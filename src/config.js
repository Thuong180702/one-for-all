// Pure config + routing logic. No electron imports, so `npm test` runs in plain node.
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = path.join(os.homedir(), 'Library', 'Application Support', 'one-for-all');
const FILE = path.join(DIR, 'config.json');

const DEFAULTS = {
  startAtLogin: true,
  globalShortcut: 'Cmd+Shift+Space',
  dnd: false,
  services: [],
};

const SERVICE_DEFAULTS = {
  enabled: true,
  muted: false,
  badge: true,
  sound: 'default',
  notify: { allow: [], deny: [], priority: [] },
};

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

function shouldNotify(service, cfg, { title = '', body = '' } = {}) {
  if (service.muted) return false;
  const text = `${title} ${body}`;
  const { allow, deny, priority } = service.notify || SERVICE_DEFAULTS.notify;
  if (matches(priority, text)) return true;
  if (cfg.dnd) return false;
  if (matches(deny, text)) return false;
  if (allow && allow.length && !matches(allow, text)) return false;
  return true;
}

module.exports = { DIR, FILE, load, save, withDefaults, parseUnread, shouldNotify };
