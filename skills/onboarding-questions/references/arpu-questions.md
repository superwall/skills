# Onboarding questions that split ARPU

This list ranks questions, not answers. A question is good when its answers separate users who pay
from users who do not, whichever way the answers point. The direction can differ by app. Advanced
users pay more in photo tools and less in health apps, and the question works in both.

The data is 411 apps. All numbers come from `out/concepts.csv` and `out/concept_by_vertical.csv`
(in the research repo; not shipped with this skill).

- **Found / asked.** Apps where the answers split ARPU, over apps that collect the answer and had
  enough data to test it. A skeptic refuted some findings. Those do not count.
- **Strong.** Apps where the finding has medium or high confidence and the skeptic did not weaken it.
- **Spread.** The ARPU of the best answer divided by the ARPU of the worst, inside one paywall
  variant and one currency. The table gives the median across apps.
- **Rule.** Share of findings where the customer has an audience rule on the key today.

## The ranked list

| # | Ask | Found / asked | Strong | Spread, max | Rule | Verticals |
|---|---|---|---|---|---|---|
| 1 | How old are you? | 81 / 83 | 67 | 2.89, 13.1 | 36% | 21 |
| 2 | How did you hear about us? | 42 / 42 | 26 | 2.03, 5.48 | 2% | 17 |
| 3 | What do you do for work? Is this for work, school, or personal use? | 24 / 29 | 18 | 2.64, 7.9 | 22% | 9 |
| 4 | How big is the problem today? (hours lost, symptoms, weight to lose, amount owed) | 52 / 55 | 36 | 1.54, 7.38 | 3% | 19 |
| 5 | What is your main goal? | 79 / 89 | 47 | 1.64, 3.28 | 8% | 21 |
| 6 | By when do you need it? (exam, trip, event, target date) | 11 / 13 | 7 | 1.92, 3.14 | 7% | 6 |
| 7 | Which of these apply to you? Multi-select, and store the count of picks | 44 / 57 | 29 | 1.78, 6.57 | 0% | 18 |
| 8 | Which topic or content do you want? (language, diet, sport, genre) | 69 / 80 | 34 | 1.60, 4.5 | 8% | 18 |
| 9 | Who is this for? (me, partner, kids, family, team) | 12 / 16 | 8 | 1.85, 3.89 | 8% | 8 |
| 10 | How often will you do this? | 24 / 32 | 19 | 1.62, 2.6 | 3% | 12 |
| 11 | Height, weight, and target weight | 10 / 12 | 5 | 1.69, 2.35 | 0% | 3 |
| 12 | Relationship, kids, pregnancy week, child age | 11 / 13 | 4 | 1.57, 5.5 | 15% | 8 |
| 13 | What have you tried before? | 17 / 24 | 12 | 1.54, 2.25 | 0% | 8 |
| 14 | How experienced are you? | 31 / 45 | 19 | 1.42, 3.63 | 8% | 14 |
| 15 | Where do you shop? What do you spend on this today? | 9 / 16 | 6 | 1.72, 2.75 | 10% | 5 |
| 16 | Gender | 36 / 62 | 19 | 1.69, 3.9 | 11% | 14 |

Age, source, and problem size work in almost every app that asks them. Age and work have the largest
spread. Almost no customer has a rule on source, problem size, or pick count, so those are open.

Experience level works in two of three apps that ask it. It is strongest in language apps (6 of 6)
and lifestyle apps (5 of 5). It is a null in four sports apps.

Gender fails in 26 of 62 apps. Ask it in dating (6 of 7, spread 2.47) and in wellness (6 of 7). It
is a null in 10 of 12 health apps.

## Three signals that cost no screen

Store these beside any answer.

- **Count of picks in a multi-select.** 44 of 57 apps. One pick pays least. The count matters more
  than which option the user picks.
- **Effort in onboarding.** 69 of 111 apps, spread 1.61. Long free-text answers, no skipped steps,
  and more seconds in onboarding all mark users who pay more.
- **Permission answers.** 45 of 63 apps, spread 1.64. A user who refuses push or tracking pays 0.38
  to 0.74.

## By category

Each line gives the question, then found / asked, the strong count, and the median spread. Questions
with no strong app are left out. The app count is the number of apps in the category.

**Health and nutrition (41).** Problem size 11/11, 10 strong, 1.42. Age 12/13, 9 strong, 1.74. Source
7/7, 7 strong, 2.25. Goal 11/13, 6 strong, 1.59. Pick count 10/11, 6 strong, 1.66. Who it is for 4/6,
4 strong, 1.47. Diet or condition 10/11, 3 strong, 1.60. Body metrics 4/4, 3 strong, 1.82.

**Productivity and screen time (23).** Age 8/8, 8 strong, 7.03. This is the largest age spread of any
category. Goal 7/8, 5 strong, 1.98. Source 4/4, 4 strong, 2.98. Work 5/5, 3 strong, 3.42. Problem size
7/7, 3 strong, 2.12. What they tried before 4/4, 3 strong, 1.62.

**Lifestyle (30).** Age 8/8, 8 strong, 2.33. Goal 9/12, 5 strong. Pick count 7/8, 5 strong, 2.05.
Frequency 6/6, 5 strong. Problem size 6/6, 4 strong, 1.87. Source 5/5, 4 strong. Experience 5/5, 4
strong, 1.38.

**Fitness (22).** Age 12/12, 8 strong, 3.17. Gender 4/7, 3 strong, 1.37. Goal 5/6, 2 strong, 1.99.
Experience 3/5, 2 strong, 1.97. Source 4/4, 1 strong. Body metrics 4/4, 1 strong.

**Dating and social (21).** Age 8/8, 8 strong, 3.43. Gender 6/7, 5 strong, 2.47. Work 1/1, 2.86.

**Wellness and mental health (21).** Age 8/8, 7 strong, 3.53. Goal 8/9, 5 strong. Problem size 6/8, 5
strong, 1.73. Work 4/4, 4 strong, 3.67. Budget 3/3, 3 strong, 2.52. Source 5/5, 3 strong, 2.37. Pick
count 4/5, 3 strong. Gender 6/7, 3 strong.

**Language learning (10).** Target language 6/6, 6 strong, 1.70. Level 6/6, 4 strong, 1.56. Goal 4/4,
3 strong, 1.86. Target date 3/3, 2 strong, 1.99.

**Education, other (17).** Goal 4/4, 3 strong. Study time 3/4, 3 strong, 2.42. Exam date 3/3, 3
strong, 1.71. Work or school level 2/2, 2 strong, 3.59. What they tried before 2/3, 2 strong.

**Design and creative (20).** Work 3/4, 2 strong, 4.18. Goal 4/4, 2 strong, 2.29. Age 2/2, 1 strong.

**Photo and video (35).** Goal or tool they came for 5/5, 2 strong, 1.62. Work 4/5, 2 strong, 2.07.
Few apps in this category ask anything.

**Sports (17).** Goal 4/4, 3 strong. Which sport 8/9, 3 strong, 1.42. Age 2/2, 2 strong, 3.38. Draft
or season date 1/1, 2.57.

**Music (9).** Pick count 2/2, 2 strong, 2.23. Genre 2/2, 2 strong. Goal 2/2, 2 strong. Age 1/1, 6.17.

**Faith (12).** Age 2/2, 2 strong, 6.54. Problem size 2/2, 2 strong, 1.96. Goal 2/3, 2 strong.

**Games (9).** Age 2/2, 2 strong, 6.0. Who they play with 1/1, 3.42, not yet strong.

**Kids and family (6).** Who it is for, or the user's role in the family, 2/2, 2 strong, 3.46.

**Women's health (5).** Age 1/1, 10.26. Life stage 1/1, 2.81. Journey type 1/1, 2.77.

**Entertainment (14).** Genre 5/5, 3 strong. Age 3/3, 2 strong. Pick count 3/3, 2 strong. Gender 2/3,
2 strong, 2.04.

**Finance (11).** Problem size (amount owed or missed) 2/2, 2 strong, 1.83.

**Business and pro tools (11).** Trade or content type 2/2, 2 strong. Goal 1/1, 2.85. Source 1/1,
2.45. Work 1/1, 2.19.

**Utilities, scanners, AI assistants, travel, news (77 apps).** Almost none ask an onboarding
question. Age worked in the 5 of 6 apps that have it, with spreads of 2.0 to 3.0. The first gain here
is to ask anything at all. Start with age, source, and goal.

## What to ask first

An app with no onboarding questions should add these four, in this order:

1. Age.
2. How did you hear about us?
3. Main goal, as a multi-select, with the pick count stored.
4. The category question from the list above: problem size in health, work in design and
   productivity, target date in education and travel, who it is for in family apps.

102 of 411 apps have no finding from a user attribute at all. The health report says that 21 of its
40 apps send no onboarding answer to Superwall, and most of them ask the questions in the app. For
those apps the work is one `setUserAttributes` call.

## Limits

- An answer that predicts ARPU is not yet a reason to change the paywall. `REPORT.md` section 4 lists
  the tests where the best paywall flips by answer. Only 25 of 721 such tests are confirmed.
- Apps that ask a question differ from apps that do not. The find rates hold for apps that ask.
- A skeptic reviewed 57% of the findings. `out/findings.csv` has the verdict for each.
