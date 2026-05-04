#!/bin/zsh
# Deploy the YouTube TLDW; iOS app to TestFlight.
#
# Usage:
#   scripts/deploy-testflight.sh                # bump build, keep version
#   scripts/deploy-testflight.sh 1.2.0          # bump build, set version 1.2.0
#   scripts/deploy-testflight.sh --skip-upload  # archive + export only
#   scripts/deploy-testflight.sh 1.2.0 --skip-upload
#
# Required environment variables (App Store Connect API key):
#   ASC_KEY_ID        Key ID (e.g. PSF4RH44AM)
#   ASC_ISSUER_ID     Issuer ID (UUID format)
#
# The matching .p8 private key must live at:
#   ~/.appstoreconnect/private_keys/AuthKey_<ASC_KEY_ID>.p8

set -euo pipefail

VERSION=""
SKIP_UPLOAD=""
for arg in "$@"; do
    case "$arg" in
        --skip-upload) SKIP_UPLOAD="--skip-upload" ;;
        *)
            if [[ -z "$VERSION" ]]; then
                VERSION="$arg"
            fi
            ;;
    esac
done

if [[ -n "$VERSION" ]]; then
    if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
        echo "❌  Version invalide : '$VERSION' (format attendu : A.B ou A.B.C)"
        exit 1
    fi
fi

: "${ASC_KEY_ID:?Variable d'environnement ASC_KEY_ID requise.}"
: "${ASC_ISSUER_ID:?Variable d'environnement ASC_ISSUER_ID requise.}"

P8_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
if [[ ! -f "$P8_PATH" ]]; then
    echo "❌  Clé privée introuvable : $P8_PATH"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$ROOT_DIR/safari-xcode-project/YouTube TLDW"
PROJECT_FILE="$PROJECT_DIR/YouTube TLDW.xcodeproj"
SCHEME="YouTube TLDW (iOS)"
TEAM_ID="2T8A23HDD8"
BUILD_DIR="$ROOT_DIR/build/testflight"
ARCHIVE_PATH="$BUILD_DIR/YouTubeTLDW.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"
EXPORT_OPTIONS="$SCRIPT_DIR/ExportOptions.plist"

[[ -f "$EXPORT_OPTIONS" ]] || { echo "❌  ExportOptions.plist introuvable"; exit 1; }

# --- 1. Bump build number (and optionally the marketing version) -----------
cd "$PROJECT_DIR"
CURRENT_BUILD=$(xcrun agvtool what-version -terse)
NEW_BUILD=$((CURRENT_BUILD + 1))
xcrun agvtool new-version -all "$NEW_BUILD" >/dev/null
if [[ -n "$VERSION" ]]; then
    xcrun agvtool new-marketing-version "$VERSION" >/dev/null
fi
CURRENT_VERSION=$(xcrun agvtool what-marketing-version -terse1 2>/dev/null | tail -1)

echo "📦  Version : $CURRENT_VERSION  (build $NEW_BUILD)"

# --- 2. Clean & archive (with API key for provisioning) --------------------
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "🏗️   Archive en cours…"
xcodebuild archive \
    -project "$PROJECT_FILE" \
    -scheme "$SCHEME" \
    -configuration Release \
    -archivePath "$ARCHIVE_PATH" \
    -destination "generic/platform=iOS" \
    -allowProvisioningUpdates \
    -authenticationKeyPath "$P8_PATH" \
    -authenticationKeyID "$ASC_KEY_ID" \
    -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    | grep -E "error:|warning:|BUILD |\*\* " || true

[[ -d "$ARCHIVE_PATH" ]] || { echo "❌  Archive échouée."; exit 1; }

# --- 3. Export IPA ---------------------------------------------------------
echo "📦  Export IPA…"
xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$EXPORT_PATH" \
    -exportOptionsPlist "$EXPORT_OPTIONS" \
    -allowProvisioningUpdates \
    -authenticationKeyPath "$P8_PATH" \
    -authenticationKeyID "$ASC_KEY_ID" \
    -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
    | grep -E "error:|warning:|EXPORT " || true

IPA_PATH=$(ls "$EXPORT_PATH"/*.ipa 2>/dev/null | head -1)
[[ -n "$IPA_PATH" && -f "$IPA_PATH" ]] || { echo "❌  IPA introuvable dans $EXPORT_PATH"; exit 1; }
echo "📱  IPA : $IPA_PATH"

# --- 4. Upload TestFlight --------------------------------------------------
if [[ "$SKIP_UPLOAD" == "--skip-upload" ]]; then
    echo "⏭️   Upload TestFlight ignoré. IPA prêt à $IPA_PATH"
    exit 0
fi

echo "🚀  Upload TestFlight…"
xcrun altool --upload-app \
    --type ios \
    --file "$IPA_PATH" \
    --apiKey "$ASC_KEY_ID" \
    --apiIssuer "$ASC_ISSUER_ID"

echo ""
echo "✅  Build $NEW_BUILD ($CURRENT_VERSION) uploadé sur TestFlight."
echo "   Surveille https://appstoreconnect.apple.com/ — le traitement prend ~10 min."
