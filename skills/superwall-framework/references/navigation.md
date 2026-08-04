# Navigation and multi-page flows

Build multi-page paywalls, onboardings, and funnels with file-based routes
and a stack router. Moving between pages never touches the network — the
whole flow ships together, so there is no page load, no spinner, and no
screen that never arrives.

## Add pages

Every `.tsx` file in `app/` is a page; directories nest the name:

```
app/
├── index.tsx        "index" — every flow starts here
├── plans.tsx        "plans"
├── layout.tsx       wraps every page (the one reserved name)
└── goals/
    ├── index.tsx    "goals"
    └── setup.tsx    "goals/setup"
```

File names are lowercase-kebab and each page default-exports a component.
Components that are not pages go in `components/`, not `app/`.

> **Note:** only the top-level `layout.tsx` is special — a nested
> `goals/layout.tsx` would become a page named `goals/layout`. There are
> no nested layouts.

## Navigate

```tsx
import { useRouter } from "superwall/navigation";

const router = useRouter();

router.push("goals/setup");                    // forward
router.push("plans", { transition: "fade" });  // with a transition
router.replace("terms");                       // swap the current page
router.back();                                 // one step back
router.canGoBack();                            // anything to go back to?
router.dismiss(2);                             // back two steps
router.dismissAll();                           // back to the first page
router.dismissTo("goals");                     // unwind to a page in the stack

router.name;    // current page
router.depth;   // pages underneath (index = 0)
```

The API is expo-router's, method for method. Page names autocomplete and
reject typos (via the generated `superwall.d.ts`).

Rules:

- **Closing the paywall is `useActions().close()`**, not navigation.
- **Fire `haptics.light()` before every push/back** — iOS gives no
  feedback of its own on navigation.
- Pages you navigate away from stay alive: going back restores a page
  exactly as it was left, scroll and state included. A covered page can't
  be clicked or focused; `useIsFocused()` tells a page it's covered so it
  can pause video or timers.
- There is no declared page order — any page can push any page, which is
  what makes branching flows possible.
- Page-view analytics are reported automatically on every navigation;
  there is nothing to instrument.

## Pass state between pages

Navigation carries no params, on purpose. Two homes for cross-page state:

**`layout.tsx`** stays mounted for the whole flow — React state or context
there is visible to every page:

```tsx
export default function Layout({ children }: PropsWithChildren) {
  return <div className="shell"><Chrome />{children}</div>;
}
```

**A plain module** works even after the collecting page is gone — the quiz
pattern (`examples/onboarding-quiz`):

```ts
// components/answers.ts
export const answers: { goal?: Goal; level?: Level } = {};
```

```tsx
const choose = (value: Goal) => {
  haptics.selection();
  answers.goal = value;
  router.push("level");
};
```

Guard every read on the destination (`answers.goal ? PLAN[answers.goal] :
undefined`) — a revisited page must never crash on a missing answer.

## Shared chrome

Put back buttons, step counters, and the close button in `layout.tsx` and
drive them from router state so they can never drift from the stack:

```tsx
const router = useRouter();

{router.canGoBack()
  ? <button onClick={() => { haptics.light(); router.back(); }}>Back</button>
  : <span className="chrome-button" />}      /* placeholder keeps the layout stable */
<span>{router.depth + 1} of 3</span>
```

`depth + 1` works as a step counter only in linear flows — in a branching
flow, label steps per page.

When the layout wraps chrome around the pages, set two variables in
`:root`:

```css
:root {
  --sw-background: var(--bg);   /* pages are opaque; give them your background */
  --sw-routes-height: auto;     /* let the layout own the height, or its footer is pushed off-screen */
}
```

Position overlay chrome absolutely over the pages rather than as a bar
above them — each page paints its own background, so a bar of its own
shows as a seam during transitions.

## Transitions

Built-ins: `push` (iOS-style, the default), `slide`, `fade`, `none`.
Set them at three levels — call site wins, then the page, then the
surface:

```tsx
router.push("plans", { transition: "none" });   // one navigation
export const transition = "fade";               // one page (top of its file)
export default definePaywall({ transition: "slide" });   // whole surface
```

Going forward uses the incoming page's transition; going back uses the
leaving one's — a page always leaves the way it arrived.

Tune the built-ins with CSS variables: `--sw-transition` (500ms),
`--sw-ease`, `--sw-stack-dim` (how much the page behind dims). All motion
respects `prefers-reduced-motion` automatically.

### Custom transitions

A transition is just a name plus CSS. Name it anywhere a transition goes,
then style the four phases — no registration:

```tsx
export const transition = "zoom";
```

```css
@media (prefers-reduced-motion: no-preference) {
  [data-sw-transition="zoom"][data-sw-phase] {
    animation-duration: 420ms;
    animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  [data-sw-transition="zoom"][data-sw-phase="enter"]  { animation-name: zoom-enter }
  [data-sw-transition="zoom"][data-sw-phase="recede"] { animation-name: zoom-recede }
  [data-sw-transition="zoom"][data-sw-phase="leave"]  { animation-name: zoom-leave }
  [data-sw-transition="zoom"][data-sw-phase="return"] { animation-name: zoom-return }
}

@keyframes zoom-enter  { from { transform: var(--sw-from-transform, scale(0.85)); opacity: 0 } }
@keyframes zoom-recede { to   { opacity: 0; transform: scale(1.15) } }
@keyframes zoom-leave  { to   { opacity: 0; transform: scale(0.85) } }
@keyframes zoom-return { from { opacity: 0; transform: scale(1.15) } }
```

| Phase | The page is… |
| --- | --- |
| `enter` | arriving on top |
| `recede` | being covered as you go forward |
| `leave` | dropping off the top as you go back |
| `return` | coming forward again as you go back |

Rules that make custom transitions robust:

- **Always start `from` at `var(--sw-from-transform, <your value>)`** (and
  `--sw-from-filter` for filters). The router fills these with a page's
  live position when a navigation interrupts an animation, so a spammed
  button picks the page up where it stands instead of snapping.
- **Wrap in `prefers-reduced-motion: no-preference`** — with reduced
  motion on, the router settles instantly.
- **Duration comes from your CSS** — the page stays mounted exactly as
  long as its animation runs. Don't declare it twice.
- **Omit phases you don't want** — they simply don't animate (that's how
  `fade` crossfades one layer at a time).

### Bottom sheets over the flow

For a modal-feeling page (a last-chance offer), define a `sheet`
transition: the page slides up while the one behind scales back and dims.
Darken the container behind it in the same motion by reusing the
framework's timing variables (`examples/abandonment-offer` has the full
recipe):

```css
:root { --dim: 0.85; }

[data-sw-routes] {
  transition: background-color var(--sw-transition, 500ms)
    var(--sw-ease, cubic-bezier(0.28, 0.4, 0.08, 1));
}
[data-sw-routes]:has([data-sw-transition="sheet"][data-sw-phase]) {
  background-color: color-mix(in srgb, var(--bg) calc(var(--dim) * 100%), #000);
}
```

One `--dim` number drives both the page's `brightness()` and the backdrop,
so they always match. Dismissing the sheet is `router.back()` — it leaves
the way it came.

## A funnel is one paywall, not several

Multi-step flows — onboarding quizzes, web funnels — are **one paywall
whose steps are pages**, not separate paywalls. Every step is a
`router.push` in the same flow, so there is no load between steps and
nothing to re-fetch. The structure is identical: `config.ts` + `app/`
pages + `layout.tsx`; funnels live in `superwall/funnels/<id>/` with
exactly the same shape. `examples/web-funnel` is the reference: question
steps, a typed plan selector, then `purchase(reference)` — with
[web checkout](checkout.md) in the same document.

## In-page animation

Animation libraries (Motion, CSS) animate *inside* a page; moving
*between* pages stays the router's job — keeping that line means spamming
navigation can never fight your component animations. Gate entry
animations on presentation, not mount
([lifecycle-and-events.md](lifecycle-and-events.md)).

Assets for upcoming pages preload automatically —
[assets.md](assets.md).
