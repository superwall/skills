---
name: superwall-framework
description: Author paywalls, onboarding funnels, and web checkout flows as React mini-apps with the superwall framework (the `superwall` npm package). Use when building or editing code-first ("headless") paywalls in a superwall/ project directory — config.ts, app/ routes, hooks (useProducts, usePurchase, useActions…), navigation, localization, assets — or running `superwall dev/push/promote/publish`. NOT for the browser paywall editor (superwall-editor) or general CLI/resource management (superwall).
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
├── config.ts          definePaywall({ name, products: { annual: "pro_5999_year" } })
├── app/               routes only — index.tsx, plans.tsx, layout.tsx (reserved)
├── components/        everything that is not a route
└── messages/en.ts     strings, discovered by filename
```

Entry points: `superwall` (SuperwallProvider — mounted for you),
`superwall/config`, `superwall/hooks`, `superwall/navigation`,
`superwall/assets`.

## Read the reference that matches the task

| Task | Reference |
| --- | --- |
| Project layout, superwall.lock, superwall.d.ts, portability | [references/project.md](references/project.md) |
| `definePaywall` options — products, presentation, trial reminders | [references/config.md](references/config.md) |
| Any hook — signatures, semantics, gotchas | [references/hooks.md](references/hooks.md) |
| Checkout — products, prices, purchase()/restore, trials, web checkout | [references/checkout.md](references/checkout.md) |
| Multi-page, funnels, router, transitions (built-in + custom) | [references/navigation.md](references/navigation.md) |
| Localization — message catalogs, t(), locales | [references/localization.md](references/localization.md) |
| Preload, SDK events, entry animations, dev vs device, the studio | [references/lifecycle-and-events.md](references/lifecycle-and-events.md) |
| Images, video, fonts, Lottie/Rive | [references/assets.md](references/assets.md) |
| dev/push/promote/publish, renames, CI | [references/cli.md](references/cli.md) |
| Mobile design execution — 1:1 fidelity, safe areas, scroll fades, motion, touch | [references/mobile-design.md](references/mobile-design.md) |
| Examples — using them, browsing them, what each teaches | [references/examples.md](references/examples.md) |

## Principles that prevent the common failures

1. **Product data is SDK-owned.** Never hardcode a price; guard every
   variable and design the unpriced state — in dev, variables are
   `undefined` unless the studio injects dashboard data. Coerce
   numeric-looking variables with `Number()` — they arrive as strings on
   device.
2. **`purchase()` never throws for flow outcomes** — it resolves
   `completed | abandoned | failed`. React to the awaited result; treat
   abandoned as an outcome. Never put the buy button in a loading state.
3. **Entry animations key off `paywall_open`, never mount** — the SDK
   preloads paywalls hidden. Gate on
   `useSuperwallSnapshot().paywall !== undefined`.
4. **Dark mode is the `:root.dark` class the SDK stamps**, not
   `prefers-color-scheme`.
5. **Routes are names on a stack** — no params, no order; cross-route state
   lives in `layout.tsx` or a plain module. Closing the paywall is
   `useActions().close()`, not navigation.
6. **Links go through `useActions().openUrl`**, never `<a href>` — in a
   webview an anchor does nothing or navigates the paywall away.
7. **Haptics on every meaningful tap** (`light` navigate, `selection`
   choose, `success` purchase) — iOS fires nothing of its own. Icon
   buttons carry `aria-label`; tap targets ≥ 44px.
8. **`restore()` has no result** — success surfaces as
   `transaction_complete` or a dismissed paywall.
9. **Commit `superwall.lock` and `superwall.d.ts`.** Never edit either by
   hand.
10. **Shipping includes the dashboard.** A push that fails on missing
    products is not a blocker to report — create them with
    `superwall products create` ([references/cli.md](references/cli.md)).
    Treat "make this live" as spanning code *and* the resources it needs.
11. **Build the design reference 1:1.** Add nothing it doesn't show;
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

Docs beyond the framework: `curl -sL https://superwall.com/docs/llms.txt`
(index), then `curl -sL https://superwall.com/docs/{path}.md`.
