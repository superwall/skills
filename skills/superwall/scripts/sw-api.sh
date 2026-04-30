#!/usr/bin/env bash
# Superwall REST API wrapper
#
# Usage:
#   sw-api.sh [-m METHOD] [-d JSON_BODY] <endpoint>
#   sw-api.sh auth login --key=<API_KEY> [--location=local|global]
#   sw-api.sh auth status
#   sw-api.sh auth logout [--location=local|global]
#   sw-api.sh --help
#   sw-api.sh --help <route>
#
# Full API spec: https://api.superwall.com/openapi.json

set -euo pipefail

BASE_URL="${SUPERWALL_API_BASE_URL:-https://api.superwall.com}"
SPEC_URL="${SUPERWALL_API_SPEC_URL:-${BASE_URL}/openapi.json}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCAL_ENV_FILE="${SKILL_ROOT}/.env"
GLOBAL_CONFIG_DIR="${HOME}/.superwall-cli"
GLOBAL_ENV_FILE="${GLOBAL_CONFIG_DIR}/.env"
AUTH_VALIDATE_PROJECTS_ENDPOINT="/v2/projects?limit=1"
AUTH_VALIDATE_ORGS_ENDPOINT="/v2/me/organizations"

usage() {
  cat <<'EOF'
Usage:
  sw-api.sh <endpoint>                          GET request
  sw-api.sh -m POST -d '{"key":"val"}' <ep>    POST/PATCH/DELETE with body
  sw-api.sh bootstrap
  sw-api.sh auth login --key=<API_KEY> [--location=local|global]
  sw-api.sh auth status
  sw-api.sh auth logout [--location=local|global]
  sw-api.sh --help                              This overview
  sw-api.sh --help <route>                      Full spec for a route
                                                (params, request body, responses)
EOF
}

print_auth_help() {
  cat <<EOF
Auth:
  sw-api.sh auth login --key=<API_KEY> [--location=local|global]
      Save and validate an org-scoped API key.
      Default location: local (${LOCAL_ENV_FILE})
      Global location:  ${GLOBAL_ENV_FILE}

  sw-api.sh auth status
      Show which credential source is active.

  sw-api.sh auth logout [--location=local|global]
      Remove a saved key from the selected location.

Credential precedence for API calls:
  1. SUPERWALL_API_KEY from the current shell environment
  2. Local saved key at ${LOCAL_ENV_FILE}
  3. Global saved key at ${GLOBAL_ENV_FILE}

Local API testing:
  SUPERWALL_API_BASE_URL=http://localhost:3000 sw-api.sh auth login --key=<API_KEY>

Get an API key:
  https://superwall.com/select-application?pathname=/applications/:app/settings/api-keys
EOF
}

print_bootstrap_help() {
  cat <<'EOF'
Bootstrap:
  sw-api.sh bootstrap
      Print organization -> project -> application hierarchy.
      Limits:
        - first 50 organizations
        - max 100 projects per organization
        - max 10 applications per project
EOF
}

require_python3() {
  if ! command -v python3 &>/dev/null; then
    echo "Error: python3 is required" >&2
    exit 1
  fi
}

load_env_file() {
  local env_file="$1"

  [[ -f "${env_file}" ]] || return 1

  local line
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "${line}" || "${line}" == \#* ]] && continue
    if [[ "${line}" =~ ^SUPERWALL_API_KEY=(.*)$ ]]; then
      SUPERWALL_API_KEY="${BASH_REMATCH[1]}"
      SUPERWALL_API_KEY="${SUPERWALL_API_KEY%\"}"
      SUPERWALL_API_KEY="${SUPERWALL_API_KEY#\"}"
      SUPERWALL_API_KEY="${SUPERWALL_API_KEY%\'}"
      SUPERWALL_API_KEY="${SUPERWALL_API_KEY#\'}"
      export SUPERWALL_API_KEY
      return 0
    fi
  done < "${env_file}"

  return 1
}

resolve_api_key() {
  API_KEY_SOURCE="none"

  if [[ -n "${SUPERWALL_API_KEY:-}" ]]; then
    API_KEY_SOURCE="env"
    return 0
  fi

  if load_env_file "${LOCAL_ENV_FILE}"; then
    API_KEY_SOURCE="local"
    return 0
  fi

  if load_env_file "${GLOBAL_ENV_FILE}"; then
    API_KEY_SOURCE="global"
    return 0
  fi

  return 1
}

mask_key() {
  local key="$1"
  local length="${#key}"

  if (( length <= 8 )); then
    printf '%s\n' '********'
    return
  fi

  printf '%s...%s\n' "${key:0:4}" "${key: -4}"
}

write_key_file() {
  local env_file="$1"
  local api_key="$2"

  mkdir -p "$(dirname "${env_file}")"
  umask 077
  printf 'SUPERWALL_API_KEY=%s\n' "${api_key}" > "${env_file}"
}

delete_key_file() {
  local env_file="$1"

  if [[ -f "${env_file}" ]]; then
    rm -f "${env_file}"
    echo "Removed saved key at ${env_file}"
  else
    echo "No saved key found at ${env_file}"
  fi
}

validate_bearer_credential() {
  local bearer_credential="$1"
  local status

  status="$(
    curl -sS -o /dev/null -w '%{http_code}' \
      -H "Authorization: Bearer ${bearer_credential}" \
      -H "Content-Type: application/json" \
      "${BASE_URL}${AUTH_VALIDATE_PROJECTS_ENDPOINT}"
  )"

  if [[ "${status}" == 2* ]]; then
    return 0
  fi

  status="$(
    curl -sS -o /dev/null -w '%{http_code}' \
      -H "Authorization: Bearer ${bearer_credential}" \
      -H "Content-Type: application/json" \
      "${BASE_URL}${AUTH_VALIDATE_ORGS_ENDPOINT}"
  )"

  [[ "${status}" == 2* ]]
}

api_request() {
  local endpoint="$1"
  local method="${2:-GET}"
  local data="${3:-}"

  local curl_args=(
    -sS
    -X "${method}"
    "${BASE_URL}${endpoint}"
    -H "Authorization: Bearer ${SUPERWALL_API_KEY}"
    -H "Content-Type: application/json"
  )

  if [[ -n "${data}" ]]; then
    curl_args+=(-d "${data}")
  fi

  curl "${curl_args[@]}"
}

print_login_instructions() {
  cat <<EOF >&2
Error: missing required --key for auth login

Usage:
  sw-api.sh auth login --key=<API_KEY> [--location=local|global]

Default location:
  local (${LOCAL_ENV_FILE})

Get an API key:
  https://superwall.com/select-application?pathname=/applications/:app/settings/api-keys
EOF
}

handle_auth_login() {
  local location="local"
  local api_key=""
  local target_file=""

  shift 2
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --key=*)
        api_key="${1#*=}"
        ;;
      --key)
        shift
        api_key="${1:-}"
        ;;
      --location=*)
        location="${1#*=}"
        ;;
      --location)
        shift
        location="${1:-}"
        ;;
      *)
        echo "Error: unknown auth login argument: $1" >&2
        print_login_instructions
        exit 1
        ;;
    esac
    shift
  done

  if [[ -z "${api_key}" ]]; then
    print_login_instructions
    exit 1
  fi

  case "${location}" in
    local)
      target_file="${LOCAL_ENV_FILE}"
      ;;
    global)
      target_file="${GLOBAL_ENV_FILE}"
      ;;
    *)
      echo "Error: invalid location '${location}'. Use local or global." >&2
      exit 1
      ;;
  esac

  if ! validate_bearer_credential "${api_key}"; then
    echo "Error: API key validation failed. Nothing was saved." >&2
    exit 1
  fi

  write_key_file "${target_file}" "${api_key}"
  echo "Saved validated API key to ${target_file}"
}

handle_auth_status() {
  resolve_api_key || true

  case "${API_KEY_SOURCE}" in
    env)
      echo "Auth source: env ($(mask_key "${SUPERWALL_API_KEY}"))"
      ;;
    local)
      echo "Auth source: local ${LOCAL_ENV_FILE} ($(mask_key "${SUPERWALL_API_KEY}"))"
      ;;
    global)
      echo "Auth source: global ${GLOBAL_ENV_FILE} ($(mask_key "${SUPERWALL_API_KEY}"))"
      ;;
    none)
      echo "Auth source: none"
      echo "Run: sw-api.sh auth login --key=<API_KEY>"
      ;;
  esac
}

handle_auth_logout() {
  local location="local"

  shift 2
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --location=*)
        location="${1#*=}"
        ;;
      --location)
        shift
        location="${1:-}"
        ;;
      *)
        echo "Error: unknown auth logout argument: $1" >&2
        exit 1
        ;;
    esac
    shift
  done

  case "${location}" in
    local)
      delete_key_file "${LOCAL_ENV_FILE}"
      ;;
    global)
      delete_key_file "${GLOBAL_ENV_FILE}"
      ;;
    *)
      echo "Error: invalid location '${location}'. Use local or global." >&2
      exit 1
      ;;
  esac
}

handle_bootstrap() {
  require_python3

  local organizations_json
  organizations_json="$(api_request "/v2/me/organizations")"

  local organizations_file
  organizations_file="$(mktemp)"
  printf '%s' "${organizations_json}" > "${organizations_file}"

  if ! python3 - "${organizations_file}" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    payload = json.load(handle)

if not isinstance(payload.get("data"), list):
    sys.exit(1)
PY
  then
    echo "Error: failed to load organizations from /v2/me/organizations" >&2
    echo "${organizations_json}" >&2
    rm -f "${organizations_file}"
    exit 1
  fi

  local organizations
  organizations="$(
    python3 - "${organizations_file}" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    payload = json.load(handle)

for org in payload.get("data", [])[:50]:
    print(json.dumps(org, separators=(",", ":")))
PY
  )"
  rm -f "${organizations_file}"

  if [[ -z "${organizations}" ]]; then
    echo "No organizations found."
    return
  fi

  local -a organization_rows=()
  local -a pids=()
  local bootstrap_tmp_dir
  bootstrap_tmp_dir="$(mktemp -d)"
  trap 'rm -rf "${bootstrap_tmp_dir}"' RETURN

  local org
  while IFS= read -r org; do
    [[ -n "${org}" ]] || continue
    organization_rows+=("${org}")
  done <<< "${organizations}"

  local org_count="${#organization_rows[@]}"
  local org_index
  for (( org_index=0; org_index<org_count; org_index++ )); do
    local org_json org_id
    org_json="${organization_rows[$org_index]}"
    org_id="$(
      python3 - "${org_json}" <<'PY'
import json
import sys

print(json.loads(sys.argv[1])["id"])
PY
    )"

    (
      api_request "/v2/projects?organization_id=${org_id}&limit=100" \
        > "${bootstrap_tmp_dir}/projects-${org_index}.json"
    ) &
    pids[$org_index]=$!
  done

  local wait_failed=0
  for (( org_index=0; org_index<org_count; org_index++ )); do
    if ! wait "${pids[$org_index]}"; then
      wait_failed=1
      printf '{"error":"request_failed"}\n' > "${bootstrap_tmp_dir}/projects-${org_index}.json"
    fi
  done

  local manifest_file
  manifest_file="${bootstrap_tmp_dir}/manifest.jsonl"
  for (( org_index=0; org_index<org_count; org_index++ )); do
    local org_json
    org_json="${organization_rows[$org_index]}"
    local projects_json
    projects_json="$(cat "${bootstrap_tmp_dir}/projects-${org_index}.json")"
    printf '{"org":%s,"projects_response":%s}\n' "${org_json}" "${projects_json}" >> "${manifest_file}"
  done

  python3 - "${manifest_file}" <<'PY'
import json
import sys

def branch(last):
    return "└──" if last else "├──"

def child_indent(last):
    return "    " if last else "│   "

rows = []
with open(sys.argv[1], "r", encoding="utf-8") as handle:
    for line in handle:
        line = line.strip()
        if line:
            rows.append(json.loads(line))

for org_idx, row in enumerate(rows):
    org = row.get("org", {})
    org_last = org_idx == len(rows) - 1
    print(f"{branch(org_last)} org: name: {org.get('name', '')}, organizationId:{org.get('id', '')}")

    projects_response = row.get("projects_response", {})
    projects = projects_response.get("data")
    if not isinstance(projects, list):
        print(f"{child_indent(org_last)}└── [error loading projects for organizationId:{org.get('id', '')}]")
        continue

    projects = projects[:100]
    for project_idx, project in enumerate(projects):
        project_last = project_idx == len(projects) - 1
        print(
            f"{child_indent(org_last)}{branch(project_last)} "
            f"project: name: {project.get('name', '')}, projectId: {project.get('id', '')}"
        )

        applications = project.get("applications") or []
        applications = applications[:10]
        for app_idx, application in enumerate(applications):
            app_last = app_idx == len(applications) - 1
            print(
                f"{child_indent(org_last)}{child_indent(project_last)}{branch(app_last)} "
                f"application: name: {application.get('name', '')}, "
                f"platform: {application.get('platform', '')}, "
                f"applicationId: {application.get('id', '')}"
            )
PY

  if (( wait_failed != 0 )); then
    return 1
  fi
}

handle_help() {
  require_python3

  local spec
  spec="$(curl -sS "${SPEC_URL}")"
  local spec_file
  spec_file="$(mktemp)"
  printf '%s' "${spec}" > "${spec_file}"

  if [[ -z "${2:-}" ]]; then
    cat <<'HEADER'
Superwall API V2 — Live Route Reference
========================================
HEADER
    echo
    usage
    echo
    print_auth_help
    echo
    print_bootstrap_help
    echo
    echo "Routes:"

    python3 - "${spec_file}" <<'PY'
import json
import re
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    spec = json.load(handle)

methods = ("get", "post", "put", "patch", "delete")

for path, path_item in spec.get("paths", {}).items():
    for method, op in path_item.items():
        if method not in methods:
            continue

        method_upper = method.upper()
        query_required = []
        for param in op.get("parameters") or []:
            if param.get("in") == "query" and param.get("required") is True:
                query_required.append(f"{param.get('name')}=...")
        qs = f"?{'&'.join(query_required)}" if query_required else ""

        body = None
        schema = (((op.get("requestBody") or {}).get("content") or {}).get("application/json") or {}).get("schema")
        if schema is not None:
            required = schema.get("required")
            required = required if isinstance(required, list) else []
            if required:
                body = "{" + ",".join(f"\"{field}\":\"...\"" for field in required) + "}"
            else:
                body = "{...}"

        if method == "get":
            usage = f"sw-api.sh {path}{qs}"
        elif body is not None:
            usage = f"sw-api.sh -m {method_upper} -d '{body}' {path}"
        else:
            usage = f"sw-api.sh -m {method_upper} {path}"

        padding = " " * max(0, 7 - len(method_upper))
        summary = op.get("summary") or ""
        print(f"{padding}{method_upper}  {path}\t{summary}")
        print(f"     ↳ {usage}")
        print()
PY

    cat <<'FOOTER'
Tip: Run sw-api.sh --help <route> for full details on any route above.
     e.g. sw-api.sh --help /v2/projects/{id}

Spec: https://api.superwall.com/openapi.json
FOOTER
  else
    local route="$2"
    python3 - "${spec_file}" "${route}" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    spec = json.load(handle)

route = sys.argv[2]
path_item = spec.get("paths", {}).get(route)
methods = ("get", "post", "put", "patch", "delete")

if path_item is None:
    print(f"No route found: {route}", file=sys.stderr)
    print("", file=sys.stderr)
    print("Available routes:", file=sys.stderr)
    for path in spec.get("paths", {}).keys():
        print(path, file=sys.stderr)
    sys.exit(1)

payload = {
    "route": route,
    "methods": [],
}

for method, operation in path_item.items():
    if method not in methods:
        continue
    payload["methods"].append(
        {
            "method": method,
            "summary": operation.get("summary"),
            "description": operation.get("description"),
            "parameters": operation.get("parameters"),
            "requestBody": operation.get("requestBody"),
            "responses": [
                {"status": status, "description": response.get("description")}
                for status, response in (operation.get("responses") or {}).items()
            ],
        }
    )

print(json.dumps(payload, indent=2))
PY
  fi

  rm -f "${spec_file}"
}

if [[ "${1:-}" == "--help" ]]; then
  handle_help "$@"
  exit 0
fi

if [[ "${1:-}" == "auth" ]]; then
  case "${2:-}" in
    login)
      handle_auth_login "$@"
      ;;
    status)
      handle_auth_status
      ;;
    logout)
      handle_auth_logout "$@"
      ;;
    *)
      echo "Error: expected one of: login, status, logout" >&2
      usage >&2
      exit 1
      ;;
  esac
  exit 0
fi

if [[ "${1:-}" == "bootstrap" ]]; then
  if ! resolve_api_key; then
    echo "Error: SUPERWALL_API_KEY not set and no saved credentials found." >&2
    echo "Run: sw-api.sh auth login --key=<API_KEY>" >&2
    exit 1
  fi

  handle_bootstrap
  exit 0
fi

if ! resolve_api_key; then
  echo "Error: SUPERWALL_API_KEY not set and no saved credentials found." >&2
  echo "Run: sw-api.sh auth login --key=<API_KEY>" >&2
  exit 1
fi

METHOD="GET"
DATA=""

while getopts "m:d:" opt; do
  case $opt in
    m) METHOD="$OPTARG" ;;
    d) DATA="$OPTARG" ;;
    *) usage >&2; exit 1 ;;
  esac
done
shift $((OPTIND - 1))

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 1
fi

ENDPOINT="$1"

CURL_ARGS=(
  -sS
  -X "$METHOD"
  "${BASE_URL}${ENDPOINT}"
  -H "Authorization: Bearer ${SUPERWALL_API_KEY}"
  -H "Content-Type: application/json"
)

if [[ -n "$DATA" ]]; then
  CURL_ARGS+=(-d "$DATA")
fi

curl "${CURL_ARGS[@]}"
