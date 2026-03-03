#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="${ROOT_DIR}/skills"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

parse_frontmatter_value() {
  local file="$1"
  local key="$2"
  awk -v key="$key" '
    BEGIN { in_fm = 0 }
    /^---$/ {
      if (in_fm == 0) { in_fm = 1; next }
      else { exit }
    }
    in_fm == 1 {
      pattern = "^" key ":[[:space:]]*"
      if ($0 ~ pattern) {
        sub(pattern, "", $0)
        gsub(/^["'\'' ]+|["'\'' ]+$/, "", $0)
        print $0
        exit
      }
    }
  ' "$file"
}

[ -d "${SKILLS_DIR}" ] || fail "skills directory missing"

for skill_dir in "${SKILLS_DIR}"/*; do
  [ -d "${skill_dir}" ] || continue

  dir_name="$(basename "${skill_dir}")"
  skill_md="${skill_dir}/SKILL.md"

  [ -f "${skill_md}" ] || fail "${dir_name}: missing SKILL.md"

  name="$(parse_frontmatter_value "${skill_md}" "name")"
  description="$(parse_frontmatter_value "${skill_md}" "description")"

  [ -n "${name}" ] || fail "${dir_name}: missing frontmatter name"
  [ -n "${description}" ] || fail "${dir_name}: missing frontmatter description"
  [ "${name}" = "${dir_name}" ] || fail "${dir_name}: frontmatter name '${name}' must match directory name"
done

check_refs() {
  local sdk="$1"
  shift
  local base="${SKILLS_DIR}/superwall-${sdk}-quickstart/references/quickstart"
  [ -d "${base}" ] || fail "${sdk}: missing references/quickstart"
  for page in "$@"; do
    [ -f "${base}/${page}.md" ] || fail "${sdk}: missing reference ${page}.md"
  done
}

check_refs ios \
  install configure user-management feature-gating tracking-subscription-state setting-user-properties in-app-paywall-previews
check_refs android \
  install configure user-management feature-gating tracking-subscription-state setting-user-properties in-app-paywall-previews
check_refs flutter \
  install configure user-management feature-gating tracking-subscription-state setting-user-properties in-app-paywall-previews
check_refs expo \
  install configure present-first-paywall user-management feature-gating tracking-subscription-state setting-user-properties in-app-paywall-previews

echo "Validation passed."
