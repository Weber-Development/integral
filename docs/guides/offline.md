---
title: Offline grace
description: Cache online license checks and keep apps working when the license server is unreachable.
---

```ts
import { browserStorage, withOfflineGrace } from "@sweberdev/integral";
import { createPolarClient } from "@sweberdev/integral/polar";

const polar = createPolarClient({ organizationId: ORG_ID });

const checkLicense = withOfflineGrace(() => polar.validate(key), {
  key: `polar:${key}`,
  storage: browserStorage(),
  ttl: 60 * 60 * 1000, // re-use a good answer for an hour
  grace: 7 * 24 * 60 * 60 * 1000, // tolerate a week without connection
});

const outcome = await checkLicense();
outcome.valid; // boolean
outcome.source; // "network" | "cache" | "grace"
```

How it decides:

1. A valid cached answer younger than `ttl` is returned without a request.
2. Otherwise the check runs. Its answer, valid or invalid, is stored.
3. If the check throws (network error, server error), a valid cached answer younger than `grace` is returned with `source: "grace"`. Otherwise the result is `{ valid: false, reason: "unreachable" }`.

Invalid answers are never served from the cache, so a customer who just bought a license is not stuck with an old "invalid".

## Storage

`withOfflineGrace` takes any object with `get`, `set` and `delete` (sync or async). Included:

- `memoryStorage()`: for servers and tests.
- `browserStorage(prefix?)`: `localStorage`, with an in-memory fallback in private windows or when storage is blocked.

For Electron or a CLI, store a small JSON file in the user's config directory.
