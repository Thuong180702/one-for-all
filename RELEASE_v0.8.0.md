# 🚀 one-for-all v0.8.0

**Release Title**: `v0.8.0 - Official Web Favicons, Multi-Space Fix, DMG Installer & Theme Switcher`

---

## 🌟 Highlights & New Features

- **💿 Native macOS DMG Installer**: Added automatic creation of `.dmg` installer packages (`one-for-all-v0.8.0-mac.dmg`) alongside standard `.zip` releases for easy drag-and-drop installation.
- **🖼️ Official Web Favicons**: Automatically fetches and renders high-resolution official web favicons for all services (Gmail, Outlook, Slack, Zalo, Messenger, Telegram, Discord, WhatsApp) as well as custom web apps added by URL.
- **🎨 Appearance & Theme Switcher**: Choose your preferred app appearance in Settings:
  - **💻 System**: Follows your macOS system theme (light/dark).
  - **🌙 Dark**: Premium dark glassmorphic appearance.
  - **☀️ Light**: Clean, bright light theme.
- **🖥️ Multi-Space macOS Fix**: Seamlessly opens the Menu Bar Panel on your **current active Desktop Space** or Fullscreen App without jumping back to previous spaces.
- **⚡ Instant Window Switching**: Instantaneous toggling between `Standard Window` and `Menu Bar Panel` mode without app restarts, alongside customizable global hotkey support.
- **🔒 Onboarding Safety Timeout**: Added a 2.5s fallback safety timeout for initial macOS notification permission checks, ensuring the Welcome screen never freezes.

---

## 🛠️ Detailed Changelog

### 🚀 Build & Packaging
- Added native `hdiutil` DMG creation pipeline to `scripts/build-app.js`. `npm run build` now generates both `.app`, `.zip`, and `.dmg` installers automatically.

### 🎨 UI & User Experience
- Restored `getFaviconUrl` for preset web apps and automatic dynamic favicon resolution via `page-favicon-updated`.
- Added Theme Appearance buttons in Settings (`system`, `dark`, `light`) powered by Electron's native `nativeTheme` API.
- Grouped card controls inside `.controls` containers to ensure clean, balanced responsive alignment in 420px Menu Bar Mode.
- Fixed theme active state highlight bug in `src/setup.html` parameter destructuring.

### ⚙️ System & macOS Integrations
- Configured `win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` for Menu Bar Panel mode to eliminate desktop space switching.
- Synchronized `patchConfig` in-memory state mutations before disk saves to remove the 250ms `fs.watch` race condition delay.

---

## 📦 Download Assets & Checksums

| Asset File | Format | SHA-256 Checksum |
| :--- | :--- | :--- |
| **`one-for-all-v0.8.0-mac.dmg`** | **Native macOS DMG Installer** | `7cbdfaa2f629a676e5187d36518dce837a8c9827eb4087f5f957b1a73f11e436` |
| **`one-for-all-v0.8.0-mac.zip`** | Portable Zip Archive | `1faaf6a6b65b334723a362f53c44cce812012ba324d2feb48b2d6ebc26edf23a` |

---

## 📥 Installation Options

### Method 1: DMG Installer (Recommended)
1. Download **`one-for-all-v0.8.0-mac.dmg`** below.
2. Double click to open the DMG, then drag **`one-for-all.app`** into **`Applications`**.

### Method 2: Direct Zip Download
1. Download `one-for-all-v0.8.0-mac.zip`.
2. Unzip and move `one-for-all.app` into `/Applications`.

### Method 3: Terminal / Curl
```bash
curl -LO https://github.com/Thuong180702/one-for-all/releases/download/v0.8.0/one-for-all-v0.8.0-mac.dmg
open one-for-all-v0.8.0-mac.dmg
```
