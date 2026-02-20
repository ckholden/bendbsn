// BSN9B Service Worker
// Version-based cache name for proper cache invalidation
const CACHE_VERSION = 'v39';
const CACHE_NAME = `bsn9b-${CACHE_VERSION}`;

// Development mode - set to true to bypass all caching
const DEV_MODE = false;

// Resources to cache for offline use
const OFFLINE_URLS = [
    '/home/',
    '/app/',
    '/resources/',
    '/community/',
    '/clinical/',
    '/shared/header.css',
    '/shared/header.js',
    '/manifest.json'
];

// URLs to always fetch fresh (stale-while-revalidate pattern)
const STALE_WHILE_REVALIDATE = [
    '/index.html',
    '/home/index.html',
    '/app/index.html',
    '/resources/index.html',
    '/community/index.html',
    '/admin/index.html',
    '/chat/index.html',
    '/ai/index.html',
    '/clinical/index.html'
];

// Install event - cache core resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(OFFLINE_URLS))
            .then(() => self.skipWaiting())
            .catch(() => { /* Install failed */ })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log(`🔄 Service Worker v${CACHE_VERSION} activating`);
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete all caches that don't match current version
                        if (cacheName.startsWith('bsn9b-') && cacheName !== CACHE_NAME) {
                            console.log(`🗑️ Deleting old cache: ${cacheName}`);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log(`✅ Service Worker v${CACHE_VERSION} activated`);
                return self.clients.claim();
            })
    );
});

// Check if URL should use stale-while-revalidate
function shouldRevalidate(url) {
    return STALE_WHILE_REVALIDATE.some(pattern => url.includes(pattern));
}

// Fetch event - improved caching strategy
self.addEventListener('fetch', (event) => {
    // Skip caching in dev mode - always fetch from network
    if (DEV_MODE) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests (Firebase, APIs, etc.)
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Detect hard refresh (cache: 'reload' in request)
    const isHardRefresh = event.request.cache === 'reload';

    // Always fetch admin fresh to avoid stale cached UI
    if (event.request.url.includes('/admin/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // For HTML pages, use NETWORK-FIRST strategy (ensures fresh content when online)
    if (shouldRevalidate(event.request.url) || event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    // Cache successful responses for offline fallback
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Offline fallback - return cached version
                    return caches.match(event.request).then(cachedResponse => {
                        return cachedResponse || caches.match('/home/');
                    });
                })
        );
        return;
    }

    // For other assets, cache-first with network fallback
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse && !isHardRefresh) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then((response) => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => cachedResponse || null);
            })
    );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('⏭️ Skipping waiting - activating new service worker');
        self.skipWaiting();
    }

    // Support for cache clear request
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        console.log('🗑️ Clearing all caches');
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        console.log(`🗑️ Deleting cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    })
                );
            }).then(() => {
                console.log('✅ All caches cleared');
                // Notify all clients that cache was cleared
                return self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({type: 'CACHE_CLEARED'});
                    });
                });
            })
        );
    }
});
