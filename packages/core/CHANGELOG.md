# @sweberdev/integral

## 1.0.0

### Major Changes

- a2f8fc4: Integral 1.0.0. The public API and the formats (`int1`, `intr1`, `intq1`) are now stable for all of 1.x, see "Stability and versions" in the docs. No breaking changes since 0.3.0.

  - `verifyLicense` also accepts an object `{ [kid]: publicKey }` as `publicKey`: a license with a `kid` is checked against that key first, which keeps key rotation cheap with many keys.
  - A test guards the documented exports so they cannot be removed by accident.

## 0.3.0

### Minor Changes

- 6d18d15: Device activation: `bindLicense()` signs a copy of a license bound to one device (same id, plan and dates). Offline activation with `createActivationRequest()` / `readActivationRequest()` (`intq1.…`) and the CLI commands `integral request` and `integral activate`. New `publicKeyFromPrivateKey()`.

## 0.2.0

### Minor Changes

- f0fce80: Signed revocation lists (`signRevocationList`, `verifyRevocationList`, `verifyLicense({ revocations })`) to revoke licenses that are only checked offline. Device binding with `machineId()` and `verifyLicense({ machine })`. Trial licenses and `licenseStatus()` for expiry and update-period warnings. CLI: `integral revoke`, `issue --machine --trial`, `verify --machine --revocations`.

## 0.1.0

### Minor Changes

- ee23dd6: First release: signed offline licenses (Ed25519), plans and entitlements, Polar license keys, offline grace, CLI and React bindings.
