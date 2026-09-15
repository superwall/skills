# iOS source screens (SwiftUI and UIKit)

How the screen you are rebuilding was wired, what each construct becomes,
and what the user changes in the app once the rebuild is reviewed.

## Reading the source

| In the source | Becomes |
| --- | --- |
| `Text("…")`, `Button("…")`, `Label("…")`, `.navigationTitle`, `String(localized:)`, `NSLocalizedString`, `UILabel.text` | a `messages/en.ts` entry read with `t()` |
| `"\(value)"` interpolation, `String(format:)` | a `t()` parameter |
| `Image("name")`, `UIImage(named:)` | the asset from `Assets.xcassets/name.imageset` (take the `@3x` or the PDF/SVG) copied into `assets/` |
| `Image(systemName:)` | an SVG in `assets/`; there are no SF Symbols on the web |
| `.font(.custom("Name", size:))`, `UIFont(name:)` | the font file from the bundle, subset, in `assets/`; `@font-face` in `theme.css` |
| `Color("name")`, asset catalog colors | a `:root` / `:root.dark` variable, both appearances from the catalog |
| `@Environment(\.colorScheme)`, `traitCollection.userInterfaceStyle` | `useColorScheme()` or plain `:root.dark` CSS |
| `Product.purchase`, `SKPaymentQueue`, `.buy()` | `usePurchase()` with the slot from `config.ts` |
| `AppStore.sync()`, `restoreCompletedTransactions` | `useActions().restore()` |
| `openURL`, `UIApplication.shared.open` (App Store links included) | `useActions().openUrl(url)` |
| `SKStoreReviewController`, `requestReview` | `useActions().requestStoreReview()` |
| `UNUserNotificationCenter.requestAuthorization` | `useActions().requestPermission("notification")` |
| `dismiss()`, `isPresented = false`, `dismiss(animated:)` | `useActions().close()` |
| `NavigationLink`, `.sheet`, `pushViewController` to another view in the same flow | a second route under `app/` and `useRouter().push()`; a sheet is a route with the `sheet` transition |
| `.sheet` / `present` to something outside the flow (settings, a web view) | close and let the app's placement handler route; note it |
| `@State`, `@Binding`, `@ObservedObject` view models | React state; data the view model fetched becomes a placement param or a user attribute the app sets before `register()` |
| `Bundle.main` version checks, `UIDevice` reads | `useDevice()` and `useVariables()`; the SDK reports app and OS versions |
| `.safeAreaInset`, `ignoresSafeArea`, `GeometryReader` for insets | nothing; the framework insets the screen (`layout.md`) |

A UIKit screen usually splits across a view controller, a storyboard or
XIB, and a view; read all three. Strings in a storyboard live in
`Main.strings` per language.

## Wiring the app afterwards (the user does this, with you, after review)

This is a placement at a feature gate — the `superwall` skill's
`workflows/placements/` playbook (`superwall integrate --skill` includes it)
is the full playbook for
where and how to register, and the SDK docs are the reference for the
API; fetch them rather than working from memory:

```bash
curl -sL https://superwall.com/docs/ios/quickstart/feature-gating.md      # Superwall.shared.register(placement:)
curl -sL https://superwall.com/docs/llms.txt                 # every other page
```

Where the app presented the screen:

```swift
// before
if needsUpdate { present(UpdateRequiredViewController(), animated: true) }

// after
if needsUpdate {
  Superwall.shared.register(placement: "update_required")
}
```

or in SwiftUI:

```swift
.fullScreenCover(isPresented: $needsUpdate) { UpdateRequiredView() }   // before
.onChange(of: needsUpdate) { if $0 { Superwall.shared.register(placement: "update_required") } }   // after
```

- The placement name is in the brief. Register it with the same condition
  the app used; pass what the screen needs as params
  (`register(placement:params:)`) instead of reading it in the screen.
- A screen the user must not dismiss (a forced update) is a **gated**
  surface: the campaign's paywall is set to gated, and the `feature`
  closure passed to `register` only runs when the surface reports the
  user through. Keep the app's own hard block until the surface is live.
- Create the campaign and placement on the dashboard for that placement
  name and point it at the pushed surface; `superwall integrate` and the
  `superwall` skill's `workflows/dashboard/` playbook cover it.
- Delete the native screen, its assets and its strings once the campaign
  is live and verified on a device. Keep a release with both for one
  cycle if users on old builds still need the native one.
