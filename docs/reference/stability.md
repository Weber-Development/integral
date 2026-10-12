---
title: Stability and versions
description: What stays the same in Integral 2.x, how versions are numbered and how to update.
---

Integral 2.0 keeps the promise of 1.0: what is documented here keeps working in every 2.x release. You can update within 2.x without changing your code. The breaking changes between 1.x and 2.0 are listed in [Migrating to 2.0](../migrating-to-2.md); 1.x gets fixes for 12 months from the release of 2.0.0.

## What is frozen

- **Formats.** License keys (`int2.…`), revocation lists (`intr2.…`) and activation requests (`intq1.…`) keep their format. The 1.x formats `int1` and `intr1` stay readable in every 2.x release. A license signed today verifies in every 2.x release. A new format would get a new prefix and be read next to the old one.
- **Public API.** The functions, options and result shapes in the [API reference](api.md), and the routes, options and store interface of [Integral Pro](../pro/overview.md). New options and new fields in results may be added; existing ones are not removed or renamed, and their meaning does not change.
- **Failure reasons.** The `reason` values of `verifyLicense`, `bindLicense` and the server's results may gain new values. Handle unknown values like an invalid license.
- **Database schema.** Integral Pro only adds tables and columns, with `IF NOT EXISTS`. Run `sqlSchema` again after an update; existing data stays untouched.

## What can change in a minor release

New functions, options, routes, events, labels and tables; stricter validation of input that was never valid; fixes. Anything that could break a working setup waits for 3.0 and is announced in the release notes at least one minor release before.

## Version numbers

Integral follows semantic versioning: patch for fixes, minor for new features, major for breaking changes. `@sweberdev/integral` and `@sweberdev/integral-react` always have the same version. `@weber-development/integral-server` and `-portal` have the same version as each other and work with the free packages of the same major version (the 1.0.1 Pro patch also accepts 2.x) (`peerDependencies`).

## Updating from 0.x

There are no breaking changes between 0.3 and 1.0: licenses, keys and databases keep working. For Integral Pro run `sqlSchema` once to add the tables of floating licenses, usage and the audit trail (0.4.0). Install the 1.x versions of the free and Pro packages together.
