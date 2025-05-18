// Service Worker for offline support
const CACHE_VERSION = 'dashboard-v1';
const CACHE_NAME = `${CACHE_VERSION}-${new Date().toISOString().split('T')[0]}`;

const CACHED_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
];

// Install event - cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(CACHED_ASSETS);
            })
            .then(() => {
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cacheName => {
                        return cacheName.startsWith(CACHE_VERSION) && cacheName !== CACHE_NAME;
                    })
                    .map(cacheName => {
                        return caches.delete(cacheName);
                    })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
    // Skip non-GET requests and browser extensions
    if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
        return;
    }
    
    // Handle Google Sheets CSV request specially
    if (event.request.url.includes('docs.google.com/spreadsheets') || 
        event.request.url.includes('sheets.googleapis.com')) {
        
        // Network first, then cache for API calls
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache a copy of the response
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // If network fails, try the cache
                    return caches.match(event.request);
                })
        );
    } else {
        // Cache first, then network for static assets
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    return fetch(event.request)
                        .then(response => {
                            // Cache the new request for next time
                            if (response.ok) {
                                const responseClone = response.clone();
                                caches.open(CACHE_NAME).then(cache => {
                                    cache.put(event.request, responseClone);
                                });
                            }
                            return response;
                        });
                })
        );
    }
});

// Handle messages from the client
self.addEventListener('message', event => {
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});
