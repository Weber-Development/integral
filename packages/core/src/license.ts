import { toBase64Url } from "./encoding.js";
import type { SigningKey } from "./keys.js";
import type { RevocationList } from "./revocation.js";
import { type PublicKeys, parseToken, signLegacyToken, signToken, verifyToken } from "./token.js";
import type { LicensePayload, LicenseVerification } from "./types.js";

/** Prefix of license keys issued since 2.0: `int2.<header>.<payload>.<signature>`. */
export const LICENSE_PREFIX = "int2";
/** Prefix of the license keys of 1.x: `int1.<payload>.<signature>`. Still read in 2.x. */
export const LEGACY_LICENSE_PREFIX = "int1";

export type LicenseInput = Omit<LicensePayload, "v" | "id" | "iat"> & {
  id?: string;
  iat?: string;
};

function randomId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return `lic_${toBase64Url(bytes)}`;
}

function toIso(value: string | Date | undefined): string | undefined {
  if (value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${String(value)}`);
  return date.toISOString();
}

export interface SignOptions {
  /** `int2` (default) or `int1` for apps that still run Integral 1.x. `int1` needs an Ed25519 key. */
  format?: "int1" | "int2";
}

/**
 * Signs a license and returns the license key string (`int2.<header>.<payload>.<signature>`).
 * `privateKey` is a PKCS#8 key from `generateKeyPair` (Ed25519 or P-256) or a `Signer` for a key
 * in a KMS. Run this on your server or in your CLI only.
 */
export async function signLicense(
  input: LicenseInput,
  privateKey: SigningKey,
  options: SignOptions = {},
): Promise<string> {
  if (!input.product) throw new Error("License needs a product.");
  if (!input.plan) throw new Error("License needs a plan.");
  const legacy = options.format === "int1";
  const payload: LicensePayload = {
    ...input,
    v: legacy ? 1 : 2,
    id: input.id ?? randomId(),
    iat: toIso(input.iat) ?? new Date().toISOString(),
  };
  for (const field of ["nbf", "exp", "updatesUntil"] as const) {
    const iso = toIso(payload[field]);
    if (iso) payload[field] = iso;
  }
  return legacy
    ? signLegacyToken(LEGACY_LICENSE_PREFIX, payload, privateKey)
    : signToken(LICENSE_PREFIX, payload, privateKey);
}

/**
 * Reads a license key without checking its signature. Only for display and debugging:
 * never make access decisions from it.
 */
export function decodeLicense(licenseKey: string): LicensePayload | null {
  const parsed = parseToken(licenseKey, LEGACY_LICENSE_PREFIX, LICENSE_PREFIX);
  const payload = parsed?.payload;
  return payload && typeof payload === "object" ? (payload as LicensePayload) : null;
}

export interface VerifyOptions {
  /**
   * One public key, a list during key rotation, or an object `{ [kid]: publicKey }`: a license
   * with a `kid` is then checked against that key first.
   */
  publicKey: PublicKeys;
  /** Expected product. A license for another product is rejected. */
  product?: string;
  /** Current time, for tests. */
  now?: Date;
  /** Allowed clock difference in seconds for `nbf` and `exp`. Default 300. */
  clockTolerance?: number;
  /**
   * Revoked license ids: a list checked with `verifyRevocationList()`, or plain ids you
   * already trust. A revoked license is rejected with reason "revoked".
   */
  revocations?: RevocationList | Iterable<string> | null;
  /**
   * The current device's id from `machineId()`. A license bound to another device (or bound
   * to any device while this option is missing) is rejected with reason "wrong_machine".
   */
  machine?: string;
}

/** Verifies the signature, product and dates of a license key. Works offline. */
export async function verifyLicense(
  licenseKey: string,
  options: VerifyOptions,
): Promise<LicenseVerification> {
  const parsed = parseToken(licenseKey, LEGACY_LICENSE_PREFIX, LICENSE_PREFIX);
  const license = decodeLicense(licenseKey);
  if (!parsed || !license) return { valid: false, reason: "malformed" };
  if (license.v !== parsed.format) return { valid: false, reason: "unsupported_version" };
  if (!(await verifyToken(parsed, options.publicKey, license.kid))) {
    return { valid: false, reason: "bad_signature" };
  }

  if (options.product && license.product !== options.product) {
    return { valid: false, reason: "wrong_product", license };
  }
  const now = (options.now ?? new Date()).getTime();
  const tolerance = (options.clockTolerance ?? 300) * 1000;
  if (license.nbf && now + tolerance < Date.parse(license.nbf)) {
    return { valid: false, reason: "not_yet_valid", license };
  }
  if (license.exp && now - tolerance > Date.parse(license.exp)) {
    return { valid: false, reason: "expired", license };
  }
  if (options.revocations) {
    const ids =
      "ids" in options.revocations && Array.isArray(options.revocations.ids)
        ? options.revocations.ids
        : (options.revocations as Iterable<string>);
    for (const id of ids) {
      if (id === license.id) return { valid: false, reason: "revoked", license };
    }
  }
  if (license.machine && license.machine !== options.machine) {
    return { valid: false, reason: "wrong_machine", license };
  }
  return { valid: true, license };
}

/**
 * True if a release from `releasedAt` is covered by the license's update period.
 * Licenses without `updatesUntil` cover every version.
 */
export function coversRelease(license: LicensePayload, releasedAt: string | Date): boolean {
  if (!license.updatesUntil) return true;
  const released = releasedAt instanceof Date ? releasedAt.getTime() : Date.parse(releasedAt);
  return released <= Date.parse(license.updatesUntil);
}
