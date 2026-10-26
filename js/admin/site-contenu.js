// Nouvelle Administration — groupe « Contenu du site », 1re partie : Actualités, Événements, Partenaires,
// reconstruits à neuf (PLAN-NOUVELLE-ADMINISTRATION.md). Avant, il fallait ouvrir la page
// publique en « mode administration » ; ici : une galerie des publications avec leur photo de
// couverture, et une page de rédaction (titre, photos, texte mis en forme, aperçu en direct).
// Mêmes données et mêmes règles que les pages publiques (js/publications.js, partagé) :
//  - actualité : catégorie, lien vidéo YouTube / Vimeo, au moins une photo ou une vidéo ;
//  - événement : date (lue à midi, pour ne jamais glisser d'un jour), lieu, au moins une photo ;
//  - suppression : la base d'abord, les images ensuite.
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site || typeof PUBLICATIONS === 'undefined' || typeof ROLES_PARTENAIRES === 'undefined') return;
  const TYPES = {
    actualites: { t: PUBLICATIONS.actualites, titre: 'Actualités', un: 'une actualité', texte: 'commentaire', lien: '/actualites?actu=',
      ordre: (q) => q.order('created_at', { ascending: false }) },
    evenements: { t: PUBLICATIONS.evenements, titre: 'Événements', un: 'un événement', texte: 'description', lien: '/evenements?evenement=',
      ordre: (q) => q.order('date_evenement', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }) }
  };
  const dateMidi = (d) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const quand = (type, p) => (type === 'evenements' ? (p.date_evenement ? dateMidi(p.date_evenement) : 'Date à préciser') : P.date(p.created_at));
  // vignette d'une vidéo YouTube (actualité sans photo) ; null pour Vimeo
  const vignetteVideo = (url) => { const m = /youtube\.com\/embed\/([\w-]{6,20})/.exec(urlVideoIntegree(url) || ''); return m ? 'https://i.ytimg.com/vi/' + m[1] + '/hqdefault.jpg' : null; };
  let redaction = null;  // { type, id, existante, fichiers, editeur }

  // L'éditeur de texte (Quill) et le nettoyeur (DOMPurify) ne sont chargés qu'à la rédaction
  async function outilsRedaction() {
    if (!document.querySelector('link[href$="quill-2.0.3.snow.css"]')) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/js/vendor/quill-2.0.3.snow.css'; document.head.appendChild(l);
      await new Promise((ok) => { l.onload = ok; l.onerror = ok; });
    }
    await P.chargerScript('/js/vendor/quill-2.0.3.js').catch(() => { /* l'éditeur simple prend le relais */ });
    await P.chargerScript('/js/vendor/dompurify-3.4.16.min.js').catch(() => { /* aperçu en texte simple */ });
  }

  // ---------- Galerie des publications ----------
  async function liste(type) {
    const c = TYPES[type];
    const [lignes, photos] = await Promise.all([
      P.bd(c.ordre(sb.from(c.t.table).select('*'))),
      P.bd(sb.from(c.t.tablePhotos).select(c.t.colonne)).catch(() => [])
    ]);
    const nb = {}; photos.forEach((p) => { nb[p[c.t.colonne]] = (nb[p[c.t.colonne]] || 0) + 1; });
    const cartes = lignes.map((p, i) => '<a class="publication-carte apparait" style="--i:' + Math.min(i, 10) + '" href="#/site/' + type + '/' + encodeURIComponent(p.id) + '">' +
      '<span class="publication-image">' + (p.image_url || vignetteVideo(p.video_url) ? '<img src="' + P.esc(p.image_url ? urlLegere(p.image_url) : vignetteVideo(p.video_url)) + '" alt="" loading="lazy">' : '') + (p.video_url ? '<span class="ini">▶</span>' : p.image_url ? '' : '<span class="ini">✦</span>') + '</span>' +
      '<span class="publication-texte">' + (p.categorie ? '<span class="publication-categorie">' + P.esc(p.categorie) + '</span>' : '') +
      '<b>' + P.esc(p.titre || 'Sans titre') + '</b><span class="doux">' + P.esc([quand(type, p), p.lieu, nb[p.id] ? nb[p.id] + ' photo' + (nb[p.id] > 1 ? 's' : '') : '', p.video_url ? 'vidéo' : ''].filter(Boolean).join(' · ')) + '</span></span></a>').join('');
    return P.entete(c.titre, '<span class="doux">' + P.pluriel(lignes.length, type === 'evenements' ? 'publié' : 'publiée', type === 'evenements' ? 'publiés' : 'publiées') + '</span><a class="btn rouge" href="#/site/' + type + '/nouvelle">＋ Publier ' + c.un + '</a>') +
      (cartes ? '<div class="publications-grille">' + cartes + '</div>' : '<div class="carte vide">Rien de publié pour le moment.</div>');
  }

  // ---------- Rédaction (nouvelle publication ou modification) ----------
  async function rediger(type, id) {
    const c = TYPES[type];
    const existante = id === 'nouvelle' ? null : await P.bd(sb.from(c.t.table).select('*').eq('id', id).maybeSingle());
    if (id !== 'nouvelle' && !existante) return P.entete(c.titre) + '<div class="carte vide">Cette publication n’existe plus. <a href="#/site/' + type + '">Retour</a></div>';
    const photos = existante ? await P.bd(sb.from(c.t.tablePhotos).select('url').eq(c.t.colonne, existante.id)).catch(() => []) : [];
    await outilsRedaction();
    redaction = { type, id: existante ? existante.id : null, existante, fichiers: [], editeur: null };
    const v = (k) => P.esc(existante && existante[k] ? existante[k] : '');
    const propres = type === 'actualites'
      ? '<label class="fl" for="pub-categorie">Catégorie<select id="pub-categorie" name="categorie"><option value="">Choisir</option>' + CATEGORIES_ACTUALITES.map((k) => '<option' + (existante && existante.categorie === k ? ' selected' : '') + '>' + P.esc(k) + '</option>').join('') + '</select></label>' +
        '<label class="fl" for="pub-video">Lien vidéo YouTube ou Vimeo (facultatif)<input id="pub-video" name="video" type="url" inputmode="url" placeholder="https://youtu.be/…" value="' + v('video_url') + '"></label>'
      : '<label class="fl" for="pub-date">Date de l’événement<input id="pub-date" name="date" type="date" value="' + v('date_evenement') + '"></label>' +
        '<label class="fl" for="pub-lieu">Lieu<input id="pub-lieu" name="lieu" maxlength="200" value="' + v('lieu') + '"></label>';
    const enLigne = photos.length ? '<div class="pub-photos">' + photos.map((p) => '<img src="' + P.esc(urlLegere(p.url)) + '" alt="" loading="lazy">').join('') + '</div><p class="doux petit-texte">' + photos.length + ' photo(s) déjà en ligne ; celles que vous ajoutez s’ajoutent.</p>' : '';
    return P.entete(existante ? 'Modifier' : 'Publier ' + c.un, '<a class="btn" href="#/site/' + type + '">← ' + c.titre + '</a>' +
        (existante ? '<a class="btn" href="' + c.lien + encodeURIComponent(existante.id) + '" target="_blank" rel="noopener">Voir sur le site ↗</a>' : '')) +
      '<div class="redaction-grille"><form class="carte f" data-form="publication-enregistrer">' +
      '<label class="fl large" for="pub-titre">Titre' + (type === 'evenements' ? ' (obligatoire)' : '') + '<input id="pub-titre" name="titre" maxlength="200" value="' + v('titre') + '"' + (type === 'evenements' ? ' required' : '') + '></label>' + propres +
      '<div class="large"><span class="fl">Photos</span>' + enLigne + '<label class="btn"><input type="file" accept="image/*,.heic,.heif" multiple data-change="publication-photos" hidden>📷 ' + (existante ? 'Ajouter des photos' : 'Choisir les photos') + '</label>' +
      '<div class="pub-photos" id="pub-nouvelles"></div></div>' +
      '<div class="large"><span class="fl">Texte</span><div id="pub-editeur" class="editeur-riche"></div></div>' +
      '<p class="form-msg large" id="pub-msg" role="status"></p>' +
      '<div class="ligne large"><button class="btn rouge" type="submit">' + (existante ? 'Enregistrer' : 'Publier') + '</button>' +
      (existante ? '<button class="btn" type="button" data-action="publication-supprimer">Supprimer</button>' : '') + '</div></form>' +
      '<aside class="carte apercu-publication" aria-label="Aperçu sur le site"><span class="surtitre">Aperçu sur le site</span><div class="apercu-image" id="apercu-image">' + (existante && existante.image_url ? '<img src="' + P.esc(urlLegere(existante.image_url)) + '" alt="">' : '') + '</div>' +
      '<span class="publication-categorie" id="apercu-categorie"></span><h2 id="apercu-titre"></h2><p class="doux" id="apercu-quand"></p><div class="apercu-texte" id="apercu-texte"></div></aside></div>';
  }
  function apercu() {
    if (!redaction) return;
    const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const type = redaction.type;
    document.getElementById('apercu-titre').textContent = val('pub-titre') || (type === 'evenements' ? 'Titre de l’événement' : 'Titre de l’actualité');
    const cat = document.getElementById('apercu-categorie');
    cat.textContent = val('pub-categorie'); cat.hidden = !val('pub-categorie');
    document.getElementById('apercu-quand').textContent = type === 'evenements' ? [val('pub-date') ? dateMidi(val('pub-date')) : '', val('pub-lieu') ? '📍 ' + val('pub-lieu') : ''].filter(Boolean).join(' · ') : P.date(redaction.existante ? redaction.existante.created_at : new Date().toISOString());
    document.getElementById('apercu-texte').innerHTML = rendreContenuRiche(lireContenuEditeur(redaction.editeur));
  }
  function brancherRedaction() {
    if (!redaction || !document.getElementById('pub-editeur')) return;
    redaction.editeur = creerEditeurRiche('pub-editeur', redaction.type === 'evenements' ? 'Racontez cet événement ici… (facultatif)' : 'Racontez votre actualité ici… (vous pouvez coller un texte déjà mis en forme)');
    if (redaction.existante) chargerContenuDansEditeur(redaction.editeur, redaction.existante[TYPES[redaction.type].texte]);
    if (redaction.editeur && typeof redaction.editeur.on === 'function') redaction.editeur.on('text-change', apercu);
    const form = document.querySelector('[data-form="publication-enregistrer"]');
    form.addEventListener('input', apercu);
    form.addEventListener('change', apercu);
    apercu();
  }
  function message(classe, texte) { const m = document.getElementById('pub-msg'); if (m) { m.className = 'form-msg large ' + classe; m.textContent = texte; } }

  P.changements['publication-photos'] = (el) => {
    if (!redaction) return;
    redaction.fichiers = Array.from(el.files || []);
    (redaction.apercus || []).forEach((u) => URL.revokeObjectURL(u));  // les aperçus précédents libèrent la mémoire
    const urls = redaction.apercus = redaction.fichiers.map((f) => URL.createObjectURL(f));
    document.getElementById('pub-nouvelles').innerHTML = urls.map((u) => '<img src="' + u + '" alt="">').join('');
    if (urls.length && !(redaction.existante && redaction.existante.image_url)) document.getElementById('apercu-image').innerHTML = '<img src="' + urls[0] + '" alt="">';
  };
  P.formulaires['publication-enregistrer'] = async (f) => {
    if (!redaction) return;
    const type = redaction.type, c = TYPES[type], titre = String(f.get('titre') || '').trim();
    const texte = lireContenuEditeur(redaction.editeur);
    let champs;
    if (type === 'actualites') {
      const video = String(f.get('video') || '').trim();
      if (video && !urlVideoIntegree(video)) { message('err', 'Ce lien vidéo n’est pas reconnu : collez un lien YouTube ou Vimeo.'); return; }
      if (!redaction.id && !redaction.fichiers.length && !video) { message('err', 'Choisissez au moins une photo ou ajoutez un lien vidéo.'); return; }
      champs = { titre, categorie: f.get('categorie') || null, commentaire: texte, video_url: video };
    } else {
      if (!titre) { message('err', 'Le titre est obligatoire.'); return; }
      if (!redaction.id && !redaction.fichiers.length) { message('err', 'Choisissez au moins une photo.'); return; }
      champs = { titre, date_evenement: f.get('date') || null, lieu: String(f.get('lieu') || '').trim() || null, description: texte || null };
    }
    const n = redaction.fichiers.length;
    message('ok', n ? 'Envoi de ' + P.pluriel(n, 'photo', 'photos') + '… gardez la page ouverte.' : 'Enregistrement…');
    const r = await sauverPublication(c.t, redaction.id, champs, redaction.fichiers);
    if (!r.ok) { message('err', 'Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    if (r.photos < n) P.message(P.pluriel(n - r.photos, 'photo n’a pas pu être envoyée', 'photos n’ont pas pu être envoyées') + ' : réessayez de les ajouter.');
    else P.message(redaction.id ? 'Modifications enregistrées.' : 'Publié sur le site' + (r.photos ? ' avec ' + P.pluriel(r.photos, 'photo', 'photos') : '') + '.');
    redaction = null;
    location.hash = '#/site/' + type;
  };
  P.actions['publication-supprimer'] = async () => {
    if (!redaction || !redaction.id) return;
    const type = redaction.type;
    if (!confirm('Supprimer définitivement cette publication et toutes ses photos ?')) return;
    if (!(await effacerPublication(TYPES[type].t, redaction.id))) { message('err', 'La suppression a échoué : reconnectez-vous puis réessayez.'); return; }
    redaction = null;
    P.message('Publication supprimée.');
    location.hash = '#/site/' + type;
  };

  // ---------- Partenaires : galerie des logos, fiche d'ajout et de modification ----------
  let partenaire = null;  // { p (null = nouveau), editeur }
  const initiale = (nom) => P.esc(String(nom || '?').trim().charAt(0).toUpperCase() || '?');
  async function partenaires() {
    const lignes = await P.bd(sb.from('partenaires').select('*').order('created_at', { ascending: false }));
    const cartes = lignes.map((p, i) => '<a class="partenaire-carte apparait" style="--i:' + Math.min(i, 10) + '" href="#/site/partenaires/' + encodeURIComponent(p.id) + '">' +
      '<span class="partenaire-logo">' + (p.logo_url ? '<img src="' + P.esc(urlLegere(p.logo_url)) + '" alt="" loading="lazy">' : '<span class="ini">' + initiale(p.nom) + '</span>') + '</span>' +
      '<b>' + P.esc(p.nom || '') + '</b><span class="doux">' + P.esc([p.role, p.structure].filter(Boolean).join(' · ')) + '</span></a>').join('');
    return P.entete('Partenaires', '<span class="doux">' + lignes.length + ' partenaire' + (lignes.length > 1 ? 's' : '') + '</span><a class="btn rouge" href="#/site/partenaires/nouveau">＋ Ajouter un partenaire</a>') +
      (cartes ? '<div class="partenaires-grille">' + cartes + '</div>' : '<div class="carte vide">Aucun partenaire pour le moment.</div>');
  }
  async function fichePartenaire(id) {
    const p = id === 'nouveau' ? null : await P.bd(sb.from('partenaires').select('*').eq('id', id).maybeSingle());
    if (id !== 'nouveau' && !p) return P.entete('Partenaires') + '<div class="carte vide">Ce partenaire n’existe plus. <a href="#/site/partenaires">Retour</a></div>';
    await outilsRedaction();
    partenaire = { p, editeur: null };
    const v = (k) => P.esc(p && p[k] ? p[k] : '');
    return P.entete(p ? p.nom : 'Nouveau partenaire', '<a class="btn" href="#/site/partenaires">← Partenaires</a>' +
        (p ? '<a class="btn" href="/partenaires?partenaire=' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener">Voir sur le site ↗</a>' : '')) +
      '<form class="carte f" data-form="partenaire-enregistrer">' +
      '<div class="large partenaire-tete"><span class="partenaire-logo grand" id="pa-apercu">' + (p && p.logo_url ? '<img src="' + P.esc(urlLegere(p.logo_url)) + '" alt="">' : '<span class="ini">' + initiale(p && p.nom) + '</span>') + '</span>' +
      '<label class="btn"><input type="file" accept="image/*,.heic,.heif" data-change="partenaire-logo" hidden>🖼️ ' + (p && p.logo_url ? 'Changer le logo' : 'Choisir le logo') + '</label></div>' +
      '<label class="fl" for="pa-nom">Nom (obligatoire)<input id="pa-nom" name="nom" required maxlength="160" value="' + v('nom') + '"></label>' +
      '<label class="fl" for="pa-role">Rôle<select id="pa-role" name="role"><option value="">Choisir</option>' + ROLES_PARTENAIRES.map((r) => '<option value="' + P.esc(r[0]) + '"' + (p && p.role === r[0] ? ' selected' : '') + '>' + P.esc(r[1]) + '</option>').join('') + '</select></label>' +
      '<label class="fl" for="pa-structure">Structure<input id="pa-structure" name="structure" maxlength="200" value="' + v('structure') + '"></label>' +
      '<label class="fl" for="pa-evenement">Événement<input id="pa-evenement" name="evenement" maxlength="200" value="' + v('evenement') + '"></label>' +
      '<div class="large"><span class="fl">Présentation</span><div id="pa-editeur" class="editeur-riche"></div></div>' +
      '<p class="form-msg large" id="pa-msg" role="status"></p>' +
      '<div class="ligne large"><button class="btn rouge" type="submit">' + (p ? 'Enregistrer' : 'Ajouter ce partenaire') + '</button>' +
      (p ? '<button class="btn" type="button" data-action="partenaire-supprimer">Supprimer</button>' : '') + '</div></form>';
  }
  function brancherPartenaire() {
    if (!partenaire || !document.getElementById('pa-editeur')) return;
    partenaire.editeur = creerEditeurRiche('pa-editeur');
    if (partenaire.p) chargerContenuDansEditeur(partenaire.editeur, partenaire.p.description);
  }
  const messagePa = (classe, texte) => { const m = document.getElementById('pa-msg'); if (m) { m.className = 'form-msg large ' + classe; m.textContent = texte; } };
  P.changements['partenaire-logo'] = (el) => {
    if (!partenaire) return;
    partenaire.logo = el.files && el.files[0];
    if (partenaire.apercu) URL.revokeObjectURL(partenaire.apercu);
    if (partenaire.logo) document.getElementById('pa-apercu').innerHTML = '<img src="' + (partenaire.apercu = URL.createObjectURL(partenaire.logo)) + '" alt="">';
  };
  P.formulaires['partenaire-enregistrer'] = async (f) => {
    if (!partenaire) return;
    const nom = String(f.get('nom') || '').trim();
    if (!nom) { messagePa('err', 'Le nom est obligatoire.'); return; }
    const ancien = partenaire.p, id = ancien ? ancien.id : crypto.randomUUID();
    const ligne = { nom, structure: String(f.get('structure') || '').trim(), evenement: String(f.get('evenement') || '').trim(), role: f.get('role') || '', description: lireContenuEditeur(partenaire.editeur) };
    messagePa('ok', partenaire.logo ? 'Envoi du logo…' : 'Enregistrement…');
    if (partenaire.logo) {
      const logo = await envoyerLogoPartenaire(id, partenaire.logo);
      if (!logo) { messagePa('err', 'Le logo n’a pas pu être envoyé : vérifiez la connexion puis réessayez.'); return; }
      Object.assign(ligne, logo);
    }
    const r = await P.bd((ancien ? sb.from('partenaires').update(ligne).eq('id', id) : sb.from('partenaires').insert(Object.assign({ id }, ligne))).select('id'));
    if (!r || !r.length) {
      // le logo envoyé à l'instant n'est rattaché à rien : il est retiré
      if (ligne.logo_chemin) await supprimerCheminsImagesSite('partenaires', 'partenaires-logos', [ligne.logo_chemin]).catch(() => {});
      messagePa('err', 'Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return;
    }
    // ancien logo remplacé : le fichier n'est plus utilisé nulle part (base d'abord, fichier ensuite)
    if (ancien && ligne.logo_chemin && ancien.logo_chemin && ancien.logo_chemin !== ligne.logo_chemin) await supprimerCheminsImagesSite('partenaires', 'partenaires-logos', [ancien.logo_chemin]);
    partenaire = null;
    P.message(ancien ? 'Partenaire enregistré.' : 'Partenaire « ' + nom + ' » ajouté au site.');
    location.hash = '#/site/partenaires';
  };
  P.actions['partenaire-supprimer'] = async () => {
    if (!partenaire || !partenaire.p || !confirm('Supprimer définitivement ce partenaire ?')) return;
    if (!(await effacerPartenaire(partenaire.p))) { messagePa('err', 'La suppression a échoué : reconnectez-vous puis réessayez.'); return; }
    partenaire = null;
    P.message('Partenaire supprimé.');
    location.hash = '#/site/partenaires';
  };
  P.espaces.site.pages.partenaires = (args) => (args && args[0] ? fichePartenaire(decodeURIComponent(args[0])) : partenaires());
  P.espaces.site.apres.partenaires = brancherPartenaire;

  Object.keys(TYPES).forEach((type) => {
    P.espaces.site.pages[type] = (args) => (args && args[0] ? rediger(type, decodeURIComponent(args[0])) : liste(type));
    P.espaces.site.apres[type] = brancherRedaction;
  });
})();
