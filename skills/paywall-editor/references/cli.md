# sw-editor.sh CLI reference

The CLI is a thin bash wrapper over the Superwall editor relay. It speaks the same public HTTP surface the MCP gateway uses, authenticated by a short-lived controller token issued during attach. Tool definitions come from the browser — **never hardcode tool names, always run `tools` first** when unsure.

## Prerequisites

- `curl` and `jq` installed (both present by default on macOS/Linux, or one `brew install jq` away).
- A live browser editor session with a visible pairing code.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `SUPERWALL_EDITOR_BASE_URL` | `https://superwall-mcp.superwall.com` | Relay base URL. Override for staging/local dev. |
| `SW_EDITOR_STATE_DIR` | `$PWD/.sw-editor` | Where to store attachment state. |

## State file

`${SW_EDITOR_STATE_DIR}/state.json`, chmod 600. Holds `{sessionId, controllerToken, baseUrl, transportSessionId, attachedAt}`. Treat it as an opaque implementation detail — never read `sessionId` out of it when communicating with the user, never echo `controllerToken` anywhere. The CLI's `status` and `whoami` commands already strip these.

## Commands

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

The controller token dies when the session expires (~1 hour) or when `release` is called. Re-attach with a fresh pairing code to get a new token.
