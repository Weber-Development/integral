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
| `POST /lease` `{ license, holder, label?, ttlSeconds? }` | Takes or renews a floating seat, since 0.4.0 |
| `POST /lease/release` `{ license, holder }` | Gives the seat back, since 0.4.0 |
| `POST /usage` `{ license, metric, amount?, period? }` | Counts usage against the license's limit, since 0.4.0 |
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

## Floating licenses

Since 0.4.0 a license can be shared between running apps: `seats` is the number of apps that may run at the same time. Each running app is a *holder* (any stable id, e.g. one per window or session). The app calls `lease` when it starts and again as a heartbeat; a seat that is not renewed expires by itself after `leaseSeconds` (default 300, between 30 and 3600).

```ts
const result = await licenses.lease({ license, holder: "session-42", label: "Anna's laptop" });
if (result.ok) result.expiresAt; // seat held until then, call again to renew
else result.reason; // "lease_limit", "revoked", "not_found", …

await licenses.releaseLease(license, "session-42");
await licenses.leases(licenseId); // who holds a seat right now
```

Devices and seats are independent: device binding limits where a license is installed, floating seats limit how many run at once. The [portal](./portal.md#uselease) holds a seat with `useLease()`.

## Usage metering

Count what a customer uses and refuse it above the limit stored in the license (`limits` in the plan mapping).

```ts
const usage = await licenses.recordUsage({ license, metric: "exports", amount: 1 });
if (!usage.ok) usage.reason; // "limit_reached", …
else usage.used; // total in this period

await licenses.usage(licenseId); // [{ metric, period, amount }]
```

The period is `month` (default, option `usagePeriod`), `year` or `none`. A metric without a limit is only counted. Refused usage is not counted.

## Audit trail

Every change is stored as an event: issued, renewed, revoked, activated, deactivated, and seats taken, released or removed. Read them with `licenses.events({ licenseId?, limit? })` (newest first, at most 1000, default 100) or export them from the [admin API](./admin.md).

Storage: `sqlSchema` now also creates `<table>_leases`, `<table>_usage` and `<table>_events` (or `integral_licenses_…`). Run it again after updating; it keeps existing data. Custom stores implement the optional methods `listLeases`, `saveLease`, `deleteLease`, `addUsage`, `listUsage`, `saveEvent` and `listEvents`.

## Key rotation

Since 0.5.0 you can replace the signing key without locking anyone out. Generate a new key pair, set the new private key and list the old public key:

```ts
createLicenseServer({
  privateKey: process.env.INTEGRAL_PRIVATE_KEY!, // the new key
  previousPublicKeys: [process.env.INTEGRAL_OLD_PUBLIC_KEY!],
  // …
});
```

Licenses signed with an old key stay valid for the server (refresh, activate, lease, usage). Then ship your app with `await licenses.publicKeys()` (or `GET /public-key`, which answers `publicKeys`): `verifyLicense` accepts a list. `resignAll()` signs every license that is not revoked again with the new key without emailing customers; apps receive the new version with their next refresh. Remove the old key from your apps and the server once no license of it is in use anymore.

## Webhooks

```ts
createLicenseServer({
  // …
  webhooks: [
    { url: "https://example.ch/hooks/integral", secret: process.env.HOOK_SECRET },
    { url: process.env.SLACK_URL!, format: "slack", events: ["issued", "revoked"] },
  ],
});
```

Every event of the [audit trail](#audit-trail) is sent to the matching targets. `format` is `json` (default: `{ id, type, at, licenseId, data }`), `slack` or `teams` (a short text). With a `secret`, each request carries `x-integral-signature: sha256=<hex>`, the HMAC-SHA256 of the body; `signDelivery(body, secret)` computes it for your check. A target that does not answer within 5 seconds or fails is skipped and never breaks the license change.

## Emails

```ts
createLicenseServer({
  // …
  mail: {
    appName: "My App",
    locale: "de", // or "en"
    portalUrl: "https://polar.sh/my-org/portal",
    supportEmail: "support@example.ch",
    send: ({ to, subject, text, html }) => mailer.send({ from, to, subject, text, html }),
  },
});
```

The customer gets a mail on `issued`, `renewed`, `canceled`, `ended` and `revoked` (option `events` to choose). The license key is included unless the license was revoked or ended. `licenseMail(record, event, options)` returns the texts if you prefer to send them yourself. A failing `send` is logged as `mail_failed` and does not fail the license change.

## Import from another system

Since 0.6.0 you can move customers from Keygen, Cryptlex or a spreadsheet. Export the licenses as CSV and import them:

```ts
import { importLicenses, rowsFromCsv } from "@weber-development/integral-server";

const rows = rowsFromCsv(await readFile("licenses.csv", "utf8"));
const check = await importLicenses(licenses, rows, {
  plans: { "Pro Yearly": "pro", "Team": "team" }, // plan or policy of the old system → your plan
  defaultPlan: "pro", // optional; without it unknown plans are refused
  dryRun: true,
});
check.errors; // [{ row: 3, reason: 'unknown plan "Trial"' }]
await importLicenses(licenses, rows, { plans: { "Pro Yearly": "pro", Team: "team" } });
```

`rowsFromCsv` finds the columns by common names: `key` or `id` (reference), `email`, `policy`, `plan` or `product`, `expiry` or `expiresAt`, `maxMachines` or `seats`, `name`. Pass `{ plan: "Your column" }` as second argument for other headers. The old keys do not work with Integral: every customer gets a new license, which you can send with [`licenseMail()`](#emails). Importing the same file twice does not create duplicates. Leave the `mail` option unset during the import, or customers get a mail for each license.

## Usage billing with Polar Meters

```ts
createLicenseServer({
  // …
  polarMeters: { accessToken: process.env.POLAR_TOKEN! },
});
```

Every counted `recordUsage` is sent to Polar as an event (`POST /v1/events/ingest`) named after the metric, for the Polar customer of the license, with the metadata `amount`, `license_id` and `period`. In Polar, create a meter that filters on this event name and sums `amount`, and attach it to a product. The token needs the `events:write` scope. Use `eventName: (metric) => "app." + metric` to rename events. Refused usage and licenses without a Polar customer (manual or imported ones) are not sent. If Polar cannot be reached, the usage is still counted and `meter_failed` appears in the audit trail.

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
