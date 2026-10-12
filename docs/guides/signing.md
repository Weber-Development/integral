---
title: Signing keys and KMS
description: Choose Ed25519 or ECDSA P-256, rotate keys by key id and sign with a key that never leaves your KMS or HSM.
---

Integral signs licenses with one of two algorithms. Both are verified with the Web Crypto API, in Node, browsers, Bun, Deno and edge runtimes.

| Algorithm | Header `alg` | Public key string | Private key string |
|---|---|---|---|
| Ed25519 (default) | `EdDSA` | base64url of the 32-byte key | base64url PKCS#8 |
| ECDSA P-256 | `ES256` | `p256.` + base64url of the 65-byte uncompressed point | base64url PKCS#8 |

```ts
import { generateKeyPair, signLicense, verifyLicense } from "@sweberdev/integral";

const ec = await generateKeyPair({ alg: "ES256" });
const license = await signLicense({ product: "app", plan: "pro" }, ec.privateKey);
await verifyLicense(license, { publicKey: ec.publicKey }); // { valid: true, ... }
```

On the command line: `npx integral keygen --alg es256`.

The header of an `int2` license contains the algorithm and, if you set `kid`, the key id. `verifyLicense` only tries public keys of the same algorithm, so a key ring can mix Ed25519 and P-256 keys:

```ts
await verifyLicense(license, {
  publicKey: { "2026-a": ed25519Key, "2027-a": p256Key },
});
```

## Signing with a KMS or HSM

Instead of a private key string, `signLicense`, `signRevocationList`, `bindLicense` and `upgradeLicense` accept a **signer**: an object with the algorithm, an optional key id and a `sign` function. The private key never has to leave the service.

```ts
import { ecdsaDerToRaw, type Signer } from "@sweberdev/integral";

const signer: Signer = {
  alg: "ES256",
  kid: "kms-2027",
  // data is the exact byte string to sign; return a raw r||s signature (64 bytes).
  sign: async (data) => ecdsaDerToRaw(await kmsSignSha256(data)),
};
const license = await signLicense({ product: "app", plan: "pro" }, signer);
```

Many services (AWS KMS `Sign` with `ECDSA_SHA_256`, Google Cloud KMS `asymmetricSign` for EC P-256, Azure Key Vault `ES256`) hash the message themselves or expect a SHA-256 digest and return a DER signature. Hash `data` with SHA-256 if the service wants a digest, and convert the answer with `ecdsaDerToRaw`. Azure and Vault return the raw form already. Export the public key once and give it to your app as `p256.…` (uncompressed point, base64url).

**Verification status.** The signer interface and the DER conversion are tested in Integral's test suite with local keys. The ready-made adapters of Integral Pro were not run against real KMS accounts and are marked beta, see [Integral Pro](../pro/server.md).
