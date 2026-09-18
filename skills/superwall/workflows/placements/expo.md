# Superwall placements - Expo

> Read `strategy.md` (beside this file) first for _where_ placements go and _why_ (the
> core set, app-type playbook, audit method, gate depth). This file is the Expo API.

Expo uses the `expo-superwall` package. Placements are registered through the
`usePlacement` hook (not a direct `Superwall.shared.register` call). The app must
be wrapped in `SuperwallProvider`.

## API

```ts
import { usePlacement } from "expo-superwall";

function usePlacement(callbacks?: {
  onPresent?: (paywallInfo: PaywallInfo) => void
  onDismiss?: (paywallInfo: PaywallInfo, result: PaywallResult) => void
  onSkip?: (reason: PaywallSkippedReason) => void
  onError?: (error: string) => void
}): {
  registerPlacement: (args: {
    placement: string
    params?: Record<string, any>
    feature?: () => void
  }) => Promise<void>
  state: PaywallState   // idle | presented | dismissed | skipped | error
}
```

`registerPlacement` is async - `await` it. Gating configuration lives in the
dashboard; the `feature` callback is your gate. Lifecycle observation goes through
the hook's `callbacks`, not a handler argument.

### Provider (once, at the app root)

```tsx
import { SuperwallProvider } from "expo-superwall";

export default function App() {
  return (
    <SuperwallProvider apiKeys={{ ios: "YOUR_IOS_KEY", android: "YOUR_ANDROID_KEY" }}>
      <RootNavigator />
    </SuperwallProvider>
  );
}
```

Children render after configuration succeeds, so hooks used inside are safe to call.

### Gated feature

```tsx
import { usePlacement } from "expo-superwall";
import { Button } from "react-native";

function ExportButton() {
  const { registerPlacement } = usePlacement({
    onDismiss: (_info, result) => console.log("dismissed", result.type),
    onSkip: (reason) => console.log("skipped", reason),
  });

  const onExport = async () => {
    await registerPlacement({
      placement: "unlock_export",
      params: { source: "editor_toolbar" },
      feature: () => exportDocument(),   // runs only when access is granted
    });
  };

  return <Button title="Export as PDF" onPress={onExport} />;
}
```

### Fire-and-forget

```tsx
await registerPlacement({ placement: "onboarding_complete" });
```

`params` values are available in campaign audience rules; keys starting with `$`
are reserved.

## Feature-gating semantics

The `feature` callback is your gate. When it runs (per the paywall's Feature
Gating setting in the dashboard):

| Situation                                            | Does `feature` run?                               |
| ---------------------------------------------------- | ------------------------------------------------- |
| No campaign matches                                  | Yes, immediately (no network, no paywall)         |
| User already subscribed                              | Yes, immediately, no paywall                      |
| Holdout / no audience match                          | Yes, immediately (per current subscription state) |
| Paywall shown, **Non-Gated**, dismissed              | Yes - whether or not they paid                    |
| Paywall shown, **Gated**, dismissed without purchase | No - feature blocked                              |
| User purchases                                       | Yes, after the transaction                        |

**Gated** = paid-only; **Non-Gated** = show paywall, let them through either way.
Same `registerPlacement` call for both; the dashboard decides.

## Where to place - one realistic gate

Limit-reached on a `Pressable`:

```tsx
function AddProjectButton({ count, freeLimit }: { count: number; freeLimit: number }) {
  const { registerPlacement } = usePlacement();
  const onPress = async () => {
    if (count < freeLimit) return createProject();
    await registerPlacement({ placement: "project_limit_reached", feature: createProject });
  };
  return <Pressable onPress={onPress}><Text>New project</Text></Pressable>;
}
```

## Audit checklist

- Find every call: `grep -rn "registerPlacement\|usePlacement" app/ src/`.
- When a placement intentionally controls access, paywalled work is passed as
  `feature` rather than run after the `await` unconditionally.
- No outer subscription branch should prevent an intentionally remote gate from
  using its feature callback. Status reads elsewhere are valid and require context.
- Names are stable and match presenting campaigns exactly; preserve intentional
  analytics taxonomies and never rename for style alone.
- Cross-check placements expected to present now with `superwall campaigns list
--project <id> --app <id> --json`; analytics-only, future, and paused placements may be unrouted.
- `usePlacement` is only called inside components under `SuperwallProvider`.
- Obvious premium boundaries (upgrade buttons, gated actions, quota limits,
  onboarding end) with no placement.

## Dashboard routing

```bash
superwall campaigns list --project <id> --app <id> --json
superwall campaigns create "Editor upgrade paywall" unlock_export --project <id> --app <id> --json
superwall campaigns placement <campaignId> another_placement --project <id> --app <id> --json
```

## Pitfalls

- **Registering during render.** Call `registerPlacement` from an event handler
  (`onPress`) or an effect - never in the component body, or it fires on every
  render.
- **Missing `await`.** `registerPlacement` returns a Promise; without `await` you
  can't sequence follow-up work and errors go unhandled. Prefer the hook callbacks
  or a try/catch.
- **Using the hook outside the provider.** `usePlacement` requires a
  `SuperwallProvider` ancestor; otherwise it won't be configured.
- **Re-creating callbacks noisily.** The `callbacks` object is fine to inline, but
  put stable logic in named functions to avoid confusion when auditing.
- **Conflicting gates.** An outer entitlement check is a problem only when the same
  action is intentionally controlled by the placement's feature callback.

## Deeper docs

- Index: https://superwall.com/docs/expo/llms.txt
- usePlacement: https://superwall.com/docs/expo/sdk-reference/hooks/usePlacement
- Feature gating: https://superwall.com/docs/expo/quickstart/feature-gating
- Present first paywall: https://superwall.com/docs/expo/quickstart/present-first-paywall
- SuperwallProvider: https://superwall.com/docs/expo/sdk-reference/components/SuperwallProvider
- Presentation handler: https://superwall.com/docs/expo/guides/advanced/using-the-presentation-handler
- Deep links: https://superwall.com/docs/expo/guides/handling-deep-links
