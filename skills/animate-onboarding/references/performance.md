# Performance

"It's choppy, weird artefacts everywhere, not premium" was the first reaction
to a version that used View Transitions and blur everywhere. It ran at 15fps.
Premium motion is smooth motion first.

## What may animate

| Property | Verdict |
|---|---|
| `transform`, `opacity` | Yes. Composited; nothing re-rasterises. |
| `filter: blur()` | Only on one element at a time: the A → B morph frame's outer wrapper (5px peak), never on text blocks, whole pages or lists. |
| `backdrop-filter` | Never on something that moves. Drop frosted-glass backgrounds on answers in the animated flow (over a soft gradient the difference is barely visible). |
| `clip-path` | Sanctioned for one element at a time: the A → B morph frame's clipper, its only outline (reshapes it without squashing corners). Not for page-wide wipes or reveals. |
| `width`, `height`, `top`, `left` | No. Progress fills slide with `translateX` inside an `overflow: hidden` track. |
| View Transitions (`document.startViewTransition`) | No, for page hand-offs: snapshot artefacts, stretched morphs, full-page re-compositing. |

Also:
- Keep simultaneous animated layers modest (tens, not hundreds).
- Clones are cheap; blur on a big clone is not.
- Don't animate CSS custom properties on a parent to drive children; write the
  transform on the element.

## Diagnosing "it's slow"

1. **Judge a production build**, not the dev server (unminified React,
   StrictMode double effects). Serve the build on an unused port
   (`vite preview --port <free> --strictPort --host 0.0.0.0`).
2. **Compare against the old motion** on the same build (`?motion=classic`).
   If both are slow, it isn't your motion.
3. **Check the browser's GPU.** In Chrome/Dia/Arc, open `chrome://gpu`. If it
   says *Compositing: Software only* or *GPU process was unable to boot: GPU
   access is disabled due to frequent crashes*, every page is being drawn on
   the CPU (at 5K on a 2× display that caps any animation near 20–25fps).
   A full browser restart clears the crash block; a disabled flag such as
   Skia Graphite may be the cause (reset it in `chrome://flags`). Recheck
   that Compositing and Rasterization say *Hardware accelerated*.
4. Only then optimise the page, starting with anything on the "no" list above.

Real users (mostly phones from ads) have working GPUs; don't strip the design
for one broken browser, but do make it transform/opacity-only regardless.
