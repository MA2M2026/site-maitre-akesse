// Service worker UNIQUE du site (scope « / »). Deux rôles :
// 1) rendre le site installable sur l'écran d'accueil (exigence de
//    Chrome/Android) — rien n'est mis en cache, le site reste toujours à jour ;
// 2) recevoir et afficher les notifications push de l'espace admin (Grand 3) et, depuis le
//    26/10/2026, celles de l'application des mannequins (app/sw.js le charge aussi).
// Il ne doit exister qu'UN service worker pour « / » : avant le 04/10/2026, un
// second (sw-notifications.js) prenait la même place et les deux se
// remplaçaient à chaque visite — les notifications arrivaient alors sur
// celui qui ne savait pas les afficher et disparaissaient sans rien montrer.
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  let donnees = {};
  try {
    donnees = event.data ? event.data.json() : {};
  } catch (e) {
    donnees = { titre: 'Maître Akesse', texte: event.data ? event.data.text() : '' };
  }

  const titre = donnees.titre || 'Maître Akesse Model Management';
  const options = {
    body: donnees.texte || '',
    // (icône de l'application concernée : Administration ou MA2M Mannequin)
    icon: /^\/icons\/[a-z0-9-]+\.png$/.test(donnees.icone || '') ? donnees.icone : '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: donnees.tag || undefined,
    renotify: !!donnees.tag,
    data: { url: donnees.url || '/admin/' },
    requireInteraction: true
  };

  event.waitUntil(self.registration.showNotification(titre, options));
});

// N-12 : au clic, ouvrir directement la fiche concernée dans l'Administration (ou la ramener
// au premier plan si un onglet de l'Administration est déjà ouvert ; 23/10/2026 : l'ancien
// tableau de bord est démoli).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin/';
  // (application des mannequins : sa fenêtre, sinon celle de l'Administration)
  const dossier = url.indexOf('/app/') === 0 ? '/app/' : '/admin/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((listeClients) => {
      for (const client of listeClients) {
        if (client.url.includes(dossier) && 'focus' in client) {
          // (l'onglet de l'Administration dépend de son propre service de fond, /admin/sw.js : il ne
          // peut pas être conduit d'ici ; on lui demande d'ouvrir la fiche — js/admin/notifications.js ;
          // application des mannequins : js/mannequin-app.js)
          client.postMessage({ ma2mOuvrir: url });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
