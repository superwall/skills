# Android source screens (Jetpack Compose and Views)

How the screen you are rebuilding was wired, what each construct becomes,
and what the user changes in the app once the rebuild is reviewed.

## Reading the source

| In the source | Becomes |
| --- | --- |
| `Text("…")`, `stringResource(R.string.x)`, `getString(R.string.x)`, `android:text="@string/x"` in a layout | a `messages/en.ts` entry read with `t()`; the text is in `res/values/strings.xml`, and every `res/values-<locale>/strings.xml` becomes `messages/<locale>.ts` |
| `"$value"` / `"${expr}"` in a string, `%1$s` placeholders in a resource | a `t()` parameter |
| `painterResource(R.drawable.x)`, `android:src="@drawable/x"`, `app:srcCompat` | the file from `res/drawable*` copied into `assets/` (take the vector XML as SVG or the highest-density PNG) |
| `Icons.Default.X` / `Icons.Outlined.X` | an SVG in `assets/`; Material icons are not on the web unless you add them |
| `FontFamily(Font(R.font.x))`, `res/font` | the font file, subset, in `assets/`; `@font-face` in `theme.css` |
| `MaterialTheme.colorScheme`, `colorResource(R.color.x)`, `res/values/colors.xml`, `values-night` | `:root` / `:root.dark` variables, both themes from the resources |
| `isSystemInDarkTheme()`, `Configuration.UI_MODE_NIGHT_MASK` | `useColorScheme()` from the framework, or `:root.dark` CSS |
| `BillingClient.launchBillingFlow`, RevenueCat `purchaseWith` | `usePurchase()` with the slot from `config.ts` |
| `queryPurchasesAsync`, `restorePurchases` | `useActions().restore()` |
| `Intent(Intent.ACTION_VIEW, uri)`, `CustomTabsIntent`, `LocalUriHandler.openUri` (Play Store links included) | `useActions().openUrl(url)` |
| `ReviewManager.requestReviewFlow` / `launchReviewFlow` | `useActions().requestStoreReview()` |
| `POST_NOTIFICATIONS` via `RequestPermission()` / `rememberPermissionState` | `useActions().requestPermission("notification")` |
| `finish()`, `onBackPressedDispatcher`, `popBackStack()`, `onDismiss` | `useActions().close()` |
| `navController.navigate` to a destination in the same flow | a second route under `app/` and `useRouter().push()` |
| `startActivity` / `navigate` to something outside the flow (settings, a web view) | close and let the app's placement handler route; note it |
| `ViewModel`, `StateFlow`, `remember { }` state | React state; data the ViewModel fetched becomes a placement param or a user attribute the app sets before `register()` |
| `BuildConfig.VERSION_NAME`, `Build.VERSION` reads | `useDevice()` and `useVariables()`; the SDK reports app and OS versions |
| `WindowInsets`, `systemBarsPadding()`, `fitsSystemWindows` | nothing; the framework insets the screen (`layout.md`); Android's bottom inset is 0 because the SDK keeps the paywall above the navigation bar |

A Views screen splits across an Activity or Fragment, a layout XML under
`res/layout`, and `strings.xml`; the scan resolved `R.string` and
`@string/` references into the brief, but read the layout for structure and
`res/values-night` for the dark theme. A Compose screen keeps its structure in
the composable; follow `viewModel()` and `hiltViewModel()` to the data.

## Wiring the app afterwards (the user does this, with you, after review)

This is a placement at a feature gate — the `superwall` skill's
`workflows/placements/` playbook (`superwall integrate --skill` includes it)
is the full playbook for
where and how to register, and the SDK docs are the reference for the
API; fetch them rather than working from memory:

```bash
curl -sL https://superwall.com/docs/android/quickstart/feature-gating.md      # Superwall.instance.register(placement) { }
curl -sL https://superwall.com/docs/android/llms.txt                          # every other page
```

Where the app presented the screen:

```kotlin
// before
if (needsUpdate) startActivity(Intent(this, UpdateRequiredActivity::class.java))

// after
if (needsUpdate) Superwall.instance.register("update_required")
```

or in Compose:

```kotlin
// before
if (needsUpdate) navController.navigate("update_required")

// after
LaunchedEffect(needsUpdate) {
    if (needsUpdate) Superwall.instance.register("update_required")
}
```

- The placement name is in the brief. Register it with the same condition
  the app used, from UI code with an Activity in the foreground; pass what
  the screen needs as `params` instead of reading it in the screen. Never
  register inside a composable body.
- A screen the user must not dismiss (a forced update) is a **gated**
  surface: the campaign's paywall is set to gated, and the `feature` lambda
  passed to `register` only runs when the surface reports the user
  through. Keep the app's own hard block until the surface is live.
- Create the campaign and placement on the dashboard for that placement
  name and point it at the pushed surface; `superwall integrate` and the
  `superwall` skill's `workflows/dashboard/` playbook cover it.
- Delete the native screen, its layout, drawables and strings once the
  campaign is live and verified on a device. Keep a release with both for
  one cycle if users on old builds still need the native one.
