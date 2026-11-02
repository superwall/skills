// The hand-off engine on the superwall framework's router.
//
// What the router already does: every page is an absolute layer inside [data-sw-routes]; the page
// being left stays mounted with data-sw-phase="recede" (forward) or "leave" (back) for as long as
// the animation declared on it runs, and the arriving page carries "enter" or "return". So there is
// no clone of the leaving page here: its exit and the new page's entrance are CSS in motion.css,
// keyed on the transition name (`story-<handoff>`) and the phase. This script does only what CSS
// can't: the shared elements that travel BETWEEN the two pages — the chosen answer flying into the
// progress bar (fly / flyBack), an answer opening into the next page's photo or into a statement's
// full-screen colour, and that colour collapsing into the bar (morphFrame.ts, one frame two faces).
//
// Copies are pinned inside the layout's motion layer ([data-motion-layer], position: absolute over
// the content box), never position: fixed: the framework's insets rule, and on a web funnel the
// iOS 26 toolbar-tint sentinel must stay the only fixed element.
//
// Only transform and opacity animate, plus the morph frame's clip-path and its 5px motion blur, on
// one element at a time.

import { flushSync } from "react-dom";
import type { Handoff } from "../flow";
import { decodedCopy, imageSize, isImageReady, releaseDecoded } from "./imageReady";
import {
  colorFace,
  fillFace,
  glideAt,
  lerp,
  morph,
  MORPH_STEPS,
  motionBlur,
  photoFace,
  roundness,
} from "./morphFrame";
import type { Box, Face } from "./morphFrame";

export type HandoffName = Handoff | "plain";
export type HandoffDirection = "next" | "back";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";

let lastInput: "pointer" | "keyboard" = "pointer";
let listening = false;

function listenForInputKind() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("pointerdown", () => (lastInput = "pointer"), {
    capture: true,
    passive: true,
  });
  window.addEventListener("keydown", () => (lastInput = "keyboard"), {
    capture: true,
    passive: true,
  });
}

/** Keyboard navigation is repeated and deliberate, and reduced motion asks for less: both get a plain fade. */
export function handoffMode(): "story" | "plain" {
  listenForInputKind();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "plain";
  return lastInput === "keyboard" ? "plain" : "story";
}

type Point = { x: number; y: number };

const q = (root: ParentNode | null, selector: string) =>
  root?.querySelector<HTMLElement>(selector) ?? null;
const qa = (root: ParentNode | null, selector: string) =>
  Array.from(root?.querySelectorAll<HTMLElement>(selector) ?? []);
const centre = (r: DOMRect): Point => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
/** An <img> that hasn't loaded has no height yet: nothing to morph into. */
const loaded = (img: HTMLImageElement | null): boolean =>
  img !== null && img.complete && img.naturalWidth > 0;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Overshoots its target by ~12% and settles back. */
const easeOutBack = (t: number) => {
  const c1 = 2;
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Every A → B transform (answer → bar, answer ↔ photo, colour → bar) runs this long, so none feels slower. */
const TRANSFORM_MS = 504;
const FLIGHT_MS = TRANSFORM_MS;
/** The answer's right edge reaches the bar's end at 55%; the rest is the two growing together. */
const JOIN = 0.55;
/** Sampled timeline; STEPS * JOIN is whole so a keyframe sits exactly on the join. */
const STEPS = 40;
/** The photo's resting corner radius (theme.css .hero). */
const PHOTO_RADIUS = 20;

/**
 * Keeps a live destination out of sight while its copy transforms into it, and hands over on the
 * last frame. 0.001, not 0: a browser doesn't paint a fully transparent element, so one revealed
 * only on the last frame shows a frame of nothing. At 0.001 it's painted, yet invisible.
 */
const REVEAL_UNDER_COPY: Keyframe[] = [{ opacity: 0.001 }, { opacity: 0.001 }];

// The previous hand-off's leftovers, so a quick second tap can finish it instantly.
let running: Animation[] = [];
// Only what the copies' removal waits for: the copies' own animations and the live destinations'
// REVEAL_UNDER_COPY holds. Never the new page's entrances (CSS): a copy that waited for them would
// sit over them for their whole duration.
let handovers: Animation[] = [];
let clones: HTMLElement[] = [];
// Elements of the leaving page hidden while a copy stands in for them; restored when the copies go
// (the page stays mounted, and comes back when the user goes back).
let hidden: HTMLElement[] = [];
// Animations on the leaving page's own elements that must not outlive the hand-off (the page stays
// mounted and comes back on Back): held at their end frame until the copies go, then cancelled.
let parked: Animation[] = [];
// The progress fill whose CSS transition is paused while an answer carries the bar.
let heldFill: HTMLElement | null = null;

function releaseFill() {
  if (heldFill) heldFill.style.transition = "";
  heldFill = null;
}

function settlePrevious() {
  // A cancelled (parked) animation is idle: finishing it would replay its end frame.
  running.forEach((a) => a.playState !== "idle" && a.finish());
  running = [];
  handovers = [];
  clones.forEach((c) => c.remove());
  clones = [];
  hidden.forEach((el) => (el.style.visibility = ""));
  hidden = [];
  parked.forEach((a) => a.cancel());
  parked = [];
  releaseDecoded();
  releaseFill();
}

/** The layout's motion layer and its screen rect: every copy is placed at `rect - origin` inside it. */
function layerOf() {
  const into = q(document, "[data-motion-layer]");
  if (!into) return null;
  const r = into.getBoundingClientRect();
  return { into, origin: { left: r.left, top: r.top } };
}

/** A copy of `el` pinned where it is on screen, inside the motion layer, for a flight to animate. */
function pin(el: HTMLElement, layer: NonNullable<ReturnType<typeof layerOf>>): HTMLElement {
  const r = el.getBoundingClientRect();
  const clone = el.cloneNode(true) as HTMLElement;
  // A cloned <img> reloads, and Safari paints nothing until it has: swap in the decoded image.
  const originals = el.querySelectorAll("img");
  clone.querySelectorAll("img").forEach((img, i) => img.replaceWith(decodedCopy(originals[i])));
  clone.setAttribute("aria-hidden", "true");
  clone.setAttribute("data-handoff-clone", "");
  Object.assign(clone.style, {
    position: "absolute",
    left: `${r.left - layer.origin.left}px`,
    top: `${r.top - layer.origin.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    margin: "0",
    zIndex: "32",
    pointerEvents: "none",
    animation: "none",
    transition: "none",
  });
  layer.into.appendChild(clone);
  clones.push(clone);
  return clone;
}

/** A plain pill in the bar's colour, pinned at `rect` inside the layer: the bar's tip in flight. */
function slugAt(
  rect: DOMRect,
  layer: NonNullable<ReturnType<typeof layerOf>>,
  color: string,
): HTMLElement {
  const slug = document.createElement("div");
  slug.setAttribute("aria-hidden", "true");
  slug.setAttribute("data-handoff-clone", "");
  Object.assign(slug.style, {
    position: "absolute",
    left: `${rect.left - layer.origin.left}px`,
    top: `${rect.top - layer.origin.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius: "999px",
    background: color,
    transformOrigin: "100% 50%",
    zIndex: "31",
    pointerEvents: "none",
  });
  layer.into.appendChild(slug);
  clones.push(slug);
  return slug;
}

function hide(el: HTMLElement | null | undefined) {
  if (!el) return;
  el.style.visibility = "hidden";
  hidden.push(el);
}

function animate(
  el: Element | null | undefined,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
) {
  if (!el) return;
  const animation = el.animate(keyframes, { fill: "both", easing: EASE_OUT, ...options });
  running.push(animation);
  if (keyframes === REVEAL_UNDER_COPY || el.closest("[data-handoff-clone]"))
    handovers.push(animation);
  return animation;
}

/** `animate` for a live element of the leaving page: held at its end until the hand-off is over, then released. */
function park(
  el: Element | null | undefined,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
) {
  const animation = animate(el, keyframes, { ...options, fill: "forwards" });
  if (animation) parked.push(animation);
}

/**
 * The chosen answer becomes the bar's leading edge: it shrinks around its right edge while that
 * edge flies to where the bar currently ends — same colour, same height. On that frame they join,
 * then grow together to the new length: the answer is what pushes the bar forward, not a timer.
 */
function fly({
  capsule,
  track,
  fill,
  lo,
  hi,
  answerClone,
  layer,
}: {
  capsule: DOMRect;
  track: DOMRect;
  fill: HTMLElement;
  /** Progress before this step: where the answer joins the bar. */
  lo: number;
  /** Progress after this step. */
  hi: number;
  answerClone: HTMLElement;
  layer: NonNullable<ReturnType<typeof layerOf>>;
}) {
  const loX = track.left + track.width * lo;
  const hiX = track.left + track.width * hi;
  // The pill lands as the bar's tip: right edge on the bar's end, one step long (inside the fill).
  const width = Math.max(track.height, Math.min(hiX - loX, loX - track.left));
  const land = new DOMRect(Math.max(track.left, loX - width), track.top, width, track.height);
  const slug = slugAt(land, layer, getComputedStyle(fill).backgroundColor);
  answerClone.style.transformOrigin = "100% 50%";

  // Everything is placed by its right edge: the answer's, then the bar's.
  const a: Point = { x: capsule.right, y: capsule.top + capsule.height / 2 };
  const b: Point = { x: land.right, y: land.top + land.height / 2 };
  const sx0 = capsule.width / land.width;
  const sy0 = capsule.height / land.height;
  // Rising and drifting left together, the rise leading and finishing first (~87% across), then a
  // short level entry into the bar's end.
  const riseAt = (f: number) => easeInOut(Math.min(1, Math.max(0, f / 0.75)));
  const slideAt = (f: number) => easeInOut(Math.min(1, Math.max(0, f)));

  const slugFrames: Keyframe[] = [];
  const capsuleFrames: Keyframe[] = [];
  const fillFrames: Keyframe[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const p = i / STEPS;
    const f = p <= JOIN ? p / JOIN : 1;
    const g = p <= JOIN ? 0 : easeOutBack((p - JOIN) / (1 - JOIN));
    const e = riseAt(f);
    const x = a.x + (b.x - a.x) * slideAt(f) + (hiX - loX) * g;
    const y = a.y + (b.y - a.y) * e;
    const sx = Math.pow(sx0, 1 - e);
    const sy = Math.pow(sy0, 1 - e);
    // The capsule is translucent, the bar opaque: the pill deepens in flight and is exactly the
    // bar's colour before it joins; nothing about the bar changes while it grows.
    const tone = 0.9 + 0.1 * Math.min(1, e / 0.9);
    slugFrames.push({
      offset: p,
      transform: `translate3d(${x - b.x}px, ${y - b.y}px, 0) scale(${sx}, ${sy})`,
      opacity: tone,
    });
    fillFrames.push({ offset: p, transform: `translateX(${(lo + (hi - lo) * g - 1) * 100}%)` });
    capsuleFrames.push({
      offset: p,
      transform: `translate3d(${x - a.x}px, ${y - a.y}px, 0) scale(${sx / sx0}, ${sy / sy0})`,
      // Its words and fill go first, over the pill.
      opacity: Math.max(0, 1 - p / 0.13),
    });
  }

  animate(slug, slugFrames, { duration: FLIGHT_MS, easing: "linear" });
  animate(fill, fillFrames, { duration: FLIGHT_MS, easing: "linear", fill: "none" });
  animate(answerClone, capsuleFrames, { duration: FLIGHT_MS, easing: "linear" });
}

/**
 * Going back, the answer comes back out of the bar: not the flight rewound (a direction flip
 * mid-motion) but its own move on the A → B clock. The pill starts as exactly the stretch of bar
 * this answer earned and takes it with it, slides out along the bar, drops and grows into the
 * answer, and hands over to a copy of the answer travelling the same path; the live answer takes
 * over on the last frame.
 */
function flyBack({
  capsule,
  track,
  fill,
  lo,
  hi,
  answerClone,
  liveAnswer,
  layer,
}: {
  capsule: DOMRect;
  track: DOMRect;
  fill: HTMLElement;
  /** Progress after this step (where the bar ends once the answer has left it). */
  lo: number;
  /** Progress before this step. */
  hi: number;
  answerClone: HTMLElement;
  liveAnswer: HTMLElement;
  layer: NonNullable<ReturnType<typeof layerOf>>;
}) {
  const duration = TRANSFORM_MS;
  const loX = track.left + track.width * lo;
  const hiX = track.left + track.width * hi;
  const seg = new DOMRect(loX, track.top, Math.max(track.height, hiX - loX), track.height);
  const slug = slugAt(seg, layer, getComputedStyle(fill).backgroundColor);
  answerClone.style.transformOrigin = "100% 50%";

  const b: Point = { x: seg.right, y: seg.top + seg.height / 2 };
  const a: Point = { x: capsule.right, y: capsule.top + capsule.height / 2 };
  const sx0 = capsule.width / seg.width;
  const sy0 = capsule.height / seg.height;
  // Level for the first quarter (sliding out along the bar), then curving down to arrive at the
  // same rate it goes across, so it lands along its line of travel.
  const up = (s: number) => (s >= 0.75 ? 1 : s + 2.6667 * s * s - 2.963 * s * s * s);

  const slugFrames: Keyframe[] = [];
  const copyFrames: Keyframe[] = [];
  let handedOver = false;
  for (let i = 0; i <= MORPH_STEPS; i++) {
    const t = i / MORPH_STEPS;
    const s = 1 - glideAt(t);
    const u = up(s);
    const x = a.x + (b.x - a.x) * s;
    const y = a.y + (b.y - a.y) * u;
    const sx = 1 + (sx0 - 1) * (1 - u);
    const sy = 1 + (sy0 - 1) * (1 - u);
    const slugTransform = `translate3d(${x - b.x}px, ${y - b.y}px, 0) scale(${sx}, ${sy})`;
    const copyTransform = `translate3d(${x - a.x}px, ${y - a.y}px, 0) scale(${sx / sx0}, ${sy / sy0})`;
    const tone = 1 - 0.1 * Math.min(1, Math.max(0, 1 - u));
    // Hand over from the pill to the answer's copy in one frame, not a crossfade: by 90% of the way
    // the pill is the answer's colour and shape, so the swap is invisible.
    const past = 1 - s >= 0.9;
    if (past && !handedOver) {
      handedOver = true;
      slugFrames.push({ offset: t, transform: slugTransform, opacity: tone });
      copyFrames.push({ offset: t, transform: copyTransform, opacity: 0 });
    }
    slugFrames.push({ offset: t, transform: slugTransform, opacity: past ? 0 : tone });
    copyFrames.push({ offset: t, transform: copyTransform, opacity: past ? 1 : 0 });
  }

  animate(slug, slugFrames, { duration, easing: "linear" });
  animate(answerClone, copyFrames, { duration, easing: "linear" });
  // The label comes back last, on the travelling copy.
  qa(answerClone, "span").forEach((label) =>
    animate(label, [{ opacity: 0 }, { offset: 0.8, opacity: 0 }, { opacity: 1 }], {
      duration,
      easing: "linear",
    }),
  );
  // Hidden while something transforms into it; takes over on the last frame, exactly where the copy ends.
  animate(liveAnswer, REVEAL_UNDER_COPY, { duration, easing: "linear", fill: "backwards" });
}

/** The stretch of progress bar between two fractions, in screen space (at least as long as it's tall). */
function barSegment(track: DOMRect, from: number, to: number): DOMRect {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return new DOMRect(
    track.left + track.width * lo,
    track.top,
    Math.max(track.height, track.width * (hi - lo)),
    track.height,
  );
}

/**
 * Any shape into the progress bar exactly the way an answer pill goes, as a morph path: right edge
 * to the bar's current end while shrinking to the bar's height, join, grow together, bounce. Through
 * the one-geometry frame, so a full-screen colour is never stretched: its corners go from its own
 * roundness to a fully round pill. Also returns the bar's keyframes (hold, then grow with the shape).
 */
function intoBarPath(
  source: DOMRect,
  sourceRadius: number,
  track: DOMRect,
  lo: number,
  hi: number,
) {
  const loX = track.left + track.width * lo;
  const hiX = track.left + track.width * hi;
  const width = Math.max(track.height, Math.min(hiX - loX, loX - track.left));
  const land = new DOMRect(Math.max(track.left, loX - width), track.top, width, track.height);
  const a: Point = { x: source.right, y: source.top + source.height / 2 };
  const b: Point = { x: land.right, y: land.top + land.height / 2 };
  const riseAt = (f: number) => easeInOut(Math.min(1, Math.max(0, f / 0.75)));
  const slideAt = (f: number) => easeInOut(Math.min(1, Math.max(0, f)));
  const fromRound = roundness(sourceRadius, source.width, source.height);
  const phase = (t: number) => ({
    f: t <= JOIN ? t / JOIN : 1,
    g: t <= JOIN ? 0 : easeOutBack((t - JOIN) / (1 - JOIN)),
  });
  const path = (t: number): Box => {
    const { f, g } = phase(t);
    const e = riseAt(f);
    const w = Math.exp(lerp(Math.log(source.width), Math.log(land.width), e));
    const h = Math.exp(lerp(Math.log(source.height), Math.log(land.height), e));
    const right = a.x + (b.x - a.x) * slideAt(f) + (hiX - loX) * g;
    return {
      cx: right - w / 2,
      cy: a.y + (b.y - a.y) * e,
      w,
      h,
      r: lerp(fromRound, 0.5, e) * Math.min(w, h),
    };
  };
  const fillFrames: Keyframe[] = Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS;
    return { offset: t, transform: `translateX(${(lo + (hi - lo) * phase(t).g - 1) * 100}%)` };
  });
  return { path, fillFrames, to: land };
}

/**
 * Out of the progress bar into any shape, the way an answer comes back out: the stretch of bar
 * slides out along it, then drops and grows into the shape by its right edge, on the A → B clock.
 */
function outOfBarPath(dest: DOMRect, destRadius: number, track: DOMRect, lo: number, hi: number) {
  const seg = barSegment(track, lo, hi);
  const b: Point = { x: seg.right, y: seg.top + seg.height / 2 };
  const a: Point = { x: dest.right, y: dest.top + dest.height / 2 };
  const up = (s: number) => (s >= 0.75 ? 1 : s + 2.6667 * s * s - 2.963 * s * s * s);
  const toRound = roundness(destRadius, dest.width, dest.height);
  const path = (t: number): Box => {
    const s = 1 - glideAt(t);
    const u = up(s);
    const w = seg.width + (dest.width - seg.width) * (1 - u);
    const h = seg.height + (dest.height - seg.height) * (1 - u);
    const right = a.x + (b.x - a.x) * s;
    return {
      cx: right - w / 2,
      cy: a.y + (b.y - a.y) * u,
      w,
      h,
      r: lerp(0.5, toRound, 1 - u) * Math.min(w, h),
    };
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

const labelOut: Keyframe[] = [{ opacity: 1 }, { offset: 0.15, opacity: 0 }, { opacity: 0 }];
const labelBack: Keyframe[] = [{ opacity: 0 }, { offset: 0.85, opacity: 0 }, { opacity: 1 }];

/**
 * Runs one hand-off: measures the leaving page, swaps the route synchronously (`update` is the
 * router call), measures the arriving page, and plays the shared-element transforms across both.
 * The pages' own exits and entrances are CSS (motion.css), keyed on the router's phase.
 */
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
  const layer = layerOf();
  // The page on top right now is the one being left. Only its live element exists; no clone.
  const oldPage = q(document, '[data-sw-route][data-sw-state="active"] [data-flow-page]');
  if (handoff === "plain" || !layer || !oldPage) {
    flushSync(update);
    return;
  }

  const forward = direction === "next";
  const oldOptions = qa(oldPage, "[data-flow-option]");
  const oldSelected = oldOptions.find((el) => el.hasAttribute("data-selected")) ?? null;
  const oldSelectedRect = oldSelected?.getBoundingClientRect();
  const oldImage = q(oldPage, "[data-flow-image]");
  const oldImageRect = oldImage?.getBoundingClientRect();
  // A statement's full-screen colour: the destination of `flood`, the source of `absorb`. Measured
  // now, on the page that is about to leave (going forward, absorb) or stay (going back, flood).
  const oldBackdrop = q(oldPage, "[data-flow-backdrop]");
  const oldBackdropRect = oldBackdrop?.getBoundingClientRect();
  const backdropColor = oldBackdrop ? getComputedStyle(oldBackdrop).backgroundColor : "";
  // Answers become progress, except where they open into the next page's image or statement colour.
  const intoImage = handoff === "picture" || handoff === "connect";
  const intoScene = intoImage || handoff === "flood";
  // Faces are captured before the page changes (the photo's first, so it gets the decoded image).
  const photoFaceBack: Face | null =
    !forward && intoImage && oldImage instanceof HTMLImageElement ? photoFace(oldImage) : null;
  const answerFace: Face | null =
    forward && intoScene && oldSelected && oldSelectedRect
      ? fillFace(oldSelected, oldSelectedRect)
      : null;

  const fill = q(document, "[data-progress-fill]");
  const fromFraction = Number(fill?.dataset.progress ?? 0);
  const answerFlies =
    forward && !intoScene && oldSelected !== null && oldSelectedRect !== undefined && fill !== null;
  let answerClone: HTMLElement | undefined;
  if (answerFlies && oldSelected) {
    answerClone = pin(oldSelected, layer);
    // The live answer stays mounted (the page comes back on Back): hide it under its copy for now.
    hide(oldSelected);
  }
  if (answerFace && oldSelected) hide(oldSelected);
  // The bar moves only when something lands in it (or leaves it), so its own transition steps aside.
  if (fill && (answerFlies || handoff === "absorb" || (!forward && !intoScene))) {
    fill.style.transition = "none";
    heldFill = fill;
  }

  // Swap the route now, synchronously: the destination exists in the DOM when this returns.
  flushSync(update);

  const page = q(document, '[data-sw-route][data-sw-state="active"] [data-flow-page]');
  const newImage = q(page, "[data-flow-image]");
  const newSelected = q(page, "[data-flow-option][data-selected]");
  const newBackdrop = q(page, "[data-flow-backdrop]");
  const toFraction = Number(fill?.dataset.progress ?? 0);
  const trackRect = fill?.parentElement?.getBoundingClientRect();

  const finish = () => {
    const done = handovers;
    const liveImage = newImage instanceof HTMLImageElement && !loaded(newImage) ? newImage : null;
    const photoLoaded = liveImage
      ? Promise.race([
          new Promise<void>((resolve) =>
            liveImage.addEventListener("load", () => resolve(), { once: true }),
          ),
          new Promise<void>((resolve) => window.setTimeout(resolve, 1000)),
        ])
      : Promise.resolve();
    Promise.all([...done.map((a) => a.finished), photoLoaded])
      .catch(() => {})
      .finally(() => {
        if (handovers !== done) return;
        // The same frame the live destinations reach full opacity: no gap, no double layer.
        clones.forEach((c) => c.remove());
        clones = [];
        handovers = [];
        hidden.forEach((el) => (el.style.visibility = ""));
        hidden = [];
        parked.forEach((a) => a.cancel());
        parked = [];
        releaseDecoded();
        releaseFill();
      });
  };

  // ---- forward: the answer becomes the progress (every question page, unless it opens into a scene)
  if (answerFlies && fill && trackRect && oldSelectedRect && answerClone) {
    fly({
      capsule: oldSelectedRect,
      track: trackRect,
      fill,
      lo: fromFraction,
      hi: toFraction,
      answerClone,
      layer,
    });
  }

  // ---- back from a question whose answer flew: it comes back out of the bar
  if (!forward && heldFill && fill && trackRect) {
    if (newSelected) {
      newSelected.dataset.morph = "";
      const copy = pin(newSelected, layer);
      flyBack({
        capsule: newSelected.getBoundingClientRect(),
        track: trackRect,
        fill,
        lo: toFraction,
        hi: fromFraction,
        answerClone: copy,
        liveAnswer: newSelected,
        layer,
      });
    } else {
      animate(
        fill,
        [
          { transform: `translateX(${(fromFraction - 1) * 100}%)` },
          { transform: `translateX(${(toFraction - 1) * 100}%)` },
        ],
        {
          duration: 300,
          fill: "none",
        },
      );
    }
  }

  switch (handoff) {
    case "picture":
    case "connect": {
      if (forward) {
        const photoKnown =
          newImage instanceof HTMLImageElement &&
          (loaded(newImage) || isImageReady(newImage.getAttribute("src") ?? ""));
        if (!(answerFace && oldSelectedRect && newImage && photoKnown)) {
          // No morph target yet: the answer leaves with the page, and the photo fades in on load.
          hidden.forEach((el) => (el.style.visibility = ""));
          hidden = [];
          if (newImage && !loaded(newImage as HTMLImageElement)) {
            newImage.addEventListener(
              "load",
              () =>
                newImage.animate([{ opacity: 0 }, { opacity: 1 }], {
                  duration: 240,
                  easing: EASE_OUT,
                }),
              { once: true },
            );
          }
          break;
        }
        // Its CSS entrance is off (motion.css declares it; data-morph is the backstop) before measuring.
        newImage.dataset.morph = "";
        const laidOut = newImage.getBoundingClientRect();
        const size = imageSize(newImage.getAttribute("src") ?? "");
        const r =
          laidOut.height >= 1 || !size
            ? laidOut
            : new DOMRect(
                laidOut.left,
                laidOut.top,
                laidOut.width,
                (laidOut.width * size.height) / size.width,
              );
        if (handoff === "connect") {
          // Connect: the other answers gather into the chosen one (never below 95%) as it becomes the
          // photo. They are the leaving page's live elements (motion.css leaves them alone for this).
          const a = centre(oldSelectedRect);
          const chosen = oldOptions.indexOf(oldSelected as HTMLElement);
          oldOptions.forEach((el, k) => {
            if (el === oldSelected) return;
            const c = centre(el.getBoundingClientRect());
            park(
              el,
              [
                { transform: "none", opacity: 1, filter: "blur(0px)", easing: EASE_IN_OUT },
                {
                  offset: 0.35,
                  transform: `translate3d(${a.x - c.x}px, ${a.y - c.y}px, 0) scale(0.95)`,
                  opacity: 0,
                  filter: `blur(${motionBlur(5)}px)`,
                },
                {
                  transform: `translate3d(${a.x - c.x}px, ${a.y - c.y}px, 0) scale(0.95)`,
                  opacity: 0,
                  filter: `blur(${motionBlur(5)}px)`,
                },
              ],
              { duration: TRANSFORM_MS, easing: "linear", delay: Math.abs(k - chosen) * 30 },
            );
          });
        }
        const m = playMorph({
          from: { rect: oldSelectedRect, radius: oldSelectedRect.height / 2 },
          to: { rect: r, radius: PHOTO_RADIUS },
          faces: { from: answerFace, to: photoFace(newImage) },
          duration: TRANSFORM_MS,
          handover: [0.45, 0.75],
          mount: layer,
        });
        qa(m.faces.from, "span").forEach((label) =>
          animate(label, labelOut, { duration: TRANSFORM_MS, easing: "linear" }),
        );
        animate(newImage, REVEAL_UNDER_COPY, {
          duration: TRANSFORM_MS,
          easing: "linear",
          fill: "backwards",
        });
      } else if (photoFaceBack && oldImageRect && newSelected) {
        // The photo becomes the answer again, closing into its pill while travelling to it.
        newSelected.dataset.morph = "";
        hide(oldImage);
        const r = newSelected.getBoundingClientRect();
        const m = playMorph({
          from: { rect: oldImageRect, radius: PHOTO_RADIUS },
          to: { rect: r, radius: r.height / 2 },
          faces: { from: photoFaceBack, to: fillFace(newSelected, r) },
          duration: TRANSFORM_MS,
          handover: [0.7, 0.94],
          mount: layer,
        });
        qa(m.faces.to, "span").forEach((label) =>
          animate(label, labelBack, { duration: TRANSFORM_MS, easing: "linear" }),
        );
        animate(newSelected, REVEAL_UNDER_COPY, {
          duration: TRANSFORM_MS,
          easing: "linear",
          fill: "backwards",
        });

        if (handoff === "connect") {
          // Every answer went into the photo, so every answer comes back out of it, from where the
          // frame is when they start (60% of the way, on the same clock).
          const k = glideAt(0.6);
          const from = {
            x: lerp(oldImageRect.left + oldImageRect.width / 2, r.left + r.width / 2, k),
            y: lerp(oldImageRect.top + oldImageRect.height / 2, r.top + r.height / 2, k),
          };
          qa(page, "[data-flow-option]").forEach((el, i) => {
            if (el === newSelected) return;
            el.dataset.morph = "";
            const c = centre(el.getBoundingClientRect());
            animate(
              el,
              [
                {
                  transform: `translate3d(${from.x - c.x}px, ${from.y - c.y}px, 0) scale(0.95)`,
                  opacity: 0,
                  filter: `blur(${motionBlur(5)}px)`,
                },
                {
                  offset: 0.55 + i * 0.04,
                  transform: `translate3d(${from.x - c.x}px, ${from.y - c.y}px, 0) scale(0.95)`,
                  opacity: 0,
                  filter: `blur(${motionBlur(5)}px)`,
                  easing: EASE_IN_OUT,
                },
                { transform: "none", opacity: 1, filter: "blur(0px)" },
              ],
              { duration: TRANSFORM_MS, easing: "linear", fill: "backwards" },
            );
          });
        }
      }
      break;
    }

    case "flood": {
      if (forward) {
        // The chosen answer opens into the statement's full-screen colour: the most prominent thing on
        // the next screen, and the answer's own colour. The words arrive on it afterwards (motion.css).
        if (!(answerFace && oldSelectedRect && newBackdrop)) break;
        newBackdrop.dataset.morph = "";
        const m = playMorph({
          from: { rect: oldSelectedRect, radius: oldSelectedRect.height / 2 },
          to: { rect: newBackdrop.getBoundingClientRect(), radius: 0 },
          faces: { from: answerFace, to: colorFace(getComputedStyle(newBackdrop).backgroundColor) },
          duration: TRANSFORM_MS,
          handover: [0.45, 0.75],
          mount: layer,
        });
        qa(m.faces.from, "span").forEach((label) =>
          animate(label, labelOut, { duration: TRANSFORM_MS, easing: "linear" }),
        );
        animate(newBackdrop, REVEAL_UNDER_COPY, {
          duration: TRANSFORM_MS,
          easing: "linear",
          fill: "backwards",
        });
      } else if (oldBackdropRect && newSelected) {
        // Back out of a statement: the colour closes back into the answer that opened into it.
        newSelected.dataset.morph = "";
        hide(oldBackdrop);
        const r = newSelected.getBoundingClientRect();
        const m = playMorph({
          from: { rect: oldBackdropRect, radius: 0 },
          to: { rect: r, radius: r.height / 2 },
          faces: { from: colorFace(backdropColor), to: fillFace(newSelected, r) },
          duration: TRANSFORM_MS,
          handover: [0.7, 0.94],
          zIndex: 29,
          mount: layer,
        });
        qa(m.faces.to, "span").forEach((label) =>
          animate(label, labelBack, { duration: TRANSFORM_MS, easing: "linear" }),
        );
        animate(newSelected, REVEAL_UNDER_COPY, {
          duration: TRANSFORM_MS,
          easing: "linear",
          fill: "backwards",
        });
      }
      break;
    }

    case "absorb": {
      if (!(fill && trackRect)) break;
      if (forward) {
        // The statement's colour collapses into the stretch of bar this step earns: the statement
        // becomes progress (the bar's exception to the size floor). Its words leave first (motion.css).
        if (!oldBackdropRect) break;
        hide(oldBackdrop);
        const { path, fillFrames, to } = intoBarPath(
          oldBackdropRect,
          0,
          trackRect,
          fromFraction,
          toFraction,
        );
        playMorph({
          from: { rect: oldBackdropRect, radius: 0 },
          to: { rect: to, radius: to.height / 2 },
          faces: { from: colorFace(backdropColor), to: colorFace(backdropColor) },
          duration: FLIGHT_MS,
          blur: 0,
          zIndex: 29,
          path,
          steps: STEPS,
          mount: layer,
        });
        // The bar holds until the colour's edge reaches it, then grows with it (the same as a pill).
        animate(fill, fillFrames, { duration: FLIGHT_MS, easing: "linear", fill: "none" });
      } else if (newBackdrop) {
        // Back into a statement: the stretch of bar it became grows back out into the colour.
        newBackdrop.dataset.morph = "";
        const color = getComputedStyle(newBackdrop).backgroundColor;
        const dest = newBackdrop.getBoundingClientRect();
        const { path, from } = outOfBarPath(dest, 0, trackRect, toFraction, fromFraction);
        playMorph({
          from: { rect: from, radius: from.height / 2 },
          to: { rect: dest, radius: 0 },
          faces: { from: colorFace(color), to: colorFace(color) },
          duration: TRANSFORM_MS,
          blur: 0,
          zIndex: 29,
          path,
          mount: layer,
        });
        animate(newBackdrop, REVEAL_UNDER_COPY, {
          duration: TRANSFORM_MS,
          easing: "linear",
          fill: "backwards",
        });
      }
      break;
    }

    default:
      // begin, kept, finish: the pages' own CSS does the rest.
      break;
  }

  finish();
}
