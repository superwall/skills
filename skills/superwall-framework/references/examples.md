# Examples — the map

Every example is a complete, standalone superwall project teaching exactly
**one idea**. They teach functionality, not design: styling is
deliberately plain so the mechanism is the thing you read. When a task
matches one, read that example before writing code.

## Use an example

```bash
superwall create --example multi-page   # scaffold it as a new project
superwall dev                            # open it in the studio
```

All examples are public at
**https://github.com/superwall/superwall/tree/main/examples** — browse
them there, or fetch specific files raw:

```bash
curl -sL https://raw.githubusercontent.com/superwall/superwall/main/examples/multi-page/paywalls/multi-page/app/layout.tsx
```

Each example's `README.md` explains the idea, and every one is a
copyable project (`package.json`, `config.ts`, `app/` routes) — copying a
directory anywhere gives a working `superwall dev`.

## Fundamentals

| Example | The one idea | Reach for it when |
| --- | --- | --- |
| `minimal` | One route, one product, purchase — a paywall is a React component, not a template | Starting anything |
| `product-selection` | Selection state is ordinary React — the framework has no "selected plan" concept | Multiple plans, price rows |

`minimal` shows the canonical price guard
(``price ? `Subscribe · ${price}` : "Subscribe"``). `product-selection` shows
a typed plan union, `haptics.selection()` on choice vs `haptics.light()` on
CTA, a real `role="radiogroup"`/`role="radio"` with `aria-checked`, one
product rendering both `price` and `monthlyPrice` (both store-formatted,
never arithmetic), and a designed unpriced state.

## Navigation

| Example | The one idea |
| --- | --- |
| `multi-page` | `router.push/back`, the route stack, chrome in `layout.tsx` that reads router state (`canGoBack()`, `depth + 1`) |
| `transitions` | All four built-ins plus a custom `zoom` — proof a transition is just CSS on two attributes |
| `onboarding-quiz` | Answers decide where you land; the router carries no state (plain module outside React) |

`onboarding-quiz`'s terminal route defends every read — a replayed route
never crashes on a missing answer. Its step labels are hardcoded per route
because a branching flow's depth is not its step number.

## Purchases

| Example | The one idea |
| --- | --- |
| `purchase-states` | The two channels: what your `purchase()` call resolves vs what the SDK reports on its own (restore arrives as `transaction_complete` with no purchase in sight) |
| `trial-eligibility` | Two paywalls in one, chosen by the store — every string forks and both states read as intentional |
| `abandonment-offer` | `purchase()` resolving `abandoned` is a signal only this paywall can act on — push a last-chance offer (a second product, not a second design) with a custom `sheet` transition |
| `trial-reminders` | A local notification declared in config, scheduled by the SDK when the trial starts — the paywall needn't be open when it fires |
| `web-funnel` | Selling on the web: steps as routes, then `checkout: "sheet"` — one config key, `purchase()` unchanged; `prefetch(reference)` on selection so the sheet opens instantly |

`purchase-states` is the only example showing the full haptic vocabulary
(`success()` / `error()` keyed to outcomes). `abandonment-offer` contains
the deepest CSS lesson in the corpus: the scrim behind its sheet reuses
`--sw-transition`/`--sw-ease` and drives page-dim and backdrop from one
`--dim` number (docs: `transitions`).

## The host

| Example | The one idea |
| --- | --- |
| `personalization` | `useVariables()` — device, user, placement params, and **guarding every read** (`?? "—"` for SDK-guaranteed device fields; `typeof x === "string"` for host-controlled user/params) |
| `permissions` | `requestPermission` (asks the OS) vs `requestCallback` (asks *your app* — run code, hand something back); both resolve from code the paywall doesn't control, and a denial is an outcome, not an error |

## Look and feel

| Example | The one idea |
| --- | --- |
| `custom-fonts` | A typeface from a file in your project — relative-path `@font-face`, hosted by content hash; subset to latin (~24 kB vs ~90 kB) |
| `with-tailwind` | Tailwind v4 with zero framework config — one postcss.config line, `@theme` tokens, and crucially `@custom-variant dark (&:where(.dark, .dark *))` so `dark:` follows the SDK's class, not the media query |
| `with-motion` | In-page animation gated on `paywall_open` via the snapshot — the preload rule (docs: `lifecycle`) — plus a price count-up bound to `rawPrice`, gated on both `opened` and the value existing |
| `with-rive` | Interactive vector animation — `.riv` as a hosted asset, the WASM engine bundled and CDN fallback nulled (CSP), real state-machine names, controls as real buttons with aria-labels |
| `orientation` | `useDevice().orientation` — measured in the page, live on rotation; landscape is a two-column grid reflow, not a shrunken portrait |

## Localization

| Example | The one idea |
| --- | --- |
| `localization` | Four locales by filename, shared + surface-local catalogs, `{price}` interpolation guarded on the value, no language picker on device |

## Habits every example carries

These are the "treat it like a real paywall" conventions — carry them into
any paywall you author:

- **Haptics on every meaningful tap** — `light()` for navigation/CTAs,
  `selection()` for changing a choice, `success()` when a purchase lands.
  iOS fires nothing of its own inside a paywall.
- **Never a loading state on the buy button** — the store sheet is the
  feedback and the SDK owns it.
- **Prices from `useProducts()`**, never from the file; product identifiers
  are placeholders to repoint.
- **Every control reachable** — icon-only buttons carry `aria-label`; tap
  targets ≥ 44px; primary actions full-width at the bottom of the screen.
- **Links through `useActions().openUrl`**, never `<a href>` — in a webview
  an anchor does nothing or navigates the paywall away from itself.
- **Light and dark via the `:root.dark` class**, both always checked; safe
  areas via `env(safe-area-inset-*)` with sensible minimums; responsive
  from 320px to tablet.
- **`--sw-background: var(--bg)` and `--sw-routes-height: auto`** in
  `:root` whenever a layout puts chrome around the routes.
