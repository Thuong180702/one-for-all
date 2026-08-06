#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const config = require('../src/config');
const presets = require('../src/presets');

const [cmd, ...args] = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};

const commands = {
  add() {
    const url = flag('url');
    const preset = args[0] && !args[0].startsWith('--') ? presets[args[0]] : null;
    if (!url && !preset) {
      console.error(`Unknown service. Presets: ${Object.keys(presets).join(', ')}\nOr: ofa add --url <url> --name <name>`);
      process.exit(1);
    }
    const service = preset
      ? { id: args[0], ...preset }
      : { id: (flag('name') || new URL(url).hostname).toLowerCase().replace(/\W+/g, '-'), name: flag('name') || new URL(url).hostname, url };

    const cfg = config.load();
    if (cfg.services.some((s) => s.id === service.id)) {
      console.error(`${service.id} is already configured.`);
      process.exit(1);
    }
    cfg.services.push(service);
    config.save(config.withDefaults(cfg));
    console.log(`Added ${service.name} (${service.id}). Restart one-for-all to load it.`);
  },

  list() {
    const cfg = config.load();
    if (!cfg.services.length) return console.log('No services configured. Try: ofa add messenger');
    for (const s of cfg.services) {
      console.log(`${s.enabled ? ' ' : '-'} ${s.id.padEnd(12)} ${s.name.padEnd(16)} ${s.url}${s.muted ? '  [muted]' : ''}`);
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

  launch() {
    spawn(require('electron'), [path.join(__dirname, '..')], { detached: true, stdio: 'ignore' }).unref();
  },

  help() {
    console.log(`one-for-all — native macOS notifications for web apps

  ofa                          launch (or focus) the app
  ofa add <preset|--url URL>   add a service   [${Object.keys(presets).join(' ')}]
  ofa list                     list configured services
  ofa remove <id>              remove a service
  ofa config                   edit ${config.FILE}`);
  },
};

const run = commands[cmd || 'launch'] || commands.help;
run();
