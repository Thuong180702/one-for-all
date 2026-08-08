# 🚀 notihub v1.2.0

**Release Title**: `v1.2.0 - WhatsApp Icon Fix & Dedicated Homebrew Tap`

---

## 🌟 Highlights

- **🖼️ Sharper WhatsApp icon**: the WhatsApp preset now uses the bundled hand-drawn SVG instead of Google's favicon service, which only ever returns a blurry 16×16 placeholder globe for `web.whatsapp.com`.
- **🍺 Dedicated Homebrew tap**: notihub now installs from its own tap, [`thuong180702/homebrew-notihub`](https://github.com/Thuong180702/homebrew-notihub), instead of a raw Cask URL pointed at this repo.

---

## 🛠️ Detailed Changelog

### 🖼️ WhatsApp preset uses the bundled icon
- Every other preset in `src/presets.js` fetches its favicon live via Google's favicon API, which is preferred over a bundled asset for accuracy. WhatsApp is the one exception: `web.whatsapp.com` has no real favicon registered (404s to a generic placeholder), and the `whatsapp.com` root only has a 23×23 icon — worse than the bundled SVG in every case.
- No user action needed; the fix applies automatically on next launch.

### 🍺 Homebrew install simplified
- Added a proper tap repo, [`homebrew-notihub`](https://github.com/Thuong180702/homebrew-notihub), holding `Casks/notihub.rb`.
- Removed the now-redundant `Casks/notihub.rb` from this repo.
- Install is now:
  ```bash
  brew tap thuong180702/notihub
  brew install --cask notihub
  ```

---

## 📦 Download Assets & Checksums

| Asset File | Format | SHA-256 Checksum |
| :--- | :--- | :--- |
| **`notihub-v1.2.0-mac.dmg`** | **Native macOS DMG Installer** | `4b860c2254a5f83e83988fb802257e705f0bd8a4f3b8e2512e964ad734b456dc` |
| **`notihub-v1.2.0-mac.zip`** | Portable Zip Archive | `fad46a9a5a16a2fc1c1c44ce192555f7ff09a18d949c6518f5d5515fe4a15eee` |

---

## 📥 Installation Options

### Method 1: Homebrew (Recommended)
```bash
brew tap thuong180702/notihub
brew install --cask notihub
```

### Method 2: DMG Installer
1. Download **`notihub-v1.2.0-mac.dmg`** below.
2. Double click to open the DMG, then drag **`notihub.app`** into **`Applications`**.

### Method 3: Direct Zip Download
1. Download `notihub-v1.2.0-mac.zip`.
2. Unzip and move `notihub.app` into `/Applications`.

### Method 4: Terminal / Curl
```bash
curl -LO https://github.com/Thuong180702/notihub/releases/download/v1.2.0/notihub-v1.2.0-mac.dmg
open notihub-v1.2.0-mac.dmg
```

---

## ⬆️ Upgrading from v1.1.1 or earlier

Replace the app as usual — no bundle identifier change this time, no notification re-grant needed.

If you previously installed via the old raw-URL Cask method, switch to the tap:
```bash
brew tap thuong180702/notihub
brew install --cask notihub
```

---

## ⚠️ Gatekeeper Notice

notihub is signed ad-hoc, not notarized by Apple. macOS will refuse to open it with "notihub is damaged and can't be opened" on first launch — this isn't corruption, it's Gatekeeper rejecting an unnotarized app. Clear the quarantine flag once:

```bash
xattr -dr com.apple.quarantine /Applications/notihub.app
```
