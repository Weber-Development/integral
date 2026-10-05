# Integral

Licenses, plans and feature entitlements for developers who sell software. Signed offline license keys (Ed25519), plans with features and limits, Polar.sh license key validation and React feature gates. Zero dependencies; runs in Node 20+, browsers, Bun, Deno and edge runtimes.

| Package | What it does |
|---|---|
| [`@sweberdev/integral`](packages/core) | Sign and verify licenses, plans and entitlements, Polar license keys, offline grace, revocation lists, device binding, CLI |
| [`@sweberdev/integral-react`](packages/react) | `IntegralProvider`, `<Feature>`, `<Limit>`, `useFeature`, `useLicenseCheck` |

```sh
npm i @sweberdev/integral
npx integral keygen
npx integral issue --product my-app --plan pro --email kunde@example.ch
```

```ts
import { createEntitlements, definePlans, verifyLicense } from "@sweberdev/integral";

const plans = definePlans({
  free: { features: ["editor"], limits: { projects: 1 } },
  pro: { extends: "free", features: ["export"], limits: { projects: 50 } },
});

const result = await verifyLicense(license, { publicKey: INTEGRAL_PUBLIC_KEY, product: "my-app" });
const entitlements = createEntitlements({ plans, license: result.valid ? result.license : null });

entitlements.has("export");
entitlements.check("projects", projects.length).allowed;
```

### Polar license keys

```ts
import { createPolarClient } from "@sweberdev/integral/polar";

const polar = createPolarClient({ organizationId: POLAR_ORG_ID });
const result = await polar.validate(key); // no access token needed
```

### Licenses that end updates, not usage

```ts
await signLicense({ product: "my-app", plan: "pro", updatesUntil: "2027-10-05" }, privateKey);
coversRelease(license, BUILD_DATE); // false for versions released after the update period
```

### Revocation lists, device binding and trials

```ts
const list = await verifyRevocationList(downloaded, { publicKey }); // signed, works offline
await verifyLicense(key, { publicKey, revocations: list, machine: await machineId(hostId) });
licenseStatus(license); // { state: "expiring", trial: true, daysLeft: 6, ... }
```

Documentation and live demo: [packages.sweber.dev/integral](https://packages.sweber.dev/integral)

**Integral Pro** adds a license server that turns Polar orders and subscriptions into signed licenses, and a React activation view: [packages.sweber.dev/integral/docs/pro/overview](https://packages.sweber.dev/integral/docs/pro/overview).

Integral is not copy protection: anyone who can change your app can remove a check. It makes honest use easy.

MIT © Seya Weber
