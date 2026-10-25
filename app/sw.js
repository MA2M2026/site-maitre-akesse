// Service worker de l'application MA2M Mannequin (25/10/2026) : limité au dossier /app/. Il rend
// l'application installable et garde une copie de l'INTERFACE pour qu'elle s'ouvre même avec
// une connexion coupée (js/sw-interface.js, partagé avec l'Administration). Notifications :
// celles du service worker du site (service-worker.js), chargé ici.
importScripts('/service-worker.js', '/js/sw-interface.js');
const VERSION = 'mannequin-app-v3';
const INTERFACE = ['/app/', '/app/manifest.webmanifest', '/css/polices.css', '/css/jetons.css', '/css/mannequin-app.css', '/js/surveillance.js',
  '/js/vendor/supabase-js-2.110.6.js', '/js/supabase-config.js', '/js/photos.js', '/js/app.js', '/js/tailles.js',
  '/js/analyse-profil.js', '/js/session-requise.js', '/js/app-coque.js', '/js/mannequin-app.js', '/icons/mannequin-192.png', '/assets/logo-header-clair.png',
  // pages du site ouvertes dans l'application (profil, paiements) : elles s'affichent même sans réseau
  '/app/espace-mannequin.html', '/app/mes-paiements.html', '/app/inscription-mannequin.html', '/css/espace-mannequin.css', '/css/cv-mannequin.css', '/css/champs-telephone.css',
  '/css/espace-mannequin-correctifs.css', '/css/charte-ma2m.css', '/css/bouton-ma2m.css', '/css/style.css', '/css/mes-paiements.css',
  '/js/bouton-appui.js', '/js/pays-naissance.js', '/js/verrou-defilement.js', '/js/conversion-heic.js', '/js/confort.js',
  '/js/espace-mannequin.js', '/js/cachets-communs.js', '/js/mes-paiements.js', '/css/inscription-simplifiee.css', '/js/inscription-simplifiee.js'];
copieInterface(VERSION, ['mannequin-app-'], '/app/', INTERFACE);
