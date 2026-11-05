# Slots, the bridge and scopes

A slot is where an entrypoint shows. Every id in its context is authorized for the viewer before your code
sees it.

| Slot                     | Shows as                                             | Context, besides `organizationId`                                            |
| ------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `org.page@1`             | A full page for the organization                     | None                                                                         |
| `app.page@1`             | A full page in an app's sidebar                      | `applicationId`, `environment`                                               |
| `app.dashboard.widget@1` | A card on an app's dashboard, 120 to 480 px          | `applicationId`, `environment`, `dateRange`                                  |
| `campaign.tab@1`         | A tab on a campaign, 240 to 4000 px                  | `applicationId`, `campaignId`, `audienceId` (or null), `variantIds`, `environment`, `dateRange` |
| `user.panel@1`           | A panel on a user's page, 80 to 640 px               | `applicationId`, `appUserId`, `aliases`, `environment`                       |
| `user.action@1`          | An action in a user's menu, a modal, 120 to 640 px   | The same as `user.panel@1`                                                   |
| `chart.source@1`         | A metric in Charts, with no frame                    | `applicationId`, and the request's window                                    |
| `campaign.metric@1`      | A row in a campaign's results, with no frame         | `applicationId`, `campaignId`, `audienceId`, `variantIds`, `environment`     |

Only `org.page@1`, `chart.source@1` and `campaign.metric@1` can run SQL. The other frames are tied to one app.
`environment` is `PRODUCTION` or `SANDBOX`. `dateRange` is `{ from, to }`, ISO 8601, `[from, to)`. A rendered
slot needs a `path` and takes no `metric`; a headless one needs a `metric` and takes no `path`.

## Types

```ts
import type { MetricRequest, MetricSeries, ReadoutRequest, ReadoutResult } from "@superwall/artifact-sdk/metrics"
import type { SlotContext, UserPanelContextV1 } from "@superwall/artifact-sdk/slots"
```

## A readout

`campaign.metric@1`: one number per variant, for one audience, all-time.

```json
{
  "id": "lift",
  "slot": "campaign.metric@1",
  "title": "Bayesian lift",
  "metric": { "value_type": "percentage", "lower_is_better": false }
}
```

```ts
import type { ReadoutRequest, ReadoutResult } from "@superwall/artifact-sdk/metrics"

const readout = async ({ context }: ReadoutRequest): Promise<ReadoutResult> => ({
  variants: context.variantIds.map((variantId) => ({ variantId, value: 0.42, interval: [0.4, 0.44] })),
})
```

Pass it to `defineArtifact({ fetch, readout })`. `value` is null when there's nothing to show yet.
`interval` is optional and must hold `value`. Each variant at most once, and only this audience's; one you
leave out shows as having no value. Limits: 10 seconds, 32 KB. A readout metric takes no `breakdowns`,
`filters` or `total`.

## The bridge

`connect()` waits for the host, then replies `ready`. It trusts Superwall's dashboards, and a localhost host
when the frame is on localhost too (which is `dev`). Import `@superwall/artifact-sdk/client` from your
`client.entry`; `client-script` gives you the same thing as `superwallArtifact.connect` on a plain page.

```ts
bridge.context // the slot's context
bridge.theme // { mode: "light" | "dark", tokens }
bridge.onContext((context) => {})
bridge.onTheme((theme) => {})
bridge.onVisibility((visible) => {})
bridge.send({ _tag: "toast", kind: "success", message: "Saved" }) // kind: info, success or error
bridge.send({ _tag: "navigate", to: "user", params: { applicationId: "42", appUserId: "alice" } })
bridge.send({ _tag: "actionResult", status: "success", message: "Done", refresh: ["user"] })
bridge.send({ _tag: "error", message: "What went wrong, up to 500 characters" })
```

- `navigate` goes to `campaign` (`applicationId`, `campaignId`), `user` (`applicationId`, `appUserId`) or
  `artifact` (`slug`). The host builds the route; it never takes a URL.
- `actionResult` means something only in `user.action@1`, the modal slot.
- `resize` is sent for you as the document grows, and clamped to the slot. A page and a widget fill what
  holds them and ignore it, so a widget must handle being narrow and scroll inside itself.
- Theme tokens: `background`, `foreground`, `card`, `card-foreground`, `popover`, `muted`,
  `muted-foreground`, `border`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`,
  `destructive`, `success`, `warning`, `info`, `fg-secondary`, `fg-tertiary`, `radius`.

## Scopes

A manifest can ask for only these, and the viewer's own access still applies:

`projects:read`, `applications:read`, `paywalls:read`, `paywalls:write`, `campaigns:read`, `campaigns:write`,
`products:read`, `products:write`, `entitlements:read`, `entitlements:write`, `webhooks:read`, `charts:read`,
`users:read`, `customers:read`, `custom_stores:read`, `custom_stores:write`, `custom_store_events:write`,
`retention_messages:read`, `retention_messages:write`, `notifications:read`, `notifications:write`,
`assets:read`, `assets:write`, `data:read`, `surveys:read`, `surveys:write`, `onboarding:read`.

`SKILL.md` has which route needs which scope. A route whose scope isn't declared answers 403. Writes do nothing
in `dev` or a draft.

Routes an artifact can call: reads under `/v2/projects`, `/v2/applications`, `/v2/charts`, `/v2/users`,
`/v3/users`, `/v2/onboarding`, `/v2/retention-onboarding` and `/v2/demand-score`; reads and, where the scope
allows, writes under `/v2/paywalls`, `/v2/campaigns`, `/v2/products`, `/v2/entitlements`, `/v2/grants`,
`/v2/assets`, `/v2/surveys` and the retention families. Nothing under `/v2/me`, access, tokens or transfers.

**A slot tied to one app reaches fewer.** That's every rendered slot but `org.page@1`: `app.page@1`, widgets, tabs,
panels and actions. They reach `/v2/campaigns`, `/v2/surveys`, the retention families, `/v2/users`, `/v3/users`,
`/v2/charts`, `/v2/paywalls`, `/v2/applications/<id>/…`, and one product, entitlement or asset by id. They can't reach
`/v2/projects`, SQL, or a list of products, entitlements or assets, which show sibling apps. Anything else answers 403
with "Artifacts may not call this endpoint.", in `dev` too. Metrics and readouts aren't held to this list.
