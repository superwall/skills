# Remember answers and resume an onboarding

Any surface that asks more than one question across pages (an onboarding, a
quiz, a survey, a funnel) must survive the user closing it halfway. The next
time it opens, they land on the first question they have not answered, not on
page one. The `onboarding-quiz` example is the reference implementation.

## The rule

1. **Every answer is a user attribute, read and written with
   `useUserAttribute(key, parser)`.** It is `useQueryState`'s API with the
   same parsers: `const [goal, setGoal] = useUserAttribute("onboarding_goal",
   goals)`. Call the setter in the tap handler, before navigating. The host
   SDK persists attributes across presentations and app launches. React
   state, a module variable, `layout.tsx` state and the router all die with
   the paywall, so an answer kept only there is lost when the user closes.
2. **Store the answers, never the position.** No `onboarding_step`, no page
   index. Where the user is follows from which answers exist, and it stays
   right when you reorder, add, branch or cut a question.
3. **The setter re-renders at once.** The paywall's own snapshot updates in
   the same event, so the card is selected on the frame the haptic fires,
   and the next presentation gets the persisted value from the host.
4. **The flow is one function.** `next(route, user)` says where each page
   leads, reading the answers it branches on. The buttons push what it
   returns; nothing else knows the order.
5. **Resume with `entry` and `replayStack`.** `app/layout.tsx` exports
   `entry`, which returns `replayStack(start, next, answered)`: the stack
   the user would have built by tapping through, walking `next` from the
   first screen while each page is answered. The framework calls it once,
   after the host has sent its state and before the first render, and opens
   on that stack: the resumed page is the first thing that paints, nothing
   animates, and nothing outside the stack mounts. Back walks down the
   branch the user actually took, with the normal transitions, and "Start
   over" works.
6. **A question page shows its saved answer as selected** (the hook's
   value), so going back to change one reads as editing, not starting again.

## Values are typed by the parser

Attributes travel as strings. The parser turns one back into a type:
`parseAsStringEnum(options)` gives the union of the options, and
`parseAsInteger`, `parseAsBoolean`, `parseAsArrayOf` the rest. Anything it
cannot read — an option this version no longer offers, a value the app set
under the same key, garbage, an object, the strings `"null"` and `"undefined"` — is `null`,
which a flow treats as unanswered. `.withDefault(value)` reads those as the
default instead and removes `null` from the type. A number or boolean the
app set reads as its string form, so `parseAsInteger` reads an app's `30`.

Attributes cannot be removed from a surface, so the setter takes no `null`
(a `null` at runtime is ignored with a console warning, never stored as
`"null"`). Design "Start over" as answering again, which overwrites, never
as clearing. Writing the value already stored sends nothing.

## Naming

Attributes are what campaigns target and what analytics segment by, so the
keys are a schema, not UI labels:

- stable snake_case, prefixed by the flow: `onboarding_goal`,
  `onboarding_level`, not `goal` (collides with the app's own) or
  `whatAreYouHereFor`;
- values are short enum ids (`"build"`, `"returning"`, `"30"`), never the
  translated copy, which changes per locale and per edit;
- one key per question; never a JSON blob of all answers;
- never rename a key that has shipped: audiences and reports query it. Add a
  new one instead.

## Worked example

A branching quiz: losing fat skips the level question. `components/answers.ts`:

```ts
import { parseAsStringEnum, readAttribute, type UserAttributes } from "superwall/hooks";
import type { RouteName } from "superwall/navigation";

export const GOAL = {
  key: "onboarding_goal",
  parser: parseAsStringEnum(["lose", "build", "endure"]),
};
export const LEVEL = {
  key: "onboarding_level",
  parser: parseAsStringEnum(["new", "returning", "regular"]),
};
export const TIME = { key: "onboarding_time", parser: parseAsStringEnum(["15", "30", "45"]) };

export type Goal = NonNullable<ReturnType<typeof GOAL.parser.parse>>;

export const answersOf = (user: UserAttributes) => ({
  goal: readAttribute(user, GOAL.key, GOAL.parser),
  level: readAttribute(user, LEVEL.key, LEVEL.parser),
  time: readAttribute(user, TIME.key, TIME.parser),
});

// The flow, in one place.
export const next = (route: RouteName, user: UserAttributes): RouteName | undefined => {
  const answers = answersOf(user);
  switch (route) {
    case "index":
      return "goal";
    case "goal":
      return answers.goal === "lose" ? "time" : "level";
    case "level":
      return "time";
    case "time":
      return "plan";
    default:
      return undefined;
  }
};

// Whether the user is past a page. The intro counts once the first question is answered.
export const answered = (route: RouteName, user: UserAttributes): boolean => {
  const answers = answersOf(user);
  switch (route) {
    case "index":
    case "goal":
      return answers.goal !== null;
    case "level":
      return answers.level !== null;
    case "time":
      return answers.time !== null;
    default:
      return false;
  }
};
```

A question page saves, then moves on with the same `next`, given the answer
it just saved:

```tsx
const user = useUser();
const [goal, setGoal] = useUserAttribute(GOAL.key, GOAL.parser);

const choose = (value: Goal) => {
  haptics.selection();
  setGoal(value);
  const to = next("goal", { ...user, [GOAL.key]: value });
  if (to) router.push(to);
};

<button className="choice" aria-pressed={goal === "lose"} onClick={() => choose("lose")}>
```

The layout (`app/layout.tsx`) resumes:

```tsx
import { replayStack, type Entry } from "superwall/navigation";
import { answered, next } from "../components/answers";

export const entry: Entry = ({ user }) =>
  replayStack("index", (route) => next(route, user), (route) => answered(route, user));
```

`app/index.tsx` stays an ordinary page: no effect, no redirect.

Why each piece is there:

- **The answers are there when `entry` runs.** Under a host a flow with
  `entry` renders nothing until the host's first state (user attributes, device,
  products) has arrived, with a three-second fallback for a host that never
  answers, and `entry` runs after that wait, once. It gets `{ user, device,
  params }`; it is not a component, so it takes them as arguments rather
  than calling hooks.
- **It opens on the stack; it does not navigate to it.** The resumed page is
  the first frame, with no transition, and only the routes in the stack
  mount. Going back from it animates like any other back. One `page_view`
  (`entry`) is reported, for the top of the stack.
- **The whole stack, not only the target.** `["level"]` alone would leave
  back with nowhere to go and make "Start over" (`router.dismissAll()`) land
  on the resumed question instead of the start.
- **It cannot loop or overshoot.** `replayStack` stops, with a console
  warning, at a page `next` returns twice, at an empty or non-string name,
  at a name the surface does not have (checked when called from `entry`),
  and past 100 pages, and opens on the last good page. A throw from `next` or `answered` opens on `index`.
- **Route names are typed.** A typo in the stack is a compile error; a stack
  `entry` returns by hand with a wrong runtime name opens on `index` with a
  console warning.
- **A stack in the URL wins.** On a web funnel `?sw_nav=` (history, a
  reload, the return from hosted checkout) decides where the funnel opens,
  and `entry` is not called.
- **`router.reset(stack)` is for mid-flow jumps**, not for opening: it
  replaces the stack the same way, but only after a first route has
  rendered.

## When `entry` runs, and what it is for

- **Only `app/layout.tsx`.** A surface has one root layout; there are no
  nested layouts, and an `entry` exported anywhere else is ignored.
- **The flow is yours.** `next`, `answered` and `answersOf` are the
  example's own functions; `replayStack`, `useUserAttribute` and
  `readAttribute` are the framework's. The framework only calls `entry` with
  `{ user, device, params }` and opens on what it returns.
- **Order of events.** The SDK loads the paywall into its webview, often
  long before it is shown (it preloads at start-up). The paywall pings, the
  host answers with its state, a flow with `entry` renders nothing until then (or
  three seconds, if the host never answers), `entry` runs once, and its stack
  is the first frame. A flow without `entry` never waits. On iOS the SDK
  reveals the webview only after the state is sent, so the wait is unseen.
- **Once per load, not per presentation.** The iOS SDK keeps a loaded
  paywall with its pages, so closing on question four and reopening in the
  same session lands on question four with no `entry` call. The next load
  (a relaunch, a paywall refresh) decides again from the saved attributes.
  Attributes the app sets after the paywall loaded are not seen by
  `entry`; a decision that depends on them goes in the page, where
  `useUserAttribute` re-renders.
- **Pure, and pages only.** StrictMode in development may call it twice. No
  attribute writes, `fetch` or analytics in it; work that should happen
  when a flow opens goes in an effect in `layout.tsx`.
- **Other uses:** a returning user skipping the welcome, one surface opened
  on different pages from different placements (`params`), a shorter flow
  per device or platform.

## Do not

- keep answers only in `useState`, a module variable, `layout.tsx` state,
  context or a store;
- write them with `useActions().setUserAttributes`: it is deprecated, and
  untyped. `useUserAttribute` writes and reads back through the same parser;
- save on "Continue" at the end of the flow, or in a batch at the last
  screen: the user who quits on question four has then saved nothing;
- store `onboarding_step`, `current_page` or a route name as an attribute;
- make every question page redirect itself whenever its attribute exists.
  It reads as resuming but traps the user: back to that page bounces
  forward, and "Start over" can never show it again, since attributes
  cannot be cleared. Resume from the entry route; a page that can be
  reached directly with its answer known (a deep link) belongs in `entry`
  too;
- resume from a `useLayoutEffect` on `index` with `router.reset`: the intro
  mounts (its effects run) only to be replaced, which `entry` avoids;
- read an attribute raw (`user.onboarding_goal === "build"`,
  `user.onboarding_age === 25`): read it through a parser, so a stale or
  foreign value reads as unanswered and a number as a number;
- keep a second, hand-written resume order beside the buttons' order: one
  `next` drives both, or a branching flow resumes down the wrong branch;
- write the visible copy as the value (`"Build muscle"`), or a key that
  only makes sense on screen.

## On a web funnel

A funnel with `checkout` set keeps every answer in the URL with
`useQueryState` as well (fetch the `web-funnels` docs page), because an
in-app browser hands only the URL to Safari. Save each answer as a user
attribute too, so campaigns and analytics see it; the URL carries the
position through the hand-off.
