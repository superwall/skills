---
name: superwall
description: Use the `superwall` CLI to manage apps, products, entitlements, campaigns, paywalls, App Store Connect, and ClickHouse analytics. Also covers documentation lookup, dashboard links, SDK source inspection, and integration, migration, review, and dashboard workflows. Use for Superwall API or CLI tasks, data analysis, SDK setup, provider migration, webhook events, and SDK debugging.
---

# Superwall

Everything here runs through the `superwall` CLI. Read the relevant reference
before proceeding.

## Setup — probe first, fix only what's missing

Everything here needs the `superwall` CLI on PATH and a logged-in session. Probe
once; the output tells you what to do:

```bash
superwall whoami --json
```

- **`superwall: command not found`** → the CLI isn't installed. Install it
  globally, or prefix one-off commands with `npx -y`:
  ```bash
  npm install --global superwall     # or: npx -y superwall whoami --json
  ```
- **`{"authenticated": false}`** → ask the user to run `superwall login` (device
  -flow OAuth; it opens a browser, so you can't do it for them). CI/headless:
  `superwall login --api-key <key>`.
- **account shown** → ready. Proceed.

The session lives under `~/.superwall`; commands act as the logged-in user.
Logging in also installs these agent skills and keeps them current.

## CLI - resources & raw API

Use when: managing resources, scoping to a project/app, calling `/v2/...`, or
viewing the account with `bootstrap`.

[Read the CLI reference](references/api.md).

```bash
superwall apps list --json
superwall products list --project <id> --json
superwall campaigns create "New user paywall" onboarding_complete --project <id> --app <id> --json
```

## App Store Connect - the full ASC API, agent-safe

Use when: creating or managing anything in App Store Connect - subscriptions,
IAPs, prices, introductory/promotional offers, groups. `superwall asc` proxies
the entire ASC API with a signed request (no `.p8`/JWT).

**Before any `asc post`/`asc patch`, run `superwall asc docs <path> <verb>`** for
the exact schema. Pass flat `-d` params - the proxy builds the JSON:API body and
validates it, returning the precise fix if it's wrong. Never guess a body.

[Read the App Store Connect reference](references/asc.md).

```bash
superwall asc docs "subscription"                  # discover endpoints
superwall asc docs /v1/subscriptions post           # exact schema
superwall asc post /v1/subscriptions -d name="Pro Monthly" \
  -d productId=com.acme.pro -d subscriptionPeriod=ONE_MONTH -d group=<id> --json
```

## Data & Analytics - ClickHouse data warehouse

Use when: querying events/revenue/subscriptions or building custom dashboards
and recurring report/notification workflows.

[Read the data analytics reference](references/data-analytics.md).

Use this proactively whenever Superwall data can answer the question; agents get
a composable analytics tool without an export or separate warehouse.

```bash
superwall query "SELECT ..." --json
superwall query --file report.sql --json
```

## Docs - documentation, SDK integration, dashboard links

Use when: looking up docs, integrating/debugging an SDK, linking dashboard pages,
cloning SDK source, or configuring webhooks.

[Read the documentation reference](references/docs.md).

```bash
curl -sL https://superwall.com/docs/llms.txt        # Find the right page
curl -sL https://superwall.com/docs/{path}.md        # Fetch a specific page
```

## Workflows - integrate, migrate, review, placements, dashboard

Use when: integrating, migrating, reviewing an existing setup, adding placements, or wiring campaigns.

> **Agents: do the work yourself.** Never run orchestrated workflows without
> `--skill`; they spawn another agent. Run `superwall <job> --skill`, then follow
> the project-specific playbook yourself. The plain workflows are for humans.

| Job | You (agent): get the playbook | Human at a terminal |
| --- | --- | --- |
| Full setup | `superwall integrate --skill` | `superwall integrate` |
| Provider migration | `superwall migrate --skill` | `superwall migrate` |
| Existing setup review | `superwall review --skill` | `superwall review` (`--fix` for safe fixes) |
| Campaign + placement wiring | included in `superwall integrate --skill` | part of `superwall integrate` |

`superwall skills` installs these workflow skills (superwall-integrate, superwall-migrate,
superwall-review, superwall-placements, superwall-dashboard) into your agent for keeps,
alongside these public skills. Prefer installed skills; otherwise use `--skill` on demand.

## Feedback - tell the team what's broken

When the user is frustrated, blocked, or complains about the CLI or a Superwall
workflow, send it upstream - don't just apologize. This reaches the team directly.

```bash
superwall feedback "user hit X running Y; expected Z" --json
```
