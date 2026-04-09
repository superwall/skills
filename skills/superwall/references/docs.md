## Documentation

All Superwall documentation is available in machine-readable formats. **Do not hardcode doc content** — always fetch live.

| Resource    | URL                                             | Use when                                      |
| ----------- | ----------------------------------------------- | --------------------------------------------- |
| Doc index   | `https://superwall.com/docs/llms.txt`           | Finding the right doc page for a topic        |
| Full docs   | `https://superwall.com/docs/llms-full.txt`      | Need comprehensive context across many topics |
| Single page | `curl -sL https://superwall.com/docs/{path}.md` | Reading a specific doc page                   |

### Platform doc prefixes

- iOS: `/docs/ios/`
- Android: `/docs/android/`
- Flutter: `/docs/flutter/`
- Expo: `/docs/expo/`
- React Native: `/docs/react-native/`
- Dashboard: `/docs/dashboard/`
- Web Checkout: `/docs/web-checkout/`
- Integrations: `/docs/integrations/`

**Tip**: Fetch `llms.txt` first to find the exact path, then fetch that page with `curl -sL`.

---

## SDK Integration

For SDK integration, use the platform-specific quickstart skills when available:

| Platform              | Skill                          |
| --------------------- | ------------------------------ |
| iOS (Swift/ObjC)      | `superwall-ios-quickstart`     |
| Android (Kotlin/Java) | `superwall-android-quickstart` |
| Flutter               | `superwall-flutter-quickstart` |
| Expo                  | `superwall-expo-quickstart`    |

For platforms without a dedicated skill (React Native), or when the quickstart skills are not installed, follow the live-doc workflow in [references/sdk-integration.md](references/sdk-integration.md).

---

## Dashboard Links

URL patterns for linking users to Superwall dashboard pages. See [references/dashboard-links.md](references/dashboard-links.md).

---

## SDK Source (for debugging)

Clone SDK repos locally to trace internal behavior. See [references/sdk-source.md](references/sdk-source.md).

---

## Webhooks & Integrations

**Live integration catalog** (same source the Superwall dashboard pulls from):

```bash
curl -s https://webhooks.superwall.me/integrations
```

Always fetch live — do not cache.

For general webhook and event documentation, fetch from the docs:

- **Webhook setup**: `curl -sL https://superwall.com/docs/integrations/webhooks.md`
- **Event catalog**: Fetch `https://superwall.com/docs/llms.txt` and search for "events" or "analytics" to find the full event type reference
