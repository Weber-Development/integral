import { fromBase64Url, fromUtf8, toBase64Url, utf8 } from "./encoding.js";
import { publicKeyFromPrivateKey } from "./keys.js";
import { decodeLicense, signLicense, verifyLicense } from "./license.js";
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
  privateKey: string,
  options: BindOptions = {},
): Promise<BindResult> {
  const device = machine.trim();
  if (!device) throw new Error("bindLicense needs a machine id.");
  const result = await verifyLicense(license, {
    publicKey: await publicKeyFromPrivateKey(privateKey),
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
