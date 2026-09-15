# The layout system — exactly how a paywall is laid out

Read this before positioning anything, and again when something sits
under a status bar, scrolls when it shouldn't, or jumps during a page
transition. Everything here is what the framework actually renders, so
it is what to check against, not a convention.

## The DOM the framework renders

```
html  .dark|.light  data-sw-platform  data-sw-idiom  data-sw-cutout  data-sw-presentation
│     style="--sw-inset-top: …"        ← only the edges `insets` in config sets
└ body
  └ #root
    └ [data-sw-root]                   ← THE INSET BOX. flex column, min-height: 100dvh,
      │                                   padding: --sw-inset-top/right/bottom/left,
      │                                   background: --sw-background
      └ [data-sw-content]              ← position: relative; flex column; flex: 1 1 auto.
        │                                 The containing block for absolute chrome.
        └ <Layout>                     ← your app/layout.tsx, if any. A flex child.
          └ [data-sw-routes]           ← the page stack: position: relative; overflow: hidden;
            │                             flex: 1 1 auto; min-height: --sw-routes-height (auto);
            │                             margin: the NEGATIVE --sw-page-inset-* — it reaches
            │                             back out under the insets, to the screen edges
            └ [data-sw-route]          ← ONE PER PAGE. position: absolute; inset: 0;
              │                           padding: --sw-page-inset-* (= the insets);
              │                           overflow: auto. THE SCROLL CONTAINER — edge to
              │                           edge, with the inset as its scroll padding
              └ <Page />               ← your app/<name>.tsx
```

Six consequences, each the answer to a common bug:

1. **The viewport is never yours.** `[data-sw-root]` is the one element
   sized to the viewport. Anything of yours with `min-height: 100dvh`
   (or `100vh`, `100svh`) is taller than the space inside the insets and
   makes the whole paywall scroll by the inset amount. A layout's shell
   is `flex: 1 1 auto`; a page fills its route with `min-height: 100%`
   (the route is absolutely positioned, so its height is definite).
2. **Pages scroll, the document does not.** The scroll container is
   `[data-sw-route]`, not `window`/`body`. `window.scrollTo` and
   `document.documentElement.scrollTop` do nothing; scroll the route
   (`el.closest("[data-sw-route]")`) or use `scrollIntoView`. Each page
   keeps its own scroll position when covered. `scrollEnabled: false` in
   config is applied by the platform stylesheet; do not fake it with
   `overflow: hidden` on `html`/`body`.
3. **Insets are applied once, and pages scroll under them.** The root is
   padded by the insets and the page stack reaches back out under them,
   so each page's scroll container runs edge to edge and carries the
   inset as its own padding — the way a native scroll view runs under
   the bars with a content inset. Content scrolls beneath the status bar
   and the home indicator and rests clear of them; nothing you render
   sits under a bar at rest unless you put it there. The moment you add
   `env()` or `--sw-inset-*` to a page or a layout, that edge is padded
   twice.
4. **Sticky honours the scroll container's padding.** `position: sticky;
   bottom: 0` in a page sticks at the inset, above the home indicator,
   while the content scrolls under it to the screen edge. `top: 0` sticks
   below the status bar. No inset arithmetic on the sticky element.
5. **`[data-sw-content]` is what absolute chrome positions against.**
   Absolute positioning resolves against the nearest positioned ancestor's
   *padding* edge; the framework makes that ancestor the box that starts
   *after* the insets, so `position: absolute; top: 4px` in a layout is
   4px below the bar with no positioned ancestor of your own.
6. **A page is its own positioning world during a transition.** The
   router animates `[data-sw-route]` with `transform` and `filter`, and a
   transformed element becomes the containing block for *fixed*
   descendants too. Fixed chrome inside a page therefore rides along with
   the page while it moves and snaps to the viewport when the animation
   ends. That is why fixed positioning has no place inside a page.

## Positioning: what each value resolves against

| You write | It resolves against | Use it for | Never for |
| --- | --- | --- | --- |
| `position: absolute` in `layout.tsx` | `[data-sw-content]` — the inset area | close/back buttons, step counters, a pinned footer shared by every page | — |
| `position: absolute` in a page | the page's own positioned wrapper, or the route's padding box (which **scrolls with the content**) | overlays on a card, badges | pinning anything to the screen |
| `position: sticky` in a page | the route's scrollport minus the route's padding — the inset area, while the content scrolls under the bars | a pinned CTA that content scrolls under, a header that content scrolls under | — |
| `position: fixed` anywhere | the viewport, **ignoring the insets** (and the moving page, during a transition) | nothing in a paywall. Chrome portaled to `body` (the checkout sheet does this) is the only case | close buttons, footers, anything inside a page |
| a flex child of the layout below `[data-sw-routes]` | the layout's column | a footer that pages must not overlap (legal links, "Built with"), with `--sw-page-inset-bottom: 0px` on `:root` so the pages stop at it | — |

Two things follow from the fixed row. First, if something is under the
status bar or the home indicator, it is either `position: fixed`, on an
edge `insets` turned off, or pulled there with a negative margin: those
are the only three ways. Second, when a design *does* bleed under the
bar (`insets: { top: "none" }`), the chrome over the bleed stays
`position: absolute` in the layout and reads the safe area itself:
`top: calc(var(--sw-safe-area-inset-top) + 8px)`. Not `env()`, which is
0 in previews and on Android. Not `--sw-inset-top`, which is the padding
you just turned off.

## Insets — the three settings and their precedence

| Layer | Set by | What it is |
| --- | --- | --- |
| `--sw-inset-*` | `insets` in `config.ts` (written inline on `<html>`), else your `:root` CSS, else the framework default | **The padding on the root.** Default: the safe area. |
| `--sw-page-inset-*` | the framework (= `--sw-inset-*`); override on `:root` per edge | **How far each page's scroll container reaches back under the insets, and its scroll padding.** Set an edge to `0px` when the layout puts something of its own between the pages and that edge (a footer below them): the pages then stop at it. |
| `--sw-bleed` / `--sw-page-bleed` | the framework | The four negative insets in `inset:` order. An overlay that must cover the bars writes `position: absolute; inset: var(--sw-bleed)` in a layout, or `var(--sw-page-bleed)` inside a page's positioned wrapper. |
| `--sw-safe-area-inset-*` | the framework; override on `:root` only to correct it | **The safe area**: `max(env(safe-area-inset-*), floor)`. What chrome over a bleed reads. |
| `--sw-safe-area-floor-*` | the framework from `data-sw-*`; override on `:root` to teach it a device | The minimum for the host's platform, screen, presentation and orientation. Never shrinks a real `env()`. |

Precedence per edge, highest first: config (inline style) → your
unlayered `:root` rule → the framework's own `:root` defaults (declared before
your stylesheet, so yours win by order; the floors use `:root:where(…)`). An edge
config leaves at `"safe-area"` is untouched inline, so CSS can still set
it; an edge config sets cannot be changed from CSS without `!important`.
Pick one per edge.

```ts
insets: "safe-area"                          // default
insets: "none"                               // flush everywhere — the paywall draws the whole screen
insets: 24                                   // 24px everywhere (a web-only paywall with a fixed gutter)
insets: { top: "none" }                      // a hero under the status bar; other edges stay safe
insets: { left: "1.25rem", right: "1.25rem" } // any CSS length, per edge
```

```css
:root[data-sw-platform="android"] { --sw-inset-top: 32px; }   /* one platform's padding (edge not set in config) */
:root { --sw-safe-area-floor-top: 62px; }                      /* a taller floor, env() still live */
:root { --sw-page-inset-bottom: 0px; }                         /* the layout owns the bottom: pages stop above its footer */
```

### When to turn an edge off — and when not to

The default is right for almost every screen: content scrolls under the
bars and rests clear of them, chrome sits inside them, a sticky CTA sits
above the home indicator. Turn an edge off (`"none"`) only when something
must **rest** under the bar, not merely scroll under it:

- A hero image or video whose top edge is the screen edge
  (`insets: { top: "none" }`), with a scrim so the clock stays legible
  and the close button reading `--sw-safe-area-inset-top`.
- Full-screen art or an onboarding animation that fills the display
  (`insets: "none"`).
- A bottom CTA block with its own edge-to-edge background that should
  reach the screen edge (`insets: { bottom: "none" }`, and the block pads
  itself with `calc(var(--sw-safe-area-inset-bottom) + 12px)`).

Never turn an edge off to fix scrolling, a cut-off footer, or a white
band under the content — those were symptoms of insets that shrank the
scroll area, and the pages now reach under the insets on their own.
`modal`, `drawer` and `popup` presentations and web funnels already have
the edges the platform gives them; do not touch them. Prefer `insets` in
config to a `:root` override for the same edge, so the setting is visible
next to the products and presentation.

### The floors

The safe area is the host's `env()` wherever it reports one — an iPhone
reports the exact value for the phone in hand — and the floor wherever it
reports nothing: the studio, Android WebView (no `env()` for system
bars), and the odd webview. The floor is a minimum per class, keyed on
the attributes the framework stamps on `<html>`:

| Host (`data-sw-platform` · `data-sw-cutout`/`idiom` · `data-sw-presentation`) | top | bottom | sides |
| --- | --- | --- | --- |
| ios · island · fullscreen | 59 | 34 | 0 |
| ios · notch · fullscreen | 44 | 34 | 0 |
| ios · none (home button) · fullscreen | 20 | 0 | 0 |
| ios · island/notch · landscape | 0 | 21 | 59/44 both sides |
| ios · tablet · fullscreen | 24 | 20 | 0 |
| ios · phone · modal or drawer | 0 (sheet starts below the bar) | 34 (island/notch), 0 (home button) | 0 |
| ios · tablet · modal or drawer | 0 | 0 (the sheet floats) | 0 |
| android · fullscreen | 24 (drawn under the status bar) | 0 (the SDK margins the webview above the nav bar) | 0 |
| android · modal or drawer | 0 (sheet starts below the bar) | 0 (SDK pads it) | 0 |
| any · popup | 0 | 0 | 0 (the SDK insets it) |
| web | 0 | 0 | 0 (the browser owns its chrome) |

`push` and `noAnimation` are fullscreen. The attributes come from the
device the host reports and are absent, never guessed, until the host's
first message; the studio sets them per preset, so switching devices
there moves the insets. The value on an actual iPhone is `env()`, so a
16 Pro shows 62 on device and 59 in the studio — that 3px is why chrome
sits at inset *plus* spacing.

## Recipes

**Close button** (`layout.tsx`):

```css
.close { position: absolute; top: 4px; right: 16px; }
```

**Pinned CTA that content scrolls under** (last child of the page):

```css
.page   { display: flex; flex-direction: column; min-height: 100%; padding: 16px 20px 0; }
.footer { position: sticky; bottom: 0; margin-top: auto; padding: 24px 0 12px;
          background: linear-gradient(to bottom, transparent, var(--bg) 32px); }
```

`bottom: 0` sticks at the inset, above the home indicator, because the
scroll container's padding is the inset; the content behind it scrolls
on to the screen edge. `pointer-events: none` on the gradient region
only if the fade is a separate element; a sticky footer that is the
button itself needs no pointer tricks. On Android the bottom inset is 0,
so the 12px is what lifts it off the edge. Never `bottom: calc(-1 *
var(--sw-inset-bottom))` or a negative margin to "reach" the edge — the
route already does.

**A footer every page must stay above** (legal links, "Built with"): a
plain flex child of the layout after `{children}`, and
`:root { --sw-page-inset-bottom: 0px; }` so the pages stop at it instead
of reaching under it. The footer then sits above the home indicator on
the root's own padding; nothing overlaps; nothing to position.

**A scrim or sheet inside the paywall that must cover the bars** (an
exit offer, a confirmation): absolute in the layout with
`inset: var(--sw-bleed)`; inside a page's positioned wrapper,
`inset: var(--sw-page-bleed)`. The variables are the four negative
insets, so there is nothing to calculate.

**Full-bleed hero under the status bar**:

```ts
insets: { top: "none" }
```

```css
.close { position: absolute; top: calc(var(--sw-safe-area-inset-top) + 8px); right: 16px; }
.hero::after { /* scrim so the bar's clock stays legible in both schemes */ }
```

**Bottom sheet or drawer** (`presentation.style: "modal" | "drawer"`):
top inset is 0 because the sheet already starts below the bar; leave
16–20px above the first element for the grabber. A drawer's viewport is
the drawer's height, not the screen.

**Web funnel**: every inset is 0 and the browser draws its own bars;
the root's `100dvh` already tracks Safari's collapsing toolbar. Design
the page to scroll; don't chase the toolbar.

**Turning it off for one platform** without touching the others:
leave that edge out of config and set it in CSS with the platform
attribute, as above.

## Debugging, in order

Run these in the studio's devtools (or on device via Safari/Chrome
remote inspector) before changing any CSS:

1. `document.documentElement.dataset` → are `swPlatform`, `swIdiom`,
   `swCutout`, `swPresentation` what you expect? Missing platform means
   the host hasn't replied yet (or the device variables have no
   `platform`); a wrong presentation means `config.ts` and what you are
   testing disagree.
2. `getComputedStyle(document.querySelector("[data-sw-root]")).padding`
   → the insets actually applied. Compare to the floor table. The same
   values are the padding of `[data-sw-route]`, whose rect should be
   the full viewport: if it stops short of an edge, something set
   `--sw-page-inset-*` for that edge, or a layout element sits there.
3. `document.documentElement.style.cssText` → what `insets` in config
   wrote inline. If an edge is there, CSS cannot move it.
4. **Under the bar?** It is `position: fixed`, on an edge you turned
   off, or negatively margined. Search the stylesheet for `fixed`,
   `env(`, and `margin-top: -`.
5. **Double gap at the top?** Something adds the inset again: `env(`,
   `--sw-inset-`, or a page padding that was tuned for a preview without
   insets. The root already did it.
6. **The whole paywall scrolls a little, or the footer is cut off?** An
   element of yours is `100dvh`/`100vh` tall, or a sticky footer was
   given a negative `bottom` to reach the edge (it now sticks under the
   home indicator — use `bottom: 0`), or the layout isn't a flex
   column so the routes collapsed (`[data-sw-routes]` height 0 → set
   `--sw-routes-height`, or make the shell `display: flex; flex: 1 1 auto;
   flex-direction: column`).
7. **Chrome jumps during a transition?** It is fixed and inside a page.
   Move it to `layout.tsx` (absolute) or make it sticky in the page.
8. **Right on iPhone, wrong on Android?** Android has no bottom inset
   (the SDK keeps the webview above the nav bar) and its top floor is
   24px; a design tuned to 34px of bottom air needs its own padding, and
   a cutout phone can have a taller bar than 24 — that is what the
   spacing above the first element absorbs.
9. **Right in the studio, wrong on device (or vice versa)?** On an
   iPhone the value is the real `env()`, in the studio it is the floor;
   they differ by a few px on the tallest bars. On Android the floor is
   the value on device too, and it is the platform's standard 24px bar:
   a cutout phone whose bar is taller shows chrome closer to the bar than
   the studio did, which is what the spacing above the first element is
   for. The studio's Android presets draw the bar at 24px and reserve the
   navigation bar below the paywall like the SDK does, so what you see
   is what the floors assume. If the two differ by a lot, the attributes
   in step 1 differ between the two.
