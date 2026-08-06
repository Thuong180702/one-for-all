# one-for-all

> Native macOS notifications for the web apps that don't have a Mac client.

**Status: pre-alpha.** v0.6 builds a real `.app` from source and sets itself up
from a first-run screen. It is not published to npm or Homebrew yet, so those
install commands do not work — build it yourself (see [Install](#install)).

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

- **Set up in one screen.** First launch asks for the notification permission and
  offers start-at-login — grant them, or skip and do it later from the menu bar.
  Then pick your services from a grid, log in once, done. The terminal is optional.
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
  Electron session partition, so cookies never mix. `ofa add messenger --as work`
  gives you a second account of the same service, logged in independently.
- **Lives in the menu bar if you want.** Set `"windowMode": "menubar"` and it
  drops the Dock icon and becomes a panel that opens under the tray icon.
- **Unread counts in the tab strip, menu bar, and Dock.** Aggregated across
  services.
- **Quiet hours that are actually quiet.** Per-service mute, keyword allow/deny
  filters, a DND schedule, and a priority list that cuts through all of it.
- **Everything local.** No account, no server, no telemetry. Sessions and
  config live on your disk.

## Supported services

Any web app can be added by URL — `ofa add --url ...`. There is no per-site code:
notifications come from whatever the page emits through the Web Notification API,
and unread counts come from a generic `(N)`-in-the-tab-title regex. The names
below just ship as presets so you can type `ofa add gmail`.

| Service | Notifications | Unread badge | Deep link on click |
|---|---|---|---|
| Messenger | yes | yes | thread |
| Gmail / Google Workspace | yes | yes | message |
| Outlook Web | yes | yes | message |
| Slack (web) | yes | yes | channel |
| Discord (web) | yes | yes | channel |
| Telegram Web | yes | yes | chat |
| WhatsApp Web | yes | yes | chat |
| Zalo Web | via unread count | yes | opens Zalo |
| Generic (any URL) | if the site uses the API | if it puts `(N)` in the title | wherever its own handler goes |

Deep links are not hardcoded: clicking a native notification replays the page's
own `onclick`, which is what already knows how to open the right thread. So a
site works the moment it uses the standard API, and keeps working when it
redeploys.

> **Zalo Web never calls the Notification API.** For sites like it, set
> `"notifyOnUnread": true` (the `zalo` preset already does) and a *rise* in the
> tab-title unread count becomes the notification: "Zalo — 3 new messages". You
> get no sender name or preview, because the page never offers one — but there
> are no DOM selectors to rot when Zalo redeploys. The flag is ignored once a
> service is seen using the real API, so it can't double up on Messenger.
>
> Everything else in the table is verified only in the sense that those sites use
> the standard API — real-account testing is still wanted.

## Install

```bash
git clone https://github.com/Thuong180702/one-for-all && cd one-for-all
npm install && npm run build
cp -R dist/one-for-all.app /Applications/
```

Then launch it from Finder. A welcome screen opens on first run:

1. **Notifications** — press *Allow* to fire a test notification, which is what
   makes macOS ask for the permission. The row turns to *✓ Done* once macOS
   accepts one. If nothing appeared on screen, *Open notification settings* takes
   you to the exact pane.
2. **Start at login** — the app only notifies while it is running.
3. *Continue* (or *Skip for now* — everything stays reachable from the menu bar
   under **Setup & Permissions…**).

Then pick services from the grid. Adding one opens its login page; log in once
and the session stays on disk. Reopen the picker any time with the **+** in the
tab strip.

> **This step is not optional.** macOS refuses to deliver notifications from a
> raw `electron .` run — it fails with `UNErrorDomain error 1`, silently, from
> the app's point of view. A notification client needs its own bundle
> identifier and a code signature, which is what `npm run build` produces. If
> nothing ever pops, run `ofa doctor` first; it checks for this.

`npm run build` copies the Electron runtime you already installed, drops our
source into it, swaps in our icon and bundle id, and ad-hoc signs the result.
No extra build dependency. Requires macOS 12+ (Apple Silicon and Intel).

Eventually:

```bash
npm install -g one-for-all      # not published yet
brew install --cask one-for-all # not published yet
```

## Usage

The setup screen covers adding and removing services; the CLI is there for
scripting and for the options the screen does not expose.

```bash
one-for-all                      # launch the app (or focus it if running)
one-for-all add messenger        # add a preconfigured service
one-for-all add messenger --as work   # second account, its own login
one-for-all add --url https://mail.proton.me --name "Proton Mail"
one-for-all list                 # list configured services
one-for-all remove slack
one-for-all config               # open config.json in $EDITOR
one-for-all notify "Build done" --body "3m42s" --url https://ci.example.com
one-for-all doctor               # check config, connectivity, DND, muted services
```

`one-for-all notify` is deliberately generic: it is a one-liner for getting any
script, cron job, or CI hook into the same notification stream. Clicking such a
notification opens `--url` in your browser.

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
  "dnd": false,                  // manual override, toggled from the menu bar
  "dndSchedule": [              // quiet hours; windows may wrap past midnight
    { "from": "22:00", "to": "08:00", "days": [1,2,3,4,5] }
  ],
  "history": true,               // false = keep no record of past notifications
  "onboarded": true,             // false = show the welcome screen again on next launch
  "notificationsOk": true,       // set once macOS has accepted a notification
  "services": [
    {
      "id": "messenger",
      "name": "Messenger",
      "url": "https://www.messenger.com/",
      "partition": "persist:messenger",   // set by --as; change for a 2nd account
      "enabled": true,
      "muted": false,
      "sound": "default",                 // "Ping" / "Glass" / ...; null = silent
      "badge": true,                      // count toward Dock badge
      "notify": {
        "allow": [],                      // regex; empty = allow all
        "deny": ["^.*reacted to your message$"],
        "priority": ["Mom", "@here"]      // these bypass DND
      },
      "notifyOnUnread": false,            // for sites that never call the API
      "reloadIfIdleMinutes": 0,           // 0 = off; see the caveat below
      "userAgent": null                   // override if the site blocks Electron
    }
  ]
}
```

Edits are picked up live — no restart. Adding, removing, and re-pointing services
all take effect on save.

`dndSchedule` days are matched against the day it is *now*, so a Mon–Fri
22:00–08:00 window stops at midnight Friday rather than running into Saturday
morning. Split the window if you want the spillover.

`reloadIfIdleMinutes` reloads a service that has gone quiet. "Quiet" means no
notification, no tab-title change, and no completed HTTP request — but frames on
an already-upgraded WebSocket are invisible to it, so a perfectly healthy
Messenger can look idle. That is why it defaults to off. Turn it on for services
you have actually seen go stale.

## How it works

```
┌──────────────────────────── Electron main ────────────────────────────┐
│                                                                       │
│   config.json ──► one WebContentsView per service                     │
│    (fs.watch,           │                                             │
│     hot-reload)         ├──► persist:<id> session                     │
│                         │     (isolated cookies/storage)              │
│                         │                                             │
│   Watchdog ◄────────────┤  did-fail-load, power-monitor resume,       │
│  (sleep/wake,           │  idle timer                                 │
│   idle reload)          ▼                                             │
│                    preload.js  (contextIsolation, sandbox)            │
│                      • injects a Notification shim into the main world│
│                      • polls document.title for "(N)"                 │
│                         │ IPC                                         │
│                         ▼                                             │
│   Tray ─┐          notify()  ──────────────► electron.Notification    │
│   Dock ─┼──────────  • allow/deny/priority       (real NSUser-        │
│   Tabs ─┘            • DND + schedule             Notification)       │
│                      • history (last 200)             │               │
│                                                       ▼               │
│                              click ──► focus + switch service ──►     │
│                                        replay the page's onclick      │
└───────────────────────────────────────────────────────────────────────┘
```

Three things carry most of the weight:

1. **A Notification shim is injected into the page's main world.** It keeps the
   same API surface (so the page thinks it succeeded) but forwards the title and
   body over IPC instead of drawing anything, and the main process decides what
   becomes a macOS notification. Because `contextIsolation` is on, the preload
   cannot just assign `window.Notification` — it injects the shim with
   `webFrame.executeJavaScript` and talks to it over a `contextBridge` channel.
2. **`session.setPermissionRequestHandler` auto-grants** `notifications` to
   configured services, so you never see the site's own permission prompt and
   the site never falls back to "notifications blocked" mode.
3. **`webContents.setBackgroundThrottling(false)` + `powerSaveBlocker`** keep
   the WebSocket alive when the window is hidden or the Mac is idle. A browser
   tab cannot do this; that is the entire gap this app fills.
4. **It ships as a signed `.app` bundle.** macOS grants notification permission
   per bundle identifier, so an unpackaged run has no identity to grant it to
   and every notification fails. `scripts/build-app.js` gives it one.
5. **The page is told when it is off screen.** Chromium calls a hosted view
   "visible" even when its window is hidden, and chat apps only raise a
   notification while the document is hidden — so the app reports real
   visibility to each service instead, or Messenger would never notify.

## Footprint

One hosted service, window closed, idle: **~5 processes** — main, GPU, network,
the tab strip, and the service itself. The tab strip and the setup screen are
plain HTML with no framework, and the setup screen's renderer is destroyed the
moment you close it.

Most of the memory is the web app you asked it to host — Messenger's own bundle
is a few hundred MB in any browser, and Chromium isolates its cross-origin frames
into their own processes. What the app itself controls, it keeps small: disk
cache capped at 64 MB, spellcheck off, one 2-second title poll per service, and a
watchdog timer that only ticks once a minute. Nothing runs per-message except the
notification itself.

Site isolation is deliberately left on. Turning it off would collapse those extra
frame processes, but it is the protection that keeps one site's script from
reading another logged-in session's memory, and this app exists to hold several
logged-in sessions at once.

Clicking a native notification sends the shim back the id of the notification
that produced it, and the shim fires that object's own `onclick`. That is the
whole deep-link mechanism — no per-site URL templates to maintain.

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
- Notification history (last 200) is kept in memory only and dies with the
  process — nothing is written to disk. Set `"history": false` to keep nothing
  at all.
- Config and sessions: `~/Library/Application Support/one-for-all/`.

## License

MIT
