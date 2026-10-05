import { describe, expect, it, vi } from "vitest";
import { createPolarClient, PolarError } from "../src/polar.js";

const ORG = "11111111-1111-4111-8111-111111111111";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  });
}

const key = {
  id: "k1",
  organization_id: ORG,
  customer_id: "c1",
  benefit_id: "b1",
  key: "ABC-123",
  display_key: "****-123",
  status: "granted",
  limit_activations: 3,
  usage: 0,
  limit_usage: null,
  validations: 1,
  last_validated_at: null,
  expires_at: null,
  activation: null,
};

describe("polar", () => {
  it("validates a granted key and sends the organization id", async () => {
    const fetch = mockFetch(200, key);
    const polar = createPolarClient({ organizationId: ORG, fetch });
    const result = await polar.validate(" ABC-123 ", { incrementUsage: 1 });
    expect(result.valid).toBe(true);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://api.polar.sh/v1/customer-portal/license-keys/validate");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      key: "ABC-123",
      organization_id: ORG,
      increment_usage: 1,
    });
  });

  it("uses the sandbox", async () => {
    const fetch = mockFetch(200, key);
    await createPolarClient({ organizationId: ORG, sandbox: true, fetch }).validate("x");
    expect(fetch.mock.calls[0]?.[0]).toMatch(/^https:\/\/sandbox-api\.polar\.sh\//);
  });

  it("maps 404, 400, expiry and benefit mismatch", async () => {
    const notFound = createPolarClient({
      organizationId: ORG,
      fetch: mockFetch(404, { detail: "nope" }),
    });
    expect(await notFound.validate("x")).toEqual({
      valid: false,
      reason: "invalid",
      message: "nope",
    });
    const usage = createPolarClient({ organizationId: ORG, fetch: mockFetch(400, {}) });
    expect(await usage.validate("x")).toMatchObject({ reason: "usage_exceeded" });
    const expired = createPolarClient({
      organizationId: ORG,
      fetch: mockFetch(200, { ...key, expires_at: "2020-01-01T00:00:00Z" }),
    });
    expect(await expired.validate("x")).toMatchObject({ valid: false, reason: "invalid" });
    const other = createPolarClient({
      organizationId: ORG,
      benefitId: "b2",
      fetch: mockFetch(200, key),
    });
    expect(await other.validate("x")).toMatchObject({ reason: "wrong_benefit" });
  });

  it("throws on server errors so offline grace can kick in", async () => {
    const polar = createPolarClient({ organizationId: ORG, fetch: mockFetch(502, undefined) });
    await expect(polar.validate("x")).rejects.toBeInstanceOf(PolarError);
  });

  it("activates and deactivates", async () => {
    const activation = { id: "a1", license_key_id: "k1", label: "laptop", meta: {} };
    const polar = createPolarClient({ organizationId: ORG, fetch: mockFetch(200, activation) });
    expect(await polar.activate("x", { label: "laptop" })).toMatchObject({
      valid: true,
      data: { id: "a1" },
    });
    const limited = createPolarClient({ organizationId: ORG, fetch: mockFetch(403, {}) });
    expect(await limited.activate("x", { label: "y" })).toMatchObject({
      reason: "activation_limit",
    });
    const off = createPolarClient({ organizationId: ORG, fetch: mockFetch(204, undefined) });
    await expect(off.deactivate("x", "a1")).resolves.toBeUndefined();
  });
});
