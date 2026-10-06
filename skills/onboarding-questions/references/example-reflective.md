# Example spec: Reflective discovery funnel

A complete spec, in the format the skill delivers. It's live at
https://getreflective.app/flow/reflective-discovery (a web funnel before
install).

## 1. The app, read

- **What it is:** a therapy companion that turns sessions into private notes,
  summaries and themes over time. Not therapy; supports it.
- **Who it's for:** people in regular talk therapy who want more out of it.
- **Category:** Wellness and mental health (the App Store files it under
  Health & Fitness; map by what the app does, not the store genre).
- **Core promise:** your therapy deserves a memory: keep what you learn, and
  see the patterns over time.
- **The pain, in users' words:** "what did we even talk about last time?";
  re-explaining things already covered; a breakthrough gone by next week;
  something big mid-week forgotten by session day.
- **Moment of value:** the first captured session, summarised.
- **What they already spend:** therapy itself, often $100–$200 a session,
  every week or two. The strongest priming material in the flow.

## 2. The arc

1. **Investment** — why they're in therapy, what they're working toward, how
   often, and what it costs.
2. **Confrontation** — can they remember their last session? Have they lost a
   breakthrough?
3. **Agitation** — re-explaining, what they do now, the mid-week moment.
4. **Pattern blindness** — they can't name their own pattern; the app can.
5. **About you** — age, gender, work, a read-back breather, source.
6. **Resolution** — "how much do you actually retain?", then the promise.

## 3. Screens

Purpose: **S** signal (with the data row), **P** priming, **Pa** pacing.

| # | id | Type | Copy | Answers (value) | Key | Purpose | Branch | Image | Transition out |
|---|---|---|---|---|---|---|---|---|---|
| 1 | welcome | Welcome | **Your therapy deserves a memory.** Capture sessions, revisit insights, and spot patterns that would otherwise fade by next week. Button: Get Started | — | — | P | — | An open journal with faint handwriting, on a warm textured background with soft pink and olive shapes. Calm, private. | The welcome leans back and floats away like a card; the progress bar draws in. |
| 2 | what-brought-you | Multi-select | **What brought you to therapy?** Select all that apply. Button: Continue | Anxiety (anxiety), Relationships (relationships), A big life change (life-change), Understanding myself (self-understanding), Something else (other) | reason, reasonCount | S: goal + pick count (#5, #7); P: identity | — | — | Every picked answer travels into the progress bar, a beat apart; the last one grows it. |
| 3 | something-specific | Single | **Is there something specific you started therapy to work through?** | Yes, one thing in particular (one), A few things (few), It's more about ongoing growth (ongoing) | specific | S: sets up target date (#6); P | ongoing → 5 | — | The answer becomes progress. |
| 4 | target-date | Single | **When would you like to feel like you're on the other side of it?** | In the next 3 months (3-months), Within 6 months (6-months), Within a year (1-year), No rush, it takes what it takes (no-rush) | targetDate | S: target date (#6), the "other side" of therapy | — | — | The answer becomes progress. |
| 5 | session-frequency | Single | **How often do you see your therapist?** | Every week (weekly), Every two weeks (biweekly), About once a month (monthly), I'm just getting started (starting) | frequency | S: frequency (#10); with cost, monthly spend | see §4 | — | Into 6: the answer's colour fills the screen. Otherwise it becomes progress. |
| 6 | sessions-ahead | Statement (read-back) | Eyebrow: Picture it… **That's about {N} sessions between now and then.** Each one is worth remembering. Reflective keeps them all, so you can see how you got there. (Fallback title: Every session between now and then is a step toward it.) | — | — | P: future pacing | — | Full-screen answer colour. | The colour collapses into the progress bar. |
| 7 | session-cost | Single | **How much does a session cost you?** | Under $50 (lt-50), $50–$100 (50-100), $100–$200 (100-200), $200+ (gt-200), Insurance covers it (insurance) | cost | S: budget, strong in wellness (3/3, 2.52); P: existing spend | — | — | The chosen price opens into the next screen's image. |
| 8 | investment-explainer | Explainer | **Therapy is one of the biggest investments you make in yourself.** An hour of your time, your energy, and your money — every single week. It deserves to stick. | — | — | P: the investment made vivid | — | An empty armchair beside a small table with a closed book and a steaming cup. Someone's hour, waiting. | The big picture sinks back; the next question rises slowly. |
| 9 | last-session-recall | Single | **Think about your last session. Can you remember the most important thing you talked about?** | Yes, clearly (clearly), Bits and pieces (bits), Honestly… no (no) | recall | P: self-persuasion; S: problem size (#4) | — | — | The answer's colour fills the screen. |
| 10 | did-you-know-writing | Statement | Eyebrow: Did you know… **Writing down what you learned right after a session helps it stick.** | — | — | P, Pa | — | Full-screen colour. | The colour collapses into the progress bar. |
| 11 | lost-breakthrough | Single | **Ever had a real breakthrough in a session — and lost it by the next week?** | More than once (many), Once or twice (few), I'm not sure (unsure), Never (never) | breakthrough | P; S: problem size | — | — | Everything fades to nothing; a beat of emptiness before the image. |
| 12 | forgetting-explainer | Explainer | **You're not alone — most of what we hear is gone within a day.** The hours after therapy are when insights are freshest. Reflective captures them before life takes over. | — | — | P: normalising after an admission | — | Two cupped hands holding a dandelion seed head, glowing softly. Fragile, precious. | The image lifts away first, then the words. |
| 13 | re-explaining | Single | **Do you spend the first 10 minutes of sessions re-explaining things you've already covered?** | All the time (always), Sometimes (sometimes), Never (never) | reexplain | P; S: problem size | — | — | The answer's colour fills the screen. |
| 14 | did-you-know-notes | Statement | Eyebrow: Did you know… **Walking in with notes from last time lets you pick up where you left off, instead of starting over.** | — | — | P, Pa | — | Full-screen colour. | Into the progress bar. |
| 15 | how-you-remember | Single | **What do you do now to remember your sessions?** | Nothing, really (nothing), Notes on my phone (notes-app), A journal (journal), Voice memos (voice-memos), Another app (other-app) | remembering | S: tried before (#13); competitor research | — | — | A quick cut. |
| 16 | mid-week-moment | Single | **Something big happens mid-week that you want to bring up. What usually happens?** | I remember it (remember), I hope I remember it (hope), It's usually gone by session day (gone) | midweek | P; S: problem size | — | — | The answer's colour fills the screen. |
| 17 | did-you-know-between | Statement | Eyebrow: Did you know… **A lot of therapy's work happens between sessions: in what you notice, try, and remember.** | — | — | P, Pa | — | Full-screen colour. | Into the progress bar. |
| 18 | name-your-pattern | Single | **Could you name the emotional pattern that showed up most for you last month?** | Yes, easily (easily), Maybe, if I thought hard (maybe), No idea (no-idea) | pattern | P: sets up the insight | — | — | The other answers gather into the chosen one as it opens into the image: many weeks, one view. |
| 19 | patterns-explainer | Explainer | **Patterns are invisible one week at a time.** Reflective connects your sessions across weeks and months, so you can see the themes your memory can't. | — | — | P: the app's reason to exist | — | A small two-leaf sprout on a pale background with soft shapes and a thin winding line. Growth, slowly. | Sinks back; the next question rises. |
| 20 | age | Single | **How old are you?** A few quick ones, so Reflective fits you. | Under 18 (under-18), 18–24, 25–34, 35–44, 45–54, 55+ (18-24 … 55-plus) | age | S: #1; wellness 8/8, 3.53 | — | — | Into progress. |
| 21 | gender | Single, skippable | **How do you describe your gender?** Optional. It helps us tailor Reflective to you. | Woman (woman), Man (man), Non-binary (non-binary), I describe it another way (self-described), Prefer not to say (prefer-not-to-say) | gender | S: works in wellness (6/7) | — | — | Into progress. |
| 22 | work | Single | **What do you do?** | Student (student), Working (working), Between jobs (between-jobs), Parent at home (parent-at-home), Retired (retired) | work | S: #3; wellness 4/4, 3.67 | — | — | Into progress. |
| 23 | sessions-a-year | Statement (read-back) | Eyebrow: Almost there **That's about {N} sessions a year worth keeping.** Reflective holds every one of them. (Fallback title: Every session is worth keeping.) | — | — | Pa; P: future pacing | — | Full-screen answer colour. | The colour collapses into the progress bar. |
| 24 | source | Single | **How did you hear about Reflective?** | A friend (friend), My therapist (therapist), TikTok (tiktok), Instagram (instagram), The App Store (app-store), Somewhere else (other) | source | S: #2; 2% of apps have a rule on it | — | — | The page settles; the honest question arrives calmly. |
| 25 | retention | Single | **Be honest: how much of what you pay for therapy do you actually retain?** | Most of it (most), About half (half), Less than half (less) | retention | P: the peak, the case for the app in their words | — | — | The bar fills its last stretch, holds, then gives way. |
| 26 | done | Done | Eyebrow: You're all set **Make every session count.** Download Reflective on the App Store and start your first session whenever you're ready. Button: Start Reflecting → App Store | — | — | — | — | The open journal again, now with a single green leaf resting on its pages. | — |

## 4. Branching

- After **3 something-specific**: if `specific = ongoing` → 5; else → 4.
- After **5 session-frequency**, in order:
  1. if `specific = ongoing` → 7 (checked first: a date left over from before
     they went back and chose ongoing must not count);
  2. if `targetDate = no-rush` → 7;
  3. if `frequency = starting` → 7;
  4. else → 6.
- **6 sessions-ahead:** N = weeks × sessions per week, rounded; weeks: 3-months
  13, 6-months 26, 1-year 52; per week: weekly 1, biweekly 0.5, monthly 12/52.
  If either answer is missing, the fallback title.
- **23 sessions-a-year:** N = sessions per year from `frequency`: weekly 52,
  biweekly 26, monthly 12; `starting` or missing → the fallback title. A beat
  inside the demographic block, so no run of questions passes four (20–22,
  then 24–25).

## 5. Attributes

Sent to Superwall with `setUserAttributes` (carried through the install, since
this is a web funnel).

| Key | Values | Screen | Why |
|---|---|---|---|
| age | under-18, 18-24, 25-34, 35-44, 45-54, 55-plus | 20 | #1 overall; wellness 8/8, 7 strong, 3.53 |
| work | student, working, between-jobs, parent-at-home, retired | 22 | #3; wellness 4/4, 4 strong, 3.67 (the largest in the category) |
| source | friend, therapist, tiktok, instagram, app-store, other | 24 | #2; wellness 5/5, 2.37; almost no one has a rule on it |
| reason, reasonCount | multi; count 1–5 | 2 | goal (#5) and pick count (#7): one pick pays least |
| cost | lt-50, 50-100, 100-200, gt-200, insurance | 7 | budget, wellness 3/3, 2.52 |
| frequency | weekly, biweekly, monthly, starting | 5 | #10; with cost, monthly therapy spend |
| targetDate | 3-months, 6-months, 1-year, no-rush | 4 | #6, 1.92 |
| specific | one, few, ongoing | 3 | gates the date |
| gender | woman, man, non-binary, self-described, prefer-not-to-say | 21 | works in wellness (6/7) |
| remembering | nothing, notes-app, journal, voice-memos, other-app | 15 | tried before (#13) |
| recall, breakthrough, reexplain, midweek, pattern, retention | as listed | 9–25 | problem size (#4) |

## 6. Claims to verify

- "Writing down what you learned right after a session helps it stick."
- "Most of what we hear is gone within a day." (the forgetting curve)
- "A lot of therapy's work happens between sessions."

## 7. The last screen

"Make every session count." → https://apps.apple.com/app/id6760877491

## 8. What the answers are for

They predict who pays and let the team build audiences on them once they reach
Superwall. They are not, by themselves, a reason to change the paywall: that
needs a test that shows the best paywall differs by answer.
