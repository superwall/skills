# Set up app to web

The playbook for "set up an app-to-web flow" or "an app-to-web experiment".
Do every step; each ends with how to tell it worked. The recommendations are
today's (November 2026) and may change. The `superwall-framework` skill
covers everything about writing the paywall; this file only adds what
teleport needs.

## Checklist

- [ ] 1. Prerequisites hold (SDK, web paywall domain, Stripe, app links)
- [ ] 2. Products: Stripe products for the web, a store product for each fallback
- [ ] 3. `config.ts`: `teleport.route`, `fallbacks`, direct Apple Pay with prepaid cards blocked
- [ ] 4. The Apple Pay gate on the push that reaches `teleport.route`
- [ ] 5. The teleport route sells Stripe on the web and the store in the app
- [ ] 6. Prepaid cards blocked in Stripe Radar too
- [ ] 7. Pushed, verified on an iPhone, attached to a campaign

## 1. Prerequisites

- **SuperwallKit 4.18.0 or later** in the iOS app. On an older SDK, and on
  Android, teleport doesn't run: the route opens in the app and a Stripe
  purchase goes to Superwall's hosted checkout. Read the version from the
  app's package manager, never assume it.
- **A web paywall domain and Stripe connected** on the Superwall app the
  paywall is pushed to: the teleport page opens on that domain, and Stripe
  takes the payment. Both are dashboard settings; when either is missing,
  say so and stop, the user sets them up.
- **A way back to the app:** its universal link (associated domains), its
  URL scheme, or both. The framework picks the link; `no_app` from
  `returnToApp()` means neither is set.

## 2. Products

Stripe products (`{environment}:{priceId}:{offer}`, such as
`live:price_123:7days-free`) are what the web page sells. Give each one a
store product to fall back to in the app. Never hardcode a price: the stores
price them at runtime. Create what's missing with `superwall products
create` (the `superwall-framework` skill's `references/cli.md`); list first.

## 3. `config.ts`

```ts
import { definePaywall } from "superwall/config";

export default definePaywall({
  name: "Web checkout",
  teleport: {
    route: "plan", // the web half opens here; prepared, warmed and pre-rendered
    fallbacks: { monthly: "annual" }, // "Continue In-App Instead" on the teleport screen
  },
  checkout: { mode: "applePay", prepaidCards: "block" },
  products: { monthly: "live:price_MONTHLY:7days-free", annual: "pro_5999_year" },
});
```

- `route` is required by this playbook even though the type makes it
  optional: it is what makes the browser open at once.
- `checkout` only applies to the web half here: inside the iOS app a
  purchase never uses it. `"applePay"` is direct Apple Pay: Apple's sheet
  opens on the tap, and Stripe's card sheet is only the fallback where
  Apple Pay can't open. Always use it on a teleport paywall; `"sheet"`
  (Stripe's embedded checkout) makes every shopper start from a card form.
  A teleport page left without `checkout` uses `"applePay"` too, but write
  it so `prepaidCards` has a place.
- **Stripe Managed Payments:** direct Apple Pay is not available with it.
  A Managed Payments checkout session comes back as Stripe's embedded
  checkout, so `useApplePay(product).product` reads `session_unsupported`
  and the tap opens the card sheet. Ask the user whether their Stripe
  account uses Managed Payments; when it does, recommend direct Apple Pay
  and let them choose `checkout: { mode: "applePay", managedPayments:
  false, prepaidCards: "block" }` for this paywall (Stripe stops acting as
  merchant of record on it). Their call, not yours.
- Leave `completion` (`"confirmation"`) and `introductoryOfferEligibility`
  (`"automatic"`) at their defaults unless the user is testing them
  ([experiments.md](experiments.md)).

## 4. The Apple Pay gate

The push that reaches `teleport.route` decides whether the shopper goes to
the web:

```tsx
const applePay = useApplePay();
router.push("plan", { teleport: applePay.available });
```

`available` is Apple's own card check
(`ApplePaySession.canMakePaymentsWithActiveCard`), the same in the iOS
app's web view as in a browser; on Android it is `false`
(`unsupported_browser`), where teleport doesn't run anyway. The answer is
asked when the paywall opens and cached for the page; an error or a timeout
is asked again. A tap that must wait for the answer uses
`const { available } = await checkApplePay()` instead.

Verify: in the studio (Chrome) `useApplePay()` reads `false,
unsupported_browser`, so the push stays in the app. That is expected; the
teleport itself only runs on an iPhone (step 7).

## 5. The teleport route

The route runs in two places: on the web page after a teleport, and in the
app for shoppers without Apple Pay. Branch on `useDevice().host`:

- `"ios-sdk"`: sell the store product. A Stripe `purchase()` here would
  teleport again.
- anything else (`"web-teleport"` on the teleport page): sell the Stripe
  product, preselecting `useTeleport().productReference` when the app
  passed one.

Keep the first render of the route to what the pre-render knows (locale,
products and prices, trial, `productReference`); the `superwall-framework`
skill's teleport rule lists the details.

## 6. Prepaid cards in Stripe

`prepaidCards: "block"` refuses prepaid cards on Stripe's card sheet and
hosted checkout. An Apple Pay payment can't be filtered by card type from
the paywall, so also ask the user to add a rule in the Stripe dashboard
(Radar → Rules): `Block if :card_funding: = 'prepaid'`, and to check it
in test mode. That is a person's step; list it in the hand-over.

## 7. Push, verify, attach

1. `superwall push`, then fix every pre-render warning it prints for the
   teleport route (the page would render in the browser instead).
2. On an iPhone with a card in Wallet, open the paywall from the app (the
   SDK's debugger, or its placement), tap through to `plan`: the browser
   opens on the plan, Apple Pay pays, "You're all set", Return to App, and
   the app is unlocked.
3. On an iPhone or simulator with an empty Wallet, the same tap opens
   `plan` in the app with the store product.
4. On the web page, the pay button opens Apple's sheet straight away, not
   a card form. A card form means `"sheet"` mode or Managed Payments
   (step 3).
5. In the browser, cancel the payment and use Continue In-App Instead on
   the teleport screen: the store sheet opens for the fallback.
6. `superwall promote` (or `publish`), then attach the paywall to its
   campaign (the `superwall` skill's dashboard workflow). For an
   experiment, each variant is its own paywall: see
   [experiments.md](experiments.md#ab-tests-one-paywall-per-variant).

## Pitfalls

- Teleporting a route other than `teleport.route` with
  `router.push(route, { teleport: true })`: it opens cold. Make it the
  route, or call `useTeleport().prefetch(route)` when it must stay
  another one.
- Reading `useApplePay()?.available`: it is always defined; read it
  without `?.`. `useVariables().device.isApplePayAvailable` is deprecated
  and always `true` in the app.
- Answers kept in component state are lost on the web: keep what the web
  half needs in `useQueryState`, which the teleport carries along.
- Returning to the app with `openDeepLink` or a hand-built link: use
  `useTeleport().returnToApp()`, or `close()` / `router.back()` on the
  first web route.
