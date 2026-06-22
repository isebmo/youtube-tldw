#!/usr/bin/env bash
# Sign and submit firefox-ext-yt/ to addons.mozilla.org.
# Requires .env at repo root with:
#   AMO_JWT_ISSUER, AMO_JWT_SECRET
# Flags:
#   --unlisted    submit on the unlisted channel (self-hosted) instead of listed (AMO).

set -euo pipefail

cd "$(dirname "$0")/.."

CHANNEL="listed"
for arg in "$@"; do
  case "$arg" in
    --unlisted) CHANNEL="unlisted";;
    *) echo "Unknown arg: $arg" >&2; exit 1;;
  esac
done

if [[ ! -f .env ]]; then
  echo ".env not found at repo root" >&2
  exit 1
fi
set -a; source .env; set +a

: "${AMO_JWT_ISSUER:?missing}"
: "${AMO_JWT_SECRET:?missing}"

EXTRA=()
if [[ "$CHANNEL" == "listed" && -f amo-metadata.json ]]; then
  EXTRA+=(--amo-metadata amo-metadata.json)
fi

# web-ext signs the raw directory; run package.sh first for its validations
# (jq on manifest/_locales, node syntax checks, locale key parity).
echo "==> Validating via scripts/package.sh"
scripts/package.sh firefox

echo "==> Signing & submitting Firefox extension (channel=$CHANNEL)"
# `web-ext sign` will time out waiting for AMO review on listed channel; that's expected.
# The submission itself is registered as soon as upload completes.
npx --yes web-ext sign \
  --source-dir firefox-ext-yt/ \
  --api-key "$AMO_JWT_ISSUER" \
  --api-secret "$AMO_JWT_SECRET" \
  --channel "$CHANNEL" \
  "${EXTRA[@]}"
