# Dashboard Links

## Without applicationId

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

## With applicationId

When you know the applicationId (from `GET /v2/projects`), link directly:

```
https://superwall.com/applications/{applicationId}/{page}
```

Same pages as above — swap `:app` for the actual ID (e.g. `https://superwall.com/applications/40581/settings`).

## Deep-linking to a specific user

```
https://superwall.com/applications/{applicationId}/users/v2/{userId}
```

`{userId}` can be a Superwall alias (e.g. `$SuperwallAlias:31FC167B-55CF-4197-9DF2-E5200C6A2E67`) or any user identifier.
