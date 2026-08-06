const {
  app, BaseWindow, WebContentsView, Notification, session, Tray, Menu,
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
  const entry = { view, service, unread: 0, lastSeen: Date.now() };
  const wc = view.webContents;
  wc.setBackgroundThrottling(false);

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

function show() {
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
  });
  n.on('click', onClick);
  n.show();
}

const findEntry = (senderId) => [...views.values()].find((v) => v.view.webContents.id === senderId);

ipcMain.on('ofa:notify', (e, payload) => {
  const entry = findEntry(e.sender.id);
  if (!entry) return;
  entry.lastSeen = Date.now();
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
  entry.unread = unread;
  updateBadge();
});

ipcMain.on('ofa:select', (_e, id) => switchTo(id));

// `ofa notify ...` relaunches the app; the running instance picks the payload out of argv.
function handleCliNotify(argv) {
  const i = argv.indexOf('--ofa-notify');
  if (i === -1) return false;
  let payload;
  try {
    payload = JSON.parse(argv[i + 1]);
  } catch {
    return true;
  }
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
  win = new BaseWindow({ width: 1100, height: 780, show: false, title: 'one-for-all' });
  win.on('resize', layout);
  win.on('close', (e) => {
    // Closing must not quit — the whole point is staying connected in the background.
    if (quitting) return;
    e.preventDefault();
    win.hide();
  });

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
  tray.on('click', show);

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
