# Fastlane Setup Guide

This guide explains how to configure and run the Fastlane automation pipeline that uploads SummitLink builds to **TestFlight** (iOS) and **Google Play Internal Testing** (Android).

---

## Prerequisites

- macOS (required for iOS builds)
- Ruby ≥ 3.0 (`ruby -v`)
- Xcode ≥ 15 with Command Line Tools (`xcode-select --install`)
- Android Studio + Android SDK (for Android builds)
- Active Apple Developer account (Task A-01)
- Active Google Play Developer account (Task A-02)

---

## Install Fastlane

```bash
cd fastlane
gem install bundler
bundle install
```

---

## iOS – App Store Connect API Key (recommended over Apple ID + password)

Using an API key avoids 2FA prompts in CI.

1. Sign in to [App Store Connect](https://appstoreconnect.apple.com)
2. Go to **Users and Access → Integrations → App Store Connect API**
3. Click **+** to generate a new key
   - Role: **App Manager** (or **Admin**)
4. Download the `.p8` file (you can only download it once)
5. Note the **Key ID** and **Issuer ID** shown on the page

**Encode the key for GitHub Secrets:**
```bash
base64 -i AuthKey_KEYID.p8 | pbcopy   # macOS – copies to clipboard
```

**Add these GitHub Secrets** (Settings → Secrets → Actions):

| Secret name | Value |
|------------|-------|
| `APPLE_API_KEY_ID` | Key ID (e.g. `ABCDEF1234`) |
| `APPLE_API_ISSUER_ID` | Issuer ID (UUID format) |
| `APPLE_API_KEY_CONTENT` | Base64-encoded `.p8` content |

---

## Android – Google Play Service Account JSON Key

1. Go to [Google Play Console](https://play.google.com/console) → **Setup → API access**
2. Link to a Google Cloud project (or create one)
3. Click **Create new service account**
4. In Google Cloud IAM, grant the service account **Service Account User** role
5. Back in Play Console, grant the service account **Release manager** access
6. In Google Cloud Console, create a JSON key for the service account:
   - Go to **IAM & Admin → Service Accounts**
   - Click the service account → **Keys → Add Key → Create new key → JSON**
   - Download the JSON file

**Encode for GitHub Secrets:**
```bash
base64 -i google-play-service-account.json | pbcopy
```

**Add this GitHub Secret:**

| Secret name | Value |
|------------|-------|
| `GOOGLE_PLAY_JSON_KEY_BASE64` | Base64-encoded JSON key |

---

## Android – Signing Keystore

1. Generate a release keystore (if you don't have one):
```bash
keytool -genkey -v \
  -keystore summitlink-release.keystore \
  -alias summitlink \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

2. Get the SHA-256 fingerprint (needed for `assetlinks.json`):
```bash
keytool -list -v \
  -keystore summitlink-release.keystore \
  -alias summitlink
```

3. Encode keystore for GitHub Secrets:
```bash
base64 -i summitlink-release.keystore | pbcopy
```

**Add these GitHub Secrets:**

| Secret name | Value |
|------------|-------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded `.keystore` file |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias (e.g. `summitlink`) |
| `ANDROID_KEY_PASSWORD` | Key password |

---

## Local Testing

**Test iOS build locally:**
```bash
cd fastlane
bundle exec fastlane ios beta_ios
```

**Test Android build locally:**
```bash
cd fastlane
bundle exec fastlane android beta_android
```

**Build both platforms:**
```bash
cd fastlane
bundle exec fastlane beta
```

**Upload App Store metadata only (no binary):**
```bash
cd fastlane
bundle exec fastlane ios deliver_metadata
```

---

## CI Trigger

The `fastlane-beta.yml` workflow triggers automatically when you push a version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

You can also trigger it manually from the **GitHub Actions** tab with platform selection.

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| `No code signing identities found` | Install distribution certificate in Keychain, or use Fastlane Match |
| `Transporter iTunes Store operation failed` | Check APPLE_API_KEY_ID / ISSUER_ID are correct |
| `Google Play upload failed: 401` | Re-generate the service account JSON key |
| `bundle exec fastlane` not found | Run `gem install bundler && bundle install` in `fastlane/` |
| `pod install` fails | Run `sudo gem install cocoapods && pod repo update` |
| Xcode build fails with provisioning error | Open Xcode manually and resolve provisioning profile issues |

---

## File Locations

| File | Purpose |
|------|---------|
| `fastlane/Appfile` | App identifiers and team IDs (replace placeholders) |
| `fastlane/Fastfile` | Lane definitions |
| `fastlane/Gemfile` | Ruby gem dependencies |
| `fastlane/Deliverfile` | App Store metadata delivery config |
| `fastlane/metadata/` | App Store and Google Play metadata |
| `.github/workflows/fastlane-beta.yml` | CI workflow for automated releases |
