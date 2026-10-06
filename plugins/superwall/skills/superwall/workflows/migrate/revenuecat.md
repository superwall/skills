# RevenueCat → Superwall

Definitive playbook. Read fully before editing.

## Scope & checklist

This migrates the **SDK integration**, not the whole product. Checklist:

- [ ] Inventory RevenueCat SDK usage (grep §3)
- [ ] Map products / entitlements / presentation call sites (§1)
- [ ] Re-create products, entitlements, campaign + placements in Superwall via CLI (§4)
- [ ] Swap SDK calls (configure, entitlement reads, presentation → placement, identify) (§5)
- [ ] **Confirm subscription state reaches Superwall** - grep for `purchase(`, `Transaction.updates`,
      `Transaction.currentEntitlements`, `BillingClient`, or any purchase call site _outside_ Superwall.
      If ANY purchase can happen without Superwall making it (Mode B / Mode C), verify state is synced
      via a `PurchaseController`, observer mode, or a manual `subscriptionStatus` set - otherwise
      Superwall shows paywalls to paying users (§2)
- [ ] **Inventory side-effects in RC purchase/restore callbacks before deleting** - backend sync
      POSTs, analytics (Singular/PostHog/TikTok/…), attribution, post-purchase navigation - and reroute
      each into a `SuperwallDelegate` (§5 "Side-effects")
- [ ] **Identity lifecycle**: `identify` at login/session-restore; `reset()` on EVERY sign-out path
      (logout, account deletion, forced 401) (§5)
- [ ] **Inventory ALL other purchase stacks** (SwiftyStoreKit, `SKPaymentQueue`, IAPManager-style
      singletons) - remove or explicitly retire; one transaction finisher only (§3)
- [ ] **Dashboard account gate**: `superwall apps list --json` must show the app matching the code's
      `pk_` key / bundle id BEFORE any create; wrong account → stop dashboard work loudly (§4)
- [ ] Build + verify each placement; Restore Purchases as an existing subscriber (§7)
- [ ] FULL only: remove RC dependency once verified
- [ ] Hand back to user: **rebuild paywalls** (dashboard editor), attach products, connect ASC/Play

> **Important - what does and does NOT migrate:**
>
> - **RC paywall designs** cannot be imported - they are **rebuilt** in the dashboard editor.
> - **Historical analytics / attribution** stays in RevenueCat.
> - **Subscriber base:** Superwall provides server-side RevenueCat migration tooling that ports
>   subscription history and entitlement state - fetch the migration guide (Docs access below)
>   for the current process before promising specifics. Independently of any data move, existing
>   subscribers keep access via device-side **Restore Purchases** because their purchases live
>   with the store.

## Docs access - fetch live, don't trust baked text

```bash
curl -sL https://superwall.com/docs/llms.txt                                             # index
curl -sL https://superwall.com/docs/dashboard/guides/migrating-from-revenuecat-to-superwall.md  # migration guide (verified)
curl -sL https://superwall.com/docs/ios/guides/using-revenuecat.md                       # PAYWALLS-ONLY controller (swap ios→expo/flutter/android)
curl -sL https://superwall.com/docs/ios/guides/advanced-configuration.md                 # PurchaseController protocol
curl -sL https://www.revenuecat.com/docs/llms.txt                                        # RevenueCat's own docs index - append .md to any RC docs page to study the existing integration
```

## 1. Concept mapping

| RevenueCat                                       | Superwall                                                                                      | Notes                                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Product (store SKU wrapped in RC dashboard)      | **Product** (re-created)                                                                       | Keep the SAME App Store / Play product identifier. Only the management layer moves.                                         |
| Package (`$rc_monthly`, inside an Offering)      | (no direct equal)                                                                              | A package is just "product + duration slot." In Superwall you attach the raw products to a paywall (in the editor).           |
| Offering (remote set of packages)                | **Paywall** + **Campaign**                                                                     | RC picks products remotely via Offering; Superwall picks the whole paywall (products included) remotely via Campaign rules. |
| Entitlement (e.g. `pro`)                         | **Entitlement** (re-created)                                                                   | 1:1. Recreate each RC entitlement id as a Superwall entitlement.                                                            |
| `customerInfo.entitlements.active`               | `Superwall.shared.subscriptionStatus` (`.active(Set<Entitlement>)` / `.inactive` / `.unknown`) | Status is device-derived in FULL mode.                                                                                      |
| RC Paywalls (RC's paywall UI)                    | **Paywall** (rebuilt), shown by **placement**                                        | Design does NOT import - see below.                                                                                         |
| Manual "should I show a paywall?" gating in code | **register(placement:)** - campaign decides                                                    |                                                                                                                             |

**Mental-model shift.** With RC you check entitlement status, then decide in code whether to
fetch an offering and present a paywall. With Superwall you **register a placement at the call
site** (`register(placement: "start_workout") { … }`) and the **campaign** decides whether a
paywall shows, which one, and A/B variant. Move the _decision_ out of the app and into the
dashboard. The trailing feature closure runs when the user is entitled (gated) or always
(non-gated) - see §6.

## 2. Three modes - decide who owns purchases first

Removing RevenueCat is not the whole decision. Once RC is gone, _something_ still has to
purchase, restore, and **tell Superwall who is subscribed**. Superwall only auto-detects
subscription state when its own SDK made the purchase. Pick the mode that matches the app you
actually have - the middle one is the easiest to get wrong.

### Mode A - FULL, Superwall owns purchases (default, simplest)

Remove RevenueCat entirely. Superwall's SDK handles purchase, restore, and entitlement
computation from the device's App Store / Play records. No `PurchaseController`, no manual status
setting. Use this unless the app has its own checkout UI or billing code you're keeping.

### Mode B - FULL, app keeps its own purchase flow (custom UI / direct StoreKit or Play Billing)

RevenueCat is gone, but the app still buys through **its own code** - a custom purchase screen,
direct StoreKit 2 / Play Billing, or a home-grown billing layer - and uses Superwall _only_ to
show paywalls and register placements. This is the mode that silently breaks: Superwall does NOT
observe purchases it didn't make, so unless you sync state it thinks **every** user is unsubscribed
and shows paywalls to people who already pay.

> **Important:** From the advanced-configuration doc, verbatim: "You **must** set
> `Superwall.shared.subscriptionStatus` every time the user's subscription status changes,
> otherwise the SDK won't know who to show a paywall to." In this mode you MUST do exactly ONE of:
>
> 1. **Implement a `PurchaseController`** - route your purchase/restore through it and set
>    `subscriptionStatus` from it (same controller shape as §5, but calling your own billing code
>    instead of RC).
> 2. **Enable observer mode** - `SuperwallOptions().shouldObservePurchases = true`. Per the doc,
>    observer mode "solely reports transaction completions" (revenue tracking) - entitlement/
>    subscriptionStatus is kept current by Superwall's server-side pipeline (App Store Server
>    Notifications + the dashboard product → entitlement mapping - confirm against the
>    observer-mode doc below), so that mapping MUST exist for gating to work. You then CANNOT call `Superwall.shared.purchase(...)`.
>    (`curl -sL https://superwall.com/docs/ios/guides/advanced/observer-mode.md`)
> 3. **Push status manually** - after every purchase / restore / expiry, set
>    `Superwall.shared.subscriptionStatus` yourself (e.g. from a `Transaction.currentEntitlements`
>    read plus a `Transaction.updates` listener on iOS).

iOS manual-push sketch (verified against advanced-configuration.md → "Step 3: Keeping
`subscriptionStatus` Up-To-Date"):

```swift
import SuperwallKit
import StoreKit

// Call once on launch, AND keep a `Transaction.updates` listener running so later
// renewals/expiries/refunds re-run this - status must be pushed on EVERY change.
func syncSubscriptionStatus() async {
  var purchasedProductIds: Set<String> = []
  for await verificationResult in Transaction.currentEntitlements {
    if case .verified(let transaction) = verificationResult {
      purchasedProductIds.insert(transaction.productID)
    }
  }
  let entitlements = Superwall.shared.entitlements.byProductIds(purchasedProductIds)
  await MainActor.run {
    Superwall.shared.subscriptionStatus = entitlements.isEmpty ? .inactive : .active(entitlements)
  }
}
```

Expo / React Native and Flutter don't assign `subscriptionStatus` directly - they call
`Superwall.shared.setSubscriptionStatus(...)` (RN uses `SubscriptionStatus.Active(entitlementIds)` /
`.Inactive()`). Confirm the exact shape per framework:

```bash
curl -sL https://superwall.com/docs/ios/quickstart/tracking-subscription-state.md
curl -sL https://superwall.com/docs/expo/quickstart/tracking-subscription-state.md
curl -sL https://superwall.com/docs/flutter/quickstart/tracking-subscription-state.md
```

### Mode C - PAYWALLS-ONLY, RevenueCat stays the purchase controller

Keep RevenueCat for purchases/receipts/webhooks; Superwall only shows paywalls. Implement a
`PurchaseController` that forwards buys to RC and mirror RC's `customerInfo` into
`Superwall.shared.subscriptionStatus` (§5). Use when RC's server-side entitlements, integrations, or
cross-platform/web receipts must stay authoritative.

```bash
curl -sL https://superwall.com/docs/ios/guides/using-revenuecat.md      # swap ios → expo / flutter / android
```

Web-checkout variants: `.../guides/web-checkout/using-revenuecat` per framework.

_Pure observer_ (analytics-only, RC owns purchases AND paywalls): set
`options.shouldObservePurchases = true` on `SuperwallOptions`. Superwall records revenue but you
CANNOT call `Superwall.shared.purchase(...)`. `curl -sL https://superwall.com/docs/ios/guides/advanced/observer-mode.md`

## 3. Codebase inventory - grep these symbols

**iOS (Swift, `RevenueCat`):**

- Config: `Purchases.configure(withAPIKey:` , `Purchases.logLevel`, `Purchases.shared.delegate`, `PurchasesDelegate`
- Products/offerings: `Purchases.shared.offerings(`, `.getOfferings(`, `offering.availablePackages`, `package.storeProduct`
- Purchase/restore: `Purchases.shared.purchase(package:` , `.purchase(product:`, `.restorePurchases(`
- Entitlement checks (→ future gates): `customerInfo(`, `customerInfoStream`, `.entitlements.active[`, `.entitlements.activeInCurrentEnvironment`, `entitlement.isActive`
- Identity/attributes: `Purchases.shared.logIn(`, `.logOut(`, `.attribution`, `.setAttributes(`, `Purchases.shared.appUserID`
- **Presentation call sites** (RC paywalls / your own): `PaywallView`, `.presentPaywallIfNeeded`, `presentPaywall`, any place an offering is fetched then a sheet shown → each becomes a **placement**.

**React Native / Expo (`react-native-purchases`, `react-native-purchases-ui`):**
`Purchases.configure({apiKey})`, `Purchases.getOfferings()`, `Purchases.getProducts()`,
`Purchases.purchasePackage()`, `Purchases.purchaseStoreProduct()`, `Purchases.purchaseSubscriptionOption()`,
`Purchases.restorePurchases()`, `Purchases.getCustomerInfo()`, `Purchases.addCustomerInfoUpdateListener()`,
`customerInfo.entitlements.active`, `Purchases.logIn()/logOut()`, `RevenueCatUI.presentPaywall()`.

**Flutter (`purchases_flutter`, `purchases_ui_flutter`):**
`Purchases.configure(PurchasesConfiguration(...))`, `Purchases.getOfferings()`, `Purchases.getProducts()`,
`Purchases.purchasePackage()`, `Purchases.purchaseStoreProduct()`, `Purchases.purchase(PurchaseParams...)`,
`Purchases.restorePurchases()`, `Purchases.getCustomerInfo()`, `Purchases.addCustomerInfoUpdateListener()`,
`customerInfo.entitlements.active`, `Purchases.logIn()/logOut()`, `RevenueCatUI.presentPaywall()`.

Produce: list of product ids, entitlement ids, and one row per presentation call site → proposed `snake_case` placement.

**Beyond RC - sweep the whole billing surface (real apps carry layers):**

- Other purchase stacks: `SwiftyStoreKit`, `SKPaymentQueue`, `Transaction.updates`, `IAPManager`,
  `StoreObserver`, Play `BillingClient` - each is a competing transaction finisher; plan removal or
  explicit retirement for every one.
- Existing Superwall wrappers: grep `Superwall.configure`, `SWPaywallManager`/`*PaywallManager`
  singletons - hybrid apps often already configure Superwall once; never add a second configure.
- ALL sign-out paths: logout screens, account-deletion flows, 401/session-expiry handlers - each
  needs `Superwall.shared.reset()`.
- Purchase-callback side-effects: backend POSTs, analytics, attribution, navigation (see §5
  "Side-effects").

## 4. Dashboard-side re-creation (CLI)

**Account gate first:** `superwall apps list --json` and confirm one app's `public_api_key` equals
the `pk_` in the code (or the bundle id matches). No match = the CLI session is on the WRONG
account: stop dashboard work, say so loudly in the summary/handback file, and have the user
`superwall login` with the owning account. Never create resources in an unrelated project; never
call the migration complete with dashboard work silently skipped.

For each entitlement and product found, use the project/app ids from the account gate:

```bash
superwall entitlements create pro --project <projectId> --json
superwall products create com.app.pro_monthly --name "Pro Monthly" --project <projectId> --json
superwall products create com.app.pro_yearly --name "Pro Yearly" --project <projectId> --json
```

Product ids MUST equal the existing App Store / Play SKUs (import via ASC connection instead of
manual create when possible - `superwall asc keys set --help`). Then one campaign with
a placement per call site:

```bash
superwall campaigns create "Main paywall" start_workout --project <projectId> --app <appId> --json
superwall campaigns placement <campaignId> unlock_export --project <projectId> --app <appId> --json
```

Verify with the same explicit ids: `superwall entitlements list --project <projectId> --json`,
`superwall products list --project <projectId> --json`, and `superwall campaigns list --project <projectId> --app <appId> --json`.

## 5. Code replacement

### FULL mode

- **Configure.** Replace `Purchases.configure(...)` with `Superwall.configure(apiKey: "…")`. No purchase controller.
- **Entitlement checks.** Replace RC reads:
  ```swift
  // Before
  let info = try? await Purchases.shared.customerInfo()
  return info?.entitlements.active["pro"]?.isActive ?? false
  // After
  if Superwall.shared.subscriptionStatus.isActive { /* entitled */ }
  // or, per-entitlement:
  switch Superwall.shared.subscriptionStatus {
  case .active(let entitlements): handler(true)   // entitlements: Set<Entitlement>
  case .inactive:                 handler(false)
  case .unknown:                  handler(false)
  }
  ```
- **Presentation → placement.** Replace "fetch offering + present paywall" with:
  ```swift
  Superwall.shared.register(placement: "start_workout") {
    navigation.startWorkout()   // runs when entitled (gated) - see §6
  }
  ```
  RN: `Superwall.shared.register({ placement: "start_workout" }, () => {...})`.
  Flutter: `Superwall.shared.registerPlacement("start_workout", feature: () {...})`.
- **Remove `PurchaseController`** if one existed:
  ```swift
  // Before: Superwall.configure(apiKey:"…", purchaseController: RCPurchaseController())
  // After:  Superwall.configure(apiKey: "…")
  ```
- **Identity.** `Purchases.shared.logIn(id)` → `Superwall.shared.identify(userId: id)`; `logOut()` → `Superwall.shared.reset()`.
  Then grep for sign-out paths logIn/logOut DIDN'T cover: account deletion, forced auth-failure
  (401) logout, session expiry. Every one needs `reset()` - a missed path leaks the previous user's
  identity and paywall assignments to the next login. `identify` must run at login AND app-launch
  session-restore, BEFORE any placement can fire.
- **Attributes.** `Purchases.shared.setAttributes([...])` → `Superwall.shared.setUserAttributes([...])`. Call `identify` BEFORE `setUserAttributes`; `identify` is idempotent.
- Remove the RevenueCat dependency only after everything builds and is verified.

### Side-effects - reroute what lived inside RC callbacks (FULL mode, CRITICAL)

Real apps bury critical work inside `PurchaseController.purchase()` / RC delegate callbacks. A
mechanical swap deletes it and everything still compiles - then production breaks. Typical
casualties: a purchase callback that is the ONLY caller of a backend subscription-sync request
(the server route gating every premium feature), or the only place an attribution/analytics
trial-started event is tracked.

Before deleting the controller/delegates, list every statement inside purchase & restore success
paths and reroute each into a `SuperwallDelegate`:

```swift
class AppSuperwallDelegate: SuperwallDelegate {
  func handleSuperwallEvent(withInfo info: SuperwallEventInfo) {
    switch info.event {
    case .transactionComplete(_, let product, _, _):
      syncSubscriptionWithBackend()                    // backend gate stays alive
      Analytics.trackPurchase(product.productIdentifier) // Singular/PostHog/TikTok/…
    case .transactionRestore:
      syncSubscriptionWithBackend()
    default: break
    }
  }
}
// Superwall.shared.delegate = AppSuperwallDelegate() - retain it; set right after configure.
```

- **Backend-gated apps:** if the server checks its own subscription record before unlocking
  features, a device-side purchase that never notifies the server = paying users locked out.
  Keep the sync (delegate POST above) or move gating to Superwall entitlements - and VERIFY the
  backend route accepts the new payload (legacy routes often expect provider-specific ids like an
  RC app-user-id).
- **Analytics/attribution parity:** every event the old callbacks emitted (trial started, purchase,
  restore) must fire from the delegate, or configure the equivalent dashboard integration
  (Settings → Integrations) and verify events arrive before removing the client-side calls.

### PAYWALLS-ONLY mode - iOS `PurchaseController` (verbatim from docs)

```swift
import SuperwallKit
import RevenueCat
import StoreKit

final class RCPurchaseController: PurchaseController {
  func syncSubscriptionStatus() {
    assert(Purchases.isConfigured, "You must configure RevenueCat before calling this method.")
    Task {
      for await customerInfo in Purchases.shared.customerInfoStream {
        let superwallEntitlements = customerInfo.entitlements.activeInCurrentEnvironment.keys.map {
          Entitlement(id: $0)
        }
        await MainActor.run { [superwallEntitlements] in
          Superwall.shared.subscriptionStatus = .active(Set(superwallEntitlements))
        }
      }
    }
  }

  func purchase(product: SuperwallKit.StoreProduct) async -> PurchaseResult {
    do {
      guard let sk2Product = product.sk2Product else { throw PurchasingError.sk2ProductNotFound }
      let storeProduct = RevenueCat.StoreProduct(sk2Product: sk2Product)
      let result = try await Purchases.shared.purchase(product: storeProduct)
      return result.userCancelled ? .cancelled : .purchased
    } catch let error as ErrorCode {
      return error == .paymentPendingError ? .pending : .failed(error)
    } catch { return .failed(error) }
  }

  func restorePurchases() async -> RestorationResult {
    do { _ = try await Purchases.shared.restorePurchases(); return .restored }
    catch { return .failed(error) }
  }
}
```

Wire it:

```swift
let purchaseController = RCPurchaseController()
Superwall.configure(apiKey: "pk_YOUR_PUBLIC_KEY", purchaseController: purchaseController)
purchaseController.syncSubscriptionStatus()
```

RN/Flutter: same shape via `addCustomerInfoUpdateListener` → `Superwall.shared.setSubscriptionStatus(SubscriptionStatus.Active(entitlementIds))` / `.Inactive()`; purchase via `Purchases.purchaseStoreProduct` / `Purchases.purchaseSubscriptionOption` (RN) or `Purchases.purchase(PurchaseParams.storeProduct(...))` (Flutter). Newer RN uses `CustomPurchaseControllerProvider` with `onPurchase`/`onPurchaseRestore` callbacks instead of passing a controller to `configure`.

## 6. Feature gating

Set per placement in the paywall editor (**General → Feature Gating**):

- **Non-gated**: feature closure runs on dismiss whether or not they paid.
- **Gated**: feature closure runs only if the user is (or becomes) entitled.
  Peek without presenting: `Superwall.shared.getPresentationResult(forPlacement:)`.
  `curl -sL https://superwall.com/docs/ios/quickstart/feature-gating.md`

## 7. Order of operations + safety

1. Re-create entitlements, products, campaign + placements in the dashboard (CLI). Import products from ASC/Play so ids match.
2. **Rebuild** paywalls (dashboard editor) and attach products (hand-back to user - designs do not import).
3. Add Superwall SDK alongside RC (don't rip RC yet). Configure it.
4. Replace presentation call sites with `register(placement:)`; replace entitlement reads with `subscriptionStatus`.
5. Build, run, present each placement; **Restore Purchases** as an existing subscriber and confirm `subscriptionStatus.isActive`.
6. FULL: remove `PurchaseController` + the RevenueCat dependency. PAYWALLS-ONLY: keep RC + controller.
7. Never delete RC dashboard/webhook config until verified in production.

Existing subscribers keep access even without a server-side data move - Superwall reads status from
the device's App Store / Play records after **Restore Purchases**. To port subscription history and
entitlement state server-side, follow the RevenueCat migration guide (§9) for the current process.

## 8. Pitfalls

- **Silent "everyone sees a paywall" bug (Mode B).** If you removed RC and kept the app's own
  purchase flow (custom UI / direct StoreKit / Play Billing) but never told Superwall about
  subscription state, Superwall treats every user as `.unknown`/`.inactive` and shows paywalls to
  paying users. Any purchase happening outside Superwall REQUIRES a `PurchaseController`, observer
  mode, or a manual `subscriptionStatus` set (§2 Mode B).
- **Double-charge / dueling finishers.** In PAYWALLS-ONLY, only ONE SDK may finish transactions. Let RC own purchasing via the controller; do NOT also call `Superwall.shared.purchase`. In FULL, remove RC's purchase paths entirely so two SDKs don't both react to StoreKit.
- **StoreKit listener conflicts.** Two SDKs observing StoreKit transactions cause duplicate grants/races. Pick one owner.
- **Observer-mode flag.** `shouldObservePurchases = true` disables `Superwall.shared.purchase`. Only set it in observer (analytics-only) mode, never in FULL.
- **Entitlement id mismatch.** Superwall entitlement ids must exactly match the RC entitlement keys you mirror (`pro` ≠ `Pro`).
- **Cache during switchover.** Right after swapping SDKs, status may read `.unknown`/`.inactive` until the first `customerInfoStream`/StoreKit sync - prompt Restore Purchases if a known subscriber looks free.
- **SK1 vs SK2.** The iOS controller expects a SK2 product (`product.sk2Product`); don't force Superwall to StoreKit 1 via `SuperwallOption`, or `purchase(product:)` gets no SK2 product.
- **identify order.** Call `identify` before `setUserAttributes`, or attributes attach to an anonymous user.
- **Deleted side-effects.** Removing a `PurchaseController` deletes everything inside it - backend
  subscription sync, analytics, attribution. Builds stay green; production breaks. Reroute via
  `SuperwallDelegate` FIRST (§5 "Side-effects").
- **Identity leakage.** No `reset()` on logout/account-deletion/401 paths → next user inherits the
  previous user's identity and sticky paywall assignments.
- **Stranded navigation.** `register` without a feature closure on a gating placement → holdout /
  skipped users tap the button and nothing happens. Gate navigation IN the closure.
- **Duplicate configure.** Hybrid apps often already call `configure` in a wrapper manager; adding
  another in AppDelegate double-configures.

## 9. Deeper docs (fetch live)

```bash
curl -sL https://superwall.com/docs/dashboard/guides/migrating-from-revenuecat-to-superwall.md   # migration guide
curl -sL https://superwall.com/docs/ios/guides/using-revenuecat.md                               # + expo/flutter/android
curl -sL https://superwall.com/docs/ios/guides/advanced/observer-mode.md
curl -sL https://superwall.com/docs/ios/quickstart/tracking-subscription-state.md
curl -sL https://superwall.com/docs/support/faq/how-to-migrate-from-another-provider-to-superwall.md
curl -sL https://superwall.com/docs/llms.txt                                                     # index (per-framework: /ios /expo /react-native /flutter llms.txt)
```

- register(): https://superwall.com/docs/ios/sdk-reference/register · identify(): .../identify · setUserAttributes(): .../setUserAttributes

`PurchasingError` enum (referenced by the iOS controller) - define alongside it:

```swift
enum PurchasingError: LocalizedError { case sk2ProductNotFound
  var errorDescription: String? { "Superwall didn't pass a StoreKit 2 product to purchase." } }
```
