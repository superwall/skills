# Integrate the Superwall SDK

Get Superwall installed and configured with the smallest, cleanest set of edits.
Placements (paywall triggers) are a **separate step** - do not add `register()` /
`registerPlacement()` calls or example "Go Premium" buttons here. After this skill
succeeds, use the **superwall-placements** skill to add triggers.

## Docs access

Superwall's docs are fetchable **as markdown** - always prefer fetching the current
page over relying on memory:

```bash
curl -sL https://superwall.com/docs/llms.txt          # index: discover any doc path
curl -sL https://superwall.com/docs/llms-full.txt      # broad context across all SDKs
curl -sL https://superwall.com/docs/{path}.md          # any page as markdown (append .md)
```

Each SDK also has its own index - `curl -sL https://superwall.com/docs/{ios|android|expo|react-native|flutter}/llms.txt`.
Fetch the index to find the slug, then fetch `{path}.md`. Every reference file
below embeds the exact `curl` at each step so you can pull current detail when the
baked-in steps aren't enough. **Never invent an API** - if a symbol isn't in a
reference or a page you fetched, fetch and confirm.

## Principles

- Make the smallest set of edits that yields a working, verifiable integration.
  Don't refactor or reformat unrelated code.
- **Read a file before editing it**; match its existing style and conventions.
- **Detect the package manager / build system** from the project (lockfiles,
  `Podfile`, `app.json`, `pubspec.yaml`, `Package.swift`) - never assume
  npm/yarn/pnpm/bun/CocoaPods/SPM.
- **Never invent an API key.** Use the exact public key you were given (it starts
  with `pk_`). Never commit a secret. The public key may be inlined where the
  platform conventionally does so (e.g. iOS `configure()`); otherwise use the
  platform's standard env/config mechanism.
- **Never invent an API.** Every symbol you write must come from the reference
  file or the linked docs. If the docs are ambiguous, say so and link the page.
- Configure **once, at app launch**, as early in the launch path as possible.

## Steps

1. **Detect the framework** from the project files:

   | Signal in the project                                         | Framework           | Read this reference          |
   | ------------------------------------------------------------- | ------------------- | ---------------------------- |
   | `*.xcodeproj` / `Package.swift` / `*.swift`, no JS            | iOS / Swift         | `ios.md` (beside this file)          |
   | `app.json`/`app.config.js` with an `expo` key, `expo` in deps | Expo                | `expo.md` (beside this file)         |
   | `package.json` with `react-native`, no `expo` config          | React Native (bare) | `react-native.md` (beside this file) |
   | `pubspec.yaml`                                                | Flutter             | `flutter.md` (beside this file)      |
   | `build.gradle(.kts)` applying `com.android.application`                                                | Android (Kotlin)             | `android.md` (beside this file)      |

   If both Expo and bare RN signals exist, treat it as **Expo**. If unsure, ask.

2. **Read `<framework>.md` beside this file and follow it exactly.** Each reference is a
   complete, verified playbook: install, configure, API key handling, verify,
   pitfalls, and doc links.

3. **Pick the purchase-handling path** (covered in each reference):
   - **No existing IAP system** → default. No `PurchaseController`; Superwall
     manages purchases, restoration, and subscription state.
   - **RevenueCat / Adapty / Qonversion / custom StoreKit already present** →
     implement a `PurchaseController` and keep `subscriptionStatus` in sync with
     your source of truth. (For a full migration off another SDK, use the
     **superwall-migrate** skill.)

## What else belongs in Superwall

While reading the app, note any screen the user would rather change
without a release: a paywall or offer, onboarding, an update-required or
force-upgrade screen, a rate-us or notifications prompt, an announcement,
a consent change. Mention them in your closing note as candidates for a
Superwall surface (`superwall create` in the app, built with the
`superwall-framework` skill) behind a placement. Don't build them here;
the placements step wires the triggers and the framework skill builds the
screens.

## Definition of done

1. SDK installed and resolving (pods/SPM/gradle/pub resolved).
2. Superwall configured exactly once at launch with the provided public `pk_` key.
3. If a build command exists, build to verify it compiles.
4. No placements added - that is the placements step.
