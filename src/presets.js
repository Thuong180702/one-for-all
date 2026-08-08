// getFaviconUrl(), not the bundled SVG art in icons.js: the hand-drawn approximations
// there don't actually match each brand's real logo closely enough (confirmed against
// the rendered Add Services grid), so accuracy wins over the minor privacy upside of
// not querying Google's favicon API for presets the user hasn't added yet. DATA_URIS
// is still used as the <img onerror> fallback and for the generic/no-favicon case.
const { getFaviconUrl } = require('./icons');

// Known services, for `ofa add <id>`. PRs adding rows here are welcome.
module.exports = {
  // Messenger uses Service Worker push, not window.Notification — needs the unread-count fallback.
  messenger: { name: 'Messenger', url: 'https://www.messenger.com/', notifyOnUnread: true, icon: getFaviconUrl('https://www.messenger.com/') },
  // Zalo never calls the Notification API, so it needs the unread-count fallback.
  zalo: { name: 'Zalo', url: 'https://chat.zalo.me/', notifyOnUnread: true, icon: getFaviconUrl('https://chat.zalo.me/') },
  gmail: { name: 'Gmail', url: 'https://mail.google.com/', icon: getFaviconUrl('https://mail.google.com/') },
  outlook: { name: 'Outlook', url: 'https://outlook.live.com/mail/', icon: getFaviconUrl('https://outlook.live.com/mail/') },
  slack: { name: 'Slack', url: 'https://app.slack.com/client', icon: getFaviconUrl('https://app.slack.com/client') },
  discord: { name: 'Discord', url: 'https://discord.com/app', icon: getFaviconUrl('https://discord.com/app') },
  telegram: { name: 'Telegram', url: 'https://web.telegram.org/', icon: getFaviconUrl('https://web.telegram.org/') },
  whatsapp: { name: 'WhatsApp', url: 'https://web.whatsapp.com/', icon: getFaviconUrl('https://web.whatsapp.com/') },
};

