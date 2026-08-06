// Known services, for `ofa add <id>`. PRs adding rows here are welcome.
module.exports = {
  // Messenger uses Service Worker push, not window.Notification — needs the unread-count fallback.
  messenger: { name: 'Messenger', url: 'https://www.messenger.com/', notifyOnUnread: true },
  // Zalo never calls the Notification API, so it needs the unread-count fallback.
  zalo: { name: 'Zalo', url: 'https://chat.zalo.me/', notifyOnUnread: true },
  gmail: { name: 'Gmail', url: 'https://mail.google.com/' },
  outlook: { name: 'Outlook', url: 'https://outlook.live.com/mail/' },
  slack: { name: 'Slack', url: 'https://app.slack.com/client' },
  discord: { name: 'Discord', url: 'https://discord.com/app' },
  telegram: { name: 'Telegram', url: 'https://web.telegram.org/' },
  whatsapp: { name: 'WhatsApp', url: 'https://web.whatsapp.com/' },
};
