const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__tabs', {
  onUpdate: (cb) => ipcRenderer.on('ofa:tabs', (_e, list) => cb(list)),
  select: (id) => ipcRenderer.send('ofa:select', id),
});
