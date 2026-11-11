# CLI — dev, push, promote, publish, pull

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
superwall pull                    # merge teammates' work from the app's source repo
superwall pull --app <id>         # get an app's paywalls into an empty folder
```

The scaffolded package scripts mirror these (`dev`, `push`, `promote`,
`ship`). Auth: `superwall login` once interactively; in CI set
`SUPERWALL_API_KEY`, which is only ever the organization's secret key
(`sk_…`), never an app's public `pk_…` key. `dev` needs no login.

## `superwall create`

Inside an app that already has a `superwall/` project (or inside the
project), `create` adds a paywall to it — a starter named as the user
answers (`-y` takes "Pro", ids stay unique), or the rebuilt dashboard
paywall with `--from` — and touches nothing else; `--example` and `--app`
are for new projects only.

`--example <name>` starts from a public example. `--app <id>` connects that
Superwall app instead of detecting one from the SDK key or asking — the
dashboard's **Copy Prompt** button hands you this form, so use the id it
gives rather than picking; it fails if the id isn't in the account, and it
cannot be combined with `--no-connect`. `--yes` accepts the defaults,
`--no-install` skips dependencies, and `--no-git` skips the git step:
outside a git repository `create` otherwise runs `git init` and commits
the scaffold along with everything else in the folder. Pass `--no-git`
whenever the user or the repository's rules forbid committing on your own.

`--from <paywall-id>` rebuilds a dashboard (visual editor) paywall as
code: it scaffolds `paywalls/<slug>/config.ts` from the paywall's
products, presentation, settings, background and locales, writes
`paywalls/<slug>/MIGRATION.md` (source URL, screenshot, product table,
inventory of pages / actions / product variables), records the source in
`superwall.lock` under `origins` (which is what puts **Compare ›
Original** in the studio), and connects the paywall's app. Needs a login;
refuses `--example`, `--no-connect`, and a paywall that is already code.
The rebuild itself is
[migrate-from-editor.md](migrate-from-editor.md). After the scaffold the
CLI asks whether to run the rebuild headless with the user's agent, copy
the prompt, or stop; `superwall migrate <paywall-id>` asks the same later
(and scaffolds first if needed), `--skill` prints the prompt.
`superwall migrate <paywall-id> --dry-run` reads the paywall and its
served document, runs the same refusals, prints the `paywalls/<slug>` it
would create and the paywall and app ids it would save in `superwall.lock`,
and ends with "Dry run - no changes made." It writes no files and skips
the agent / copy / stop choice and the studio; it still needs a login, and
fails like the real run when the paywall has no served document. When *you*
are the agent driving it, read the playbook and do the inventory step with
the user rather than running the headless path.

## `superwall migrate --screen <path>`

Rebuilds a native screen — SwiftUI or UIKit (`.swift`), Jetpack Compose or
Android Views (`.kt`), React Native (`.tsx`), Flutter (`.dart`) — as a surface. The scan writes
`paywalls/<slug>/config.ts` (name, product slots from any store ids in the
source), a `MIGRATION.md` brief (strings, assets, links, actions mapped to
hooks, the placement to register) and an `origins` entry in
`superwall.lock`, then offers the same agent / copy / stop choice. No
path: it lists likely screens in the app and asks. `--screenshot <file>`
saves the original for **Compare › Original**; with a booted iOS simulator
it offers to capture one. `--skill` prints the prompt. `--dry-run` reads
the screen, runs the same refusals, prints the `paywalls/<slug>` it would
create and ends with "Dry run - no changes made." It writes no files and
skips the screenshot prompt, the agent / copy / stop choice and the
studio. When the screen is already scaffolded, either dry run says so and
stops. The rebuild and the
wiring are [migrate-from-native.md](migrate-from-native.md).

## `superwall dev`

Hosts the studio for the project (or several:
`superwall dev examples/*`). Regenerates `superwall.d.ts` first, so route
and product types are always current. `--port/-p` (default 6100, moves to
the next free port), `--host` (default `0.0.0.0`).

It prints a **Device** URL and QR beside the studio one, for opening the
paywalls on a phone on the same wifi. If the app's App Transport Security
would block a plain-`http` dev server it offers to add the two `Info.plist`
keys — development builds only, and the SDK refuses a dev server outside a
sandbox build anyway, so they are pointless in a release.

Three consequences for you, not the user:

- **A preview asks a human for every outcome** — purchase, restore,
  permission, callback. Nothing resolves on its own, so never claim a
  purchase flow is verified from `superwall dev`; ask the user to click, or
  verify on a pushed URL.
- **A screenshot needs a promoted version.** The studio's download button
  captures the published document, so it stays disabled until `promote` has
  made one live — a push alone is not enough. Never tell a user to expect a
  screenshot of a paywall nobody has promoted. What it saves is the
  1290 x 2796 render, the App Store size Apple takes for a product page and
  for subscription review attachments, so it uploads without resizing.
- **It previews; only chat edits.** The dashboard hosts the same studio for a
  code-first paywall (its live snapshot plus every pushed version), at
  `https://app.superwall.com/{orgId}/{applicationId}/paywalls/{paywallId}/studio`. Nothing
  there is point-and-click editable, so never tell the user to drag a headless
  paywall into shape — changes ship through `push`/`promote`/`publish`. Its
  **Chat** panel is the one exception: it edits the source in a sandbox and
  commits to the branch `studio/<paywallId>` of the same source repo a push
  writes to, publishing through the ordinary pipeline. One workspace per
  paywall, shared by every thread and teammate, one turn at a time; its
  preview is a `superwall build` snapshot taken when a turn ends, not a live
  server. So edits may have arrived that a local checkout has never seen —
  `main` carries the source commit of the last published version; run
  `superwall pull` to bring them into the local project.

The mechanism behind both (the envelope, the `ping` reply, hosting a paywall
yourself) is `curl -sL superwall.com/docs/framework/host-protocol.md`.

Scanning the Device QR on a phone on the same wifi opens `/device`: the studio's
overview labelled "Preview" — same design, search, and live surface
cards — and tapping a card opens the hosted editor for that surface, as
on a desktop. For in-app, on-device rendering through real placements, set
the iOS SDK's `SuperwallOptions.devServer` (`.default` reaches a simulator;
iOS SDK ≥ 4.17.0) — simulators find the dev server on localhost ports
6100–6104 automatically; physical devices also need
`SuperwallOptions.devServer = .url(<the printed Device URL's origin>)`.
The SDK reads `/device/manifest.json` to map each dashboard paywall to
its local surface via `superwall.lock`, activates test mode, and skips
preloading. Each manifest surface also carries the settings block
`superwall push` stamps (`presentation_style`, `feature_gating`,
`on_device_cache`, `scroll_enabled`, `game_controller_enabled`,
`web_checkout_destination`, background hexes), computed by the same
`paywallSettingsOf` the push uses, so a `config.ts` change to presentation
or background shows on device without a push. An SDK that predates the
block, and the Android SDK, ignore it and keep the last promoted values —
so a `drawer` that presents fullscreen on device is an SDK-version
question, not a config one. The host app's Info.plist needs `NSAppTransportSecurity` →
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
superwall entitlements create --identifier pro --app <id> --json   # skip if it exists
superwall products create --identifier <identifier> \
  --app <id|dashboard link> \
  --name "Annual" --price 39.99 --period year \
  --trial-days 7 --entitlement pro --json
```

- `--entitlement` takes the entitlement's identifier (`pro`) or id. Pass
  the same `--app` to both commands: a product only grants entitlements on
  its own app, and a mismatch is refused with the fix in the message.
- CLI 2.2.1 and older take only the numeric id from
  `superwall entitlements list --json`; run `superwall upgrade` once a
  newer CLI is out.
- Pass `--app <id|dashboard link>` (or `--project <id>`) when the account
  has several projects, or it stops with "You can open N projects" and
  lists them.
- `--price` is major units (39.99); `--period` is `day|week|month|year`;
  `--trial-days` sets the intro offer. `--dry-run` confirms the target first.

Derive identifiers and prices from the design. Where the design shows a
placeholder (`US$XX.xx`), pick an explicit stand-in and say so — never
invent a price silently.

Creating products writes to the user's real dashboard. Doing it is right
when they've asked you to push or to create them; name it in your summary
either way.

One more gate to check before promising a push will work:

- **One broken surface blocks the whole push.** A leftover scaffold aimed at
  a nonexistent product stops everything — push what you built with repeated
  `--id` flags instead of touching unrelated directories.

## `superwall build`

Builds paywalls into the single-file HTML document a push would version and
stops: no network, no login. Writes
`superwall/.superwall/build/<kind>/<id>/[<platform>/]index.html`; `--id`,
`--platform <ios|android|web>` (without it, one platform-neutral document),
`--out <dir>`, `--json` (`{ "builds": [{ kind, id, platform, file, bytes,
snapshotId }] }`). Diagnostics warn, they do not block. Assets over 32 kB are
referenced from the app's asset host when the paywall is bound for that
platform in `superwall.lock` — they are uploaded by `push`, so a new large
asset is missing from a build until the next push — and inlined otherwise.
The hosted studio's chat runs this at the end of every turn for its preview.

## `superwall push`

Builds every paywall, versions the changed ones, and leaves production
alone. Re-running with nothing changed is a no-op. Flags: `--id <id>`
(limit, repeatable), `--platform <p>` (repeatable or comma-separated; limits the platforms),
`--rename <old>=<new>`, `-m <note>`, `--overwrite-source` (replaces only the
pushed paywalls' source — below; `publish` takes it too).

A push refuses — before anything is written — when:

- a selected paywall has diagnostics (publishing is immutable; fix first)
- a product in `config.ts` doesn't exist on the dashboard ("Every
  variable on them would be undefined on device")
- a directory rename is unresolved (below)
- the project pushes to several platforms and a selected paywall has no
  `platforms` field (below)

First push binds each paywall (creating it on Superwall if needed) and
records the binding in `superwall.lock`, per platform — commit it. After
that, push always updates the same paywalls; no IDs ever appear in your code.
An existing headless paywall with the same id that the lock doesn't bind is
never taken over on a name alone: interactively push asks, otherwise it
stops and prints the lock line to add if the paywall is this project's.
Never add that line without the user confirming the paywall is theirs;
renaming the directory creates a new one instead.

### Several platforms

A project can push to several platforms — apps in the same Superwall
project (iOS + Android + web). `superwall.lock` binds one app per platform
under `apps`:

```json
{
  "version": 1,
  "apps": { "ios": "1001", "android": "1002", "web": "1003" },
  "paywalls": {
    "plus-upgrade": { "ios": { "paywallId": "2001" }, "android": { "paywallId": "2002" } },
    "web-upgrade": { "web": { "paywallId": "2003" } }
  },
  "funnels": {},
  "sources": { "…": "<commit sha>" }
}
```

`sources` is the commit each app's source repo was last synced to (see
Source, below). Never edit it.

Each paywall says which platforms it ships to in `config.ts` — a typed
array of `ios | android | web`:

```ts
export default definePaywall({ platforms: ["ios", "android"], products: { … } }); // shared
export default definePaywall({ platforms: ["web"], checkout: "sheet", products: { … } }); // web only
```

- One directory, one dashboard paywall **per platform**, each with its own
  versions; push output labels them `plus-upgrade · ios`.
- `platforms` is optional while the project is on one platform;
  **required once it has more** — push stops on a silent paywall instead of
  guessing. Annotate every existing paywall when you add a second platform.
  No project-wide default exists; to mirror a set everywhere, spread a
  shared constant (`{ platforms: ["ios", "android", "web"] } as const`).
- A new platform binds its app on the first push: automatic when the
  account has exactly one app of it, a prompt when it has several, an
  error when it has none. In CI, either bind once interactively or add
  `"web": "<app id>"` under `apps` yourself (`superwall apps list --json`
  for ids) — the one hand edit the lock invites.
- `--platform <p>` (or a bound app id) narrows push/promote/publish;
  `promote --version` needs it when the paywall is on several platforms.
- Store products differ per store, so a shared slot takes one id per
  platform: `annual: { ios: "pro_year", android: "pro_year_play", web:
  "live:price_…:trial" }` — `purchase("annual")` is unchanged; each
  platform's build resolves the slot to its own id (the map is rewritten
  out of the bundle) and its version carries the matching store (Play for
  android), so an Android build never names an App Store product. A
  per-platform slot must name every platform in `platforms` (push error:
  `` `annual` has no product id for web ``). The dashboard product check
  runs per platform, so create the Play product too.
- An App Store product can offer Apple's monthly plan (a 12-month
  commitment billed monthly) next to the year paid up front. A slot picks
  which one it sells with `billingPlan: "monthly" | "upFront"`, on a slot
  object or a per-platform slot:
  `annual: { productId: "pro_annual", billingPlan: "upFront" }` or
  `annual: { ios: "pro_annual", android: "pro_annual_play", billingPlan:
  "upFront" }`. Omitted, it is `"monthly"` for a product that offers the
  monthly plan and has no effect on one that does not. To offer both plans
  side by side, use two slots on the same product:
  `annual: { productId: "pro_annual", billingPlan: "upFront" },
  annualMonthly: { productId: "pro_annual", billingPlan: "monthly" }`.
  iOS / App Store only: Android and web have no such plan and ignore it,
  and Play, Stripe and custom slots never carry it. `superwall push` sends
  the plan with each version, and changing only `billingPlan` pushes a new
  version. An unknown value fails the build (`` paywalls/<id>: `annual`
  billingPlan must be one of "monthly", "upFront", got "upfront". ``).

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

### Paywall settings ship with the version

Presentation style (`presentation: { style: "drawer", drawer: { height,
cornerRadius } }`), `featureGating`, `onDeviceCacheEnabled`,
`scrollEnabled`, `gameControllerEnabled`, plus `checkout` (as the web
checkout destination) and `background`, are read from `config.ts` at build
time, stored on the pushed version, and applied to the paywall on promote. A
headless paywall has no dashboard editor, so never tell the user to change
these in the dashboard; edit the config and push. Omitted keys reset to the
defaults (fullscreen, non-gated, cached, scrolling, no controller) on the
next promote.

### Source

Every push also saves the `superwall/` source to the app's source repo on
Superwall, so the dashboard can show and diff the code each version was
built from — and `-m "why"` records the reason there.

- **A push writes only its own paywall.** The repo is shared by everyone
  who pushes to the app. A push of paywall `a` writes `paywalls/a/`, the
  shared files outside every paywall and funnel directory (`package.json`,
  components, config), and `a`'s own entries in `superwall.lock`. Every
  other paywall and funnel stays as the repo has it — even from a checkout
  with no sync point, and even if the local copy of another paywall is
  stale or missing. `superwall.lock` merges entry by entry; `superwall.d.ts`
  takes this project's copy.
- **Teammates' work is kept.** With a sync point (the commit
  `superwall.lock` records under `sources` — commit the lock), a push
  merges this project's changes on top of whatever others published since.
  It stops and names only the conflicting files rather than overwrite:
  `Someone else published changes to …` (a teammate changed the same file),
  or, with no sync point, `The source repo differs from this project in …`
  (the push would change an existing file in this paywall or a shared
  file). Files the repo doesn't have yet never block. Both say to run
  `superwall pull` (below), then publish again.
- **`--overwrite-source` replaces only the pushed paywall's source** (its
  directory, the shared files and its lock entries); teammates' other
  paywalls stay. It still discards a teammate's edits to that paywall, so
  it is the user's decision, never a fix you reach for on your own —
  reach for `superwall pull` first.
- **No version ships without its source.** A version whose source didn't
  land is recorded in `superwall.lock` (`sourcePending`); the next push
  finishes its source before anything else, `promote` refuses it (`version
  N has no source yet`), and `publish` finishes the source before
  promoting.
- **What never leaves the machine:** `.env*`, `node_modules/`,
  `.superwall/`, `.git/`, key and credential files (`*.p8`, `*.p12`,
  `*.pem`, `*.key`, keystores, `.npmrc`, `.netrc`, `google-services.json`,
  `GoogleService-Info.plist`), and gitignored files. A source tree over
  250 MB stops the push before any version exists, naming the largest
  files.
- **Git is required.** Without it nothing is created.

If any import reaches outside the project directory, the push warns and
the dashboard disables remote editing for that paywall (docs:
`project-structure`).

## `superwall promote`

Points production at a pushed version. `--id <id>` to limit;
`--version/-v <n>` (with a single `--id`) to pick one — which is also the
**rollback**:

```sh
superwall promote --id plus-upgrade --version 5
# → Rolled back version 7 → 5
superwall promote --id plus-upgrade --platform ios --version 5   # on several platforms
```

Promote never rebuilds — it only moves the live pointer.

## `superwall publish`

Push + promote in one step. Also warns about other paywalls that are
pushed-but-not-live, so nothing ships half-forgotten.

## The studio link after shipping

None of `push`, `promote` or `publish` prints a dashboard link, so end each
with the paywall's studio link yourself:

```
https://app.superwall.com/{orgId}/{applicationId}/paywalls/{paywallId}/studio
```

`applicationId` and `paywallId` are in `superwall.lock`
(`apps.<platform>`, `paywalls.<name>.<platform>.paywallId`); `orgId` is
`organization_id` of the project holding the app in `GET /v2/projects`.
On several platforms, give one link per platform. A paywall never pushed
has no studio page yet; the builder for a new one is
`…/paywalls/new/studio`. Never give a code-first paywall the legacy
`superwall.com/editor/#/…` link.

## `superwall pull`

Merges the app's source repo into this project: teammates' paywalls and
shared files, their `superwall.lock` bindings, and the sync point the next
push merges from. Run it inside a project; it pulls the repo of every app
`superwall.lock` binds (`--platform <p>` limits it to those platforms).

- **Local edits stay.** Uncommitted changes in the project are merged with
  the repo's, and only the files that changed are written.
- **A conflict changes nothing.** If both sides changed a file (with no
  sync point: any file both have with different content), it stops:
  `Your project and the source repo both changed …, so nothing was
  pulled`. `superwall pull --theirs` takes the repo's whole copy of those
  files — the local edits to them are lost, so copy them aside first if
  the user wants to keep them. Never add `--theirs` on your own.
- **Bindings:** the repo's lock entries are taken only for platforms this
  project binds to the same app (or doesn't bind yet); a platform bound to
  a different app keeps its local bindings.
- **No source-less version ships.** A local version whose source never
  landed stays `sourcePending`, so `promote` still refuses it until a push
  finishes its source.
- **Safety:** a gitignored local file is never overwritten (it is listed
  as left alone), and a symlink or `..` in a path refuses the whole pull.

With no project, `superwall pull --app <id|name|dashboard link> [dir]`
clones the app's source into an empty `<dir>/superwall/` (default: the
current directory), with its `superwall.lock` bindings, `superwall.d.ts`
and sync point — the way to work on an app's paywalls without its codebase
or GitHub. It installs nothing; it prints the next step, `cd superwall &&
<manager> install && <dev>`. It refuses a directory that is already a
superwall project (run `superwall pull` there instead) or one that already
has files, and an app with no code paywall or an empty source repo (start
one with `superwall create --app <id>`).

## The studio's Push / Publish / Promote buttons

Same operations from the `dev` UI — good for iteration. Prefer the CLI
for shipping: the buttons skip the diagnostics gate and the dashboard
product check, can't resolve renames, and take no `-m` note.

**Promote** defaults to the latest push (no version sent, so a
multi-platform paywall promotes each app's own latest). A version picker
at the start of the button group lists every pushed version; picking one
older than the live version turns the button into **Roll back** and sends
that version — one paywall only, so on several platforms the studio
points you at `superwall promote --platform … --version N`. The live
version is marked and cannot be promoted onto itself.

The dashboard's hosted studio offers the same button and nothing else
(no project on disk, so no push): the same picker switches the preview and the target,
and the button reads Promote or Roll back by where that version sits
against the live one. It is the `POST /v2/paywalls/:id/promote` call
`superwall promote --version` makes.

The studio's **Compare** menu lists every pushed version of the paywall
(the live one marked) plus the project's other paywalls, and splits the
stage between the chosen one and the local build. It needs a login and a
bound paywall; when the versions can't be read, the menu says why rather
than listing none.

## Troubleshooting

| Message | Fix |
| --- | --- |
| `Not a superwall project` | Run inside the app (or `superwall/`); the project's `package.json` must depend on `superwall` |
| `…package.json is named "superwall"` | Rename the package — that name shadows the framework |
| `No superwall framework found` | `bun add superwall` (or npm) inside the project |
| `These N products do not exist on Superwall` | Create them with `superwall products create` (above) — don't just report it — or fix the identifiers in `config.ts` |
| `Superwall for Agents is in private beta and isn't enabled for this app yet` | Enabled per app on Superwall's side; contact support@superwall.com. Nothing in the CLI can set it |
| `You can open N projects - pass --app <id\|dashboard link> or --project <id>` | Add `--app <id\|dashboard link>` to the resource command |
| `App <id> already has a paywall … that superwall.lock doesn't bind` | Ask the user whether it's this project's; if so add the printed line under `paywalls`, if not rename the directory |
| Diagnostics block the push | The message names each stray file and where it belongs |
| Rename ambiguity in CI | Add the printed `--rename old=new` |
| `x doesn't say which platforms it's for` | The project pushes to several platforms — add `platforms: [...]` to that `config.ts` |
| `Several iOS apps in your account` / `no Web app to bind` | Run push interactively once, add `"web": "<app id>"` under `apps` in `superwall.lock`, or `superwall apps create --name <name> --platform web` |
| `This project has no app for "…"` | `--platform` takes a platform bound in `superwall.lock` (or that app's id); the message lists them |
| `paywall x has never been pushed` (promote) | Push first |
| `superwall publish requires git` | Install git — the source snapshot is part of every publish |
| `… version N has no source yet` (promote) | Run `superwall push` to finish that version's source, then promote |
| `Someone else published changes to …` | Run `superwall pull`, then publish again; `--overwrite-source` (this paywall only) only on the user's say-so |
| `The source repo differs from this project in …` | Run `superwall pull`, then publish again; `--overwrite-source` (this paywall only) only on the user's say-so |
| `Your project and the source repo both changed …, so nothing was pulled` | Ask the user which copy wins; to take the repo's, copy their edits aside if wanted, then `superwall pull --theirs` |
| `… already has files — pull --app only fills an empty folder` | Pick an empty directory, or run `superwall pull` inside the existing project without `--app` |
| `App … has no code paywall on Superwall yet` / `source repo is empty` (pull) | Nothing to pull — start one with `superwall create --app <id>` |
| `The source in … is N MB, over the 250 MB limit` | Gitignore what doesn't belong in the source, push again |
| Not signed in | `superwall login`, or `SUPERWALL_API_KEY` in CI |
