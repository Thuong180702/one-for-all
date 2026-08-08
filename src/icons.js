// Vector SVG icons for presets and fallbacks.
// Encoded as SVG strings and Data URIs for easy rendering in HTML <img> tags or inline SVGs.

const SVG_ICONS = {
  messenger: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="msg-grad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0099FF"/>
        <stop offset="60%" stop-color="#A033FF"/>
        <stop offset="100%" stop-color="#FF5280"/>
      </linearGradient>
    </defs>
    <path d="M18 3C9.716 3 3 9.27 3 17c0 4.38 2.184 8.27 5.6 10.74V33l5.05-2.77c1.4.39 2.87.6 4.35.6 8.284 0 15-6.27 15-14S26.284 3 18 3z" fill="url(#msg-grad)"/>
    <path d="M9.8 20.7l4.9-7.8c.7-.9 2-.9 2.7-.1l3.7 2.8c.4.3.9.3 1.3 0l5.3-4c.7-.5 1.5.3 1 1l-4.9 7.8c-.7.9-2 .9-2.7.1l-3.7-2.8c-.4-.3-.9-.3-1.3 0l-5.3 4c-.7.5-1.5-.3-1-1z" fill="#FFFFFF"/>
  </svg>`,

  zalo: `<svg viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M22.782 0.166016H27.199C33.2653 0.166016 36.8103 1.05701 39.9572 2.74421C43.1041 4.4314 45.5875 6.89585 47.2557 10.0428C48.9429 13.1897 49.8339 16.7347 49.8339 22.801V27.1991C49.8339 33.2654 48.9429 36.8104 47.2557 39.9573C45.5685 43.1042 43.1041 45.5877 39.9572 47.2559C36.8103 48.9431 33.2653 49.8341 27.199 49.8341H22.8009C16.7346 49.8341 13.1896 48.9431 10.0427 47.2559C6.89583 45.5687 4.41243 43.1042 2.7442 39.9573C1.057 36.8104 0.166016 33.2654 0.166016 27.1991V22.801C0.166016 16.7347 1.057 13.1897 2.7442 10.0428C4.43139 6.89585 6.89583 4.41245 10.0427 2.74421C13.1707 1.05701 16.7346 0.166016 22.782 0.166016Z" fill="#0068FF"/>
    <path opacity="0.12" fill-rule="evenodd" clip-rule="evenodd" d="M49.8336 26.4736V27.1994C49.8336 33.2657 48.9427 36.8107 47.2555 39.9576C45.5683 43.1045 43.1038 45.5879 39.9569 47.2562C36.81 48.9434 33.265 49.8344 27.1987 49.8344H22.8007C17.8369 49.8344 14.5612 49.2378 11.8104 48.0966L7.27539 43.4267L49.8336 26.4736Z" fill="#001A33"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M7.779 43.5892C10.1019 43.846 13.0061 43.1836 15.0682 42.1825C24.0225 47.1318 38.0197 46.8954 46.4923 41.4732C46.8209 40.9803 47.1279 40.4677 47.4128 39.9363C49.1062 36.7779 50.0004 33.22 50.0004 27.1316V22.7175C50.0004 16.629 49.1062 13.0711 47.4128 9.91273C45.7385 6.75436 43.2461 4.28093 40.0877 2.58758C36.9293 0.894239 33.3714 0 27.283 0H22.8499C17.6644 0 14.2982 0.652754 11.4699 1.89893C11.3153 2.03737 11.1636 2.17818 11.0151 2.32135C2.71734 10.3203 2.08658 27.6593 9.12279 37.0782C9.13064 37.0921 9.13933 37.1061 9.14889 37.1203C10.2334 38.7185 9.18694 41.5154 7.55068 43.1516C7.28431 43.399 7.37944 43.5512 7.779 43.5892Z" fill="white"/>
    <path d="M20.5632 17H10.8382V19.0853H17.5869L10.9329 27.3317C10.7244 27.635 10.5728 27.9194 10.5728 28.5639V29.0947H19.748C20.203 29.0947 20.5822 28.7156 20.5822 28.2606V27.1421H13.4922L19.748 19.2938C19.8428 19.1801 20.0134 18.9716 20.0893 18.8768L20.1272 18.8199C20.4874 18.2891 20.5632 17.8341 20.5632 17.2844V17Z" fill="#0068FF"/>
    <path d="M32.9416 29.0947H34.3255V17H32.2402V28.3933C32.2402 28.7725 32.5435 29.0947 32.9416 29.0947Z" fill="#0068FF"/>
    <path d="M25.814 19.6924C23.1979 19.6924 21.0747 21.8156 21.0747 24.4317C21.0747 27.0478 23.1979 29.171 25.814 29.171C28.4301 29.171 30.5533 27.0478 30.5533 24.4317C30.5723 21.8156 28.4491 19.6924 25.814 19.6924ZM25.814 27.2184C24.2785 27.2184 23.0273 25.9672 23.0273 24.4317C23.0273 22.8962 24.2785 21.645 25.814 21.645C27.3495 21.645 28.6007 22.8962 28.6007 24.4317C28.6007 25.9672 27.3685 27.2184 25.814 27.2184Z" fill="#0068FF"/>
    <path d="M40.4867 19.6162C37.8516 19.6162 35.7095 21.7584 35.7095 24.3934C35.7095 27.0285 37.8516 29.1707 40.4867 29.1707C43.1217 29.1707 45.2639 27.0285 45.2639 24.3934C45.2639 21.7584 43.1217 19.6162 40.4867 19.6162ZM40.4867 27.2181C38.9322 27.2181 37.681 25.9669 37.681 24.4124C37.681 22.8579 38.9322 21.6067 40.4867 21.6067C42.0412 21.6067 43.2924 22.8579 43.2924 24.4124C43.2924 25.9669 42.0412 27.2181 40.4867 27.2181Z" fill="#0068FF"/>
    <path d="M29.4562 29.0944H30.5747V19.957H28.6221V28.2793C28.6221 28.7153 29.0012 29.0944 29.4562 29.0944Z" fill="#0068FF"/>
  </svg>`,

  gmail: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="36" rx="9" fill="#FFFFFF"/>
    <path d="M6 26V12l12 9 12-9v14c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2z" fill="#EA4335"/>
    <path d="M30 10l-12 9L6 10v-1c0-1.1.9-2 2-2h20c1.1 0 2 .9 2 2v1z" fill="#C5221F"/>
    <path d="M6 10l12 9V29H8c-1.1 0-2-.9-2-2V10z" fill="#4285F4"/>
    <path d="M30 10l-12 9V29h10c1.1 0 2-.9 2-2V10z" fill="#34A853"/>
    <path d="M28 8h2v3l-12 9L6 11V8h2l10 7.5L28 8z" fill="#FBBC04"/>
  </svg>`,

  outlook: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="36" rx="9" fill="#0078D4"/>
    <path d="M19 10h11c.6 0 1 .4 1 1v14c0 .6-.4 1-1 1H19V10z" fill="#0263B1"/>
    <path d="M19 14l6 4.5-6 4.5V14z" fill="#50E6FF"/>
    <circle cx="12" cy="18" r="7" fill="#004578"/>
    <path d="M12 14c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0 6.2c-1.2 0-2.2-1-2.2-2.2s1-2.2 2.2-2.2 2.2 1 2.2 2.2-1 2.2-2.2 2.2z" fill="#FFFFFF"/>
  </svg>`,

  slack: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="36" rx="9" fill="#4A154B"/>
    <path d="M11 19.5c0-.8.7-1.5 1.5-1.5h3.5v3.5c0 .8-.7 1.5-1.5 1.5s-1.5-.7-1.5-1.5v-2zm0-5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5v3.5H12.5C11.7 18 11 17.3 11 16.5v-2z" fill="#E01E5A"/>
    <path d="M16.5 11c.8 0 1.5.7 1.5 1.5v3.5h-3.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5h2zm5 0c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5h-3.5V12.5c0-.8.7-1.5 1.5-1.5h2z" fill="#36C5F0"/>
    <path d="M25 16.5c0 .8-.7 1.5-1.5 1.5h-3.5v-3.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5v2zm0 5c0 .8-.7 1.5-1.5 1.5s-1.5-.7-1.5-1.5v-3.5h1.5c.8 0 1.5.7 1.5 1.5v2z" fill="#2EB67D"/>
    <path d="M19.5 25c-.8 0-1.5-.7-1.5-1.5v-3.5h3.5c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5h-2zm-5 0c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5h3.5v3.5c0 .8-.7 1.5-1.5 1.5h-2z" fill="#ECB22E"/>
  </svg>`,

  discord: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="36" rx="9" fill="#5865F2"/>
    <path d="M24.7 10.5c-1.3-.6-2.7-1-4.2-1.2-.2.3-.4.8-.5 1.2-1.6-.2-3.1-.2-4.7 0-.2-.4-.4-.9-.6-1.2-1.5.2-2.9.6-4.2 1.2-2.7 4-3.4 7.9-3 11.8 1.8 1.3 3.5 2.1 5.2 2.7.4-.6.8-1.2 1.1-1.9-.6-.2-1.2-.5-1.7-.8.1-.1.3-.2.4-.3 3.3 1.5 6.9 1.5 10.2 0 .1.1.3.2.4.3-.5.3-1.1.6-1.7.8.3.7.7 1.3 1.1 1.9 1.7-.5 3.4-1.4 5.2-2.7.5-4.5-.7-8.4-3-11.8zM13.8 20.3c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm8.4 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z" fill="#FFFFFF"/>
  </svg>`,

  telegram: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="36" rx="9" fill="#2AABEE"/>
    <path d="M8.5 17.6l17.7-6.8c.8-.3 1.5.2 1.2 1.1l-3 14.1c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.2.2-.5.4-.9.4l.3-4.6 8.4-7.6c.4-.3-.1-.5-.6-.2l-10.4 6.5-4.5-1.4c-1-.3-1-.1-.7-1z" fill="#FFFFFF"/>
  </svg>`,

  whatsapp: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="36" rx="9" fill="#25D366"/>
    <path d="M18 7c-6.1 0-11 4.9-11 11 0 2.4.8 4.7 2.2 6.5L7.5 29l4.7-1.5c1.7 1.2 3.8 1.9 5.8 1.9 6.1 0 11-4.9 11-11S24.1 7 18 7zm5.7 14.8c-.2.7-1.4 1.4-1.9 1.4-.5.1-1.2.2-3.8-.8-3.1-1.3-5.2-4.5-5.3-4.7-.2-.2-1.3-1.7-1.3-3.3 0-1.6.8-2.3 1.1-2.6.3-.3.7-.4.9-.4.2 0 .5 0 .7.1.2.1.6.1.8.7.3.7.9 2.2.9 2.3.1.2.1.4 0 .6-.1.2-.2.3-.4.5-.2.2-.4.4-.2.8.5.9 1.5 2.1 2.7 2.8.4.3.8.3 1.1 0 .3-.3.8-1 1.1-1.3.3-.3.6-.3.9-.2.3.1 2 .9 2.3 1.1.4.2.6.3.7.5.1.2.1.8-.1 1.5z" fill="#FFFFFF"/>
  </svg>`,

  generic: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="36" rx="9" fill="#6E6E73"/>
    <circle cx="18" cy="18" r="9" stroke="#FFFFFF" stroke-width="2"/>
    <ellipse cx="18" cy="18" rx="4" ry="9" stroke="#FFFFFF" stroke-width="1.8"/>
    <path d="M9 18h18" stroke="#FFFFFF" stroke-width="1.8"/>
  </svg>`,
};

function getSvgDataUri(svgString) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString.replace(/\n/g, '').trim());
}

function getFaviconUrl(target) {
  if (!target) return null;
  try {
    let hostname = target;
    if (target.startsWith('http://') || target.startsWith('https://')) {
      hostname = new URL(target).hostname;
    }
    // sz=64 measured as low as 16x16 actually delivered for some sites (Google
    // returns whatever real favicon exists up to this size, never upscaled) —
    // shown at 36px CSS / 72px on Retina, that's a 4.5x stretch. Asking for 128
    // gets the sharpest source image available; sites whose own favicon truly
    // tops out smaller than that are a source-side limit no sz value fixes.
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
  } catch {
    return null;
  }
}

const fs = require('fs');
const path = require('path');

// Logo.png is kept at 1024x1024 for icon.js's .icns build (macOS wants that
// much for a crisp Dock/Finder icon). This is the same artwork downscaled to
// 128x128 — the app never displays it above ~54px CSS (108px @2x) — because
// base64-embedding the full-res original here meant every renderSetup()/
// renderTabs() IPC call (fired on nearly every state change) was shipping a
// ~1.3MB string just for a fallback icon nobody sees at that size.
const LOGO_PATH = path.join(__dirname, 'Logo-icon.png');
let logoDataUri = null;
try {
  if (fs.existsSync(LOGO_PATH)) {
    logoDataUri = `data:image/png;base64,${fs.readFileSync(LOGO_PATH).toString('base64')}`;
  }
} catch {}

const DATA_URIS = {};
for (const key in SVG_ICONS) {
  DATA_URIS[key] = getSvgDataUri(SVG_ICONS[key]);
}

if (logoDataUri) {
  DATA_URIS.generic = logoDataUri;
  DATA_URIS.logo = logoDataUri;
}

module.exports = {
  SVG_ICONS,
  DATA_URIS,
  getFaviconUrl,
};
