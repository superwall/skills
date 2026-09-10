---
name: superwall-framework
description: Author paywalls, onboarding funnels, and web checkout flows as React mini-apps with the superwall framework (the `superwall` npm package). Use when building or editing code-first ("headless") paywalls in a superwall/ project directory — config.ts, app/ routes, hooks (useProducts, usePurchase, useDiscount, useActions…), navigation, localization, assets — or running `superwall dev/push/promote/publish`. NOT for the browser paywall editor (superwall-editor) or general CLI/resource management (superwall).
---

# The superwall framework

A paywall is a mini React app: a required `config.ts` (`definePaywall` —
the name and product slots) plus an `app/` route tree, living in a
self-contained `superwall/` directory in the user's repo. Superwall
provides products, purchases, localization, trials, and the bridge to the
native SDKs — no native code changes. `superwall dev` previews in the
studio; `superwall push` seals immutable versions; `promote` ships them.

```
superwall/paywalls/<id>/
├── config.ts          definePaywall({ name, platforms: ["ios", "android"], products: { annual: "pro_5999_year" } })
├── app/               routes only — index.tsx, plans.tsx, layout.tsx (reserved)
├── components/        everything that is not a route
└── messages/en.ts     strings, discovered by filename
```

Entry points: `superwall` (SuperwallProvider — mounted for you),
`superwall/config`, `superwall/hooks`, `superwall/navigation`,
`superwall/assets`.

## Local references — the agent playbooks

Working practices the docs don't carry. Read the one that matches the task:

| Task | Reference |
| --- | --- |
| Mobile design execution — 1:1 fidelity, safe areas, scroll fades, motion, touch | [references/mobile-design.md](references/mobile-design.md) |
| dev/push/promote/publish, creating products yourself, renames, several platforms, CI | [references/cli.md](references/cli.md) |
| Examples — using them, browsing them, what each teaches | [references/examples.md](references/examples.md) |

## Everything else — fetch the docs live

Full framework documentation lives at `superwall.com/docs/framework`.
**Do not answer API questions from memory — fetch the page:**

```bash
curl -sL https://superwall.com/docs/framework/llms.txt      # page index
curl -sL https://superwall.com/docs/framework/{page}.md      # one page
```

| Task | Page(s) |
| --- | --- |
| Project layout, superwall.lock (apps per platform + bindings), superwall.d.ts, portability, .env | `project-structure` |
| `definePaywall` options — products, platforms, presentation style/gating/cache (all paywall settings live here; there is no dashboard editor for a headless paywall), trial reminders | `config` |
| Any hook — signatures, semantics | `hooks` |
| Declaring products, reading variables, the three price rules | `products` |
| `purchase()` outcomes, restore, the two channels | `purchases` |
| Introductory-offer eligibility forking (`useIntroductoryOffer`), reminder notifications | `trials` |
| Selling on the web — modes, prefetch, the Stripe sheet, hosted checkout, promotion codes (`useDiscount`) | `web-checkout` |
| Web funnels — answers in the URL (`useQueryState`), resume after a browser hand-off, `shift` | `web-funnels` |
| Multi-page flows, router, cross-page state, shared chrome | `navigation` |
| Built-in + custom transitions, bottom sheets | `transitions` |
| Message catalogs, t(), locales | `localization` |
| Preload, entry animations, SDK events, dark mode | `lifecycle` |
| Images, video, fonts, Lottie/Rive, app-bundled local resources (`useLocalResource`) | `assets` |
| close/openUrl/permissions/callbacks | `actions` |
| The messages a paywall exchanges with its host, hosting one yourself | `host-protocol` |
| Device/user/params records, personalization | `variables` |
| The dev studio, dev-vs-device differences | `studio` |
| Error messages → fixes | `troubleshooting` |

Docs beyond the framework (dashboard, SDKs, web checkout setup):
`curl -sL https://superwall.com/docs/llms.txt`, then `/docs/{path}.md`.

## Principles that prevent the common failures

1. **Product data is host-owned.** Never hardcode a price; guard every
   variable and design the unpriced state — the host (the SDK on a
   device, the studio in `superwall dev`, reading your dashboard) delivers
   products, and a slot the dashboard cannot resolve shows the editor's
   example prices in previews and is refused by push. Coerce
   numeric-looking variables with `Number()` — they arrive as strings on
   device.
2. **`purchase()` never throws for flow outcomes** — it resolves
   `completed | abandoned | failed`. React to the awaited result; treat
   abandoned as an outcome. Never put the buy button in a loading state.
   `failed` with `reason: "sdk"` is iOS only: Android reports no purchase
   failures, so there a failed purchase stays pending until the user
   abandons or completes. The paywall runs no timer of its own; design the
   pending state to be survivable and never gate irreversible UI on
   `failed` on Android.
3. **Entry animations key off `paywall_open`, never mount** — the SDK
   preloads paywalls hidden. Gate on
   `useSuperwallSnapshot().paywall !== undefined`.
4. **Dark mode is the `:root.dark` class the SDK stamps**, not
   `prefers-color-scheme`.
5. **Routes are names on a stack** — no params, no order. Closing the
   paywall is `useActions().close()`, not navigation. Cross-route state
   lives in `layout.tsx` or a plain module on a native paywall — but **on a
   web funnel (`checkout` set) every answer, selection and input is
   `useQueryState`, never `useState`**: an in-app browser hands only the
   URL to Safari, and hosted checkout returns to one, so anything not in
   the URL is lost mid-flow. Enum ids, short keys, nothing personal; set
   `transition: "shift"`. Fetch `web-funnels` before building one.
6. **Links go through `useActions().openUrl`**, never `<a href>` — in a
   webview an anchor does nothing or navigates the paywall away.
7. **Haptics on every meaningful tap** (`light` navigate, `selection`
   choose, `success` purchase) — iOS fires nothing of its own. Icon
   buttons carry `aria-label`; tap targets ≥ 44px.
8. **`restore()` has no result to await** — success surfaces as a
   dismissed paywall; the SDK's `restore_start/complete/fail` land on
   `useSuperwallSnapshot().restore` (iOS all three, Android `restore_fail`
   only).
9. **Commit `superwall.lock` and `superwall.d.ts`.** Never edit either by
   hand — the one exception is adding an app under `apps` in the lock when
   CI can't prompt.
10. **One project, several platforms.** `superwall.lock` binds one
    Superwall app per platform under `apps` (`ios`, `android`, `web`), and
    a paywall lists the platforms it ships
    to with `platforms: [...]` in `config.ts` (typed) — optional on one
    platform, **required once the project pushes to more than one** (push
    refuses a silent paywall rather than guess; there is no project-wide
    default — spread a shared constant). `["ios", "android"]` is one shared
    codebase with a dashboard paywall and versions per platform; a web-only
    paywall is `["web"]`. `--platform <p>` narrows push/promote/publish. A
    new platform binds its app on the first push (auto when the account has
    exactly one app of it, else a prompt); fetch `push-and-promote` first.
    Store products differ per store, so a shared slot takes one id per
    platform — `annual: { ios: "…", android: "…" }` — while
    `purchase("annual")` stays the same call; the slot must name every
    platform the paywall ships to.
11. **Shipping includes the dashboard.** A push that fails on missing
    products is not a blocker to report — create them with
    `superwall products create` ([references/cli.md](references/cli.md)).
    Treat "make this live" as spanning code *and* the resources it needs.
12. **Build the design reference 1:1.** Add nothing it doesn't show;
    effects (shadows, gradients) are design decisions, not defaults.
    Safe-area insets always wrap in `max()` with floors — bare `env()`
    is 0 in previews ([references/mobile-design.md](references/mobile-design.md)).

## Working loop

```bash
superwall dev            # studio on :6100 — check light/dark, locales, devices, 320px→tablet
bun run typecheck        # in the project — the generated types catch route/product typos
superwall push           # sealed version, production untouched; diagnostics hard-fail here
superwall promote        # ship (or: superwall publish -m "why")
```

Two gates before promising a push will work: Superwall for Agents is in
private beta and must be enabled on each app you push to (`superwall apps
list --json` → `features_enabled` lists `headless_paywalls`; a refused push
says "Superwall for Agents is in private beta and isn't enabled for this
app yet" — support@superwall.com turns it on), and every product named in a
`config.ts` must exist on the dashboard.
