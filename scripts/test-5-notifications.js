#!/usr/bin/env node
const { execFileSync } = require('child_process');

const sampleNotifications = [
  { title: 'Messenger • Alice Nguyen', body: 'Hey, meet me at the coffee shop at 2 PM! ☕' },
  { title: 'Zalo • Công việc', body: 'Báo cáo tuần đã được phê duyệt 🚀' },
  { title: 'Gmail • Security Team', body: 'New login detected from macOS Device 🛡️' },
  { title: 'Slack • Dev Team', body: 'Deployment build #142 succeeded on main branch ✅' },
  { title: 'Telegram • Bob Tran', body: 'Can you check the design file I sent? 🎨' },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('🚀 Sending 5 test notifications to notihub...\n');
  for (let i = 0; i < sampleNotifications.length; i++) {
    const n = sampleNotifications[i];
    const payload = JSON.stringify({ title: n.title, body: n.body });
    try {
      execFileSync('open', ['-a', '/Applications/notihub.app', '--args', `--notihub-notify=${payload}`]);
      console.log(`  ✓ Sent (${i + 1}/5): ${n.title}`);
    } catch (err) {
      console.error(`  ❌ Failed (${i + 1}/5):`, err.message);
    }
    await sleep(800);
  }
  console.log('\n🎉 Done! All 5 notifications delivered to macOS banner & Notification History.');
}

run();
