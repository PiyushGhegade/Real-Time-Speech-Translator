// Service Worker for Real-Time Speech Translator
const CACHE_NAME = 'speech-translator-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Failed to cache static assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker activated successfully');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Handle API requests
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleApiRequest(request));
        return;
    }

    // Handle static assets
    if (request.method === 'GET') {
        event.respondWith(handleStaticRequest(request));
        return;
    }

    // For other requests, use network first
    event.respondWith(fetch(request));
});

async function handleApiRequest(request) {
    try {
        // Try network first for API requests
        const response = await fetch(request);

        // Cache successful API responses
        if (response.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        console.log('API request failed, checking cache:', error);

        // Fallback to cache if available
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Return offline response
        return new Response(
            JSON.stringify({ error: 'Offline - API not available' }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

async function handleStaticRequest(request) {
    try {
        // Check cache first for static assets
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // If not in cache, fetch from network
        const response = await fetch(request);

        // Cache the response for future use
        if (response.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        console.log('Static request failed:', error);

        // Return offline page for HTML requests
        if (request.destination === 'document') {
            return caches.match('/index.html');
        }

        // Return offline response for other static assets
        return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Background sync for offline transcript data
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync-transcript') {
        console.log('Background sync triggered for transcript');
        event.waitUntil(syncTranscriptData());
    }
});

async function syncTranscriptData() {
    try {
        // Get stored transcript data from IndexedDB
        const transcriptData = await getStoredTranscriptData();

        if (transcriptData && transcriptData.length > 0) {
            // Sync with server when back online
            for (const data of transcriptData) {
                try {
                    await fetch('/api/sync-transcript', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });

                    // Remove synced data from storage
                    await removeStoredTranscriptData(data.id);
                } catch (error) {
                    console.error('Failed to sync transcript data:', error);
                }
            }
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

// Push notification handling
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'New translation available',
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.url || '/',
                timestamp: Date.now()
            }
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'Speech Translator', options)
        );
    }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then(clientList => {
                // Focus existing window if available
                for (const client of clientList) {
                    if (client.url === event.notification.data.url && 'focus' in client) {
                        return client.focus();
                    }
                }

                // Open new window if none exists
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url);
                }
            })
    );
});

// Helper functions for IndexedDB operations
async function getStoredTranscriptData() {
    // This would implement IndexedDB operations
    // For now, return empty array
    return [];
}

async function removeStoredTranscriptData(id) {
    // This would implement IndexedDB operations
    // For now, just log
    console.log('Removing stored transcript data:', id);
}

// Message handling from main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

console.log('Service Worker loaded successfully');
