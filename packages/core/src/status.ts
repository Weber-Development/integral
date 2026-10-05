import type { LicensePayload } from "./types.js";

const DAY = 24 * 60 * 60 * 1000;

export type LicenseState = "active" | "expiring" | "expired" | "not_yet_valid";

export interface LicenseStatus {
  state: LicenseState;
  /** True for trial licenses (`trial: true`). */
  trial: boolean;
  /** Whole days until `exp`, rounded up. `null` for licenses without expiry. */
  daysLeft: number | null;
  /** True once `updatesUntil` has passed. Older versions keep working. */
  updatesEnded: boolean;
  /** Whole days until `updatesUntil`, rounded up. `null` without an update period. */
  updatesDaysLeft: number | null;
}

export interface LicenseStatusOptions {
  /** Current time, for tests. */
  now?: Date;
  /** A license counts as "expiring" this many days before `exp`. Default 14. */
  warnDays?: number;
}

function daysUntil(date: string | undefined, now: number): number | null {
  if (!date) return null;
  return Math.ceil((Date.parse(date) - now) / DAY);
}

/**
 * Summarizes a verified license for your UI: active, expiring soon, expired, trial,
 * and how many days are left of the license and of its update period.
 */
export function licenseStatus(
  license: LicensePayload,
  options: LicenseStatusOptions = {},
): LicenseStatus {
  const now = (options.now ?? new Date()).getTime();
  const warnDays = options.warnDays ?? 14;
  const daysLeft = daysUntil(license.exp, now);
  const updatesDaysLeft = daysUntil(license.updatesUntil, now);
  let state: LicenseState = "active";
  if (license.nbf && Date.parse(license.nbf) > now) state = "not_yet_valid";
  else if (license.exp && Date.parse(license.exp) <= now) state = "expired";
  else if (daysLeft !== null && daysLeft <= warnDays) state = "expiring";
  return {
    state,
    trial: license.trial === true,
    daysLeft,
    updatesEnded: license.updatesUntil ? Date.parse(license.updatesUntil) <= now : false,
    updatesDaysLeft,
  };
}
