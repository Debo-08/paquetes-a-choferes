// sw.js
// Caché estático sencillo para funcionamiento offline básico de la PWA.

const CACHE = 'pac-choferes-v5';// cambio el numero de v para invalidar cache viejo
const ASSETS = [
  '/', '/index.html', '/styles.css', '/app.js', '/db.js', '/manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting(); // toma control mas rapido
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(()=> self.clients.claim())// toma control de pestañas abiertas
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  // Network-first para HTML, cache-first para estáticos.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
  } else {
    e.respondWith(
      caches.match(request).then(res => res || fetch(request).then(resp => {
        // Opcional: cache dinámico
        return resp;
      }))
    );
  }
});