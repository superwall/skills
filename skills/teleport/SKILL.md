---
name: teleport
description: Set up an app-to-web flow or experiment with the superwall framework's teleport — the shopper starts on a paywall or onboarding in the iOS app and finishes on the web, paying with Apple Pay through Stripe, and the app is credited on its own. Covers the recommended setup (`teleport.route` in config.ts, the Apple Pay gate with `useApplePay().available` and `router.push(route, { teleport: false })`, `teleport.fallbacks`, blocking prepaid cards), what buying a Stripe product inside the app does, A/B testing teleport by paywall in a campaign, and optional setups (return to the app on a failed payment, `completion`, trial eligibility). Use when the user asks to "set up app to web", "app-to-web experiment", "teleport", "send users to web checkout from the app", "sell on the web from iOS", "Stripe / Apple Pay from the app", or to test web checkout against the App Store. Needs the superwall-framework skill for everything else about the paywall.
user-invocable: true
---

# Teleport: app to web

App to web means the shopper starts in the iOS app and finishes on the web:
a paywall shown by SuperwallKit 4.18+ opens one of its routes in the
shopper's browser, they pay there with Apple Pay (Stripe), and the app is
credited without a restore. With the superwall framework this is one key,
`teleport`, in the paywall's `config.ts`; the same paywall runs on both
sides, so nothing is built twice. Everything about writing the paywall
itself (routes, hooks, layout, push and publish) is in the
`superwall-framework` skill; this skill is how to set up teleport well.

These are **today's recommendations** (November 2026). They come from what
converts so far and may change; when the user's own results disagree, theirs
win. Say so when you hand a setup over.

## The rules

1. **Teleport through `teleport.route` in `config.ts`, always.** Name the
   route the web half opens on: `teleport: { route: "plan" }`. A paywall
   with `teleport.route` prepares that teleport and warms the web page the
   moment it opens, asks Apple about Apple Pay at the same time, and
   `superwall push` pre-renders the route so the browser paints it before
   any script runs. A route teleported only with
   `router.push(route, { teleport: true })` gets none of that and opens
   cold. Never hand-build a link or call `openExternalUrl` to reach the web.
2. **Send only shoppers with Apple Pay to the web.** App to web converts
   well when the shopper pays with a double click; typing a card in a
   browser does not. Read `useApplePay().available` and push the route with
   `{ teleport: applePay.available }`: `true` teleports, `false` pushes the
   same route in the app (`teleport: false` overrides `teleport.route`), so
   the page is still warmed and checked. `false` includes `checking`, the
   first moments before Apple answers; it is cached for the page, and the
   paywall asked when it opened, so by the shopper's tap it has almost
   always answered. Call `await checkApplePay()` instead when a tap must
   wait for the real answer (at most 1.5 s, never `checking`).
3. **In the app, sell store products; on the web, Stripe products.** The
   route pushed in the app (no Apple Pay) offers the App Store product;
   branch on `useDevice().host` (`"ios-sdk"` in the app, `"web-teleport"`
   on the teleport page), never on the URL. `purchase()` of a Stripe
   product inside the app teleports: to `teleport.route` with the tapped
   product preselected there (`useTeleport().productReference`), or,
   without `teleport.route`, to the route it was tapped on, cold. That is
   fine as a deliberate path, never as a side effect of the in-app branch.
4. **Map every Stripe product to a store product in `teleport.fallbacks`.**
   While the shopper is in the browser the app shows Superwall's teleport
   screen; `fallbacks` adds "Continue In-App Instead", which buys the store
   product. It is the way back for anyone who changes their mind.
5. **Block prepaid cards:** `checkout: { mode: "applePay", prepaidCards:
   "block" }`. Prepaid cards are how free trials are abused. `applePay` is
   what a teleport page uses anyway; `prepaidCards` holds on the card sheet
   it falls back to, but Apple Pay itself can't be filtered by card type, so
   also add a Radar rule in the Stripe dashboard (see setup).
6. **A/B test with separate paywalls, not branches in one.** Each variant is
   its own paywall directory with its own `teleport.route`, attached as its
   own variant in a campaign. A flag inside one paywall that decides which
   route teleports loses the preparation, warm-up and pre-render for every
   route but the configured one.

## Worked example

The `teleport` example (`superwall create --example teleport`) is the full
flow; this is the shape with the rules above applied. `monthly` and `pro`
are Stripe products, `annual` the App Store one.

```ts
// paywalls/web-checkout/config.ts
import { definePaywall } from "superwall/config";

export default definePaywall({
  name: "Web checkout",
  teleport: { route: "plan", fallbacks: { monthly: "annual", pro: "annual" } },
  checkout: { mode: "applePay", prepaidCards: "block" },
  products: {
    monthly: "live:price_MONTHLY:7days-free",
    pro: "live:price_PRO:no-trial",
    annual: "pro_5999_year",
  },
});
```

```tsx
// paywalls/web-checkout/app/goal.tsx — in the app
import { useApplePay } from "superwall/hooks";
import { useRouter } from "superwall/navigation";

export default function Goal() {
  const router = useRouter();
  const applePay = useApplePay();

  return (
    <button
      type="button"
      onClick={() => {
        // Apple Pay set up: plan opens in the browser. Otherwise: plan, in the app.
        router.push("plan", { teleport: applePay.available });
      }}
    >
      Continue
    </button>
  );
}
```

```tsx
// paywalls/web-checkout/app/plan.tsx — on the web, or in the app without Apple Pay
import { useDevice, useProducts, usePurchase } from "superwall/hooks";

export default function Plan() {
  const { host } = useDevice();
  const { getProduct } = useProducts();
  const { purchase } = usePurchase();
  // In the app sell the store product; a Stripe purchase here would teleport.
  const reference = host === "ios-sdk" ? "annual" : "monthly";
  const product = getProduct(reference);

  return (
    <button type="button" onClick={() => void purchase(reference)}>
      {product?.variables.price ? `Subscribe for ${product.variables.price}` : "Subscribe"}
    </button>
  );
}
```

## Where to go next

| The job | Read |
| --- | --- |
| Set up app to web end to end: prerequisites, the paywall, products, the campaign, verifying on a device | [references/setup.md](references/setup.md) |
| Optional setups and experiments: back to the app after a failed payment, `completion`, trial eligibility, a custom teleport screen, which page teleports, A/B tests by paywall | [references/experiments.md](references/experiments.md) |
| Anything else about the paywall: routes, `useQueryState`, `useTeleport`, layout, push and publish | the `superwall-framework` skill |
