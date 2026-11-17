# Setups and experiments

What else an app-to-web flow can do, and what is worth testing. None of
this is required; [setup.md](setup.md) is the baseline. Read this file as
a menu of what the framework makes possible, and show the user that range:
a paywall is the user's own React, and teleport's primitives (the config
options, `useTeleport`, `usePurchase` callbacks, `useApplePay`,
`returnToApp({ data })`, `router.push(route, { teleport })`) compose into
almost any flow they can describe. When they ask for something not listed
here, build it from those pieces before saying it can't be done.

When the user asks for "an experiment" without saying which, start with
the first A/B test below against their current in-app paywall, and
suggest two or three others from this file as next steps.

Every snippet below is cut from a file that type-checks against the framework. `monthly` and
`webAnnual` are Stripe products, `annual` and `annualOffer` App Store ones;
use the user's own references.

## A/B tests: one paywall per variant

Test teleport variants as separate paywalls, each a variant in the same
campaign audience, never as a flag inside one paywall. Only the configured
`teleport.route` is prepared, warmed, Apple Pay-checked and pre-rendered,
so a branch that teleports another route makes one variant slower and the
test unfair.

Copy the paywall directory, change only what the variant tests, push both,
and add each as a variant of the campaign audience. Find the endpoints with
`superwall api docs variant`, and split traffic with `superwall campaigns
variants weights <campaignId> <audienceId>` (the `superwall` skill's
`references/api.md`). Changing weights changes live traffic: confirm with
the user first.

Tests worth running, each one paywall directory per arm:

| Test | Arm A | Arm B |
| --- | --- | --- |
| App to web at all | the current in-app paywall | the same paywall with `teleport` |
| Which page teleports | `teleport.route` on the plan picker | on the last page |
| Web price | the same price as the App Store | a lower Stripe price (below) |
| Trial on the web | `introductoryOfferEligibility: "automatic"` | `"ineligible"` |
| After paying | `completion: "confirmation"` | `"direct"` |
| Who teleports | everyone with Apple Pay | only trial-eligible shoppers (below) |
| Way back | `fallbacks` on the teleport screen | a custom screen with its own offer (below) |
| Failure rescue | none | back to the app on a decline (below) |

## Show the web price beside the App Store's

A Stripe product pays no App Store commission, so the web can be cheaper.
Both products are priced in the app before the teleport; say so on the
button that teleports:

```tsx
const applePay = useApplePay();
const { getProduct } = useProducts();
const store = getProduct("annual")?.variables.price;
const web = getProduct("webAnnual")?.variables.price;

return applePay.available ? (
  <button type="button" onClick={() => router.push("plan", { teleport: true })}>
    {web && store ? `${web} a year with Apple Pay (${store} in the App Store)` : "Continue"}
  </button>
) : null;
```

Never write a price into code or copy; both come from the stores.

## Who teleports

The `teleport` option on a push is any boolean, so the gate can be more
than Apple Pay. Teleport only shoppers who can still take the trial, for
example:

```tsx
const applePay = useApplePay();
const { eligible } = useIntroductoryOffer();
const teleport = applePay.available && eligible === true;

<button type="button" onClick={() => router.push("plan", { teleport })}>Continue</button>;
```

The same works for a user attribute (`useUserAttribute`), a quiz answer in
`useQueryState`, or the locale. Keep Apple Pay in every gate.

## Ask for the email in the app

A `user.email` becomes the Stripe customer's email, and the teleport page
takes the email the app sent, so asking for it before the teleport saves
the shopper typing it in the browser and lets the user follow up when a
web payment never happens:

```tsx
const applePay = useApplePay();
const [email, setEmail] = useUserAttribute("email");

<input type="email" value={email ?? ""} onChange={(event) => void setEmail(event.target.value)} />;
<button type="button" onClick={() => router.push("plan", { teleport: applePay.available })}>
  Continue
</button>;
```

## Promotion codes on the web

`useDiscount()` redeems a Stripe promotion code and prices every product
with it:

```tsx
const { redeem, applied, getDiscountedProduct } = useDiscount();
const { purchase } = usePurchase();
const [code, setCode] = React.useState("");
const deal = applied ? getDiscountedProduct("webAnnual") : undefined;

<input value={code} onChange={(event) => setCode(event.target.value)} />;
<button type="button" onClick={() => void redeem(code)}>Apply</button>;
<button type="button" onClick={() => void purchase("webAnnual")}>
  {deal?.applies ? `${deal.discountedPrice} (was ${deal.price})` : "Subscribe"}
</button>;
```

`redeem(code)` resolves with the verdict; `useDiscount({ onDropped })`
fires when checkout later refuses a code.

## Rescue a failed payment

`usePurchase({ onFailure })` says why a web payment failed
(`failure.reason`: `card_declined`, `insufficient_funds`, `expired_card`,
`incorrect_card_details`, `authentication_failed`, `card_not_supported`,
`limit_exceeded`, `fraud_suspected`, `processing_error`, `unknown`). Each
reason can get its own answer: a cheaper plan on the page, or back to the
app for the App Store:

```tsx
// the teleport route, on the web
const teleport = useTeleport();
const [cheaper, setCheaper] = React.useState(false);
const { purchase } = usePurchase({
  onFailure: (failure) => {
    if (teleport.status !== "arrived") return;
    if (failure.reason === "insufficient_funds") setCheaper(true);
    else if (failure.reason === "card_declined") void teleport.returnToApp({ data: { offer: "app_store" } });
  },
});
const reference = cheaper ? "monthly" : "webAnnual";
```

In the app, `useTeleport()` reads what came back while `status ===
"waiting"`:

```tsx
// the route before it, in the app
const back = useTeleport({ onReturnData: (data) => console.info("back from the page", data) });
const offer = back.status === "waiting" ? back.data?.offer : undefined;
const failure = back.status === "waiting" ? back.failure : undefined;
// offer === "app_store": show purchase("annual"); failure: say what happened
```

`returnToApp()` resolves `"opened"`, `"cancelled"` (the shopper tapped
Cancel on "Open in App?") or `"no_app"`; on anything but `"opened"` they
are still on the page, so leave it ready to buy again. The data is plain
JSON, at most 16 KB.

## An offer when the shopper gives up

In the app, `useTeleport({ onCancel })` fires when the shopper cancels on
the teleport screen. Answer with an in-app offer, an App Store product at
an introductory price, on a route of its own:

```tsx
// in the app
const router = useRouter();
const { customPlacement } = useActions();
useTeleport({
  onCancel: () => {
    customPlacement("teleport_cancelled");
    router.push("offer", { teleport: false });
  },
});
```

```tsx
// app/offer.tsx
const price = getProduct("annualOffer")?.variables.price;

<button type="button" onClick={() => void purchase("annualOffer")}>
  {price ? `Stay in the app: ${price} for the first year` : "Stay in the app"}
</button>;
```

`customPlacement(name)` fires a placement the SDK reports like any other,
so the user can count it, and aim a campaign at it, in the dashboard.
`useTeleport({ onOpen, onReturn, onComplete })` are there for the other
moments; an unpaid return resolves the `purchase()` as `abandoned`.

## Your own teleport screen

`teleport.overlay: false` hides Superwall's teleport screen; draw your own
from `useTeleport()` while `status === "waiting"` and not `returned`. Its
copy, its offer and its look are all yours:

```tsx
export function WaitingScreen() {
  const teleport = useTeleport();
  const { getProduct } = useProducts();
  const { purchase } = usePurchase();
  if (teleport.status !== "waiting" || teleport.returned) return null;
  const fallback = teleport.fallbackReference;
  const price = fallback ? getProduct(fallback)?.variables.price : undefined;

  return (
    <div role="dialog">
      <p>Finish in Safari. Your plan is waiting there.</p>
      <button type="button" onClick={teleport.open}>Open Safari again</button>
      {fallback && price ? (
        <button type="button" onClick={() => void purchase(fallback)}>
          Pay {price} in the app instead
        </button>
      ) : null}
      <button type="button" onClick={teleport.cancel}>Not now</button>
    </div>
  );
}
```

`fallbackReference` is the `teleport.fallbacks` product for what is being
bought. Render it from the layout so it covers every page. Keep the default
screen unless the user wants their own; it already does all of this.

## An Apple Pay button on the web page

`useApplePay(product).product` says whether Apple's sheet will open for
that product, so the web page can promise it:

```tsx
const applePay = useApplePay("webAnnual");

<button type="button" onClick={() => void purchase("webAnnual")}>
  {applePay.product.status === "ready" ? "Pay with Apple Pay" : "Continue to payment"}
</button>;
```

## After the payment: `completion`

`teleport.completion` decides what the web page does once paid:
`"confirmation"` (the default) shows "You're all set" with Return to App;
`"direct"` opens the app at once and shows that screen only when the app
didn't open. Worth testing when shoppers stay on the page after paying.

## The trial on the web: `introductoryOfferEligibility`

The App Store's trial history doesn't bind a Stripe purchase, so the web
checkout decides on its own: `teleport.introductoryOfferEligibility` is
`"automatic"` (the app's store says the shopper is eligible, the default),
`"eligible"` (always offer it) or `"ineligible"` (never). The Stripe
product's offer (`7days-free`, `no-trial`) sets which trial it is.

## Tag the purchase for analysis

`purchase(reference, { stripeMetadata })` writes key/values onto the
Stripe subscription, visible in Stripe and its webhooks; tag the arm so
revenue joins the experiment:

```tsx
const teleport = useTeleport();
const tapped = teleport.status === "arrived" ? teleport.productReference : undefined;
const reference = tapped ?? "webAnnual";

<button
  type="button"
  onClick={() => void purchase(reference, { stripeMetadata: { experiment: "teleport-early", variant: "b" } })}
>
  Subscribe
</button>;
```

`teleport.productReference` is the Stripe product tapped in the app when a
`purchase()` started the teleport; preselect it.

## Two ways into the web

When a paywall teleports from more than one page, keep the main one as
`teleport.route` and prepare the other with `useTeleport().prefetch(route)`
as soon as it can be reached, so it opens warm too:

```tsx
const { prefetch } = useTeleport();
React.useEffect(() => prefetch("checkout"), [prefetch]);

<button type="button" onClick={() => router.push("checkout", { teleport: true })}>Checkout</button>;
```

## Leaving the web page without paying

On the first web route, `router.back()` and `close()` return to the app.
The teleport screen's Continue In-App Instead buys the `teleport.fallbacks`
product.

## A Stripe purchase in the app

`purchase()` of a Stripe product inside the app teleports: to
`teleport.route` with that product preselected
(`useTeleport().productReference` on the page), or, without
`teleport.route`, to the route it was tapped on, which is not warmed.
Without `teleport` in config at all, it opens Superwall's hosted checkout
in the browser instead, the older app-to-web path. Prefer pushing
`teleport.route` behind the Apple Pay gate; use a Stripe purchase in the
app when that preselection is the point.

## And everything else

The web page is the same paywall, so the rest of the framework applies on
both sides: transitions and motion, Rive, layouts and themes, localized
copy, haptics in the app, `useQueryState` answers carried across the
teleport, quizzes and onboarding before the paywall, trial reminders. Any
of them can be an arm of a test. Pick by what the user wants to learn, and
keep one change per arm.
