// Pure config + routing logic. No electron imports, so `npm test` runs in plain node.
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = path.join(os.homedir(), 'Library', 'Application Support', 'one-for-all');
const FILE = path.join(DIR, 'config.json');

const DEFAULTS = {
  startAtLogin: true,
  windowMode: 'window', // "window" | "menubar"
  globalShortcut: 'Cmd+Shift+Space',
  dnd: false, // manual override, toggled from the menu bar
  dndSchedule: [], // [{ from: "22:00", to: "08:00", days: [1,2,3,4,5] }]
  history: true,
  services: [],
};

const SERVICE_DEFAULTS = {
  enabled: true,
  muted: false,
  badge: true,
  sound: 'default',
  reloadIfIdleMinutes: 0, // 0 = never
  notifyOnUnread: false, // for sites that never call the Notification API
  notify: { allow: [], deny: [], priority: [] },
};

// Sites that ignore the Notification API (Zalo) only ever tell us one thing: the
// unread count in their tab title. Turning a rise in that number into a notification
// is the whole fallback — no DOM selectors to rot when the site redeploys.
const SETTLE_MS = 10000;

function unreadDelta({ enabled, sawApiNotification, msSinceLoad }, prev, next) {
  if (!enabled || sawApiNotification) return null; // never double up on a real API call
  if (msSinceLoad < SETTLE_MS) return null; // a reload re-counts from 0; don't replay it
  if (!(next > prev)) return null;
  const d = next - prev;
  return `${d} new message${d > 1 ? 's' : ''}`;
}

function withDefaults(raw) {
  const cfg = { ...DEFAULTS, ...raw };
  cfg.services = (raw.services || []).map((s) => ({
    ...SERVICE_DEFAULTS,
    ...s,
    notify: { ...SERVICE_DEFAULTS.notify, ...(s.notify || {}) },
    partition: s.partition || `persist:${s.id}`,
  }));
  return cfg;
}

function load() {
  try {
    return withDefaults(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`config.json is unreadable (${err.message}); using defaults`);
    const seed = withDefaults({
      ...DEFAULTS,
      services: [{ id: 'messenger', name: 'Messenger', url: 'https://www.messenger.com/' }],
    });
    save(seed);
    return seed;
  }
}

function save(cfg) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
}

// "(3) Messenger" -> 3, "Inbox (12) - Gmail" -> 12, "(9+) Slack" -> 9
function parseUnread(title) {
  const m = /\((\d+)\+?\)/.exec(title || '');
  return m ? Number(m[1]) : 0;
}

const matches = (patterns, text) =>
  (patterns || []).some((p) => {
    try {
      return new RegExp(p, 'i').test(text);
    } catch {
      return false; // a broken regex in user config must never swallow notifications
    }
  });

const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// ponytail: `days` is checked against the day it is *now*, so a Mon–Fri 22:00–08:00
// window stops at midnight Friday rather than spilling into Saturday morning.
// Predictable beats clever; split the window in config if you need the spillover.
function inWindow(w, now) {
  const from = toMinutes(w.from);
  const to = toMinutes(w.to);
  if (from === null || to === null) return false;
  if (w.days && !w.days.includes(now.getDay())) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  return from <= to ? mins >= from && mins < to : mins >= from || mins < to;
}

function isDndActive(cfg, now = new Date()) {
  return !!cfg.dnd || (cfg.dndSchedule || []).some((w) => inWindow(w, now));
}

function shouldNotify(service, cfg, { title = '', body = '' } = {}, now = new Date()) {
  if (service.muted) return false;
  const text = `${title} ${body}`;
  const { allow, deny, priority } = service.notify || SERVICE_DEFAULTS.notify;
  if (matches(priority, text)) return true;
  if (isDndActive(cfg, now)) return false;
  if (matches(deny, text)) return false;
  if (allow && allow.length && !matches(allow, text)) return false;
  return true;
}

module.exports = {
  DIR, FILE, load, save, withDefaults, parseUnread, shouldNotify, isDndActive, unreadDelta,
};
