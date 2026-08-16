const CACHE_NAME = 'baczone-v19';
const CORE_ASSETS = [
  '/BacZone/index.html',
  '/BacZone/matieres.html',
  '/BacZone/contact.html',
  '/BacZone/favoris.html',
  '/BacZone/pomodoro.html',
  '/BacZone/style.css',
  '/BacZone/app.js',
  '/BacZone/pomodoro.js',
  '/BacZone/manifest.json',
  '/BacZone/icons/icon-192.png',
  '/BacZone/icons/icon-512.png',
  '/BacZone/pages/mathematiques.html',
  '/BacZone/pages/physique.html',
  '/BacZone/pages/genie-electrique.html',
  '/BacZone/pages/mecanique.html',
  '/BacZone/pages/arabe.html',
  '/BacZone/pages/francais.html',
  '/BacZone/pages/anglais.html',
  '/BacZone/pages/philosophie.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// الشبكة أولا: كل مرة فما نات، ناخذ آخر نسخة مباشرة من GitHub.
// الكاش يخدم غير كحل احتياطي كي ما فماش نات خالص (Offline).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
