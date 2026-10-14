// Service worker for the WAGA BITES info page: makes the app installable AND
// able to open offline. Strategy — network-first with a cached fallback:
//   • Navigations (the HTML shell) fall back to the cached entry page.
//   • Same-origin static shell assets (JS/CSS/icons/manifest) fall back to
//     their cached copies when the network is down.
//   • Live surfaces (/api/, /socket.io/, /uploads/) are never cached — the
//     page opens offline, then behaves as usual once the network returns.
// Network-first (rather than cache-first) keeps online behavior identical to
// a site without a worker — no stale code after deploys, no dev/HMR weirdness.
// Bump the version to make every client drop its old cache on activation.
const CACHE = 'wagabits-info-shell-v2'

// Everything worth keeping is same-origin and NOT live data or uploads.
const isShellUrl = url => url.origin === self.location.origin
  && !url.pathname.startsWith('/api/')
  && !url.pathname.startsWith('/socket.io/')
  && !url.pathname.startsWith('/uploads/')

self.addEventListener('install', event => {
  // Snapshot the entry page at install time so the very first offline visit
  // already has something to show, even before any runtime caching.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    await cache.add(new Request('/', { cache: 'reload' }))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Retire every cache left by earlier worker versions.
    const names = await caches.keys()
    await Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Cross-origin requests (fonts, other ports) and live data pass straight
  // through — the worker adds nothing to them.
  if (!isShellUrl(url)) return

  if (request.mode === 'navigate') {
    // HTML: try the network (stays fresh), fall back to the cached shell.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      try {
        const fresh = await fetch(request)
        if (fresh.ok) await cache.put('/', fresh.clone()) // keyed as '/', matches any navigation
        return fresh
      } catch {
        return (await cache.match('/', { ignoreSearch: true })) || Response.error()
      }
    })())
    return
  }

  // Static shell asset: network first, cached copy when offline. Successful
  // responses quietly prime the cache for the next offline visit.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    try {
      const fresh = await fetch(request)
      if (fresh.ok) cache.put(request, fresh.clone())
      return fresh
    } catch {
      const hit = await cache.match(request, { ignoreVary: true })
      return hit || Response.error()
    }
  })())
})
