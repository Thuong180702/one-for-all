#!/usr/bin/env node
const { spawn } = require('child_process');
const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const presets = require('../src/presets');
const pkg = require('../package.json');

const APP = path.join(__dirname, '..');
const PIDFILE = path.join(config.DIR, 'notihub.pid');

const [cmd, ...args] = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};
// macOS will not deliver notifications from an unpackaged `electron .` run, so
// always prefer a built bundle. `-n` starts a second copy that hands its argv to
// the running one through the single-instance lock, then quits.
const BUNDLE = [`/Applications/${pkg.name}.app`, path.join(APP, 'dist', `${pkg.name}.app`)]
  .find((p) => fs.existsSync(p));
const launch = (extra = []) => {
  const [cmd, argv] = BUNDLE
    ? ['open', ['-n', '-a', BUNDLE, ...(extra.length ? ['--args', ...extra] : [])]]
    : [require('electron'), [APP, ...extra]];
  spawn(cmd, argv, { detached: true, stdio: 'ignore' }).unref();
};

function isRunning() {
  try {
    process.kill(Number(fs.readFileSync(PIDFILE, 'utf8')), 0);
    return true;
  } catch {
    return false;
  }
}

const commands = {
  add() {
    const url = flag('url');
    const preset = args[0] && !args[0].startsWith('--') ? presets[args[0]] : null;
    if (!url && !preset) {
      console.error(`Unknown service. Presets: ${Object.keys(presets).join(', ')}\nOr: notihub add --url <url> --name <name>`);
      process.exit(1);
    }
    let host;
    if (!preset) {
      try {
        host = new URL(url).hostname;
      } catch {
        console.error(`Not a valid URL: ${url}`);
        process.exit(1);
      }
    }
    const service = preset
      ? { id: args[0], ...preset }
      : { id: (flag('name') || host).toLowerCase().replace(/\W+/g, '-'), name: flag('name') || host, url };

    // `--as work` is the whole multi-account story: a distinct id gets a distinct
    // session partition, so the second copy logs in independently.
    const label = flag('as');
    if (label) {
      const slug = label.toLowerCase().replace(/\W+/g, '-');
      service.id = `${service.id}-${slug}`;
      service.name = `${service.name} (${label})`;
    }

    const cfg = config.load();
    if (cfg.services.some((s) => s.id === service.id)) {
      console.error(`${service.id} is already configured.`);
      process.exit(1);
    }
    cfg.services.push(service);
    config.save(config.withDefaults(cfg));
    console.log(`Added ${service.name} (${service.id}).${isRunning() ? '' : ' Start the app with: notihub'}`);
  },

  list() {
    const cfg = config.load();
    if (!cfg.services.length) return console.log('No services configured. Try: notihub add messenger');
    const w = (key) => Math.max(...cfg.services.map((s) => s[key].length));
    for (const s of cfg.services) {
      console.log(`${s.enabled ? ' ' : '-'} ${s.id.padEnd(w('id'))}  ${s.name.padEnd(w('name'))}  ${s.url}${s.muted ? '  [muted]' : ''}`);
    }
  },

  remove() {
    const cfg = config.load();
    const before = cfg.services.length;
    cfg.services = cfg.services.filter((s) => s.id !== args[0]);
    if (cfg.services.length === before) {
      console.error(`No service with id "${args[0]}".`);
      process.exit(1);
    }
    config.save(cfg);
    console.log(`Removed ${args[0]}. Its session data stays on disk.`);
  },

  config() {
    config.load(); // creates the file if missing
    const editor = process.env.VISUAL || process.env.EDITOR;
    const proc = editor
      ? spawn(editor, [config.FILE], { stdio: 'inherit' })
      : spawn('open', ['-t', config.FILE]);
    proc.on('exit', (code) => process.exit(code || 0));
  },

  notify() {
    const title = args.find((a) => !a.startsWith('--'));
    if (!title) {
      console.error('Usage: notihub notify "Title" [--body "..."] [--url https://...]');
      process.exit(1);
    }
    // The running instance picks this out of argv via Electron's second-instance event.
    launch([config.CLI_NOTIFY + JSON.stringify({ title, body: flag('body'), url: flag('url') })]);
  },

  async doctor() {
    const ok = (pass, msg) => console.log(`${pass ? '✓' : '✗'} ${msg}`);
    let fatal = 0;

    const cfg = config.load();
    ok(true, `config: ${config.FILE}`);
    const running = isRunning();
    ok(running, running ? 'app is running' : 'app is not running (start it with: notihub)');

    if (BUNDLE) {
      ok(true, `packaged app: ${BUNDLE}`);
    } else {
      // the single most common reason nothing ever pops
      ok(false, 'no packaged app — macOS blocks notifications from a raw electron run (npm run build)');
      fatal++;
      try {
        require('electron');
        ok(true, 'electron binary present (dev mode)');
      } catch {
        ok(false, 'electron binary missing — run: npm install');
        fatal++;
      }
    }

    if (!cfg.services.length) {
      ok(false, 'no services configured (notihub add messenger)');
      fatal++;
    }
    for (const s of cfg.services) {
      let host;
      try {
        host = new URL(s.url).hostname;
      } catch {
        ok(false, `${s.id}: invalid url ${s.url}`);
        fatal++;
        continue;
      }
      if (!host) { // file:// and friends have no host to resolve
        ok(true, `${s.id}: ${s.url}`);
        continue;
      }
      try {
        await dns.lookup(host);
        ok(true, `${s.id}: ${host} resolves`);
      } catch {
        ok(false, `${s.id}: cannot resolve ${host}`);
        fatal++;
      }
    }

    const dnd = config.isDndActive(cfg);
    ok(!dnd, dnd ? 'Do Not Disturb is ON — notifications are suppressed' : 'Do Not Disturb is off');
    for (const s of cfg.services.filter((x) => x.muted)) ok(false, `${s.id} is muted`);

    console.log('\nmacOS notification permission cannot be read from here.');
    console.log('Test it end to end with:  notihub notify "test"');
    process.exit(fatal ? 1 : 0);
  },

  launch() {
    launch();
  },

  help() {
    console.log(`notihub — native macOS notifications for web apps

  notihub                          launch (or focus) the app
  notihub add <preset|--url URL>   add a service   [${Object.keys(presets).join(' ')}]
  notihub add <preset> --as work   add a second account, with its own login
  notihub list                     list configured services
  notihub remove <id>              remove a service
  notihub config                   edit ${config.FILE}
  notihub notify "Title" [--body B] [--url U]   push a notification
  notihub doctor                   check config, connectivity, DND`);
  },
};

const run = commands[cmd || 'launch'] || commands.help;
run();
