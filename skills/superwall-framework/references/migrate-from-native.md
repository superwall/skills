# Migrating a native screen to a Superwall surface

Any screen the app would rather change without a release — update-required
and force-upgrade, onboarding steps, rate-us and notification prompts,
announcements, offers and win-backs — can become a framework surface shown
through a placement. The move is a **rebuild**, not a port: same copy,
assets and behavior, expressed as a page with the framework's hooks. The
CLI does the deterministic half; you rebuild the page; the user reviews it
next to a screenshot of the original; then the app is wired.

```bash
superwall migrate --screen App/UpdateRequiredView.swift   # in the app's root
superwall migrate --screen                                # scan for likely screens and pick
```

The scan reads that one file — SwiftUI or UIKit (`.swift`), Jetpack Compose or
Android Views (`.kt`), React Native (`.tsx`), Flutter (`.dart`) — and writes into the project it finds (or a
new `superwall/`):

- `paywalls/<slug>/config.ts`: the screen's name, and a product slot per
  store identifier the source referenced. The user confirms they exist on
  the dashboard; a push refuses unknown products.
- `paywalls/<slug>/MIGRATION.md`, the brief: source path and framework,
  every user-visible string with its dynamic values, assets and system
  symbols, links, product ids, and each action mapped to the hook that
  replaces it. **Read the brief first; then read the source and what it
  imports.** Strings in string tables, view models and theme files are not
  in the scan.
- `superwall.lock` → `origins["paywall/<slug>"] = { path, framework,
  screenshot? }`, so `superwall migrate --screen <path>` picks the rebuild
  up later and the studio knows the original.

Then the CLI offers to run the rebuild headless with the user's agent, copy
the prompt, or stop; `--skill` prints the prompt. When *you* are the agent
driving it, do the inventory with the user rather than the headless path.

## The original

The studio cannot render native UI, so **Compare › Original** shows a
screenshot: the CLI offers to capture a booted iOS simulator, or the user
passes `--screenshot <file>` (an Android emulator capture works too). It is
saved as `paywalls/<slug>/original.png`. Without one there is no Original
entry — keep the app running in the simulator beside the studio, and take
your own screenshots when reviewing.

## Rebuilding

Read [layout.md](layout.md) and [mobile-design.md](mobile-design.md) first,
and hold to the localization rule in `SKILL.md` (every string through
`messages/` and `t()`, even for one language). Then:

- One page per screen state that was a separate view; a single screen is
  `app/index.tsx` alone. Tokens from the source's styles and the app's
  theme into `:root` / `:root.dark` in `theme.css`; match the app's dark
  appearance, not the starter's.
- Every string in `messages/en.ts`, read with `t()`; dynamic values as
  `t()` parameters from `useVariables()`, `useProducts()` or placement
  params. Every locale the app has becomes `messages/<locale>.ts`.
- Assets copied into `assets/`; system symbols and Material icons become
  SVGs; fonts subset with `@font-face`.
- Actions, per the brief's table:

| The screen did | The surface does |
| --- | --- |
| a purchase | `usePurchase()` with the slot from `config.ts` |
| a restore | `useActions().restore()` |
| opened a URL, the App Store included | `useActions().openUrl(url)` |
| asked for a store review | `useActions().requestStoreReview()` |
| asked for notifications | `useActions().requestPermission("notification")` |
| dismissed itself | `useActions().close()` |
| navigated within its own flow | another route and `useRouter().push()` |
| navigated elsewhere, refreshed data, routed the app | nothing: close, and the app's placement handler continues |
| read app / OS version, device facts | `useDevice()`, `useVariables()` |
| fetched its own data | placement params or user attributes set before `register()`, read with `useVariables()` |
| safe-area work | nothing; the framework insets the screen |

- Only write inside `paywalls/<slug>/`. Never edit the app, never add
  `register()` calls, never delete the native screen, never push or touch
  campaigns. Anything with no equivalent (share sheet, camera, a settings
  deep link the SDK cannot open) goes in the closing note as not carried
  over.

## Wiring the app (after the user has reviewed and pushed)

The brief names the placement (the screen's name in snake_case). Where the
app presented the screen, register instead, with the same condition and
the data the screen needs as params. This is ordinary placement work:
the `superwall` skill's `workflows/placements/` playbook (printed by
`superwall integrate --skill`) is the playbook for where and how to
register in each SDK, and the SDK docs are the API reference —
fetch the page for the app's platform rather than working from memory:

```bash
curl -sL https://superwall.com/docs/ios/quickstart/feature-gating.md
curl -sL https://superwall.com/docs/android/quickstart/feature-gating.md
curl -sL https://superwall.com/docs/expo/quickstart/feature-gating.md
curl -sL https://superwall.com/docs/flutter/quickstart/feature-gating.md
```

```swift
if needsUpdate { Superwall.shared.register(placement: "update_required") }
```

```kotlin
if (needsUpdate) Superwall.instance.register("update_required")
```

```tsx
const { registerPlacement } = usePlacement();
if (needsUpdate) await registerPlacement({ placement: "update_required" });
```

```dart
if (needsUpdate) Superwall.shared.registerPlacement('update_required');
```

A screen the user must not dismiss is a **gated** surface: the campaign's
paywall is gated and the `feature` callback only runs when the user is
let through; keep the app's hard block until the surface is live. Create
the campaign and placement on the dashboard (`superwall integrate`, the
`superwall` skill's `workflows/dashboard/`), verify on a device, then delete
the native screen, its assets and strings. `native/<framework>.md` beside
this file has the full construct table for each source framework.

## Playbook: rebuilding the screen

You are inside a `superwall/` project. One surface, `paywalls/<slug>/`, was
scaffolded from a screen in the app: its `config.ts` carries the name and
any products the screen sold, its `MIGRATION.md` is your brief, and
everything under `app/` is a starter to replace. Rebuild the screen so it
looks and behaves like the source, written the way the framework is meant
to be used. The source file stays untouched; wiring the app is a later
step the user runs.

Read `layout.md` (insets, positioning, scrolling) and `mobile-design.md`
before writing a line, and hold to the localization rule in `SKILL.md`:
every string through `messages/` and `t()`, even for one language. This section fixes the order of
work and the boundaries; the source framework's file under `native/`
(`ios.md`, `android.md`, `react-native.md`, `flutter.md`) explains how the
source was wired and what each construct becomes.

### Docs access

```bash
curl -sL https://superwall.com/docs/framework/llms.txt      # page index
curl -sL https://superwall.com/docs/framework/{page}.md      # one page
```

### Order of work

- [ ] Read `MIGRATION.md`, then the source file it names (the path is
      relative to this directory). Confirm the brief's inventory against
      the code: every string, every asset, every control and what it does,
      every conditional branch (a loading state, an error, a version
      check). Follow imports for view models, string tables and theme
      files that hold what the screen draws; the brief only saw one file.
- [ ] Design tokens: colors, type, spacing and radii from the source's
      styles (and the app's theme if it uses one) into `:root` /
      `:root.dark` variables in `app/theme.css`. Keep
      `--sw-background: var(--bg)`. Match the app's dark appearance, not
      the framework starter's.
- [ ] One route per screen state that was a separate view; a single
      screen is `app/index.tsx` alone. Every control becomes the hook call
      the brief's action table names; anything the app did after the
      screen (routing, refreshing) is not yours — the screen closes and
      the app's placement handler continues.
- [ ] Every string through messages, even for one language: the copy in
      `messages/en.ts`, `t()` in the pages (`aria-label`s included), dynamic
      values as `t()` parameters read from `useVariables()`, `useProducts()`
      or placement params. Assets copied into `assets/` and referenced
      relatively; system symbols replaced with SVGs.
- [ ] Layout rules from `layout.md`: the framework insets the screen; no
      `env()`, no `position: fixed`, a pinned CTA sticky in the page, shell
      `flex: 1 1 auto`, nothing `100dvh`.
- [ ] `bun run typecheck` in the project passes. Fix every diagnostic
      `superwall dev` would print.
- [ ] Leave `MIGRATION.md` in place; the user deletes it after review.
- [ ] End your note with the placement name from the brief and the file in
      the app that presented the screen, so the wiring step starts from it.

### Boundaries

- Only write inside `paywalls/<slug>/`. Never edit the app's source, never
  add `register()` calls, never delete the native screen: the user wires
  the app after reviewing the rebuild, with the framework reference below.
- Never run `superwall push`, `promote` or `publish`, and never touch
  campaigns or products. The user reviews in the studio (Compare › Original
  shows the simulator screenshot when one was captured) and ships.
- Never change `config.ts` except to replace a product identifier the
  user has named. Never invent a product or a price.
- Anything with no framework equivalent (a native share sheet, a system
  settings deep link the SDK cannot open, a camera view) is listed in your
  final note as not carried over, never approximated.
