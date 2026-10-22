/* Rounds: offline support. Caches the app's own files; it never contacts any other site. */
const CACHE = 'rounds-1.2.3';
const FILES = ['./', 'index.html', 'style.css', 'engine.js', 'native.js', 'hr.js', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'maskable-512.png', 'apple-touch-icon.png', 'fonts/InstrumentSans-latin-variable.woff2', 'fonts/IBMPlexMono-latin-500.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // network first so updates arrive; the cached copy is used when offline
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
