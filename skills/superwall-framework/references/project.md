# Project structure

Everything Superwall-related in an app lives in a `superwall/` directory
(or the repo root for a dedicated repo). It is a self-contained npm
project — clone, install, `superwall dev` — so the host app needs no npm
setup of its own.

## Start a project

```bash
superwall create                        # scaffold superwall/ inside the current app
superwall create --example multi-page   # start from an example instead
```

`create` writes the whole skeleton, connects your Superwall app, installs
dependencies, and git-inits if needed. Every example is a complete project
— copy one anywhere and it runs.

## Layout

```
superwall/
├── package.json          depends on `superwall`, react, react-dom
├── tsconfig.json
├── superwall.d.ts        generated — commit, never edit
├── superwall.lock        bindings — commit
├── .gitignore
├── components/           shared components
├── messages/             shared string catalogs (en.ts, de.ts, …)
├── assets/               shared assets
├── paywalls/<id>/        one directory per paywall
│   ├── config.ts         REQUIRED — definePaywall({ name, products })
│   ├── app/              routes — index.tsx (required), layout.tsx, more pages
│   ├── components/       this paywall's own components
│   ├── messages/         this paywall's own strings
│   └── assets/           this paywall's own assets
└── funnels/<id>/         same shape, for funnels
```

`components/`, `messages/`, and `assets/` work at both levels: shared at
the root, local inside a surface. `@/…` imports resolve from the
`superwall/` root (`import { Button } from "@/components/Button"`).

## The rules

- **`app/` holds routes and nothing else.** Every `.tsx` there is a route
  (lowercase-kebab filename + default-exported component); `layout.tsx` at
  the top level is the one reserved name; stylesheets may sit beside
  routes. Put anything else in `components/` — a stray file is a warning
  in dev and blocks a push.
- **Every paywall starts at `app/index.tsx`** and must have a `config.ts`.
- **The directory name is the identifier** — lowercase-kebab, used for the
  URL in dev and the binding on push. `config.ts`'s `name` is the human
  label in the dashboard.
- **No build tooling in the project.** No vite config, no `index.html`, no
  entry point — the framework owns all of it.
- **Never name the package `"superwall"`** in `package.json` — that would
  shadow the framework import. `create` names it after your app.
- Commands work from the app root or inside `superwall/` alike; a global
  `superwall` always defers to the project's own installed version.

## Two files the CLI manages — commit both

**`superwall.d.ts`** — regenerated on every `dev` and `push`. It is what
makes `router.push("plans")` autocomplete and reject typos, gives
`getProduct`/`purchase` their typed references, and makes asset imports
typecheck. Never edit it; never delete it.

**`superwall.lock`** — binds each surface to its dashboard paywall and
records which Superwall app the project pushes to. Committing it is what
makes every machine and CI push to the same paywalls. Nothing about the
dashboard ever appears in `config.ts`.

Renaming a paywall directory is safe: the next `push` notices and asks
whether it is a rename (keeping the live paywall) or a new paywall — in
CI, declare it with `--rename old=new`. Details in [cli.md](cli.md).

## Keep imports inside the project

Import from within `superwall/` or from packages in its `package.json`. An
import reaching outside (`../../src/theme`) still builds locally, but the
pushed source can't be rebuilt elsewhere, so the dashboard disables remote
editing for that paywall and the push warns naming each offender. Copy
shared code into `superwall/components/` instead — duplication here is
correct.

## `.env`

`superwall/.env` (and the app root's, as fallback) holds project
credentials — `SUPERWALL_API_KEY` for CI pushes. It is gitignored and
never leaves the machine: source pushes exclude `.env*`, `node_modules/`,
`.superwall/`, and anything your `.gitignore` lists.
