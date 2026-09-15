# Adapty → Superwall

Definitive playbook. Read fully before editing. Superwall has no Adapty-specific
"using-adapty" guide, so PAYWALLS-ONLY mode uses the **generic** `PurchaseController`
(`/docs/ios/guides/advanced-configuration`) - mirror the RevenueCat controller shape in
`references/revenuecat.md`, swapping RC calls for Adapty calls.

## Scope & checklist

This migrates the **SDK integration**, not the whole product. Checklist:

- [ ] Inventory Adapty SDK usage (grep §3)
- [ ] Map products / access levels / `getPaywall` call sites (§1)
- [ ] Re-create products, entitlements, campaign + placements in Superwall via CLI (§4)
- [ ] Swap SDK calls (activate→configure, access-level reads, present → placement, identify) (§5)
- [ ] Build + verify each placement; Restore Purchases as an existing subscriber (§7)
- [ ] FULL only: remove Adapty dependency once verified
- [ ] Hand back to user: **rebuild paywalls** (superwall framework or dashboard editor), attach products, connect ASC/Play

> **Important - what does NOT migrate:**
>
> - **Adapty paywall designs** (Paywall Builder / remote config) cannot be imported - they are
>   **rebuilt** - as code with the superwall framework or in the dashboard editor.
> - **Historical analytics / attribution** stays in Adapty.
> - **Subscriber base:** there is currently no server-side subscriber migration from Adapty.
>   Existing subscribers keep access because their purchases live with the store (StoreKit /
>   Play Billing); the app reads them device-side via **Restore Purchases** and maps them to
>   Superwall entitlements. No subscriber data currently moves between backends.

## Docs access - fetch live, don't trust baked text

```bash
curl -sL https://superwall.com/docs/llms.txt                                          # index
curl -sL https://superwall.com/docs/ios/guides/advanced-configuration.md              # PurchaseController protocol (swap ios→expo/flutter/android)
curl -sL https://superwall.com/docs/support/faq/how-to-migrate-from-another-provider-to-superwall.md
```

## 1. Concept mapping

| Adapty                                           | Superwall                                             | Notes                                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Product (store SKU)                              | **Product** (re-created)                              | Keep the SAME App Store / Play product id.                                                             |
| Paywall (Adapty Paywall Builder / remote config) | **Paywall** (rebuilt)                       | Design does NOT import - rebuild from scratch.                                                         |
| Placement (`main`, `onboarding`, …)              | **Placement** (inside a **Campaign**)                 | Closest 1:1 - Adapty already hardcodes placement ids at call sites; reuse the names (as `snake_case`). |
| Access Level (e.g. `premium`)                    | **Entitlement** (re-created)                          | 1:1. Recreate each access-level id as a Superwall entitlement.                                         |
| `profile.accessLevels["premium"].isActive`       | `Superwall.shared.subscriptionStatus.isActive` (FULL) | Device-derived in FULL mode.                                                                           |
| Profile (Adapty user)                            | Superwall user (`identify`)                           |                                                                                                        |
| `Adapty.updateProfile` custom attributes         | `Superwall.shared.setUserAttributes`                  |                                                                                                        |

**Mental-model shift.** Adapty already uses placements - but you call `Adapty.getPaywall(placementId:)`,
fetch products, and present. In Superwall you just `register(placement:)` at the call site and the
**campaign** decides whether/which paywall shows. The decision moves from app code to the dashboard.

## 2. Three modes - decide who owns purchases first

Once Adapty is gone, something still has to purchase, restore, and **tell Superwall who is
subscribed** - Superwall only auto-detects state when its own SDK made the purchase.

### Mode A - FULL, Superwall owns purchases (default)

Remove Adapty. Superwall handles purchase/restore and computes entitlements from device records. No `PurchaseController`, no manual status setting.

### Mode B - FULL, app keeps its own purchase flow (custom UI / direct StoreKit or Play Billing)

Adapty is gone, but the app still buys through its own code and uses Superwall only for paywalls.
Superwall does NOT observe purchases it didn't make.

> **Important:** From advanced-configuration, verbatim: "You **must** set
> `Superwall.shared.subscriptionStatus` every time the user's subscription status changes, otherwise
> the SDK won't know who to show a paywall to." Do exactly ONE of: (1) implement a `PurchaseController`
> that sets `subscriptionStatus`; (2) enable observer mode - `SuperwallOptions().shouldObservePurchases = true`
> (then you can't call `Superwall.shared.purchase(...)`); or (3) push status manually after every
> purchase/restore/expiry (iOS: from a `Transaction.currentEntitlements` read +
> `Transaction.updates` listener; Expo/RN/Flutter: `Superwall.shared.setSubscriptionStatus(...)`).
> Skip this and Superwall shows paywalls to paying users.

```bash
curl -sL https://superwall.com/docs/ios/quickstart/tracking-subscription-state.md   # + expo/ · flutter/ variants
curl -sL https://superwall.com/docs/ios/guides/advanced/observer-mode.md
```

### Mode C - PAYWALLS-ONLY, Adapty stays the purchase controller

Keep Adapty for purchases/receipts/webhooks; Superwall only shows paywalls. Implement a Superwall
`PurchaseController` whose `purchase`/`restore` call Adapty, and mirror Adapty access levels into
`Superwall.shared.subscriptionStatus` / `setSubscriptionStatus`. Confirm the exact
`PurchaseController` protocol signatures live (there is no Adapty-specific sample):

```bash
curl -sL https://superwall.com/docs/ios/guides/advanced-configuration.md
```

_Pure observer_ (analytics-only, Adapty owns purchases AND paywalls): `SuperwallOptions.shouldObservePurchases = true`. `curl -sL https://superwall.com/docs/ios/guides/advanced/observer-mode.md`

## 3. Codebase inventory - grep these symbols

**iOS (Swift, `Adapty`):**

- Config: `Adapty.activate(` , `AdaptyConfiguration`, `Adapty.delegate`, `AdaptyDelegate`
- Paywall/products (→ future placements): `Adapty.getPaywall(placementId:` , `Adapty.getPaywallProducts(paywall:` , `AdaptyUI.getPaywallConfiguration`, `AdaptyPaywallController`, `paywall.remoteConfig`
- Purchase/restore: `Adapty.makePurchase(product:` , `Adapty.restorePurchases(`
- Access-level checks (→ future gates): `Adapty.getProfile(` , `profile.accessLevels[` , `.isActive`, `AdaptyDelegate.didLoadLatestProfile`
- Identity/attributes: `Adapty.identify(` , `Adapty.logout(` , `Adapty.updateProfile(` (`AdaptyProfileParameters` / `.customAttributes`)

**React Native (`react-native-adapty`):**
`adapty.activate('APP_KEY')`, `adapty.getPaywall(placementId)`, `adapty.getPaywallProducts(paywall)`,
`adapty.makePurchase(product)`, `adapty.restorePurchases()`, `adapty.getProfile()`,
`profile.accessLevels['premium'].isActive`, `adapty.identify(id)`, `adapty.logout()`,
`adapty.updateProfile({...})`, `adapty.addEventListener('onLatestProfileLoad', …)`.

**Flutter (`adapty_flutter`):**
`Adapty().activate(...)`, `Adapty().getPaywall(placementId: ...)`, `Adapty().getPaywallProducts(paywall: ...)`,
`Adapty().makePurchase(product: ...)`, `Adapty().restorePurchases()`, `Adapty().getProfile()`,
`profile.accessLevels['premium']?.isActive`, `Adapty().identify(...)`, `Adapty().logout()`,
`Adapty().updateProfile(...)`, `adaptyDelegate.didLoadLatestProfile`.

Produce: product ids, access-level ids (→ entitlements), and one row per `getPaywall`/present call site → placement (reuse Adapty's placement id, `snake_case`).

## 4. Dashboard-side re-creation (CLI)

```bash
superwall entitlements create premium --project <projectId> --json
superwall products create com.app.premium_monthly --name "Premium Monthly" --project <projectId> --json
superwall products create com.app.premium_yearly --name "Premium Yearly" --project <projectId> --json
superwall campaigns create "Main paywall" main --project <projectId> --app <appId> --json
superwall campaigns placement <campaignId> onboarding --project <projectId> --app <appId> --json
```

Product ids MUST equal existing App Store / Play SKUs (import from ASC via `superwall asc keys set --help`).
Verify with the same explicit ids: `superwall entitlements list --project <projectId> --json`,
`superwall products list --project <projectId> --json`, and `superwall campaigns list --project <projectId> --app <appId> --json`.

## 5. Code replacement

### FULL mode

- **Configure.** Replace `Adapty.activate(...)` with `Superwall.configure(apiKey: "…")`. No purchase controller.
- **Access-level checks → subscriptionStatus.**
  ```swift
  // Before
  let profile = try? await Adapty.getProfile()
  return profile?.accessLevels["premium"]?.isActive ?? false
  // After
  if Superwall.shared.subscriptionStatus.isActive { /* entitled */ }
  // per-entitlement: switch Superwall.shared.subscriptionStatus { case .active(let e): … ; case .inactive: … ; case .unknown: … }
  ```
- **Presentation → placement.** Replace `getPaywall` + `getPaywallProducts` + present with:
  ```swift
  Superwall.shared.register(placement: "main") { unlockFeature() }
  ```
  RN: `Superwall.shared.register({ placement: "main" }, () => {...})`.
  Flutter: `Superwall.shared.registerPlacement("main", feature: () {...})`.
- **Identity.** `Adapty.identify(id)` → `Superwall.shared.identify(userId: id)`; `Adapty.logout()` → `Superwall.shared.reset()`.
- **Attributes.** `Adapty.updateProfile(params)` (customAttributes) → `Superwall.shared.setUserAttributes([...])`. Call `identify` BEFORE `setUserAttributes`.
- Remove the Adapty dependency only after build + verification.

### PAYWALLS-ONLY mode - bridge to Adapty

Build a Superwall `PurchaseController` (confirm signatures at advanced-configuration). Skeleton,
mirroring the RC pattern with Adapty calls:

```swift
final class AdaptyPurchaseController: PurchaseController {
  func syncSubscriptionStatus() {
    // Adapty is the source of truth. On every profile update (AdaptyDelegate.didLoadLatestProfile
    // or an initial getProfile), map active access levels → Superwall entitlements:
    // let ents = profile.accessLevels.filter { $0.value.isActive }.keys.map { Entitlement(id: $0) }
    // Superwall.shared.subscriptionStatus = ents.isEmpty ? .inactive : .active(Set(ents))
  }
  func purchase(product: SuperwallKit.StoreProduct) async -> PurchaseResult {
    // Resolve the matching AdaptyPaywallProduct (or make an Adapty purchase by product id),
    // call Adapty.makePurchase(product:), map its result → .purchased / .cancelled / .pending / .failed(error)
  }
  func restorePurchases() async -> RestorationResult {
    // try await Adapty.restorePurchases(); return .restored  (catch → .failed(error))
  }
}
```

Wire: `Superwall.configure(apiKey: "…", purchaseController: AdaptyPurchaseController())` then start the sync.
Set `AdaptyDelegate` so `didLoadLatestProfile` drives `Superwall.shared.subscriptionStatus` (iOS) /
`setSubscriptionStatus(...)` (RN/Flutter). Confirm the exact `PurchaseController` method signatures and
`PurchaseResult`/`RestorationResult` cases at the advanced-configuration doc before finalizing.

## 6. Feature gating

Set per placement in the editor (**General → Feature Gating**): non-gated (closure runs on dismiss
regardless) vs gated (only when entitled). Peek: `Superwall.shared.getPresentationResult(forPlacement:)`.
`curl -sL https://superwall.com/docs/ios/quickstart/feature-gating.md`

## 7. Order of operations + safety

1. Re-create entitlements/products/campaign+placements (CLI); import products from ASC/Play so ids match.
2. **Rebuild** paywalls (superwall framework or dashboard editor), attach products (hand-back to user - designs do not import).
3. Add Superwall SDK alongside Adapty; configure it.
4. Replace `getPaywall`/present call sites with `register(placement:)`; replace access-level reads with `subscriptionStatus`.
5. Build, present each placement, Restore Purchases as an existing subscriber, confirm `subscriptionStatus.isActive`.
6. FULL: remove controller + Adapty dependency. PAYWALLS-ONLY: keep Adapty + controller.
7. Never delete Adapty dashboard/webhook config until verified in production. Existing subscribers keep access via device-side Restore Purchases (Superwall reads store records) - no server-side subscriber migration currently exists.

## 8. Pitfalls

- **Double-finish / double-charge.** Exactly one SDK finishes transactions. PAYWALLS-ONLY: Adapty owns purchasing via the controller; never also call `Superwall.shared.purchase`. FULL: remove Adapty purchase paths.
- **StoreKit listener conflicts.** Two SDKs observing StoreKit → duplicate grants/races. One owner only.
- **Silent "everyone sees a paywall" bug (Mode B).** Removed Adapty but kept the app's own purchase
  flow (custom UI / direct StoreKit / Play Billing) without syncing state → Superwall treats every user
  as unsubscribed and shows paywalls to payers. Grep for `purchase(` / `Transaction.updates` /
  `BillingClient` outside Superwall; if purchases happen outside Superwall, sync via controller,
  observer mode, or a manual `subscriptionStatus` set (§2 Mode B).
- **Observer flag.** `shouldObservePurchases = true` disables `Superwall.shared.purchase`; observer mode only.
- **Entitlement id mismatch.** Superwall entitlement ids must equal Adapty access-level ids exactly (`premium` ≠ `Premium`).
- **Access-level nuances.** Adapty access levels also carry grace-period / lifetime / billing-issue states; when mirroring, treat `isActive` (incl. grace period per your policy) as entitled - don't silently drop grace-period users.
- **Cache during switchover.** Status may read `.unknown`/`.inactive` until the first profile load / StoreKit sync - prompt Restore Purchases if a known subscriber looks free.
- **identify order.** `identify` before `setUserAttributes`.
- **Unverified controller signatures.** The Adapty controller above is a skeleton - verify `PurchaseController` protocol + result enums at the advanced-configuration doc, since there's no official Adapty sample.

## 9. Deeper docs (fetch live)

```bash
curl -sL https://superwall.com/docs/support/faq/how-to-migrate-from-another-provider-to-superwall.md
curl -sL https://superwall.com/docs/ios/guides/advanced-configuration.md       # PurchaseController (+ expo/flutter/android)
curl -sL https://superwall.com/docs/ios/guides/advanced/observer-mode.md
curl -sL https://superwall.com/docs/ios/quickstart/tracking-subscription-state.md
curl -sL https://superwall.com/docs/llms.txt                                    # index
```

- PurchaseController reference: https://superwall.com/docs/ios/sdk-reference/PurchaseController
- register/identify/setUserAttributes: https://superwall.com/docs/ios/sdk-reference/register · .../identify · .../setUserAttributes
- Adapty side: https://adapty.io/docs/ios-sdk-overview · https://adapty.io/docs/making-purchases · RN https://adapty.io/docs/react-native-making-purchases · Flutter https://adapty.io/docs/flutter-sdk-making-purchases
