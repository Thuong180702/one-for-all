# 🚀 notihub v1.1.1

**Release Title**: `v1.1.1 - Menu Bar Icon Fix`

---

## 🌟 Highlights

- **🔧 The menu bar icon is back**: on some Macs the notihub tray icon silently stopped appearing — the app ran fine, logged nothing, but owned no visible menu bar item. Root cause was a broken per-bundle-id menu bar slot held by macOS, not anything in notihub's code. The app now ships under a new bundle identifier, which gets a clean slot.

---

## 🛠️ Detailed Changelog

### 🔧 Menu bar icon no longer disappears
- App bundle identifier changed from `io.github.thuong180702.notihub` to `io.github.thuong180702.notihub.app`.
- The Homebrew cask's `zap trash` paths were updated to match the new identifier, so uninstall still cleans up after itself.

### 🔍 How this was diagnosed
The symptom looked like a code regression — it appeared right after the `one-for-all` → `notihub` rename, so the rename was the obvious suspect. It wasn't. Ruled out, each by reproduction rather than by reading code:

- **notihub's own code** — the untouched v0.8.0 source, the version that "worked", failed identically when run today.
- **Electron** — Electron 42.8.1, 43.3.0 and 44.0.0-beta.1 all failed; a 15-line Electron app doing nothing but `new Tray(icon)` showed nothing either.
- **The icon, the bundle metadata, the ad-hoc signature, the install location** — all verified correct, and changing them changed nothing.
- **The menu bar itself** — a native Swift `NSStatusItem` test binary placed an item without trouble at the same moment notihub could not.

The decisive test was a native `NSStatusItem` probe packaged into several bundles that were byte-identical except for `CFBundleIdentifier`:

| `CFBundleIdentifier` | status item frame | Visible |
| :--- | :--- | :--- |
| `…one-for-all` | `(1091, 949, 63, 33)` | ✅ |
| `…notihub2` (with `CFBundleName` still `notihub`) | `(1091, 949, 63, 33)` | ✅ |
| `…notihub.app` | `(1092, 949, 63, 33)` | ✅ |
| `…notihub` | `(1449, 960, 63, 22)` / `(0, −17, 63, 22)` | ❌ |

Under the old identifier macOS still created the item and reported `isVisible = true`, but placed it at an invalid position — underneath the clock, or off-screen entirely — always using the legacy 22pt menu bar height instead of the 33pt one. Keeping the display name `notihub` while changing only the identifier fixed it, which is what confirmed the identifier was the variable and the name was not.

The bad state could not be cleared from the app side: it was absent from the app's preferences (both `AnyHost` and `ByHost`), survived removing stale LaunchServices registrations, ignored hand-written `NSStatusItem Preferred Position` / `VisibleCC` keys, and survived restarting `ControlCenter`, `SystemUIServer` and `Dock`.

### ⚠️ Notification permission must be re-granted
macOS ties notification permission to the bundle identifier, so this build looks like a new app to the system. Approve the prompt on the first notification, or enable it manually in **System Settings → Notifications → notihub**.

Your data is **not** affected — services, history settings and preferences live in `~/Library/Application Support/notihub`, which is keyed by app name, not by bundle identifier.

---

## 📦 Download Assets & Checksums

| Asset File | Format | SHA-256 Checksum |
| :--- | :--- | :--- |
| **`notihub-v1.1.1-mac.dmg`** | **Native macOS DMG Installer** | `98a3ab9535e173eb6ffebd8c77a6ff2d780ae44b3d4fa274046518c360981679` |
| **`notihub-v1.1.1-mac.zip`** | Portable Zip Archive | `8e3216764309e23c564d7da08750f916da37796a16ac809c492f7513e376f30c` |

---

## 📥 Installation Options

### Method 1: Homebrew (Recommended)
```bash
brew install --cask https://raw.githubusercontent.com/Thuong180702/notihub/main/Casks/notihub.rb
```

### Method 2: DMG Installer
1. Download **`notihub-v1.1.1-mac.dmg`** below.
2. Double click to open the DMG, then drag **`notihub.app`** into **`Applications`**.

### Method 3: Direct Zip Download
1. Download `notihub-v1.1.1-mac.zip`.
2. Unzip and move `notihub.app` into `/Applications`.

### Method 4: Terminal / Curl
```bash
curl -LO https://github.com/Thuong180702/notihub/releases/download/v1.1.1/notihub-v1.1.1-mac.dmg
open notihub-v1.1.1-mac.dmg
```

---

## ⬆️ Upgrading from v1.0.1 or earlier

Replace the app as usual. Because the bundle identifier changed, also do this once:

1. Quit any running copy of notihub before installing.
2. Re-approve notifications when prompted (see above).
3. If **System Settings → General → Login Items & Extensions** shows a duplicate `notihub` entry left over from the old identifier, remove the stale one.

---

## ⚠️ Gatekeeper Notice

notihub is signed ad-hoc, not notarized by Apple. macOS will refuse to open it with "notihub is damaged and can't be opened" on first launch — this isn't corruption, it's Gatekeeper rejecting an unnotarized app. Clear the quarantine flag once:

```bash
xattr -dr com.apple.quarantine /Applications/notihub.app
```
