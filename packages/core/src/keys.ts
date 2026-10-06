import { fromBase64Url, toBase64Url } from "./encoding.js";

const ED25519 = { name: "Ed25519" } as const;

export interface KeyPair {
  /** Base64url raw public key (32 bytes). Safe to ship in your app. */
  publicKey: string;
  /** Base64url PKCS#8 private key. Keep it secret, server side only. */
  privateKey: string;
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("Integral needs the Web Crypto API (Node 20+, modern browsers).");
  return c.subtle;
}

/** Creates a new Ed25519 signing key pair. */
export async function generateKeyPair(): Promise<KeyPair> {
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

export async function importPublicKey(publicKey: string): Promise<CryptoKey> {
  const raw = fromBase64Url(publicKey.trim());
  if (raw.length !== 32) throw new Error("Public key must be a 32 byte Ed25519 key (base64url).");
  return subtle().importKey("raw", raw, ED25519, false, ["verify"]);
}

export async function importPrivateKey(privateKey: string): Promise<CryptoKey> {
  return subtle().importKey("pkcs8", fromBase64Url(privateKey.trim()), ED25519, false, ["sign"]);
}

export async function sign(key: CryptoKey, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  return new Uint8Array(await subtle().sign(ED25519, key, data));
}

export async function verify(
  key: CryptoKey,
  signature: Uint8Array<ArrayBuffer>,
  data: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  return subtle().verify(ED25519, key, signature, data);
}

/** Derives the public key from a private key, e.g. on a server that only stores the private key. */
export async function publicKeyFromPrivateKey(privateKey: string): Promise<string> {
  const key = await subtle().importKey("pkcs8", fromBase64Url(privateKey.trim()), ED25519, true, [
    "sign",
  ]);
  const jwk = await subtle().exportKey("jwk", key);
  if (!jwk.x) throw new Error("Could not derive the public key.");
  return jwk.x;
}
