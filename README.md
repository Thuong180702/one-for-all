# one-for-all

> Native macOS notifications for the web apps that don't have a Mac client.

**Status: pre-alpha.** v0.1 runs from source (`npm install && npm start`). It is
not published to npm or Homebrew yet, so the install commands below do not work.
Commands marked *(v0.2)* are not implemented.

[Tiếng Việt →](README.vi.md)

---

## The problem

Messenger has no macOS app. Zalo's Mac app is a second-class port. Web mail
tabs get throttled by Chrome and stop pushing. So you end up with a pinned tab
somewhere that:

- doesn't fire notifications after the tab has been in the background a while
- silently disconnects when the Mac sleeps, and never reconnects
- gets suspended by the browser's background throttling
- makes you hunt through 40 tabs to find the one that blinked

`one-for-all` is a single small macOS app that hosts those web apps in
never-throttled, always-connected containers and turns whatever they emit into
**real macOS notifications** — with real click-through back to the exact
conversation.

## What it does

- **Real native notifications.** Not in-app toasts. macOS Notification Center,
  so Focus modes, Do Not Disturb, the lock screen, and Notification Center
  history all work the way you already expect.
- **Click-through that lands where it should.** Clicking a notification
  activates the app, switches to that service, and — when the service gives us
  a deep link — opens the exact thread, not the inbox.
- **Stays connected.** Background throttling off, power-save blocker on, and a
  watchdog that reloads a service after sleep/wake or a dropped socket. This is
  the whole reason the project exists.
- **One login per service, kept separate.** Each service gets its own isolated
  Electron session partition, so cookies never mix and you can run two accounts
  of the same service side by side.
- **Unread counts in the menu bar and Dock.** Aggregated across services.
- **Everything local.** No account, no server, no telemetry. Sessions and
  config live on your disk.

## Supported services (v0.1 target)

Any web app can be added by URL. These ship preconfigured because they need
per-site tweaks (user agent, unread parsing, deep-link shape):

| Service | Notifications | Unread badge | Deep link on click |
|---|---|---|---|
| Messenger | Web Notification API | title + DOM | thread URL |
| Zalo Web | title parsing | title | conversation, best effort |
| Gmail / Google Workspace | Web Notification API | title | message URL |
| Outlook Web | Web Notification API | title | message URL |
| Slack (web) | Web Notification API | title | channel URL |
| Discord (web) | Web Notification API | title | channel URL |
| Telegram Web | Web Notification API | title | chat URL |
| WhatsApp Web | Web Notification API | title | chat URL |
| Generic (any URL) | whichever it emits | title regex | page URL |

> Zalo Web does not use the Notification API and re-renders aggressively, so its
> adapter is heuristic (unread-count-in-title plus a DOM watcher). It is the
> most likely thing to break on a Zalo redeploy — see
> [`adapters/zalo.js`](src/adapters) and please open an issue when it does.

## Install

```bash
npm install -g one-for-all
```

```bash
brew install --cask one-for-all
```

Then:

```bash
one-for-all
```

Requires macOS 12+ (Apple Silicon and Intel). First launch asks for the
Notifications permission — grant it, or nothing works.

## Usage

```bash
one-for-all                      # launch the app (or focus it if running)
one-for-all add messenger        # add a preconfigured service
one-for-all add --url https://mail.proton.me --name "Proton Mail"
one-for-all list                 # list configured services
one-for-all remove slack
one-for-all config               # open config.json in $EDITOR
one-for-all notify "Build done" --body "3m42s"   # (v0.2)
one-for-all doctor               # (v0.2) check permissions, throttling, connectivity
```

In v0.1 there is no tab strip: switch services from the menu bar icon or with
<kbd>⌘</kbd><kbd>1</kbd>…<kbd>9</kbd>, and restart after editing services.

`one-for-all notify` is deliberately generic: it is a one-liner for getting any
script, cron job, or CI hook into the same notification stream.

### Keyboard

| Shortcut | Action |
|---|---|
| <kbd>⌘</kbd><kbd>⇧</kbd><kbd>Space</kbd> | Toggle window (global, configurable) |
| <kbd>⌘</kbd><kbd>1</kbd>…<kbd>9</kbd> | Jump to service N |
| <kbd>⌘</kbd><kbd>R</kbd> | Reload current service |
| <kbd>⌘</kbd><kbd>⇧</kbd><kbd>D</kbd> | Toggle Do Not Disturb |

## Configuration

`~/Library/Application Support/one-for-all/config.json`

```jsonc
{
  "startAtLogin": true,
  "windowMode": "window",        // "window" | "menubar"
  "globalShortcut": "Cmd+Shift+Space",
  "dnd": false,                  // toggled from the menu bar or Cmd+Shift+D
  "services": [
    {
      "id": "messenger",
      "name": "Messenger",
      "adapter": "messenger",             // or "generic"
      "url": "https://www.messenger.com/",
      "partition": "persist:messenger",   // change this for a 2nd account
      "enabled": true,
      "muted": false,
      "sound": "default",                 // macOS sound name, or null for silent
      "badge": true,                      // count toward Dock badge
      "notify": {
        "allow": [],                      // regex; empty = allow all
        "deny": ["^.*reacted to your message$"],
        "priority": ["Mom", "@here"]      // these bypass DND
      },
      "userAgent": null                   // override if the site blocks Electron
    }
  ]
}
```

Restart the app after editing (hot-reload is v0.2).

## How it works

```
┌──────────────────────────── Electron main ────────────────────────────┐
│                                                                       │
│   config.json ──► ServiceManager ──► one WebContentsView per service  │
│                        │                     │                        │
│                        │              persist:<id> session           │
│                        │              (isolated cookies/storage)      │
│                        ▼                     │                        │
│                   Watchdog ◄─────────────────┤ did-fail-load,         │
│                  (sleep/wake,                │ power-monitor resume   │
│                   idle reload)               │                        │
│                        ▲                     ▼                        │
│                        │              preload.js (contextIsolation)   │
│                        │               • patches window.Notification  │
│                        │               • watches document.title       │
│                        │               • adapter DOM hooks            │
│                        │                     │ IPC                    │
│                        ▼                     ▼                        │
│   Tray + Dock badge ◄── NotificationRouter ──► electron.Notification  │
│                          (filters, DND,            (real NSUser-      │
│                           dedupe, history)          Notification)     │
│                                    │                                  │
│                          click ────┴──► focus app → switch service    │
│                                          → navigate to deep link      │
└───────────────────────────────────────────────────────────────────────┘
```

Three things carry most of the weight:

1. **`preload.js` replaces `window.Notification`** with a shim that keeps the
   same API surface (so the page thinks it succeeded) but forwards `title`,
   `body`, `icon`, `tag`, and `data` over IPC instead of drawing anything. The
   main process decides what actually becomes a macOS notification.
2. **`session.setPermissionRequestHandler` auto-grants** `notifications` to
   configured services, so you never see the site's own permission prompt and
   the site never falls back to "notifications blocked" mode.
3. **`webContents.setBackgroundThrottling(false)` + `powerSaveBlocker`** keep
   the WebSocket alive when the window is hidden or the Mac is idle. A browser
   tab cannot do this; that is the entire gap this app fills.

For sites with no Notification API (Zalo), the adapter falls back to diffing
`document.title` for an unread count and watching the conversation list for new
rows. Less reliable, clearly marked as such in the UI.

## Comparison

| | one-for-all | Ferdium / Rambox | Browser tab | Beeper |
|---|---|---|---|---|
| Native macOS notifications | yes | yes | throttled | yes |
| Survives sleep / throttling | designed for it | mostly | no | yes |
| Zalo support | yes | community recipe | n/a | no |
| Runs entirely local | yes | yes | yes | no (bridge servers) |
| Footprint | one process per service | same | — | — |
| Open source | MIT | Ferdium: Apache-2.0 | — | partly |

If Ferdium already works for you, **use Ferdium** — it is mature and has more
recipes. This project exists for the narrower case: Zalo/Messenger on macOS,
aggressive reconnect behavior, a scriptable `notify` CLI, and a much smaller
surface to audit.

## Privacy & security

- Renderers run with `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`. Preload scripts expose exactly one IPC channel, one-way.
- Credentials are never read, stored, or proxied — you log in to the real site
  in its own isolated session, same as a browser.
- No network calls to anything except the services you configure. No analytics,
  no crash reporting, no update ping unless you enable it.
- Notification bodies are held in memory and in the local history file only.
  Set `"history": false` to keep nothing.
- Config and sessions: `~/Library/Application Support/one-for-all/`.

## License

MIT
