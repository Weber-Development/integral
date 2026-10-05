---
title: CLI
description: Create key pairs, issue, verify and inspect licenses from the terminal.
---

```sh
npx integral keygen                 # prints INTEGRAL_PUBLIC_KEY and INTEGRAL_PRIVATE_KEY
npx integral keygen --out ./keys    # writes two files, the private one with mode 600
```

```sh
npx integral issue --product my-app --plan pro \
  --feature beta --limit projects=100 --limit seats=unlimited \
  --email kunde@example.ch --name "Kunde AG" \
  --updates-until 2027-10-05
```

| Option | Meaning |
|---|---|
| `--private-key`, `--private-key-file` | Signing key. Default: `INTEGRAL_PRIVATE_KEY` |
| `--feature` | Extra feature, repeatable |
| `--limit key=n` | Limit override, `unlimited` for no limit, repeatable |
| `--seats` | Number of seats |
| `--email`, `--name`, `--customer-id` | Customer |
| `--expires` | Hard expiry |
| `--updates-until` | End of updates |
| `--id`, `--kid` | License id, key id |

```sh
npx integral verify <license> --public-key <key> --product my-app   # exit code 0 or 1
npx integral inspect <license>                                       # shows the content, unchecked
echo "$LICENSE" | npx integral verify - --public-key "$INTEGRAL_PUBLIC_KEY"
```
