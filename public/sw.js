// SQ360 Service Worker — PWA minimal
const CACHE = 'sq360-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  // Pass-through: non-GET, Supabase API, internal API routes, external URLs
  if (
    request.method !== 'GET' ||
    request.url.includes('.supabase.co') ||
    request.url.includes('/api/')
  ) return

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE).then(cache => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})
