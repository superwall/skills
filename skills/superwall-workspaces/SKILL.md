---
name: superwall-workspaces
description: Build and ship a Superwall workspace, a small Cloudflare Worker that adds to the Superwall dashboard, from your own machine with the `superwall workspaces` commands (`create`, `dev`, `try`, `update`, `push`, `pull`, `status`, `logs`, `share`, `approve`, `install`, `list`, `open`). Covers `superwall.json`, slots and their context, `metric()` for a chart in Charts, `readout()` for a row in a campaign's results, `fetch` for pages, panels, tabs, widgets and actions, the host bridge, scopes, and what the builder refuses. Use when the user wants a custom dashboard page, a metric or chart one query can't express, an own statistic on a campaign's results, or a panel or action on a user's page. NOT for screens shown inside an app (paywalls, onboarding), which are `superwall-framework`. For a one-off answer or a single query, use `superwall query`.
user-invocable: true
---

# Superwall workspaces

A workspace is a small Cloudflare Worker that adds to the Superwall dashboard. It holds no credential:
it calls Superwall as whoever is viewing it. You can build a page, a panel, a tab, a card, an action, a
metric in Charts or a row in a campaign's results.

The commands need `SUPERWALL_CHANNEL=next`, and Node 20 or later. `dev` and `try` need a browser login
(`superwall login`): an API key can't run them.

## The loop

```bash
superwall workspaces create my-workspace   # downloads the starter and installs
cd my-workspace
superwall workspaces dev --app <app>       # http://localhost:8790, real data, read-only
superwall workspaces try transactions --app <app>   # a metric on the real runtime
superwall workspaces try home --org <org>   # a page in the dashboard
superwall workspaces push --org <org>       # build it; only you see it until an admin approves it
```

1. **`dev`** bundles it the way the builder does and runs it in workerd. A local page plays the
   dashboard: it mounts pages and widgets, sends them context and theme, and runs metrics and readouts.
   Saving a file rebuilds it. Only run code you trust: it reads everything you can read in that organization.
   Its token is limited to one organization, which goes for a staff account too. Without a browser, POST to the page's own API (see `references/cli.md`).
2. **`try`** uploads a draft and runs it on the real runtime, as you, read-only and with no outside hosts.
   Only you can reach a draft, for a day. A metric prints its series. A page, panel, tab, card or action
   opens in the dashboard. Readouts can't be tried yet, so `dev` is how you run those.
3. Nothing is saved by either. **`push`** is what saves it: it sends the source over git, and the builder
   makes a version from the commit. `push` waits for the build and shows the builder's message if it fails.
4. **Only the author can see a pushed version until an admin approves it.** Say so. A staff account gets no copy, so
   nobody can see what it pushes until then, and `push` and `share` say which. After approval, the author keeps a
   copy marked "Not installed" until an entrypoint has an install. `share` asks for review,
   an admin runs `approve`, and `install` chooses where it shows. `org.page@1` needs no install.
5. **A pusher's own copy can include teammates' merged code, and it runs with the pusher's reads.** `push` lists
   those commits and asks first. Without a terminal it stops unless `--accept-merged-commits` is passed. That flag
   is for a person who has read them, so don't add it to get past the refusal.

Run `try` before you believe a scope is enough. `dev` reads everything you can read in its organization and warns about a
scope it knows is missing; a draft holds only the manifest's read scopes ∩ yours, and answers 403 otherwise.

## Files

| File                  | What it is                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `superwall.json`      | The manifest: what it can do and where it shows.                                            |
| `src/worker.ts`       | The code. One default export and no other exports.                                          |
| `wrangler.jsonc`      | `name`, `main` and `compatibility_date`. No bindings of any kind.                           |
| `package-lock.json`   | Required, from npm. The builder installs exactly this.                                      |
| `superwall.workspace.json` | Written by the first push: which workspace this is. Commit it, so teammates push to the same one. |
| `vendor/workspace-sdk` | Generated, never edited. `superwall workspaces update` refreshes it. There is no npm package. |

## A metric

`superwall.json`:

```json
{
  "name": "Subscription health",
  "scopes": ["data:read"],
  "entrypoints": [
    {
      "id": "transactions",
      "slot": "chart.source@1",
      "title": "Transactions",
      "metric": {
        "description": "Under 280 characters.",
        "value_type": "number",
        "breakdowns": [{ "key": "store", "name": "Store" }],
        "filters": [
          {
            "key": "store",
            "name": "Store",
            "values": [
              { "value": "APP_STORE", "label": "App Store" },
              { "value": "PLAY_STORE", "label": "Google Play" }
            ]
          }
        ]
      }
    }
  ]
}
```

Ids and keys are lowercase letters, digits and dashes, starting with a letter. `value_type` is `number`,
`percentage` or `currency`. `breakdowns` and `filters` are optional, 10 of each at most. `total` is `sum`
(the default) or `last`, for a count at a moment, where adding the days up means nothing.

`src/worker.ts`:

```ts
import type { MetricRequest, MetricSeries } from "@superwall/workspace-sdk/metrics"
import { defineWorkspace, superwallFetch } from "@superwall/workspace-sdk/server"

const UNITS = { hour: "HOUR", day: "DAY", week: "WEEK", month: "MONTH" }
const dateTime = (iso: string) => iso.slice(0, 19).replace("T", " ")

const metric = async ({
  context,
  from,
  to,
  interval,
  timezone,
  breakdown,
  filters,
}: MetricRequest): Promise<MetricSeries> => {
  const search = new URLSearchParams({
    default_format: "JSON",
    param_app: String(context.applicationId),
    param_from: dateTime(from),
    param_to: dateTime(to),
    param_tz: timezone,
  })
  let storeFilter = ""
  if (filters.store) {
    storeFilter = "AND store IN {stores:Array(String)}"
    search.set("param_stores", `[${filters.store.map((store) => `'${store}'`).join(",")}]`)
  }
  const unit = UNITS[interval]
  const bucketOf = (time: string) =>
    `toDateTime(toStartOfInterval(${time}, INTERVAL 1 ${unit}, {tz:String}), {tz:String})`
  const sql = `
    SELECT toString(toTimeZone(bucket, 'UTC')) AS t, breakdown, value
    FROM (
      SELECT ${bucketOf("ts")} AS bucket,
             ${breakdown === "store" ? "store" : "NULL"} AS breakdown,
             uniq(transactionId) AS value
      FROM open_revenue.attributed_events_by_ts_rep
      WHERE applicationId = {app:UInt64} AND ts >= {from:DateTime} AND ts < {to:DateTime} AND ts < now()
        AND isSandbox = 0 ${storeFilter}
      GROUP BY bucket, breakdown
      ORDER BY breakdown, bucket WITH FILL
        FROM ${bucketOf("toDateTime({from:DateTime}, 'UTC')")}
        TO least(toDateTime({to:DateTime}, 'UTC'), now())
        STEP INTERVAL 1 ${unit}
    )
    ORDER BY breakdown, t`
  const response = await superwallFetch(`/v2/organizations/${context.organizationId}/query?${search}`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: sql,
  })
  if (!response.ok) throw new Error((await response.text()).slice(0, 500))
  const { data } = (await response.json()) as {
    data: ReadonlyArray<{ t: string; value: string | number; breakdown: string | null }>
  }
  return {
    points: data.map((row) => ({
      t: `${row.t.replace(" ", "T")}Z`,
      value: Number(row.value),
      breakdown: row.breakdown,
    })),
  }
}

export default defineWorkspace({
  fetch: () => new Response("Not found", { status: 404 }),
  metric,
})
```

- `metric()` is called with `metric` (the entrypoint id), `context` `{ organizationId, applicationId }`,
  `from` and `to` (ISO 8601 in UTC, ending in Z), `interval` (`hour`, `day`, `week` or `month`), `timezone`,
  `breakdown` (a declared key or null) and `filters` (declared keys to the values chosen; a key is absent
  when nothing is chosen). Bucket in `timezone`, as the example does, or days land on the wrong side of the
  viewer's midnight.
- It returns `{ points: [{ t, value, breakdown? }] }`. `t` is the bucket's start as ISO 8601 with an offset.
  A bucket with no point is a gap, so return 0 where zero is what you mean. The example's `WITH FILL` does that;
  a window with no rows at all still returns no points.
- Always honor `interval`, `breakdown` and `filters`, as the example does. Only ever build SQL from values
  you control, or from filter values the manifest declares, which are the only ones that reach you.
- Prefer aggregated tables, filter `applicationId` and `isSandbox = 0`, and keep `ts < now()`. A slow query
  fails the metric, so test it over the widest window you expect. Test the SQL with `superwall query` first.
- Limits: 10 seconds, 5,000 points, 50 series, 256 KB returned, 1 MB bundled for a draft.

A readout is the same idea for a campaign's results; see `references/slots.md`.

## A page

Name the page's browser code in `superwall.json`, and `dev`, `try` and the builder bundle it the same way.
No build script of yours runs. The starter's page is the worked example.

```json
{ "client": { "entry": "src/client.tsx" } }
```

```ts
// src/worker.ts. Browser code holds no credential, so it asks this Worker, which calls Superwall as the viewer.
import client from "@superwall/workspace-sdk/client-bundle"
import { clientPage, defineWorkspace, superwallFetch, type WorkspaceRequest } from "@superwall/workspace-sdk/server"
import type { OrgPageContextV1 } from "@superwall/workspace-sdk/slots"

const serve = ({ request, context }: WorkspaceRequest) => {
  const { pathname } = new URL(request.url)
  if (pathname === "/") return clientPage(client, { title: "Projects" })
  if (pathname === "/api/projects") {
    const { organizationId } = context as OrgPageContextV1
    return superwallFetch(`/v2/projects?organization_id=${organizationId}`)
  }
  return new Response("Not found", { status: 404 })
}

export default defineWorkspace({ client, fetch: serve })
```

```tsx
// src/client.tsx
import type { Theme } from "@superwall/workspace-sdk/bridge"
import { connect } from "@superwall/workspace-sdk/client"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import "./styles.css"

const applyTheme = ({ tokens }: Theme) => {
  for (const [name, value] of Object.entries(tokens)) document.documentElement.style.setProperty(`--${name}`, value)
}

const Home = () => {
  const [projects, setProjects] = useState<ReadonlyArray<{ name: string }>>([])
  useEffect(() => {
    void connect().then((bridge) => {
      applyTheme(bridge.theme)
      bridge.onTheme(applyTheme)
    })
    // On a refusal, show the API's message: the starter's src/client.tsx does.
    void fetch("/api/projects")
      .then((response) => response.json() as Promise<{ data: ReadonlyArray<{ name: string }> }>)
      .then(({ data }) => setProjects(data))
  }, [])
  return <ul>{projects.map((project) => <li key={project.name}>{project.name}</li>)}</ul>
}

createRoot(document.getElementById("root")!).render(<Home />)
```

`defineWorkspace({ client })` serves the bundle at `/_client/<hash>.js` and `.css`, and `clientPage` writes the
document that loads them, with an empty `<div id="root">`. The Worker also needs the import: with no `client` in the
manifest, it doesn't bundle.

**What the build does.** React's automatic JSX, TypeScript, CSS imports, images and fonts as data URLs, one script
and at most one stylesheet, 8 MiB together. `dev` rebuilds on any change in the project.

**What it doesn't do yet, because no customer script runs:**

- PostCSS and Tailwind's build. Run them yourself and commit the CSS they make.
- `paths` from `tsconfig.json` in browser code, because the build doesn't read that file. Wrangler still honors them
  in the Worker, so the two differ. Use relative imports in browser code.
- Web Workers from `new URL(...)`.

**A draft can be 1 MiB at most,** so a large page works in `dev` and `push` and is refused by `try`.

A page with no npm packages can skip all of this: answer HTML from `fetch` and load the bridge from
`@superwall/workspace-sdk/client-script` in a `<script>`.

```json
{ "id": "home", "slot": "org.page@1", "title": "Projects", "path": "/" }
```

With scopes `["projects:read"]`, and connect within 20 seconds of the page being visible or the dashboard shows the load error. The
context comes from the platform, already authorized for the viewer. Never trust a user's id from the URL
over it. If you write HTML yourself, escape everything that came from the API or an end user.

## What it can reach

`https://api.workspace.internal` is the Superwall API (`superwallFetch` is a `fetch` to it). The viewer's
own access still applies on every call, narrowed by the manifest's `scopes`.

**Declare a scope for every API you call.** A route whose scope isn't declared answers a bare 403 at run
time, and `data:read` covers only SQL:

| Route                                       | Read scope                |
| ------------------------------------------- | ------------------------- |
| `/v2/organizations/:id/query` (SQL)         | `data:read`               |
| `/v2/projects`                              | `projects:read`           |
| `/v2/applications/…`                        | `applications:read`       |
| `/v2/paywalls`                              | `paywalls:read`           |
| `/v2/campaigns`                             | `campaigns:read`          |
| `/v2/products`                              | `products:read`           |
| `/v2/entitlements`                          | `entitlements:read`       |
| `/v2/charts/…`, `/v2/demand-score/…`        | `charts:read`             |
| `/v2/users`, `/v3/users`                    | `users:read`              |
| `/v2/onboarding`                            | `onboarding:read`         |
| `/v2/surveys`                               | `surveys:read`            |
| `/v2/assets`                                | `assets:read`             |
| `/v2/retention-messages` and its family     | `retention_messages:read` |
| `/v2/projects/:id/custom-stores`            | `custom_stores:read`      |

**SQL runs only in an `org.page@1` or a metric.** Every other frame (`app.page`,
`app.dashboard.widget`, `campaign.tab`, `user.panel`, `user.action`) is tied to one app and can't reach
`/v2/organizations/:id/query`. Before you write one, decide where its data comes from: an API in the table,
which reaches only that app, or an `org.page@1` or a metric instead of it. Don't write a widget that needs SQL.

Dev and drafts read only, with no outside hosts and no raw sockets, whatever the manifest asks for.

**Not available yet:** storage, cron, events, jobs and secrets. The manifest fields exist, but nothing runs
them, and an admin can't approve a version that declares secrets. If the user's idea needs them, build the read-only part and say the rest can't be tried here.

## What the builder refuses

- Any binding in `wrangler.jsonc`: KV, R2, D1, services, vars, AI, assets, Durable Objects, Workflows,
  Containers, cron triggers. Everything goes through `fetch`.
- A custom `build.command`, `no_bundle` or `find_additional_modules`, and text, data or wasm modules. A
  workspace is exactly one bundled ES module, at most 10 MiB, exporting only its default handlers.
- `@superwall/workspace-sdk` from anywhere but `file:vendor/workspace-sdk`.
- A lockfile with a package from outside `registry.npmjs.org`, or without an integrity hash.

`dev` applies the bundle rules as it builds. `references/cli.md` lists what `dev` doesn't copy from the
real runtime, and what its errors mean.
