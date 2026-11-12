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
superwall products create --identifier <identifier> \
  --price 39.99 \          # major units; converted to cents for you
  --currency USD \         # default USD
  --period year \          # day | week | month | year
  --period-count 1 \       # periods per cycle, default 1
  --trial-days 7 \         # optional free-trial length
  --entitlement pro \      # entitlement(s) to grant; repeat --entitlement for more
  --name "Pro Yearly" \    # optional display name
  --app <id> --json        # the app the entitlement is on
```

Use the **real store product identifiers** (the ones in App Store Connect / Google Play), e.g.
`com.app.pro.yearly`. The dashboard product identifier must match the store's or the SDK can't
resolve it on device.

### Import from App Store Connect

There is **no** `products import` subcommand. `superwall integrate --skill`
prints the full setup instructions without spawning another agent. To import
products yourself, use credentials the user has already connected privately,
enumerate via the signed ASC proxy, then create products in the approved scope.
If credentials are missing, have the user consult `superwall asc keys create --help`
at their own terminal and complete setup themselves. Do not request, inspect,
or upload their private key.

```bash
superwall asc keys list --json                # confirm connected; note the team id

# enumerate real products for the app (by bundle id or ASC app id)
superwall asc subscriptions list com.app.bundle --json   # renewing subs
superwall asc iaps list         com.app.bundle --json     # one-time / non-renewing
superwall asc products     com.app.bundle --json     # everything
superwall asc apps --json                            # list ASC apps if unsure of the id

# create each returned productId with its price, period and trial, granting your entitlement
superwall products create --identifier com.app.pro.yearly --price 24.99 --period year \
  --trial-days 7 --entitlement pro --app <id> --json
```

Take the price, period and trial from the ASC listing. `--price` is in major units (24.99),
`--currency` defaults to USD, `--period` is `day`, `week`, `month` or `year`, and
`--period-count` defaults to 1; leave out `--period` and `--trial-days` for a one-time product.
A product created without `--price` is left out of the `.storekit` export below, which writes
what Superwall holds.

### Generate a local `.storekit` file (for Xcode testing without sandbox)

```bash
superwall products storekit --project <id> --out Superwall.storekit --json
```

Writes each App Store product with its Superwall price, read in its currency's minor units
(399 USD is 3.99). Auto-renewable subscriptions go in one `Subscriptions` group with their
period, and their free or paid trial as the introductory offer; one-time products are written
as NonConsumable. Products of another store (Play, Stripe, custom), with no price, or with no
identifier are left out and named in a warning. Price one with
`superwall products update <id> --price '{"amount":<minor units>,"currency":"USD"}'`, where
`<id>` is its Superwall product id, then export again.

## Entitlements

```bash
superwall entitlements list --project <id> --json
superwall entitlements create --identifier pro --app <id> --json
```

Default to a single coarse `pro` entitlement. Add more only for genuine tiers (e.g. `pro`,
`team`). Products grant entitlements via `--entitlement` (id or identifier) at create time.
Pass the same `--app <id>` to the entitlement and the product: a native product only grants
entitlements on its own app. CLI 2.2.1 and older take only the numeric id from
`superwall entitlements list --json`; run `superwall upgrade` once a newer CLI is out.

## Campaigns + placements

```bash
superwall campaigns list --project <id> --app <id> --json
superwall campaigns create --description "Onboarding" --placement onboarding_complete --project <id> --app <id> --json
superwall campaigns placements create <campaignId> --event-name another_placement --project <id> --app <id> --json
```

- `create` takes a **description**, not an identifier - name it for the surface.
- A campaign can carry several related placements; call `campaigns placement` once per placement.
- Adding a placement that's already on the campaign is safe to skip - list first.

## What the CLI cannot do (leave manual)

- **Design the paywall** - either as code with the superwall framework (`superwall create` scaffolds
  a `superwall/` directory in the app; products are declared in the paywall's `config.ts`;
  `superwall publish` ships it) or in the dashboard's paywall editor.
  `superwall paywalls list --project <id> --app <id> --json` shows what exists.
- **Configure audiences / experiment splits** beyond the default - done in the dashboard.

Report these as the remaining manual steps.
