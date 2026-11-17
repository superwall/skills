# Setups and experiments

What else an app-to-web flow can do, and what is worth testing. None of
this is required; [setup.md](setup.md) is the baseline. Pick what the user
asks for, and when they ask for "an experiment" without saying which,
start with the A/B test below against their current in-app paywall.

## A/B tests: one paywall per variant

Test teleport variants as separate paywalls, each a variant in the same
campaign audience, never as a flag inside one paywall. Only the configured
`teleport.route` is prepared, warmed, Apple Pay-checked and pre-rendered,
so a branch that teleports another route makes one variant slower and the
test unfair.

Good first tests, each a paywall directory:

- **App Store only vs app to web**: the current in-app paywall against a
  copy with `teleport` added. The question every app asks first.
- **Which page teleports**: the same flow with `teleport.route` on an early
  page (the plan picker) vs the last one (the checkout page).
- **Trial on the web vs not**: `teleport.introductoryOfferEligibility`
  (below).

Copy the paywall directory, change only what the variant tests, push both,
and add each as a variant of the campaign audience. Find the endpoints with
`superwall api docs variant`, and split traffic with `superwall campaigns
variants weights <campaignId> <audienceId>` (the `superwall` skill's
`references/api.md`). Changing weights changes live traffic: confirm with
the user first.

## Back to the app after a failed payment

When a payment fails on the web, send the shopper back and offer the App
Store instead. On the teleport page, `returnToApp({ data })` from
`usePurchase({ onFailure })` leaves the app the failure and your data; in
the app, `useTeleport()` reads them while `status === "waiting"`:

```tsx
// teleport route, on the web
const teleport = useTeleport();
const { purchase } = usePurchase({
  onFailure: (failure) => {
    if (teleport.status !== "arrived") return;
    const offer = failure.reason === "insufficient_funds" ? "app_store" : "retry";
    void teleport.returnToApp({ data: { offer } });
  },
});

// the route before it, in the app
const back = useTeleport({ onReturnData: (data) => console.info("back from the page", data) });
const offer = back.status === "waiting" ? back.data?.offer : undefined;
// offer === "app_store": show purchase("annual"); "retry": say it didn't go through
```

`returnToApp()` resolves `"opened"`, `"cancelled"` (the shopper tapped
Cancel on "Open in App?") or `"no_app"`; on anything but `"opened"` they
are still on the page, so leave it ready to buy again. The data is plain
JSON, at most 16 KB.

## Leaving the web page without paying

On the first web route, `router.back()` and `close()` return to the app.
In the app, `useTeleport({ onCancel, onReturn })` counts cancels and
returns (`onCancel` is the teleport screen's Cancel only; an unpaid
return resolves the `purchase()` as `abandoned`). The teleport screen's
Continue In-App Instead buys the `teleport.fallbacks` product.

## After the payment: `completion`

`teleport.completion` decides what the web page does once paid:
`"confirmation"` (the default) shows "You're all set" with Return to App;
`"direct"` opens the app at once and shows that screen only when the app
didn't open. Worth testing when shoppers stay on the page after paying.

## The trial on the web: `introductoryOfferEligibility`

The App Store's trial history doesn't bind a Stripe purchase, so the web
checkout decides on its own: `teleport.introductoryOfferEligibility` is
`"automatic"` (the app's store says the shopper is eligible, the default),
`"eligible"` (always offer it) or `"ineligible"` (never). `"ineligible"`
against `"automatic"` is a clean test of whether the web trial pays off.

## Your own teleport screen

`teleport.overlay: false` hides Superwall's teleport screen; draw your own
from `useTeleport()` while `status === "waiting"` and not `returned`:
`open()` reopens the browser, `cancel()` gives up, and
`fallbackReference` is the store product to sell with `purchase()`. Keep
the default screen unless the user asks for their own.

## A Stripe purchase in the app

`purchase()` of a Stripe product inside the app teleports: to
`teleport.route` with that product preselected
(`useTeleport().productReference` on the page), or, without
`teleport.route`, to the route it was tapped on, which is not warmed.
Without `teleport` in config at all, it opens Superwall's hosted checkout
in the browser instead, the older app-to-web path. Prefer pushing `teleport.route` behind the Apple Pay gate;
use a Stripe purchase in the app only when that preselection is the point.
