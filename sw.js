const CACHE_NAME = 'faro-v1'; // Incrementa esto (v2, v3...) para forzar actualizaciones

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(['/'])));
});

self.addEventListener('fetch', (e) => {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
