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
4. **Resume from the entry route.** The first route works out the first
   unanswered question and pushes the path to it before it paints. Push every
   answered question on the way, not only the target: the stack is then the
   one the user built by tapping through, so back and "Start over" work.
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

// Every answered question up to the first unanswered one, or the last
// screen once all are answered. Empty when nothing is answered.
export const resumePath = (answers: Answers): RouteName[] => {
  const unanswered = QUESTIONS.findIndex((question) => answers[question] === undefined);
  if (unanswered === 0) return [];
  if (unanswered === -1) return [...QUESTIONS, "plan"];
  return QUESTIONS.slice(0, unanswered + 1);
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
const focused = useIsFocused();
const { answers } = useAnswers();

const decided = useRef(false);
useLayoutEffect(() => {
  if (decided.current) return;
  const path = resumePath(answers);
  if (focused && path.length === 0) return;
  decided.current = true;
  if (!focused) return;
  for (const route of path) router.push(route, { transition: "none" });
});
```

Why each piece is there:

- **`useLayoutEffect`** runs before the browser paints, so when the answers
  are already known the intro never flashes; `transition: "none"` makes the
  jump instant.
- **No dependency array.** The attributes arrive from the host in a message
  that can land after the first render (a cold webview), so the check runs
  on every render until it has decided.
- **`decided`** makes resuming a one-time decision made while the entry route
  is still the first screen. Once the user moves on (or it has resumed),
  coming back to it with `router.dismissAll()` ("Start over") shows it
  instead of jumping forward again.
- **`push` for each route, not `replace`.** `replace` would make the target
  the only route on the stack: back would do nothing and `dismissAll()`
  would land on the resumed question instead of the start.

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
