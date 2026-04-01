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

SPEC_URL="https://api.superwall.com/openapi.json"
BASE_URL="https://api.superwall.com"
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
  if ! command -v jq &>/dev/null; then
    echo "Error: jq is required for bootstrap (brew install jq)" >&2
    exit 1
  fi

  local organizations_json
  organizations_json="$(api_request "/v2/me/organizations")"

  if ! echo "${organizations_json}" | jq -e '.data | type == "array"' >/dev/null 2>&1; then
    echo "Error: failed to load organizations from /v2/me/organizations" >&2
    echo "${organizations_json}" >&2
    exit 1
  fi

  local organizations
  organizations="$(echo "${organizations_json}" | jq -c '.data[:50][]')"

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
    org_id="$(echo "${org_json}" | jq -r '.id')"

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

  for (( org_index=0; org_index<org_count; org_index++ )); do
    local org_json org_name org_id org_prefix org_indent
    org_json="${organization_rows[$org_index]}"
    org_name="$(echo "${org_json}" | jq -r '.name')"
    org_id="$(echo "${org_json}" | jq -r '.id')"

    org_prefix="├──"
    org_indent="│   "
    if (( org_index == org_count - 1 )); then
      org_prefix="└──"
      org_indent="    "
    fi

    printf '%s org: name: %s, organizationId:%s\n' "${org_prefix}" "${org_name}" "${org_id}"

    local projects_json
    projects_json="$(cat "${bootstrap_tmp_dir}/projects-${org_index}.json")"

    if ! echo "${projects_json}" | jq -e '.data | type == "array"' >/dev/null 2>&1; then
      printf '%s└── [error loading projects for organizationId:%s]\n' "${org_indent}" "${org_id}"
      continue
    fi

    local projects_json_array
    projects_json_array="$(echo "${projects_json}" | jq -c '.data[:100]')"

    local project_count
    project_count="$(echo "${projects_json_array}" | jq 'length')"
    if [[ "${project_count}" == "0" ]]; then
      continue
    fi

    local project_index
    for (( project_index=0; project_index<project_count; project_index++ )); do
      local project_json project_name project_id project_prefix project_indent
      project_json="$(echo "${projects_json_array}" | jq -c ".[$project_index]")"
      project_name="$(echo "${project_json}" | jq -r '.name')"
      project_id="$(echo "${project_json}" | jq -r '.id')"

      project_prefix="├──"
      project_indent="${org_indent}│   "
      if (( project_index == project_count - 1 )); then
        project_prefix="└──"
        project_indent="${org_indent}    "
      fi

      printf '%s%s project: name: %s, projectId: %s\n' \
        "${org_indent}" "${project_prefix}" "${project_name}" "${project_id}"

      local applications_json
      applications_json="$(echo "${project_json}" | jq -c '.applications[:10]')"

      local application_count
      application_count="$(echo "${applications_json}" | jq 'length')"
      if [[ "${application_count}" == "0" ]]; then
        continue
      fi

      local application_index
      for (( application_index=0; application_index<application_count; application_index++ )); do
        local application_json application_name platform application_id application_prefix
        application_json="$(echo "${applications_json}" | jq -c ".[$application_index]")"
        application_name="$(echo "${application_json}" | jq -r '.name')"
        platform="$(echo "${application_json}" | jq -r '.platform')"
        application_id="$(echo "${application_json}" | jq -r '.id')"

        application_prefix="├──"
        if (( application_index == application_count - 1 )); then
          application_prefix="└──"
        fi

        printf '%s%s application: name: %s, platform: %s, applicationId: %s\n' \
          "${project_indent}" "${application_prefix}" "${application_name}" "${platform}" "${application_id}"
      done
    done
  done

  if (( wait_failed != 0 )); then
    return 1
  fi
}

handle_help() {
  if ! command -v jq &>/dev/null; then
    echo "Error: jq is required for --help (brew install jq)" >&2
    exit 1
  fi

  local spec
  spec="$(curl -sS "${SPEC_URL}")"

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

    echo "${spec}" | jq -r '
      .paths | to_entries[] |
      .key as $path |
      .value | to_entries[] |
      select(.key | test("get|post|put|patch|delete")) |
      .key as $method | .value as $op |
      ($method | ascii_upcase) as $METHOD |
      ([$op.parameters // [] | .[] | select(.in == "query" and .required == true) | .name] |
        if length > 0 then "?" + (map("\(.)=...") | join("&")) else "" end) as $qs |
      ($op.requestBody.content["application/json"].schema // null |
        if . == null then null
        else
          (.required | if type == "array" then . else [] end) as $req |
          if ($req | length) > 0 then
            "{" + ([$req[] as $f | "\"\($f)\":\"...\""] | join(",")) + "}"
          else "{...}"
          end
        end) as $body |
      (if $method == "get" then "sw-api.sh \($path)\($qs)"
       elif $body != null then "sw-api.sh -m \($METHOD) -d \u0027\($body)\u0027 \($path)"
       elif $method != "get" then "sw-api.sh -m \($METHOD) \($path)"
       else "sw-api.sh \($path)" end) as $usage |
      "\(" " * (7 - ($METHOD | length)) + $METHOD)  \($path)\t\(.value.summary // "")\n     ↳ \($usage)\n"
    '

    cat <<'FOOTER'
Tip: Run sw-api.sh --help <route> for full details on any route above.
     e.g. sw-api.sh --help /v2/projects/{id}

Spec: https://api.superwall.com/openapi.json
FOOTER
  else
    local route="$2"
    local match
    match="$(echo "${spec}" | jq --arg r "${route}" '.paths[$r] // empty')"

    if [[ -z "${match}" ]]; then
      echo "No route found: ${route}" >&2
      echo >&2
      echo "Available routes:" >&2
      echo "${spec}" | jq -r '.paths | keys[]' >&2
      exit 1
    fi

    echo "${spec}" | jq --arg r "${route}" '{
      route: $r,
      methods: (.paths[$r] | to_entries | map(select(.key | test("get|post|put|patch|delete"))) | map({
        method: .key,
        summary: .value.summary,
        description: .value.description,
        parameters: .value.parameters,
        requestBody: .value.requestBody,
        responses: (.value.responses | to_entries | map({status: .key, description: .value.description}))
      }))
    }'
  fi
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
