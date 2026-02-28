/**
 * Service Worker for Helmick Underground LLC
 * Provides offline support, caching, and performance optimization
 */

const CACHE_VERSION = 'v1.3.0';
const CACHE_NAME = `helmick-underground-${CACHE_VERSION}`;
const API_CACHE_NAME = `helmick-api-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `helmick-images-${CACHE_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/about.html',
    '/contact.html',
    '/gallery.html',
    '/services.html',
    '/styles.css',
    '/script.js',
    '/logo.png',
    '/manifest.json',
    '/offline.html',
    '/mobile-enhancements.js',
    '/ios-install.js',
    '/pwa-install.js'
];

// Cache strategies
const CACHE_STRATEGIES = {
    CACHE_FIRST: 'cache-first',
    NETWORK_FIRST: 'network-first',
    STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
    NETWORK_ONLY: 'network-only'
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching static assets');
            return cache.addAll(STATIC_ASSETS).catch((error) => {
                console.error('[Service Worker] Failed to cache:', error);
                // Don't fail the entire install if some assets fail
                return Promise.resolve();
            });
        }).then(() => {
            console.log('[Service Worker] Installed successfully');
            return self.skipWaiting(); // Activate immediately
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete old caches
                    if (cacheName !== CACHE_NAME && 
                        cacheName !== API_CACHE_NAME && 
                        cacheName !== IMAGE_CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Activated');
            return self.clients.claim(); // Take control immediately
        })
    );
});

// Fetch event - handle requests with appropriate strategy
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Skip non-GET requests (POST, PUT, DELETE, etc.) - they can't be cached
    if (request.method !== 'GET') {
        return;
    }

    // Determine cache strategy based on request type
    let strategy;
    
    if (url.pathname.startsWith('/api/')) {
        // API requests: Network first, fallback to cache
        strategy = CACHE_STRATEGIES.NETWORK_FIRST;
    } else if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
        // Images: Cache first with network fallback
        strategy = CACHE_STRATEGIES.CACHE_FIRST;
    } else if (url.pathname.match(/\.(css|js)$/i)) {
        // CSS/JS: Stale while revalidate
        strategy = CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
    } else if (url.pathname.startsWith('/admin/')) {
        // Admin pages: Network only (require auth)
        strategy = CACHE_STRATEGIES.NETWORK_ONLY;
    } else {
        // HTML pages: Network first, fallback to cache
        strategy = CACHE_STRATEGIES.NETWORK_FIRST;
    }

    event.respondWith(handleRequest(request, strategy));
});

/**
 * Handle request with specified cache strategy
 */
async function handleRequest(request, strategy) {
    const url = new URL(request.url);
    
    switch (strategy) {
        case CACHE_STRATEGIES.CACHE_FIRST:
            return cacheFirst(request);
        
        case CACHE_STRATEGIES.NETWORK_FIRST:
            return networkFirst(request);
        
        case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
            return staleWhileRevalidate(request);
        
        case CACHE_STRATEGIES.NETWORK_ONLY:
        default:
            return fetch(request);
    }
}

/**
 * Cache First: Try cache, fallback to network
 */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            // Cache images separately
            const cache = await caches.open(
                request.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) 
                    ? IMAGE_CACHE_NAME 
                    : CACHE_NAME
            );
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.error('[Service Worker] Fetch failed:', error);
        return new Response('Network error', { status: 503 });
    }
}

/**
 * Network First: Try network, fallback to cache
 */
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        
        if (response.ok) {
            // Clone response before caching to avoid "body already used" error
            const responseClone = response.clone();
            // Cache successful responses
            const cacheName = request.url.includes('/api/') 
                ? API_CACHE_NAME 
                : CACHE_NAME;
            const cache = await caches.open(cacheName);
            cache.put(request, responseClone);
        }
        
        return response;
    } catch (error) {
        console.log('[Service Worker] Network failed, trying cache:', request.url);
        const cached = await caches.match(request);
        
        if (cached) {
            return cached;
        }
        
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            const offlinePage = await caches.match('/offline.html');
            return offlinePage || new Response('Offline', { status: 503 });
        }
        
        return new Response('Network error', { status: 503 });
    }
}

/**
 * Stale While Revalidate: Serve from cache, update in background
 */
async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);
    
    // Fetch in background to update cache
    const fetchPromise = fetch(request).then(async (response) => {
        if (response.ok) {
            // Clone before using to avoid "body already used" error
            const responseClone = response.clone();
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, responseClone);
        }
        return response;
    }).catch(() => cached); // Fallback to cache on error
    
    // Return cached version immediately if available
    return cached || fetchPromise;
}

/**
 * Background sync for offline actions
 */
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync:', event.tag);
    
    if (event.tag === 'sync-offline-actions') {
        event.waitUntil(syncOfflineActions());
    }
});

/**
 * Sync offline actions when connection is restored
 */
async function syncOfflineActions() {
    try {
        // Get offline actions from IndexedDB or localStorage
        const actions = await getOfflineActions();
        
        for (const action of actions) {
            try {
                await fetch(action.url, action.options);
                await removeOfflineAction(action.id);
            } catch (error) {
                console.error('[Service Worker] Failed to sync action:', error);
            }
        }
    } catch (error) {
        console.error('[Service Worker] Sync failed:', error);
    }
}

/**
 * Get offline actions from storage
 */
async function getOfflineActions() {
    // Placeholder - would integrate with IndexedDB
    return [];
}

/**
 * Remove synced action from storage
 */
async function removeOfflineAction(id) {
    // Placeholder - would integrate with IndexedDB
}

/**
 * Handle push notifications
 */
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    
    const options = {
        body: data.body || 'New notification',
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: [200, 100, 200],
        data: data
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Helmick Underground', options)
    );
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow(event.notification.data.url || '/')
    );
});

/**
 * Message handler for communication with pages
 */
self.addEventListener('message', (event) => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            })
        );
    }
    
    if (event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_VERSION });
    }
});

console.log('[Service Worker] Script loaded');
