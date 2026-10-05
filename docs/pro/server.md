---
title: License server
description: Turn Polar orders and subscriptions into signed licenses automatically.
---

```ts title="lib/licenses.ts"
import { createPolarClient } from "@sweberdev/integral/polar";
import { createLicenseServer, sqlStore } from "@weber-development/integral-server";

export const licenses = createLicenseServer({
  privateKey: process.env.INTEGRAL_PRIVATE_KEY!,
  product: "my-app",
  store: sqlStore((sql, params) => pool.query(sql, params).then((r) => r.rows), {
    dialect: "postgres",
  }),
  plans: {
    // Polar product id → plan
    "a1b2…": { plan: "pro" },
    "c3d4…": { plan: "team", seats: 10, limits: { projects: null } },
  },
  polar: createPolarClient({ organizationId: process.env.POLAR_ORG_ID! }),
  onLicense: async (record, event) => {
    if (event === "issued") await mail(record.email, `Your license: ${record.license}`);
  },
});
```

`plans` can also be a function `({ id, name }) => PlanMapping | null`. Products that map to `null` are ignored, so one Polar organization can sell several products.

## Routes

```ts title="app/api/integral/[...path]/route.ts"
import { createLicenseHandler } from "@weber-development/integral-server";
import { licenses } from "@/lib/licenses";

const handler = createLicenseHandler(licenses, {
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  basePath: "/api/integral",
  corsOrigin: "https://app.example.ch", // only if a browser app on another origin calls it
});

export { handler as GET, handler as POST, handler as OPTIONS };
```

| Route | Purpose |
|---|---|
| `POST /webhook` | Polar webhook endpoint. Verifies the signature and age of each delivery |
| `POST /exchange` `{ key }` | Polar license key → the customer's signed license |
| `POST /refresh` `{ license }` | Current version of a license, e.g. after a renewal |
| `GET /public-key` | Public key derived from the private key |

In Polar, add a webhook (Settings → Webhooks) to `https://your-app/api/integral/webhook` with the events `order.paid`, `order.refunded` and all `subscription.*` events. For `/exchange`, attach a **License Keys** benefit to the products.

## Lifecycle

| Polar event | License |
|---|---|
| `order.paid` (one-time) | Issued without end, e.g. Lifetime |
| `subscription.active` | Issued, `updatesUntil` = end of period + `graceDays` (default 3) |
| `subscription.updated` (renewal) | Re-issued with the same id and a later `updatesUntil` |
| `subscription.canceled` | Status `canceled`, license unchanged until the period ends |
| `subscription.revoked` / ended | Status `ended`, `updatesUntil` = end date |
| `order.refunded` | Revoked: `exp` set to now |

With `afterCancel: "expire"`, licenses also get `exp`, so they stop working when the subscription ends.

## Storage

- `memoryStore()` for tests.
- `sqlStore(query, { dialect, table? })` for Postgres (`$1`), SQLite and MySQL (`?`). `query(sql, params)` must return the rows. `sqlSchema({ dialect })` returns the `CREATE TABLE` statement.
- Or implement `LicenseStore` (`get`, `findBySource`, `findByCustomer`, `save`, `list`) for anything else.

## Manual licenses

```ts
await licenses.issueManual({ email: "kunde@example.ch", plan: "team", reference: "INV-2026-041", updatesUntil: "2027-10-31" });
await licenses.revoke(licenseId);
```

## Other frameworks

`verifyPolarWebhook(rawBody, headers, secret)` and `licenses.handleEvent(event)` work without the fetch handler, e.g. in Express. Always pass the raw request body: re-serialised JSON breaks the signature.
