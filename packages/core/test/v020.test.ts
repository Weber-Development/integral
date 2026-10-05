import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import {
  generateKeyPair,
  licenseStatus,
  machineId,
  signLicense,
  signRevocationList,
  verifyLicense,
  verifyRevocationList,
} from "../src/index.js";

const pair = await generateKeyPair();

describe("revocation lists", () => {
  it("rejects a revoked license and keeps others valid", async () => {
    const revoked = await signLicense(
      { product: "app", plan: "pro", id: "lic_a" },
      pair.privateKey,
    );
    const kept = await signLicense({ product: "app", plan: "pro", id: "lic_b" }, pair.privateKey);
    const token = await signRevocationList({ ids: ["lic_a"], product: "app" }, pair.privateKey);
    expect(token.startsWith("intr1.")).toBe(true);
    const list = await verifyRevocationList(token, { publicKey: pair.publicKey, product: "app" });
    expect(list?.ids).toEqual(["lic_a"]);
    const a = await verifyLicense(revoked, { publicKey: pair.publicKey, revocations: list });
    expect(a).toMatchObject({ valid: false, reason: "revoked" });
    const b = await verifyLicense(kept, { publicKey: pair.publicKey, revocations: list });
    expect(b.valid).toBe(true);
  });

  it("accepts plain ids", async () => {
    const key = await signLicense({ product: "app", plan: "pro", id: "lic_x" }, pair.privateKey);
    const result = await verifyLicense(key, {
      publicKey: pair.publicKey,
      revocations: new Set(["lic_x"]),
    });
    expect(result).toMatchObject({ valid: false, reason: "revoked" });
  });

  it("rejects lists signed with another key, tampered or for another product", async () => {
    const other = await generateKeyPair();
    const foreign = await signRevocationList({ ids: ["lic_a"] }, other.privateKey);
    expect(await verifyRevocationList(foreign, { publicKey: pair.publicKey })).toBeNull();
    const token = await signRevocationList({ ids: ["lic_a"], product: "app" }, pair.privateKey);
    const [prefix, , sig] = token.split(".");
    const body = Buffer.from(JSON.stringify({ v: 1, iat: "2026-01-01", ids: [] })).toString(
      "base64url",
    );
    expect(
      await verifyRevocationList(`${prefix}.${body}.${sig}`, { publicKey: pair.publicKey }),
    ).toBeNull();
    expect(
      await verifyRevocationList(token, { publicKey: pair.publicKey, product: "other" }),
    ).toBeNull();
    expect(await verifyRevocationList("nonsense", { publicKey: pair.publicKey })).toBeNull();
  });
});

describe("machine binding", () => {
  it("builds stable anonymous ids", async () => {
    const a = await machineId("host-123", "seya");
    expect(a).toBe(await machineId(" host-123 ", "seya"));
    expect(a).not.toBe(await machineId("host-456", "seya"));
    expect(a).toMatch(/^m_[A-Za-z0-9_-]{32}$/);
    await expect(machineId("", " ")).rejects.toThrow();
  });

  it("only accepts the bound machine", async () => {
    const machine = await machineId("host-123");
    const key = await signLicense({ product: "app", plan: "pro", machine }, pair.privateKey);
    const ok = await verifyLicense(key, { publicKey: pair.publicKey, machine });
    expect(ok.valid).toBe(true);
    const other = await verifyLicense(key, {
      publicKey: pair.publicKey,
      machine: await machineId("host-456"),
    });
    expect(other).toMatchObject({ valid: false, reason: "wrong_machine" });
    const missing = await verifyLicense(key, { publicKey: pair.publicKey });
    expect(missing).toMatchObject({ valid: false, reason: "wrong_machine" });
  });
});

describe("licenseStatus", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const base = { v: 1 as const, id: "lic_1", product: "app", plan: "pro", iat: now.toISOString() };

  it("reports active licenses without expiry", () => {
    expect(licenseStatus(base, { now })).toEqual({
      state: "active",
      trial: false,
      daysLeft: null,
      updatesEnded: false,
      updatesDaysLeft: null,
    });
  });

  it("reports expiring trials and expired licenses", () => {
    const trial = { ...base, trial: true, exp: "2026-10-12T12:00:00Z" };
    expect(licenseStatus(trial, { now })).toMatchObject({
      state: "expiring",
      trial: true,
      daysLeft: 7,
    });
    expect(licenseStatus(trial, { now, warnDays: 3 }).state).toBe("active");
    expect(licenseStatus({ ...base, exp: "2026-10-01T00:00:00Z" }, { now }).state).toBe("expired");
    expect(licenseStatus({ ...base, nbf: "2026-11-01T00:00:00Z" }, { now }).state).toBe(
      "not_yet_valid",
    );
  });

  it("reports the update period", () => {
    const ended = licenseStatus({ ...base, updatesUntil: "2026-09-01T00:00:00Z" }, { now });
    expect(ended).toMatchObject({ state: "active", updatesEnded: true });
    const running = licenseStatus({ ...base, updatesUntil: "2026-10-15T12:00:00Z" }, { now });
    expect(running).toMatchObject({ updatesEnded: false, updatesDaysLeft: 10 });
  });
});

describe("CLI", () => {
  it("revokes and verifies against the list", async () => {
    const lines: string[] = [];
    const out = {
      log: (l: string) => lines.push(l),
      error: (l: string) => lines.push(l),
    } as unknown as Console;
    const key = await signLicense({ product: "app", plan: "pro", id: "lic_cli" }, pair.privateKey);
    expect(await main(["revoke", "lic_cli", "--private-key", pair.privateKey], out)).toBe(0);
    const { writeFile, mkdtemp } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const file = join(await mkdtemp(join(tmpdir(), "integral-")), "revoked.txt");
    await writeFile(file, lines[0] ?? "");
    const code = await main(
      ["verify", key, "--public-key", pair.publicKey, "--revocations", file],
      out,
    );
    expect(code).toBe(1);
    expect(lines.at(-1)).toBe("invalid: revoked");
  });

  it("issues trial licenses bound to a machine", async () => {
    const lines: string[] = [];
    const out = {
      log: (l: string) => lines.push(l),
      error: (l: string) => lines.push(l),
    } as unknown as Console;
    const machine = await machineId("host-1");
    await main(
      [
        "issue",
        "--product",
        "app",
        "--plan",
        "pro",
        "--trial",
        "--machine",
        machine,
        "--private-key",
        pair.privateKey,
      ],
      out,
    );
    const result = await verifyLicense(lines[0] ?? "", { publicKey: pair.publicKey, machine });
    expect(result.valid && result.license.trial).toBe(true);
  });
});
