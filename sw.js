// Offline support: serve the app shell from cache, refresh it in the background.
// Bump VERSION when shipping changes so phones pick up the new files.
const VERSION = 'liftlog-v51';
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
  'js/library.js',
  'js/search.js',
  'js/merge.js',
  'js/together.js',
  'js/export.js',
  'js/tips.js',
  'js/howto.js',
  'js/equipment.js',
  'js/rest.js',
  'js/drag.js',
  'js/version.js',
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

// Serve this version's files from its own cache. The cache is only ever
// filled at install, all files together, so old and new files never mix
// (a mix can break the app). A new version arrives as a new service worker.
self.addEventListener('fetch', ev => {
  if (ev.request.method !== 'GET' || new URL(ev.request.url).origin !== location.origin) return;
  ev.respondWith(
    caches.open(VERSION).then(async cache => (await cache.match(ev.request, { ignoreSearch: true })) || fetch(ev.request))
  );
});
