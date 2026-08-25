# CLI — dev, push, promote, publish

Git semantics on purpose: **push saves, promote ships.** Every push mints
a sealed version; nothing users see changes until promote points
production at it.

```sh
superwall create                  # scaffold superwall/ inside your app
superwall dev                     # studio on http://localhost:6100
superwall push                    # build + version. Production untouched.
superwall promote                 # point production at the latest push
superwall publish                 # push + promote in one step
superwall publish -m "Q3 test"    # record why
```

The scaffolded package scripts mirror these (`dev`, `push`, `promote`,
`ship`). Auth: `superwall login` once interactively; in CI set
`SUPERWALL_API_KEY` (an `sk_…` key). `dev` needs no login.

## `superwall dev`

Hosts the studio for the project (or several:
`superwall dev examples/*`). Regenerates `superwall.d.ts` first, so route
and product types are always current. `--port/-p` (default 6100, moves to
the next free port), `--host`.

It also prints a `Device` URL with a QR code (the server binds the LAN).
Scanning it on a phone on the same wifi opens `/device`: the studio's
overview labelled "Preview" — same design, search, and live surface
cards — except tapping a card opens the surface as a standalone browser
preview (simulated purchases) instead of the editor. For in-app, on-device rendering through real placements, set
the iOS SDK's `SuperwallOptions.devMode = true` (unreleased; on the SDK's
`develop` branch) — simulators find the dev server on localhost ports
6100–6104 automatically; physical devices also need
`SuperwallOptions.devServerURL` set to the printed Device URL's origin.
The SDK reads `/device/manifest.json` to map each dashboard paywall to
its local surface via `superwall.lock`, activates test mode, and skips
preloading. The host app's Info.plist needs `NSAppTransportSecurity` →
`NSAllowsLocalNetworking` and `NSAllowsArbitraryLoadsInWebContent`.

The `/device` page also has an "Open in app" button. It resolves the app's
URL scheme automatically — the bound application's `apple_url_scheme` on
the dashboard first, then the app's own source (Info.plist,
`app.json`/`app.config.json`, `AndroidManifest.xml`) — and only asks for
one when neither has it. Tapping it fires `<scheme>://?superwall_dev=<dev-server-origin>` —
routed through `Superwall.handleDeepLink`, this opens **the SDK's own
paywall debugger** with the dev server's surfaces in its picker, each
labelled `<id> (local)` and rendered straight from the dev server. No
push and no dashboard record is needed: a local surface is built from
the manifest (its URL plus the products its `config.ts` declares), so
paywalls that have never been pushed preview too. Append
`&superwall_dev_surface=<id>` to open one directly. The debugger's paywall list is searchable and split into
`Local · superwall dev` and `Published` sections — the published list
comes from the downloaded config, so both sources are switchable side by
side without a dashboard preview token.

Project problems (stray files in `app/`, duplicate routes) print as
warnings here — the same ones that block a push, so fix them as they
appear.

## Before pushing: create the products yourself

A push refuses if a `config.ts` names a product the dashboard doesn't have.
**Don't hand that back to the user as a blocker — create them.** The
`superwall` CLI (see the `superwall` skill) writes products directly, so
"the dashboard needs products" is work you can do, not a dependency:

```sh
superwall entitlements list --json                 # grab the NUMERIC entitlement id
superwall products create <identifier> \
  --project <id> --app <id> \
  --name "Annual" --price 39.99 --period year \
  --trial-days 7 --entitlement <numeric-id> --json
```

- `--entitlement` takes the **numeric id** (`55688`), not the identifier
  (`pro`) — the identifier fails with a decode error.
- Pass `--project` explicitly when the account has several, or it errors
  with "Multiple projects found".
- `--price` is major units (39.99); `--period` is `day|week|month|year`;
  `--trial-days` sets the intro offer. `--dry-run` confirms the target first.

Derive identifiers and prices from the design. Where the design shows a
placeholder (`US$XX.xx`), pick an explicit stand-in and say so — never
invent a price silently.

Creating products writes to the user's real dashboard. Doing it is right
when they've asked you to push or to create them; name it in your summary
either way.

Two gates to check before promising a push will work:

- **`headless_paywalls` must be enabled on the application** — otherwise
  every push fails with "Headless paywalls are not enabled for this
  application". It's a server-side flag no CLI can set; the account owner
  has to have it turned on. Check
  `superwall apps list --json` → `features_enabled`.
- **One broken surface blocks the whole push.** A leftover scaffold aimed at
  a nonexistent product stops everything — push what you built with repeated
  `--id` flags instead of touching unrelated directories.

## `superwall push`

Builds every paywall, versions the changed ones, and leaves production
alone. Re-running with nothing changed is a no-op. Flags: `--id <id>`
(limit, repeatable), `--rename <old>=<new>`, `-m <note>`.

A push refuses — before anything is written — when:

- a selected paywall has diagnostics (publishing is immutable; fix first)
- a product in `config.ts` doesn't exist on the dashboard ("Every
  variable on them would be undefined on device")
- a directory rename is unresolved (below)

First push binds each paywall (creating it on Superwall if needed) and
records the binding in `superwall.lock` — commit it. After that, push
always updates the same paywall; no IDs ever appear in your code.

### Renames

Renaming a paywall directory is detected, never guessed. Interactively,
push asks:

```
? `pro-upgrade` is not in superwall.lock. Is it a new paywall, or renamed?
  › Renamed from plus-upgrade   paywall 208540
    Create a new paywall
```

Choosing the rename keeps the live paywall attached to the new directory.
In CI, declare it — anything unresolved stops the push rather than
creating a duplicate:

```sh
superwall push --rename plus-upgrade=pro-upgrade
```

Deleting a paywall directory never blocks a push — the dashboard paywall
keeps serving, and restoring the directory re-binds it.

### Source

Every push also snapshots your `superwall/` source to Superwall, so the
dashboard can show and diff the code each version was built from — and
`-m "why"` records the reason there. `.env`, `node_modules/`, and
gitignored files never leave the machine. If any import reaches outside
the project directory, the push warns and the dashboard disables remote
editing for that paywall (docs: `project-structure`).

## `superwall promote`

Points production at a pushed version. `--id <id>` to limit;
`--version/-v <n>` (with a single `--id`) to pick one — which is also the
**rollback**:

```sh
superwall promote --id plus-upgrade --version 5
# → Rolled back version 7 → 5
```

Promote never rebuilds — it only moves the live pointer.

## `superwall publish`

Push + promote in one step. Also warns about other paywalls that are
pushed-but-not-live, so nothing ships half-forgotten.

## The studio's Push / Publish / Promote buttons

Same operations from the `dev` UI — good for iteration. Prefer the CLI
for shipping: the buttons skip the diagnostics gate and the dashboard
product check, can't resolve renames, and take no `-m` note.

## Troubleshooting

| Message | Fix |
| --- | --- |
| `Not a superwall project` | Run inside the app (or `superwall/`); the project's `package.json` must depend on `superwall` |
| `…package.json is named "superwall"` | Rename the package — that name shadows the framework |
| `No superwall framework found` | `bun add superwall` (or npm) inside the project |
| `These N products do not exist on Superwall` | Create them with `superwall products create` (above) — don't just report it — or fix the identifiers in `config.ts` |
| `Headless paywalls are not enabled for this application` | Server-side feature flag; the account owner must have `headless_paywalls` enabled. Nothing in the CLI can set it |
| `Multiple projects found. Pass --project <id>.` | Add `--project <id>` (and usually `--app <id>`) to the resource command |
| Diagnostics block the push | The message names each stray file and where it belongs |
| Rename ambiguity in CI | Add the printed `--rename old=new` |
| `paywall x has never been pushed` (promote) | Push first |
| `superwall publish requires git` | Install git — the source snapshot is part of every publish |
| Not signed in | `superwall login`, or `SUPERWALL_API_KEY` in CI |
