---
title: Administration
description: Search, revoke and inspect licenses through a token-protected API.
---

Since 0.4.0 `createAdminHandler` gives your back office an API for the licenses of your server. It is separate from the customer routes and protected by a bearer token.

```ts title="app/api/integral-admin/[...path]/route.ts"
import { createAdminHandler } from "@weber-development/integral-server";
import { licenses } from "@/lib/licenses";

const handler = createAdminHandler(licenses, {
  token: process.env.INTEGRAL_ADMIN_TOKEN!, // long random value, an empty token throws
  basePath: "/api/integral-admin",
});
export { handler as GET, handler as POST };
```

| Route | Purpose |
|---|---|
| `GET /licenses?q=&status=` | Search by email, name, plan or id; `status` is `active`, `canceled`, `ended` or `revoked` |
| `GET /licenses/:id` | License with devices, seats, usage and history |
| `POST /licenses/:id/revoke` | Revokes the license |
| `POST /licenses/:id/reissue` | Issues the license again, e.g. after a lost key |
| `POST /licenses/:id/devices/remove` `{ machine }` | Frees a device |
| `POST /licenses/:id/leases/remove` `{ holder }` | Frees a floating seat |
| `GET /events`, `GET /events.csv` | Audit trail as JSON or CSV (`license`, `limit`) |

The token is compared in constant time. Keep the route behind your own login or network rules as well. In CSV, cells that start with `=`, `+`, `-` or `@` are prefixed so spreadsheets do not run them. The React [`LicenseAdmin`](./portal.md#licenseadmin) view uses this API.
