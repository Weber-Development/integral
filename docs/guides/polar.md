---
title: Polar license keys
description: Validate, activate and deactivate license keys from Polar's "License Keys" benefit.
---

[Polar](https://polar.sh) can attach a **License Keys** benefit to a product. Customers receive a key such as `POLAR-1A2B…` after paying. `@sweberdev/integral/polar` checks these keys through Polar's public customer portal API, which needs no access token and is safe in apps and browsers.

```ts
import { createPolarClient } from "@sweberdev/integral/polar";

const polar = createPolarClient({
  organizationId: "your-polar-organization-id",
  benefitId: "your-license-keys-benefit-id", // optional, recommended with several products
  // sandbox: true,
});

const result = await polar.validate(key);
if (result.valid) {
  result.data.customer_id;
  result.data.expires_at;
} else {
  result.reason; // "invalid" | "usage_exceeded" | "wrong_benefit"
}
```

## Activations

If the benefit limits activations (for example three machines), activate once and keep the activation id:

```ts
const activation = await polar.activate(key, { label: os.hostname() });
if (activation.valid) save(activation.data.id);
else if (activation.reason === "activation_limit") askToDeactivateAnotherMachine();

await polar.validate(key, { activationId }); // later checks
await polar.deactivate(key, activationId); // "sign out this machine"
```

## Usage-based limits

`validate(key, { incrementUsage: 1 })` counts usage on the key, for example one per generated report. When the key's usage limit is reached, the result is `usage_exceeded`.

## Errors and offline use

Invalid keys return `{ valid: false }`. Network failures and server errors **throw**, so you can tell "invalid" apart from "Polar unreachable". Wrap the check with [`withOfflineGrace`](offline.md) so customers are not locked out when they are offline.

## Polar keys or Integral licenses?

| | Polar license key | Integral license |
|---|---|---|
| Needs a server | Polar, on every check | none |
| Works offline | with `withOfflineGrace` | always |
| Plans, features, limits | you map the benefit to a plan | signed into the license |
| Revocation | immediate | at the next refresh (short `updatesUntil` or `exp`) |

You can combine both: customers enter their Polar key once, your server exchanges it for a signed Integral license. [Integral Pro](../pro/overview.md) does exactly that.
