# Checkout

How a paywall sells: declaring products, reading store data, making the
purchase, handling trials — and, for web paywalls, taking payment in the
page.

## Declare products

Products are **slots** in `config.ts`. The key is the reference your code
uses; the value is the store identifier:

```ts
products: {
  monthly: "pro_999_month",
  annual: "pro_5999_year",
},
```

Web/Stripe products put the Stripe price inside the identifier — no
separate mapping (`{environment}:{priceId}:{offer}`):

```ts
products: {
  monthly: "live:price_1ABC…:7days-free",
},
```

A paywall can declare both kinds. Product **data** — price, period,
trial — never appears in the file: it is store-owned and arrives at
runtime. `superwall push` refuses to publish a reference the dashboard has
no product for; example identifiers are placeholders to repoint at your
own.

## Read product data

```tsx
const { getProduct } = useProducts();
const annual = getProduct("annual");

annual?.variables.price          // "$59.99" — formatted for the user's region
annual?.variables.monthlyPrice   // "$5.00" — the store's own math
annual?.variables.trialPeriodDays
```

Everything on `variables`, all optional:

| Group | Variables |
| --- | --- |
| Price | `price`, `rawPrice`, `currencyCode`, `currencySymbol` |
| Period | `period` ("year"), `periodly` ("yearly"), `periodDays/Weeks/Months/Years` |
| Per-interval price | `dailyPrice`, `weeklyPrice`, `monthlyPrice`, `yearlyPrice` |
| Trial | `trialPeriodDays/Weeks/Months/Years`, `trialPeriodPrice`, `trialPeriodText` ("7-day"), `trialPeriodEndDate` ("Jul 23, 2026"), per-interval trial prices |
| Locale | `locale`, `languageCode` |
| State | `identifier`, `isSubscribed` |

`period` and `periodly` arrive pre-localized to the device locale.

### The three rules

1. **Guard every read and design the empty state.** A declared reference
   always exists, but its variables may not have arrived — and in
   `superwall dev` they are `undefined` until the studio injects your
   dashboard's products. Degrade the copy, never invent a number:

   ```tsx
   {annual?.variables.price ? `Subscribe · ${annual.variables.price}` : "Subscribe"}
   ```

2. **`Number()` before arithmetic.** Numeric-looking variables arrive as
   strings on device (`"59.99"`, `"7"`); a `typeof x === "number"` check
   silently treats every product as trial-less on a real phone:

   ```tsx
   const days = Number(annual?.variables.trialPeriodDays);
   const trialDays = Number.isFinite(days) ? days : 0;
   ```

3. **Display formatted, compute raw.** `price`/`monthlyPrice` for copy,
   `rawPrice` for computation or animation. Never derive a displayed price
   the store already provides.

Selection state is ordinary React, typed against the config:

```tsx
import { type ProductReference } from "superwall/hooks";
const [selected, setSelected] = React.useState<ProductReference>("annual");
```

## Purchase

```tsx
const { purchase } = usePurchase();

<button onClick={async () => {
  haptics.light();
  const result = await purchase(selected);
  if (result.status === "abandoned") {
    router.push("offer", { transition: "sheet" });
  }
}}>
```

`purchase()` resolves — never throws for flow outcomes:

| Status | Meaning | Respond by |
| --- | --- | --- |
| `completed` | The sale went through | `haptics.success()`; the SDK dismisses if configured |
| `abandoned` | The user closed the store sheet | An ordinary outcome — most people who open a sheet close it. The only place *this paywall's own* declined offer is visible: show a last-chance offer, or nothing |
| `failed` | No transaction — `reason` is `"timeout"` or `"superseded"` (a retry or re-presentation replaced it) | Usually nothing; `haptics.error()` at most |

Rules:

- **Never put the buy button in a loading state.** No "One moment…", no
  disabling. The store sheet is the feedback, and the SDK owns it.
- **One recovery offer, not two.** If the user abandons the discounted
  offer too, let them be (`examples/abandonment-offer`).
- Options: `purchase(ref, { shouldDismiss?, timeoutMs? })` — both default
  to config.

### The two channels

Your `purchase()` call is one channel; the SDK reporting on its own is the
other — it reports transactions **whoever started them**, and a
successful restore arrives as `transaction_complete` with no purchase in
sight:

```tsx
// this paywall's own attempt
const result = await purchase("annual");

// anything the SDK reports — purchase, restore, trial start
useSuperwallEvent("transaction_complete", () => haptics.success());
useSuperwallEvent("freeTrial_start", () => {});
```

Drive *this paywall's* flow from the awaited result; use events for side
effects that should fire on any transaction. `examples/purchase-states`
shows both side by side.

### Restore

```tsx
const { restore } = useActions();
<button onClick={() => { haptics.light(); restore(); }}>Restore purchases</button>
```

Fire-and-forget — there is no result to await; success shows up as a
`transaction_complete` event or a dismissed paywall. Every store paywall
should offer it (App Review expects it).

## Trial eligibility

The store decides who gets a trial — not you, and not the user's claim.
`useTrialEligibility()` is that signal, and it splits the paywall into two
versions that must **both** read as intentional:

```tsx
const { eligible } = useTrialEligibility();   // boolean | undefined
const days = annual?.variables.trialPeriodDays;

<h1>{eligible ? "Start free" : "Go Pro"}</h1>
<p>
  {eligible
    ? days
      ? `${days} days free, then ${annual?.variables.price ?? "the annual price"}.`
      : "Your trial is on the house."
    : "You have used your trial. Subscribe to keep going."}
</p>
<button>{eligible ? "Start free trial" : (annual?.variables.price ?? "Subscribe")}</button>
```

- **Fork every user-facing string, including the CTA.** A returning
  customer sees the ineligible copy, and it cannot read like a mistake.
- **Nest the fallbacks** — eligible-but-days-unknown needs its own
  sentence, never "undefined days free".
- `eligible` is `undefined` until the SDK reports, so gate trial-only UI
  on `eligible === true`.
- Trial length, price, and end date come from the product's variables
  (`trialPeriodDays`, `trialPeriodPrice`, `trialPeriodEndDate`) — never
  from the file.
- Check both states with the studio's trial toggle. Config can force
  either side for testing: `introductoryOfferEligibility:
  "alwaysEligible" | "alwaysIneligible"`.

`examples/trial-eligibility` is the reference. To remind users before a
trial ends, declare a notification in config — the SDK schedules it when
the trial starts ([config.md](config.md), `examples/trial-reminders`).

## Web checkout

One config key sells the same paywall on the web. Native hosts ignore it —
drop it and the paywall buys through the App Store; `purchase()` does not
change.

```ts
checkout: "sheet",
```

### Modes

| Mode | The purchase | Use when |
| --- | --- | --- |
| `sheet` | Stripe checkout in a sheet **over the paywall** — nobody leaves mid-flow | Default choice for the web |
| `applePay` | Straight to Apple Pay where available, sheet as fallback | Apple-Pay-heavy audiences |
| `external` | Superwall's hosted checkout page, then back | You want zero payment UI in the paywall |

Only `sheet`/`applePay` add payment UI to the paywall (~85 kB);
`external` adds nothing. Before shipping, read
https://superwall.com/docs/web-checkout.

With `sheet`/`applePay` and a Stripe product, the same `purchase()` call
opens the payment sheet in-page (a brief loading overlay covers the wait
unless the session was prefetched): `completed` on payment success,
`abandoned` when the shopper closes the sheet, `failed` on a payment or
session error.

> **Note:** the web sheet does not set `isPurchasing` — react to the
> awaited result, which is the right pattern everywhere anyway. A web
> paywall also typically drops the close button and restore link its
> native sibling carries — there is no host app to close back to.

### Prefetch — make the sheet open instantly

Creating a checkout session takes a network round-trip; prefetching does
it ahead of the tap.

**Automatic:** every `sheet`/`applePay` paywall warms its first Stripe
product on load. Steer it in config:

```ts
checkout: { mode: "sheet", prefetch: "pro" }   // which product warms first
checkout: { mode: "sheet", prefetch: false }   // disable auto-prefetch
```

**On selection — do this whenever there is a product selector.** The
default warms one plan; prefetch the selected one so whichever plan is on
screen opens instantly:

```tsx
const { purchase, prefetch } = usePurchase();
const [reference, setReference] = React.useState<ProductReference>("monthly");

React.useEffect(() => {
  prefetch(reference);
}, [prefetch, reference]);
```

`prefetch` is safe to call unconditionally — a no-op for store products,
for paywalls without web checkout, and for already-warm sessions
(sessions stay warm for ten minutes). It is a hint; never await it.

### The sheet is not yours to style

It takes no colors, fonts, or spacing from the page around it, and there
is no prop to change that. Payment UI that borrows the paywall's design
stops looking like payment UI — the one place a shopper is entitled to
see something they recognize. Safe areas, scroll locking, and Escape
(never mid-payment) are handled for you.

### Verify on a pushed version

`superwall dev` previews the flow and copy but does not mount the payment
sheet — push and open the live URL to verify the checkout itself.
