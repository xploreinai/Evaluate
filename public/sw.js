// E-valuate service worker
//
// Deliberately does NOT cache anything.
//
// A service worker with a fetch handler is what makes the app installable to a
// home screen. It is tempting to also cache assets here for offline use, but
// this app cannot work offline anyway — transcription and question generation
// both need the network — and a caching worker would serve stale JavaScript
// after a deploy, which is far more painful than a missing offline mode.
//
// Every request goes straight to the network, so an install always runs the
// current build.

const VERSION = 'v1'

self.addEventListener('install', () => {
  // Replace any previous worker immediately rather than waiting for all tabs
  // to close.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clear anything an earlier version of this worker may have cached.
      const names = await caches.keys()
      await Promise.all(names.map((n) => caches.delete(n)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  // Pass through untouched. Present so the app qualifies as installable.
  event.respondWith(fetch(event.request))
})
