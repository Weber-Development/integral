---
title: API
description: All exports of @sweberdev/integral and @sweberdev/integral-react.
---

## `@sweberdev/integral`

| Export | Description |
|---|---|
| `generateKeyPair()` | New Ed25519 key pair as base64url strings `{ publicKey, privateKey }` |
| `signLicense(input, privateKey)` | Signs a license, returns the license key. `id` and `iat` are added if missing; dates may be `Date` or ISO strings |
| `verifyLicense(license, options)` | `{ valid: true, license }` or `{ valid: false, reason, license? }`. Options: `publicKey` (string or array), `product`, `now`, `clockTolerance` |
| `decodeLicense(license)` | Content without checking the signature, or `null` |
| `coversRelease(license, releasedAt)` | `false` if the release is after `updatesUntil` |
| `definePlans(plans)` | Validates and returns plan definitions |
| `createEntitlements({ plans, license?, fallbackPlan? })` | Entitlements object, see [Plans](../guides/plans.md) |
| `resolvePlan(plans, name)` | A plan with inherited features and limits |
| `planFor(plans, feature)` | First plan that includes a feature, or `null` |
| `EntitlementError` | Thrown by `require()`; has `feature` and `plan` |
| `withOfflineGrace(check, options)` | Cache and grace period for online checks, see [Offline grace](../guides/offline.md) |
| `memoryStorage()`, `browserStorage(prefix?)` | Storage for `withOfflineGrace` |
| `LICENSE_PREFIX` | `"int1"` |

Types: `LicensePayload`, `LicenseInput`, `LicenseVerification`, `LicenseInvalidReason`, `Plans`, `PlanDefinition`, `ResolvedPlan`, `Entitlements`, `LimitCheck`, `LimitValue`, `LicenseStorage`, `CheckOutcome`, `CachedOutcome`.

## `@sweberdev/integral/polar`

| Export | Description |
|---|---|
| `createPolarClient({ organizationId, benefitId?, sandbox?, baseUrl?, fetch? })` | Client with `validate(key, { activationId?, incrementUsage?, conditions? })`, `activate(key, { label, conditions?, meta? })` and `deactivate(key, activationId)` |
| `PolarError` | Thrown for server errors; has `status` |

Types: `PolarClient`, `PolarLicenseKey`, `PolarActivation`, `PolarResult`, `PolarReason`.

## `@sweberdev/integral-react`

| Export | Description |
|---|---|
| `IntegralProvider` | Provides an entitlements object |
| `Feature` | `name`, `fallback` |
| `Limit` | `name`, `used`, `amount`, `fallback`; children may be render functions |
| `useEntitlements()`, `useFeature(name)`, `useLimit(name, used, amount?)` | Hooks |
| `useLicenseCheck(check, key)` | Async check state with `refresh()` |
