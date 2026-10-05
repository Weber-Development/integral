---
title: React
description: Feature gates, limits and license checks in React.
---

```sh
npm i @sweberdev/integral @sweberdev/integral-react
```

```tsx
import { createEntitlements } from "@sweberdev/integral";
import { Feature, IntegralProvider, Limit, useFeature } from "@sweberdev/integral-react";

const entitlements = createEntitlements({ plans, license });

<IntegralProvider entitlements={entitlements}>
  <App />
</IntegralProvider>;
```

## Feature

```tsx
<Feature name="export" fallback={<UpgradeHint />}>
  <ExportButton />
</Feature>
```

`name` can be an array; then all features are required.

## Limit

```tsx
<Limit name="projects" used={projects.length} fallback={(c) => <p>{c.limit} projects is the limit of your plan.</p>}>
  <NewProjectButton />
</Limit>
```

Children and fallback can be render functions that receive `{ limit, used, remaining, allowed }`.

## Hooks

- `useEntitlements()` returns the entitlements object.
- `useFeature("export")` returns a boolean.
- `useLimit("projects", used, amount?)` returns the limit check.
- `useLicenseCheck(check, key)` runs an async check (for example Polar validation wrapped in `withOfflineGrace`) whenever `key` changes, and returns `status` (`idle`, `loading`, `valid`, `invalid`, `error`), `result` and `refresh()`. Pass `null` as key to skip.

```tsx
const { status } = useLicenseCheck((key) => checkWithGrace(key), licenseKey || null);
```

Hide features in the UI for convenience, but enforce them where it matters: on your server for paid APIs, or in the code path itself for desktop apps.

For a ready-made activation form, renewal and upgrade prompt, see [Integral Pro portal](../pro/portal.md).
