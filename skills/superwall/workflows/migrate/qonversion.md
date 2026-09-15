# Qonversion → Superwall

Definitive playbook. Read fully before editing. Superwall has no Qonversion-specific
"using-qonversion" guide, so PAYWALLS-ONLY mode uses the **generic** `PurchaseController`
(`/docs/ios/guides/advanced-configuration`) - mirror the RevenueCat controller shape in
`references/revenuecat.md`, swapping RC calls for Qonversion calls.

## Scope & checklist

This migrates the **SDK integration**, not the whole product. Checklist:

- [ ] Inventory Qonversion SDK usage (grep §3)
- [ ] Map products / entitlements / offering-fetch call sites (§1)
- [ ] Re-create products, entitlements, campaign + placements in Superwall via CLI (§4)
- [ ] Swap SDK calls (init→configure, entitlement reads, present → placement, identify) (§5)
- [ ] Build + verify each placement; Restore Purchases as an existing subscriber (§7)
- [ ] FULL only: remove Qonversion dependency once verified
- [ ] Hand back to user: **rebuild paywalls** (superwall framework or dashboard editor), attach products, connect ASC/Play

> **Important - what does NOT migrate:**
>
> - **Qonversion paywall UI** cannot be imported - paywalls are **rebuilt** - as code with the superwall framework or in the dashboard editor.
> - **Historical analytics / attribution** stays in Qonversion.
> - **Subscriber base:** there is currently no server-side subscriber migration from Qonversion.
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

| Qonversion                                 | Superwall                                                  | Notes                                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Product (store SKU, Qonversion dashboard)  | **Product** (re-created)                                   | Keep the SAME App Store / Play product id.                                                                       |
| Offering (remote product collection)       | **Paywall** + **Campaign**                                 | Qonversion swaps products remotely via offerings; Superwall swaps the whole paywall remotely via campaign rules. |
| Entitlement / Permission (e.g. `premium`)  | **Entitlement** (re-created)                               | 1:1. Recreate each entitlement id as a Superwall entitlement.                                                    |
| `entitlements["premium"].isActive`         | `Superwall.shared.subscriptionStatus.isActive` (FULL)      | Device-derived in FULL mode.                                                                                     |
| User (Qonversion) + `identify`             | Superwall user (`identify`)                                |                                                                                                                  |
| `setUserProperty`                          | `Superwall.shared.setUserAttributes`                       |                                                                                                                  |
| Where you fetch an offering and present UI | **Placement** at the call site (paywall rebuilt in editor) |                                                                                                                  |

**Mental-model shift.** With Qonversion you `checkEntitlements()`, then fetch an `offering` and
present your own paywall UI. In Superwall you `register(placement:)` at the call site and the
**campaign** decides whether/which paywall shows. Move the decision from app code to the dashboard.

## 2. Three modes - decide who owns purchases first

Once Qonversion is gone, something still has to purchase, restore, and **tell Superwall who is
subscribed** - Superwall only auto-detects state when its own SDK made the purchase.

### Mode A - FULL, Superwall owns purchases (default)

Remove Qonversion. Superwall handles purchase/restore and computes entitlements from device records. No `PurchaseController`, no manual status setting.

### Mode B - FULL, app keeps its own purchase flow (custom UI / direct StoreKit or Play Billing)

Qonversion is gone, but the app still buys through its own code and uses Superwall only for paywalls.
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

### Mode C - PAYWALLS-ONLY, Qonversion stays the purchase controller

Keep Qonversion for purchases/receipts/webhooks; Superwall only shows paywalls. Implement a
Superwall `PurchaseController` whose `purchase`/`restore` call Qonversion, and mirror Qonversion
entitlements into `Superwall.shared.subscriptionStatus` / `setSubscriptionStatus`. Confirm exact
`PurchaseController` signatures live (no Qonversion-specific sample exists):

```bash
curl -sL https://superwall.com/docs/ios/guides/advanced-configuration.md
```

_Pure observer_ (analytics-only, Qonversion owns purchases AND paywalls): `SuperwallOptions.shouldObservePurchases = true`. `curl -sL https://superwall.com/docs/ios/guides/advanced/observer-mode.md`

## 3. Codebase inventory - grep these symbols

**iOS (Swift, `Qonversion`):**

- Config: `Qonversion.initWithConfig(` , `Qonversion.shared(`, `Qonversion.Configuration`
- Offerings/products (→ future placements): `Qonversion.shared().offerings(` , `.products(`, `offering.products`
- Purchase/restore: `.purchase(` , `.purchaseProduct(`, `.restore(`
- Entitlement checks (→ future gates): `.checkEntitlements(` , `.entitlements(`, `entitlements["premium"]`, `.isActive`
- Identity/attributes: `.identify(` , `.logout(`, `.setUserProperty(`, `.setCustomUserProperty(`

**React Native (`react-native-qonversion`):**
`Qonversion.initialize(config)`, `Qonversion.getSharedInstance()`, `.offerings()`, `.products()`,
`.purchaseProduct()` / `.purchase()`, `.restore()`, `.checkEntitlements()`, `entitlements['premium'].isActive`,
`.identify(userId)`, `.logout()`, `.setUserProperty()` / `.setCustomUserProperty()`.

**Flutter (`qonversion_flutter`):**
`Qonversion.initialize(config)`, `Qonversion.getSharedInstance()`, `.offerings()`, `.products()`,
`.purchase(id)` / `.purchaseProduct(product)`, `.restore()`, `.checkEntitlements()`,
`entitlements['premium']?.isActive`, `.identify(userId)`, `.logout()`, `.setUserProperty()` / `.setCustomUserProperty()`.

Produce: product ids, entitlement/permission ids (→ entitlements), and one row per offering-fetch/present call site → placement (`snake_case`).

## 4. Dashboard-side re-creation (CLI)

```bash
superwall entitlements create premium --project <projectId> --json
superwall products create com.app.premium_monthly --name "Premium Monthly" --project <projectId> --json
superwall products create com.app.premium_yearly --name "Premium Yearly" --project <projectId> --json
superwall campaigns create "Main paywall" paywall_main --project <projectId> --app <appId> --json
```

Product ids MUST equal existing App Store / Play SKUs (import from ASC via `superwall asc keys set --help`).
Verify with the same explicit ids: `superwall entitlements list --project <projectId> --json`,
`superwall products list --project <projectId> --json`, and `superwall campaigns list --project <projectId> --app <appId> --json`.

## 5. Code replacement

### FULL mode

- **Configure.** Replace `Qonversion.initWithConfig(...)` with `Superwall.configure(apiKey: "…")`. No purchase controller.
- **Entitlement checks → subscriptionStatus.**
  ```swift
  // Before
  Qonversion.shared().checkEntitlements { entitlements, error in
    let active = entitlements["premium"]?.isActive ?? false
  }
  // After
  if Superwall.shared.subscriptionStatus.isActive { /* entitled */ }
  // per-entitlement: switch Superwall.shared.subscriptionStatus { case .active(let e): … ; case .inactive: … ; case .unknown: … }
  ```
- **Presentation → placement.** Replace offering fetch + present with:
  ```swift
  Superwall.shared.register(placement: "paywall_main") { unlockFeature() }
  ```
  RN: `Superwall.shared.register({ placement: "paywall_main" }, () => {...})`.
  Flutter: `Superwall.shared.registerPlacement("paywall_main", feature: () {...})`.
- **Identity.** `Qonversion.shared().identify(id)` → `Superwall.shared.identify(userId: id)`; `.logout()` → `Superwall.shared.reset()`.
- **Attributes.** `.setUserProperty(...)` / `.setCustomUserProperty(...)` → `Superwall.shared.setUserAttributes([...])`. Call `identify` BEFORE `setUserAttributes`.
- Remove the Qonversion dependency only after build + verification.

### PAYWALLS-ONLY mode - bridge to Qonversion

Build a Superwall `PurchaseController` (confirm signatures at advanced-configuration). Skeleton,
mirroring the RC pattern with Qonversion calls:

```swift
final class QonversionPurchaseController: PurchaseController {
  func syncSubscriptionStatus() {
    // Qonversion is the source of truth. On launch and after purchase/restore, call
    // Qonversion.shared().checkEntitlements and map active entitlements → Superwall entitlements:
    // let ents = entitlements.values.filter { $0.isActive }.map { Entitlement(id: $0.id) }
    // Superwall.shared.subscriptionStatus = ents.isEmpty ? .inactive : .active(Set(ents))
    // (Qonversion has no continuous stream - re-check after each purchase/restore and on foreground.)
  }
  func purchase(product: SuperwallKit.StoreProduct) async -> PurchaseResult {
    // Resolve the Qonversion product by id, call Qonversion.shared().purchaseProduct(...),
    // map result → .purchased / .cancelled / .pending / .failed(error)
  }
  func restorePurchases() async -> RestorationResult {
    // Qonversion.shared().restore(...); on success return .restored (catch → .failed(error))
  }
}
```

Wire: `Superwall.configure(apiKey: "…", purchaseController: QonversionPurchaseController())` then start the sync.
RN/Flutter: drive `Superwall.shared.setSubscriptionStatus(...)` from `checkEntitlements()` results after
each purchase/restore/foreground. Confirm exact `PurchaseController` signatures and
`PurchaseResult`/`RestorationResult` cases at the advanced-configuration doc before finalizing.

## 6. Feature gating

Set per placement in the editor (**General → Feature Gating**): non-gated (closure runs on dismiss
regardless) vs gated (only when entitled). Peek: `Superwall.shared.getPresentationResult(forPlacement:)`.
`curl -sL https://superwall.com/docs/ios/quickstart/feature-gating.md`

## 7. Order of operations + safety

1. Re-create entitlements/products/campaign+placements (CLI); import products from ASC/Play so ids match.
2. **Rebuild** paywalls (superwall framework or dashboard editor), attach products (hand-back to user - designs do not import).
3. Add Superwall SDK alongside Qonversion; configure it.
4. Replace offering-fetch/present call sites with `register(placement:)`; replace `checkEntitlements` reads with `subscriptionStatus`.
5. Build, present each placement, Restore Purchases as an existing subscriber, confirm `subscriptionStatus.isActive`.
6. FULL: remove controller + Qonversion dependency. PAYWALLS-ONLY: keep Qonversion + controller.
7. Never delete Qonversion dashboard/webhook config until verified in production. Existing subscribers keep access via device-side Restore Purchases (Superwall reads store records) - no server-side subscriber migration currently exists.

## 8. Pitfalls

- **Double-finish / double-charge.** Exactly one SDK finishes transactions. PAYWALLS-ONLY: Qonversion owns purchasing via the controller; never also call `Superwall.shared.purchase`. FULL: remove Qonversion purchase paths.
- **StoreKit listener conflicts.** Two SDKs observing StoreKit → duplicate grants/races. One owner only.
- **Silent "everyone sees a paywall" bug (Mode B).** Removed Qonversion but kept the app's own purchase
  flow (custom UI / direct StoreKit / Play Billing) without syncing state → Superwall treats every user
  as unsubscribed and shows paywalls to payers. Grep for `purchase(` / `Transaction.updates` /
  `BillingClient` outside Superwall; if purchases happen outside Superwall, sync via controller,
  observer mode, or a manual `subscriptionStatus` set (§2 Mode B).
- **Observer flag.** `shouldObservePurchases = true` disables `Superwall.shared.purchase`; observer mode only.
- **Entitlement id mismatch.** Superwall entitlement ids must equal Qonversion entitlement/permission ids exactly (`premium` ≠ `Premium`).
- **No continuous stream.** Unlike RC's `customerInfoStream`, Qonversion has no push stream - re-run `checkEntitlements` after each purchase/restore and on app foreground so `subscriptionStatus` stays fresh.
- **Cache during switchover.** Status may read `.unknown`/`.inactive` until the first `checkEntitlements` / StoreKit sync - prompt Restore Purchases if a known subscriber looks free.
- **identify order.** `identify` before `setUserAttributes`.
- **Unverified controller signatures.** The Qonversion controller above is a skeleton - verify `PurchaseController` protocol + result enums at the advanced-configuration doc, since there's no official Qonversion sample.

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
- Qonversion side: https://documentation.qonversion.io/docs/making-purchases · https://documentation.qonversion.io/docs/flutter-sdk · RN https://github.com/qonversion/react-native-sdk
