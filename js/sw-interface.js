// Copie de secours de l'INTERFACE d'une application installable (Administration : admin/sw.js ;
// application des mannequins : app/sw.js) — partagée, pour ne pas recopier le même code.
// Seuls les fichiers de l'interface (écrans, styles, icônes) sont gardés : jamais de données
// nominatives ni de montants (les requêtes vers la base et vers /api ne passent pas par lui).
// version : nom de la copie (« prefixe-vN ») ; page : adresse de la page (« /admin/ ») ;
// fichiers : les fichiers gardés. Réseau d'abord (toujours la dernière version), la copie ne
// sert qu'en cas de coupure.
function copieInterface(version, prefixes, page, fichiers) {
  const racine = page.replace(/\/$/, '');
  // la page (/admin, /admin/, /admin/index.html) est rangée sous « /admin/ » ; les autres
  // fichiers du dossier (manifest.webmanifest…) gardent leur propre nom (avant le 22/10/2026,
  // le manifeste prenait la place de la page : sans réseau, on voyait son texte « comme du code »)
  // Une page « x.html » est rangée sous « x » : en ligne, Vercel (cleanUrls) affiche l'adresse
  // sans « .html » et redirige l'autre ; une réponse redirigée ne peut pas servir de page, d'où
  // la copie « propre » faite à l'installation
  const cleDe = (chemin) => (chemin === racine || chemin === page || chemin === page + 'index.html' ? page : chemin.replace(/\.html$/, ''));
  const cles = fichiers.map(cleDe);
  const propre = (r) => (r.redirected ? new Response(r.body, { status: r.status, statusText: r.statusText, headers: r.headers }) : r);
  self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(version).then((c) => Promise.all(fichiers.map((f) => fetch(f).then((r) => {
      if (!r.ok) throw new Error('copie impossible : ' + f);
      return c.put(cleDe(f), propre(r));
    })))).then(() => self.skipWaiting()));
  });
  self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => prefixes.some((p) => k.startsWith(p)) && k !== version).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
  });
  self.addEventListener('fetch', (e) => {
    const u = new URL(e.request.url);
    if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
    const cle = cleDe(u.pathname);
    if (!cles.includes(cle)) return;
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok) { const copie = propre(r.clone()); caches.open(version).then((c) => c.put(cle, copie)).catch(() => { /* mémoire du navigateur pleine : la page reste servie */ }); }
      return r;
    }).catch(() => caches.match(cle)));
  });
}
