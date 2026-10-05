---
title: Why Integral
description: Licenses, plans and feature entitlements for developers who sell software, without a licensing SaaS.
---

If you sell a desktop app, a self-hosted tool, a CLI or a paid library, you need three things: a license your customers can enter, a way to tell in code what their plan allows, and a connection to the shop that takes the money. Licensing services such as Keygen solve this as a hosted API with a monthly bill and a hard dependency at runtime.

Integral is a library instead:

- **Signed offline licenses.** Licenses are signed with Ed25519 on your side and verified in your app with the public key. No server is needed to check them, and nobody can forge or change one without your private key.
- **Plans and entitlements in code.** Declare plans with features and limits once, then ask `has("export")` or `check("projects", used)` anywhere.
- **Polar.sh built in.** Validate, activate and deactivate Polar license keys through Polar's public API, without an access token in your app.
- **Keeps working offline.** Online checks get a cache and a grace period, so a flaky connection does not lock out paying customers.
- **"Keep what you paid for" licenses.** A license can end updates instead of ending usage: versions released before the end date keep working.
- **React bindings.** `<Feature>`, `<Limit>`, `useFeature` and an async license check hook.

Integral has no dependencies and runs in Node 20+, browsers, Bun, Deno and edge runtimes (anything with the Web Crypto API and Ed25519).

## What Integral is not

Integral is not copy protection. Anyone who can change your application can remove a license check from it. Integral makes honest use easy and dishonest use deliberate, which is what most indie and B2B software needs.

## Integral Pro

[Integral Pro](pro/overview.md) adds a license server that turns Polar orders and subscriptions into signed licenses automatically, and a React view for activating licenses in your app.
