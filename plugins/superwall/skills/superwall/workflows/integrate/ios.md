# Integrate Superwall - iOS / Swift

You are integrating Superwall into a native iOS app (SwiftUI or UIKit). Get the
SDK installed and configured cleanly. **Do not add paywall triggers (`register`)**;
that is the separate **superwall-placements** skill.

## Checklist

Work top to bottom. Steps 1-4 are this skill; 5-6 verify; 7 is the hand-off list.

- [ ] **0. Decide the purchase-handling path** (default / RevenueCat / custom) - it changes what you write in steps 2 & 4.
- [ ] **1. Install** `SuperwallKit` via the manager the project already uses (SPM or CocoaPods).
- [ ] **2. Configure** once at launch with the public `pk_` key.
- [ ] **3. API key** handled correctly (public key, not a secret; follow existing config pattern).
- [ ] **4. Purchase handling** wired for the chosen path.
- [ ] **5. Build** - compiles with `SuperwallKit` resolved.
- [ ] **6. Run** - console shows Superwall SDK startup; StoreKit test config in place if testing purchases.
- [ ] **7. Post-integration** (identity, attributes, subscription state, deep links, analytics) - see the final section; wire what the app needs, then move to **superwall-placements**.

## Docs access - read the current page when baked steps aren't enough

Superwall's docs are fetchable **as markdown**. When a step below is ambiguous or
you need current detail, fetch the page rather than guessing:

```bash
curl -sL https://superwall.com/docs/ios/llms.txt          # index: every iOS doc path
curl -sL https://superwall.com/docs/llms-full.txt          # broad context across all SDKs
curl -sL https://superwall.com/docs/ios/quickstart/install.md   # any page + ".md"
```

Pattern: fetch `ios/llms.txt` to find the slug, then fetch
`https://superwall.com/docs/ios/{path}.md`. Every `curl` in this file is verified
working. **Never invent an API** - if a symbol isn't in this reference or a page
you fetched, fetch the page and confirm.

## Quickstart walk

The iOS quickstart is a sequence of pages. This reference mirrors it. Fetch any
page with the `curl` shown at that step.

| Order | Slug                                         | Covered by                                |
| ----- | -------------------------------------------- | ----------------------------------------- |
| 1     | `ios/quickstart/install`                     | Step 1 here                               |
| 2     | `ios/quickstart/configure`                   | Step 2 here                               |
| 3     | `ios/quickstart/feature-gating`              | **superwall-placements** skill (not here) |
| 4     | `ios/quickstart/in-app-paywall-previews`     | placements / QA                           |
| 5     | `ios/quickstart/setting-user-properties`     | Step 7 here                               |
| 6     | `ios/quickstart/tracking-subscription-state` | Step 7 here                               |
| 7     | `ios/quickstart/user-management`             | Step 7 here                               |

## Step 0 - Purchase-handling path (decide first)

> **Important:** This choice determines whether you pass a `PurchaseController`
> and whether _you_ must keep `subscriptionStatus` in sync. Paths (b) and (c)
> require manual subscription-status management; path (a) does not.

- **(a) Default - Superwall handles StoreKit.** No existing IAP code. Recommended,
  zero purchase code. Superwall manages purchases, restores, and subscription
  status. Use this unless the app already has a billing SDK.
- **(b) RevenueCat stays the source of truth.** The app already uses RevenueCat.
  Keep RC as the purchase controller and sync its `CustomerInfo` into Superwall.
  Follow `curl -sL https://superwall.com/docs/ios/guides/using-revenuecat.md`.
- **(c) Custom `PurchaseController`.** The app has its own StoreKit/billing stack.
  Implement `PurchaseController` and drive `subscriptionStatus` yourself.

For a full migration off another SDK, use the **superwall-migrate** skill.

## Step 1 - Install

The SDK product is **`SuperwallKit`** from `github.com/superwall/Superwall-iOS`.
Use the dependency manager the project already uses.

```bash
curl -sL https://superwall.com/docs/ios/quickstart/install.md
```

### Swift Package Manager (preferred; detect `Package.swift` or existing SPM setup)

**Via Xcode UI:**

1. File ▸ Add Package Dependencies…
2. Paste `https://github.com/superwall/Superwall-iOS`.
3. Dependency Rule: **Up to Next Major Version**, lower bound **`4.0.0`**.
4. Add Package; confirm the **SuperwallKit** product is added to your app target.

**Via `Package.swift`** (SPM projects, and the safe route for an agent with Xcode closed):

```swift
dependencies: [
  .package(url: "https://github.com/superwall/Superwall-iOS", from: "4.0.0"),
],
targets: [
  .target(
    name: "YourApp",
    dependencies: [
      .product(name: "SuperwallKit", package: "Superwall-iOS"),
    ]
  ),
]
```

**Editing `.pbxproj` directly** (agent, no Xcode): only if the project already has
SPM references to copy the exact `XCRemoteSwiftPackageReference` /
`XCSwiftPackageProductDependency` structure from; then
`xcodebuild -resolvePackageDependencies`. Otherwise instruct the user to add it via
the Xcode UI - safer than hand-editing.

### CocoaPods (detect a `Podfile`)

Add to the app target:

```ruby
pod 'SuperwallKit', '< 5.0.0'
```

Then:

```bash
pod repo update
pod install
```

> **Important:** With CocoaPods, set **User Script Sandboxing = No** in the
> target's Build Settings, or the build fails on the SDK's build phase.

## Step 2 - Configure

Call `Superwall.configure(apiKey:)` **once, at launch, as early as possible**.

```bash
curl -sL https://superwall.com/docs/ios/quickstart/configure.md
```

```swift
import SuperwallKit
```

### SwiftUI - in the `App` struct's `init()`

```swift
import SwiftUI
import SuperwallKit

@main
struct MyApp: App {
  init() {
    Superwall.configure(apiKey: "pk_YOUR_PUBLIC_KEY")
  }

  var body: some Scene {
    WindowGroup { ContentView() }
  }
}
```

### UIKit - in `AppDelegate`

```swift
import UIKit
import SuperwallKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    Superwall.configure(apiKey: "pk_YOUR_PUBLIC_KEY")
    return true
  }
}
```

With a `SceneDelegate`, still configure in `AppDelegate`'s
`didFinishLaunchingWithOptions` - it runs first and only once.

### Objective-C

```objectivec
@import SuperwallKit;
[Superwall configureWithApiKey:@"pk_YOUR_PUBLIC_KEY"];
```

## Step 3 - API key handling

Use the **Public API Key** (starts with `pk_`) from Dashboard ▸ Settings ▸ Keys.
On iOS it is conventional to inline the public key in the `configure` call - it is
not a secret. **Never** use a secret/server key here and never commit one. If the
project centralizes config (an `.xcconfig`, a `Secrets` enum), follow that pattern.

## Step 4 - Purchase handling (implements Step 0's choice)

### (a) Default

Nothing extra. `Superwall.configure(apiKey:)` with no `purchaseController` means
Superwall manages purchases, restores, and subscription status automatically.

### (b) RevenueCat

Create an `RCPurchaseController: PurchaseController` that forwards `purchase` to
`Purchases.shared.purchase()` and `restorePurchases` to
`Purchases.shared.restorePurchases()`, then sync entitlements via RevenueCat's
`customerInfoStream` into `Superwall.shared.subscriptionStatus`:

```swift
let purchaseController = RCPurchaseController()
Superwall.configure(apiKey: "pk_YOUR_PUBLIC_KEY", purchaseController: purchaseController)
purchaseController.syncSubscriptionStatus()
```

> **Important:** Copy the full `RCPurchaseController` from the doc - do not hand-roll it.
> `curl -sL https://superwall.com/docs/ios/guides/using-revenuecat.md`

### (c) Custom `PurchaseController`

```bash
curl -sL https://superwall.com/docs/ios/guides/advanced-configuration.md
```

```swift
import SuperwallKit
import StoreKit

final class MyPurchaseController: PurchaseController {
  static let shared = MyPurchaseController()

  func purchase(product: StoreProduct) async -> PurchaseResult {
    // Purchase via StoreKit / your billing system, then return one of:
    return .purchased            // .cancelled, .pending, .failed(Error)
  }

  func restorePurchases() async -> RestorationResult {
    return .restored             // .failed(error)
  }
}

Superwall.configure(
  apiKey: "pk_YOUR_PUBLIC_KEY",
  purchaseController: MyPurchaseController.shared
)
```

> **Important (paths b & c):** With a `PurchaseController` you **must** set
> `Superwall.shared.subscriptionStatus` whenever entitlements change. Cases:
> `.unknown` (default - paywalls wait), `.active(let entitlements)` (a
> `Set<Entitlement>`), `.inactive`. Leaving it `.unknown` means paywalls never present.

```swift
Superwall.shared.subscriptionStatus = .active(entitlements)   // Set<Entitlement>
Superwall.shared.subscriptionStatus = .inactive
```

## Step 5 & 6 - Verify

1. **Build:** `xcodebuild -scheme <YourScheme> -destination 'generic/platform=iOS' build`
   (or ⌘B). Must compile with `SuperwallKit` resolved.
2. **Run** on a simulator; the Xcode console logs Superwall SDK startup. To confirm
   the key, temporarily set `SuperwallOptions.logging.level = .debug` and look for a
   successful config fetch.
3. **StoreKit testing** (test purchases without App Store Connect): File ▸ New ▸
   File… ▸ StoreKit Configuration File, name it `Products`, save at project root
   (don't add to target). Scheme ▸ Run ▸ Options ▸ StoreKit Configuration ▸ select
   `Products.storekit`. Product IDs must match the products on your paywall. Reset via
   Debug ▸ StoreKit ▸ Manage Transactions.
   `curl -sL https://superwall.com/docs/ios/guides/testing-purchases.md`

## Step 7 - Post-integration (wire what the app needs, then → placements)

Do the ones the app requires. Each has a fetchable page.

- **User identity - REQUIRED if the app has ANY auth/login system.** Not optional: without it every logged-in user is anonymous to Superwall, breaking user-scoped audiences, attribution, and cross-device status. Wire it the moment you see a login/logout flow (grep for signIn/login/logout/signOut/auth). call `Superwall.shared.identify(userId:)` on login,
  `Superwall.shared.reset()` on logout. `userId` **must be a valid UUID** (StoreKit
  compat) and must not be an email, device id, or guessable value.
  `curl -sL https://superwall.com/docs/ios/quickstart/user-management.md`
  ```swift
  Superwall.shared.identify(userId: user.id)
  Superwall.shared.reset()   // on sign-out
  ```
- **User attributes** - target audiences / fill paywall variables.
  `curl -sL https://superwall.com/docs/ios/quickstart/setting-user-properties.md`
  ```swift
  Superwall.shared.setUserAttributes(["email": user.email, "plan": "trial"])
  // pass nil to unset a key (Swift only)
  ```
- **Tracking subscription state** - read `Superwall.shared.subscriptionStatus`
  (or `.isActive`); observe changes via the delegate's
  `subscriptionStatusDidChange(from:to:)`.
  `curl -sL https://superwall.com/docs/ios/quickstart/tracking-subscription-state.md`
- **Deep links** - pass incoming URLs to `Superwall.handleDeepLink(url)`; it fires
  the `deepLink_open` placement so routing is dashboard-driven.
  `curl -sL https://superwall.com/docs/ios/guides/handling-deep-links.md`
- **3rd-party analytics** - forward Superwall events to your analytics via the
  delegate. `curl -sL https://superwall.com/docs/ios/guides/3rd-party-analytics.md`

## Pitfalls

- **CocoaPods build failure** → **User Script Sandboxing = No** in Build Settings.
- **`.pbxproj` hand-edits with Xcode open** → Xcode overwrites them; close Xcode or use the UI.
- **Configured but paywalls never show** → `subscriptionStatus` stuck at `.unknown`
  (only when you use a `PurchaseController` - you must set it), or no placement yet
  (that's the placements skill).
- **Configuring more than once / not at launch** → configure exactly once in
  `App.init()` or `didFinishLaunchingWithOptions`, not in a view body.
- **Secret key** → the key must start with `pk_`; a secret key fails config.

## Deeper docs

- Index: `curl -sL https://superwall.com/docs/ios/llms.txt`
- Install: https://superwall.com/docs/ios/quickstart/install
- Configure: https://superwall.com/docs/ios/quickstart/configure
- Advanced purchasing / PurchaseController: https://superwall.com/docs/ios/guides/advanced-configuration
- Using RevenueCat: https://superwall.com/docs/ios/guides/using-revenuecat
- StoreKit testing: https://superwall.com/docs/ios/guides/testing-purchases
- SDK reference: https://superwall.com/docs/ios/sdk-reference/Superwall
