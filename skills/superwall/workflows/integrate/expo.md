# Integrate Superwall - Expo

You are integrating Superwall into an Expo app using the **`expo-superwall`**
package (the modern, recommended SDK - hooks + provider API). Get it installed and
configured. **Do not add paywall triggers (`usePlacement` / `registerPlacement`)**;
that is the separate **superwall-placements** skill.

**Requirements:** Expo SDK **53+**, iOS deployment target **15.1+** (**16.4+** for
Expo SDK 56+), Android **minSdkVersion 21+**. **Expo Go does not work** - you must
use a Development Build (custom dev client). See Pitfalls.

## Checklist

- [ ] **0. Decide the purchase-handling path** (default / RevenueCat / custom).
- [ ] **1. Install** `expo-superwall` + `expo-build-properties`; produce a native build.
- [ ] **2. Configure** - wrap the root in `SuperwallProvider` with per-platform `pk_` keys.
- [ ] **3. API keys** via `EXPO_PUBLIC_*` env vars (public keys, never secrets).
- [ ] **4. Purchase handling** for the chosen path.
- [ ] **5. Build a dev client** (NOT Expo Go) - native module links.
- [ ] **6. Run** - logs show Superwall startup; StoreKit test config if testing purchases.
- [ ] **7. Post-integration** (identity, attributes, subscription state, deep links, analytics) - final section, then → **superwall-placements**.

## Docs access - read the current page when baked steps aren't enough

Superwall's docs are fetchable **as markdown**. Fetch instead of guessing:

```bash
curl -sL https://superwall.com/docs/expo/llms.txt          # index: every Expo doc path
curl -sL https://superwall.com/docs/llms-full.txt          # broad context across all SDKs
curl -sL https://superwall.com/docs/expo/quickstart/configure.md   # any page + ".md"
```

Pattern: fetch `expo/llms.txt` for the slug, then
`https://superwall.com/docs/expo/{path}.md`. Every `curl` here is verified working.
The Expo SDK is hooks-based (`useUser`, `usePlacement`, `useSuperwallEvents`) and
its component API (`SuperwallProvider`, `SuperwallLoading`/`SuperwallLoaded`,
`CustomPurchaseControllerProvider`) differs from the native SDKs - **never invent a
hook or prop**; fetch the SDK-reference page and confirm.

## Quickstart walk

| Order | Slug                                          | Covered by                     |
| ----- | --------------------------------------------- | ------------------------------ |
| 1     | `expo/quickstart/install`                     | Step 1 here                    |
| 2     | `expo/quickstart/configure`                   | Step 2 here                    |
| 3     | `expo/quickstart/present-first-paywall`       | **superwall-placements** skill |
| 4     | `expo/quickstart/feature-gating`              | **superwall-placements** skill |
| 5     | `expo/quickstart/in-app-paywall-previews`     | placements / QA                |
| 6     | `expo/quickstart/setting-user-properties`     | Step 7 here                    |
| 7     | `expo/quickstart/tracking-subscription-state` | Step 7 here                    |
| 8     | `expo/quickstart/user-management`             | Step 7 here                    |

SDK-reference index (components + hooks):
`curl -sL https://superwall.com/docs/expo/llms.txt`

## Step 0 - Purchase-handling path (decide first)

> **Important:** Paths (b) and (c) require you to keep subscription status in sync
> yourself via `setSubscriptionStatus`. Path (a) does not.

- **(a) Default - Superwall handles StoreKit/Billing.** No existing IAP code.
  Recommended, zero purchase code. Just use `SuperwallProvider`.
- **(b) RevenueCat stays the source of truth.** Keep RC purchasing and sync its
  entitlements into Superwall. `curl -sL https://superwall.com/docs/expo/guides/using-revenuecat.md`
- **(c) Custom purchase controller.** The app has its own billing. Supply a
  `PurchaseController` via `CustomPurchaseControllerProvider` and drive status.

For a full migration off another SDK, use the **superwall-migrate** skill.

## Step 1 - Install

Detect the package manager from the lockfile. Use `expo install` so versions match
the Expo SDK.

```bash
curl -sL https://superwall.com/docs/expo/quickstart/install.md
```

```bash
npx expo install expo-superwall
# or: pnpm dlx expo install expo-superwall / yarn dlx expo install expo-superwall / bunx expo install expo-superwall
```

Also install and configure `expo-build-properties` to guarantee native minimums:

```bash
npx expo install expo-build-properties
```

Merge into the **existing** `plugins` array in `app.json` / `app.config.js` (don't
create a second one):

```json
{
  "expo": {
    "plugins": [
      ["expo-build-properties", {
        "ios": { "deploymentTarget": "15.1" },
        "android": { "minSdkVersion": 21 }
      }]
    ]
  }
}
```

(For Expo SDK 56+, set `"deploymentTarget": "16.4"`.)

`expo-superwall` is a native module, so produce a **native build**:

```bash
npx expo run:ios      # or: npx expo run:android
```

For an **existing** project whose `ios/`/`android/` predate the install, regenerate
them (back up custom native code first):

```bash
npx expo prebuild --clean
```

## Step 2 - Configure

Wrap the app root in `SuperwallProvider` with per-platform public keys. Place it at
the very top of the tree - the root `App` component, or `app/_layout.tsx` for
expo-router so it mounts once above every route.

```bash
curl -sL https://superwall.com/docs/expo/quickstart/configure.md
```

```tsx
import { SuperwallProvider } from "expo-superwall";

export default function App() {
  return (
    <SuperwallProvider
      apiKeys={{
        ios: process.env.EXPO_PUBLIC_SUPERWALL_IOS_KEY!,
        android: process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_KEY!,
      }}
    >
      {/* your existing app tree */}
    </SuperwallProvider>
  );
}
```

`apiKeys` takes `ios` and optionally `android`. `SuperwallProvider` configures the
SDK on mount - **do not** also call a separate `configure()`. Optional behavior
goes through the `options` prop:

```tsx
<SuperwallProvider apiKeys={{ ios: "...", android: "..." }} options={{ /* ... */ }}>
```

To gate UI on SDK readiness, `SuperwallLoading` / `SuperwallLoaded` are available
(see the SDK-reference components).

## Step 3 - API key handling

Use the **Public API Key(s)** (`pk_…`) from Dashboard ▸ Settings ▸ Keys - iOS and
Android apps each have their own key. Store as `EXPO_PUBLIC_`-prefixed env vars
(readable in JS at build time) in `.env` / `app.config.js`. Public keys aren't
secrets, but `EXPO_PUBLIC_*` keeps them out of source and lets environments differ.
**Never** put a secret/server key here.

## Step 4 - Purchase handling (implements Step 0's choice)

### (a) Default

Just use `SuperwallProvider` as above. Superwall manages purchases, restores, and
subscription status.

### (b) RevenueCat / (c) custom

Supply a `PurchaseController` through `CustomPurchaseControllerProvider`. Read the
page before writing - the exact wiring differs between the hooks API and the compat
API:

```bash
curl -sL https://superwall.com/docs/expo/guides/advanced-configuration.md
```

The controller implements `purchaseFromAppStore(productId)`,
`purchaseFromGooglePlay(productId, basePlanId?, offerId?)`, and `restorePurchases()`:

```tsx
export class MyPurchaseController extends PurchaseController {
  async purchaseFromAppStore(productId: string): Promise<PurchaseResult> { /* ... */ }
  async purchaseFromGooglePlay(
    productId: string, basePlanId?: string, offerId?: string
  ): Promise<PurchaseResult> { /* ... */ }
  async restorePurchases(): Promise<RestorationResult> { /* ... */ }
}
```

> **Important (paths b & c):** keep subscription status in sync whenever
> entitlements change. Via the `useUser` hook:
>
> ```tsx
> const { setSubscriptionStatus } = useUser();
> setSubscriptionStatus({ status: "ACTIVE", entitlements: [{ id: "pro" }] });
> // or: setSubscriptionStatus({ status: "INACTIVE" });
> ```
>
> Or via the shared instance:
> `Superwall.shared.setSubscriptionStatus(SubscriptionStatus.Active([new Entitlement("pro")]))`
> / `SubscriptionStatus.Inactive()`. For (b), map RevenueCat's active entitlements
> into that call. Confirm shapes against the advanced-configuration page.

## Step 5 & 6 - Verify

1. **Build a dev client** and run it: `npx expo run:ios` / `npx expo run:android`
   (NOT Expo Go). Must compile with the native module linked.
2. Watch Metro/Xcode/Android logs on launch for Superwall SDK startup.
   > **Important:** Superwall does **not** refetch config on hot reload - fully
   > restart the app after changing SDK setup.
3. For iOS purchases in the simulator, read the StoreKit testing guide:
   `curl -sL https://superwall.com/docs/expo/guides/testing-purchases.md`

## Step 7 - Post-integration (wire what the app needs, then → placements)

The Expo SDK exposes these through the **`useUser`** hook and event hooks.

- **User identity - REQUIRED if the app has ANY auth/login system.** Not optional: without it every logged-in user is anonymous to Superwall, breaking user-scoped audiences, attribution, and cross-device status. Wire it the moment you see a login/logout flow (grep for signIn/login/logout/signOut/auth). `identify(userId)` on login, `signOut()` on logout. `userId`
  should be a **UUID** (StoreKit compat), never an email/device id/guessable value.
  `curl -sL https://superwall.com/docs/expo/quickstart/user-management.md`
  ```tsx
  const { identify, signOut } = useUser();
  await identify(user.id);
  signOut();
  ```
- **User attributes** - `curl -sL https://superwall.com/docs/expo/quickstart/setting-user-properties.md`
- **Tracking subscription state** - read `subscriptionStatus` from `useUser`
  (`status` is `"ACTIVE" | "INACTIVE" | "UNKNOWN"`); react to changes with
  `useSuperwallEvents({ onSubscriptionStatusChange })`.
  `curl -sL https://superwall.com/docs/expo/quickstart/tracking-subscription-state.md`
  ```tsx
  const { subscriptionStatus } = useUser();
  if (subscriptionStatus?.status === "ACTIVE") { /* entitled */ }
  ```
- **Deep links** - `curl -sL https://superwall.com/docs/expo/guides/handling-deep-links.md`
- **3rd-party analytics** - forward events via `useSuperwallEvents`.
  `curl -sL https://superwall.com/docs/expo/guides/3rd-party-analytics.md`

## Pitfalls

- **"Cannot find native module 'SuperwallExpo'" / paywalls don't load** → you're on
  Expo Go. Build a dev client: `npx expo run:ios` / `run:android`, or
  `eas build --profile development --platform ios`.
- **Existing app, native folders out of date** → `npx expo prebuild --clean` (back
  up custom native code first).
- **EAS build missing the module** → fresh dev build:
  `eas build --profile development --platform ios`.
- **Stale caches after install** → `npx expo start --clear`, reinstall
  `node_modules`, `pod install --repo-update` in `ios/`.
- **Wrong Expo SDK** → `npx expo-doctor`; needs Expo SDK 53+.
- **Changes not taking effect** → hot reload doesn't re-configure Superwall; fully
  restart.

## Deeper docs

- Index: `curl -sL https://superwall.com/docs/expo/llms.txt`
- Install: https://superwall.com/docs/expo/quickstart/install
- Configure: https://superwall.com/docs/expo/quickstart/configure
- Configuring (options): https://superwall.com/docs/expo/guides/configuring
- Advanced purchasing / PurchaseController: https://superwall.com/docs/expo/guides/advanced-configuration
- Using RevenueCat: https://superwall.com/docs/expo/guides/using-revenuecat
- Debugging: https://superwall.com/docs/expo/guides/debugging
