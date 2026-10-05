---
title: License keys
description: The license format, what it contains and how verification works.
---

An Integral license is a string like `int1.eyJ2IjoxLC….Qx8f…`: a prefix, the license data as base64url JSON, and an Ed25519 signature over both. It fits in an environment variable, a license file or a text field.

## Contents

| Field | Meaning |
|---|---|
| `id` | Unique id, generated if you do not pass one. Stays the same when you re-issue a license. |
| `product` | Your product. `verifyLicense({ product })` rejects licenses for other products. |
| `plan` | Plan name from your plan definitions. |
| `features`, `limits` | Extras on top of the plan. |
| `seats` | Seats, if you sell per person or machine. |
| `customer` | `id`, `email`, `name`. Optional; it is readable by anyone who has the license. |
| `iat`, `nbf` | Issued at, not valid before. |
| `exp` | Hard expiry: the license stops working. |
| `updatesUntil` | End of updates: newer versions are not covered, older ones keep working. See [Update periods](updates.md). |
| `kid` | Key id for key rotation. |
| `meta` | Small free-form data, e.g. an order id. |

Licenses are signed, not encrypted. Do not put secrets in them.

## Verification

```ts
const result = await verifyLicense(license, {
  publicKey: [CURRENT_KEY, PREVIOUS_KEY], // rotation: several keys are accepted
  product: "my-app",
  clockTolerance: 300, // seconds, for nbf and exp
});
```

Verification is offline and takes well under a millisecond. To show license details without trusting them, use `decodeLicense(license)`, which does not check the signature.

## Key rotation

1. Create a new key pair and ship an app version that accepts both public keys.
2. Sign new licenses with the new key and set `kid`.
3. Once old licenses are replaced or no longer matter, remove the old public key.

## Where to keep the private key

On your server or in your CI secrets, never in the app. If it leaks, anyone can issue licenses: create a new key pair, re-issue all licenses and ship an app version that only accepts the new public key.
