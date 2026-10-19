// Service worker du portail d'administration (cahier v2.3, sections 3.1 et 17.7) : limité au
// dossier /admin/, il ne touche ni le cache ni le fonctionnement du site public. Il ne garde
// que les fichiers de l'INTERFACE (écrans, styles, icônes) : jamais de données nominatives ni
// de montants (les requêtes vers la base et vers /api ne passent pas par lui).
const VERSION = 'portail-v5';
const INTERFACE = ['/admin/', '/css/jetons.css', '/css/portail.css', '/js/supabase-config.js',
  '/js/vendor/supabase-js-2.110.6.js', '/js/portail/noyau.js', '/js/portail/espace-site.js',
  '/js/portail/espace-paiements.js', '/js/portail/espace-compta.js', '/js/portail/securite.js', '/css/bouton-ma2m.css', '/js/bouton-appui.js', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(INTERFACE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k.startsWith('portail-') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Réseau d'abord (toujours la dernière version) ; la copie ne sert qu'en cas de coupure
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  const cle = u.pathname.startsWith('/admin') ? '/admin/' : u.pathname;
  if (!INTERFACE.includes(cle)) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copie = r.clone(); caches.open(VERSION).then((c) => c.put(cle, copie)); }
    return r;
  }).catch(() => caches.match(cle)));
});
