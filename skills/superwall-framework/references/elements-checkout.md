# Build your own checkout form from Stripe's elements

`checkout: "elements"` lets a paywall build its own checkout form from
Stripe's own elements (wallet buttons, a card form, an email field, an
address) while superwall prices the form, takes the payment, runs 3D Secure
and the free trial, and completes the purchase with entitlements and
redemption, exactly as Apple Pay and the sheet do. The project installs
nothing from Stripe and runs no backend. The `elements-checkout` example is
the reference implementation; its chips switch between ten layouts of the
same purchase.

## Which mode

| The paywall wants                                                   | `checkout`               |
| ------------------------------------------------------------------- | ------------------------ |
| To leave for Superwall's hosted checkout page and come back          | `"external"` (default)   |
| Stripe's ready-made payment sheet, no design work                    | `"sheet"`                |
| One key straight to Apple Pay, the sheet where it isn't available    | `"applePay"`             |
| Its own form: card fields, wallets, Link, in the paywall's design    | `"elements"`             |

Pick `elements` when the card form sits on the paywall itself, styled like
it, or when an existing custom Stripe checkout is being moved onto
superwall. Pick `sheet` when nobody wants to design a form, and `applePay`
when Apple Pay is the only button. In `elements` mode a plain
`purchase(product)` still opens the sheet, and superwall's Apple Pay sheet is
prepared too (see [Recipes](#recipes)).

```ts
// config.ts
checkout: { mode: "elements", prefetch: "trial" },
products: {
  trial: "test:price_1R7OiTBmoUO4I4NSACz7JoAy:3days-free",
  monthly: "test:price_1RJpYPBmoUO4I4NSX0AUMLee:no-trial",
},
```

`prefetch` names the product whose price loads as the paywall opens
(default: the first Stripe product; `false` turns it off), so the form
renders without a wait. Any other product loads when `<StripeCheckout>`
first asks for it. `prepaidCards: "block"` can't filter an `elements`
payment; only the sheet fallback refuses prepaid cards.

## The imports

```tsx
import { PurchaseButton, useCheckout } from "superwall/checkout";
import {
  ExpressCheckoutElement,
  LinkAuthenticationElement,
  PaymentElement,
  StripeCheckout,
} from "superwall/checkout/stripe";
```

- **`superwall/checkout`** holds what every store's form shares:
  `useCheckout()`, `<PurchaseButton>` and their types (`UseCheckoutResult`,
  `CheckoutAmounts`, `CheckoutSubmitResult`, `CheckoutUnavailableReason`,
  `CheckoutFailure`, `PurchaseButtonProps`). Build the CTA, the "due today"
  line and the failure notice on these, so they work unchanged in another
  store's form.
- **`superwall/checkout/stripe`** holds what is Stripe's: `<StripeCheckout>`,
  `StripeCheckoutOptions`, `StripeCheckoutProps`, and Stripe's elements.
  Import from it only inside the Stripe form. A paywall that never imports it
  never ships Stripe's React bindings.
- **Never import from `@stripe/react-stripe-js` or `@stripe/stripe-js`, and
  never install them.** A project's own copy of Stripe's React package has
  its own context: its elements can't see `<StripeCheckout>` and throw
  "Could not find Elements context".

## A form

```tsx
import { useMemo } from "react";
import { PurchaseButton, useCheckout } from "superwall/checkout";
import {
  ExpressCheckoutElement,
  LinkAuthenticationElement,
  PaymentElement,
  StripeCheckout,
  type StripeCheckoutOptions,
} from "superwall/checkout/stripe";
import { usePurchase } from "superwall/hooks";
import { useRouter } from "superwall/navigation";

const Summary = ({ product }: { product: Plan }) => {
  const { status, amounts, failure } = useCheckout();
  const label = amounts?.trialDays ? "Start free trial" : "Subscribe";
  if (status === "unavailable") return <PlainPurchase product={product} />;
  return (
    <>
      {failure ? <p role="status">{failure.message ?? "Your payment was declined."}</p> : null}
      <PurchaseButton className="button">
        {status === "paying" ? "Paying…" : label}
      </PurchaseButton>
    </>
  );
};

// Where the form can't take payment (inside the iOS app, Studio, an SDK
// below 4.10.8), the paywall still sells: purchase() opens hosted checkout.
const PlainPurchase = ({ product }: { product: Plan }) => {
  const { purchase } = usePurchase();
  return (
    <button className="button" onClick={() => void purchase(product)}>
      Subscribe
    </button>
  );
};

type Plan = "annual" | "monthly";

export function Checkout({ product }: { product: Plan }) {
  const router = useRouter();
  const options = useMemo<StripeCheckoutOptions>(
    () => ({ appearance: { theme: "flat" } }),
    [],
  );
  return (
    <StripeCheckout product={product} options={options} onComplete={() => router.push("welcome")}>
      <ExpressCheckoutElement />
      <LinkAuthenticationElement />
      <PaymentElement options={{ layout: "tabs" }} />
      <Summary product={product} />
    </StripeCheckout>
  );
}
```

The rules this follows, each one broken in real builds:

1. **Every purchase needs an email.** It is the subscription customer's
   email: the receipt, the redemption link and the billing portal hang on
   it. See [The email](#the-email).
2. **`options` is stable.** Build it with `useMemo` (or a module constant). A
   new object on every render makes Stripe redraw every field.
3. **`unavailable` is a state to design for, not an error.** Inside the iOS
   app, in Studio and on SDKs below 4.10.8 the form reports `unavailable`
   and Stripe's elements render nothing; offer `usePurchase().purchase()`
   there, which opens hosted checkout.
4. **The trial label reads `amounts.trialDays`**, not `dueNow === 0`: a 100%
   discount makes `dueNow` `0` with no trial.
5. **`<PurchaseButton>` says it is paying.** It disables itself while a
   payment runs and its label reads "Paying…" from `status === "paying"`. This
   is the one exception to "never put a purchase button in a loading state":
   a card payment opens no store sheet, so the paywall is the only feedback,
   and without it the shopper sees nothing for a few seconds and taps again.

## `<StripeCheckout>`

A form for one Stripe product. It renders at once from the product's price;
nothing is created in Stripe until the shopper pays. Switching `product`
re-prices the form and Stripe's fields keep what was typed.

| Prop             | What it takes                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `product`        | The Stripe product, by reference (`"annual"`) or as a product. Required.                                                                                                 |
| `options`        | `StripeCheckoutOptions`: Stripe's Elements options (`appearance`, `fonts`, `locale`, `loader`, `paymentMethodTypes`…), minus `mode`, `amount`, `currency`, `paymentMethodCreation` and `setupFutureUsage`, which come from the product. Default: Stripe's own. |
| `email`          | The shopper's email from the paywall's own field. Pass `""` while it is empty. Default: see [The email](#the-email).                                                     |
| `stripeMetadata` | Metadata set on the Stripe subscription. Default: none.                                                                                                                  |
| `postPurchase`   | What happens after the purchase, as for `purchase()`. Default: the paywall's config.                                                                                      |
| `onStart`, `onSubmit`, `onComplete`, `onAbandon`, `onFailure` | `usePurchase`'s callbacks, fired for this form's purchases only. See [Events](#events).                                                    |
| `children`       | The form: Stripe's elements from `superwall/checkout/stripe`, a `<PurchaseButton>`, any UI of the paywall's.                                                               |

`locale` defaults to the paywall's locale, so Stripe's labels and errors
match the paywall's language. `paymentMethodTypes` defaults to
`["card", "link"]`, which covers cards, Apple Pay, Google Pay and Link; any
other type is dropped with a console warning (see [Limits](#limits)).

## `useCheckout()`

Read it from any component inside `<StripeCheckout>`; outside one it throws.

| Field       | What it holds                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `status`    | `"preparing"` (Stripe.js and the price are loading), `"ready"`, `"paying"`, `"unavailable"`                                            |
| `reason`    | Why it is `unavailable` (below). Set only then.                                                                                       |
| `message`   | The reason in an English sentence, for logs and a notice.                                                                             |
| `error`     | What the browser or Stripe threw, when a step threw (`{ name, message }`).                                                             |
| `product`   | The product the form sells. Absent when the paywall has no such product.                                                              |
| `amounts`   | `CheckoutAmounts`, absent until the price loads: `currency` (lowercase ISO), `dueNow`, `recurring` (after any discount), `interval`, `intervalCount`, `trialDays?`, `discount?` |
| `canSubmit` | `status === "ready"`                                                                                                                  |
| `submit()`  | Pays with what the shopper entered. Resolves a `CheckoutSubmitResult`.                                                                |
| `failure`   | `CheckoutFailure` of the last payment, cleared when the next starts.                                                                  |

Amounts are in the currency's minor units, and not every currency has two
decimals (yen has none). Format them with the currency's own digits:

```ts
const formatAmount = (amount: number, currency: string) => {
  const format = new Intl.NumberFormat(undefined, { style: "currency", currency });
  return format.format(amount / 10 ** (format.resolvedOptions().maximumFractionDigits ?? 2));
};
```

**`submit()` results.** `completed`, `abandoned` and `failed` are a purchase
and reach every callback. `incomplete` means no purchase started: the
fields are not filled in (they already show the shopper what is missing), the
form has no email (`error.name === "email_required"`), or Stripe refused to
read the form, such as when no `PaymentElement` is mounted. `unavailable`
carries a `reason`, which is also `"preparing"` or `"paying"` when the form
wasn't ready or is already paying.

**Unavailable reasons** (`CheckoutUnavailableReason`):

| `reason`                 | When                                                                                         | What the paywall does                     |
| ------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `unsupported_host`       | Inside the iOS app, in Studio, or an SDK below 4.10.8                                         | Offer `usePurchase().purchase()`          |
| `external_checkout`      | The config's `checkout` isn't `"elements"`                                                    | Fix `config.ts`                           |
| `missing_public_api_key` | The host supplied no public API key                                                          | A host or setup problem; log it           |
| `unknown_product`        | The paywall has no product with this reference                                               | Point the identifier at a dashboard product |
| `unsupported_product`    | Not a Stripe product, such as an App Store product                                           | Buy it with `usePurchase().purchase()`    |
| `session_failed`         | Fetching the price failed; `error` holds why                                                 | Show the notice; offer `purchase()`       |
| `session_unsupported`    | The backend can't take this product in a form, such as a one-time price                      | Use `purchase()`                          |
| `store_load_failed`      | Stripe.js didn't load                                                                        | Show the notice; offer `purchase()`       |

**Failure reasons** are the same `CheckoutFailureReason`s as every web
purchase (`card_declined`, `insufficient_funds`, `expired_card`,
`incorrect_card_details`, `authentication_failed`, `card_not_supported`,
`limit_exceeded`, `fraud_suspected`, `processing_error`, `unknown`), with
Stripe's `code`, `declineCode` and `message`. A decline keeps the form open
for another card; show `failure.message` and let the shopper pay again. If
a promotion code or a sign-in replaces the price while the shopper is
paying, the payment is refused before any charge with `reason: "unknown"`,
`code: "quote_changed"`.

## `<PurchaseButton>`

`useCheckout().submit` on a `<button>`: disabled until the form can pay and
while it pays, with `data-status` set to `status` and `aria-busy` while
paying, so CSS can style each state. Every other prop goes to the button;
`onClick` runs first and `event.preventDefault()` stops the payment. It
shows nothing for an `incomplete` result. A paywall with its own email box
pays from its own button instead and shows the result's `error.message`:

```tsx
import { useState } from "react";
import { useCheckout } from "superwall/checkout";

const PayButton = ({ label }: { label: string }) => {
  const { canSubmit, submit, status } = useCheckout();
  const [problem, setProblem] = useState<string>();
  return (
    <>
      {problem ? <p role="status">{problem}</p> : null}
      <button
        disabled={!canSubmit}
        onClick={async () => {
          setProblem(undefined);
          const result = await submit();
          if (result.status === "incomplete") setProblem(result.error.message);
        }}
      >
        {status === "paying" ? "Paying…" : label}
      </button>
    </>
  );
};
```

## The email

Every purchase needs one. The form takes the first of:

1. the `email` prop, for a paywall that collects it in its own `<input>`
   (pass `""` while empty);
2. the email typed into `LinkAuthenticationElement`, which also signs a Link
   shopper in;
3. the email on the card's or wallet's billing details (a wallet in
   `ExpressCheckoutElement` is always asked for one);
4. the user's `email` attribute, which also pre-fills
   `LinkAuthenticationElement`.

With none of these, the form logs a warning once it is ready, and a card
payment returns `incomplete` with `email_required` and charges nothing. So
render `LinkAuthenticationElement` above the card form, pass your own
field's value as `email`, or set the `email` attribute before the paywall
shows; a wallets-only form needs nothing more.

## Which Stripe elements work

`superwall/checkout/stripe` re-exports Stripe's components unchanged, with
every option Stripe documents (`PaymentElement`'s `layout: "tabs"` or
`"accordion"`, `fields`, `wallets`, `terms`, `defaultValues`…). Two are
wrapped because superwall needs their events; their props are Stripe's,
minus the handlers superwall owns.

| Element                                                                   | Supported | Notes                                                                                     |
| ------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| `PaymentElement`                                                          | Yes       | Cards and Link                                                                            |
| `ExpressCheckoutElement`                                                  | Wrapped   | Apple Pay, Google Pay, Link. superwall owns `onClick`, `onConfirm` and `onCancel`; `onReady` and the rest are yours |
| `LinkAuthenticationElement`                                               | Wrapped   | Hands the email to the purchase; pre-filled from the user's `email` attribute              |
| `AddressElement`                                                          | Yes       | `mode: "billing"`: the address goes onto the payment method                               |
| `CardElement`, `CardNumberElement`, `CardExpiryElement`, `CardCvcElement` | Yes       | The classic card fields; styled with `options.style`, not `appearance`                    |
| `useStripe()`, `useElements()`                                            | Yes       | For reading the form; never confirm with them, call `useCheckout().submit()`              |
| `ShippingAddressElement`, `AddressElement` with `mode: "shipping"`        | No        | A subscription ships nothing, and the purchase has nowhere to send it                     |
| `TaxIdElement`                                                            | No        | The purchase has nowhere to send a tax ID                                                 |
| `IbanElement`, SEPA, ACH, iDEAL, Klarna, Afterpay, Cash App Pay           | No        | They redirect or need a bank mandate: a return-and-resume flow superwall doesn't have     |
| `PaymentMethodMessagingElement`                                           | No        | It advertises the buy-now-pay-later methods above                                         |
| `EmbeddedCheckout`, `CheckoutProvider`                                    | No        | Stripe's own hosted checkout: use `checkout: "sheet"` instead                             |

Saved cards and a customer's earlier payment methods aren't offered: the
form pays as a new customer each time. A promotion code box is not a Stripe
element: it is a plain input on `useDiscount()`, superwall's own codes, and
a redeemed code re-prices the form and the charge.

## Matching the paywall's design

Stripe draws its fields in its own frame, so they can't read the paywall's
CSS variables. The example's `components/appearance.ts` is the pattern:

- **Resolve the tokens to plain colours.** Read each CSS variable from the
  surface's `theme.css` (`--surface`, `--fg`, `--fg-muted`, `--border`,
  `--accent`…) through `getComputedStyle`, turn it into `rgb()`, and read
  them again when the root's `light`/`dark` class changes.
- **`appearance.variables`**: `colorBackground` is the plan rows' surface,
  not the page background; text, placeholder, accent, `colorDanger`, font,
  `fontSizeBase: "16px"` and the corner radius come from the tokens.
- **`appearance.rules`**: a hairline border and `boxShadow: "none"` on
  `.Input`, `.Tab`, `.AccordionItem` and `.Block` (Link's "save my
  information" box), and the accent border on `.Input:focus` and
  `.Tab--selected`, so every field matches the paywall's own inputs.
- **`fonts`**: the font file itself, `{ family, src: "url(…woff2)", weight }`,
  never a `cssSrc` stylesheet. Stripe fetches `cssSrc` from the paywall's
  page, where the hosted page's Content Security Policy blocks Google Fonts;
  a font file loads inside Stripe's frame.
- **The classic card fields** take `options.style` (`base`, `invalid`,
  `::placeholder`) instead of `appearance`; wrap each in the paywall's own
  input class for the surface, border and focus edge.
- **Wallet buttons** take `buttonHeight` and `buttonType` in
  `ExpressCheckoutElement`'s options; `buttonType: { applePay: "plain" }`
  shows the bare Apple Pay logo, the same size as Link's button.
- **Memoize the result.** Return the options from `useMemo` keyed on the
  palette; a new object on every render redraws every field.

## Recipes

Elements are plain components: put them in any order, around any UI.

- **Apple Pay, Link and a card (recommended).** superwall's own Apple Pay
  sheet on a button of the paywall's own, because it is the most fully
  instrumented path; Link alone in the express row; the card form with its
  wallets off so no wallet shows twice. In `elements` mode the paywall
  prepares the Apple Pay sheet from the form's price, so the button opens it
  at once:

  ```tsx
  const ApplePayButton = ({ product }: { product: "annual" }) => {
    const { product: wallet } = useApplePay(product);
    const { purchase } = usePurchase();
    return wallet.status === "ready" ? (
      <button className="apple-pay" onClick={() => void purchase(product, { checkout: "applePay" })} />
    ) : null;
  };

  <StripeCheckout product="annual" options={options}>
    <ApplePayButton product="annual" />
    <ExpressCheckoutElement
      options={{ paymentMethods: { applePay: "never", googlePay: "never", link: "auto" } }}
    />
    <LinkAuthenticationElement />
    <PaymentElement options={{ layout: "tabs", wallets: { applePay: "never", googlePay: "never" } }} />
    <PurchaseButton>Subscribe</PurchaseButton>
  </StripeCheckout>
  ```

  Use the full `ExpressCheckoutElement` only when the paywall wants every
  express method together in Stripe's row.
- **Only one wallet in the row.** `paymentMethods` turns the others off:
  `{ applePay: "auto", googlePay: "never", link: "never" }`.
- **A divider beside the wallets.** The express row renders nothing on a
  device with no wallet, so show "or pay with card" only after
  `ExpressCheckoutElement`'s `onReady` reports one:
  `onReady={({ availablePaymentMethods }) => setShown(Object.values(availablePaymentMethods ?? {}).some(Boolean))}`.
- **Wallets only.** Just `ExpressCheckoutElement`, no CTA: the wallet pays
  and asks for the email itself.
- **Split card fields.** `CardNumberElement`, `CardExpiryElement`,
  `CardCvcElement` (or the one-line `CardElement`), the paywall's own email
  `<input>` passed as `email`, and its own button on `submit()` that shows
  an `incomplete` message.
- **Billing address.** `AddressElement` with `mode: "billing"`; put the
  paywall's own tags on the subscription with `stripeMetadata`.
- **Promotion code.** A plain input calling `useDiscount().redeem(code)`; the
  form re-prices and `amounts.discount` is set.

## Events

`usePurchase` callbacks hear every purchase on the paywall, superwall's
Apple Pay sheet included; `<StripeCheckout>`'s hear only that form's. The
native SDK gets the matching `stripe_checkout_*` messages, so a
`transaction_abandon` reaches its analytics.

| What the shopper does                      | Callbacks, in order                         |
| ------------------------------------------ | ------------------------------------------- |
| Pays with a card                           | `onStart`, `onSubmit`, `onComplete`         |
| Pays with an incomplete form or no email   | nothing: `submit()` returns `incomplete`    |
| Card declined                              | `onStart`, `onSubmit`, `onFailure` (reason) |
| Pays again after a decline                 | a new `onStart`, then as above              |
| Fails 3D Secure                            | `onStart`, `onSubmit`, `onFailure`          |
| Opens Link or a wallet in the express row  | `onStart`                                   |
| … and pays                                 | `onSubmit`, `onComplete`                    |
| … and closes it                            | `onAbandon`                                 |
| Taps superwall's Apple Pay button and pays | `onStart`, `onSubmit`, `onComplete`         |
| … and closes the sheet                     | `onAbandon` (from `usePurchase` only)       |

A card form never fires `onAbandon`. The callbacks don't say which method
paid; a paywall that needs it knows which of its buttons the shopper used.

## Migrating an existing Stripe checkout

A custom Stripe checkout usually has an `<Elements>` provider with a client
secret, a server endpoint that creates the PaymentIntent or subscription, a
`stripe.confirmPayment()` call on submit and a webhook that grants access.

1. **Set the mode.** `checkout: { mode: "elements" }` in `config.ts`, and
   the Stripe products in `products`.
2. **Swap the provider.** Replace `<Elements stripe={…} options={{ clientSecret }}>`
   with `<StripeCheckout product="annual">`. Move `appearance`, `fonts`,
   `locale` and `paymentMethodTypes` into its `options`; drop
   `clientSecret`, `mode`, `amount` and `currency`, which come from the
   product.
3. **Keep the elements.** Same props, imported from
   `superwall/checkout/stripe` instead of `@stripe/react-stripe-js`; remove
   the `@stripe/*` dependencies.
4. **Swap the submit.** Where you called `elements.submit()` and
   `stripe.confirmPayment()`, call `useCheckout().submit()`, or render
   `<PurchaseButton>`. 3D Secure, trials and failures are handled.
5. **Collect the email.** Keep `LinkAuthenticationElement`, or pass your own
   field's value as `email`.
6. **Move the metadata.** What you put on the subscription goes in
   `stripeMetadata`.
7. **Delete the backend.** The PaymentIntent endpoint and the
   access-granting webhook go: superwall creates the subscription, grants
   the entitlement and redeems it in the app.
8. **Move the reactions.** Success and error handling moves to
   `onComplete`, `onFailure` and `onAbandon` on `<StripeCheckout>`, or to
   `usePurchase()`'s callbacks.

Any element from the unsupported list has no place in the port; drop it
or keep that product on the hosted checkout.

## Limits

- **Only card and Link.** `paymentMethodTypes` beyond `card` and `link` are
  dropped with a console warning. A payment method of any other type, say
  from an `IbanElement` imported straight from Stripe's package, fails with
  `card_not_supported` (code `payment_method_unsupported`) before anything
  is charged. Redirect and bank-debit methods need a return-and-resume flow
  that doesn't exist yet.
- **Not inside the iOS app.** There `status` is `unavailable`
  (`unsupported_host`) and a purchase opens hosted checkout in the browser.
  Studio and SDKs below 4.10.8 report the same; a teleport page and a web
  paywall take payment.
- **Studio never pays.** The preview shows the form's `unavailable` state;
  try a real payment on a published web paywall with Stripe test cards:
  `4242 4242 4242 4242` pays, `4000 0000 0000 0002` is declined,
  `4000 0025 0000 3155` asks for 3D Secure.
- **Subscriptions only.** A one-time price reports `session_unsupported`.
