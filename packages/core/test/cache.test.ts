import { describe, expect, it, vi } from "vitest";
import { memoryStorage, withOfflineGrace } from "../src/index.js";

describe("withOfflineGrace", () => {
  it("caches good answers and survives outages within the grace period", async () => {
    let time = 0;
    let online = true;
    const check = vi.fn(async () => {
      if (!online) throw new Error("offline");
      return { valid: true, data: "ok" };
    });
    const run = withOfflineGrace(check, {
      key: "k",
      storage: memoryStorage(),
      ttl: 1000,
      grace: 10_000,
      now: () => time,
    });
    expect(await run()).toMatchObject({ valid: true, source: "network" });
    time = 500;
    expect(await run()).toMatchObject({ valid: true, source: "cache" });
    expect(check).toHaveBeenCalledTimes(1);
    online = false;
    time = 5000;
    expect(await run()).toMatchObject({ valid: true, source: "grace" });
    time = 20_000;
    expect(await run()).toMatchObject({ valid: false, reason: "unreachable" });
  });

  it("does not cache invalid answers as valid", async () => {
    const run = withOfflineGrace(async () => ({ valid: false, reason: "invalid" }), { key: "k" });
    expect(await run()).toMatchObject({ valid: false, reason: "invalid", source: "network" });
    expect(await run()).toMatchObject({ source: "network" });
  });
});
