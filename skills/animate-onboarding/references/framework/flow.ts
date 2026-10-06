import moon from "../assets/moon.svg";
import sprout from "../assets/sprout.svg";

/**
 * The flow's map: for every page, how it is entered (its hand-off), how far
 * the progress bar stands when it is on screen, and the image it shows (so it
 * can be warmed before a morph needs it).
 *
 * The hand-off is named on the page being ENTERED, like the framework's own
 * transitions: going forward the router uses the incoming page's transition,
 * going back the leaving page's, so a pair plays in reverse for free.
 */
export type Route = "index" | "goal" | "nights" | "statement" | "tried" | "insight" | "done";

/**
 * The catalog (handoffs.md). This flow uses six; the rest are built too
 * (motion.css, handoffs.ts), so a page can name any of them.
 */
export type Handoff =
  /** welcome → first question: the welcome tips back like a card; the bar draws in */
  | "begin"
  /** question → question: the chosen answer flies into the progress bar */
  | "kept"
  /** question → statement: the chosen answer opens into the full-screen colour */
  | "flood"
  /** statement → question: the colour collapses into the bar, like a pill */
  | "absorb"
  /** question → explainer: the chosen answer becomes the hero image */
  | "picture"
  /** question → explainer: the other answers gather into the chosen one as it becomes the hero image */
  | "connect"
  /** explainer → done: the bar completes and hands over */
  | "finish"
  /** big picture → looking inward: the old page shrinks away, the next rises from further down, slower */
  | "inward"
  /** forgotten: the old page drifts off, the next arrives in place, softly */
  | "slip"
  /** memories fading: the answers leave one by one, each further than the last */
  | "fade"
  /** fade to nothing, a beat of emptiness, then the next settles in */
  | "gone"
  /** the mind goes blank: the photo lifts first, the words a beat later */
  | "blank"
  /** re-explaining: back over the same ground, so the next comes from above */
  | "again"
  /** tension: faster cuts */
  | "jolt"
  /** the answers leave and arrive on an even beat: a pattern forms */
  | "cadence"
  /** the calmest moment: slow, low, on a wide beat */
  | "settle";

export const HANDOFF: Record<Exclude<Route, "index">, Handoff> = {
  goal: "begin",
  nights: "kept",
  statement: "flood",
  tried: "absorb",
  insight: "picture",
  done: "finish",
};

/** Progress on each page, 0–1. The bar only moves when something lands in it or leaves it. */
export const PROGRESS: Record<Route, number> = {
  index: 0,
  goal: 0,
  nights: 0.25,
  statement: 0.5,
  tried: 0.75,
  insight: 0.75,
  done: 1,
};

/** The image on a page, warmed when the flow opens and awaited before a morph into it. */
export const IMAGE: Partial<Record<Route, string>> = {
  index: moon,
  insight: sprout,
};

/** Natural size of the images above, so a page reserves the box before it paints (Safari). */
export const IMAGE_SIZE = { width: 800, height: 600 };
