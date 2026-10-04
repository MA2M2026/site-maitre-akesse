// Service worker UNIQUE du site (scope « / »). Deux rôles :
// 1) rendre le site installable sur l'écran d'accueil (exigence de
//    Chrome/Android) — rien n'est mis en cache, le site reste toujours à jour ;
// 2) recevoir et afficher les notifications push de l'espace admin (Grand 3).
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
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: donnees.tag || undefined,
    renotify: !!donnees.tag,
    data: { url: donnees.url || '/tableau-de-bord.html' },
    requireInteraction: true
  };

  event.waitUntil(self.registration.showNotification(titre, options));
});

// N-12 : au clic, ouvrir directement la fiche concernée (ou la ramener au premier
// plan si un onglet du tableau de bord est déjà ouvert).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/tableau-de-bord.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((listeClients) => {
      for (const client of listeClients) {
        if (client.url.includes('/tableau-de-bord.html') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
