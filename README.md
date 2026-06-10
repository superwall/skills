<p align="center">
  <br />
  <img src=https://user-images.githubusercontent.com/3296904/158817914-144c66d0-572d-43a4-9d47-d7d0b711c6d7.png alt="logo" height="100px" />
  <h3 style="font-size:26" align="center">In-App Paywalls Made Easy 💸</h3>
  <br />
</p>

[Superwall](https://superwall.com/) lets you remotely configure every aspect of your paywall — helping you find winners quickly.


# Superwall Skills

Official [Agent Skills](https://agentskills.io/home) for integrating Superwall SDKs and managing Superwall projects.

## Install

We recommend using [skills.sh](https://skills.sh) CLI to install the skills.

Install all skills:

```bash
npx skills add superwall/skills
```

Install the main skill:

```bash
npx skills add superwall/skills --skill superwall
```

## Skills

- [`superwall`](#superwall) — REST API access, ClickHouse analytics, documentation lookup, SDK integration triage, dashboard links, and SDK source cloning.
- [`superwall-editor`](#superwall-editor) — live Superwall paywall, onboarding, and web2app editing from the CLI.
- [`wwdc`](#wwdc) — WWDC session lookup, comparison, citation, summarization, and transcript navigation using [wwdc.ai](https://wwdc.ai/).

## superwall

Use the `superwall` skill when you need to manage Superwall projects, paywalls, campaigns, products, entitlements, webhooks, assets, or dashboard configuration. It also covers Superwall documentation lookup, SDK integration triage, SDK source inspection, and ClickHouse-backed product analytics.

### API Key

To enable API access, add your **org-scoped API key** to the environment:

```bash
export SUPERWALL_API_KEY=<your-org-api-key>
```

You can generate an API key from the Superwall dashboard under **Settings → Keys** ([go to API Keys](https://superwall.com/select-application?pathname=/applications/:app/settings/api-keys)).

> **Tip:** Add the export to your shell profile (e.g. `~/.zshrc`) or `.env` file so it persists across sessions.

### Required Scopes

To fully use the `superwall` skill, your API key needs the following scopes:

| Scope | Used for |
|-------|----------|
| `projects:read` | List and inspect projects and applications |
| `projects:write` | Create and update projects and applications |
| `applications:read` | Fetch application overview stats and transactions |
| `applications:write` | Update application settings |
| `paywalls:read` | List paywalls and templates |
| `paywalls:write` | Create, update, publish, and archive paywalls |
| `products:read` | List and inspect products |
| `products:write` | Create, update, and delete products |
| `campaigns:read` | List and inspect campaigns |
| `campaigns:write` | Create and update campaigns, placements, and audiences |
| `entitlements:read` | List entitlements and grants |
| `entitlements:write` | Create, update, delete entitlements; grant/revoke access |
| `webhooks:read` | List webhook endpoints and events |
| `webhooks:write` | Create, update, delete endpoints; retry deliveries |
| `charts:read` | Query chart data and definitions |
| `users:read` | Retrieve user events |
| `assets:read` | List and inspect assets |
| `assets:write` | Upload and manage assets |

> If you only need read-only access, the `:read` scopes are sufficient for browsing your Superwall data.

## superwall-editor

Use the `superwall-editor` skill when you want an agent to build, modify, or review a live Superwall paywall, onboarding flow, or web2app flow.

The editor skill attaches to a running browser editor session, discovers the tools currently exposed by that browser, and invokes those tools from the CLI. Prefer the API launch flow when you have `SUPERWALL_API_KEY`, an application id, and a paywall id:

```bash
scripts/sw-editor.sh expose --application-id <id> --paywall-id <id> --agent-name <agent> --open --wait
scripts/sw-editor.sh tools
scripts/sw-editor.sh call <tool-name> --args '<json>'
```

If the API launch flow is not available, use the pairing code shown in the editor:

```bash
scripts/sw-editor.sh attach <pairing-code>
scripts/sw-editor.sh tools
scripts/sw-editor.sh call <tool-name> --args '<json>'
```

See the skill references for the full CLI lifecycle, native `sw-*` elements, paywall editing workflow, and design standards.

## wwdc

Use the `wwdc` skill when you need current Apple Developer session context while working on Superwall integrations. It can find, compare, cite, and summarize WWDC session content, including transcripts and session IDs, using [wwdc.ai](https://wwdc.ai/).

The bundled helper can list available WWDC.ai markdown pages and fetch session summaries or transcripts:

```bash
scripts/wwdc.sh llms
scripts/wwdc.sh summary 2026 389
scripts/wwdc.sh transcript 2026 309
```
