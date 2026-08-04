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

Project problems (stray files in `app/`, duplicate routes) print as
warnings here — the same ones that block a push, so fix them as they
appear.

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
editing for that paywall ([project.md](project.md)).

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
| `These N products do not exist on Superwall` | Create them in the dashboard or fix the identifiers in `config.ts` |
| Diagnostics block the push | The message names each stray file and where it belongs |
| Rename ambiguity in CI | Add the printed `--rename old=new` |
| `paywall x has never been pushed` (promote) | Push first |
| `superwall publish requires git` | Install git — the source snapshot is part of every publish |
| Not signed in | `superwall login`, or `SUPERWALL_API_KEY` in CI |
