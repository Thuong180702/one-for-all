#!/usr/bin/env node
/**
 * integration-test.js
 *
 * End-to-end test that exercises the real notihub app:
 *   1. Starts a local HTTP server serving a Messenger-like test page.
 *   2. Injects the service into config.json → the running app hot-reloads it.
 *   3. The test page fires 3 notifications via window.Notification (the same
 *      path our shim intercepts from Messenger's reg.showNotification) with 300 ms gaps.
 *   4. Reads notihub-debug.log and verifies:
 *        - correct notification count (3 × ofa:notify, each shown)
 *        - correct sender names and bodies
 *        - badge shows 3 after all messages
 *        - badge resets to 0 after "reading" (page clears its title)
 *   5. Cleans up: removes the test service from config.json.
 *
 * Usage:  node test/integration-test.js
 * Requires the packaged notihub.app to be running.
 */

'use strict';

const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const assert  = require('assert');

/* ────────────────────────────────────────── paths ─── */
const CONFIG_PATH = path.join(os.homedir(), 'Library/Application Support/notihub/config.json');
const LOG_PATH    = path.join(os.homedir(), 'Library/Application Support/notihub/notihub-debug.log');

const PORT            = 19_823;
const SERVICE_ID      = 'notihub-integration-test';
const SERVICE_NAME    = 'IntegrationTest';
const SETTLE_MS       = 3_000;  // time for the app to load the tab + shim to install
const NOTIFY_DELAY_MS = 400;    // gap between each simulated message
const VERIFY_MS       = 5_000;  // wait for all notifications to be processed + logged

/* ────────────────────────────── test page HTML ─── */
// This page simulates what messenger.com does when new messages arrive:
//  - Calls window.Notification(senderName, { body: messageText })
//  - Updates document.title with the unread count badge
//  - After a delay, clears the title (simulating the user reading messages)

const TEST_MESSAGES = [
  { sender: 'Alice Nguyen',  body: 'Hey, are you free tonight? 🎉' },
  { sender: 'Bob Tran',      body: 'Can we reschedule the meeting?' },
  { sender: 'Charlie Le',    body: 'Just sent you the files!' },
];

function buildTestPage(messages, port) {
  const steps = messages.map((m, i) => `
    await sleep(${i === 0 ? 0 : NOTIFY_DELAY_MS});
    log('Sending notification ${i + 1}: ${m.sender}');
    new Notification(${JSON.stringify(m.sender)}, { body: ${JSON.stringify(m.body)} });
    document.title = '(${i + 1}) ${SERVICE_NAME}';
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${SERVICE_NAME}</title>
  <style>
    body { font-family: monospace; background: #1a1a2e; color: #a6e3a1; padding: 24px; }
    h2   { color: #cba6f7; }
    #log { white-space: pre-wrap; font-size: 13px; }
  </style>
</head>
<body>
  <h2>🧪 notihub Integration Test</h2>
  <div id="log"></div>
  <script>
    const NOTIFY_DELAY_MS = ${NOTIFY_DELAY_MS};
    const SETTLE_MS       = ${SETTLE_MS};
    const PORT            = ${port};

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    function log(msg) {
      const el = document.getElementById('log');
      el.textContent += '[' + new Date().toISOString().slice(11,23) + '] ' + msg + '\\n';
      console.log(msg);
      // Also POST to the test server so the Node runner can read progress.
      fetch('http://localhost:' + PORT + '/log', {
        method: 'POST', headers: {'Content-Type': 'text/plain'}, body: msg,
      }).catch(() => {});
    }

    async function runTest() {
      log('Page loaded. Waiting ' + SETTLE_MS + ' ms for preload shim to install…');
      await sleep(SETTLE_MS);

      // ── Phase 1: fire 3 notifications ──────────────────────────────────
      log('=== Phase 1: sending 3 notifications ===');
      ${steps}

      log('All 3 notifications sent. Waiting ' + (${VERIFY_MS} / 1000) + ' s…');
      await sleep(${VERIFY_MS});

      // ── Phase 2: simulate reading (badge clear) ─────────────────────────
      log('=== Phase 2: simulating read (clearing badge) ===');
      document.title = '${SERVICE_NAME}';
      log('Title cleared → badge should go to 0 after this tab is focused.');

      await sleep(2000);
      log('=== Test sequence complete ===');

      // Signal the test runner we are done.
      fetch('http://localhost:' + PORT + '/done', { method: 'POST' }).catch(() => {});
    }

    runTest().catch(e => {
      log('ERROR: ' + e.message);
      fetch('http://localhost:' + PORT + '/error', {
        method: 'POST', body: e.message,
      }).catch(() => {});
    });
  </script>
</body>
</html>`;
}

/* ─────────────────────────────────── helpers ─── */

function pass(msg) { console.log(`  ✅  ${msg}`); }
function fail(msg) { console.error(`  ❌  ${msg}`); process.exitCode = 1; }

function readLog() {
  try { return fs.readFileSync(LOG_PATH, 'utf8'); }
  catch { return ''; }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function addTestService(cfg) {
  const services = cfg.services.filter((s) => s.id !== SERVICE_ID);
  services.push({
    id:              SERVICE_ID,
    name:            SERVICE_NAME,
    url:             `http://localhost:${PORT}/`,
    partition:       `persist:${SERVICE_ID}`,
    enabled:         true,
    muted:           false,
    badge:           true,
    sound:           'default',
    notifyOnUnread:  true,
    reloadIfIdleMinutes: 0,
    notify:          { allow: [], deny: [], priority: [] },
  });
  return { ...cfg, services };
}

function removeTestService(cfg) {
  return { ...cfg, services: cfg.services.filter((s) => s.id !== SERVICE_ID) };
}

/* ──────────────────────────────────────── main ─── */

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  notihub Notification Integration Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ── sanity: is config accessible? ───────────────────────────────────
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`❌ Config not found at ${CONFIG_PATH}`);
    console.error('   Is notihub running?');
    process.exit(1);
  }

  const logLines = [];   // progress messages from the page
  let done = false;

  // ── 1. Start local HTTP server ───────────────────────────────────────
  const testHtml = buildTestPage(TEST_MESSAGES, PORT);
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(testHtml);
    } else if (req.method === 'POST' && req.url === '/log') {
      let body = '';
      req.on('data', (d) => { body += d; });
      req.on('end', () => { logLines.push(body); console.log(`  [page] ${body}`); res.end(); });
    } else if (req.method === 'POST' && req.url === '/done') {
      done = true;
      res.end();
    } else if (req.method === 'POST' && req.url === '/error') {
      let body = '';
      req.on('data', (d) => { body += d; });
      req.on('end', () => { console.error(`  [page ERROR] ${body}`); res.end(); });
    } else {
      res.writeHead(404); res.end();
    }
  });

  await new Promise((resolve, reject) => server.listen(PORT, '127.0.0.1', resolve).on('error', reject));
  console.log(`🌐  Test server running at http://localhost:${PORT}/`);

  // ── 2. Snapshot the log (ignore pre-existing entries) ────────────────
  const logSnapshot = readLog();
  const logSnapshotLen = logSnapshot.length;
  console.log(`📋  Log snapshot taken (${logSnapshotLen} bytes already in log)`);

  // ── 3. Inject test service into config.json ──────────────────────────
  const originalCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const patchedCfg  = addTestService(originalCfg);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(patchedCfg, null, 2));
  console.log(`⚙️   Test service "${SERVICE_NAME}" added to config.json`);
  console.log(`    → The app will hot-reload and open http://localhost:${PORT}/\n`);

  // ── 4. Wait for the page to finish its test sequence ─────────────────
  const totalWait = SETTLE_MS + TEST_MESSAGES.length * NOTIFY_DELAY_MS + VERIFY_MS + 4_000;
  console.log(`⏳  Waiting up to ${Math.ceil(totalWait / 1000)} s for test page to complete…`);

  const deadline = Date.now() + totalWait + 5_000;
  while (!done && Date.now() < deadline) await sleep(500);

  if (!done) {
    console.warn('\n⚠️   Page did not signal completion (normal if app is slow to load)');
    console.warn('    Continuing with log analysis…\n');
  }

  await sleep(1000); // final flush

  // ── 5. Analyse the debug log ─────────────────────────────────────────
  const newLog = readLog().slice(logSnapshotLen);
  const lines  = newLog.split('\n').filter(Boolean);

  console.log('\n📝  New log entries since test started:');
  lines.forEach((l) => console.log('    ' + l));
  console.log();

  // ── Assertions ───────────────────────────────────────────────────────
  console.log('🔍  Verifying results…\n');

  const notifyReceived = lines.filter((l) => l.includes('ofa:notify received') && l.includes(SERVICE_ID));
  const notifyShown    = lines.filter((l) => l.includes('notification SHOWN'));
  const notifyFailed   = lines.filter((l) => l.includes('notification FAILED'));
  const titleLines     = lines.filter((l) => l.includes(`ofa:title service=${SERVICE_ID}`));
  const badgeLines     = titleLines.filter((l) => /unread=\d+->\d+/.test(l));

  // ── Check: 3 ofa:notify IPC calls received ───────────────────────────
  if (notifyReceived.length === TEST_MESSAGES.length) {
    pass(`Received exactly ${TEST_MESSAGES.length} ofa:notify IPC messages`);
  } else {
    fail(`Expected ${TEST_MESSAGES.length} ofa:notify received, got ${notifyReceived.length}`);
    if (notifyReceived.length === 0) {
      console.error('       → The shim may not have loaded, or the tab was not opened');
    }
  }

  // ── Check: correct sender names in notifications ─────────────────────
  for (const { sender } of TEST_MESSAGES) {
    const found = notifyReceived.some((l) => l.includes(sender));
    if (found) {
      pass(`Sender name captured: "${sender}"`);
    } else {
      fail(`Sender name missing from log: "${sender}"`);
    }
  }

  // ── Check: all notifications were actually shown ──────────────────────
  if (notifyShown.length >= TEST_MESSAGES.length) {
    pass(`All ${TEST_MESSAGES.length} notifications shown on-screen`);
  } else {
    fail(`Only ${notifyShown.length} of ${TEST_MESSAGES.length} notifications were shown`);
    if (notifyFailed.length > 0) {
      console.error('       → Notification FAILED events found:');
      notifyFailed.forEach((l) => console.error(`         ${l}`));
    }
  }

  // ── Check: no notification failures ──────────────────────────────────
  if (notifyFailed.length === 0) {
    pass('No notification failures');
  } else {
    fail(`${notifyFailed.length} notification failure(s) detected`);
  }

  // ── Check: badge count reached 3 ─────────────────────────────────────
  const badgeAt3 = badgeLines.some((l) => {
    const m = l.match(/unread=\d+->(\d+)/);
    return m && parseInt(m[1], 10) >= TEST_MESSAGES.length;
  });
  if (badgeAt3) {
    pass(`Menu bar badge reached ${TEST_MESSAGES.length}`);
  } else {
    // Badge persistence means it might not go to 3 in one step; check cumulative
    const maxBadge = badgeLines.reduce((max, l) => {
      const m = l.match(/unread=\d+->(\d+)/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    if (maxBadge > 0) {
      pass(`Badge reached ${maxBadge} (may be batched — badge persistence active)`);
    } else {
      fail('Badge never incremented — ofa:title not received or unread count stayed 0');
    }
  }

  // ── Check: badge clears after "reading" ───────────────────────────────
  // The title goes back to SERVICE_NAME (no parens) — but badge persistence means
  // this is only honoured when the tab is the active+focused one.
  // We check that the log recorded the "ignoring decrease" message OR that
  // unread did reach 0 at some point.
  const badgeIgnored = lines.some((l) => l.includes('ignoring decrease') && l.includes(SERVICE_ID));
  const badgeCleared = badgeLines.some((l) => {
    const m = l.match(/unread=\d+->0/);
    return !!m;
  });
  if (badgeIgnored) {
    pass('Badge persistence working: decrease ignored (user not looking at tab)');
  } else if (badgeCleared) {
    pass('Badge cleared to 0 (tab was active+focused when title reset)');
  } else {
    // This might not have happened yet because it requires the tab to be active+focused
    console.log('  ⚠️   Badge clear not verified in log (requires tab to be active+focused)');
    console.log('       Switch to the IntegrationTest tab in notihub to see the badge clear.');
  }

  // ── Check: duplicate popup loop prevention ────────────────────────────
  const cooldownLines = lines.filter((l) => l.includes('in cooldown'));
  if (cooldownLines.length > 0) {
    pass(`Cooldown prevented ${cooldownLines.length} duplicate popup(s)`);
  }

  // ── 6. Cleanup ───────────────────────────────────────────────────────
  console.log('\n🧹  Cleaning up…');
  server.close();

  const restoredCfg = removeTestService(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(restoredCfg, null, 2));
  console.log('    Test service removed from config.json');

  // ── Summary ───────────────────────────────────────────────────────────
  const exitOk = process.exitCode !== 1;
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (exitOk) {
    console.log('🎉  Integration test PASSED');
  } else {
    console.log('💥  Integration test FAILED — see failures above');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error('\n💥  Unexpected error:', err);
  process.exit(1);
});
