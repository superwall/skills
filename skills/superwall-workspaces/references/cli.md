# The commands

## `superwall workspaces dev [dir]`

| Flag                         | What it fills in                                                   |
| ---------------------------- | ------------------------------------------------------------------ |
| `--port`, `-p`               | The dev page's port, 8787 by default. The frame takes the next one. |
| `--org`, `--app`             | The organization and app. `--app` alone finds the organization.     |
| `--campaign`, `--audience`, `--variant` | A campaign tab's or readout's context. `--variant` repeats. |
| `--user`, `--alias`          | A user panel's or action's context. `--alias` repeats.              |
| `--environment`              | `PRODUCTION` or `SANDBOX`.                                          |
| `--from`, `--to`             | A date range, ISO 8601. The last 30 days by default.                |
| `--context`                  | The whole context as JSON, for a slot this CLI doesn't know.        |

The page lets you change all of these. Without a browser, use its own API on the dev page's origin. It answers
JSON, with `error` on a 400:

```bash
curl -X POST localhost:8787/__dev/metric -H 'content-type: application/json' -d '{
  "entrypoint": "transactions",
  "input": { "applicationId": "42" },
  "from": "2026-10-01T00:00:00Z", "to": "2026-10-08T00:00:00Z",
  "interval": "day", "breakdown": "store", "filters": { "store": ["APP_STORE"] }
}'

curl -X POST localhost:8787/__dev/readout -H 'content-type: application/json' -d '{
  "entrypoint": "lift",
  "input": { "applicationId": "42", "campaignId": "7", "audienceId": "8", "variantIds": ["9", "10"] }
}'
```

### How `dev` differs from the real runtime

The same: workerd, the platform's compatibility date, the same bundling step, the same checks on what a
handler returns and how long it takes, no `caches`, no outside hosts, the same response headers and
content security policy, a frame on its own origin that really goes through the bridge, and a slot tied to
one app being refused SQL.

Different, so run `try` before believing these:

- **Scopes and routes.** `dev` uses a read-only token with everything you can read, on any route that token
  allows. It warns when a known route's scope isn't declared, and still answers. A draft holds only the
  manifest's read scopes, on the workspace routes, and answers 403.
- **App narrowing.** A slot tied to one app reaches only that app on the real runtime. `dev` refuses it SQL,
  and otherwise doesn't narrow.
- **Frames** have one session per dev server, so two tabs share the last one opened. The local dashboard is
  a stand-in, and its theme tokens are close to the real ones, not the same.
- **Limits.** CPU and subrequest limits don't apply locally.
- **Handlers** are called over a local route rather than Workers RPC, so results pass through JSON.
- **The bundle** uses your project's wrangler, and the builder uses its own pinned one.
- **Storage, cron, events, jobs and secrets** aren't available anywhere yet. The platform host answers 501.

## `superwall workspaces try <entrypoint>`

A metric prints each series' summary: `--app` (required), `--org`, `--dir`, `--from`, `--to`, `--days` (30),
`--interval` (`day`), `--breakdown`, `--filter key=value` (repeats), `--points`. `--json` adds the draft id, its
expiry, the scopes it asked for and the series.

A frame uploads, prints a link to `/<org>/workspace-drafts/<draft>` on the dashboard and, at a terminal, opens
it: `--org` or `--app`, `--campaign`, `--user`, `--environment`, `--no-open`. `--json` gives the link as `url`.
A readout says to use `dev`.

If your code throws, `try` shows your own message. A 403 from inside your code is a missing scope.

## `superwall workspaces create [dir]`

Downloads the starter into `dir` (`my-workspace` by default), names it after the directory and runs
`npm install`. `--no-install` skips the install. It refuses a directory with files in it.

## `superwall workspaces update [dir]`

Replaces `vendor/workspace-sdk` with the latest, points `package.json` at it and updates the lockfile. Commit
both. `dev` and `try` say when yours is behind, and never stop you if they can't check.

## What errors mean

| You see                                                    | It means                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `needs a browser login`                                    | You're signed in with an API key. Run `superwall login`.                                                            |
| `POST … 403 … Dev is read-only`                            | A write, or a route the read-only token can't reach. A workspace can only write once saved, which isn't available yet. |
| `Refused GET https://…: dev runs like a draft`             | Outside hosts are off in dev and drafts.                                                                            |
| `… needs projects:read, which superwall.json doesn't declare` | Add it to `scopes`. It answers 403 on the real runtime.                                                           |
| `A slot tied to one app can't run SQL`                     | Use another API, an `org.page@1` or a metric. It answers 403 on the real runtime too.                                |
| `The metric handler didn't answer within 10 seconds`       | The real limit. Query an aggregated table or a narrower window. A cold first query can be slow, so run it again once. |
| `A point's t must be an ISO 8601 date-time`                | ClickHouse returned `2026-10-01 00:00:00`. Replace the space with `T` and add `Z`, as the example does.             |
| `The workspace didn't start … compatibility date is too new` | Your wrangler is older than the platform's date. Run `npm install -D wrangler@latest`.                            |
| `exactly one ES module` or `exports …`                     | A text, data or wasm import, or a named export. Inline it, or export only the default.                              |
| `The analytics query didn't finish`, or a 503 about row policies | A passing failure of the query endpoint. Try again.                                                           |
