# Review Superwall - React Native

You are reviewing a bare React Native app. First distinguish the recommended
`expo-superwall` provider path from the legacy
`@superwall/react-native-superwall` singleton path; do not mix their APIs.

## Checklist

- [ ] package/native linking and deployment targets
- [ ] one provider or one early singleton configuration with platform keys
- [ ] purchase controller, restore flow, and subscription-status ownership
- [ ] identity/logout and user attributes
- [ ] platform linking and `handleDeepLink`
- [ ] conditional Web Checkout redemption readiness
- [ ] placements, callbacks, campaigns, and standard placements
- [ ] dashboard/store products, entitlements, paywalls, and campaigns
- [ ] event forwarding and native build verification

## Docs access

```bash
curl -sL https://superwall.com/docs/react-native/llms.txt
curl -sL https://superwall.com/docs/react-native/sdk-reference/configure.md
curl -sL https://superwall.com/docs/react-native/sdk-reference/handleDeepLink.md
curl -sL https://superwall.com/docs/react-native/sdk-reference/register.md
curl -sL https://superwall.com/docs/expo/quickstart/configure.md
curl -sL https://superwall.com/docs/expo/guides/advanced-configuration.md
curl -sL https://superwall.com/docs/expo/guides/handling-deep-links.md
curl -sL https://superwall.com/docs/expo/guides/web-checkout.md
```

## 1. SDK and configuration

Inspect `package.json`, lockfiles, iOS pods/project settings, Android Gradle, and
app entry points. Provider path: one root `SuperwallProvider` with per-platform
keys, no duplicate singleton `configure`. Legacy path: one
`Superwall.configure({ apiKey, ... })` in a root effect that does not rerun.
Public keys should match platform and existing config conventions.

## 2. Purchases, restores, and subscription state

Infer the chosen path:

- **Default:** no custom controller is correct; Superwall owns purchases,
  restores, and subscription status.
- **RevenueCat/custom:** the controller must implement the current App Store and
  Google Play purchase methods plus restore, and synchronize Superwall status as
  its entitlement source changes.

Reading status through `useUser` or the legacy singleton is documented and not a
defect. Report only broken ownership, conflicting sources, permanently unknown
status, missing controller branches, or behavior inconsistent with the intended
architecture. Compare product/entitlement IDs through authenticated CLI/store
checks; blocked checks go in **Not verified**.

## 3. Identity and attributes

Trace real auth flows. Provider path uses `useUser` identity/sign-out methods;
legacy path uses `Superwall.shared.identify(...)` and `reset()`. Confirm login and
logout both update Superwall, and inspect attributes for targeting value and
sensitive data. Anonymous-only apps do not need fabricated identity work.

## 4. Deep links and Web Checkout

Inspect React Navigation/linking config plus iOS and Android native URL handling.
Cover cold start and foreground delivery. Provider-style apps follow the current
Expo module `handleDeepLink` docs; legacy apps use the singleton
`handleDeepLink`. The goal is the standard `deepLink_open` placement and its URL
parameters - not an app-maintained URL-to-placement table.

Web Checkout is conditional. If used, verify return URLs and redemption behavior
for the detected purchase path. Default purchasing needs no custom entitlement
merge; custom/RevenueCat paths follow their dedicated redemption docs. Otherwise
list readiness only as an optional opportunity.

## 5. Placements and lifecycle

Find provider `usePlacement`/`registerPlacement` and legacy
`Superwall.shared.register`, including wrappers and analytics bridges. Analytics
and fire-and-forget registrations are valid. Require a feature callback only when
that action is meant to be remotely gateable. Check event/effect placement,
awaiting of async calls, exact names for active presenting campaigns, and useful
parameters. Unrouted analytics/future placements are fine.

Prefer standard `app_launch`, `session_start`, and `deepLink_open` over truly
duplicative custom lifecycle placements. Do not propose cosmetic renames of
stable keys. Analytics delegate/hooks are optional unless the app relies on them.

## 6. Dashboard and verification

Run the read-only CLI checks from `SKILL.md`. Verify app/platform keys, products,
entitlements, paywall products, campaigns, and placements expected to present
now form a usable chain. Cite IDs where available. In fix mode, run the existing
TypeScript and native build/test paths.

## Fix-mode boundaries

Fix clear wiring bugs and code/doc mismatches. Never mix provider and legacy APIs,
switch purchase providers, enable Web Checkout, rename stable placements, change
prices, or invent campaign strategy without an explicit user decision.
