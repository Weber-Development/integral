import { fromBase64Url, fromUtf8, toBase64Url, utf8 } from "./encoding.js";
import { importPrivateKey, importPublicKey, sign, verify } from "./keys.js";
import type { RevocationList } from "./revocation.js";
import type { LicensePayload, LicenseVerification } from "./types.js";

/** Prefix of every license key. Bumped only on incompatible format changes. */
export const LICENSE_PREFIX = "int1";

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

/**
 * Signs a license with your private key and returns the license key string
 * (`int1.<payload>.<signature>`). Run this on your server or in your CLI only.
 */
export async function signLicense(input: LicenseInput, privateKey: string): Promise<string> {
  if (!input.product) throw new Error("License needs a product.");
  if (!input.plan) throw new Error("License needs a plan.");
  const payload: LicensePayload = {
    ...input,
    v: 1,
    id: input.id ?? randomId(),
    iat: toIso(input.iat) ?? new Date().toISOString(),
  };
  for (const field of ["nbf", "exp", "updatesUntil"] as const) {
    const iso = toIso(payload[field]);
    if (iso) payload[field] = iso;
  }
  const body = `${LICENSE_PREFIX}.${toBase64Url(utf8(JSON.stringify(payload)))}`;
  const key = await importPrivateKey(privateKey);
  return `${body}.${toBase64Url(await sign(key, utf8(body)))}`;
}

/**
 * Reads a license key without checking its signature. Only for display and debugging:
 * never make access decisions from it.
 */
export function decodeLicense(licenseKey: string): LicensePayload | null {
  const parts = licenseKey.trim().split(".");
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX || !parts[1]) return null;
  try {
    const payload = JSON.parse(fromUtf8(fromBase64Url(parts[1])));
    return payload && typeof payload === "object" ? (payload as LicensePayload) : null;
  } catch {
    return null;
  }
}

export interface VerifyOptions {
  /**
   * One public key, a list during key rotation, or an object `{ [kid]: publicKey }`: a license
   * with a `kid` is then checked against that key first.
   */
  publicKey: string | string[] | Record<string, string>;
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

/** Public keys to try for a license, the one named by its `kid` first. */
function keyCandidates(
  publicKey: string | string[] | Record<string, string>,
  kid: string | undefined,
): string[] {
  if (typeof publicKey === "string") return [publicKey];
  if (Array.isArray(publicKey)) return publicKey;
  const named = kid !== undefined ? publicKey[kid] : undefined;
  return [...(named ? [named] : []), ...Object.values(publicKey).filter((k) => k !== named)];
}

/** Verifies the signature, product and dates of a license key. Works offline. */
export async function verifyLicense(
  licenseKey: string,
  options: VerifyOptions,
): Promise<LicenseVerification> {
  const parts = licenseKey.trim().split(".");
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX)
    return { valid: false, reason: "malformed" };
  const license = decodeLicense(licenseKey);
  if (!license) return { valid: false, reason: "malformed" };
  if (license.v !== 1) return { valid: false, reason: "unsupported_version" };

  let signature: Uint8Array<ArrayBuffer>;
  try {
    signature = fromBase64Url(parts[2] ?? "");
  } catch {
    return { valid: false, reason: "malformed" };
  }
  const data = utf8(`${parts[0]}.${parts[1]}`);
  const keys = keyCandidates(options.publicKey, license.kid);
  let signed = false;
  for (const publicKey of keys) {
    if (await verify(await importPublicKey(publicKey), signature, data)) {
      signed = true;
      break;
    }
  }
  if (!signed) return { valid: false, reason: "bad_signature" };

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
