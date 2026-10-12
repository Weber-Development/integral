---
"@sweberdev/integral": major
"@sweberdev/integral-react": major
---

Integral 2.0: new license format `int2` with algorithm agility (Ed25519 and ECDSA P-256, key id in the header), `intr2` revocation lists, `Signer` objects for KMS/HSM signing, `upgradeLicense` and `integral migrate` to convert `int1` licenses, `integral keygen --alg es256`. `int1` and `intr1` stay readable. Breaking: `signLicense` and `signRevocationList` issue `int2`/`intr2` by default (`format: "int1"` for old verifiers), `LICENSE_PREFIX` is `int2`, `LicensePayload.v` is `1 | 2`, Node 22 or newer. See docs/migrating-to-2.md.
