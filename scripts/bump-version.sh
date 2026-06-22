#!/usr/bin/env bash
# Bump the "version" field in all three extension manifests.
# Usage:
#   scripts/bump-version.sh 1.2.0           # set explicit version
#   scripts/bump-version.sh patch|minor|major  # semver bump

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <version|patch|minor|major>" >&2
  exit 1
fi

ARG="$1"

MANIFESTS=(
  "firefox-ext-yt/manifest.json"
  "chrome-ext-yt/manifest.json"
  "safari-ext-yt/manifest.json"
  # Xcode bundles this copy; sync-safari-xcode.sh keeps it aligned, but bump
  # it here too so a bump alone never leaves the shipped version behind.
  "safari-xcode-project/YouTube TLDW/Shared (Extension)/Resources/manifest.json"
)

current_version() {
  grep -m1 '"version"' "${MANIFESTS[0]}" | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
}

bump() {
  local v="$1" kind="$2"
  IFS='.' read -r major minor patch <<< "$v"
  case "$kind" in
    patch) patch=$((patch + 1));;
    minor) minor=$((minor + 1)); patch=0;;
    major) major=$((major + 1)); minor=0; patch=0;;
  esac
  echo "${major}.${minor}.${patch}"
}

CURRENT="$(current_version)"
case "$ARG" in
  patch|minor|major) NEW="$(bump "$CURRENT" "$ARG")" ;;
  *)
    if [[ ! "$ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "Invalid version: $ARG (expected X.Y.Z or patch/minor/major)" >&2
      exit 1
    fi
    NEW="$ARG"
    ;;
esac

echo "Bumping $CURRENT -> $NEW"

for m in "${MANIFESTS[@]}"; do
  # Use sed in-place; -i '' for BSD/macOS compatibility
  sed -i '' -E "s/(\"version\"[[:space:]]*:[[:space:]]*\")[^\"]+(\")/\1${NEW}\2/" "$m"
  echo "  updated $m"
done

echo "$NEW"
