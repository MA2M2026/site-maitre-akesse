// Cartes de The Book (01/11/2026, site dynamique, étape A) : UNE seule façon de dessiner une carte, partagée
// par le serveur (middleware.js, qui écrit les cartes dans la page avant de l'envoyer) et par la page
// (js/mannequins.js, qui les redessine quand on filtre). Script classique ET importable par middleware.js :
// il pose window.RenduBook / globalThis.RenduBook.
(function (racine) {
  'use strict';
  function echapper(t) {
    return t === null || t === undefined ? '' : String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // ordre alphabétique des prénoms (choix de la propriétaire, sept. 2026)
  function ordonner(profils) {
    return profils.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'fr', { sensitivity: 'base' }));
  }
  // o : { en, photo, selectionne, libelle } (libelle : texte du bouton « + »)
  function carte(profil, rang, o) {
    const nom = profil.full_name || (o.en ? 'Model' : 'Mannequin');
    return '<div class="medaillon-carte reveal">' +
      '<button class="btn-selection' + (o.selectionne ? ' est-selectionne' : '') + '" data-id="' + echapper(profil.id) + '" title="' + echapper(o.libelle) + '" aria-label="' + echapper(o.libelle) + '">' + (o.selectionne ? '✓' : '+') + '</button>' +
      '<a href="mannequin.html?id=' + echapper(profil.id) + '" class="u-flex-col-centre"><div class="medaillon-photo">' +
      '<img src="' + echapper(o.photo) + '" alt="' + echapper(nom) + '"' + (rang < 5 ? (rang === 0 ? ' fetchpriority="high"' : '') : ' loading="lazy"') + '>' +
      '<div class="book-carte-legende"><div class="medaillon-nom">' + echapper(nom) + '</div>' +
      '<div class="medaillon-info">' + echapper(profil.city || '') + (profil.height_cm ? ' · ' + echapper(profil.height_cm) + ' cm' : '') + '</div></div>' +
      '</div></a></div>';
  }
  const compte = (n, en) => (en ? n + (n > 1 ? ' profiles' : ' profile') : n + (n > 1 ? ' profils correspondent' : ' profil correspond'));
  racine.RenduBook = { echapper, ordonner, carte, compte };
})(typeof window !== 'undefined' ? window : globalThis);
