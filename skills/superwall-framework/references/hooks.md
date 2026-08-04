# Hooks

Everything a paywall reads or triggers comes through hooks from
`superwall/hooks`. One concern each — there is deliberately no
kitchen-sink hook.

```tsx
import {
  useProducts, usePurchase, useActions, useHaptics, useTranslation,
  useTrialEligibility, useDevice, useUser, useVariables, useColorScheme,
  useSuperwallEvent, useSuperwallSnapshot, useSuperwallSession,
  type ProductReference,
} from "superwall/hooks";
```

## `useProducts()`

```tsx
const { products, getProduct } = useProducts();
const annual = getProduct("annual");   // typed reference — typos are compile errors
```

Products, keyed by the reference declared in `config.ts`, with store-owned
`variables` (`price`, `period`, `trialPeriodDays`, …). Reading them
correctly has rules — see [checkout.md](checkout.md).

## `usePurchase()`

```tsx
const { purchase, prefetch, isPurchasing, transaction, failure } = usePurchase();

const result = await purchase("annual");
// { status: "completed" | "abandoned" | "failed" } — never throws for flow outcomes
```

The full purchase flow — outcomes, rules, web checkout, and
`prefetch` — is in [checkout.md](checkout.md).

## `useActions()`

```tsx
const { close, restore, openUrl, requestPermission, requestCallback } = useActions();
```

| Action | Use it for |
| --- | --- |
| `close()` | Closing the paywall — the X button. Closing is not navigation. |
| `restore()` | Restore purchases. Fire-and-forget: success arrives as a `transaction_complete` event or a dismissed paywall — there is no return value to await. |
| `openUrl(url)` | Terms, privacy, any link. **Always this, never `<a href>`** — in a webview an anchor does nothing or navigates the paywall away from itself. |
| `openExternalUrl(url)` | Open in the system browser instead of in-app. |
| `openDeepLink(link)` | Deep link into the app. |
| `customPlacement(name, params?)` | Fire a Superwall placement (can present another paywall). |
| `requestPermission(type)` | OS permission prompt. Resolves `"granted" \| "denied" \| "unsupported"`. |
| `requestCallback(name, options?)` | Run **your app's** code and await its answer. Resolves `{ status: "success" \| "failure", data? }`. |
| `requestStoreReview("in-app" \| "external")` | Store review prompt. |

Permission types: `notification`, `camera`, `microphone`, `location`,
`background_location`, `contacts`, `read_images`, `read_video` (Android
only), `tracking`.

**Permission vs callback:** a permission asks the OS; a callback asks your
app — anything the paywall cannot know (does this account exist, is this
referral valid). Both resolve from code the paywall does not control, so
show something while they run, and treat a denial as an ordinary outcome.
Type a callback's answer with a claim:
`requestCallback<{ exists: boolean }>("checkAccount")`.

In `superwall dev`, actions are logged in the studio's event log;
permission, callback, and purchase requests prompt **you** to pick the
outcome.

## `useHaptics()`

```tsx
const haptics = useHaptics();
haptics.light();      // navigation, CTAs
haptics.selection();  // changing a choice
haptics.success();    // purchase landed        (also: medium, heavy, warning, error)
```

Fire one on every meaningful tap — iOS produces no feedback of its own
inside a paywall. No-ops where unavailable.

## `useTranslation()`

```tsx
const { t } = useTranslation();
t("paywall.cta", { price });
```

Localized copy from `messages/<locale>.ts` catalogs — the full hook and
the catalog system are in [localization.md](localization.md).

## `useTrialEligibility()`

```tsx
const { eligible } = useTrialEligibility();   // boolean | undefined — the store decides
```

Splits the paywall into eligible and ineligible versions — both must read
as intentional. The full treatment is in
[checkout.md](checkout.md#trial-eligibility).

## `useVariables()`

```tsx
const { device, user, params } = useVariables();
```

Everything the app and SDK told this paywall about the presentation, in
three records:

- **`device`** — filled in by the SDK: `platform`, `deviceModel`,
  `osVersion`, `appVersion`, `deviceLocale`, `regionCode`,
  `deviceCurrencyCode`, `subscriptionStatus`, `activeEntitlements`,
  `daysSinceInstall`, `totalPaywallViews`, and more.
- **`user`** — whatever the app set via `setUserAttributes`
  (`user.firstName`, `user.plan`, …).
- **`params`** — whatever the placement was called with
  (`params.placementName`, plus anything the app passed).

```tsx
const name = typeof user.firstName === "string" ? user.firstName : undefined;
<h1>{name ? `Welcome back, ${name}` : "Go Pro"}</h1>
<span>{device.platform ?? "—"}</span>
```

> **Important:** guard every read — all three are filled in by the host.
> `?? "—"` suffices for `device` fields; for `user`/`params` the host
> controls the *type* too, so check it
> (`typeof params.placementName === "string"`). Note `device.isSandbox`
> is a string. Edit any of them live in the studio's Variables panel.

`examples/personalization` is the reference.

## `useUser()`

```tsx
const user = useUser();
```

Shorthand for `useVariables().user` when the device and params records
aren't needed.

## `useDevice()`

```tsx
const { orientation, platform, deviceModel } = useDevice();
```

The same device record as `useVariables().device`, plus **`orientation`**
(`"portrait" | "landscape"`) — measured in the page, so it updates the
moment the device turns. Use it for layouts that answer to rotation
(`examples/orientation` reflows to two columns in landscape).

## `useColorScheme()`

Rarely needed: the framework already keeps a `dark`/`light` class on
`<html>` from what the device reports, so style with plain CSS:

```css
:root { --bg: #fff; }
:root.dark { --bg: #1c1b19; }
```

`useColorScheme()` returns `"light" | "dark"` from the same source when
you need it in JS.

> **Important:** don't use `@media (prefers-color-scheme: dark)` as the
> mechanism — it cannot see what the device reports and ignores the
> studio's theme toggle. The class is the mechanism.

## `useSuperwallEvent(name, handler)`

```tsx
useSuperwallEvent("transaction_complete", () => haptics.success());
useSuperwallEvent("freeTrial_start", () => { /* trial began */ });
```

Typed SDK events, subscribed for the component's lifetime; an inline
arrow handler is fine. The event list and when each fires:
[lifecycle-and-events.md](lifecycle-and-events.md). For anything a
dedicated hook covers (products, trial, variables), use the hook — it
cannot miss data that arrived before your component subscribed.

## `useSuperwallSnapshot()`

```tsx
const snapshot = useSuperwallSnapshot();
const opened = snapshot.paywall !== undefined;
```

The whole runtime state as one subscribed object. Its most common use is
gating entry animations on presentation — paywalls are preloaded hidden,
and `snapshot.paywall` flips when the paywall is actually shown
([lifecycle-and-events.md](lifecycle-and-events.md)). It also carries
`experiment` (the A/B assignment), `locale`, and the current
purchase/transaction state.

## `useSuperwallSession()`

```tsx
const session = useSuperwallSession();
session.setUserAttributes({ onboardingCompleted: "true" });
```

The full session for advanced work — the few methods no hook surfaces
(`setUserAttributes`, raw protocol messaging) and use outside React
components. If you're reaching for it for products, purchases, actions,
or events, use the dedicated hook instead.
