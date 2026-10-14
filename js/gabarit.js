// Barre du haut, menu et bas de page communs à toutes les pages publiques (11/10/2026 : avant,
// recopiés dans chacune des ~33 pages FR/EN). Chaque page contient seulement des emplacements
// vides, remplis par ce script dès leur lecture (script chargé juste après eux, sans attendre) :
//   <header class="site-header-v2" data-gabarit="entete" data-page="contact"></header>
//   <div class="menu-overlay" id="menuOverlay" data-gabarit="menu"></div>
//   <script src="js/gabarit.js"></script>      … contenu de la page …
//   <footer class="site-footer" data-gabarit="pied"></footer>
//   <script src="js/gabarit.js"></script>
// data-page : nom du fichier sans « .html » (lien actif du menu, lien vers l'autre langue).
// data-autre-langue (facultatif) : page de l'autre langue quand elle n'existe pas (ex. Espace).
// Aussi : <div class="reseaux" data-gabarit="reseaux"></div> (icônes des réseaux sociaux).
// Pour ajouter une page au menu : une seule ligne dans PAGES ci-dessous.
(function () {
  if (window.ma2mGabarit) { window.ma2mGabarit(); return; } // 2e chargement : bas de page
  var EN_G = document.documentElement.lang === 'en';
  var RACINE_G = EN_G ? '../' : '';
  // [fichier, libellé menu FR, libellé menu EN, libellé bas de page FR, libellé bas de page EN]
  // (libellé bas de page null = absent du bas de page)
  // Ordre du menu « Modèle A » (11/10/2026) ; « Intégrer l'agence » devient le grand bouton rouge.
  var PAGES = [
    ['index', 'Accueil', 'Home', 'Accueil', 'Home'],
    ['mannequins', 'The Book', 'The Book', 'The Book', 'The Book'],
    ['parcours', 'Parcours MA2M', 'Track Record', 'Parcours MA2M', 'Track Record'],
    ['agenda', 'Agenda', 'Agenda', null, null],
    ['qui-sommes-nous', 'Qui sommes-nous', 'About us', 'Qui sommes-nous', 'About us'],
    ['services', 'Services', 'Services', 'Services', 'Services'],
    ['actualites', 'Actualités', 'News', 'Actualités', 'News'],
    ['evenements', 'Événements', 'Our Events', 'Nos événements', 'Our Events'],
    ['partenaires', 'Partenaires', 'Our Partners', 'Nos partenaires', 'Our Partners'],
    ['candidature', 'Postuler à un casting', 'Apply for a Casting', 'Postuler à un casting', 'Apply for a Casting'],
    ['inscription-mannequin', "Inscription nouveau mannequin de l'agence", 'Registration', 'Inscription', 'Registration'],
    ['contact', 'Contact', 'Contact', null, null],
    ['integrer-agence', "Intégrer l'agence", 'Join the Agency', "Intégrer l'agence", 'Join the Agency']
  ];
  // Le bas de page garde son ordre d'avant le menu « Modèle A » (seul le menu a changé).
  var ORDRE_PIED = ['index', 'qui-sommes-nous', 'services', 'mannequins', 'actualites', 'evenements', 'parcours',
    'partenaires', 'integrer-agence', 'candidature', 'inscription-mannequin'];
  var RESEAUX = [
    '<a href="https://www.instagram.com/maitreakessemodelmanagement" target="_blank" rel="noopener" aria-label="Instagram" title="Instagram"><svg viewBox="0 0 24 24"><defs><linearGradient id="ig-grad-pied" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFC107"/><stop offset="50%" stop-color="#F44336"/><stop offset="100%" stop-color="#9C27B0"/></linearGradient></defs><path fill="url(#ig-grad-pied)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98C.014 8.333 0 8.741 0 12s.014 3.667.072 4.948c.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24s3.667-.014 4.948-.072c4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.667.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>',
    '<a href="https://www.tiktok.com/@agencemaitreakessemodel" target="_blank" rel="noopener" aria-label="TikTok" title="TikTok"><svg viewBox="0 0 24 24"><path fill="#25F4EE" transform="translate(-0.9,-0.9)" d="M16.6 5.82c-1.36-1.57-3.24-1.48-3.24-1.48h-3.09v12.4a2.592 2.592 0 01-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 004.3 1.38V7.3s-1.88.09-3.24-1.48z"/><path fill="#FE2C55" transform="translate(0.9,0.9)" d="M16.6 5.82c-1.36-1.57-3.24-1.48-3.24-1.48h-3.09v12.4a2.592 2.592 0 01-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 004.3 1.38V7.3s-1.88.09-3.24-1.48z"/><path fill="#000000" d="M16.6 5.82c-1.36-1.57-3.24-1.48-3.24-1.48h-3.09v12.4a2.592 2.592 0 01-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 004.3 1.38V7.3s-1.88.09-3.24-1.48z"/></svg></a>',
    '<a href="https://www.facebook.com/share/1BzPN69rhE/" target="_blank" rel="noopener" aria-label="Facebook" title="Facebook" class="u-ic-facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.06C22 6.505 17.523 2 12 2S2 6.505 2 12.06c0 5.022 3.657 9.184 8.438 9.94v-7.03H7.898v-2.91h2.54V9.845c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.459h-1.26c-1.243 0-1.63.771-1.63 1.562v1.875h2.773l-.443 2.91h-2.33V22c4.78-.756 8.437-4.918 8.437-9.94z"/></svg></a>',
    '<a href="https://youtube.com/@maitreakessemodelmanagement" target="_blank" rel="noopener" aria-label="YouTube" title="YouTube" class="u-ic-youtube"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a2.994 2.994 0 00-2.107-2.12C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.391.521A2.994 2.994 0 00.502 6.186 31.25 31.25 0 000 12a31.25 31.25 0 00.502 5.814 2.994 2.994 0 002.107 2.12c1.886.521 9.391.521 9.391.521s7.505 0 9.391-.521a2.994 2.994 0 002.107-2.12A31.25 31.25 0 0024 12a31.25 31.25 0 00-.502-5.814zM9.6 15.6V8.4l6.4 3.6-6.4 3.6z"/></svg></a>',
    '<a href="https://wa.me/message/HJAMXGXHCL46I1" target="_blank" rel="noopener" aria-label="WhatsApp" title="WhatsApp" class="u-ic-whatsapp"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0a12 12 0 00-10.288 18.06L0 24l6.084-1.688A12 12 0 1012 0zm0 21.938a9.917 9.917 0 01-5.052-1.383l-.362-.215-3.752 1.041 1.004-3.665-.235-.375A9.938 9.938 0 1112 21.938z"/></svg></a>'
  ];

  function remplir() {
  function placeHolders(nom) { return document.querySelectorAll('[data-gabarit="' + nom + '"]:not([data-rempli])'); }
  var entete = document.querySelector('[data-gabarit="entete"]');
  var page = (entete && entete.dataset.page) || (document.body && document.body.dataset.page) || '';

  // « Qui sommes-nous » : dans le menu partout, dans le bas de page seulement sur sa propre
  // page ; le lien « Inscription » n'est pas proposé dans le menu français des deux pages de
  // candidature.
  // La fiche d'une mannequin garde « The Book » allumé dans le menu.
  var actif = page === 'mannequin' ? 'mannequins' : page;
  function visible(p, menu) {
    if (!menu && p[0] === 'qui-sommes-nous') return page === 'qui-sommes-nous';
    if (menu && !EN_G && p[0] === 'inscription-mannequin') return page !== 'candidature' && page !== 'integrer-agence';
    return true;
  }

  placeHolders('entete').forEach(function (el) {
    var autre = el.dataset.autreLangue || ((EN_G ? '../' : 'en/') + page + '.html');
    el.innerHTML = '\n  <div class="container header-v2-inner">\n' +
      '    <a href="index.html" class="logo-img-header"><img src="' + RACINE_G + 'assets/logo-header.png" alt="Maître Akesse Model Management"></a>\n' +
      '    <div class="header-v2-droite">\n' +
      '      <a href="' + autre + '" class="lang-switch" aria-label="' + (EN_G ? 'Switch to French">FR' : 'Switch to English">EN') + '</a>\n' +
      '      <button class="menu-trigger" id="menuBtn">\n        <span>Menu</span>\n        <span class="dots"><span></span><span></span><span></span></span>\n      </button>\n' +
      '    </div>\n  </div>\n';
    el.setAttribute('data-rempli', '');
  });

  placeHolders('menu').forEach(function (el) {
    var liens = PAGES.filter(function (p) { return visible(p, true); }).map(function (p) {
      return '    <li' + (p[0] === 'integrer-agence' ? ' class="menu-rejoindre"' : '') + '><a href="' + p[0] + '.html"' + (p[0] === actif ? ' class="actif"' : '') + '>' + (EN_G ? p[2] : p[1]) + '</a></li>';
    });
    liens.push('    <li class="item-cta"><a href="' + RACINE_G + 'espace-mannequin.html"' + (actif === 'espace-mannequin' ? ' class="actif"' : '') + '>' + (EN_G ? "Agency's Model Space" : "Espace mannequin de l'agence") + '</a></li>');
    el.innerHTML = '\n  <button class="close-menu" id="closeMenuBtn">' + (EN_G ? 'Close ✕' : 'Fermer ✕') + '</button>\n  <ul class="nav-links">\n' + liens.join('\n') + '\n  </ul>\n';
    el.setAttribute('data-rempli', '');
  });

  // Liens vers les réseaux sociaux (page Contact, 12/10/2026 : avant, recopiés dans la page)
  placeHolders('reseaux').forEach(function (el, n) {
    // ordre de la page Contact : TikTok, Facebook, Instagram, YouTube, WhatsApp
    el.innerHTML = [1, 2, 0, 3, 4].map(function (i) { return RESEAUX[i]; }).join('').replace(/ig-grad-pied/g, 'ig-grad-r' + n);
    el.setAttribute('data-rempli', '');
  });

  placeHolders('pied').forEach(function (el) {
    var nav = PAGES.filter(function (p) { return p[3] && visible(p, false); }).sort(function (a, b) {
      return ORDRE_PIED.indexOf(a[0]) - ORDRE_PIED.indexOf(b[0]);
    }).map(function (p) {
      return '        <a href="' + p[0] + '.html">' + (EN_G ? p[4] : p[3]) + '</a>';
    }).join('\n');
    // Titre de structure invisible (12/10/2026) : sur les pages sans titre de niveau 2, les
    // titres h3 du bas de page « sautaient » un niveau (relevé par Lighthouse et le W3C).
    el.innerHTML = '\n  <div class="container">\n    <h2 class="u-lecteur-ecran">' + (EN_G ? 'Site information' : 'Informations du site') + '</h2>\n    <div class="footer-grille">\n      <div>\n' +
      '        <h3>Maître Akesse Model Management</h3>\n' +
      '        <p>' + (EN_G ? 'Every great journey begins with a dream. Ours begins in Abidjan.' : 'Chaque grand parcours commence par un rêve. Le nôtre commence à Abidjan.') + '</p>\n' +
      '      </div>\n      <div>\n        <h3>Navigation</h3>\n' + nav + '\n      </div>\n      <div>\n        <h3>Contact</h3>\n' +
      '        <a href="tel:+2250545656687">+225 05 45 65 66 87</a>\n        <a href="tel:+2252722231176">+225 27 22 23 11 76</a>\n        <a href="mailto:infos.ma2m@gmail.com">infos.ma2m@gmail.com</a>\n' +
      '        <div class="footer-reseaux">\n          ' + RESEAUX.join('\n          ') + '\n        </div>\n      </div>\n    </div>\n' +
      '    <div class="footer-bas">\n      <span>© <span id="an">' + new Date().getFullYear() + '</span> Maître Akesse Model Management</span>\n' +
      "      <span>Abidjan, Côte d'Ivoire</span>\n" +
      '      <span><a href="mentions-legales.html">' + (EN_G ? 'Legal Notice' : 'Mentions légales') + '</a> · <a href="politique-confidentialite.html">' + (EN_G ? 'Privacy Policy' : 'Confidentialité') + '</a></span>\n' +
      '    </div>\n  </div>\n';
    el.setAttribute('data-rempli', '');
  });
  }
  window.ma2mGabarit = remplir;
  remplir();
})();

// --- Place réservée pour une liste remplie par la base (The Book : #grille) ---
// Journal du 14/10/2026 (« Affichage qui saute », téléphone) : au retour en arrière, le
// navigateur replace le visiteur plus bas AVANT l'arrivée de la liste des mannequins ; la liste
// arrive ensuite et pousse tout le bas de page d'un coup. On retient la hauteur de la liste
// (par page et largeur d'écran) et on la réserve à l'ouverture suivante. Fait ici, au 2e
// chargement de ce script (juste après le bas de page), pour que la place soit prise avant
// que le navigateur ne replace le visiteur, sans fichier de plus à charger. La page appelle
// libererPlaceListe() une fois la liste affichée. (L'accueil, lui, a des cartes d'attente
// dans la page : nombre de mannequins fixe.)
function cleHauteurListe(el) {
  // même clé pour /mannequins, /mannequins.html, /, /index.html (adresses « propres » de Vercel)
  var page = location.pathname.replace(/(index)?(\.html)?$/, '').replace(/\/$/, '');
  return 'ma2m_hauteur_' + page + '#' + el.id + '@' + Math.round(window.innerWidth / 40);
}
function reserverPlaceListe(el) {
  try { var h = Number(localStorage.getItem(cleHauteurListe(el))); if (h > 0 && h < 200000) el.style.minHeight = h + 'px'; } catch (e) { /* stockage indisponible : pas de place réservée */ }
}
// memoriser = false quand la liste affichée est filtrée (recherche gardée par le navigateur) :
// sa hauteur ne vaut pas pour la liste complète.
function libererPlaceListe(el, memoriser) {
  el.style.minHeight = '';
  if (memoriser === false) return;
  requestAnimationFrame(function () {
    try { if (el.offsetHeight > 0) localStorage.setItem(cleHauteurListe(el), String(el.offsetHeight)); else localStorage.removeItem(cleHauteurListe(el)); } catch (e) { /* idem */ }
  });
}
document.querySelectorAll('[data-place-reservee]').forEach(reserverPlaceListe);
