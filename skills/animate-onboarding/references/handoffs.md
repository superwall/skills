# Hand-offs

Each hand-off is (a) the leaving page's exit, CSS keyed on the router's
`recede` / `leave` phase, (b) CSS variable overrides for the arriving
page's entrance on `enter` / `return`, and (c) the shared-element flights
the script plays across both. Pick per pair from what the two pages say.
Below: the two signature moves, then the catalog that shipped on a 15-page
discovery funnel.

The complete, working code for everything here is in
`framework/handoffs.ts` (the script: `fly()` answer → bar, `flyBack()` bar →
answer, the `picture` / `connect` / `flood` / `absorb` cases), `morphFrame.ts`
(`morph()`, the faces, `glideAt()` the A → B clock) and
`framework/motion.css` (every exit and entrance of the whole catalog below,
on the router's phases). The example flow names six of them; name any other
on a page (`export const transition = "story-slip"`) and it plays, both ways.
The excerpts below explain the parts; the web-runtime copies in
`web-runtime/` do the same with a cloned page because that runtime has no
router.

Shared helpers:

```ts
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => { const c1 = 2; return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2; }; // ~13% overshoot
const out = (y: number, scale = 1): Keyframe[] => [
  { transform: "none", opacity: 1 },
  { transform: `translate3d(0, ${y}px, 0) scale(${scale})`, opacity: 0 },
];
```

## The A → B clock

Every A → B transform runs on one clock, so its stacked phases share one
continuous speed. It's a **critically damped spring** (damping 1.0: no
overshoot) chasing a target that eases in from rest after a ~1% pull-back: top
speed early (~27%), then a long, continuously slowing tail. No constant-speed
middle, no bounce at the end, at rest at both ends.

```ts
const TRANSFORM_MS = 504;   // every A → B transform, so none feels slower
const CLOCK_RAMP = 0.25;    // the target eases in over the first quarter
const CLOCK_OMEGA = 9;      // spring stiffness, per transition length
const CLOCK_PULL = 0.6;     // → ~1% pull-back
const CLOCK_TAPER = 0.12;   // the last 12% eases the tail exactly onto the target
function buildClock(samples = 1200): Float64Array {
  const smoother = (u) => { const k = Math.min(1, Math.max(0, u)); return k * k * k * (k * (k * 6 - 15) + 10); };
  const table = new Float64Array(samples + 1);
  let x = 0, v = 0; const dt = 1 / samples;
  for (let i = 0; i <= samples; i++) {
    const s = smoother((i * dt) / CLOCK_RAMP);
    const target = s - CLOCK_PULL * Math.sin(Math.PI * s) * (1 - s);   // dips a hair, then eases to 1
    table[i] = x;
    v += (CLOCK_OMEGA ** 2 * (target - x) - 2 * CLOCK_OMEGA * v) * dt; // ζ = 1: critically damped
    x += v * dt;
  }
  const end = table[samples];
  for (let i = 0; i <= samples; i++) { const y = table[i] / end; table[i] = y + (1 - y) * ease01(i / samples, 1 - CLOCK_TAPER, 1); }
  return table;
}
// glideAt(t): look up (and interpolate) the table; see morphFrame.ts.
```

Measured against the previous curve (a smooth-step ease to a 1.5% overshoot
at 82%): near top speed 13% of the time instead of 23%, no overshoot instead
of 1.5% past at 75%, braking in the last quarter 2.1 instead of 5.8.

Sample it into keyframes (~30 samples, `easing: "linear"`) and derive every
channel from its value `p`: position on `p`, size and corners on `p^1.5`
(sign kept, for the pull-back), the crossfade on a smoothstep window of `p`.
The blur runs on plain time `t` instead: it's motion blur, crisp at both ends
and blurred from 25% to 75% of the duration, and the swap is placed inside
that window.

## Signature move 1: the answer becomes the progress

Runs on every question page going forward (unless the answer morphs into an
image instead). Going back has its own move (below). Timeline:
`TRANSFORM_MS`; the answer joins the bar at 55%, the rest is the two growing
together with the bounce.

1. Pin a copy of the chosen answer in the layout's motion layer; hide the live one (`visibility: hidden`, restored when the copies go).
2. Create a **slug**: a plain div, `border-radius: 999px`, the bar's exact
   colour, positioned at the **landing rect**: the bar's height, one step
   long, right edge on the bar's *current* end (inside the filled part).
   `transform-origin: 100% 50%`. Put the answer copy on the same origin.
3. Sample the flight. Everything is placed by its **right edge**:
   `a` = the answer's right-centre, `b` = the landing rect's right-centre.

```ts
const FLIGHT_MS = TRANSFORM_MS, JOIN = 0.55, STEPS = 40; // STEPS * JOIN is whole: a keyframe sits on the join
const loX = track.left + track.width * lo, hiX = track.left + track.width * hi;
const w = Math.max(track.height, Math.min(hiX - loX, loX - track.left));
const land = new DOMRect(Math.max(track.left, loX - w), track.top, w, track.height);
const a = { x: capsule.right, y: capsule.top + capsule.height / 2 };
const b = { x: land.right, y: land.top + land.height / 2 };
const sx0 = capsule.width / land.width, sy0 = capsule.height / land.height; // both long thin pills: ~uniform
// Rise and drift together; the rise leads and finishes first (≈87% across), then a short level entry.
const riseAt = (f: number) => easeInOut(Math.min(1, Math.max(0, f / 0.75)));
const slideAt = (f: number) => easeInOut(Math.min(1, Math.max(0, f)));

for (let i = 0; i <= STEPS; i++) {
  const p = i / STEPS;
  // f: flight (0 = answer, 1 = joined). g: joined edge's growth (0 = lo, 1 = hi).
  const f = p <= JOIN ? p / JOIN : 1;
  const g = p <= JOIN ? 0 : easeOutBack((p - JOIN) / (1 - JOIN));
  const e = riseAt(f);                                    // also how far it has shrunk to bar size
  const x = a.x + (b.x - a.x) * slideAt(f) + (hiX - loX) * g;
  const y = a.y + (b.y - a.y) * e;
  const sx = sx0 ** (1 - e), sy = sy0 ** (1 - e);
  const tone = 0.9 + 0.1 * Math.min(1, e / 0.9);          // capsule is 90% primary; bar colour before it joins
  slugFrames.push({ offset: p, transform: `translate3d(${x - b.x}px, ${y - b.y}px, 0) scale(${sx}, ${sy})`, opacity: tone });  // never fades over the bar
  fillFrames.push({ offset: p, transform: `translateX(${(lo + (hi - lo) * g - 1) * 100}%)` });
  answerFrames.push({ offset: p, transform: `translate3d(${x - a.x}px, ${y - a.y}px, 0) scale(${sx / sx0}, ${sy / sy0})`,
                      opacity: Math.max(0, 1 - p / 0.13) }); // its label and fill go in the first ~13%
}
// slug + answer copy: linear, fill "both" (they're removed). Fill: linear, fill "none". Transition paused meanwhile.
```

### Going back: `flyBack()`, not a rewind

Rewinding the flight means the bar's edge pulls left, then the pill reverses
to fly right: a direction flip mid-motion. Instead the pill starts as exactly
the stretch of bar the answer earned and **takes it with it**: the bar gives
that stretch up at once (its transition held, so React's new length applies
under the pill), and the pill slides out along the bar and drops and grows
into the answer on the A → B clock, landing on its long gentle tail.

```ts
const s = 1 - glideAt(t);                          // 1 at the bar → 0 at the answer
const across = (s) => s;                           // linear
const up = (s) => (s >= 0.75 ? 1 : s + 2.6667 * s * s - 2.963 * s * s * s);
// Level for the first quarter (sliding out along the bar), then curving down to arrive at slope 1,
// so it arrives along its line of travel and a gentle clock stays gentle on screen.
const u = up(s);                                   // 1 = bar-like, 0 = answer, < 0 past it
const sx = 1 + (capsule.width / seg.width - 1) * (1 - u);    // linear grow: doesn't rush the end
```

A pinned copy of the answer (with its label) travels the same path at the
same shape; the pill crossfades into it at 70–90% of the clock, the label
returns over the last 20%, and the live answer takes over on the last frame
(held at `opacity: 0.001` until then, so it's already painted).

Rules this encodes (each was a correction):
- one timeline drives the flight *and* the bar;
- the 80% size floor doesn't apply here: the answer has to shrink to become a 4px stretch of bar;
- right edge to the bar's current end, then grow together;
- rise leads, short level entry, no hugging the right side;
- bounce after growing;
- the fill slides (`translateX`) so its round end matches the slug's; the slug
  stays opaque and is removed while it sits exactly over the fill's end, so
  nothing changes colour;
- no height change on the bar, ever.

## Signature move 2: A → B morphs, one frame, two faces

Every element-into-element transform (an answer into the next page's hero, a
button into a photo, an answer into a background) goes through `morph()` in
`morphFrame.ts`. It builds **one** frame that owns all of the geometry, and A
and B are faces inside it that only crossfade, so they share one geometry at
every moment by construction:

```
outer   absolute at `home` (the larger end; never fixed), no transform — the blur, in screen px
  middle  — translate to the box's centre, scale only *up* (never squashes)
    clipper — clip-path: inset(... round r), the box's size and corners: the only outline
      face A — fills the clipper, no shape of its own; opacity only
      face B — fills the clipper, no shape of its own; opacity only, on top
```

The box comes from `boxAt(a, b, glideAt(t))`: position on the clock, size and
corners on `p^1.5`, the 20% bubble dip for a dimension equal at both ends,
never below 80% of the smaller end. Corners are **proportional**: the radius
is interpolated as a fraction of the box's shorter side (`roundness()`: 0.5 =
fully round ends), from A's roundness to B's, so a pill opening into a square
full-screen colour stays visibly round while it's big and only squares off at
the end. A custom `path` (below) replaces `boxAt` for moves that aren't a
plain A → B, like going into the progress bar. B fades in on top over the `handover`
window while A stays opaque beneath (the frame never goes see-through). The
blur is motion blur on the frame: crisp at both ends, blurred from 25% to 75%
of the duration (easing in 25–35%, full 5px 35–65%, easing out 65–75%), and the
handover sits inside it, so the swap happens under the blur.

### The faces

```ts
photoFace(img)          // the decoded image, object-fit: cover over the frame — exactly how it sits at rest
fillFace(el, restRect)  // el's colour fills the whole frame; a copy of its content sits where el rests
colorFace(color)        // a plain colour: backgrounds, colour blocks
```

A face must never have a shape of its own: no border-radius, border, margin,
shadow or transform (they're stripped), or it reintroduces a second geometry.
`fillFace` and `photoFace` capture their element immediately, so create the
source's face **before** the page swaps.

### Recipe: chosen answer → next page's hero image

```ts
// before the page swaps
const answerRect = answerEl.getBoundingClientRect();
const answer = fillFace(answerEl, answerRect);
ghostAnswer.style.visibility = "hidden";            // its copy in the leaving page
flushSync(update);                                  // swap the page
// after
const photoEl = page.querySelector("[data-flow-image]");
photoEl.dataset.morph = "";                         // its CSS entrance is off: the morph is its entrance
const photoRect = photoEl.getBoundingClientRect();  // reserved box (width/height attrs), so it's right
const m = morph({
  from: { rect: answerRect, radius: answerRect.height / 2 },
  to: { rect: photoRect, radius: 20 },
  faces: { from: answer, to: photoFace(photoEl) },
  duration: TRANSFORM_MS,
  handover: [0.45, 0.75],                           // ~32–45% of the time: under the motion blur
});
m.faces.from.querySelectorAll("span").forEach((l) => l.animate([{ opacity: 1 }, { offset: 0.15, opacity: 0 }, { opacity: 0 }], { duration: TRANSFORM_MS }));
photoEl.animate(REVEAL_UNDER_COPY, { duration: TRANSFORM_MS, easing: "linear", fill: "backwards" });
// when the handovers (the frame's animations and this hold) and the live photo's load are done,
// in that same frame: m.frame.remove(). Not when the new page's entrances are (engine.md).
```

### Recipe: hero image → answer (going back)

Its own move on the same clock, landing on its gentle tail — not the forward
one reversed:

```ts
const photoRect = oldPhoto.getBoundingClientRect();
const photo = photoFace(oldPhoto);                  // before the swap
flushSync(update);
answerEl.dataset.morph = "";
const answerRect = answerEl.getBoundingClientRect();
const m = morph({
  from: { rect: photoRect, radius: 20 },
  to: { rect: answerRect, radius: answerRect.height / 2 },
  faces: { from: photo, to: fillFace(answerEl, answerRect) },
  duration: TRANSFORM_MS,
  handover: [0.7, 0.94],                            // ~43–65% of the time: under the motion blur
});
m.faces.to.querySelectorAll("span").forEach((l) => l.animate([{ opacity: 0 }, { offset: 0.85, opacity: 0 }, { opacity: 1 }], { duration: TRANSFORM_MS }));
answerEl.animate(REVEAL_UNDER_COPY, { duration: TRANSFORM_MS, easing: "linear", fill: "backwards" });
```

### Recipe: continue button → hero image

Same as the answer recipe with the button as A (lowest-priority source: use it
when nothing was chosen on the page):

```ts
const button = fillFace(continueEl, continueRect);  // before the swap
morph({ from: { rect: continueRect, radius: continueRect.height / 2 }, to: { rect: photoRect, radius: 20 },
        faces: { from: button, to: photoFace(photoEl) }, duration: TRANSFORM_MS });
```

### Recipe: chosen answer → a background that ties to it (`flood`)

When the next screen's most demanding element is a background in the answer's
colour (a "Did you know…" statement), the answer opens into it. The background
is its own full-screen layer (`[data-flow-backdrop]`, see `engine.md`), so it's
one element to morph into; the statement's words arrive ~540ms later, on it
(just after the frame hands over: an entrance under it would play unseen).

```ts
const answer = fillFace(answerEl, answerRect);      // before the swap
flushSync(update);
const backdrop = document.querySelector("[data-flow-backdrop]");
backdrop.dataset.morph = "";
const m = morph({
  from: { rect: answerRect, radius: answerRect.height / 2 },  // roundness 0.5
  to: { rect: backdrop.getBoundingClientRect(), radius: 0 },   // square: only at the very end
  faces: { from: answer, to: colorFace(getComputedStyle(backdrop).backgroundColor) },
  duration: TRANSFORM_MS,
  handover: [0.45, 0.75],
});
m.faces.from.querySelectorAll("span").forEach((l) => l.animate([{ opacity: 1 }, { offset: 0.15, opacity: 0 }, { opacity: 0 }], { duration: TRANSFORM_MS }));
backdrop.animate(REVEAL_UNDER_COPY, { duration: TRANSFORM_MS, easing: "linear", fill: "backwards" });
```

Back: the colour (captured before the swap as `colorFace(color)`) closes into
the answer's `fillFace`, handover `[0.7, 0.94]`, the answer's words last, the
same as the photo → answer recipe.

### Recipe: a full-screen colour → the progress bar (`absorb`)

The statement's colour goes into the bar **exactly like an answer pill**
(signature move 1): its right edge flies to where the bar ends as it shrinks
to a bar-height pill (rising first), joins at 55%, grows together with the
bar to the new length, and bounces. It runs through the one-geometry frame
with a custom `path`, so the big rectangle is never stretched: its corners go
from its own roundness to a fully round pill.

```ts
// Before the swap: the backdrop's rect and colour (it's gone once the page swaps). Hold the bar's transition.
const { path, fillFrames, to } = intoBarPath(backdropRect, 0, trackRect, fromFraction, toFraction);
morph({
  from: { rect: backdropRect, radius: 0 },
  to: { rect: to, radius: to.height / 2 },
  faces: { from: colorFace(color), to: colorFace(color) },
  duration: FLIGHT_MS,
  blur: 0,                 // one colour, nothing to smear
  zIndex: 29,              // under the leaving words
  path,                    // (t) => Box: replaces boxAt
  steps: STEPS,            // STEPS * JOIN whole, so a keyframe lands on the join
});
fill.animate(fillFrames, { duration: FLIGHT_MS, easing: "linear", fill: "none" }); // holds, then grows with it
// The words leave first, one after another, above the colour: out(-10), 180ms, 40ms apart.
```

`intoBarPath` is the pill flight generalised to any rect: width and height
interpolate in log space toward the landing pill (so a huge shape doesn't
race), the rise leads (`f / 0.75`), the slide eases in-out to the join, then
the right edge travels `(hi - lo) · easeOutBack(g)` with the fill.

Back (`outOfBarPath`): the bar gives up the stretch at once (held), and the
frame starts exactly on it, slides out along the bar, drops and grows into
the full-screen colour by its right edge on the A → B clock, corners from 0.5
to the backdrop's own. The backdrop is held at 0.001 and takes over on the
last frame; the statement's words arrive after.

### Recipe: many answers → one image (`connect`)

The other answers gather into the chosen one (translate to its centre, never
below 95%, 5px blur, fade, 30ms apart), and the chosen one morphs into the
photo exactly as in the first recipe. Going back, **every** answer comes back
out of the photo: the chosen one via the reverse recipe, the others emerging
from where the frame is at 60% of the clock.

### A new kind of face

Anything else can be a face as long as it **fills the frame and has no shape
of its own**: a function `(home) => HTMLElement` returning an absolutely
positioned element at `inset: 0`, `width/height: 100%`, no radius, border,
margin, shadow or transform. Place inner content in the frame's local
coordinates (centred at the element's rest size, scaled by `1/k` if that rest
size is larger than `home`), as `fillFace` does.

### Checklist

- One `morph()` per A → B. Never two layers.
- The frame starts exactly on A's rect/radius and ends exactly on B's.
- A's face is created before the page swaps; B's live element has its CSS
  entrance off (`data-morph` / declared in CSS) and is held at `opacity:
  0.001` until the last frame, when the copy is removed.
- Corners are proportional (a fraction of the shorter side), not pixels.
- The frame is `position: absolute`, never fixed (the iOS 26 toolbar tint).
- Faces fill the frame and have no shape of their own.
- Blur is motion blur on the frame: crisp at both ends, 5px from 25% to 75%
  of the duration, with the handover inside that window.
- All A → B morphs share one duration (`TRANSFORM_MS`).

## Catalog (a 15-page discovery funnel)

| Hand-off | Pair (from → to) | Exit (the leaving page, on `recede` / `leave`) | Entrance (overrides) | Why |
|---|---|---|---|---|
| `begin` | welcome → first question | `perspective(900px) translateY(-20px) rotateX(22deg) scale(.97)`, fade, 320ms, origin bottom — **the model A → nothing**: physics (it tips back like a card) | `--in-delay: 140ms; --in-ms: 520ms`; bar fades in and slides from 0 | the journey starts; progress appears |
| `kept` | question → question | lines and other answers lift 10px, 180ms | default | the answer → bar flight carries it |
| `picture` | price → "biggest investment" | lines/other answers lift; the chosen answer morphs | the photo *is* the morph (signature move 2) | the price *is* the investment |
| `inward` | explainer → "can you remember…" | `out(8, 0.92)`, 320ms | `--in-delay: 160ms; --in-ms: 600ms; --in-y: 24px` | big picture → looking back inward |
| `slip` | recall → "lost a breakthrough" | `out(-28)`, 380ms | `--in-delay: 180ms; --in-ms: 560ms; --in-y: 0; --in-scale: .98` | the page is forgotten, drifts off |
| `fade` | breakthrough → "how long do insights stay" | answers leave one by one, `out(-6 - 3k)`, 60ms apart | `--in-delay: 260ms` | memories fading over time |
| `gone` | → "gone within a day" | `out(0, 0.98)`, 300ms | `--in-delay: 420ms; --in-ms: 600ms; --in-y: 0; --in-scale: 1.03` | fade to nothing, a beat, then it settles |
| `blank` | "gone" → "what did we talk about" | photo lifts first `out(-16)`, words 60ms later | `--in-delay: 160ms` | the mind goes blank |
| `again` | → "re-explaining" | `out(14)` (down) | `--in-y: -16px` (from above); going back, the previous page rises from below | going back over the same ground |
| `jolt` | → "something big happens" | `out(0, .98)`, 120ms | `--in-ms: 240ms; --in-y: 0; --in-scale: .96; --stagger: 25ms` | tension: faster cuts |
| `cadence` | → "name your pattern" | answers leave 50ms apart, linear | answers `scale(.94)` on a 70ms beat | the hand-off forms a pattern |
| `connect` | pattern → "patterns are invisible" | the others gather into the chosen answer | it opens into the photo (signature move 2) | many weeks → one view |
| `flood` | answer → "Did you know…" statement | lines/other answers lift; the chosen answer opens into the full-screen colour | words `--in-delay: 540ms` (after the frame hands over); header and button invert after the colour lands | the answer *becomes* the moment |
| `absorb` | statement → next question | words leave one by one, above the colour | the colour goes into the bar like a pill; `--in-delay: 200ms` | the statement becomes progress |
| `settle` | explainer → "be honest" | `out(20)` (settles down) | `--in-delay: 200ms; --in-ms: 680ms; --in-y: 10px; --stagger: 70ms` | the calmest, most honest moment |
| `finish` | last question → done | `out(-12)`, 220ms | `--in-delay: 380ms`; bar holds full ~200ms after its bounce, then fades | the bar you watched completes |
| back (all) | — | `out(12)`, 160ms (the way it came, quicker) | `--in-ms: 300ms; --in-y: -10px; --stagger: 25ms` | spatial consistency |
| `plain` | keyboard, browser nav, reduced motion | none | 200ms fade, no stagger | frequent or system-animated |
