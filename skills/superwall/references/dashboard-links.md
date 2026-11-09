# Dashboard Links

The dashboard lives at `https://app.superwall.com`. Every page of an app is
under its organization and application:

```
https://app.superwall.com/{orgId}/{applicationId}/{page}
```

The old `superwall.com` dashboard pages (`/applications/{applicationId}/…`
and the `/select-application?pathname=…` redirect) are the legacy
dashboard. Do not give them.

## Finding the ids

- **applicationId**: `superwall.lock` (`apps.<platform>`) in a framework
  project, or `applications[].id` in `GET /v2/projects`.
- **orgId**: `organization_id` of the project that holds the app, in
  `GET /v2/projects`. A dashboard link the user pasted carries both:
  `https://app.superwall.com/{orgId}/{applicationId}/…`.
- **paywallId**: `superwall.lock` (`paywalls.<name>.<platform>.paywallId`) in
  a framework project, or `id` in `GET /v2/paywalls`.

When you can't find the ids, link the organization picker; the user picks
their organization and app, then opens the page from the sidebar:

```
https://app.superwall.com/select-organization
```

## Pages

| Page | Path after `/{orgId}/{applicationId}` |
|------|-----|
| Paywalls | `/paywalls` |
| Design system | `/paywalls/design-system` |
| Templates (where a new paywall starts) | `/templates` |
| Campaigns | `/campaigns` |
| One campaign | `/campaigns/{campaignId}` |
| Products | `/products` |
| Charts | `/charts` |
| Users | `/users` |
| Surveys | `/surveys` |
| Demand Score | `/demand-score` |
| Integrations | `/integrations` |
| Settings | `/settings` |
| API Keys | `/settings/api-keys` |

Example: `https://app.superwall.com/1203/40581/settings/api-keys`.

## Deep-linking to a specific paywall

The link depends on how the paywall was built. A paywall row from
`GET /v2/paywalls` says so in `headless`.

**Built with the framework (code-first, `headless: true`)**: its studio.

```
https://app.superwall.com/{orgId}/{applicationId}/paywalls/{paywallId}/studio
```

Give this link whenever you push, promote or publish a framework paywall,
and whenever the user asks where to see one.

**A new code-first paywall** (the builder, before any push):

```
https://app.superwall.com/{orgId}/{applicationId}/paywalls/new/studio
```

**Built in the visual editor (`headless: false`)**: the legacy editor, the
only place those paywalls open.

```
https://superwall.com/editor/#/applications/{applicationId}/paywalls/{paywallId}/latest
```

Never give a code-first paywall the editor link; it cannot edit one. When
you can't tell the kind, link the paywalls page,
`https://app.superwall.com/{orgId}/{applicationId}/paywalls`, which opens
each paywall the right way.

## Deep-linking to a specific user

```
https://app.superwall.com/{orgId}/{applicationId}/users/{userId}
```

`{userId}` can be a Superwall alias (e.g. `$SuperwallAlias:31FC167B-55CF-4197-9DF2-E5200C6A2E67`) or any user identifier; URL-encode it.

## Staging

Superwall's own staging dashboard is `https://app.superwall.dev`, same paths.
Use it only when the CLI or API points at staging.
