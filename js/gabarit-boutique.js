// Haut de page, menu, barre de la boutique, panier et bas de page communs aux 6 pages de
// La Maison MA2M (12/10/2026 : avant, recopiés dans chaque page — code recopié signalé par
// SonarQube). Chaque page contient seulement des emplacements vides, remplis par ce script,
// chargé juste après le bas de page et AVANT les autres scripts de la boutique :
//   <div data-gabarit-boutique="haut" data-actif="collection|suivi|gestion|"></div>
//   <div data-gabarit-boutique="panier"></div>        (pages avec panier : vitrine, produit)
//   <footer class="site-footer" data-gabarit-boutique="pied"></footer>
// L'année du bas de page est écrite ici (plus besoin de copyright-annee.js).
(function () {
  function remplacer(nom, html) {
    document.querySelectorAll('[data-gabarit-boutique="' + nom + '"]').forEach(function (el) {
      el.outerHTML = html(el);
    });
  }
  function lien(href, texte, actif, classe) {
    const classes = [actif ? 'actif' : '', classe || ''].join(' ').trim();
    return '<a href="' + href + '"' + (classes ? ' class="' + classes + '"' : '') + '>' + texte + '</a>';
  }

  remplacer('haut', function (el) {
    const actif = el.dataset.actif || '';
    return '<header class="site-header-v2">\n' +
      '  <div class="container header-v2-inner">\n' +
      '    <a href="/index.html" class="logo-img-header"><img src="/assets/logo-header.png" alt="Maître Akesse Model Management"></a>\n' +
      '    <div class="header-v2-droite">\n' +
      '      <button class="menu-trigger" id="menuBtn"><span>Menu</span><span class="dots"><span></span><span></span><span></span></span></button>\n' +
      '    </div>\n  </div>\n</header>\n' +
      '<div class="menu-overlay" id="menuOverlay">\n' +
      '  <button class="close-menu" id="closeMenuBtn">Fermer ✕</button>\n' +
      '  <ul class="nav-links">\n' +
      [['/marketplace/', 'La Maison MA2M'], ['/marketplace/suivi', 'Suivre ma commande'], ['/index.html', "Accueil de l'agence"],
       ['/mannequins.html', 'The Book'], ['/actualites.html', 'Actualités'], ['/evenements.html', 'Événements'], ['/contact.html', 'Contact']]
        .map(function (l) { return '    <li><a href="' + l[0] + '">' + l[1] + '</a></li>'; }).join('\n') +
      '\n  </ul>\n</div>\n' +
      '<div class="mp-apercu mp-cache" id="mp-apercu">\n' +
      '  <strong>Aperçu administration</strong>\n' +
      '  <span>La boutique n’est pas encore ouverte au public.</span>\n' +
      '  <a href="/marketplace/gestion">Gestion de la boutique</a>\n</div>\n' +
      '<nav class="mp-nav" aria-label="Boutique">\n' +
      '  <div class="container mp-nav-inner">\n' +
      '    <a href="/marketplace/" class="mp-marque">La Maison MA2M</a>\n' +
      '    <div class="mp-nav-liens">\n' +
      '      ' + lien('/marketplace/#collection', 'Collection', actif === 'collection') + '\n' +
      '      ' + lien('/marketplace/suivi', 'Suivi', actif === 'suivi') + '\n' +
      '      ' + lien('/marketplace/gestion', 'Gestion', actif === 'gestion', 'mp-lien-admin mp-cache') + '\n' +
      '      <button type="button" class="mp-panier-btn" data-mp-ouvrir-panier>Panier <span class="mp-panier-compte mp-cache" data-mp-compte-panier>0</span></button>\n' +
      '    </div>\n  </div>\n</nav>';
  });

  remplacer('panier', function () {
    return '<div class="mp-voile-panier" id="mp-voile-panier"></div>\n' +
      '<aside class="mp-panier" id="mp-panier" aria-hidden="true" aria-label="Panier">\n' +
      '  <div class="mp-panier-tete">\n' +
      '    <h2>Panier<span class="oeil">.</span></h2>\n' +
      '    <button type="button" class="mp-fermer" id="mp-panier-fermer">Fermer ✕</button>\n' +
      '  </div>\n' +
      '  <div class="mp-panier-lignes" id="mp-panier-lignes"></div>\n' +
      '  <div class="mp-panier-pied mp-cache" id="mp-panier-pied">\n' +
      '    <div class="mp-total"><span>Sous-total</span><b id="mp-panier-total">0 FCFA</b></div>\n' +
      '    <p class="mp-panier-note" id="mp-panier-note">Paiement par Wave, Orange Money ou MTN Mobile Money.</p>\n' +
      '    <a class="btn btn--principal" href="/marketplace/commande" id="mp-commander">Passer commande <span class="mp-fleche" aria-hidden="true">→</span></a>\n' +
      '  </div>\n</aside>';
  });

  remplacer('pied', function () {
    return '<footer class="site-footer">\n  <div class="container">\n    <div class="footer-bas">\n' +
      '      <span>© <span id="an">' + new Date().getFullYear() + '</span> Maître Akesse Model Management</span>\n' +
      "      <span>Abidjan, Côte d'Ivoire</span>\n" +
      '      <span><a href="/marketplace/cgv">Conditions de vente</a> · <a href="/mentions-legales.html">Mentions légales</a> · <a href="/politique-confidentialite.html">Confidentialité</a></span>\n' +
      '    </div>\n  </div>\n</footer>';
  });
})();
