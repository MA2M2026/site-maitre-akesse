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
  // adresse de la fiche : /book/nom quand le profil a son nom d'adresse (page écrite par le serveur, photo
  // annoncée dès la première seconde), sinon l'ancienne adresse (01/11/2026 : la fiche ouverte depuis une
  // carte arrivait vide, ≈ 3,6 s avant la photo, mesuré sur le site en ligne)
  const lienFiche = (m, en) => (m.slug && /^[a-z0-9-]{1,80}$/.test(m.slug) ? (en ? '/en' : '') + '/book/' + m.slug : 'mannequin.html?id=' + encodeURIComponent(m.id));
  // o : { en, photo, selectionne, libelle } (libelle : texte du bouton « + »)
  function carte(profil, rang, o) {
    const nom = profil.full_name || (o.en ? 'Model' : 'Mannequin');
    return '<div class="medaillon-carte reveal">' +
      '<button class="btn-selection' + (o.selectionne ? ' est-selectionne' : '') + '" data-id="' + echapper(profil.id) + '" title="' + echapper(o.libelle) + '" aria-label="' + echapper(o.libelle) + '">' + (o.selectionne ? '✓' : '+') + '</button>' +
      '<a href="' + echapper(lienFiche(profil, o.en)) + '" class="u-flex-col-centre"><div class="medaillon-photo">' +
      '<img src="' + echapper(o.photo) + '" alt="' + echapper(nom) + '"' + (rang < 5 ? (rang === 0 ? ' fetchpriority="high"' : '') : ' loading="lazy"') + '>' +
      '<div class="book-carte-legende"><div class="medaillon-nom">' + echapper(nom) + '</div>' +
      '<div class="medaillon-info">' + echapper(profil.city || '') + (profil.height_cm ? ' · ' + echapper(profil.height_cm) + ' cm' : '') + '</div></div>' +
      '</div></a></div>';
  }
  // bandeau « Mannequin du mois » en haut du Book (chantier 14) : seulement si sa fiche est publiée (slug)
  function bandeauMdm(d, en) {
    if (!d || !d.slug || !/^[a-z0-9-]{1,80}$/.test(d.slug)) return '';
    return '<a class="mannequin-du-mois" href="' + (en ? '/en' : '') + '/book/' + d.slug + '"><span class="mdm-titre">🏆 ' + (en ? 'Model of the month' : 'Mannequin du mois') + '</span>' +
      '<b>' + echapper(d.nom || '') + '</b><span class="mdm-lien">' + (en ? 'See her book →' : 'Voir sa fiche →') + '</span></a>';
  }
  const compte = (n, en) => (en ? n + (n > 1 ? ' profiles' : ' profile') : n + (n > 1 ? ' profils correspondent' : ' profil correspond'));
  // Accueil (magazine) : vignette d'un visage (photo + nom), « À la une », nombre de mannequins
  function vignetteAccueil(m, o) {
    // (le nom est écrit juste dessous : image décorative pour les lecteurs d'écran)
    return '<a href="' + echapper(lienFiche(m, o.en)) + '"><div class="mag-cadre"><img alt="" loading="lazy" src="' + echapper(o.photo) + '"></div>' +
      '<span>' + echapper(m.full_name || (o.en ? 'Model' : 'Mannequin')) + '</span></a>';
  }
  const categorieAccueil = (c, en) => (c === 'homme' ? (en ? 'Male' : 'Homme') : c === 'femme' ? (en ? 'Female' : 'Femme') : 'New Face');
  const infoUne = (m, en) => [categorieAccueil(m.category, en), m.city, m.height_cm ? m.height_cm + ' cm' : null].filter(Boolean).join(' · ');
  const nombreAccueil = (n, en) => (n > 1 ? (en ? n + ' models to discover' : n + ' mannequins à découvrir') : (en ? 'Our models to discover' : 'Nos mannequins à découvrir'));
  // les visages de l'accueil : 6 femmes, 3 hommes (dans l'ordre reçu : les plus récents)
  const visagesAccueil = (liste) => ({ femmes: liste.filter((p) => p.category === 'femme').slice(0, 6), hommes: liste.filter((p) => p.category === 'homme').slice(0, 3) });
  // Fiche préparée dès que le doigt (ou la souris) touche une carte : le téléphone demande la page pendant
  // le geste, elle est prête à l'ouverture. (Chrome et Android vont plus loin : la fiche entière est
  // préparée, règles /regles-fiches.json annoncées par vercel.json.)
  if (typeof document !== 'undefined' && document.addEventListener) {
    const deja = new Set();
    const preparer = (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[href*="/book/"], a[href*="mannequin.html?id="]') : null;
      if (!a || deja.has(a.href) || deja.size > 20) return;
      deja.add(a.href);
      const l = document.createElement('link');
      l.rel = 'prefetch'; l.href = a.href; l.as = 'document';
      document.head.appendChild(l);
    };
    document.addEventListener('pointerdown', preparer, { passive: true });
    document.addEventListener('mouseover', preparer, { passive: true });
  }
  racine.RenduBook = { echapper, lienFiche, bandeauMdm, ordonner, carte, compte, vignetteAccueil, categorieAccueil, infoUne, nombreAccueil, visagesAccueil };
})(typeof window !== 'undefined' ? window : globalThis);
