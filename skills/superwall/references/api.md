# CLI Reference

Everything is available through the `superwall` CLI. Install it globally, then
use `superwall login` once for device-flow OAuth. The saved session lives in
`~/.superwall`.

```bash
npm install --global superwall
superwall login                  # device-flow OAuth (opens browser); acts as you
superwall login --api-key <key>  # headless, for CI - a dashboard org key, à la STRIPE_API_KEY
superwall whoami --json          # show the logged-in account / org
superwall logout --json
```

Add `--help` / `-h` to any command for its flags.

## Data hierarchy

Organization → Projects → Applications. Each application has a `platform` (ios,
android, flutter, react_native, web), a `bundle_id`, and a `public_api_key`
(the `pk_…` key used for SDK initialization - distinct from the OAuth session
used for CLI/REST calls). Projects own products + entitlements; applications own
campaigns + paywalls.

## Scoping

Commands auto-scope only when exactly one project/app exists. With several, rich
interactive mode prompts; JSON and noninteractive modes require explicit scope:

- `--project <id>` - scope to a project.
- `--app <id|name>` - scope to an application. `superwall apps use <id|name>` sets
  the rich UI's default, but automation still passes scope explicitly.

**Everything is org-scoped.** The session pins one active organization, and every
command runs against it: resource listings and creates, `query` (that org's
ClickHouse data), and the `asc` proxy (that org's App Store Connect key vault).
Single-org accounts resolve it automatically and never think about it. Multi-org
accounts are prompted once in rich mode; automation runs
`superwall orgs use <id|name>` once to persist the choice. The switch is global
and sticky (stored in the session) - to work in another org, switch, run the
commands, and switch back. `superwall whoami --json` shows the active org.

**Agent contract:** always pass `--json` to resource, ASC, raw API, query,
`bootstrap`, `whoami`, and `doctor` commands. JSON is the stable machine contract,
uses two-space indentation, never prompts, and returns errors as `{ "error": {
"code", "message", "status"? } }`. `--dry-run` plans a create without writing.

## Resources

```bash
superwall orgs list --json
superwall orgs use <id|name>     # persist the org for org-scoped commands (multi-org accounts)
superwall apps list --json
superwall products list --project <id> --json
superwall entitlements list --project <id> --json
superwall campaigns list --project <id> --app <id> --json
superwall paywalls list --project <id> --app <id> --json
```

`apps list` nests apps under their projects - there is no separate projects
command; `--project <id>` is how you scope when it matters.

### Create

```bash
# Apps: an app is a platform of a project. Without --project a new project is spun
# up for it; each project allows one app per platform.
superwall apps create "My App" --platform ios [--bundle com.acme.app] [--project <projectId>] --json

# Entitlements
superwall entitlements create pro --project <id> --json

# Products (identifier is required; the rest is a full definition, mainly for agents)
superwall products create com.acme.pro.monthly \
  --name "Pro Monthly" \
  --price 9.99 --currency USD \
  --period month --period-count 1 \
  --trial-days 7 \
  --entitlement pro \
  --project <id> --json        # repeatable: grant multiple entitlements

# Campaigns (the create arg is a description)
superwall campaigns create "Onboarding paywall" onboarding_complete --project <id> --app <id> --json

# Placements: attach a placement (event name) to a campaign
superwall campaigns placement <campaignId> onboarding_complete --project <id> --app <id> --json
```

Projects aren't created directly - add the first platform with `apps create` and
a project is created for you.

### StoreKit config

```bash
superwall products storekit --project <id> [--out Superwall.storekit] --json
```

## App Store Connect

Superwall proxies the App Store Connect API with a signed request - no `.p8`
file or JWT to manage locally. First connect ASC credentials (uploaded to
Superwall's vault, nothing sensitive stored locally):

```bash
superwall asc keys set --key-id <id> --issuer <id> --key-file ./AuthKey.p8 [--name "My Team"] --json
superwall asc keys list --json
superwall asc keys rm <team_id> --json
```

Then call ASC through the proxy:

```bash
# Shortcuts
superwall asc apps --json
superwall asc products <bundle-id | asc-app-id> --json
superwall asc subscriptions com.acme.app --json

# Raw API - a verb + path, or just a path (defaults to GET)
superwall asc get /v1/apps --json
superwall asc /v1/apps --json
superwall asc post /v1/... -d key=value -d count:=3 --json

# Multiple connected teams
superwall asc apps --team <teamId> --json
```

### Request schema & docs — do this before every write

The proxy is schema-aware, backed by Apple's own OpenAPI spec. **Before any
`post`/`patch`, look up the exact schema — never guess a body:**

```bash
superwall asc docs                          # catalog: every resource root
superwall asc docs "introductory offer"     # find endpoints by keyword
superwall asc docs /v1/subscriptions post   # required fields, enums, relationships, example
```

Pass flat `-d` params — the proxy builds the JSON:API envelope for you
(`data.type`, `attributes`, `relationships`) and casts values by declared type:

```bash
superwall asc post /v1/subscriptions -d name=Pro -d productId=com.acme.pro -d group=<subscriptionGroups id> --json
```

A malformed body is rejected locally with the exact fix (missing required field,
invalid enum value) before it ever reaches Apple's opaque errors. Pass `--force`
to skip validation and send as-is.

For end-to-end recipes (creating a subscription with prices and offers) and the
full workflow, see the [App Store Connect reference](asc.md).

## Raw API access - any endpoint

`bootstrap` prints the account overview; the verb commands hit any V2 endpoint
with the CLI's session auth (like `stripe get /v1/...`):

```bash
superwall bootstrap --json                       # complete account tree

superwall get /v2/products -d project_id=25607 --json
superwall get /v2/campaigns -d project_id=25607 -d limit=10 --json
superwall post /v2/entitlements -d project_id=25607 -d identifier=pro --json
superwall patch /v2/projects/25607 -d name=Renamed --json
superwall delete /v2/... --json                  # careful

# -d key=value sends a string; key:=value sends typed JSON; nesting via key[sub]
superwall post /v2/products -d 'price[amount]:=4999' -d 'price[currency]=USD' --json
```

Raw paths need explicit scope params (`project_id`, ...) - the nicely-named
resource commands above resolve scope for you; the verbs do not.

## Data query - ClickHouse SQL

`query` runs read-only SQL against the logged-in organization's ClickHouse
analytics data. Use it for analysis, custom dashboards, scheduled reports, and
agent workflows. Prefer `--json` when another tool or agent will consume the
result; it returns ClickHouse's native JSON envelope (`meta`, `data`, `rows`, and
statistics).

```bash
superwall query "SELECT applicationId, name FROM sw.applications_rep FINAL LIMIT 20" --json
superwall query "SELECT count() AS active FROM sw.subscription_status_rep FINAL WHERE applicationId = 123 AND isSandbox = 0" --json
superwall query --file daily-report.sql --json
printf 'SHOW TABLES FROM sw' | superwall query --json
```

Pass SQL in exactly one place: as a quoted argument, with `--file <query.sql>`,
or on stdin. With `--json`, omit the SQL `FORMAT` clause because the CLI requests
ClickHouse JSON. Without `--json`, any explicit ClickHouse `FORMAT` clause is
preserved.

The CLI supplies the current organization ID and authenticated session. The
credential must have `data:read` access. See `data-analytics.md` for exposed
tables, query patterns, and performance guardrails.

## Utilities

```bash
superwall doctor --json   # health-check the integration
superwall skills          # install the Superwall agent skills into your agent
superwall upgrade         # update the CLI to the latest version
superwall feedback "..."  # send feedback about the CLI to the Superwall team
```

## Agent workflows

```bash
superwall integrate             # first-time SDK + dashboard setup
superwall migrate               # move from RevenueCat / Adapty / Qonversion
superwall review                # audit an existing setup end to end
superwall review --fix          # apply verified, safe findings from the review
superwall <workflow> --skill    # print the project-specific playbook for an agent
```

`review` covers SDK configuration, purchase/subscription ownership, identity,
deep links, conditional Web Checkout readiness, placements, products,
entitlements, campaigns, paywalls, and analytics. It is not a placement-only
inventory. Agents should use `--skill` and follow the playbook themselves rather
than spawning a nested agent.

Responses are cursor-paginated: pass `limit` (1-100), `starting_after`, or
`ending_before` as query params and follow `has_more`. Prefer a CLI command
whenever one exists - reach for curl only for genuinely uncovered routes.
