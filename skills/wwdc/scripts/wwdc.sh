#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${WWDC_AI_BASE_URL:-https://wwdc.ai}"
APPLE_TRANSCRIPT_MANIFEST_URLS="${WWDC_APPLE_TRANSCRIPT_MANIFEST_URLS:-https://devimages-cdn.apple.com/wwdc-services/w9f43630/73A40F02-6975-439F-BA6E-F5C834BFEAC5/transcript-manifest-eng.json}"

usage() {
  cat <<'EOF'
Usage:
  wwdc.sh llms
  wwdc.sh full
  wwdc.sh skill
  wwdc.sh list <year>
  wwdc.sh summary <year> <session>
  wwdc.sh transcript <year> <session>
  wwdc.sh html <year> <session>
  wwdc.sh transcript-url <year> <session>
  wwdc.sh transcript-json <year> <session>

Environment:
  WWDC_AI_BASE_URL=https://wwdc.ai
  WWDC_APPLE_TRANSCRIPT_MANIFEST_URLS="https://.../transcript-manifest-eng.json ..."
EOF
}

fetch() {
  curl -fsSL --compressed "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "wwdc.sh requires $1 for this operation" >&2
    return 1
  fi
}

session_markdown_url() {
  local year="$1"
  local session="$2"
  printf '%s/%s/%s.md\n' "${BASE_URL%/}" "${year}" "${session}"
}

session_api_url() {
  local year="$1"
  local session="$2"
  printf '%s/api/static/%s/%s.json\n' "${BASE_URL%/}" "${year}" "${session}"
}

require_session_args() {
  if [[ $# -ne 2 ]]; then
    usage >&2
    exit 2
  fi
}

page_transcript_url() {
  local year="$1"
  local session="$2"
  local markdown
  markdown="$(fetch "$(session_markdown_url "${year}" "${session}")")"
  printf '%s\n' "${markdown}" | awk '/Apple transcript JSON:/ { print $NF; found=1; exit } END { if (!found) exit 1 }' ||
    wwdc_api_transcript_url "${year}" "${session}"
}

wwdc_api_transcript_url() {
  local year="$1"
  local session="$2"

  require_command node
  fetch "$(session_api_url "${year}" "${session}")" | node -e '
const fs = require("node:fs");
const input = fs.readFileSync(0, "utf8");
const session = JSON.parse(input);
const url = session.transcriptSource?.transcriptUrl;
if (!url) process.exit(1);
process.stdout.write(url + "\n");
'
}

transcript_url() {
  local year="$1"
  local session="$2"
  page_transcript_url "${year}" "${session}" || apple_transcript_url "${year}" "${session}"
}

page_transcript_json() {
  local year="$1"
  local session="$2"
  local url
  url="$(page_transcript_url "${year}" "${session}")"
  fetch "${url}"
}

apple_transcript_json() {
  local year="$1"
  local session="$2"
  local url
  url="$(apple_transcript_url "${year}" "${session}")"
  fetch "${url}"
}

resolved_transcript_json() {
  local year="$1"
  local session="$2"
  local url
  url="$(transcript_url "${year}" "${session}")"
  fetch "${url}"
}

page_transcript_text() {
  local year="$1"
  local session="$2"
  local url
  url="$(page_transcript_url "${year}" "${session}")"
  transcript_text "${year}" "${session}" "${url}"
}

apple_transcript_text() {
  local year="$1"
  local session="$2"
  local url
  url="$(apple_transcript_url "${year}" "${session}")"
  transcript_text "${year}" "${session}" "${url}"
}

resolved_transcript_text() {
  local year="$1"
  local session="$2"
  local url
  url="$(transcript_url "${year}" "${session}")"
  transcript_text "${year}" "${session}" "${url}"
}

transcript_text() {
  local year="$1"
  local session="$2"
  local url="$3"
  local session_id="wwdc${year}-${session}"

  require_command node
  fetch "${url}" | node -e '
const fs = require("node:fs");
const sessionId = process.argv[1];
const input = fs.readFileSync(0, "utf8");
const payload = JSON.parse(input);
const record = payload[sessionId] ?? Object.values(payload)[0];
const rows = record?.transcript;
if (!Array.isArray(rows)) {
  process.exit(1);
}

const text = rows
  .map((row) => Array.isArray(row) ? row[1] : row?.text)
  .filter((line) => typeof line === "string" && line.length > 0)
  .join("\n");

process.stdout.write(text);
if (!text.endsWith("\n")) process.stdout.write("\n");
' "${session_id}"
}

apple_transcript_url() {
  local year="$1"
  local session="$2"
  local session_id="wwdc${year}-${session}"
  local manifest_url
  local url

  require_command node

  for manifest_url in ${APPLE_TRANSCRIPT_MANIFEST_URLS}; do
    url="$(
      fetch "${manifest_url}" | node -e '
const fs = require("node:fs");
const sessionId = process.argv[1];
const input = fs.readFileSync(0, "utf8");
const manifest = JSON.parse(input);
const url = manifest.individual?.[sessionId]?.url;
if (!url) process.exit(1);
process.stdout.write(url + "\n");
' "${session_id}"
    )" || true

    if [[ -n "${url}" ]]; then
      printf '%s\n' "${url}"
      return 0
    fi
  done

  echo "No Apple transcript JSON URL found for ${session_id}" >&2
  return 1
}

cmd="${1:-}"
shift || true

case "${cmd}" in
  llms | index | docs)
    fetch "${BASE_URL%/}/llms.txt"
    ;;
  full | llms-full)
    fetch "${BASE_URL%/}/llms-full.txt"
    ;;
  skill)
    fetch "${BASE_URL%/}/.well-known/agent-skills/wwdc/SKILL.md"
    ;;
  list | year)
    if [[ $# -ne 1 ]]; then
      usage >&2
      exit 2
    fi
    fetch "${BASE_URL%/}/$1.md"
    ;;
  summary | page | session | md)
    require_session_args "$@"
    fetch "$(session_markdown_url "$1" "$2")"
    ;;
  html)
    require_session_args "$@"
    fetch "${BASE_URL%/}/$1/$2"
    ;;
  page-transcript-url | wwdc-transcript-url)
    require_session_args "$@"
    page_transcript_url "$1" "$2"
    ;;
  page-transcript-json | wwdc-transcript-json)
    require_session_args "$@"
    page_transcript_json "$1" "$2"
    ;;
  page-transcript-text | wwdc-transcript-text)
    require_session_args "$@"
    page_transcript_text "$1" "$2"
    ;;
  apple-transcript-url)
    require_session_args "$@"
    apple_transcript_url "$1" "$2"
    ;;
  apple-transcript-json)
    require_session_args "$@"
    apple_transcript_json "$1" "$2"
    ;;
  apple-transcript-text)
    require_session_args "$@"
    apple_transcript_text "$1" "$2"
    ;;
  transcript-url)
    require_session_args "$@"
    transcript_url "$1" "$2"
    ;;
  transcript-json)
    require_session_args "$@"
    resolved_transcript_json "$1" "$2"
    ;;
  transcript | transcript-text)
    require_session_args "$@"
    resolved_transcript_text "$1" "$2"
    ;;
  -h | --help | help | '')
    usage
    ;;
  *)
    echo "Unknown command: ${cmd}" >&2
    usage >&2
    exit 2
    ;;
esac
