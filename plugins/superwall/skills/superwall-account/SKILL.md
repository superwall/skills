---
name: superwall-account
description: Use the Superwall MCP connector to inspect or manage an authenticated account, including projects, products, entitlements, campaigns, paywalls, webhooks, events, and analytics. Use for account tasks in any agent with the connector. For SDK code changes in a local repository, use the superwall skill.
---

# Superwall account

Use the Superwall MCP connector for account data and configuration. Its tools
act as the signed-in user and are limited by that user's access.

## Connect and scope

1. If the Superwall tools are unavailable, use the `superwall` CLI skill when a
   local authenticated CLI can complete the task. Otherwise ask the user to
   connect the Superwall connector. The public endpoint is
   `https://superwall-mcp.superwall.com/mcp`; sign-in uses the Superwall
   browser flow. Do not ask for an API key in chat.
2. Call `whoami` once per session to verify the account. For a request without a clear
   project, list organizations and projects and select the one the user's
   request identifies. Ask only when multiple plausible projects remain.
3. Use read tools to inspect current state before proposing changes. Keep
   project and application IDs explicit in subsequent calls.

## Common tasks

- Products and access: list or get products and entitlements before creating,
  updating, or deleting either.
- Paywalls and campaigns: inspect the current paywall, campaign, audience, and
  template before changing their relationship or status.
- Webhooks: inspect endpoints and event attempts before retrying delivery or
  rotating a secret. Never paste a returned secret into the conversation.
- Analytics: use chart and report tools when they answer the question. For
  custom SQL, use `run_clickhouse_query` only for read-only `SELECT` queries
  (including `WITH` queries that end in `SELECT`). Keep scope and time range
  explicit. Do not submit statements that alter tables or data.
- Health: use `run_doctor` to report issues; explain findings before making
  repairs the user did not request.

After a write, read the affected resource again and report the outcome with a
Superwall link or resource ID. If the connector denies access, report the
permission boundary instead of trying another project or credential.

## Local development

If the user asks to edit SDK integration code, migrate a provider, or review an
app repository, use the bundled `superwall` skill in a coding agent with a
terminal. It covers the CLI and framework-specific playbooks. The MCP server
does not control the live editor canvas; use `superwall-editor` for that
paired browser workflow.

For current setup and tool capabilities, read the
[Superwall MCP guide](https://superwall.com/docs/dashboard/guides/superwall-mcp).
