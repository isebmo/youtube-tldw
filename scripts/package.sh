#!/usr/bin/env bash
# Build store-submission zips for the Chrome, Firefox and Safari extensions.
# Outputs to dist/<ext>-v<version>.zip. Does not upload anything.
#
# Usage:
#   scripts/package.sh                # all three
#   scripts/package.sh chrome firefox # subset

set -euo pipefail

cd "$(dirname "$0")/.."

DIST="dist"
mkdir -p "$DIST"

ALL=(firefox chrome safari)
TARGETS=("${@:-${ALL[@]}}")

target_dir() {
  case "$1" in
    firefox) echo "firefox-ext-yt" ;;
    chrome)  echo "chrome-ext-yt"  ;;
    safari)  echo "safari-ext-yt"  ;;
    *) echo "Unknown target: $1" >&2; exit 1 ;;
  esac
}

validate() {
  local dir="$1"
  jq empty "$dir/manifest.json"
  for m in "$dir"/_locales/*/messages.json; do
    [[ -f "$m" ]] && jq empty "$m"
  done
  node -c "$dir/options.js"
  node -c "$dir/content.js"
  node -c "$dir/background.js"
}

# Cross-extension key parity: every locale must define the same keys as en/.
key_parity() {
  local dir="$1"
  local en="$dir/_locales/en/messages.json"
  [[ -f "$en" ]] || return 0
  local en_keys
  en_keys=$(jq -r 'keys[]' "$en" | sort)
  for f in "$dir"/_locales/*/messages.json; do
    [[ "$f" == "$en" ]] && continue
    local other
    other=$(jq -r 'keys[]' "$f" | sort)
    if ! diff -q <(echo "$en_keys") <(echo "$other") >/dev/null; then
      echo "  ! key set mismatch: $f vs en/" >&2
      diff <(echo "$en_keys") <(echo "$other") >&2 || true
      exit 1
    fi
  done
}

for t in "${TARGETS[@]}"; do
  dir=$(target_dir "$t")
  echo "==> $t ($dir)"

  echo "  - validating"
  validate "$dir"
  key_parity "$dir"

  version=$(jq -r '.version' "$dir/manifest.json")
  out="$DIST/${dir}-v${version}.zip"
  rm -f "$out"

  echo "  - zipping -> $out"
  # -X strips extra file attrs (resource forks); excludes hidden files.
  ( cd "$dir" && zip -rqX "../$out" . \
      -x '.*' -x '__MACOSX' -x '*/.DS_Store' )

  size=$(du -h "$out" | awk '{print $1}')
  count=$(unzip -l "$out" | tail -1 | awk '{print $2}')
  echo "  - $size, $count files"
done

echo
echo "Artifacts in $DIST/:"
ls -lh "$DIST" | tail -n +2
