---
title: Migrating to 2.0
description: What breaks in Integral 2.0 and how to update the free packages, Integral Pro and your existing licenses.
---

Integral 2.0 changes the default license format and needs Node 22. Licenses you issued before keep working. This page lists every breaking change and what to do about it.

## Order of updates

1. Update `@sweberdev/integral` (and `@sweberdev/integral-react`) in your app. Existing `int1` licenses still verify.
2. If you use Integral Pro, update to `@weber-development/integral-server` and `-portal` 2.x at the same time. Pro 1.0.1 already accepts the 2.x free packages, so you can update in two steps.
3. Run `sqlSchema` again (Pro) if you have not since 1.0. 2.0 itself changes no tables.
4. Optionally convert old licenses with `integral migrate`, see below.

## Breaking changes

| Change | What to do |
|---|---|
| **Node 22 or newer** (`engines`) | Update the runtime. Browsers and edge runtimes are not affected. |
| **`signLicense` and `signRevocationList` issue `int2` and `intr2`** by default. Payload field `v` is `2`. | Apps that run 1.x verifiers cannot read `int2`. Update those apps first, or pass `{ format: "int1" }` to `signLicense` (`format: "intr1"` for revocation lists) until they are updated. |
| **`LICENSE_PREFIX` is `"int2"`**, `REVOCATION_PREFIX` is `"intr2"`. The old values are `LEGACY_LICENSE_PREFIX` and `LEGACY_REVOCATION_PREFIX`. | Code that checks `license.startsWith("int1.")` should accept both, or use `decodeLicense`. |
| **`LicensePayload.v` is `1 \| 2`.** | Only affects code that narrows on `v === 1`. |
| **`signLicense`, `bindLicense` and friends take a `SigningKey`** (private key string or `Signer`). | Strings keep working. |
| **Pro: `createLicenseServer` takes `privateKey` or `signer`.** Both are optional in the types; one is required at runtime. | Nothing to do if you pass `privateKey`. |
| **Pro: handler options for sources.** `sources: [polarSource(…), …]` is new; `webhookSecret` is optional and still means Polar at `/webhook`, but the handler throws at start if neither is set. | See [Other payment sources](pro/server.md). |
| **Pro: `LicenseServer` has a new method `devices()`** (custom implementations or mocks of the interface need it). | Add it if you wrap or mock `LicenseServer`. The store interface is unchanged: no new tables or columns. |

Revocation lists and activation requests: `intr1` lists are still read; `intq1` requests do not change.

## Converting old licenses

`int1` licenses never expire because of the update, but customers can only get the new algorithm options when you issue `int2`. To convert licenses you hold (one per line in a file or from a database export):

```sh
npx integral migrate --file licenses.txt --private-key-file integral-private.key > migrated.txt
```

Each converted license keeps its id, plan, features, dates and device, so revocation lists and renewals still match. Licenses with a bad signature are skipped and reported on stderr. In code: `upgradeLicense(license, privateKey, { publicKey })`. To move to a new algorithm, pass the old public key in `publicKey` and the new private key (or signer) as the second argument.

## Rotating to ECDSA P-256 or a KMS key

1. Generate the new key (`keygen --alg es256`) or export the public key of your KMS key as `p256.…`.
2. Ship the new public key to your apps next to the old one: `publicKey: { old: edKey, new: p256Key }`.
3. Issue new licenses with the new key and a `kid`. Convert existing ones with `migrate` if you want them on the new key.
4. Remove the old public key when no license signed with it is left.

See [Signing keys and KMS](guides/signing.md).

## Support for 1.x

1.x gets fixes for 12 months after the release of 2.0.0. Prices and licenses of Integral Pro do not change.
