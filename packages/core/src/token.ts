import { fromBase64Url, fromUtf8, toBase64Url, utf8 } from "./encoding.js";
import {
  type Algorithm,
  publicKeyAlgorithm,
  type SigningKey,
  toSigner,
  verifySignature,
} from "./keys.js";

/** Public keys to check a signature against: one, a list during rotation, or `{ [kid]: key }`. */
export type PublicKeys = string | string[] | Record<string, string>;

export interface TokenHeader {
  alg: Algorithm;
  kid?: string;
}

export interface ParsedToken {
  /** `1` for the old three part format (`int1`, `intr1`), `2` for the format with a header. */
  format: 1 | 2;
  header: TokenHeader;
  payload: unknown;
  signature: Uint8Array<ArrayBuffer>;
  /** The bytes that were signed. */
  signed: Uint8Array<ArrayBuffer>;
}

/** Signs `payload` as `<prefix>.<header>.<payload>.<signature>`. */
export async function signToken(prefix: string, payload: object, key: SigningKey): Promise<string> {
  const signer = await toSigner(key);
  const header: TokenHeader = { alg: signer.alg, ...(signer.kid ? { kid: signer.kid } : {}) };
  const body = `${prefix}.${toBase64Url(utf8(JSON.stringify(header)))}.${toBase64Url(utf8(JSON.stringify(payload)))}`;
  return `${body}.${toBase64Url(await signer.sign(utf8(body)))}`;
}

/** Signs `payload` in the old format `<prefix>.<payload>.<signature>` (Ed25519 only). */
export async function signLegacyToken(
  prefix: string,
  payload: object,
  key: SigningKey,
): Promise<string> {
  const signer = await toSigner(key);
  if (signer.alg !== "EdDSA") throw new Error("The old format supports Ed25519 keys only.");
  const body = `${prefix}.${toBase64Url(utf8(JSON.stringify(payload)))}`;
  return `${body}.${toBase64Url(await signer.sign(utf8(body)))}`;
}

/** Splits a token of either format. Does not check the signature. */
export function parseToken(
  token: string,
  legacyPrefix: string,
  prefix: string,
): ParsedToken | null {
  const parts = token.trim().split(".");
  try {
    if (parts[0] === legacyPrefix && parts.length === 3 && parts[1] && parts[2]) {
      return {
        format: 1,
        header: { alg: "EdDSA" },
        payload: JSON.parse(fromUtf8(fromBase64Url(parts[1]))),
        signature: fromBase64Url(parts[2]),
        signed: utf8(`${parts[0]}.${parts[1]}`),
      };
    }
    if (parts[0] === prefix && parts.length === 4 && parts[1] && parts[2] && parts[3]) {
      const header = JSON.parse(fromUtf8(fromBase64Url(parts[1]))) as TokenHeader;
      if (header?.alg !== "EdDSA" && header?.alg !== "ES256") return null;
      return {
        format: 2,
        header,
        payload: JSON.parse(fromUtf8(fromBase64Url(parts[2]))),
        signature: fromBase64Url(parts[3]),
        signed: utf8(`${parts[0]}.${parts[1]}.${parts[2]}`),
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** The keys to try, the one named by `kid` first, only those of the token's algorithm. */
function candidates(keys: PublicKeys, kid: string | undefined, alg: Algorithm): string[] {
  let list: string[];
  if (typeof keys === "string") list = [keys];
  else if (Array.isArray(keys)) list = keys;
  else {
    const named = kid !== undefined ? keys[kid] : undefined;
    list = [...(named ? [named] : []), ...Object.values(keys).filter((k) => k !== named)];
  }
  return list.filter((key) => {
    try {
      return publicKeyAlgorithm(key) === alg;
    } catch {
      return false;
    }
  });
}

/** True if one of the keys signed the token. A `kid` in the header or payload picks the key first. */
export async function verifyToken(
  token: ParsedToken,
  keys: PublicKeys,
  payloadKid?: string,
): Promise<boolean> {
  for (const key of candidates(keys, token.header.kid ?? payloadKid, token.header.alg)) {
    if (await verifySignature(key, token.signature, token.signed)) return true;
  }
  return false;
}
