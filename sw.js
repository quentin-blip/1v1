const V = 'party-games-v7'; // à incrémenter si tu changes la liste des fichiers ci-dessous
const FILES = ['./', 'index.html', 'style.css', 'icons.js', 'config.js', 'app.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  // addAll échoue franchement si un fichier manque : mieux qu'un cache incomplet qui casse le hors-ligne en silence
  e.waitUntil(caches.open(V).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k)))).then(() => clients.claim())
));

// Réponse immédiate depuis le cache + mise à jour en arrière-plan : tes nouveaux fichiers arrivent à l'ouverture suivante.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return; // Supabase passe toujours par le réseau
  e.respondWith((async () => {
    const cache = await caches.open(V);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  })());
});
