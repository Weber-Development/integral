import { toBase64Url, utf8 } from "./encoding.js";

/**
 * Builds a stable, anonymous machine id from values that identify a device, e.g. the OS
 * machine id and the user name. Only a SHA-256 hash leaves the device. Bind a license to it
 * with `signLicense({ machine })` and check it with `verifyLicense({ machine })`.
 */
export async function machineId(...parts: string[]): Promise<string> {
  const values = parts.map((part) => part.trim()).filter(Boolean);
  if (!values.length) throw new Error("machineId needs at least one non-empty value.");
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    utf8(`integral-machine\n${values.join("\n")}`),
  );
  return `m_${toBase64Url(new Uint8Array(digest)).slice(0, 32)}`;
}
