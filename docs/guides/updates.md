---
title: Update periods
description: Licenses that end updates instead of ending usage.
---

Many developers want this rule: "If you cancel, the version you have keeps working, you just stop getting updates." Integral supports it with `updatesUntil` instead of `exp`.

```ts
await signLicense(
  { product: "my-app", plan: "pro", updatesUntil: "2027-10-05" },
  privateKey,
);
```

In your app, compare the license with the release date of the running version:

```ts
import { coversRelease } from "@sweberdev/integral";

const RELEASED_AT = "2026-11-20"; // set at build time

if (!coversRelease(license, RELEASED_AT)) {
  showNotice("This version was released after your updates ended. Renew to use it, or install an earlier version.");
}
```

A subscription then works like this:

| Event | License |
|---|---|
| Purchase | `updatesUntil` = end of the paid period plus a few days |
| Renewal | re-issued with a later `updatesUntil` |
| Cancellation | not renewed; versions released before `updatesUntil` keep working |
| Refund | re-issued with `exp` in the past, so it stops working |
| Lifetime purchase | neither `exp` nor `updatesUntil` |

[Integral Pro](../pro/server.md) applies this rule to Polar subscriptions automatically. If you prefer licenses that stop working, set `afterCancel: "expire"`.
