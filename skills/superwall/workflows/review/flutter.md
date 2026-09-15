# Review Superwall - Flutter

You are reviewing an existing Flutter integration using `superwallkit_flutter`.
Complete the whole checklist; placements are one part of it.

## Checklist

- [ ] package and iOS/Android native configuration
- [ ] one early `configure` call with the correct platform key/options
- [ ] purchase controller, restore flow, and subscription-status ownership
- [ ] identity/reset and user attributes
- [ ] platform links/router and `handleDeepLink`
- [ ] conditional Web Checkout redemption readiness
- [ ] placements, callbacks, campaigns, and standard placements
- [ ] dashboard/store products, entitlements, paywalls, and campaigns
- [ ] delegate/analytics and build verification

## Docs access

```bash
curl -sL https://superwall.com/docs/flutter/llms.txt
curl -sL https://superwall.com/docs/flutter/quickstart/configure.md
curl -sL https://superwall.com/docs/flutter/guides/advanced-configuration.md
curl -sL https://superwall.com/docs/flutter/quickstart/tracking-subscription-state.md
curl -sL https://superwall.com/docs/flutter/quickstart/user-management.md
curl -sL https://superwall.com/docs/flutter/guides/handling-deep-links.md
curl -sL https://superwall.com/docs/flutter/guides/web-checkout.md
curl -sL https://superwall.com/docs/flutter/quickstart/feature-gating.md
```

## 1. SDK and configuration

Inspect `pubspec.yaml`/lock, iOS pods and deployment target, Android Gradle/SDK,
and `main()`. Confirm initialization happens before use, with one
`Superwall.configure` call and the correct key for each platform. Check
`WidgetsFlutterBinding.ensureInitialized()` where initialization needs it. Read
`SuperwallOptions` in context rather than treating custom options as suspicious.

## 2. Purchases, restores, and subscription state

Infer the path first:

- **Default:** no `PurchaseController` is correct; Superwall owns purchases,
  restores, and subscription status.
- **RevenueCat/custom:** the controller must implement the current App Store and
  Google Play purchase methods plus restore, and synchronize Superwall status as
  entitlements change.

Reading `Superwall.shared.subscriptionStatus`, customer info, or entitlements is
documented and valid. Flag only conflicting sources, permanently unknown status,
missing controller branches, or access behavior inconsistent with the selected
architecture. Compare product/entitlement IDs with authenticated CLI/store data;
blocked checks belong in **Not verified**.

## 3. Identity and attributes

Trace login/logout. Account-based apps should call
`Superwall.shared.identify(...)` after authentication and `reset()` on logout.
For Android, check whether Play Store identifiers are intentionally passed when
needed. Inspect attributes for audience/paywall value and sensitive data. Do not
demand identity in a deliberately anonymous app.

## 4. Deep links and Web Checkout

Inspect `app_links`/`uni_links`, router handling, iOS URL schemes/universal links,
Android intent filters/app links, cold start, and foreground delivery. Superwall
URLs should reach `await Superwall.shared.handleDeepLink(uri)` so the standard
`deepLink_open` placement receives URL parameters for dashboard rules.

Web Checkout is conditional. If present, verify return URLs and post-checkout
handling. Default purchasing needs no custom redemption sync. A custom controller
must merge web and device entitlements and update status; RevenueCat follows its
dedicated docs. Otherwise list readiness only as an optional opportunity.

## 5. Placements and lifecycle

Find `registerPlacement`, wrappers, constants, and analytics bridges. Analytics
and fire-and-forget calls are valid. A `feature` callback is needed only when the
specific action should be remotely gateable. Check calls occur outside widget
`build`, futures are awaited where sequencing matters, active presenting campaign
names match, and parameters are useful. Unrouted analytics/future placements are
fine.

Prefer standard `app_launch`, `session_start`, and `deepLink_open` over truly
duplicative lifecycle placements. Do not recommend cosmetic renames of stable
keys. Delegate forwarding is optional unless app behavior relies on it.

## 6. Dashboard and verification

Run the read-only CLI checks from `SKILL.md`. Verify platform keys, products,
entitlements, paywall products, campaigns, and placements expected to present
now form a usable chain. Cite IDs where available. In fix mode, run existing
`flutter analyze`, tests, and an appropriate platform build where practical.

## Fix-mode boundaries

Fix clear wiring bugs and code/doc mismatches. Do not switch purchase providers,
enable Web Checkout, rename stable placements, change prices, or invent campaign
strategy without an explicit user decision.
