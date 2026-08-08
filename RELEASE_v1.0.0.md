# 🚀 notihub v1.0.0

**Release Title**: `v1.0.0 - Connection Reliability, Notification Filters & UI Overhaul`

---

## 🌟 Highlights

- **🚦 Live Connection Status**: Every tab now shows whether it's actually still connected — a quiet dot turns amber then red the longer a service goes without network activity, and flags outright if the page looks logged out. No more wondering whether silence means "no new messages" or "broken."
- **🛠️ Automatic Crash Recovery**: A crashed or hung renderer reloads itself with exponential backoff instead of sitting on a blank tab until you notice.
- **🎯 Notification Filters & Scheduled DND, now in Settings**: Per-service Priority/Allow/Deny regex rules and a full quiet-hours schedule editor — previously config-file-only, now built into the UI.
- **💎 Settings & Add Services redesign**: Sticky section nav, real toggle switches, a Browse/Manage split for services, simplified History cards, and a responsive layout that finally uses the window's actual width.
- **📦 First MIT-licensed release**: Added the `LICENSE` file the badge and `package.json` were already pointing at.

---

## 🛠️ Detailed Changelog

### 🔌 Reliability
- `render-process-gone` and `unresponsive`/`responsive` handlers added — a crashed or hung service tab now reloads itself (same exponential backoff as failed loads) instead of staying blank indefinitely.
- Fixed `sawApiNotification` staying permanently stuck if a site's Notification API integration silently broke after working once; it now expires after 10 minutes so the title-count fallback can take back over.
- Fixed `parseUnread()` misreading a parenthesized year or version number (`"Report (2023)"`) as an unread count of 2023.
- Fixed a `webRequest` listener leak on service removal that could leave a stale closure writing to an already-removed service's state.
- Capped the notification-icon cache so a site that cycles its favicon per unread count can't grow it unbounded.
- Added retry backoff (5s → capped at 5 min) for failed service loads, replacing an uncapped 5-second retry loop.
- Debounced favicon-change handling so a site swapping its favicon per message no longer triggers a disk write + full UI re-render on every single message.

### 🚦 Connection status & notification filters (new UI surfaces)
- Per-tab status dot (`tabs.html`) and status line (Settings → Manage) reflect live/stale/dead/needs-login/asleep, computed from time-since-last-request and login-page URL detection.
- Priority/Allow/Deny regex filters per service, editable directly in Settings (previously only settable by hand-editing `config.json`).
- Do Not Disturb: manual toggle and a full recurring-schedule editor (day-of-week + time window, add/remove multiple windows) in Settings.

### 💎 UI overhaul
- Settings: sticky section nav (Permissions/Appearance/Modes/Performance/DND/Startup), real switch controls replacing ambiguous state-label buttons, trimmed descriptions with full detail on hover, SVG icons replacing emoji.
- Add Services: split into Browse (catalog) and Manage (your active services + their filters) tabs — services no longer show a "Remove" button in both places.
- History: removed the redundant "Open Service" button per card in favor of making the whole card clickable (with proper keyboard/`role="button"` support), and now shows the service name instead of just its icon.
- Fixed the `Start at Login` control only ever sending "on" — it's a real two-way toggle now.
- Fixed a number-input field rendering with a white background in dark mode.
- Increased preset favicon resolution (`sz=64` → `sz=128`) and fixed active-tab contrast in the tab strip (was 1.33:1, under the 3:1 floor for UI surfaces).
- Fixed a real first-launch bug: dismissing the Welcome screen while a service was already loaded (but never made active) left the window with nothing attached to it at all — looked identical to the app hanging.
- Fixed `acceptsFirstMouse` so a click on Continue/Skip during onboarding — right after macOS's own permission dialog steals window focus — registers immediately instead of needing a second click.

### ⚡ Minimal Mode
- Minimal Mode now skips creating the tab-strip renderer process entirely (~30MB measured) since it has no tabs to show; its Notifications/Settings buttons moved into a small header inside the notification board itself. Services still stay fully loaded for real-time delivery — Electron has no Web Push API, so there's no way around that without dropping notifications for inactive services.

### 🧹 Cleanup
- Added the missing `LICENSE` file (MIT) referenced by the README badge and `package.json` since the project's inception.
- Fixed `scripts/test-5-notifications.js` silently doing nothing when notihub was already running (missing `-n` on `open`, which is required to force a new process that actually carries the payload through Electron's single-instance relay).
- Downscaled the bundled logo asset (1254px/1.1MB → 1024px for the `.icns` build, plus a separate 128px/17.5KB variant for in-app UI) — the full-resolution PNG was being base64-embedded into every `renderSetup()`/`renderTabs()` IPC message.
- Presets now resolve their icons via Google's favicon API instead of a bundled SVG approximation that didn't visually match the real brand logos.

---

## 📦 Download Assets & Checksums

| Asset File | Format | SHA-256 Checksum |
| :--- | :--- | :--- |
| **`notihub-v1.0.0-mac.dmg`** | **Native macOS DMG Installer** | `22f60b747cc73967761d157c5e8d08223c5cb72fa014def40d457efe6645f4ab` |
| **`notihub-v1.0.0-mac.zip`** | Portable Zip Archive | `9a15267c97424c256fe42d2de40936303a2adcd75939fc4cd4725a83e4c2eac3` |

---

## 📥 Installation Options

### Method 1: Homebrew (Recommended)
```bash
brew install --cask https://raw.githubusercontent.com/Thuong180702/notihub/main/Casks/notihub.rb
```

### Method 2: DMG Installer
1. Download **`notihub-v1.0.0-mac.dmg`** below.
2. Double click to open the DMG, then drag **`notihub.app`** into **`Applications`**.

### Method 3: Direct Zip Download
1. Download `notihub-v1.0.0-mac.zip`.
2. Unzip and move `notihub.app` into `/Applications`.

### Method 4: Terminal / Curl
```bash
curl -LO https://github.com/Thuong180702/notihub/releases/download/v1.0.0/notihub-v1.0.0-mac.dmg
open notihub-v1.0.0-mac.dmg
```

---

## ⚠️ Gatekeeper Notice

notihub is signed ad-hoc, not notarized by Apple. macOS will refuse to open it with "notihub is damaged and can't be opened" on first launch — this isn't corruption, it's Gatekeeper rejecting an unnotarized app. Clear the quarantine flag once:

```bash
xattr -dr com.apple.quarantine /Applications/notihub.app
```
