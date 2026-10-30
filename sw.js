// Offline support: serve the app shell from cache, refresh it in the background.
// Bump VERSION when shipping changes so phones pick up the new files.
const VERSION = 'liftlog-v14';
const FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/data.js',
  'js/store.js',
  'js/engine.js',
  'js/charts.js',
  'js/fx.js',
  'js/plates.js',
  'js/bodymap.js',
  'js/insights.js',
  'js/builder.js',
  'js/photos.js',
  'js/share.js',
  'js/healthimport.js',
  'js/units.js',
  'js/planner.js',
  'js/plancontrol.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', ev => {
  // cache: 'reload' skips the browser's HTTP cache, so a new version never
  // mixes fresh files with stale ones (GitHub Pages lets browsers cache 10 min).
  ev.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  if (ev.request.method !== 'GET' || new URL(ev.request.url).origin !== location.origin) return;
  ev.respondWith(
    caches.open(VERSION).then(async cache => {
      const cached = await cache.match(ev.request, { ignoreSearch: true });
      const fresh = fetch(ev.request, { cache: 'no-cache' })
        .then(res => { if (res.ok) cache.put(ev.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
