---
name: superwall-editor
description: LEGACY — drives the browser (visual) paywall editor over a pairing code. For any screen an agent builds, use superwall-framework instead (paywalls, onboarding, update-required, lifecycle prompts, announcements, offers and web flows, as React code); to move an existing editor paywall onto it, run `superwall migrate <paywall-id>`. Use this skill only when the user explicitly wants to edit inside the visual editor, or to read an editor paywall before migrating it. Covers attach/call/release, native sw-* elements and the editor tool surface.
---

# Superwall Paywall Editor

> [!WARNING]
> **LEGACY. For agents, the visual editor is the second choice.** Any screen
> an agent builds (a paywall, an onboarding, an update-required screen, a
> lifecycle prompt, an announcement, an offer, a web flow) belongs in the
> **superwall framework**: a React mini-app in the user's repo, reviewed as
> code, localized from message files, previewed in the studio on every
> device, and shipped with `superwall push` / `promote`. Use the
> `superwall-framework` skill. If it isn't installed:
>
> ```bash
> npx skills add https://github.com/superwall/skills/tree/next --skill superwall-framework --global --yes --agent claude-code universal --full-depth
> ```
>
> The framework is on the `next` channel: the CLI has its commands only
> while `SUPERWALL_CHANNEL=next` is set (an `Unknown command: create` means
> it is missing; ask the user to set it in their shell rc and relaunch).
>
> **An editor paywall moves over in one command:**
>
> ```bash
> superwall migrate <paywall-id>
> ```
>
> It scaffolds the paywall as code, briefs the rebuild (the framework
> skill's `references/migrate-from-editor.md` is the playbook), and shows
> the original beside the new one in the studio (Compare › Original). The
> original keeps serving until a campaign is switched to the new one, so
> nothing changes for users until then.
>
> **What to do here:**
>
> - Asked to build any new screen: build it with the framework, not here.
> - Asked to change an editor paywall: offer the migration first, in one
>   line, saying what it gains (code review, localization files, any
>   component library, the same studio for every screen). If the user
>   says no or wants a quick edit in place, continue with this skill.
> - Never migrate unprompted, and never refuse an explicit editor request.

Paywalls are built in a browser editor that exposes its tools over an authenticated relay. This skill drives the same surface used by the MCP gateway, so every tool runs inside the live browser session the user has open.

## When to use

- The user wants to build, edit, or review a Superwall paywall, onboarding, or web2app flow.
- The user pastes a pairing code and asks you to take over editing.
- The user asks "what tools can you run right now?" Discover them via the browser, not from memory.

## Start here: attach, then discover

Never assume a tool name or signature from memory. The browser is the source of truth and its tool set changes across releases.

Preferred API launch flow:

1. Create an auto-expose URL: `scripts/sw-editor.sh expose --application-id <id> --paywall-id <id> --agent-name <agent> --open --wait`
2. Ask the user to complete browser authorization if prompted. The editor auto-exposes; do not ask them to click the expose button.
3. Discover what is available right now: `scripts/sw-editor.sh tools`
4. Invoke tools: `scripts/sw-editor.sh call <tool-name> --args '<json>'`

Fallback manual flow:

1. Ask the user for the **pairing code** shown in the editor UI.
2. Attach: `scripts/sw-editor.sh attach <pairing-code>`
3. Continue with `tools` and `call`.

Full CLI reference: [references/cli.md](references/cli.md).

## How to build and edit

- Workflow, build order, and when to use which tool: [references/workflow.md](references/workflow.md)
- Native `sw-*` elements (multiple-choice, indicator, drawer, picker, lottie, navigation): [references/native-elements.md](references/native-elements.md)
- Design standards, review checkpoints, typography, and conversion principles: [references/design.md](references/design.md)

## Orchestration rules

- Always establish an attachment before editing. Use `expose --open --wait` when possible, otherwise use `attach <pairing-code>`. `tools`, `call`, `status`, `release` all require an attached session.
- Prefer `expose --open --wait` when you have `SUPERWALL_API_KEY`, an application id, and a paywall id. It uses the same relay as manual pairing but removes the human pairing-code step.
- Before calling a tool you have not used this session, run `tools` to confirm it exists and to read the current parameter schema. Tools are defined in the browser bundle, so an updated editor can ship new or renamed tools without changing this skill.
- Use `get_screenshot` (if present in the tool list) every two or three modifications to verify. Don't fly blind.
- Prefer semantic tools (`update_styles`, `set_text_content`, `set_dynamic_value`, `move_nodes`) over re-running `write_html` on existing structure. See `references/workflow.md`.
- Prefer native `sw-*` elements over hand-rolled `<div>` recreations whenever the UI represents a semantic control. See `references/native-elements.md`.
- When parsing CLI output, use `jq`, not Python. Example: `sw-editor.sh call get_subtree --args '...' | jq -r '.content[0].text'`
- Release when the user is done: `scripts/sw-editor.sh release`.

## When things go wrong

- `session_not_ready`: the browser disconnected or reloaded. Ask the user to bring the editor tab back, then re-attach. The pairing code rotates, so they must provide the new one.
- `session_locked`: another client is already attached. The user either attached from another MCP client, or a previous CLI attachment wasn't released. They can detach from the editor UI and you can retry.
- `unauthorized`: the controller token is stale. Re-attach with a fresh pairing code.
- `attach_failed: provide a valid current pairingCode`: pairing codes expire after ~10 minutes and rotate on detach. Ask the user to show you the current one.

## Report what's broken

When you confirm an editor tool misbehaves (wrong result, a crash, a schema
that doesn't match `tools`, a doc here that's wrong), report it yourself:
write it with every ID needed to reproduce it, tell the user in one line,
send on their yes (or straight away if they've said you may). Strip secrets
and customer data.

```bash
superwall feedback "Called X with Y; expected Z; got W." --title "..." \
  --kind bug --command "sw-editor.sh call <tool>" --app <id> \
  --context paywall=<id> --file error.json --json
```
