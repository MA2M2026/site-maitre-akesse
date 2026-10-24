// Nouvelle Administration — groupe « Mannequins » du bloc 1 (étape 3), reconstruit à neuf avec les
// visages (PLAN-NOUVELLE-ADMINISTRATION.md). Mêmes données et mêmes règles que l'ancien tableau de
// bord (inventaire du 22/10/2026, retiré à la démolition : historique git) :
//  - Mannequins : publiées et en sourdine (pour pouvoir les réactiver) ; fiche : photos du Book
//    (ajouter plusieurs, remplacer, supprimer — la base d'abord, les fichiers ensuite), case de la
//    compcard (1 à 5), sourdine (definir_sourdine), CV (image, PDF, JPEG),
//    suppression définitive (api/supprimer-mannequin, il faut taper SUPPRIMER) ;
//  - Validations en attente : 4 premières photos, « Valider et publier », « Refuser » avec la raison
//    (visible par la mannequin) ;
//  - Mannequin à la une : choisir un visage, ou retirer la mise en avant.
// Outils partagés (js/app.js) : envoyerPhotoBook, supprimerDeR2, affecterCaseCompcard,
// construireCanvasCv, genererCvFichier, completerProfilsPrives,
// sansChampsPrives, ma2mExperiencesAgence, fusionnerExperiences, experiencePourCv,
// niveauNormalise, ouvrirGalerieLightbox ; js/tailles.js (ma2mTailleVetements).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  const PAGE = 'b2-mannequins-publies';

  // ---------- Liste : galerie des visages ----------
  async function photosPrincipales(ids) {
    if (!ids.length) return {};
    const photos = await P.bd(sb.from('model_photos').select('model_id, url_miniature, url, principale').in('model_id', ids));
    const parId = {};
    photos.forEach((p) => { if (p.principale || !parId[p.model_id]) parId[p.model_id] = p.url_miniature || p.url; });
    return parId;
  }
  async function liste() {
    // en sourdine : listées quand même, pour pouvoir les réactiver (sans la colonne : liste d'avant)
    let r = await sb.from('model_profiles').select('id, full_name, city, desactive, niveau_mannequin').or('published.eq.true,desactive.eq.true').order('full_name', { ascending: true });
    if (r.error) r = await sb.from('model_profiles').select('id, full_name, city, niveau_mannequin').eq('published', true).order('full_name', { ascending: true });
    if (r.error) throw r.error;
    const profils = r.data || [];
    const photos = await photosPrincipales(profils.map((p) => p.id));
    const cherche = (P.etat.chercheMannequins || '').toLowerCase();
    const visibles = profils.filter((p) => !cherche || String(p.full_name || '').toLowerCase().includes(cherche));
    const sourdine = profils.filter((p) => p.desactive).length;
    // Sélection par l'agence (24/10/2026) : cocher plusieurs mannequins, puis les convoquer
    const choix = P.etat.choixMannequins;  // Set des identifiants cochés, ou null hors sélection
    const carte = (p, i) => choix
      ? '<label class="mannequin-carte apparait' + (choix.has(p.id) ? ' choisie' : '') + '" style="--i:' + Math.min(i, 14) + '"><input type="checkbox" class="mannequin-case" data-change="mannequin-choisir" data-id="' + P.esc(p.id) + '"' + (choix.has(p.id) ? ' checked' : '') + ' aria-label="Choisir ' + P.esc(p.full_name || '') + '">' +
        P.visage(photos[p.id], p.full_name, 'mannequin-visage') + '<span class="mannequin-nom">' + P.esc(p.full_name || 'Sans nom') + '</span></label>'
      : '<a class="mannequin-carte apparait' + (p.desactive ? ' sourdine' : '') + '" style="--i:' + Math.min(i, 14) + '" href="#/site/' + PAGE + '/' + P.esc(p.id) + '">' +
        P.visage(photos[p.id], p.full_name, 'mannequin-visage') + '<span class="mannequin-nom">' + P.esc(p.full_name || 'Sans nom') + '</span>' +
        '<span class="mannequin-meta">' + (p.desactive ? '🔇 En sourdine' : P.esc([p.niveau_mannequin, p.city].filter(Boolean).join(' · '))) + '</span></a>';
    const barre = choix
      ? '<div class="ligne barre-selection"><button type="button" class="btn rouge" data-action="mannequins-convoquer"' + (choix.size ? '' : ' disabled') + '>📨 Convoquer la sélection (' + choix.size + ')</button><button type="button" class="btn" data-action="mannequins-selection">Annuler</button></div>'
      : '<div class="ligne"><button type="button" class="btn" data-action="mannequins-selection">☑️ Sélectionner pour convoquer</button></div>';
    return P.entete('Mannequins', '<span class="doux">' + P.pluriel(profils.length - sourdine, 'publiée', 'publiées') + (sourdine ? ' · ' + sourdine + ' en sourdine' : '') + '</span>') +
      '<p class="doux petit-texte">Ici : les mannequins publiées dans The Book du site. Les mensualités de formation se suivent dans le <a href="#/paiements/registre">registre du Suivi des paiements</a>.</p>' +
      '<form class="ligne" data-form="mannequins-chercher" role="search"><label class="fl" for="mq-cherche" style="flex:1;min-width:200px">Rechercher un nom' +
      '<input id="mq-cherche" name="cherche" type="search" value="' + P.esc(P.etat.chercheMannequins || '') + '"></label><button class="btn" type="submit">Rechercher</button></form>' +
      barre + (visibles.length ? '<div class="mannequins-grille">' + visibles.filter((p) => !choix || !p.desactive).map(carte).join('') + '</div>' :
        '<div class="carte vide">Aucune mannequin' + (cherche ? ' pour « ' + P.esc(cherche) + ' »' : ' publiée pour le moment') + '.</div>');
  }
  P.formulaires['mannequins-chercher'] = (f) => { P.etat.chercheMannequins = String(f.get('cherche') || '').trim(); return P.afficher(); };
  P.actions['mannequins-selection'] = () => { P.etat.choixMannequins = P.etat.choixMannequins ? null : new Set(); return P.afficher(); };
  P.changements['mannequin-choisir'] = (el) => {
    const choix = P.etat.choixMannequins;
    if (!choix) return;
    if (el.checked) choix.add(el.dataset.id); else choix.delete(el.dataset.id);
    el.closest('.mannequin-carte').classList.toggle('choisie', el.checked);
    const b = document.querySelector('[data-action="mannequins-convoquer"]');
    if (b) { b.textContent = '📨 Convoquer la sélection (' + choix.size + ')'; b.disabled = !choix.size; }
  };
  P.actions['mannequins-convoquer'] = () => { if (P.etat.choixMannequins && P.etat.choixMannequins.size) P.convoquerSelection([...P.etat.choixMannequins], { client: '' }); };

  // ---------- Fiche d'une mannequin ----------
  let ouverte = null; // { id, profil, photos }
  const COLONNES_PHOTOS = '*';  // (toutes les versions : supprimerFichiersPhoto, js/app.js)
  async function lirePhotos(id) { return P.bd(sb.from('model_photos').select(COLONNES_PHOTOS).eq('model_id', id).order('created_at', { ascending: true })); }
  function blocPhotos() {
    const ph = ouverte.photos;
    const optionsCc = (n) => '<option value="">Compcard —</option>' + [1, 2, 3, 4, 5].map((c) => '<option value="' + c + '"' + (n === c ? ' selected' : '') + '>Compcard ' + c + (c === 1 ? ' (grande)' : '') + '</option>').join('');
    return '<section class="carte" id="mq-photos"><div class="section-titre"><h2>Photos du Book <span class="doux">(' + ph.length + ')</span></h2>' +
      '<label class="btn rouge"><input type="file" accept="image/*" multiple data-change="mannequin-photos-ajouter" hidden>＋ Photos</label></div>' +
      '<p class="doux petit-texte">Sous chaque photo : sa case sur la compcard (1 à 5, la case 1 est la grande photo).</p>' +
      '<p class="doux" id="mq-photo-msg" role="status"></p>' +
      (ph.length ? '<div class="photos-mannequin">' + ph.map((p, i) => '<figure class="photo-mannequin apparait" style="--i:' + Math.min(i, 12) + '">' +
        '<button type="button" class="photo-ouvrir" data-action="mannequin-photo-voir" data-index="' + i + '" aria-label="Agrandir la photo ' + (i + 1) + '">' + P.visage(p.url_miniature || p.url, ouverte.profil.full_name) +
        (p.principale ? '<span class="etiquette-photo">Photo de profil</span>' : '') + (p.compcard_ordre ? '<span class="etiquette-photo cc">Compcard ' + p.compcard_ordre + '</span>' : '') + '</button>' +
        '<select data-change="mannequin-compcard" data-photo="' + P.esc(p.id) + '" aria-label="Case de la compcard, photo ' + (i + 1) + '">' + optionsCc(p.compcard_ordre) + '</select>' +
        '<figcaption><button type="button" class="btn petit" data-action="mannequin-photo-remplacer" data-photo="' + P.esc(p.id) + '">Remplacer</button>' +
        '<button type="button" class="btn petit" data-action="mannequin-photo-supprimer" data-photo="' + P.esc(p.id) + '" aria-label="Supprimer la photo ' + (i + 1) + '">✕</button></figcaption></figure>').join('') + '</div>' :
        '<p class="doux">Aucune photo pour cette mannequin.</p>') +
      '<input type="file" accept="image/*" id="mq-remplacement" data-change="mannequin-photo-remplacement" hidden></section>';
  }
  async function fiche(id) {
    const profil = await P.bd(sb.from('model_profiles').select('id, full_name, city, category, niveau_mannequin, desactive, published, featured').eq('id', id).maybeSingle());
    if (!profil) return P.entete('Mannequins') + '<div class="carte"><h2>Mannequin introuvable</h2><a class="btn" href="#/site/' + PAGE + '">← Retour</a></div>';
    ouverte = { id, profil, photos: await lirePhotos(id) };
    const principale = ouverte.photos.find((p) => p.principale) || ouverte.photos[0];
    return '<a class="retour-liste" href="#/site/' + PAGE + '">← Mannequins</a>' +
      '<header class="mannequin-tete">' + P.visage(principale && (principale.url_moyenne || principale.url_miniature || principale.url), profil.full_name, 'mannequin-portrait') +
      '<div class="mannequin-tete-texte"><h1>' + P.esc(profil.full_name || 'Sans nom') + '</h1>' +
      '<p class="doux">' + P.esc([profil.niveau_mannequin, profil.city, profil.category === 'homme' ? 'Homme' : profil.category === 'femme' ? 'Femme' : null].filter(Boolean).join(' · ')) + '</p>' +
      '<div class="ligne">' + (profil.desactive ? P.pastille('🔇 En sourdine : invisible sur le site, Espace bloqué', 'alerte') : P.pastille('Publiée au Book', 'ok')) + (profil.featured ? P.pastille('★ À la une', 'info') : '') + '</div>' +
      '<div class="ligne"><a class="btn" href="/mannequin.html?id=' + P.esc(id) + '" target="_blank" rel="noopener">Voir sur le site ↗</a>' +
      '<a class="btn" href="#/site/' + PAGE + '/' + P.esc(id) + '/cv">📄 Voir le CV</a>' +
      '<button type="button" class="btn" data-action="mannequin-sourdine">' + (profil.desactive ? '🔊 Réactiver' : '🔇 Mettre en sourdine') + '</button></div></div></header>' +
      blocPhotos() +
      '<section class="carte zone-danger"><h2>Supprimer définitivement</h2><p class="doux petit-texte">Supprime le profil, le compte de connexion et toutes les photos. Irréversible. Pour la retirer seulement du site, préférez la sourdine.</p>' +
      '<button type="button" class="btn" data-action="mannequin-supprimer">🗑 Supprimer</button></section>';
  }
  async function rafraichirPhotos(message) {
    ouverte.photos = await lirePhotos(ouverte.id);
    const zone = document.getElementById('mq-photos');
    if (zone) zone.outerHTML = blocPhotos();
    if (message) document.getElementById('mq-photo-msg').textContent = message;
  }
  P.actions['mannequin-photo-voir'] = (el) => { if (typeof ouvrirGalerieLightbox === 'function') ouvrirGalerieLightbox(ouverte.photos.map((p) => p.url_moyenne || p.url), Number(el.dataset.index)); };
  P.changements['mannequin-compcard'] = async (el) => {
    el.disabled = true;
    const erreur = await affecterCaseCompcard(ouverte.id, el.dataset.photo, el.value ? Number(el.value) : null);
    await rafraichirPhotos(erreur ? 'Compcard non enregistrée : ' + erreur.message : 'Compcard enregistrée.');
  };
  P.changements['mannequin-photos-ajouter'] = async (el) => {
    const fichiers = Array.from(el.files || []); el.value = '';
    const modelId = ouverte && ouverte.id;  // gardé : on peut changer de page pendant l'envoi
    if (!fichiers.length || !modelId) return;
    const msg = () => document.getElementById('mq-photo-msg') || { textContent: '' };
    let reussies = 0;
    for (let i = 0; i < fichiers.length; i++) {
      msg().textContent = 'Envoi ' + (i + 1) + '/' + fichiers.length + '…';
      try {
        const n = await envoyerPhotoBook(modelId, fichiers[i]);
        const r = await P.bd(sb.from('model_photos').insert(Object.assign({ model_id: modelId, originale_optimisee: true }, n)).select('id'));
        if (!r || !r.length) throw new Error('photo non rattachée');
        reussies++;
      } catch (e) { console.error('Envoi photo échoué :', e); }
    }
    if (ouverte && ouverte.id === modelId) await rafraichirPhotos(reussies + '/' + fichiers.length + (fichiers.length > 1 ? ' photos envoyées.' : ' photo envoyée.'));
  };
  let aRemplacer = null;
  P.actions['mannequin-photo-remplacer'] = (el) => { aRemplacer = ouverte.photos.find((p) => String(p.id) === el.dataset.photo) || null; document.getElementById('mq-remplacement').click(); };
  P.changements['mannequin-photo-remplacement'] = async (el) => {
    const fichier = el.files[0]; el.value = '';
    const photo = aRemplacer, modelId = ouverte && ouverte.id; aRemplacer = null;
    if (!fichier || !photo || !modelId) return;
    document.getElementById('mq-photo-msg').textContent = 'Envoi de la photo de remplacement…';
    try {
      const n = await envoyerPhotoBook(modelId, fichier);
      // la fiche en base d'abord : si la base refuse, l'ancienne photo reste intacte et les
      // nouveaux fichiers (inutilisés) sont retirés
      const r = await sb.from('model_photos').update(n).eq('id', photo.id).select('id');
      if (r.error || !r.data || !r.data.length) {
        await supprimerFichiersPhoto(modelId, n);
        throw r.error || new Error('la photo n’a pas été remplacée : reconnectez-vous puis réessayez');
      }
      await supprimerFichiersPhoto(modelId, photo);
      await rafraichirPhotos('Photo remplacée.');
    } catch (e) { document.getElementById('mq-photo-msg').textContent = 'Échec du remplacement : ' + P.erreurTexte(e); }
  };
  P.actions['mannequin-photo-supprimer'] = async (el) => {
    if (!confirm('Supprimer définitivement cette photo ? Cette action est irréversible.')) return;
    const photo = ouverte.photos.find((p) => String(p.id) === el.dataset.photo), modelId = ouverte.id;
    if (!photo) return;
    el.disabled = true;
    // la fiche en base d'abord, les fichiers ensuite (sinon une photo listée sans fichier)
    const r = await P.bd(sb.from('model_photos').delete().eq('id', photo.id).select('id'));
    if (!r || !r.length) { el.disabled = false; P.message('Rien n’a été supprimé : reconnectez-vous puis réessayez.'); return; }
    await supprimerFichiersPhoto(modelId, photo);
    await rafraichirPhotos('Photo supprimée.');
  };
  P.actions['mannequin-sourdine'] = async (el) => {
    const p = ouverte.profil, desactiver = !p.desactive, nom = p.full_name || 'cette mannequin';
    const question = desactiver
      ? 'Mettre « ' + nom + ' » en sourdine ?\n\nSon profil disparaîtra du site et elle ne pourra plus utiliser son Espace mannequin (message : « L’administrateur a désactivé votre profil »). Rien n’est supprimé : vous pourrez la réactiver à tout moment.'
      : 'Réactiver « ' + nom + ' » ?\n\nSon profil redevient visible sur le site et elle retrouve son Espace mannequin.';
    if (!confirm(question)) return;
    el.disabled = true;
    await P.rpc('definir_sourdine', { p_model: p.id, p_desactive: desactiver });
    P.message(desactiver ? 'Mannequin mise en sourdine.' : 'Mannequin réactivée.');
    return P.afficher();
  };
  P.actions['mannequin-supprimer'] = () => {
    P.fenetre('<form class="grille" data-form="mannequin-supprimer"><h2>Suppression définitive</h2><p>Profil, compte de connexion et photos de « ' + P.esc(ouverte.profil.full_name || '') + ' » seront supprimés. <b>Irréversible.</b></p>' +
      '<label class="fl" for="mq-confirmer">Pour confirmer, tapez SUPPRIMER en majuscules<input id="mq-confirmer" name="mot" autocomplete="off" required></label>' +
      '<div class="ligne"><button class="btn rouge" type="submit">Supprimer définitivement</button><button class="btn" type="button" data-action="fermer-fenetre">Annuler</button></div></form>');
    document.getElementById('mq-confirmer').focus();
  };
  P.formulaires['mannequin-supprimer'] = async (f) => {
    if (String(f.get('mot')) !== 'SUPPRIMER') { P.message('Suppression annulée : il faut taper exactement SUPPRIMER.'); return; }
    const session = (await sb.auth.getSession()).data.session;
    if (!session) { P.message('Session expirée : reconnectez-vous puis réessayez.'); return; }
    const rep = await fetch('/api/supprimer-mannequin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ modelId: ouverte.id }) });
    const corps = await rep.json().catch(() => ({}));
    if (!rep.ok) { P.message('Échec de la suppression : ' + (corps.error || 'erreur inconnue.')); return; }
    P.fenetre('');
    P.message('Le profil et le compte ont été supprimés définitivement.');
    location.hash = '#/site/' + PAGE;
  };

  // ---------- CV ----------
  let donneesCv = null;
  async function cv(id) {
    const [{ data: profil, error }, { data: projets }, { data: photos }, projetsAgence] = await Promise.all([
      sb.from('model_profiles').select(sansChampsPrives('id, full_name, category, bio, height_cm, weight_kg, city, quartier, instagram, chest_cm, waist_cm, hips_cm, shoe_size, carnation, clothing_size, date_naissance, eye_color, hair_color, years_experience, niveau_mannequin, inseam_cm, niveau_etude, etablissement, formation_particuliere, formation_mannequin, competences, citation, ville_naissance, lieu_naissance, nationalite')).eq('id', id).maybeSingle(),
      sb.from('model_projects').select('*').eq('model_id', id).order('created_at', { ascending: true }),
      sb.from('model_photos').select('*').eq('model_id', id).order('created_at', { ascending: true }),
      ma2mExperiencesAgence(id)
    ]);
    if (error || !profil) return '<div class="carte"><h2>CV indisponible</h2><p class="doux">Impossible de charger le CV de cette mannequin.</p></div>';
    await completerProfilsPrives(profil);
    let photoCvUrl = '';
    const compcardPhotos = [null, null, null, null, null];
    (photos || []).forEach((p) => {
      if (p.photo_cv) photoCvUrl = p.url || '';
      if (p.compcard_ordre >= 1 && p.compcard_ordre <= 5) compcardPhotos[p.compcard_ordre - 1] = p.url || p.url_miniature;
    });
    donneesCv = {
      nomComplet: profil.full_name, dateNaissance: profil.date_naissance, villeNaissance: profil.ville_naissance, lieuNaissance: profil.lieu_naissance, nationalite: profil.nationalite,
      ville: profil.city, quartier: profil.quartier, citation: profil.citation, bio: profil.bio, instagram: profil.instagram,
      niveauMannequin: niveauNormalise(profil.niveau_mannequin, profil.years_experience), mannequinId: profil.id, photoCvUrl, compcardPhotos,
      photosBook: (photos || []).slice().sort((a, b) => (b.principale ? 1 : 0) - (a.principale ? 1 : 0)).map((p) => p.url),
      physique: { taille: profil.height_cm, poids: profil.weight_kg, poitrine: profil.chest_cm, tourTaille: profil.waist_cm, hanches: profil.hips_cm, entrejambe: profil.inseam_cm,
        pointure: profil.shoe_size, tailleVet: ma2mTailleVetements(profil), yeux: profil.eye_color, cheveux: profil.hair_color, carnation: profil.carnation },
      formation: { niveau: profil.niveau_etude, etablissement: profil.etablissement, particuliere: profil.formation_particuliere, mannequin: profil.formation_mannequin },
      competences: profil.competences || {}, experiences: fusionnerExperiences(projetsAgence, projets).map(experiencePourCv), sexe: profil.category
    };
    return '<a class="retour-liste" href="#/site/' + PAGE + '/' + P.esc(id) + '">← ' + P.esc(profil.full_name || 'Fiche') + '</a>' +
      P.entete('CV de ' + (profil.full_name || 'la mannequin'), '<button type="button" class="btn rouge" id="cv-pdf" data-action="mannequin-cv" data-format="pdf">⬇ PDF</button>' +
        '<button type="button" class="btn" id="cv-jpeg" data-action="mannequin-cv" data-format="jpeg">⬇ Image (JPEG)</button>') +
      '<div class="carte cv-apercu" id="cv-apercu"><p class="doux">Préparation de l’aperçu…</p></div>';
  }
  async function apresCv() {
    const zone = document.getElementById('cv-apercu');
    if (!zone || !donneesCv) return;
    try {
      const canvas = await construireCanvasCv(donneesCv);
      const faibles = messagePhotosFaibles(canvas);  // (js/app.js)
      zone.innerHTML = (faibles ? '<div class="note attention">⚠️ ' + P.esc(faibles) + '</div>' : '') + '<img alt="Aperçu du CV" src="' + canvas.toDataURL('image/jpeg', 0.9) + '">';
    } catch (e) { zone.innerHTML = '<p class="doux">Aperçu indisponible : le fichier reste téléchargeable.</p>'; }
  }
  P.actions['mannequin-cv'] = (el) => genererCvFichier(el.dataset.format, donneesCv, 'cv-pdf', 'cv-jpeg');

  // ---------- Validations en attente ----------
  async function validations() {
    const profils = await P.bd(sb.from('model_profiles').select('id, full_name, city, category').eq('en_attente_validation', true).order('created_at', { ascending: true }));
    await completerProfilsPrives(profils);
    const photos = profils.length ? await P.bd(sb.from('model_photos').select('model_id, url_miniature, url, created_at').in('model_id', profils.map((p) => p.id)).order('created_at', { ascending: true })) : [];
    const parId = {};
    photos.forEach((p) => { (parId[p.model_id] = parId[p.model_id] || []).push(p.url_miniature || p.url); });
    return P.entete('Validations en attente', '<span class="doux">' + (profils.length ? profils.length + ' en attente' : 'Aucune') + '</span>') +
      '<p class="doux">Les fiches remplies par les mannequins dans leur Espace : vérifiez les photos, puis publiez au Book ou refusez avec une raison.</p>' +
      (profils.length ? profils.map((p, i) => {
        const age = P.age(p.date_naissance), mes = (parId[p.id] || []).slice(0, 4);
        return '<article class="carte validation apparait" style="--i:' + i + '"><div class="validation-photos">' +
          (mes.length ? mes.map((u) => P.visage(u, p.full_name)).join('') : '<p class="doux">Aucune photo</p>') + '</div>' +
          '<div class="validation-texte"><h2>' + P.esc(p.full_name || 'Sans nom') + (age !== null && age !== undefined && age < 18 ? ' ' + P.pastille((p.category === 'femme' ? 'Mineure' : 'Mineur') + ' — ' + age + ' ans', 'info') : '') + '</h2>' +
          '<p class="doux">' + P.esc([p.city, p.category].filter(Boolean).join(' · ')) + '</p><div class="ligne">' +
          '<button type="button" class="btn rouge" data-action="validation-publier" data-id="' + P.esc(p.id) + '">Valider et publier</button>' +
          '<button type="button" class="btn" data-action="validation-refuser" data-id="' + P.esc(p.id) + '" data-nom="' + P.esc(p.full_name || '') + '">Refuser</button></div></div></article>';
      }).join('') : '<div class="carte vide">Aucune fiche en attente de validation pour le moment.</div>');
  }
  P.actions['validation-publier'] = async (el) => {
    el.disabled = true;
    const r = await P.bd(sb.from('model_profiles').update({ published: true }).eq('id', el.dataset.id).select('id'));
    if (!r || !r.length) { el.disabled = false; P.message('Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    P.message('Fiche publiée au Book.');
    return P.afficher();
  };
  P.actions['validation-refuser'] = (el) => {
    P.fenetre('<form class="grille" data-form="validation-refuser" data-id="' + P.esc(el.dataset.id) + '"><h2>Refuser la fiche de ' + P.esc(el.dataset.nom) + '</h2>' +
      '<label class="fl" for="vr-raison">Raison du refus (visible par la mannequin, pour qu’elle puisse corriger)<textarea id="vr-raison" name="raison" rows="4"></textarea></label>' +
      '<div class="ligne"><button class="btn rouge" type="submit">Refuser</button><button class="btn" type="button" data-action="fermer-fenetre">Annuler</button></div></form>');
    document.getElementById('vr-raison').focus();
  };
  P.formulaires['validation-refuser'] = async (f, form) => {
    const r = await P.bd(sb.from('model_profiles').update({ en_attente_validation: false, raison_refus: String(f.get('raison') || '').trim() || null }).eq('id', form.dataset.id).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    P.fenetre(''); P.message('Fiche refusée : la mannequin voit la raison dans son Espace.');
    return P.afficher();
  };

  // ---------- Mannequin à la une ----------
  async function vedette() {
    const profils = await P.bd(sb.from('model_profiles').select('id, full_name, featured').eq('published', true).order('full_name', { ascending: true }));
    const photos = await photosPrincipales(profils.map((p) => p.id));
    const une = profils.find((p) => p.featured);
    return P.entete('Mannequin à la une') +
      '<p class="doux">Sa photo ouvre l’accueil du site. Sans mannequin à la une, l’accueil montre une photo au hasard.</p>' +
      (une ? '<section class="carte une-actuelle"><a href="#/site/' + PAGE + '/' + P.esc(une.id) + '" class="visage-lien" tabindex="-1" aria-hidden="true">' + P.visage(photos[une.id], une.full_name, 'une-visage') + '</a><div><p class="surtitre">À la une en ce moment</p><h2><a href="#/site/' + PAGE + '/' + P.esc(une.id) + '" data-visage>' + P.esc(une.full_name) + '</a></h2>' +
        '<button type="button" class="btn" data-action="vedette-retirer">Retirer la mise en avant</button></div></section>' :
        '<div class="note info">Aucune mannequin à la une : l’accueil montre une photo au hasard.</div>') +
      '<h2>Choisir une mannequin</h2><div class="mannequins-grille">' + profils.map((p, i) => '<button type="button" class="mannequin-carte apparait' + (p.featured ? ' choisie' : '') + '" style="--i:' + Math.min(i, 14) + '" data-action="vedette-choisir" data-id="' + P.esc(p.id) + '" aria-pressed="' + !!p.featured + '">' +
        P.visage(photos[p.id], p.full_name, 'mannequin-visage') + '<span class="mannequin-nom">' + P.esc(p.full_name) + '</span><span class="mannequin-meta">' + (p.featured ? '★ À la une' : 'Mettre à la une') + '</span></button>').join('') + '</div>';
  }
  P.actions['vedette-choisir'] = async (el) => {
    await P.bd(sb.from('model_profiles').update({ featured: false }).eq('featured', true));
    const r = await P.bd(sb.from('model_profiles').update({ featured: true }).eq('id', el.dataset.id).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    P.message('Nouvelle mannequin à la une.');
    return P.afficher();
  };
  P.actions['vedette-retirer'] = async () => {
    await P.bd(sb.from('model_profiles').update({ featured: false }).eq('featured', true));
    P.message('Mise en avant retirée.');
    return P.afficher();
  };

  // ---------- Branchement ----------
  P.espaces.site.pages[PAGE] = (args) => (args && args[0] ? (args[1] === 'cv' ? cv(decodeURIComponent(args[0])) : fiche(decodeURIComponent(args[0]))) : liste());
  P.espaces.site.apres[PAGE] = () => { if (/\/cv$/.test(location.hash)) void apresCv(); };
  P.espaces.site.pages['b2-validations'] = validations;
  P.espaces.site.pages['b3c-vedette-admin'] = vedette;
})();
