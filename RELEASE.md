# Release Procedures

## Prerequisites

All secrets are stored in `.env` (git-ignored):

```env
AMO_JWT_ISSUER=...
AMO_JWT_SECRET=...
CHROME_CLIENT_ID=...
CHROME_CLIENT_SECRET=...
CHROME_REFRESH_TOKEN=...
CHROME_EXTENSION_ID=eeennffobiomhlhdgalmmdpbfpaokdga
```

### Obtaining keys

**Firefox (AMO):** Generate JWT keys at https://addons.mozilla.org/developers/addon/api/key/

**Chrome:**
1. Google Cloud project: `youtube-tldw-ext`
2. OAuth credentials: https://console.cloud.google.com/apis/credentials?project=youtube-tldw-ext
3. Refresh token: run the OAuth flow below then exchange the code

```bash
source .env

# 1. Open in browser, authorize, copy code from redirect URL
echo "https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=${CHROME_CLIENT_ID}&redirect_uri=http://localhost:8888&scope=https://www.googleapis.com/auth/chromewebstore&access_type=offline"

# 2. Exchange code for refresh token
curl -s -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=${CHROME_CLIENT_ID}&client_secret=${CHROME_CLIENT_SECRET}&code=CODE_HERE&grant_type=authorization_code&redirect_uri=http://localhost:8888"
```

---

## Firefox

Extension ID: `youtube-tldw@sebastienmouret.com`
Dashboard: https://addons.mozilla.org/en-US/developers/addon/youtube-tldw/

### Release

```bash
source .env

npx web-ext sign \
  --source-dir firefox-ext-yt/ \
  --api-key "$AMO_JWT_ISSUER" \
  --api-secret "$AMO_JWT_SECRET" \
  --channel listed \
  --amo-metadata amo-metadata.json
```

The command uploads, validates, and submits for review. Review takes 1-3 days. The command will timeout waiting for approval — this is normal, the submission is registered.

### Notes

- `manifest.json` must include `data_collection_permissions` with `"required": ["none"]`
- Icons must be square (use `icons/` folder, not `logo.png` directly)
- `innerHTML` warnings are non-blocking

---

## Chrome

Extension ID: `eeennffobiomhlhdgalmmdpbfpaokdga`
Dashboard: https://chrome.google.com/webstore/devconsole/

### Build zip

```bash
cd chrome-ext-yt
rm -f ../chrome-ext-yt.zip
zip -r ../chrome-ext-yt.zip . -x ".*"
```

### Upload new version

```bash
source .env

npx chrome-webstore-upload-cli upload \
  --source chrome-ext-yt.zip \
  --extension-id "$CHROME_EXTENSION_ID" \
  --client-id "$CHROME_CLIENT_ID" \
  --client-secret "$CHROME_CLIENT_SECRET" \
  --refresh-token "$CHROME_REFRESH_TOKEN"
```

### Publish

```bash
source .env

npx chrome-webstore-upload-cli publish \
  --extension-id "$CHROME_EXTENSION_ID" \
  --client-id "$CHROME_CLIENT_ID" \
  --client-secret "$CHROME_CLIENT_SECRET" \
  --refresh-token "$CHROME_REFRESH_TOKEN"
```

Review takes 1-5 days.

### Notes

- Do not request unused permissions (e.g. `scripting` was rejected)
- Icons must be square
- Screenshots for store listing: 1280x800 or 640x400, JPEG 24-bit (no alpha). Pre-generated in `store-screenshots/`

---

## Safari

Xcode project: `safari-xcode-project/YouTube TLDW/YouTube TLDW.xcodeproj`

### Build

1. Open the Xcode project
2. Verify both macOS + iOS targets
3. iOS deployment target: 15.0
4. Product > Archive (for each target)

### Publish

Requires an Apple Developer account ($99/year). Submit via Xcode > Organizer > Distribute App > App Store Connect.

### Regenerate Xcode project from source

```bash
xcrun safari-web-extension-converter safari-ext-yt/ \
  --project-location safari-xcode-project \
  --app-name "YouTube TLDW" \
  --bundle-identifier com.mouret.youtube-tldw \
  --swift \
  --copy-resources \
  --no-open
```

---

## Landing page

URL: https://tldw.mouret.pro
Hosted on Cloudflare Pages (project: `ytdw`)

### Deploy

```bash
npx wrangler pages deploy site-ext-yt --project-name ytdw --branch main
```

---

## Version bump checklist

When releasing a new version, update `"version"` in:

- [ ] `firefox-ext-yt/manifest.json`
- [ ] `chrome-ext-yt/manifest.json`
- [ ] `safari-ext-yt/manifest.json`
