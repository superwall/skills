# Superwall placements - Android / Kotlin

> Read `strategy.md` (beside this file) first for _where_ placements go and _why_ (the
> core set, app-type playbook, audit method, gate depth). This file is the Android API.

## API

```kotlin
import com.superwall.sdk.Superwall

// With gated feature (the common form)
fun Superwall.register(
    placement: String,
    params: Map<String, Any>? = null,
    handler: PaywallPresentationHandler? = null,
    feature: () -> Unit,
)

// Fire-and-forget (no feature to gate)
fun Superwall.register(
    placement: String,
    params: Map<String, Any>? = null,
    handler: PaywallPresentationHandler? = null,
)
```

Called on the shared instance: `Superwall.instance.register(...)`. Not a
suspend function - no coroutine needed. `params` values are available in
campaign audience rules; keys starting with `$` are reserved and dropped, and
arrays or nested maps are ignored.

### Gated feature

```kotlin
Superwall.instance.register("unlock_export") {
    // Runs only when access is granted (see semantics below).
    exportDocument()
}
```

### Fire-and-forget (e.g. onboarding end, an upsell surface)

```kotlin
Superwall.instance.register("onboarding_complete")
```

### Passing params for audience targeting

```kotlin
Superwall.instance.register(
    placement = "unlock_export",
    params = mapOf("source" to "editor_toolbar", "doc_count" to documents.size),
) {
    exportDocument()
}
```

## Feature-gating semantics

The `feature` lambda is your gate. When it runs depends on the paywall's
**Feature Gating** setting (paywall editor → General → Feature Gating):

| Situation                                            | Does `feature` run?                                    |
| ---------------------------------------------------- | ------------------------------------------------------ |
| No campaign matches the placement                    | Yes, immediately (no network, no paywall)              |
| User already subscribed / entitled                   | Yes, immediately, no paywall                           |
| Holdout group or no audience match                   | Yes, immediately (runs per current subscription state) |
| Paywall shown, **Non-Gated**, dismissed              | Yes - access granted whether or not they paid          |
| Paywall shown, **Gated**, dismissed without purchase | No - feature blocked                                   |
| Paywall shown, user purchases                        | Yes, after the transaction completes                   |

So: **Gated** = paid-only feature; **Non-Gated** = show the paywall but let them
through either way (soft paywall / upsell). This is toggled in the dashboard, not
in code - the same `register` call works for both.

## Presentation handler (optional lifecycle observation)

```kotlin
val handler = PaywallPresentationHandler()
handler.onPresent { paywallInfo -> Log.d("SW", "presented ${paywallInfo.name}") }
handler.onDismiss { paywallInfo, result -> Log.d("SW", "dismissed $result") }
handler.onError { error -> Log.e("SW", "error", error) }
handler.onSkip { reason -> Log.d("SW", "skipped $reason") }   // holdout, no audience match, placement not found

Superwall.instance.register("unlock_export", handler = handler) {
    exportDocument()
}
```

Use the handler for analytics/UI reactions only. Do **not** move the gated work
into `onDismiss` - the `feature` lambda already handles gating correctly. Fetch
the page for the exact `onSkip` reason types:
`curl -sL https://superwall.com/docs/android/guides/advanced/using-the-presentation-handler.md`

## Where to place - one realistic gate

Compose button:

```kotlin
Button(onClick = {
    Superwall.instance.register("unlock_export") {
        exporter.exportPdf(document)
    }
}) { Text("Export as PDF") }
```

Views:

```kotlin
binding.exportButton.setOnClickListener {
    Superwall.instance.register("unlock_export") {
        exporter.exportPdf(document)
    }
}
```

Limit-reached gate:

```kotlin
fun addProject() {
    if (projects.size < freeLimit) return createProject()
    Superwall.instance.register("project_limit_reached") {
        createProject()
    }
}
```

## Audit checklist

- Find every call: `grep -rn "register(" app/src/main` (also any wrapper the
  app's analytics layer exposes).
- When a placement intentionally controls access, the paywalled work is **inside**
  the `feature` lambda rather than after the call.
- No outer subscription branch should prevent an intentionally remote gate from
  using its feature lambda. Subscription reads elsewhere are valid and require
  context.
- Names are stable and match presenting campaigns exactly; preserve intentional
  analytics taxonomies and never rename for style alone.
- Cross-check placements expected to present now with `superwall campaigns list
--project <id> --app <id> --json`; analytics-only, future, and paused placements may be unrouted.
- Obvious premium entry points (upgrade buttons, gated exports, quota limits,
  onboarding end) that have **no** placement.

## Dashboard routing

A placement is inert without a campaign:

```bash
superwall campaigns list --project <id> --app <id> --json
superwall campaigns create "Editor upgrade paywall" unlock_export --project <id> --app <id> --json
superwall campaigns placement <campaignId> another_placement --project <id> --app <id> --json
```

## Pitfalls

- **Registering during composition.** Never call `register` in a composable's
  body - it re-fires on every recomposition. Register from `onClick`, a
  `LaunchedEffect(Unit)` for screen-entry placements, or a ViewModel event.
- **Registering before `configure`.** Calls before `Superwall.configure(...)` in
  `Application.onCreate()` are dropped. Configure first.
- **No Activity in the foreground.** A paywall is an Activity; registering from
  a background service or during process start, before any Activity is resumed,
  cannot present. Register from UI code.
- **Conflicting gates.** An outer entitlement check is a problem only when the same
  action is intentionally controlled by the placement's feature lambda.
- **Waiting on the lambda to fire.** The `feature` lambda may run later (after a
  purchase). Don't assume it runs synchronously before the next line.

## Deeper docs

- Index: https://superwall.com/docs/android/llms.txt
- register: https://superwall.com/docs/android/sdk-reference/register
- Feature gating: https://superwall.com/docs/android/quickstart/feature-gating
- Presentation handler: https://superwall.com/docs/android/guides/advanced/using-the-presentation-handler
- Deep links: https://superwall.com/docs/android/guides/handling-deep-links
