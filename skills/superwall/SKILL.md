---
name: superwall
description: Provides Superwall REST API access, ClickHouse data analytics, documentation lookup, SDK integration triage, dashboard linking, and SDK source cloning. Use when the user asks about Superwall paywalls, campaigns, subscriptions, API usage, data analysis, SDK integration, webhook events, or debugging SDK behavior. Before doing anything, run the bootstrap command to see which projects & apps you have access to - `{baseDir}/scripts/sw-api.sh bootstrap`
---

# Superwall

This skill covers three areas. Read the relevant reference doc before proceeding.

## API — REST API wrapper & auth

Use when: making API calls, managing projects/paywalls/campaigns, bootstrapping org structure, or setting up API keys.

→ [references/api.md](references/api.md)

Quick start:

```bash
{baseDir}/scripts/sw-api.sh bootstrap
```

## Data & Analytics — ClickHouse data warehouse

Use when: querying event data, analyzing revenue/subscriptions, running SQL against Superwall's ClickHouse tables, or investigating user behavior.

→ [references/data-analytics.md](references/data-analytics.md)

Query endpoint:

```bash
{baseDir}/scripts/sw-api.sh -m POST -d 'SELECT ... FORMAT CSVWithNames' /v2/organizations/:organizationId/query
```

## Docs — Documentation, SDK integration, dashboard links

Use when: looking up Superwall docs, integrating an SDK, linking to dashboard pages, cloning SDK source for debugging, or configuring webhooks.

→ [references/docs.md](references/docs.md)

Doc lookup:

```bash
curl -sL https://superwall.com/docs/llms.txt        # Find the right page
curl -sL https://superwall.com/docs/{path}.md        # Fetch a specific page
```
