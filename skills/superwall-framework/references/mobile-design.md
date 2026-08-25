# Mobile design execution

Paywalls render inside a native webview on a phone. Two things decide
whether one feels native: reproducing the design exactly, and following
the platform conventions (Apple HIG and their Android equivalents) that
users feel but never name. These are working practices, not laws — the
design reference always wins over any rule here.

## The reference is the contract

- **Build 1:1.** Spacing, sizing, weights, colors, and effects come from
  the reference, not from habit. Measure the reference at logical points
  (a screenshot at device width) instead of eyeballing; compare your
  build against it side by side before calling it done.
- **Add nothing the design doesn't show.** No extra links, badges,
  footnotes, or affordances, however well-intentioned. If something seems
  missing (a restore affordance, a legal link), raise it in conversation
  — never add it to the UI unprompted.
- **Effects are design decisions, not defaults.** Shadows, gradients,
  borders, blurs, and radii belong to the design system of the paywall
  being built. If the reference is flat, build flat; if it is soft and
  elevated, match that. Reach for an effect only when the reference shows
  it.

## Safe areas

`env(safe-area-inset-*)` resolves to **0** in previews and some webview
contexts, so bare `env()` math puts controls in the status bar or under
the home indicator the moment insets go missing. Always wrap in `max()`
with a floor:

```css
/* fixed top chrome (close button): clears the status bar even with no env */
top: max(calc(env(safe-area-inset-top, 0px) + 10px), 60px);

/* pinned bottom chrome: clears the home indicator */
padding-bottom: max(calc(env(safe-area-inset-bottom, 0px) + 14px), 28px);
```

- ~60px is a sensible top floor, ~28px a bottom floor; adjust to the
  design, keep the pattern.
- Fixed elements (close button, CTA bar) need the inset math. Scrolling
  content instead needs enough bottom padding to clear whatever is
  pinned over it.

## Scrollable content

- Long content scrolls **under** pinned bottom chrome. The pinned footer
  carries a gradient (transparent → page background) so content fades
  out behind it instead of clipping to a hard edge. Set the page
  background with `background` in config (`"#0d0f12"` or
  `{ light, dark }`) and match the gradient's opaque end to it — the
  same value paints the native loading backdrop and spinner, so the load
  is seamless.
- Put `pointer-events: none` on the pinned container and
  `pointer-events: auto` back on its interactive children, so the fade
  region doesn't swallow scroll gestures.
- Give the scroll content bottom padding ≈ footer height + safe area, so
  the last row can scroll clear of the fade.
- Let the page itself scroll; don't invent nested scroll areas — the
  platform (and `scrollEnabled` in config) owns scroll behavior.

## Motion

- **Animate functional movement only** — elements that physically travel
  between states: a segmented-control thumb sliding, a sheet presenting,
  a progress bar filling. Content that merely changes (text, list rows,
  a price) updates in place; it does not fade, slide, or stagger unless
  the design explicitly calls for it.
- **Press feedback is the baseline interaction**: a scale-down active
  state (~0.96, fast in ~80ms, settle out ~200ms) on tappable elements,
  paired with a haptic. That is the whole story for most controls.
- Entry animations are opt-in per design — and when a design has one, it
  gates on presentation, never mount
  (docs: `lifecycle`).
- Honor `prefers-reduced-motion` by collapsing durations to ~1ms.

## Touch

- Tap targets ≥ 44×44pt. A visually shorter control (a slim segmented
  control) can trade height when the design demands it — width and
  spacing must compensate.
- Haptics on every meaningful tap (`useHaptics()`): `light` for
  navigation and CTAs, `selection` for choosing between options,
  `success` on `transaction_complete`, `error` sparingly on failures.
  iOS fires nothing on its own inside a webview.
- **Suppress focus rings on tap-driven controls** — `:focus-visible`
  heuristics misfire in webviews and previews, drawing outlines the
  design never asked for. Keep keyboard focus styles only where a
  keyboard is real (web checkout pages).
- On controls: `-webkit-tap-highlight-color: transparent`,
  `touch-action: manipulation`, `user-select: none`.

## Type and rendering

- Default to the system font stack (`-apple-system, BlinkMacSystemFont,
  …`) unless the design specifies brand type — it is what makes a
  webview read as native iOS.
- `-webkit-text-size-adjust: 100%` on `html`; antialiased smoothing;
  body copy around 17px matches iOS body text.
- Dark mode styles hang off the `:root.dark` class — never
  `prefers-color-scheme`
  (docs: `lifecycle`). Design both
  palettes even when the reference shows only one.

## Verify like a device

In the studio, before calling any paywall done: both color schemes, the
smallest supported width (320px) through tablet, every route, and the
trial-eligibility toggle where relevant. Nothing may overflow
horizontally at any size.
