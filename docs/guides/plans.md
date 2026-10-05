---
title: Plans and entitlements
description: Declare plans once, then ask for features and limits anywhere in your code.
---

## Declaring plans

```ts
import { definePlans } from "@sweberdev/integral";

export const plans = definePlans({
  free: { features: ["editor"], limits: { projects: 1, storageMb: 100 } },
  pro: { extends: "free", label: "Pro", features: ["export"], limits: { projects: 50 } },
  team: { extends: "pro", label: "Team", features: ["sso"], limits: { projects: null } },
});
```

- `extends` inherits features and limits. A plan overrides inherited limits with its own.
- `label` is the display name, used for example by upgrade prompts.
- `definePlans` throws on unknown or circular `extends`, so mistakes show up at startup.

## Entitlements

```ts
const entitlements = createEntitlements({ plans, license });
```

| Call | Returns |
|---|---|
| `has("export")` | `true` if the plan or the license includes the feature |
| `require("export")` | throws an `EntitlementError` if not; handy in API routes |
| `limit("projects")` | the limit, `null` for unlimited, `0` if the plan does not mention it |
| `check("projects", used, amount?)` | `{ limit, used, remaining, allowed }` |
| `features()` / `limits()` | everything that applies, for display or debugging |
| `seats` | seats from the license, or `null` |
| `plan` | the resolved plan with `name` and `label` |

Without a license, or with a license for a plan you do not define, the first plan applies. Pass `fallbackPlan` to use another one.

## Per-customer extras

A license can carry `features` and `limits` on top of its plan, for example a beta feature for one customer or a larger quota negotiated by email. They are part of the signed data, so customers cannot add them themselves.

## Which plan has a feature?

```ts
import { planFor } from "@sweberdev/integral";

planFor(plans, "sso")?.label; // "Team"
```
