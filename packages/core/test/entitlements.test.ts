import { describe, expect, it } from "vitest";
import { createEntitlements, definePlans, EntitlementError, planFor } from "../src/index.js";

const plans = definePlans({
  free: { features: ["basic"], limits: { projects: 1 } },
  pro: { extends: "free", label: "Pro", features: ["export"], limits: { projects: 10 } },
  team: { extends: "pro", features: ["sso"], limits: { projects: null, seats: 25 } },
});

describe("entitlements", () => {
  it("falls back to the first plan without a license", () => {
    const e = createEntitlements({ plans });
    expect(e.plan.name).toBe("free");
    expect(e.has("basic")).toBe(true);
    expect(e.has("export")).toBe(false);
    expect(e.check("projects", 1).allowed).toBe(false);
    expect(() => e.require("export")).toThrow(EntitlementError);
  });

  it("inherits features and limits", () => {
    const e = createEntitlements({ plans, fallbackPlan: "team" });
    expect(e.features()).toEqual(["basic", "export", "sso"]);
    expect(e.limit("projects")).toBeNull();
    expect(e.check("projects", 500)).toEqual({
      limit: null,
      used: 500,
      remaining: null,
      allowed: true,
    });
    expect(e.limit("unknown")).toBe(0);
  });

  it("applies license plan, extra features and limit overrides", () => {
    const e = createEntitlements({
      plans,
      license: {
        v: 1,
        id: "lic_1",
        product: "app",
        plan: "pro",
        features: ["beta"],
        limits: { projects: 20 },
        seats: 3,
        iat: new Date().toISOString(),
      },
    });
    expect(e.plan.label).toBe("Pro");
    expect(e.has("beta")).toBe(true);
    expect(e.check("projects", 19)).toMatchObject({ allowed: true, remaining: 1 });
    expect(e.check("projects", 19, 2).allowed).toBe(false);
    expect(e.seats).toBe(3);
  });

  it("ignores unknown license plans", () => {
    const e = createEntitlements({
      plans,
      license: { v: 1, id: "x", product: "app", plan: "gold", iat: "2026-01-01" },
    });
    expect(e.plan.name).toBe("free");
  });

  it("finds the cheapest plan for a feature", () => {
    expect(planFor(plans, "export")?.name).toBe("pro");
    expect(planFor(plans, "nope")).toBeNull();
  });

  it("detects broken plan definitions", () => {
    expect(() => definePlans({ a: { extends: "b" }, b: { extends: "a" } })).toThrow(/Circular/);
    expect(() => definePlans({ a: { extends: "missing" } })).toThrow(/Unknown/);
  });
});
