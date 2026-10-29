const V = 'party-games-v6';
const F = ['./', 'index.html', 'style.css', 'icons.js', 'config.js', 'app.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.all(F.map(f => c.add(f).catch(() => {}))))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => clients.claim())
));
self.addEventListener('fetch', e => {
  if (new URL(e.request.url).origin !== location.origin) return; // Supabase passe toujours par le réseau
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
