/**
 * test-preload-shim.js
 *
 * Tests the preload shim logic in a simulated browser environment (plain Node).
 *
 * Covers:
 *   - window.Notification replacement → captures title + body
 *   - ServiceWorkerRegistration.showNotification interception
 *   - document.visibilityState / document.hidden override
 *   - visibilitychange event dispatch on state change
 *   - ofa:notify and ofa:title IPC messages are fired correctly
 */

'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');

/* ─────────────────────────────────── simulated browser env ─ */

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

// Build a minimal browser-like environment that the shim code can run in.
function makeBrowserEnv() {
  const ipcMessages = []; // captured { channel, payload } objects

  const ee = new EventEmitter();
  const docListeners = {};

  const document = {
    visibilityState: 'visible',
    hidden: false,
    addEventListener(type, fn) {
      if (!docListeners[type]) docListeners[type] = [];
      docListeners[type].push(fn);
    },
    dispatchEvent(event) {
      (docListeners[event.type] || []).forEach((fn) => fn(event));
    },
    title: 'Messenger',
  };

  // Simulated window with __ofa bridge
  const notifyCalls = [];
  const titleCalls = [];

  const window = {
    Notification: class NativeNotification {
      constructor(title, opts = {}) { this.title = title; this.body = opts.body; }
      static requestPermission() { return Promise.resolve('granted'); }
      static get permission() { return 'granted'; }
    },
    __ofa: {
      notify(payload) { notifyCalls.push(payload); ipcMessages.push({ ch: 'ofa:notify', payload }); },
      title(t) { titleCalls.push(t); ipcMessages.push({ ch: 'ofa:title', payload: t }); },
      onVisibility(cb) { ee.on('visibility', cb); },
    },
  };

  // ServiceWorker mock: provides a ServiceWorkerRegistration with showNotification
  const swNotifyCalls = [];
  const regProto = {
    showNotification(title, opts) {
      swNotifyCalls.push({ title, body: opts?.body });
    },
  };
  const reg = Object.create(regProto);
  const swReady = Promise.resolve(reg);
  window.navigator = {
    serviceWorker: { ready: swReady },
  };

  // Emit visibility changes
  const setVisible = (v) => ee.emit('visibility', v);

  return { window, document, reg, regProto, ipcMessages, notifyCalls, titleCalls, swNotifyCalls, setVisible };
}

/* ─────────────────── the shim logic under test ─ */

// This is the business logic from preload.js, isolated for testing.
// It mirrors what shim() does when injected into the page.
function runShim(env) {
  const { window, document, setVisible } = env;

  // seq counter (mirrors preload.js)
  let seq = 0;

  // ── OfaNotification class ──────────────────────────────
  class OfaNotification {
    constructor(title, options = {}) {
      this._id = ++seq;
      this.title = String(title);
      this.body = options.body || '';
      window.__ofa.notify({ id: this._id, title: this.title, body: this.body });
    }
    static get permission() { return 'granted'; }
    static requestPermission() { return Promise.resolve('granted'); }
    addEventListener() {}
    close() {}
  }

  // Replace window.Notification
  window.Notification = OfaNotification;

  // ── Visibility ────────────────────────────────────────
  let visible = true;
  Object.defineProperty(document, 'visibilityState', {
    configurable: true, get: () => (visible ? 'visible' : 'hidden'),
  });
  Object.defineProperty(document, 'hidden', {
    configurable: true, get: () => !visible,
  });
  window.__ofa.onVisibility((v) => {
    if (v === visible) return;
    visible = v;
    document.dispatchEvent({ type: 'visibilitychange' });
  });

  // ── SW interception (mirrors preload.js addition) ─────
  if (window.navigator && 'serviceWorker' in window.navigator) {
    window.navigator.serviceWorker.ready.then(function (reg) {
      const proto = Object.getPrototypeOf(reg);
      proto.showNotification = function swNotification(title, options) {
        options = options || {};
        window.__ofa.notify({ id: ++seq, title: String(title), body: options.body || '' });
        return Promise.resolve();
      };
    }).catch(function () {});
  }

  return { getSeq: () => seq };
}

/* ═══════════════════════════════════════════════════════════
   window.Notification replacement
═══════════════════════════════════════════════════════════ */
console.log('\nwindow.Notification shim');

test('Notification constructor sends ofa:notify with title and body', () => {
  const env = makeBrowserEnv();
  runShim(env);
  new env.window.Notification('Alice', { body: 'Hey there' });
  assert.strictEqual(env.notifyCalls.length, 1);
  assert.strictEqual(env.notifyCalls[0].title, 'Alice');
  assert.strictEqual(env.notifyCalls[0].body, 'Hey there');
});

test('each Notification gets a unique incrementing id', () => {
  const env = makeBrowserEnv();
  runShim(env);
  new env.window.Notification('A', { body: 'x' });
  new env.window.Notification('B', { body: 'y' });
  assert.notStrictEqual(env.notifyCalls[0].id, env.notifyCalls[1].id);
  assert.ok(env.notifyCalls[1].id > env.notifyCalls[0].id, 'ids must be ascending');
});

test('Notification with no body sends empty string', () => {
  const env = makeBrowserEnv();
  runShim(env);
  new env.window.Notification('No body notification');
  assert.strictEqual(env.notifyCalls[0].body, '');
});

test('Notification.permission returns granted', () => {
  const env = makeBrowserEnv();
  runShim(env);
  assert.strictEqual(env.window.Notification.permission, 'granted');
});

test('Notification.requestPermission resolves to granted', async () => {
  const env = makeBrowserEnv();
  runShim(env);
  const result = await env.window.Notification.requestPermission();
  assert.strictEqual(result, 'granted');
});

/* ═══════════════════════════════════════════════════════════
   document.visibilityState / document.hidden
═══════════════════════════════════════════════════════════ */
console.log('\nVisibility state override');

test('starts as visible', () => {
  const env = makeBrowserEnv();
  runShim(env);
  assert.strictEqual(env.document.visibilityState, 'visible');
  assert.strictEqual(env.document.hidden, false);
});

test('setVisible(false) → document.hidden=true, visibilityState=hidden', () => {
  const env = makeBrowserEnv();
  runShim(env);
  env.setVisible(false);
  assert.strictEqual(env.document.visibilityState, 'hidden');
  assert.strictEqual(env.document.hidden, true);
});

test('setVisible(true) restores visible state', () => {
  const env = makeBrowserEnv();
  runShim(env);
  env.setVisible(false);
  env.setVisible(true);
  assert.strictEqual(env.document.visibilityState, 'visible');
  assert.strictEqual(env.document.hidden, false);
});

test('visibilitychange event fires when state changes', () => {
  const env = makeBrowserEnv();
  runShim(env);
  let changeCount = 0;
  env.document.addEventListener('visibilitychange', () => changeCount++);
  env.setVisible(false);
  env.setVisible(true);
  assert.strictEqual(changeCount, 2, 'event fires for each state change');
});

test('visibilitychange does NOT fire if state unchanged', () => {
  const env = makeBrowserEnv();
  runShim(env);
  let changeCount = 0;
  env.document.addEventListener('visibilitychange', () => changeCount++);
  env.setVisible(true); // same as initial → no event
  env.setVisible(true); // still the same → no event
  assert.strictEqual(changeCount, 0);
});

/* ═══════════════════════════════════════════════════════════
   ServiceWorkerRegistration.showNotification interception
═══════════════════════════════════════════════════════════ */
console.log('\nServiceWorker.showNotification interception');

test('after shim, reg.showNotification sends ofa:notify instead of native', async () => {
  const env = makeBrowserEnv();
  runShim(env);

  // Wait for the promise chain inside the shim to complete
  await env.reg.constructor.resolve?.() ?? await Promise.resolve();
  await new Promise((r) => setImmediate(r));

  // Now call the (patched) prototype method
  const reg = await env.window.navigator.serviceWorker.ready;
  await reg.showNotification('Bob', { body: 'Hello from SW' });

  assert.ok(env.notifyCalls.length >= 1, 'ofa:notify must have been called');
  const last = env.notifyCalls[env.notifyCalls.length - 1];
  assert.strictEqual(last.title, 'Bob');
  assert.strictEqual(last.body, 'Hello from SW');
});

test('SW notification with no body → empty string body', async () => {
  const env = makeBrowserEnv();
  runShim(env);
  await new Promise((r) => setImmediate(r));

  const reg = await env.window.navigator.serviceWorker.ready;
  await reg.showNotification('Notification title');

  const last = env.notifyCalls[env.notifyCalls.length - 1];
  assert.strictEqual(last.body, '');
});

test('SW showNotification returns a resolved Promise (does not throw)', async () => {
  const env = makeBrowserEnv();
  runShim(env);
  await new Promise((r) => setImmediate(r));

  const reg = await env.window.navigator.serviceWorker.ready;
  const result = reg.showNotification('Test', { body: 'hi' });
  assert.ok(result instanceof Promise, 'must return a Promise');
  await result; // must not reject
});

test('shim assigns unique ids to both Notification and SW notifications', async () => {
  const env = makeBrowserEnv();
  runShim(env);
  await new Promise((r) => setImmediate(r));

  new env.window.Notification('From page', { body: 'p' });
  const reg = await env.window.navigator.serviceWorker.ready;
  await reg.showNotification('From SW', { body: 's' });

  assert.strictEqual(env.notifyCalls.length, 2);
  assert.notStrictEqual(env.notifyCalls[0].id, env.notifyCalls[1].id, 'ids must differ');
});

/* ═══════════════════════════════════════════════════════════
   RESULT
═══════════════════════════════════════════════════════════ */
// Async tests: flush microtask queue before printing result
setImmediate(() => {
  console.log(`\n${'─'.repeat(50)}`);
  if (failed === 0) {
    console.log(`✅  All ${passed} tests passed`);
  } else {
    console.error(`❌  ${failed} of ${passed + failed} tests failed`);
    process.exitCode = 1;
  }
});
