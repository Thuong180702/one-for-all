const {
  app, BaseWindow, WebContentsView, Notification, session, Tray, Menu, screen,
  globalShortcut, powerSaveBlocker, powerMonitor, ipcMain, nativeImage, shell,
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

const TAB_H = 34;
const DEV = process.argv.includes('--dev');
const LOG_FILE = path.join(config.DIR, 'ofa-debug.log');
// Notification title/body pass through here — real message content. Only ever
// written to disk in --dev; on disk otherwise would contradict the README's
// "notification history... nothing is written to disk" privacy claim.
function dbg(...args) {
  if (!DEV) return;
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch {}
  console.log('[ofa-debug]', ...args);
}
const PIDFILE = path.join(config.DIR, 'ofa.pid');

let cfg = config.load();
const views = new Map(); // service.id -> { view, service, unread, lastSeen }
const history = [];
let win, tabsView, setupView, tray, active, quitting = false;
let setupOpen = false;
let setupPage = 'services';
let pendingLogin = null; // service added from the UI, to switch to once it exists

// Sites block the Electron UA; pretend to be plain Chrome.
const USER_AGENT = app.userAgentFallback.replace(/ (one-for-all|Electron)\/[\d.]+/g, '');

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
    view, service, unread: 0, lastSeen: Date.now(), loadedAt: Date.now(), sawApiNotification: false,
    pendingNotify: null,      // { base, timer } — debounce unread-count notifications
    notifyCooldownUntil: 0,   // suppress repeat popups for 2 min; reset when user views tab
    isSleeping: false,
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
  ses.webRequest.onCompleted(() => { entry.lastSeen = Date.now(); });

  // Links out of the app open in the real browser; the service keeps its page.
  wc.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('did-fail-load', (_e, code, desc, _url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = aborted, normal during SPA nav
    console.error(`[${entry.service.id}] load failed (${desc}); retrying in 5s`);
    setTimeout(() => !wc.isDestroyed() && wc.loadURL(entry.service.url), 5000);
  });

  // Auto-detect & save page favicon for services. Reads entry.service (not the
  // `service` param) because applyConfig() swaps that object out on every
  // config reload — writing to the stale one would save an orphaned favicon.
  wc.on('page-favicon-updated', (_e, favicons) => {
    if (favicons && favicons.length > 0 && favicons[0] !== entry.service.icon) {
      entry.service.icon = favicons[0];
      config.save(cfg);
      renderTabs();
      renderSetup();
    }
  });

  wc.loadURL(service.url);
  views.set(service.id, entry);
  layout();
}

function removeService(id) {
  const entry = views.get(id);
  if (!entry) return;
  if (entry.pendingNotify) { clearTimeout(entry.pendingNotify.timer); entry.pendingNotify = null; }
  win.contentView.removeChildView(entry.view);
  entry.view.webContents.close();
  views.delete(id);
  if (active === id) {
    active = null;
    const next = views.keys().next().value;
    if (next) switchTo(next);
    else win.setTitle('one-for-all');
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
  const body = { x: 0, y: TAB_H, width, height: height - TAB_H };
  tabsView.setBounds({ x: 0, y: 0, width, height: TAB_H });
  if (setupView) setupView.setBounds(body);
  for (const { view } of views.values()) view.setBounds(body);
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
  if (active) switchTo(active); // also re-runs layout and visibility
  else updateVisibility();
}

function renderSetup() {
  if (!setupView) return;
  setupView.webContents.send('ofa:setup', {
    page: setupPage,
    presets: Object.entries(presets).map(([id, p]) => ({ id, name: p.name, icon: p.icon || getFaviconUrl(p.url) || DATA_URIS.generic })),
    services: cfg.services.map((s) => ({ id: s.id, name: s.name, icon: s.icon || presets[s.id]?.icon || getFaviconUrl(s.url) || DATA_URIS.generic })),
    canClose: views.size > 0,
    notificationsOk: !!cfg.notificationsOk,
    appMode: cfg.appMode || 'normal',
    ramOptimization: cfg.ramOptimization !== false,
    idleSleepMinutes: cfg.idleSleepMinutes || 0,
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
  if (isMenubar()) positionUnderTray();
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
  cfg = next;
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

function notify({ title, body, sound, serviceId, onClick }) {
  dbg(`notify() called title="${title}" body="${body}" serviceId=${serviceId}`);
  if (cfg.history) {
    const entrySvc = views.get(serviceId)?.service;
    history.unshift({
      at: Date.now(),
      serviceId,
      serviceName: entrySvc?.name || 'Notification',
      serviceIcon: entrySvc?.icon || presets[serviceId]?.icon || DATA_URIS.generic,
      title,
      body,
    });
    history.length = Math.min(history.length, 200);
  }
  const n = retain(new Notification({
    title,
    subtitle: views.get(serviceId)?.service.name || '',
    body: body || '',
    silent: sound === null,
    ...(sound && sound !== 'default' ? { sound } : {}),
  }));
  n.on('show', () => dbg(`notification SHOWN title="${title}"}`));
  n.on('click', onClick);
  n.on('failed', (_e, err) => {
    dbg(`notification FAILED title="${title}" err=${err}`);
    console.error(`[ofa] notification failed: ${err}\n[ofa] System Settings > Notifications > ${app.getName()} — allow notifications.`);
  });
  n.show();
}

const findEntry = (senderId) => [...views.values()].find((v) => v.view.webContents.id === senderId);

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
  dbg(`ofa:title service=${entry.service.id} unread=${prev}->${unread} notifyOnUnread=${entry.service.notifyOnUnread} sawApi=${entry.sawApiNotification}`);
  updateBadge();

  // Only trigger fallback notification when count goes up.
  if (!(unread > prev) || !entry.service.notifyOnUnread || entry.sawApiNotification) {
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
      { enabled: true, sawApiNotification: entry.sawApiNotification, msSinceLoad: Date.now() - entry.loadedAt },
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
ipcMain.on('ofa:set-app-mode', (_e, mode) => patchConfig({ appMode: mode }));
ipcMain.on('ofa:set-ram-opt', (_e, on) => patchConfig({ ramOptimization: !!on }));
ipcMain.on('ofa:set-idle-sleep', (_e, mins) => patchConfig({ idleSleepMinutes: Number(mins) || 0 }));
// fs.watch turns every one of these into applyConfig, which re-renders the UI.
const patchConfig = (patch) => config.save({ ...config.load(), ...patch });

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
    service = {
      id: url.hostname.toLowerCase().replace(/\W+/g, '-'),
      name: url.hostname,
      url: url.href,
      icon: getFaviconUrl(url.href),
    };
  }
  const next = config.load();
  if (next.services.some((s) => s.id === service.id)) return;
  next.services.push(service);
  pendingLogin = service.id;
  config.save(config.withDefaults(next)); // fs.watch turns this into applyConfig
});

ipcMain.on('ofa:remove', (_e, id) => {
  const next = config.load();
  next.services = next.services.filter((s) => s.id !== id);
  config.save(next);
});

// Deliberately bypasses notify(): this tests whether macOS will deliver at all,
// so DND and the per-service filters must not be able to swallow it.
ipcMain.on('ofa:test-notification', (e) => {
  const n = retain(new Notification({ title: 'one-for-all', body: 'Notifications are working.' }));
  const reply = (r) => !e.sender.isDestroyed() && e.sender.send('ofa:test-result', r);
  n.on('show', () => {
    reply({ ok: true });
    if (!cfg.notificationsOk) patchConfig({ notificationsOk: true });
  });
  n.on('failed', (_ev, err) => reply({ ok: false, err: String(err) }));
  n.show();
});

// `ofa notify ...` relaunches the app; the running instance picks the payload out of argv.
function handleCliNotify(argv) {
  const payload = config.parseCliNotify(argv);
  if (!payload) return false;
  if (!payload.title) return true;
  notify({
    title: payload.title,
    body: payload.body,
    serviceId: null,
    onClick: () => (payload.url ? shell.openExternal(payload.url) : show()),
  });
  return true;
}

/* --------------------------------------------------------------- watchdog */

// One tick, two independent idle policies: reload a service that's gone quiet
// (opt-in per service) and sleep one RAM optimization has decided to unload
// (opt-in globally). They share a timer since both only need minute resolution.
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
      entry.view.webContents.loadURL('about:blank'); // release heavy DOM memory
    }
  }
}

/* -------------------------------------------------------------------- chrome */

function renderTabs() {
  if (!tabsView) return;
  const list = [...views.values()].map(({ service, unread }) => ({
    id: service.id,
    name: service.name,
    icon: service.icon || presets[service.id]?.icon || getFaviconUrl(service.url) || DATA_URIS.generic,
    unread,
    muted: service.muted,
    active: service.id === active,
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
  tray.setContextMenu(Menu.buildFromTemplate([
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
    { label: 'Quit one-for-all', accelerator: 'Cmd+Q', click: () => app.quit() },
  ]));
}

function buildAppMenu() {
  const jump = [...views.keys()].slice(0, 9).map((id, i) => ({
    label: views.get(id).service.name,
    accelerator: `Cmd+${i + 1}`,
    click: () => switchTo(id),
  }));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' }, // copy/paste inside the web views needs this
    {
      label: 'Service',
      submenu: [
        ...jump,
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
    { role: 'windowMenu' },
  ]));
}

/* ---------------------------------------------------------------- lifecycle */

app.whenReady().then(() => {
  const menubar = isMenubar();
  win = new BaseWindow({
    width: menubar ? 420 : 1100,
    height: menubar ? 620 : 780,
    show: false,
    title: 'one-for-all',
    frame: !menubar,
    alwaysOnTop: menubar,
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
    win.on('blur', () => {
      // BaseWindow has no webContents of its own; ask the service views instead,
      // otherwise opening devtools blurs the panel and hides it out from under you.
      if (![...views.values()].some((v) => v.view.webContents.isDevToolsOpened())) win.hide();
    });
  }

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

  const trayIcon = nativeImage.createFromBuffer(trayPng(1));
  trayIcon.addRepresentation({ scaleFactor: 2, buffer: trayPng(2) });
  trayIcon.setTemplateImage(true); // black-on-transparent: macOS tints it for light/dark menu bars
  tray = new Tray(trayIcon);
  tray.setToolTip('one-for-all');
  // In menubar mode the blur handler has already hidden the panel by the time this
  // fires, so treat a click just after a hide as "close", not "open again".
  let hiddenAt = 0;
  win.on('hide', () => { hiddenAt = Date.now(); });
  tray.on('click', () => {
    if (win.isVisible() || Date.now() - hiddenAt < 250) win.hide();
    else show();
  });

  const enabledServices = cfg.services.filter((s) => s.enabled);
  enabledServices.forEach(addService);

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
