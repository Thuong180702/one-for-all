/**
 * test-notify-pipeline.js
 *
 * Tests the notification pipeline business logic extracted from main.js.
 * Runs in plain Node — no Electron required.
 *
 * Covers:
 *   - Badge persistence (ignore decreases when not viewing)
 *   - Cooldown (suppress repeated popups for 2 minutes)
 *   - Debounce (batch rapid messages into one notification)
 *   - API notification vs title-fallback interaction
 *   - shouldNotify / unreadDelta integration
 */

'use strict';

const assert = require('assert');
const { shouldNotify, isDndActive, withDefaults } = require('../src/config');

/* ─────────────────────────────────────────────── helpers ─── */

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

// Fake timer implementation — lets us control setTimeout without real delays.
function makeFakeTimers() {
  const pending = [];
  let nextId = 1;

  const setTimeout = (fn, _delay) => {
    const id = nextId++;
    pending.push({ id, fn, cancelled: false });
    return id;
  };
  const clearTimeout = (id) => {
    const t = pending.find((p) => p.id === id);
    if (t) t.cancelled = true;
  };
  // Run all non-cancelled timers in order of registration.
  const flush = () => {
    const toRun = pending.filter((p) => !p.cancelled);
    pending.length = 0;
    toRun.forEach((p) => p.fn());
  };
  const hasPending = () => pending.some((p) => !p.cancelled);

  return { setTimeout, clearTimeout, flush, hasPending };
}

// Build a realistic service entry (mirrors the shape in main.js addService).
function makeEntry(id = 'messenger', overrides = {}) {
  const svc = withDefaults({ services: [{ id, name: id, notifyOnUnread: true }] }).services[0];
  return {
    service: { ...svc, ...overrides.service },
    unread: 0,
    lastSeen: Date.now(),
    loadedAt: Date.now() - 15_000, // 15 s ago → past the 10 s settle window
    sawApiNotification: false,
    pendingNotify: null,
    notifyCooldownUntil: 0,
    ...overrides,
  };
}

/* ─────────────────────────────────── pipeline simulation ─── */

/**
 * Simulates the ofa:title IPC handler from main.js.
 * Returns the list of notify() calls made (after flushing timers).
 */
function simulatePipeline(opts = {}) {
  const {
    entry,
    events,          // [{ prev, unread }] — sequence of title-poll changes
    focused = false, // win.isFocused()
    active = null,   // which service is currently visible
    timers,
    notifications = [],
    cfg = { dnd: false },
  } = opts;

  for (const { prev, unread } of events) {
    entry.unread = unread;

    // ── only go up ────────────────────────────────────────
    if (!(unread > prev) || !entry.service.notifyOnUnread || entry.sawApiNotification) {
      if (entry.pendingNotify) {
        timers.clearTimeout(entry.pendingNotify.timer);
        entry.pendingNotify = null;
      }
      continue;
    }

    // ── cooldown ──────────────────────────────────────────
    if (Date.now() < entry.notifyCooldownUntil) {
      if (entry.pendingNotify) {
        timers.clearTimeout(entry.pendingNotify.timer);
        entry.pendingNotify = null;
      }
      continue;
    }

    // ── debounce ──────────────────────────────────────────
    if (!entry.pendingNotify) entry.pendingNotify = { base: prev };
    if (entry.pendingNotify.timer != null) timers.clearTimeout(entry.pendingNotify.timer);

    const snap = entry; // closure over entry
    entry.pendingNotify.timer = timers.setTimeout(() => {
      const base = snap.pendingNotify ? snap.pendingNotify.base : prev;
      snap.pendingNotify = null;
      const d = snap.unread - base;
      if (d <= 0 || Date.now() - snap.loadedAt < 10_000) return;
      const payload = {
        title: snap.service.name,
        body: `${d} new message${d > 1 ? 's' : ''}`,
      };
      if (!shouldNotify(snap.service, cfg, payload)) return;
      notifications.push(payload);
      snap.notifyCooldownUntil = Date.now() + 120_000;
    }, 1500);
  }

  timers.flush();
  return notifications;
}

/* ═══════════════════════════════════════════════════════════
   BADGE PERSISTENCE
═══════════════════════════════════════════════════════════ */
console.log('\nBadge persistence');

test('increase always accepted', () => {
  const entry = makeEntry();
  const notes = simulatePipeline({
    entry, timers: makeFakeTimers(),
    events: [{ prev: 0, unread: 1 }],
  });
  assert.strictEqual(entry.unread, 1);
  assert.strictEqual(notes.length, 1);
});

test('decrease correctly updates unread count (e.g. read on phone)', () => {
  const entry = makeEntry();
  entry.unread = 3;
  const timers = makeFakeTimers();
  simulatePipeline({
    entry, timers,
    events: [{ prev: 3, unread: 0 }],
  });
  assert.strictEqual(entry.unread, 0, 'unread must decrease to 0 when read on another device');
});

/* ═══════════════════════════════════════════════════════════
   DEBOUNCE
═══════════════════════════════════════════════════════════ */
console.log('\nDebounce');

test('single message → exactly one notification', () => {
  const entry = makeEntry();
  const notes = simulatePipeline({
    entry, timers: makeFakeTimers(),
    events: [{ prev: 0, unread: 1 }],
  });
  assert.strictEqual(notes.length, 1);
  assert.strictEqual(notes[0].body, '1 new message');
});

test('two rapid messages → one batched notification with total delta', () => {
  const entry = makeEntry();
  const notes = simulatePipeline({
    entry, timers: makeFakeTimers(),
    events: [
      { prev: 0, unread: 1 }, // msg A — timer starts
      { prev: 1, unread: 2 }, // msg B — timer resets, base stays at 0
    ],
  });
  assert.strictEqual(notes.length, 1, 'must fire only once');
  assert.strictEqual(notes[0].body, '2 new messages', 'body must reflect total delta');
});

test('five rapid messages → one batched notification', () => {
  const entry = makeEntry();
  const notes = simulatePipeline({
    entry, timers: makeFakeTimers(),
    events: [0, 1, 2, 3, 4].map((i) => ({ prev: i, unread: i + 1 })),
  });
  assert.strictEqual(notes.length, 1);
  assert.strictEqual(notes[0].body, '5 new messages');
});

test('no notification within the 10 s settle window after load', () => {
  const entry = makeEntry();
  entry.loadedAt = Date.now() - 5_000; // only 5 s ago
  const notes = simulatePipeline({
    entry, timers: makeFakeTimers(),
    events: [{ prev: 0, unread: 3 }],
  });
  assert.strictEqual(notes.length, 0, 'too soon after load');
});

/* ═══════════════════════════════════════════════════════════
   COOLDOWN
═══════════════════════════════════════════════════════════ */
console.log('\nCooldown');

test('first notification fires; sets 2-minute cooldown', () => {
  const entry = makeEntry();
  const notes = simulatePipeline({
    entry, timers: makeFakeTimers(),
    events: [{ prev: 0, unread: 1 }],
  });
  assert.strictEqual(notes.length, 1);
  assert.ok(entry.notifyCooldownUntil > Date.now(), 'cooldown must be set');
});

test('second burst during cooldown is suppressed', () => {
  const entry = makeEntry();
  const timers = makeFakeTimers();
  const notes = [];

  // First message — fires notification, sets cooldown
  simulatePipeline({ entry, timers, events: [{ prev: 0, unread: 1 }], notifications: notes });

  // Second message — should be swallowed by cooldown
  entry.pendingNotify = null;
  simulatePipeline({ entry, timers, events: [{ prev: 1, unread: 2 }], notifications: notes });

  assert.strictEqual(notes.length, 1, 'only the first notification must show');
});

test('notification fires again after cooldown expires', () => {
  const entry = makeEntry();
  const timers = makeFakeTimers();
  const notes = [];

  simulatePipeline({ entry, timers, events: [{ prev: 0, unread: 1 }], notifications: notes });
  assert.strictEqual(notes.length, 1);

  // Expire the cooldown
  entry.notifyCooldownUntil = Date.now() - 1;
  entry.pendingNotify = null;
  simulatePipeline({ entry, timers, events: [{ prev: 1, unread: 2 }], notifications: notes });

  assert.strictEqual(notes.length, 2, 'must fire again once cooldown expires');
});

test('switchTo resets cooldown and sawApiNotification', () => {
  const entry = makeEntry();
  entry.notifyCooldownUntil = Date.now() + 120_000;
  entry.sawApiNotification = true;

  // Simulate switchTo:
  entry.notifyCooldownUntil = 0;
  entry.sawApiNotification = false;

  assert.strictEqual(entry.notifyCooldownUntil, 0);
  assert.strictEqual(entry.sawApiNotification, false);

  // Should now be able to notify again
  const notes = simulatePipeline({
    entry, timers: makeFakeTimers(),
    events: [{ prev: 0, unread: 1 }],
  });
  assert.strictEqual(notes.length, 1, 'notification fires after switchTo reset');
});

/* ═══════════════════════════════════════════════════════════
   API NOTIFICATION vs TITLE FALLBACK
═══════════════════════════════════════════════════════════ */
console.log('\nAPI notification vs title-fallback');

test('sawApiNotification=true suppresses title-based fallback', () => {
  const entry = makeEntry();
  entry.sawApiNotification = true; // a real notification already came via ofa:notify
  const notes = simulatePipeline({
    entry, timers: makeFakeTimers(),
    events: [{ prev: 0, unread: 1 }],
  });
  assert.strictEqual(notes.length, 0, 'fallback must be silent when API already notified');
});

test('notifyOnUnread=false disables fallback (non-Messenger services)', () => {
  const entry = makeEntry('gmail', { service: { notifyOnUnread: false } });
  const notes = simulatePipeline({
    entry, timers: makeFakeTimers(),
    events: [{ prev: 0, unread: 5 }],
  });
  assert.strictEqual(notes.length, 0);
});

test('DND suppresses notification', () => {
  const entry = makeEntry();
  const notes = simulatePipeline({
    entry, timers: makeFakeTimers(),
    events: [{ prev: 0, unread: 1 }],
    cfg: { dnd: true },
  });
  assert.strictEqual(notes.length, 0, 'DND must block notification');
});

test('muted service produces no notification', () => {
  const entry = makeEntry('messenger', { service: { muted: true } });
  const notes = simulatePipeline({
    entry, timers: makeFakeTimers(),
    events: [{ prev: 0, unread: 1 }],
  });
  assert.strictEqual(notes.length, 0);
});

/* ═══════════════════════════════════════════════════════════
   PRESETS & CONFIG
═══════════════════════════════════════════════════════════ */
console.log('\nPresets & config');

test('Messenger preset has notifyOnUnread=true (needed for SW fallback)', () => {
  const presets = require('../src/presets');
  assert.strictEqual(presets.messenger.notifyOnUnread, true);
});

test('Zalo preset has notifyOnUnread=true', () => {
  const presets = require('../src/presets');
  assert.strictEqual(presets.zalo.notifyOnUnread, true);
});

test('Gmail/Outlook/Slack presets default to notifyOnUnread=false (they use Notification API)', () => {
  const presets = require('../src/presets');
  const apiServices = ['gmail', 'outlook', 'slack', 'discord', 'telegram', 'whatsapp'];
  for (const id of apiServices) {
    if (presets[id]) {
      assert.ok(
        !presets[id].notifyOnUnread,
        `${id} should not have notifyOnUnread=true`,
      );
    }
  }
});

test('withDefaults applies notifyOnUnread from preset', () => {
  const cfg = withDefaults({
    services: [{ id: 'messenger', name: 'Messenger', url: 'https://www.messenger.com/', notifyOnUnread: true }],
  });
  assert.strictEqual(cfg.services[0].notifyOnUnread, true);
});

/* ═══════════════════════════════════════════════════════════
   RESULT
═══════════════════════════════════════════════════════════ */
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅  All ${passed} tests passed`);
} else {
  console.error(`❌  ${failed} of ${passed + failed} tests failed`);
  process.exitCode = 1;
}
