// Service worker minimal — sert uniquement à rendre le site "installable"
// sur l'écran d'accueil (exigence technique de Chrome/Android). Ne met rien
// en cache pour l'instant : le site reste toujours à jour à chaque visite.
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', () => { self.clients.claim(); });
self.addEventListener('fetch', () => {});
