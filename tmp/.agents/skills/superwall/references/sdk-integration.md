# SDK Integration

## Integration checklist

Copy this checklist to track progress:

```
- [ ] Detect platform ({sdk})
- [ ] Determine purchase controller path (default / RevenueCat / custom)
- [ ] Install SDK dependency
- [ ] Configure Superwall at app launch
- [ ] User management (identify / reset)
- [ ] Feature gating (register placements)
- [ ] Track subscription state
- [ ] Set user properties
- [ ] In-app paywall previews (deep links)
- [ ] Post-integration: deep links, analytics, feature gating audit
```

## Step 1: Detect the platform

Examine the user's project to determine the SDK. Use the first match:

| Signal | SDK value |
|--------|-----------|
| `pubspec.yaml` present, Dart code | `flutter` |
| `app.json` or `app.config.js` with `expo` field | `expo` |
| `*.xcodeproj` or `Package.swift`, Swift/ObjC code | `ios` |
| `build.gradle` or `build.gradle.kts`, Kotlin/Java code | `android` |
| `react-native` in `package.json` without Expo | `react-native` (community SDK, limited support) |

Store the result as `{sdk}` — it is used in every doc URL below.

## Step 2: Determine the purchase controller path

Ask the user (or infer from their codebase) which applies:

1. **No existing purchase system** — New to IAP or wants Superwall to handle everything.
   → **Default (no PurchaseController)**. Superwall manages purchases, restoration, and subscription tracking automatically.

2. **Using RevenueCat** — RevenueCat SDK is present in the project.
   → **RevenueCat integration**. Follow the RevenueCat guide instead of the default configure step.
   `curl -sL https://superwall.com/docs/{sdk}/guides/using-revenuecat.md`

3. **Using another billing SDK or custom purchase logic** — Qonversion, Adapty, proprietary server-side billing, etc.
   → **Custom PurchaseController**. User must implement `PurchaseController` and manually set `subscriptionStatus`.
   `curl -sL https://superwall.com/docs/{sdk}/guides/advanced-configuration.md`
   `curl -sL https://superwall.com/docs/{sdk}/sdk-reference/PurchaseController.md`

> **Critical**: When a PurchaseController is used (paths 2 or 3), the user **must** also manually set `subscriptionStatus` on the Superwall instance.

## Step 3: Execute the quickstart steps in order

Fetch each doc page with `curl -sL`, implement, verify, then move to the next.

**Doc URL pattern:**
```
https://superwall.com/docs/{sdk}/quickstart/{slug}.md
```

| # | Slug | What it covers |
|---|------|----------------|
| 1 | `install` | Add the SDK dependency to the project |
| 2 | `configure` | Initialize Superwall at app launch (apply purchase controller path from Step 2) |
| 3 | `user-management` | Identify users on sign-in, reset on logout |
| 4 | `feature-gating` | Register placements and present paywalls (page title: "Presenting Paywalls") |
| 5 | `tracking-subscription-state` | Observe subscription status changes in app code |
| 6 | `setting-user-properties` | Set custom user attributes for audience targeting |
| 7 | `in-app-paywall-previews` | Set up deep link handling for on-device paywall previews |

> Docs use `:::ios`, `:::android`, `:::flutter`, `:::expo` fences — use only the `{sdk}`-relevant code.

## Step 4: Complete the integration

After the quickstart, walk through these remaining concerns:

- **Deep links**: Set up deep link handling for paywall previews and web checkout redemption.
  `curl -sL https://superwall.com/docs/{sdk}/guides/handling-deep-links.md`

- **User identity**: Ensure `identify(userId:)` is called on sign-in with a stable, non-guessable user ID (UUID recommended). Call `reset()` on logout.

- **Feature gating audit**: Review which features should be paywalled. Register a placement for each, then configure gating rules in the Superwall dashboard.

- **User attributes**: Set custom attributes (name, plan type, cohort, etc.) for audience targeting and paywall personalization via `setUserAttributes()`.

- **3rd-party analytics** (offer if an analytics SDK is detected in the project): Forward Superwall events to their analytics tool via the SuperwallDelegate.
  - Overview: `curl -sL https://superwall.com/docs/{sdk}/guides/3rd-party-analytics.md`
  - Event list & forwarding: `curl -sL https://superwall.com/docs/{sdk}/guides/3rd-party-analytics/tracking-analytics.md`
  - Cohorting (experiment/variant IDs in Amplitude, Mixpanel, etc.): `curl -sL https://superwall.com/docs/{sdk}/guides/3rd-party-analytics/cohorting-in-3rd-party-tools.md`
  - `confirmAllAssignments()` — get all experiment/variant assignments on startup: `curl -sL https://superwall.com/docs/{sdk}/sdk-reference/confirmAllAssignments.md`

## Advanced configuration docs

| Topic | URL |
|-------|-----|
| Purchases & subscription status | `https://superwall.com/docs/{sdk}/guides/advanced-configuration.md` |
| RevenueCat integration | `https://superwall.com/docs/{sdk}/guides/using-revenuecat.md` |
| PurchaseController reference | `https://superwall.com/docs/{sdk}/sdk-reference/PurchaseController.md` |
| SuperwallDelegate reference | `https://superwall.com/docs/{sdk}/sdk-reference/SuperwallDelegate.md` |
| SuperwallOptions reference | `https://superwall.com/docs/{sdk}/sdk-reference/SuperwallOptions.md` |
