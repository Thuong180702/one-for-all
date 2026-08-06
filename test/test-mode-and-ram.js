/**
 * test-mode-and-ram.js
 *
 * Tests the App Operating Mode (normal vs minimal) & RAM optimization defaults.
 * Runs in plain Node.
 */

'use strict';

const assert = require('assert');
const { withDefaults } = require('../src/config');

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

console.log('\nApp Mode & RAM Optimization Config');

test('defaults to normal mode', () => {
  const cfg = withDefaults({});
  assert.strictEqual(cfg.appMode, 'normal');
});

test('allows setting appMode to minimal', () => {
  const cfg = withDefaults({ appMode: 'minimal' });
  assert.strictEqual(cfg.appMode, 'minimal');
});

test('defaults ramOptimization to false (background throttling would pause the socket)', () => {
  const cfg = withDefaults({});
  assert.strictEqual(cfg.ramOptimization, false);
});

test('allows enabling ramOptimization', () => {
  const cfg = withDefaults({ ramOptimization: true });
  assert.strictEqual(cfg.ramOptimization, true);
});

test('defaults idleSleepMinutes to 0 (off)', () => {
  const cfg = withDefaults({});
  assert.strictEqual(cfg.idleSleepMinutes, 0);
});

test('allows customizing idleSleepMinutes', () => {
  const cfg = withDefaults({ idleSleepMinutes: 15 });
  assert.strictEqual(cfg.idleSleepMinutes, 15);
});

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅  All ${passed} tests passed`);
} else {
  console.error(`❌  ${failed} of ${passed + failed} tests failed`);
  process.exitCode = 1;
}
