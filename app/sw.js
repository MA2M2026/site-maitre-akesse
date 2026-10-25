// Service worker de l'application MA2M Mannequin (25/10/2026) : limité au dossier /app/. Il rend
// l'application installable et garde une copie de l'INTERFACE pour qu'elle s'ouvre même avec
// une connexion coupée (js/sw-interface.js, partagé avec l'Administration). Notifications :
// celles du service worker du site (service-worker.js), chargé ici.
importScripts('/service-worker.js', '/js/sw-interface.js');
const VERSION = 'mannequin-app-v1';
const INTERFACE = ['/app/', '/app/manifest.webmanifest', '/css/polices.css', '/css/jetons.css', '/css/mannequin-app.css', '/js/surveillance.js',
  '/js/vendor/supabase-js-2.110.6.js', '/js/supabase-config.js', '/js/photos.js', '/js/app.js', '/js/tailles.js',
  '/js/analyse-profil.js', '/js/session-requise.js', '/js/app-coque.js', '/js/mannequin-app.js', '/icons/mannequin-192.png', '/assets/logo-header-clair.png'];
copieInterface(VERSION, ['mannequin-app-'], '/app/', INTERFACE);
