// sw.js
const CACHE_NAME = 'toeic-ai-tutor-v2';

// On install, activate immediately.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// On activate, clean up old caches and take control of the page.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// On fetch, use a "stale-while-revalidate" strategy.
self.addEventListener('fetch', (event) => {
  // We only want to handle GET requests. Let API calls and other requests pass through.
  if (event.request.method !== 'GET' || event.request.url.includes('googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        // Fetch from the network in the background to update the cache.
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // If we get a valid response, cache it.
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });

        // Return the cached response immediately if it's available,
        // otherwise, wait for the network response. This ensures a fast, offline-first experience.
        return cachedResponse || fetchPromise;
      });
    })
  );
});