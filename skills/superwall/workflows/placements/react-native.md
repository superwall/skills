# Superwall placements - React Native

> Read `references/strategy.md` first for _where_ placements go and _why_ (the core
> set, app-type playbook, audit method, gate depth). This file is the RN API.

The RN SDK (`@superwall/react-native-superwall`) registers placements via a single
options-object `register` call on the shared instance. (This is distinct from Expo,
which uses the `usePlacement` hook - see `references/expo.md` if the app uses
`expo-superwall`.)

## API

```ts
import Superwall from "@superwall/react-native-superwall";
import { PaywallPresentationHandler } from "@superwall/react-native-superwall";

async register(options: {
  placement: string
  params?: Record<string, any> | Map<string, any>
  handler?: PaywallPresentationHandler
  feature?: () => void
}): Promise<void>
```

Called as `Superwall.shared.register({ ... })`. Async - `await` it. `params` values
are available in campaign audience rules; keys starting with `$` are reserved and
dropped. The `feature` callback is your gate; gating configuration lives in the
dashboard.

### Gated feature

```ts
await Superwall.shared.register({
  placement: "unlock_export",
  params: { source: "editor_toolbar" },
  feature: () => exportDocument(),   // runs only when access is granted
});
```

### Fire-and-forget

```ts
await Superwall.shared.register({ placement: "onboarding_complete" });
```

### With a presentation handler (lifecycle observation)

```ts
const handler = new PaywallPresentationHandler();
handler.onPresent((info) => console.log("presented", info.name));
handler.onDismiss((info, result) => console.log("dismissed", result));
handler.onError((error) => console.log("error", error));

await Superwall.shared.register({
  placement: "unlock_export",
  handler,
  feature: () => exportDocument(),
});
```

Keep gated work in `feature`; use the handler for analytics/UI only.

## Feature-gating semantics

When the `feature` callback runs (per the paywall's Feature Gating setting in the
dashboard):

| Situation                                            | Does `feature` run?                               |
| ---------------------------------------------------- | ------------------------------------------------- |
| No campaign matches                                  | Yes, immediately (no network, no paywall)         |
| User already subscribed                              | Yes, immediately, no paywall                      |
| Holdout / no audience match                          | Yes, immediately (per current subscription state) |
| Paywall shown, **Non-Gated**, dismissed              | Yes - whether or not they paid                    |
| Paywall shown, **Gated**, dismissed without purchase | No - feature blocked                              |
| User purchases                                       | Yes, after the transaction                        |

**Gated** = paid-only; **Non-Gated** = show paywall, let them through either way.
Same `register` call for both; the dashboard decides.

## Where to place - one realistic gate

`onPress` on a `Pressable`, limit-reached:

```tsx
function AddProjectButton({ count, freeLimit }: { count: number; freeLimit: number }) {
  const onPress = async () => {
    if (count < freeLimit) return createProject();
    await Superwall.shared.register({
      placement: "project_limit_reached",
      feature: createProject,
    });
  };
  return (
    <Pressable onPress={onPress}>
      <Text>New project</Text>
    </Pressable>
  );
}
```

## Audit checklist

- Find every call: `grep -rn "\.register(" src/ app/` and `Superwall.shared`.
- When a placement intentionally controls access, paywalled work is passed as
  `feature` rather than run after the `await` unconditionally.
- No outer subscription branch should prevent an intentionally remote gate from
  using its feature callback. Status reads elsewhere are valid and require context.
- Names are stable and match presenting campaigns exactly; preserve intentional
  analytics taxonomies and never rename for style alone.
- Cross-check placements expected to present now with `superwall campaigns list
--project <id> --app <id> --json`; analytics-only, future, and paused placements may be unrouted.
- Obvious premium boundaries (upgrade buttons, gated actions, quota limits,
  onboarding end) with no placement.

## Dashboard routing

```bash
superwall campaigns list --project <id> --app <id> --json
superwall campaigns create "Editor upgrade paywall" unlock_export --project <id> --app <id> --json
superwall campaigns placement <campaignId> another_placement --project <id> --app <id> --json
```

## Pitfalls

- **Registering during render.** Call `register` from an event handler or effect,
  never in the component body - it would fire on every render.
- **Missing `await`.** `register` returns a Promise; without `await` errors go
  unhandled and you can't sequence follow-up work. Use `await` in a try/catch or
  attach the presentation handler.
- **Registering before `configure`.** Ensure `Superwall.configure(apiKey)` has run
  (typically at app startup) before any `register`; earlier calls are dropped.
- **Conflicting gates.** An outer entitlement check is a problem only when the same
  action is intentionally controlled by the placement's feature callback.

## Deeper docs

- Index: https://superwall.com/docs/react-native/llms.txt
- register: https://superwall.com/docs/react-native/sdk-reference/register
- PaywallPresentationHandler: https://superwall.com/docs/react-native/sdk-reference/PaywallPresentationHandler
- subscriptionStatus: https://superwall.com/docs/react-native/sdk-reference/subscriptionStatus
- Deep links: https://superwall.com/docs/react-native/sdk-reference/handleDeepLink

Note: the RN docs index does not expose a standalone feature-gating page; the
semantics above are confirmed on the `register` reference. Confirm exact wording at
the register URL above if a detail is load-bearing.
