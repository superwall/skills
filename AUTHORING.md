# Authoring skills

Three skills, deliberately: `superwall` (the CLI, the API, and the app-side
workflows), `superwall-framework` (screens as code, and the rebuild
playbooks), `superwall-editor` (the visual editor). Each is a lean `SKILL.md`
router in the [agent skills](https://agentskills.io) format plus deep
reference files, so it installs into any agent with `npx skills add
superwall/skills`, and an agent finds every playbook one hop from a routing
table in the `SKILL.md`. Do not add a top-level skill for a task; add a
playbook file and a row in the table.

The workflow playbooks are also what the `superwall` CLI composes for the
user's platform and hands to their coding agent headless; the CLI vendors
`superwall` and `superwall-framework` from `main` before each release, so
**this repo is the source of truth and the CLI copy is never edited by hand**.

| Skill                                        | What it does                                                                           | References                                | Driven by                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------ |
| [`superwall-integrate`](superwall-integrate) | Install and configure the SDK in an app for the first time                             | `ios` `android` `expo` `react-native` `flutter` | `superwall integrate`                |
| [`superwall-placements`](superwall-placements) | Add or audit placements at feature gates and route them to campaigns                 | `strategy` + one framework (`ios` `android` `expo` `react-native` `flutter`) | `superwall integrate` (phase 2)      |
| [`superwall-dashboard`](superwall-dashboard) | Create the entitlements, products, and campaigns a placement needs to present          | `setup`                                   | `superwall integrate` (phase 3)      |
| [`superwall-review`](superwall-review)       | Audit an existing setup end to end; `--fix` repairs verified findings                  | `ios` `android` `expo` `react-native` `flutter` | `superwall review [--fix]`           |
| [`superwall-migrate`](superwall-migrate)     | Move an app off RevenueCat, Adapty, or Qonversion                                      | `revenuecat` `adapty` `qonversion`        | `superwall migrate`                  |
| [`superwall-paywall-migrate`](superwall-paywall-migrate) | Rebuild a dashboard (visual editor) paywall as a framework paywall from its `MIGRATION.md` brief; leans on the installed `superwall-framework` skill for the mapping and layout rules | none | `superwall migrate <paywall-id>`, `superwall create --from` |
| [`superwall-screen-migrate`](superwall-screen-migrate) | Rebuild a native screen (SwiftUI, UIKit, Jetpack Compose, Android Views, React Native, Flutter) as a framework surface from its `MIGRATION.md` brief; the reference maps each source construct to the framework and shows the `register()` wiring afterwards | `ios` `android` `react-native` `flutter` | `superwall migrate --screen <path>` |

The toolkit skills — `superwall` (resources, analytics SQL, docs, SDK
triage), `superwall-editor` (the visual editor from the CLI) and
`superwall-framework` (paywalls and funnels as code) — live beside them and
are not composed by the CLI; agents read them directly. `superwall login`
installs everything here into the user's agent and `superwall skills` keeps
it updated.

## Shipping a change

1. Edit the skill here. Verify every API against the live docs (below).
2. In the monorepo, run `bun run skills:vendor` in `packages/cli` (or
   `bun run skills:vendor --from ../../../skills` to vendor an uncommitted
   local checkout while iterating). The vendored copy is committed with the
   CLI change that goes with it, and `tests/core/agent/skill-contracts.test.ts`
   checks it matches `VENDORED_SKILLS` and that every `PLAYBOOKS` path exists.
3. Skill changes and CLI releases ship together: a command rename lands in
   both repos in the same pass (see "Keeping skills in sync").

## How a skill reaches the agent

- **Composed at run time.** `loadBundledSkill(id, reference)` in
  `src/core/agent/skills.ts` (in the monorepo's `packages/cli`) joins `SKILL.md` with exactly the references the
  detected app needs (`FRAMEWORK_REF` in `src/core/agent/actions.ts`;
  placements always adds `strategy`). An Expo agent never sees Swift docs.
  Frontmatter is stripped; a missing reference file is a hard error.
- **Wrapped by the harness.** `prompts/actions/<action>.xml` adds the task
  framing and `[STATUS]` protocol; `prompts/commandments.xml` the guardrails.
  Harness protocol lives there, never in a skill.
- **Or printed.** `superwall integrate|migrate|review --skill` writes the
  composed playbook to stdout for an agent you drive yourself. `integrate
  --skill` is all three phases (integrate → placements → dashboard) in order.
- **Or installed.** `superwall skills` delegates to the `skills` CLI
  (`npx -y skills@latest add …`), which owns locations and agent detection.

## Layout

```
skills/superwall/
  SKILL.md                         router: when to use, the workflow table
  references/<x>.md                CLI, API, ASC, ASA, analytics, docs
  workflows/<job>/playbook.md      the job, ≤ ~80 lines: checklist, flow,
                                   the CLI commands, a Docs access block
  workflows/<job>/<x>.md           the depth — one file per framework or
                                   provider (`strategy.md`, `setup.md` for
                                   the framework-agnostic ones)
skills/superwall-framework/
  SKILL.md                         router with the reference table
  references/migrate-from-*.md     mapping + rebuild playbook, one per source
  references/native/<x>.md         per source framework
```

- Framework and provider file names are the contract: they match the CLI's
  `Integration` values (`ios` for swift, `android`, `expo`, `react-native`,
  `flutter`) or provider slugs, and `PLAYBOOKS` in the CLI's
  `src/core/agent/skills.ts` names each playbook path.
- `SKILL.md` frontmatter is `name` (equal to the directory) and `description`
  written as when-to-use: what the skill does, the situations that activate
  it, and what it is **not** for (pointing at the sibling skill).

### Reference file anatomy, in order

1. One-line context ("You are integrating Superwall into a <X> app.")
2. Lifecycle checklist (markdown checkboxes)
3. Docs access block — always include:
   ```bash
   curl -sL https://superwall.com/docs/llms.txt          # index — find the path
   curl -sL https://superwall.com/docs/{path}.md         # any page as markdown
   ```
4. The steps — verified instructions plus the inline `curl -sL` for each
   step's doc page (baked = fast and offline; fetched = source of truth)
5. Decision points as explicit branches
6. Verify section — build commands, what success looks like
7. Pitfalls — real ones with fixes
8. Deeper docs — the exact URLs used

`> **Important:**` callouts for critical steps; `→ references/x.md` arrows for
routing.

## Content rules

- **Verify every API against live docs before writing it.** Package ids,
  version bounds, signatures, config keys — fetched, not remembered. If a doc
  is ambiguous, write the step and add "confirm against <exact doc url>".
  Never invent sample code for a path with no official doc.
- **Never exaggerate.** Migration skills carry a prominent "what does NOT
  migrate" callout. Paywall designs are rebuilt — as code with the framework
  or in the editor — and the skill says so. Craft guidance (where placements
  go, how many, naming) is introduced as recommended practice, not passed off
  as documentation.
- **Dashboard changes go through the CLI** (`superwall entitlements create …`,
  `campaigns placement …`, `--json` everywhere) — never raw curl when a
  command exists.
- **No harness protocol in skills.** `[STATUS]` lines and report formats come
  from `prompts/`.
- **No customer specifics.** Placeholders are `pk_YOUR_PUBLIC_KEY`,
  `AuthKey_<KEY_ID>.p8`, `<campaignId>`; pitfalls are written generically.

## Keeping skills in sync

Skills quote CLI commands constantly, and the public `superwall` skill
documents this CLI's whole surface. On any command change, sweep:

```bash
grep -rn "superwall <old>" skills                      # this repo
cd <monorepo>/packages/cli && grep -rn "superwall <old>" prompts README.md
```

then `src/core/agent/actions.ts` (action vars, references),
`prompts/actions/*.xml` (task wrappers), and the `superwall` skill's
`references/api.md` here. Smoke the
composition with `superwall <workflow> --skill` in a fixture project of each
affected framework: right reference, no cross-framework leakage, no unresolved
`{{vars}}`.

## Before calling a skill done

- [ ] An agent with only `SKILL.md` + one reference in context could execute it
      flawlessly — no missing steps, no assumed context.
- [ ] Zero unverified API names, or each flagged with its doc URL.
- [ ] Composition tested per framework; grep for leakage.
- [ ] Honesty pass: nothing promises more than the product does.
- [ ] Vendored into the CLI (`bun run skills:vendor`) and `bun run test`
      there is green — `tests/core/agent/skill-contracts.test.ts` checks the
      files the loader expects exist and that the copy matches the lock.
