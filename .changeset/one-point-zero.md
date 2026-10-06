---
"@sweberdev/integral": major
"@sweberdev/integral-react": major
---

Integral 1.0.0. The public API and the formats (`int1`, `intr1`, `intq1`) are now stable for all of 1.x, see "Stability and versions" in the docs. No breaking changes since 0.3.0.

- `verifyLicense` also accepts an object `{ [kid]: publicKey }` as `publicKey`: a license with a `kid` is checked against that key first, which keeps key rotation cheap with many keys.
- A test guards the documented exports so they cannot be removed by accident.
