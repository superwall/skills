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
hits Apple's opaque errors. Read the correction and retry. `--force` skips
validation and sends as-is.

The schema is fetched from Apple on first use (a one-time few-second load),
cached under `~/.superwall`, and refreshed automatically in the background when
stale. Force an update with `superwall asc docs refresh`.

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

## Recipe: create a subscription end to end

App Store Connect requires these in order; each step's returned id feeds the
next. Run `asc docs <path> post` for the full schema of any step.

```bash
# 1. Subscription group (one per app)
superwall asc post /v1/subscriptionGroups \
  -d referenceName="Premium" -d app=<ascAppId> --json

# 2. Subscription, inside that group
superwall asc post /v1/subscriptions \
  -d name="Premium Monthly" -d productId=com.acme.pro.monthly \
  -d subscriptionPeriod=ONE_MONTH -d group=<groupId> --json

# 3. Discover a price point (Apple's fixed tiers, per territory)
superwall asc /v1/subscriptions/<subId>/pricePoints --json

# 4. Set the price
superwall asc post /v1/subscriptionPrices \
  -d subscription=<subId> -d subscriptionPricePoint=<pricePointId> \
  -d territory=USA --json

# 5. (Optional) Introductory offer — e.g. a one-week free trial
superwall asc post /v1/subscriptionIntroductoryOffers \
  -d subscription=<subId> -d duration=ONE_WEEK -d offerMode=FREE_TRIAL \
  -d numberOfPeriods=1 -d subscriptionPricePoint=<pricePointId> --json
```

Territory ids are three-letter store regions (`USA`, `GBR`, …). Whether
`territory` is required on a given call is marked by `asc docs` — don't assume.

## Convenience shortcuts (formatted reads)

For the common reads there are hand-built shortcuts (not raw endpoints):

```bash
superwall asc apps --json                         # ASC apps for the team
superwall asc products <bundle-id | asc-app-id> --json
superwall asc subscriptions com.acme.app --json
superwall asc iaps com.acme.app --json
superwall asc apps --team <teamId> --json          # if the org has multiple teams
```

Everything else — every one of Apple's endpoints — goes through the raw proxy
(`asc get|post|patch|delete /v1/…`), which is where validation applies.

## Connecting ASC credentials (one-time)

```bash
superwall asc keys set --key-id <id> --issuer <id> --key-file ./AuthKey.p8 [--name "My Team"] --json
superwall asc keys list --json
superwall asc keys rm <team_id> --json
```
