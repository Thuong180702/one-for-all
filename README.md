<div align="center">

# ⚡ one-for-all

### All-in-One Native macOS Notification Hub & Lightweight Web App Client

[![Release](https://img.shields.io/github/v/release/Thuong180702/one-for-all?style=flat-macro&color=007AFF)](https://github.com/Thuong180702/one-for-all/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%2012%2B-black?style=flat-macro&logo=apple)](https://github.com/Thuong180702/one-for-all)
[![Homebrew](https://img.shields.io/badge/homebrew-cask-orange?style=flat-macro&logo=homebrew)](https://github.com/Thuong180702/one-for-all)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

*Turn all your web messaging & productivity tools (**Messenger, Zalo, Gmail, Slack, Telegram, WhatsApp**) into high-performance, native macOS desktop apps with instant notifications, real web favicons, and zero background battery drain.*

[English](README.md) • [Tiếng Việt](README.vi.md)

</div>

---

## 🌟 Why `one-for-all`?

Browsers like Chrome and Safari aggressively throttle background tabs, causing missed messages, dropped WebSockets, silent disconnects, and heavy RAM usage. Dedicated web apps often lack native Mac feel or aren't available at all (like Messenger or Zalo).

`one-for-all` solves this by giving every web app an isolated, socket-preserved container with **real native macOS Notification Center popups**, deep-link thread jump, and ultra-low RAM footprint.

---

## 🔥 Key Features

- 🔔 **True Native macOS Notifications**: Direct integration with macOS Notification Center — respects Focus Modes, Do Not Disturb, Lock Screen, and native alert sounds.
- 🎯 **Deep-Link Thread Jump**: Clicking a notification opens the exact conversation thread or email message, not just the generic inbox.
- 🌐 **Real Web Favicons**: Automatic high-res favicon extraction for all presets and custom web URLs.
- 💤 **Smart RAM Auto-Sleep Watchdog**: Automatically unloads memory for background tabs after N idle minutes without missing unread messages.
- 💎 **Modern Glassmorphic Interface**: Sleek translucent design, custom brand tile cards, instant search filtering, and smooth transitions.
- 🔒 **Multi-Account & Isolated Sessions**: Log into multiple accounts (`ofa add messenger --as work`) without cookie interference.
- ⚡ **Minimal Mode Support**: Run purely in the background via Notification Center & Tray with zero visible webviews.
- 🛡️ **100% Private & Open Source**: No tracking, no external proxy servers, no telemetry. Everything stays local on your Mac.

---

## ⚡ Minimal Mode & RAM Optimization

`one-for-all` is built from the ground up for maximum resource efficiency. Beyond standard tab management, it offers a dedicated **Minimal Mode**:

- 🚀 **Zero-UI Background Notification Daemon**: When switched to **Minimal Mode**, the main tab bar and heavy webview windows stay hidden. The app operates as an ultra-lightweight background notification router, consuming up to **80% less RAM**.
- 📋 **Integrated Notification History Board**: In Minimal Mode, clicking the Tray icon or global hotkey opens a sleek **Notification History Board** showing recent messages with brand icons, timestamps, and one-click deep-link jumps.
- 💤 **Customizable Idle Sleep Watchdog**: Set inactive tabs to auto-sleep after 5m, 10m, 15m, 30m, 60m, or custom duration. Sleeping tabs unload memory entirely until you switch back to them, while keeping unread counters 100% active.
- 🔋 **Battery-Friendly Throttling**: Pauses unnecessary DOM animations and canvas rendering on background webviews without dropping socket connections.

---

## 📦 Quick Installation

### Method 1: Via Homebrew (Recommended)

```bash
brew install --cask https://raw.githubusercontent.com/Thuong180702/one-for-all/main/Casks/one-for-all.rb
```

*Or add the tap:*
```bash
brew tap Thuong180702/one-for-all https://github.com/Thuong180702/one-for-all
brew install --cask one-for-all
```

### Method 2: Direct App Download

1. Download the latest **`one-for-all-v0.7.0-mac.zip`** from [GitHub Releases](https://github.com/Thuong180702/one-for-all/releases).
2. Unzip and drag `one-for-all.app` into your `/Applications` directory.

### Method 3: Build from Source

```bash
git clone https://github.com/Thuong180702/one-for-all.git
cd one-for-all
npm install
npm run build
cp -R dist/one-for-all.app /Applications/
```

---

## ⚡ Supported Web Apps

`one-for-all` works out-of-the-box with all major platforms and supports **any custom Web URL**:

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

`one-for-all` includes a powerful companion command-line utility for automation and scripting:

```bash
one-for-all                           # Launch or focus the app
one-for-all add messenger             # Add a preset service
one-for-all add messenger --as work   # Add a 2nd isolated account
one-for-all add --url https://proton.me --name "Proton Mail"
one-for-all list                      # List all active services
one-for-all remove slack              # Remove a service
one-for-all notify "Build Completed" --body "Deployment successful" --url https://ci.example.com
one-for-all doctor                    # Diagnose notification permissions & setup
```

---

## ⚙️ Advanced Configuration

Edit `~/Library/Application Support/one-for-all/config.json` directly for fine-grained control:

```jsonc
{
  "startAtLogin": true,
  "windowMode": "window",        // "window" | "menubar"
  "appMode": "normal",           // "normal" (full UI) | "minimal" (notifications only)
  "ramOptimization": true,       // background memory throttling
  "idleSleepMinutes": 30,        // auto-sleep idle background tabs after 30 mins
  "dndSchedule": [
    { "from": "22:00", "to": "08:00", "days": [1,2,3,4,5] }
  ]
}
```

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
