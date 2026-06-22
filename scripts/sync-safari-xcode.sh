#!/usr/bin/env bash
# Sync safari-ext-yt/ (single source of truth) into the Xcode project's
# bundled extension resources. Run before archiving the Safari app —
# the App Store build ships whatever is in Resources/, not safari-ext-yt/.

set -euo pipefail

cd "$(dirname "$0")/.."

SRC="safari-ext-yt"
DST="safari-xcode-project/YouTube TLDW/Shared (Extension)/Resources"

rsync -a --delete --exclude '.DS_Store' "$SRC"/ "$DST"/

echo "Synced $SRC/ -> $DST/"
diff -rq "$SRC" "$DST"
