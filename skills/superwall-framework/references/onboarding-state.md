# Remember answers and resume an onboarding

Any surface that asks more than one question across pages (an onboarding, a
quiz, a survey, a funnel) must survive the user closing it halfway. The next
time it opens, they land on the first question they have not answered, not on
page one. The `onboarding-quiz` example is the reference implementation.

## The rule

1. **Save every answer the moment it is given, as a user attribute.**
   `useActions().setUserAttributes({ onboarding_goal: "build" })` in the tap
   handler, before navigating. The host SDK persists attributes across
   presentations and app launches. React state, a module variable,
   `layout.tsx` state and the router all die with the paywall, so an answer
   kept only there is lost when the user closes.
2. **Store the answers, never the position.** No `onboarding_step`, no page
   index. Where the user is follows from which answers exist, and it stays
   right when you reorder, add or cut a question.
3. **Read them back with `useUser()`.** `setUserAttributes` updates the
   paywall's own snapshot immediately, so `useUser()` sees the new value on
   the same render that fires the haptic, and the next presentation gets the
   persisted values from the host.
4. **Resume with `entry`.** `app/layout.tsx` exports `entry`, which returns
   the stack the user would have built by tapping through (the first screen,
   every answered question, then the first unanswered one). The framework
   calls it once, after the host has sent its state and before the first
   render, and opens on that stack: the resumed page is the first thing that
   paints, nothing animates, and nothing outside the stack mounts. Back walks
   down it with the normal transitions, and "Start over" works.
5. **A question page shows its saved answer as selected** (from `useUser()`),
   so going back to change one reads as editing, not starting again.

## Values come back as strings

`setUserAttributes` stringifies every value (`String(value)`): `25` is read
back as `"25"`, `true` as `"true"`, `null` as `"null"`. Compare as strings,
parse numbers with `Number()`, and accept only the values you know, because
the app may have set the same key itself:

```ts
const oneOf = <T extends string>(options: readonly T[], value: unknown): T | undefined =>
  options.find((option) => option === value);
```

Attributes cannot be removed from a surface (an empty or `null` value is
stored as a string), so design "Start over" as answering again, which
overwrites, never as clearing.

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

`components/answers.ts`:

```ts
import { useActions, useUser } from "superwall/hooks";
import type { EntryVariables, RouteName } from "superwall/navigation";

const GOALS = ["lose", "build", "endure"] as const;
const LEVELS = ["new", "returning", "regular"] as const;
const TIMES = ["15", "30", "45"] as const;

export type Goal = (typeof GOALS)[number];
export type Level = (typeof LEVELS)[number];
export type Time = (typeof TIMES)[number];

export type Answers = { goal?: Goal; level?: Level; time?: Time };
export type Question = keyof Answers;

export const ATTRIBUTES: Record<Question, string> = {
  goal: "onboarding_goal",
  level: "onboarding_level",
  time: "onboarding_time",
};

// The question routes, in the order they are asked.
export const QUESTIONS: readonly Question[] = ["goal", "level", "time"];

const oneOf = <T extends string>(options: readonly T[], value: unknown): T | undefined =>
  options.find((option) => option === value);

export const answersOf = (user: EntryVariables["user"]): Answers => ({
  goal: oneOf(GOALS, user[ATTRIBUTES.goal]),
  level: oneOf(LEVELS, user[ATTRIBUTES.level]),
  time: oneOf(TIMES, user[ATTRIBUTES.time]),
});

export const useAnswers = () => {
  const answers = answersOf(useUser());
  const { setUserAttributes } = useActions();
  const save = <Q extends Question>(question: Q, value: NonNullable<Answers[Q]>) =>
    setUserAttributes({ [ATTRIBUTES[question]]: value });
  return { answers, save };
};

// Where the user left off, as a whole stack: the first screen, every
// answered question, then the first unanswered one, or the last screen once
// all are answered.
export const resumeStack = (answers: Answers): RouteName[] => {
  const unanswered = QUESTIONS.findIndex((question) => answers[question] === undefined);
  if (unanswered === 0) return ["index"];
  if (unanswered === -1) return ["index", ...QUESTIONS, "plan"];
  return ["index", ...QUESTIONS.slice(0, unanswered + 1)];
};
```

A question page saves, then moves on:

```tsx
const { answers, save } = useAnswers();

const choose = (value: Goal) => {
  haptics.selection();
  save("goal", value);
  router.push("level");
};

<button className="choice" aria-pressed={answers.goal === "lose"} onClick={() => choose("lose")}>
```

The layout (`app/layout.tsx`) resumes:

```tsx
import type { Entry } from "superwall/navigation";
import { answersOf, resumeStack } from "../components/answers";

export const entry: Entry = ({ user }) => resumeStack(answersOf(user));
```

`app/index.tsx` stays an ordinary page: no effect, no redirect.

Why each piece is there:

- **The answers are there when `entry` runs.** Under a host the framework
  renders nothing until the host's first state (user attributes, device,
  products) has arrived, with a one-second fallback for a host that never
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
- **Route names are typed.** A typo in the stack is a compile error; a name
  that only exists at runtime and is wrong opens on `index` with a console
  warning, and an `entry` that throws opens on `index` too.
- **A stack in the URL wins.** On a web funnel `?sw_nav=` (history, a
  reload, the return from hosted checkout) decides where the funnel opens,
  and `entry` is not called.
- **`router.reset(stack)` is for mid-flow jumps**, not for opening: it
  replaces the stack the same way, but only after a first route has
  rendered.

## When `entry` runs, and what it is for

- **Only `app/layout.tsx`.** A surface has one root layout; there are no
  nested layouts, and an `entry` exported anywhere else is ignored.
- **The logic is yours.** `resumeStack` and `answersOf` are the example's
  own functions, not framework API. The framework only calls `entry` with
  `{ user, device, params }` and opens on what it returns.
- **Order of events.** The SDK loads the paywall into its webview, often
  long before it is shown (it preloads at start-up). The paywall pings, the
  host answers with its state, the framework renders nothing until then (or
  one second, if the host never answers), `entry` runs once, and its stack
  is the first frame. On iOS the SDK reveals the webview only after that.
- **Once per load, not per presentation.** The iOS SDK keeps a loaded
  paywall with its pages, so closing on question four and reopening in the
  same session lands on question four with no `entry` call. The next load
  (a relaunch, a paywall refresh) decides again from the saved attributes.
  Attributes the app sets after the paywall loaded are not seen by
  `entry`; a decision that depends on them goes in the page, where
  `useUser()` re-renders.
- **Pure, and pages only.** StrictMode in development may call it twice. No
  `setUserAttributes`, `fetch` or analytics in it; work that should happen
  when a flow opens goes in an effect in `layout.tsx`.
- **Other uses:** a returning user skipping the welcome, one surface opened
  on different pages from different placements (`params`), a shorter flow
  per device or platform.

## Do not

- keep answers only in `useState`, a module variable, `layout.tsx` state,
  context or a store;
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
- compare an attribute to a number or boolean (`user.onboarding_age === 25`
  is always false; it is `"25"`);
- write the visible copy as the value (`"Build muscle"`), or a key that
  only makes sense on screen.

## On a web funnel

A funnel with `checkout` set keeps every answer in the URL with
`useQueryState` as well (fetch the `web-funnels` docs page), because an
in-app browser hands only the URL to Safari. Save each answer as a user
attribute too, so campaigns and analytics see it; the URL carries the
position through the hand-off.
