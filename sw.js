// sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const CACHE_NAME = 'faro-v2.9'; 
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './versiculos.js',
  './debug.js'
];

const firebaseConfig = {
  apiKey: "AIzaSyAzb71Y1IHcGhWqRmX5E3-Va5258wrhdk0",
  authDomain: "red-social-de-dios.firebaseapp.com",
  projectId: "red-social-de-dios",
  storageBucket: "red-social-de-dios.firebasestorage.app",
  messagingSenderId: "256126083920",
  appId: "1:256126083920:web:f9265cbac956d1efe38255",
  measurementId: "G-5X7TMJVN71"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Escuchar notificaciones cuando la app está en segundo plano o cerrada
messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Notificación recibida en background.', payload);
    const tituloNotificacion = payload.notification.title || "Faro";
    const opcionesNotificacion = {
        body: payload.notification.body || "Tienes una nueva notificación en la comunidad.",
        icon: './icon-192.png', // Asegúrate de tener este icono en tu carpeta
        badge: './icon-192.png'
    };
    self.registration.showNotification(tituloNotificacion, opcionesNotificacion);
});

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE)));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) return caches.delete(cache);
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebase')) return;
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
