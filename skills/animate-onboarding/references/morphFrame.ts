// THE way to morph Frame A into Frame B (one frame, two faces, one geometry), as shipped on
// Reflective's web2app, with one addition for the superwall framework: the frame is mounted into
// the layout's motion layer (`mount`), never `document.body`, because a surface never positions
// anything fixed and its pages are absolute layers inside the framework's content box.

import { decodedCopy } from "./imageReady";

/**
 * Frame A → Frame B morphs. The one rule: **A and B share the same geometry at
 * every moment of the transition.** Not "two copies driven by the same numbers" —
 * those drift apart the moment one has its own rounded corners, border, margin,
 * blur or rounding error, and the eye catches it instantly.
 *
 * So there is exactly one frame, and it alone owns the geometry:
 *
 *   outer   (fixed at `home`, no transform)  — the blur, in screen pixels
 *     middle  — the transform: translate to the box's centre, scale only *up*
 *       clipper — the clip-path: the box's size and corner radius
 *         face A — fills the clipper; opacity only
 *         face B — fills the clipper; opacity only, on top
 *
 * The faces never have a shape of their own (no radius, border, margin or
 * transform of their own): they fill the frame, and the frame's clip is the
 * only outline anyone sees. A and B cannot differ in geometry because there is
 * only one geometry.
 *
 * Usage, answer → photo:
 *
 *   const answer = fillFace(answerEl, answerRect);     // capture before the page swaps
 *   // …swap the page…
 *   const { frame, animations, faces } = morph({
 *     from: { rect: answerRect, radius: answerRect.height / 2 },
 *     to:   { rect: photoRect,  radius: 20 },
 *     faces: { from: answer, to: photoFace(photoEl) },
 *     duration: 504,
 *   });
 */

/**
 * One switch for every blur in the hand-offs (the morph frame's motion blur and the answers gathering
 * into a photo). Off gives the same motion with no blur.
 */
export const MOTION_BLUR_ENABLED = true;
/** A blur amount, or 0 while motion blur is switched off. */
export const motionBlur = (px: number) => (MOTION_BLUR_ENABLED ? px : 0);

export type MorphEnd = { rect: DOMRect; radius: number };
/** Builds a face that fills the frame; given the frame's home rect (its size when unscaled). */
export type Face = (home: DOMRect) => HTMLElement;

/** The frame's shape at one moment, in screen pixels: centre, size, corner radius. */
export type Box = { cx: number; cy: number; w: number; h: number; r: number };

/** A corner radius as a fraction of the shape's shorter side (0.5 = fully round ends). */
export const roundness = (radius: number, w: number, h: number) => Math.min(0.5, radius / Math.max(1e-6, Math.min(w, h)));

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** 0 before `a`, 1 after `b`, linear in between. */
export const span = (t: number, a: number, b: number) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a));
/** 0 → 1 across [a, b] with zero speed at both ends. */
export const ease01 = (t: number, a: number, b: number) => {
  const k = span(t, a, b);
  return k * k * (3 - 2 * k);
};

/**
 * The A → B clock: a critically damped spring (ζ = 1, Apple's default for UI: no overshoot) chasing
 * a target that eases in from rest after a barely-there pull-back (~1%). It speeds up to its top
 * speed early (~27% of the time) and then slows continuously over a long, gentle tail, so there's
 * no constant-speed middle and no snap at the end; a final taper lands it exactly at rest on the
 * last frame. Speed is continuous everywhere and zero at both ends.
 *
 * Tried and dropped: a quintic ease to a 1.5% overshoot at 82% with a ~90ms settle (linear-feeling
 * middle, snappy bounce at the end); a stiff spring (~6% overshoot, back in ~75ms); stock
 * ease-in-out-back (10% both ways, rushed middle).
 */
const CLOCK_RAMP = 0.25; // the target eases in over the first quarter
const CLOCK_OMEGA = 9; // spring stiffness, per transition length
const CLOCK_PULL = 0.6; // → ~1% pull-back
const CLOCK_TAPER = 0.12; // the last 12% eases the spring's tail exactly onto the target
const CLOCK_SAMPLES = 1200;
let clockTable: Float64Array | null = null;

function buildClock(): Float64Array {
  const smoother = (u: number) => {
    const k = Math.min(1, Math.max(0, u));
    return k * k * k * (k * (k * 6 - 15) + 10);
  };
  const table = new Float64Array(CLOCK_SAMPLES + 1);
  const dt = 1 / CLOCK_SAMPLES;
  let x = 0;
  let v = 0;
  for (let i = 0; i <= CLOCK_SAMPLES; i++) {
    const s = smoother((i * dt) / CLOCK_RAMP);
    const target = s - CLOCK_PULL * Math.sin(Math.PI * s) * (1 - s);
    table[i] = x;
    v += (CLOCK_OMEGA * CLOCK_OMEGA * (target - x) - 2 * CLOCK_OMEGA * v) * dt; // ζ = 1
    x += v * dt;
  }
  const end = table[CLOCK_SAMPLES];
  for (let i = 0; i <= CLOCK_SAMPLES; i++) {
    const y = table[i] / end;
    table[i] = y + (1 - y) * ease01(i / CLOCK_SAMPLES, 1 - CLOCK_TAPER, 1);
  }
  return table;
}

export function glideAt(t: number): number {
  clockTable ??= buildClock();
  const f = Math.min(1, Math.max(0, t)) * CLOCK_SAMPLES;
  const i = Math.floor(f);
  return i >= CLOCK_SAMPLES ? clockTable[CLOCK_SAMPLES] : clockTable[i] + (clockTable[i + 1] - clockTable[i]) * (f - i);
}

/** Samples per morph; every channel is sampled from the same clock at the same instants. */
export const MORPH_STEPS = 30;

/** Up to a 20% dip for a dimension about equal at both ends (a bubble squeezing through); none once they differ by half. */
const dipFor = (x: number, y: number) => 0.2 * Math.max(0, 1 - (Math.max(x, y) / Math.min(x, y) - 1) / 0.5);

/**
 * The frame's box at clock value p (0 = a, 1 = b; a hair below 0 at the start). It travels
 * on p and opens on p^1.5, so the move leads and the opening follows without either restarting;
 * size only interpolates between the ends (never below 80% of the smaller); a dimension equal at
 * both ends dips and swells back.
 *
 * Corners are proportional: the radius is interpolated as a fraction of the shorter side (its
 * "roundness"), not in pixels. A fully round answer (0.5) opening into a square background (0)
 * stays visibly rounded while it's big and only goes square at the end; pixel interpolation would
 * leave a big frame with tiny, sharp-looking corners almost at once.
 */
function boxAt(a: Box, b: Box, p: number): Box {
  const open = Math.sign(p) * Math.pow(Math.abs(p), 1.5);
  const bulge = Math.sin(Math.PI * p);
  const w = lerp(a.w, b.w, open) * (1 - dipFor(a.w, b.w) * bulge);
  const h = lerp(a.h, b.h, open) * (1 - dipFor(a.h, b.h) * bulge);
  const round = lerp(roundness(a.r, a.w, a.h), roundness(b.r, b.w, b.h), Math.min(1, Math.max(0, open)));
  return { cx: lerp(a.cx, b.cx, p), cy: lerp(a.cy, b.cy, p), w, h, r: round * Math.min(w, h) };
}

const boxOf = ({ rect, radius }: MorphEnd): Box => ({
  cx: rect.left + rect.width / 2,
  cy: rect.top + rect.height / 2,
  w: rect.width,
  h: rect.height,
  r: radius,
});

/** Makes `el` fill its parent exactly, with no shape of its own. */
function fill(el: HTMLElement) {
  el.removeAttribute("style");
  Object.assign(el.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
    margin: "0",
    border: "0",
    borderRadius: "0",
    boxShadow: "none",
    transform: "none",
    animation: "none",
    transition: "none",
  });
  return el;
}

/** A photo face: the decoded image covering the frame exactly as it covers its own box at rest. */
export function photoFace(img: HTMLImageElement): Face {
  const copy = fill(decodedCopy(img));
  copy.style.objectFit = "cover";
  return () => copy;
}

/**
 * A face for a filled element (an answer capsule, a button): its colour fills the whole frame, so
 * the frame's shape is the only shape, and a copy of its content sits where the element rests.
 * Captures the element now (call it before the page swaps, while the element still exists).
 */
export function fillFace(el: HTMLElement, rest: DOMRect): Face {
  const background = getComputedStyle(el).backgroundColor;
  const content = el.cloneNode(true) as HTMLElement;
  return (home) => {
    const face = fill(document.createElement("div"));
    face.style.background = background;
    // Where the frame shows the element's own box, its content must sit: centred, at rest size
    // (scaled by 1/k when that box is larger than the frame's home, as the frame scales it by k).
    const k = Math.max(1, rest.width / home.width, rest.height / home.height);
    content.removeAttribute("style");
    Object.assign(content.style, {
      position: "absolute",
      left: `${(home.width - rest.width) / 2}px`,
      top: `${(home.height - rest.height) / 2}px`,
      width: `${rest.width}px`,
      height: `${rest.height}px`,
      margin: "0",
      background: "transparent",
      border: "0",
      boxShadow: "none",
      transform: k === 1 ? "none" : `scale(${1 / k})`,
      animation: "none",
      transition: "none",
    });
    face.appendChild(content);
    return face;
  };
}

/**
 * A face that's just a colour: for a destination (or source) whose look is its fill, like a
 * page background that ties to the chosen answer's colour.
 */
export function colorFace(color: string): Face {
  return () => {
    const face = fill(document.createElement("div"));
    face.style.background = color;
    return face;
  };
}

/**
 * Morph Frame A into Frame B. `handover` is the clock window over which B fades in on top of A
 * (A stays opaque underneath until B is fully in, so the frame never goes see-through); keep it
 * inside the blur window so the swap happens under the blur. The blur is motion blur: crisp at both
 * ends, blurred only while it's moving fastest — from 25% to 75% of the duration (easing in over
 * 25–35%, full 35–65%, easing out over 65–75%). Returns the frame (remove it when done) and its
 * animations (await them).
 */
export function morph({
  from,
  to,
  faces,
  duration,
  handover = [0.45, 0.75],
  blur = 5,
  blurWindow = [0.25, 0.75],
  zIndex = 31,
  path,
  steps = MORPH_STEPS,
  mount,
}: {
  from: MorphEnd;
  to: MorphEnd;
  faces: { from: Face; to: Face };
  duration: number;
  /** Clock window (p) over which B takes over. */
  handover?: [number, number];
  /** Peak blur, on-screen px. */
  blur?: number;
  /** Time window (fraction of the duration) the blur spans; crisp outside it. */
  blurWindow?: [number, number];
  zIndex?: number;
  /**
   * The frame's shape at each moment t (0–1), for a move with its own geometry (e.g. into the
   * progress bar, right edge first). Must start exactly on `from` and end exactly on `to`.
   */
  path?: (t: number) => Box;
  /** Keyframe samples (make steps × any key moment a whole number so a sample lands on it). */
  steps?: number;
  /**
   * Where the frame lives: a positioned layer and that layer's screen rect, so the frame is placed
   * at `rect - origin` inside it. Defaults to document.body at page coordinates.
   */
  mount?: { into: HTMLElement; origin: { left: number; top: number } };
}) {
  // Home: the larger end, so the frame is only ever scaled up (never squashed).
  const home = from.rect.width * from.rect.height >= to.rect.width * to.rect.height ? from.rect : to.rect;
  const outer = document.createElement("div");
  outer.setAttribute("aria-hidden", "true");
  outer.setAttribute("data-handoff-clone", "");
  const origin = mount?.origin ?? { left: -window.scrollX, top: -window.scrollY };
  Object.assign(outer.style, {
    position: "absolute",
    left: `${home.left - origin.left}px`,
    top: `${home.top - origin.top}px`,
    width: `${home.width}px`,
    height: `${home.height}px`,
    zIndex: String(zIndex),
    pointerEvents: "none",
  });
  const middle = fill(document.createElement("div"));
  middle.style.transformOrigin = "50% 50%";
  const clipper = fill(document.createElement("div"));
  clipper.style.overflow = "hidden";
  const faceA = faces.from(home);
  const faceB = faces.to(home);
  clipper.append(faceA, faceB);
  middle.appendChild(clipper);
  outer.appendChild(middle);
  (mount?.into ?? document.body).appendChild(outer);

  const a = boxOf(from);
  const b = boxOf(to);
  const homeCx = home.left + home.width / 2;
  const homeCy = home.top + home.height / 2;
  const [h0, h1] = handover;
  const [b0, b1] = blurWindow;
  const ramp = (b1 - b0) * 0.2;
  const samples = Array.from({ length: steps + 1 }, (_, i) => ({ t: i / steps, p: glideAt(i / steps) }));

  const middleFrames: Keyframe[] = [];
  const clipFrames: Keyframe[] = [];
  const outerFrames: Keyframe[] = [];
  const aFrames: Keyframe[] = [];
  const bFrames: Keyframe[] = [];
  for (const { t, p } of samples) {
    const box = path ? path(t) : boxAt(a, b, p);
    // Scale only up, when the box is bigger than home; the clip shows the box, in local pixels.
    const k = Math.max(1, box.w / home.width, box.h / home.height);
    const w = box.w / k;
    const h = box.h / k;
    middleFrames.push({ offset: t, transform: `translate3d(${box.cx - homeCx}px, ${box.cy - homeCy}px, 0) scale(${k})` });
    clipFrames.push({ offset: t, clipPath: `inset(${(home.height - h) / 2}px ${(home.width - w) / 2}px round ${box.r / k}px)` });
    // Motion blur: only while it's moving fastest, crisp at both ends.
    const amount = ease01(t, b0, b0 + ramp) * (1 - ease01(t, b1 - ramp, b1));
    outerFrames.push({ offset: t, filter: `blur(${(motionBlur(blur) * amount).toFixed(3)}px)` });
    bFrames.push({ offset: t, opacity: ease01(p, h0, h1) });
    // A fades out gradually, from halfway through B's fade-in to a little after it. Never in one
    // step: when B is translucent (a selected answer is 90%), whatever is under it shows through, and
    // switching A off at once changes that instantly — a mid-morph brightness jump.
    aFrames.push({ offset: t, opacity: 1 - ease01(p, (h0 + h1) / 2, Math.min(1, h1 + (h1 - h0) / 2)) });
  }

  const options: KeyframeAnimationOptions = { duration, easing: "linear", fill: "both" };
  const animations = [
    middle.animate(middleFrames, options),
    clipper.animate(clipFrames, options),
    outer.animate(outerFrames, options),
    faceA.animate(aFrames, options),
    faceB.animate(bFrames, options),
  ];
  return { frame: outer, animations, faces: { from: faceA, to: faceB } };
}
