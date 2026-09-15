# Review Superwall - iOS / Swift

You are reviewing an existing iOS integration using `SuperwallKit`. Complete the
whole checklist; placements are one part of it.

## Checklist

- [ ] SDK dependency and deployment target
- [ ] one early `configure` call and the intended public key/options
- [ ] purchase controller, restore flow, and subscription-status ownership
- [ ] identity, reset, and user attributes
- [ ] URL schemes/universal links and `handleDeepLink`
- [ ] conditional Web Checkout redemption readiness
- [ ] placements, feature callbacks, campaign coverage, and standard placements
- [ ] products, entitlements, paywalls, campaigns, and App Store identifiers
- [ ] delegate/analytics and a build or test verification path

## Docs access

```bash
curl -sL https://superwall.com/docs/ios/llms.txt
curl -sL https://superwall.com/docs/ios/quickstart/configure.md
curl -sL https://superwall.com/docs/ios/guides/advanced-configuration.md
curl -sL https://superwall.com/docs/ios/quickstart/tracking-subscription-state.md
curl -sL https://superwall.com/docs/ios/quickstart/user-management.md
curl -sL https://superwall.com/docs/ios/guides/handling-deep-links.md
curl -sL https://superwall.com/docs/ios/guides/web-checkout.md
curl -sL https://superwall.com/docs/ios/quickstart/feature-gating.md
```

## 1. SDK and configuration

Inspect `Package.resolved`, `project.pbxproj`, `Package.swift`, or the Podfile and
lockfile. Confirm `Superwall.configure(apiKey:)` is called once, as early as
practical at launch. A `pk_` key is public and may be inlined on iOS; verify it
belongs to the current app rather than treating its presence as a secret leak.
Read any `SuperwallOptions` and judge intentional behavior, not mere customization.

## 2. Purchases, restores, and subscription state

Infer exactly which path the app uses:

- **Default:** no `PurchaseController` is correct; Superwall owns purchases,
  restores, and subscription status.
- **RevenueCat/custom:** the controller must implement purchase and restore,
  return accurate result cases, and keep `Superwall.shared.subscriptionStatus`
  synchronized as entitlements change. Custom/web products need the current doc's
  handling; do not assume StoreKit-backed and custom products are interchangeable.

Reading `subscriptionStatus`, `.isActive`, customer info, or entitlements is a
documented way to drive app state and UI. Report a problem only when two sources
contradict each other, status remains `.unknown`, restore is missing, or access
logic demonstrably bypasses the intended purchase architecture.

Compare dashboard products/entitlements with App Store subscription identifiers
when CLI access exists. Do not label an auth, network, or ASC failure as broken
subscriptions; put it under **Not verified**.

## 3. Identity and attributes

If the app has accounts, trace the real login and logout paths. Expect
`Superwall.shared.identify(userId:)` after identity is known and
`Superwall.shared.reset()` on logout. On iOS, a UUID user ID is needed for
StoreKit `appAccountToken`; non-UUID IDs fall back to the anonymous alias for
store events. Review `setUserAttributes` for useful targeting data and accidental
sensitive values.

## 4. Deep links and Web Checkout

Trace every URL entry point: SwiftUI `.onOpenURL`, app/scene delegate methods,
universal links, and any routing service. Incoming URLs intended for Superwall
should reach `Superwall.handleDeepLink(url)`, which produces the standard
`deepLink_open` placement with URL parameters. A hardcoded URL-to-placement
switch is worth improving when dashboard campaign rules can replace it.

Web Checkout is conditional. If the app/dashboard uses it, verify return URLs and
post-checkout handling. Default Superwall purchasing needs no custom redemption
sync. A custom controller must merge redeemed web entitlements with device
entitlements and update status; RevenueCat must follow its documented path. If
there is no Web Checkout intent, list readiness only as an optional opportunity.

## 5. Placements and lifecycle

Find `register(placement:)`, wrappers, analytics bridges, and placement constants.
Analytics bridges and calls without a feature closure are valid. Require a
feature closure only when the action itself is meant to be remotely gated. Check
valuable surfaces, placement parameters, accidental calls during SwiftUI `body`,
and exact name agreement with active campaigns. Unrouted analytics/future
placements are fine.

Prefer standard `app_launch`, `session_start`, and `deepLink_open` placements over
custom duplicates when the semantics truly match. Do not suggest cosmetic
renames of stable keys. Review delegate forwarding for duplicated analytics or
missing subscription/redemption callbacks only when the app relies on them.

## 6. Dashboard and verification

Run the read-only CLI cross-checks from `SKILL.md`. A presenting chain needs a
matching app, product attached to the intended entitlement/paywall, and an active
campaign audience for placements expected to show now. Cite dashboard IDs where
available. Finally identify the project's existing Xcode build/test command; in
fix mode, run it after minimal changes.

## Fix-mode boundaries

Fix clear wiring bugs and code/doc mismatches. Do not switch purchase providers,
enable Web Checkout, rename stable placements, change prices, or invent campaign
strategy without an explicit user decision.
