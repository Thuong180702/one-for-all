const { contextBridge, ipcRenderer } = require('electron');

// Our own chrome (the tab strip and the setup screen), not a hosted service.
contextBridge.exposeInMainWorld('__tabs', {
  onUpdate: (cb) => ipcRenderer.on('ofa:tabs', (_e, list) => cb(list)),
  select: (id) => ipcRenderer.send('ofa:select', id),
  openSetup: () => ipcRenderer.send('ofa:setup-open'),
});

contextBridge.exposeInMainWorld('__setup', {
  onState: (cb) => ipcRenderer.on('ofa:setup', (_e, state) => cb(state)),
  onTestResult: (cb) => ipcRenderer.on('ofa:test-result', (_e, r) => cb(r)),
  add: (what) => ipcRenderer.send('ofa:add', what),
  remove: (id) => ipcRenderer.send('ofa:remove', id),
  test: () => ipcRenderer.send('ofa:test-notification'),
  close: () => ipcRenderer.send('ofa:setup-close'),
});
