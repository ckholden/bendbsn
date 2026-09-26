// BendBSN Service Worker
// Version-based cache name for proper cache invalidation
const CACHE_VERSION = 'v223';
const CACHE_NAME = `bendbsn-${CACHE_VERSION}`;

// Development mode - set to true to bypass all caching
const DEV_MODE = false;

// Resources to cache for offline use
const OFFLINE_URLS = [
    '/offline/',
    '/home/',
    '/app/',
    '/resources/',
    '/clinical/',
    '/clinical/cap-modules.js',
    '/clinical/cap-renderers.js',
    '/clinical/cap-pdf.js',
    '/clinical/packet/',
    '/clinical/standalone/',
    '/apa/',
    '/sbar/',
    '/careplan/',
    '/rotationlog/',
    '/profile/',
    '/emr/',
    '/emr/seed-data.js',
    '/emr/scenarios.js',
    '/shared/toast.css',
    '/shared/toast.js',
    '/shared/header.css',
    '/shared/clinical-ui.css',
    '/shared/clinical-components.css',
    '/shared/app-shell.css',
    '/shared/header.js',
    '/shared/rich-textarea.css',
    '/shared/rich-textarea.js',
    '/shared/smart-phrases.js',
    '/shared/affirmations.js',
    '/manifest.json',
    '/logo.svg',
    '/logo-dark.svg',
    '/logo-mark.svg',
    '/favicon.ico',
    '/favicon-32x32.png',
    '/favicon-16x16.png',
    '/apple-touch-icon.png',
    '/android-chrome-192x192.png'
];

// Network-first strategy: fetch from network, fall back to cache on failure.
// Named STALE_WHILE_REVALIDATE historically but behaves as network-first.
const STALE_WHILE_REVALIDATE = [
    '/index.html',
    '/home/index.html',
    '/app/index.html',
    '/resources/index.html',
    '/clinical/index.html',
    '/clinical/packet/index.html',
    '/clinical/cap-',             // cap-modules/renderers/pdf.js must stay in step with the packet HTML
    '/apa/index.html',
    '/sbar/index.html',
    '/careplan/index.html',
    '/rotationlog/index.html',
    '/profile/index.html',
    '/emr/index.html'
];

// Must be cached or the install fails. A failed install keeps the previous
// worker and its cache, and the browser retries on the next update check,
// instead of activating a worker whose cache has no offline fallback.
const CRITICAL_URLS = ['/offline/'];

// Fetch one precache URL and store it under its own key.
// - cache: 'reload' skips the browser HTTP cache, so a new cache version never
//   captures the previous deploy's JS/CSS (served cache-first until the next bump).
// - A followed redirect (Firebase Hosting 301s /x/ <-> /x) is re-wrapped as a
//   plain response: a redirected response served to a navigation is rejected
//   by the browser as a network error, which broke offline pages.
function precache(cache, url) {
    return fetch(new Request(url, { cache: 'reload' })).then((res) => {
        if (!res.ok) throw new Error('[SW] Precache ' + url + ' -> ' + res.status);
        if (!res.redirected) return cache.put(url, res);
        return res.blob().then((body) => cache.put(url, new Response(body, {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers
        })));
    });
}

// Install event - cache core resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => Promise.all(CRITICAL_URLS.map((url) => precache(cache, url))).then(() => Promise.all(
                // Everything else is best-effort: one 404 or flaky fetch skips
                // that file rather than leaving the whole new cache empty.
                OFFLINE_URLS.filter((url) => !CRITICAL_URLS.includes(url)).map((url) =>
                    precache(cache, url).catch((err) => console.warn('[SW] Precache skipped:', url, err))
                )
            )))
            .then(() => self.skipWaiting())
            .catch((err) => {
                console.error('[SW] Install cache failed:', err);
                throw err;
            })
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
                        if (cacheName.startsWith('bendbsn-') && cacheName !== CACHE_NAME) {
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

// Last-resort offline page when even '/offline/' is not in the cache, so
// respondWith() never resolves to undefined (a browser network error).
function offlineResponse() {
    return new Response(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Offline</title><p style="font-family:system-ui,sans-serif;padding:24px">' +
        'You\'re offline. Reconnect and reload the page.</p>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
}

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
        // Never cached; offline navigations still get the offline card.
        event.respondWith(fetch(event.request).catch(() =>
            event.request.mode === 'navigate'
                ? caches.match('/offline/').then((r) => r || offlineResponse())
                : Response.error()
        ));
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
                        return cachedResponse || caches.match('/offline/');
                    }).then(r => r || offlineResponse());
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
            }).then(() => caches.open(CACHE_NAME).then((c) => c.add('/offline/')).catch(() => {}))
            .then(() => {
                console.log('✅ All caches cleared (offline page re-cached)');
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
