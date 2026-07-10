---
name: superwall
description: Control Superwall from the terminal with the `superwall` CLI. Covers resources (apps, products, entitlements, campaigns, paywalls), raw API access, App Store Connect, ClickHouse data analytics, documentation lookup, dashboard linking, SDK source cloning, and the integrate/migrate/review/dashboard workflows. Use when the user asks about Superwall paywalls, campaigns, subscriptions, products, entitlements, API/CLI usage, data analysis, SDK integration, provider migration, webhook events, or debugging SDK behavior.
---

# Superwall

Everything here runs through the `superwall` CLI — one keyless, install-free
binary. Install and authenticate once, then work across four areas. Read the
relevant reference doc before proceeding.

## Setup (do this first)

```bash
npx superwall            # runs the interactive setup; installs `superwall` + `sw`
superwall login          # device-flow OAuth (opens browser), one time
superwall whoami         # confirm you're logged in
superwall skills         # install the Superwall agent toolkit (skills) for your agent
```

Auth is device-flow OAuth against `auth.superwall.com` — no API keys to juggle,
no `.env` to resolve. `login` stores an OAuth session under `~/.superwall` and the
CLI acts as the logged-in user on every call. For CI/headless, `superwall login
--api-key <key>` stores a dashboard org key instead.

## CLI — resources, raw API, App Store Connect

Use when: listing/creating apps, products, entitlements, campaigns, paywalls;
scoping to a project/app; raw `get`/`post`/`patch`/`delete` against any `/v2/…` endpoint;
`bootstrap` for an account overview; or App Store Connect access.

→ [references/api.md](references/api.md)

Quick start:

```bash
superwall apps list                 # apps + their pk_ keys
superwall products list --json      # machine-readable output on any resource
superwall campaigns create "New user paywall"
```

## Data & Analytics — ClickHouse data warehouse

Use when: querying event data, analyzing revenue/subscriptions, running SQL
against Superwall's ClickHouse tables, or investigating user behavior.

→ [references/data-analytics.md](references/data-analytics.md)

The query endpoint has no dedicated CLI command — call it with curl:

```bash
curl -s -X POST https://api.superwall.com/v2/organizations/:organizationId/query \
  -H "Authorization: Bearer $SUPERWALL_API_KEY" \
  -H "Content-Type: text/plain" \
  --data 'SELECT ... FORMAT CSVWithNames'
```

## Docs — documentation, SDK integration, dashboard links

Use when: looking up Superwall docs, integrating an SDK, linking to dashboard
pages, cloning SDK source for debugging, or configuring webhooks.

→ [references/docs.md](references/docs.md)

Doc lookup:

```bash
curl -sL https://superwall.com/docs/llms.txt        # Find the right page
curl -sL https://superwall.com/docs/{path}.md        # Fetch a specific page
```

## Workflows — integrate, migrate, placements, dashboard

Use when: doing a big multi-step job — first-time SDK integration, migrating off
another billing SDK, adding/auditing placements, or standing up a campaign so
paywalls present.

> **If you are an agent: do the work yourself.** Use the CLI freely for CLI
> tasks (resources, raw API, ASC, bootstrap). But NEVER run the orchestrated
> workflow commands (`superwall integrate`, `superwall migrate`,
> `superwall review` without `--skill`) — they spawn a *second* headless agent,
> taking the work out of your session and out of the user's sight. Instead run
> `superwall <job> --skill` to print the expert playbook for *this* project
> (skill + the reference matching the detected framework/provider), then follow
> it yourself, step by visible step. The orchestrated commands exist for humans
> typing into a terminal without an agent.

| Job | You (agent): get the playbook | Human at a terminal |
| --- | --- | --- |
| Full setup | `superwall integrate --skill` | `superwall integrate` |
| Provider migration | `superwall migrate --skill` | `superwall migrate` |
| Placements audit/add | `superwall review --skill` | `superwall review` (`--fix` to implement) |
| Campaign + placement wiring | follow the **superwall-dashboard** skill | part of `superwall integrate` |

Example: `superwall migrate --skill` in a RevenueCat Expo app prints the migrate
skill + the RevenueCat reference — everything you need, composed for that repo.

`superwall skills` installs these workflow skills (superwall-integrate,
superwall-migrate, superwall-placements, superwall-dashboard) into your agent for
keeps, alongside this public toolkit. Prefer the installed skill when present;
otherwise reach for `--skill` on demand.
