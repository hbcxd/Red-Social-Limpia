// Importamos las librerías de Firebase compatibles para el Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const CACHE_NAME = 'faro-v1.7'; // Subimos la versión
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ⚠️ PEGA AQUÍ TU MISMA CONFIGURACIÓN DE FIREBASE DEL INDEX.HTML
const firebaseConfig = {
  apiKey: "AIzaSyAzb71Y1IHcGhWqRmX5E3-Va5258wrhdk0",
  authDomain: "red-social-de-dios.firebaseapp.com",
  projectId: "red-social-de-dios",
  storageBucket: "red-social-de-dios.firebasestorage.app",
  messagingSenderId: "256126083920",
  appId: "1:256126083920:web:f9265cbac956d1efe38255",
  measurementId: "G-5X7TMJVN71"
};

// Inicializamos Firebase en segundo plano
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Escuchador de notificaciones cuando la app está cerrada
messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Notificación en segundo plano recibida: ', payload);
    
    const tituloNotificacion = payload.notification.title || "Faro Comunidad";
    const opcionesNotificacion = {
        body: payload.notification.body || "Tienes nuevas actualizaciones.",
        icon: './icon-192.png',
        badge: './icon-192.png'
    };

    self.registration.showNotification(tituloNotificacion, opcionesNotificacion);
});

// --- CACHÉ Y PWA ESTÁNDAR ---
self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE)));
    self.skipWaiting();
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

self.addEventListener('message', (e) => {
    if (e.data.action === 'skipWaiting') self.skipWaiting();
});
