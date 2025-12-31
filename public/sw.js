const CACHE_NAME = 'phmc-map-tiles-v1';
// Removed the '$' at the end to allow for query parameters (like ?v=123 from Vite)
const TILE_URL_PATTERN = /assets\/map-tiles\/.*\.jpg/;

console.log('[SW] Service Worker version 1.1 loaded.');

self.addEventListener('install', (event) => {
    console.log('[SW] Install event: Skipping wait...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activate event: Claiming clients...');
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // Log EVERY fetch request to see if the SW is even awake
    // (You can remove this after we confirm it works)
    if (url.includes('map-tiles')) {
        console.log(`[SW] Fetching map tile: ${url}`);
    }

    if (TILE_URL_PATTERN.test(url)) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    console.log(`[SW] Cache HIT: ${url}`);
                    return cachedResponse;
                }

                console.log(`[SW] Cache MISS: ${url}`);
                return fetch(event.request).then((networkResponse) => {
                    if (!networkResponse || networkResponse.status !== 200) {
                        return networkResponse;
                    }

                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                });
            })
        );
    }
});