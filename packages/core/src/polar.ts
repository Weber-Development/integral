/**
 * Polar.sh license keys (benefit type "License Keys"). Uses Polar's public customer portal
 * endpoints, which need no access token and are safe to call from apps and browsers.
 */

export interface PolarActivation {
  id: string;
  license_key_id: string;
  label: string;
  meta: Record<string, string | number | boolean>;
  created_at: string;
  modified_at: string | null;
}

export interface PolarLicenseKey {
  id: string;
  organization_id: string;
  customer_id: string;
  benefit_id: string;
  key: string;
  display_key: string;
  status: "granted" | "revoked" | "disabled";
  limit_activations: number | null;
  usage: number;
  limit_usage: number | null;
  validations: number;
  last_validated_at: string | null;
  expires_at: string | null;
  activation: PolarActivation | null;
  customer?: { id: string; email?: string; name?: string | null };
  [key: string]: unknown;
}

export type PolarReason =
  /** Unknown, revoked, disabled or expired key, or activation or conditions do not match. */
  | "invalid"
  /** `increment_usage` exceeds the remaining usage. */
  | "usage_exceeded"
  /** The activation limit of the key is reached. */
  | "activation_limit"
  /** The key belongs to another benefit than the one you expect. */
  | "wrong_benefit";

export type PolarResult<T> =
  | { valid: true; data: T }
  | { valid: false; reason: PolarReason; message?: string };

export interface PolarClientOptions {
  /** Your Polar organization id (Settings → General). */
  organizationId: string;
  /** Only accept keys of this benefit, recommended if you sell more than one product. */
  benefitId?: string;
  /** Use Polar's sandbox. */
  sandbox?: boolean;
  /** Custom API origin, for tests or a proxy. */
  baseUrl?: string;
  fetch?: typeof fetch;
}

export class PolarError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PolarError";
  }
}

export interface ValidateOptions {
  activationId?: string;
  /** Count usage, e.g. one per generated report. */
  incrementUsage?: number;
  /** Must match the conditions given at activation, e.g. `{ major_version: 2 }`. */
  conditions?: Record<string, string | number | boolean>;
}

export interface ActivateOptions {
  /** Shown to the customer in Polar's portal, e.g. the machine or domain name. */
  label: string;
  conditions?: Record<string, string | number | boolean>;
  meta?: Record<string, string | number | boolean>;
}

export interface PolarClient {
  validate(key: string, options?: ValidateOptions): Promise<PolarResult<PolarLicenseKey>>;
  activate(key: string, options: ActivateOptions): Promise<PolarResult<PolarActivation>>;
  deactivate(key: string, activationId: string): Promise<void>;
}

function messageOf(body: unknown): string | undefined {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    return typeof detail === "string" ? detail : JSON.stringify(detail);
  }
  return undefined;
}

/**
 * Creates a client for Polar license keys. Network failures and unexpected server errors throw
 * (`PolarError` or the fetch error), so you can tell "invalid" apart from "Polar unreachable".
 * Combine with `withOfflineGrace` from `@sweberdev/integral` to keep apps working offline.
 */
export function createPolarClient(options: PolarClientOptions): PolarClient {
  const origin =
    options.baseUrl ?? (options.sandbox ? "https://sandbox-api.polar.sh" : "https://api.polar.sh");
  const doFetch = options.fetch ?? globalThis.fetch;

  async function post(path: string, body: Record<string, unknown>) {
    const response = await doFetch(`${origin}/v1/customer-portal/license-keys/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ organization_id: options.organizationId, ...body }),
    });
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: response.status, json };
  }

  function fail(status: number, json: unknown): never {
    throw new PolarError(messageOf(json) ?? `Polar answered with HTTP ${status}`, status);
  }

  return {
    async validate(key, opts = {}) {
      const { status, json } = await post("validate", {
        key: key.trim(),
        activation_id: opts.activationId,
        benefit_id: options.benefitId,
        increment_usage: opts.incrementUsage,
        conditions: opts.conditions,
      });
      if (status === 200) {
        const data = json as PolarLicenseKey;
        if (options.benefitId && data.benefit_id !== options.benefitId) {
          return { valid: false, reason: "wrong_benefit" };
        }
        if (data.status !== "granted") return { valid: false, reason: "invalid" };
        if (data.expires_at && Date.parse(data.expires_at) < Date.now()) {
          return { valid: false, reason: "invalid", message: "License key expired" };
        }
        return { valid: true, data };
      }
      if (status === 404) return { valid: false, reason: "invalid", message: messageOf(json) };
      if (status === 400)
        return { valid: false, reason: "usage_exceeded", message: messageOf(json) };
      fail(status, json);
    },

    async activate(key, opts) {
      const { status, json } = await post("activate", {
        key: key.trim(),
        label: opts.label,
        conditions: opts.conditions,
        meta: opts.meta,
      });
      if (status === 200 || status === 201) return { valid: true, data: json as PolarActivation };
      if (status === 404) return { valid: false, reason: "invalid", message: messageOf(json) };
      if (status === 403) {
        return { valid: false, reason: "activation_limit", message: messageOf(json) };
      }
      fail(status, json);
    },

    async deactivate(key, activationId) {
      const { status, json } = await post("deactivate", {
        key: key.trim(),
        activation_id: activationId,
      });
      if (status === 204 || status === 200 || status === 404) return;
      fail(status, json);
    },
  };
}
