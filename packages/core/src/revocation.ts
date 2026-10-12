import type { SigningKey } from "./keys.js";
import { type PublicKeys, parseToken, signLegacyToken, signToken, verifyToken } from "./token.js";

/** Prefix of revocation lists signed since 2.0: `intr2.<header>.<payload>.<signature>`. */
export const REVOCATION_PREFIX = "intr2";
/** Prefix of the revocation lists of 1.x. Still read in 2.x. */
export const LEGACY_REVOCATION_PREFIX = "intr1";

/** The signed content of a revocation list. */
export interface RevocationList {
  v: 1 | 2;
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
  /** `intr2` (default) or `intr1` for apps that still run Integral 1.x (Ed25519 key only). */
  format?: "intr1" | "intr2";
}

/**
 * Signs a list of revoked license ids with your private key. Ship the result to your app
 * (download it, bundle it, or serve it from your server) and pass the verified list to
 * `verifyLicense({ revocations })`. Works for licenses that are only ever checked offline.
 */
export async function signRevocationList(
  input: RevocationInput,
  privateKey: SigningKey,
): Promise<string> {
  const iat = input.iat ? new Date(input.iat) : new Date();
  if (Number.isNaN(iat.getTime())) throw new Error(`Invalid date: ${String(input.iat)}`);
  const legacy = input.format === "intr1";
  const list: RevocationList = {
    v: legacy ? 1 : 2,
    ...(input.product ? { product: input.product } : {}),
    iat: iat.toISOString(),
    ids: [...new Set(input.ids)].sort(),
  };
  return legacy
    ? signLegacyToken(LEGACY_REVOCATION_PREFIX, list, privateKey)
    : signToken(REVOCATION_PREFIX, list, privateKey);
}

export interface VerifyRevocationOptions {
  /** One public key, a list during key rotation, or an object `{ [kid]: publicKey }`. */
  publicKey: PublicKeys;
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
  const parsed = parseToken(token, LEGACY_REVOCATION_PREFIX, REVOCATION_PREFIX);
  const list = parsed?.payload as RevocationList | undefined;
  if (!parsed || list?.v !== parsed.format || !Array.isArray(list.ids)) return null;
  if (!(await verifyToken(parsed, options.publicKey))) return null;
  if (options.product && list.product && list.product !== options.product) return null;
  return list;
}
