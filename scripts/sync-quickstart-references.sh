#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="${ROOT_DIR}/skills"

sync_page() {
  local sdk="$1"
  local slug="$2"
  local out_dir="${SKILLS_DIR}/superwall-${sdk}-quickstart/references/quickstart"
  local url="https://superwall.com/docs/${sdk}/quickstart/${slug}.md"
  local out_file="${out_dir}/${slug}.md"
  local tmp_file
  local header_file
  local content_type

  mkdir -p "${out_dir}"
  echo "Syncing ${sdk}/quickstart/${slug}"

  tmp_file="$(mktemp)"
  header_file="$(mktemp)"
  trap 'rm -f "${tmp_file}" "${header_file}"' RETURN

  curl -fsSL \
    --retry 3 \
    --retry-delay 1 \
    --connect-timeout 15 \
    --max-time 60 \
    -D "${header_file}" \
    "${url}" \
    -o "${tmp_file}"

  content_type="$(
    awk -F': ' '
      tolower($1) == "content-type" {
        gsub(/\r/, "", $2)
        print tolower($2)
      }
    ' "${header_file}" | tail -n 1
  )"

  case "${content_type}" in
    text/markdown*|text/plain*)
      ;;
    *)
      echo "Unexpected content type for ${url}: ${content_type:-<none>}" >&2
      return 1
      ;;
  esac

  if grep -qiE '^[[:space:]]*<!doctype html|^[[:space:]]*<html' "${tmp_file}"; then
    echo "Unexpected HTML response for ${url}" >&2
    return 1
  fi

  if [ ! -s "${tmp_file}" ]; then
    echo "Empty response for ${url}" >&2
    return 1
  fi

  mv "${tmp_file}" "${out_file}"
  rm -f "${header_file}"
  trap - RETURN
}

# Native SDK quickstarts
for sdk in ios android flutter; do
  sync_page "${sdk}" "install"
  sync_page "${sdk}" "configure"
  sync_page "${sdk}" "user-management"
  sync_page "${sdk}" "feature-gating"
  sync_page "${sdk}" "tracking-subscription-state"
  sync_page "${sdk}" "setting-user-properties"
  sync_page "${sdk}" "in-app-paywall-previews"
done

# Expo quickstart (includes present-first-paywall)
sdk="expo"
sync_page "${sdk}" "install"
sync_page "${sdk}" "configure"
sync_page "${sdk}" "present-first-paywall"
sync_page "${sdk}" "user-management"
sync_page "${sdk}" "feature-gating"
sync_page "${sdk}" "tracking-subscription-state"
sync_page "${sdk}" "setting-user-properties"
sync_page "${sdk}" "in-app-paywall-previews"

echo "Done. Quickstart references updated."
