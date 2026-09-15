# Superwall placements

A **placement** is a named event you fire at a meaningful moment. You register it,
optionally with a `feature` callback. Superwall evaluates your dashboard campaign
on-device and decides - remotely - whether to show a paywall and whether the
feature is gated. Reading subscription state is fine; only avoid a hand-rolled local
gate where it would override a gate the campaign is meant to control.

The API is the easy part. The value of this skill is knowing _where_ to place
placements and _why_. Read the strategy playbook first, then your framework's
reference for the exact call.

## Read the strategy playbook FIRST

`references/strategy.md` - the definitive, framework-agnostic guide to where
placements go and why. Read it before adding or auditing any placement. It covers:

- **The mental model** - register generously; let campaigns decide what presents.
  Analytics bridges, fire-and-forget calls, and intentionally unrouted placements
  are valid. Put work in a feature callback when that action should be remotely
  gateable; subscription-state reads remain valid for app state and UI.
- **Common candidates** (`onboarding_complete`, feature gates, limit-reached,
  upgrade entry, broad-reach lifecycle, win-back), selected for the actual app.
- **App-type playbook** - concrete placements for editors, fitness, productivity,
  content, dating/social, and AI apps.
- **The audit method** - enumerate the paid surface first, then map surface →
  placement and flag the gaps.
- **Gate depth** - hard gate (paid-only) vs soft/non-gated (upsell), and when each
  is right.
- **Calibration** (no universal count) and **naming rules**.

## Then read the framework reference

Exact API, gating semantics, placement examples, audit checklist, and pitfalls:

| Framework    | Reference                    |
| ------------ | ---------------------------- |
| iOS / Swift  | `references/ios.md`          |
| Expo         | `references/expo.md`         |
| React Native | `references/react-native.md` |
| Flutter      | `references/flutter.md`      |
| Android      | `references/android.md`      |

## Placements need campaigns (`superwall` CLI, authenticated)

A placement cannot present a paywall until a campaign routes it in the dashboard:

- `superwall campaigns list --project <id> --app <id> --json` - existing campaigns and placements.
- `superwall campaigns create "<description>" <placement_name> --project <id> --app <id> --json` - create one with its required first placement.
- `superwall campaigns placement <campaignId> <placement_name> --project <id> --app <id> --json` - route another placement.

Analytics-only, future, and paused placements may intentionally remain unrouted.
For placements expected to present now, use one campaign per distinct paywall
surface - not one per trigger. Don't create duplicates.

## Docs access

Superwall docs are agent-fetchable as markdown:

- **Discover pages:** `curl -sL https://superwall.com/docs/llms.txt` (index of all
  pages) or a platform index like `https://superwall.com/docs/ios/llms.txt`.
- **Fetch a page:** append `.md` to any docs route and use `curl -sL` (follow
  redirects), e.g. `curl -sL https://superwall.com/docs/ios/quickstart/feature-gating.md`.
- Full-text dumps: `.../llms-full.txt` per platform.

Key pages: `feature-gating`, `sdk-reference/register`,
`dashboard/dashboard-campaigns/campaigns-placements`, and
`dashboard/dashboard-campaigns/campaigns-standard-placements` (the auto-registered
lifecycle placements).
