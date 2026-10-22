# App Store Connect — the full ASC API via the signed proxy

`superwall asc` proxies the **entire** App Store Connect API through Superwall's
signed request — no `.p8` file or JWT locally. It is schema-aware: it builds
JSON:API request bodies from flat params and validates them against Apple's own
OpenAPI spec before anything reaches App Store Connect. This lets an agent create
and manage subscriptions, IAPs, prices, and offers directly.

## Docs access — do this before every write

Never guess a request body. Before any `asc post` / `asc patch`, look up the
exact schema:

```bash
superwall asc docs                            # catalog: every resource root
superwall asc docs "introductory offer"        # find endpoints by keyword
superwall asc docs /v1/subscriptions post      # exact schema: required fields, enums, relationships, example
```

If you send a malformed body, the proxy **blocks it locally** and returns the
precise fix — a missing required field, an invalid enum value — before it ever
hits Apple's opaque errors. Read the correction and retry. Keep validation enabled
and correct the payload.

The schema is fetched from Apple on first use (a one-time few-second load),
cached under `~/.superwall`, and refreshed automatically in the background when
stale. Force an update with `superwall asc docs --refresh`.

## Flat params, not hand-written JSON:API

Pass flat `-d key=value`; the proxy assembles the JSON:API envelope
(`data.type` / `attributes` / `relationships`), casts values by declared type,
and wraps each relationship id. A relationship value is just the target id.

```bash
superwall asc post /v1/subscriptions \
  -d name="Premium Monthly" -d productId=com.acme.pro.monthly \
  -d subscriptionPeriod=ONE_MONTH -d group=<subscriptionGroups id> --json
```

An already-enveloped body (`-d data[type]=…`) is passed through untouched.

## Recipe: a subscription ready for review

Apple needs a group, the subscription, its localization, where it is sold, a
price in every territory, and a review screenshot. The resource commands do
each in one step on Apple's current endpoints and end by reporting what is
still `missing`:

```bash
# 1. A group (one per app is typical), with its en-US name
superwall asc subscription-groups create --asc-app <bundle-id> --reference-name Pro --display-name Pro --json

# 2. The subscription: localization, availability, the price equalized to every territory, a free trial
superwall asc subscriptions create --group <group-id> --asc-app <bundle-id> \
  --product-id pro_monthly --name "Pro Monthly" --subscription-period ONE_MONTH \
  --price 9.99 --display-name "Pro" --description "Everything unlocked" --trial ONE_WEEK --json

# 3. The App Review screenshot, then submit (an app's first products go with a version: asc release submit)
superwall asc screenshots upload --subscription <id> review.png
superwall asc submit --asc-app <bundle-id> --group <group-id> --subscription <id>
```

Add `--dry-run` to any write to see every request first. Reach for raw
requests (`asc get|post|patch|delete`) only for what these don't cover.

## Products: the asc resource commands

Selling something on the App Store takes many Apple calls (product, version,
localization, availability, a price in every territory, a review screenshot).
The resource commands do each job in one step, on Apple's current endpoints.
Reach for them before raw requests:

```bash
superwall asc apps --json                                   # ASC apps for the team
superwall asc products <bundle-id | asc-app-id> --json       # everything one app sells
superwall asc subscription-groups list <bundle-id> --json
superwall asc subscriptions list <bundle-id> --json
superwall asc iaps list <bundle-id> --json

# A subscription ready for review: localization, availability, price equalized everywhere
superwall asc subscriptions create --group <id|name> --asc-app <bundle-id> \
  --product-id pro_monthly --name "Pro Monthly" --subscription-period ONE_MONTH \
  --price 9.99 --display-name "Pro" --description "Everything unlocked" --trial ONE_WEEK

superwall asc iaps create --asc-app <bundle-id> --product-id coins_100 --name "100 coins" \
  --in-app-purchase-type CONSUMABLE --price 0.99 --display-name "100 coins"

superwall asc prices points --subscription <id> --territory USA --price 9.99   # Apple's price tier
superwall asc prices set --subscription <id> --price 12.99 --preserve-current-price
superwall asc offers create --subscription <id> --offer-mode FREE_TRIAL --duration ONE_WEEK   # every territory
superwall asc offers list --subscription <id>
superwall asc availability set --iap <id> --available-territories USA,CAN
superwall asc localizations add --subscription <id> --locale de-DE --name "Pro" --description "…"
superwall asc screenshots upload --subscription <id> review.png   # needed before review
superwall asc submit --asc-app <bundle-id> --group <id> --subscription <id>
```

Releases have their own commands:

```bash
superwall asc versions create --asc-app <bundle-id> --version-string 1.4.0
superwall asc builds list <bundle-id> --version-string 1.4.0
superwall asc builds attach <build-id> 1.4.0 --asc-app <bundle-id>
superwall asc metadata update 1.4.0 --asc-app <bundle-id> --locale en-US --whats-new "…"
superwall asc release submit 1.4.0 --asc-app <bundle-id> [--subscription <id>]   # first in-app products ship with a version
superwall asc release status 1.4.0 --asc-app <bundle-id>
superwall asc release phased start 1.4.0 --asc-app <bundle-id>
```

Raw requests to an endpoint Apple has replaced print a warning naming the replacement.

Every write takes `--dry-run` (prints each request, sends nothing). `create`
ends by reporting the product's `state` and anything still `missing` before it
can be submitted. `superwall asc <resource> --help` lists each one's operations.

Everything else goes through the raw proxy (`asc get|post|patch|delete /v1/…`),
which is where validation applies.

## Connecting ASC credentials

Connecting an app's Apple keys, pointing Apple's server notifications at
Superwall, and choosing the revenue provider are in the
[Apple setup reference](apple-setup.md). Read it before running any
`superwall asc keys`, `superwall asc notification-url`, `superwall setup apple`
or `superwall apps update --revenue-provider` command.

The short version: look at what is saved (`superwall apps get <app>`), import a
key the organization already has (`superwall asc keys import --app <app>`), and
have the user create only what is still missing. Do not ask for, inspect, or
upload an Apple password, private key, JWT, or authentication secret.
