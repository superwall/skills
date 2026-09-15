# Review Superwall - Android / Kotlin

You are reviewing an existing Android integration using
`com.superwall.sdk:superwall-android`. Complete the whole checklist;
placements are one part of it.

## Checklist

- [ ] SDK dependency in the app module and `minSdk`
- [ ] one early `configure` call in `Application.onCreate()` and the intended public key/options
- [ ] purchase controller, restore flow, and subscription-status ownership
- [ ] identity, reset, and user attributes
- [ ] intent filters / App Links and `handleDeepLink`
- [ ] conditional Web Checkout redemption readiness
- [ ] placements, feature lambdas, campaign coverage, and standard placements
- [ ] products, entitlements, paywalls, campaigns, and Play Console product IDs
- [ ] delegate/analytics and a build or test verification path

## Docs access

```bash
curl -sL https://superwall.com/docs/android/llms.txt
curl -sL https://superwall.com/docs/android/quickstart/configure.md
curl -sL https://superwall.com/docs/android/guides/advanced-configuration.md
curl -sL https://superwall.com/docs/android/quickstart/tracking-subscription-state.md
curl -sL https://superwall.com/docs/android/quickstart/user-management.md
curl -sL https://superwall.com/docs/android/guides/handling-deep-links.md
curl -sL https://superwall.com/docs/android/guides/web-checkout.md
curl -sL https://superwall.com/docs/android/quickstart/feature-gating.md
```

## 1. SDK and configuration

Inspect the app module's `build.gradle(.kts)` and `gradle/libs.versions.toml`
for `com.superwall.sdk:superwall-android` and its version. Confirm
`Superwall.configure(...)` (or `configureSuperwall { }`) runs once in
`Application.onCreate()`, declared via `android:name` in the manifest, not in an
Activity or a composable. A `pk_` key is public and may be inlined; verify it
belongs to the current app rather than treating its presence as a secret leak.
Read any `SuperwallOptions` and judge intentional behavior, not mere
customization.

## 2. Purchases, restores, and subscription state

Infer exactly which path the app uses:

- **Default:** no `PurchaseController` is correct; Superwall owns purchases,
  restores, and subscription status through Play Billing.
- **RevenueCat/custom:** the controller must implement `purchase(activity,
  product, basePlanId, offerId)` and `restorePurchases()`, return accurate
  `PurchaseResult` / `RestorationResult` cases, and keep
  `Superwall.instance.setSubscriptionStatus(...)` synchronized as entitlements
  change. RevenueCat in observer mode is the documented alternative; do not
  flag it as missing a controller.

Reading `subscriptionStatus` (a `StateFlow`), `.value`, customer info, or
entitlements is a documented way to drive app state and UI. Report a problem
only when two sources contradict each other, status remains `Unknown`, restore
is missing, or access logic demonstrably bypasses the intended purchase
architecture.

Compare dashboard products/entitlements with Play Console product IDs and base
plans when CLI access exists. Do not label an auth or network failure as broken
subscriptions; put it under **Not verified**.

## 3. Identity and attributes

If the app has accounts, trace the real login and logout paths. Expect
`Superwall.instance.identify(userId)` after identity is known and
`Superwall.instance.reset()` on logout. The id is hashed before it reaches Play
unless `passIdentifiersToPlayStore` is set; either way it must not be an email
or a device id. Review `setUserAttributes` for useful targeting data and
accidental sensitive values.

## 4. Deep links and Web Checkout

Trace every URI entry point: the launcher Activity's `intent.data` in
`onCreate`, `onNewIntent`, navigation deep links, and any routing service.
Incoming URIs intended for Superwall should reach
`Superwall.instance.handleDeepLink(uri)`, which produces the standard
`deepLink_open` placement with URL parameters. A hardcoded URI-to-placement
`when` is worth improving when dashboard campaign rules can replace it. Confirm
the manifest has the intent filter (custom scheme or verified App Link).

Web Checkout is conditional. If the app/dashboard uses it, verify return URLs
and post-checkout handling. Default Superwall purchasing needs no custom
redemption sync. A custom controller must merge redeemed web entitlements with
device entitlements and update status; RevenueCat must follow its documented
path. If there is no Web Checkout intent, list readiness only as an optional
opportunity.

## 5. Placements and lifecycle

Find `register(`, wrappers, analytics bridges, and placement constants.
Analytics bridges and calls without a feature lambda are valid. Require a
feature lambda only when the action itself is meant to be remotely gated. Check
valuable surfaces, placement parameters, accidental calls during composition
(inside a composable body rather than an `onClick` or `LaunchedEffect`), and
exact name agreement with active campaigns. Unrouted analytics/future
placements are fine.

Prefer standard `app_launch`, `session_start`, and `deepLink_open` placements
over custom duplicates when the semantics truly match. Do not suggest cosmetic
renames of stable keys. Review delegate forwarding for duplicated analytics or
missing subscription/redemption callbacks only when the app relies on them.

## 6. Dashboard and verification

Run the read-only CLI cross-checks from `SKILL.md`. A presenting chain needs a
matching Android app, product attached to the intended entitlement/paywall, and
an active campaign audience for placements expected to show now. Cite dashboard
IDs where available. Finally identify the project's existing Gradle build/test
command (`./gradlew :app:assembleDebug`, `./gradlew test`); in fix mode, run it
after minimal changes.

## Fix-mode boundaries

Fix clear wiring bugs and code/doc mismatches. Do not switch purchase providers,
enable Web Checkout, rename stable placements, change prices, or invent campaign
strategy without an explicit user decision.
