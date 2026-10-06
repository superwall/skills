# Craft: writing a flow that primes, finishes, and predicts

## The psychology, and what each principle asks of a screen

| Principle | What it means here | How a screen uses it |
|---|---|---|
| **Self-persuasion** | People believe conclusions they reach more than claims they're told. | Ask a question whose honest answer shows the problem ("Can you remember the most important thing from your last session?"). Never state it for them. |
| **Commitment and consistency** | Small yeses make the next yes easier; people act in line with what they've said about themselves. | Open with easy, identity-affirming questions. Build to the bigger admissions. End with one question whose answer *is* the case for the app ("Be honest: how much of what you pay for do you actually keep?"). |
| **Existing spend as the anchor** | A price is judged against what's already being spent on the problem. | If they already spend (therapy, a gym, tutoring, a coach, other apps), ask how much, then make that investment vivid on the next screen. The app later looks small beside it. The price itself is never mentioned. |
| **Normalising** | A vulnerable answer followed by judgement ends the flow; followed by "you're not alone" it deepens it. | After the answer that admits the problem, a screen that says it's common (true, and framed as common experience). |
| **Curiosity** | An open question pulls attention forward. | "Did you know…" statements: one surprising, true, useful fact tied to the answer just given. |
| **Future pacing** | A goal with a date and a size feels reachable, and worth equipment. | Ask for the target date (adapted to the app's world), then read it back as something concrete: "That's about 26 sessions between now and then." |
| **Effort creates value** | What people build, they value, and effort in onboarding predicts paying (69 of 111 apps). | Let the answers visibly shape what comes next (read-backs, "your plan"), and take a free-text answer where it's natural. Never pad for effort's sake. |
| **Goal gradient** | People speed up as a goal gets close. | A visible, honest progress indicator that moves with every answer. Branches stay short so it never jumps backward or stalls. |
| **Peak–end** | An experience is remembered by its strongest moment and its end. | The last screens are the emotional peak and the promise; demographics come just before, never last. |

## Writing a question

- **One idea**, in the second person, as said aloud: "How often do you see your
  therapist?", not "Session frequency".
- **Short**: a title a thumb can read in one glance (aim for under ~15 words;
  a vivid scenario can run longer: "Something big happens mid-week that you
  want to bring up. What usually happens?").
- **Ask about behaviour and moments, not opinions**: "What usually happens?"
  beats "How important is remembering?".
- **3–6 answers.** Mutually exclusive for single-select. Ordered: scales run
  one direction (low → high or most → least) and keep it across the flow.
- **Answers in the user's voice**: "Honestly… no", "It's usually gone by
  session day", "No rush, it takes what it takes". Lift phrases from reviews.
- **An honest way out** where someone might not fit: "Something else", "I'm
  not sure", "Prefer not to say". Not on every question: a way out on a
  priming question lets people skip the realisation.
- **Ranges, not free numbers**, for anything you'll segment on (age, spend,
  hours). Clean boundaries (18–24, 25–34…), no overlaps, no gaps.
- **Single-select advances on tap** (no Continue button). Multi-select has a
  Continue button that's off until one is picked, and says "Select all that
  apply."
- **Every answer has a stable value** (kebab-case, `"between-jobs"`), and every
  question an attribute key (`work`). Values never change after launch.
- **Data questions stay neutral; priming questions may be vivid.** A question
  can be both: "How much does a session cost you?" is a budget signal and the
  set-up for "the biggest investment you make in yourself".

## Adapting the data questions to the app's world

The data names concepts; the flow asks them in the app's language. Find the
version a user of *this* app would answer without thinking.

| Data question | Adapt it as | Examples |
|---|---|---|
| Age | Ranges; include "Under 18" if minors can use the app. Introduce the demographic block once: "A few quick ones, so [app] fits you." | 18–24 / 25–34 / 35–44 / 45–54 / 55+ |
| Source | Last in the demographic block. Options are the app's real channels plus "A friend" and the category's authority. | Therapy: "My therapist". Fitness: "My trainer". Education: "My teacher / school". |
| Work | "What do you do?" or "Is this for work, school, or you?" | Student / Working / Between jobs / Parent at home / Retired; design tools: Freelancer / In-house / Agency / Student / Hobby |
| Problem size | The unit the user already measures the problem in. | Hours lost a week, weight to lose, amount owed, nights of bad sleep, how long insights last |
| Goal (multi-select + count) | "What brought you here?" as reasons they'd recognise; store the count. | Therapy: what brought you to therapy. Fitness: what you want to change. |
| Target date | The moment the user is working toward, even when the app has no deadline. Make it the *other side* of the goal. | Exam date, trip date, wedding, season start, "When would you like to feel like you're on the other side of it?" |
| Who it's for | Only if the app serves more than one person. | Me / My partner / My kids / My team |
| Frequency | How often they do the underlying thing today. | Sessions a week, workouts a week, study days |
| Tried before | What they do *now* instead; doubles as competitor research. | Nothing / Notes app / A journal / Another app |
| Experience | Only where it works (language, lifestyle); it's a null in sports. | Beginner / Some / Confident |
| Spend today | What they already pay to solve it. Priming and signal at once. | Per session, per month, per class |
| Gender | Only in dating, wellness, fitness, entertainment. Optional, skippable, respectful. | "How do you describe your gender?" Woman / Man / Non-binary / I describe it another way / Prefer not to say |
| Life stage | Only where the app follows one (women's health, family). | Pregnancy week, child's age, trying to conceive |

A read-back turns two answers into one concrete picture. Combine a date with
a frequency ("That's about 26 sessions between now and then"), a problem size
with a year ("That's 150 hours a year"), a spend with a month. Show it only
when both answers exist; otherwise skip the screen.

## Screen types

Design agnostic; name them so the builder knows the job.

| Type | Job | Notes |
|---|---|---|
| **Welcome** | The promise in one line, and one image. | "Your therapy deserves a memory." One button. |
| **Single-select** | Most questions. | Advances on tap. |
| **Multi-select** | Goals, reasons, "which apply". | Store the pick count. |
| **Statement** | A "Did you know…" beat, or a read-back. | One sentence, true; on a full-screen colour it lands as a pause. |
| **Explainer** | The insight after a run of questions: the app's reason to exist. | Headline, one line of body, one image. |
| **Input** | A free-text answer (a name, the thing they're working on). | Sparingly; long answers mark payers, a required text field loses people. |
| **Permission primer** | In-app only: why notifications help, then the system prompt. | Its answer predicts paying (45 of 63 apps). A web funnel can't ask. |
| **Done** | The promise again, and the App Store link. | The last screen; its button opens the App Store URL. |

## Pacing

- First question on the first tap.
- A non-question beat every 2–4 questions: statement, explainer, read-back.
- Group the demographic questions into one late block, source last.
- 15–25 screens; count them and justify each (signal / priming / pacing).
- The final question is the emotional peak ("Be honest: …"), then the promise.

## Branching

- Branch to **skip what doesn't apply** ("It's more about ongoing growth"
  skips the target date) or to **show a read-back only when its inputs exist**.
- Keep branches to 1–2 screens so progress stays honest.
- Write every rule as "after X, if key = value, go to Y", **gating answer
  first**: a user who goes back and changes an earlier answer leaves the old
  later answer in state, and the rules must not trust it.
- Never branch into a dead end or a screen whose copy depends on an answer
  that might be missing; give read-backs a fallback line.

## Statements and explainers

- One sentence for a statement, one headline and one line for an explainer.
- **True.** A known finding (list it under "Claims to verify") or a common
  experience framed as one ("You're not alone — most of what we hear is gone
  within a day" rests on the forgetting curve; it's listed for verification).
- Tied to the answer just given, in its language.
- The explainer after a run of questions names the insight, then says what the
  app does about it in one clause ("Reflective connects your sessions across
  weeks and months, so you can see the themes your memory can't.").

## Images

- One per explainer and the welcome and done screens; none on questions.
- Describe subject, composition and mood in one or two sentences, in the
  app's existing style (from its screenshots): "An open journal on a warm,
  textured background, soft pink and olive shapes; calm, quiet."
- Make the image the *picture of the answer before it* where you can: after
  "How much does a session cost you?", an empty armchair and a cup of tea (the
  investment); after a question about patterns, a small sprout (growth). Then
  the answer can visibly become the image.

## Motion (describe the meaning; `animate-onboarding` builds it)

For each transition that carries meaning, one line on what it conveys:

- **The answer becomes progress**: the chosen answer travels into the progress
  indicator and grows it. The default for questions.
- **The answer becomes the picture**: the chosen answer opens into the next
  screen's image (the price becomes the picture of the investment).
- **The answer becomes the moment**: the chosen answer's colour fills the next
  screen, a statement on it.
- **The moment becomes progress**: the statement's colour collapses into the
  progress indicator.
- **Forgetting**: a screen fades to nothing before an image arrives ("gone
  within a day").
- **A jolt**: a quick cut before "Something big happens…".

Name the idea, not the implementation.
