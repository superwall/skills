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

  mkdir -p "${out_dir}"
  echo "Syncing ${sdk}/quickstart/${slug}"
  curl -fsSL "${url}" -o "${out_file}"
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
