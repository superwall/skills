// Reference implementation: the hand-off engine as shipped on Reflective's web2app
// discovery funnel (React + Vite). Copy and adapt: the hand-off names and their
// exits are specific to that funnel's copy (see handoffs.md for why each exists);
// the machinery (pin, settlePrevious, playMorph, fly,
// flyBack, intoBarPath, outOfBarPath, runHandoff) is general; A → B morphs come from morphFrame.ts.
//
// Expects: `FlowHandoff` from your flow types, the data attributes listed in
// engine.md, and navigation that calls runHandoff (engine.md "Navigation wiring").

import { flushSync } from "react-dom";
import type { FlowHandoff } from "@/lib/types";
import { decodedCopy, imageSize, isImageReady, releaseDecoded } from "./imageReady";
import { colorFace, fillFace, glideAt, lerp, morph, MORPH_STEPS, motionBlur, photoFace, roundness } from "./morphFrame";
import type { Box, Face } from "./morphFrame";

/**
 * Story motion for flows with `motion: "story"`: each hand-off between two
 * pages gets its own choreography, tied to what the pair says.
 *
 * The outgoing page is a DOM clone pinned over where it was, animated away
 * here; the incoming page is live and runs its entrance from
 * styles/story-motion.css, keyed on the same hand-off name.
 *
 * Only transform and opacity animate, plus the answer ↔ photo morph's clip
 * (one element) and its 5px blur. Blur on anything large, clip-path and
 * View Transition snapshots re-rasterise every frame, and without GPU raster
 * that drops the flow to ~15fps.
 *
 *   begin    welcome leans back and floats up; the progress bar draws in
 *   kept     plain lift; the answer's flight into the bar (below) carries this one
 *   picture  the chosen price becomes the "investment" image: it travels and opens into it, never shrinking
 *   inward   the big picture sinks back; the recall question rises slowly
 *   slip     the page drifts up and away, like something forgotten
 *   fade     answers leave one by one, each drifting a little further
 *   gone     everything fades to nothing; a beat of emptiness before the image arrives
 *   blank    the image lifts away first, then the words
 *   again    re-explaining: the next page comes from above, back over the same ground
 *   jolt     "something big happens": quick cut, tighter cadence
 *   cadence  answers leave and arrive on an even beat, a pattern
 *   connect  the other answers gather into the chosen one as it opens into the image
 *   settle   the page settles down and away; the honest question arrives calmly
 *   finish   the progress bar completes and hands over to "You're all set"
 *
 * On every question page except picture and connect (whose answers grow into
 * the next image), the chosen answer also becomes the progress it earned: see fly().
 *
 * Back leaves the way the page came, quicker. Keyboard navigation and reduced
 * motion get a plain fade ("plain").
 */

export type HandoffName = FlowHandoff | "default" | "plain";
export type HandoffDirection = "next" | "back";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";

let lastInput: "pointer" | "keyboard" = "pointer";
let listening = false;

function listenForInputKind() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("pointerdown", () => (lastInput = "pointer"), { capture: true, passive: true });
  window.addEventListener("keydown", () => (lastInput = "keyboard"), { capture: true, passive: true });
}

/** Keyboard navigation is repeated and deliberate, and reduced motion asks for less: both get a plain fade. */
export function handoffMode(): "story" | "plain" {
  listenForInputKind();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "plain";
  return lastInput === "keyboard" ? "plain" : "story";
}

type Point = { x: number; y: number };

const q = (root: ParentNode | null, selector: string) => root?.querySelector<HTMLElement>(selector) ?? null;
const qa = (root: ParentNode | null, selector: string) => Array.from(root?.querySelectorAll<HTMLElement>(selector) ?? []);
const centre = (r: DOMRect): Point => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
/** An <img> that hasn't loaded has no height yet: nothing to morph into. */
const loaded = (img: HTMLImageElement | null): boolean => img !== null && img.complete && img.naturalWidth > 0;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// The previous hand-off's leftovers, so a quick second tap can finish it instantly.
let running: Animation[] = [];
// Only what the copies' removal waits for: the copies' own animations and the live destinations'
// REVEAL_UNDER_COPY holds, which end on the same frame. Never the new page's entrances (CSS here, but
// if you move them into script, keep them out of this list): a copy that waits for them sits over
// them for their whole duration, and a full-screen colour frame hid a statement's words that way.
let handovers: Animation[] = [];
let clones: HTMLElement[] = [];
// The progress fill whose CSS transition is paused while an answer carries the bar.
let heldFill: HTMLElement | null = null;

function releaseFill() {
  if (heldFill) heldFill.style.transition = "";
  heldFill = null;
}

function settlePrevious() {
  running.forEach((a) => a.finish());
  running = [];
  handovers = [];
  clones.forEach((c) => c.remove());
  clones = [];
  releaseDecoded();
  releaseFill();
}

/**
 * A copy of `el` pinned where it is on screen, outside the page, for the exit to animate.
 *
 * Every animated copy is position: absolute (at the same screen coordinates; the page itself never
 * scrolls), never fixed: iOS 26 Safari tints its toolbar from a fixed element touching the top edge,
 * so a full-screen fixed morph frame retinted the browser chrome mid-transition. The toolbar-tint
 * sentinel (index.html) must stay the only fixed element.
 */
function pin(el: HTMLElement): HTMLElement {
  const r = el.getBoundingClientRect();
  const clone = el.cloneNode(true) as HTMLElement;
  // A cloned <img> reloads, and Safari paints nothing until it has: swap in the decoded image.
  const originals = el.querySelectorAll("img");
  clone.querySelectorAll("img").forEach((img, i) => img.replaceWith(decodedCopy(originals[i])));
  clone.removeAttribute("data-flow-page");
  clone.setAttribute("aria-hidden", "true");
  clone.setAttribute("data-handoff-clone", "");
  Object.assign(clone.style, {
    position: "absolute",
    left: `${r.left + window.scrollX}px`,
    top: `${r.top + window.scrollY}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    margin: "0",
    zIndex: "30",
    pointerEvents: "none",
  });
  document.body.appendChild(clone);
  clones.push(clone);
  return clone;
}

function animate(el: Element | null | undefined, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  if (!el) return;
  const animation = el.animate(keyframes, { fill: "both", easing: EASE_OUT, ...options });
  running.push(animation);
  if (keyframes === REVEAL_UNDER_COPY || el.closest("[data-handoff-clone]")) handovers.push(animation);
}

/**
 * Every A → B transform (answer → progress bar, answer ↔ photo, bar → answer) runs this long, so
 * one never feels slower than another.
 */
const TRANSFORM_MS = 504;

/**
 * Keyframes that keep a live destination out of sight while its copy transforms into it, and hand
 * over on the last frame: it's at opacity 0.001 throughout, then 1 the moment the animation ends,
 * and the copy is removed in that same frame (see finish()).
 *
 * Why 0.001, not 0: a browser doesn't paint a fully transparent element, so one revealed only on the
 * last frame shows a frame of nothing (a flash). At 0.001 it's already painted, yet adds nothing
 * visible. Why not reveal it early under the copy: many destinations are translucent (a selected
 * answer is 90% primary), and a 90% copy over a 90% element reads as ~99% — the answer darkens for
 * the last stretch, then pops back when the copy goes.
 */
const REVEAL_UNDER_COPY: Keyframe[] = [{ opacity: 0.001 }, { opacity: 0.001 }];
const FLIGHT_MS = TRANSFORM_MS;
// The answer's right edge reaches the bar's end at 55%; the rest is the two growing together.
const JOIN = 0.55;
// Sampled timeline; STEPS * JOIN is whole so a keyframe sits exactly on the join.
const STEPS = 40;

/** Overshoots its target by ~12% and settles back. */
const easeOutBack = (t: number) => {
  const c1 = 2;
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/**
 * The chosen answer becomes the bar's leading edge. Its label fades, and the
 * pill shrinks around its right edge while that edge flies to where the bar
 * currently ends — same colour, same height. On that frame they join, then
 * grow together to the new length: the answer is what pushes the bar
 * forward, not a timer. Going back is its own move, not this one rewound:
 * see flyBack().
 *
 * It rises to the bar's height (shrinking to the bar's size) while drifting
 * left, reaching that height just before the end, so it slides the last
 * stretch level into the bar's end. Once the bar has grown, its edge
 * overshoots a little and settles back.
 */
function fly({
  capsule,
  track,
  fill,
  lo,
  hi,
  answerClone,
}: {
  capsule: DOMRect;
  track: DOMRect;
  fill: HTMLElement;
  /** Progress before this step: where the answer joins the bar. */
  lo: number;
  /** Progress after this step. */
  hi: number;
  answerClone?: HTMLElement;
}) {
  const loX = track.left + track.width * lo;
  const hiX = track.left + track.width * hi;
  // The pill lands as the bar's tip: right edge on the bar's end, one step long (inside the fill).
  const width = Math.max(track.height, Math.min(hiX - loX, loX - track.left));
  const land = new DOMRect(Math.max(track.left, loX - width), track.top, width, track.height);

  const slug = document.createElement("div");
  slug.setAttribute("aria-hidden", "true");
  slug.setAttribute("data-handoff-clone", "");
  Object.assign(slug.style, {
    position: "absolute",
    left: `${land.left + window.scrollX}px`,
    top: `${land.top + window.scrollY}px`,
    width: `${land.width}px`,
    height: `${land.height}px`,
    borderRadius: "999px",
    background: "rgb(var(--color-ui-primary))",
    transformOrigin: "100% 50%",
    zIndex: "31",
    pointerEvents: "none",
  });
  document.body.appendChild(slug);
  clones.push(slug);
  if (answerClone) answerClone.style.transformOrigin = "100% 50%";

  // Everything is placed by its right edge: the answer's, then the bar's.
  const a = { x: capsule.right, y: capsule.top + capsule.height / 2 };
  const b = { x: land.right, y: land.top + land.height / 2 };
  // Both are long thin pills whose proportions track the page width, so this scale stays nearly uniform.
  const sx0 = capsule.width / land.width;
  const sy0 = capsule.height / land.height;
  // Rising and drifting left together, the rise leading, and finishing first: it reaches the bar's
  // height with ~13% of the way left to go, which it covers level, into the bar's end.
  const riseAt = (f: number) => easeInOut(Math.min(1, Math.max(0, f / 0.75)));
  const slideAt = (f: number) => easeInOut(Math.min(1, Math.max(0, f)));

  const slugFrames: Keyframe[] = [];
  const capsuleFrames: Keyframe[] = [];
  const fillFrames: Keyframe[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const p = i / STEPS;
    // f: flight progress (0 = the answer, 1 = joined). g: how far the joined edge has grown (0 = lo, 1 = hi).
    const f = p <= JOIN ? p / JOIN : 1;
    const g = p <= JOIN ? 0 : easeOutBack((p - JOIN) / (1 - JOIN));
    // e: how far it has become the bar's tip (shrinks with the rise).
    const e = riseAt(f);
    const x = a.x + (b.x - a.x) * slideAt(f) + (hiX - loX) * g;
    const y = a.y + (b.y - a.y) * e;
    const sx = Math.pow(sx0, 1 - e);
    const sy = Math.pow(sy0, 1 - e);
    // The capsule is 90% primary, the bar 100%: the pill deepens in flight and is exactly the bar's
    // colour before it joins. Nothing about the bar's colour changes while it grows: the pill stays
    // opaque and is removed once it sits exactly over the fill's identical end.
    const tone = 0.9 + 0.1 * Math.min(1, e / 0.9);
    slugFrames.push({
      offset: p,
      transform: `translate3d(${x - b.x}px, ${y - b.y}px, 0) scale(${sx}, ${sy})`,
      opacity: tone,
    });
    fillFrames.push({ offset: p, transform: `translateX(${(lo + (hi - lo) * g - 1) * 100}%)` });
    if (answerClone) {
      capsuleFrames.push({
        offset: p,
        transform: `translate3d(${x - a.x}px, ${y - a.y}px, 0) scale(${sx / sx0}, ${sy / sy0})`,
        // Its words and fill go first, over the pill.
        opacity: Math.max(0, 1 - p / 0.13),
      });
    }
  }

  animate(slug, slugFrames, { duration: FLIGHT_MS, easing: "linear" });
  animate(fill, fillFrames, { duration: FLIGHT_MS, easing: "linear", fill: "none" });
  if (answerClone) animate(answerClone, capsuleFrames, { duration: FLIGHT_MS, easing: "linear" });
}

/**
 * Going back, the answer comes back out of the bar: not the forward flight rewound (the edge
 * pulling left, then the pill reversing to fly right would be a direction flip mid-motion), but its
 * own physical move that ends, like every arrival, on the A → B clock's long, gentle tail.
 *
 * The pill starts as exactly the stretch of bar this answer earned and takes it with it: the bar
 * gives that stretch up at once, hidden under the pill, and the pill slides out along the bar and
 * drops to the answer, growing into it, on the A → B clock (critically damped: no overshoot, a soft
 * landing), and hands over mid-flight to a copy of the answer travelling the same path; the live
 * answer takes over on the last frame.
 */
function flyBack({
  capsule,
  track,
  fill,
  lo,
  hi,
  answerClone,
  liveAnswer,
}: {
  capsule: DOMRect;
  track: DOMRect;
  fill: HTMLElement;
  /** Progress after this step (where the bar ends once the answer has left it). */
  lo: number;
  /** Progress before this step. */
  hi: number;
  answerClone?: HTMLElement;
  liveAnswer?: HTMLElement;
}) {
  const duration = TRANSFORM_MS;
  const loX = track.left + track.width * lo;
  const hiX = track.left + track.width * hi;
  const seg = new DOMRect(loX, track.top, Math.max(track.height, hiX - loX), track.height);

  const slug = document.createElement("div");
  slug.setAttribute("aria-hidden", "true");
  slug.setAttribute("data-handoff-clone", "");
  Object.assign(slug.style, {
    position: "absolute",
    left: `${seg.left + window.scrollX}px`,
    top: `${seg.top + window.scrollY}px`,
    width: `${seg.width}px`,
    height: `${seg.height}px`,
    borderRadius: "999px",
    background: "rgb(var(--color-ui-primary))",
    transformOrigin: "100% 50%",
    zIndex: "31",
    pointerEvents: "none",
  });
  document.body.appendChild(slug);
  clones.push(slug);
  if (answerClone) answerClone.style.transformOrigin = "100% 50%";

  // Placed by right edges, as going forward: the segment's, then the answer's.
  const b = { x: seg.right, y: seg.top + seg.height / 2 };
  const a = { x: capsule.right, y: capsule.top + capsule.height / 2 };
  const sx0 = capsule.width / seg.width;
  const sy0 = capsule.height / seg.height;
  // Path shape, s = 1 at the bar → 0 at the answer. Across: linear. Down:
  // level for the first quarter (sliding out along the bar), then curving down to arrive at the same
  // rate as it goes across (slope 1 at the answer), so it arrives along its line of travel and a
  // gentle clock stays gentle on screen (a steep final curve would magnify any change in speed).
  const across = (s: number) => s;
  const up = (s: number) => (s >= 0.75 ? 1 : s + 2.6667 * s * s - 2.963 * s * s * s);

  const slugFrames: Keyframe[] = [];
  const copyFrames: Keyframe[] = [];
  let handedOver = false;
  for (let i = 0; i <= MORPH_STEPS; i++) {
    const t = i / MORPH_STEPS;
    const s = 1 - glideAt(t);
    const u = up(s); // 1 = bar-like, 0 = answer-like, < 0 past the answer
    const x = a.x + (b.x - a.x) * across(s);
    const y = a.y + (b.y - a.y) * u;
    // Size grows linearly toward the answer (a multiplicative grow would rush the end of it).
    const sx = 1 + (sx0 - 1) * (1 - u);
    const sy = 1 + (sy0 - 1) * (1 - u);
    const slugAt = `translate3d(${x - b.x}px, ${y - b.y}px, 0) scale(${sx}, ${sy})`;
    const copyAt = `translate3d(${x - a.x}px, ${y - a.y}px, 0) scale(${sx / sx0}, ${sy / sy0})`;
    // The bar's colour, lightening to the capsule's 90% as it becomes the answer.
    const tone = 1 - 0.1 * Math.min(1, Math.max(0, 1 - u));
    // Hand over from the pill to the answer's copy in one frame, not a crossfade: both are translucent,
    // so mid-crossfade they'd cover less than either does alone and the answer would lighten. By 90%
    // of the way the pill is the answer's colour and shape, so the swap is invisible; the label fades
    // in on the copy on its own.
    const past = 1 - s >= 0.9;
    if (past && !handedOver) {
      handedOver = true;
      slugFrames.push({ offset: t, transform: slugAt, opacity: tone });
      copyFrames.push({ offset: t, transform: copyAt, opacity: 0 });
    }
    slugFrames.push({ offset: t, transform: slugAt, opacity: past ? 0 : tone });
    copyFrames.push({ offset: t, transform: copyAt, opacity: past ? 1 : 0 });
  }

  // The bar gives the stretch up at once, under the pill that now carries it: its transition is held
  // (heldFill), so the new length React just rendered applies on this frame.
  animate(slug, slugFrames, { duration, easing: "linear" });
  if (answerClone) {
    animate(answerClone, copyFrames, { duration, easing: "linear" });
    // The label comes back last, on the travelling copy.
    qa(answerClone, "span").forEach((label) => animate(label, [{ opacity: 0 }, { offset: 0.8, opacity: 0 }, { opacity: 1 }], { duration, easing: "linear" }));
  }
  if (liveAnswer) {
    // Hidden while something transforms into it; takes over on the last frame, exactly where the copy ends.
    animate(liveAnswer, REVEAL_UNDER_COPY, { duration, easing: "linear", fill: "backwards" });
  }
}

// The photo's resting corner radius (its rounded-[20px]).
const PHOTO_RADIUS = 20;

/** The stretch of progress bar between two fractions, in screen space (at least as long as it's tall). */
function barSegment(track: DOMRect, from: number, to: number): DOMRect {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return new DOMRect(track.left + track.width * lo, track.top, Math.max(track.height, track.width * (hi - lo)), track.height);
}

/**
 * Any shape into the progress bar exactly the way an answer pill goes (fly()), as a morph path:
 * its right edge flies to where the bar currently ends while it shrinks to the bar's height (rising
 * first, a short level run in); they join, then grow together to the new length, and the edge
 * bounces. Driven through the one-geometry frame, so a big shape (a full-screen colour) never gets
 * stretched: its corners go from its own roundness to a fully round pill. Also returns the bar's
 * keyframes (hold, then grow with the shape).
 */
function intoBarPath(source: DOMRect, sourceRadius: number, track: DOMRect, lo: number, hi: number) {
  const loX = track.left + track.width * lo;
  const hiX = track.left + track.width * hi;
  const width = Math.max(track.height, Math.min(hiX - loX, loX - track.left));
  const land = new DOMRect(Math.max(track.left, loX - width), track.top, width, track.height);
  const a = { x: source.right, y: source.top + source.height / 2 };
  const b = { x: land.right, y: land.top + land.height / 2 };
  const riseAt = (f: number) => easeInOut(Math.min(1, Math.max(0, f / 0.75)));
  const slideAt = (f: number) => easeInOut(Math.min(1, Math.max(0, f)));
  const fromRound = roundness(sourceRadius, source.width, source.height);
  const phase = (t: number) => ({
    f: t <= JOIN ? t / JOIN : 1,
    g: t <= JOIN ? 0 : easeOutBack((t - JOIN) / (1 - JOIN)),
  });
  const path = (t: number): Box => {
    const { f, g } = phase(t);
    const e = riseAt(f); // how far it has become the bar's tip
    const w = Math.exp(lerp(Math.log(source.width), Math.log(land.width), e));
    const h = Math.exp(lerp(Math.log(source.height), Math.log(land.height), e));
    const right = a.x + (b.x - a.x) * slideAt(f) + (hiX - loX) * g;
    return { cx: right - w / 2, cy: a.y + (b.y - a.y) * e, w, h, r: lerp(fromRound, 0.5, e) * Math.min(w, h) };
  };
  const fillFrames: Keyframe[] = Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS;
    return { offset: t, transform: `translateX(${(lo + (hi - lo) * phase(t).g - 1) * 100}%)` };
  });
  return { path, fillFrames, to: land };
}

/**
 * Out of the progress bar into any shape, the way an answer comes back out (flyBack()): the stretch
 * of bar slides out along it, then drops and grows into the shape by its right edge, on the A → B
 * clock (critically damped: a soft landing). Corners go from a fully round pill to the shape's own.
 */
function outOfBarPath(dest: DOMRect, destRadius: number, track: DOMRect, lo: number, hi: number) {
  const seg = barSegment(track, lo, hi);
  const b = { x: seg.right, y: seg.top + seg.height / 2 };
  const a = { x: dest.right, y: dest.top + dest.height / 2 };
  const up = (s: number) => (s >= 0.75 ? 1 : s + 2.6667 * s * s - 2.963 * s * s * s);
  const toRound = roundness(destRadius, dest.width, dest.height);
  const path = (t: number): Box => {
    const s = 1 - glideAt(t);
    const u = up(s); // 1 = bar-like, 0 = the shape
    const w = seg.width + (dest.width - seg.width) * (1 - u);
    const h = seg.height + (dest.height - seg.height) * (1 - u);
    const right = a.x + (b.x - a.x) * s;
    return { cx: right - w / 2, cy: a.y + (b.y - a.y) * u, w, h, r: lerp(0.5, toRound, 1 - u) * Math.min(w, h) };
  };
  return { path, from: seg };
}

/** Runs a Frame A → Frame B morph (morphFrame.ts) as part of this hand-off. */
function playMorph(args: Parameters<typeof morph>[0]) {
  const m = morph(args);
  running.push(...m.animations);
  handovers.push(...m.animations);
  clones.push(m.frame);
  return m;
}

const out = (y: number, scale = 1): Keyframe[] => [
  { transform: "none", opacity: 1 },
  { transform: `translate3d(0, ${y}px, 0) scale(${scale})`, opacity: 0 },
];

export function runHandoff({
  handoff,
  direction,
  update,
}: {
  handoff: HandoffName;
  direction: HandoffDirection;
  update: () => void;
}) {
  settlePrevious();
  if (handoff === "plain") {
    update();
    return;
  }

  const forward = direction === "next";
  const oldPage = q(document, "[data-flow-page]");
  if (!oldPage) {
    update();
    return;
  }

  // Measure the old page, pin a copy of it, then swap the real page underneath.
  const oldOptions = qa(oldPage, "[data-flow-option]");
  const oldSelectedIndex = oldOptions.findIndex((el) => el.hasAttribute("data-selected"));
  const oldSelectedRect = oldSelectedIndex >= 0 ? oldOptions[oldSelectedIndex].getBoundingClientRect() : undefined;
  const oldImage = q(oldPage, "[data-flow-image]");
  const oldImageRect = oldImage?.getBoundingClientRect();
  // Answers become progress, except where they grow into the next page's image or statement colour.
  const intoImage = handoff === "picture" || handoff === "connect";
  const intoScene = intoImage || handoff === "flood";
  // A statement's full-screen colour (FlowRuntime's backdrop): the destination of `flood`, the
  // source of `absorb`. Captured now; it's gone once the page swaps.
  const oldBackdrop = q(document, "[data-flow-backdrop]");
  const oldBackdropRect = oldBackdrop?.getBoundingClientRect();
  const backdropColor = oldBackdrop ? getComputedStyle(oldBackdrop).backgroundColor : "";
  // The answer ↔ photo morph's faces are captured before the page changes (morphFrame.ts). The
  // photo's goes first so it gets the decoded image (the page copy's photo is hidden anyway).
  const photoFaceBack: Face | null = !forward && intoImage && oldImage instanceof HTMLImageElement ? photoFace(oldImage) : null;
  const ghost = pin(oldPage);
  const ghostOptions = qa(ghost, "[data-flow-option]");
  const ghostLines = qa(ghost, "[data-flow-line], [data-next-button]");
  const ghostImage = q(ghost, "[data-flow-image]");
  const answerFace: Face | null =
    forward && intoScene && oldSelectedIndex >= 0 && oldSelectedRect ? fillFace(oldOptions[oldSelectedIndex], oldSelectedRect) : null;
  if (answerFace) ghostOptions[oldSelectedIndex].style.visibility = "hidden";
  if (photoFaceBack && ghostImage) ghostImage.style.visibility = "hidden";
  const fill = q(document, "[data-progress-fill]");
  const fromFraction = Number(fill?.dataset.progress ?? 0);
  const answerFlies = forward && !intoScene && oldSelectedIndex >= 0 && oldSelectedRect !== undefined && fill !== null;
  let answerClone: HTMLElement | undefined;
  if (answerFlies) {
    answerClone = pin(oldOptions[oldSelectedIndex]);
    answerClone.style.zIndex = "32";
    ghostOptions[oldSelectedIndex].style.visibility = "hidden";
  }
  // The bar moves only when something lands in it (or leaves it), so its own transition steps aside.
  if (fill && (answerFlies || handoff === "absorb" || (!forward && !intoScene))) {
    fill.style.transition = "none";
    heldFill = fill;
  }

  flushSync(update);

  const page = q(document, "[data-flow-page]");
  const newImage = q(page, "[data-flow-image]");
  const newSelected = q(page, "[data-flow-option][data-selected]");
  const toFraction = Number(fill?.dataset.progress ?? 0);
  const trackRect = fill?.parentElement?.getBoundingClientRect();

  const finish = () => {
    const done = handovers;
    // A copy only goes once the live photo under it has loaded (at most a second), so the handover
    // never shows a blank frame even if Safari is still loading it.
    const liveImage = newImage instanceof HTMLImageElement && !loaded(newImage) ? newImage : null;
    const photoLoaded = liveImage
      ? Promise.race([
          new Promise<void>((resolve) => liveImage.addEventListener("load", () => resolve(), { once: true })),
          new Promise<void>((resolve) => window.setTimeout(resolve, 1000)),
        ])
      : Promise.resolve();
    Promise.all([...done.map((a) => a.finished), photoLoaded])
      .catch(() => {})
      .finally(() => {
        if (handovers !== done) return;
        // The same frame the live destinations reach full opacity (their REVEAL_UNDER_COPY ends with
        // the transform, and they're already painted), so the swap is exact: no gap, no double layer.
        // `running` keeps the rest, so a quick second tap can still finish it.
        clones.forEach((c) => c.remove());
        clones = [];
        handovers = [];
        releaseDecoded();
        releaseFill();
      });
  };

  if (answerFlies && fill && trackRect && oldSelectedRect) {
    fly({ capsule: oldSelectedRect, track: trackRect, fill, lo: fromFraction, hi: toFraction, answerClone });
  }

  if (!forward && handoff === "absorb" && fill && trackRect) {
    // Back into a statement: the stretch of bar it became grows back out into the full-screen colour.
    // The bar gives the stretch up at once (held), under the frame that starts exactly on it.
    const backdrop = q(document, "[data-flow-backdrop]");
    if (backdrop) {
      backdrop.dataset.morph = "";
      const color = getComputedStyle(backdrop).backgroundColor;
      const dest = backdrop.getBoundingClientRect();
      const { path, from } = outOfBarPath(dest, 0, trackRect, toFraction, fromFraction);
      playMorph({
        from: { rect: from, radius: from.height / 2 },
        to: { rect: dest, radius: 0 },
        faces: { from: colorFace(color), to: colorFace(color) },
        duration: TRANSFORM_MS,
        blur: 0,
        zIndex: 29,
        path,
      });
      animate(backdrop, REVEAL_UNDER_COPY, { duration: TRANSFORM_MS, easing: "linear", fill: "backwards" });
    }
    animate(ghost, out(12), { duration: 160 });
    finish();
    return;
  }

  if (!forward && handoff === "flood" && oldBackdropRect && newSelected) {
    // Back out of a statement: the colour closes back into the answer that opened into it, its own
    // move on the A → B clock; the statement's words fade above it.
    newSelected.dataset.morph = "";
    const r = newSelected.getBoundingClientRect();
    const m = playMorph({
      from: { rect: oldBackdropRect, radius: 0 },
      to: { rect: r, radius: r.height / 2 },
      faces: { from: colorFace(backdropColor), to: fillFace(newSelected, r) },
      duration: TRANSFORM_MS,
      handover: [0.7, 0.94],
      zIndex: 29,
    });
    qa(m.faces.to, "span").forEach((label) => animate(label, [{ opacity: 0 }, { offset: 0.85, opacity: 0 }, { opacity: 1 }], { duration: TRANSFORM_MS, easing: "linear" }));
    animate(newSelected, REVEAL_UNDER_COPY, { duration: TRANSFORM_MS, easing: "linear", fill: "backwards" });
    animate(ghost, out(12), { duration: 160 });
    finish();
    return;
  }

  if (!forward) {
    if (heldFill && fill && trackRect) {
      if (newSelected) {
        // The answer comes back out of the stretch of bar it became.
        newSelected.dataset.morph = "";
        const copy = pin(newSelected);
        copy.style.zIndex = "32";
        flyBack({ capsule: newSelected.getBoundingClientRect(), track: trackRect, fill, lo: toFraction, hi: fromFraction, answerClone: copy, liveAnswer: newSelected });
      } else {
        animate(fill, [{ transform: `translateX(${(fromFraction - 1) * 100}%)` }, { transform: `translateX(${(toFraction - 1) * 100}%)` }], {
          duration: 300,
          fill: "none",
        });
      }
    }
    if (photoFaceBack && oldImageRect && newSelected) {
      // The photo becomes the answer again in one frame (morphFrame.ts): one geometry the whole way,
      // closing into the answer's pill while travelling to it, the answer taking over under the blur
      // and sharpening until the last frame.
      newSelected.dataset.morph = "";
      const r = newSelected.getBoundingClientRect();
      const duration = TRANSFORM_MS;
      const m = playMorph({
        from: { rect: oldImageRect, radius: PHOTO_RADIUS },
        to: { rect: r, radius: r.height / 2 },
        faces: { from: photoFaceBack, to: fillFace(newSelected, r) },
        duration,
        handover: [0.7, 0.94],
      });
      // Its words come back last.
      qa(m.faces.to, "span").forEach((label) => animate(label, [{ opacity: 0 }, { offset: 0.85, opacity: 0 }, { opacity: 1 }], { duration, easing: "linear" }));
      // The live answer takes over under the frame (see REVEAL_UNDER_COPY).
      animate(newSelected, REVEAL_UNDER_COPY, { duration, easing: "linear", fill: "backwards" });

      if (handoff === "connect") {
        // Every answer went into the photo, so every answer comes back out of it, from where the
        // frame is when they start (60% of the way, on the same clock).
        const k = glideAt(0.6);
        const from = {
          cx: lerp(oldImageRect.left + oldImageRect.width / 2, r.left + r.width / 2, k),
          cy: lerp(oldImageRect.top + oldImageRect.height / 2, r.top + r.height / 2, k),
        };
        qa(page, "[data-flow-option]").forEach((el, k) => {
          if (el === newSelected) return;
          el.dataset.morph = "";
          const c = centre(el.getBoundingClientRect());
          animate(
            el,
            [
              { transform: `translate3d(${from.cx - c.x}px, ${from.cy - c.y}px, 0) scale(0.95)`, opacity: 0, filter: `blur(${motionBlur(5)}px)` },
              { offset: 0.55 + k * 0.04, transform: `translate3d(${from.cx - c.x}px, ${from.cy - c.y}px, 0) scale(0.95)`, opacity: 0, filter: `blur(${motionBlur(5)}px)`, easing: EASE_IN_OUT },
              { transform: "none", opacity: 1, filter: "blur(0px)" },
            ],
            { duration, easing: "linear", fill: "backwards" },
          );
        });
      }
      ghostLines.forEach((el) => animate(el, out(12), { duration: 150 }));
    } else {
      // Leave the way the page came in, quicker: re-explaining came from above, so it goes back up.
      animate(ghost, out(handoff === "again" ? -12 : 12), { duration: 160 });
      if (photoFaceBack && ghostImage) ghostImage.style.visibility = "";
    }
    finish();
    return;
  }

  switch (handoff) {
    case "begin":
      animate(
        ghost,
        [
          { transformOrigin: "50% 100%", transform: "perspective(900px) rotateX(0deg)", opacity: 1 },
          { transformOrigin: "50% 100%", transform: "perspective(900px) translate3d(0, -20px, 0) rotateX(22deg) scale(0.97)", opacity: 0 },
        ],
        { duration: 320, easing: EASE_IN_OUT },
      );
      break;

    case "picture":
    case "connect": {
      ghostLines.forEach((el) => animate(el, out(-10), { duration: 180 }));
      // The photo is known if the new <img> has loaded or the flow already decoded it: Safari loads even
      // a cached image a moment after the element is created, so requiring the former alone meant the
      // morph never ran there.
      const photoKnown =
        newImage instanceof HTMLImageElement && (loaded(newImage) || isImageReady(newImage.getAttribute("src") ?? ""));
      if (!(answerFace && oldSelectedRect && photoKnown)) {
        // No morph target (the photo still hasn't loaded): the answers leave, and the photo fades in
        // on its own the moment it arrives.
        if (oldSelectedIndex >= 0) ghostOptions[oldSelectedIndex].style.visibility = "";
        ghostOptions.forEach((el) => animate(el, out(-10), { duration: 180 }));
        if (newImage && !loaded(newImage as HTMLImageElement)) {
          newImage.addEventListener("load", () => newImage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: EASE_OUT }), { once: true });
        }
        break;
      }
      if (!newImage) break;
      // Its CSS entrance is switched off before measuring: the morph is its entrance.
      newImage.dataset.morph = "";
      // Its box is reserved from its known size (WelcomePage sets width/height); if it isn't, derive the
      // height from the decoded image rather than trusting a not-yet-loaded element's zero height.
      const laidOut = newImage.getBoundingClientRect();
      const size = imageSize(newImage.getAttribute("src") ?? "");
      const r =
        laidOut.height >= 1 || !size ? laidOut : new DOMRect(laidOut.left, laidOut.top, laidOut.width, (laidOut.width * size.height) / size.width);
      const duration = TRANSFORM_MS;
      const a = { cx: oldSelectedRect.left + oldSelectedRect.width / 2, cy: oldSelectedRect.top + oldSelectedRect.height / 2 };

      if (handoff === "picture") {
        ghostOptions.forEach((el, k) => k !== oldSelectedIndex && animate(el, out(-10), { duration: 180 }));
      } else {
        // Connect: the other answers gather into the chosen one (never below 95%) as it becomes the photo.
        ghostOptions.forEach((el, k) => {
          if (k === oldSelectedIndex) return;
          const c = centre(el.getBoundingClientRect());
          animate(
            el,
            [
              { transform: "none", opacity: 1, filter: "blur(0px)", easing: EASE_IN_OUT },
              { offset: 0.35, transform: `translate3d(${a.cx - c.x}px, ${a.cy - c.y}px, 0) scale(0.95)`, opacity: 0, filter: `blur(${motionBlur(5)}px)` },
              { transform: `translate3d(${a.cx - c.x}px, ${a.cy - c.y}px, 0) scale(0.95)`, opacity: 0, filter: `blur(${motionBlur(5)}px)` },
            ],
            { duration, easing: "linear", delay: Math.abs(k - oldSelectedIndex) * 30 },
          );
        });
      }

      // The answer becomes the photo in one frame (morphFrame.ts): one geometry the whole way, the
      // photo taking over under the blur and sharpening until the last frame.
      const m = playMorph({
        from: { rect: oldSelectedRect, radius: oldSelectedRect.height / 2 },
        to: { rect: r, radius: PHOTO_RADIUS },
        faces: { from: answerFace, to: photoFace(newImage) },
        duration,
        // Under the motion blur (25–75% of the time): p 0.45–0.75 is ~32–45% of the duration.
        handover: [0.45, 0.75],
      });
      // Its words go first.
      qa(m.faces.from, "span").forEach((label) => animate(label, [{ opacity: 1 }, { offset: 0.15, opacity: 0 }, { opacity: 0 }], { duration, easing: "linear" }));
      // The live photo takes over under the frame (see REVEAL_UNDER_COPY).
      animate(newImage, REVEAL_UNDER_COPY, { duration, easing: "linear", fill: "backwards" });
      break;
    }

    case "flood": {
      // The chosen answer opens into the statement's full-screen colour: the most prominent thing on the
      // next screen, and the answer's own colour. The words arrive on it afterwards (story-motion.css).
      ghostLines.forEach((el) => animate(el, out(-10), { duration: 180 }));
      ghostOptions.forEach((el, k) => k !== oldSelectedIndex && animate(el, out(-10), { duration: 180 }));
      const backdrop = q(document, "[data-flow-backdrop]");
      if (!(answerFace && oldSelectedRect && backdrop)) break;
      backdrop.dataset.morph = "";
      const m = playMorph({
        from: { rect: oldSelectedRect, radius: oldSelectedRect.height / 2 },
        to: { rect: backdrop.getBoundingClientRect(), radius: 0 },
        faces: { from: answerFace, to: colorFace(getComputedStyle(backdrop).backgroundColor) },
        duration: TRANSFORM_MS,
        handover: [0.45, 0.75],
      });
      qa(m.faces.from, "span").forEach((label) => animate(label, [{ opacity: 1 }, { offset: 0.15, opacity: 0 }, { opacity: 0 }], { duration: TRANSFORM_MS, easing: "linear" }));
      animate(backdrop, REVEAL_UNDER_COPY, { duration: TRANSFORM_MS, easing: "linear", fill: "backwards" });
      break;
    }

    case "absorb": {
      // The statement's colour collapses into the stretch of progress bar this step earns: the
      // statement becomes progress (the progress-bar exception to the size floor). Its words leave
      // first, above the colour, one after another; the bar takes the stretch as the colour lands.
      ghostLines.forEach((el, k) => animate(el, out(-10), { duration: 180, delay: k * 40 }));
      if (!(oldBackdropRect && fill && trackRect)) break;
      const { path, fillFrames, to } = intoBarPath(oldBackdropRect, 0, trackRect, fromFraction, toFraction);
      playMorph({
        from: { rect: oldBackdropRect, radius: 0 },
        to: { rect: to, radius: to.height / 2 },
        faces: { from: colorFace(backdropColor), to: colorFace(backdropColor) },
        duration: FLIGHT_MS,
        blur: 0,
        zIndex: 29,
        path,
        steps: STEPS,
      });
      // The bar holds until the colour's edge reaches it, then grows with it (the same as a pill).
      animate(fill, fillFrames, { duration: FLIGHT_MS, easing: "linear", fill: "none" });
      break;
    }

    case "inward":
      animate(ghost, out(8, 0.92), { duration: 320 });
      break;

    case "slip":
      animate(ghost, out(-28), { duration: 380 });
      break;

    case "fade":
      ghostLines.forEach((el) => animate(el, out(-8), { duration: 200 }));
      ghostOptions.forEach((el, k) => animate(el, out(-6 - k * 3), { duration: 220, delay: 40 + k * 60 }));
      break;

    case "gone":
      animate(ghost, out(0, 0.98), { duration: 300 });
      break;

    case "blank":
      animate(ghostImage, out(-16), { duration: 200 });
      ghostLines.forEach((el) => animate(el, out(-8), { duration: 160, delay: 60 }));
      break;

    case "again":
      animate(ghost, out(14), { duration: 200 });
      break;

    case "jolt":
      animate(ghost, out(0, 0.98), { duration: 120 });
      break;

    case "cadence":
      ghostLines.forEach((el) => animate(el, out(-8), { duration: 160 }));
      ghostOptions.forEach((el, k) => animate(el, out(-10), { duration: 160, delay: k * 50, easing: "linear" }));
      break;

    case "settle":
      animate(ghost, out(20), { duration: 320 });
      break;

    case "finish":
      animate(ghost, out(-12), { duration: 220 });
      break;

    default:
      animate(ghost, out(-12), { duration: 180 });
  }

  finish();
}
