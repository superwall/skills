# Lifecycle and events

What the paywall knows and when — and the one rule that shapes every entry
animation.

## Entry animations key off presentation, never mount

The SDK **preloads paywalls hidden** before showing them. Your components
mount long before anyone is looking, so a mount-timed animation (a
`useEffect`, Motion's `initial`/`animate` firing on mount, a CSS animation
on load) has already finished by the time the paywall appears.

Gate entry animations on the presentation signal:

```tsx
import { useSuperwallSnapshot } from "superwall/hooks";

const opened = useSuperwallSnapshot().paywall !== undefined;

<motion.div
  initial={{ opacity: 0, y: 14 }}
  animate={opened ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
/>
```

`snapshot.paywall` flips when the paywall is actually presented and, unlike
an event listener added in an effect, cannot miss the moment.

Value-driven animations gate on **both** conditions — a price count-up
starts when `opened && raw !== undefined`, never when the store delivers
the price (it would play while hidden) and never on a missing value (it
would land on a made-up figure):

```tsx
const rawPrice = Number(annual?.variables.rawPrice);
const raw = Number.isFinite(rawPrice) ? rawPrice : undefined;

React.useEffect(() => {
  if (opened && raw !== undefined) {
    const controls = animate(price, raw, { duration: 0.9, ease: "circOut" });
    return () => controls.stop();
  }
}, [opened, raw]);
```

`examples/with-motion` is the reference. The ownership rule that goes with
it: animation libraries animate *inside* a page; moving *between* pages is
the router's job ([navigation.md](navigation.md)).

## Events you can react to

```tsx
useSuperwallEvent("transaction_complete", () => haptics.success());
```

| Event | Fires when |
| --- | --- |
| `paywall_open` | The paywall is presented (or re-presented). Prefer `snapshot.paywall` for anything render-driving. |
| `transaction_complete` | A purchase **or restore** succeeded — whoever started it |
| `transaction_abandon` | The store sheet was closed |
| `freeTrial_start` | A trial actually began (also triggers the configured trial reminder) |
| `experiment` | The experiment assignment arrived (`experimentId`, `variantId`, `campaignId`) |
| `back_button_input` | Android hardware back |
| `game_controller_input` | Controller input — needs `gameControllerEnabled: true` in config |
| `message` | Every incoming SDK message — the debugging firehose |

For products, variables, and trial eligibility, use the dedicated hooks
instead of events — they read current state and cannot miss data that
arrived before your component subscribed. Data arrives progressively after
open (paywall id → products → variables → trial eligibility → experiment),
which is another reason every read is guarded.

## Dark mode

The device decides; the framework maintains a `dark`/`light` class on
`<html>`. Style with plain CSS and write no wiring:

```css
:root { --bg: #fdfef6; --fg: #0c0b0a; }
:root.dark { --bg: #1c1b19; --fg: #fdfef6; }
```

> **Important:** don't use `@media (prefers-color-scheme: dark)` as the
> mechanism — it cannot see what the device reports and doesn't respond to
> the studio's theme toggle. A paywall styled that way looks right on your
> machine and wrong on the device. (Tailwind: redefine the `dark:` variant
> onto the class — see [examples.md](examples.md).)

## Previewing — the studio

`superwall dev` hosts the studio: every paywall as a card with a live
miniature, and an editor per paywall with a device-frame preview at exact
logical size. Use it to check what you cannot check in code:

- **Devices** — iPhone SE through iPad Pro and Pixel; switching also
  changes what the paywall sees as platform/model/OS
- **Light/dark**, **locale**, **rotation**, and a **trial eligibility**
  toggle — check every route in every state you support
- **Variables** — edit user attributes, device properties, placement
  params, and per-product variables live; values are seeded from your
  app's real sample data and products
- **Purchases, permissions, callbacks** — the studio asks *you* to pick
  each outcome, so both branches of every flow are testable
- **The event log** — every message the paywall sends (haptics, page
  views, purchase attempts) as it happens
- **Push / Publish / Promote** buttons ([cli.md](cli.md))

## Dev vs device

The same paywall runs against a simulated host in dev and the real SDK on
device. What differs:

| | `superwall dev` | Real device |
| --- | --- | --- |
| Product variables | `undefined` until the studio injects your dashboard products | delivered by the SDK |
| `purchase()` / `restore()` | simulated — you pick the outcome | real store |
| `close()`, `openUrl()`, haptics | logged in the event log | acted on by the host |
| Permissions / callbacks | studio prompts you | OS prompt / your app's code |
| Numeric variables | numbers | **strings** — always `Number()` |
| Presentation (`paywall_open`) | immediate | after preload, when actually shown |
| Web checkout sheet | not mounted — verify on a pushed version | works |

A published paywall never falls back to simulated data — the simulation
exists only in previews.

## Local platform styling

Published paywalls receive a small Superwall-owned stylesheet at serve
time (platform-wide behavior like scroll control). Previews apply the same
one, so local and published render identically. Set
`SUPERWALL_RUNTIME_URL` in the project `.env` only if you need previews to
use a local build of that platform layer.
