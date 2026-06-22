#!/usr/bin/env bash
# Build a zip from chrome-ext-yt/, upload to the Chrome Web Store, then publish.
# Requires .env at repo root with:
#   CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, CHROME_REFRESH_TOKEN, CHROME_EXTENSION_ID
# Flags:
#   --no-publish    upload only, do not call publish (useful for trusted-tester track)

set -euo pipefail

cd "$(dirname "$0")/.."

PUBLISH=1
for arg in "$@"; do
  case "$arg" in
    --no-publish) PUBLISH=0;;
    *) echo "Unknown arg: $arg" >&2; exit 1;;
  esac
done

if [[ ! -f .env ]]; then
  echo ".env not found at repo root" >&2
  exit 1
fi
set -a; source .env; set +a

: "${CHROME_CLIENT_ID:?missing}"
: "${CHROME_CLIENT_SECRET:?missing}"
: "${CHROME_REFRESH_TOKEN:?missing}"
: "${CHROME_EXTENSION_ID:?missing}"

# Build through package.sh so the upload gets its validations
# (jq on manifest/_locales, node syntax checks, locale key parity).
echo "==> Building via scripts/package.sh"
scripts/package.sh chrome

VERSION=$(jq -r '.version' chrome-ext-yt/manifest.json)
ZIP="dist/chrome-ext-yt-v${VERSION}.zip"

echo "==> Uploading to Chrome Web Store"
npx --yes chrome-webstore-upload-cli upload \
  --source "$ZIP" \
  --extension-id "$CHROME_EXTENSION_ID" \
  --client-id "$CHROME_CLIENT_ID" \
  --client-secret "$CHROME_CLIENT_SECRET" \
  --refresh-token "$CHROME_REFRESH_TOKEN"

if [[ "$PUBLISH" -eq 1 ]]; then
  echo "==> Submitting for review"
  npx --yes chrome-webstore-upload-cli publish \
    --extension-id "$CHROME_EXTENSION_ID" \
    --client-id "$CHROME_CLIENT_ID" \
    --client-secret "$CHROME_CLIENT_SECRET" \
    --refresh-token "$CHROME_REFRESH_TOKEN"
  echo "Submitted. Review takes 1-5 days."
else
  echo "Upload only. Skipping publish."
fi
