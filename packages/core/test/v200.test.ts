import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import {
  bindLicense,
  decodeLicense,
  ecdsaDerToRaw,
  generateKeyPair,
  publicKeyAlgorithm,
  signLicense,
  signRevocationList,
  upgradeLicense,
  verifyLicense,
  verifyRevocationList,
} from "../src/index.js";

const input = { product: "app", plan: "pro" };

describe("int2 licenses", () => {
  it("signs and verifies with Ed25519 and ES256", async () => {
    for (const alg of ["EdDSA", "ES256"] as const) {
      const pair = await generateKeyPair({ alg });
      expect(publicKeyAlgorithm(pair.publicKey)).toBe(alg);
      const key = await signLicense(input, pair.privateKey);
      expect(key.startsWith("int2.")).toBe(true);
      expect(decodeLicense(key)?.v).toBe(2);
      expect((await verifyLicense(key, { publicKey: pair.publicKey })).valid).toBe(true);
      const other = await generateKeyPair({ alg });
      expect((await verifyLicense(key, { publicKey: other.publicKey })).valid).toBe(false);
    }
  });

  it("does not accept a key of the wrong algorithm", async () => {
    const ed = await generateKeyPair();
    const ec = await generateKeyPair({ alg: "ES256" });
    const key = await signLicense(input, ec.privateKey);
    expect((await verifyLicense(key, { publicKey: ed.publicKey })).valid).toBe(false);
  });

  it("picks the key by kid from a key ring with mixed algorithms", async () => {
    const ed = await generateKeyPair();
    const ec = await generateKeyPair({ alg: "ES256" });
    const key = await signLicense({ ...input, kid: "k2" }, ec.privateKey);
    const ring = { k1: ed.publicKey, k2: ec.publicKey };
    expect((await verifyLicense(key, { publicKey: ring })).valid).toBe(true);
    expect((await verifyLicense(key, { publicKey: [ed.publicKey, ec.publicKey] })).valid).toBe(
      true,
    );
  });

  it("signs with a custom Signer (KMS style, DER output)", async () => {
    const ec = await generateKeyPair({ alg: "ES256" });
    const { createPrivateKey, createSign } = await import("node:crypto");
    const pk = createPrivateKey({
      key: Buffer.from(ec.privateKey, "base64url"),
      format: "der",
      type: "pkcs8",
    });
    const signer = {
      alg: "ES256" as const,
      kid: "kms-1",
      sign: async (data: Uint8Array) =>
        ecdsaDerToRaw(new Uint8Array(createSign("SHA256").update(data).sign(pk))),
    };
    const key = await signLicense(input, signer);
    const result = await verifyLicense(key, { publicKey: { "kms-1": ec.publicKey } });
    expect(result.valid).toBe(true);
  });

  it("keeps int1 licenses readable and upgrades them", async () => {
    const pair = await generateKeyPair();
    const old = await signLicense({ ...input, id: "lic_old" }, pair.privateKey, { format: "int1" });
    expect(old.startsWith("int1.")).toBe(true);
    expect((await verifyLicense(old, { publicKey: pair.publicKey })).valid).toBe(true);
    const up = await upgradeLicense(old, pair.privateKey);
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    expect(up.license.startsWith("int2.")).toBe(true);
    expect(up.payload).toMatchObject({ id: "lic_old", v: 2, plan: "pro" });
    expect((await verifyLicense(up.license, { publicKey: pair.publicKey })).valid).toBe(true);
    expect(await upgradeLicense(up.license, pair.privateKey)).toMatchObject({ ok: true });
    const other = await generateKeyPair();
    expect(await upgradeLicense(old, other.privateKey)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
    expect(await upgradeLicense("nope", pair.privateKey)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("upgrades to ES256 when moving to a new key", async () => {
    const ed = await generateKeyPair();
    const ec = await generateKeyPair({ alg: "ES256" });
    const old = await signLicense(input, ed.privateKey, { format: "int1" });
    const up = await upgradeLicense(old, ec.privateKey, { publicKey: ed.publicKey });
    expect(up.ok).toBe(true);
    if (up.ok)
      expect((await verifyLicense(up.license, { publicKey: ec.publicKey })).valid).toBe(true);
  });
});

describe("int2 revocation lists and activation", () => {
  it("signs intr2 and still reads intr1", async () => {
    for (const alg of ["EdDSA", "ES256"] as const) {
      const pair = await generateKeyPair({ alg });
      const list = await signRevocationList({ ids: ["lic_a"] }, pair.privateKey);
      expect(list.startsWith("intr2.")).toBe(true);
      expect(await verifyRevocationList(list, { publicKey: pair.publicKey })).toMatchObject({
        ids: ["lic_a"],
      });
    }
    const ed = await generateKeyPair();
    const legacy = await signRevocationList({ ids: ["x"], format: "intr1" }, ed.privateKey);
    expect(legacy.startsWith("intr1.")).toBe(true);
    expect(await verifyRevocationList(legacy, { publicKey: ed.publicKey })).not.toBeNull();
  });

  it("binds an ES256 license to a machine", async () => {
    const ec = await generateKeyPair({ alg: "ES256" });
    const key = await signLicense(input, ec.privateKey);
    const bound = await bindLicense(key, "machine-1", ec.privateKey, { publicKey: ec.publicKey });
    expect(bound.ok).toBe(true);
    if (bound.ok)
      expect(
        (await verifyLicense(bound.license, { publicKey: ec.publicKey, machine: "machine-1" }))
          .valid,
      ).toBe(true);
  });
});

describe("cli 2.0", () => {
  it("generates ES256 keys and migrates licenses", async () => {
    const lines: string[] = [];
    const out = { log: (m: string) => lines.push(m), error: (m: string) => lines.push(m) };
    expect(await main(["keygen", "--alg", "es256"], out as never)).toBe(0);
    const pub = lines[0]?.replace("INTEGRAL_PUBLIC_KEY=", "") ?? "";
    const priv = lines[1]?.replace("INTEGRAL_PRIVATE_KEY=", "") ?? "";
    expect(pub.startsWith("p256.")).toBe(true);
    lines.length = 0;
    const ed = await generateKeyPair();
    const old = await signLicense(input, ed.privateKey, { format: "int1" });
    expect(await main(["migrate", old, "--private-key", ed.privateKey], out as never)).toBe(0);
    expect(lines[0]?.startsWith("int2.")).toBe(true);
    lines.length = 0;
    expect(await main(["migrate", old, "--private-key", priv], out as never)).toBe(1);
  });
});
