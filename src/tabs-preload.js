const { contextBridge, ipcRenderer } = require('electron');

const DEV = process.argv.includes('--dev');

// Our own chrome (the tab strip and the setup screen), not a hosted service.
contextBridge.exposeInMainWorld('__tabs', {
  onUpdate: (cb) => ipcRenderer.on('ofa:tabs', (_e, data) => cb(data)),
  select: (id) => ipcRenderer.send('ofa:select', id),
  openSetup: () => ipcRenderer.send('ofa:open-page', 'services'),
  openSettings: () => ipcRenderer.send('ofa:open-page', 'settings'),
  openHistory: () => ipcRenderer.send('ofa:open-page', 'history'),
  contextMenu: (id) => ipcRenderer.send('ofa:tab-context-menu', id),
});

contextBridge.exposeInMainWorld('__setup', {
  onState: (cb) => ipcRenderer.on('ofa:setup', (_e, state) => cb(state)),
  onTestResult: (cb) => ipcRenderer.on('ofa:test-result', (_e, r) => cb(r)),
  add: (what) => ipcRenderer.send('ofa:add', what),
  remove: (id) => ipcRenderer.send('ofa:remove', id),
  updateService: (id, patch) => ipcRenderer.send('ofa:update-service', { id, patch }),
  test: () => ipcRenderer.send('ofa:test-notification'),
  // Debug-only: not called from any setup.html button, and the main-process
  // handlers no-op outside --dev anyway. Left off the surface entirely in a
  // production build rather than just relying on that server-side gate.
  ...(DEV ? {
    testSimulated: (count) => ipcRenderer.send('ofa:test-simulated-notification', { count }),
    setUnreadCount: (count) => ipcRenderer.send('ofa:set-unread-count', count),
  } : {}),
  close: () => ipcRenderer.send('ofa:setup-close'),
  page: (name) => ipcRenderer.send('ofa:setup-page', name),
  finishWelcome: () => ipcRenderer.send('ofa:onboarded'),
  setLoginItem: (on) => ipcRenderer.send('ofa:login-item', on),
  openNotificationSettings: () => ipcRenderer.send('ofa:notification-settings'),
  setTheme: (theme) => ipcRenderer.send('ofa:set-theme', theme),
  setAppMode: (mode) => ipcRenderer.send('ofa:set-app-mode', mode),
  setWindowMode: (mode) => ipcRenderer.send('ofa:set-window-mode', mode),
  setRamOptimization: (on) => ipcRenderer.send('ofa:set-ram-opt', on),
  setIdleSleepMinutes: (mins) => ipcRenderer.send('ofa:set-idle-sleep', mins),
  setDnd: (on) => ipcRenderer.send('ofa:set-dnd', on),
  setDndSchedule: (schedule) => ipcRenderer.send('ofa:set-dnd-schedule', schedule),
  setGlobalShortcut: (shortcut) => ipcRenderer.send('ofa:set-global-shortcut', shortcut),
  onShortcutResult: (cb) => ipcRenderer.on('ofa:shortcut-result', (_e, r) => cb(r)),
  select: (id) => ipcRenderer.send('ofa:select', id),
  clearHistory: () => ipcRenderer.send('ofa:history-clear'),
  checkUpdate: () => ipcRenderer.send('ofa:check-update'),
  openRelease: () => ipcRenderer.send('ofa:open-release'),
});
