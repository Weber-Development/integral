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
| `GET /revocations` | Signed list of all revoked licenses (plain text, cached 5 minutes), since 0.2.0 |
| `POST /activate` `{ license \| key \| request, machine, label? }` | License bound to this device, within the device limit, since 0.3.0 |
| `POST /deactivate` `{ license, machine }` | Frees the device's place, since 0.3.0 |
| `GET /public-key` | Public key derived from the private key |

In Polar, add a webhook (Settings → Webhooks) to `https://your-app/api/integral/webhook` with the events `order.paid`, `order.refunded` and all `subscription.*` events. For `/exchange`, attach a **License Keys** benefit to the products.

## Revocation list

A refund or `server.revoke(id)` re-signs the license with an end date. An app that only checks offline never sees the new version, and a lifetime license had no end date before. `GET /revocations` (or `server.revocationList()`) returns a list of every revoked license id, signed with the same key. The portal downloads it automatically. In other apps, pass it to `verifyLicense`:

```ts
const list = await verifyRevocationList(await (await fetch("/api/integral/revocations")).text(), {
  publicKey,
  product: "my-app",
});
await verifyLicense(license, { publicKey, revocations: list });
```

## Device activations

Since 0.3.0 the server can bind licenses to devices and limit how many devices one license may use. The app sends its license (or a Polar key) and its `machineId()` to `/activate` and gets back a copy bound to that device. The [portal](./portal.md) does this with `bindToMachine`.

```ts
const result = await licenses.activate({ key: polarKey, machine, label: "Office laptop" });
if (result.ok) result.license; // bound to `machine`
else result.reason; // "not_found", "revoked", "device_limit", "expired", …

await licenses.deactivate(result.license, machine); // frees the place
await licenses.activations(licenseId); // [{ machine, label, createdAt, lastSeenAt }]
```

- The limit is `seats × devicesPerSeat` (option `devicesPerSeat`, default 3). A license without seats counts as one seat. Activating a device that already has a place does not count again.
- `/refresh` returns a renewed license bound to the same device, so renewals keep the binding.
- For offline activation, pass the customer's request file as `{ request }` (see [Device activation](../guides/activation.md#offline-activation)). It counts against the same limit.
- Activations need storage: `memoryStore` and `sqlStore` support them. `sqlSchema` now also creates the table `integral_licenses_activations` (or `<table>_activations`); run it again after updating. Custom stores implement `listActivations`, `saveActivation` and `deleteActivation`.

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
- Or implement `LicenseStore` (`get`, `findBySource`, `findByCustomer`, `save`, `list`, and for device activations `listActivations`, `saveActivation`, `deleteActivation`) for anything else.

## Manual licenses

```ts
await licenses.issueManual({ email: "kunde@example.ch", plan: "team", reference: "INV-2026-041", updatesUntil: "2027-10-31" });
await licenses.revoke(licenseId);
```

## Other frameworks

`verifyPolarWebhook(rawBody, headers, secret)` and `licenses.handleEvent(event)` work without the fetch handler, e.g. in Express. Always pass the raw request body: re-serialised JSON breaks the signature.
