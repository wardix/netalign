// src/api.ts
// Detect API base URL for development (proxy) vs production.
export const API_BASE = (() => {
  const hostname = window.location.hostname;
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.includes('agentix.nusa.net.id')
  ) {
    return '';
  }
  // Change to your production backend domain when deploying.
  return 'https://api.netalign.com';
})();
