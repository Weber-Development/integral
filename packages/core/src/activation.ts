import { fromBase64Url, fromUtf8, toBase64Url, utf8 } from "./encoding.js";
import { publicKeyFromPrivateKey, type SigningKey } from "./keys.js";
import { decodeLicense, signLicense, verifyLicense } from "./license.js";
import { type PublicKeys, parseToken, verifyToken } from "./token.js";
import type { LicenseInvalidReason, LicensePayload } from "./types.js";

/** Prefix of an activation request. */
export const ACTIVATION_PREFIX = "intq1";

/** What a device sends to get its license bound to it, online or as a file. */
export interface ActivationRequest {
  v: 1;
  /** The license key to bind. */
  license: string;
  /** Device id from `machineId()`. */
  machine: string;
  /** Shown to the customer when they manage their devices, e.g. "Office laptop". */
  label?: string;
  iat: string;
}

export interface ActivationRequestInput {
  license: string;
  machine: string;
  label?: string;
  iat?: string | Date;
}

/**
 * Packs a license and a device id into one string (`intq1.…`), e.g. to save as a file on a
 * computer without internet. Not signed: the server checks the license inside it.
 */
export function createActivationRequest(input: ActivationRequestInput): string {
  if (!decodeLicense(input.license)) throw new Error("Not an Integral license key.");
  if (!input.machine.trim()) throw new Error("Activation request needs a machine id.");
  const iat = input.iat ? new Date(input.iat) : new Date();
  if (Number.isNaN(iat.getTime())) throw new Error(`Invalid date: ${String(input.iat)}`);
  const request: ActivationRequest = {
    v: 1,
    license: input.license.trim(),
    machine: input.machine.trim(),
    ...(input.label ? { label: input.label } : {}),
    iat: iat.toISOString(),
  };
  return `${ACTIVATION_PREFIX}.${toBase64Url(utf8(JSON.stringify(request)))}`;
}

/** Reads an activation request, or returns `null` if it is malformed. */
export function readActivationRequest(token: string): ActivationRequest | null {
  const parts = token.trim().split(".");
  if (parts.length !== 2 || parts[0] !== ACTIVATION_PREFIX || !parts[1]) return null;
  try {
    const request = JSON.parse(fromUtf8(fromBase64Url(parts[1]))) as ActivationRequest;
    if (
      request?.v !== 1 ||
      typeof request.license !== "string" ||
      typeof request.machine !== "string" ||
      !request.machine
    ) {
      return null;
    }
    return request;
  } catch {
    return null;
  }
}

export interface BindOptions {
  /**
   * Public key(s) to check the license with. Needed when `privateKey` is a `Signer` (KMS);
   * with a private key string it is derived from it. Pass all keys while rotating.
   */
  publicKey?: PublicKeys;
  /** Expected product. A license for another product is refused. */
  product?: string;
  /** Current time, for tests. */
  now?: Date;
}

export type BindResult =
  | { ok: true; license: string; payload: LicensePayload }
  | { ok: false; reason: LicenseInvalidReason | "bound_elsewhere" };

/**
 * Checks a license with the public key of `privateKey` and signs a copy bound to one device.
 * The copy keeps the id, plan, dates and features, so revocation lists and renewals still match.
 * A license already bound to another device is refused.
 */
export async function bindLicense(
  license: string,
  machine: string,
  privateKey: SigningKey,
  options: BindOptions = {},
): Promise<BindResult> {
  const device = machine.trim();
  if (!device) throw new Error("bindLicense needs a machine id.");
  const result = await verifyLicense(license, {
    publicKey: options.publicKey ?? (await publicKeyOf(privateKey)),
    product: options.product,
    now: options.now,
    machine: device,
  });
  if (!result.valid) {
    return {
      ok: false,
      reason: result.reason === "wrong_machine" ? "bound_elsewhere" : result.reason,
    };
  }
  const { v: _v, iat: _iat, ...payload } = result.license;
  const bound = await signLicense(
    { ...payload, machine: device, iat: (options.now ?? new Date()).toISOString() },
    privateKey,
  );
  return { ok: true, license: bound, payload: decodeLicense(bound) as LicensePayload };
}

async function publicKeyOf(key: SigningKey): Promise<string> {
  if (typeof key !== "string") {
    throw new Error("Pass options.publicKey when signing with a Signer.");
  }
  return publicKeyFromPrivateKey(key);
}

export interface UpgradeOptions {
  /** Public key(s) the old license was signed with. Default: the key of `privateKey`. */
  publicKey?: PublicKeys;
}

export type UpgradeResult =
  | { ok: true; license: string; payload: LicensePayload }
  | { ok: false; reason: "malformed" | "bad_signature" };

/**
 * Signs an `int1` license again as `int2` with the same id, plan, dates, device and customer, so
 * revocation lists and renewals still match. Only the signature and format change. Expired
 * licenses are converted too; an `int2` license is returned as it is.
 */
export async function upgradeLicense(
  license: string,
  privateKey: SigningKey,
  options: UpgradeOptions = {},
): Promise<UpgradeResult> {
  const parsed = parseToken(license, "int1", "int2");
  const payload = decodeLicense(license);
  if (!parsed || !payload) return { ok: false, reason: "malformed" };
  const keys = options.publicKey ?? (await publicKeyOf(privateKey));
  if (!(await verifyToken(parsed, keys, payload.kid)))
    return { ok: false, reason: "bad_signature" };
  if (parsed.format === 2) return { ok: true, license: license.trim(), payload };
  const { v: _v, ...rest } = payload;
  const upgraded = await signLicense(rest, privateKey);
  return { ok: true, license: upgraded, payload: decodeLicense(upgraded) as LicensePayload };
}
