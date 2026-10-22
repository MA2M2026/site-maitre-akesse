// Service worker de l'Administration (cahier v2.3, sections 3.1 et 17.7 ; v2.4 : adresse séparée
// admin.maitreakessemodelmanagement.com) : limité au dossier /admin/, il ne touche pas le site public. Il ne garde
// que les fichiers de l'INTERFACE (écrans, styles, icônes) : jamais de données nominatives ni
// de montants (les requêtes vers la base et vers /api ne passent pas par lui).
// v8 (22/10/2026) : nouvelle copie, l'ancienne pouvait contenir le manifeste à la place de la page.
const VERSION = 'administration-v9';
const INTERFACE = ['/admin/', '/css/jetons.css', '/css/portail.css', '/js/supabase-config.js',
  '/js/vendor/supabase-js-2.110.6.js', '/js/portail/inactivite.js', '/js/messages-mensualites.js', '/js/portail/noyau.js', '/js/portail/espace-site.js', '/js/portail/espace-paiements.js', '/js/portail/espace-paiements-suivi.js',
  '/js/conversion-heic.js', '/js/portail/espace-compta.js', '/js/portail/espace-compta-suivi.js', '/js/portail/compta-pdf.js', '/js/portail/compta-xlsx.js',
  '/js/portail/espace-compta-cachets.js', '/js/portail/espace-compta-documents.js', '/js/portail/espace-compta-dossier.js', '/js/vendor/pdf-lib-1.17.1.min.js',
  '/js/portail/securite.js', '/css/bouton-ma2m.css', '/js/bouton-appui.js', '/icons/admin-192.png', '/assets/logo-header.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(INTERFACE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => (k.startsWith('portail-') || k.startsWith('administration-')) && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Réseau d'abord (toujours la dernière version) ; la copie ne sert qu'en cas de coupure
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  // La page de l'Administration (/admin, /admin/, /admin/index.html) est rangée sous « /admin/ » ;
  // les autres fichiers du dossier (manifest.webmanifest…) gardent leur propre nom. Avant le
  // 22/10/2026, TOUT ce qui commençait par /admin prenait la place de la page : sans réseau,
  // l'Administration affichait le texte du manifeste « comme du code ».
  const cle = /^\/admin(\/(index\.html)?)?$/.test(u.pathname) ? '/admin/' : u.pathname;
  if (!INTERFACE.includes(cle)) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copie = r.clone(); caches.open(VERSION).then((c) => c.put(cle, copie)).catch(() => { /* mémoire du navigateur pleine : la page reste servie */ }); }
    return r;
  }).catch(() => caches.match(cle)));
});
