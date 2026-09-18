# Review an existing Superwall setup

Review the integration as a system, not as a placement inventory. Inspect code,
project configuration, and authenticated dashboard state where available. A good
review explains what is correct, identifies only evidence-backed defects, and
separates optional opportunities from required fixes.

## Review contract

1. Read the app's architecture and detect its purchase path before judging it.
2. Fetch the current platform docs at each relevant step; APIs and guidance move.
3. Audit code and native project configuration without editing in review mode.
4. Cross-check the dashboard and store through read-only CLI commands when auth
   is available. A failed check is **Not verified**, never an issue by itself.
5. Cite file and line evidence for every code finding. Never infer a defect from
   a symbol name alone; read the surrounding flow.

## Audit every area

| Area                      | What good looks like                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK & configuration       | Supported package, configured once and early with the correct platform public key and intentional options.                                                             |
| Purchases & subscriptions | Exactly one deliberate purchase path: Superwall default, RevenueCat, or a custom controller; restores and status sync match that path.                                 |
| Identity & attributes     | Authenticated apps identify after login, reset/sign out on logout, and set useful targeting attributes without sensitive data.                                         |
| Deep links                | App URL entry points forward URLs to `handleDeepLink`, enabling the standard `deepLink_open` placement and preview links.                                              |
| Web Checkout              | If used or intended, redirects and redemption match the purchase path. If absent, describe readiness as optional - not broken setup.                                   |
| Placements                | Valuable moments are registered intentionally; real gates put controllable work in the feature callback; code and campaign names agree where presentation is expected. |
| Dashboard & store         | Products, entitlements, paywalls, campaigns, placements, and store identifiers form a usable chain.                                                                    |
| Analytics & lifecycle     | Delegate/event forwarding is coherent and custom lifecycle events do not accidentally duplicate standard placements.                                                   |

## Correctness rules that prevent false positives

- **Analytics events becoming placements is recommended.** The docs explicitly
  recommend registering analytics events for future flexibility.
- **Fire-and-forget placements are valid.** A feature callback is needed only
  when that specific action must be remotely gateable.
- **Subscription-state reads are valid.** The SDK documents them for app state and
  UI. Flag only contradictory sources of truth or broken controller/status sync.
- **An unrouted placement is not automatically dead.** It is a problem only when
  the app expects that placement to present or gate now; analytics-only and future
  placements may intentionally have no campaign.
- Do not require optional features (Web Checkout, delegate analytics, custom
  attributes) without evidence that the app intends to use them.
- Do not recommend renaming stable placement keys for style alone.

## Authenticated cross-checks

Use `superwall whoami --json`, then `superwall bootstrap --json`. Derive the exact
project/app ids and pass them to `superwall products list --project <id> --json`,
`superwall entitlements list --project <id> --json`, `superwall campaigns list
--project <id> --app <id> --json`, and `superwall paywalls list --project <id>
--app <id> --json`. When App Store Connect is linked,
use `superwall asc subscriptions <bundle-id> --json` to compare store identifiers.

## Framework reference

Read exactly one: `ios.md` (beside this file), `expo.md` (beside this file),
`react-native.md` (beside this file), `flutter.md` (beside this file), or `android.md` (beside this file).

## Docs access

```bash
curl -sL https://superwall.com/docs/llms.txt
curl -sL https://superwall.com/docs/{platform}/llms.txt
curl -sL https://superwall.com/docs/{path}.md
```

Use the platform pages for configure, advanced purchasing, subscription state,
user management, deep links, feature gating, and Web Checkout. Use dashboard
pages for placements, standard placements, products, and subscription management.
