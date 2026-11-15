// Page « Cours de talons » (Atelier Talons & Élégance, cours-talons.html et en/cours-talons.html, 08/11/2026).
// Inscription en 4 étapes : formule → la personne → 2 à 5 photos + une vidéo de sa marche → paiement Wave
// maintenant ou plus tard. Les photos et la vidéo partent vers Google Drive (sous-dossier « Cours de
// talons », même programme que les candidatures) au clic sur « Envoyer », sous les yeux de la personne (jauges),
// ALLÉGÉES (10/11/2026 : l'envoi faisait attendre plusieurs minutes et décourageait les élèves ; photos 1600 px,
// vidéo 480p, 3 minutes au plus), avec une jauge par photo et une pour la vidéo, qui passent au vert une fois
// arrivées ; puis la ligne est enregistrée par le serveur du site
// (anti-robots, table cours_talons, supabase-cours-talons.sql) : le statut et le montant sont décidés par la base.
// Si le SQL n'est pas encore installé, l'inscription est proposée par WhatsApp (rien n'est perdu).
// Outils partagés (js/app.js) : insererAvecPatience, envoyerPhotosAvecJauges, envoyerVideoVersDrive, majJauge,
// afficherMsg, enMo, dureeVideo, composerTelephone… ; allègement des vidéos : js/video-allegee.js.
(function () {
  'use strict';
  const form = document.getElementById('form-talons');
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  // Prix (décision de la propriétaire, 08/11/2026) : le groupe est un forfait de 4 dimanches par mois (prix du mois :
  // js/talons-commun.js) ; le privé se paie à la séance (à l'extérieur : 30 000 au départ, l'agence ajuste jusqu'à
  // 35 000 selon le lieu). La base reste seule juge du montant enregistré (cours_talons_montant, et pour le groupe le
  // déclencheur cours_talons_avant_inscription de supabase-programme-talons.sql).
  const PRIX = { groupe: window.TalonsCommun.PRIX_MOIS, prive_salle: 25000, prive_exterieur: 30000 };
  const WHATSAPP_AGENCE = window.TalonsCommun.NUMERO_AGENCE;  // js/talons-commun.js
  // 2 à 5 photos ; vidéo de 3 minutes au plus (décisions de la propriétaire, 10/11/2026). Le programme Google Drive
  // refuse plus de 60 Mo : la vidéo est allégée en 480p (environ 6 Mo la minute) et son poids final est vérifié.
  const PHOTOS_MAX = 5, PHOTOS_MIN = 2;
  const VIDEO_MAX_SECONDES = VIDEO_DUREE_MAX_SECONDES;  // (js/app.js)
  const VIDEO_MAX_OCTETS = VIDEO_ENVOI_MAX_OCTETS, VIDEO_MAX_ORIGINAL = VIDEO_ORIGINALE_MAX_OCTETS;  // (js/app.js)
  const ALLEGEMENT = VIDEO_ALLEGEMENT_RAPIDE;  // (js/app.js : 480p, ~6 Mo la minute)
  const fcfa = enFcfa;  // (js/app.js, comme LIEN_WAVE_AGENCE : le lien Wave des mensualités)

  remplirIndicatifs($('ct-indicatif'));
  remplirIndicatifs($('ct-parent-indicatif'));

  // ---------- état
  let etape = 1;
  let photos = [];
  let video = null, videoEnPreparation = null, numeroVideo = 0;
  // nouvel essai après une coupure : même identifiant (la base ne double pas l'inscription) et photos / vidéo déjà
  // envoyées vers Drive gardées (oubliées dès qu'on change les photos ou la vidéo)
  // (15/11/2026) ce numéro est aussi celui de l'envoi vers Drive : nouvelles photos ou nouvelle vidéo = nouveau numéro
  // (le programme Google réutilise le dossier d'un même numéro : il ne doit pas resservir les anciennes photos)
  let idInscription = crypto.randomUUID();
  // Ce qui est déjà arrivé sur Drive { liens, dossier, video } : gardé pour un nouvel essai (rien n'est renvoyé en
  // double), oublié dès qu'on change les photos ou la vidéo. envoiEnCours : jauges de l'envoi affichées.
  // (rangs : numéros des photos réellement envoyées, une photo illisible étant laissée de côté)
  let dejaEnvoye = { liens: [], rangs: [], dossier: null, video: null }, envoiEnCours = false;
  // (nouveau numéro seulement si l'inscription n'a encore jamais été tentée : sinon, elle est peut-être déjà
  // enregistrée, réponse perdue, et le même numéro évite de la doubler)
  let inscriptionTentee = false;
  function mediasChanges() { dejaEnvoye = { liens: [], rangs: [], dossier: null, video: null }; if (!inscriptionTentee) idInscription = crypto.randomUUID(); }

  const formule = () => (form.querySelector('input[name="formule"]:checked') || {}).value || '';
  const decision = () => (form.querySelector('input[name="decision"]:checked') || {}).value || '';
  // (14/11/2026, décision de la propriétaire) parcours, en groupe comme en privé : « Je débute » (tout le programme dans
  // l'ordre) ou « J'ai déjà la base » (elle coche ses thèmes, 1 ou 2 mois chacun ; en privé, 4 séances par mois).
  // Les thèmes sont lus dans la section « Le programme » de la page (#programme) : un seul endroit, traduit en anglais.
  const parcours = () => (form.querySelector('input[name="parcours"]:checked') || {}).value || '';
  const PROGRAMME = Array.from(document.querySelectorAll('#programme .lx-prog-mois[data-module]')).map((li) => ({
    module: +li.dataset.module, titre: li.querySelector('h3').textContent.trim(), themes: Array.from(li.querySelectorAll('ol li')).map((x) => x.textContent.trim()) }));
  const TITRE_SUITE = ((document.querySelector('#programme .lx-prog-mois--suite h3') || {}).textContent || '').trim();
  const titreModule = (m) => (PROGRAMME.find((x) => x.module === m) || {}).titre || TITRE_SUITE;
  // modules choisis, dans l'ordre, répétés selon la durée : {3,3,4} = La prestance 2 mois puis Le podium 1 mois
  // (privé : 7 mois de thèmes au plus, soit 28 séances — le privé est limité à 30 ; la base applique la même règle)
  const MAX_MOIS_PRIVE = 7;
  const modulesTous = () => (parcours() !== 'base' ? [] : Array.from(form.querySelectorAll('#ct-themes input[type="checkbox"]:checked'))
    .flatMap((c) => Array(Math.max(1, Math.min(2, parseInt(($('ct-duree-' + c.value) || {}).value, 10) || 1))).fill(+c.value)));
  const modulesChoisis = () => modulesTous().slice(0, formule() === 'groupe' ? 12 : MAX_MOIS_PRIVE);
  const nbSeances = () => (formule() === 'groupe' ? 4 : parcours() === 'base' ? Math.max(1, Math.min(30, 4 * modulesChoisis().length)) : Math.max(1, Math.min(30, parseInt($('ct-nb').value, 10) || 1)));
  // (14/11/2026) groupe sur plusieurs mois : 30 000 le mois, payé d'un coup ou mois par mois (la base décide du montant)
  const nbMois = () => (formule() !== 'groupe' ? 1 : parcours() === 'base' ? Math.max(1, modulesChoisis().length) : Math.max(1, Math.min(12, parseInt($('ct-mois').value, 10) || 1)));
  const paiementMois = () => (nbMois() > 1 && (form.querySelector('input[name="paiement"]:checked') || {}).value === 'mensuel' ? 'mensuel' : 'tout');
  const civilite = () => (form.querySelector('input[name="civilite"]:checked') || {}).value || '';
  const montant = () => (formule() === 'groupe' ? PRIX.groupe * (paiementMois() === 'mensuel' ? 1 : nbMois()) : (PRIX[formule()] || 0) * nbSeances());
  const age = () => parseInt($('ct-age').value, 10);
  const mineure = () => age() > 0 && age() < 18;

  function texteTotal() {
    const f = formule();
    if (!f) return '';
    if (f === 'groupe') {
      const m = nbMois();
      if (m === 1) return T('Total : ', 'Total: ') + fcfa(PRIX.groupe) + T(' pour les 4 séances (4 dimanches).', ' for the 4 sessions (4 Sundays).');
      if (paiementMois() === 'mensuel') return T(`À payer maintenant : ${fcfa(PRIX.groupe)} (le premier mois), puis ${fcfa(PRIX.groupe)} chaque mois, ${m} mois en tout (${4 * m} dimanches).`,
        `To pay now: ${fcfa(PRIX.groupe)} (the first month), then ${fcfa(PRIX.groupe)} each month, ${m} months in all (${4 * m} Sundays).`);
      return T(`Total : ${fcfa(montant())} pour ${m} mois (${4 * m} dimanches).`, `Total: ${fcfa(montant())} for ${m} months (${4 * m} Sundays).`);
    }
    const n = nbSeances(), s = n > 1 ? 's' : '';
    if (f === 'prive_salle') return T(`Total : ${fcfa(montant())} pour ${n} séance${s} de 2 h dans notre salle.`, `Total: ${fcfa(montant())} for ${n} 2-hour session${s} in our studio.`);
    return T(`Total : à partir de ${fcfa(montant())} pour ${n} séance${s} de 2 h (30 000 à 35 000 FCFA la séance selon le lieu ; l'agence vous confirme le prix exact).`,
      `Total: from ${fcfa(montant())} for ${n} 2-hour session${s} (30,000 to 35,000 FCFA per session depending on the place; the agency confirms the exact price).`);
  }
  // la liste des thèmes à cocher (« J'ai déjà la base ») : titre, ses 4 séances, 1 ou 2 mois
  (function dessinerThemes() {
    const boite = $('ct-themes');
    if (!boite) return;
    PROGRAMME.forEach((m) => {
      const l = document.createElement('div'); l.className = 'ct-theme';
      const lab = document.createElement('label'); lab.className = 'ct-theme-case';
      const c = document.createElement('input'); c.type = 'checkbox'; c.value = String(m.module); c.id = 'ct-theme-' + m.module;
      const t = document.createElement('span'); const b = document.createElement('strong'); b.textContent = m.titre;
      const e = document.createElement('em'); e.textContent = m.themes.join(' · ');
      t.appendChild(b); t.appendChild(e); lab.appendChild(c); lab.appendChild(t);
      const d = document.createElement('select'); d.id = 'ct-duree-' + m.module; d.setAttribute('aria-label', T('Durée : ', 'Length: ') + m.titre);
      [1, 2].forEach((n) => { const o = document.createElement('option'); o.value = String(n); o.textContent = T(n + ' mois', n + (n > 1 ? ' months' : ' month')); d.appendChild(o); });
      l.appendChild(lab); l.appendChild(d); boite.appendChild(l);
      c.addEventListener('change', majFormule); d.addEventListener('change', majFormule);
    });
  })();
  // « Votre programme » : ce qu'elle suivra, mois après mois (le privé : 4 séances par mois de programme)
  function dessinerProgrammeChoisi() {
    const boite = $('ct-programme-choisi'), liste = boite.querySelector('ol');
    const f = formule(), p = parcours();
    let mois = [];
    if (f && p === 'base') mois = modulesChoisis();
    else if (f && p === 'debut') mois = Array.from({ length: f === 'groupe' ? nbMois() : Math.ceil(nbSeances() / 4) }, (_, i) => Math.min(i + 1, 7));
    liste.textContent = '';
    mois.forEach((m, i) => {
      const li = document.createElement('li');
      const n = document.createElement('small'); n.textContent = f === 'groupe' ? T('Mois ', 'Month ') + (i + 1) : T('Séances ', 'Sessions ') + (4 * i + 1) + '–' + Math.min(4 * i + 4, nbSeances());
      const t = document.createElement('span'); t.textContent = titreModule(m) + (i > 0 && mois[i - 1] === m && m < 7 ? T(' (approfondissement)', ' (going further)') : '');
      li.appendChild(n); li.appendChild(t); liste.appendChild(li);
    });
    boite.classList.toggle('u-hidden', !mois.length);
  }
  // ---------- (14 et 15/11/2026, maquettes validées : maquettes/creneaux-prives.html et creneaux-prives-v2.html) cours
  // privés : trois façons — « je choisis maintenant » (créneaux libres, gardés 48 h), « je choisirai après mon
  // paiement » (sur son lien personnel), « dates à convenir ensemble ». Le choix des créneaux est commun avec la page de
  // l'élève : js/talons-creneaux.js. Base : supabase-creneaux-prives.sql ; pas encore collé → « à convenir » seulement.
  const TCr = window.TalonsCreneaux;
  const prive = () => !!formule() && formule() !== 'groupe';
  const choixCreneaux = () => (form.querySelector('input[name="choix_creneaux"]:checked') || {}).value || '';
  const convenir = () => choixCreneaux() === 'convenir';
  const maintenantChoisi = () => choixCreneaux() === 'maintenant';
  const selecteur = TCr.creer({
    jours: $('ct-jours'), heures: $('ct-heures'), liste: $('ct-choisis'), titre: $('ct-choisis-titre'), repeter: $('ct-repeter'), en: EN, nb: () => nbSeances(),
    lire: (du, jours) => (typeof sb !== 'undefined' && sb ? sb.rpc('cours_talons_creneaux_libres', { p_du: du, p_jours: jours }).then((r) => (r.error ? null : r.data)) : null),
    trop: (nb) => afficherMsg(msg, T('Vous avez déjà choisi vos ' + nb + ' séances : retirez-en une pour en choisir une autre.', 'You have already chosen your ' + nb + ' sessions: remove one to choose another.'), 'err'),
    change: () => { msg.className = 'form-msg'; msg.textContent = ''; majCreneaux(); }
  });
  const choisis = () => selecteur.choisis();
  function majCreneaux() {
    const p = prive();
    if (p && selecteur.etat() === null) selecteur.charger();
    // base pas prête : seulement « à convenir »
    const pret = selecteur.etat() !== false;
    if (!pret && p) { form.querySelector('input[name="choix_creneaux"][value="convenir"]').checked = true; }
    $('ct-facon-maintenant').classList.toggle('u-hidden', !pret);
    $('ct-facon-apres').classList.toggle('u-hidden', !pret);
    selecteur.ajuster();
    $('ct-bloc-facons').classList.toggle('u-hidden', !p);
    $('ct-bloc-creneaux').classList.toggle('u-hidden', !p || !maintenantChoisi());
    $('ct-bloc-dispo').classList.toggle('u-hidden', !p || !convenir());
    if (p && maintenantChoisi()) selecteur.dessiner();
  }
  form.querySelectorAll('input[name="choix_creneaux"]').forEach((r) => r.addEventListener('change', majCreneaux));
  function majFormule() {
    const f = formule();
    $('ct-bloc-prive').classList.toggle('u-hidden', !f || f === 'groupe');
    $('ct-bloc-adresse').classList.toggle('u-hidden', f !== 'prive_exterieur');
    majCreneaux();
    const base = parcours() === 'base';
    $('ct-bloc-parcours').classList.toggle('u-hidden', !f);
    $('ct-bloc-themes').classList.toggle('u-hidden', !base);
    $('ct-bloc-groupe').classList.toggle('u-hidden', f !== 'groupe' || !parcours());
    $('ct-champ-mois').classList.toggle('u-hidden', base);
    $('ct-champ-nb').classList.toggle('u-hidden', base);
    $('ct-bloc-paiement-mois').classList.toggle('u-hidden', f !== 'groupe' || nbMois() === 1);
    form.querySelectorAll('#ct-themes .ct-theme').forEach((t) => t.classList.toggle('choisi', t.querySelector('input').checked));
    dessinerProgrammeChoisi();
    $('ct-total').textContent = texteTotal();
    $('ct-total-final').textContent = texteTotal();
    $('ct-lien-wave').href = LIEN_WAVE_AGENCE + montant();
    dessinerMoyens();
  }
  // (13/11/2026, maquette premium validée) moyens allumés par l'agence en tuiles ; Wave garde son lien, les autres
  // affichent le numéro (ou le lien de la carte, ou le RIB) — js/moyens-paiement.js
  const MP = window.MoyensPaiement;
  let moyens = [{ code: 'wave', nom: 'Wave' }], moyenChoisi = 'wave';
  // le moyen montré est celui qui est enregistré (si Wave est éteint, le premier moyen allumé)
  const moyenActuel = () => moyens.find((x) => x.code === moyenChoisi) || moyens[0];
  function dessinerMoyens() {
    if (!MP) return;
    const m = moyenActuel();
    $('ct-moyens').innerHTML = MP.choix(moyens, m.code, 'talons');
    $('ct-lien-wave').classList.toggle('u-hidden', m.code !== 'wave');
    $('ct-consigne').innerHTML = MP.consigne(m, montant(), 'talons');
  }
  if (MP && typeof sb !== 'undefined' && sb) MP.charger(sb).then((l) => { moyens = l; dessinerMoyens(); });
  $('ct-bloc-wave').addEventListener('click', (e) => {
    const t = e.target.closest('[data-moyen]');
    if (t) { moyenChoisi = t.getAttribute('data-moyen'); dessinerMoyens(); }
  });
  form.querySelectorAll('input[name="formule"]').forEach((r) => r.addEventListener('change', majFormule));
  $('ct-nb').addEventListener('change', majFormule);
  $('ct-mois').addEventListener('change', majFormule);
  form.querySelectorAll('input[name="parcours"]').forEach((r) => r.addEventListener('change', majFormule));
  form.querySelectorAll('input[name="paiement"]').forEach((r) => r.addEventListener('change', majFormule));
  $('ct-objectif').addEventListener('change', () => $('ct-bloc-concours').classList.toggle('u-hidden', !['miss', 'beaute'].includes($('ct-objectif').value)));
  $('ct-age').addEventListener('input', () => $('ct-bloc-parent').classList.toggle('u-hidden', !mineure()));
  form.querySelectorAll('input[name="decision"]').forEach((r) => r.addEventListener('change', () => $('ct-bloc-wave').classList.toggle('u-hidden', decision() !== 'maintenant')));

  // ---------- étapes
  const msg = $('ct-msg');
  function montrer(n, defiler = true) {
    etape = n;
    form.querySelectorAll('.ct-etape').forEach((f) => f.classList.toggle('u-hidden', Number(f.dataset.etape) !== n));
    document.querySelectorAll('.lx-progression li').forEach((li, i) => { li.classList.toggle('actif', i === n - 1); li.classList.toggle('fait', i < n - 1); });
    $('ct-retour').classList.toggle('u-hidden', n === 1);
    $('ct-envoi-jauges').classList.toggle('u-hidden', n !== 4 || !envoiEnCours);
    $('ct-suivant').classList.toggle('u-hidden', n === 4);
    $('ct-envoyer').classList.toggle('u-hidden', n !== 4);
    msg.className = 'form-msg'; msg.textContent = '';
    const titre = form.querySelector('.ct-etape[data-etape="' + n + '"] .ct-etape-titre');
    if (defiler && titre && typeof titre.scrollIntoView === 'function') titre.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function erreur(texte, champ) {
    afficherMsg(msg, texte, 'err');
    if (champ && typeof champ.focus === 'function') champ.focus();
    return false;
  }
  function etapeValide(n) {
    if (n === 1) {
      if (!formule()) return erreur(T('Choisissez une formule.', 'Please choose an option.'));
      if (!parcours()) return erreur(T('Dites-nous si vous débutez ou si vous avez déjà la base.', 'Please tell us whether you are a beginner or already have the basics.'), form.querySelector('input[name="parcours"]'));
      if (parcours() === 'base' && formule() !== 'groupe' && modulesTous().length > MAX_MOIS_PRIVE) return erreur(T('En privé : 7 mois de thèmes au plus (28 séances). Retirez un thème ou passez-en un à 1 mois.', 'Private lessons: 7 months of themes at most (28 sessions). Remove a theme or set one to 1 month.'), form.querySelector('#ct-themes input:checked'));
      if (parcours() === 'base' && !modulesChoisis().length) return erreur(T('Cochez au moins un thème à travailler.', 'Please tick at least one theme to work on.'), form.querySelector('#ct-themes input'));
      if (formule() === 'prive_exterieur' && !$('ct-adresse').value.trim()) return erreur(T('Indiquez le lieu des cours.', 'Please give the place of the lessons.'), $('ct-adresse'));
      if (prive() && !choixCreneaux()) return erreur(T('Dites-nous quand vous choisirez vos créneaux.', 'Please tell us when you will choose your time slots.'), form.querySelector('input[name="choix_creneaux"]'));
      if (prive() && maintenantChoisi() && choisis().length < nbSeances()) {
        const reste = nbSeances() - choisis().length;
        return erreur(T('Choisissez vos créneaux (encore ' + reste + '), ou une autre façon ci-dessus.', 'Please choose your time slots (' + reste + ' more), or another option above.'), $('ct-heures').querySelector('button:not([disabled])') || $('ct-bloc-facons'));
      }
    }
    if (n === 2) {
      if (!civilite()) return erreur(T('Choisissez : Madame ou Mademoiselle.', 'Please choose: Mrs or Miss.'), form.querySelector('input[name="civilite"]'));
      if ($('ct-nom').value.trim().length < 2) return erreur(T('Indiquez votre nom.', 'Please give your name.'), $('ct-nom'));
      if (!/^[0-9 ]{6,14}$/.test($('ct-telephone').value.trim())) return erreur(T('Indiquez un numéro de téléphone valide.', 'Please give a valid phone number.'), $('ct-telephone'));
      if (!(age() >= 8 && age() <= 90)) return erreur(T('Indiquez votre âge.', 'Please give your age.'), $('ct-age'));
      if (mineure() && ($('ct-parent-nom').value.trim().length < 2 || !/^[0-9 ]{6,14}$/.test($('ct-parent-telephone').value.trim()))) {
        return erreur(T('Moins de 18 ans : indiquez le nom et le téléphone d’un parent ou tuteur.', 'Under 18: please give the name and phone of a parent or guardian.'), $('ct-parent-nom'));
      }
    }
    if (n === 3) {
      if (nbPhotosEnPreparation) return erreur(T('Vos photos sont en cours de préparation : un instant, puis appuyez à nouveau.', 'Your photos are being prepared: wait a moment, then tap again.'), $('ct-photos'));
      if (photos.length < PHOTOS_MIN) return erreur(T('Ajoutez 2 à 5 photos.', 'Please add 2 to 5 photos.'), $('ct-photos'));
      if (!video && !videoEnPreparation) return erreur(T('Ajoutez la vidéo de votre marche.', 'Please add the video of your walk.'), $('ct-video'));
    }
    return true;
  }
  $('ct-suivant').addEventListener('click', () => {
    if (etapeValide(etape)) montrer(etape + 1);
  });
  $('ct-retour').addEventListener('click', () => montrer(Math.max(1, etape - 1)));

  // ---------- photos (2 à 5)
  function rafraichirPhotos() {
    const boite = $('ct-photos-apercu');
    boite.querySelectorAll('img').forEach((im) => URL.revokeObjectURL(im.src));
    boite.innerHTML = '';
    photos.forEach((f, i) => {
      const fig = document.createElement('figure');
      const img = document.createElement('img'); img.src = URL.createObjectURL(f); img.alt = 'Photo ' + (i + 1);
      const b = document.createElement('button'); b.type = 'button'; b.textContent = '✕'; b.setAttribute('aria-label', T('Retirer la photo ', 'Remove photo ') + (i + 1));
      b.addEventListener('click', () => { photos.splice(i, 1); mediasChanges(); rafraichirPhotos(); });
      fig.append(img, b); boite.appendChild(fig);
    });
    const info = $('ct-photos-info');
    info.className = 'ct-info' + (photos.length && photos.length < PHOTOS_MIN ? ' err' : '');
    info.textContent = photos.length ? T(`${photos.length} photo${photos.length > 1 ? 's' : ''} sur ${PHOTOS_MAX}.`, `${photos.length} photo${photos.length > 1 ? 's' : ''} out of ${PHOTOS_MAX}.`) : '';
  }
  // (12/11/2026) chaque photo est lue et allégée DÈS QU'ELLE EST CHOISIE (preparerPhotosEnvoi, js/app.js)
  let photosEnPreparation = Promise.resolve(), nbPhotosEnPreparation = 0;
  $('ct-photos').addEventListener('change', (e) => {
    const nouvelles = Array.from(e.target.files || []).filter((f) => /^image\//.test(f.type || '') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name || ''));
    e.target.value = '';
    $('ct-photos-info').textContent = T('Préparation des photos…', 'Preparing the photos…');
    nbPhotosEnPreparation++;
    const travail = photosEnPreparation.then(() => preparerPhotosEnvoi(nouvelles)).then(({ pretes, illisibles }) => {
      nbPhotosEnPreparation--;
      photos = photos.concat(pretes).slice(0, PHOTOS_MAX);
      mediasChanges();
      rafraichirPhotos();
      if (illisibles.length) { const info = $('ct-photos-info'); info.className = 'ct-info err'; info.textContent += ' ' + textePhotosIllisibles(illisibles); }
    });
    photosEnPreparation = travail.catch(() => { nbPhotosEnPreparation = Math.max(0, nbPhotosEnPreparation - 1); });
  });

  // ---------- vidéo (3 minutes au plus, allégée sur l'appareil si elle est lourde)
  $('ct-video').addEventListener('change', async (e) => {
    const info = $('ct-video-info');
    const fichier = e.target.files && e.target.files[0];
    const numero = ++numeroVideo;
    video = null; videoEnPreparation = null; mediasChanges();
    cacherJauge('ct-video-jauge');
    info.className = 'ct-info';
    if (!fichier) { info.textContent = ''; return; }
    const refuser = (t) => { info.className = 'ct-info err'; info.textContent = t; e.target.value = ''; };
    if (!/^video\//.test(fichier.type || '') && !/\.(mp4|mov|m4v|3gp|webm)$/i.test(fichier.name || '')) return refuser(T("Ce fichier n'est pas une vidéo.", 'This file is not a video.'));
    if (fichier.size > VIDEO_MAX_ORIGINAL) return refuser(T(`Vidéo beaucoup trop lourde (${enMo(fichier.size)}). Choisissez une vidéo plus courte.`, `Video far too large (${enMo(fichier.size)}). Please choose a shorter video.`));
    info.textContent = T('Lecture de la vidéo…', 'Reading the video…');
    const examen = window.examinerVideo ? await window.examinerVideo(fichier) : { duree: null };
    if (numero !== numeroVideo) return;
    const duree = examen.duree || (fichier.size <= 300 * 1048576 ? await dureeVideo(fichier) : null);
    if (numero !== numeroVideo) return;
    if (duree && isFinite(duree) && duree > VIDEO_MAX_SECONDES) return refuser(T(`Vidéo trop longue (${dureeLisible(duree)}) : 3 minutes maximum.`, `Video too long (${dureeLisible(duree)}): 3 minutes maximum.`));
    info.textContent = '';
    videoEnPreparation = (async () => {
      let allegee = null;
      try {
        if (window.allegerVideo) allegee = await window.allegerVideo(fichier, (pc) => {
          if (numero !== numeroVideo) return;
          majJauge('ct-video-jauge', pc, T('Préparation de votre vidéo…', 'Preparing your video…'));
          if (envoiEnCours) majJauge('ct-jauge-video', pc, T('Vidéo : préparation…', 'Video: preparing…'));
        }, ALLEGEMENT);
      } catch (err) { allegee = null; }
      if (numero !== numeroVideo) return;
      cacherJauge('ct-video-jauge');
      const choisie = [allegee, fichier].find((f) => f && f.size <= VIDEO_MAX_OCTETS) || null;
      if (!choisie) { refuser(T(`Vidéo trop lourde pour ce téléphone (${enMo(fichier.size)}) : choisissez une vidéo plus courte, ou envoyez-la à l’agence sur WhatsApp.`, `Video too large for this phone (${enMo(fichier.size)}): choose a shorter video, or send it to the agency on WhatsApp.`)); }
      else { video = choisie; info.textContent = '✓ ' + T('Vidéo prête', 'Video ready') + ' (' + (duree ? dureeLisible(duree) + ', ' : '') + enMo(choisie.size) + ').'; }
      videoEnPreparation = null;
    })();
  });


  // (jauges : creerJauge et avancerDoucement, js/app.js)

  // ---------- envoi des photos et de la vidéo vers Drive (au clic sur « Envoyer », jauges visibles)
  // Attend d'abord la fin de la préparation de la vidéo (rien ne part si elle est refusée) ; ne renvoie pas ce qui
  // est déjà arrivé. Renvoie false si la vidéo manque, sinon met à jour dejaEnvoye.
  // (12/11/2026) l'inscription est GARDÉE DANS LE TÉLÉPHONE pendant l'envoi (EnvoiFiable, js/app.js) : si l'envoi est
  // coupé (page fermée, réseau perdu), il reprend tout seul quand la personne revient sur cette page.
  // etat : { ligne (l'inscription, sans photos ni vidéo), montant (texte), photos (prêtes), video, d (déjà arrivé), page }
  async function envoyerMedias(etat) {
    envoiEnCours = true;
    $('ct-envoi-jauges').classList.remove('u-hidden');
    const d = etat.d, liste = etat.photos || [];
    const boite = $('ct-jauges-photos'); boite.textContent = '';
    const ids = liste.map((f, i) => { boite.appendChild(creerJauge('ct-jauge-photo-' + (i + 1))); return 'ct-jauge-photo-' + (i + 1); });
    const nomPhoto = (i) => T('Photo ', 'Photo ') + (i + 1);
    const photosArrivees = () => jaugesPhotosArrivees(ids, d.rangs, d.liens.length, nomPhoto);  // (js/app.js)
    if (d.liens.length) photosArrivees();
    else ids.forEach((id, i) => majJauge(id, 0, nomPhoto(i) + T(' : en attente…', ': waiting…')));
    if (!d.video) majJauge('ct-jauge-video', 0, T('Vidéo : en attente…', 'Video: waiting…'));
    const infosDrive = { nom: etat.ligne.nom, email: '', phone: etat.ligne.telephone, type: 'projet', projet: 'Cours de talons', source: 'cours_talons', ref: etat.ligne.id };
    if (!d.liens.length) {
      // (envoyerPhotosAvecJauges, js/app.js : le même outil que les candidatures ; le programme Google enregistre lui-même
      // les liens dans la base, l'inscription les reprend à son arrivée même si la réponse s'est perdue)
      const r = await envoyerPhotosAvecJauges(liste, ids, nomPhoto, infosDrive);
      d.liens = r.liens || []; d.rangs = r.rangs; d.dossier = r.dossier || null;
      if (d.liens.length) await EnvoiFiable.garder('cours-talons', etat);
    }
    if (!d.video) {
      d.video = await envoyerVideoAvecJauge(URL_SCRIPT_PHOTOS_CASTING, { ...infosDrive, dossier: d.dossier }, etat.video, 'ct-jauge-video');
      if (d.video) await EnvoiFiable.garder('cours-talons', etat);
    } else majJauge('ct-jauge-video', 100, T('Vidéo : envoyée ✓', 'Video: sent ✓'));
  }

  // ---------- envoi
  function ligneInscription(liensPhotos, lienVideo) {
    const f = formule();
    return {
      formule: f, nb_seances: nbSeances(), nb_mois: nbMois(), paiement: paiementMois(), civilite: civilite() || null,
      parcours: parcours() || 'debut', modules: parcours() === 'base' ? modulesChoisis() : null,
      nom: $('ct-nom').value.trim(),
      telephone: composerTelephone($('ct-indicatif'), $('ct-telephone')),
      age: age(),
      quartier: $('ct-quartier').value.trim() || null,
      objectif: $('ct-objectif').value || null,
      concours: ['miss', 'beaute'].includes($('ct-objectif').value) ? ($('ct-concours').value.trim() || null) : null,
      concours_date: ['miss', 'beaute'].includes($('ct-objectif').value) ? ($('ct-concours-date').value || null) : null,
      niveau: (form.querySelector('input[name="niveau"]:checked') || {}).value || null,
      // (14/11/2026) créneaux choisis (la base les réserve) ; ils sont aussi écrits pour l'agence (résumé WhatsApp)
      creneaux: prive() && maintenantChoisi() ? choisis() : null,
      choix_creneaux: prive() ? choixCreneaux() || 'convenir' : null,
      disponibilites: f === 'groupe' ? null : maintenantChoisi() ? ('Créneaux choisis : ' + TCr.pourAgence(choisis())).slice(0, 600)
        : choixCreneaux() === 'apres' ? 'Choisira ses créneaux après son paiement (sur son lien)' : ($('ct-dispo').value.trim() || null),
      adresse: f === 'prive_exterieur' ? $('ct-adresse').value.trim() : null,
      parent_nom: mineure() ? $('ct-parent-nom').value.trim() : null,
      parent_telephone: mineure() ? composerTelephone($('ct-parent-indicatif'), $('ct-parent-telephone')) : null,
      photos: liensPhotos, video: lienVideo || null,
      decision: decision(),
      reference_wave: decision() === 'maintenant' ? ($('ct-ref-wave').value.trim() || null) : null,
      ...(decision() === 'maintenant' && moyenActuel().code !== 'wave' ? { moyen: moyenActuel().code } : {})
    };
  }
  const NOMS_FORMULES = { groupe: 'En groupe (4 dimanches par mois)', prive_salle: 'Privé dans la salle', prive_exterieur: 'Privé à l’extérieur' };
  function resume(l, montantTexte) {
    return [`Inscription aux cours de talons${EN ? ' (site en anglais)' : ''}`,
      `Formule : ${NOMS_FORMULES[l.formule]}${l.formule === 'groupe' ? (l.nb_mois > 1 ? ' · ' + l.nb_mois + ' mois, payés ' + (l.paiement === 'mensuel' ? 'mois par mois' : 'en une fois') : '') : ' · ' + l.nb_seances + ' séance(s)'} · ${montantTexte}`,
      l.parcours === 'base' ? `Parcours : a déjà la base · thèmes : ${window.TalonsCommun.grouperModules(l.modules).map((x) => titreModule(x.m) + ' (' + x.n + ' mois)').join(', ')}` : 'Parcours : débute (tout le programme)',
      `Nom : ${l.civilite ? window.TalonsCommun.civilite(l.civilite) + ' ' : ''}${l.nom} · ${l.age} ans · ${l.telephone}`, l.quartier ? `Quartier : ${l.quartier}` : '',
      l.objectif ? `Objectif : ${l.objectif}${l.concours ? ' · ' + l.concours : ''}${l.concours_date ? ' le ' + l.concours_date : ''}` : '',
      l.niveau ? `Niveau : ${l.niveau}` : '', l.adresse ? `Lieu : ${l.adresse}` : '', l.disponibilites ? `Disponibilités : ${l.disponibilites}` : '',
      l.parent_nom ? `⚠️ Mineure. Parent : ${l.parent_nom} · ${l.parent_telephone}` : '',
      `Paiement : ${l.decision === 'maintenant' ? 'payé maintenant par ' + (MP ? MP.nom(l.moyen || 'wave') : 'Wave') + (l.reference_wave ? ' (réf. ' + l.reference_wave + ')' : '') : 'plus tard'}`,
      l.photos.length ? 'Photos : ' + l.photos.join(' ') : 'Photos : non reçues', 'Vidéo : ' + (l.video || 'non reçue')].filter(Boolean).join('\n');
  }

  async function terminerInscription(etat, reprise) {
    afficherMsg(msg, T('Envoi de vos photos et de votre vidéo… Vous pouvez passer sur une autre application : l’envoi continue, et s’il est coupé, il reprendra quand vous reviendrez sur cette page.', 'Sending your photos and video… You can switch to another app: sending continues, and if it is interrupted it will resume when you come back to this page.'), 'ok');
    await envoyerMedias(etat);
    afficherMsg(msg, T('Enregistrement de votre inscription…', 'Saving your sign-up…'), 'ok');
    const envoi = { liens: etat.d.liens.slice() }, lienVideo = etat.d.video;
    // 3) l'inscription (le serveur vérifie, la base décide du statut et du montant)
    const ligne = Object.assign({}, etat.ligne, { photos: envoi.liens, video: lienVideo || null });
    inscriptionTentee = true;
    let { error } = await insererAvecPatience('cours_talons', ligne, (reste) => afficherMsg(msg, texteAttenteEnvoi(reste), 'ok'));
    // (14/11/2026) un créneau pris entre-temps par une autre élève : rien n'est enregistré. Sur la page, elle en
    // choisit un autre (photos et vidéo déjà envoyées gardées) ; à la reprise d'un envoi coupé (formulaire vide),
    // l'inscription part sans créneau, ses souhaits écrits pour l'agence, qui l'appelle.
    if (error && error.creneauPris && !reprise) {
      await EnvoiFiable.oublier('cours-talons');
      envoiEnCours = false;
      await selecteur.relire();
      majCreneaux();
      montrer(1);
      erreur(T('Un de vos créneaux n’est plus disponible (réservé entre-temps). Choisissez-en un autre, puis renvoyez votre inscription (vos photos et votre vidéo sont gardées).', 'One of your slots is no longer available (booked in the meantime). Please choose another one, then send your sign-up again (your photos and video are kept).'), $('ct-heures'));
      return;
    }
    if (error && error.creneauPris) {
      Object.assign(ligne, { creneaux: null, choix_creneaux: 'convenir', disponibilites: ('À convenir (créneaux souhaités, un n’était plus libre) : ' + TCr.pourAgence(etat.ligne.creneaux || [])).slice(0, 600) });
      ({ error } = await insererAvecPatience('cours_talons', ligne, (reste) => afficherMsg(msg, texteAttenteEnvoi(reste), 'ok')));
    }
    const lienWhatsApp = 'https://wa.me/' + WHATSAPP_AGENCE + '?text=' + encodeURIComponent(resume(ligne, etat.montant));
    if (error && !error.pasPret) {
      afficherMsg(msg, T('Une erreur est survenue. Réessayez, ou envoyez votre inscription sur WhatsApp.', 'An error occurred. Please try again, or send your sign-up on WhatsApp.'), 'err');
      const a = document.createElement('a'); a.href = lienWhatsApp; a.target = '_blank'; a.rel = 'noopener'; a.textContent = ' ' + T('Envoyer sur WhatsApp', 'Send on WhatsApp'); msg.appendChild(a);
      return;
    }
    if (!error) envoyerNotificationEmail({ name: ligne.nom + ' (cours de talons)', telephone: ligne.telephone, email: '', message: resume(ligne, etat.montant) });
    await EnvoiFiable.oublier('cours-talons');
    void EnvoiFiable.prevenir(T('Inscription envoyée ✓', 'Sign-up sent ✓'), T('Merci ! Votre inscription aux cours de talons est bien arrivée chez Maître Akesse Model Management.', 'Thank you! Your heels class sign-up has reached Maître Akesse Model Management.'), etat.page);
    if (window.jouerSon) window.jouerSon('envoi');
    msg.className = 'form-msg'; msg.textContent = '';
    const merci = $('ct-merci');
    merci.classList.remove('u-hidden');
    merci.textContent = '';
    const p1 = document.createElement('p');
    p1.textContent = error
      ? T('Merci ! Les inscriptions en ligne ouvrent très bientôt : touchez le bouton ci-dessous pour envoyer votre inscription à l’agence sur WhatsApp.', 'Thank you! Online sign-ups open very soon: tap the button below to send your sign-up to the agency on WhatsApp.')
      : (ligne.decision === 'maintenant'
        ? (ligne.choix_creneaux === 'apres'
          ? T('Merci ! Votre inscription est bien reçue. Dès que l’agence voit votre paiement, vous recevrez votre lien personnel pour choisir vos créneaux.', 'Thank you! Your sign-up has been received. As soon as the agency sees your payment, you will receive your personal link to choose your slots.')
          : ligne.creneaux && ligne.creneaux.length
          ? T('Merci ! Votre inscription est bien reçue. Dès que l’agence voit votre paiement, elle vous confirme vos créneaux sur WhatsApp.', 'Thank you! Your sign-up has been received. As soon as the agency sees your payment, it confirms your slots on WhatsApp.')
          : T('Merci ! Votre inscription est bien reçue. Dès que l’agence voit votre paiement, elle vous confirme votre place sur WhatsApp.', 'Thank you! Your sign-up has been received. As soon as the agency sees your payment, it confirms your place on WhatsApp.'))
        : ligne.choix_creneaux === 'apres'
          ? T('Merci ! Votre inscription est bien reçue. Dès votre paiement validé, vous recevrez votre lien personnel pour choisir vos créneaux.', 'Thank you! Your sign-up has been received. Once your payment is confirmed, you will receive your personal link to choose your slots.')
          : ligne.creneaux && ligne.creneaux.length
          ? T('Merci ! Votre inscription est bien reçue et vos créneaux sont gardés 48 h, le temps de votre paiement. L’agence vous recontacte sur WhatsApp.', 'Thank you! Your sign-up has been received and your slots are held for 48 hours while you pay. The agency will contact you on WhatsApp.')
          : T('Merci ! Votre inscription est bien reçue. L’agence vous recontacte sur WhatsApp pour fixer la date et le paiement.', 'Thank you! Your sign-up has been received. The agency will contact you on WhatsApp to set the date and the payment.'));
    merci.appendChild(p1);
    if (envoi.liens.length && lienVideo) {
      const pOk = document.createElement('p');
      const nb = envoi.liens.length, manque = (etat.photos || []).length - nb;
      pOk.textContent = '✓ ' + T(`${nb > 1 ? 'Vos ' + nb + ' photos' : 'Votre photo'} et votre vidéo sont bien arrivées à l’agence.`, `Your ${nb > 1 ? nb + ' photos' : 'photo'} and your video have reached the agency.`)
        + (manque > 0 ? ' ' + T(`(${manque} photo${manque > 1 ? 's' : ''} illisible${manque > 1 ? 's' : ''} : envoyez-la${manque > 1 ? 's' : ''} sur WhatsApp si besoin.)`, `(${manque} unreadable photo${manque > 1 ? 's' : ''}: send ${manque > 1 ? 'them' : 'it'} on WhatsApp if needed.)`) : '');
      merci.appendChild(pOk);
    }
    if (error) { const a = document.createElement('a'); a.href = lienWhatsApp; a.target = '_blank'; a.rel = 'noopener'; a.className = 'btn btn--principal'; a.textContent = T('Envoyer sur WhatsApp', 'Send on WhatsApp'); merci.appendChild(a); }
    if (!envoi.liens.length || !lienVideo) {
      const p2 = document.createElement('p');
      p2.textContent = T('Vos photos ou votre vidéo n’ont pas pu partir (connexion instable ?) : envoyez-les sur WhatsApp au +225 05 45 65 66 87 avec votre nom.', 'Your photos or video could not be sent (unstable connection?): please send them on WhatsApp to +225 05 45 65 66 87 with your name.');
      merci.appendChild(p2);
    }
    form.querySelectorAll('.ct-etape, .ct-boutons').forEach((el) => el.classList.add('u-hidden'));
    if (typeof merci.scrollIntoView === 'function') merci.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    for (const n of [1, 2, 3]) if (!etapeValide(n)) { montrer(n); etapeValide(n); return; }
    if (!decision()) return erreur(T('Choisissez : payer maintenant ou plus tard.', 'Please choose: pay now or later.'));
    if (!$('ct-consentement').checked) return erreur(T('Cochez la case pour accepter la politique de confidentialité.', 'Please tick the box to accept the privacy policy.'), $('ct-consentement'));
    EnvoiFiable.demanderNotifications();  // (12/11/2026 : « Inscription envoyée ✓ » si elle passe sur une autre application)
    const btn = $('ct-envoyer'); btn.disabled = true; $('ct-retour').disabled = true;
    try {
      if (!video && !videoEnPreparation) { montrer(3); erreur(T('Ajoutez la vidéo de votre marche.', 'Please add the video of your walk.'), $('ct-video')); return; }
      // (le message et les jauges d'abord : la préparation de la vidéo peut prendre un moment)
      envoiEnCours = true; $('ct-envoi-jauges').classList.remove('u-hidden');
      afficherMsg(msg, T('Préparation de votre vidéo…', 'Preparing your video…'), 'ok');
      if (videoEnPreparation) await videoEnPreparation;
      await photosEnPreparation;
      if (!video) { envoiEnCours = false; montrer(3); erreur(T('Ajoutez la vidéo de votre marche.', 'Please add the video of your walk.'), $('ct-video')); return; }
      const etat = { ligne: Object.assign({ id: idInscription }, ligneInscription([], null)), montant: fcfa(montant()), photos, video, d: dejaEnvoye, page: location.pathname };
      await EnvoiFiable.garder('cours-talons', etat);
      await EnvoiFiable.seul('cours-talons', () => terminerInscription(etat), true);
    } finally {
      btn.disabled = false; $('ct-retour').disabled = false;
    }
  });

  majFormule();
  montrer(1, false);  // (sans défilement au chargement)
  // Reprise d'un envoi coupé (12/11/2026) : l'inscription gardée dans le téléphone se termine toute seule
  window.MA2M_REPRISE_ICI = 'cours-talons';
  void (async () => {
    const etat = await EnvoiFiable.lire('cours-talons');
    if (!etat || !etat.ligne) return;
    const btn = $('ct-envoyer'); btn.disabled = true;
    montrer(4, false);
    afficherMsg(msg, T('Votre inscription n’avait pas fini de s’envoyer : nous terminons l’envoi…', 'Your sign-up had not finished sending: we are finishing it…'), 'ok');
    if (typeof msg.scrollIntoView === 'function') msg.scrollIntoView({ block: 'center' });
    const annuler = document.createElement('button');
    annuler.type = 'button'; annuler.className = 'lien-annuler-envoi'; annuler.textContent = T('Annuler cet envoi', 'Cancel this submission');
    annuler.addEventListener('click', async () => { await EnvoiFiable.oublier('cours-talons'); location.reload(); });
    msg.appendChild(annuler);
    try { await EnvoiFiable.seul('cours-talons', () => terminerInscription(etat, true), false); } finally { btn.disabled = false; }
  })();
})();
