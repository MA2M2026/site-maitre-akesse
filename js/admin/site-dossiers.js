// Nouvelle Administration — Candidatures casting et Demandes recruteurs (bloc 1), reconstruites
// à neuf (PLAN-NOUVELLE-ADMINISTRATION.md, étape 2) : galerie des visages, fiche en pleine page.
// Mêmes données et mêmes règles que l'ancien tableau de bord (INVENTAIRE-BLOC1.md) :
//  - statuts et pastilles avec leurs nombres ; « À revoir » (valeur « en étude ») et « En attente »
//    rangés à part, hors de « Toutes » ; 12 dossiers par page, « Voir plus » ;
//  - changement de statut : premier message du catalogue (js/messages-candidats.js), e-mail parti
//    tout seul s'il y a une adresse (celle du parent pour un mineur), modifiable, renvoyable, WhatsApp ;
//  - « Écrire sur WhatsApp » : tous les messages du catalogue + rendez-vous (date, heure, lieu) ;
//  - photos (casting_photos : stockage signé ou lien Google Drive) : ajouter, remplacer, supprimer ;
//  - code d'inscription d'une personne retenue (code_individuel_creer) ; suppression du dossier ;
//  - recruteur : mannequins choisis (avec leurs visages), retirer un mannequin.
// Outils partagés : js/messages-candidats.js, js/messages-convocations.js (sansMarquesWhatsApp),
// js/emailjs-config.js (envoyerEmailCandidat), js/app.js (numeroWhatsApp, fichierEnBase64,
// envoyerPhotosVersDrive, URL_SCRIPT_PHOTOS_CASTING, ouvrirGalerieLightbox).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  const PAR_PAGE = 12;
  const SOURCES = {
    casting: {
      page: 'b2-candidatures', titre: 'Candidatures', table: 'casting_applications', photos: { table: 'casting_photos', colonne: 'application_id', bucket: 'casting-applications' },
      champStatut: 'status', statuts: ['nouvelle', 'en étude', 'en attente', 'retenue', 'refusée'], aPart: ['en étude', 'en attente'], defaut: 'nouvelle',
      libelles: { nouvelle: 'Nouvelle', vue: 'Vue', 'en étude': 'À revoir', 'en attente': 'En attente', retenue: 'Retenue', 'refusée': 'Refusée' },
      reçue: 'Candidature reçue le '
    },
    recruteur: {
      page: 'b2-recruteurs', titre: 'Demandes recruteurs', table: 'recruiter_requests', photos: null,
      champStatut: 'status', statuts: ['nouvelle', 'vue', 'traitée'], aPart: [], defaut: 'nouvelle',
      libelles: { nouvelle: 'Nouvelle', vue: 'Vue', 'traitée': 'Traitée' },
      reçue: 'Demande reçue le '
    }
  };
  const TONS = { nouvelle: 'erreur', 'en étude': 'alerte', 'en attente': 'info', retenue: 'ok', 'refusée': 'neutre', vue: 'alerte', 'traitée': 'ok' };
  const CHAMPS = {
    casting: [
      ['experience_mannequin', 'Parcours'], ['video_url', 'Vidéo de présentation'],
      ['email', 'E-mail'], ['phone', 'Téléphone'], ['genre', 'Genre'], ['civilite', 'Civilité'], ['city', 'Ville'], ['quartier', 'Quartier'], ['date_naissance', 'Date de naissance'],
      ['situation_scolaire', 'Situation scolaire'], ['niveau_etudes', 'Niveau d’études'],
      ['height_cm', 'Taille', 'cm'], ['weight_kg', 'Poids', 'kg'], ['clothing_size', 'Taille vêtements'], ['chest_cm', 'Poitrine', 'cm'], ['waist_cm', 'Taille (tour)', 'cm'],
      ['hips_cm', 'Tour de bassin', 'cm'], ['shoe_size', 'Pointure'],
      ['parent_nom', 'Nom du parent/tuteur'], ['parent_telephone', 'WhatsApp du parent/tuteur'], ['parent_email', 'E-mail du parent/tuteur']
    ],
    recruteur: [['company', 'Entreprise / marque'], ['email', 'E-mail'], ['phone', 'Téléphone'], ['whatsapp', 'WhatsApp'],
      ['city', 'Ville'], ['project_type', 'Type de projet'], ['event_date', 'Date souhaitée']]
  };
  const TEXTES_SPECIAUX = {
    experience_mannequin: { non: 'Débutant·e (jamais été mannequin)', oui: 'Déjà mannequin' },
    situation_scolaire: { 'en cours': 'Encore élève / étudiant(e)', "plus à l'école": 'N’est plus à l’école', 'jamais scolarisé(e)': 'Jamais scolarisé(e)' }
  };
  // Premier message quand le statut change (catalogue commun, comme « Messages groupés »)
  const PREMIER = { casting: { 'en étude': 'etude', 'en attente': 'attente', retenue: 'retenue', 'refusée': 'refusee' } };
  const MODELES_LIBRES = {
    recruteur_merci: { libelle: '🤝 Remerciement de la demande', sources: ['recruteur'],
      texte: (d) => 'Bonjour ' + (String(d.contact_name || '').trim() || 'Madame, Monsieur') + ',\n\nMerci pour votre demande auprès de Maître Akesse Model Management. Notre équipe l’étudie et revient vers vous très rapidement avec une proposition de profils.\n\nBien cordialement.' },
    libre: { libelle: '✏️ Message libre', sources: ['casting', 'recruteur'],
      texte: (d) => d.contact_name ? 'Bonjour ' + String(d.contact_name).trim() + ',\n\n' : 'Bonjour ' + (contactsEnvoi(d).parent ? salutationParent(d.parent_nom) : nomAvecCivilite(d)) + ',\n\n' }
  };

  // Réglages des dossiers lus par les Messages groupés (js/messages-groupes.js), au format de
  // l'ancien tableau de bord : table, champ du statut, statuts et libellés.
  window.MA2M_DOSSIERS = {
    casting: { table: 'casting_applications', statutChamp: 'status', statuts: SOURCES.casting.statuts, libellesStatut: SOURCES.casting.libelles },
    inscription: { table: 'inscriptions_mannequins', statutChamp: 'statut', statuts: ['en attente de paiement', 'dossier en vérification', 'payée', 'annulée'],
      libellesStatut: { 'en attente de paiement': 'Paiement à vérifier', 'dossier en vérification': 'Dossier en vérification', 'payée': 'Inscription validée', 'annulée': 'Refusée' } }
  };

  // ---------- Outils ----------
  const etat = (source) => (P.etat['dossiers-' + source] = P.etat['dossiers-' + source] || { filtre: SOURCES[source].defaut, pages: 1 });
  const lienWa = (numero) => { const n = numeroWhatsApp(numero); return n ? 'https://wa.me/' + n : null; };
  const contacts = (source, d) => source === 'casting' ? contactsEnvoi(d) : { parent: false, email: d.email || '', phone: d.whatsapp || d.phone };
  const nomDe = (source, d) => source === 'recruteur' ? (d.contact_name || d.company || 'Sans nom') : (d.full_name || 'Sans nom');
  const destinataire = (source, d) => { const c = contacts(source, d); return c.parent ? salutationParent(d.parent_nom) : (source === 'recruteur' ? nomDe(source, d) : nomAvecCivilite(d)); };
  const ageDe = (d) => { const a = P.age(d.date_naissance); return a === null || a === undefined ? null : a; };
  function typeDe(d) {
    if (d.type_candidature === 'projet') return d.projet_nom || 'Projet';
    if (d.type_candidature === 'agence') return 'Intégrer l’agence';
    if (d.type_candidature === 'direct') return 'Casting direct (agence)';
    return null;
  }
  const dateFr = (d) => new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Africa/Abidjan' });
  function meta(source, d) {
    if (source === 'recruteur') return [d.project_type, d.company, dateFr(d.created_at)].filter(Boolean).join(' · ');
    return [typeDe(d), d.experience_mannequin === 'non' ? 'Débutant·e' : null, d.city, dateFr(d.created_at)].filter(Boolean).join(' · ');
  }
  async function compter(conf, statut) {
    let q = sb.from(conf.table).select('id', { count: 'exact', head: true });
    if (statut) q = q.eq(conf.champStatut, statut);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  }
  // Photos d'un ou plusieurs dossiers : { idDossier: [{ id, chemin, url, affiche }] }
  async function photosDe(conf, ids) {
    if (!conf.photos || !ids.length) return {};
    const lignes = await P.bd(sb.from(conf.photos.table).select('id, chemin, url, ' + conf.photos.colonne).in(conf.photos.colonne, ids));
    const chemins = lignes.map((p) => p.chemin).filter(Boolean);
    const signees = {};
    if (chemins.length) {
      const { data } = await sb.storage.from(conf.photos.bucket).createSignedUrls(chemins, 3600);
      (Array.isArray(data) ? data : []).forEach((s) => { if (s.path && s.signedUrl) signees[s.path] = s.signedUrl; });
    }
    const parDossier = {};
    lignes.forEach((p) => {
      const affiche = p.chemin ? signees[p.chemin] : p.url;
      if (!affiche) return;
      (parDossier[p[conf.photos.colonne]] = parDossier[p[conf.photos.colonne]] || []).push(Object.assign({ affiche }, p));
    });
    return parDossier;
  }
  // Visage d'un dossier (photo jointe, sinon initiales) ; l'adresse est déjà prête (pas de urlLegere)
  const visageDossier = (url, nom, classe) => '<span class="vis ' + (classe || '') + '"><span class="ini" aria-hidden="true">' + P.esc(P.initiales(nom)) + '</span>' +
    (url ? '<img src="' + P.esc(url) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + '</span>';

  // ---------- Liste ----------
  async function liste(source) {
    const conf = SOURCES[source], e = etat(source);
    const [total, ...parStatut] = await Promise.all([compter(conf)].concat(conf.statuts.map((s) => compter(conf, s))));
    const nb = {};
    conf.statuts.forEach((s, i) => { nb[s] = parStatut[i]; });
    let q = sb.from(conf.table).select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (e.filtre !== 'toutes') q = q.eq(conf.champStatut, e.filtre);
    else if (conf.aPart.length) q = q.not(conf.champStatut, 'in', '(' + conf.aPart.map((x) => '"' + x + '"').join(',') + ')');
    const { data, count, error } = await q.range(0, e.pages * PAR_PAGE - 1);
    if (error) throw error;
    const dossiers = data || [];
    const photos = await photosDe(conf, dossiers.map((d) => d.id)).catch(() => ({}));
    const pastille = (s) => {
      const compte = s === 'toutes' ? total - conf.aPart.reduce((n, x) => n + (nb[x] || 0), 0) : (nb[s] || 0);
      return '<button type="button" class="btn petit' + (e.filtre === s ? ' actif' : '') + '" data-action="dossiers-filtre" data-source="' + source + '" data-filtre="' + P.esc(s) + '"' +
        (e.filtre === s ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' + P.esc(s === 'toutes' ? 'Toutes' : conf.libelles[s]) + ' <span class="nb">' + compte + '</span></button>';
    };
    const filtres = '<div class="segments">' + ['toutes'].concat(conf.statuts.filter((s) => !conf.aPart.includes(s))).map(pastille).join('') +
      (conf.aPart.length ? '<span class="a-part">À part :</span>' + conf.aPart.map(pastille).join('') : '') + '</div>';
    const cartes = dossiers.map((d, i) => {
      const c = contacts(source, d), wa = lienWa(c.phone), age = source === 'casting' ? ageDe(d) : null, ph = (photos[d.id] || [])[0];
      const statut = d[conf.champStatut];
      return '<article class="dossier-carte apparait" style="--i:' + Math.min(i, 12) + '">' +
        '<a class="dossier-lien" href="#/site/' + conf.page + '/' + P.esc(d.id) + '">' +
        (source === 'casting' ? visageDossier(ph && ph.affiche, nomDe(source, d), 'dossier-visage') : '<span class="dossier-sigle" aria-hidden="true">' + P.esc(P.initiales(nomDe(source, d))) + '</span>') +
        '<span class="dossier-texte"><span class="dossier-nom">' + P.esc(nomDe(source, d)) + (age !== null && age < 18 ? ' ' + P.pastille(d.genre === 'femme' ? 'Mineure' : 'Mineur', 'info') : '') + '</span>' +
        '<span class="dossier-meta">' + P.esc(meta(source, d)) + '</span>' +
        P.pastille(conf.libelles[statut] || statut || '', TONS[statut]) + '</span></a>' +
        (wa ? '<a class="dossier-wa" href="' + P.esc(wa) + '" target="_blank" rel="noopener" aria-label="WhatsApp ' + (c.parent ? 'du parent de ' : '') + P.esc(nomDe(source, d)) + '">' + (c.parent ? 'WhatsApp parent ↗' : 'WhatsApp ↗') + '</a>' : '') +
        '</article>';
    }).join('');
    const plus = count > dossiers.length ? '<button type="button" class="btn" data-action="dossiers-plus" data-source="' + source + '">Voir plus (' + (count - dossiers.length) + ' de plus)</button>' : '';
    return P.entete(conf.titre, '<span class="doux">' + total + ' au total</span>') + filtres +
      (cartes ? '<div class="dossiers-grille' + (source === 'recruteur' ? ' sans-visage' : '') + '">' + cartes + '</div>' + plus :
        '<div class="carte vide">Aucun dossier « ' + P.esc(e.filtre === 'toutes' ? 'toutes' : conf.libelles[e.filtre]) + ' » pour le moment.</div>');
  }
  P.actions['dossiers-filtre'] = (el) => { const e = etat(el.dataset.source); e.filtre = el.dataset.filtre; e.pages = 1; return P.afficher(); };
  P.actions['dossiers-plus'] = (el) => { etat(el.dataset.source).pages += 1; return P.afficher(); };

  // ---------- Fiche ----------
  let fiche = null; // { source, d, photos }
  function lienWaTexte(source, d, texte) { const l = lienWa(contacts(source, d).phone); return l ? l + '?text=' + encodeURIComponent(texte) : null; }
  function noteParent(source, d) { return contacts(source, d).parent ? ' Personne mineure : le message part vers son parent (' + salutationParent(d.parent_nom) + ').' : ''; }
  function modeleDe(cle) {
    if (cle.indexOf('c:') !== 0) return MODELES_LIBRES[cle] || null;
    const m = messageCandidatParCle(cle.slice(2));
    if (!m) return null;
    return { rdv: m.rdv, texte: (d) => personnaliserMessage(texteMessageCandidat(m, d, typeCandidature(d)), d, {
      date: (document.getElementById('dos-wa-date') || {}).value, heure: (document.getElementById('dos-wa-heure') || {}).value, lieu: (document.getElementById('dos-wa-lieu') || {}).value
    }, (k) => '[' + k + ' à préciser]') };
  }
  function modeleParDefaut(source, d) {
    if (source !== 'casting') return 'libre';
    const m = MESSAGES_CANDIDATS.find((x) => x.source === source && x.statut === d.status && x.groupe && !x.premier) ||
      MESSAGES_CANDIDATS.find((x) => x.source === source && x.statut === d.status && !x.premier);
    return m ? 'c:' + m.cle : 'libre';
  }
  function blocChamps(source, d) {
    const age = source === 'casting' ? ageDe(d) : null, mineur = age !== null && age < 18;
    const parentJoignable = mineur && d.parent_telephone;
    return '<dl class="champs">' + CHAMPS[source].map(([cle, libelle, unite]) => {
      const v = d[cle];
      if (!v) return '';
      const wa = (parentJoignable ? cle === 'parent_telephone' : (cle === 'phone' || cle === 'whatsapp')) ? lienWa(v) : null;
      const video = cle === 'video_url' && /^https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/view$/.test(String(v));
      const valeur = wa ? '<a href="' + P.esc(wa) + '" target="_blank" rel="noopener">' + P.esc(v) + ' ↗ WhatsApp</a>' :
        video ? '<a href="' + P.esc(v) + '" target="_blank" rel="noopener">▶ Voir la vidéo</a>' :
        P.esc((TEXTES_SPECIAUX[cle] && TEXTES_SPECIAUX[cle][v]) || (cle === 'date_naissance' ? P.date(v) + (age !== null ? ' (' + age + ' ans)' : '') : v)) + (unite ? ' ' + unite : '') +
        (parentJoignable && cle === 'phone' ? ' <small class="doux">(mineur : écrire au parent)</small>' : '');
      return '<div><dt>' + P.esc(libelle) + '</dt><dd>' + valeur + '</dd></div>';
    }).join('') + '</dl>';
  }
  function blocPhotos(source) {
    if (source !== 'casting') return '';
    const ph = fiche.photos;
    return '<section class="galerie-dossier" aria-label="Photos">' + (ph.length ? ph.map((p, i) =>
      '<figure class="photo-dossier apparait" style="--i:' + i + '"><button type="button" class="photo-ouvrir" data-action="dossier-photo-voir" data-index="' + i + '" aria-label="Agrandir la photo ' + (i + 1) + '">' +
      visageDossier(p.affiche, fiche.d.full_name) + '</button>' +
      '<figcaption><button type="button" class="btn petit" data-action="dossier-photo-remplacer" data-photo="' + P.esc(p.id) + '" aria-label="Remplacer la photo ' + (i + 1) + '">Remplacer</button>' +
      '<button type="button" class="btn petit" data-action="dossier-photo-supprimer" data-photo="' + P.esc(p.id) + '" aria-label="Supprimer la photo ' + (i + 1) + '">✕</button></figcaption></figure>').join('') :
      '<p class="doux galerie-vide">Aucune photo jointe.</p>') +
      '<label class="ajout-photo"><input type="file" accept="image/*" data-change="dossier-photo-ajouter" hidden><span class="btn">＋ Ajouter une photo</span></label>' +
      '<input type="file" accept="image/*" id="dos-photo-remplacement" data-change="dossier-photo-remplacement" hidden>' +
      '<p class="doux petit-texte" id="dos-photo-msg" role="status"></p></section>';
  }
  function blocStatut(source) {
    const conf = SOURCES[source], d = fiche.d;
    return '<section class="carte"><h2>Statut</h2><div class="segments statuts" role="group" aria-label="Statut du dossier">' + conf.statuts.map((s) =>
      '<button type="button" class="btn petit' + (d[conf.champStatut] === s ? ' actif' : '') + '" aria-pressed="' + (d[conf.champStatut] === s) + '" data-action="dossier-statut" data-statut="' + P.esc(s) + '">' + P.esc(conf.libelles[s]) + '</button>').join('') +
      '</div><div id="dos-notification"></div></section>';
  }
  function blocWhatsApp(source) {
    const d = fiche.d;
    if (!lienWa(contacts(source, d).phone)) return '';
    const options = MESSAGES_CANDIDATS.filter((m) => m.source === source && !m.premier).map((m) => '<option value="c:' + m.cle + '">' + P.esc(m.libelle) + '</option>').join('') +
      Object.keys(MODELES_LIBRES).filter((k) => MODELES_LIBRES[k].sources.includes(source)).map((k) => '<option value="' + k + '">' + P.esc(MODELES_LIBRES[k].libelle) + '</option>').join('');
    const rdv = infosRdvMemorisees();
    return '<section class="carte"><h2>Écrire sur WhatsApp</h2><div class="grille" style="gap:12px">' +
      '<label class="fl" for="dos-wa-modele">Message<select id="dos-wa-modele" data-change="dossier-wa-modele">' + options + '</select></label>' +
      '<div class="rdv" id="dos-wa-rdv" hidden><label class="fl" for="dos-wa-date">Date<input type="date" id="dos-wa-date" value="' + P.esc(dimancheSuivantISO()) + '"></label>' +
      '<label class="fl" for="dos-wa-heure">Heure<input id="dos-wa-heure" value="' + P.esc(rdv.heure) + '"></label>' +
      '<label class="fl" for="dos-wa-lieu">Lieu<input id="dos-wa-lieu" value="' + P.esc(rdv.lieu) + '"></label></div>' +
      '<label class="fl" for="dos-wa-texte">Texte (modifiable)<textarea id="dos-wa-texte" rows="9"></textarea></label>' +
      '<div class="ligne"><a class="btn rouge" id="dos-wa-ouvrir" target="_blank" rel="noopener" href="#">Ouvrir WhatsApp avec ce message</a>' +
      (source === 'casting' && contacts(source, d).email ? '<button type="button" class="btn" data-action="dossier-wa-email">✉️ Envoyer aussi par e-mail</button>' : '') + '</div>' +
      '<p class="doux petit-texte" id="dos-wa-statut" role="status">WhatsApp s’ouvre avec le message déjà écrit : il ne reste qu’à appuyer sur « Envoyer ».' + P.esc(noteParent(source, d)) + '</p></div></section>';
  }
  async function blocMannequinsChoisis() {
    const choisis = await P.bd(sb.from('recruiter_request_models').select('id, model_id, model_name_snapshot, model_height_snapshot').eq('request_id', fiche.d.id));
    const photos = await P.photosCouverture(choisis.map((m) => m.model_id).filter(Boolean)).catch(() => ({}));
    return '<section class="carte"><h2>Mannequins choisis par le recruteur</h2>' + (choisis.length ? '<div class="choisis">' + choisis.map((m) =>
      '<div class="choisi">' + P.visage(photos[m.model_id], m.model_name_snapshot, 'choisi-visage') +
      '<span><b>' + P.esc(m.model_name_snapshot || 'Mannequin') + '</b>' + (m.model_height_snapshot ? '<small>' + P.esc(m.model_height_snapshot) + ' cm</small>' : '') +
      (m.model_id ? '<a href="/mannequin.html?id=' + P.esc(m.model_id) + '" target="_blank" rel="noopener">Voir la fiche ↗</a>' : '') + '</span>' +
      '<button type="button" class="btn petit" data-action="dossier-retirer-mannequin" data-choix="' + P.esc(m.id) + '" aria-label="Retirer ' + P.esc(m.model_name_snapshot || 'ce mannequin') + ' de la sélection">✕</button></div>').join('') + '</div>' :
      '<p class="doux">Aucun mannequin dans cette sélection.</p>') + '</section>';
  }
  async function blocCode() {
    const d = fiche.d;
    if (fiche.source !== 'casting' || d.status !== 'retenue') return '';
    const codes = await P.bd(sb.from('codes_inscription').select('code, utilise, utilise_le').eq('candidature_id', d.id)).catch(() => []);
    const libre = codes.find((c) => !c.utilise), utilise = codes.find((c) => c.utilise);
    let corps;
    if (utilise && !libre) corps = '<p>Code ' + P.esc(utilise.code) + ' utilisé le ' + P.date(utilise.utilise_le || new Date().toISOString()) + ' : l’inscription est faite.</p>';
    else if (libre) {
      const wa = lienWhatsAppCode(d, libre.code);  // js/messages-candidats.js
      corps = '<p class="code-valeur"><strong id="dos-code">' + P.esc(libre.code) + '</strong> — valable une seule fois</p><div class="ligne">' +
        '<button type="button" class="btn" data-action="dossier-code-copier">Copier</button>' +
        (wa ? '<a class="btn rouge" href="' + P.esc(wa) + '" target="_blank" rel="noopener">💬 Envoyer par WhatsApp</a>' : '') + '</div>';
    } else corps = '<p class="doux">Pas encore de code. Créez-le seulement quand la personne montre son intérêt pour s’inscrire.</p>' +
      '<button type="button" class="btn rouge" data-action="dossier-code-creer">La personne veut s’inscrire : créer son code</button>';
    return '<section class="carte code-zone"><h2>Code d’inscription</h2>' + corps + '</section>';
  }
  async function pageFiche(source, id) {
    const conf = SOURCES[source];
    const d = await P.bd(sb.from(conf.table).select('*').eq('id', id).maybeSingle());
    if (!d) return P.entete(conf.titre) + '<div class="carte"><h2>Dossier introuvable</h2><p class="doux">Il a peut-être été supprimé.</p><a class="btn" href="#/site/' + conf.page + '">← Retour à la liste</a></div>';
    fiche = { source, d, photos: [] };
    if (conf.photos) fiche.photos = (await photosDe(conf, [d.id]).catch(() => ({})))[d.id] || [];
    const age = source === 'casting' ? ageDe(d) : null, mineur = age !== null && age < 18;
    const type = source === 'casting' ? typeDe(d) : null;
    return '<a class="retour-liste" href="#/site/' + conf.page + '">← ' + P.esc(conf.titre) + '</a>' +
      '<header class="fiche-tete"><div><h1>' + P.esc(nomDe(source, d)) + (mineur ? ' ' + P.pastille((d.genre === 'femme' ? 'Mineure' : 'Mineur') + ' — ' + age + ' ans', 'info') : '') + '</h1>' +
      '<p class="doux">' + P.esc(conf.reçue + dateFr(d.created_at) + (type ? ' · Postule pour : ' + type : '')) + '</p></div>' +
      P.pastille(conf.libelles[d[conf.champStatut]] || d[conf.champStatut] || '', TONS[d[conf.champStatut]]) + '</header>' +
      blocPhotos(source) +
      '<div class="fiche-grille"><div class="fiche-col">' + blocStatut(source) + blocWhatsApp(source) + (await blocCode()) + '</div>' +
      '<div class="fiche-col"><section class="carte"><h2>Informations</h2>' + blocChamps(source, d) +
      (d.message ? '<blockquote class="message-dossier">' + P.esc(d.message) + '</blockquote>' : '') + '</section>' +
      (source === 'recruteur' ? await blocMannequinsChoisis() : '') +
      '<section class="carte zone-danger"><h2>Supprimer</h2><p class="doux petit-texte">Supprime définitivement ce dossier' + (conf.photos ? ' et ses photos enregistrées sur le site (les copies Google Drive restent)' : '') + '.</p>' +
      '<button type="button" class="btn" data-action="dossier-supprimer">🗑 Supprimer ce dossier</button></section></div></div>';
  }
  function apresFiche() {
    if (!fiche) return;
    const sel = document.getElementById('dos-wa-modele');
    if (sel) { sel.value = modeleParDefaut(fiche.source, fiche.d); majWhatsApp(true); }
  }
  function majWhatsApp(regenerer) {
    const sel = document.getElementById('dos-wa-modele');
    if (!sel || !fiche) return;
    const modele = modeleDe(sel.value);
    if (!modele) return;
    document.getElementById('dos-wa-rdv').hidden = !modele.rdv;
    const zone = document.getElementById('dos-wa-texte');
    if (regenerer) zone.value = modele.texte(fiche.d);
    document.getElementById('dos-wa-ouvrir').href = lienWaTexte(fiche.source, fiche.d, zone.value) || '#';
  }
  P.changements['dossier-wa-modele'] = () => majWhatsApp(true);
  document.addEventListener('input', (e) => {
    if (!fiche || !e.target.id) return;
    if (e.target.id === 'dos-wa-texte') majWhatsApp(false);
    if (['dos-wa-date', 'dos-wa-heure', 'dos-wa-lieu'].includes(e.target.id)) {
      memoriserInfosRdv(document.getElementById('dos-wa-heure').value, document.getElementById('dos-wa-lieu').value);
      majWhatsApp(true);
    }
    if (e.target.id === 'dos-notif-texte') {
      const a = document.getElementById('dos-notif-wa');
      if (a) a.href = lienWaTexte(fiche.source, fiche.d, e.target.value) || '#';
    }
  });
  async function envoyerEmail(texte, statutEl) {
    const d = fiche.d, c = contacts(fiche.source, d);
    if (!c.email) { statutEl.textContent = 'Aucune adresse e-mail sur ce dossier : envoyez plutôt par WhatsApp.'; return false; }
    statutEl.textContent = 'Envoi en cours…';
    try {
      await envoyerEmailCandidat({ to_email: c.email, to_name: destinataire(fiche.source, d), message: messagePourEmail(texte) });
      statutEl.textContent = 'E-mail envoyé à ' + c.email + '.';
      return true;
    } catch (err) {
      statutEl.textContent = 'L’e-mail n’est pas parti' + (err && err.text ? ' (' + err.text + ')' : '') + '. Réessayez.';
      return false;
    }
  }
  P.actions['dossier-wa-email'] = () => {
    const texte = document.getElementById('dos-wa-texte').value, st = document.getElementById('dos-wa-statut');
    if (/\[(date|heure|lieu) à préciser\]/.test(texte)) { st.textContent = 'Remplissez la date, l’heure et le lieu avant d’envoyer.'; return; }
    return envoyerEmail(texte, st);
  };
  // Changement de statut : enregistré, puis premier message proposé et e-mail parti tout seul
  P.actions['dossier-statut'] = async (el) => {
    const conf = SOURCES[fiche.source], nouveau = el.dataset.statut, d = fiche.d;
    if (d[conf.champStatut] === nouveau) return;
    const r = await P.bd(sb.from(conf.table).update({ [conf.champStatut]: nouveau }).eq('id', d.id).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    d[conf.champStatut] = nouveau;
    document.querySelectorAll('.statuts .btn').forEach((b) => { const oui = b.dataset.statut === nouveau; b.classList.toggle('actif', oui); b.setAttribute('aria-pressed', String(oui)); });
    const tete = document.querySelector('.fiche-tete > .pastille');
    if (tete) { tete.className = 'pastille ' + (TONS[nouveau] || 'neutre'); tete.textContent = conf.libelles[nouveau]; }
    P.message('Statut : ' + conf.libelles[nouveau] + '.');
    const zone = document.getElementById('dos-notification');
    const cle = PREMIER[fiche.source] && PREMIER[fiche.source][nouveau];
    // la zone du code d'inscription suit le statut « Retenue »
    if (fiche.source === 'casting') void rafraichirCode();
    if (!cle) { zone.innerHTML = ''; return; }
    const texte = personnaliserMessage(texteMessageCandidat(messageCandidatParCle(cle), d, typeCandidature(d)), d, {}, () => '');
    const wa = lienWaTexte(fiche.source, d, texte), c = contacts(fiche.source, d);
    zone.innerHTML = '<div class="notification apparait"><p class="doux petit-texte">Message pour ce nouveau statut (modifiable avant envoi) :' + P.esc(noteParent(fiche.source, d)) + '</p>' +
      '<textarea id="dos-notif-texte" rows="8" aria-label="Message pour le nouveau statut">' + P.esc(texte) + '</textarea>' +
      '<div class="ligne"><button type="button" class="btn" data-action="dossier-notif-email">✉️ ' + (c.email ? 'Renvoyer l’e-mail' : 'Envoyer l’e-mail') + '</button>' +
      (wa ? '<a class="btn rouge" id="dos-notif-wa" href="' + P.esc(wa) + '" target="_blank" rel="noopener">💬 Envoyer par WhatsApp</a>' : '') + '</div>' +
      '<p class="doux petit-texte" id="dos-notif-statut" role="status"></p></div>';
    if (c.email) {
      const st = document.getElementById('dos-notif-statut');
      st.textContent = 'Envoi automatique de l’e-mail en cours…';
      if (await envoyerEmail(texte, st)) st.textContent = 'E-mail envoyé automatiquement à ' + c.email + '. Vous pouvez le modifier et le renvoyer, ou l’envoyer aussi par WhatsApp.';
    }
  };
  P.actions['dossier-notif-email'] = () => envoyerEmail(document.getElementById('dos-notif-texte').value, document.getElementById('dos-notif-statut'));
  async function rafraichirCode() {
    const ancien = document.querySelector('.fiche-col .carte.code-zone');
    const html = await blocCode();
    const col = document.querySelector('.fiche-col');
    if (ancien) ancien.remove();
    if (html && col) col.insertAdjacentHTML('beforeend', html);
  }
  P.actions['dossier-code-creer'] = async (el) => {
    el.disabled = true;
    try { await P.rpc('code_individuel_creer', { p_candidature: fiche.d.id }); }
    catch (e) { el.disabled = false; P.message('Code non créé : ' + P.erreurTexte(e)); return; }
    await rafraichirCode();
  };
  P.actions['dossier-code-copier'] = (el) => {
    const code = document.getElementById('dos-code').textContent, avant = el.textContent;
    navigator.clipboard.writeText(code).then(() => { el.textContent = 'Copié !'; setTimeout(() => { el.textContent = avant; }, 1500); },
      () => { el.textContent = 'Copie impossible : sélectionnez le code'; setTimeout(() => { el.textContent = avant; }, 2500); });
  };
  // Photos : agrandir, ajouter (Google Drive), remplacer, supprimer
  P.actions['dossier-photo-voir'] = (el) => { if (typeof ouvrirGalerieLightbox === 'function') ouvrirGalerieLightbox(fiche.photos.map((p) => p.affiche), Number(el.dataset.index)); };
  async function envoyerVersDrive(fichier) {
    const d = fiche.d;
    const r = await envoyerPhotosVersDrive(URL_SCRIPT_PHOTOS_CASTING, { nom: d.full_name, email: d.email || '', phone: d.phone || '', type: d.type_candidature || 'agence', projet: d.projet_nom || '', photos: [await fichierEnBase64(fichier)] });
    if (r.echec || !r.liens || !r.liens.length) throw new Error('le script Google n’a renvoyé aucun lien');
    return r.liens[0];
  }
  async function rechargerPhotos(message) {
    const conf = SOURCES[fiche.source];
    fiche.photos = (await photosDe(conf, [fiche.d.id]))[fiche.d.id] || [];
    const zone = document.querySelector('.galerie-dossier');
    if (zone) zone.outerHTML = blocPhotos(fiche.source);
    if (message) document.getElementById('dos-photo-msg').textContent = message;
  }
  P.changements['dossier-photo-ajouter'] = async (el) => {
    const fichier = el.files[0]; el.value = '';
    if (!fichier) return;
    const msg = document.getElementById('dos-photo-msg'), conf = SOURCES[fiche.source];
    msg.textContent = 'Envoi vers Google Drive…';
    try {
      const lien = await envoyerVersDrive(fichier);
      const r = await P.bd(sb.from(conf.photos.table).insert({ [conf.photos.colonne]: fiche.d.id, url: lien, chemin: null }).select('id'));
      if (!r || !r.length) throw new Error('la photo n’a pas été rattachée au dossier : reconnectez-vous puis réessayez');
      await rechargerPhotos('Photo ajoutée.');
    } catch (e) { msg.textContent = 'Échec de l’envoi : ' + P.erreurTexte(e); }
  };
  let aRemplacer = null;
  P.actions['dossier-photo-remplacer'] = (el) => { aRemplacer = fiche.photos.find((p) => String(p.id) === el.dataset.photo) || null; document.getElementById('dos-photo-remplacement').click(); };
  P.changements['dossier-photo-remplacement'] = async (el) => {
    const fichier = el.files[0]; el.value = '';
    const photo = aRemplacer; aRemplacer = null;
    if (!fichier || !photo) return;
    const msg = document.getElementById('dos-photo-msg'), conf = SOURCES[fiche.source];
    msg.textContent = 'Envoi de la photo de remplacement…';
    try {
      const lien = await envoyerVersDrive(fichier);
      // la base d'abord, l'ancien fichier ensuite (jamais de photo cassée si la base refuse)
      const r = await P.bd(sb.from(conf.photos.table).update({ url: lien, chemin: null }).eq('id', photo.id).select('id'));
      if (!r || !r.length) throw new Error('la photo n’a pas été remplacée : reconnectez-vous puis réessayez');
      if (photo.chemin) await sb.storage.from(conf.photos.bucket).remove([photo.chemin]);
      await rechargerPhotos('Photo remplacée.');
    } catch (e) { msg.textContent = 'Échec du remplacement : ' + P.erreurTexte(e); }
  };
  P.actions['dossier-photo-supprimer'] = async (el) => {
    if (!confirm('Supprimer définitivement cette photo ? Cette action est irréversible.')) return;
    const conf = SOURCES[fiche.source], photo = fiche.photos.find((p) => String(p.id) === el.dataset.photo);
    if (!photo) return;
    el.disabled = true;
    // la base d'abord, le fichier ensuite (une ligne sans fichier ne se voit pas ; l'inverse si)
    const r = await P.bd(sb.from(conf.photos.table).delete().eq('id', photo.id).select('id'));
    if (!r || !r.length) { el.disabled = false; P.message('Rien n’a été supprimé : reconnectez-vous puis réessayez.'); return; }
    if (photo.chemin) await sb.storage.from(conf.photos.bucket).remove([photo.chemin]);
    await rechargerPhotos('Photo supprimée.');
  };
  P.actions['dossier-retirer-mannequin'] = async (el) => {
    if (!confirm('Retirer ce mannequin de la sélection de ce recruteur ?')) return;
    const r = await P.bd(sb.from('recruiter_request_models').delete().eq('id', el.dataset.choix).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été retiré : reconnectez-vous puis réessayez.'); return; }
    el.closest('.choisi').remove();
  };
  P.actions['dossier-supprimer'] = async (el) => {
    const conf = SOURCES[fiche.source];
    if (!confirm('Supprimer définitivement ce dossier' + (conf.photos ? ' et toutes ses photos' : '') + ' ? Cette action est irréversible.')) return;
    el.disabled = true;
    // la base d'abord, les fichiers ensuite : si la base refuse, les photos restent intactes
    const chemins = conf.photos ? fiche.photos.map((p) => p.chemin).filter(Boolean) : [];
    try {
      const r = await P.bd(sb.from(conf.table).delete().eq('id', fiche.d.id).select('id'));
      if (!r || !r.length) throw new Error('rien n’a été supprimé : reconnectez-vous puis réessayez');
    } catch (e) { el.disabled = false; P.message('Erreur : ' + P.erreurTexte(e)); return; }
    if (chemins.length) await sb.storage.from(conf.photos.bucket).remove(chemins).catch(() => { /* fichiers orphelins : sans effet visible */ });
    P.message('Dossier supprimé.');
    location.hash = '#/site/' + conf.page;
  };

  // ---------- Branchement dans le bloc 1 ----------
  Object.keys(SOURCES).forEach((source) => {
    const conf = SOURCES[source];
    P.espaces.site.pages[conf.page] = (args) => (args && args[0] ? pageFiche(source, decodeURIComponent(args[0])) : liste(source));
    P.espaces.site.apres[conf.page] = () => { if (location.hash.split('/').length > 3) apresFiche(); else fiche = null; };
  });
})();
