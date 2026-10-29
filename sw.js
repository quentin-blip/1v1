const V = 'party-games-v12';
const F = ['./', 'index.html', 'style.css', 'icons.js', 'rules.js', 'config.js', 'app.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.all(F.map(f => c.add(f).catch(() => {}))))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => clients.claim())
));
// Réseau d'abord (mises à jour immédiates), cache en secours (hors ligne)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(V).then(ch => ch.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
