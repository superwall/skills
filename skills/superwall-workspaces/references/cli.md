# The commands

## `superwall workspaces dev [dir]`

| Flag                         | What it fills in                                                   |
| ---------------------------- | ------------------------------------------------------------------ |
| `--port`, `-p`               | The dev page's port, 8790 by default. The frame takes the next one. |
| `--org`, `--app`             | The organization, which is all its token reaches, and the app. `--app` alone finds the organization. |
| `--campaign`, `--audience`, `--variant` | A campaign tab's or readout's context. `--variant` repeats. |
| `--user`, `--alias`          | A user panel's or action's context. `--alias` repeats.              |
| `--environment`              | `PRODUCTION` or `SANDBOX`, in capitals.                                          |
| `--from`, `--to`             | A date range, ISO 8601. The last 30 days by default.                |
| `--context`                  | The whole context as JSON, for a slot this CLI doesn't know.        |

The page lets you change all of these but the organization. To use another one, restart `dev` with its `--org`.
Without a browser, use its own API on the dev page's origin. A POST needs
that origin in an `Origin` header. It answers JSON, with `error` on a 400:

```bash
curl -X POST localhost:8790/__dev/metric -H 'origin: http://localhost:8790' -H 'content-type: application/json' -d '{
  "entrypoint": "transactions",
  "input": { "applicationId": "42" },
  "from": "2026-10-01T00:00:00Z", "to": "2026-10-08T00:00:00Z",
  "interval": "day", "breakdown": "store", "filters": { "store": ["APP_STORE"] }
}'

curl -X POST localhost:8790/__dev/readout -H 'origin: http://localhost:8790' -H 'content-type: application/json' -d '{
  "entrypoint": "lift",
  "input": { "applicationId": "42", "campaignId": "7", "audienceId": "8", "variantIds": ["9", "10"] }
}'
```

### How `dev` differs from the real runtime

The same: workerd, a worker loader with the platform's modules, the bundle's own compatibility date and flags, no bindings, the same
bundling step, handlers called over RPC, the same checks on what a handler returns and how long it takes, no
`caches`, no outside hosts, no raw sockets, the same response headers and content security policy, a frame on
its own origin that really goes through the bridge, and which routes a slot can reach.

Different, so run `try` before believing these:

- **Scopes.** `dev` uses a read-only token as you, limited to one organization, for an hour at a time. It makes a new
  one when that runs out. A staff account gets the same limit, so it reaches only that organization, and `dev` no
  longer reads across every organization. It warns when a known route's scope isn't declared, and still answers. A
  draft holds only the manifest's read scopes, and answers 403. Against an API that hasn't deployed limited tokens,
  `dev` warns that its token reaches everything you can read.
- **App narrowing.** `dev` refuses the same routes the runtime does, for the slot's narrowing, with the same 403:
  "Workspaces may not call this endpoint." It doesn't narrow data: on a route the slot can reach, the real runtime
  holds it to one app, and `dev` lets it read another app in the organization. So don't rely on `dev` to catch an id
  from the wrong app.
- **Frames** have one session per dev server, so two tabs of it share the last one opened. The local dashboard is
  a stand-in, and its theme tokens are close to the real ones, not the same.
- **Limits.** CPU and subrequest limits don't apply locally.
- **The bundle** uses your project's wrangler and the esbuild it brings, and the builder uses its own pinned ones.
  `client.entry` needs that esbuild to be the builder's version, so keep wrangler where the starter pins it. Both
  ignore `.env`, `.wrangler/deploy/config.json` and your shell's `CLOUDFLARE_ENV`, and both refuse the same things,
  so a config or an import the builder would fail stops `dev` and `try` first. A bundle runs on the `compatibility_date`
  and flags in its wrangler config, in `dev` as on the platform. The date must be from 2024-09-23 to today, and the
  only flags allowed are `nodejs_compat`, `nodejs_compat_v2` and `nodejs_als`.
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
both. If yours is newer than the latest published one, it says so and leaves it unless you pass `--force`. `dev` and `try` say when yours is behind, and never stop you if they can't check.

## `superwall workspaces push [dir]`

`--org` (on the first push), `-m <note>`, `--overwrite-source`, `--accept-merged-commits`, `--json`. The first push creates the workspace from
the manifest's name, or reuses the one with that slug. It waits for the build, up to 20 minutes, and a build that
fails or outlasts that exits 1. `--json` gives `version_id`, `status`, `failure`, `steps` and `url` either way, and `visible_to` (`you`, `its_author`, `nobody` or `everyone`) when it builds. The link it prints opens the page: for a workspace with an `app.page@1` and no `org.page@1`, that's the page in the first app, and `open <entrypoint> --app <id>` opens it in another.

If a teammate changed the same files, it stops and says to run `pull`. `--overwrite-source` replaces the whole
source repo with this project, so use it only when you mean to discard what's there.

**A pusher's own copy can include teammates' code.** When the source repo has commits this project doesn't,
`push` merges them, and the version runs them with the pusher's reads. So it lists them and asks: "Your copy
will run commits from <names> with your reads." Without a terminal it pushes nothing, exits 1 and, with `--json`,
gives `reason: "needs_accept_merged_commits"` and `merged_commits`. Don't add `--accept-merged-commits` to get past
this. Read the commits first with `pull`, or ask the person to confirm. This applies to any commit it hasn't seen,
even one under your own name, because a commit's author is whatever its pusher set. It also applies to a push with
no changes of your own, whose build would be their commit. It asks once per commit.

A build can wait or stop for reasons that aren't your code:

- **An organization runs three builds at once.** `push` says so and keeps trying on its own, for up to 20 minutes, with nothing to push again.
- **A workspace can have 100 new versions a day.** `push` stops and says trying soon won't help. Your source is already pushed, so push again later.
- **A failure code of `busy` or `unavailable`** means no build machine was free or the platform failed. Run `push` again in a few minutes, and it retries the same version.

**Who can do what.** `EDITOR` and `USER` can push. Approving and installing need `OWNER` or `ADMIN`. A member with access to only some projects can't build or approve, because a workspace reaches every project, and the command shows why.

## `superwall workspaces pull [dir]`

Merges teammates' pushes into this project. `--theirs` takes the source repo's version of files you both changed.
`--workspace <id>` fills an empty folder with a workspace's source. The next `push` won't ask about what you pulled,
so read it first: your own copy runs all of it with your reads.

## `status`, `logs`, `share`, `list`, `open`

`status` shows the state, the latest three versions and the live one, and `--all` lists them all. `logs [version]` prints the last 128 KiB of a build's log once it has
finished. `share [version]` marks the latest built version for review. Nobody is told automatically, so for someone
who can't approve it, it names who can, when their role can see that. `list --org` lists an organization's
workspaces. `open` prints the dashboard link and opens it at a terminal; `open <entrypoint> --app <id>` opens one
entrypoint inside an app.

Each takes `--workspace <id>` (or a slug with `--org`), and otherwise reads this project's `superwall.workspace.json`.

## `superwall workspaces approve [version]` (admins)

Shows what the version can do and how it differs from what's granted, then asks. **Never run it with flags before
a person has read that.** Without a terminal it needs `--yes`, and `--accept-changes` too when scopes, hosts,
secrets, entrypoints, crons, events, storage or the bundle's compatibility date and flags change. `--json` with neither approves nothing, prints `manifest`
and `diff`, and exits 1, so run that first and show the person the result.

## `superwall workspaces install [entrypoint]` (admins)

With no entrypoint, lists what's installed. Otherwise installs it from the live version for the whole organization,
or one app with `--app`. `--disable` turns it off and keeps its row, `--remove` deletes the row and ends open
sessions (`--yes` without a terminal), and `--position` orders entrypoints in a slot. Every slot but `org.page@1`
shows only where it's installed and enabled.

## What errors mean

| You see                                                    | It means                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `needs a browser login`                                    | You're signed in with an API key. Run `superwall login`.                                                            |
| `POSTs here need the header Origin`                        | You called the dev page's API without its `Origin` header. Add it, as in the examples above.                         |
| `… 403 … Dev's token is read-only`                         | A write, or a route outside what a workspace can read, like `/v2/me`. The real runtime refuses it too.               |
| `You can't mint an Agent Token for organization …`         | You aren't a member of it, or your access ended. Check `--org`.                                                      |
| `This dev is running against organization …`               | Its token reaches that one only. Restart `dev` with `--org`.                                                         |
| `This would fail on the builder. …`                        | Your wrangler config has something a workspace can't use: `vars`, a binding, `site`, an `env` section, a build command or a key the builder doesn't know. A workspace needs `name`, `main` and `compatibility_date`, and little else. The date and flags have limits too. |
| `The bundle reads files outside the repo …`                | An import, or a link, reaches past the repo or into `.git`. Move the file into the repo.                              |
| `client.entry: … is not in the repo`                       | The path in `superwall.json` is wrong.                                                                               |
| `src/client.tsx:3:14: …`                                   | esbuild's error in your browser code. The builder would say the same.                                                |
| `Could not resolve "@superwall/workspace-sdk/client-bundle"` | The Worker imports the bundle and `superwall.json` has no `client`.                                                |
| `The client bundle is … bytes`                             | Over 8 MiB. It lists the largest files.                                                                              |
| `This project's workspace SDK is too old for client.entry` | Run `superwall workspaces update`, then `npm install`.                                                               |
| `bundled with esbuild 0.28.2, not …`                       | This project's wrangler brings another esbuild. Install the wrangler the starter pins.                               |
| `Refused GET https://…: dev runs like a draft`             | Outside hosts are off in dev and drafts.                                                                            |
| `Someone else pushed changes to …`                         | A teammate changed the same files. Run `superwall workspaces pull`, then push again.                                |
| `The build failed at …`                                    | The builder's own words. `superwall workspaces logs` has the rest. A new push, or the same commit again, retries.    |
| `Your copy would run commits from …`                       | `push` would merge teammates' commits into your own copy. Run `pull` to read them, then push.                         |
| `Only organization owners and admins can …`                | Your role can't do this. `share` says who can, when your role can see that.                                           |
| `Building a workspace needs access to all projects`        | An owner or admin has to change your project access.                                                                 |
| `… builds running`                                         | Your organization's three builds are taken. `push` waits and retries on its own.                                     |
| `… pushes in the last day`                                 | The daily limit. Trying soon won't help.                                                                              |
| `All the build machines are busy` or `… usually temporary` | Not your code. Run `push` again in a few minutes.                                                                     |
| `Nothing was approved …`                                   | `approve` needs a person, or `--yes`, plus `--accept-changes` when what it can do changes.                           |
| `… needs projects:read, which superwall.json doesn't declare` | Add it to `scopes`. It answers 403 on the real runtime.                                                           |
| `Workspaces may not call this endpoint.`                   | The route isn't open to workspaces, or to this slot. A slot tied to one app can't reach `/v2/projects` or SQL, on the real runtime too. Use its app's routes, an `org.page@1` or a metric. |
| `The environment must be PRODUCTION or SANDBOX`            | In capitals, in `--environment`, `--context` and dev's page API.                                                     |
| `The metric handler didn't answer within 10 seconds`       | The real limit. Query an aggregated table or a narrower window. A cold first query can be slow, so run it again once. |
| `A point's t must be an ISO 8601 date-time`                | ClickHouse returned `2026-10-01 00:00:00`. Replace the space with `T` and add `Z`, as the example does.             |
| `Port … is already in use`                                 | Something else has that port. Pick another with `--port`; dev takes the one after it too.                            |
| `The workspace didn't start … compatibility date is too new` | Your wrangler is older than the platform's date. Run `npm install -D wrangler@latest`.                            |
| `exactly one ES module` or `exports …`                     | A text, data or wasm import, or a named export. Inline it, or export only the default.                              |
| `The analytics query didn't finish`, or a 503 about row policies | A passing failure of the query endpoint. Try again.                                                           |
