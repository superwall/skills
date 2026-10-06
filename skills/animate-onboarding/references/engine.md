# The hand-off engine

## In the superwall framework

The framework's router already does half of what the generic engine below
builds by hand. `references/framework/` is the engine ported onto it, as
shipped in the `animated-onboarding` example (`superwall create --example
animated-onboarding`): start from those files, and read the rest of this
document for the parts that are the same everywhere (the moving parts, loaded
destinations, handing over, traps).

- **No outgoing clone.** Every page is an absolutely positioned layer inside
  `[data-sw-routes]`, and the page being left stays mounted, carrying
  `data-sw-phase="recede"` (going forward) or `"leave"` (going back), for as
  long as the animation declared on its layer runs (capped at 5s). The
  router measures that on the layer element itself, so give the layer a
  silent hold of the hand-off's length and key everything else on the
  phase:

  ```css
  [data-sw-route][data-sw-transition^="story-"][data-sw-phase] {
    animation: story-hold var(--story-ms) linear;   /* opacity 1 → 1 */
  }
  [data-sw-phase="recede"] [data-flow-page] [data-flow-line] { animation: story-out … }
  [data-sw-phase="enter"]  [data-flow-page] [data-flow-line] { animation: story-in … }
  ```

  `--story-ms` must outlast every exit, every entrance delay plus duration,
  and the transform (504ms): once the phase clears, a still-running entrance
  is cut. Shared elements (the chosen answer, the bar, a photo, a
  statement's colour) are the only things the script animates.
- **The hand-off name is the transition name**, prefixed: `export const
  transition = "story-picture"` on the page being entered (`framework/flow.ts`
  maps route → hand-off → progress fraction → image). Going forward the router
  uses the incoming page's transition, going back the leaving one's, so the
  pair plays in reverse on the way back for free: the entry carries the name
  it was pushed with. Wrap every story rule in `@media
  (prefers-reduced-motion: no-preference)`; with reduced motion the wrapper
  asks the router for `fade` and nothing of yours runs.
- **Swap synchronously, then measure.** `router.push(name)` is a React state
  update; the destination mounts on the next render. `runHandoff` measures
  the leaving page, wraps the push in `flushSync` so the new page exists to
  measure in the same frame as the tap, then plays the transforms across
  both (`framework/handoffs.ts`, `framework/useStoryRouter.ts`):

  ```ts
  const oldPage = document.querySelector('[data-sw-state="active"] [data-flow-page]');
  const answer = oldSelected.getBoundingClientRect();        // before
  flushSync(() => router.push("insight", { transition: "story-picture" }));
  const photo = document.querySelector('[data-sw-state="active"] [data-flow-image]');
  morph({ from: { rect: answer, … }, to: { rect: photo.getBoundingClientRect(), … }, mount: layer });
  ```

  Wait for the destination's image first exactly as below (`whenImageReady`);
  a newer tap cancels the wait.
- **Copies are pinned inside a motion layer in the layout**, never
  `position: fixed` (the framework forbids fixed: it ignores the insets and
  rides along during transitions). `layout.tsx` renders an empty
  `<div data-motion-layer>` (`position: absolute; inset: 0; z-index: 30;
  pointer-events: none`) after the pages; every copy, pill and morph frame
  goes in there at `rect - layerRect` (`morphFrame.ts` takes it as `mount`).
  The page layers are an isolated stacking context, so the layer is always
  above them.
- **Persistent chrome is `layout.tsx`.** The progress bar, back button and
  close render there once and survive every navigation, which is what makes
  "the answer becomes the bar" possible; the layout reads `useRouter().name`
  to set the bar's fraction (`data-progress` on the fill, read by the script)
  and to invert the chrome on a statement (`data-tone="inverse"`).
- **Pages stay mounted behind the next one**, which is the point (the chosen
  answer is still there to hand back out of the bar) and a trap: component
  state survives too. A question's commit lock must release when the page
  regains focus (`useIsFocused()` from `superwall/navigation`,
  `framework/Question.tsx`), or the user can never re-answer after going
  back. The script hides the live answer under its copy with `visibility`
  and restores it when the copies go, never removes it.
- **Only the first page gates on `paywall_open`.** Its entrance runs when
  `useSuperwallSnapshot().paywall !== undefined`; every later page's
  entrance is a router phase and runs on a tap, so it needs no gate.
- **The flag.** On a web funnel, `useQueryState("m")` (short key; the URL is
  the state there); natively, a constant or a placement param from
  `useVariables()`. `"classic"` turns the choreography off: push with the
  built-in `shift` and skip the story CSS.
- **State** is the answers module (`components/answers.ts`) plus
  `setUserAttributes` the moment an answer is tapped; the router carries
  none.

Everything below describes the same engine inside a hand-rolled web
runtime (`references/web-runtime/handoffs.ts`, `story-motion.css`), which
has no router and so clones the outgoing page itself. **On a surface, never
do that**: the router is the page swapper, and a clone, a custom router or
a `position: fixed` copy is the wrong build. Read on for the parts that are
the same everywhere (the moving parts, loaded destinations, handing over,
statement screens, traps), with "the clone" read as "the leaving page".

## The same engine in a hand-rolled web runtime (not for surfaces)

A page change in a tap-through flow is one moment: the old page leaves, the new
page arrives. The engine splits it cleanly:

- **Outgoing page:** a DOM clone of the old page, pinned (`position: absolute`
  at its screen coordinates, never `fixed`: see "The browser's toolbar tint"
  below) exactly where it was, animated away with WAAPI, removed when done.
- **Incoming page:** the real, live page. Its entrance is plain CSS keyed on
  the hand-off name, so it also works if the script does nothing.
- **Shared elements** (the chosen answer, the progress bar, a photo) are
  animated by the script across both.

Don't use the View Transitions API for this. Its snapshots smear morphs,
stretch shapes, and re-composite a full-page image every frame (see
`performance.md`). A clone is cheaper and fully controllable.

## Data model

```ts
// On the flow: opt in, so other flows keep their motion.
type Flow = { id: string; pages: Page[]; motion?: "story" };

// On each page: how it hands off to the next one (and back).
type FlowHandoff = "begin" | "kept" | "picture" | "inward" | "slip" | "fade" | "gone"
  | "blank" | "again" | "jolt" | "cadence" | "connect" | "settle" | "finish";
type Page = { pageId: string; type: string; props: object; handoff?: FlowHandoff };
```

Going forward, the page being **left** names the hand-off. Going back, the page
being **returned to** names it (and the pair plays in reverse).

Keep a URL override to turn it off (`?motion=classic`), read once on mount and
reserved so it doesn't leak into flow state. That's the A/B lever.

## Mark the moving parts

Data attributes, not new components:

| Attribute | On |
|---|---|
| `data-flow-page` | the keyed page container (remounts per page) |
| `data-flow-line` | title, subtitle, eyebrow, body |
| `data-flow-option` | each answer; plus `data-selected` when chosen |
| `data-committing` | answers, during the short auto-advance pause after a tap |
| `data-flow-image` | the page's photo |
| `data-next-button` | the primary button |
| `data-progress`, `data-progress-fill` | the bar wrapper and its fill (fill carries its fraction: `data-progress="0.35"`) |
| `data-morph` | set by the script on a live element it animates itself (disables its CSS entrance) |

### Roles, declared up front

Every element gets the standard entrance by default, so every element that is
**transformed from** something on the previous page (see the element map in
SKILL.md) needs an explicit exemption, or its entrance competes with the
morph. Don't leave that to a `dataset.morph = ""` line remembered inside each
morph's script: declare the destinations per hand-off and direction in CSS,
from the element map, so they're off from the new page's first frame.

```css
/* forward: the chosen answer becomes the photo */
[data-motion="story"][data-flow-transition="flow-next"]:is([data-handoff="picture"], [data-handoff="connect"]) [data-flow-page] [data-flow-image],
/* back, picture: only the chosen answer comes out of the photo; the others return from nothing */
[data-motion="story"][data-flow-transition="flow-back"][data-handoff="picture"] [data-flow-page] [data-flow-option][data-selected],
/* back, connect: every answer went into the photo, so every answer comes back out */
[data-motion="story"][data-flow-transition="flow-back"][data-handoff="connect"] [data-flow-page] [data-flow-option] {
  animation: none;
}
```

Derive each selector from the map, element by element: here the unchosen
answers on the price page left on their own going forward, so going back they
*enter from nothing* and keep the standard entrance; exempting them too would
leave them popping in with no motion at all.

Keep setting `data-morph` in the script as well, as a backstop and to mark what
it's animating. Then check the map against the code for every hand-off in both
directions.

The reference code once missed this: going back through `connect`, only the
chosen answer came out of the photo while the others, which had gathered into
it going forward, ran the standard entrance. It now brings every answer back
out of the photo; check for the same slip in any new morph.

The runtime's section carries `data-motion="story"`,
`data-flow-transition="flow-next|flow-back|flow-idle"`, and
`data-handoff="<name>|default|plain"`.

## Navigation wiring

Wrap the state changes of next/back in the hand-off, so the old DOM is measured
and cloned before React swaps it:

```ts
const IMAGE_WAIT_MS = 400;
const token = useRef(0);   // the latest navigation; one still waiting for its image is dropped

const handOff = (pair: FlowHandoff | undefined, direction: "next" | "back", destinationId: string, apply: () => void) => {
  const mine = ++token.current;
  if (!story) return apply();
  const name = handoffMode() === "plain" ? "plain" : pair ?? "default";
  const run = () => {
    if (mine !== token.current) return;
    runHandoff({ handoff: name, direction, update: () => { setHandoff(name); apply(); } });
  };
  // A morph needs its destination image decoded (see "Loaded destinations"). Ready = same frame as the tap.
  const image = getPage(destinationId)?.props.image;
  if (name === "plain" || !image || isImageReady(image)) return run();
  void whenImageReady(image, IMAGE_WAIT_MS).then(run);
};

// goNext — the URL is written inside apply, so a dropped navigation never touches it
handOff(currentPage.handoff, "next", nextId, () => { setState(next); setDirection("next"); setHistory(h); setPageId(nextId); writeFlowUrl(/* … */); });
// goBack
handOff(getPage(previousId)?.handoff, "back", previousId, () => { setDirection("back"); setHistory(h.slice(0, -1)); setPageId(previousId); });
// popstate (browser back/forward, iOS swipe): token.current++ and setHandoff("plain") — the system already animates.
```

`handoffMode()` returns `"plain"` for reduced motion and when the last input
was a key (listen to `pointerdown`/`keydown` in the capture phase).

## Loaded destinations

An `<img>` that hasn't loaded has no height, so a morph into it measures a
zero-size target and animates a blank copy. `imageReady.ts`:

- **Warm and decode** every image in the flow when it opens (`warmImage`), and
  hold the `Image` objects for the session (a bare `new Image()` can be
  dropped before it decodes).
- **Wait briefly**: before a hand-off into a page with an image, `isImageReady`
  → run now; otherwise `whenImageReady(src, 400)` then run. A newer tap, a back
  press or browser navigation during the wait supersedes it.
- **Fall back**: if the image isn't known when the hand-off runs, skip the
  morph — the source leaves normally — and fade the image in on its `load`
  event.

**Safari** loads even a cached image asynchronously when a new `<img>` is
created, so right after the swap the new element reports not-loaded with zero
height. Chrome doesn't, which is why this only breaks on phones:

- Gate the morph on the flow's decoded copy (`isImageReady(src)`), not on the
  new element (`img.complete`): gated on the element, the morph never runs on
  an iPhone.
- Reserve the box from the known size, so the rect is right before it paints:
  ```tsx
  const size = imageSize(src); // natural size once warmed
  <img data-flow-image src={src} width={size?.width} height={size?.height} className="w-full" />
  ```
- Build copies from the decoded `Image` object (`decodedCopy(img)`), never
  `img.cloneNode()` (a clone reloads and paints blank for its first frames).
  One DOM node can only be in one place, so each decoded image is claimed by
  one copy at a time and released when the hand-off ends. And because it's
  reused, reset it to an exact stand-in every time (the original's attributes
  and nothing else): a morph face leaves it stretched to fill its frame, and a
  page copy that inherits that shows the photo filling the whole page.
- Keep the morph frame on top until the live image has actually loaded (max
  ~1s), then remove it.
- Mark readiness on the `load` event; older Safari rejects `decode()` for
  images outside the document.

## runHandoff skeleton

```ts
let running: Animation[] = [];          // everything, so a quick second tap can finish it
let handovers: Animation[] = [];        // only what the copies' removal waits for (see "Handing over")
let clones: HTMLElement[] = [];
let heldFill: HTMLElement | null = null;

function settlePrevious() {            // a quick second tap never waits
  running.forEach((a) => a.finish());
  running = [];
  handovers = [];
  clones.forEach((c) => c.remove());
  clones = [];
  if (heldFill) heldFill.style.transition = "";
  heldFill = null;
}

function pin(el: HTMLElement) {        // clone pinned over the original
  const r = el.getBoundingClientRect();
  const c = el.cloneNode(true) as HTMLElement;
  c.removeAttribute("data-flow-page"); // so CSS entrance selectors don't match it
  c.setAttribute("aria-hidden", "true");
  c.setAttribute("data-handoff-clone", "");
  // Absolute, never fixed: iOS 26 Safari tints its toolbar from a fixed element at the top.
  Object.assign(c.style, { position: "absolute", left: `${r.left + scrollX}px`, top: `${r.top + scrollY}px`,
    width: `${r.width}px`, height: `${r.height}px`, margin: "0", zIndex: "30", pointerEvents: "none" });
  document.body.appendChild(c);
  clones.push(c);
  return c;
}

export function runHandoff({ handoff, direction, update }) {
  settlePrevious();
  if (handoff === "plain") return update();
  const oldPage = document.querySelector<HTMLElement>("[data-flow-page]");
  if (!oldPage) return update();

  // 1. Measure the old page (selected answer, image, bar fraction) and pin a clone.
  // 2. Pin the chosen answer separately if it will fly; hide its copy inside the page clone.
  // 3. If the bar will be carried by the answer, pause its CSS transition (heldFill).
  flushSync(update);                   // 4. Swap the real page underneath, synchronously.
  // 5. Measure the new page (image, selected answer, bar fraction, track rect).
  // 6. Play: the pair's exit on the clone, flights/morphs across both.
  // 7. When the handovers have finished (and no newer hand-off started): remove clones, release the bar.
  //    Not when *every* animation has: the new page's entrances play under the copies.
}
```

## Entrances: one keyframe, variables per hand-off

```css
[data-motion="story"] {
  --in-ms: 420ms; --in-delay: 70ms; /* a beat after the exit starts: pages barely overlap */
  --in-y: 14px; --in-scale: 1;
  --line-gap: 60ms; --opt-lead: 100ms; --stagger: 40ms; --img-lead: 120ms; --btn-lead: 180ms;
}
[data-motion="story"][data-flow-transition="flow-idle"] { --in-delay: 0ms; }

@keyframes story-in {
  from { opacity: 0; transform: translate3d(0, var(--in-y), 0) scale(var(--in-scale)); }
}

[data-motion="story"] [data-flow-page] :is([data-flow-line], [data-flow-option], [data-flow-image], [data-next-button]) {
  animation: story-in var(--in-ms) var(--ease-out) backwards;
}
/* delays by position: lines at --in-delay + n·--line-gap, answers at + --opt-lead + n·--stagger
   (nth-child rules), image + --img-lead, button + --btn-lead */
[data-motion="story"] [data-flow-page] [data-morph] { animation: none; }

/* A hand-off is just overrides, e.g.: */
[data-motion="story"][data-flow-transition="flow-next"][data-handoff="gone"] {
  --in-delay: 420ms; --in-ms: 600ms; --in-y: 0px; --in-scale: 1.03;
}
[data-motion="story"][data-flow-transition="flow-back"] { --in-ms: 300ms; --in-y: -10px; --stagger: 25ms; }
[data-motion="story"][data-handoff="plain"] { --in-ms: 200ms; --in-delay: 0ms; --in-y: 0px; --stagger: 0ms; }
@media (prefers-reduced-motion: reduce) { [data-motion="story"][data-handoff] { --in-y: 0px !important; /* … all motion vars zeroed */ } }
```

Use `backwards` fill for entrances: once landed, press and selection styles own
the element again.

**The commit beat:** during the auto-advance pause after a tap, the other
answers step back (`[data-committing]:not([data-selected]) { opacity: 0.4 }`),
so the tap is visibly heard before the page moves. Mirror that rule for
`[data-handoff-clone]` so the leaving copy keeps it.

## The progress bar markup

```tsx
<div data-progress className={hidden ? "opacity-0" : "opacity-100"}>
  <div className="h-1 w-full overflow-hidden rounded-full bg-ink/10">   {/* the track clips the fill */}
    <div
      data-progress-fill
      data-progress={fraction}                                        // read by the script
      className="h-full w-full rounded-full bg-primary transition-transform duration-300"
      // Slides in instead of scaling, so its rounded end stays round (matches the flying pill).
      style={{ transform: `translateX(${(fraction - 1) * 100}%)` }}
    />
  </div>
</div>
```

## The commit beat, in the selection component

```ts
// In the group that owns auto-advance: flag the pause between tap and page change.
setCommitting(true);
timeout = setTimeout(() => {
  onAutoAdvance(value);
  setTimeout(() => setCommitting(false), 800); // only matters if the page couldn't advance
}, 200);
// Each answer renders: data-flow-option, data-selected={selected || undefined}, data-committing={committing || undefined}
```

## Handing over to the live element

The transforming copies carry the destination the whole way; the live element
must never fade in over them (it appears twice). Keep it invisible but
painted for the whole transform, and swap on the last frame:

```ts
// 0.001, not 0: a browser doesn't paint a fully transparent element, so one held at 0 and shown on the
// last frame paints a frame of nothing (a flash). At 0.001 it's painted, and invisible.
const REVEAL_UNDER_COPY: Keyframe[] = [{ opacity: 0.001 }, { opacity: 0.001 }];
live.animate(REVEAL_UNDER_COPY, { duration: TRANSFORM_MS, easing: "linear", fill: "backwards" });

// Remove the copies in the same frame the live element returns to full opacity: when the copies'
// own animations and these holds (which end together) have finished, and the live photo has loaded.
// No gap, no double layer.
Promise.all([...handovers.map((a) => a.finished), photoLoaded]).finally(() => {
  clones.forEach((c) => c.remove());
  releaseDecoded();
});
```

**Remove each copy when its own transform ends, never when the whole
hand-off ends.** Keep two lists: `running` (everything, so `settlePrevious()`
can finish it on a fast tap) and `handovers` (the copies' animations plus the
live destinations' `REVEAL_UNDER_COPY` holds). Cleanup waits on `handovers`
and the photo's load, nothing else. A copy that waits for the new page's
entrances sits over them for their whole duration: with a full-screen colour
frame on top, the statement's words stayed hidden for ~1s and then just
appeared. The reference's entrances are CSS, so they're never in either list;
if you move entrances into script (WAAPI), this is the contract that breaks.

**Nothing enters under a covering copy.** The frame is above the live page
until it hands over at `TRANSFORM_MS`, so an entrance that starts earlier
plays unseen and pops in mid-fade when the frame goes. Anything arriving on a
full-screen colour (its words, the inverted header and button) starts after it.

## The browser's toolbar tint (iOS 26)

iOS 26 Safari ignores `theme-color`. It tints its toolbars from a
`position: fixed` element touching the top edge (within ~4px, 80%+ of the
width, 3px+ tall, with its own background colour), else from the page. A
full-screen colour moving in retints the chrome mid-transition. Pin it:

```html
<!-- index.html, before the app root. Keep the theme-color metas for Chrome and older Safari. -->
<div class="chrome-tint" aria-hidden="true"></div>
```

```css
/* The only fixed element: Safari always tints from it, so full-screen colours never retint the chrome. */
.chrome-tint {
  position: fixed; top: 0; left: 0; right: 0; height: 4px;
  z-index: 2147483647; pointer-events: none;
  background-color: rgb(var(--color-ui-bg));
}
```

Then every animated copy, morph frame and flying pill is `position: absolute`
at `rect + scroll` (the page itself doesn't scroll, so it's the same as
fixed). To check on a phone, make the sentinel red: the toolbar should turn
red and hold through every transition.

## Statement screens: a full-screen colour as its own layer

```tsx
// FlowRuntime: the colour is a layer behind the page, not the page's background, so a hand-off can
// morph into and out of it as one element. data-tone flips the header and button onto it.
<section data-motion="story" data-tone={page.type === "statement" ? "inverse" : undefined} className="relative …">
  {page.type === "statement" && <div data-flow-backdrop aria-hidden="true" className="absolute inset-0 bg-ui-primary" />}
  …
</section>
```

```tsx
// StatementPage: the words, centred, each a line so they arrive (and leave) one after another.
<div className="my-auto">
  <p data-flow-line className="text-ui-bg/70">{eyebrow}</p>        {/* "Did you know…" */}
  <h1 data-flow-line className="text-[34px] text-ui-bg">{title}</h1>
  {body && <p data-flow-line className="text-ui-bg/80">{body}</p>}
</div>
```

```css
/* Inverse tone: header, back, skip, progress and button switch once the colour has arrived. */
[data-tone="inverse"] :is(h2, [data-back-button], [data-skip-button]) { color: rgb(var(--color-ui-bg)); }
[data-tone="inverse"] [data-progress] > div { background-color: rgb(var(--color-ui-bg) / 0.3); }
[data-tone="inverse"] [data-progress-fill] { background-color: rgb(var(--color-ui-bg)); }
[data-tone="inverse"] [data-next-button] { background-color: rgb(var(--color-ui-bg)); color: rgb(var(--color-ui-primary)); }
[data-motion="story"][data-tone="inverse"] :is(h2, [data-back-button], [data-progress] > div) {
  transition: color 160ms var(--ease-out) 504ms, background-color 160ms var(--ease-out) 504ms;
}
/* The words arrive once the colour has filled the screen and its frame has handed over (504ms). */
[data-motion="story"][data-flow-transition="flow-next"][data-handoff="flood"],
[data-motion="story"][data-flow-transition="flow-back"][data-handoff="absorb"] { --in-delay: 540ms; --in-y: 10px; }
[data-motion="story"][data-flow-transition="flow-next"][data-handoff="absorb"] { --in-delay: 200ms; }
```

The hand-offs: `flood` (answer → backdrop, and back) and `absorb` (backdrop →
progress bar like a pill, and back). Recipes in `handoffs.md`.

## Traps

- **`fill: "both"` on a live, persistent element freezes it.** A finished
  WAAPI animation with forwards fill overrides every later style change. Use
  `fill: "none"` for the progress fill/track, `fill: "backwards"` for live
  incoming elements; keep `"both"` only for clones that get removed. On the
  router the leaving page is live too (it comes back on Back): an exit the
  script plays on its own elements is parked (`park()` in
  `framework/handoffs.ts`: `forwards` until the hand-off is over, then
  cancelled), and a cancelled animation is skipped when the next tap settles
  the previous hand-off, or `finish()` would replay its end frame.
- **Measure after disabling the CSS entrance.** Set `data-morph` on a live
  element *before* `getBoundingClientRect()`, or you measure it mid-entrance
  and the morph lands a few pixels off, then snaps.
- **Keyframe mid-points stall motion.** Two eased segments meeting at a pinned
  transform both decelerate into the pin. Put waypoints for other properties
  (blur, opacity) on keyframes without `transform`; per-property intervals then
  skip them.
- **Sampled paths.** For anything with its own physics (the answer's flight),
  compute ~40 keyframes in JS and animate them `linear`. Make `STEPS × JOIN`
  a whole number so a keyframe lands exactly on the join frame.
- **The progress fill's transition** must step aside (`transition: none`)
  while the script carries the bar, and be restored when the hand-off ends.
