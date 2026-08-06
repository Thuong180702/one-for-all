const assert = require('assert');
const { parseUnread, shouldNotify, withDefaults } = require('../src/config');

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

console.log('ok');
