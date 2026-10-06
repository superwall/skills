# The engine on the superwall framework

These files are copied verbatim from the `animated-onboarding` example in the
superwall monorepo (`superwall create --example animated-onboarding` gives the
whole project: pages, theme, assets, messages). In that project they live at:

| here | there |
| --- | --- |
| `flow.ts` | `components/flow.ts` — route → hand-off, progress fraction, image |
| `Question.tsx` | `components/Question.tsx` — a question page; releases its commit lock on focus |
| `useStoryRouter.ts` | `components/motion/useStoryRouter.ts` — `push` / `back` inside the hand-off |
| `handoffs.ts` | `components/motion/handoffs.ts` — the engine |
| `../morphFrame.ts` | `components/motion/morphFrame.ts` — the one-geometry morph, with `mount` |
| `../imageReady.ts` | `components/motion/imageReady.ts` — decoded images, for Safari |
| `motion.css` | `app/motion.css` — exits and entrances on the router's phases |
| `layout.tsx` | `app/layout.tsx` — chrome, progress bar, the motion layer |

So `handoffs.ts` imports `../flow`, `./imageReady` and `./morphFrame` relative
to that layout, not to this folder. Copy them into the same places in the
user's surface and the imports hold.

What each page needs, beyond these: `export const transition = "story-<handoff>"`,
a `<main data-flow-page>` root, `data-flow-line` on each line of copy,
`data-flow-image` on the hero, `data-flow-backdrop` on a statement's colour
layer, `data-next-button` on the primary button; answers through `Question`
(or any button with `data-flow-option` / `data-selected` / `data-committing`).
The verified flow: cover → `begin` → question → `kept` → question → `flood` →
statement → `absorb` → question → `picture` → insight → `finish` → end, each
one also played backwards. The other ten of the catalog (`connect`, `inward`,
`slip`, `fade`, `gone`, `blank`, `again`, `jolt`, `cadence`, `settle`) are
built in the same files with the catalog's values (handoffs.md), so a page
can name any of them; `connect` was verified both ways too.

One thing the router changes about Jake's engine: the leaving page is not a
throwaway clone, it stays mounted and comes back on Back. So anything the
script animates on that page's own elements (connect's gathering answers) is
`park`ed: held at its end frame until the hand-off is over, then cancelled,
never left with `fill: both`.
