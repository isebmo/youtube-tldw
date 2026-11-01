#!/usr/bin/env bash
# Regenerate every icon of the project from the SVG sources in marketing/icon/:
# extension icons + logo.png (Firefox, Chrome, Safari), the iOS/macOS AppIcon
# set, the app's LargeIcon / Icon.png. Requires rsvg-convert (brew install
# librsvg) and python3 with Pillow (to strip alpha from the App Store icons).
# Run scripts/sync-safari-xcode.sh afterwards to copy safari-ext-yt/ into Xcode.

set -euo pipefail

cd "$(dirname "$0")/.."

SRC="marketing/icon"
APP="safari-xcode-project/YouTube TLDW/Shared (App)"
ICONSET="$APP/Assets.xcassets/AppIcon.appiconset"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

render() { rsvg-convert -w "$2" -h "$2" "$1" -o "$3"; }

# Full-bleed masters (iOS applies its own mask).
render "$SRC/icon.svg" 1024 "$TMP/full.png"
render "$SRC/icon-dark.svg" 1024 "$TMP/full-dark.png"
render "$SRC/icon-tinted.svg" 1024 "$TMP/full-tinted.png"
FULL="data:image/png;base64,$(base64 < "$TMP/full.png" | tr -d '\n')"

# Rounded tile with transparent corners and a hairline edge, for browsers,
# logo.png and in-app images. $1 = margin around the tile, in 1024 units.
tile_svg() {
    local m=$1 s=$((1024 - 2 * $1))
    local r=$((s * 225 / 1000))
    cat <<EOF
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1024 1024">
  <defs><clipPath id="c"><rect x="$m" y="$m" width="$s" height="$s" rx="$r"/></clipPath></defs>
  <image x="$m" y="$m" width="$s" height="$s" clip-path="url(#c)" xlink:href="$FULL"/>
  <rect x="$m" y="$m" width="$s" height="$s" rx="$r" fill="none" stroke="#000" stroke-opacity=".1" stroke-width="12"/>
</svg>
EOF
}
tile_svg 0 > "$TMP/tile.svg"
tile_svg 40 > "$TMP/tile-padded.svg"

# macOS template: 824 px rounded rect centered on 1024 with a drop shadow.
cat > "$TMP/mac.svg" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1024 1024">
  <defs>
    <clipPath id="c"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="14"/><feOffset dy="12"/><feComponentTransfer><feFuncA type="linear" slope=".3"/></feComponentTransfer></filter>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="#000" filter="url(#s)"/>
  <image x="100" y="100" width="824" height="824" clip-path="url(#c)" xlink:href="$FULL"/>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="none" stroke="#000" stroke-opacity=".08" stroke-width="4"/>
</svg>
EOF

# Browser extensions
for s in 48 96 128; do render "$TMP/tile-padded.svg" $s "firefox-ext-yt/icons/icon-$s.png"; done
for s in 16 48 128; do render "$TMP/tile-padded.svg" $s "chrome-ext-yt/icons/icon-$s.png"; done
for s in 48 96 128 256 512; do render "$TMP/tile-padded.svg" $s "safari-ext-yt/icons/icon-$s.png"; done
for d in firefox-ext-yt chrome-ext-yt safari-ext-yt site-ext-yt; do render "$TMP/tile.svg" 540 "$d/logo.png"; done

# iOS / macOS app
render "$TMP/tile.svg" 256 "$APP/Assets.xcassets/LargeIcon.imageset/icon-256.png"
render "$TMP/tile.svg" 512 "$APP/Resources/Icon.png"
for s in 16 32 128 256 512; do
    render "$TMP/mac.svg" $s "$ICONSET/mac-icon-$s@1x.png"
    render "$TMP/mac.svg" $((s * 2)) "$ICONSET/mac-icon-$s@2x.png"
done

# App Store rejects an alpha channel on the iOS icons.
python3 - "$TMP" "$ICONSET" <<'EOF'
import sys
from PIL import Image
tmp, out = sys.argv[1:]
for src, dst in [("full", "universal-icon-1024@1x"), ("full-dark", "universal-icon-dark-1024@1x"), ("full-tinted", "universal-icon-tinted-1024@1x")]:
    Image.open(f"{tmp}/{src}.png").convert("RGB").save(f"{out}/{dst}.png")
EOF

echo "Icons regenerated. Run scripts/sync-safari-xcode.sh to update the Xcode extension resources."
