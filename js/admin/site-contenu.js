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
  let redaction = null;  // { type, id, existante, fichiers, editeur, enLigne, couverture, origine }
  // photos choisies avant l'envoi : ajoutées en plusieurs fois, jusqu'à cette limite (31/10/2026)
  const MAX_PHOTOS = 30;
  const cleBrouillon = () => 'publication:' + redaction.type + ':' + (redaction.id || 'nouvelle');

  // L'éditeur de texte (Quill) et le nettoyeur (DOMPurify) ne sont chargés qu'à la rédaction
  async function outilsRedaction() {
    if (!document.querySelector('link[href$="quill-2.0.3.snow.css"]')) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/js/vendor/quill-2.0.3.snow.css'; document.head.appendChild(l);
      await new Promise((ok) => { l.onload = ok; l.onerror = ok; });
    }
    await P.chargerScript('/js/vendor/quill-2.0.3.js').catch(() => { /* l'éditeur simple prend le relais */ });
    await P.chargerScript('/js/vendor/dompurify-3.4.16.min.js').catch(() => { /* aperçu en texte simple */ });
  }
  P.outilsRedaction = outilsRedaction;  // (aussi pour les Traductions anglaises, js/admin/site-traductions.js)

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
    // photos déjà en ligne, dans l'ordre du site (created_at) : modifiables (chantier 9, 31/10/2026)
    const photos = existante ? await P.bd(sb.from(c.t.tablePhotos).select('id, url, chemin, created_at').eq(c.t.colonne, existante.id).order('created_at', { ascending: true })).catch(() => []) : [];
    await outilsRedaction();
    const enLigne = photos.map((p) => Object.assign({}, p, { retiree: false }));
    const couverture = existante ? existante.image_url || null : null;
    redaction = { type, id: existante ? existante.id : null, existante, fichiers: [], editeur: null, enLigne, couverture,
      origine: { ordre: enLigne.map((p) => p.id).join(','), couverture } };
    const v = (k) => P.esc(existante && existante[k] ? existante[k] : '');
    const propres = type === 'actualites'
      ? '<label class="fl" for="pub-categorie">Catégorie<select id="pub-categorie" name="categorie"><option value="">Choisir</option>' + CATEGORIES_ACTUALITES.map((k) => '<option' + (existante && existante.categorie === k ? ' selected' : '') + '>' + P.esc(k) + '</option>').join('') + '</select></label>' +
        '<label class="fl" for="pub-video">Lien vidéo YouTube ou Vimeo (facultatif)<input id="pub-video" name="video" type="url" inputmode="url" placeholder="https://youtu.be/…" value="' + v('video_url') + '"></label>'
      : '<label class="fl" for="pub-date">Date de l’événement<input id="pub-date" name="date" type="date" value="' + v('date_evenement') + '"></label>' +
        '<label class="fl" for="pub-lieu">Lieu<input id="pub-lieu" name="lieu" maxlength="200" value="' + v('lieu') + '"></label>';
    return P.entete(existante ? 'Modifier' : 'Publier ' + c.un, '<a class="btn" href="#/site/' + type + '">← ' + c.titre + '</a>' +
        (existante ? '<a class="btn" href="' + c.lien + encodeURIComponent(existante.id) + '" target="_blank" rel="noopener">Voir sur le site ↗</a>' : '')) +
      '<div class="redaction-grille"><form class="carte f" data-form="publication-enregistrer">' +
      '<label class="fl large" for="pub-titre">Titre' + (type === 'evenements' ? ' (obligatoire)' : '') + '<input id="pub-titre" name="titre" maxlength="200" value="' + v('titre') + '"' + (type === 'evenements' ? ' required' : '') + '></label>' + propres +
      '<div class="large"><span class="fl">Photos</span>' + (enLigne.length ? '<div class="pub-photos" id="pub-en-ligne"></div>' : '') + '<label class="btn"><input type="file" accept="image/*,.heic,.heif" multiple data-change="publication-photos" hidden>📷 <span id="pub-choisir">' + (existante ? 'Ajouter des photos' : 'Choisir les photos') + '</span></label>' +
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
    if (redaction.editeur && typeof redaction.editeur.on === 'function') redaction.editeur.on('text-change', () => { apercu(); garderBrouillon(); });
    const form = document.querySelector('[data-form="publication-enregistrer"]');
    form.addEventListener('input', () => { apercu(); garderBrouillon(); });
    form.addEventListener('change', apercu);
    montrerEnLigne();
    apercu();
    return reprendreBrouillon();
  }
  function message(classe, texte) { const m = document.getElementById('pub-msg'); if (m) { m.className = 'form-msg large ' + classe; m.textContent = texte; } }

  // Photos choisies (pas encore envoyées) : chacune avec « ✕ » pour la retirer
  function montrerNouvelles() {
    (redaction.apercus || []).forEach((u) => URL.revokeObjectURL(u));  // les aperçus précédents libèrent la mémoire
    const urls = redaction.apercus = redaction.fichiers.map((f) => URL.createObjectURL(f));
    document.getElementById('pub-nouvelles').innerHTML = urls.map((u, i) => '<span class="pub-photo-choisie"><img src="' + u + '" alt="">' +
      '<button type="button" class="btn-mini-admin" data-action="publication-photo-retirer" data-i="' + i + '" aria-label="Retirer cette photo">✕</button></span>').join('') +
      (urls.length ? '<p class="doux petit-texte">' + P.pluriel(urls.length, 'photo choisie', 'photos choisies') + ' (au plus ' + MAX_PHOTOS + ') : vous pouvez en ajouter d’autres.</p>' : '');
    if (urls.length || redaction.existante) document.getElementById('pub-choisir').textContent = 'Ajouter des photos';
    montrerVitrine();
  }

  // Photos déjà en ligne (modification, chantier 9) : ◀ ▶ pour l'ordre, ★ pour la couverture, ✕ pour
  // retirer. Rien ne change sur le site avant « Enregistrer » (js/publications.js, appliquerPhotosEnLigne).
  const gardees = () => redaction.enLigne.filter((p) => !p.retiree);
  // couverture affichée : celle choisie si elle reste (ou ancienne image hors liste), sinon la 1re photo restante,
  // sinon la 1re photo choisie — même règle qu'à l'enregistrement
  function couvertureEffective() {
    const c = redaction.couverture, g = gardees();
    if (c && (g.some((p) => p.url === c) || !redaction.enLigne.some((p) => p.url === c))) return urlLegere(c);
    if (g[0]) return urlLegere(g[0].url);
    return (redaction.apercus && redaction.apercus[0]) || '';
  }
  function montrerVitrine() {
    const u = couvertureEffective(), vitrine = document.getElementById('apercu-image');
    if (vitrine) vitrine.innerHTML = u ? '<img src="' + P.esc(u) + '" alt="">' : '';
  }
  function montrerEnLigne() {
    const zone = document.getElementById('pub-en-ligne');
    if (!zone || !redaction) return;
    const g = gardees(), retirees = redaction.enLigne.length - g.length, couv = couvertureEffective();
    const bouton = (action, id, signe, nom, inactif) => '<button type="button" class="btn-mini-admin" data-action="' + action + '" data-id="' + P.esc(id) + '" aria-label="' + nom + '" title="' + nom + '"' + (inactif ? ' disabled' : '') + '>' + signe + '</button>';
    zone.innerHTML = g.map((p, i) => {
      const estCouv = urlLegere(p.url) === couv;
      return '<span class="pub-photo-en-ligne' + (estCouv ? ' est-couverture' : '') + '"><img src="' + P.esc(urlLegere(p.url)) + '" alt="" loading="lazy">' +
        (estCouv ? '<span class="pub-badge-couverture">Couverture</span>' : '') +
        '<span class="pub-photo-boutons">' + bouton('publication-photo-avant', p.id, P.icone('avant', 18), 'Déplacer avant', i === 0) + bouton('publication-photo-apres', p.id, P.icone('apres', 18), 'Déplacer après', i === g.length - 1) +
        bouton('publication-photo-couverture', p.id, P.icone('etoile', 18), 'Choisir comme photo de couverture', estCouv) + bouton('publication-photo-enlever', p.id, P.icone('croix', 18), 'Retirer cette photo du site', false) + '</span></span>';
    }).join('') +
      '<p class="doux petit-texte">' + (g.length ? P.pluriel(g.length, 'photo en ligne', 'photos en ligne') + ' : les flèches pour l’ordre, l’étoile pour la couverture, la croix pour retirer.' : 'Aucune photo gardée.') +
      ' Rien ne change sur le site avant « Enregistrer ».' +
      (retirees ? ' <b>' + P.pluriel(retirees, 'photo retirée', 'photos retirées') + '</b> (effacée' + (retirees > 1 ? 's' : '') + ' à l’enregistrement). <button type="button" class="btn-mini-admin" data-action="publication-photos-annuler">Annuler</button>' : '') + '</p>';
    montrerVitrine();
  }
  function photosChangees() {
    if (!redaction || !redaction.enLigne.length) return false;
    return redaction.enLigne.some((p) => p.retiree) || gardees().map((p) => p.id).join(',') !== redaction.origine.ordre || redaction.couverture !== redaction.origine.couverture;
  }
  function apresChangementEnLigne() { montrerEnLigne(); garderBrouillon(); }
  const trouver = (el) => redaction && redaction.enLigne.find((p) => String(p.id) === el.dataset.id);
  function deplacer(el, pas) {
    const p = trouver(el); if (!p) return;
    const g = gardees(), i = g.indexOf(p), j = i + pas;
    if (j < 0 || j >= g.length) return;
    [g[i], g[j]] = [g[j], g[i]];
    redaction.enLigne = g.concat(redaction.enLigne.filter((x) => x.retiree));
    apresChangementEnLigne();
  }
  P.actions['publication-photo-avant'] = (el) => deplacer(el, -1);
  P.actions['publication-photo-apres'] = (el) => deplacer(el, 1);
  P.actions['publication-photo-couverture'] = (el) => { const p = trouver(el); if (!p) return; redaction.couverture = p.url; apresChangementEnLigne(); };
  P.actions['publication-photo-enlever'] = (el) => { const p = trouver(el); if (!p) return; p.retiree = true; apresChangementEnLigne(); };
  P.actions['publication-photos-annuler'] = () => { if (!redaction) return; redaction.enLigne.forEach((p) => { p.retiree = false; }); apresChangementEnLigne(); };
  // Brouillon gardé dans ce navigateur (js/admin/brouillons.js) : champs, texte et photos choisies
  let minuteurBrouillon = null;
  function garderBrouillon() {
    if (!redaction || !P.brouillon) return;
    clearTimeout(minuteurBrouillon);
    const r = redaction;
    minuteurBrouillon = setTimeout(() => {
      const form = document.querySelector('[data-form="publication-enregistrer"]');
      if (!form || redaction !== r) return;
      const champs = {};
      ['titre', 'categorie', 'video', 'date', 'lieu'].forEach((n) => { if (form.elements[n]) champs[n] = form.elements[n].value; });
      // photos déjà en ligne : ordre, retirées et couverture (seulement des numéros, pas les fichiers)
      const enLigne = r.enLigne.length ? { ordre: r.enLigne.map((p) => p.id), retirees: r.enLigne.filter((p) => p.retiree).map((p) => p.id), couverture: r.couverture } : null;
      P.brouillon.ecrire(cleBrouillon(), { champs, texte: lireContenuEditeur(r.editeur), fichiers: r.fichiers, enLigne });
    }, 400);
  }
  async function reprendreBrouillon() {
    if (!redaction || !P.brouillon) return;
    const r = redaction, b = await P.brouillon.lire(cleBrouillon());
    const form = document.querySelector('[data-form="publication-enregistrer"]');
    if (!b || !form || redaction !== r) return;
    Object.entries(b.champs || {}).forEach(([n, v]) => { if (form.elements[n] && v) form.elements[n].value = v; });
    if (b.texte) chargerContenuDansEditeur(r.editeur, b.texte);
    r.fichiers = Array.isArray(b.fichiers) ? b.fichiers.slice(0, MAX_PHOTOS) : [];
    if (b.enLigne && r.enLigne.length) {
      // photos encore en ligne seulement (une photo disparue entre-temps est ignorée, une nouvelle va à la fin)
      const rang = new Map((b.enLigne.ordre || []).map((id, i) => [String(id), i])), retirees = new Set((b.enLigne.retirees || []).map(String));
      r.enLigne.sort((x, y) => (rang.has(String(x.id)) ? rang.get(String(x.id)) : 1e6) - (rang.has(String(y.id)) ? rang.get(String(y.id)) : 1e6));
      r.enLigne.forEach((p) => { p.retiree = retirees.has(String(p.id)); });
      r.enLigne = r.enLigne.filter((p) => !p.retiree).concat(r.enLigne.filter((p) => p.retiree));
      if (b.enLigne.couverture === r.origine.couverture || r.enLigne.some((p) => p.url === b.enLigne.couverture)) r.couverture = b.enLigne.couverture;
      montrerEnLigne();
    }
    montrerNouvelles();
    apercu();
    const dit = 'Brouillon retrouvé (' + new Date(b.quand).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) + ') : texte et photos choisies sont revenus.';
    message('ok', dit);
    P.message(dit);  // aussi en haut de l'écran
  }
  P.changements['publication-photos'] = (el) => {
    if (!redaction) return;
    // ajoutées aux précédentes (avant, un nouveau choix effaçait le premier) ; un même fichier n'entre qu'une fois
    const deja = new Set(redaction.fichiers.map((f) => f.name + '|' + f.size + '|' + f.lastModified));
    const nouveaux = Array.from(el.files || []).filter((f) => !deja.has(f.name + '|' + f.size + '|' + f.lastModified));
    const place = MAX_PHOTOS - redaction.fichiers.length;
    if (nouveaux.length > place) P.message('Au plus ' + MAX_PHOTOS + ' photos à la fois : ' + P.pluriel(Math.max(place, 0), 'photo ajoutée', 'photos ajoutées') + '.');
    redaction.fichiers = redaction.fichiers.concat(nouveaux.slice(0, Math.max(place, 0)));
    el.value = '';  // le même choix peut être refait
    montrerNouvelles();
    garderBrouillon();
  };
  P.actions['publication-photo-retirer'] = (el) => {
    if (!redaction) return;
    redaction.fichiers.splice(Number(el.dataset.i), 1);
    montrerNouvelles();
    garderBrouillon();
  };
  P.formulaires['publication-enregistrer'] = async (f) => {
    if (!redaction) return;
    const type = redaction.type, c = TYPES[type], titre = String(f.get('titre') || '').trim();
    const texte = lireContenuEditeur(redaction.editeur);
    let champs;
    if (type === 'actualites') {
      const video = String(f.get('video') || '').trim();
      if (video && !urlVideoIntegree(video)) { message('err', 'Ce lien vidéo n’est pas reconnu : collez un lien YouTube ou Vimeo.'); return; }
      if (!gardees().length && !redaction.fichiers.length && !video && (!redaction.id || photosChangees())) { message('err', redaction.id ? 'Gardez au moins une photo, ajoutez-en une, ou ajoutez un lien vidéo.' : 'Choisissez au moins une photo ou ajoutez un lien vidéo.'); return; }
      champs = { titre, categorie: f.get('categorie') || null, commentaire: texte, video_url: video };
    } else {
      if (!titre) { message('err', 'Le titre est obligatoire.'); return; }
      if (!gardees().length && !redaction.fichiers.length && (!redaction.id || photosChangees())) { message('err', redaction.id ? 'Gardez au moins une photo ou ajoutez-en une.' : 'Choisissez au moins une photo.'); return; }
      champs = { titre, date_evenement: f.get('date') || null, lieu: String(f.get('lieu') || '').trim() || null, description: texte || null };
    }
    const n = redaction.fichiers.length;
    message('ok', n ? 'Envoi de ' + P.pluriel(n, 'photo', 'photos') + '… gardez la page ouverte.' : 'Enregistrement…');
    const r = await sauverPublication(c.t, redaction.id, champs, redaction.fichiers);
    if (!r.ok) { message('err', 'Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    if (redaction.id && photosChangees() && !(await appliquerPhotosEnLigne(c.t, redaction.id, redaction.enLigne, redaction.couverture))) {
      redaction.fichiers = []; montrerNouvelles(); garderBrouillon();  // les photos ajoutées, elles, sont déjà en ligne
      message('err', 'Le texte est enregistré, mais l’ordre, la couverture ou les photos retirées n’ont pas pu l’être : reconnectez-vous puis réessayez.'); return;
    }
    if (r.photos < n) P.message(P.pluriel(n - r.photos, 'photo n’a pas pu être envoyée', 'photos n’ont pas pu être envoyées') + ' : réessayez de les ajouter.');
    else P.message(redaction.id ? 'Modifications enregistrées.' : 'Publié sur le site' + (r.photos ? ' avec ' + P.pluriel(r.photos, 'photo', 'photos') : '') + '.');
    clearTimeout(minuteurBrouillon);
    if (P.brouillon) await P.brouillon.effacer(cleBrouillon());
    redaction = null;
    location.hash = '#/site/' + type;
  };
  P.actions['publication-supprimer'] = async () => {
    if (!redaction || !redaction.id) return;
    const type = redaction.type;
    if (!confirm('Supprimer définitivement cette publication et toutes ses photos ?')) return;
    if (!(await effacerPublication(TYPES[type].t, redaction.id))) { message('err', 'La suppression a échoué : reconnectez-vous puis réessayez.'); return; }
    clearTimeout(minuteurBrouillon);
    if (P.brouillon) await P.brouillon.effacer(cleBrouillon());
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
