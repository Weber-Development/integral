import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { generateKeyPair } from "./keys.js";
import { decodeLicense, signLicense, verifyLicense } from "./license.js";
import type { LimitValue } from "./types.js";

const HELP = `integral – signed license keys

Usage:
  integral keygen [--out <dir>]
  integral issue --product <name> --plan <plan> [options]
  integral verify <license> --public-key <key> [--product <name>]
  integral inspect <license>

Options for issue:
  --private-key <key>        or INTEGRAL_PRIVATE_KEY, or --private-key-file <path>
  --feature <name>           repeatable
  --limit <key>=<n|unlimited> repeatable
  --seats <n>
  --email <address>  --customer-id <id>  --name <name>
  --expires <date>           hard expiry (license stops working)
  --updates-until <date>     updates end, older versions keep working
  --id <id>  --kid <key id>

A license argument of "-" reads from stdin.`;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").trim();
}

function parseLimits(values: string[] = []): Record<string, LimitValue> | undefined {
  if (!values.length) return undefined;
  const limits: Record<string, LimitValue> = {};
  for (const entry of values) {
    const [key, raw] = entry.split("=");
    if (!key || raw === undefined) throw new Error(`--limit expects key=value, got "${entry}"`);
    if (raw === "unlimited") limits[key] = null;
    else if (/^\d+$/.test(raw)) limits[key] = Number(raw);
    else throw new Error(`Limit "${key}" must be a number or "unlimited".`);
  }
  return limits;
}

export async function main(argv: string[], out = console): Promise<number> {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    out.log(HELP);
    return 0;
  }

  if (command === "keygen") {
    const { values } = parseArgs({ args: rest, options: { out: { type: "string" } } });
    const pair = await generateKeyPair();
    if (values.out) {
      await writeFile(`${values.out}/integral-public.key`, `${pair.publicKey}\n`);
      await writeFile(`${values.out}/integral-private.key`, `${pair.privateKey}\n`, {
        mode: 0o600,
      });
      out.log(`Wrote integral-public.key and integral-private.key to ${values.out}.`);
      out.log("Keep the private key secret. Never commit it.");
    } else {
      out.log(`INTEGRAL_PUBLIC_KEY=${pair.publicKey}`);
      out.log(`INTEGRAL_PRIVATE_KEY=${pair.privateKey}`);
    }
    return 0;
  }

  if (command === "issue") {
    const { values } = parseArgs({
      args: rest,
      options: {
        product: { type: "string" },
        plan: { type: "string" },
        "private-key": { type: "string" },
        "private-key-file": { type: "string" },
        feature: { type: "string", multiple: true },
        limit: { type: "string", multiple: true },
        seats: { type: "string" },
        email: { type: "string" },
        "customer-id": { type: "string" },
        name: { type: "string" },
        expires: { type: "string" },
        "updates-until": { type: "string" },
        id: { type: "string" },
        kid: { type: "string" },
      },
    });
    const privateKey =
      values["private-key"] ??
      (values["private-key-file"]
        ? (await readFile(values["private-key-file"], "utf8")).trim()
        : process.env.INTEGRAL_PRIVATE_KEY);
    if (!privateKey)
      throw new Error("Missing private key (--private-key or INTEGRAL_PRIVATE_KEY).");
    if (!values.product || !values.plan) throw new Error("issue needs --product and --plan.");
    const customer =
      values.email || values["customer-id"] || values.name
        ? { email: values.email, id: values["customer-id"], name: values.name }
        : undefined;
    const license = await signLicense(
      {
        product: values.product,
        plan: values.plan,
        features: values.feature,
        limits: parseLimits(values.limit),
        seats: values.seats ? Number(values.seats) : undefined,
        customer,
        exp: values.expires,
        updatesUntil: values["updates-until"],
        id: values.id,
        kid: values.kid,
      },
      privateKey,
    );
    out.log(license);
    return 0;
  }

  if (command === "verify" || command === "inspect") {
    const { values, positionals } = parseArgs({
      args: rest,
      allowPositionals: true,
      options: { "public-key": { type: "string" }, product: { type: "string" } },
    });
    const arg = positionals[0];
    if (!arg) throw new Error(`${command} needs a license key.`);
    const token = arg === "-" ? await readStdin() : arg;
    if (command === "inspect") {
      const payload = decodeLicense(token);
      if (!payload) {
        out.error("Not an Integral license key.");
        return 1;
      }
      out.log(JSON.stringify(payload, null, 2));
      out.log("(signature not checked)");
      return 0;
    }
    const publicKey = values["public-key"] ?? process.env.INTEGRAL_PUBLIC_KEY;
    if (!publicKey) throw new Error("Missing public key (--public-key or INTEGRAL_PUBLIC_KEY).");
    const result = await verifyLicense(token, { publicKey, product: values.product });
    if (result.valid) {
      out.log(`valid: ${result.license.product} / ${result.license.plan} (${result.license.id})`);
      return 0;
    }
    out.error(`invalid: ${result.reason}`);
    return 1;
  }

  out.error(`Unknown command "${command}".\n\n${HELP}`);
  return 1;
}
