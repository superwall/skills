# `config.ts` — `definePaywall`

Every paywall declares itself in a required `config.ts`: its dashboard
name, its products, and any behavior settings. This file is the whole
truth for the paywall — nothing is inherited from anywhere else.

```ts
import { definePaywall } from "superwall/config";

export default definePaywall({
  name: "Plus — Annual, 3-day trial",
  products: {
    monthly: "pro_999_month",
    annual: "pro_5999_year",
  },
});
```

TypeScript is the only validation — keep the object literal inline so
typos are caught. To share settings between paywalls, export a plain
object and spread it:

```ts
// superwall/components/shared-config.ts
export const shared = { transition: "slide", purchaseTimeoutMs: 300_000 } as const;

// paywalls/pro/config.ts
export default definePaywall({ ...shared, name: "Pro", products: { … } });
```

## Options

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `name` | `string` | directory name, title-cased | The label in the dashboard. The directory stays the identifier. |
| `products` | `Record<string, string \| { productId }>` | — | Product slots by reference (below). |
| `transition` | `"push" \| "slide" \| "fade" \| "none"` or custom | `"push"` | Default page transition ([navigation.md](navigation.md)). |
| `checkout` | mode or `{ mode, prefetch? }` | — | Sell on the web. Omit for native-only ([checkout.md](checkout.md)). |
| `presentation` | see below | — | How the native SDK presents the paywall. |
| `featureGating` | `"gated" \| "nonGated"` | `"nonGated"` | Whether users must pay to pass. |
| `introductoryOfferEligibility` | `"automatic" \| "alwaysEligible" \| "alwaysIneligible"` | `"automatic"` | Trial eligibility — `automatic` lets the store decide. |
| `dismissOnPurchase` | `boolean` | — | Auto-dismiss after a completed purchase. |
| `purchaseTimeoutMs` | `number` | — | Resolve a purchase as failed after this long with no result. |
| `notifications` | `{ trialReminder }` | — | Trial-reminder notification (below). |
| `localization` | `{ defaultLocale, messages? }` | `"en"` | Fallback locale; file-based catalogs need no config ([localization.md](localization.md)). |
| `scrollEnabled` | `boolean` | `true` | Whether the paywall scrolls. |
| `gameControllerEnabled` | `boolean` | — | Forward game-controller input. |
| `onDeviceCacheEnabled` | `boolean` | `true` | Cache the paywall on device. |

There is deliberately **no identifier field** — the directory path is the
identity, and the dashboard binding lives in `superwall.lock`
([project.md](project.md)).

### `presentation`

```ts
presentation: {
  style: "fullscreen" | "modal" | "push" | "drawer" | "popup" | "noAnimation",  // default "fullscreen"
  condition: "checkUserSubscription" | "always",                                // default "checkUserSubscription"
  drawer: { height, cornerRadius },          // when style === "drawer"
  popup: { width, height, cornerRadius },    // when style === "popup"
}
```

## Products

```ts
products: {
  annual: "pro_5999_year",                    // shorthand
  monthly: { productId: "pro_999_month" },    // same thing
}
```

The **key is the reference** — the name your code uses
(`getProduct("annual")`, `purchase("annual")`). The **value is the store
identifier**. Web/Stripe products use the
`{test|live}:price_…:{offer}` identifier format
([checkout.md](checkout.md)).

Product **data** — price, period, trial — never appears in this file. It
is store-owned and arrives at runtime; a reference the dashboard has no
product for renders undefined variables and blocks publishing. See
[checkout.md](checkout.md).

## Trial reminder notifications

Declare a local notification and the SDK schedules it when a trial
actually starts — the paywall does not need to be open when it fires:

```ts
notifications: {
  trialReminder: {
    title: "Your trial ends tomorrow",
    body: "Keep Pro, or cancel in Settings — no charge either way.",
    beforeTrialEndDays: 1,        // default 1
  },
},
```

`title`/`subtitle`/`body` accept message keys (resolved through `t()`) or
literal copy. For full control, pass a function instead — it receives
`{ trialEndDate, product, t, locale }` and returns
`{ title, body, delayMs }` (or `null` to skip). See
`examples/trial-reminders`.

## Experimenting

Variables are not declared in code. What the paywall reads —
`useVariables()`, product variables, trial eligibility — is supplied by
the app and the store, and the studio overrides all of it live while
previewing. Write paywalls to read variables defensively and every one of
them is experimentable from the dashboard without a rebuild.
