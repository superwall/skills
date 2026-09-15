# React Native and Expo source screens

How the screen you are rebuilding was wired, what each construct becomes,
and what the user changes in the app once the rebuild is reviewed. The
surface is React too, so most of the tree carries over; the differences
are the primitives, the styling and the hooks.

## Reading the source

| In the source | Becomes |
| --- | --- |
| JSX text, `title=`, `placeholder=`, `accessibilityLabel=`, `i18n.t("key")` | a `messages/en.ts` entry read with `t()`; copy every locale file the app has into `messages/<locale>.ts` |
| `` `${value}` `` in text | a `t()` parameter |
| `<View>`, `<Text>`, `<Pressable>`, `<ScrollView>` | `div`, `p`/`span`, `button`, a scrolling page (`layout.md`) |
| `StyleSheet.create`, Tamagui / NativeWind classes | CSS in `theme.css` and modules; Tailwind works in the project if the app used NativeWind |
| `require("./x.png")`, `source={{ uri }}` | the file copied into `assets/`, imported relatively |
| `expo-image`, `SvgXml`, `lottie-react-native` | `img`, inline SVG, the framework's Lottie support (`assets.md`) |
| `useColorScheme()` | `useColorScheme()` from the framework, or `:root.dark` CSS |
| `react-native-iap` `requestPurchase`, RevenueCat `purchasePackage` | `usePurchase()` with the slot from `config.ts` |
| `restorePurchases`, `getAvailablePurchases` | `useActions().restore()` |
| `Linking.openURL`, `WebBrowser.openBrowserAsync` (App Store links included) | `useActions().openUrl(url)` |
| `expo-store-review` `requestReview` | `useActions().requestStoreReview()` |
| `Notifications.requestPermissionsAsync`, `messaging().requestPermission` | `useActions().requestPermission("notification")` |
| `navigation.goBack()`, `router.back()`, `dismiss()` | `useActions().close()` |
| `navigation.navigate` / `router.push` to a screen in the same flow | a second route under `app/` and `useRouter().push()` |
| `navigation.navigate` to something outside the flow | close and let the app's placement handler route; note it |
| `useState`, `useEffect` fetching data, context | React state; fetched data becomes a placement param or a user attribute the app sets before `register()` |
| `expo-application` / `DeviceInfo` version reads | `useDevice()` and `useVariables()`; the SDK reports app and OS versions |
| `SafeAreaView`, `useSafeAreaInsets` | nothing; the framework insets the screen (`layout.md`) |

## Wiring the app afterwards (the user does this, with you, after review)

This is a placement at a feature gate — the `superwall` skill's
`workflows/placements/` playbook (`superwall integrate --skill` includes it)
is the full playbook for
where and how to register, and the SDK docs are the reference for the
API; fetch them rather than working from memory:

```bash
curl -sL https://superwall.com/docs/expo/quickstart/feature-gating.md      # registerPlacement / usePlacement
curl -sL https://superwall.com/docs/llms.txt                 # every other page
```

Where the app rendered or navigated to the screen:

```tsx
// before
if (needsUpdate) router.replace("/update-required");

// after (expo-superwall)
const { registerPlacement } = usePlacement();
if (needsUpdate) await registerPlacement({ placement: "update_required" });
```

- The placement name is in the brief. Register it with the same condition
  the app used; pass what the screen needs as `params` instead of reading
  it in the screen.
- A screen the user must not dismiss (a forced update) is a **gated**
  surface: the campaign's paywall is set to gated, and `feature` in
  `registerPlacement` only runs when the surface reports the user
  through. Keep the app's own hard block until the surface is live.
- Create the campaign and placement on the dashboard for that placement
  name and point it at the pushed surface; `superwall integrate` and the
  `superwall` skill's `workflows/dashboard/` playbook cover it.
- Delete the screen component, its route and its assets once the
  campaign is live and verified on a device. Keep a release with both for
  one cycle if users on old builds still need the native one.
