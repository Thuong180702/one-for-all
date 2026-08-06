const {
  app, BaseWindow, WebContentsView, Notification, session, Tray, Menu,
  globalShortcut, powerSaveBlocker, powerMonitor, ipcMain, nativeImage, shell,
} = require('electron');
const path = require('path');
const config = require('./config');

if (!app.requestSingleInstanceLock()) app.quit();

const cfg = config.load();
const views = new Map(); // service.id -> { view, service, unread }
let win, tray, active, quitting = false;

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
  const wc = view.webContents;
  wc.setBackgroundThrottling(false);

  // Links out of the app open in the real browser; the service keeps its page.
  wc.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = aborted, normal during SPA nav
    console.error(`[${service.id}] load failed (${desc}); retrying in 5s`);
    setTimeout(() => !wc.isDestroyed() && wc.loadURL(service.url), 5000);
  });

  wc.loadURL(service.url);
  views.set(service.id, { view, service, unread: 0 });
  win.contentView.addChildView(view);
  if (!active) switchTo(service.id);
  else layout();
}

function switchTo(id) {
  const entry = views.get(id);
  if (!entry) return;
  active = id;
  win.contentView.addChildView(entry.view); // re-adding raises it to the front
  win.setTitle(entry.service.name);
  layout();
  entry.view.webContents.focus();
}

function layout() {
  const { width, height } = win.getContentBounds();
  for (const { view } of views.values()) view.setBounds({ x: 0, y: 0, width, height });
}

const reloadAll = () => views.forEach(({ view }) => view.webContents.reload());

function show() {
  win.show();
  app.focus({ steal: true });
}

/* ----------------------------------------------------------- notifications */

ipcMain.on('ofa:notify', (e, payload) => {
  const entry = [...views.values()].find((v) => v.view.webContents.id === e.sender.id);
  if (!entry || !config.shouldNotify(entry.service, cfg, payload)) return;

  const n = new Notification({
    title: payload.title || entry.service.name,
    subtitle: entry.service.name,
    body: payload.body || '',
    silent: entry.service.sound === null,
  });
  n.on('click', () => {
    show();
    switchTo(entry.service.id);
    if (!e.sender.isDestroyed()) e.sender.send('ofa:click', payload.id);
  });
  n.show();
});

ipcMain.on('ofa:title', (e, title) => {
  const entry = [...views.values()].find((v) => v.view.webContents.id === e.sender.id);
  if (!entry) return;
  entry.unread = config.parseUnread(title);
  updateBadge();
});

function updateBadge() {
  let total = 0;
  for (const { service, unread } of views.values()) if (service.badge) total += unread;
  app.setBadgeCount(total);
  tray.setTitle(total ? String(total) : '');
  buildTrayMenu();
}

/* -------------------------------------------------------------------- chrome */

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
  tray.setContextMenu(Menu.buildFromTemplate([
    ...services,
    { type: 'separator' },
    {
      label: 'Do Not Disturb',
      type: 'checkbox',
      checked: cfg.dnd,
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
          checked: cfg.dnd,
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

  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('one-for-all');
  tray.on('click', show);

  cfg.services.filter((s) => s.enabled).forEach(addService);
  buildAppMenu();
  updateBadge();
  win.show();

  // Keeping the sockets alive is the entire reason this app exists.
  powerSaveBlocker.start('prevent-app-suspension');
  powerMonitor.on('resume', reloadAll);

  // Unpackaged dev runs can't register a login item ("Operation not permitted").
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!cfg.startAtLogin });
  if (cfg.globalShortcut) globalShortcut.register(cfg.globalShortcut, () => (win.isVisible() ? win.hide() : show()));
  if (process.argv.includes('--dev')) views.forEach(({ view }) => view.webContents.openDevTools({ mode: 'detach' }));
});

app.on('second-instance', () => show());
app.on('activate', () => show());
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {}); // stay resident
