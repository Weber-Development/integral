import { fromBase64Url, toBase64Url } from "./encoding.js";

/** Signature algorithm of a key: Ed25519 (`EdDSA`) or ECDSA with P-256 and SHA-256 (`ES256`). */
export type Algorithm = "EdDSA" | "ES256";

const ED25519 = { name: "Ed25519" } as const;
const ES256 = { name: "ECDSA", namedCurve: "P-256" } as const;
const ES256_SIGN = { name: "ECDSA", hash: "SHA-256" } as const;

/** Prefix of public keys that are not Ed25519. An Ed25519 public key is the bare base64url string. */
export const P256_PREFIX = "p256.";

export interface KeyPair {
  /**
   * Public key. Ed25519: base64url raw key (32 bytes). ES256: `p256.` followed by the base64url
   * uncompressed point (65 bytes). Safe to ship in your app.
   */
  publicKey: string;
  /** Base64url PKCS#8 private key. Keep it secret, server side only. */
  privateKey: string;
}

/**
 * Signs data with a key that never leaves its place, e.g. a key in a KMS or HSM. `sign` returns
 * the signature: raw 64 bytes for Ed25519, and for ES256 the raw `r || s` form (64 bytes; use
 * `ecdsaDerToRaw` for the DER form that most KMS return).
 */
export interface Signer {
  alg: Algorithm;
  /** Id of the key, written into the license header. */
  kid?: string;
  sign(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array>;
}

/** A PKCS#8 private key string, or a `Signer`. */
export type SigningKey = string | Signer;

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("Integral needs the Web Crypto API (Node 22+, modern browsers).");
  return c.subtle;
}

/** Creates a new signing key pair. Ed25519 by default; `{ alg: "ES256" }` for P-256. */
export async function generateKeyPair(options: { alg?: Algorithm } = {}): Promise<KeyPair> {
  if (options.alg === "ES256") {
    const pair = (await subtle().generateKey(ES256, true, ["sign", "verify"])) as CryptoKeyPair;
    const [pub, priv] = await Promise.all([
      subtle().exportKey("raw", pair.publicKey),
      subtle().exportKey("pkcs8", pair.privateKey),
    ]);
    return {
      publicKey: `${P256_PREFIX}${toBase64Url(new Uint8Array(pub))}`,
      privateKey: toBase64Url(new Uint8Array(priv)),
    };
  }
  const pair = (await subtle().generateKey(ED25519, true, ["sign", "verify"])) as CryptoKeyPair;
  const [pub, priv] = await Promise.all([
    subtle().exportKey("raw", pair.publicKey),
    subtle().exportKey("pkcs8", pair.privateKey),
  ]);
  return {
    publicKey: toBase64Url(new Uint8Array(pub)),
    privateKey: toBase64Url(new Uint8Array(priv)),
  };
}

/** The algorithm a public key string belongs to. */
export function publicKeyAlgorithm(publicKey: string): Algorithm {
  return publicKey.trim().startsWith(P256_PREFIX) ? "ES256" : "EdDSA";
}

export async function importPublicKey(publicKey: string): Promise<CryptoKey> {
  const text = publicKey.trim();
  if (text.startsWith(P256_PREFIX)) {
    const raw = fromBase64Url(text.slice(P256_PREFIX.length));
    if (raw.length !== 65 || raw[0] !== 4) {
      throw new Error("ES256 public key must be a 65 byte uncompressed P-256 point (base64url).");
    }
    return subtle().importKey("raw", raw, ES256, false, ["verify"]);
  }
  const raw = fromBase64Url(text);
  if (raw.length !== 32) throw new Error("Public key must be a 32 byte Ed25519 key (base64url).");
  return subtle().importKey("raw", raw, ED25519, false, ["verify"]);
}

/** Turns a private key string into a `Signer`. Ed25519 and P-256 keys are told apart by import. */
export async function importSigner(privateKey: string, kid?: string): Promise<Signer> {
  const der = fromBase64Url(privateKey.trim());
  try {
    const key = await subtle().importKey("pkcs8", der, ED25519, false, ["sign"]);
    return {
      alg: "EdDSA",
      kid,
      sign: async (data) => new Uint8Array(await subtle().sign(ED25519, key, data)),
    };
  } catch {
    const key = await subtle().importKey("pkcs8", der, ES256, false, ["sign"]);
    return {
      alg: "ES256",
      kid,
      sign: async (data) => new Uint8Array(await subtle().sign(ES256_SIGN, key, data)),
    };
  }
}

/** A `Signer` for a private key string or a ready `Signer`. */
export async function toSigner(key: SigningKey): Promise<Signer> {
  return typeof key === "string" ? importSigner(key) : key;
}

export async function verifySignature(
  publicKey: string,
  signature: Uint8Array<ArrayBuffer>,
  data: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  const key = await importPublicKey(publicKey);
  return publicKeyAlgorithm(publicKey) === "ES256"
    ? subtle().verify(ES256_SIGN, key, signature, data)
    : subtle().verify(ED25519, key, signature, data);
}

/**
 * Derives the public key from a private key, e.g. on a server that only stores the private key.
 * Returns the same string format as `generateKeyPair`.
 */
export async function publicKeyFromPrivateKey(privateKey: string): Promise<string> {
  const der = fromBase64Url(privateKey.trim());
  try {
    const key = await subtle().importKey("pkcs8", der, ED25519, true, ["sign"]);
    const jwk = await subtle().exportKey("jwk", key);
    if (!jwk.x) throw new Error("Could not derive the public key.");
    return jwk.x;
  } catch {
    const key = await subtle().importKey("pkcs8", der, ES256, true, ["sign"]);
    const jwk = await subtle().exportKey("jwk", key);
    if (!jwk.x || !jwk.y) throw new Error("Could not derive the public key.");
    const point = new Uint8Array(65);
    point[0] = 4;
    point.set(fromBase64Url(jwk.x), 1);
    point.set(fromBase64Url(jwk.y), 33);
    return `${P256_PREFIX}${toBase64Url(point)}`;
  }
}

/**
 * Converts an ECDSA signature in DER form (what AWS KMS, Google Cloud KMS and Azure return)
 * into the raw `r || s` form of 64 bytes that Integral uses for ES256.
 */
export function ecdsaDerToRaw(der: Uint8Array): Uint8Array<ArrayBuffer> {
  let offset = 0;
  const byte = () => {
    const value = der[offset++];
    if (value === undefined) throw new Error("Invalid DER signature.");
    return value;
  };
  if (byte() !== 0x30) throw new Error("Invalid DER signature.");
  const seqLength = byte();
  if (seqLength & 0x80) offset += seqLength & 0x7f; // long form length of the sequence
  const read = (): Uint8Array => {
    if (byte() !== 0x02) throw new Error("Invalid DER signature.");
    const length = byte();
    const value = der.slice(offset, offset + length);
    offset += length;
    return value;
  };
  const raw = new Uint8Array(64);
  for (const [index, part] of [read(), read()].entries()) {
    let trimmed = part;
    while (trimmed.length > 32 && trimmed[0] === 0) trimmed = trimmed.slice(1);
    if (trimmed.length > 32) throw new Error("Invalid DER signature.");
    raw.set(trimmed, index * 32 + (32 - trimmed.length));
  }
  return raw;
}
