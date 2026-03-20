---
name: superwall
description: Superwall API, documentation, and SDK helper. Use when the user asks about Superwall paywalls, subscriptions, campaigns, SDK integration, API usage, webhook events, or debugging Superwall behavior. Provides a REST API wrapper, documentation lookup, and SDK source cloning for deep investigation.
---

# Superwall

## API Access

A bash helper is included at `{baseDir}/scripts/sw-api.sh`. It wraps the Superwall REST API V2.

**Requires**: `SUPERWALL_API_KEY` environment variable (org-scoped bearer token).

```bash
# List all routes with methods (fetches live OpenAPI spec, no API key needed)
{baseDir}/scripts/sw-api.sh --help

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

The `--help` flag fetches the live OpenAPI spec from `https://api.superwall.com/openapi.json` — use it to discover endpoints and their parameters instead of hardcoding. Requires `jq`.

### Data hierarchy

Organization → Projects → Applications. Each application has a `platform` (ios, android, flutter, react_native, web), a `bundle_id`, and a `public_api_key` (used for SDK initialization — distinct from the org API key used for REST calls).

### Bootstrap workflow

1. Call `GET /v2/projects` to list all projects
2. Find the project matching the user's context
3. Inspect its `applications` array to find the right platform
4. Use the application's `public_api_key` for SDK init, the org `SUPERWALL_API_KEY` for REST API calls

### Pagination

Cursor-based. Responses include `has_more`. Pass `limit` (1-100), `starting_after`, or `ending_before` as query params.

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

## API Key Setup

API keys are **org-scoped** — one key grants access to all projects and applications in the organization.

- **Get an API key**: `https://superwall.com/select-application?pathname=/applications/:app/settings/api-keys`
- **Important**: The user needs to know which project/application they're targeting. Always start with `GET /v2/projects` to discover the org structure before doing anything else.
- Store the key as `SUPERWALL_API_KEY` in the environment.

---

## Dashboard Links

Use these to direct the user to the right page in the Superwall dashboard.

### Without applicationId

When you don't know the applicationId, use the `select-application` redirect — the user picks their app, then lands on the target page:

```
https://superwall.com/select-application?pathname=/applications/:app/{page}
```

| Page | URL |
|------|-----|
| Settings | `https://superwall.com/select-application?pathname=/applications/:app/settings` |
| API Keys | `https://superwall.com/select-application?pathname=/applications/:app/settings/api-keys` |
| Integrations | `https://superwall.com/select-application?pathname=/applications/:app/integrations` |
| Users | `https://superwall.com/select-application?pathname=/applications/:app/users/v2` |
| Surveys | `https://superwall.com/select-application?pathname=/applications/:app/surveys` |
| Products | `https://superwall.com/select-application?pathname=/applications/:app/products/v2` |
| Demand Score | `https://superwall.com/select-application?pathname=/applications/:app/demand-score` |
| Charts | `https://superwall.com/select-application?pathname=/applications/:app/charts/v2` |
| Campaigns | `https://superwall.com/select-application?pathname=/applications/:app/rules` |
| Paywalls | `https://superwall.com/select-application?pathname=/applications/:app/paywalls` |
| Templates | `https://superwall.com/select-application?pathname=/applications/:app/templates` |

### With applicationId

When you know the applicationId (from `GET /v2/projects`), link directly:

```
https://superwall.com/applications/{applicationId}/{page}
```

Same pages as above — swap `:app` for the actual ID (e.g. `https://superwall.com/applications/40581/settings`).

### Deep-linking to a specific user

```
https://superwall.com/applications/{applicationId}/users/v2/{userId}
```

`{userId}` can be a Superwall alias (e.g. `$SuperwallAlias:31FC167B-55CF-4197-9DF2-E5200C6A2E67`) or any user identifier.

---

## SDK Source (for debugging)

When you need to answer deep SDK questions, debug integration issues, or trace internal behavior, clone the relevant SDK into `{baseDir}/tmp/superwall-sdks/`.

**If the directory already exists, `git pull` instead of re-cloning.**

```bash
# iOS (Swift)
git clone -b develop https://github.com/superwall/Superwall-iOS.git {baseDir}/tmp/superwall-sdks/ios
# or if exists:
git -C {baseDir}/tmp/superwall-sdks/ios pull

# Android (Kotlin)
git clone -b develop https://github.com/superwall/Superwall-Android.git {baseDir}/tmp/superwall-sdks/android
# or if exists:
git -C {baseDir}/tmp/superwall-sdks/android pull

# Flutter (Dart)
git clone -b main https://github.com/superwall/Superwall-Flutter.git {baseDir}/tmp/superwall-sdks/flutter
# or if exists:
git -C {baseDir}/tmp/superwall-sdks/flutter pull

# React Native (TypeScript)
git clone -b main https://github.com/superwall/react-native-superwall.git {baseDir}/tmp/superwall-sdks/react-native
# or if exists:
git -C {baseDir}/tmp/superwall-sdks/react-native pull
```

Flutter and React Native are wrapper SDKs around the native iOS and Android SDKs. For deep internals, you may need to also clone the native SDK.

---

## Webhooks & Integrations

**Live integration catalog** (this is the same source the Superwall dashboard pulls from):

```bash
curl -s https://webhooks.superwall.me/integrations
```

Returns JSON with two top-level keys:
- `integrations` — array of all available integrations with their `id`, `name`, `status` (ACTIVE/BETA/WAITLIST), `category`, `fields` (configuration schema), and `documentation` URL
- `categories` — array of category definitions (analytics, communication, etc.)

Use this endpoint to get the current list of supported integrations, their required configuration fields, and setup instructions. Always fetch live — do not cache.

For general webhook and event documentation, fetch from the docs:
- **Webhook setup**: `curl -sL https://superwall.com/docs/integrations/webhooks.md`
- **Event catalog**: Fetch `https://superwall.com/docs/llms.txt` and search for "events" or "analytics" to find the full event type reference
