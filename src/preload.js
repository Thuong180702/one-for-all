const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('__ofa', {
  notify: (payload) => ipcRenderer.send('ofa:notify', payload),
  onClick: (cb) => ipcRenderer.on('ofa:click', (_e, id) => cb(id)),
});

// Runs in the page's main world. contextIsolation keeps preload out of it, so the
// Notification shim has to be injected rather than assigned from here.
function shim() {
  const pending = new Map();
  let seq = 0;

  class OfaNotification extends EventTarget {
    static get permission() {
      return 'granted';
    }
    static requestPermission(cb) {
      if (cb) cb('granted');
      return Promise.resolve('granted');
    }
    constructor(title, options = {}) {
      super();
      Object.assign(this, options);
      this.title = String(title);
      this.onclick = null;
      this.onclose = null;
      this._id = ++seq;
      pending.set(this._id, this);
      if (pending.size > 200) pending.delete(pending.keys().next().value);
      window.__ofa.notify({ id: this._id, title: this.title, body: options.body || '' });
    }
    close() {
      pending.delete(this._id);
      if (this.onclose) this.onclose(new Event('close'));
    }
  }

  // Clicking the native notification replays the page's own onclick, which is what
  // navigates to the right thread. No per-site deep-link code needed.
  window.__ofa.onClick((id) => {
    const n = pending.get(id);
    if (!n) return;
    const ev = new Event('click');
    try {
      if (n.onclick) n.onclick.call(n, ev);
    } catch (err) {
      console.error('[one-for-all] notification onclick threw', err);
    }
    n.dispatchEvent(ev);
  });

  Object.defineProperty(window, 'Notification', {
    value: OfaNotification,
    writable: true,
    configurable: true,
  });
}

webFrame.executeJavaScript(`(${shim})()`);

// ponytail: 2s poll instead of a MutationObserver — SPAs swap the whole <title>
// element out, and polling is immune to that. Raise the interval if it ever shows up
// in a profile.
let last = null;
setInterval(() => {
  if (document.title !== last) {
    last = document.title;
    ipcRenderer.send('ofa:title', last);
  }
}, 2000);
