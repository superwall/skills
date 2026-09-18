# Apple Search Ads — the full Apple Ads API via Superwall's proxy

`superwall asa` proxies the **entire** Apple Ads Campaign Management API v5
(`api.searchads.apple.com/api/v5`). Superwall holds the credentials connected
in the dashboard, mints the client secret, exchanges it for an access token,
and adds the `X-AP-Context` org header — nothing to manage locally. This lets
an agent read and manage campaigns, ad groups, keywords, ads, creatives, and
reports directly.

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

If the Apple API user can reach several Apple Search Ads orgs, pass
`--org-id <appleOrgId>` (`superwall asa acls --json` lists them); otherwise the
proxy uses the API user's parent org.

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
superwall asa <resource> <action> [id] [--campaign <id>] [--adgroup <id>] [--adam-id <id>] --json
```

| Resource | Actions |
|---|---|
| `campaigns` | `list`, `get <id>`, `find`, `create`, `update <id>`, `delete <id>` |
| `adgroups` | same, scoped with `--campaign` (`find` without `--campaign` searches the whole org) |
| `keywords` | `list`, `get`, `find` (`--campaign`, optional `--adgroup`), `create`, `update [id]`, `delete <id[,id…]>` |
| `negative-keywords` | same; `--adgroup` switches from campaign-level to ad-group-level; `find --adgroup-level` |
| `ads` | `list`, `get`, `find`, `create`, `update`, `delete` (`--campaign --adgroup`; `find` scopes down to org level) |
| `creatives` | `list`, `get`, `find`, `create` |
| `product-pages` | `list --adam-id`, `get <id> --adam-id`, `locales <id> --adam-id`, `countries`, `device-sizes` |
| `ad-rejections` | `find`, `get <id>`, `assets --adam-id` |
| `reports` | `campaigns`, `adgroups`, `keywords`, `searchterms`, `ads` (`--start --end`, `--campaign`, optional `--adgroup`) |
| `impression-share` | `list`, `get <id>`, `create` |
| `apps` | `search <query>`, `eligibility <adam-id>`, `get <adam-id>`, `localized <adam-id>` |
| `geo` | `search <query>`, `get <id> --entity <Country\|AdminArea\|Locality>` |
| `budget-orders` | `list`, `get <id>`, `create --body`, `update <id> --body` |
| `acls`, `me` | the API user's orgs and identity |

Raw escape hatch for anything else: `superwall asa get|post|put|delete /path
[-d k=v] [--body json]`, or `superwall asa /path` (GET). `/api/v5` is implied.

## Reading

```bash
superwall asa campaigns list --limit 50 --json
superwall asa campaigns list --all --json                     # walks every page
superwall asa campaigns find --field status --op EQUALS --values ENABLED --json
superwall asa campaigns find --selector '{"conditions":[{"field":"name","operator":"STARTSWITH","values":["US"]}],"orderBy":[{"field":"name","sortOrder":"ASCENDING"}]}' --all --json
superwall asa campaigns get <id> --fields id,name,status --json
superwall asa keywords find --campaign <id> --field matchType --op EQUALS --values EXACT --all --json
```

`find` takes Apple's selector: `--selector <json|@file|@->` for the whole
thing, or the one-condition shorthand `--field/--op/--values` plus
`--order-by field[:asc|desc]`, `--fields`, `--limit`, `--offset`. `--all` pages
until Apple's `totalResults` is reached; the output is `{ data: [...],
pagination }` like a single page.

## Writing

Typed flags map to Apple's field names (`asa docs <resource>` shows the
mapping). Money flags (`--budget`, `--daily-budget`, `--bid`, `--default-bid`,
`--cpa-goal`) become `{ amount, currency }`; the currency comes from
`--currency` or the account's `/acls` entry. Anything else goes through
`-d key=value` (`key:=value` for numbers/booleans/JSON, `key[sub]` nesting) or
`--body`.

```bash
# Campaign (Apple requires supplySources and adChannelType alongside the budget)
superwall asa campaigns create --name "Launch" --adam-id <adamId> --countries US,CA \
  --daily-budget 50 --supply-sources APPSTORE_SEARCH_RESULTS --ad-channel-type SEARCH \
  --billing-event TAPS --json

# Pause it
superwall asa campaigns update <id> --status PAUSED --json

# Ad group
superwall asa adgroups create --campaign <id> --name "Exact match" --default-bid 1.50 \
  --start 2025-06-01T00:00:00.000 --search-match=false --json

# Keywords are bulk: one from flags, or many from --body
superwall asa keywords create --campaign <id> --adgroup <id> --text "grammar checker" --match-type EXACT --bid 1.25 --json
superwall asa keywords create --campaign <id> --adgroup <id> \
  --body '[{"text":"grammar","matchType":"BROAD","bidAmount":{"amount":"1","currency":"USD"}},{"text":"spell check","matchType":"EXACT"}]' --json
superwall asa keywords update <id> --campaign <id> --adgroup <id> --bid 2 --json
superwall asa keywords delete <id> --campaign <id> --adgroup <id> --json           # one → DELETE
superwall asa keywords delete <id,id,id> --campaign <id> --adgroup <id> --json     # several → bulk

# Negative keywords: campaign level, or ad group level with --adgroup
superwall asa negative-keywords create --campaign <id> --text free --match-type BROAD --json
superwall asa negative-keywords create --campaign <id> --adgroup <id> --text free --json

# Creative + ad (custom product page)
superwall asa creatives create --adam-id <adamId> --type CUSTOM_PRODUCT_PAGE --product-page-id <ppId> --name "Holiday" --json
superwall asa ads create --campaign <id> --adgroup <id> --creative-id <creativeId> --name "Holiday ad" --json
```

Apple's validation failures come back as
`Apple Search Ads rejected asa campaigns create (400): • field: message (CODE)`.
Read the field, fix the flag, retry.

## Reports

```bash
superwall asa reports campaigns --start 2025-01-01 --end 2025-01-31 --json
superwall asa reports campaigns --start 2025-01-01 --end 2025-01-31 --granularity WEEKLY --group-by countryOrRegion --json
superwall asa reports adgroups --campaign <id> --start 2025-01-01 --end 2025-01-31 --json
superwall asa reports keywords --campaign <id> [--adgroup <id>] --start 2025-01-01 --end 2025-01-31 --json
superwall asa reports searchterms --campaign <id> --start 2025-01-01 --end 2025-01-31 --json
superwall asa reports ads --campaign <id> --start 2025-01-01 --end 2025-01-31 --json
```

Defaults: `DAILY` granularity (search terms: none, since Apple allows row
totals or granularity but not both), rows sorted by `localSpend` descending,
`timeZone` UTC. `--selector` replaces the sort/filter; `--time-zone ORTZ` uses
the org's time zone. Impression share is asynchronous:

```bash
superwall asa impression-share create --name weekly --start 2025-01-01 --end 2025-01-07 \
  --granularity DAILY --dimensions appName,countryOrRegion --metrics lowImpressionShare,highImpressionShare --json
superwall asa impression-share get <id> --json        # downloadUri once state is COMPLETED
```

## Discovery

```bash
superwall asa apps search "grammar checker" --owned --json    # find adamIds
superwall asa apps eligibility <adamId> --json
superwall asa product-pages list --adam-id <adamId> --json
superwall asa geo search "New York" --entity Locality --json
superwall asa geo get "US|CA|Cupertino" --entity Locality --json
superwall asa product-pages countries --json
superwall asa acls --json
superwall asa me --json
```
