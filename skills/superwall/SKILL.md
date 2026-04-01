---
name: superwall
description: Provides Superwall REST API access, documentation lookup, SDK integration triage, dashboard linking, and SDK source cloning. Use when the user asks about Superwall paywalls, campaigns, subscriptions, API usage, SDK integration, webhook events, or debugging SDK behavior.
---

# Superwall

## API Access

A bash helper is included at `{baseDir}/scripts/sw-api.sh`. It wraps the Superwall REST API V2.

**Auth resolution**: `SUPERWALL_API_KEY` from the current shell wins, then `{baseDir}/.env`, then `~/.superwall-cli/.env`.

Always start a session by calling `bootstrap` to get an overview of the current Superwall setup:

```bash
{baseDir}/scripts/sw-api.sh bootstrap
```

```bash
# List all routes with methods (fetches live OpenAPI spec, no API key needed)
{baseDir}/scripts/sw-api.sh --help

# Save a key for this installed skill (default)
{baseDir}/scripts/sw-api.sh auth login --key=<your-org-api-key>

# Save a machine-wide fallback key
{baseDir}/scripts/sw-api.sh auth login --key=<your-org-api-key> --location=global

# Show which credential source is active
{baseDir}/scripts/sw-api.sh auth status

# Print organization -> project -> application hierarchy
{baseDir}/scripts/sw-api.sh bootstrap

# Show full spec for a specific route (params, request body, responses)
{baseDir}/scripts/sw-api.sh --help /v2/projects

# List all projects (start here to discover the org structure)
{baseDir}/scripts/sw-api.sh /v2/projects

# Get a specific project (includes its applications)
{baseDir}/scripts/sw-api.sh /v2/projects/{id}

# Create a project
{baseDir}/scripts/sw-api.sh -m POST -d '{"name":"My Project"}' /v2/projects

# Update a project
{baseDir}/scripts/sw-api.sh -m PATCH -d '{"name":"Renamed"}' /v2/projects/{id}
```

The `--help` flag requires `jq`.

### Data hierarchy

Organization → Projects → Applications. Each application has a `platform` (ios, android, flutter, react_native, web), a `bundle_id`, and a `public_api_key` (used for SDK initialization — distinct from the org API key used for REST calls).

### Bootstrap workflow

To print the current organization/project/application hierarchy:

```bash
{baseDir}/scripts/sw-api.sh bootstrap
```

The bootstrap command uses:

1. `GET /v2/me/organizations` for the first 50 organizations
2. `GET /v2/projects?organization_id=...&limit=100` for up to 100 projects per organization
3. The embedded `applications` array from each project, capped to the first 10 apps

Use the application's `public_api_key` for SDK init, and the org `SUPERWALL_API_KEY` for REST API calls.

### Pagination

Cursor-based. Responses include `has_more`. Pass `limit` (1-100), `starting_after`, or `ending_before` as query params.

---

## API Key Setup

API keys are **org-scoped** — one key grants access to all projects and applications in the organization.

- **Get an API key**: `https://superwall.com/select-application?pathname=/applications/:app/settings/api-keys`

Preferred setup:

```bash
{baseDir}/scripts/sw-api.sh auth login --key=<your-org-api-key>
```

That validates the key and saves it to `{baseDir}/.env` by default. The skill ships a `.gitignore` in its root so that local `.env` file is not committed when the skill is copied into another repository.

You can also save a machine-wide fallback:

```bash
{baseDir}/scripts/sw-api.sh auth login --key=<your-org-api-key> --location=global
```

If needed, exporting `SUPERWALL_API_KEY` in the current shell still overrides any saved key.

### Required scopes

For full use of this skill, the API key requires all scopes. However, you may
also provision just read access if you'll just be doing analysis. 

---

## Documentation

All Superwall documentation is available in machine-readable formats. **Do not hardcode doc content** — always fetch live.

| Resource | URL | Use when |
|----------|-----|----------|
| Doc index | `https://superwall.com/docs/llms.txt` | Finding the right doc page for a topic |
| Full docs | `https://superwall.com/docs/llms-full.txt` | Need comprehensive context across many topics |
| Single page | `curl -sL https://superwall.com/docs/{path}.md` | Reading a specific doc page |

### Platform doc prefixes

- iOS: `/docs/ios/`
- Android: `/docs/android/`
- Flutter: `/docs/flutter/`
- Expo: `/docs/expo/`
- React Native: `/docs/react-native/`
- Dashboard: `/docs/dashboard/`
- Web Checkout: `/docs/web-checkout/`
- Integrations: `/docs/integrations/`

**Tip**: Fetch `llms.txt` first to find the exact path, then fetch that page with `curl -sL`.

---

## SDK Integration

For SDK integration, use the platform-specific quickstart skills when available:

| Platform | Skill |
|----------|-------|
| iOS (Swift/ObjC) | `superwall-ios-quickstart` |
| Android (Kotlin/Java) | `superwall-android-quickstart` |
| Flutter | `superwall-flutter-quickstart` |
| Expo | `superwall-expo-quickstart` |

For platforms without a dedicated skill (React Native), or when the quickstart skills are not installed, follow the live-doc workflow in [references/sdk-integration.md](references/sdk-integration.md).

---

## Dashboard Links

URL patterns for linking users to Superwall dashboard pages. See [references/dashboard-links.md](references/dashboard-links.md).

---

## SDK Source (for debugging)

Clone SDK repos locally to trace internal behavior. See [references/sdk-source.md](references/sdk-source.md).

---

## Webhooks & Integrations

**Live integration catalog** (same source the Superwall dashboard pulls from):

```bash
curl -s https://webhooks.superwall.me/integrations
```

Always fetch live — do not cache.

For general webhook and event documentation, fetch from the docs:
- **Webhook setup**: `curl -sL https://superwall.com/docs/integrations/webhooks.md`
- **Event catalog**: Fetch `https://superwall.com/docs/llms.txt` and search for "events" or "analytics" to find the full event type reference
