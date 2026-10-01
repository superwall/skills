# Integrate Superwall - Flutter

You are integrating Superwall into a Flutter app using the
**`superwallkit_flutter`** package. Get it installed and configured. **Do not add
paywall triggers (`registerPlacement`)** - that is the separate
**superwall-placements** skill.

**Requirements:** iOS deployment target **14.0+**; Android **minSdkVersion 26**,
**compileSdk 34**, Gradle **8.6+**, Android Gradle Plugin **8.4+**.

## Checklist

- [ ] **0. Decide the purchase-handling path** (default / RevenueCat / custom).
- [ ] **1. Install** `superwallkit_flutter`; set iOS/Android native minimums + Android activities.
- [ ] **2. Configure** once at launch with the platform's `pk_` key.
- [ ] **3. API keys** branched on `Platform.isIOS` (public keys, never secrets).
- [ ] **4. Purchase handling** for the chosen path.
- [ ] **5. Build** - `flutter run` on iOS sim + Android emulator; pods/gradle resolve.
- [ ] **6. Run** - console shows Superwall startup; StoreKit test config if testing purchases.
- [ ] **7. Post-integration** (identity, attributes, subscription state, deep links, analytics), then → **superwall-placements**.

## Docs access - read the current page when baked steps aren't enough

```bash
curl -sL https://superwall.com/docs/flutter/llms.txt        # index: every Flutter doc path
curl -sL https://superwall.com/docs/llms-full.txt            # broad context across all SDKs
curl -sL https://superwall.com/docs/flutter/quickstart/install.md   # any page + ".md"
```

Pattern: fetch `flutter/llms.txt` for the slug, then
`https://superwall.com/docs/flutter/{path}.md`. Every `curl` here is verified
working. **Never invent an API** - if a symbol isn't in this reference or a page you
fetched, fetch and confirm.

## Quickstart walk

| Order | Slug                                             | Covered by                     |
| ----- | ------------------------------------------------ | ------------------------------ |
| 1     | `flutter/quickstart/install`                     | Step 1 here                    |
| 2     | `flutter/quickstart/configure`                   | Step 2 here                    |
| 3     | `flutter/quickstart/feature-gating`              | **superwall-placements** skill |
| 4     | `flutter/quickstart/in-app-paywall-previews`     | placements / QA                |
| 5     | `flutter/quickstart/setting-user-properties`     | Step 7 here                    |
| 6     | `flutter/quickstart/tracking-subscription-state` | Step 7 here                    |
| 7     | `flutter/quickstart/user-management`             | Step 7 here                    |

## Step 0 - Purchase-handling path (decide first)

> **Important:** Paths (b)/(c) require you to keep `subscriptionStatus` in sync;
> path (a) does not.

- **(a) Default - Superwall handles StoreKit/Billing.** Recommended, zero purchase code.
- **(b) RevenueCat stays the source of truth.** Keep RC purchasing; sync entitlements in.
  `curl -sL https://superwall.com/docs/flutter/guides/using-revenuecat.md`
- **(c) Custom `PurchaseController`.** Supply one, drive status.

Full migration off another SDK → **superwall-migrate** skill.

## Step 1 - Install

Add the package (match the project's existing Flutter tooling):

```bash
curl -sL https://superwall.com/docs/flutter/quickstart/install.md
flutter pub add superwallkit_flutter
```

Or add `superwallkit_flutter` to `pubspec.yaml` under `dependencies:` (use the
latest version on pub.dev) then `flutter pub get`.

### iOS native config

`ios/Podfile`:

```ruby
platform :ios, '14.0'
```

Then `cd ios && pod install` (or let the next `flutter run` install pods).

### Android native config

`android/app/build.gradle`:

```groovy
android {
    compileSdkVersion 34
    defaultConfig {
        minSdkVersion 26
        targetSdkVersion 34
    }
}
```

`android/build.gradle` - AGP 8.4+:

```groovy
plugins { id 'com.android.application' version '8.4.1' apply false }
```

`android/gradle/wrapper/gradle-wrapper.properties` - Gradle 8.6+:

```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.6-bin.zip
```

> **Important:** Register Superwall's activities in the `<application>` tag of
> `android/app/src/main/AndroidManifest.xml`, or Android builds/paywalls fail:

```xml
<activity
  android:name="com.superwall.sdk.paywall.view.SuperwallPaywallActivity"
  android:theme="@style/Theme.MaterialComponents.DayNight.NoActionBar"
  android:configChanges="orientation|screenSize|keyboardHidden">
</activity>
<activity android:name="com.superwall.sdk.debug.DebugViewActivity" />
<activity android:name="com.superwall.sdk.debug.localizations.SWLocalizationActivity" />
<activity android:name="com.superwall.sdk.debug.SWConsoleActivity" />
```

## Step 2 - Configure

```bash
curl -sL https://superwall.com/docs/flutter/quickstart/configure.md
```

```dart
import 'package:superwallkit_flutter/superwallkit_flutter.dart';
```

Call `Superwall.configure` **once, at launch**, with the platform's public key.

**In `main()`** (call `WidgetsFlutterBinding.ensureInitialized()` first if you
configure before `runApp`):

```dart
import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:superwallkit_flutter/superwallkit_flutter.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final apiKey = Platform.isIOS ? "pk_YOUR_IOS_PUBLIC_KEY" : "pk_YOUR_ANDROID_PUBLIC_KEY";
  Superwall.configure(apiKey);
  runApp(const MyApp());
}
```

**Or in a root widget's `initState()`:**

```dart
@override
void initState() {
  super.initState();
  final apiKey = Platform.isIOS ? "pk_YOUR_IOS_PUBLIC_KEY" : "pk_YOUR_ANDROID_PUBLIC_KEY";
  Superwall.configure(apiKey);
}
```

Optional behavior goes through `SuperwallOptions` via the named `options:` argument:
`Superwall.configure("pk_...", options: options)`.

## Step 3 - API key handling

Use the **Public API Key(s)** (`pk_…`) from Dashboard ▸ Settings ▸ Keys - iOS and
Android apps have separate keys, so branch on `Platform.isIOS`. Public keys aren't
secrets; inline them, or read from existing config (`--dart-define` /
`String.fromEnvironment`). **Never** use a secret key.

## Step 4 - Purchase handling (implements Step 0's choice)

### (a) Default

Just `Superwall.configure(apiKey)`. Superwall handles purchases, restores, and
subscription status.

### (b) RevenueCat / (c) custom

Implement a `PurchaseController` and pass it in. Read the page first:

```bash
curl -sL https://superwall.com/docs/flutter/guides/advanced-configuration.md
```

```dart
class MyPurchaseController extends PurchaseController {
  @override
  Future<PurchaseResult> purchaseFromAppStore(String productId) async {
    // Purchase via StoreKit / RevenueCat / your billing system, then return:
    return PurchaseResult.purchased;
  }

  @override
  Future<PurchaseResult> purchaseFromGooglePlay(
    String productId, String? basePlanId, String? offerId) async {
    return PurchaseResult.purchased;
  }

  @override
  Future<RestorationResult> restorePurchases() async {
    return RestorationResult.restored;
  }
}
```

Pass it at configure time (**positional** second argument):

```dart
Superwall.configure(apiKey, MyPurchaseController());
```

> **Important (paths b & c):** keep subscription status synced whenever entitlements
> change:
>
> ```dart
> Superwall.shared.setSubscriptionStatus(
>   SubscriptionStatusActive(entitlements: {Entitlement(id: "pro")}),
> );
> // or
> Superwall.shared.setSubscriptionStatus(SubscriptionStatusInactive());
> ```
>
> For (b), map RevenueCat's active entitlements into that call. Confirm the exact
> `configure` argument shape against the advanced-configuration page - some SDK
> versions differ.

## Step 5 & 6 - Verify

1. **Build & run:** `flutter run` on an iOS simulator and an Android emulator. Must
   compile with pods/gradle resolved.
2. Watch the console on launch for Superwall SDK startup. Raise verbosity via
   `SuperwallOptions` logging if needed.
3. For iOS purchase testing, read the StoreKit testing guide:
   `curl -sL https://superwall.com/docs/flutter/guides/testing-purchases.md`

## Step 7 - Post-integration (wire what the app needs, then → placements)

- **User identity - REQUIRED if the app has ANY auth/login system.** Not optional: without it every logged-in user is anonymous to Superwall, breaking user-scoped audiences, attribution, and cross-device status. Wire it the moment you see a login/logout flow (grep for signIn/login/logout/signOut/auth). `Superwall.shared.identify(user.id)` on login,
  `Superwall.shared.reset()` on logout. `userId` should be a **UUID** (StoreKit
  compat), never an email/device id/guessable value.
  `curl -sL https://superwall.com/docs/flutter/quickstart/user-management.md`
  ```dart
  Superwall.shared.identify(user.id);
  Superwall.shared.reset();   // on sign-out
  ```
  > **Use when** you need the unhashed `appUserId` to reach Google Play: set
  > `SuperwallOptions()..passIdentifiersToPlayStore = true` and pass it via
  > `identify(user.id, options: options)` (Android only).
- **User attributes** - `Superwall.shared.setUserAttributes(attributes)` (a
  `Map<String, dynamic>`; merges, overwriting matching keys). The Flutter SDK does
  **not** support deleting an attribute via `null`.
  `curl -sL https://superwall.com/docs/flutter/quickstart/setting-user-properties.md`
- **Tracking subscription state** - read `Superwall.shared.subscriptionStatus`
  (`.unknown` / `.active(entitlements)` / `.inactive`).
  `curl -sL https://superwall.com/docs/flutter/quickstart/tracking-subscription-state.md`
- **Deep links** - pass incoming URLs to `Superwall.shared.handleDeepLink(url)`; it
  fires the `deepLink_open` placement so routing is dashboard-driven.
  `curl -sL https://superwall.com/docs/flutter/guides/handling-deep-links.md`
  ```dart
  Future<void> handleUrl(Uri url) async => Superwall.shared.handleDeepLink(url);
  ```
- **3rd-party analytics** - forward Superwall events via the delegate.
  `curl -sL https://superwall.com/docs/flutter/guides/3rd-party-analytics.md`

## Pitfalls

- **Android build fails** → check minSdk 26 / compileSdk 34 / Gradle 8.6 / AGP 8.4,
  and that the four Superwall activities are declared in `AndroidManifest.xml`.
- **iOS pod errors** → set `platform :ios, '14.0'` in the `Podfile`, then
  `cd ios && pod install`.
- **Configuring before bindings ready** → call
  `WidgetsFlutterBinding.ensureInitialized()` before `Superwall.configure` in `main()`.
- **Configured but paywalls never show** → with a `PurchaseController` you must set
  `subscriptionStatus`; and no placement yet (that's the placements skill).
- **Secret key** → the key must start with `pk_` (public).

## Deeper docs

- Index: `curl -sL https://superwall.com/docs/flutter/llms.txt`
- Install: https://superwall.com/docs/flutter/quickstart/install
- Configure: https://superwall.com/docs/flutter/quickstart/configure
- Advanced purchasing / PurchaseController: https://superwall.com/docs/flutter/guides/advanced-configuration
- Using RevenueCat: https://superwall.com/docs/flutter/guides/using-revenuecat
- Configuring (options): https://superwall.com/docs/flutter/guides/configuring
- StoreKit testing: https://superwall.com/docs/flutter/guides/testing-purchases
