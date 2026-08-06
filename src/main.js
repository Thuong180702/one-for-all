const {
  app, BaseWindow, WebContentsView, Notification, session, Tray, Menu, screen,
  globalShortcut, powerSaveBlocker, powerMonitor, ipcMain, nativeImage, shell,
} = require('electron');
const fs = require('fs');
const path = require('path');
const config = require('./config');

if (!app.requestSingleInstanceLock()) app.quit();

const TAB_H = 34;
const PIDFILE = path.join(config.DIR, 'ofa.pid');

let cfg = config.load();
const views = new Map(); // service.id -> { view, service, unread, lastSeen }
const history = [];
let win, tabsView, tray, active, quitting = false;

// Sites block the Electron UA; pretend to be plain Chrome.
const USER_AGENT = app.userAgentFallback.replace(/ (one-for-all|Electron)\/[\d.]+/g, '');

/* ---------------------------------------------------------------- services */

function addService(service) {
  const ses = session.fromPartition(service.partition);
  ses.setUserAgent(service.userAgent || USER_AGENT);
  // Auto-grant notifications so the site never falls into "blocked" mode; deny the rest.
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'notifications'));

  const view = new WebContentsView({
    webPreferences: {
      session: ses,
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  const entry = {
    view, service, unread: 0, lastSeen: Date.now(), loadedAt: Date.now(), sawApiNotification: false,
  };
  const wc = view.webContents;
  wc.setBackgroundThrottling(false);
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
    console.error(`[${service.id}] load failed (${desc}); retrying in 5s`);
    setTimeout(() => !wc.isDestroyed() && wc.loadURL(service.url), 5000);
  });

  wc.loadURL(service.url);
  views.set(service.id, entry);
  win.contentView.addChildView(view);
  if (!active) switchTo(service.id);
  else layout();
}

function removeService(id) {
  const entry = views.get(id);
  if (!entry) return;
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
  active = id;
  win.contentView.addChildView(entry.view); // re-adding raises it to the front
  win.setTitle(entry.service.name);
  layout();
  entry.view.webContents.focus();
  renderTabs();
  updateVisibility();
}

// A service is "on screen" only if the window is up and it is the front tab.
// Everything else must look hidden to the page, or it will never notify.
function updateVisibility() {
  const shown = !!win && win.isVisible();
  for (const [id, entry] of views) {
    const wc = entry.view.webContents;
    if (!wc.isDestroyed()) wc.send('ofa:visibility', shown && id === active);
  }
}

function layout() {
  const { width, height } = win.getContentBounds();
  tabsView.setBounds({ x: 0, y: 0, width, height: TAB_H });
  for (const { view } of views.values()) {
    view.setBounds({ x: 0, y: TAB_H, width, height: height - TAB_H });
  }
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

function show() {
  if (isMenubar()) positionUnderTray();
  win.show();
  app.focus({ steal: true });
}

/* ------------------------------------------------------------ config reload */

function applyConfig(next) {
  cfg = next;
  const wanted = next.services.filter((s) => s.enabled);
  for (const id of [...views.keys()]) {
    if (!wanted.some((s) => s.id === id)) removeService(id);
  }
  for (const s of wanted) {
    const entry = views.get(s.id);
    if (!entry) {
      addService(s);
    } else {
      const changed = s.url !== entry.service.url || s.partition !== entry.service.partition;
      entry.service = s;
      if (changed) entry.view.webContents.loadURL(s.url);
    }
  }
  buildAppMenu();
  updateBadge();
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

function notify({ title, body, sound, serviceId, onClick }) {
  if (cfg.history) {
    history.unshift({ at: Date.now(), serviceId, title, body });
    history.length = Math.min(history.length, 200);
  }
  const n = new Notification({
    title,
    subtitle: views.get(serviceId)?.service.name || '',
    body: body || '',
    silent: sound === null,
    // macOS takes a sound *name* here ("Ping", "Glass"); "default" means leave it alone.
    ...(sound && sound !== 'default' ? { sound } : {}),
  });
  n.on('click', onClick);
  // Silence here is the worst failure mode this app has: everything looks fine
  // and nothing ever pops. UNErrorDomain 1 = macOS is blocking us.
  n.on('failed', (_e, err) => console.error(`[ofa] notification failed: ${err}\n[ofa] System Settings > Notifications > ${app.getName()} — allow notifications.`));
  n.show();
}

const findEntry = (senderId) => [...views.values()].find((v) => v.view.webContents.id === senderId);

// Preload reruns on every navigation, so it asks rather than us guessing when to tell it.
ipcMain.on('ofa:hello', (e) => {
  const entry = findEntry(e.sender.id);
  if (entry) e.sender.send('ofa:visibility', win.isVisible() && entry.service.id === active);
});

ipcMain.on('ofa:notify', (e, payload) => {
  const entry = findEntry(e.sender.id);
  if (!entry) return;
  entry.lastSeen = Date.now();
  entry.sawApiNotification = true; // stops the unread fallback from doubling up
  if (!config.shouldNotify(entry.service, cfg, payload)) return;
  notify({
    title: payload.title || entry.service.name,
    body: payload.body,
    sound: entry.service.sound,
    serviceId: entry.service.id,
    onClick: () => {
      show();
      switchTo(entry.service.id);
      // Replaying the page's own onclick is what navigates to the right thread.
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
  updateBadge();

  const body = config.unreadDelta({
    enabled: entry.service.notifyOnUnread,
    sawApiNotification: entry.sawApiNotification,
    msSinceLoad: Date.now() - entry.loadedAt,
  }, prev, unread);
  if (!body) return;
  const payload = { title: entry.service.name, body };
  if (!config.shouldNotify(entry.service, cfg, payload)) return;
  notify({
    ...payload,
    sound: entry.service.sound,
    serviceId: entry.service.id,
    onClick: () => {
      show();
      switchTo(entry.service.id);
    },
  });
});

ipcMain.on('ofa:select', (_e, id) => switchTo(id));

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

function checkIdle() {
  for (const entry of views.values()) {
    const limit = entry.service.reloadIfIdleMinutes;
    if (!limit) continue;
    if (Date.now() - entry.lastSeen > limit * 60000) {
      console.log(`[${entry.service.id}] idle ${limit}m; reloading`);
      entry.lastSeen = Date.now();
      entry.view.webContents.reload();
    }
  }
}

/* -------------------------------------------------------------------- chrome */

function renderTabs() {
  if (!tabsView) return;
  tabsView.webContents.send('ofa:tabs', [...views.values()].map(({ service, unread }) => ({
    id: service.id,
    name: service.name,
    unread,
    muted: service.muted,
    active: service.id === active,
  })));
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
  for (const ev of ['show', 'hide', 'minimize', 'restore']) win.on(ev, updateVisibility);
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

  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('one-for-all');
  // In menubar mode the blur handler has already hidden the panel by the time this
  // fires, so treat a click just after a hide as "close", not "open again".
  let hiddenAt = 0;
  win.on('hide', () => { hiddenAt = Date.now(); });
  tray.on('click', () => {
    if (win.isVisible() || Date.now() - hiddenAt < 250) win.hide();
    else show();
  });

  cfg.services.filter((s) => s.enabled).forEach(addService);
  buildAppMenu();
  updateBadge();
  layout();
  win.show();

  // Keeping the sockets alive is the entire reason this app exists.
  powerSaveBlocker.start('prevent-app-suspension');
  powerMonitor.on('resume', reloadAll);
  setInterval(checkIdle, 60000);
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
