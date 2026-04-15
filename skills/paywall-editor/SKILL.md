---
name: paywall-editor
description: Build and edit live Superwall paywalls from the CLI. Attach to a running browser editor session using a pairing code, list the tools the browser exposes right now, and invoke them. Covers native sw-* elements, editing workflow, design standards, and the attach/call/release lifecycle. Use whenever the user wants to design, build, modify, or review a Superwall paywall, onboarding, or web2app flow.
---

# Superwall Paywall Editor

Paywalls are built in a browser editor that exposes its tools over an authenticated relay. This skill drives that relay from the CLI — the exact same surface the MCP gateway uses — so every tool you invoke runs inside the live browser session the user has open.

## When to use

- The user wants to build, edit, or review a Superwall paywall, onboarding, or web2app flow.
- The user pastes a pairing code and asks you to take over editing.
- The user asks "what tools can you run right now?" — discover them via the browser, not from memory.

## Start here: attach, then discover

Never assume a tool name or signature from memory. The browser is the source of truth and its tool set changes across releases.

1. Ask the user for the **pairing code** shown in the editor UI.
2. Attach: `scripts/sw-editor.sh attach <pairing-code>`
3. Discover what is available right now: `scripts/sw-editor.sh tools`
4. Invoke tools: `scripts/sw-editor.sh call <tool-name> --args '<json>'`

Full CLI reference: [references/cli.md](references/cli.md).

## How to build and edit

- Workflow, build order, and when to use which tool: [references/workflow.md](references/workflow.md)
- Native `sw-*` elements (multiple-choice, indicator, drawer, picker, lottie, navigation): [references/native-elements.md](references/native-elements.md)
- Design standards, review checkpoints, typography, and conversion principles: [references/design.md](references/design.md)

## Orchestration rules

- Always `attach` before anything else. `tools`, `call`, `status`, `release` all require an attached session.
- Before calling a tool you have not used this session, run `tools` to confirm it exists and to read the current parameter schema. Tools are defined in the browser bundle — an updated editor ships new or renamed tools without any change to this skill.
- Use `get_screenshot` (if present in the tool list) every 2–3 modifications to verify. Don't fly blind.
- Prefer semantic tools (`update_styles`, `set_text_content`, `set_dynamic_value`, `move_nodes`) over re-running `write_html` on existing structure. See `references/workflow.md`.
- Prefer native `sw-*` elements over hand-rolled `<div>` recreations whenever the UI represents a semantic control. See `references/native-elements.md`.
- Release when the user is done: `scripts/sw-editor.sh release`.

## When things go wrong

- `session_not_ready`: the browser disconnected or reloaded. Ask the user to bring the editor tab back, then re-attach (the pairing code rotates — they'll need to read you the new one).
- `session_locked`: another client is already attached. The user either attached from another MCP client, or a previous CLI attachment wasn't released. They can detach from the editor UI and you can retry.
- `unauthorized`: the controller token is stale — re-attach with a fresh pairing code.
- `attach_failed: provide a valid current pairingCode`: pairing codes expire after ~10 minutes and rotate on detach. Ask the user to show you the current one.
