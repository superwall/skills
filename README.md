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

Install the general skill:

```bash
npx skills add superwall/skills --skill superwall
```

## Setup

### API Key

The `superwall` skill uses the Superwall REST API to manage projects, paywalls, campaigns, products, and more. To enable API access, add your **org-scoped API key** to the environment:

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
