# Responsive — every screen the paywall ships to

A paywall is designed at one size and shipped to dozens. The studio's
device presets are the contract: a paywall is finished when it is right
on every one of them, in both schemes, in the presentation style its
`config.ts` declares. This file says what "right" means at each size and
how to get there without a second design.

## The sizes that matter

| Preset | Logical size | What it tests |
| --- | --- | --- |
| iPhone SE | 375 × 667, no cutout | The shortest phone: does the pinned CTA still leave room for the content? 20px status bar, no home indicator |
| Responsive at 320 | 320 wide | Narrowest width in the wild (older phones, split view). Nothing may overflow; display type must have shrunk |
| iPhone 17 / Air / Pro Max | 402–440 × 874–956, island | The default. The tallest phones: does the layout use the height or leave a void above the CTA? |
| Pixel 10 / Galaxy S25 | 412 × 915 / 360 × 780, Android | Android conventions, 24px status-bar floor, no bottom inset, 360-wide Galaxy is the second-narrowest common width |
| iPad mini / iPad Pro 11″ | 744 × 1133 / 834 × 1194 | Tablet: a phone layout stretched to 800px is wrong; a centered column or a two-column reflow is right |
| Desktop (web only) | 1440 × 900 | A web funnel in a browser: a phone-width column, centered; hover states; real keyboard focus |
| Landscape | any preset rotated | Only where the app allows it. Cutout on the sides, 21px indicator, no status bar |

The studio also switches what the paywall is *told* — platform, model,
OS — so the inset floors and any `data-sw-*`-keyed CSS follow the preset.

## Width

- **Fluid by default.** `width: 100%`, `max-width` for the reading
  column, `padding-inline: 20px` (16px at 320 if the design is tight).
  Never a fixed pixel width on anything wider than an icon.
- **Type scales with `clamp()`**: a 40px display size on the reference is
  `clamp(2rem, 8vw, 2.5rem)` — 32px at 320, 40px at 393+, capped on
  tablets. Body text does not scale; it stays 15–17px everywhere.
- **Rows of options** (plan cards, feature bullets) stack vertically on
  phones; side-by-side plan cards fit three across at 393 only when each
  is under 110px wide — check 320 and 360, where they usually can't.
- **Pills and badges** ("Most popular", "Save 40%") wrap or truncate
  before they push the row wider; give them `white-space: nowrap` and
  the row `min-width: 0`, and check the longest locale.
- `min-width: 0` on flex children with text, or a long product name
  breaks the row instead of wrapping.

## Height — the short phone is the hard one

The iPhone SE's 667px, minus 20 status bar, minus a 120px pinned footer,
leaves under 530px for everything else. Design for that, and the tall
phones get more air, not a different layout.

- **Content scrolls; the CTA never does.** With the footer sticky at the
  page's end, a page that doesn't fit simply scrolls under it. That is
  the entire strategy for short screens; do not shrink the CTA or hide
  the legal links to "make it fit".
- **The shell is `flex: 1 1 auto`, never a viewport-height box.** The
  framework's wrapper is the one element sized to the viewport (with
  `100dvh`, so Safari's collapsing toolbar can't make it taller than what
  is visible); a shell with `min-height: 100dvh` of its own overflows the
  insets and scrolls.
- **Vertical rhythm compresses before content is cut**: `gap`s of
  24→16, a hero of `clamp(160px, 30dvh, 280px)` rather than a fixed 280,
  feature lists that lose a row of *spacing* at 667 rather than a
  feature. `@media (max-height: 700px)` is the switch for that.
- A tall phone should not end with a void above the CTA: `margin-top:
  auto` on the actions block, or a hero that grows with `dvh`, uses the
  height.
- A **short page** (three lines and a button) centers its content or
  pins it to the top by design; it does not stretch a card to fill the
  screen.

## Tablets

- An iPad is not a big phone. Either **center a column** (`max-width:
  34rem`, the same layout as the phone with more margin) or **reflow**
  (hero beside the copy, plan cards in a row) — the design reference
  decides; the column is the safe default when it says nothing.
- Insets are small (24px top, 20px bottom) and a `modal` floats in the
  middle with 0 on every side; the framework sets both, so the phone CSS
  usually just works.
- Tap targets can stay 44px; type does not grow much (cap display at the
  reference size); images do grow, so ship a 2× asset that survives
  834px wide or cap the hero's width.
- `data-sw-idiom="tablet"` on `:root` is the hook for tablet-only rules
  when a media query on width isn't the right question (a narrow iPad
  split view is still a tablet).

## Landscape

Most apps lock portrait; `useDevice().orientation` says which state the
paywall is in, live. Where landscape is allowed:

- **The cutout moves to the sides** and the framework moves the insets
  with it (44/59px on both sides, top 0, bottom 21px), so the paywall's
  padding already clears the camera. Only a full-bleed design
  (`insets: "none"`) has to handle it, with `--sw-safe-area-inset-left`
  and `-right` on the chrome over the bleed.
- Reflow to **two columns** (hero left, copy and CTA right) rather than
  shrinking the portrait layout; the `orientation` example is the
  reference.
- Keep the CTA pinned; in landscape there is even less height, and the
  content scrolls in its column.

## Sheets, drawers and popups

`presentation.style` changes the viewport the paywall lives in, and the
studio shows it that way:

- **`modal`** rises as a sheet below the status bar on phones, so the
  framework's top inset is 0 and the sheet's own grabber sits at the top:
  leave 16–20px above the first element, and don't draw a close button
  where the grabber is unless the design does. On iPad the sheet floats,
  and both insets are 0.
- **`drawer`** takes the height you declared (`drawer.height`, a
  percentage); the paywall's viewport is that drawer, not the screen.
  Design for the declared height and check the tallest locale's copy
  fits or scrolls inside it.
- **`popup`** is centered with the declared width and height and inset by
  the SDK; the framework's insets are 0 and the page is the popup's
  interior.
  No pinned footer with a gradient here — the popup is short enough that
  the CTA is simply the last element.
- **Fullscreen and push** are the full screen: everything in
  [mobile-design.md](mobile-design.md) applies as written.

## Dynamic type and font scale

- The host reports `fontScale` (Android) and
  `preferredContentSizeCategory` (iOS) in `useDevice()`. A paywall does
  not have to honor them — a webview doesn't scale text on its own — but
  a design that wants to should use `rem` for type and scale the root
  with the reported value, clamped to the range the layout survives
  (0.85–1.3 is a safe band).
- Whatever the strategy, the pinned CTA keeps its height and the legal
  text stays legible; if anything gives, it is the hero.

## Locales are a responsive axis

German and Finnish run 30% longer than English; Japanese runs shorter
but taller. The studio's locale switch is part of the size matrix:

- Buttons wrap to two lines rather than clip; set `min-height`, not
  `height`, on every button.
- Plan cards with a price and a period per line need the longest
  formatted price (`$1,299.99/year`) checked, not `$9.99`.
- Never `text-overflow: ellipsis` on a price, a CTA label or a legal
  line.

## The verification matrix

Before hand-off, in the studio, walk every cell. Each takes seconds; a
device bug found after promote takes a release.

| | iPhone SE | 320 wide | Island phone | Pixel / Galaxy | iPad | Landscape\* | Desktop\*\* |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Light | | | | | | | |
| Dark | | | | | | | |
| Longest locale | | | | | | | |
| Configured presentation | | | | | | | |
| Trial toggle (if any) | | | | | | | |

\* where the app allows rotation · \*\* web platforms only

What to look at in each cell: the close/back control against the bar and
cutout, the CTA against the bottom edge, horizontal overflow, the last
content row scrolling clear of the footer, and the unpriced state if the
products aren't resolving.
