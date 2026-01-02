// QuickBill Service Worker - Optimized Version
// Version: 2.1.0
// Supports both root (/) and subdirectory (/QuickBill/) deployment

const CACHE_NAME = 'quickbill-pwa-v2';

// Auto-detect base path from service worker location
const getBasePath = () => {
    const swPath = self.location.pathname;
    const basePath = swPath.substring(0, swPath.lastIndexOf('/') + 1);
    return basePath || '/';
};

const BASE_PATH = getBasePath();

// Essential local files to cache
const localAssets = [
    `${BASE_PATH}`,
    `${BASE_PATH}index.html`,
    `${BASE_PATH}manifest.json`,
    `${BASE_PATH}icons/icon-192x192.png`,
    `${BASE_PATH}icons/icon-512x512.png`
];

// CDN resources - cached at runtime to avoid CORS issues
const cdnResources = [
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Install event - cache local assets only
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing with base path:', BASE_PATH);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching local assets');
                return cache.addAll(localAssets);
            })
            .catch(error => {
                console.error('Service Worker: Install failed:', error);
                // Don't fail install if some assets missing
                return Promise.resolve();
            })
    );
    self.skipWaiting();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    const requestUrl = event.request.url;
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip Firebase/external auth requests
    if (requestUrl.includes('firebaseapp.com') || 
        requestUrl.includes('googleapis.com/identitytoolkit') ||
        requestUrl.includes('securetoken.googleapis.com')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Valid response - clone and cache it
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Network failed - try cache
                return caches.match(event.request)
                    .then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // No cache - return offline page or error
                        console.log('Service Worker: Resource not in cache:', requestUrl);
                        throw new Error('Offline and resource not cached');
                    });
            })
    );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});
