# Superwall placements - Flutter

> Read `references/strategy.md` first for _where_ placements go and _why_ (the core
> set, app-type playbook, audit method, gate depth). This file is the Flutter API.

## API

```dart
import 'package:superwallkit_flutter/superwallkit_flutter.dart';

Future<void> registerPlacement(
  String placement, {
  Map<String, Object>? params,
  PaywallPresentationHandler? handler,
  Function()? feature,
})
```

Called as `Superwall.shared.registerPlacement(...)`. Async - `await` it. `params`
values are available in campaign audience rules; keys starting with `$` are
reserved and dropped. The `feature` callback is your gate; gating configuration
lives in the dashboard.

### Gated feature

```dart
await Superwall.shared.registerPlacement(
  'unlock_export',
  params: {'source': 'editor_toolbar'},
  feature: () {
    exportDocument();   // runs only when access is granted
  },
);
```

### Fire-and-forget

```dart
await Superwall.shared.registerPlacement('onboarding_complete');
```

### With a presentation handler (lifecycle observation)

```dart
final handler = PaywallPresentationHandler();
handler.onPresent((info) => debugPrint('presented ${info.name}'));
handler.onDismiss((info, result) => debugPrint('dismissed $result'));
handler.onError((error) => debugPrint('error $error'));
handler.onSkip((reason) => debugPrint('skipped $reason'));

await Superwall.shared.registerPlacement(
  'unlock_export',
  handler: handler,
  feature: () => exportDocument(),
);
```

Keep gated work in `feature`; use the handler for analytics/UI only.

## Feature-gating semantics

When the `feature` callback runs (per the paywall's Feature Gating setting in the
dashboard - editor → General → Feature Gating):

| Situation                                            | Does `feature` run?                                 |
| ---------------------------------------------------- | --------------------------------------------------- |
| No campaign matches                                  | Yes, immediately (no network, no paywall)           |
| User already subscribed                              | Yes, immediately (entitlement verified server-side) |
| Holdout / no audience match                          | Yes, immediately (per current subscription state)   |
| Paywall shown, **Non-Gated**, dismissed              | Yes - whether or not they paid                      |
| Paywall shown, **Gated**, dismissed without purchase | No - feature blocked                                |
| User purchases                                       | Yes, after the transaction                          |

**Gated** = paid-only; **Non-Gated** = show paywall, let them through either way.
Same `registerPlacement` call for both; the dashboard decides.

## Where to place - one realistic gate

`onTap` / `onPressed`, limit-reached:

```dart
ElevatedButton(
  onPressed: () async {
    if (projects.length < freeLimit) {
      createProject();
      return;
    }
    await Superwall.shared.registerPlacement(
      'project_limit_reached',
      feature: () => createProject(),
    );
  },
  child: const Text('New project'),
)
```

## Audit checklist

- Find every call: `grep -rn "registerPlacement" lib/`.
- When a placement intentionally controls access, paywalled work is passed as
  `feature` rather than run after the `await` unconditionally.
- No outer entitlement branch should prevent an intentionally remote gate from
  using its feature callback. Entitlement reads elsewhere are valid and require
  context.
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

- **Registering inside `build`.** Never call `registerPlacement` from a widget's
  `build` method - it re-fires on every rebuild. Call it from a callback
  (`onPressed`/`onTap`) or a one-shot `initState`.
- **Missing `await`.** `registerPlacement` returns `Future<void>`; without `await`
  errors go unhandled and follow-up work can't be sequenced.
- **Registering before configure.** Ensure `Superwall.configure(apiKey)` has run
  before any `registerPlacement`; earlier calls are dropped.
- **Conflicting gates.** An outer entitlement check is a problem only when the same
  action is intentionally controlled by the placement's feature callback.

## Deeper docs

- Index: https://superwall.com/docs/flutter/llms.txt
- register: https://superwall.com/docs/flutter/sdk-reference/register
- Feature gating: https://superwall.com/docs/flutter/quickstart/feature-gating
- Presentation handler: https://superwall.com/docs/flutter/guides/advanced/using-the-presentation-handler
- Tracking subscription state: https://superwall.com/docs/flutter/quickstart/tracking-subscription-state
- Deep links: https://superwall.com/docs/flutter/guides/handling-deep-links
