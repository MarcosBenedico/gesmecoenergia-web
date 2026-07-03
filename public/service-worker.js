const CACHE_NAME = 'gesmeco-v1';
const URLS_TO_CACHE = [
  '/mobile',
  '/mobile/consumos',
  '/api/leer-factura',
  '/manifest.json',
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE).catch(() => {
        // Si falla, continuamos igual
      });
    })
  );
  self.skipWaiting();
});

// Activar Service Worker
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
    })
  );
  self.clients.claim();
});

// Estrategia: Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Solo cachear GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cachear respuesta exitosa
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si no hay red, usar cache
        return caches.match(event.request);
      })
  );
});
