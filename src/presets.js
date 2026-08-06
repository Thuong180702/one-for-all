const { DATA_URIS } = require('./icons');

// Known services, for `ofa add <id>`. PRs adding rows here are welcome.
module.exports = {
  // Messenger uses Service Worker push, not window.Notification — needs the unread-count fallback.
  messenger: { name: 'Messenger', url: 'https://www.messenger.com/', notifyOnUnread: true, icon: DATA_URIS.messenger },
  // Zalo never calls the Notification API, so it needs the unread-count fallback.
  zalo: { name: 'Zalo', url: 'https://chat.zalo.me/', notifyOnUnread: true, icon: DATA_URIS.zalo },
  gmail: { name: 'Gmail', url: 'https://mail.google.com/', icon: DATA_URIS.gmail },
  outlook: { name: 'Outlook', url: 'https://outlook.live.com/mail/', icon: DATA_URIS.outlook },
  slack: { name: 'Slack', url: 'https://app.slack.com/client', icon: DATA_URIS.slack },
  discord: { name: 'Discord', url: 'https://discord.com/app', icon: DATA_URIS.discord },
  telegram: { name: 'Telegram', url: 'https://web.telegram.org/', icon: DATA_URIS.telegram },
  whatsapp: { name: 'WhatsApp', url: 'https://web.whatsapp.com/', icon: DATA_URIS.whatsapp },
};

