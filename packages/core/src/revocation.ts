import { fromBase64Url, fromUtf8, toBase64Url, utf8 } from "./encoding.js";
import { importPrivateKey, importPublicKey, sign, verify } from "./keys.js";

/** Prefix of a signed revocation list. */
export const REVOCATION_PREFIX = "intr1";

/** The signed content of a revocation list. */
export interface RevocationList {
  v: 1;
  /** Product the list belongs to. Checked by `verifyRevocationList({ product })`. */
  product?: string;
  /** Issued at. A newer list replaces an older one. */
  iat: string;
  /** Ids of revoked licenses. */
  ids: string[];
}

export interface RevocationInput {
  ids: Iterable<string>;
  product?: string;
  iat?: string | Date;
}

/**
 * Signs a list of revoked license ids with your private key. Ship the result to your app
 * (download it, bundle it, or serve it from your server) and pass the verified list to
 * `verifyLicense({ revocations })`. Works for licenses that are only ever checked offline.
 */
export async function signRevocationList(
  input: RevocationInput,
  privateKey: string,
): Promise<string> {
  const iat = input.iat ? new Date(input.iat) : new Date();
  if (Number.isNaN(iat.getTime())) throw new Error(`Invalid date: ${String(input.iat)}`);
  const list: RevocationList = {
    v: 1,
    ...(input.product ? { product: input.product } : {}),
    iat: iat.toISOString(),
    ids: [...new Set(input.ids)].sort(),
  };
  const body = `${REVOCATION_PREFIX}.${toBase64Url(utf8(JSON.stringify(list)))}`;
  const key = await importPrivateKey(privateKey);
  return `${body}.${toBase64Url(await sign(key, utf8(body)))}`;
}

export interface VerifyRevocationOptions {
  /** One public key, or several during key rotation. */
  publicKey: string | string[];
  /** Expected product. A list for another product is rejected. */
  product?: string;
}

/**
 * Checks the signature of a revocation list and returns its content, or `null` if the list
 * is malformed, signed with another key or meant for another product.
 */
export async function verifyRevocationList(
  token: string,
  options: VerifyRevocationOptions,
): Promise<RevocationList | null> {
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== REVOCATION_PREFIX || !parts[1] || !parts[2]) return null;
  let list: RevocationList;
  let signature: Uint8Array<ArrayBuffer>;
  try {
    list = JSON.parse(fromUtf8(fromBase64Url(parts[1])));
    signature = fromBase64Url(parts[2]);
  } catch {
    return null;
  }
  if (list?.v !== 1 || !Array.isArray(list.ids)) return null;
  const data = utf8(`${parts[0]}.${parts[1]}`);
  const keys = Array.isArray(options.publicKey) ? options.publicKey : [options.publicKey];
  let signed = false;
  for (const publicKey of keys) {
    if (await verify(await importPublicKey(publicKey), signature, data)) {
      signed = true;
      break;
    }
  }
  if (!signed) return null;
  if (options.product && list.product && list.product !== options.product) return null;
  return list;
}
