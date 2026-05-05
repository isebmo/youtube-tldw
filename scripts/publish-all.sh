#!/usr/bin/env bash
# One-shot release: bump version in all manifests, then publish to Chrome + Firefox.
# Usage:
#   scripts/publish-all.sh 1.2.0
#   scripts/publish-all.sh patch
#   scripts/publish-all.sh           # no bump, publish current version

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ $# -ge 1 ]]; then
  scripts/bump-version.sh "$1"
fi

echo
echo "================ Chrome ================"
scripts/publish-chrome.sh

echo
echo "================ Firefox ==============="
scripts/publish-firefox.sh

echo
echo "Done. Don't forget to commit the manifest version bumps."
