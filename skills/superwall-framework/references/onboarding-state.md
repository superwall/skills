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
4. **Resume from the entry route.** The first route works out the stack the
   user would have built by tapping through (itself, every answered question,
   then the first unanswered one) and calls `router.reset(stack)` in a layout
   effect, once. The framework holds a paywall's first render until the host
   has sent its state, so the answers are already there and the resumed page
   is the first thing that paints: no intro flash, no transition. Back walks
   down the reset stack with the normal transitions, and "Start over" works.
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
import type { RouteName } from "superwall/navigation";

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

export const useAnswers = () => {
  const user = useUser();
  const { setUserAttributes } = useActions();
  const answers: Answers = {
    goal: oneOf(GOALS, user[ATTRIBUTES.goal]),
    level: oneOf(LEVELS, user[ATTRIBUTES.level]),
    time: oneOf(TIMES, user[ATTRIBUTES.time]),
  };
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

The entry route (`app/index.tsx`) resumes:

```tsx
const router = useRouter();
const { answers } = useAnswers();

useLayoutEffect(() => router.reset(resumeStack(answers)), []);
```

Why each piece is there:

- **The answers are there on the first render.** Under a host the
  framework renders nothing until the host's first state (user attributes,
  device, products) has arrived, with a one-second fallback for a host that
  never answers. There is nothing to wait for or re-check.
- **`useLayoutEffect`** runs before the browser paints, so the resumed page
  is the first frame; an effect (`useEffect`) can paint the intro first.
- **`reset`, not `push`.** `reset` lands without a transition and without
  pinning one on the routes, so going back from the resumed page animates
  like any other back. It keeps the entry route mounted, and it reports one
  `page_view` (`entry`) for the resumed page, none for the entry route it
  skipped. Resetting to `["index"]` when nothing is answered changes nothing.
- **The whole stack, not only the target.** `reset(["level"])` would leave
  back with nowhere to go and make "Start over" (`router.dismissAll()`) land
  on the resumed question instead of the start.
- **An empty dependency list.** Resuming is decided once, when the surface
  opens. The entry route stays mounted under the stack, so "Start over"
  lands back on it to answer again instead of jumping forward.

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
  reached directly with its answer known (a deep link) skips itself once,
  on mount, not on every render;
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
