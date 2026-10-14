// Service worker that makes the business info page installable as a PWA.
// Deliberately a passthrough — no caching — so updated business details,
// dashboard links and hot reload behave exactly like before; its only job is
// to satisfy the install criteria (a fetch handler under the manifest scope).
const VERSION = 'wagabits-pwa-shell-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim())
})

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request))
})
