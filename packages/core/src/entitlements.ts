import type { LicensePayload, LimitValue } from "./types.js";

export interface PlanDefinition {
  /** Inherit features and limits from another plan. */
  extends?: string;
  /** Human readable name, e.g. for upgrade prompts. */
  label?: string;
  features?: string[];
  limits?: Record<string, LimitValue>;
}

export type Plans<P extends string = string> = Record<P, PlanDefinition>;

export interface ResolvedPlan {
  name: string;
  label: string;
  features: ReadonlySet<string>;
  limits: Readonly<Record<string, LimitValue>>;
}

/** Declares your plans. Returns the same object, typed, and checks for unknown or circular `extends`. */
export function definePlans<P extends string>(plans: Plans<P>): Plans<P> {
  for (const name of Object.keys(plans)) resolvePlan(plans, name);
  return plans;
}

export function resolvePlan(plans: Plans, name: string, seen: string[] = []): ResolvedPlan {
  const plan = plans[name];
  if (!plan) throw new Error(`Unknown plan "${name}".`);
  if (seen.includes(name))
    throw new Error(`Circular plan inheritance: ${[...seen, name].join(" > ")}`);
  const parent = plan.extends ? resolvePlan(plans, plan.extends, [...seen, name]) : undefined;
  return {
    name,
    label: plan.label ?? name,
    features: new Set([...(parent?.features ?? []), ...(plan.features ?? [])]),
    limits: { ...parent?.limits, ...plan.limits },
  };
}

export interface LimitCheck {
  /** The limit, `null` for unlimited, `0` if the plan does not mention it. */
  limit: LimitValue;
  used: number;
  /** Remaining units, `null` for unlimited. Never negative. */
  remaining: number | null;
  /** True if one more unit (or `amount`) still fits. */
  allowed: boolean;
}

export class EntitlementError extends Error {
  constructor(
    message: string,
    readonly feature: string,
    readonly plan: string,
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

export interface Entitlements {
  plan: ResolvedPlan;
  license: LicensePayload | null;
  /** True if the feature is part of the plan or the license. */
  has(feature: string): boolean;
  /** Throws an `EntitlementError` if the feature is missing. */
  require(feature: string): void;
  /** The limit for a key; `null` means unlimited, missing keys are `0`. */
  limit(key: string): LimitValue;
  /** Checks whether `amount` more units fit next to `used`. */
  check(key: string, used: number, amount?: number): LimitCheck;
  /** All features, sorted. */
  features(): string[];
  /** All limits. */
  limits(): Record<string, LimitValue>;
  /** Seats from the license, `null` if not sold per seat. */
  seats: number | null;
}

export interface EntitlementsOptions {
  plans: Plans;
  /** A verified license. Its plan, features and limits are applied. */
  license?: LicensePayload | null;
  /** Plan to use without a license. Default: the first plan. */
  fallbackPlan?: string;
}

/** Combines your plan definitions with a (verified) license. */
export function createEntitlements(options: EntitlementsOptions): Entitlements {
  const { plans, license = null } = options;
  const planNames = Object.keys(plans);
  const fallback = options.fallbackPlan ?? planNames[0];
  if (!fallback) throw new Error("Define at least one plan.");
  const planName = license && plans[license.plan] ? license.plan : fallback;
  const base = resolvePlan(plans, planName);
  const features = new Set([...base.features, ...(license?.features ?? [])]);
  const limits: Record<string, LimitValue> = { ...base.limits, ...license?.limits };
  const plan: ResolvedPlan = { ...base, features, limits };

  const limit = (key: string): LimitValue => (key in limits ? (limits[key] ?? null) : 0);

  return {
    plan,
    license,
    seats: license?.seats ?? null,
    has: (feature) => features.has(feature),
    require(feature) {
      if (!features.has(feature)) {
        throw new EntitlementError(
          `Feature "${feature}" is not included in plan "${plan.label}".`,
          feature,
          plan.name,
        );
      }
    },
    limit,
    check(key, used, amount = 1) {
      const value = limit(key);
      if (value === null) return { limit: null, used, remaining: null, allowed: true };
      return {
        limit: value,
        used,
        remaining: Math.max(0, value - used),
        allowed: used + amount <= value,
      };
    },
    features: () => [...features].sort(),
    limits: () => ({ ...limits }),
  };
}

/** Finds the cheapest plan (in declaration order) that includes a feature, for upgrade prompts. */
export function planFor(plans: Plans, feature: string): ResolvedPlan | null {
  for (const name of Object.keys(plans)) {
    const plan = resolvePlan(plans, name);
    if (plan.features.has(feature)) return plan;
  }
  return null;
}
