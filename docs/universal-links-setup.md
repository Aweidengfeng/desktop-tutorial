# Universal Links (iOS) + App Links (Android) Setup Guide

This document explains how to configure deep linking so that `summitlink.app` URLs open the SummitLink App directly on iOS and Android.

---

## Overview

| Platform | Technology | Verification file |
|----------|-----------|-------------------|
| iOS | Universal Links | `/.well-known/apple-app-site-association` |
| Android | App Links | `/.well-known/assetlinks.json` |
| Both (fallback) | Custom URL Scheme | `summitlink://` |

---

## Step 1 – Fill in the Apple Team ID (iOS)

The file `public/.well-known/apple-app-site-association` contains the placeholder `TEAMID`. Replace it with your actual 10-character Apple Developer Team ID.

**How to find your Team ID:**
1. Sign in to [developer.apple.com](https://developer.apple.com/account)
2. Go to **Membership** → **Team ID** (e.g. `ABC1234567`)

**Edit the file:**
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["ABC1234567.app.summitlink"],   ← replace TEAMID here
        ...
      }
    ]
  },
  "webcredentials": {
    "apps": ["ABC1234567.app.summitlink"]           ← and here
  }
}
```

---

## Step 2 – Fill in the Android SHA-256 Fingerprint

The file `public/.well-known/assetlinks.json` contains `PLACEHOLDER_REPLACE_WITH_YOUR_SHA256_FINGERPRINT`. Replace it with the SHA-256 fingerprint of your Android signing key.

**How to get the fingerprint:**

For a **debug keystore** (development):
```bash
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey \
  -storepass android \
  -keypass android
```

For a **release keystore** (production, use this for Play Store):
```bash
keytool -list -v \
  -keystore android/app/release.keystore \
  -alias your-alias-name
```

The output will contain a line like:
```
SHA256: A1:B2:C3:D4:E5:F6:...
```

Copy the value (including colons) and paste it into `assetlinks.json`:
```json
"sha256_cert_fingerprints": [
  "A1:B2:C3:D4:E5:F6:..."
]
```

> **Note:** If you use Google Play App Signing (recommended), get the fingerprint from **Play Console → Setup → App integrity → App signing key certificate**.

---

## Step 3 – Enable Associated Domains in Xcode (iOS)

1. Open `ios/App/App.xcworkspace` in Xcode
2. Select the **App** target → **Signing & Capabilities**
3. Click **+ Capability** → add **Associated Domains**
4. Add the following entries:
   ```
   applinks:summitlink.app
   webcredentials:summitlink.app
   ```
5. Ensure the provisioning profile includes the Associated Domains entitlement (Xcode handles this automatically if you have a paid Apple Developer account)

---

## Step 4 – Verify App Links in Android Studio

1. Open the project in Android Studio
2. Go to **Tools → App Links Assistant**
3. Click **Open URL Mapping Editor** and confirm the deep link paths match your intent filters in `AndroidManifest.xml`
4. Click **Test App Links** to verify the `assetlinks.json` file is reachable and valid

Alternatively, use `adb` on a device/emulator:
```bash
adb shell am start -a android.intent.action.VIEW \
  -c android.intent.category.BROWSABLE \
  -d "https://summitlink.app/expedition/123"
```

---

## Step 5 – Deploy and Verify

After deploying, verify the well-known files are accessible:

```bash
# iOS
curl -I https://summitlink.app/.well-known/apple-app-site-association

# Android
curl -I https://summitlink.app/.well-known/assetlinks.json
```

Both should return:
- HTTP `200 OK`
- `Content-Type: application/json`
- No redirect (3xx) responses

---

## Supported Deep Link Paths

| Path pattern | Handled by |
|-------------|-----------|
| `/verify-email?token=xxx` | `backend/routes/deeplinks.js` |
| `/reset-password?token=xxx` | `backend/routes/deeplinks.js` |
| `/expedition/*` | iOS Universal Links / Android App Links |
| `/route/*` | iOS Universal Links / Android App Links |
| `/profile/*` | iOS Universal Links / Android App Links |

---

## Custom URL Scheme Fallback

The App also registers the custom URL scheme `summitlink://` as a fallback for devices where Universal Links / App Links are not available (e.g. first launch, link shared via copy-paste).

The scheme is configured in:
- **iOS**: `ios/App/App/Info.plist` (CFBundleURLTypes)
- **Android**: `android/app/src/main/AndroidManifest.xml` (intent-filter with scheme)
- **Capacitor**: `capacitor.config.json` (server.androidScheme)

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Links open browser instead of App | Associated Domains not enabled | Step 3 above |
| 404 on `apple-app-site-association` | File not deployed | Deploy and check nginx |
| App Links not verified | Wrong SHA-256 fingerprint | Step 2 above |
| Universal Links stop working after reinstall | iOS caches AASA aggressively | Wait up to 24h or use developer mode |
