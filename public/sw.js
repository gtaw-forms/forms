const CACHE_NAME = 'phmc-map-tiles-v1';
const CONFIG_CACHE = 'phmc-config-v1';
const CONFIG_KEY = 'firebaseConfig';
const TILE_URL_PATTERN = /assets\/map-tiles\/.*\.jpg/;

let databaseURL = '';

async function loadConfig() {
    try {
        const cache = await caches.open(CONFIG_CACHE);
        const response = await cache.match(CONFIG_KEY);
        if (response) {
            const config = await response.json();
            databaseURL = config.databaseURL || '';
        }
    } catch (err) {
        console.error('[SW] Failed to load config:', err);
    }
}

async function saveConfig(config) {
    try {
        const cache = await caches.open(CONFIG_CACHE);
        const response = new Response(JSON.stringify(config), {
            headers: { 'Content-Type': 'application/json' }
        });
        await cache.put(CONFIG_KEY, response);
    } catch (err) {
        console.error('[SW] Failed to save config:', err);
    }
}

async function checkKillSwitch() {
    if (!databaseURL) return null;
    try {
        const url = `${databaseURL}/appMetadata/globalKillSwitch.json`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) return null;
        return await response.json();
    } catch (err) {
        return null;
    }
}

self.addEventListener('install', (event) => {
    console.log('[SW] v1.2: Install event');
    event.waitUntil(loadConfig());
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] v1.2: Activate event - claiming clients');
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SET_FIREBASE_CONFIG') {
        databaseURL = event.data.databaseURL;
        saveConfig({ databaseURL });
    }
});

async function handleKillSwitch() {
    const timestamp = await checkKillSwitch();
    if (!timestamp) return;

    const now = Date.now();
    if (now - timestamp > 60000) return;

    console.warn('[SW] GLOBAL KILL-SWITCH DETECTED! Purging caches and notifying clients...');

    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map(key => caches.delete(key)));

    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
        client.postMessage({ type: 'KILL_SWITCH_ACTIVE' });
    }
}

self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    if (TILE_URL_PATTERN.test(url)) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then((networkResponse) => {
                    if (!networkResponse || networkResponse.status !== 200) return networkResponse;
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                    return networkResponse;
                });
            })
        );
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                if (databaseURL) {
                    handleKillSwitch();
                }
                return fetch(event.request);
            })()
        );
    }
});
