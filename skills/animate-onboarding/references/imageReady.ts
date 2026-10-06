// Reference implementation: image readiness for hand-offs (engine.md "Loaded
// destinations"), as shipped on Reflective's web2app. Call warmImage() for every
// image when the flow opens; navigation checks isImageReady()/whenImageReady()
// before a hand-off into a page with an image.

/**
 * Decoded images, kept alive for the session. A hand-off that morphs into a
 * page's photo needs that photo decoded before the page swaps: an <img> that
 * hasn't loaded has no height yet, so the morph would measure a zero-size
 * target and animate a blank copy. Holding the Image objects here also keeps
 * them from being dropped before they finish.
 *
 * Readiness comes from the image having loaded, not from decode() alone:
 * older Safari rejects decode() on an image that isn't in the document, which
 * would leave a perfectly good image marked "not ready" forever. decode() is
 * still awaited when it works, so the first paint doesn't stall on decoding.
 */
type Entry = { img: HTMLImageElement; ready: boolean; done: Promise<void> };

const images = new Map<string, Entry>();

/** Start downloading and decoding `src` (once); resolves when it's ready or has failed. */
export function warmImage(src: string): Promise<void> {
  const existing = images.get(src);
  if (existing) return existing.done;
  const img = new Image();
  img.decoding = "async";
  const entry: Entry = { img, ready: false, done: Promise.resolve() };
  entry.done = new Promise<void>((resolve) => {
    const settle = () => {
      entry.ready = img.complete && img.naturalWidth > 0;
      resolve();
    };
    const decodeThenSettle = () => {
      img.decode().catch(() => {}).then(settle);
    };
    img.addEventListener("load", decodeThenSettle, { once: true });
    img.addEventListener("error", settle, { once: true });
    img.src = src;
    if (img.complete && img.naturalWidth > 0) decodeThenSettle();
  });
  images.set(src, entry);
  return entry.done;
}

export const isImageReady = (src: string) => images.get(src)?.ready ?? false;

/** The image's natural size once it's ready, so pages can reserve its box before it paints. */
export function imageSize(src: string): { width: number; height: number } | null {
  const entry = images.get(src);
  return entry?.ready ? { width: entry.img.naturalWidth, height: entry.img.naturalHeight } : null;
}

/**
 * A copy of the image that paints on its first frame: the already-decoded element itself when it's
 * free, else a clone. Safari loads even a cached image asynchronously when a new <img> is created, so
 * a plain clone can show nothing for its first frames — the whole morph, on a phone.
 */
export function decodedCopy(img: HTMLImageElement): HTMLImageElement {
  const entry = images.get(img.getAttribute("src") ?? "");
  // One DOM node can only be in one place: whoever claims it first gets it, the rest get a clone.
  const free = entry?.ready && !claimed.has(entry.img) && !entry.img.isConnected;
  if (!free) return img.cloneNode(true) as HTMLImageElement;
  const decoded = entry.img;
  claimed.add(decoded);
  // The decoded element is reused: a morph may have left it stretched to fill its frame. Make it an
  // exact stand-in for `img` every time — its attributes and nothing else (class, size, style…).
  for (const { name } of Array.from(decoded.attributes)) if (name !== "src") decoded.removeAttribute(name);
  for (const { name, value } of Array.from(img.attributes)) if (name !== "src") decoded.setAttribute(name, value);
  return decoded;
}

const claimed = new Set<HTMLImageElement>();

/** Frees every decoded image handed out by decodedCopy (call when the copies using them are gone). */
export function releaseDecoded() {
  claimed.forEach((img) => img.remove());
  claimed.clear();
}

/** Resolves once `src` is decoded, or after `timeoutMs`, whichever comes first. */
export function whenImageReady(src: string, timeoutMs: number): Promise<void> {
  return Promise.race([warmImage(src), new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs))]);
}
