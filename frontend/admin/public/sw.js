// Service worker that makes the dashboard installable as a PWA. It is
// deliberately a passthrough — no caching — so live data, socket traffic and
// hot reload behave exactly like before; its only job is to satisfy the
// install criteria (a fetch handler under the manifest scope). A future
// offline-capable cache can build on this shell without breaking it.
const VERSION = 'wagabits-pwa-shell-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim())
})

self.addEventListener('fetch', event => {
  // Cross-origin requests (API on another port, uploads, fonts) pass through
  // untouched; same-origin navigation/file requests stream straight to the
  // network as well — the worker itself never keeps copies.
  event.respondWith(fetch(event.request))
})
