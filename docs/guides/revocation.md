---
title: Revocation, devices and trials
description: Revoke offline licenses, bind licenses to one device and show trial or expiry status.
---

## Revoke licenses that are checked offline

An offline license stays valid until its `exp`. That becomes a problem after a refund or a leaked key, and lifetime licenses have no `exp` at all. A signed revocation list fixes this: you sign the revoked ids with the same private key, your app downloads the list now and then, and `verifyLicense` rejects every listed license.

```ts
import { signRevocationList } from "@sweberdev/integral";

// On your server, whenever a license is revoked:
const token = await signRevocationList({ ids: ["lic_123"], product: "my-app" }, privateKey);
// Serve `token` as text, e.g. from https://example.com/revocations
```

```ts
import { verifyLicense, verifyRevocationList } from "@sweberdev/integral";

const list = await verifyRevocationList(await (await fetch(url)).text(), {
  publicKey,
  product: "my-app",
});
const result = await verifyLicense(licenseKey, { publicKey, revocations: list });
// result.reason === "revoked" for listed licenses
```

The list is signed, so it can come from any host or be bundled with your app. Keep the last list you received and use it while offline. Plain ids you already trust (`new Set(["lic_123"])`) work too. From the terminal: `npx integral revoke lic_123 lic_456 --product my-app > revoked.txt`.

## Bind a license to one device

`machineId()` hashes values that identify a device into an anonymous id. Only the hash is sent to you. Put it into the license, and `verifyLicense` rejects the license on every other device:

```ts
import os from "node:os";
import { machineId, signLicense, verifyLicense } from "@sweberdev/integral";

const machine = await machineId(os.hostname(), os.userInfo().username);
// Your server issues a license with { machine } after activation:
await signLicense({ product: "my-app", plan: "pro", machine }, privateKey);
// In the app:
await verifyLicense(licenseKey, { publicKey, machine }); // reason "wrong_machine" elsewhere
```

Choose values that survive updates but differ between devices. In desktop apps, an OS machine id (for example from `node-machine-id`) works well.

## Trials and expiry warnings

Mark a trial with `trial: true` and give it an `exp`. `licenseStatus()` turns a verified license into what your UI needs:

```ts
import { licenseStatus } from "@sweberdev/integral";

const status = licenseStatus(result.license, { warnDays: 14 });
// { state: "active" | "expiring" | "expired" | "not_yet_valid",
//   trial, daysLeft, updatesEnded, updatesDaysLeft }
if (status.trial && status.state === "expiring") showBanner(`${status.daysLeft} days left`);
```
