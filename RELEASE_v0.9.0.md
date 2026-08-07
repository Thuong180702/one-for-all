# 🚀 notihub v0.9.0

**Release Title**: `v0.9.0 - Project Renamed to notihub`

---

## 🌟 Highlights

- **✨ Renamed the project**: `one-for-all` is now **notihub**. New package name, CLI command (`notihub`, the `ofa` alias is gone), app bundle ID (`io.github.thuong180702.notihub`), window/tray title, and data directory (`~/Library/Application Support/notihub`).
- **🍺 Homebrew cask updated**: token, app name, and cleanup paths on `brew uninstall --zap` now match the new bundle id.

---

## 🛠️ Detailed Changelog

### 📦 Rebrand
- `package.json`, CLI (`bin/ofa.js` → `bin/notihub.js`), app title/tray/menu, User-Agent string, and config/log/pid file locations all renamed from `one-for-all` to `notihub`.
- Fixed a stale mismatch in the cask's `zap trash` paths, which referenced a `com.thuong180702.*` prefix that no longer matched the actual `io.github.thuong180702.*` bundle id — cleanup now actually removes the right files.
- Internal Electron IPC channel names (`ofa:*`) were intentionally left as-is; they're implementation detail, not user-facing.

---

## 📦 Download Assets & Checksums

| Asset File | Format | SHA-256 Checksum |
| :--- | :--- | :--- |
| **`notihub-v0.9.0-mac.dmg`** | **Native macOS DMG Installer** | `81c1131001b09fcb071a582695a24dc83964ca6180fa44768e467ea024683147` |
| **`notihub-v0.9.0-mac.zip`** | Portable Zip Archive | `6367727fcb39f8aac3fa1d15bce2dd03c9cbd59fef44081e036d40b1cb75fe4b` |

---

## 📥 Installation Options

### Method 1: Homebrew (Recommended)
```bash
brew install --cask https://raw.githubusercontent.com/Thuong180702/notihub/main/Casks/notihub.rb
```

### Method 2: DMG Installer
1. Download **`notihub-v0.9.0-mac.dmg`** below.
2. Double click to open the DMG, then drag **`notihub.app`** into **`Applications`**.

### Method 3: Direct Zip Download
1. Download `notihub-v0.9.0-mac.zip`.
2. Unzip and move `notihub.app` into `/Applications`.

### Method 4: Terminal / Curl
```bash
curl -LO https://github.com/Thuong180702/notihub/releases/download/v0.9.0/notihub-v0.9.0-mac.dmg
open notihub-v0.9.0-mac.dmg
```

---

## ⚠️ Upgrading from one-for-all

The app's data directory, config file, and macOS notification permission are tied to the bundle id, which changed in this release. After installing v0.9.0:
- Your old `one-for-all` install is unaffected and can be removed manually (`brew uninstall --cask one-for-all --zap` if it was installed via the old cask name, or drag `one-for-all.app` to Trash).
- notihub starts fresh — you'll need to re-add your services (`notihub add messenger`, etc.) and re-approve the notification permission prompt once.
