# CLI Reference

Everything is the `superwall` CLI. It's keyless and install-free —
`npx superwall` to run, `superwall login` once for device-flow OAuth. There are
no API keys to pass or `.env` files to resolve; the session lives in
`~/.superwall`.

```bash
superwall login                  # device-flow OAuth (opens browser); acts as you
superwall login --api-key <key>  # headless, for CI — a dashboard org key, à la STRIPE_API_KEY
superwall whoami                 # show the logged-in account / org
superwall logout
```

Add `--help` / `-h` to any command for its flags.

## Data hierarchy

Organization → Projects → Applications. Each application has a `platform` (ios,
android, flutter, react_native, web), a `bundle_id`, and a `public_api_key`
(the `pk_…` key used for SDK initialization — distinct from the OAuth session
used for CLI/REST calls). Projects own products + entitlements; applications own
campaigns + paywalls.

## Scoping

Commands auto-scope. With one project/app they pick it; with several they prompt
(interactive) or take the first (agent/`--json` mode). Override explicitly:

- `--project <id>` — scope to a project.
- `--app <id|name>` — scope to an application (persists as the default app for
  that project). `superwall apps use <id|name>` sets it without running anything.

Add `--json` to any resource command for machine-readable output — always do
this when parsing programmatically. `--dry-run` plans a create without writing.

## Resources

```bash
superwall orgs list                    # your organizations
superwall apps list                    # apps grouped by project (platforms, pk_ keys)
superwall products list                # products in the scoped project
superwall entitlements list            # entitlements in the scoped project
superwall campaigns list               # campaigns in the scoped app
superwall paywalls list                # paywalls in the scoped app
```

`apps list` nests apps under their projects — there is no separate projects
command; `--project <id>` is how you scope when it matters.

### Create

```bash
# Apps: an app is a platform of a project. Without --project a new project is spun
# up for it; each project allows one app per platform.
superwall apps create "My App" --platform ios [--bundle com.acme.app] [--project <projectId>]

# Entitlements
superwall entitlements create pro

# Products (identifier is required; the rest is a full definition, mainly for agents)
superwall products create com.acme.pro.monthly \
  --name "Pro Monthly" \
  --price 9.99 --currency USD \
  --period month --period-count 1 \
  --trial-days 7 \
  --entitlement pro            # repeatable: grant multiple entitlements

# Campaigns (the create arg is a description)
superwall campaigns create "Onboarding paywall"

# Placements: attach a placement (event name) to a campaign
superwall campaigns placement <campaignId> onboarding_complete
```

Projects aren't created directly — add the first platform with `apps create` and
a project is created for you.

### StoreKit config

```bash
superwall products storekit [--out Superwall.storekit]   # generate a local .storekit from your products
```

## App Store Connect

Superwall proxies the App Store Connect API with a signed request — no `.p8`
file or JWT to manage locally. First connect ASC credentials (uploaded to
Superwall's vault, nothing sensitive stored locally):

```bash
superwall asc keys set --key-id <id> --issuer <id> --key-file ./AuthKey.p8 [--name "My Team"]
superwall asc keys list
superwall asc keys rm <team_id>
```

Then call ASC through the proxy:

```bash
# Shortcuts
superwall asc apps                              # list ASC apps
superwall asc products <bundle-id | asc-app-id> # products; also: subscriptions | iaps
superwall asc subscriptions com.acme.app

# Raw API — a verb + path, or just a path (defaults to GET)
superwall asc get /v1/apps
superwall asc /v1/apps                          # same, GET is implied
superwall asc post /v1/... -d key=value -d count:=3   # -d key=value string, key:=value number/bool/json

# Multiple connected teams
superwall asc apps --team <teamId>
```

## Raw API access — any endpoint

`bootstrap` prints the account overview; the verb commands hit any V2 endpoint
with the CLI's session auth (like `stripe get /v1/...`):

```bash
superwall bootstrap                              # complete account tree: orgs → projects → apps
                                                 #   + campaigns (placements), paywalls, products,
                                                 #   entitlements — add --json for the full structure

superwall get /v2/products -d project_id=25607   # -d on get/delete = query params
superwall get /v2/campaigns -d project_id=25607 -d limit=10
superwall post /v2/entitlements -d project_id=25607 -d identifier=pro
superwall patch /v2/projects/25607 -d name=Renamed
superwall delete /v2/...                         # careful

# -d key=value sends a string; key:=value sends typed JSON; nesting via key[sub]
superwall post /v2/products -d 'price[amount]:=4999' -d 'price[currency]=USD'
```

Raw paths need explicit scope params (`project_id`, ...) — the nicely-named
resource commands above resolve scope for you; the verbs do not.

## Utilities

```bash
superwall doctor          # health-check the integration
superwall skills          # install the Superwall agent toolkit (skills) into your agent
```

## curl fallback — non-JSON bodies only

The verb commands cover every JSON endpoint. The one case still needing curl is
a raw (non-JSON) request body — e.g. the ClickHouse query endpoint, which takes
SQL as the body (see data-analytics.md). Use a Bearer token — an org API key
from the dashboard (Settings → API Keys), exported as `SUPERWALL_API_KEY`:

```bash
curl -s -X POST https://api.superwall.com/v2/organizations/{orgId}/query \
  -H "Authorization: Bearer $SUPERWALL_API_KEY" \
  -d 'SELECT ... FORMAT CSVWithNames'
```

Responses are cursor-paginated: pass `limit` (1–100), `starting_after`, or
`ending_before` as query params and follow `has_more`. Prefer a CLI command
whenever one exists — reach for curl only for genuinely uncovered routes.
