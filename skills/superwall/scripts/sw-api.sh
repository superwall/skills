#!/usr/bin/env bash
# Superwall REST API wrapper
# Requires: SUPERWALL_API_KEY environment variable
#
# Usage:
#   sw-api.sh [-m METHOD] [-d JSON_BODY] <endpoint>
#   sw-api.sh --help              List all API routes with methods (fetched live)
#   sw-api.sh --help <route>      Show OpenAPI spec for a specific route
#
# Examples:
#   sw-api.sh /v2/projects
#   sw-api.sh -m POST -d '{"name":"New Project"}' /v2/projects
#   sw-api.sh --help
#   sw-api.sh --help /v2/projects
#   sw-api.sh --help /v2/projects/{id}
#
# Full API spec: https://api.superwall.com/openapi.json

set -euo pipefail

SPEC_URL="https://api.superwall.com/openapi.json"

# ── --help mode (no API key needed) ──────────────────────────────
if [[ "${1:-}" == "--help" ]]; then
  if ! command -v jq &>/dev/null; then
    echo "Error: jq is required for --help (brew install jq)" >&2
    exit 1
  fi

  SPEC=$(curl -s "$SPEC_URL")

  if [[ -z "${2:-}" ]]; then
    # Print header
    cat <<'HEADER'
Superwall API V2 — Live Route Reference
========================================

Usage:
  sw-api.sh <endpoint>                          GET request
  sw-api.sh -m POST -d '{"key":"val"}' <ep>    POST/PATCH/DELETE with body
  sw-api.sh --help                              This overview
  sw-api.sh --help <route>                      Full spec for a route
                                                (params, request body, responses)
Routes:
HEADER

    # List all routes with methods + usage (with required params/body fields)
    echo "$SPEC" | jq -r '
      .paths | to_entries[] |
      .key as $path |
      .value | to_entries[] |
      select(.key | test("get|post|put|patch|delete")) |
      .key as $method | .value as $op |
      ($method | ascii_upcase) as $METHOD |

      # Build query string from required query params
      ([$op.parameters // [] | .[] | select(.in == "query" and .required == true) | .name] |
        if length > 0 then "?" + (map("\(.)=...") | join("&")) else "" end) as $qs |

      # Build JSON body stub from required requestBody fields
      ($op.requestBody.content["application/json"].schema // null |
        if . == null then null
        else
          (.required | if type == "array" then . else [] end) as $req |
          if ($req | length) > 0 then
            "{" + ([$req[] as $f | "\"\($f)\":\"...\""] | join(",")) + "}"
          else "{...}"
          end
        end) as $body |

      # Assemble usage line
      (if $method == "get" then "sw-api.sh \($path)\($qs)"
       elif $body != null then "sw-api.sh -m \($METHOD) -d \u0027\($body)\u0027 \($path)"
       elif $method != "get" then "sw-api.sh -m \($METHOD) \($path)"
       else "sw-api.sh \($path)" end) as $usage |

      "\(" " * (7 - ($METHOD | length)) + $METHOD)  \($path)\t\(.value.summary // "")\n     ↳ \($usage)\n"
    '

    # Print footer
    cat <<'FOOTER'
Tip: Run sw-api.sh --help <route> for full details on any route above.
     e.g. sw-api.sh --help /v2/projects/{id}

Requires: SUPERWALL_API_KEY env var for API calls (not needed for --help)
Spec:     https://api.superwall.com/openapi.json
FOOTER
  else
    # Show spec for a specific route
    ROUTE="$2"
    MATCH=$(echo "$SPEC" | jq --arg r "$ROUTE" '.paths[$r] // empty')

    if [[ -z "$MATCH" ]]; then
      echo "No route found: $ROUTE" >&2
      echo "" >&2
      echo "Available routes:" >&2
      echo "$SPEC" | jq -r '.paths | keys[]' >&2
      exit 1
    fi

    echo "$SPEC" | jq --arg r "$ROUTE" '{
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
  exit 0
fi

# ── Normal API mode ──────────────────────────────────────────────
if [[ -z "${SUPERWALL_API_KEY:-}" ]]; then
  echo "Error: SUPERWALL_API_KEY not set" >&2
  exit 1
fi

METHOD="GET"
DATA=""

while getopts "m:d:" opt; do
  case $opt in
    m) METHOD="$OPTARG" ;;
    d) DATA="$OPTARG" ;;
    *) echo "Usage: sw-api.sh [-m METHOD] [-d JSON] <endpoint>" >&2; exit 1 ;;
  esac
done
shift $((OPTIND - 1))

if [[ $# -lt 1 ]]; then
  echo "Usage: sw-api.sh [-m METHOD] [-d JSON] <endpoint>" >&2
  echo "       sw-api.sh --help [route]" >&2
  exit 1
fi

ENDPOINT="$1"
BASE_URL="https://api.superwall.com"

CURL_ARGS=(
  -s
  -X "$METHOD"
  "${BASE_URL}${ENDPOINT}"
  -H "Authorization: Bearer ${SUPERWALL_API_KEY}"
  -H "Content-Type: application/json"
)

if [[ -n "$DATA" ]]; then
  CURL_ARGS+=(-d "$DATA")
fi

curl "${CURL_ARGS[@]}"
