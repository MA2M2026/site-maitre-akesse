// Cartes des actualités, des événements et des partenaires (01/11/2026, site dynamique, étape A) : UNE seule
// façon de les dessiner, partagée par le serveur (middleware.js écrit les cartes dans la page avant de
// l'envoyer) et par les pages (js/actualites.js, js/evenements.js, js/partenaires.js, qui les redessinent
// après la traduction anglaise). Script classique ET importable par middleware.js : pose RenduPublications.
(function (racine) {
  'use strict';
  function echapper(t) {
    return t === null || t === undefined ? '' : String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // extrait coupé entre deux mots (et non au milieu d'un mot : « Cette nouvel… »)
  function extrait(texte, longueur) {
    if (!texte) return '';
    if (texte.length <= longueur) return texte;
    let coupe = texte.slice(0, longueur);
    const espace = coupe.lastIndexOf(' ');
    if (espace > longueur * 0.6) coupe = coupe.slice(0, espace);
    // ponctuation et espaces de fin retirés un à un (sans expression régulière : SonarCloud S8786)
    let fin = coupe.length;
    while (fin > 0 && (/\s/.test(coupe[fin - 1]) || ',;:.-–—('.includes(coupe[fin - 1]))) fin--;
    return coupe.slice(0, fin) + '…';
  }
  // texte sans balises, pour le serveur (la page, elle, passe par texteBrutDepuis de js/app.js)
  function texteBrut(html) {
    return String(html || '').replace(/<\/(p|h[1-6]|li|blockquote)>/gi, ' ').replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ').trim();
  }
  const dateLongue = (d, en) => new Date(d).toLocaleDateString(en ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' });
  // date d'un événement (jour sans heure : midi, pour ne jamais afficher la veille), sinon date de publication
  const dateEvenement = (e, en) => (e.date_evenement ? dateLongue(e.date_evenement + 'T12:00:00Z', en) : dateLongue(e.created_at, en));
  const LIRE = {
    actualite: { une: ['Lire l\'article →', 'Read Article →'], carte: ['Lire la suite →', 'Read More →'] },
    evenement: { une: ['Voir l\'événement →', 'View Event →'], carte: ['Voir l\'album →', 'View Album →'] }
  };
  // o : { en, sorte ('actualite' | 'evenement'), photo, nbPhotos, extrait (texte brut déjà extrait) }
  function etiquette(p, o) {
    if (o.sorte === 'evenement') return p.lieu ? '<span class="news-categorie">📍 ' + echapper(p.lieu) + '</span>' : '';
    return p.categorie ? '<span class="news-categorie">' + echapper(p.categorie) + '</span>' : '';
  }
  const datePublication = (p, o) => (o.sorte === 'evenement' ? dateEvenement(p, o.en) : dateLongue(p.created_at, o.en));
  function une(p, o) {
    return '<div class="news-une reveal" data-index="0"><img src="' + echapper(o.photo) + '" loading="lazy" alt="' + echapper(p.titre || '') + '">' +
      '<div class="news-une-scrim"></div><div class="news-une-corps"><span class="news-une-badge">★ ' + (o.en ? 'Featured' : 'À la une') + '</span>' +
      etiquette(p, o) + '<div class="news-date">' + echapper(datePublication(p, o)) + '</div>' +
      (p.titre ? '<h2>' + echapper(p.titre) + '</h2>' : '') + (o.extrait ? '<p>' + echapper(o.extrait) + '</p>' : '') +
      '<span class="news-lire">' + LIRE[o.sorte].une[o.en ? 1 : 0] + '</span></div></div>';
  }
  function carte(p, index, o) {
    return '<div class="news-carte reveal" data-index="' + index + '"' + (o.sorte === 'actualite' ? ' data-categorie="' + echapper(p.categorie || '') + '"' : '') + '>' +
      '<div class="news-img"><img src="' + echapper(o.photo) + '" loading="lazy" alt="' + echapper(p.titre || '') + '">' +
      (o.sorte === 'actualite' && p.video_url ? '<span class="news-play">▶</span>' : '') +
      (o.nbPhotos > 1 ? '<span class="news-compteur-photos">' + o.nbPhotos + '</span>' : '') + '</div>' +
      '<div class="news-corps">' + etiquette(p, o) + '<div class="news-date">' + echapper(datePublication(p, o)) + '</div>' +
      (p.titre ? '<h3>' + echapper(p.titre) + '</h3>' : '') + (o.extrait ? '<p class="news-extrait">' + echapper(o.extrait) + '</p>' : '') +
      '<span class="news-lire">' + LIRE[o.sorte].carte[o.en ? 1 : 0] + '</span></div></div>';
  }
  // partenaire : o : { en, logo }
  function partenaire(p, i, o) {
    return '<div class="news-carte reveal" data-index="' + i + '"><div class="news-img ' + (o.en ? 'enpt-9' : 'pt-9') + '">' +
      (p.logo_url ? '<img src="' + echapper(o.logo) + '" loading="lazy" alt="' + echapper(p.nom) + '" class="' + (o.en ? 'enpt-10' : 'pt-10') + '">'
        : '<span class="' + (o.en ? 'enpt-11' : 'pt-11') + '">' + echapper((p.nom || '?').charAt(0)) + '</span>') + '</div>' +
      '<div class="news-corps"><div class="news-date">' + echapper(p.role || '') + '</div><h3>' + echapper(p.nom || '') + '</h3>' +
      '<span class="news-lire">' + (o.en ? 'View Details →' : 'Voir la fiche →') + '</span></div></div>';
  }
  // Filtres par catégorie des Actualités (phase 2, 02/11/2026 : écrits aussi par le serveur ; js/actualites.js y
  // branche les clics). Moins de 2 catégories présentes : aucun filtre ('').
  const CATEGORIES_ACTUALITES = ['Casting', 'Mannequinat', 'Conseils', 'Événements'];
  const LIBELLES_CATEGORIES_EN = { Casting: 'Casting', Mannequinat: 'Modeling', Conseils: 'Tips', Événements: 'Events' };
  const libelleCategorie = (cat, en) => (en ? (LIBELLES_CATEGORIES_EN[cat] || cat) : cat);
  function filtresActualites(liste, en) {
    const presentes = CATEGORIES_ACTUALITES.filter((cat) => liste.some((a) => a.categorie === cat));
    if (presentes.length < 2) return '';
    return ['Toutes', ...presentes].map((cat) => '\n    <button class="filtre-categorie' + (cat === 'Toutes' ? ' actif' : '') + '" data-categorie="' + echapper(cat) + '">' +
      echapper(cat === 'Toutes' ? (en ? 'All' : 'Toutes') : libelleCategorie(cat, en)) + '</button>\n  ').join('');
  }
  racine.RenduPublications = { echapper, extrait, texteBrut, dateLongue, dateEvenement, une, carte, partenaire, CATEGORIES_ACTUALITES, libelleCategorie, filtresActualites };
})(typeof window !== 'undefined' ? window : globalThis);
