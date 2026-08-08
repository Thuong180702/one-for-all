const {
  app, BaseWindow, WebContentsView, Notification, session, Tray, Menu, screen,
  globalShortcut, powerSaveBlocker, powerMonitor, ipcMain, nativeImage, shell, nativeTheme, net,
} = require('electron');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const presets = require('./presets');
const { trayPng } = require('./icon');
const { DATA_URIS, getFaviconUrl } = require('./icons');

// app.quit() is async — without the early return, this whole module keeps
// running (and re-registering its own will-quit handler) in the losing instance.
if (!app.requestSingleInstanceLock()) { app.quit(); return; }

// Chromium sizes its disk cache off free space and will happily sit on hundreds of
// megabytes per session. A chat client re-fetches its bundles anyway; 64 MB is plenty.
app.commandLine.appendSwitch('disk-cache-size', String(64 * 1024 * 1024));

// The GPU process was the single largest consumer measured in profiling (~100MB
// resident, spiking near 400MB) for what's ultimately compositing a handful of chat
// UIs. Cap its budget and skip the persistent shader cache — services reload over
// the network anyway, so there's nothing gained from caching compiled shaders on disk.
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '128');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

const TAB_H = 34;
const DEV = process.argv.includes('--dev');
const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 5 * 60 * 1000;
const FAVICON_SETTLE_MS = 5000;
// A site that fires one real Notification API call sets sawApiNotification and the
// title-count fallback stays off for good — right, if the API path keeps working.
// But if the site later stops calling it (a redeploy, a service-worker update) the
// flag never resets on its own, and the fallback would stay silenced forever. Treat
// "saw an API notification" as stale after this long so the fallback can take back over.
const API_NOTIFICATION_TTL_MS = 10 * 60 * 1000;

// Connection status thresholds, keyed off the last completed HTTP request
// (ses.webRequest.onCompleted). An open WebSocket sits idle between messages
// with zero HTTP traffic, so "quiet" isn't itself a problem — these are long
// enough that a real chat app's own keepalive/poll traffic keeps it under
// STALE_MS in normal use, and DEAD_MS is deliberately generous before crying wolf.
const STALE_MS = 5 * 60 * 1000;
const DEAD_MS = 20 * 60 * 1000;

// Catches the common shapes of "your session ended, please sign in again" URLs.
// False negatives (a login page that doesn't match) just mean no warning shows —
// safer than a false positive flagging a real conversation as logged-out.
const LOGIN_URL_PATTERN = /\/(login|signin|sign-in|checkpoint|auth|authenticate)(?:[/?#]|$)/i;
function looksLikeLoginPage(url) {
  try {
    const u = new URL(url);
    return LOGIN_URL_PATTERN.test(u.pathname) || /(^|\.)accounts\.google\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}

// One glance at connectionStatus() should answer "is this tab actually going to
// notify me?" — the exact question this app's whole premise depends on, and the
// one thing that previously had zero visibility (a dead socket looks identical
// to a quiet conversation from the UI).
function connectionStatus(entry) {
  if (entry.needsLogin) return 'login';
  if (entry.isSleeping) return 'asleep';
  const idle = Date.now() - entry.lastSeen;
  if (idle < STALE_MS) return 'live';
  if (idle < DEAD_MS) return 'stale';
  return 'dead';
}

const LOG_FILE = path.join(config.DIR, 'notihub-debug.log');
// Notification title/body pass through here — real message content. Only ever
// written to disk in --dev; on disk otherwise would contradict the README's
// "notification history... nothing is written to disk" privacy claim.
function dbg(...args) {
  if (!DEV) return;
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch {}
  console.log('[notihub-debug]', ...args);
}
const PIDFILE = path.join(config.DIR, 'notihub.pid');

let cfg = config.load();
const views = new Map(); // service.id -> { view, service, unread, lastSeen }
const history = [];
let win, tabsView, setupView, tray, active, quitting = false;
let trayMenu = null; // rebuilt by buildTrayMenu(); the right-click handler reads it fresh
let setupOpen = false;
let setupPage = 'services';
let pendingLogin = null; // service added from the UI, to switch to once it exists

// Sites block the Electron UA; pretend to be plain Chrome.
const USER_AGENT = app.userAgentFallback.replace(/ (notihub|Electron)\/[\d.]+/g, '');

/* ---------------------------------------------------------------- services */

function addService(service) {
  const ses = session.fromPartition(service.partition);
  ses.setUserAgent(service.userAgent || USER_AGENT);
  // Auto-grant notifications so the site never falls into "blocked" mode; deny the rest.
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'notifications'));

  const ramOpt = cfg.ramOptimization !== false;
  const view = new WebContentsView({
    webPreferences: {
      session: ses,
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: ramOpt,
      spellcheck: false, // dictionaries and a spell-check pass we never look at
    },
  });
  const entry = {
    view, service, unread: 0, lastSeen: Date.now(), loadedAt: Date.now(),
    sawApiNotification: false, apiNotificationAt: 0, // see apiNotificationActive()
    pendingNotify: null,      // { base, timer } — debounce unread-count notifications
    notifyCooldownUntil: 0,   // suppress repeat popups for 2 min; reset when user views tab
    isSleeping: false,
    retryDelayMs: RETRY_BASE_MS, // doubles on each consecutive failure, resets on success
    retryTimer: null,
    faviconTimer: null,
    unresponsiveTimer: null,
    crashCount: 0,
    needsLogin: false, // set from the URL — see LOGIN_URL_PATTERN
  };
  const wc = view.webContents;
  wc.setBackgroundThrottling(ramOpt);
  // Every load restarts the unread count from zero; the settle window keeps a
  // reload (or a wake-from-sleep) from replaying the whole backlog as popups.
  // did-finish-load never fires on messenger.com (it aborts the initial load);
  // did-stop-loading does, and is what we actually mean by "reloaded just now".
  wc.on('did-stop-loading', () => { entry.loadedAt = Date.now(); });

  // ponytail: liveness = completed HTTP requests. Frames on an already-upgraded
  // WebSocket are invisible here, which is why reloadIfIdleMinutes defaults to off.
  // Electron's webRequest listeners are per-session (singleton, last one wins), and
  // a session is keyed by partition — re-adding a service with the same partition id
  // replaces this closure entirely, but removeService() never explicitly unregisters
  // it. The views.get() guard makes a stale closure a no-op instead of writing to an
  // entry object nothing else references anymore.
  ses.webRequest.onCompleted(() => {
    if (views.get(service.id) === entry) entry.lastSeen = Date.now();
  });

  // Links out of the app open in the real browser; the service keeps its page.
  wc.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  // did-navigate only fires on a successful commit (never on a failed load), so it's
  // the signal that a retry actually worked — reset the backoff back to the base delay.
  // Also where a redirect to a login page shows up: a session that expired lands
  // here with no error at all, and would otherwise look identical to "no new
  // messages" — see LOGIN_URL_PATTERN.
  const trackUrl = (url) => { entry.needsLogin = looksLikeLoginPage(url); };
  wc.on('did-navigate', (_e, url) => { entry.retryDelayMs = RETRY_BASE_MS; trackUrl(url); });
  wc.on('did-navigate-in-page', (_e, url) => trackUrl(url)); // SPA client-side routing (history.pushState)
  wc.on('did-fail-load', (_e, code, desc, _url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = aborted, normal during SPA nav
    scheduleReconnect(entry, wc, `load failed (${desc})`);
  });

  // A crashed/OOM-killed renderer just stops existing — no did-fail-load, no error
  // event, the tab silently goes blank forever with the badge frozen at its last
  // value. Without this a crash is indistinguishable from "no new messages" until
  // someone happens to click the tab.
  wc.on('render-process-gone', (_e, details) => {
    if (!views.has(entry.service.id) || views.get(entry.service.id) !== entry) return; // torn down on purpose by removeService
    if (details.reason === 'clean-exit') return;
    entry.crashCount = (entry.crashCount || 0) + 1;
    dbg(`render-process-gone service=${entry.service.id} reason=${details.reason} crashCount=${entry.crashCount}`);
    scheduleReconnect(entry, wc, `renderer gone (${details.reason})`);
  });

  // A page can go unresponsive without crashing (a synchronous JS loop, a huge
  // layout). Give it a chance to recover on its own before forcing a reload —
  // long enough that a brief hang doesn't interrupt something legitimate.
  wc.on('unresponsive', () => {
    console.error(`[${entry.service.id}] renderer unresponsive`);
    clearTimeout(entry.unresponsiveTimer);
    entry.unresponsiveTimer = setTimeout(() => {
      if (!wc.isDestroyed()) { console.error(`[${entry.service.id}] still unresponsive after 30s; reloading`); wc.reload(); }
    }, 30000);
  });
  wc.on('responsive', () => clearTimeout(entry.unresponsiveTimer));

  // Auto-detect & save page favicon for services. Reads entry.service (not the
  // `service` param) because applyConfig() swaps that object out on every
  // config reload — writing to the stale one would save an orphaned favicon.
  // Debounced: some sites swap their favicon to reflect an unread badge, which
  // would otherwise hit disk (and cascade through fs.watch → applyConfig →
  // full UI re-render) on every single new message.
  wc.on('page-favicon-updated', (_e, favicons) => {
    if (!favicons || !favicons.length || favicons[0] === entry.service.icon) return;
    clearTimeout(entry.faviconTimer);
    entry.faviconTimer = setTimeout(() => {
      entry.service.icon = favicons[0];
      resolveNotificationIcon(favicons[0]);
      config.save(cfg);
      renderTabs();
      renderSetup();
    }, FAVICON_SETTLE_MS);
  });

  wc.loadURL(service.url);
  views.set(service.id, entry);
  layout();

  // Kick the icon fetch off now (async) rather than at the first real notify() —
  // by the time an actual message arrives, the NativeImage is already cached.
  const icon = service.icon || presets[service.id]?.icon || getFaviconUrl(service.url) || DATA_URIS.generic;
  resolveNotificationIcon(icon);
}

function removeService(id) {
  const entry = views.get(id);
  if (!entry) return;
  if (entry.pendingNotify) { clearTimeout(entry.pendingNotify.timer); entry.pendingNotify = null; }
  clearTimeout(entry.retryTimer);
  clearTimeout(entry.faviconTimer);
  clearTimeout(entry.unresponsiveTimer);
  win.contentView.removeChildView(entry.view);
  entry.view.webContents.close();
  views.delete(id);
  if (active === id) {
    active = null;
    const next = views.keys().next().value;
    if (next) switchTo(next);
    else win.setTitle('notihub');
  }
}

function switchTo(id) {
  const entry = views.get(id);
  if (!entry) return;
  // User is now looking at this service: reset notification cooldown so the next
  // message after they leave will trigger a fresh popup.
  entry.notifyCooldownUntil = 0;
  entry.sawApiNotification = false; // allow the unread-count fallback to fire again

  // Wake up if tab was sleeping due to RAM optimization
  if (entry.isSleeping) {
    entry.isSleeping = false;
    entry.loadedAt = Date.now();
    entry.view.webContents.loadURL(entry.service.url);
  } else {
    // Read current title from webContents and sync unread count badge immediately
    const title = entry.view.webContents.getTitle();
    entry.unread = config.parseUnread(title);
    updateBadge();
  }

  // The previously active view stays in the window's view tree (re-adding on the
  // next switch is what raises it back to front) but must be marked not-visible,
  // or Chromium keeps compositing it and background throttling never kicks in.
  const prevEntry = active ? views.get(active) : null;
  if (prevEntry && prevEntry !== entry) prevEntry.view.setVisible(false);

  active = id;
  win.contentView.addChildView(entry.view); // re-adding raises it to the front
  entry.view.setVisible(true);
  win.setTitle(entry.service.name);
  layout();
  entry.view.webContents.focus();
  renderTabs();
  updateVisibility();
}

// A service is "on screen" only if the window is up, focused (user is actively
// using this app), and it is the front tab. Using isFocused() is critical: when
// the user switches to another app, all services see visible=false and will use
// their own Notification API — giving us full sender name + message content.
const isFrontmost = (id) => !!win && win.isVisible() && win.isFocused() && !setupOpen && id === active;

function updateVisibility() {
  for (const [id, entry] of views) {
    const wc = entry.view.webContents;
    if (!wc.isDestroyed()) wc.send('ofa:visibility', isFrontmost(id));
  }
}

function layout() {
  const { width, height } = win.getContentBounds();
  // No tabsView in Minimal Mode (see ensureTabsView/teardownTabsView) — setup
  // and service views then own the full height instead of leaving a 34px gap.
  const topH = tabsView ? TAB_H : 0;
  const body = { x: 0, y: topH, width, height: height - topH };
  if (tabsView) tabsView.setBounds({ x: 0, y: 0, width, height: TAB_H });
  if (setupView) setupView.setBounds(body);
  for (const { view } of views.values()) view.setBounds(body);
}

const isMinimal = () => cfg.appMode === 'minimal';

// tabsView is a whole extra Chromium renderer process (~30MB measured) just to
// show a 34px strip — in Minimal Mode that strip renders a single "Notifications"
// toggle (see tabs.html), so the strip itself is skipped entirely and setup.html
// grows its own small header for that one button instead (see renderSetup's
// `standalone` flag). Normal Mode is unaffected: tabsView still owns the real tab bar.
function ensureTabsView() {
  if (tabsView) return;
  tabsView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'tabs-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  tabsView.webContents.on('will-navigate', (e) => e.preventDefault()); // chrome stays chrome
  tabsView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  tabsView.webContents.on('did-finish-load', renderTabs);
  tabsView.webContents.loadFile(path.join(__dirname, 'tabs.html'));
  win.contentView.addChildView(tabsView);
  layout();
}

function teardownTabsView() {
  if (!tabsView) return;
  win.contentView.removeChildView(tabsView);
  tabsView.webContents.close();
  tabsView = null;
  layout();
}

/* --------------------------------------------------------------- setup UI */

function openSetup(page = 'services') {
  setupPage = page;
  if (!setupView) {
    setupView = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, 'tabs-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const wc = setupView.webContents;
    wc.on('will-navigate', (e) => e.preventDefault()); // chrome stays chrome
    wc.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
    wc.on('did-finish-load', renderSetup);
    wc.loadFile(path.join(__dirname, 'setup.html'));
  }
  setupOpen = true;
  win.contentView.addChildView(setupView); // re-adding raises it over the services
  layout();
  renderSetup();
  renderTabs();
  updateVisibility();
}

function closeSetup() {
  if (!setupOpen) return;
  setupOpen = false;
  win.contentView.removeChildView(setupView);
  setupView.webContents.close(); // a whole renderer process for a screen nobody is looking at
  setupView = null;
  renderTabs();
  // `active` is only ever set by switchTo(), which the first-launch startup path
  // (openSetup('welcome') straight from app.whenReady()) never calls even though a
  // service may already exist (e.g. the pre-seeded Messenger). Without this fallback,
  // dismissing the welcome screen with nothing active left the window with no view
  // attached at all — blank, no service, no setup — which just looks hung.
  if (active && views.has(active)) switchTo(active); // also re-runs layout and visibility
  else if (views.size) switchTo(views.keys().next().value);
  else updateVisibility();
}

function renderSetup() {
  if (!setupView) return;
  setupView.webContents.send('ofa:setup', {
    page: setupPage,
    presets: Object.entries(presets).map(([id, p]) => ({ id, name: p.name, icon: p.icon || getFaviconUrl(p.url) || DATA_URIS.generic })),
    services: cfg.services.map((s) => ({
      ...s,
      icon: s.icon || presets[s.id]?.icon || getFaviconUrl(s.url) || DATA_URIS.generic,
      status: views.has(s.id) ? connectionStatus(views.get(s.id)) : (s.enabled ? 'unknown' : 'disabled'),
    })),
    canClose: views.size > 0,
    // No tabsView (Minimal Mode) means no tab strip anywhere providing the
    // Notifications/Settings buttons — setup.html renders its own small header
    // for them instead of relying on the (nonexistent) one above it.
    standalone: !tabsView,
    notificationsOk: !!cfg.notificationsOk,
    theme: cfg.theme || 'system',
    appMode: cfg.appMode || 'normal',
    windowMode: cfg.windowMode || 'window',
    globalShortcut: cfg.globalShortcut || 'Cmd+Shift+Space',
    ramOptimization: cfg.ramOptimization !== false,
    idleSleepMinutes: cfg.idleSleepMinutes || 0,
    dnd: !!cfg.dnd,
    dndSchedule: cfg.dndSchedule || [],
    history: history.slice(0, 50),
    // an unpackaged run has no login item to read, so fall back to what config says
    openAtLogin: app.isPackaged ? app.getLoginItemSettings().openAtLogin : !!cfg.startAtLogin,
    genericIcon: DATA_URIS.generic,
  });
}

const reloadAll = () => views.forEach((entry) => {
  entry.lastSeen = Date.now();
  entry.view.webContents.reload();
});

const isMenubar = () => cfg.windowMode === 'menubar';

// Park the panel under the tray icon, clamped to the display it lives on.
function positionUnderTray() {
  const t = tray.getBounds();
  const { width, height } = win.getBounds();
  const area = screen.getDisplayNearestPoint({ x: t.x, y: t.y }).workArea;
  const x = Math.round(t.x + t.width / 2 - width / 2);
  win.setPosition(
    Math.max(area.x, Math.min(x, area.x + area.width - width)),
    Math.round(Math.min(t.y + t.height, area.y + area.height - height)),
  );
}

function show(forceService = false) {
  if (isMenubar()) {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    positionUnderTray();
  }
  win.show();
  app.focus({ steal: true });
  // Minimal mode: show notification board / setup unless explicitly opening a service
  if (cfg.appMode === 'minimal' && !forceService && !setupOpen) {
    openSetup('services');
  }
}

/* ------------------------------------------------------------ config reload */

function applyConfig(next) {
  const ramOptChanged = cfg.ramOptimization !== next.ramOptimization;
  const appModeChanged = cfg.appMode !== next.appMode;
  cfg = next;
  nativeTheme.themeSource = cfg.theme || 'system';
  // Switching Minimal Mode at runtime, not just at startup — same tabsView
  // create/destroy as the initial isMinimal() check in app.whenReady().
  if (appModeChanged) { if (isMinimal()) teardownTabsView(); else ensureTabsView(); }
  const wanted = next.services.filter((s) => s.enabled);
  for (const id of [...views.keys()]) {
    if (!wanted.some((s) => s.id === id)) removeService(id);
  }
  const ramOpt = next.ramOptimization !== false;
  for (const s of wanted) {
    const entry = views.get(s.id);
    if (!entry) {
      addService(s);
    } else {
      const changed = s.url !== entry.service.url || s.partition !== entry.service.partition;
      entry.service = s;
      if (changed) entry.view.webContents.loadURL(s.url);
      if (ramOptChanged) entry.view.webContents.setBackgroundThrottling(ramOpt);
    }
  }
  buildAppMenu();
  updateBadge();
  renderSetup();
  // A service added from the setup screen only exists after this reload; take the
  // user straight to its login page, which is the whole point of adding it.
  if (pendingLogin && views.has(pendingLogin)) {
    const id = pendingLogin;
    pendingLogin = null;
    closeSetup();
    switchTo(id);
  }
}

function watchConfig() {
  let timer;
  fs.watch(config.DIR, (_e, file) => {
    if (file !== 'config.json') return;
    clearTimeout(timer); // editors write in bursts, and our own save() retriggers this
    timer = setTimeout(() => applyConfig(config.load()), 250);
  });
}

/* ----------------------------------------------------------- notifications */

// macOS pulls a notification back out of Notification Center when Electron's
// wrapper object is garbage collected, so a fire-and-forget `new Notification()`
// can play its sound and then vanish before you ever look at it. Holding the last
// few is the whole fix; they are also what a click handler needs to stay alive for.
const live = [];
function retain(n) {
  live.push(n);
  if (live.length > 50) live.shift();
  return n;
}

// macOS's Notification `icon` needs a NativeImage, not the URL/data-URI string
// `icon` resolves to elsewhere — and fetching a remote favicon is async while
// showing a notification is not, so a same-tick notify() can only use what's
// already cached from an earlier call. Pre-warmed in addService() so the first
// real notification for a service already has it.
const iconCache = new Map(); // icon src string -> NativeImage
// A site that cycles its favicon per unread count (favicon-1.png, favicon-2.png...)
// would otherwise grow this map forever, one NativeImage per count ever seen.
// Map preserves insertion order, so the oldest entry is always the eviction target.
const ICON_CACHE_MAX = 200;
function cacheIcon(src, img) {
  iconCache.set(src, img);
  if (iconCache.size > ICON_CACHE_MAX) iconCache.delete(iconCache.keys().next().value);
}
function resolveNotificationIcon(src) {
  if (!src) return null;
  if (iconCache.has(src)) return iconCache.get(src);
  if (src.startsWith('data:')) {
    try {
      const img = nativeImage.createFromDataURL(src);
      if (!img.isEmpty()) { cacheIcon(src, img); return img; }
    } catch {}
    return null;
  }
  if (/^https?:\/\//.test(src)) {
    cacheIcon(src, null); // don't refetch on every notify() while this is in flight
    net.request(src).on('response', (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const img = nativeImage.createFromBuffer(Buffer.concat(chunks));
          if (!img.isEmpty()) cacheIcon(src, img);
        } catch {}
      });
    }).end();
    return null;
  }
  return null;
}

function notify({ title, body, sound, serviceId, onClick }) {
  dbg(`notify() called title="${title}" body="${body}" serviceId=${serviceId}`);
  const entrySvc = serviceId ? views.get(serviceId)?.service : null;
  const icon = entrySvc?.icon || (serviceId ? presets[serviceId]?.icon : null) || (serviceId && presets[serviceId] ? getFaviconUrl(presets[serviceId].url) : null) || DATA_URIS.generic;
  const serviceName = entrySvc?.name || (serviceId ? presets[serviceId]?.name : null) || '';

  if (cfg.history) {
    history.unshift({
      at: Date.now(),
      serviceId,
      serviceName: serviceName || 'Notification',
      serviceIcon: icon,
      title,
      body,
    });
    history.length = Math.min(history.length, 200);
  }
  const nativeIcon = resolveNotificationIcon(icon);
  const n = retain(new Notification({
    title,
    subtitle: serviceName,
    body: body || '',
    silent: sound === null,
    ...(sound && sound !== 'default' ? { sound } : {}),
    ...(nativeIcon ? { icon: nativeIcon } : {}),
  }));
  n.on('show', () => dbg(`notification SHOWN title="${title}"`));
  n.on('click', onClick);
  n.on('failed', (_e, err) => {
    dbg(`notification FAILED title="${title}" err=${err}`);
    console.error(`[notihub] notification failed: ${err}\n[notihub] System Settings > Notifications > ${app.getName()} — allow notifications.`);
  });
  n.show();
}

// Shared by did-fail-load and render-process-gone: both mean "this service is
// no longer connected to anything" and both should back off the same way,
// rather than each keeping its own retry counter that resets the other's.
function scheduleReconnect(entry, wc, reason) {
  const delay = entry.retryDelayMs;
  console.error(`[${entry.service.id}] ${reason}; reloading in ${Math.round(delay / 1000)}s`);
  clearTimeout(entry.retryTimer);
  entry.retryTimer = setTimeout(() => !wc.isDestroyed() && wc.loadURL(entry.service.url), delay);
  entry.retryDelayMs = Math.min(delay * 2, RETRY_MAX_MS);
}

const findEntry = (senderId) => [...views.values()].find((v) => v.view.webContents.id === senderId);

// See API_NOTIFICATION_TTL_MS: a real API notification only suppresses the
// title-count fallback for a while, not forever, so a site that quietly stops
// calling the Notification API doesn't go silent with no way to notice.
const apiNotificationActive = (entry) =>
  entry.sawApiNotification && Date.now() - entry.apiNotificationAt < API_NOTIFICATION_TTL_MS;

// Preload reruns on every navigation, so it asks rather than us guessing when to tell it.
ipcMain.on('ofa:hello', (e) => {
  const entry = findEntry(e.sender.id);
  if (entry) e.sender.send('ofa:visibility', isFrontmost(entry.service.id));
});

ipcMain.on('ofa:notify', (e, payload) => {
  const entry = findEntry(e.sender.id);
  dbg(`ofa:notify received service=${entry?.service?.id} title="${payload?.title}"`);
  if (!entry) { dbg('ofa:notify no entry found, dropping'); return; }
  entry.lastSeen = Date.now();
  entry.sawApiNotification = true;
  entry.apiNotificationAt = Date.now();
  // Real API notification cancels any pending unread-count fallback to avoid duplicates.
  if (entry.pendingNotify) { clearTimeout(entry.pendingNotify.timer); entry.pendingNotify = null; }
  const ok = config.shouldNotify(entry.service, cfg, payload);
  dbg(`shouldNotify=${ok} muted=${entry.service.muted} dnd=${config.isDndActive(cfg)}`);
  if (!ok) return;
  notify({
    title: payload.title || entry.service.name,
    body: payload.body,
    sound: entry.service.sound,
    serviceId: entry.service.id,
    onClick: () => {
      show(true);
      switchTo(entry.service.id);
      if (!e.sender.isDestroyed()) e.sender.send('ofa:click', payload.id);
    },
  });
});

ipcMain.on('ofa:title', (e, title) => {
  const entry = findEntry(e.sender.id);
  if (!entry) return;
  entry.lastSeen = Date.now();
  const unread = config.parseUnread(title);
  if (unread === entry.unread) return;
  const prev = entry.unread;

  entry.unread = unread;
  dbg(`ofa:title service=${entry.service.id} unread=${prev}->${unread} notifyOnUnread=${entry.service.notifyOnUnread} sawApi=${apiNotificationActive(entry)}`);
  updateBadge();

  // Only trigger fallback notification when count goes up.
  if (!(unread > prev) || !entry.service.notifyOnUnread || apiNotificationActive(entry)) {
    if (entry.pendingNotify) { clearTimeout(entry.pendingNotify.timer); entry.pendingNotify = null; }
    return;
  }

  // Cooldown: after one notification, suppress further popups for 2 minutes.
  // This stops the "popup every time you switch apps" loop.
  // The cooldown is cleared by switchTo() when the user opens this service tab.
  if (Date.now() < entry.notifyCooldownUntil) {
    dbg(`ofa:title service=${entry.service.id} in cooldown, badge updated silently`);
    if (entry.pendingNotify) { clearTimeout(entry.pendingNotify.timer); entry.pendingNotify = null; }
    return;
  }

  // Debounce: batch rapid messages (0→1→2) into one popup (e.g. "2 new messages").
  if (!entry.pendingNotify) entry.pendingNotify = { base: prev };
  clearTimeout(entry.pendingNotify.timer);
  entry.pendingNotify.timer = setTimeout(() => {
    const base = entry.pendingNotify.base;
    entry.pendingNotify = null;
    // config.unreadDelta is the same settle-window + delta logic test/test.js checks
    // directly; reusing it here keeps the settle threshold and message wording in one place.
    const body = config.unreadDelta(
      { enabled: true, sawApiNotification: apiNotificationActive(entry), msSinceLoad: Date.now() - entry.loadedAt },
      base, entry.unread,
    );
    dbg(`pendingNotify fired service=${entry.service.id} base=${base} current=${entry.unread} body=${body}`);
    if (!body) return;
    const payload = { title: entry.service.name, body };
    if (!config.shouldNotify(entry.service, cfg, payload)) return;
    notify({
      ...payload,
      sound: entry.service.sound,
      serviceId: entry.service.id,
      onClick: () => { show(); switchTo(entry.service.id); },
    });
    entry.notifyCooldownUntil = Date.now() + 120000; // 2-minute cooldown starts now
  }, 1500);
});

ipcMain.on('ofa:select', (_e, id) => {
  if (setupOpen) closeSetup();
  switchTo(id);
});
ipcMain.on('ofa:history-clear', () => {
  history.length = 0;
  renderSetup();
});
ipcMain.on('ofa:set-theme', (_e, theme) => patchConfig({ theme }));
ipcMain.on('ofa:set-app-mode', (_e, mode) => patchConfig({ appMode: mode }));
ipcMain.on('ofa:set-ram-opt', (_e, on) => patchConfig({ ramOptimization: !!on }));
ipcMain.on('ofa:set-idle-sleep', (_e, mins) => patchConfig({ idleSleepMinutes: Number(mins) || 0 }));
ipcMain.on('ofa:set-dnd', (_e, on) => patchConfig({ dnd: !!on }));
ipcMain.on('ofa:set-dnd-schedule', (_e, schedule) => patchConfig({ dndSchedule: config.normalizeDndSchedule(schedule) }));
// fs.watch turns every one of these into applyConfig, which re-renders the UI.
const patchConfig = (patch) => {
  cfg = config.withDefaults({ ...cfg, ...patch });
  nativeTheme.themeSource = cfg.theme || 'system';
  config.save(cfg);
};

ipcMain.on('ofa:open-page', (_e, page) => openSetup(page));
ipcMain.on('ofa:setup-page', (_e, page) => { setupPage = page; renderSetup(); renderTabs(); });

// Skip and Continue do the same thing: the welcome screen is never shown again,
// and everything on it stays reachable from the tray.
ipcMain.on('ofa:onboarded', () => {
  if (!cfg.onboarded) patchConfig({ onboarded: true });
  if (views.size) closeSetup();
  else { setupPage = 'services'; renderSetup(); }
});

ipcMain.on('ofa:login-item', (_e, on) => {
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!on });
  patchConfig({ startAtLogin: !!on });
  renderSetup();
});

ipcMain.on('ofa:notification-settings', () =>
  shell.openExternal('x-apple.systempreferences:com.apple.Notifications-Settings.extension'));
ipcMain.on('ofa:setup-close', closeSetup);

ipcMain.on('ofa:add', (_e, what) => {
  const preset = presets[what.preset];
  const next = config.load();
  let service;
  if (preset) {
    service = { id: what.preset, ...preset };
  } else {
    let url;
    try {
      url = new URL(what.url);
    } catch {
      return; // the input is type=url, but never trust the renderer
    }
    if (!/^https?:$/.test(url.protocol)) return;
    const baseId = url.hostname.toLowerCase().replace(/\W+/g, '-');
    const uniqueId = config.uniqueServiceId(next.services, baseId);
    service = {
      id: uniqueId,
      name: (what.name && what.name.trim()) || url.hostname,
      url: url.href,
      icon: getFaviconUrl(url.href),
    };
  }
  if (next.services.some((s) => s.id === service.id)) return;
  next.services.push(service);
  pendingLogin = service.id;
  config.save(config.withDefaults(next)); // fs.watch turns this into applyConfig
});

ipcMain.on('ofa:update-service', (_e, { id, patch }) => {
  const current = config.load();
  const next = config.updateService(current, id, patch);
  config.save(next);
});

function registerGlobalShortcut(shortcut) {
  globalShortcut.unregisterAll();
  if (!shortcut || !shortcut.trim()) return true;
  try {
    return globalShortcut.register(shortcut.trim(), () => (win && win.isVisible() ? win.hide() : show()));
  } catch {
    return false;
  }
}

function recreateWindow() {
  if (!win) return;
  const menubar = isMenubar();
  const oldWin = win;

  // Detach every child view before destroying oldWin. Left parented to a
  // destroyed BaseWindow, a non-active service's WebContentsView is orphaned
  // rather than freed — its renderer process keeps running, and switchTo()
  // would try to re-attach a view whose old window no longer exists.
  const detach = (v) => { try { oldWin.contentView.removeChildView(v); } catch {} };
  if (tabsView) detach(tabsView);
  if (setupView) detach(setupView);
  for (const { view } of views.values()) detach(view);

  win = new BaseWindow({
    width: menubar ? 420 : 1100,
    height: menubar ? 620 : 780,
    show: false,
    title: 'notihub',
    frame: !menubar,
    alwaysOnTop: menubar,
    // Without this, a click on a button in a window that lost key-window status
    // (e.g. the macOS notification-permission system alert stealing focus during
    // onboarding) only refocuses the window instead of registering as a real
    // click — the exact "Continue/Skip does nothing, feels frozen" symptom.
    acceptsFirstMouse: true,
  });

  win.on('resize', layout);
  for (const ev of ['show', 'hide', 'minimize', 'restore', 'focus', 'blur']) win.on(ev, updateVisibility);
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
  });

  let hiddenAt = 0;
  win.on('hide', () => { hiddenAt = Date.now(); });
  if (tray) {
    tray.removeAllListeners('click');
    tray.on('click', () => {
      if (win.isVisible() || Date.now() - hiddenAt < 250) win.hide();
      else show();
    });
  }

  if (menubar) {
    if (app.dock) app.dock.hide();
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.on('blur', () => {
      if (![...views.values()].some((v) => v.view.webContents.isDevToolsOpened())) win.hide();
    });
  } else {
    if (app.dock) app.dock.show();
    win.setVisibleOnAllWorkspaces(false);
  }

  if (tabsView) win.contentView.addChildView(tabsView);
  if (setupOpen && setupView) win.contentView.addChildView(setupView);
  if (active && views.has(active)) {
    const entry = views.get(active);
    win.contentView.addChildView(entry.view);
    entry.view.setVisible(true);
  }

  try { oldWin.destroy(); } catch {}
  layout();
  show();
  renderTabs();
  renderSetup();
  buildAppMenu();
}

ipcMain.on('ofa:set-window-mode', (_e, mode) => {
  if (mode !== 'window' && mode !== 'menubar') return;
  if (cfg.windowMode === mode) return;
  patchConfig({ windowMode: mode });
  recreateWindow();
});

ipcMain.on('ofa:set-global-shortcut', (e, shortcut) => {
  const reply = (res) => !e.sender.isDestroyed() && e.sender.send('ofa:shortcut-result', res);
  const ok = registerGlobalShortcut(shortcut);
  if (ok) {
    patchConfig({ globalShortcut: shortcut });
    reply({ ok: true, shortcut });
  } else {
    registerGlobalShortcut(cfg.globalShortcut);
    reply({ ok: false, err: 'Invalid key combination' });
  }
});

ipcMain.on('ofa:tab-context-menu', (_e, id) => {
  const entry = views.get(id);
  if (!entry) return;
  const { service } = entry;
  const menu = Menu.buildFromTemplate([
    { label: service.name, enabled: false },
    { type: 'separator' },
    {
      label: service.muted ? '🔊 Unmute Notifications' : '🔇 Mute Notifications',
      click: () => {
        const current = config.load();
        const next = config.updateService(current, id, { muted: !service.muted });
        config.save(next);
      },
    },
    {
      label: '🔄 Reload Service',
      click: () => entry.view.webContents.reload(),
    },
    {
      label: '⚙️ Service Settings',
      click: () => {
        show();
        openSetup('services');
      },
    },
    { type: 'separator' },
    {
      label: '❌ Remove Service',
      click: () => {
        const next = config.load();
        next.services = next.services.filter((s) => s.id !== id);
        config.save(next);
      },
    },
  ]);
  menu.popup();
});

ipcMain.on('ofa:remove', (_e, id) => {
  const next = config.load();
  next.services = next.services.filter((s) => s.id !== id);
  config.save(next);
});

// Deliberately bypasses notify(): this tests whether macOS will deliver at all,
// so DND and the per-service filters must not be able to swallow it.
ipcMain.on('ofa:test-notification', (e) => {
  let replied = false;
  const reply = (r) => {
    if (replied || e.sender.isDestroyed()) return;
    replied = true;
    e.sender.send('ofa:test-result', r);
  };

  try {
    const n = retain(new Notification({ title: 'notihub', body: 'Notifications are working.' }));
    n.on('show', () => {
      if (!cfg.notificationsOk) patchConfig({ notificationsOk: true });
      reply({ ok: true });
    });
    n.on('failed', (_ev, err) => reply({ ok: false, err: String(err) }));
    n.show();
  } catch (err) {
    reply({ ok: false, err: String(err) });
  }

  setTimeout(() => {
    if (!cfg.notificationsOk) patchConfig({ notificationsOk: true });
    reply({ ok: true, fallback: true });
  }, 2500);
});

// Debug-only scaffolding for manually exercising the notification pipeline —
// not wired to any button in setup.html, but the IPC channel is still live in
// a production build unless gated here.
ipcMain.on('ofa:test-simulated-notification', (_e, { count = 5 } = {}) => {
  if (!DEV) return;
  const firstEntry = views.values().next().value;
  if (firstEntry) {
    firstEntry.unread = count;
    updateBadge();
  }

  const testItems = [
    { title: 'Messenger • Alice Nguyen', body: 'Hey, meet me at the coffee shop at 2 PM! ☕' },
    { title: 'Zalo • Công việc', body: 'Báo cáo tuần đã được phê duyệt 🚀' },
    { title: 'Gmail • Security Alert', body: 'New login detected from macOS Device 🛡️' },
    { title: 'Slack • Dev Team', body: 'Deployment build #142 succeeded on main branch ✅' },
    { title: 'Telegram • Bob Tran', body: 'Can you check the design file I sent? 🎨' },
  ];

  const itemsToSend = testItems.slice(0, count);
  itemsToSend.forEach((item, i) => {
    setTimeout(() => {
      notify({
        title: item.title,
        body: item.body,
        serviceId: firstEntry?.service?.id || null,
        onClick: () => {
          show();
          if (firstEntry) switchTo(firstEntry.service.id);
        },
      });
    }, i * 600);
  });
});

ipcMain.on('ofa:set-unread-count', (_e, count) => {
  if (!DEV) return;
  const firstEntry = views.values().next().value;
  if (firstEntry) {
    firstEntry.unread = Math.max(0, Number(count) || 0);
    updateBadge();
  }
});

// `notihub notify ...` relaunches the app; the running instance picks the payload out of argv.
function handleCliNotify(argv) {
  const payload = config.parseCliNotify(argv);
  if (!payload) return false;
  if (!payload.title) return true;
  // serviceId is optional and doesn't have to be a configured service — notify()
  // already falls back to presets[serviceId]?.icon, so `--service telegram` picks
  // up Telegram's real icon even if the user never added a Telegram tab.
  notify({
    title: payload.title,
    body: payload.body,
    serviceId: payload.serviceId || null,
    onClick: () => (payload.url ? shell.openExternal(payload.url) : show()),
  });
  return true;
}

/* --------------------------------------------------------------- watchdog */

// One tick, three independent idle policies: reload a service that's gone quiet
// (opt-in per service), sleep one RAM optimization has decided to unload (opt-in
// globally), and refresh the connection-status indicator. They share a timer
// since all three only need minute resolution.
function watchdogTick() {
  const now = Date.now();
  const sleepMins = cfg.idleSleepMinutes;
  const sleepTimeoutMs = sleepMins > 0 ? sleepMins * 60000 : 0;

  for (const [id, entry] of views) {
    const limit = entry.service.reloadIfIdleMinutes;
    if (limit && now - entry.lastSeen > limit * 60000) {
      console.log(`[${entry.service.id}] idle ${limit}m; reloading`);
      entry.lastSeen = now;
      entry.view.webContents.reload();
      continue;
    }
    if (sleepTimeoutMs && id !== active && !entry.isSleeping && !entry.unread
      && now - entry.lastSeen > sleepTimeoutMs) {
      dbg(`RAM Optimization: sleeping idle service=${id} (idle for ${sleepMins}m)`);
      entry.isSleeping = true;
      entry.view.webContents.loadURL('about:blank'); // release idle memory
    }
  }
  // connectionStatus() is time-based (idle duration) — without this, a tab that
  // goes quiet with no other event (no click, no message, no config change)
  // would keep showing "live" forever since nothing else re-renders the tabs.
  renderTabs();
  renderSetup();
}

/* -------------------------------------------------------------------- chrome */

function renderTabs() {
  if (!tabsView) return;
  const list = [...views.values()].map((entry) => ({
    id: entry.service.id,
    name: entry.service.name,
    icon: entry.service.icon || presets[entry.service.id]?.icon || getFaviconUrl(entry.service.url) || DATA_URIS.generic,
    unread: entry.unread,
    muted: entry.service.muted,
    active: entry.service.id === active,
    status: connectionStatus(entry),
  }));
  const activeEntry = active ? views.get(active) : null;
  tabsView.webContents.send('ofa:tabs', {
    list,
    appMode: cfg.appMode || 'normal',
    setupOpen: !!setupOpen,
    setupPage: setupPage || 'services',
    activeId: active,
    activeService: activeEntry?.service?.name || '',
    genericIcon: DATA_URIS.generic,
  });
}

function updateBadge() {
  let total = 0;
  for (const { service, unread } of views.values()) if (service.badge) total += unread;
  app.setBadgeCount(total);
  tray.setTitle(total ? String(total) : '');
  renderTabs();
  buildTrayMenu();
}

function buildTrayMenu() {
  const services = [...views.values()].map(({ service, unread }) => ({
    label: unread ? `${service.name} (${unread})` : service.name,
    type: 'radio',
    checked: service.id === active,
    click: () => {
      show();
      switchTo(service.id);
    },
  }));
  const recent = history.slice(0, 10).map((h) => ({
    label: `${h.title}${h.body ? ` — ${h.body}` : ''}`.slice(0, 60),
    click: () => {
      show();
      if (h.serviceId) switchTo(h.serviceId);
    },
  }));
  trayMenu = Menu.buildFromTemplate([
    ...services,
    { type: 'separator' },
    { label: 'Recent', submenu: recent.length ? recent : [{ label: 'Nothing yet', enabled: false }] },
    {
      label: 'Do Not Disturb',
      type: 'checkbox',
      checked: config.isDndActive(cfg),
      click: (item) => {
        cfg.dnd = item.checked;
        config.save(cfg);
      },
    },
    { label: 'Reload All', click: reloadAll },
    { label: 'Setup & Permissions…', click: () => { show(); openSetup('welcome'); } },
    { type: 'separator' },
    { label: 'Quit notihub', accelerator: 'Cmd+Q', click: () => app.quit() },
  ]);

  // On macOS the right-click handler is registered once (below, at tray creation)
  // and reads trayMenu fresh each time. Registering it here too — this function
  // runs on every unread-count change — would pile up one listener per update.
  if (process.platform !== 'darwin') tray.setContextMenu(trayMenu);
}

function cycleTab(dir = 1) {
  const keys = [...views.keys()];
  if (!keys.length) return;
  const idx = keys.indexOf(active);
  if (idx === -1) {
    switchTo(keys[0]);
    return;
  }
  const nextIdx = (idx + dir + keys.length) % keys.length;
  switchTo(keys[nextIdx]);
}

function buildAppMenu() {
  const jump = [...views.keys()].slice(0, 9).map((id, i) => ({
    label: views.get(id).service.name,
    accelerator: `Cmd+${i + 1}`,
    click: () => switchTo(id),
  }));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Preferences…', accelerator: 'Cmd+,', click: () => { show(); openSetup('settings'); } },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' }, // copy/paste inside the web views needs this
    {
      label: 'Service',
      submenu: [
        ...jump,
        { type: 'separator' },
        { label: 'Next Service', accelerator: 'Control+Tab', click: () => cycleTab(1) },
        { label: 'Previous Service', accelerator: 'Control+Shift+Tab', click: () => cycleTab(-1) },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'Cmd+R', click: () => views.get(active)?.view.webContents.reload() },
        { label: 'Reload All', accelerator: 'Cmd+Shift+R', click: reloadAll },
        {
          label: 'Do Not Disturb',
          type: 'checkbox',
          accelerator: 'Cmd+Shift+D',
          checked: config.isDndActive(cfg),
          click: (item) => {
            cfg.dnd = item.checked;
            config.save(cfg);
            buildTrayMenu();
          },
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Close Window', accelerator: 'Cmd+W', click: () => win.hide() },
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ]));
}

/* ---------------------------------------------------------------- lifecycle */

app.whenReady().then(() => {
  nativeTheme.themeSource = cfg.theme || 'system';
  const menubar = isMenubar();
  win = new BaseWindow({
    width: menubar ? 420 : 1100,
    height: menubar ? 620 : 780,
    show: false,
    title: 'notihub',
    frame: !menubar,
    alwaysOnTop: menubar,
    // Without this, a click on a button in a window that lost key-window status
    // (e.g. the macOS notification-permission system alert stealing focus during
    // onboarding) only refocuses the window instead of registering as a real
    // click — the exact "Continue/Skip does nothing, feels frozen" symptom.
    acceptsFirstMouse: true,
  });
  win.on('resize', layout);
  // focus/blur: when user switches to another app, services see visible=false
  // so they use their own Notification API and we get full message content.
  for (const ev of ['show', 'hide', 'minimize', 'restore', 'focus', 'blur']) win.on(ev, updateVisibility);
  win.on('close', (e) => {
    // Closing must not quit — the whole point is staying connected in the background.
    if (quitting) return;
    e.preventDefault();
    win.hide();
  });
  if (menubar) {
    app.dock.hide(); // menu bar only: no Dock icon, no app switcher entry
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.on('blur', () => {
      // BaseWindow has no webContents of its own; ask the service views instead,
      // otherwise opening devtools blurs the panel and hides it out from under you.
      if (![...views.values()].some((v) => v.view.webContents.isDevToolsOpened())) win.hide();
    });
  }

  if (!isMinimal()) ensureTabsView();

  const trayIcon = nativeImage.createFromBuffer(trayPng(1));
  trayIcon.addRepresentation({ scaleFactor: 2, buffer: trayPng(2) });
  trayIcon.setTemplateImage(true); // black-on-transparent: macOS tints it for light/dark menu bars
  tray = new Tray(trayIcon);
  tray.setToolTip('notihub');
  // In menubar mode the blur handler has already hidden the panel by the time this
  // fires, so treat a click just after a hide as "close", not "open again".
  let hiddenAt = 0;
  win.on('hide', () => { hiddenAt = Date.now(); });
  tray.on('click', () => {
    if (win.isVisible() || Date.now() - hiddenAt < 250) win.hide();
    else show();
  });
  // Registered once here, not in buildTrayMenu() (which reruns on every unread-count
  // change) — reads trayMenu fresh so it always pops the latest build.
  if (process.platform === 'darwin') tray.on('right-click', () => tray.popUpContextMenu(trayMenu));

  const enabledServices = cfg.services.filter((s) => s.enabled);
  enabledServices.forEach(addService);

  // Pre-warm every known preset's icon, not just configured services — a `notihub
  // notify --service telegram` can reference a preset the user never added, and
  // without this the very first such notification would show before the async
  // favicon fetch resolves.
  for (const id in presets) resolveNotificationIcon(presets[id].icon);

  if (!cfg.onboarded) {
    openSetup('welcome');
  } else if (cfg.appMode === 'minimal') {
    openSetup('history');
  } else if (!views.size) {
    openSetup('services');
  } else {
    const firstId = enabledServices[0]?.id || views.keys().next().value;
    if (firstId) switchTo(firstId);
  }
  buildAppMenu();
  updateBadge();
  layout();
  win.show();

  // Keeping the sockets alive is the entire reason this app exists.
  powerSaveBlocker.start('prevent-app-suspension');
  powerMonitor.on('resume', reloadAll);
  setInterval(watchdogTick, 60000);
  watchConfig();

  fs.writeFileSync(PIDFILE, String(process.pid));
  // Unpackaged dev runs can't register a login item ("Operation not permitted").
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!cfg.startAtLogin });
  if (cfg.globalShortcut) globalShortcut.register(cfg.globalShortcut, () => (win.isVisible() ? win.hide() : show()));
  if (process.argv.includes('--dev')) views.forEach(({ view }) => view.webContents.openDevTools({ mode: 'detach' }));
  handleCliNotify(process.argv);
});

app.on('second-instance', (_e, argv) => {
  if (!handleCliNotify(argv)) show();
});
app.on('activate', () => show());
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  try { fs.unlinkSync(PIDFILE); } catch {}
});
app.on('window-all-closed', () => {}); // stay resident
