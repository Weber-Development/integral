---
title: Getting started
description: Create a key pair, issue a license and check it in your app in five minutes.
---

```sh
npm i @sweberdev/integral
```

## 1. Create a key pair

```sh
npx integral keygen
```

This prints two values. Put `INTEGRAL_PRIVATE_KEY` in your secrets manager or server environment: whoever has it can issue licenses. `INTEGRAL_PUBLIC_KEY` goes into your app; it can only verify.

## 2. Declare your plans

```ts title="plans.ts"
import { definePlans } from "@sweberdev/integral";

export const plans = definePlans({
  free: { features: ["editor"], limits: { projects: 1 } },
  pro: { extends: "free", label: "Pro", features: ["export", "sync"], limits: { projects: 50 } },
  team: { extends: "pro", label: "Team", features: ["sso"], limits: { projects: null } },
});
```

The first plan is used when there is no valid license. `null` means unlimited.

## 3. Issue a license

```sh
npx integral issue --product my-app --plan pro --email kunde@example.ch --updates-until 2027-10-05
```

Or in code, e.g. after a payment:

```ts
import { signLicense } from "@sweberdev/integral";

const license = await signLicense(
  { product: "my-app", plan: "pro", customer: { email: "kunde@example.ch" } },
  process.env.INTEGRAL_PRIVATE_KEY!,
);
```

## 4. Check it in your app

```ts
import { createEntitlements, verifyLicense } from "@sweberdev/integral";
import { plans } from "./plans";

const result = await verifyLicense(storedLicense, {
  publicKey: INTEGRAL_PUBLIC_KEY,
  product: "my-app",
});

const entitlements = createEntitlements({
  plans,
  license: result.valid ? result.license : null,
});

if (entitlements.has("export")) showExportButton();
const { allowed, remaining } = entitlements.check("projects", projects.length);
```

`verifyLicense` never throws for bad input. It returns `{ valid: false, reason }` with one of `malformed`, `unsupported_version`, `bad_signature`, `wrong_product`, `not_yet_valid` or `expired`.

## Next steps

- Selling through Polar? See [Polar license keys](guides/polar.md), or let [Integral Pro](pro/overview.md) issue licenses automatically.
- React app? See [React](guides/react.md).
