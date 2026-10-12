---
title: License activation (React)
description: Let customers activate their license in your app.
---

```tsx
import { Feature } from "@sweberdev/integral-react";
import {
  de,
  LicenseActivation,
  LicenseProvider,
  LicenseStatusBanner,
  UpgradePrompt,
} from "@weber-development/integral-portal";

<LicenseProvider
  publicKey={INTEGRAL_PUBLIC_KEY}
  product="my-app"
  plans={plans}
  endpoint="/api/integral"
  releasedAt={BUILD_DATE}
>
  <LicenseActivation labels={de} locale="de-CH" />
  <Feature name="export" fallback={<UpgradePrompt feature="export" featureLabel="Export" plans={plans} checkoutUrls={{ pro: PRO_CHECKOUT }} />}>
    <ExportButton />
  </Feature>
</LicenseProvider>;
```

`LicenseProvider`:

- reads the stored license on start and verifies it offline,
- accepts Integral licenses (`int1.…`) directly and exchanges any other key (a Polar license key) through `endpoint/exchange`,
- asks `endpoint/refresh` for a renewed license when the update period or expiry is less than `refreshWindowDays` (default 7) away, or the stored license is no longer valid,
- downloads the signed revocation list from `endpoint/revocations`, keeps the last one for offline use and rejects revoked licenses (`checkRevocations`, default on with `endpoint`),
- passes `machine` (from `machineId()`) to `verifyLicense`, so device-bound licenses only work on their device,
- with `bindToMachine` (since 0.3.0), activates every new license through `endpoint/activate` for this device, within the server's device limit, and frees the place again on `remove()`. `deviceLabel` names the device in the customer's list,
- provides entitlements to `<Feature>`, `<Limit>` and the hooks of `@sweberdev/integral-react`.

Without `endpoint`, only Integral licenses can be entered and nothing is refreshed.

## useLicense

```ts
const { status, license, error, entitlements, coversThisRelease, activate, refresh, remove } = useLicense();
```

`status` is `loading`, `none`, `active` or `invalid`. `coversThisRelease` is `false` if `releasedAt` lies after the license's update period.

## LicenseActivation

A form to enter a key and, once activated, an overview with plan, customer, update period and buttons to check for a renewal or remove the license. It is unstyled: style it through `className` or the `data-integral="license"` and `data-status` attributes. Errors are announced to screen readers. English (`en`, default) and German (`de`) labels are included; pass your own `PortalLabels` for other languages.

## LicenseStatusBanner

```tsx
<LicenseStatusBanner warnDays={14} renewUrl={CUSTOMER_PORTAL_URL} />
```

Warns before a trial, a license or its update period ends, with an optional renew link. It renders nothing otherwise. Style it through `data-integral="license-status"` and `data-kind` (`trial`, `expiring`, `updates`). Since 0.2.0.

## UpgradePrompt

Shows which plan includes a feature and links to its checkout, for example a Polar checkout link. It renders nothing if the feature is already included.

## useLease

```tsx
const { status, limit, offline, release, retry } = useLease({
  holder: "window-1",
  offlineGraceSeconds: 120,
});
if (status === "full") return <p>All {limit} seats are in use. <button onClick={retry}>Try again</button></p>;
```

Holds one seat of a floating license while the component is mounted: it asks `endpoint/lease`, repeats as a heartbeat (a third of the lease time, at least 10 seconds) and gives the seat back on unmount. `status` is `idle`, `acquiring`, `held`, `full` or `error`. Options: `holder`, `label`, `ttlSeconds`, `heartbeatSeconds`, `enabled`, `offlineGraceSeconds`. Since 0.4.0.

**Offline tolerance (2.0).** With `offlineGraceSeconds` the app keeps working when the server cannot be reached: after a successful heartbeat `status` stays `held` and `offline` is `true` until the grace time has passed, then it becomes `error`. Default 0 (an unreachable server is an `error` at once). The server frees the seat after its own lease time, so keep the grace time at or below it if seats must stay exact.

## DeviceList

```tsx
<DeviceList endpoint="/api/integral" machine={machineId} />
```

Shows the devices the license is activated on (`POST endpoint/devices`), marks this device and lets the customer remove one with `POST endpoint/deactivate`, to free a place without contacting you. Options: `locale`, `labels`, `className`, `fetch`. Since 2.0. Whoever holds the license key can see and remove its devices, as with `/deactivate`.

## LicenseAdmin

```tsx
<LicenseAdmin endpoint="/api/integral-admin" token={adminToken} />
```

An unstyled admin view for the [admin API](./admin.md): search, license details, revoke, issue again, remove devices and seats, usage, history and CSV export. English and German labels (`locale`, `labels`). Use it only in your own back office, never in the customer app. Since 0.4.0.

## TrialSignup

```tsx
<TrialSignup endpoint="/api/integral" />
```

Asks for an email address, requests a trial license from `endpoint/trial` and activates it. It shows clear messages when the address already had a trial or is invalid. Needs the server option `trial`. English and German (`locale`), your own texts through `labels`. Since 0.7.0.

## OfflineActivation

```tsx
<OfflineActivation machine={machine} deviceLabel="Lab PC" activationUrl="https://app.example.ch/api/integral/offline" />
```

For computers without internet: the customer enters the license key, copies the activation request to a computer with internet, opens the server's [offline page](./server.md#offline-activation-page), and pastes the license that comes back. The component activates it for this device. Since 0.7.0.

## Storage

The license is kept in `localStorage` (memory fallback). Pass `storage` for Electron, React Native or a cookie-based setup.
