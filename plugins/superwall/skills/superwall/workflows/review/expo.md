# Review Superwall - Expo

You are reviewing an existing Expo integration using `expo-superwall`. Complete
the whole checklist; placements are one part of it.

## Checklist

- [ ] package/plugin/native build configuration
- [ ] one root `SuperwallProvider` with correct platform keys/options
- [ ] purchase controller, restore flow, and subscription-status ownership
- [ ] identity, sign-out, and user attributes
- [ ] Expo linking and `handleDeepLink`
- [ ] conditional Web Checkout redemption readiness
- [ ] placements, callbacks, campaign coverage, and standard placements
- [ ] dashboard products, entitlements, paywalls, campaigns, and store IDs
- [ ] event forwarding and a native build verification path

## Docs access

```bash
curl -sL https://superwall.com/docs/expo/llms.txt
curl -sL https://superwall.com/docs/expo/quickstart/configure.md
curl -sL https://superwall.com/docs/expo/guides/advanced-configuration.md
curl -sL https://superwall.com/docs/expo/quickstart/tracking-subscription-state.md
curl -sL https://superwall.com/docs/expo/quickstart/user-management.md
curl -sL https://superwall.com/docs/expo/guides/handling-deep-links.md
curl -sL https://superwall.com/docs/expo/guides/web-checkout.md
curl -sL https://superwall.com/docs/expo/quickstart/feature-gating.md
```

## 1. SDK and configuration

Inspect `package.json`, the lockfile, app config, `expo-build-properties`, and the
native projects when present. Confirm one root `SuperwallProvider` with `apiKeys`
for the platforms actually shipped. `EXPO_PUBLIC_*` values are public, but should
follow the app's existing config pattern. Do not also require a separate
`configure()` when the provider already configures the SDK. Read options and
plugin settings in context.

## 2. Purchases, restores, and subscription state

Infer the path before judging it:

- **Default:** `SuperwallProvider` without a custom controller is correct;
  Superwall owns purchases, restores, and status.
- **RevenueCat/custom:** `CustomPurchaseControllerProvider`/`PurchaseController`
  must handle the current iOS and Android purchase signatures, restoration, and
  synchronize status/entitlements whenever the source of truth changes.

`useUser().subscriptionStatus` is documented app state, so its use is not an
issue by itself. Flag only contradictory state, permanently unknown status,
missing restore/controller branches, or access behavior that conflicts with the
chosen architecture. Cross-check product and entitlement identifiers through the
CLI when available; failed auth/network/store checks belong in **Not verified**.

## 3. Identity and attributes

Trace actual auth transitions. Account-based apps should call `identify(userId)`
when login resolves and `signOut()` on logout. Review user attributes for useful
audience/paywall personalization and accidental sensitive data. Do not demand
identity in a deliberately anonymous app.

## 4. Deep links and Web Checkout

Inspect Expo Router/React Navigation linking config, `Linking` subscriptions,
initial URL handling, app schemes, and universal/app links. Superwall URLs should
reach the current docs' `SuperwallExpoModule.handleDeepLink(url)` path so the
standard `deepLink_open` placement carries URL parameters into campaign rules.
Check cold-start and already-running paths.

Web Checkout is conditional. If present, verify return URL configuration and
post-checkout handling. Default purchasing needs no custom redemption sync. A
custom controller must merge web and device entitlements; RevenueCat follows its
dedicated docs. Otherwise describe Web Checkout readiness only as optional.

## 5. Placements and lifecycle

Find `usePlacement`, `registerPlacement`, wrappers, constants, and analytics
bridges. Analytics-backed and fire-and-forget placements are valid. A `feature`
callback is necessary only for an action intended to be remotely gateable. Check
calls occur in event/effect flows rather than render, await async registrations,
and compare exact names only for active campaigns expected to present now.
Unrouted analytics/future placements are fine.

Prefer standard `app_launch`, `session_start`, and `deepLink_open` over custom
duplicates when semantics match. Do not recommend style-only placement renames.
Review `useSuperwallEvents` only when the app intends to forward analytics.

## 6. Dashboard and verification

Run the read-only CLI cross-checks from `playbook.md` (Authenticated cross-checks). Verify the app/platform keys,
products, entitlements, paywall products, campaigns, and current presentation
placements form a usable chain. Cite IDs where available. In fix mode, run the
project's native Expo build/typecheck path - not only hot reload.

## Fix-mode boundaries

Fix clear wiring bugs and code/doc mismatches. Do not change purchase providers,
enable Web Checkout, rename stable placements, alter prices, or invent campaign
strategy without an explicit user decision.
