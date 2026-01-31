// BSN9B Service Worker
// Version-based cache name for proper cache invalidation
const CACHE_VERSION = 'v4';
const CACHE_NAME = `bsn9b-${CACHE_VERSION}`;

// Resources to cache for offline use
const OFFLINE_URLS = [
    '/home/',
    '/app/',
    '/resources/',
    '/community/',
    '/manifest.json'
];

// URLs to always fetch fresh (stale-while-revalidate pattern)
const STALE_WHILE_REVALIDATE = [
    '/home/index.html',
    '/app/index.html',
    '/resources/index.html',
    '/community/index.html'
];

// Install event - cache core resources
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker version:', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app shell...');
                return cache.addAll(OFFLINE_URLS);
            })
            .then(() => {
                console.log('[SW] Install complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.log('[SW] Install failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker version:', CACHE_VERSION);
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete all caches that don't match current version
                        if (cacheName.startsWith('bsn9b-') && cacheName !== CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Activation complete, claiming clients');
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
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests (Firebase, APIs, etc.)
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // For HTML pages, use stale-while-revalidate
    if (shouldRevalidate(event.request.url) || event.request.mode === 'navigate') {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    // Fetch fresh version in background
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => null);

                    // Return cached version immediately, update in background
                    return cachedResponse || fetchPromise;
                });
            }).catch(() => {
                // Fallback to home page if offline
                return caches.match('/home/');
            })
        );
        return;
    }

    // For other assets, cache-first with network fallback
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
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
                    .catch(() => null);
            })
    );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Received SKIP_WAITING message');
        self.skipWaiting();
    }

    // Support for cache clear request
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        console.log('[SW] Clearing cache...');
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            }).then(() => {
                console.log('[SW] Cache cleared');
            })
        );
    }
});
