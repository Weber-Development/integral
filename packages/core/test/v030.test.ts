import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import {
  bindLicense,
  createActivationRequest,
  decodeLicense,
  generateKeyPair,
  publicKeyFromPrivateKey,
  readActivationRequest,
  signLicense,
  verifyLicense,
} from "../src/index.js";

const pair = await generateKeyPair();

function capture() {
  const lines: string[] = [];
  const errors: string[] = [];
  const out = {
    log: (line: string) => lines.push(line),
    error: (line: string) => errors.push(line),
  } as unknown as Console;
  return { out, lines, errors };
}

describe("publicKeyFromPrivateKey", () => {
  it("derives the matching public key", async () => {
    expect(await publicKeyFromPrivateKey(pair.privateKey)).toBe(pair.publicKey);
  });
});

describe("activation requests", () => {
  it("round-trips license, machine and label", async () => {
    const license = await signLicense({ product: "app", plan: "pro" }, pair.privateKey);
    const token = createActivationRequest({ license, machine: "m_1", label: "Laptop" });
    expect(token.startsWith("intq1.")).toBe(true);
    expect(readActivationRequest(token)).toMatchObject({
      v: 1,
      license,
      machine: "m_1",
      label: "Laptop",
    });
  });

  it("rejects malformed requests", () => {
    expect(readActivationRequest("nope")).toBeNull();
    expect(readActivationRequest("intq1.###")).toBeNull();
    expect(() => createActivationRequest({ license: "x", machine: "m" })).toThrow();
  });
});

describe("bindLicense", () => {
  it("signs a copy bound to one device with the same id", async () => {
    const license = await signLicense(
      { product: "app", plan: "pro", id: "lic_bind", updatesUntil: "2030-01-01" },
      pair.privateKey,
    );
    const result = await bindLicense(license, "m_a", pair.privateKey, { product: "app" });
    if (!result.ok) throw new Error(result.reason);
    expect(result.payload).toMatchObject({ id: "lic_bind", machine: "m_a", plan: "pro" });
    expect(result.payload.updatesUntil).toBe(decodeLicense(license)?.updatesUntil);
    const here = await verifyLicense(result.license, { publicKey: pair.publicKey, machine: "m_a" });
    expect(here.valid).toBe(true);
    const there = await verifyLicense(result.license, {
      publicKey: pair.publicKey,
      machine: "m_b",
    });
    expect(there).toMatchObject({ valid: false, reason: "wrong_machine" });
  });

  it("re-binds to the same device but refuses another one", async () => {
    const license = await signLicense({ product: "app", plan: "pro" }, pair.privateKey);
    const first = await bindLicense(license, "m_a", pair.privateKey);
    if (!first.ok) throw new Error(first.reason);
    expect((await bindLicense(first.license, "m_a", pair.privateKey)).ok).toBe(true);
    expect(await bindLicense(first.license, "m_b", pair.privateKey)).toEqual({
      ok: false,
      reason: "bound_elsewhere",
    });
  });

  it("refuses foreign, expired and wrong-product licenses", async () => {
    const stranger = await generateKeyPair();
    const foreign = await signLicense({ product: "app", plan: "pro" }, stranger.privateKey);
    expect(await bindLicense(foreign, "m", pair.privateKey)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
    const expired = await signLicense(
      { product: "app", plan: "pro", exp: "2020-01-01" },
      pair.privateKey,
    );
    expect(await bindLicense(expired, "m", pair.privateKey)).toEqual({
      ok: false,
      reason: "expired",
    });
    const other = await signLicense({ product: "other", plan: "pro" }, pair.privateKey);
    expect(await bindLicense(other, "m", pair.privateKey, { product: "app" })).toEqual({
      ok: false,
      reason: "wrong_product",
    });
  });
});

describe("CLI request and activate", () => {
  it("creates a request and turns it into a bound license", async () => {
    const license = await signLicense({ product: "app", plan: "pro" }, pair.privateKey);
    const a = capture();
    expect(await main(["request", license, "--machine", "m_cli", "--label", "PC"], a.out)).toBe(0);
    const request = a.lines[0] ?? "";
    expect(readActivationRequest(request)?.machine).toBe("m_cli");
    const b = capture();
    expect(
      await main(
        ["activate", request, "--private-key", pair.privateKey, "--product", "app"],
        b.out,
      ),
    ).toBe(0);
    expect(decodeLicense(b.lines[0] ?? "")?.machine).toBe("m_cli");
  });

  it("fails on a bad request", async () => {
    const c = capture();
    expect(await main(["activate", "garbage", "--private-key", pair.privateKey], c.out)).toBe(1);
    expect(c.errors[0]).toContain("activation request");
  });
});
