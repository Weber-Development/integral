---
title: Device activation
description: Bind licenses to devices, online through your server or offline with a request file.
---

A license with a `machine` field only works on that device (see [Revocation](./revocation.md) for `machineId()` and `verifyLicense({ machine })`). Since 0.3.0 you no longer need to know the device when you sell the license: the customer activates it on their device later, and you sign a bound copy.

```ts
import { bindLicense, machineId } from "@sweberdev/integral";

// In the app
const machine = await machineId(hostId, username);

// On your server
const result = await bindLicense(license, machine, process.env.INTEGRAL_PRIVATE_KEY!, {
  product: "my-app",
});
if (result.ok) return result.license; // same id, plan and dates, plus `machine`
else result.reason; // "bad_signature", "expired", "bound_elsewhere", …
```

`bindLicense` checks the license with the public key that belongs to your private key. It refuses licenses that are invalid, expired, revoked by `exp`, for another product (with `product`) or already bound to another device. Binding again to the same device returns a fresh copy. Because the id stays the same, revocation lists and renewals keep working.

`bindLicense` does not count devices. To limit how many devices one license may activate, keep a list per license on your server, or use [Integral Pro](../pro/server.md#device-activations), which does it for you.

## Offline activation

For computers without internet, the activation runs through a file:

1. The app (or the customer with the CLI) creates an activation request: the license and the device id in one string.
2. The customer sends it to you, for example by email.
3. You turn it into a bound license and send that back. The customer pastes it into the app.

```ts
import { createActivationRequest, readActivationRequest } from "@sweberdev/integral";

// In the app: save as activation.txt
const request = createActivationRequest({ license, machine, label: "Workshop PC" });

// On your side
const { license, machine } = readActivationRequest(request)!;
const result = await bindLicense(license, machine, privateKey, { product: "my-app" });
```

Or with the [CLI](./cli.md):

```sh
npx integral request <license> --machine <id> > activation.txt   # on the customer's side
npx integral activate - --product my-app < activation.txt        # on yours, with INTEGRAL_PRIVATE_KEY
```

The request is not signed and contains nothing secret beyond the license itself. Everything that matters is checked when you activate it.
