const assert = require('assert');
const {
  parseUnread, shouldNotify, withDefaults, isDndActive, unreadDelta,
} = require('../src/config');

// unread parsing — the only thing standing between us and a wrong Dock badge
assert.strictEqual(parseUnread('(3) Messenger'), 3);
assert.strictEqual(parseUnread('Inbox (12) - me@gmail.com - Gmail'), 12);
assert.strictEqual(parseUnread('(9+) Slack'), 9);
assert.strictEqual(parseUnread('Messenger'), 0);
assert.strictEqual(parseUnread(undefined), 0);

const cfg = { dnd: false };
const svc = withDefaults({ services: [{ id: 'x', name: 'X' }] }).services[0];

assert.ok(shouldNotify(svc, cfg, { title: 'Mom', body: 'hi' }));
assert.ok(!shouldNotify({ ...svc, muted: true }, cfg, { title: 'Mom' }));
assert.ok(!shouldNotify(svc, { dnd: true }, { title: 'Mom' }));

const deny = { ...svc, notify: { ...svc.notify, deny: ['reacted to your message'] } };
assert.ok(!shouldNotify(deny, cfg, { title: 'Bob', body: 'reacted to your message' }));
assert.ok(shouldNotify(deny, cfg, { title: 'Bob', body: 'hello' }));

const allow = { ...svc, notify: { ...svc.notify, allow: ['^Mom'] } };
assert.ok(shouldNotify(allow, cfg, { title: 'Mom' }));
assert.ok(!shouldNotify(allow, cfg, { title: 'Spam' }));

// priority beats DND, and a broken user regex must not swallow notifications
const prio = { ...svc, notify: { ...svc.notify, priority: ['Mom'] } };
assert.ok(shouldNotify(prio, { dnd: true }, { title: 'Mom' }));
assert.ok(shouldNotify({ ...svc, notify: { ...svc.notify, deny: ['[unclosed'] } }, cfg, { title: 'hi' }));

// defaults get filled in, and partition is derived from id
assert.strictEqual(svc.partition, 'persist:x');
assert.strictEqual(svc.badge, true);
assert.strictEqual(svc.reloadIfIdleMinutes, 0); // watchdog is opt-in

/* ------------------------------------------------------------ DND schedule */
// 2026-08-06 is a Thursday (day 4).
const at = (h, m = 0, day = 6) => new Date(2026, 7, day, h, m);

assert.strictEqual(isDndActive({}), false);
assert.strictEqual(isDndActive({ dnd: true }), true); // manual override wins

// a window that wraps past midnight
const night = { dndSchedule: [{ from: '22:00', to: '08:00' }] };
assert.strictEqual(isDndActive(night, at(23)), true);
assert.strictEqual(isDndActive(night, at(2)), true);
assert.strictEqual(isDndActive(night, at(8)), false); // `to` is exclusive
assert.strictEqual(isDndActive(night, at(21, 59)), false);
assert.strictEqual(isDndActive(night, at(22)), true);

// a same-day window
const lunch = { dndSchedule: [{ from: '12:00', to: '13:00' }] };
assert.strictEqual(isDndActive(lunch, at(12, 30)), true);
assert.strictEqual(isDndActive(lunch, at(13)), false);
assert.strictEqual(isDndActive(lunch, at(11, 59)), false);

// days filter — Thu Aug 6 2026 is day 4, Sat Aug 8 is day 6
const weekdays = { dndSchedule: [{ from: '22:00', to: '08:00', days: [1, 2, 3, 4, 5] }] };
assert.strictEqual(isDndActive(weekdays, at(23, 0, 6)), true); // Thursday
assert.strictEqual(isDndActive(weekdays, at(23, 0, 8)), false); // Saturday

// malformed entries must not throw or silently swallow everything
assert.strictEqual(isDndActive({ dndSchedule: [{ from: 'nope', to: '08:00' }] }, at(2)), false);
assert.strictEqual(isDndActive({ dndSchedule: [{}] }, at(2)), false);

// and the schedule actually gates notifications
assert.ok(!shouldNotify(svc, night, { title: 'Bob' }, at(23)));
assert.ok(shouldNotify(svc, night, { title: 'Bob' }, at(12)));
assert.ok(shouldNotify(prio, night, { title: 'Mom' }, at(23))); // priority beats the schedule

/* -------------------------------------------- unread fallback (Zalo & co.) */
const settled = { enabled: true, sawApiNotification: false, msSinceLoad: 60000 };

assert.strictEqual(unreadDelta(settled, 0, 1), '1 new message');
assert.strictEqual(unreadDelta(settled, 1, 4), '3 new messages'); // plural, and it's a delta
assert.strictEqual(unreadDelta(settled, 4, 4), null); // unchanged
assert.strictEqual(unreadDelta(settled, 4, 1), null); // reading messages is not news
assert.strictEqual(unreadDelta(settled, 4, 0), null);

// off by default, so enabling it on Messenger can't spam
assert.strictEqual(unreadDelta({ ...settled, enabled: false }, 0, 3), null);
// a site that already fired a real Notification must never get a second one
assert.strictEqual(unreadDelta({ ...settled, sawApiNotification: true }, 0, 3), null);
// a reload re-counts from zero; don't replay the backlog as popups
assert.strictEqual(unreadDelta({ ...settled, msSinceLoad: 500 }, 0, 12), null);
assert.strictEqual(unreadDelta({ ...settled, msSinceLoad: 9999 }, 0, 12), null);
assert.strictEqual(unreadDelta({ ...settled, msSinceLoad: 10001 }, 0, 12), '12 new messages');

// the fallback is opt-in per service, and the zalo preset opts in
assert.strictEqual(svc.notifyOnUnread, false);
assert.strictEqual(require('../src/presets').zalo.notifyOnUnread, true);

// window mode defaults to a normal window
assert.strictEqual(withDefaults({}).windowMode, 'window');

console.log('ok');
