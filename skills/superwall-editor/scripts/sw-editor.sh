#!/usr/bin/env bash
set -euo pipefail

DEFAULT_BASE_URL="https://superwall-mcp.superwall.com"
BASE_URL="${SUPERWALL_EDITOR_BASE_URL:-$DEFAULT_BASE_URL}"
STATE_DIR="${SUPERWALL_STATE_DIR:-$PWD/.superwall}"
STATE_FILE="${STATE_DIR}/state.json"

usage() {
  cat <<'EOF'
sw-editor.sh — drive a live Superwall paywall editor session from the CLI.

Commands:
  attach <pairing-code> [--agent-name <name>]
      Attach to the editor session whose pairing code is shown in the UI.
      Writes session state to .superwall/state.json in the current directory.

  tools
      List every tool the browser currently exposes. Call this first before
      invoking an unfamiliar tool — the list is dynamic and reflects the
      browser build that is connected right now.

  call <tool-name> [--args '<json>']
      Invoke a tool. Args must be valid JSON. Prints the tool result.
      Exits non-zero when the tool reports isError: true.

  status
      Print the current session status (browser connectivity, metadata).

  release
      Detach from the editor session and drop local state.

  whoami
      Print the current attachment info (without leaking sessionId or token).

Env:
  SUPERWALL_EDITOR_BASE_URL   Default: https://superwall-mcp.superwall.com
  SUPERWALL_STATE_DIR         Default: $PWD/.superwall
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: '$1' is required" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd jq

ensure_state_dir() {
  mkdir -p "$STATE_DIR"
  chmod 700 "$STATE_DIR" 2>/dev/null || true
  [[ -f "$STATE_DIR/.gitignore" ]] || printf '*\n' > "$STATE_DIR/.gitignore"
}

write_state() {
  ensure_state_dir
  printf '%s' "$1" > "$STATE_FILE"
  chmod 600 "$STATE_FILE" 2>/dev/null || true
}

require_state() {
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "Error: not attached. Run 'sw-editor.sh attach <pairing-code>' first." >&2
    exit 1
  fi
}

state_field() {
  jq -r --arg field "$1" '.[$field] // empty' "$STATE_FILE"
}

_request() {
  local method="$1" path="$2" body="${3:-}"
  local state_base
  state_base="$(state_field baseUrl)"
  local url="${state_base:-$BASE_URL}${path}"
  local token
  token="$(state_field controllerToken)"

  local args=(-sS -X "$method" -w '\n%{http_code}')
  if [[ -n "$token" ]]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi

  local response
  response="$(curl "${args[@]}" "$url")"

  HTTP_STATUS="${response##*$'\n'}"
  HTTP_BODY="${response%$'\n'*}"
}

_request_anon() {
  local path="$1" body="$2"
  local url="${BASE_URL}${path}"

  local response
  response="$(curl -sS -X POST -H "Content-Type: application/json" \
    -d "$body" -w '\n%{http_code}' "$url")"

  HTTP_STATUS="${response##*$'\n'}"
  HTTP_BODY="${response%$'\n'*}"
}

fail_on_non_2xx() {
  if [[ "$HTTP_STATUS" != 2* ]]; then
    local msg
    msg="$(echo "$HTTP_BODY" | jq -r '.error // .message // empty' 2>/dev/null || true)"
    if [[ -z "$msg" ]]; then
      msg="HTTP $HTTP_STATUS"
    fi

    if [[ "$msg" == session_expired* || "$msg" == session_not_found* || "$msg" == session_terminated* || "$msg" == unauthorized* ]]; then
      if [[ -f "$STATE_FILE" ]]; then
        rm -f "$STATE_FILE"
        rmdir "$STATE_DIR" 2>/dev/null || true
        echo "Error: $msg" >&2
        echo "Local state cleared. Run 'sw-editor.sh attach <pairing-code>' to reattach." >&2
        exit 1
      fi
    fi

    echo "Error: $msg" >&2
    exit 1
  fi
}

VALID_AGENTS="claude codex cursor opencode windsurf kilocode chatgpt openwebui other"

resolve_agent_name() {
  local input
  input="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$input" in
    claude|"claude code")   echo "Claude Code" ;;
    codex)                  echo "Codex" ;;
    cursor)                 echo "Cursor" ;;
    opencode)               echo "OpenCode" ;;
    windsurf)               echo "Windsurf" ;;
    kilocode)               echo "Kilocode" ;;
    chatgpt|"chatgpt")      echo "ChatGPT" ;;
    openwebui|"open webui") echo "Open WebUI" ;;
    other)                  echo "Other" ;;
    *)                      echo "" ;;
  esac
}

cmd_attach() {
  local pairing_code="" agent_name=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --agent-name)
        agent_name="$2"; shift 2 ;;
      --agent-name=*)
        agent_name="${1#*=}"; shift ;;
      --help|-h)
        usage; exit 0 ;;
      -*)
        echo "Unknown flag: $1" >&2; exit 1 ;;
      *)
        if [[ -z "$pairing_code" ]]; then pairing_code="$1"
        else echo "Unexpected arg: $1" >&2; exit 1
        fi
        shift ;;
    esac
  done

  if [[ -z "$pairing_code" ]]; then
    echo "Usage: sw-editor.sh attach <pairing-code> [--agent-name <name>]" >&2
    exit 1
  fi

  if [[ -z "$agent_name" ]]; then
    echo "Error: --agent-name is required. Valid: ${VALID_AGENTS}" >&2
    exit 1
  fi

  local resolved_agent
  resolved_agent="$(resolve_agent_name "$agent_name")"
  if [[ -z "$resolved_agent" ]]; then
    echo "Error: unknown agent '${agent_name}'. Valid: ${VALID_AGENTS}" >&2
    exit 1
  fi

  local transport_session_id
  transport_session_id="cli-$(jq -nr 'now | tostring | @base64' 2>/dev/null || date +%s)-$$"

  local body
  body="$(jq -n \
    --arg pairingCode "$pairing_code" \
    --arg transportSessionId "$transport_session_id" \
    --arg agentName "$resolved_agent" \
    '{
      pairingCode: $pairingCode,
      controllerTransportSessionId: $transportSessionId,
      agentSessionId: $transportSessionId,
      agentName: $agentName,
      clientName: "sw-editor-cli",
      clientVersion: "1.0.0"
    }')"

  _request_anon "/editor-sessions/claim" "$body"
  fail_on_non_2xx

  local session_id token
  session_id="$(echo "$HTTP_BODY" | jq -r '.status.sessionId')"
  token="$(echo "$HTTP_BODY" | jq -r '.controllerToken')"

  if [[ -z "$session_id" || "$session_id" == "null" || -z "$token" || "$token" == "null" ]]; then
    echo "Error: claim response missing session or token" >&2
    echo "$HTTP_BODY" >&2
    exit 1
  fi

  local attached_at
  attached_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  local state_json
  state_json="$(jq -n \
    --arg sessionId "$session_id" \
    --arg controllerToken "$token" \
    --arg baseUrl "$BASE_URL" \
    --arg transportSessionId "$transport_session_id" \
    --arg attachedAt "$attached_at" \
    '{sessionId: $sessionId, controllerToken: $controllerToken, baseUrl: $baseUrl, transportSessionId: $transportSessionId, attachedAt: $attachedAt}')"
  write_state "$state_json"

  local tool_count
  tool_count="$(echo "$HTTP_BODY" | jq '.toolDefinitions | length')"
  echo "Attached. Browser exposes $tool_count tools. Run 'sw-editor.sh tools' to list them."
}

cmd_tools() {
  require_state
  local session_id
  session_id="$(state_field sessionId)"
  _request GET "/editor-sessions/${session_id}/tools"
  fail_on_non_2xx
  echo "$HTTP_BODY" | jq '.'
}

cmd_call() {
  require_state

  local tool_name="" args_json="{}"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --args)
        args_json="$2"; shift 2 ;;
      --args=*)
        args_json="${1#*=}"; shift ;;
      --help|-h)
        usage; exit 0 ;;
      -*)
        echo "Unknown flag: $1" >&2; exit 1 ;;
      *)
        if [[ -z "$tool_name" ]]; then tool_name="$1"
        else echo "Unexpected arg: $1" >&2; exit 1
        fi
        shift ;;
    esac
  done

  if [[ -z "$tool_name" ]]; then
    echo "Usage: sw-editor.sh call <tool-name> [--args '<json>']" >&2
    exit 1
  fi

  if ! echo "$args_json" | jq empty >/dev/null 2>&1; then
    echo "Error: --args must be valid JSON" >&2
    exit 1
  fi

  local body
  body="$(jq -n --arg toolName "$tool_name" --argjson args "$args_json" '{toolName: $toolName, args: $args}')"

  local session_id
  session_id="$(state_field sessionId)"
  _request POST "/editor-sessions/${session_id}/call-tool" "$body"
  fail_on_non_2xx

  echo "$HTTP_BODY" | jq '.'

  local is_error
  is_error="$(echo "$HTTP_BODY" | jq -r '.isError // false')"
  if [[ "$is_error" == "true" ]]; then
    exit 1
  fi
}

cmd_status() {
  require_state
  local session_id
  session_id="$(state_field sessionId)"
  _request GET "/editor-sessions/${session_id}/status"
  fail_on_non_2xx
  echo "$HTTP_BODY" | jq 'del(.sessionId, .controllerTransportSessionId, .controllerInfo.transportSessionId, .controllerInfo.agentSessionId)'
}

cmd_release() {
  require_state
  local session_id transport_session_id
  session_id="$(state_field sessionId)"
  transport_session_id="$(state_field transportSessionId)"
  local body
  body="$(jq -n --arg transportSessionId "$transport_session_id" '{controllerTransportSessionId: $transportSessionId}')"
  _request POST "/editor-sessions/${session_id}/release" "$body"
  rm -f "$STATE_FILE"
  rmdir "$STATE_DIR" 2>/dev/null || true

  if [[ "$HTTP_STATUS" != 2* ]]; then
    echo "Detached locally. Server reported: HTTP $HTTP_STATUS" >&2
  else
    echo "Detached."
  fi
}

cmd_whoami() {
  if [[ ! -f "$STATE_FILE" ]]; then
    echo '{"attached": false}'
    return
  fi
  jq '{attached: true, baseUrl: .baseUrl, attachedAt: .attachedAt}' "$STATE_FILE"
}

main() {
  if [[ $# -eq 0 ]]; then
    usage; exit 0
  fi

  local cmd="$1"; shift
  case "$cmd" in
    attach)   cmd_attach "$@" ;;
    tools)    cmd_tools "$@" ;;
    call)     cmd_call "$@" ;;
    status)   cmd_status "$@" ;;
    release)  cmd_release "$@" ;;
    whoami)   cmd_whoami "$@" ;;
    --help|-h|help) usage ;;
    *)
      echo "Unknown command: $cmd" >&2
      usage
      exit 1 ;;
  esac
}

main "$@"
