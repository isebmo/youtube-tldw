#!/bin/zsh
# Deploy the YouTube TLDW; macOS app to the Mac App Store (TestFlight for Mac).
#
# Usage:
#   scripts/deploy-macappstore.sh                # bump build, keep version
#   scripts/deploy-macappstore.sh 1.2.0          # also set version 1.2.0
#   scripts/deploy-macappstore.sh --skip-upload  # archive + export only
#
# Required environment variables (App Store Connect API key):
#   ASC_KEY_ID        Key ID
#   ASC_ISSUER_ID     Issuer ID (UUID)
# .p8 file expected at ~/.appstoreconnect/private_keys/AuthKey_<ASC_KEY_ID>.p8

set -euo pipefail

VERSION=""
SKIP_UPLOAD=""
for arg in "$@"; do
    case "$arg" in
        --skip-upload) SKIP_UPLOAD="--skip-upload" ;;
        *) [[ -z "$VERSION" ]] && VERSION="$arg" ;;
    esac
done

if [[ -n "$VERSION" ]]; then
    if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
        echo "❌  Version invalide : '$VERSION' (format A.B ou A.B.C)"; exit 1
    fi
fi

: "${ASC_KEY_ID:?Variable ASC_KEY_ID requise.}"
: "${ASC_ISSUER_ID:?Variable ASC_ISSUER_ID requise.}"

P8_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
[[ -f "$P8_PATH" ]] || { echo "❌  Clé privée introuvable : $P8_PATH"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$ROOT_DIR/safari-xcode-project/YouTube TLDW"
PROJECT_FILE="$PROJECT_DIR/YouTube TLDW.xcodeproj"
SCHEME="YouTube TLDW (macOS)"
TEAM_ID="2T8A23HDD8"
BUILD_DIR="$ROOT_DIR/build/macappstore"
ARCHIVE_PATH="$BUILD_DIR/YouTubeTLDW-mac.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"
EXPORT_OPTIONS="$SCRIPT_DIR/ExportOptionsMac.plist"

[[ -f "$EXPORT_OPTIONS" ]] || { echo "❌  $EXPORT_OPTIONS introuvable"; exit 1; }

# --- 1. Bump build (and optionally marketing version) ----------------------
cd "$PROJECT_DIR"
CURRENT_BUILD=$(xcrun agvtool what-version -terse)
NEW_BUILD=$((CURRENT_BUILD + 1))
xcrun agvtool new-version -all "$NEW_BUILD" >/dev/null
[[ -n "$VERSION" ]] && xcrun agvtool new-marketing-version "$VERSION" >/dev/null
CURRENT_VERSION=$(xcrun agvtool what-marketing-version -terse1 2>/dev/null | tail -1)

echo "📦  macOS — Version : $CURRENT_VERSION  (build $NEW_BUILD)"

# --- 2. Clean & archive ----------------------------------------------------
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "🏗️   Archive macOS…"
xcodebuild archive \
    -project "$PROJECT_FILE" \
    -scheme "$SCHEME" \
    -configuration Release \
    -archivePath "$ARCHIVE_PATH" \
    -destination "generic/platform=macOS" \
    -allowProvisioningUpdates \
    -authenticationKeyPath "$P8_PATH" \
    -authenticationKeyID "$ASC_KEY_ID" \
    -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    | grep -E "error:|warning:|BUILD |\*\* " || true

[[ -d "$ARCHIVE_PATH" ]] || { echo "❌  Archive échouée."; exit 1; }

# --- 3. Export pkg ---------------------------------------------------------
echo "📦  Export Mac App Store package…"
xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$EXPORT_PATH" \
    -exportOptionsPlist "$EXPORT_OPTIONS" \
    -allowProvisioningUpdates \
    -authenticationKeyPath "$P8_PATH" \
    -authenticationKeyID "$ASC_KEY_ID" \
    -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
    | grep -E "error:|warning:|EXPORT " || true

PKG_PATH=$(ls "$EXPORT_PATH"/*.pkg 2>/dev/null | head -1)
[[ -n "$PKG_PATH" && -f "$PKG_PATH" ]] || { echo "❌  PKG introuvable dans $EXPORT_PATH"; exit 1; }
echo "📦  PKG : $PKG_PATH"

# --- 4. Upload Mac App Store -----------------------------------------------
if [[ "$SKIP_UPLOAD" == "--skip-upload" ]]; then
    echo "⏭️   Upload ignoré. PKG prêt : $PKG_PATH"
    exit 0
fi

echo "🚀  Upload Mac App Store…"
xcrun altool --upload-app \
    --type macos \
    --file "$PKG_PATH" \
    --apiKey "$ASC_KEY_ID" \
    --apiIssuer "$ASC_ISSUER_ID"

echo ""
echo "✅  Build $NEW_BUILD ($CURRENT_VERSION) macOS uploadé."
echo "   https://appstoreconnect.apple.com/ — traitement ~10 min."
