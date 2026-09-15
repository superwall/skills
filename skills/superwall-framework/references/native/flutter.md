# Flutter source screens

How the screen you are rebuilding was wired, what each construct becomes,
and what the user changes in the app once the rebuild is reviewed.

## Reading the source

| In the source | Becomes |
| --- | --- |
| `Text('…')`, `title:`, `label:`, `hintText:`, `semanticsLabel:`, `AppLocalizations.of(context).key` | a `messages/en.ts` entry read with `t()`; copy every `.arb` locale the app has into `messages/<locale>.ts` |
| `'$value'` / `'${value}'` in text | a `t()` parameter |
| `Column`, `Row`, `Stack`, `Padding`, `SizedBox` | flex layout in CSS |
| `ThemeData`, `Theme.of(context)`, `ColorScheme` | `:root` / `:root.dark` variables, both brightnesses from the theme |
| `Image.asset('assets/x.png')`, `AssetImage` | the file from `pubspec.yaml`'s assets copied into `assets/`, imported relatively |
| `Icon(Icons.x)` | an SVG in `assets/`; there are no Material icons on the web unless you add them |
| `Lottie.asset`, `RiveAnimation` | the framework's Lottie / Rive support (`assets.md`) |
| `MediaQuery.platformBrightnessOf` | `useColorScheme()` from the framework, or `:root.dark` CSS |
| `in_app_purchase` `buyNonConsumable`, RevenueCat `purchasePackage` | `usePurchase()` with the slot from `config.ts` |
| `restorePurchases` | `useActions().restore()` |
| `url_launcher` `launchUrl` (App Store links included) | `useActions().openUrl(url)` |
| `in_app_review` `requestReview` | `useActions().requestStoreReview()` |
| `Permission.notification.request()`, `FirebaseMessaging.requestPermission` | `useActions().requestPermission("notification")` |
| `Navigator.pop`, `context.pop()` | `useActions().close()` |
| `Navigator.push` / `context.push` to a screen in the same flow | a second route under `app/` and `useRouter().push()` |
| `Navigator.push` to something outside the flow | close and let the app's placement handler route; note it |
| `setState`, providers, blocs feeding the widget | React state; fetched data becomes a placement param or a user attribute the app sets before `registerPlacement` |
| `package_info_plus` version reads | `useDevice()` and `useVariables()`; the SDK reports app and OS versions |
| `SafeArea`, `MediaQuery.padding` | nothing; the framework insets the screen (`layout.md`) |

## Wiring the app afterwards (the user does this, with you, after review)

This is a placement at a feature gate — the `superwall` skill's
`workflows/placements/` playbook (`superwall integrate --skill` includes it)
is the full playbook for
where and how to register, and the SDK docs are the reference for the
API; fetch them rather than working from memory:

```bash
curl -sL https://superwall.com/docs/flutter/quickstart/feature-gating.md      # Superwall.shared.registerPlacement
curl -sL https://superwall.com/docs/llms.txt                 # every other page
```

Where the app pushed the screen:

```dart
// before
if (needsUpdate) Navigator.of(context).push(MaterialPageRoute(builder: (_) => const UpdateRequiredScreen()));

// after
if (needsUpdate) Superwall.shared.registerPlacement('update_required');
```

- The placement name is in the brief. Register it with the same condition
  the app used; pass what the screen needs as `params` instead of reading
  it in the screen.
- A screen the user must not dismiss (a forced update) is a **gated**
  surface: the campaign's paywall is set to gated, and the `feature`
  callback of `registerPlacement` only runs when the surface reports the
  user through. Keep the app's own hard block until the surface is live.
- Create the campaign and placement on the dashboard for that placement
  name and point it at the pushed surface; `superwall integrate` and the
  `superwall` skill's `workflows/dashboard/` playbook cover it.
- Delete the screen widget, its route and its assets once the campaign is
  live and verified on a device. Keep a release with both for one cycle
  if users on old builds still need the native one.
