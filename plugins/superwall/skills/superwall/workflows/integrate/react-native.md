# Integrate Superwall - React Native (bare, non-Expo)

You are integrating Superwall into a **bare** React Native app (no Expo config).
Get the SDK installed and configured. **Do not add paywall triggers** - that is the
separate **superwall-placements** skill.

> **Important - which SDK:** Superwall's recommended SDK for React Native is now
> **`expo-superwall`**, installed into bare RN via Expo modules (**Path A**). The
> standalone **`@superwall/react-native-superwall`** is **deprecated** (**Path B**,
> kept only for existing setups). Default to Path A. Use Path B only if the project
> cannot add Expo modules or is already on the legacy SDK.

**Requirements (Path A):** React Native **0.79+**, Node **18+**, iOS deployment
target **15.1+**, Android **minSdkVersion 21+**.

## Checklist

- [ ] **0. Decide the purchase-handling path** (default / RevenueCat / custom).
- [ ] **0b. Pick the SDK** - Path A (`expo-superwall`, default) or Path B (legacy).
- [ ] **1. Install** the SDK + native deps (pods / gradle).
- [ ] **2. Configure** at launch with per-platform `pk_` keys.
- [ ] **3. API keys** branched on platform (public keys, never secrets).
- [ ] **4. Purchase handling** for the chosen path.
- [ ] **5. Native rebuild** (not just a Metro reload) - module links.
- [ ] **6. Run** - native logs show Superwall startup.
- [ ] **7. Post-integration** (identity, attributes, subscription state, deep links, analytics), then → **superwall-placements**.

## Docs access - read the current page when baked steps aren't enough

```bash
curl -sL https://superwall.com/docs/expo/llms.txt          # Path A docs (expo-superwall) live here
curl -sL https://superwall.com/docs/react-native/llms.txt  # Path B legacy SDK reference
curl -sL https://superwall.com/docs/llms-full.txt          # broad context
curl -sL https://superwall.com/docs/expo/guides/using-expo-sdk-in-bare-react-native.md
```

Pattern: fetch the index, then `https://superwall.com/docs/{sdk}/{path}.md`. Every
`curl` here is verified working. **Path A uses the Expo docs** - the hooks/provider
API (`SuperwallProvider`, `useUser`) is documented under `/docs/expo/…`. **Never
invent an API**; fetch and confirm.

## Quickstart walk

Path A follows the **Expo** quickstart. Path B uses the (deprecated) react-native
SDK reference.

| Order | Path A slug (Expo docs)                           | Covered by      |
| ----- | ------------------------------------------------- | --------------- |
| 1     | `expo/guides/using-expo-sdk-in-bare-react-native` | Step 1 (Path A) |
| 2     | `expo/quickstart/configure`                       | Step 2          |
| 3     | `expo/quickstart/setting-user-properties`         | Step 7          |
| 4     | `expo/quickstart/tracking-subscription-state`     | Step 7          |
| 5     | `expo/quickstart/user-management`                 | Step 7          |

Path B reference: `curl -sL https://superwall.com/docs/react-native/llms.txt`

## Step 0 - Purchase-handling path (decide first)

> **Important:** Paths (b)/(c) require manual subscription-status management; (a) doesn't.

- **(a) Default - Superwall handles StoreKit/Billing.** Recommended, zero purchase code.
- **(b) RevenueCat stays the source of truth.** Keep RC purchasing; sync entitlements in.
- **(c) Custom purchase controller.** Supply a `PurchaseController`, drive status.

Full migration off another SDK → **superwall-migrate** skill.

---

## Path A - `expo-superwall` in bare React Native (recommended)

### 1. Install

Add Expo modules support to the bare project (the Superwall-documented way to
consume `expo-superwall` without full Expo):

```bash
curl -sL https://superwall.com/docs/expo/guides/using-expo-sdk-in-bare-react-native.md
npx install-expo-modules@latest
```

Install the SDK with the project's package manager (detect from lockfile):

```bash
npm install expo-superwall
# or: yarn add expo-superwall / pnpm add expo-superwall / bun add expo-superwall
```

Install iOS pods, ensure Android mins:

```bash
cd ios && pod install
```

`android/app/build.gradle`: `minSdkVersion 21`+ (with `compileSdkVersion` /
`targetSdkVersion` 34).

### 2. Configure

Wrap the app root in `SuperwallProvider` with per-platform public keys:

```tsx
import { SuperwallProvider } from "expo-superwall";

export default function App() {
  return (
    <SuperwallProvider
      apiKeys={{ ios: "pk_YOUR_IOS_PUBLIC_KEY", android: "pk_YOUR_ANDROID_PUBLIC_KEY" }}
    >
      {/* your existing app tree */}
    </SuperwallProvider>
  );
}
```

`SuperwallProvider` configures the SDK on mount - **do not** also call a separate
`configure()`. Optional behavior goes through the `options` prop.

Path A shares the Expo API. Skip to **API key handling**, **Purchase handling**,
**Post-integration** - they apply to both paths (Path A uses the hooks form).

---

## Path B - legacy `@superwall/react-native-superwall`

Use only if you cannot add Expo modules, or the project already uses this SDK.

### 1. Install

```bash
npm install @superwall/react-native-superwall
# or: yarn add @superwall/react-native-superwall
cd ios && pod install
```

Android autolinks - no extra native step beyond a normal build.

### 2. Configure

Import the default export and call `Superwall.configure` once at launch (root
component's `useEffect` with empty deps). The public key is per-platform:

```tsx
import { useEffect } from "react";
import { Platform } from "react-native";
import Superwall from "@superwall/react-native-superwall";

export default function App() {
  useEffect(() => {
    const apiKey = Platform.OS === "ios" ? "pk_YOUR_IOS_PUBLIC_KEY" : "pk_YOUR_ANDROID_PUBLIC_KEY";
    Superwall.configure({ apiKey });
  }, []);

  return (/* your app */);
}
```

Full signature: `Superwall.configure({ apiKey, options?, purchaseController?, completion? })`
(returns a Promise resolving to the configured instance, also at `Superwall.shared`).
`curl -sL https://superwall.com/docs/react-native/sdk-reference/configure.md`

---

## API key handling (both paths)

Use the **Public API Key(s)** (`pk_…`) from Dashboard ▸ Settings ▸ Keys - iOS and
Android apps have separate keys, so branch on platform. Public keys aren't secrets;
inline them, or read from existing config (`react-native-config`). **Never** use a
secret/server key.

## Purchase handling (both paths - implements Step 0)

### (a) Default

Nothing extra - Superwall manages purchases, restores, and subscription status.

### (b) RevenueCat / (c) custom

Subclass `PurchaseController` and implement `purchaseFromAppStore(productId)`,
`purchaseFromGooglePlay(productId, basePlanId?, offerId?)`, `restorePurchases()`;
pass it at configure time. Read the page first - **do not invent method names**:

```bash
curl -sL https://superwall.com/docs/expo/guides/advanced-configuration.md
```

```tsx
export class MyPurchaseController extends PurchaseController {
  async purchaseFromAppStore(productId: string): Promise<PurchaseResult> { /* ... */ }
  async purchaseFromGooglePlay(
    productId: string, basePlanId?: string, offerId?: string
  ): Promise<PurchaseResult> { /* ... */ }
  async restorePurchases(): Promise<RestorationResult> { /* ... */ }
}
```

> **Important (paths b & c):** keep subscription status synced whenever entitlements
> change. Path A (hooks): `const { setSubscriptionStatus } = useUser();
setSubscriptionStatus({ status: "ACTIVE", entitlements: [{ id: "pro" }] })`.
> Shared instance:
> `Superwall.shared.setSubscriptionStatus(SubscriptionStatus.Active([new Entitlement("pro")]))`
> / `SubscriptionStatus.Inactive()`. For (b), map RevenueCat's active entitlements in.

## Verify (both paths)

1. **Native rebuild** & run: `npx react-native run-ios` / `run-android`. Path A must
   relink the native module - rebuild, don't just reload JS.
2. Watch native logs on launch for Superwall SDK startup.
3. iOS purchase testing: StoreKit testing in Xcode.

## Post-integration (wire what the app needs, then → placements)

Path A uses the `useUser` hook; Path B uses static `Superwall` methods.

- **User identity - REQUIRED if the app has ANY auth/login system.** Not optional: without it every logged-in user is anonymous to Superwall, breaking user-scoped audiences, attribution, and cross-device status. Wire it the moment you see a login/logout flow (grep for signIn/login/logout/signOut/auth). Path A: `const { identify, signOut } = useUser()`. Path B:
  `Superwall.shared.identify(userId)` / `Superwall.shared.reset()`. `userId` should
  be a **UUID** (StoreKit compat), never an email/device id/guessable value.
  `curl -sL https://superwall.com/docs/expo/quickstart/user-management.md`
- **User attributes** - `setUserAttributes(...)`.
  `curl -sL https://superwall.com/docs/expo/quickstart/setting-user-properties.md`
- **Tracking subscription state** - Path A: `subscriptionStatus` from `useUser`
  (`status` = `"ACTIVE" | "INACTIVE" | "UNKNOWN"`).
  `curl -sL https://superwall.com/docs/expo/quickstart/tracking-subscription-state.md`
- **Deep links** - pass URLs to `handleDeepLink`; fires the `deepLink_open` placement.
  `curl -sL https://superwall.com/docs/expo/guides/handling-deep-links.md`
- **3rd-party analytics** - forward events (Path A: `useSuperwallEvents`).
  `curl -sL https://superwall.com/docs/expo/guides/3rd-party-analytics.md`

## Pitfalls

- **iOS module not found / link errors** → `cd ios && pod install`, then a full
  native rebuild (not just Metro reload).
- **Reached for the wrong SDK** → prefer Path A (`expo-superwall`); the standalone
  `@superwall/react-native-superwall` is deprecated.
- **Path A native module missing** → `npx install-expo-modules@latest` must succeed
  before `pod install`; rebuild afterward.
- **Configuring on every render** → Path B: wrap `configure` in `useEffect(..., [])`.
- **Secret key** → key must start with `pk_`.

## Deeper docs

- Bare RN install guide (Path A): https://superwall.com/docs/expo/guides/using-expo-sdk-in-bare-react-native
- Migrating from the legacy SDK: https://superwall.com/docs/expo/guides/migrating-react-native
- Legacy `configure()` (Path B): https://superwall.com/docs/react-native/sdk-reference/configure
- React Native SDK reference index: `curl -sL https://superwall.com/docs/react-native/llms.txt`
- Expo docs index (applies to Path A): `curl -sL https://superwall.com/docs/expo/llms.txt`
