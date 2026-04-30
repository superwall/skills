# sw-editor.sh CLI reference

The CLI is a thin bash wrapper over the Superwall editor relay. It speaks the same public HTTP surface the MCP gateway uses, authenticated by a short-lived controller token issued during attach. Tool definitions come from the browser — **never hardcode tool names, always run `tools` first** when unsure.

## Prerequisites

- `curl` and `jq` installed (both present by default on macOS/Linux, or one `brew install jq` away).
- For `expose`: a `SUPERWALL_API_KEY` with read access to the paywall.
- For manual `attach`: a live browser editor session with a visible pairing code.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `SUPERWALL_EDITOR_BASE_URL` | `https://superwall-mcp.superwall.com` | Relay base URL. Override for custom environments. |
| `SUPERWALL_EDITOR_WEB_URL` | `https://superwall.com/editor/` | Editor URL used by `expose`. Override only when the user provides a custom editor URL. |
| `SUPERWALL_API_KEY` | unset | Org API key used by `expose` / `wait-expose`. Also read from this skill `.env`, sibling `superwall/.env`, or `~/.superwall-cli/.env`. |
| `SUPERWALL_STATE_DIR` | `$PWD/.superwall` | Where to store attachment state. |

## State file

`${SUPERWALL_STATE_DIR}/state.json`, chmod 600. Holds `{sessionId, controllerToken, baseUrl, transportSessionId, attachedAt}`. Treat it as an opaque implementation detail — never read `sessionId` out of it when communicating with the user, never echo `controllerToken` anywhere. The CLI's `status` and `whoami` commands already strip these.

## Commands

### expose

```
sw-editor.sh expose --application-id <id> --paywall-id <id> --agent-name <name> [--open] [--wait]
```

Creates a short-lived editor launch URL through the relay API. Opening the URL loads the editor for that paywall and auto-exposes the browser session; the user only completes normal browser authorization if prompted. Launch creation and polling require `SUPERWALL_API_KEY`; the browser-side ready call uses only the short-lived launch token embedded in the URL. `--agent-name` is required so the editor can show which agent is attached.

Use `--open --wait` for the smoothest flow. The CLI opens the browser, polls the launch, and writes controller state once the editor connects.

Example:

```bash
sw-editor.sh expose --application-id 5 --paywall-id 28 --agent-name codex --open --wait
```

### wait-expose

```
sw-editor.sh wait-expose <launch-id> [--timeout <seconds>]
```

Polls a launch created by `expose` until the browser editor auto-exposes and the CLI receives a controller token. Useful when `expose` was run without `--wait`.

### attach

```
sw-editor.sh attach <pairing-code> [--agent-name <name>]
```

Exchange the single-use pairing code for a controller token and cache it locally. The pairing code is consumed on success; if you fail (bad code, expired code, editor disconnected, another client attached), the user needs to refresh the editor UI for a new one.

On success the response carries the browser's full tool list — but the CLI prints only a count. Run `tools` for details.

### tools

```
sw-editor.sh tools
```

Prints `{toolDefinitions: [{name, description, parameters}], metadata}` as JSON. Always run this before calling an unfamiliar tool. Tool shapes can change when the editor ships.

### call

```
sw-editor.sh call <tool-name> [--args '<json>']
```

Invokes a tool in the browser. `--args` must be valid JSON (defaults to `{}`). Prints the `CallToolResult` (`{content, isError, ...}`). Exits 1 when `isError: true`.

Example:

```bash
sw-editor.sh call write_html --args '{"targetNodeId": "page:page", "position": "append", "html": "<h1>Hello</h1>"}'
```

### status

```
sw-editor.sh status
```

Prints session status (browser connectivity, pairing code freshness, metadata). Internal IDs are stripped from the output.

### release

```
sw-editor.sh release
```

Notifies the relay, clears local state. Call when the user says they're done, or before attaching to a different session.

### whoami

```
sw-editor.sh whoami
```

Prints `{attached, baseUrl, attachedAt}` — no internal identifiers. Useful for confirming whether a session is cached.

## Attach / call / release flow

```
┌────────────────┐  pairingCode  ┌────────────────┐
│  Editor UI     │ ────────────► │  User          │
│  (browser)     │               └────────────────┘
└────────────────┘                       │ reads code aloud
                                          ▼
                               ┌────────────────┐ POST /editor-sessions/claim
                               │  sw-editor.sh  │ ────────────────────────┐
                               │  attach        │                         │
                               └────────────────┘                         ▼
                                        ▲                        ┌───────────────┐
                                controllerToken                  │  Relay DO     │
                                        │                        │  (per session)│
                               ┌────────────────┐                └───────────────┘
                               │  sw-editor.sh  │ Authorization: Bearer ▲
                               │  call/tools/…  │ ──────────────────────┘
                               └────────────────┘
```

The controller token dies when the session expires or when `release` is called. Re-attach with a fresh pairing code, or create a fresh `expose` launch, to get a new token.
