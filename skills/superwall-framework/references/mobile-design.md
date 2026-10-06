# Mobile design execution — the framework's part

The craft of a screen that reads as native — press feedback, hover gating,
inputs and the keyboard, motion values, type, worst-case content, dark mode,
platform conventions, the audit — lives in the **`mobile-design` skill**.
Read it for every new screen, and especially when there is no design
reference: its values are then the design. If it is not installed:

```bash
npx skills add https://github.com/superwall/skills/tree/next --skill mobile-design --global --yes --agent claude-code universal --full-depth
```

This file is only what the framework adds to that: the DOM it renders, the
insets it applies, where chrome and scrolling live, and the hooks that stand
in for a native app's signals.

## The skeleton every screen shares

Native screens have a fixed anatomy, and a paywall that follows it reads
as native before a single color is applied:

```
┌──────────────────────────────┐  ← status bar / cutout — the framework's inset, not yours
│  [close]              [skip] │  ← layout chrome, absolute inside the shell
│                              │
│  scrolling content           │  ← a page: ordinary padding, the page itself scrolls
│  (the page itself scrolls)   │
│                              │
│ ░░░░░░░░ fade ░░░░░░░░░░░░░░ │  ← content slides under the pinned area
│  [   Primary CTA (full)    ] │  ← pinned bottom chrome
│   Restore · Terms · Privacy  │
└──────────────────────────────┘  ← home indicator / nav bar — the framework's inset
```

**The framework insets the whole paywall.** Its root box fills the
viewport and is padded by the safe area of the device the paywall is on,
so everything you render already starts clear of the bars, and its
content box is what layout chrome positions against. Each page's scroll
container reaches back out to the screen edges and carries the inset as
its scroll padding, so content scrolls under the bars and rests clear of
them, like a native scroll view. You write ordinary padding. The canonical stylesheet, which every example and the
`superwall create` scaffold share:

```css
:root {
  --bg: #fdfef6;                   /* cream paper in light; the dark branch is one cool OKLCH ramp */
  --fg: #0c0b0a;
  --accent: #46d7d4;               /* the one accent, fixed in both modes: the primary fill, the selected edge */
  --radius: 3px;                   /* one corner; circles are 999px */
  --sw-background: var(--bg);      /* every route paints it */
  --sw-page-inset-bottom: 0px;     /* the layout's footer owns the bottom edge; drop this line if the layout has no footer below the pages */
}
:root.dark {
  --bg: oklch(0.16 0.00385 262);   /* #0c0d0f */
  --fg: #fdfef6;
}
```

The full sheet (the text ladder at 70 / 55 / 45%, the border at 10%,
`color-mix(in oklab)`, press and hover rules, the sticky `.actions`) is the
head of every example's `theme.css` and what `superwall create` writes;
start from it rather than from a blank file.

**A background that is not white MUST also be set in `config.ts`.** This is
not a duplicate of `--sw-background` and it is not optional:

```ts
background: { light: "#fdfef6", dark: "#0c0d0f" }   // config.ts — the same two colours as --bg
```

`--sw-background` paints the *routes*. `background` in config is what the
framework writes on `<html>`, per scheme, and `<html>` is what the shopper
sees when the scroll rubber-bands past the end of the content — every
iOS scroll does this. Set only the CSS variable and the paywall looks
right at rest and flashes a white band on every bounce, on a dark paywall
most of all. The two always carry the same colors; the audit below checks
it.

```css
.shell {                            /* layout.tsx — a flex child of the framework's content box */
  display: flex;
  flex: 1 1 auto;                   /* never min-height: 100dvh — that overflows the insets and scrolls */
  flex-direction: column;
}

.page {                             /* a route — plain padding, the inset is already outside */
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 16px 20px 0;
}

.close {                            /* layout chrome — absolute, already below the bar */
  position: absolute;
  top: 4px;
  right: 16px;
}

.footer {                           /* pinned CTA, last child of the page; sticks above the home indicator, content scrolls under the fade to the edge */
  position: sticky;
  bottom: 0;
  margin-top: auto;
  padding: 24px 0 12px;
  background: linear-gradient(to bottom, transparent, var(--bg) 32px);
}
```

Three rules keep it honest, and [layout.md](layout.md) is the exact
mechanics behind them — the DOM the framework renders, what fixed,
absolute and sticky resolve against inside it, the inset settings and
their precedence, the floor table, and the debugging order:

1. **Nothing in a layout or page adds or subtracts a safe-area inset,
   and nothing is `position: fixed`.** The root did the insets and the
   pages already scroll under them; fixed ignores them and
   rides along with a page during transitions. Chrome is absolute in the
   layout or sticky in the page. The one time a control reads the safe
   area itself is over a deliberate bleed (`insets: { top: "none" }`),
   and then it reads `--sw-safe-area-inset-*`, never `env()`.
2. **Chrome sits at inset *plus* spacing, never at the inset.** The
   floor for a class of device is a minimum (an iPhone 16 Pro's bar is
   62px against the island floor of 59; a cutout Pixel's is taller than
   Android's 24), so the 4–16px of ordinary spacing above the first
   element is what absorbs the difference on the real phone.
3. **Sides are real.** Rotate an island phone and the cutout takes 59px of
   one side; the framework pads the root's sides for it. Don't undo that
   with negative margins unless the element is meant to bleed.

## Insets — when to change them

`insets` in `config.ts` is what the paywall is padded with. The default,
`"safe-area"`, is right for almost every paywall and needs no CSS. Change
it only when the design bleeds, and say so in the hand-off:

```ts
insets: "none"                                 // full-bleed: the paywall draws the whole screen
insets: { top: "none" }                        // a hero under the status bar; other edges stay safe
insets: 24                                     // pixels on every edge (a web-only paywall with a fixed gutter)
```

Android is the platform to think about twice: its bottom inset is 0
because the SDK keeps the webview above the navigation bar, so a design
tuned to 34px of air under the CTA on iPhone needs its own 12–16px on
Android, and its top floor is the standard 24px status bar while cutout
phones can run taller.

**Tailwind**: the shell is `flex flex-1 flex-col`, chrome is
`absolute top-1 right-4`, a pinned CTA is `sticky bottom-0 mt-auto`, and
chrome over a bleed reads the safe area as an arbitrary value:
`top-[calc(var(--sw-safe-area-inset-top)+8px)]`. Do not reinvent the
variables as theme tokens.

## Scrolling and pinned chrome

- **The page scrolls; the CTA does not.** On a page with real content the
  primary action is pinned at the bottom and the content scrolls under
  it. A CTA that scrolls away with the copy is the single most common
  reason a paywall underperforms a native one. Pinned means
  `position: sticky; bottom: 0` as the page's last child, never fixed
  ([layout.md](layout.md)).
- The pinned area carries a **gradient from transparent to the page
  background** so content fades out behind it instead of clipping to a
  hard edge; set `background` in config to the same color so the native
  loading backdrop matches.
- If the fade is a separate element over the content, `pointer-events:
  none` on it so it doesn't swallow scroll gestures; a sticky footer that
  *is* the button needs nothing.
- **The last content row must scroll clear of the fade**: a sticky footer
  takes its own space at the end of the page, so give the content above it
  a little bottom margin rather than a page padding that guesses the
  footer's height.
- Let the page itself scroll. Don't invent nested scroll areas — the
  platform (and `scrollEnabled` in config) owns scroll behavior, and a
  nested scroller breaks the rubber-band and the SDK's scroll control.
  The scroll container is the page's route, not the window.
- A short page still lays out the same way: the pinned chrome is pinned
  whether or not there is anything to scroll, so nothing jumps when the
  content grows by a line in another locale.
- Never `overflow: hidden` on `html`/`body` to "fix" scrolling. If
  something scrolls that shouldn't, find the element that is taller than
  the viewport.


## What the framework supplies for the craft rules

- **Haptics**: `useHaptics()` — `light` for navigation and CTAs,
  `selection` for choosing, `success` on `transaction_complete`.
- **"Shown" signal**: `useSuperwallSnapshot().paywall !== undefined`. Every
  entrance gates on it, never on mount; the SDK preloads paywalls hidden
  (docs: `lifecycle`). `@starting-style` and mount animations fire during
  the preload.
- **Between-page motion**: the router (`push`, `slide`, `fade`, `shift`, or
  a custom transition on `[data-sw-route]`, docs: `transitions`). Never
  animate a page's own root on navigation.
- **Dark mode**: the `:root.dark` class the SDK stamps, never
  `prefers-color-scheme` (docs: `lifecycle`). `background` in `config.ts`
  paints the native backdrop in both schemes.
- **Platform**: `data-sw-platform` / `data-sw-idiom` on `<html>`, switched
  by the studio's presets.
- **Strings**: `messages/en.ts` through `useTranslation().t()`; no plural
  engine, so fork on the count with `Intl.PluralRules`.
- **Covered pages**: `useIsFocused()` to pause video and timers.

## The pre-ship audit

Run it in the studio on every preset and both schemes; a paywall is not
done until every line passes.

- [ ] No `env()` and no `position: fixed` in the stylesheet; no layout or
      page adds a safe-area inset of its own; nothing of yours is
      `100dvh`/`100vh` tall; `insets` in config only where the design
      bleeds, and then the chrome over the bleed reads
      `--sw-safe-area-inset-*`.
- [ ] Close/back sits below the bar on iPhone SE (home button, 20px), an
      island phone, a Pixel, an iPad; and clear of the cutout in landscape
      where the app allows rotation.
- [ ] The primary CTA is pinned, full width, above the home indicator on
      iOS and 12px+ above the bottom on Android; the last content row
      scrolls clear of it.
- [ ] Nothing overflows horizontally at 320px; nothing is clipped at 667px
      tall with the largest locale's copy.
- [ ] Both schemes designed and checked; `background` in `config.ts` and
      `--sw-background` in CSS set to the same colors. Scroll past the end
      of a page in both schemes: any white flash means `background` is
      missing from config.
- [ ] Tap targets ≥ 44px; haptics on every meaningful tap; no focus rings
      on tap controls natively; `aria-label` on icon buttons.
- [ ] Every tappable element has an `:active` state; every `:hover` is
      inside `@media (hover: hover) and (pointer: fine)`.
- [ ] Inputs are 16px or larger, with the right `type` / `inputmode` /
      `autocomplete`; the field and its action stay reachable with the
      keyboard open on a short phone.
- [ ] Motion: no `transition: all`, no `ease-in`, no `scale(0)`; only
      `transform`/`opacity` move; UI changes under 300ms; entrances gate
      on `paywall_open` (no `@starting-style` or mount animation); a
      reduced-motion variant that cross-fades instead of moving.
- [ ] Worst-case content renders cleanly: longest price, longest locale,
      a count of 1, no price at all.
- [ ] No loading state on the buy button; unpriced state designed;
      abandoned purchase handled.
- [ ] Copy is store-neutral where the paywall ships to both stores, and
      every string, `aria-label`s included, comes from `messages/` through
      `t()`, with prices interpolated and guarded, never in a catalog.
- [ ] Custom fonts subset and woff2; images sized for a phone.
- [ ] The configured presentation (`modal`, `drawer`, `popup`) checked as
      a sheet, not only as fullscreen.
- [ ] Opened on a real phone once (the studio's **Preview** button gives
      a QR code). The tap highlight, a hover stuck after a tap, input zoom,
      the keyboard and how the press feels don't reproduce in a desktop
      browser; say which of these you could not check.
