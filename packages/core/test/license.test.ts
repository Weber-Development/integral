import { describe, expect, it } from "vitest";
import {
  coversRelease,
  decodeLicense,
  generateKeyPair,
  signLicense,
  verifyLicense,
} from "../src/index.js";

const pair = await generateKeyPair();

describe("license keys", () => {
  it("signs and verifies a license", async () => {
    const key = await signLicense(
      { product: "app", plan: "pro", features: ["export"], customer: { email: "a@b.ch" } },
      pair.privateKey,
    );
    expect(key.startsWith("int1.")).toBe(true);
    const result = await verifyLicense(key, { publicKey: pair.publicKey, product: "app" });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.license.plan).toBe("pro");
      expect(result.license.id).toMatch(/^lic_/);
    }
  });

  it("rejects a tampered payload", async () => {
    const key = await signLicense({ product: "app", plan: "free" }, pair.privateKey);
    const [prefix, , signature] = key.split(".");
    const forged = { ...decodeLicense(key), plan: "pro" };
    const body = Buffer.from(JSON.stringify(forged)).toString("base64url");
    const result = await verifyLicense(`${prefix}.${body}.${signature}`, {
      publicKey: pair.publicKey,
    });
    expect(result).toEqual({ valid: false, reason: "bad_signature" });
  });

  it("rejects a license signed with another key", async () => {
    const other = await generateKeyPair();
    const key = await signLicense({ product: "app", plan: "pro" }, other.privateKey);
    expect((await verifyLicense(key, { publicKey: pair.publicKey })).valid).toBe(false);
    // Key rotation: several public keys are accepted.
    const rotated = await verifyLicense(key, { publicKey: [pair.publicKey, other.publicKey] });
    expect(rotated.valid).toBe(true);
  });

  it("checks product and dates", async () => {
    const key = await signLicense(
      { product: "app", plan: "pro", nbf: "2026-01-01", exp: "2026-12-31" },
      pair.privateKey,
    );
    const opts = { publicKey: pair.publicKey };
    expect(await verifyLicense(key, { ...opts, product: "other" })).toMatchObject({
      reason: "wrong_product",
    });
    expect(await verifyLicense(key, { ...opts, now: new Date("2025-06-01") })).toMatchObject({
      reason: "not_yet_valid",
    });
    expect(await verifyLicense(key, { ...opts, now: new Date("2027-02-01") })).toMatchObject({
      reason: "expired",
    });
    expect((await verifyLicense(key, { ...opts, now: new Date("2026-06-01") })).valid).toBe(true);
  });

  it("returns malformed for garbage", async () => {
    for (const input of ["", "abc", "int1.x.y", "int2.e30.AA", "int1.e30.!!"]) {
      expect((await verifyLicense(input, { publicKey: pair.publicKey })).valid).toBe(false);
    }
    expect(decodeLicense("nope")).toBeNull();
  });

  it("covers releases until updatesUntil", async () => {
    const key = await signLicense(
      { product: "app", plan: "pro", updatesUntil: "2027-01-01" },
      pair.privateKey,
    );
    const license = decodeLicense(key);
    if (!license) throw new Error("decode failed");
    expect(coversRelease(license, "2026-11-01")).toBe(true);
    expect(coversRelease(license, "2027-03-01")).toBe(false);
    expect(coversRelease({ ...license, updatesUntil: undefined }, "2099-01-01")).toBe(true);
  });

  it("validates inputs", async () => {
    await expect(signLicense({ product: "", plan: "x" }, pair.privateKey)).rejects.toThrow();
    await expect(
      signLicense({ product: "a", plan: "x", exp: "not a date" }, pair.privateKey),
    ).rejects.toThrow(/Invalid date/);
  });
});
