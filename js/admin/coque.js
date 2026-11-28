// Nouvelle Administration « vivante » (PLAN-NOUVELLE-ADMINISTRATION.md, 22/10/2026) : la
// décoration de la maison. La connexion, les droits et l'aiguillage restent dans
// js/portail/noyau.js (les fondations) ; ce fichier remplace seulement P.coque (en-tête, menu,
// barre du bas sur téléphone) et P.vuePortail (l'accueil vivant), et apporte les visages.
(function () {
  'use strict';
  const P = window.Portail;
  if (!P) return;

  // ---------- Visages (vignettes légères des photos du Book, js/photos.js) ----------
  // « 1 photo », « 3 photos » (jamais « photo(s) »)
  P.pluriel = (n, un, plusieurs) => n + ' ' + (n > 1 ? plusieurs : un);
  // (la civilité devant le nom ne compte pas : « Mademoiselle GRÂCE YAO » → GY)
  P.initiales = initialesNom;  // (js/app.js)
  // (13/11/2026) distant : photo hébergée ailleurs (Google Drive : candidatures casting, cours de talons), telle quelle,
  // sans envoyer l'adresse de la page (Drive refuse sinon certaines vignettes)
  P.visage = (url, nom, classe, distant) => '<span class="vis ' + (classe || '') + '"><span class="ini" aria-hidden="true">' + P.esc(P.initiales(nom)) + '</span>' +
    (url ? '<img src="' + P.esc(distant ? url : urlLegere(url)) + '" alt="" loading="lazy" decoding="async"' + (distant ? ' referrerpolicy="no-referrer"' : '') + '>' : '') + '</span>';
  P.visageDistant = (url, nom, classe) => P.visage(url, nom, classe, true);

  // (15/11/2026, maquettes/URGENT-photos-candidatures.md) Filet de sécurité des photos envoyées vers Google Drive,
  // partagé par les candidatures (js/admin/site-dossiers.js) et les cours de talons (js/admin/site-cours-talons.js) :
  // un dossier sans photo affiche « Photos dans Drive », le lien du dossier s'il est connu, et le bouton « Récupérer
  // les photos depuis Drive » (la base demande au programme Google de retrouver le dossier et d'y rattacher les
  // photos : medias_drive_relancer, supabase-medias-drive.sql). source : 'candidature' ou 'cours_talons'.
  // (16/11/2026, L-17) photos des candidatures et des cours de talons rangées chez Cloudflare R2 (« r2:… ») :
  // adresses de lecture signées d'1 heure demandées au serveur (api/r2-presigner.js), suppression au clic.
  // Partagé par js/admin/site-dossiers.js et js/admin/site-cours-talons.js.
  // (17/11/2026, L-18, demande de la propriétaire) vidéo de candidature ou de cours de talons LUE DANS LA FICHE, comme
  // une photo, au lieu d'un simple lien (lecteurs autorisés par frame-src de l'Administration, vercel.json). Les vidéos
  // restent où elles sont (Drive…). Lien « Ouvrir la vidéo » gardé en secours.
  // Adresse du lecteur intégré pour TOUTE vidéo envoyée (17/11, demande de la propriétaire : « valable pour tous ceux
  // qui envoient des vidéos ») : Google Drive (…/file/d/<id>/view ou /preview, open?id=, uc?id=), YouTube et Vimeo
  // (urlVideoIntegree, js/publications-lecture.js, déjà utilisée par les actualités). null si non reconnue.
  const RE_DRIVE = [/^https:\/\/drive\.google\.com\/file\/d\/([\w-]{6,120})(?:\/(?:view|preview|edit))?(?:[?#].*)?$/, /^https:\/\/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([\w-]{6,120})(?:&.*)?$/];
  P.adresseLecteur = (u) => {
    const t = String(u || '').trim();
    for (const re of RE_DRIVE) { const m = re.exec(t); if (m) return 'https://drive.google.com/file/d/' + m[1] + '/preview'; }
    const autre = /^https:\/\//.test(t) && typeof urlVideoIntegree === 'function' ? urlVideoIntegree(t) : null;
    return autre && /^https:\/\/(www\.youtube\.com|player\.vimeo\.com)\//.test(autre) ? autre : null;
  };
  P.estVideoDrive = (u) => !!P.adresseLecteur(u);   // (nom historique : toute vidéo que le lecteur sait lire)
  // (17/11/2026, demande de la propriétaire) la vidéo en GRAND, avec « ⛶ Plein écran » qui reste dans l'Administration.
  // Le plein écran est un calque posé sur la page entière (hors des cartes animées, sinon iPhone le coince dans la carte),
  // avec le plein écran du téléphone ou de l'ordinateur quand il est permis. Un petit lien de secours garde l'original
  // (vidéo privée, encore en traitement…). Partagé par les candidatures et les cours de talons.
  P.lecteurVideo = function (u) {
    const src = P.adresseLecteur(u);
    if (!src) return '';
    return '<div class="lecteur-video-bloc"><iframe class="lecteur-video" src="' + P.esc(src) + '" title="Vidéo envoyée" loading="lazy" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>' +
      '<button type="button" class="btn petit lecteur-plein" data-action="video-plein-ecran" data-video="' + P.esc(u) + '">⛶ Plein écran</button>' +
      '<a class="lecteur-secours" href="' + P.esc(u) + '" target="_blank" rel="noopener">La vidéo ne se lit pas ? Ouvrir l’original</a></div>';
  };
  P.fermerVideo = () => {
    const calque = document.getElementById('video-plein-calque');
    if (!calque) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { /* déjà sorti */ });
    calque.remove(); document.body.classList.remove('video-pleine');
  };
  P.actions['video-plein-ecran'] = (el) => {
    const src = P.adresseLecteur(el.dataset.video);
    if (!src) return;
    P.fermerVideo();
    const calque = document.createElement('div');
    calque.id = 'video-plein-calque'; calque.className = 'video-plein-calque';
    calque.setAttribute('role', 'dialog'); calque.setAttribute('aria-modal', 'true'); calque.setAttribute('aria-label', 'Vidéo en plein écran');
    calque.innerHTML = '<iframe class="lecteur-video" src="' + P.esc(src) + '" title="Vidéo en plein écran" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>' +
      '<button type="button" class="btn lecteur-fermer" data-action="video-fermer">✕ Fermer</button>';
    document.body.appendChild(calque); document.body.classList.add('video-pleine');
    calque.querySelector('.lecteur-fermer').focus();
    if (calque.requestFullscreen) calque.requestFullscreen().catch(() => { /* refusé : le calque couvre déjà la page */ });
  };
  P.actions['video-fermer'] = () => P.fermerVideo();
  // sortie du plein écran du navigateur, Échap, ou changement de page : le calque part, la page défile de nouveau
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) P.fermerVideo(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') P.fermerVideo(); });
  addEventListener('hashchange', () => P.fermerVideo());
  // partagé par js/admin/site-dossiers.js et js/admin/site-cours-talons.js
  P.photosR2 = {
    est: (c) => typeof c === 'string' && /^r2:(candidatures|cours-talons)\//.test(c),
    // (relecture du superviseur, 17/11 02 h 15 : règle simple, rien n'est jamais supprimé) N photos Cloudflare et M copies
    // Drive dans un même dossier : si M ≤ N, les copies Drive sont cachées (ce sont des copies) ; si M > N, tout est
    // montré (au pire un doublon, jamais une photo cachée). Partagé par les candidatures et les cours de talons.
    cacherDrive: (nbR2, nbDrive) => nbR2 > 0 && nbDrive <= nbR2,
    // copie Drive : un lien https sans chemin de stockage (une seule définition, règle n° 5)
    estCopieDrive: (lien, chemin) => !chemin && typeof lien === 'string' && /^https:\/\/[^\s"<>]+$/.test(lien),
    // (dernière passe du superviseur, 17/11 03 h) photos d'UN dossier → celles à montrer. elements : [{ r2, drive,
    // affiche }]. N ne compte que les photos Cloudflare qui ont reçu leur adresse signée : si le serveur de photos est
    // injoignable, les copies Drive s'affichent (la galerie n'est jamais vide). Partagé par les deux pages.
    filtrer(elements) {
      const n = elements.filter((e) => e.r2 && e.affiche).length, m = elements.filter((e) => e.drive).length;
      const cacher = P.photosR2.cacherDrive(n, m);
      return elements.filter((e) => e.affiche && !(e.drive && cacher));
    },
    async appel(corps) {
      const jeton = await jetonSessionCourante();
      const rep = await fetch('/api/r2-presigner', { method: 'POST', headers: enTetesServeur(jeton), body: JSON.stringify(corps) });
      const r = await rep.json().catch(() => ({}));
      if (!rep.ok) throw new Error(r.error || 'Photos indisponibles pour le moment.');
      return r;
    },
    // chemins « r2:… » → { chemin: adresse signée } (serveur injoignable : ces photos ne s'affichent pas cette fois)
    async adresses(chemins) {
      const liste = [...new Set(chemins.filter(P.photosR2.est).map((c) => c.slice(3)))], adresses = {};
      for (let i = 0; i < liste.length; i += 200) {
        try { Object.assign(adresses, (await P.photosR2.appel({ action: 'candidature_lire', chemins: liste.slice(i, i + 200) })).adresses || {}); }
        catch (e) { /* rien n'est perdu */ }
      }
      const parChemin = {};
      Object.keys(adresses).forEach((c) => { parChemin['r2:' + c] = adresses[c]; });
      return parChemin;
    },
    supprimer: (chemins) => P.photosR2.appel({ action: 'candidature_supprimer', chemins: chemins.filter(P.photosR2.est).map((c) => c.slice(3)) })
  };
  P.drive = {
    // identifiant du dossier Drive de chaque référence (ceux connus de la base), { ref: idDossier }
    async dossiers(refs) {
      if (!refs.length) return {};
      const { data, error } = await sb.from('medias_drive').select('ref, lien').eq('genre', 'dossier').in('ref', refs).order('id');
      const parRef = {};
      if (!error) (data || []).forEach((x) => { if (!parRef[x.ref]) parRef[x.ref] = x.lien; });
      return parRef;
    },
    encart(source, ref, dossierId) {
      const lien = /^[\w-]{6,120}$/.test(String(dossierId || '')) ? 'https://drive.google.com/drive/folders/' + dossierId : '';
      return '<div class="drive-secours"><p><strong>📁 Photos dans Drive</strong> · aucune photo n’est encore rattachée à ce dossier.' +
        (lien ? '' : ' <span class="doux">(Dossier Drive pas encore connu du site.)</span>') + '</p><div class="ligne">' +
        (lien ? '<a class="btn petit" href="' + P.esc(lien) + '" target="_blank" rel="noopener noreferrer">Ouvrir le dossier Drive ↗</a>' : '') +
        '<button type="button" class="btn petit rouge" data-action="drive-recuperer" data-source="' + P.esc(source) + '" data-ref="' + P.esc(ref) + '">Récupérer les photos depuis Drive</button></div>' +
        '<p class="doux petit-texte" role="status" data-drive-msg></p></div>';
    },
    async nbPhotos(source, ref) {
      if (source === 'candidature') {
        const { data } = await sb.from('casting_photos').select('id').eq('application_id', ref);
        return (data || []).length;
      }
      const { data } = await sb.from('cours_talons').select('photos').eq('id', ref).maybeSingle();
      return data && Array.isArray(data.photos) ? data.photos.length : 0;
    }
  };
  P.actions['drive-recuperer'] = async (el) => {
    const source = el.dataset.source, ref = el.dataset.ref;
    const msg = (el.closest('.drive-secours') || document).querySelector('[data-drive-msg]');
    const dire = (t) => { if (msg) msg.textContent = t; };
    el.disabled = true;
    dire('Recherche dans Google Drive…');
    const { data, error } = await sb.rpc('medias_drive_relancer', { p_source: source, p_ref: ref });
    if (error) { el.disabled = false; dire('Recherche impossible : ' + (error.message || 'erreur inconnue') + '. Ouvrez le dossier Drive.'); return; }
    if (data === false) { el.disabled = false; dire('Le programme Google n’est pas encore mis à jour : ouvrez le dossier Drive en attendant.'); return; }
    // le programme Google cherche puis enregistre lui-même ce qu'il trouve (quelques secondes) : on regarde toutes les 4 s,
    // tant que l'agence reste sur cette page (ailleurs, on ne redessine rien : elle écrit peut-être autre chose)
    const ici = location.hash;
    for (let essai = 0; essai < 15; essai++) {
      await new Promise((r) => setTimeout(r, 4000));
      if (location.hash !== ici || !el.isConnected) return;
      const nb = await P.drive.nbPhotos(source, ref).catch(() => 0);
      if (nb) { dire(nb + ' photo' + (nb > 1 ? 's récupérées' : ' récupérée') + ' ✓'); setTimeout(() => { if (location.hash === ici) P.afficher(); }, 900); return; }
    }
    el.disabled = false;
    dire('Aucune photo trouvée dans Drive pour l’instant. Réessayez dans quelques minutes, ou demandez les photos sur WhatsApp.');
  };
  // Grille de cases à cocher avec visages (Programmation défilé, Informations agence) : un titre, le
  // nombre, les personnes par ordre alphabétique ; attributs(x) = ce que porte la case de chacune
  P.casesVisages = (titre, l, attributs) => {
    l = l.slice().sort((a, b) => String(a.nom).localeCompare(String(b.nom)));
    return l.length ? '<h3>' + P.esc(titre) + ' <span class="doux">(' + l.length + ')</span></h3><div class="df-choix">' + l.map((x) =>
      '<label class="df-choix-carte"><input type="checkbox" ' + attributs(x) + '>' + P.visage(x.photo, x.nom, 'df-vis') + '<span>' + P.esc(x.nom) + '</span></label>').join('') + '</div>' : '';
  };
  // une photo affichée apparaît en fondu (l'évènement « load » ne remonte pas : capture)
  document.addEventListener('load', (e) => {
    if (e.target.tagName === 'IMG' && e.target.parentNode && e.target.parentNode.classList && e.target.parentNode.classList.contains('vis')) e.target.classList.add('charge');
  }, true);
  // ---------- Étudier une à une, en grand (12/11/2026) : morceaux communs ----------
  // Candidatures et Demandes recruteurs (js/admin/site-dossiers.js), Validations en attente (site-mannequins.js),
  // Paiements à valider (js/portail/espace-paiements.js) : même écran, mêmes gestes.
  P.etude = {
    LIMITE: 500,  // (une file plus longue s'étudie en plusieurs fois)
    taille: (cm) => window.Partage.enMetres(cm),  // (js/partage.js)
    // une photo qui s'agrandit d'un appui (les adresses de la file sont dans P.etude.galerie)
    diapo: (url, nom, i) => '<button type="button" class="etude-photo" data-action="etude-photo-voir" data-index="' + i + '" aria-label="Agrandir la photo ' + (i + 1) + '">' +
      '<span class="vis"><span class="ini" aria-hidden="true">' + P.esc(P.initiales(nom)) + '</span>' +
      (url ? '<img src="' + P.esc(url) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + '</span></button>',
    galerie: [],
    // le grand cadre : diapositives qui défilent (avec leurs points), sinon « centre » (ex. le montant), sinon les initiales
    haut: (diapos, nom, sous, centre) => '<div class="etude-photos apparait' + (centre ? ' etude-somme' : '') + '">' +
      (diapos.length ? '<div class="etude-piste" id="etude-piste">' + diapos.join('') + '</div>' +
          (diapos.length > 1 ? '<div class="etude-points" aria-hidden="true">' + diapos.map((x, i) => '<i' + (i ? '' : ' class="actif"') + '></i>').join('') + '</div>' : '')
        : centre || '<div class="etude-piste">' + P.visage('', nom) + '</div>') +
      '<div class="etude-voile"><b>' + P.esc(nom) + '</b><small>' + P.esc(sous.filter(Boolean).join(' · ')) + '</small></div></div>',
    infos: (l, apres) => { const h = l.filter(Boolean).map((x) => '<span>' + P.esc(x) + '</span>').join('') + (apres || ''); return h ? '<div class="etude-infos">' + h + '</div>' : ''; },
    // choix : [classe (non / revoir / oui), signe, texte, attributs { action, id, statut… }, actuel]
    decision: (choix) => '<div class="etude-decision' + (choix.length === 2 ? ' deux' : '') + '" id="etude-decision">' + choix.map(([classe, signe, texte, attrs, actuel]) =>
      '<button type="button" class="etude-choix ' + classe + (actuel ? ' actuel" aria-current="true' : '') + '"' +
      Object.keys(attrs).map((k) => ' data-' + k + '="' + P.esc(attrs[k]) + '"').join('') + '><em aria-hidden="true">' + signe + '</em>' + P.esc(texte) + '</button>').join('') + '</div>',
    page: (retour, compteur, corps) => '<div class="etude"><div class="etude-haut">' + retour + (compteur ? '<span>' + P.esc(compteur) + '</span>' : '') + '</div>' + corps + '</div>',
    quitter: (href) => '<a class="etude-quitter" href="' + P.esc(href) + '">‹ Quitter</a>',
    fin: (retourHref, titre, texte, bouton) => P.etude.page(P.etude.quitter(retourHref), '', '<div class="etude-fin apparait"><div class="etude-gros" aria-hidden="true">🎉</div>' +
      '<h1>' + P.esc(titre) + '</h1><p class="doux">' + P.esc(texte) + '</p><a class="btn rouge" href="' + P.esc(retourHref) + '">' + P.esc(bouton) + '</a></div>'),
    // bouton de la liste (href : l'adresse de l'étude, ou attrs d'une action) ; sans rien à étudier, la même place, « à jour »
    lancer: (cible, titre, sous) => (typeof cible === 'string' ? '<a class="etude-lancer apparait" href="' + P.esc(cible) + '">'
        : '<button type="button" class="etude-lancer apparait"' + Object.keys(cible).map((k) => ' data-' + k + '="' + P.esc(cible[k]) + '"').join('') + '>') +
      '<em aria-hidden="true">▶</em><span>' + P.esc(titre) + '<small>' + P.esc(sous) + '</small></span>' + (typeof cible === 'string' ? '</a>' : '</button>'),
    aJour: (titre, sous) => '<div class="etude-lancer etude-a-jour apparait" role="status"><em aria-hidden="true">✓</em><span>' + P.esc(titre) + '<small>' + P.esc(sous) + '</small></span></div>',
    // file « le plus ancien d'abord » (Paiements, Validations) : « Plus tard » met de côté pour cette étude, sans rien
    // écrire ; la liste mise de côté se vide en revenant à la liste de la rubrique (P.etude.vider)
    deCote: (cle) => (P.etat['etudeDeCote-' + cle] = P.etat['etudeDeCote-' + cle] || []),
    vider: (cle) => { P.etat['etudeDeCote-' + cle] = []; },
    plusTard: (cle, id) => ['revoir', '⏸', 'Plus tard', { action: 'etude-plus-tard', cle, id }]
  };
  P.actions['etude-plus-tard'] = (el) => { P.etude.deCote(el.dataset.cle).push(el.dataset.id); return P.afficher(); };
  P.actions['etude-photo-voir'] = (el) => { if (typeof ouvrirGalerieLightbox === 'function') ouvrirGalerieLightbox(P.etude.galerie, Number(el.dataset.index)); };
  // les points sous les photos suivent la photo affichée (à appeler après l'affichage d'une étude)
  P.etude.suivrePoints = () => {
    const piste = document.getElementById('etude-piste'), points = document.querySelectorAll('.etude-points i');
    if (!piste || !points.length) return;
    piste.addEventListener('scroll', () => {
      const n = Math.round(piste.scrollLeft / Math.max(1, piste.clientWidth));
      points.forEach((x, i) => x.classList.toggle('actif', i === n));
    }, { passive: true });
  };

  // ---------- Cartes de personnes, au lieu des tableaux à lignes (12/11/2026, « premium partout ») ----------
  // items : { tete (le nom, souvent P.lienFiche : la photo s'y pose), sous [textes], montant, etat [texte, ton], actions (HTML),
  //           ton (ok / alerte / erreur / neutre : liseré de couleur), classe, coche (HTML d'une case à cocher, en haut à droite),
  //           alertes [textes en rouge, ⚠] }
  P.cartesPersonnes = (items, vide) => (items.length ? '<div class="pers-grille">' + items.map((x, i) =>
    '<article class="pers-carte apparait ton-' + (!x.ton || x.ton === 'info' ? 'neutre' : x.ton) + (x.coche ? ' avec-coche' : '') + (x.classe ? ' ' + x.classe : '') + '" style="--i:' + Math.min(i, 14) + '">' +
      (x.coche ? '<div class="pers-coche">' + x.coche + '</div>' : '') + '<div class="pers-tete">' + x.tete + (x.sous && x.sous.filter(Boolean).length ? '<small>' + x.sous.filter(Boolean).map(P.esc).join(' · ') + '</small>' : '') + '</div>' +
      '<div class="pers-milieu">' + (x.montant !== undefined && x.montant !== null ? '<b class="pers-montant">' + P.esc(x.montant) + '</b>' : '') + (x.etat ? P.pastille(x.etat[0], x.etat[1]) : '') + '</div>' +
      (x.alertes && x.alertes.length ? x.alertes.map((a) => '<p class="pers-alerte" role="alert">⚠ ' + P.esc(a) + '</p>').join('') : '') +
      (x.actions ? '<div class="pers-actions">' + x.actions + '</div>' : '') + '</article>').join('') + '</div>'
    : '<div class="carte vide">' + P.esc(vide || 'Personne pour le moment.') + '</div>');
  // Barre d'avancement en couleurs : parts [[valeur, ton, libellé]] sur un total
  P.barreParts = (parts, total) => '<div class="barre-parts" role="img" aria-label="' + P.esc(parts.map((x) => x[2] + ' ' + (total ? Math.round(x[0] * 100 / total) : 0) + ' %').join(', ')) + '">' +
    parts.filter((x) => x[0] > 0 && total).map((x) => '<i class="' + x[1] + '" style="width:' + (x[0] * 100 / total).toFixed(2) + '%"></i>').join('') + '</div>';

  // ---------- Convoquer une sélection (24/10/2026, demande de la propriétaire) ----------
  // Sélection d'un client (Demandes recruteurs) ou de l'agence (Mannequins, cases à cocher) : une
  // petite fenêtre crée le projet dans l'Agenda avec ces mannequins (caché du site public), puis
  // ouvre les Convocations sur lui, message « Annoncer la sélection » d'abord.
  // ids : identifiants des mannequins ; v : valeurs proposées { titre, type, date, ville, client }.
  P.convoquerSelection = (ids, v) => {
    v = v || {};
    P.etat.selectionAConvoquer = ids.slice();
    const types = Object.keys(MA2M_TYPES_AGENDA).map((k) => '<option value="' + k + '"' + (k === (v.type || 'shooting') ? ' selected' : '') + '>' + P.esc(libelleTypeAgenda(k)) + '</option>').join('');
    P.fenetre('<form class="grille" data-form="selection-convoquer"><h2>📨 Annoncer la sélection et convoquer</h2>' +
      '<p class="doux">' + P.pluriel(ids.length, 'mannequin sélectionnée', 'mannequins sélectionnées') + '. Le projet est ajouté à l’Agenda (caché du site), puis l’envoi groupé WhatsApp et e-mail s’ouvre.</p>' +
      '<label class="fl" for="sel-titre">Titre du projet<input id="sel-titre" name="titre" maxlength="160" required value="' + P.esc(v.titre || '') + '"></label>' +
      '<label class="fl" for="sel-type">Type<select id="sel-type" name="type">' + types + '</select></label>' +
      '<label class="fl" for="sel-date">Date<input id="sel-date" name="date" type="date" required value="' + P.esc(v.date || '') + '"></label>' +
      '<label class="fl" for="sel-ville">Ville<input id="sel-ville" name="ville" maxlength="80" value="' + P.esc(v.ville || 'Abidjan') + '"></label>' +
      '<label class="fl" for="sel-client">Client<input id="sel-client" name="client" maxlength="160" value="' + P.esc(v.client || '') + '"></label>' +
      '<label class="ligne"><input type="checkbox" name="citer" checked> Citer le client dans les messages aux mannequins</label>' +
      '<div class="ligne"><button class="btn rouge" type="submit">Créer le projet et préparer les messages</button><button class="btn" type="button" data-action="fermer-fenetre">Annuler</button></div></form>');
    document.getElementById('sel-titre').focus();
  };
  P.formulaires['selection-convoquer'] = async (f) => {
    const ids = P.etat.selectionAConvoquer || [];
    const titre = String(f.get('titre') || '').trim(), date = String(f.get('date') || '');
    if (!ids.length) { P.message('Aucune mannequin sélectionnée.'); return; }
    if (!titre || !date) { P.message('Indiquez au moins le titre et la date du projet.'); return; }
    const r = await P.bd(sb.from('agenda_projets').insert({ type: String(f.get('type') || 'autre'), titre, date_debut: date, ville: String(f.get('ville') || '').trim() || null,
      client: String(f.get('client') || '').trim() || null, citer_client: f.get('citer') === 'on', visible: false, mannequin_ids: ids }).select('id'));
    if (!r || !r.length) { P.message('Le projet n’a pas pu être créé : reconnectez-vous puis réessayez.'); return; }
    P.fenetre(''); P.etat.selectionAConvoquer = null;
    P.message('Projet « ' + titre + ' » ajouté à l’Agenda : vérifiez le message, puis envoyez.');
    if (typeof window.convoquerProjet === 'function') window.convoquerProjet(r[0].id);
    else { window.convocationDemandee = r[0].id; location.hash = '#/site/b2-convocations'; }
  };
  // Photo de couverture de chaque mannequin publiée : { id: url }
  P.photosCouverture = async (ids) => {
    if (!ids.length) return {};
    // petits visages ronds : la petite version (480 px) partout quand elle existe (js/photos.js)
    const lignes = await lirePhotosCouverture(sb, ids, true);
    const parId = {};
    lignes.forEach((p) => { parId[p.model_id] = urlGrille(p, true); });
    return parId;
  };
  // ---------- Toutes les personnes qu'on peut choisir (Programmation défilé, Informations agence) ----------
  // clé « m:<profil du site> », « r:<registre sans compte> », « c:<carnet> » → { nom, photo, sexe, origine } ;
  // carnetRegistre : contact du carnet → mannequin du registre (réponses aux convocations).
  // tousLesComptes : aussi les mannequins du registre dont le compte n'est pas (ou plus) publié.
  // sexe d'un profil du site (même règle que places_sexe, supabase-places.sql)
  const sexeProfil = (m) => m.category === 'homme' || (m.category !== 'femme' && m.civilite === 'Monsieur') ? 'homme' : 'femme';
  P.personnesPossibles = async (tousLesComptes) => {
    const [profils, registre, carnet] = await Promise.all([
      P.bd(sb.from('model_profiles').select('id, full_name, category, civilite').eq('published', true).order('full_name')),
      P.bd(sb.from('agence_mannequins').select('id, full_name, genre, user_id').eq('statut', 'actif').order('full_name')).catch(() => []),
      P.bd(sb.from('contacts_externes').select('id, civilite, nom, mannequin_id').order('nom')).catch(() => [])
    ]);
    const photos = await P.photosCouverture(profils.map((m) => m.id)).catch(() => ({}));
    const liste = {};
    profils.forEach((m) => { liste['m:' + m.id] = { cle: 'm:' + m.id, model_id: m.id, nom: m.full_name || '?', photo: photos[m.id] || '', sexe: sexeProfil(m), origine: 'agence' }; });
    registre.filter((r) => !r.user_id || (tousLesComptes && !liste['m:' + r.user_id])).forEach((r) => {
      liste['r:' + r.id] = { cle: 'r:' + r.id, mannequin_id: r.id, nom: r.full_name || '?', photo: '', sexe: r.genre === 'homme' ? 'homme' : 'femme', origine: 'agence', compte: !!r.user_id };
    });
    liste.carnetRegistre = {};
    carnet.filter((c) => c.mannequin_id).forEach((c) => { liste.carnetRegistre[c.id] = c.mannequin_id; });
    carnet.filter((c) => !c.mannequin_id).forEach((c) => { liste['c:' + c.id] = { cle: 'c:' + c.id, contact_id: c.id, nom: [c.civilite, c.nom].filter(Boolean).join(' ') || '?', photo: '', sexe: c.civilite === 'Monsieur' ? 'homme' : 'femme', origine: 'exterieure' }; });
    return liste;
  };
  // Nombre qui défile jusqu'à sa valeur (attribut data-compte)
  P.animerChiffres = (racine) => {
    (racine || document).querySelectorAll('[data-compte]').forEach((el) => {
      const cible = Number(el.dataset.compte) || 0, suffixe = el.dataset.suffixe || '';
      const ecrire = (v) => { el.textContent = Math.round(v).toLocaleString('fr-FR') + suffixe; };
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || !cible) { ecrire(cible); return; }
      const t0 = performance.now();
      const pas = (t) => { const k = Math.min(1, (t - t0) / 1100); ecrire(cible * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(pas); };
      requestAnimationFrame(pas);
    });
  };
  // Page de connexion : un mur des visages du Book derrière le texte (photos publiques)
  let murVisages = null;
  async function visagesPublics() {
    if (!murVisages) {
      murVisages = (async () => {
        const profils = await P.bd(sb.from('model_profiles').select('id, full_name').eq('published', true).order('created_at', { ascending: false }).limit(16));
        const photos = await P.photosCouverture(profils.map((m) => m.id));
        return profils.filter((m) => photos[m.id]).map((m) => [photos[m.id], m.full_name]);
      })().catch(() => []);
    }
    return murVisages;
  }
  new MutationObserver(() => {
    const g = document.querySelector('.connexion .g');
    if (!g || g.querySelector('.mur-fond')) return;
    const mur = document.createElement('div');
    mur.className = 'mur-fond'; mur.setAttribute('aria-hidden', 'true');
    g.prepend(mur);
    visagesPublics().then((v) => { if (mur.isConnected) mur.innerHTML = v.slice(0, 8).map((x) => P.visage(x[0], x[1])).join(''); }, () => { /* pas de visages : le fond reste uni */ });
  }).observe(document.getElementById('app'), { childList: true });

  // Téléphone : chaque ligne d'un tableau devient une petite carte (css « .tableau » en bas de
  // admin-vivante.css) ; chaque case reçoit le titre de sa colonne. La matrice reste une grille.
  function etiqueterTableaux() {
    document.querySelectorAll('.tableau table:not(.matrice):not([data-etiquete])').forEach((t) => {
      t.setAttribute('data-etiquete', '');
      const titres = Array.from(t.querySelectorAll('thead th'), (th) => th.textContent.trim());
      t.querySelectorAll('tbody tr').forEach((tr) => Array.from(tr.children).forEach((td, i) => { if (titres[i] && !td.hasAttribute('colspan')) td.setAttribute('data-titre', titres[i]); }));
    });
  }
  // Écrans repris de l'ancien tableau de bord (.ecran-partage) : titres sans émoji, comme les
  // autres pages, et longues explications repliées sous « En savoir plus » (visite du 22/10/2026).
  const EMOJI_DEBUT = /^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u;
  function harmoniserEcransPartages() {
    // (grande visite du 22/10/2026 : aucun émoji en tête des titres, boutons, choix et pastilles, partout)
    // (seulement les éléments nouveaux : ceux déjà vus portent data-sans-emoji)
    document.querySelectorAll('#contenu :is(h1, h2, h3, button, a.btn, label.btn, option, summary, .pastille, .btn-mini-admin):not([data-sans-emoji])').forEach((h) => {
      h.setAttribute('data-sans-emoji', '');
      const t = h.firstChild;
      if (t && t.nodeType === 3 && EMOJI_DEBUT.test(t.textContent)) t.textContent = t.textContent.replace(EMOJI_DEBUT, '');
      else if (t && t.nodeType === 1 && t.matches('img.emoji')) t.remove();
    });
    document.querySelectorAll('.ecran-partage:not([data-harmonise])').forEach((ecran) => {
      ecran.setAttribute('data-harmonise', '');
      ecran.querySelectorAll('p.tdb-5, p.tdb-9, p.tdb-12, p.tdb-17').forEach((p) => {
        if (p.textContent.length < 160 || p.closest('details.aide')) return;
        const d = document.createElement('details');
        d.className = 'aide';
        d.innerHTML = '<summary>En savoir plus</summary>';
        p.replaceWith(d); d.appendChild(p);
      });
    });
  }
  // Formulaires de saisie (blocs 2 et 3) : repliés derrière « ＋ … », la liste d'abord (grande visite du
  // 22/10/2026) ; un appui les ouvre. Les pages elles-mêmes ne changent pas (même logique partout).
  const SAISIES = ['compta-ecrire', 'compta-virement', 'compta-compte', 'compta-document', 'compta-impot', 'compta-dette',
    'compta-payer-personne', 'compta-materiel', 'compta-tiers', 'lien-ajouter'];
  function replierSaisies() {
    document.querySelectorAll('#contenu form.carte.f[data-form]:not([data-replie])').forEach((form) => {
      if (!SAISIES.includes(form.getAttribute('data-form'))) return;
      form.setAttribute('data-replie', '');
      const titre = form.querySelector('h2'), bouton = document.createElement('button');
      bouton.type = 'button'; bouton.className = 'btn rouge ouvrir-saisie';
      bouton.textContent = '＋ ' + (titre ? titre.textContent.trim() : 'Nouvelle saisie');
      bouton.setAttribute('aria-expanded', 'false');
      form.hidden = true;
      form.before(bouton);
      bouton.addEventListener('click', () => { form.hidden = false; bouton.remove(); const champ = form.querySelector('input, select, textarea'); if (champ) champ.focus(); });
    });
  }
  // Menu : la rubrique ouverte reste visible (menu long sur un ordinateur portable)
  function rubriqueVisible() {
    const a = document.querySelector('.lateral .nav.actif:not([data-vu])');
    if (!a) return;
    a.setAttribute('data-vu', '');
    const menu = a.closest('.lateral'), r = a.getBoundingClientRect(), m = menu.getBoundingClientRect();
    if (r.bottom > m.bottom - 40 || r.top < m.top) menu.scrollTop += r.top - m.top - m.height / 3;
  }
  // Visages partout (demande de la propriétaire, 22/10/2026 : « les photos des mannequins partout où
  // se trouve leur nom, et cliquables ») : devant chaque lien vers la fiche d'une mannequin des
  // Paiements (#/paiements/fiche/<id du registre>), sa photo du Book en médaillon, qui ouvre la même
  // fiche ; initiales tant que la photo arrive, ou si elle n'est pas inscrite sur le site.
  const photoDuRegistre = {};  // id du registre → adresse de la photo ('' : pas de photo)
  const paquets = (l, n) => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, i * n + n));
  // lecture par paquets de n identifiants (une longue liste ne tient pas dans une adresse) :
  // lire(paquet) renvoie une liste ; les réponses sont mises bout à bout. Partagé par les pages.
  P.parPaquets = async (ids, n, lire) => {
    let tous = [];
    for (const p of paquets(ids, n)) tous = tous.concat((await lire(p)) || []);
    return tous;
  };
  // compte du site : donné par la page (data-compte) ; sinon cherché dans le registre (par paquets
  // de 100, pour des adresses courtes) ; puis les photos de tous ces comptes
  async function chercherPhotos(ids, compteDe) {
    ids.forEach((id) => { photoDuRegistre[id] = ''; });  // (une seule recherche par mannequin)
    const inconnus = ids.filter((id) => !compteDe[id]);
    for (const p of paquets(inconnus, 100)) {
      (await P.bd(sb.from('agence_mannequins').select('id, user_id').in('id', p))).forEach((l) => { if (l.user_id) compteDe[l.id] = l.user_id; });
    }
    const comptes = [...new Set(ids.map((id) => compteDe[id]).filter(Boolean))];
    for (const p of paquets(comptes, 100)) {
      const parCompte = await P.photosCouverture(p);
      ids.forEach((id) => { if (parCompte[compteDe[id]]) photoDuRegistre[id] = parCompte[compteDe[id]]; });
    }
  }
  // Même règle pour les fiches du Book (#/site/b2-mannequins-publies/<id du profil>, 23/10/2026 :
  // « partout où il y a le nom d'un mannequin, sa photo cliquable, avec son nom à côté »).
  const photoDuProfil = {};  // id du profil → adresse de la photo ('' : pas de photo)
  const photoDeCandidature = {};  // id de la candidature → première photo jointe
  async function chercherPhotosProfils(ids) {
    ids.forEach((id) => { photoDuProfil[id] = ''; });
    for (const p of paquets(ids, 100)) Object.assign(photoDuProfil, await P.photosCouverture(p));
  }
  const FICHES = [
    { liens: 'a[href^="#/paiements/fiche/"]', photos: photoDuRegistre, attribut: 'data-visage-registre',
      chercher: (ids, liens) => { const compteDe = {}; liens.forEach((a) => { if (a.dataset.compte) compteDe[a.getAttribute('href').split('/').pop()] = a.dataset.compte; }); return chercherPhotos(ids, compteDe); } },
    { liens: 'a[href^="#/site/b2-mannequins-publies/"]', photos: photoDuProfil, attribut: 'data-visage-profil', chercher: chercherPhotosProfils,
      // (le lien du nom seulement : pas « CV », pas un lien qui porte déjà sa photo)
      garde: (a) => /^#\/site\/b2-mannequins-publies\/[^/]+$/.test(a.getAttribute('href')) && !a.querySelector('img, .vis') },
    // candidature (codes d'accès…) : sa première photo jointe (P.photosDossiers, js/admin/site-dossiers.js)
    { liens: 'a[href^="#/site/b2-candidatures/"]', photos: photoDeCandidature, attribut: 'data-visage-candidature',
      chercher: async (ids) => { ids.forEach((id) => { photoDeCandidature[id] = ''; }); if (P.photosDossiers) Object.assign(photoDeCandidature, await P.photosDossiers('b2-candidatures', ids)); },
      garde: (a) => /^#\/site\/b2-candidatures\/[^/]+$/.test(a.getAttribute('href')) && !a.querySelector('img, .vis') }
  ];
  function visagesDesFiches() {
    FICHES.forEach((f) => {
      const liens = [...document.querySelectorAll('#contenu ' + f.liens + ':not(.btn):not(.visage-lien):not(.retour-liste):not([data-visage])')].filter((a) => !f.garde || f.garde(a));
      // emplacements d'une photo dans une case à cocher ou un choix (la photo sélectionne, le nom est à côté)
      const places = [...document.querySelectorAll('#contenu [' + f.attribut + ']:not([data-vu]), #fenetre [' + f.attribut + ']:not([data-vu])')];
      if (!liens.length && !places.length) return;
      const poserLien = (a) => {
        const id = a.getAttribute('href').split('/').pop(), nom = a.textContent.trim();
        const v = a.previousElementSibling && a.previousElementSibling.classList.contains('visage-lien') ? a.previousElementSibling : null;
        const html = '<a class="visage-lien" href="' + P.esc(a.getAttribute('href')) + '" tabindex="-1" aria-hidden="true">' + P.visage(f.photos[id] || '', nom, 'rond-vis') + '</a>';
        if (v) v.outerHTML = html; else a.insertAdjacentHTML('beforebegin', html);
      };
      const poserPlace = (el) => { el.setAttribute('data-vu', ''); el.innerHTML = P.visage(f.photos[el.getAttribute(f.attribut)] || '', el.dataset.nom || '', 'rond-vis'); };
      liens.forEach((a) => { a.setAttribute('data-visage', ''); poserLien(a); });
      places.forEach(poserPlace);
      const idsLiens = liens.map((a) => a.getAttribute('href').split('/').pop());
      const manquants = [...new Set(idsLiens.concat(places.map((el) => el.getAttribute(f.attribut))))].filter((id) => id && !(id in f.photos));
      if (manquants.length) {
        // (photos arrivées : on les pose partout où ces mannequins sont affichées MAINTENANT,
        // la page a pu être redessinée pendant la recherche)
        f.chercher(manquants, liens).then(() => {
          document.querySelectorAll('#contenu ' + f.liens + '[data-visage]').forEach((a) => { if (manquants.includes(a.getAttribute('href').split('/').pop())) poserLien(a); });
          document.querySelectorAll('#contenu [' + f.attribut + '], #fenetre [' + f.attribut + ']').forEach((el) => { if (manquants.includes(el.getAttribute(f.attribut))) poserPlace(el); });
        }, () => { /* initiales gardées */ });
      }
    });
  }
  // Un nom écrit seul (tiers d'une écriture de la Comptabilité, bénéficiaire d'un cachet…) :
  // emplacement <span data-visage-nom="Nom">. Si c'est une mannequin du registre, sa photo s'y
  // place ; sinon (fournisseur, client…), rien.
  const registreParNom = {};  // nom en minuscules → id du registre ('' : pas une mannequin)
  const nomsEnCours = new Set();  // noms en cours de recherche (pas encore de réponse)
  async function chercherNoms(noms) {
    noms.forEach((n) => nomsEnCours.add(n.toLowerCase()));
    const compteDe = {}, trouves = {};
    for (const p of paquets(noms, 50)) {
      (await P.bd(sb.from('agence_mannequins').select('id, full_name, user_id').in('full_name', p))).forEach((l) => {
        trouves[String(l.full_name).toLowerCase()] = l.id;
        if (l.user_id) compteDe[l.id] = l.user_id;
      });
    }
    const ids = [...new Set(Object.values(trouves).filter((id) => !(id in photoDuRegistre)))];
    if (ids.length) await chercherPhotos(ids, compteDe);
    noms.forEach((n) => { const k = n.toLowerCase(); registreParNom[k] = trouves[k] || ''; nomsEnCours.delete(k); });
  }
  function visagesParNom() {
    const places = [...document.querySelectorAll('#contenu [data-visage-nom]:not([data-vu]), #fenetre [data-visage-nom]:not([data-vu])')];
    if (!places.length) return;
    const poser = (el) => {
      const id = registreParNom[el.dataset.visageNom.toLowerCase()];
      if (id === undefined) return;
      el.setAttribute('data-vu', '');
      el.innerHTML = id ? P.visage(photoDuRegistre[id] || '', el.dataset.visageNom, 'rond-vis') : '';
    };
    places.forEach(poser);
    const inconnus = [...new Set(places.map((el) => el.dataset.visageNom).filter((n) => n && !(n.toLowerCase() in registreParNom) && !nomsEnCours.has(n.toLowerCase())))];
    // (réponse arrivée : on reprend tous les emplacements affichés MAINTENANT)
    if (inconnus.length) chercherNoms(inconnus).then(() => visagesParNom(), () => { inconnus.forEach((n) => nomsEnCours.delete(n.toLowerCase())); });
  }
  // (regroupé : une seule passe après une rafale de changements, pas une par image des chiffres animés)
  let retouche = 0;
  const retoucheur = new MutationObserver(() => {
    if (retouche) return;
    retouche = setTimeout(() => { retouche = 0; etiqueterTableaux(); harmoniserEcransPartages(); replierSaisies(); rubriqueVisible(); visagesDesFiches(); visagesParNom(); }, 60);
  });
  retoucheur.observe(document.getElementById('app'), { childList: true, subtree: true });
  // (la fenêtre par-dessus la page : ses choix à photos aussi)
  new MutationObserver(() => { visagesDesFiches(); visagesParNom(); }).observe(document.getElementById('fenetre'), { childList: true, subtree: true });

  // ---------- Choisir une mannequin par sa photo (23/10/2026) ----------
  // Au lieu d'une liste déroulante de noms : une recherche et une grille de médaillons, le nom à
  // côté. Le choix remplit un champ caché (nom du formulaire inchangé) et déclenche son
  // data-change, comme la liste d'avant. items : [{ id, nom, note }] ; sorte : 'registre' (photo par
  // le registre des Paiements) ou 'profil' (photo du Book) ; autres : [[valeur, libellé]] proposés
  // en premier (« Personne extérieure », « Tous les mannequins »…).
  P.choixVisages = (o) => {
    const bouton = (valeur, contenu, nomTexte) => '<button type="button" class="cvi-item" role="option" aria-selected="' + (String(o.valeur || '') === String(valeur)) + '" data-valeur="' + P.esc(valeur) + '" data-texte="' + P.esc(String(nomTexte || '').toLowerCase()) + '">' + contenu + '</button>';
    return '<div class="choix-visages large"><span class="fl-titre">' + P.esc(o.libelle || 'Mannequin') + '</span>' +
      '<input type="hidden" id="' + P.esc(o.id) + '" name="' + P.esc(o.nom) + '" value="' + P.esc(o.valeur || '') + '"' + (o.change ? ' data-change="' + P.esc(o.change) + '"' : '') + '>' +
      (o.items.length > 8 ? '<input type="search" class="cvi-recherche" placeholder="Rechercher un nom…" aria-label="Rechercher une mannequin">' : '') +
      '<div class="cvi-grille" role="listbox" aria-label="' + P.esc(o.libelle || 'Mannequin') + '">' +
      (o.autres || []).map((x) => bouton(x[0], '<span class="cvi-autre" aria-hidden="true">' + (x[2] || '＋') + '</span><span class="cvi-nom">' + P.esc(x[1]) + '</span>', x[1])).join('') +
      o.items.map((m) => bouton(m.id, '<span data-visage-' + o.sorte + '="' + P.esc(m.id) + '" data-nom="' + P.esc(m.nom) + '"></span><span class="cvi-nom">' + P.esc(m.nom) + (m.note ? '<small class="doux">' + P.esc(m.note) + '</small>' : '') + '</span>', m.nom)).join('') +
      '</div></div>';
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.cvi-item');
    if (!b) return;
    const boite = b.closest('.choix-visages'), champ = boite.querySelector('input[type=hidden]');
    boite.querySelectorAll('.cvi-item').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    champ.value = b.dataset.valeur;
    champ.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.addEventListener('input', (e) => {
    if (!e.target.classList || !e.target.classList.contains('cvi-recherche')) return;
    const q = e.target.value.trim().toLowerCase();
    e.target.closest('.choix-visages').querySelectorAll('.cvi-item').forEach((x) => { x.hidden = !!q && !x.dataset.texte.includes(q); });
  });

  P.compte = (n, suffixe) => '<span data-compte="' + (Number(n) || 0) + '"' + (suffixe ? ' data-suffixe="' + P.esc(suffixe) + '"' : '') + '>0' + P.esc(suffixe || '') + '</span>';

  // ---------- Les trois blocs ----------
  const ICONES = {
    accueil: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    site: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 21h8M12 18v3"/>',
    paiements: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11h20M6 15h4"/>',
    compta: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 10h8M8 14h8M8 18h5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    // petits boutons (dessinés : le nettoyage des émojis en tête des boutons effaçait ◀ ▶ ★, 31/10/2026)
    avant: '<path d="M15 5l-7 7 7 7"/>',
    apres: '<path d="M9 5l7 7-7 7"/>',
    etoile: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
    croix: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  const icone = (cle, taille) => '<svg width="' + (taille || 20) + '" height="' + (taille || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONES[cle] + '</svg>';
  P.icone = icone;
  // Barre d'étapes (Convocations, Messages groupés, Informations agence, 11/11/2026) : étape en cours, étapes faites
  P.marquerEtapes = (boutons, n, cle) => boutons.forEach((b) => {
    const k = Number(b.dataset[cle]);
    b.classList.toggle('fait', k < n); b.classList.toggle('actif', k === n);
    if (k === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });  // (aussi pour les autres pièces, ex. js/admin/site-contenu.js)
  const COURT = { site: 'Le site', paiements: 'Paiements', compta: 'Compta' };
  const premierePage = P.premierePage;  // js/portail/noyau.js
  const blocsPermis = () => ['site', 'paiements', 'compta'].filter((k) => P.moi.espaces[k] && P.espaces[k]);
  const lienSecurite = () => P.moi.role === 'principal' ? ['#/securite/comptes', 'Sécurité et journal'] : ['#/securite/codes', 'Mes codes de secours'];

  function enTete(titre, court) {
    return '<header class="haut"><a class="marque" href="#/" aria-label="Accueil de l’Administration">' +
      '<img class="logo-portail logo-haut" src="/assets/logo-header-clair.png" width="600" height="182" alt="Maître Akesse Model Management"></a>' +
      '<div class="bloc-actuel"><span class="long">' + P.esc(titre) + '</span>' + (court ? '<span class="court">' + P.esc(court) + '</span>' : '') + '</div>' +
      '<div class="qui"><b>' + P.esc(P.moi.nom) + '</b>' + P.esc(P.ROLES[P.moi.role]) + '</div></header>';
  }
  function barreBas(module, avecMenu) {
    return '<nav class="onglets-bas" aria-label="Blocs de l’Administration">' +
      '<a href="#/"' + (!module ? ' class="actif" aria-current="page"' : '') + '>' + icone('accueil') + 'Accueil</a>' +
      blocsPermis().map((k) => '<a href="#/' + k + '/' + premierePage(P.espaces[k]) + '"' + (k === module ? ' class="actif" aria-current="page"' : '') + '>' + icone(k) + COURT[k] + '</a>').join('') +
      (avecMenu ? '<button type="button" data-action="menu-ouvrir" aria-controls="menu-lateral" aria-expanded="false">' + icone('menu') + 'Rubriques</button>' : '') +
      '</nav>';
  }

  // Coque d'un bloc : en-tête, menu des rubriques (à gauche ; en bas, en tiroir, sur téléphone)
  P.coque = (module, page, html) => {
    const esp = P.espaces[module];
    // (11/11/2026, tuiles) dans l'Administration du site : seulement les rubriques de la tuile de cette page
    const tuile = module === 'site' && P.tuileDe ? P.tuileDe(page) : null;
    // (Paiements, Comptabilité : seulement le groupe de la rubrique, js/admin/blocs-index.js)
    const groupe = !tuile && P.groupeBloc ? P.groupeBloc(module, page) : null;
    const nav = P.menuRubriques(tuile ? { nav: P.menuTuile(tuile), compteur: esp.compteur } : groupe ? { nav: groupe, compteur: esp.compteur } : esp, module, page);  // (js/portail/noyau.js : compartiments)
    const blocs = '<div class="blocs">' + '<a class="bloc" href="#/">' + icone('accueil') + 'Accueil</a>' +
      blocsPermis().map((k) => '<a class="bloc' + (k === module ? ' actif' : '') + '" href="#/' + k + '/' + premierePage(P.espaces[k]) + '">' + icone(k) + P.esc(P.ESPACES[k]) + '</a>').join('') + '</div>';
    const secu = lienSecurite();
    return '<div class="coque">' + enTete(P.ESPACES[module] || 'Sécurité', { site: 'Administration du site', paiements: 'Paiements', compta: 'Comptabilité' }[module]) +
      '<div class="voile-menu" data-action="menu-fermer"></div>' +
      '<nav class="lateral" id="menu-lateral" aria-label="' + P.esc(P.ESPACES[module] || 'Sécurité') + '">' + blocs + nav +
      '<div class="lateral-pied"><a class="btn petit clair" href="' + secu[0] + '">' + P.esc(secu[1]) + '</a>' +
      '<button class="btn petit clair" data-action="se-deconnecter">Déconnexion</button></div></nav>' +
      '<main class="contenu" id="contenu">' + html + '</main>' + barreBas(module, true) + '</div>';
  };

  // ---------- Accueil vivant ----------
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  function dateDuJour() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Abidjan' }));
    return { jour: JOURS[d.getDay()], date: d.getDate() + ' ' + P.MOIS[d.getMonth()] };
  }
  // Une lecture qui échoue ne casse pas l'accueil : sa carte disparaît simplement
  // (partagés avec les pièces du bloc 1 : P.essai, P.nombre)
  const essai = P.essai = (promesse) => Promise.resolve(promesse).catch(() => null);
  const nombre = P.nombre = async (requete) => { const r = await requete; if (r.error) throw r.error; return r.count || 0; };

  async function donneesSite() {
    const aujourdhui = P.aujourdhui();
    const [profils, nouvelles, projets, aValider, recruteurs] = await Promise.all([
      essai(P.bd(sb.from('model_profiles').select('id, full_name, niveau_mannequin, city').eq('published', true).order('created_at', { ascending: false }).limit(40))),
      essai(nombre(sb.from('casting_applications').select('id', { count: 'exact', head: true }).eq('status', 'nouvelle'))),
      essai(P.bd(sb.from('agenda_projets').select('id, titre, type, date_debut, date_fin, lieu, ville, annule, mannequin_ids').eq('annule', false).or('date_debut.gte.' + aujourdhui + ',date_fin.gte.' + aujourdhui).order('date_debut').limit(10))),  // en cours ou à venir
      essai(nombre(sb.from('model_profiles').select('id', { count: 'exact', head: true }).eq('en_attente_validation', true))),
      essai(nombre(sb.from('recruiter_requests').select('id', { count: 'exact', head: true }).eq('status', 'nouvelle')))
    ]);
    const prochain = (projets || []).find((p) => (p.date_fin || p.date_debut) >= aujourdhui) || null;
    let reponses = null;
    if (prochain) {
      const parts = await essai(P.bd(sb.from('convocation_participants').select('id, model_id, parent, reponse').eq('projet_id', prochain.id)));
      if (parts && parts.length) {
        const vus = {}, uniques = [];
        parts.forEach((x) => { const g = x.model_id || x.id; if (!vus[g] || (!vus[g].reponse && x.reponse)) { if (!vus[g]) uniques.push(g); vus[g] = x; } });
        reponses = { total: uniques.length, confirme: uniques.filter((g) => vus[g].reponse === 'confirme').length, sans: uniques.filter((g) => !vus[g].reponse).length };
      }
    }
    const liste = profils || [];
    const photos = await essai(P.photosCouverture(liste.map((p) => p.id).concat(prochain ? prochain.mannequin_ids || [] : []).filter((x, i, l) => l.indexOf(x) === i))) || {};
    return { profils: liste, photos, nouvelles, prochain, reponses, aValider, recruteurs, projets: projets || [] };
  }
  async function donneesPaiements() {
    const declares = await essai(nombre(sb.from('paiements_mannequins').select('id', { count: 'exact', head: true }).eq('statut', 'declare')));
    return { declares };
  }
  async function donneesCompta() {
    const soldes = await essai(P.rpc('compta_soldes'));
    return { total: soldes ? soldes.reduce((s, x) => s + (Number(x.solde) || 0), 0) : null };
  }

  // (14/11/2026, maquette validée par la propriétaire : maquettes/accueil-administration.html) « L'agence ce mois-ci » et
  // « Cette semaine ». Chacun ne voit que ce que son rôle permet : l'argent (Comptabilité), les mannequins actives
  // (Paiements), les élèves et les cours de talons, les castings et défilés (Site). Une lecture absente ne casse rien.
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  // séances de talons de la semaine ; « occupe » (calculé par la base, supabase-creneaux-prives.sql) : relu sans lui
  // tant que ce fichier n'est pas collé
  async function seancesSemaine(auj, dans7) {
    const lire = (champs) => P.bd(sb.from('cours_talons_seances').select('debut, theme, inscription_id' + champs + ', cours_talons(nom, formule, civilite, age, mineure, statut, valide_le)')
      .gte('debut', new Date(auj.getFullYear(), auj.getMonth(), auj.getDate()).toISOString()).lte('debut', dans7.toISOString()).order('debut').limit(200));
    try { return await lire(', occupe'); } catch (e) { return lire(''); }
  }
  async function donneesAgence() {
    // (le calendrier des congés des cours du dimanche, js/presences-calcul.js, pour « Cette semaine »)
    if (P.moi.espaces.site && !window.Presences && P.chargerScript) await essai(P.chargerScript('/js/presences-calcul.js'));
    const auj = new Date(), debutMois = iso(new Date(auj.getFullYear(), auj.getMonth(), 1)), dans7 = new Date(auj.getTime() + 7 * 86400000);
    const [recettes, actives, eleves, seances] = await Promise.all([
      P.moi.espaces.compta ? essai(P.bd(sb.from('compta_ecritures').select('montant').eq('sens', 'recette').eq('annule', false).gte('date_op', debutMois).lte('date_op', iso(auj)).limit(5000))) : null,
      P.moi.espaces.paiements ? essai(nombre(sb.from('agence_mannequins').select('id', { count: 'exact', head: true }).eq('statut', 'actif'))) : null,
      P.moi.espaces.site ? essai(nombre(sb.from('cours_talons').select('id', { count: 'exact', head: true }).eq('statut', 'inscrite'))) : null,
      P.moi.espaces.site ? essai(seancesSemaine(auj, dans7)) : null
    ]);
    return { encaisse: Array.isArray(recettes) ? recettes.reduce((t, x) => t + (Number(x.montant) || 0), 0) : null, actives, eleves, seances: seances || [] };
  }
  // (15/11/2026, « premium partout ») LA carte façon carte bancaire des tableaux de bord, écrite une fois : accueil
  // (« L'agence ce mois-ci »), Tableau du mois (Paiements), Tableau de bord (Comptabilité).
  // o : { titre, grand (texte), unite, legende, tuiles: [[nombre, texte]], suite (HTML déjà échappé) }
  P.sansFcfa = (n) => P.fcfa(n).replace(/\s*FCFA$/, '');   // (montant dans la carte, qui dit déjà « FCFA »)
  P.carteHero = (o) => {
    const tuile = (t) => (t[0] === null || t[0] === undefined ? '' : '<div><b>' + P.esc(String(t[0])) + '</b><span>' + P.esc(t[1]) + '</span></div>');
    const tuiles = (o.tuiles || []).map(tuile).join('');
    return '<div class="ag-carte apparait" style="--i:1"><div class="ag-tete"><img src="/assets/logo-header.png" alt=""><span>' + P.esc(o.titre) + '</span></div>' +
      (o.grand !== undefined && o.grand !== null ? '<div class="ag-grand">' + P.esc(o.grand) + (o.unite ? ' <small>' + P.esc(o.unite) + '</small>' : '') + '</div>' : '') +
      (o.legende ? '<div class="ag-leg">' + P.esc(o.legende) + '</div>' : '') + (o.suite || '') + (tuiles ? '<div class="ag-tuiles">' + tuiles + '</div>' : '') + '</div>';
  };
  function carteAgence(a) {
    if (!a || (a.encaisse === null && a.actives === null && a.eleves === null)) return '';
    const mois = P.MOIS[new Date().getMonth()];
    return P.carteHero({ titre: 'L’AGENCE CE MOIS-CI', grand: a.encaisse !== null ? P.sansFcfa(a.encaisse) : null, unite: 'FCFA',
      legende: a.encaisse !== null ? 'encaissés en ' + mois + ' · mensualités, cours de talons, cachets…' : '',
      tuiles: [[a.actives, 'mannequins actives'], [a.eleves, 'élèves des cours de talons']] });
  }
  const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  function semaine(site, a) {
    if (!P.moi.espaces.site) return '';
    const auj = new Date(), jours = [];
    for (let k = 0; k < 7; k++) { const d = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() + k); jours.push({ d, cle: iso(d), lignes: [] }); }
    const heure = (t) => { const d = new Date(t); return d.getUTCHours() + ' h' + (d.getUTCMinutes() ? ' ' + String(d.getUTCMinutes()).padStart(2, '0') : ''); };   // (Abidjan = UTC)
    // castings, défilés, projets de l'agenda (à cheval sur plusieurs jours : chaque jour)
    ((site && site.projets) || []).forEach((p) => jours.forEach((j) => {
      if (p.date_debut <= j.cle && (p.date_fin || p.date_debut) >= j.cle) j.lignes.push(['📅', p.titre, [p.type === 'casting' ? 'casting' : p.type === 'defile' ? 'défilé' : '', [p.lieu, p.ville].filter(Boolean).join(', ')].filter(Boolean).join(' · '), '#/site/b2-convocations']);
    }));
    // (15/11/2026, maquette validée : maquettes/accueil-administration.html) le cours des mannequins de l'agence, chaque
    // dimanche de 15 h à 18 h (heures données par la propriétaire le 15/11/2026 ; liste de présence : Présences), jamais
    // pendant les congés (js/presences-calcul.js)
    const P2 = window.Presences;
    if (P2) jours.forEach((j) => { if (j.d.getDay() === 0 && !P2.enVacances(j.cle)) j.lignes.push(['🎓', 'Cours des mannequins', '15 h – 18 h · liste de présence', '#/site/b2-presences']); });
    // cours de talons : le groupe en une ligne (nombre d'élèves), chaque cours privé avec l'élève et son thème
    const groupes = {};
    ((a && a.seances) || []).forEach((s) => {
      const c = s.cours_talons || {}, j = jours.find((x) => x.cle === iso(new Date(s.debut)));
      // (14/11/2026) cours privés réservés à l'inscription : « occupe » est calculé par la base (supabase-creneaux-prives.sql :
      // jamais une inscription annulée, une réservation pas payée seulement 48 h) ; pas encore payé → « à confirmer »
      const aConfirmer = !c.valide_le && c.statut !== 'inscrite' && c.statut !== 'terminee';
      if (!j || s.occupe === false || c.statut === 'annulee') return;
      if (c.formule === 'groupe') { const k = j.cle + heure(s.debut); if (!groupes[k]) { groupes[k] = ['👠', 'Cours de talons en groupe', '', '#/site/b2-cours-talons', 0, heure(s.debut)]; j.lignes.push(groupes[k]); } groupes[k][4]++; groupes[k][2] = groupes[k][5] + ' · ' + groupes[k][4] + (groupes[k][4] > 1 ? ' élèves' : ' élève'); }
      else j.lignes.push(['👠', 'Cours privé · ' + ((c.civilite === 'mademoiselle' || (!c.civilite && (window.TalonsCommun ? window.TalonsCommun.mineure(c) : c.mineure === true || c.age < 18))) ? 'Mlle ' : 'Mme ') + (c.nom || ''), [heure(s.debut), s.theme ? '« ' + s.theme + ' »' : '', aConfirmer ? 'à confirmer (paiement)' : ''].filter(Boolean).join(' · '), '#/site/b2-cours-talons']);
    });
    const html = jours.filter((j, k) => k === 0 || j.lignes.length).map((j, k) => '<div class="se-jour' + (k === 0 ? ' auj' : '') + '"><div class="se-date"><small>' + JOURS_COURTS[j.d.getDay()] + '</small><b>' + j.d.getDate() + '</b></div>' +
      (j.lignes.length ? '<ul>' + j.lignes.map((l) => '<li><a href="' + l[3] + '"><i aria-hidden="true">' + l[0] + '</i><span>' + P.esc(l[1]) + (l[2] ? ' <small>· ' + P.esc(l[2]) + '</small>' : '') + '</span></a></li>').join('') + '</ul>'
        : '<p class="se-vide">Rien de prévu aujourd’hui</p>') + '</div>').join('');
    return '<h2 class="tu-titre apparait" style="--i:1">Cette semaine</h2><div class="se-semaine apparait" style="--i:1">' + html + '</div>';
  }
  function dateCourte(d) { const s = String(d).slice(0, 10).split('-'); return Number(s[2]) + ' ' + P.MOIS[Number(s[1]) - 1]; }
  // le prochain projet en une ligne (11/11/2026, accueil apaisé) : la date en carré blanc, le titre, les réponses
  function affiche(site) {
    const p = site.prochain;
    if (!p) return '';
    const auj = P.aujourdhui(), enCours = p.date_debut === auj || (p.date_fin && p.date_debut <= auj && p.date_fin >= auj);
    const j = String(p.date_debut).slice(0, 10).split('-');
    const r = site.reponses;
    return '<a class="affiche affiche-ligne apparait" href="#/site/b2-convocations" data-projet="' + P.esc(p.id) + '" style="--i:2"><span class="af-date" aria-hidden="true"><b>' + Number(j[2]) + '</b><small>' + P.esc(moisCourtDe(p.date_debut).toUpperCase()) + '</small></span>' +
      '<span class="txt"><span class="surtitre">' + (enCours ? 'Aujourd’hui' : 'Prochain événement') + (p.lieu || p.ville ? ' · ' + P.esc([p.lieu, p.ville].filter(Boolean).join(', ')) : '') + '</span>' +
      '<span class="titre">' + P.esc(p.titre) + '</span>' +
      (r ? '<span class="reponses">' + r.confirme + ' sur ' + r.total + ' confirmées' + (r.sans ? ' · ' + r.sans + ' sans réponse' : '') + '</span>' +
        '<span class="jauge"><i data-largeur="' + Math.round(100 * r.confirme / Math.max(1, r.total)) + '"></i></span>' : '<span class="reponses">Aucune convocation envoyée pour l’instant</span>') +
      '</span></a>';
  }
  function taches(site, paiements) {
    const t = [];
    if (site && site.nouvelles) t.push(['#/site/b2-candidatures', 'Candidatures à étudier', 'Casting et agence', site.nouvelles, true]);
    if (site && site.aValider) t.push(['#/site/b2-validations', 'Fiches mannequins à valider', 'Espace mannequin', site.aValider, true]);
    if (site && site.recruteurs) t.push(['#/site/b2-recruteurs', 'Demandes de recruteurs à lire', 'Marques et organisateurs', site.recruteurs, true]);
    if (site && site.reponses && site.reponses.sans) t.push(['#/site/b2-convocations', 'Mannequins sans réponse', site.prochain.titre, site.reponses.sans, true]);
    if (paiements && paiements.declares) t.push(['#/paiements/a-valider', 'Paiements « J’ai payé » à valider', 'Wave et espèces', paiements.declares, true]);
    if (!t.length) return '<div class="taches apparait" style="--i:2"><div class="tache"><span class="point"></span><span class="t">Rien d’urgent<small>Tout est à jour pour le moment.</small></span></div></div>';
    return '<div class="taches apparait" style="--i:2">' + t.map((x) => '<a class="tache" href="' + x[0] + '"><span class="point' + (x[4] ? ' chaud' : '') + '"></span>' +
      '<span class="t">' + P.esc(x[1]) + '<small>' + P.esc(x[2]) + '</small></span><b>' + P.compte(x[3]) + '</b></a>').join('') + '</div>';
  }
  // 8 grandes tuiles (11/11/2026, maquette validée par la propriétaire) : celles de l'Administration du site
  // (js/admin/site.js, P.TUILES_SITE), puis Paiements et Comptabilité ; chacune selon les droits du rôle
  function tuilesAccueil(site, paiements) {
    const tuile = (lien, ic, titre, sous, badge, discret, i) => '<a class="tu apparait' + (discret ? ' discret' : '') + '" style="--i:' + (3 + i) + '" href="' + lien + '">' +
      '<em aria-hidden="true">' + ic + '</em>' + (badge ? '<i>' + P.compte(badge) + '</i>' : '') + '<b class="nom">' + P.esc(titre) + '</b><small>' + P.esc(sous) + '</small></a>';
    const l = [];
    const badges = site ? { castings: (site.nouvelles || 0) + (site.recruteurs || 0), mannequins: site.aValider || 0 } : {};
    const siteT = P.moi.espaces.site && P.TUILES_SITE ? P.TUILES_SITE : [];
    siteT.filter((x) => !x.discret).forEach((x) => l.push(['#/site/tuile-' + x.cle, x.ic, x.titre, x.sous, badges[x.cle], false]));
    if (P.moi.espaces.paiements && P.espaces.paiements) l.push(['#/paiements/' + (P.espaces.paiements.pages.accueil ? 'accueil' : premierePage(P.espaces.paiements)), '💳', 'Paiements', 'Mensualités, cachets', paiements && paiements.declares, false]);
    if (P.moi.espaces.compta && P.espaces.compta) l.push(['#/compta/' + (P.espaces.compta.pages.accueil ? 'accueil' : premierePage(P.espaces.compta)), '📒', 'Comptabilité', 'Recettes, dépenses', 0, false]);
    siteT.filter((x) => x.discret).forEach((x) => l.push(['#/site/tuile-' + x.cle, x.ic, x.titre, x.sous, 0, true]));
    return l.length ? '<h2 class="tu-titre apparait" style="--i:3">Tout gérer</h2><div class="tuiles-accueil">' + l.map((x, i) => tuile(x[0], x[1], x[2], x[3], x[4], x[5], i)).join('') + '</div>' : '';
  }
  // recherche de l'accueil : une rubrique (toutes celles du rôle) ou une mannequin publiée (par son nom)
  function rubriquesCherchables() {
    const l = [];
    ['site', 'paiements', 'compta'].filter((k) => P.moi.espaces[k] && P.espaces[k]).forEach((k) =>
      P.espaces[k].nav.forEach((n) => { if (n[0]) l.push(['#/' + k + '/' + n[0], n[1]]); }));
    (P.moi.espaces.site && P.TUILES_SITE ? P.TUILES_SITE : []).forEach((x) => l.push(['#/site/tuile-' + x.cle, x.titre]));
    return l;
  }
  const sansAccents = (x) => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let rechercheMinuteur = 0, rechercheNo = 0;
  function brancherRecherche() {
    const champ = document.getElementById('av-recherche'), zone = document.getElementById('av-resultats');
    if (!champ || !zone) return;
    champ.addEventListener('input', () => {
      clearTimeout(rechercheMinuteur);
      const q = champ.value.trim(), n = ++rechercheNo;
      if (q.length < 2) { zone.innerHTML = ''; zone.hidden = true; return; }
      const rub = rubriquesCherchables().filter((r) => sansAccents(r[1]).includes(sansAccents(q))).slice(0, 6);
      const dessiner = (mannequins) => {
        if (n !== rechercheNo) return;
        const lignes = rub.map((r) => '<a href="' + r[0] + '"><em aria-hidden="true">📂</em>' + P.esc(r[1]) + '</a>')
          .concat((mannequins || []).map((m) => '<a href="#/site/b2-mannequins-publies/' + P.esc(encodeURIComponent(m.id)) + '"><em aria-hidden="true">👩🏾</em>' + P.esc(m.full_name) + '</a>'));
        zone.innerHTML = lignes.length ? lignes.join('') : '<p>Rien trouvé pour « ' + P.esc(q) + ' ».</p>';
        zone.hidden = false;
        const navigation = document.querySelector('.onglets-bas');
        const limite = navigation && navigation.offsetHeight ? navigation.getBoundingClientRect().top : window.innerHeight;
        const hauteur = Math.max(0, limite - zone.getBoundingClientRect().top - 8);
        zone.style.setProperty('--av-resultats-disponible', hauteur + 'px');
      };
      dessiner(null);
      if (!P.moi.espaces.site) return;
      rechercheMinuteur = setTimeout(async () => {
        const motif = '%' + q.replace(/[%_,()\\]/g, ' ') + '%';
        const m = await essai(P.bd(sb.from('model_profiles').select('id, full_name').eq('published', true).ilike('full_name', motif).order('full_name').limit(6)));
        dessiner(m || []);
      }, 250);
    });
  }
  P.vuePortail = async () => {
    const d = dateDuJour();
    const [site, paiements, compta, agence] = await Promise.all([
      P.moi.espaces.site ? essai(donneesSite()) : null,
      P.moi.espaces.paiements ? essai(donneesPaiements()) : null,
      P.moi.espaces.compta ? essai(donneesCompta()) : null,
      essai(donneesAgence())
    ]);
    const phrase = {
      principal: 'voici l’essentiel.',
      site: 'Le site au quotidien : mannequins, castings, contenu. Aucune donnée financière.',
      caisse: 'Les paiements des mannequins : à valider, en retard, messages.',
      compta: 'La comptabilité de l’agence. Sur les mannequins, vous ne voyez que des totaux.'
    }[P.moi.role];
    const secu = lienSecurite();
    return '<div class="coque sans-menu">' + enTete('Accueil') +
      '<main class="contenu accueil-apaise" id="contenu">' +
      '<div class="accueil-tete"><div class="date"><span class="bj">Bonjour</span> <em>' + P.esc(P.moi.nom) + '</em></div>' +
      '<p class="bonjour">' + P.esc(d.jour.charAt(0).toUpperCase() + d.jour.slice(1) + ' ' + d.date) + ' · ' + P.esc(phrase) + '</p></div>' +
      '<div class="av-recherche apparait" style="--i:1"><label for="av-recherche" class="sr-only">Chercher une mannequin ou une rubrique</label>' +
        '<input id="av-recherche" type="search" autocomplete="off" placeholder="🔍 Chercher une mannequin, une rubrique…"><div id="av-resultats" class="av-resultats" hidden></div></div>' +
      (P.moi.espaces.site ? '<a class="av-envoyer apparait" style="--i:1" href="#/site/tuile-messages"><em aria-hidden="true">✉️</em><span>Envoyer un message<small>Convoquer, annoncer une sélection, informer…</small></span><i aria-hidden="true">›</i></a>' : '') +
      // (14/11/2026) la recherche reste en haut (ses résultats doivent se voir sur téléphone), puis les nouvelles cartes
      carteAgence(agence) + semaine(site, agence) +
      '<h2 class="tu-titre apparait" style="--i:1">À faire aujourd’hui</h2>' + taches(site, paiements) +
      (site ? affiche(site) : '') +
      tuilesAccueil(site, paiements) +
      '<div class="pied-portail"><span class="ligne"><a class="btn petit" href="' + secu[0] + '">' + P.esc(secu[1]) + '</a>' +
      (P.installee() ? '' : '<button class="btn petit" data-action="installer">Installer l’application</button>') +
      '<button class="btn petit" data-action="se-deconnecter">Déconnexion</button></span><a href="/" class="retour">Voir le site public →</a></div>' +
      '</main>' + barreBas('', false) + '</div>';
  };
  P.apresPortail = () => {
    brancherRecherche();
    // le prochain événement touché : son projet s'ouvre directement dans les Convocations (js/admin/site-convocations.js)
    const af = document.querySelector('.affiche[data-projet]');
    if (af) af.addEventListener('click', () => { window.convocationDemandee = af.dataset.projet; });
    P.animerChiffres(document.getElementById('app'));
    // la jauge des réponses se remplit après l'apparition de l'affiche
    setTimeout(() => document.querySelectorAll('.affiche .jauge i[data-largeur]').forEach((i) => { i.style.width = i.dataset.largeur + '%'; }), 350);
    // anciennes photos du Book : versions légères refaites en arrière-plan, une fois par session
    // (js/photos.js ; avant, par l'ancien tableau de bord, 8 secondes après la connexion)
    if (P.moi.espaces.site && typeof rattraperPhotosEnArrierePlan === 'function') {
      setTimeout(() => rattraperPhotosEnArrierePlan().catch((e) => console.warn('Rattrapage des photos :', e)), 8000);
    }
  };
})();
