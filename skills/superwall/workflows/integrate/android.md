# Integrate Superwall - Android / Kotlin

You are integrating Superwall into a native Android app (Jetpack Compose or
Views). Get the SDK installed and configured cleanly. **Do not add paywall
triggers (`register`)**; that is the separate **superwall-placements** skill.

## Checklist

Work top to bottom. Steps 1-4 are this skill; 5-6 verify; 7 is the hand-off list.

- [ ] **0. Decide the purchase-handling path** (default / RevenueCat / custom) - it changes what you write in steps 2 & 4.
- [ ] **1. Install** `com.superwall.sdk:superwall-android` via Gradle in the app module.
- [ ] **2. Configure** once in `Application.onCreate()` with the public `pk_` key.
- [ ] **3. API key** handled correctly (public key, not a secret; follow existing config pattern).
- [ ] **4. Purchase handling** wired for the chosen path.
- [ ] **5. Build** - `./gradlew :app:assembleDebug` compiles with the SDK resolved.
- [ ] **6. Run** - Logcat shows Superwall SDK startup; a license-tested account or test mode in place if testing purchases.
- [ ] **7. Post-integration** (identity, attributes, subscription state, deep links, analytics) - see the final section; wire what the app needs, then move to **superwall-placements**.

## Docs access - read the current page when baked steps aren't enough

Superwall's docs are fetchable **as markdown**. When a step below is ambiguous or
you need current detail, fetch the page rather than guessing:

```bash
curl -sL https://superwall.com/docs/android/llms.txt          # index: every Android doc path
curl -sL https://superwall.com/docs/llms-full.txt              # broad context across all SDKs
curl -sL https://superwall.com/docs/android/quickstart/install.md   # any page + ".md"
```

Pattern: fetch `android/llms.txt` to find the slug, then fetch
`https://superwall.com/docs/android/{path}.md`. Every `curl` in this file is
verified working. **Never invent an API** - if a symbol isn't in this reference
or a page you fetched, fetch the page and confirm.

## Quickstart walk

| Order | Slug                                             | Covered by                                |
| ----- | ------------------------------------------------ | ----------------------------------------- |
| 1     | `android/quickstart/install`                     | Step 1 here                               |
| 2     | `android/quickstart/configure`                   | Step 2 here                               |
| 3     | `android/quickstart/feature-gating`              | **superwall-placements** skill (not here) |
| 4     | `android/quickstart/in-app-paywall-previews`     | placements / QA (deep link setup)         |
| 5     | `android/quickstart/setting-user-properties`     | Step 7 here                               |
| 6     | `android/quickstart/tracking-subscription-state` | Step 7 here                               |
| 7     | `android/quickstart/user-management`             | Step 7 here                               |

## Step 0 - Purchase-handling path (decide first)

> **Important:** This choice determines whether you pass a `PurchaseController`
> and whether _you_ must keep `subscriptionStatus` in sync. Paths (b) and (c)
> require manual subscription-status management; path (a) does not.

- **(a) Default - Superwall handles Google Play Billing.** No existing IAP code.
  Recommended, zero purchase code. Superwall manages purchases, restores, and
  subscription status. Use this unless the app already has a billing SDK.
- **(b) RevenueCat stays the source of truth.** The app already uses RevenueCat
  (`com.revenuecat.purchases`). Keep RC as the purchase controller and sync its
  `CustomerInfo` into Superwall, or put RevenueCat in observer mode. Follow
  `curl -sL https://superwall.com/docs/android/guides/using-revenuecat.md`.
- **(c) Custom `PurchaseController`.** The app has its own Play Billing stack.
  Implement `PurchaseController` and drive `subscriptionStatus` yourself.

For a full migration off another SDK, use the **superwall-migrate** skill.

## Step 1 - Install

The artifact is **`com.superwall.sdk:superwall-android`**. Take the version from
the releases page rather than this file (it moves):
`https://github.com/superwall/Superwall-Android/releases`.

```bash
curl -sL https://superwall.com/docs/android/quickstart/install.md
```

Add it to the **app module** (the one whose `build.gradle(.kts)` applies
`com.android.application`), using the form the project already uses:

```kotlin
// app/build.gradle.kts
dependencies {
    implementation("com.superwall.sdk:superwall-android:<latest>")
}
```

```groovy
// app/build.gradle
implementation "com.superwall.sdk:superwall-android:<latest>"
```

```toml
# gradle/libs.versions.toml, when the project uses a version catalog
[libraries]
superwall-android = { group = "com.superwall.sdk", name = "superwall-android", version = "<latest>" }
```

Then sync. `minSdk` must be 23 or higher on SDK 2.8.0+ (21 on older releases;
the install page and changelog say which); the SDK also brings Play Billing 9,
so any other billing library in the app must support it. Keep `INTERNET` in the manifest (it is there for
virtually every app already).

## Step 2 - Configure

Configure once, in the `Application` subclass's `onCreate()`, before any
Activity needs a paywall. If the app has no `Application` subclass, add one and
declare it with `android:name` in `AndroidManifest.xml`.

```bash
curl -sL https://superwall.com/docs/android/quickstart/configure.md
```

```kotlin
// MainApplication.kt
import android.app.Application
import com.superwall.sdk.Superwall

class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Superwall.configure(this, "pk_YOUR_PUBLIC_KEY")
    }
}
```

```xml
<!-- AndroidManifest.xml -->
<application android:name=".MainApplication" ...>
```

The DSL form takes options and a purchase controller:

```kotlin
configureSuperwall("pk_YOUR_PUBLIC_KEY") {
    purchaseController = MyPurchaseController(this@MainApplication)
    options = SuperwallOptions().apply { /* paywalls, logging, … */ }
}
```

Compose apps configure in the same place: `Application.onCreate()`, never inside
a composable or an Activity's `setContent`.

## Step 3 - API key handling

Use the **Public API Key** (starts with `pk_`) from Dashboard ▸ Settings ▸ Keys.
It is not a secret; inlining it in `configure` is conventional. If the project
centralizes keys (`BuildConfig` fields from `local.properties`, a `Secrets`
object, product flavors), follow that pattern. **Never** use a secret/server key
here and never commit one.

## Step 4 - Purchase handling (implements Step 0's choice)

### (a) Default

Nothing extra. `Superwall.configure(context, apiKey)` with no
`purchaseController` means Superwall manages purchases, restores, and
subscription status through Google Play Billing.

### (b) RevenueCat

Create an `RCPurchaseController : PurchaseController` that forwards `purchase` to
RevenueCat and `restorePurchases` to `Purchases.sharedInstance.restorePurchases`,
then sync entitlements from RevenueCat's customer info into
`Superwall.instance.setSubscriptionStatus(...)`:

```kotlin
val purchaseController = RCPurchaseController(this)
Superwall.configure(this, "pk_YOUR_PUBLIC_KEY", purchaseController)
purchaseController.syncSubscriptionStatus()
```

> **Important:** Copy the full `RCPurchaseController` from the doc - do not hand-roll it.
> `curl -sL https://superwall.com/docs/android/guides/using-revenuecat.md`
> The same page describes observer mode (`PurchasesAreCompletedBy`) as the
> recommended alternative when the app does not need to own purchasing.

### (c) Custom `PurchaseController`

```bash
curl -sL https://superwall.com/docs/android/guides/advanced-configuration.md
```

```kotlin
import android.app.Activity
import android.content.Context
import com.superwall.sdk.delegate.PurchaseResult
import com.superwall.sdk.delegate.RestorationResult
import com.superwall.sdk.delegate.subscription_controller.PurchaseController
import com.superwall.sdk.store.abstractions.product.StoreProduct

class MyPurchaseController(val context: Context) : PurchaseController {
    override suspend fun purchase(
        activity: Activity,
        product: StoreProduct,
        basePlanId: String?,
        offerId: String?,
    ): PurchaseResult {
        // Purchase via Play Billing / your billing system, then return one of:
        return PurchaseResult.Purchased()   // Cancelled(), Pending(), Failed(message)
    }

    override suspend fun restorePurchases(): RestorationResult {
        return RestorationResult.Restored()   // Failed(error)
    }
}

Superwall.configure(this, "pk_YOUR_PUBLIC_KEY", MyPurchaseController(this))
```

> **Important (paths b & c):** With a `PurchaseController` you **must** call
> `Superwall.instance.setSubscriptionStatus(...)` whenever entitlements change.
> Cases: `SubscriptionStatus.Unknown` (default - paywalls wait),
> `SubscriptionStatus.Active(entitlements)` (a `Set<Entitlement>`),
> `SubscriptionStatus.Inactive`. Leaving it `Unknown` means paywalls never present.

```kotlin
Superwall.instance.setSubscriptionStatus(SubscriptionStatus.Active(entitlements))
Superwall.instance.setSubscriptionStatus(SubscriptionStatus.Inactive)
```

## Step 5 & 6 - Verify

1. **Build:** `./gradlew :app:assembleDebug` (use the module name the project has).
   Must compile with the SDK resolved; a version catalog typo shows up here.
2. **Run** on an emulator or device; Logcat (filter `Superwall`) logs SDK startup.
   To confirm the key, temporarily set `SuperwallOptions().logging.level` to
   debug and look for a successful config fetch.
3. **Purchases without Play Console products** - test mode simulates purchases
   end to end: `curl -sL https://superwall.com/docs/android/guides/test-mode.md`.
   Real Play Billing needs the app in a Play track with a license-tester account
   and product IDs that match the paywall's products.

## Step 7 - Post-integration (wire what the app needs, then → placements)

Do the ones the app requires. Each has a fetchable page.

- **User identity - REQUIRED if the app has ANY auth/login system.** Not optional:
  without it every logged-in user is anonymous to Superwall, breaking user-scoped
  audiences, attribution, and cross-device status. Wire it the moment you see a
  login/logout flow (grep for signIn/login/logout/signOut/auth). Call
  `Superwall.instance.identify(userId)` on login, `Superwall.instance.reset()` on
  logout. The `userId` must not be an email, a device id, or guessable. Superwall
  SHA-256 hashes it before passing it to Play as the obfuscated account id;
  `SuperwallOptions().passIdentifiersToPlayStore = true` sends it raw.
  `curl -sL https://superwall.com/docs/android/quickstart/user-management.md`
  ```kotlin
  Superwall.instance.identify(user.id)
  Superwall.instance.reset()   // on sign-out
  ```
- **User attributes** - target audiences / fill paywall variables.
  `curl -sL https://superwall.com/docs/android/quickstart/setting-user-properties.md`
  ```kotlin
  Superwall.instance.setUserAttributes(mapOf("email" to user.email, "plan" to "trial"))
  Superwall.instance.setUserAttributes(mapOf("plan" to null))   // unset a key
  ```
- **Tracking subscription state** - `Superwall.instance.subscriptionStatus` is a
  `StateFlow<SubscriptionStatus>`; read `.value` or `collect` it in a
  `lifecycleScope`. Cases: `Active(entitlements)`, `Inactive`, `Unknown`.
  `curl -sL https://superwall.com/docs/android/quickstart/tracking-subscription-state.md`
- **Deep links** - pass incoming URIs (from `intent.data` in `onCreate` /
  `onNewIntent`) to `Superwall.instance.handleDeepLink(intent.data.toString())` —
  the Android signature takes the URL as a `String`; it fires the
  `deepLink_open` placement so routing is dashboard-driven. Needs an intent
  filter for the scheme / App Link first.
  `curl -sL https://superwall.com/docs/android/guides/handling-deep-links.md`
  `curl -sL https://superwall.com/docs/android/quickstart/in-app-paywall-previews.md`
- **Delegate and 3rd-party analytics** - `Superwall.instance.delegate = …`
  implementing `SuperwallDelegate`; `handleSuperwallEvent` forwards events,
  `subscriptionStatusDidChange`, `handleCustomPaywallAction`.
  `curl -sL https://superwall.com/docs/android/guides/using-superwall-delegate.md`

## Pitfalls

- **Configured in an Activity instead of `Application.onCreate()`** → paywalls
  configured late or more than once; the first `register` calls are dropped.
- **Wrong module** → the dependency added to a library module or the root
  `build.gradle`; it belongs to the app module (or the catalog plus the app module).
- **Configured but paywalls never show** → `subscriptionStatus` stuck at `Unknown`
  (only when you use a `PurchaseController` - you must set it), or no placement yet
  (that's the placements skill).
- **ProGuard / R8 stripping** → the SDK ships consumer rules (per the changelog); if minified builds
  fail, confirm nothing strips `com.superwall.sdk` before adding rules.
- **Secret key** → the key must start with `pk_`; a secret key fails config.

## Deeper docs

- Index: `curl -sL https://superwall.com/docs/android/llms.txt`
- Install: https://superwall.com/docs/android/quickstart/install
- Configure: https://superwall.com/docs/android/quickstart/configure
- Advanced purchasing / PurchaseController: https://superwall.com/docs/android/guides/advanced-configuration
- Using RevenueCat: https://superwall.com/docs/android/guides/using-revenuecat
- Test mode: https://superwall.com/docs/android/guides/test-mode
- SDK reference: https://superwall.com/docs/android/sdk-reference/Superwall
