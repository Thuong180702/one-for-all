<div align="center">

# ⚡ notihub

### All-in-One Native macOS Notification Hub & Lightweight Web App Client

[![Release](https://img.shields.io/github/v/release/Thuong180702/notihub?style=flat-macro&color=007AFF)](https://github.com/Thuong180702/notihub/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%2012%2B-black?style=flat-macro&logo=apple)](https://github.com/Thuong180702/notihub)
[![Homebrew](https://img.shields.io/badge/homebrew-cask-orange?style=flat-macro&logo=homebrew)](https://github.com/Thuong180702/notihub)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

*Turn all your web messaging & productivity tools (**Messenger, Zalo, Gmail, Slack, Telegram, WhatsApp**) into high-performance, native macOS desktop apps with instant notifications and real web favicons — each one kept alive in the background so you never miss a message.*

[English](README.md) • [Tiếng Việt](README.vi.md)

</div>

---

## 🌟 Why `notihub`?

Browsers like Chrome and Safari aggressively throttle background tabs, causing missed messages, dropped WebSockets, silent disconnects, and heavy RAM usage. Dedicated web apps often lack native Mac feel or aren't available at all (like Messenger or Zalo).

`notihub` solves this by giving every web app an isolated, socket-preserved container with **real native macOS Notification Center popups**, deep-link thread jump, and ultra-low RAM footprint.

---

## 🔥 Key Features

- 🪟 **Dynamic Window Modes**: Instantly toggle between **Standard Desktop Window** (resizable window with Dock icon) and **Menu Bar Panel** (frameless status bar popup) directly from Settings.
- ⌨️ **Customizable Global Hotkey**: Record and customize your own global hotkey (e.g. `Cmd+Shift+Space`, `Alt+Space`, `Cmd+Alt+M`) to instantly show or hide the application anywhere.
- 🔔 **True Native macOS Notifications**: Direct integration with macOS Notification Center — respects Focus Modes, Do Not Disturb, Lock Screen, and native alert sounds with dedicated per-service icons.
- 🎯 **Deep-Link Thread Jump**: Clicking a notification opens the exact conversation thread or email message, not just the generic inbox.
- 🌐 **Real Web Favicons & Custom Web Apps**: Automatic high-res favicon extraction for all presets and custom web URLs with sleek custom web app creation.
- 🎛️ **Per-Service Controls & Context Menu**: Right-click tabs to Mute/Unmute notifications, toggle unread badges, reload, or tweak per-service settings.
- 💤 **Smart RAM Auto-Sleep Watchdog**: Automatically unloads memory for background tabs after N idle minutes. The service reconnects the instant you switch back — note that a sleeping tab won't notify you until then.
- 💎 **Modern Glassmorphic Interface**: Sleek translucent design, custom brand tile cards, instant search filtering, and smooth transitions.
- 🔒 **Multi-Account & Isolated Sessions**: Log into multiple accounts (`notihub add messenger --as work`) without cookie interference.
- ⚡ **Minimal Mode Support**: Run purely in the background via Notification Center & Tray with zero visible webviews.
- 🚦 **Live Connection Status**: A quiet dot on each tab turns amber then red the longer a service goes without any network activity, and flags it outright if the page looks logged out — so a dead connection never looks identical to "no new messages."
- 🛠️ **Automatic Crash Recovery**: A crashed or hung renderer reloads itself with exponential backoff, instead of sitting on a blank tab until you notice and restart it yourself.
- 🎯 **Per-Service Notification Filters & Scheduled DND**: Regex-based Priority / Allow / Deny rules per service, plus a full quiet-hours schedule editor (day-of-week + time windows) — all from Settings, no `config.json` editing required.
- 🛡️ **Private & Open Source**: No tracking, no telemetry, no notihub-run servers — every service loads directly from its own site. One exception: service icons (presets and custom URLs alike) are resolved via Google's public favicon API for accuracy and reliability, until a service's own page reports its real favicon.
- 🔔 **Update Notifications**: notihub checks GitHub Releases in the background and flags a new version with an amber dot on the Settings icon — no silent auto-install (see below), just a heads-up and a link to the release.

---

## ⚡ Minimal Mode & RAM Optimization

`notihub` offers a few opt-in ways to trade some responsiveness for a lighter footprint — worth knowing the actual trade-off before you flip them:

- 📋 **Minimal Mode**: Hides the tab bar and jumps straight to a **Notification History Board** (opened via the Tray icon or global hotkey) instead of the full web-app UI. Skips the tab-bar's renderer process entirely (~30MB measured) since Minimal Mode has no tabs to show. Services themselves still stay fully loaded underneath so delivery stays real-time — Electron has no Web Push API, so there's no way to receive messages without a service's page actually running.
- 💤 **Idle Sleep Watchdog**: Set inactive tabs to auto-sleep after 5m, 10m, 15m, 30m, 60m, or a custom duration. A sleeping tab unloads its page and genuinely frees memory, but its connection drops with it — you won't get notifications from that service until you switch back to it (which reloads and reconnects instantly).
- 🔋 **RAM Optimization (background throttling)**: Reduces CPU/timer activity on background tabs. It's **off by default** because throttling a tab's timers can pause the very socket that keeps a hidden chat connected — turn it on only if you're fine with background services checking in less often.

---

## 📦 Quick Installation

### Method 1: Via Homebrew (Recommended)

```bash
brew tap thuong180702/notihub
brew install --cask notihub
```

### Method 2: Direct App Download

1. Download the latest release package from [GitHub Latest Releases](https://github.com/Thuong180702/notihub/releases/latest).
2. Unzip and drag `notihub.app` into your `/Applications` directory.

### Method 3: Build from Source

```bash
git clone https://github.com/Thuong180702/notihub.git
cd notihub
npm install
npm run build
cp -R dist/notihub.app /Applications/
```

### Staying Updated

notihub checks for new releases in the background and flags one with an amber dot on the Settings icon, but **does not auto-install** — macOS's update mechanism (Squirrel.Mac) requires a stable code-signing identity to trust a downloaded update, which ad-hoc signing (no paid Apple Developer ID yet) doesn't provide. Reinstall via any method above when notified.

---

## ⚡ Supported Web Apps

`notihub` works out-of-the-box with all major platforms and supports **any custom Web URL**:

| Service | Native Notifications | Unread Badge | Deep Link Jump | Real Favicon |
|---|---|---|---|---|
| **Messenger** | ✅ Yes | ✅ Yes | ✅ Thread | 🌐 Official |
| **Zalo Web** | ✅ Via Unread Delta | ✅ Yes | ✅ App Focus | 🌐 Official |
| **Gmail / Workspace** | ✅ Yes | ✅ Yes | ✅ Email | 🌐 Official |
| **Outlook Web** | ✅ Yes | ✅ Yes | ✅ Email | 🌐 Official |
| **Slack Web** | ✅ Yes | ✅ Yes | ✅ Channel | 🌐 Official |
| **Discord Web** | ✅ Yes | ✅ Yes | ✅ Channel | 🌐 Official |
| **Telegram Web** | ✅ Yes | ✅ Yes | ✅ Chat | 🌐 Official |
| **WhatsApp Web** | ✅ Yes | ✅ Yes | ✅ Chat | 🌐 Official |
| **Custom Web App** | ✅ Web API | ✅ Title Regex | ✅ Web Handler | 🌐 Favicon API |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| <kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>Space</kbd> | Toggle main window (Global shortcut) |
| <kbd>⌘</kbd> <kbd>1</kbd> … <kbd>9</kbd> | Switch directly to Service tab N |
| <kbd>⌘</kbd> <kbd>R</kbd> | Reload active service page |
| <kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>D</kbd> | Toggle Do Not Disturb (DND) mode |

---

## 💻 CLI Commands

`notihub` includes a powerful companion command-line utility for automation and scripting:

```bash
notihub                           # Launch or focus the app
notihub add messenger             # Add a preset service
notihub add messenger --as work   # Add a 2nd isolated account
notihub add --url https://proton.me --name "Proton Mail"
notihub list                      # List all active services
notihub remove slack              # Remove a service
notihub notify "Build Completed" --body "Deployment successful" --url https://ci.example.com
notihub doctor                    # Diagnose notification permissions & setup
```

---

## ⚙️ Advanced Configuration

Edit `~/Library/Application Support/notihub/config.json` directly for fine-grained control:

```jsonc
{
  "startAtLogin": true,
  "windowMode": "window",        // "window" | "menubar"
  "appMode": "normal",           // "normal" (full UI) | "minimal" (notifications only)
  "ramOptimization": false,      // throttles background tabs; off by default, can delay reconnects
  "idleSleepMinutes": 30,        // auto-sleep idle background tabs after 30 mins
  "dndSchedule": [
    { "from": "22:00", "to": "08:00", "days": [1,2,3,4,5] }
  ],
  "services": [
    {
      "id": "messenger",
      "notify": {
        "priority": ["urgent|boss"],   // always notifies, bypasses DND
        "allow": [],                   // if non-empty, only matches notify
        "deny": ["reacted to your message"]
      }
    }
  ]
}
```

All three (`dndSchedule`, per-service `notify` rules, and the manual DND toggle) are also editable from **Settings** directly — this is only needed for bulk edits or scripting.

---

## 🤝 Contributing

Contributions are welcome! Feel free to submit Issues, Feature Requests, or Pull Requests.

1. Fork the Repository
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

<div align="center">
  <sub>Built with ❤️ for macOS power users by <a href="https://github.com/Thuong180702">Thuong180702</a></sub>
</div>
