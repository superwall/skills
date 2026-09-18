# Dashboard setup - reference

Detailed recipes for the `superwall-dashboard` skill. Every command takes `--json`.

## Scoping

| Resource               | Scope       | Flag             |
| ---------------------- | ----------- | ---------------- |
| products, entitlements | project     | `--project <id>` |
| campaigns, paywalls    | application | `--app <id>`     |

`superwall apps list --json` returns projects with nested `applications` (each has `id`,
`platform`, `bundle_id`, `public_api_key`). One project holds one app per platform, so with a
single app the CLI auto-scopes; agents always pass the flags explicitly.

## Products

### Create by hand (real pricing)

```bash
superwall products create <identifier> \
  --price 39.99 \          # major units; converted to cents for you
  --currency USD \         # default USD
  --period year \          # day | week | month | year
  --period-count 1 \       # periods per cycle, default 1
  --trial-days 7 \         # optional free-trial length
  --entitlement pro \      # entitlement(s) to grant; repeat --entitlement for more
  --name "Pro Yearly" \    # optional display name
  --project <id> --json
```

Use the **real store product identifiers** (the ones in App Store Connect / Google Play), e.g.
`com.app.pro.yearly`. The dashboard product identifier must match the store's or the SDK can't
resolve it on device.

### Import from App Store Connect

There is **no** `products import` subcommand. Two ways to import:

1. **Orchestrated (hands-off):** run `superwall integrate` - the CLI
   walks App Store Connect and imports products interactively.
2. **Agent-driven (you do it):** connect the key once, enumerate via the signed ASC proxy, then
   create each product:

   ```bash
   # one-time: upload the ASC API key to Superwall's vault (nothing stored locally)
   superwall asc keys set --key-id <KEY_ID> --issuer <ISSUER_ID> --key-file ./AuthKey_<KEY_ID>.p8 --json
   superwall asc keys list --json                # confirm connected; note the team id

   # enumerate real products for the app (by bundle id or ASC app id)
   superwall asc subscriptions com.app.bundle --json   # renewing subs
   superwall asc iaps         com.app.bundle --json     # one-time / non-renewing
   superwall asc products     com.app.bundle --json     # everything
   superwall asc apps --json                            # list ASC apps if unsure of the id

   # create each returned productId, granting your entitlement
   superwall products create com.app.pro.yearly --entitlement pro --project <id> --json
   ```

   Products imported this way carry only the identifier (and reference name); Xcode/StoreKit and
   the stores remain the source of truth for pricing.

### Generate a local `.storekit` file (for Xcode testing without sandbox)

```bash
superwall products storekit --project <id> --out Superwall.storekit --json
```

Seeds product identifiers into a StoreKit configuration file; Xcode refines pricing/types on import.

## Entitlements

```bash
superwall entitlements list --project <id> --json
superwall entitlements create pro --project <id> --json
```

Default to a single coarse `pro` entitlement. Add more only for genuine tiers (e.g. `pro`,
`team`). Products grant entitlements via `--entitlement` at create time.

## Campaigns + placements

```bash
superwall campaigns list --project <id> --app <id> --json
superwall campaigns create "Onboarding" onboarding_complete --project <id> --app <id> --json
superwall campaigns placement <campaignId> another_placement --project <id> --app <id> --json
```

- `create` takes a **description**, not an identifier - name it for the surface.
- A campaign can carry several related placements; call `campaigns placement` once per placement.
- Adding a placement that's already on the campaign is safe to skip - list first.

## What the CLI cannot do (leave manual)

- **Design the paywall** - in the dashboard's paywall editor.
  `superwall paywalls list --project <id> --app <id> --json` shows what exists.
- **Configure audiences / experiment splits** beyond the default - done in the dashboard.

Report these as the remaining manual steps.
