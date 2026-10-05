/** A limit value. `null` means unlimited. */
export type LimitValue = number | null;

export interface LicenseCustomer {
  id?: string;
  email?: string;
  name?: string;
}

/** The signed content of an Integral license. Dates are ISO 8601 strings. */
export interface LicensePayload {
  /** Format version, always 1. */
  v: 1;
  /** Unique license id. */
  id: string;
  /** Your product, e.g. "my-app". Checked by `verifyLicense({ product })`. */
  product: string;
  /** Plan name, resolved against your plan definitions. */
  plan: string;
  /** Extra features on top of the plan. */
  features?: string[];
  /** Limits that override the plan's limits. */
  limits?: Record<string, LimitValue>;
  /** Number of seats (people or machines), if you sell per seat. */
  seats?: number;
  customer?: LicenseCustomer;
  /** Issued at. */
  iat: string;
  /** Not valid before. */
  nbf?: string;
  /** Hard expiry: the license stops working after this date. */
  exp?: string;
  /**
   * Updates end: versions released after this date are not covered,
   * older versions keep working. Use instead of `exp` for "keep what you paid for" licenses.
   */
  updatesUntil?: string;
  /** Id of the signing key, for key rotation. */
  kid?: string;
  /** Free-form data, e.g. an order id. Keep it small. */
  meta?: Record<string, string | number | boolean | null>;
}

export type LicenseInvalidReason =
  | "malformed"
  | "unsupported_version"
  | "bad_signature"
  | "wrong_product"
  | "not_yet_valid"
  | "expired";

export type LicenseVerification =
  | { valid: true; license: LicensePayload }
  | { valid: false; reason: LicenseInvalidReason; license?: LicensePayload };
