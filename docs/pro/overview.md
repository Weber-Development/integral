---
title: Integral Pro
description: A license server for Polar and a React activation view for your app.
---

The free packages verify licenses. Integral Pro runs the other half: it issues them.

| Package | What it does |
|---|---|
| [`@weber-development/integral-server`](server.md) | Listens to Polar webhooks and keeps one signed license per order or subscription: issued on purchase, extended on renewal, limited to the paid update period after cancellation, revoked on refund. Storage for SQLite, Postgres and MySQL, a fetch handler for Next.js, Hono, Bun, Deno and Workers. Device activations, floating seats, usage metering and Polar Meters, trials, audit trail, admin API, key rotation, webhooks, license emails and import from Keygen, Cryptlex or CSV |
| [`@weber-development/integral-portal`](portal.md) | React license activation: customers paste their Polar key, the app exchanges it for a signed license, verifies it offline, stores it, picks up renewals and shows upgrade prompts. Also trial signup, offline activation, floating seats and a license admin view |

```text
Polar ── webhook ──▶ integral-server ──▶ database
                         ▲   │ signed license
     Polar license key   │   ▼
            app (integral-portal) ── verifies offline with the public key
```

## Licence and plans

Plans and prices are on [packages.sweber.dev/integral](https://packages.sweber.dev/integral). After cancelling a subscription, the versions you installed keep working; only updates and access to new versions end. Your own customers never need a licence for Integral Pro, even though `integral-portal` ships inside your app.

## Installation

The packages are delivered through GitHub Packages. After purchase you get read access to the repository `Weber-Development/integral-pro-dist`, which contains the full installation guide. In short:

```ini title=".npmrc"
@weber-development:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${INTEGRAL_PRO_TOKEN}
```

```sh
npm i @sweberdev/integral @weber-development/integral-server          # backend
npm i @sweberdev/integral-react @weber-development/integral-portal     # React app
```
