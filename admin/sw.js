// Service worker de l'Administration (cahier v2.3, sections 3.1 et 17.7 ; v2.4 : adresse séparée
// admin.maitreakessemodelmanagement.com) : limité au dossier /admin/, il ne touche pas le site public. Il ne garde
// que les fichiers de l'INTERFACE (écrans, styles, icônes) : jamais de données nominatives ni
// de montants (les requêtes vers la base et vers /api ne passent pas par lui).
// v8 (22/10/2026) : nouvelle copie, l'ancienne pouvait contenir le manifeste à la place de la page.
// v10 (déménagement) : /admin/ ouvre la nouvelle Administration (décoration vivante, bloc 1 natif).
// v11 (démolition, 23/10/2026) : notifications du téléphone reprises dans js/admin/notifications.js.
const VERSION = 'administration-v18';
// (les pièces réservées js/admin/site-*.js ne sont jamais gardées : elles exigent la clé d'accès)
const INTERFACE = ['/admin/', '/css/polices.css', '/css/jetons.css', '/css/installation.css', '/css/admin-vivante.css', '/css/applis-rouge-mat.css', '/js/supabase-config.js',
  '/js/vendor/supabase-js-2.110.6.js', '/js/vendor/emailjs-browser-3.12.1.min.js', '/js/emailjs-config.js', '/js/verrou-defilement.js',
  '/js/conversion-heic.js', '/js/photos.js', '/js/tailles.js', '/js/analyse-profil.js', '/js/app.js', '/js/bouton-appui.js',
  '/js/portail/inactivite.js', '/js/messages-mensualites.js', '/js/portail/noyau.js', '/js/admin/coque.js', '/js/admin/notifications.js', '/js/admin/site.js',
  '/js/portail/espace-paiements.js', '/js/portail/espace-paiements-suivi.js',
  '/js/portail/espace-compta.js', '/js/portail/espace-compta-suivi.js', '/js/portail/compta-pdf.js', '/js/portail/compta-xlsx.js',
  '/js/cachets-communs.js', '/js/portail/espace-compta-cachets.js', '/js/portail/espace-compta-cachets-rapport.js', '/js/portail/espace-compta-documents.js', '/js/portail/espace-compta-dossier.js', '/js/vendor/pdf-lib-1.17.1.min.js',
  '/js/portail/securite.js', '/icons/admin-192.png', '/assets/logo-header.png', '/assets/logo-header-clair.png'];

importScripts('/js/sw-interface.js');
copieInterface(VERSION, ['portail-', 'administration-'], '/admin/', INTERFACE);
