# Assets

Add images, video, audio, fonts, and animations to a paywall by importing
files from an `assets/` directory. The build handles optimization, hosting,
and caching — there is nothing to configure.

## Use an image

```tsx
import hero from "@/assets/hero.jpg";          // shared: superwall/assets/
import badge from "../assets/badge.png";        // this paywall's own: paywalls/<id>/assets/

<img src={hero} alt="" />
```

CSS `url()` works the same way. Supported out of the box: `png jpg jpeg
webp avif gif svg ico apng`, video `mp4 webm mov m4v`, audio `mp3 m4a aac
wav ogg`, fonts `woff2 woff ttf otf`, and `lottie riv glb`, plus
`?url` / `?raw` / `?inline` imports and CSS modules.

> **Important:** every asset belongs in an `assets/` directory —
> `superwall/assets/` for files shared across surfaces,
> `superwall/paywalls/<id>/assets/` for one paywall's own. The build fails
> and names the file if a large asset lives anywhere else.

Imports typecheck because of the generated `superwall.d.ts` — commit it.

## Use a video

```tsx
import promo from "../assets/promo.mp4";

<video src={promo} autoPlay muted loop playsInline />
```

Video, audio, and fonts are served from Superwall's CDN rather than
embedded in the paywall, whatever their size — video streams properly and
one upload is reused across every version of every paywall. Images embed
when small and move to the CDN when large; you never choose, and nothing
about the code changes either way.

## Use a custom font

A relative-path `@font-face` is the whole setup:

```css
@font-face {
  font-family: "Manrope Custom";
  font-display: swap;
  font-weight: 200 800;
  src: url("../assets/manrope-latin.woff2") format("woff2-variations");
}

:root { --sans: "Manrope Custom", ui-sans-serif, system-ui, sans-serif; }
```

- **Subset before you ship.** A full variable font carries alphabets the
  paywall will never render — latin-only Manrope is ~24 kB against ~90 kB
  for the whole family.
- **Ship woff2.** Anything older is bytes for nothing you support.
- **Google Fonts go in a CSS `@import`**, at the top of the stylesheet —
  never React-rendered `<link>` tags. The stylesheet ships in the page
  itself, so the browser finds the `@import` immediately; a rendered link
  waits for JavaScript and the text flashes.
- One family plus one mono is a good budget.

`examples/custom-fonts` shows a local file and a Google Fonts import side
by side.

## Use Lottie

Two ways, with different trade-offs:

```tsx
// 1. Animation JSON — embedded in the paywall. Offline-proof, zero requests.
//    Best for small animations.
import spinner from "@/assets/spinner.json";

// 2. A .lottie file — served from the CDN and pre-cached on device by the
//    SDK before the paywall opens. Best for bigger animations.
import intro from "@/assets/intro.lottie";
```

## Use Rive

`.riv` files load like any asset, plus one required setup step:

```tsx
import { useRive, RuntimeLoader } from "@rive-app/canvas";
import riveWasm from "@rive-app/canvas/rive.wasm?url";
import smiley from "../assets/smiley.riv";

RuntimeLoader.setWasmUrl(riveWasm);
RuntimeLoader.setWasmFallbackUrl(null);

const { RiveComponent } = useRive({ src: smiley, stateMachines: "State Machine 1", autoplay: true });
```

> **Important:** Rive fetches its WebAssembly engine from a CDN by
> default, and published paywalls cannot reach external CDNs. Bundle the
> wasm with the `?url` import as above and null the fallback so a failure
> stays loud. Also pass the file's **real state-machine name** — naming
> one that doesn't exist leaves a blank canvas and no error.

See `examples/with-rive`.

## Multi-page flows

Nothing to do — the next pages' images, video, and fonts warm
automatically while the user is on the current page, and `.lottie`/`.riv`
files are pre-cached on device by the SDK before the paywall even opens.

## Keep it light

- Big imagery is fine — it is served from the CDN and cached, not carried
  by the paywall itself.
- Compress and size media for a phone screen; every open pays for what the
  paywall loads.
- Pushing files over 50 MB warns (every future clone of the source pays
  for them) but nothing is capped.
