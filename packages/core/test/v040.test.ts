import { describe, expect, it } from "vitest";
import * as api from "../src/index.js";
import { generateKeyPair, signLicense, verifyLicense } from "../src/index.js";

const a = await generateKeyPair();
const b = await generateKeyPair();

describe("key ring", () => {
  it("accepts an object of public keys by kid and also without kid", async () => {
    const ring = { "2025": a.publicKey, "2026": b.publicKey };
    const withKid = await signLicense({ product: "app", plan: "pro", kid: "2026" }, b.privateKey);
    const oldKey = await signLicense({ product: "app", plan: "pro" }, a.privateKey);
    expect((await verifyLicense(withKid, { publicKey: ring, product: "app" })).valid).toBe(true);
    expect((await verifyLicense(oldKey, { publicKey: ring, product: "app" })).valid).toBe(true);
  });

  it("rejects a license signed with a key that is not in the ring", async () => {
    const other = await generateKeyPair();
    const license = await signLicense(
      { product: "app", plan: "pro", kid: "2026" },
      other.privateKey,
    );
    const result = await verifyLicense(license, { publicKey: { "2026": b.publicKey } });
    expect(result).toEqual({ valid: false, reason: "bad_signature" });
  });
});

// The public API of 1.x: names may be added, not removed or renamed.
describe("public API", () => {
  it("keeps every documented export", () => {
    const expected = [
      "ACTIVATION_PREFIX",
      "bindLicense",
      "coversRelease",
      "createActivationRequest",
      "createEntitlements",
      "decodeLicense",
      "definePlans",
      "generateKeyPair",
      "licenseStatus",
      "machineId",
      "publicKeyFromPrivateKey",
      "readActivationRequest",
      "signLicense",
      "signRevocationList",
      "verifyLicense",
      "verifyRevocationList",
    ];
    for (const name of expected) expect(Object.keys(api), name).toContain(name);
  });
});
