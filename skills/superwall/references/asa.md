# Apple Search Ads — the Apple Ads Platform API via Superwall's proxy

`superwall asa` proxies the **Apple Ads Platform API v1**
(`api.ads.apple.com/v1`), which replaced the Campaign Management API v5 (Apple
shuts v5 off on 2027-01-26). Superwall holds the credentials connected in the
dashboard, mints the client secret, exchanges it for an access token, and adds
the `X-AP-Context` header — nothing to manage locally. This lets an agent read
and manage campaigns, ad groups, keywords, ads, creatives, budgets and reports
directly.

## Which app

Credentials are per Superwall app (iOS). The CLI picks the one connected app
itself; with several connected, pass `--app <id|name>`.

```bash
superwall asa keys list --json           # every iOS app + whether Apple Search Ads is connected
```

Not connected → the dashboard does it: open the app → Integrations → Apple
Search Ads → Advanced, paste Superwall's public key into Apple's Account
Settings → API, then enter the Client ID, Team ID and Key ID. `asa keys set`
is deliberately not a CLI command (Superwall generates the key pair).

## Which ad account

Every request is scoped to one Apple Ads ad account. Pass
`--ad-account-id <id>` to choose it (sent as `X-AP-Context: adAccountId=<id>`;
`superwall asa acls --json` lists the accounts the key reaches). Without it,
the only ad account the key reaches is used; when it reaches several, the
command fails and asks for `--ad-account-id`. There is no `--org-id` on v1.

## Docs access — do this before every write

Never guess a request body. `asa docs` is the catalog, and for a specific
command it fetches Apple's own page live (fields, required flags, enums,
examples):

```bash
superwall asa docs                          # every endpoint, grouped by resource
superwall asa docs keywords                 # one resource: usage, flags → Apple field names, links
superwall asa docs campaigns create         # Apple's page for that call, plus the body object's fields
superwall asa docs "impression"             # search by keyword
```

## Command shape

```
superwall asa <resource> <action> [id] --json
```

Resources are top level, as in v1: a keyword, ad or ad group is addressed by
its own id, never through its campaign. On lists, `--campaign`, `--adgroup` and
`--adam-id` are filters, not path parts.

| Resource | Actions |
|---|---|
| `campaigns` | `list`, `get <id>`, `create`, `update <id>`, `delete <id>`, `limited-reasons <id>` |
| `adgroups` | `list [--campaign]`, `get <id>`, `create --campaign`, `update <id>`, `delete <id>` |
| `keywords` | `list [--campaign] [--adgroup]`, `get <id>`, `create --adgroup`, `update <id[,id…]>`, `delete <id[,id…]>` |
| `negative-keywords` | same; `create --campaign` for campaign level, add `--adgroup` for ad group level |
| `ads` | `list [--campaign] [--adgroup]`, `get <id>`, `create --adgroup`, `update <id>`, `delete <id>` |
| `creatives` | `list`, `get <id>`, `create`, `update <id>`, `delete <id>` |
| `assets` | `list [--adam-id]`, `get <id>`, `delete <id>` |
| `product-pages` | `list --adam-id`, `get <id>`, `locales <id>` |
| `ad-rejections` | `list [--adam-id]`, `get <id>` |
| `reports` | `campaigns`, `adgroups`, `keywords`, `searchterms`, `ads` (`--start --end`; all but `campaigns` need `--campaign`) |
| `brand-reports` | the same five, for Apple Maps (business brand) campaigns |
| `insights` | `impression-share`, `search-term-popularity` |
| `apps` | `search <query>`, `eligibility <adam-id>`, `get <adam-id>`, `localized <adam-id>`, `languages` |
| `geo` | `search <query>`, `get <id[,id…]> --entity <Country\|AdminArea\|Locality>` |
| `budget-orders` | `list`, `get <id>`, `create`, `update <id>`, `delete <id>` |
| `recommendations` | `target-cpas`, `daily-budgets`, and `apply-…` / `dismiss-…` for each |
| `suggestions` | `keywords`, `phrases`, `categories`, `target-cpa` |
| `change-history` | `list`, `get <id>` |
| `brands` | `list`, `get <id>`, `categories`, `category <id>`, `rejections` |
| `ad-accounts` | `get <id>`, `create`, `update <id>`, `resources` |
| `orgs`, `acls`, `me` | the organization, the ad accounts the key reaches, the API user |

Raw escape hatch for anything else: `superwall asa get|post|put|delete /path
[-d k=v] [--body json]`, or `superwall asa /path` (GET). `/v1` is added to the
path; a path that already starts with `/v1` or `/api/` is sent as written.

```bash
superwall asa /me --json
superwall asa post /campaigns/query --body '{"filters":[]}' --json
```

## Reading

Every list is a `POST …/query` with Apple's QueryRequest (`filters`,
`sorting`, `pagination { offset, pageSize }`). Build it with the one-filter
shorthand `--field/--op/--values`, sort with `--order-by field[:asc|desc]`,
page with `--limit`/`--offset`, or pass the whole request with
`--query <json|@file|@->`. Shorthand, scope flags and `--query` filters are
combined. `--all` walks every page until Apple's `totalCount`; the output is
`{ result: [...], pagination }` like a single page.

```bash
superwall asa campaigns list --limit 50 --json
superwall asa campaigns list --all --json                     # walks every page
superwall asa campaigns list --field status --op EQUALS --values ENABLED --order-by name:desc --json
superwall asa campaigns list --query '{"filters":[{"field":"name","operator":"STARTS_WITH","value":"US"}],"sorting":[{"field":"name","order":"ASC"}]}' --all --json
superwall asa campaigns get <id> --json
superwall asa adgroups list --campaign <id> --json
superwall asa keywords list --adgroup <id> --field matchType --op EQUALS --values EXACT --all --json
```

`asa docs <resource> list` links Apple's page, which lists the fields each
query can filter and sort on, with their operators.

## Writing

Before writes, confirm the exact ad account, campaign and ad group. Changes to
budgets, bids, billing or enabled campaigns can spend money: show the proposed
change, currency and spending limit and obtain specific user approval. Ask for
specific approval before deletions or access changes. Examples below are not
permission to execute those actions.

Typed flags map to Apple's field names (`asa docs <resource>` shows the
mapping, including nested ones such as `--daily-budget` → `dailyBudget.value`).
Money flags (`--daily-budget`, `--bid`, `--amount`) become
`{ amount, currency }`; the currency comes from `--currency` or the ad
account's `/acls` entry. Anything else goes through `-d key=value`
(`key:=value` for numbers/booleans/JSON, `key[sub]` nesting) or `--body`.
Campaign and budget order creates take the ad account id from
`--ad-account-id`, or the only account the key reaches.

```bash
# Campaign
superwall asa campaigns create --name "Launch" --adam-id <adamId> --countries US,CA \
  --daily-budget 50 --supply-sources APPSTORE --supply-placements APPSTORE_SEARCH_RESULTS \
  --billing-event TAPS --bid-strategy MANUAL_CPT --bid-goal TAP --json

# Pause it
superwall asa campaigns update <id> --status PAUSED --json

# Ad group (--bid is the default bid)
superwall asa adgroups create --campaign <id> --name "Exact match" --pricing-model CPT --bid 1.50 \
  --start 2025-06-01T00:00:00.000 --search-match=false --json

# Keywords: one from flags, or many from --body (sent to bulk-create as items)
superwall asa keywords create --adgroup <id> --text "grammar checker" --match-type EXACT --bid 1.25 --json
superwall asa keywords create \
  --body '[{"adGroupId":<id>,"text":"grammar","matchType":"BROAD"},{"adGroupId":<id>,"text":"spell check","matchType":"EXACT"}]' --json
superwall asa keywords update <id> --bid 2 --json                  # one → PUT /keywords/{id}
superwall asa keywords update <id,id> --status PAUSED --json       # several → bulk-update
superwall asa keywords delete <id> --json                          # one → DELETE
superwall asa keywords delete <id,id,id> --json                    # several → bulk-delete

# Negative keywords: campaign level, or ad group level with --adgroup
superwall asa negative-keywords create --campaign <id> --text free --match-type BROAD --json
superwall asa negative-keywords create --campaign <id> --adgroup <id> --text free --match-type BROAD --json

# Creative + ad (custom product page)
superwall asa creatives create --adam-id <adamId> --type CUSTOM_PRODUCT_PAGE --product-page-id <ppId> --name "Holiday" --json
superwall asa ads create --adgroup <id> --creative-id <creativeId> --name "Holiday ad" --json
```

Apple's validation failures come back as
`Apple Search Ads rejected asa campaigns create (400): • field: message (CODE)`.
Read the field, fix the flag, retry.

## Reports

```bash
superwall asa reports campaigns --start 2025-01-01 --end 2025-01-31 --json
superwall asa reports campaigns --start 2025-01-01 --end 2025-01-31 --granularity WEEKLY --group-by countryOrRegion --json
superwall asa reports adgroups --campaign <id> --start 2025-01-01 --end 2025-01-31 --json
superwall asa reports keywords --campaign <id> --adgroup <id> --start 2025-01-01 --end 2025-01-31 --json
superwall asa reports searchterms --campaign <id> --start 2025-01-01 --end 2025-01-31 --json
superwall asa reports ads --campaign <id> --start 2025-01-01 --end 2025-01-31 --json
superwall asa brand-reports campaigns --start 2025-01-01 --end 2025-01-31 --json   # Apple Maps
```

Reports send a `timeRange` (`start`, `end`, `granularity`, `timeZone`):
granularity defaults to `DAILY` and the time zone to `UTC` (`--time-zone ORTZ`
uses the account's). Filters, `--order-by` and `--query` work as on lists.

Insights are queries too, answered right away:

```bash
superwall asa insights impression-share --adam-id <adamId> --start 2025-01-01 --end 2025-01-07 --json
superwall asa insights search-term-popularity --start 2025-01-01 --end 2025-01-07 --json
```

## Discovery

```bash
superwall asa apps search "grammar checker" --owned --json    # find adamIds
superwall asa apps eligibility <adamId> --json
superwall asa product-pages list --adam-id <adamId> --json
superwall asa geo search "New York" --entity Locality --json
superwall asa geo get "US|CA|Cupertino" --entity Locality --json
superwall asa suggestions keywords --adam-id <adamId> --json
superwall asa recommendations daily-budgets --json
superwall asa change-history list --json
superwall asa acls --json
superwall asa me --json
```

## Not on v1

These v5 commands have no Platform API equivalent and are gone:
`negative-keywords find --adgroup-level`, `product-pages countries` and
`device-sizes`. Every `find` is now `list` with filters, `--selector` is
`--query`, and `--org-id` is `--ad-account-id`. `impression-share` moved to
`insights impression-share` (synchronous now) and `ad-rejections assets` to
`assets list`. Asset upload (`POST /v1/assets/upload`) takes form data, which
the proxy doesn't pass, so it isn't available.
