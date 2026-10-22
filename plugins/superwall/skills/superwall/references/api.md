# CLI Reference

CLI commands use the installed `superwall` binary. The user installs it once
with `npm install --global superwall`; agents must not automatically install or
upgrade it. Use `superwall login` once for device-flow OAuth. The saved session
lives in `~/.superwall`.

```bash
superwall login                  # device-flow OAuth (opens browser); acts as you
superwall whoami --json          # show the logged-in account
superwall logout --json
```

Add `--help` / `-h` to any command for its flags.

`SUPERWALL_API_KEY` is only ever the organization's secret key (`sk_…`), which
CI uses to push and promote without a login. It is never the app's public key:
`superwall integrate` takes that (`pk_…`) from `--api-key`, or finds it in the
project. Never read, print or move either key.

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
- `--app <id|name|dashboard link>` - scope to an application. An id or a dashboard
  link (`https://app.superwall.com/<org>/<app>/…`) opens any app the API serves,
  in any organization, with no `--project` and no org switch; the link also
  finds apps that have no paywalls yet. `superwall apps use <id|name|link>` sets
  the rich UI's default, but automation still passes scope explicitly.

**There are no organizations to pick.** Every app belongs to one organization,
and the CLI reads it off the app, so no command takes an org and nothing is
saved. App- and project-scoped commands find their target through `--app`,
`--project` or `superwall.lock`. Org-wide endpoints use the org of that same
app: `query` (its ClickHouse data), `asc` (its App Store Connect keys), `asa`
(its Apple Search Ads credentials). When your apps span several organizations
and no app is named, they ask in rich mode and fail in automation with "pass
--app". A new project goes to your only organization, or asks.
`superwall apps list` lists every project and app you can open, grouped by
organization (`organization: { id, name, member }` on each `--json` row). It
includes organizations you aren't a member of but have opened through `--app`,
`--project`, a dashboard link or a lock, marked `member: false`; they appear once opened. Never conclude "no access" from `apps list` alone: pass the app's id or
dashboard link.

**Agent contract:** always pass `--json` to resource, ASC, ASA, raw API, query,
`bootstrap`, `whoami`, and `doctor` commands. JSON is the stable machine contract,
uses two-space indentation, never prompts, and returns errors as `{ "error": {
"code", "message", "status"? } }`. `--dry-run` plans a create without writing.

## Resources

Commands follow the API, Stripe-style: `superwall <resource> [nested] <operation>
[ids] [--field value]`. Resources: `apps`, `products`, `entitlements` (+
`grants`), `campaigns` (+ `placements`, `audiences`, `variants`), `paywalls`,
`users`, `webhooks`, `events`. Each has `list`, `get`, `create`, `update`,
`delete` where the API does, plus actions the API names (`archive`, `publish`,
`duplicate`, `readout`, `rotate-secret`, ...). **Run `superwall <resource>
--help` to see its operations and `superwall <resource> <operation> --help` for
an operation's flags** - they are read from the live API reference.

```bash
superwall apps list --json       # every app you can open, grouped by organization
superwall apps get <app> --json  # one app: bundle ID, Apple team, keys, notification URL, SDK reports, revenue provider
superwall products list --project <id> --json
superwall entitlements list --project <id> --json
superwall campaigns list --project <id> --app <id> --json
superwall campaigns get <campaignId> --json
superwall paywalls list --project <id> --app <id> --json
superwall users subscriptions <appUserId> --app <id> --json
superwall webhooks list --app <id> --json
```

- **A flag is a request field.** `--event-name x` sends `event_name`; anything
  else goes in with `-d key=value` (`key:=json` for numbers and objects). A flag
  the endpoint doesn't take is refused before anything is sent.
- **`--app` fills the ids.** Project, app and organization ids in a path or
  body come from `--app` (or `superwall.lock`); positionals are only the ids of
  the thing itself (`<campaignId> <audienceId>`).
- **`--dry-run` prints the request instead of sending it.** Deleting,
  archiving, resetting and rotating ask first, and need `--yes` outside a
  terminal: get a person's agreement before passing it.
- **One way to change a thing.** An app's fields (bundle ID, Apple team ID, URL
  scheme, support URL, revenue provider) are all `apps update` flags:

```bash
superwall apps update <app> --team-id <teamId> --json
superwall apps update <app> --bundle-id com.acme.app --json   # warns when reported builds would run in test mode
superwall apps update <app> --revenue-provider open_revenue --json   # a person's decision; needs --yes outside a terminal
superwall campaigns placements create <campaignId> --event-name paywall_trigger --json
superwall campaigns audiences readout <campaignId> <audienceId> --json
```

There is no `projects` command: `apps list` nests apps under their projects,
and `--project <id>` only narrows `--app`.

**Large accounts.** Every `list` takes `--search <text>` (matches id, name,
identifier or bundle id, case-insensitively) and `--limit <n>`. With `--json` a
list returns every row unless `--limit` caps it; in a terminal it shows 50 and
says how many more. Search instead of paging through a thousand paywalls:
`superwall paywalls list --app <id> --search winback --json`. `apps list --search`
keeps a matching project whole and otherwise only its matching apps. When a
command can't tell which project or app you mean, the error names the first ten
with their ids. `bootstrap --app <id>` (or `--project <id>`) loads one project's
tree instead of the whole account.

### Create

```bash
# Apps: an app is a platform of a project. Without --project a new project is spun
# up for it; each project allows one app per platform.
superwall apps create --name "My App" --platform ios [--bundle-id com.acme.app] [--project <projectId>] --json

# Entitlements
superwall entitlements create --identifier pro --project <id> --json

# Products (identifier is required; the rest is a full definition, mainly for agents)
superwall products create --identifier com.acme.pro.monthly \
  --name "Pro Monthly" \
  --price 9.99 --currency USD \
  --period month --period-count 1 \
  --trial-days 7 \
  --entitlement pro \
  --project <id> --json        # repeatable: grant multiple entitlements

# Campaigns: a description and the placement that triggers it
superwall campaigns create --description "Onboarding paywall" --placement onboarding_complete --project <id> --app <id> --json

# Placements: trigger an existing campaign on another event
superwall campaigns placements create <campaignId> --event-name onboarding_complete --project <id> --app <id> --json
```

`create` always takes flags, never positionals. Projects aren't created
directly - add the first platform with `apps create` and a project is created
for you.

### StoreKit config

```bash
superwall products storekit --project <id> [--out Superwall.storekit] --json
```

## App Store Connect

Superwall proxies the App Store Connect API with a signed request - no `.p8`
file or JWT to manage locally. It uses the key the organization has for the
Apple team. Connecting keys, Apple's server notifications and the revenue
provider are in the [Apple setup reference](apple-setup.md). Do not request,
inspect, or upload private key files or secrets as an agent.

```bash
superwall apps get <app> --json                           # bundle ID, Apple keys, notification URL, SDK reports, revenue provider
superwall asc keys import --app <app> --json              # reuse a key the organization already has
superwall asc notification-url check --app <app> --json   # what Apple has, and whose it is
```

An app's own keys are managed with `asc keys`; `superwall apps get <app>` shows
which it has:

```bash
superwall asc keys list --app <id> --json                   # the app's keys
superwall asc keys import --app <id> --json                 # reuse a key the organization already has
superwall asc keys import api_key --app <id> --from <app> --json   # ...from that app
superwall asc keys sources --app <id> --json                # keys import could use
superwall asc keys create api_key --app <id>                # signs in to Apple: a person runs this
superwall asc keys delete purchase_key --app <id> --json
superwall asc notification-url check --app <id> --json      # whose URL Apple sends purchase events to
superwall asc notification-url set --app <id> --json        # set it where Apple has none
```

Then call ASC through the proxy:

```bash
# Shortcuts
superwall asc apps --json
superwall asc products <bundle-id | asc-app-id> --json
superwall asc subscriptions list com.acme.app --json

# Raw API - a verb + path
superwall asc get /v1/apps --json
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
invalid enum value) before it ever reaches Apple's opaque errors. Fix the payload
using the reported schema; keep validation enabled.

For the resource commands (subscription groups, subscriptions, in-app purchases,
localizations, prices, offers, availability, review screenshots, submissions)
and releases (versions, builds, metadata, release), see the
[App Store Connect reference](asc.md).

## Apple Search Ads

Superwall proxies the Apple Ads Campaign Management API v5 with the credentials
connected in the dashboard (app → Integrations → Apple Search Ads → Advanced).
Nothing is stored locally; the CLI picks the connected iOS app itself, or takes
`--app <id>`:

```bash
superwall asa keys --json                          # which apps are connected

# Resources: asa <resource> <action> [id], scoped with --campaign / --adgroup / --adam-id
superwall asa campaigns list --json
superwall asa campaigns get <id> --json
superwall asa campaigns find --field status --op EQUALS --values ENABLED --all --json
superwall asa adgroups list --campaign <id> --json
superwall asa keywords list --campaign <id> --adgroup <id> --all --json
superwall asa reports campaigns --start 2025-01-01 --end 2025-01-31 --json

# Raw API - a verb + path, or just a path (defaults to GET); /api/v5 is implied
superwall asa get /campaigns --json
superwall asa /campaigns --json
superwall asa post /campaigns/find --body '{"conditions":[]}' --json

# Several Apple Search Ads orgs behind one API user
superwall asa campaigns list --org-id <appleOrgId> --json
```

### Request schema & docs — do this before every write

```bash
superwall asa docs                          # catalog: every endpoint, grouped
superwall asa docs keywords                 # one resource: usage, flags, Apple links
superwall asa docs campaigns create         # Apple's own page: fields, enums, examples
```

Writes take typed flags (money flags resolve the account's currency from
`/acls`, or pass `--currency`), `-d key=value` / `key:=json` for any other
field, or `--body <json|@file|@->` for the whole payload:

```bash
superwall asa campaigns create --name "Launch" --adam-id <adamId> --countries US,CA \
  --daily-budget 50 --supply-sources APPSTORE_SEARCH_RESULTS --ad-channel-type SEARCH --json
superwall asa keywords update <id> --campaign <id> --adgroup <id> --bid 2 --json
superwall asa keywords delete <id,id,id> --campaign <id> --adgroup <id> --json
```

Apple's validation errors come back as `Apple Search Ads rejected …` with each
field and message code. For the full resource list and recipes, see the
[Apple Search Ads reference](asa.md).

## Raw API access - any endpoint

The Superwall API is much bigger than the resource commands: campaigns with
their audiences, variants and traffic weights, users and their entitlements,
webhooks, charts, surveys, retention messaging, assets, audit logs. **Find the
endpoint and its body in `superwall api docs` before calling it.** It reads the
live OpenAPI spec (cached a day, `--refresh` to fetch now) and needs no login:

```bash
superwall api docs                               # every group, with endpoint counts
superwall api docs variant                       # search: summary, path, group, description
superwall api docs experiment                    # agent words map to API words (experiment → variant, audience)
superwall api docs /v2/campaigns/123/audiences/9/variants post   # one endpoint: params, body, scope, returns
superwall api docs variant --json                # the same, as data
```

A raw request that fails with a 4xx names the reference entry to read: the
endpoint's body, the methods its path does take, or a search for a path that
doesn't exist.

`bootstrap` prints the account overview; the verb commands hit any V2 endpoint
with the CLI's session auth (like `stripe get /v1/...`):

```bash
superwall bootstrap --json                       # complete account tree
superwall bootstrap --app <id> --json            # one project's tree

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

The CLI supplies the organization ID and authenticated session. The credential
must have `data:read` access.

### Revenue: always use the app's revenue provider

Many apps receive revenue from both the store and RevenueCat, so the same
purchase can arrive twice. Each app's **revenue provider** decides which one its
dashboard figures count, and every revenue query must count the same rows or
its numbers won't match the dashboard. Pass `--app <id>`: the query then gets
the provider as ClickHouse parameters, `{app:UInt64}`,
`{revenue_provider:String}` (`open_revenue`, `revenue_cat`, or empty) and
`{revenue_integrations:Array(String)}`. Filter revenue exactly like this:

```sql
-- superwall query --file revenue.sql --app <id> --json
SELECT sum(price) AS revenue
FROM open_revenue.attributed_events_by_ts_rep FINAL
WHERE applicationId = {app:UInt64}
  AND (integration IN {revenue_integrations:Array(String)} OR source = 'sdk')
  AND NOT (coalesce(integration, '') = 'revenue_cat' AND store = 'STRIPE')
```

`--param name=value` adds any other parameter (`{from:Date}`). One query covers
one app's provider; query apps with different providers separately. See `data-analytics.md` for exposed
tables, query patterns, and performance guardrails.

## Utilities

```bash
superwall doctor --json   # health-check the integration
superwall skills          # install the Superwall agent skills into your agent
superwall upgrade         # only when the user explicitly requests a CLI upgrade
superwall feedback "..."  # send feedback about the CLI to the Superwall team
```

## Agent workflows

```bash
superwall integrate --skill     # print first-time SDK + dashboard instructions
superwall migrate --skill       # print provider migration instructions
superwall review --skill        # print existing-setup review instructions
```

`review` covers SDK configuration, purchase/subscription ownership, identity,
deep links, conditional Web Checkout readiness, placements, products,
entitlements, campaigns, paywalls, and analytics. It is not a placement-only
inventory. Agents should use `--skill` and follow the playbook themselves rather
than spawning a nested agent.

Responses are cursor-paginated: pass `limit` (1-100), `starting_after`, or
`ending_before` as query params and follow `has_more`. Prefer a CLI command
whenever one exists - reach for curl only for genuinely uncovered routes.
