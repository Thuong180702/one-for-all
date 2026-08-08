# 🚀 notihub v1.0.1

**Release Title**: `v1.0.1 - Update Notifications`

---

## 🌟 Highlights

- **🔔 Update Notifications**: notihub now checks GitHub Releases in the background (on launch, then every 6 hours) and shows an amber dot on the Settings icon plus a banner in Settings when a newer version is out — with a one-click link to the release page.

---

## 🛠️ Detailed Changelog

### 🔔 Update check
- Background check against `api.github.com/repos/Thuong180702/notihub/releases/latest`, compared against the running build's version (`app.getVersion()`).
- Amber status dot on the tab-strip Settings button (reusing the same dot language as the per-service connection status added in v1.0.0), plus a persistent "notihub vX.X.X — up to date" line and manual "Check for Updates" button in Settings → Startup.
- When a newer version is found: a dedicated banner at the top of Settings with a "View Release" button that opens the GitHub release page in the default browser.
- This is a **notify-only** check — no download, no install. See below for why.

### ⚠️ Why not auto-install
Investigated wiring up full auto-download-and-install (Squirrel.Mac via Electron's native `autoUpdater`) before shipping this release. Built two ad-hoc-signed test builds and ran a real update cycle end-to-end against a local feed server to verify feasibility rather than guess:

```
ERROR: Code signature at URL .../update.zip did not pass validation:
code failed to satisfy specified code requirement(s)
```

Squirrel.Mac requires the downloaded update to satisfy the same code-signing requirement as the running app. Ad-hoc signing (no paid Apple Developer ID) produces a different signature identity on every build, so Squirrel.Mac correctly refuses to install it — this isn't a bug to fix in notihub's code, it's a hard requirement that needs a real Developer ID certificate + notarization first. Auto-install stays out of scope until that's in place; the notify-only check in this release is the safe, working alternative.

---

## 📦 Download Assets & Checksums

| Asset File | Format | SHA-256 Checksum |
| :--- | :--- | :--- |
| **`notihub-v1.0.1-mac.dmg`** | **Native macOS DMG Installer** | `703cf64dff8e93bdeabfeb5fa8c1c1714df51bc519ce60f68e85ce30d0fcd816` |
| **`notihub-v1.0.1-mac.zip`** | Portable Zip Archive | `405e7a831b8f563fbd0f1721e9b4fcbfc796b31c0b67e80f2e39bb315762e543` |

---

## 📥 Installation Options

### Method 1: Homebrew (Recommended)
```bash
brew install --cask https://raw.githubusercontent.com/Thuong180702/notihub/main/Casks/notihub.rb
```

### Method 2: DMG Installer
1. Download **`notihub-v1.0.1-mac.dmg`** below.
2. Double click to open the DMG, then drag **`notihub.app`** into **`Applications`**.

### Method 3: Direct Zip Download
1. Download `notihub-v1.0.1-mac.zip`.
2. Unzip and move `notihub.app` into `/Applications`.

### Method 4: Terminal / Curl
```bash
curl -LO https://github.com/Thuong180702/notihub/releases/download/v1.0.1/notihub-v1.0.1-mac.dmg
open notihub-v1.0.1-mac.dmg
```

---

## ⚠️ Gatekeeper Notice

notihub is signed ad-hoc, not notarized by Apple. macOS will refuse to open it with "notihub is damaged and can't be opened" on first launch — this isn't corruption, it's Gatekeeper rejecting an unnotarized app. Clear the quarantine flag once:

```bash
xattr -dr com.apple.quarantine /Applications/notihub.app
```
