// Page « Cours de talons » (Atelier Talons & Élégance, cours-talons.html et en/cours-talons.html, 08/11/2026).
// Inscription en 4 étapes : formule → la personne → 2 ou 3 photos + une vidéo de sa marche → paiement Wave
// maintenant ou plus tard. Les photos et la vidéo partent d'abord vers Google Drive (sous-dossier « Cours de
// talons », même programme que les candidatures) ; puis la ligne est enregistrée par le serveur du site
// (anti-robots, table cours_talons, supabase-cours-talons.sql) : le statut et le montant sont décidés par la base.
// Si le SQL n'est pas encore installé, l'inscription est proposée par WhatsApp (rien n'est perdu).
// Outils partagés (js/app.js) : insererAvecPatience, envoyerPhotosVersDrive, envoyerVideoVersDrive, majJauge,
// afficherMsg, enMo, dureeVideo, composerTelephone… ; allègement des vidéos : js/video-allegee.js.
(function () {
  'use strict';
  const form = document.getElementById('form-talons');
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  // Prix (décision de la propriétaire, 08/11/2026) : le groupe est un forfait de 4 dimanches ; le privé se paie à la
  // séance (à l'extérieur : 30 000 au départ, l'agence ajuste jusqu'à 35 000 selon le lieu). Mêmes valeurs que
  // cours_talons_montant() dans la base, qui reste seule juge du montant enregistré.
  const PRIX = { groupe: 30000, prive_salle: 25000, prive_exterieur: 30000 };
  const WHATSAPP_AGENCE = '2250545656687';
  const VIDEO_MAX_SECONDES = 65, VIDEO_MAX_OCTETS = 60 * 1024 * 1024, VIDEO_MAX_ORIGINAL = 2 * 1024 * 1024 * 1024;
  const fcfa = enFcfa;  // (js/app.js, comme LIEN_WAVE_AGENCE : le lien Wave des mensualités)

  remplirIndicatifs($('ct-indicatif'));
  remplirIndicatifs($('ct-parent-indicatif'));

  // ---------- état
  let etape = 1;
  let photos = [];
  let video = null, videoEnPreparation = null, numeroVideo = 0;
  // nouvel essai après une coupure : même identifiant (la base ne double pas l'inscription) et photos / vidéo déjà
  // envoyées vers Drive gardées (oubliées dès qu'on change les photos ou la vidéo)
  const idInscription = crypto.randomUUID();
  let dejaEnvoye = null;

  const formule = () => (form.querySelector('input[name="formule"]:checked') || {}).value || '';
  const decision = () => (form.querySelector('input[name="decision"]:checked') || {}).value || '';
  const nbSeances = () => (formule() === 'groupe' ? 4 : Math.max(1, Math.min(30, parseInt($('ct-nb').value, 10) || 1)));
  const montant = () => (formule() === 'groupe' ? PRIX.groupe : (PRIX[formule()] || 0) * nbSeances());
  const age = () => parseInt($('ct-age').value, 10);
  const mineure = () => age() > 0 && age() < 18;

  function texteTotal() {
    const f = formule();
    if (!f) return '';
    if (f === 'groupe') return T('Total : ', 'Total: ') + fcfa(PRIX.groupe) + T(' pour les 4 séances (4 dimanches).', ' for the 4 sessions (4 Sundays).');
    const n = nbSeances(), s = n > 1 ? 's' : '';
    if (f === 'prive_salle') return T(`Total : ${fcfa(montant())} pour ${n} séance${s} de 2 h dans notre salle.`, `Total: ${fcfa(montant())} for ${n} 2-hour session${s} in our studio.`);
    return T(`Total : à partir de ${fcfa(montant())} pour ${n} séance${s} de 2 h (30 000 à 35 000 FCFA la séance selon le lieu ; l'agence vous confirme le prix exact).`,
      `Total: from ${fcfa(montant())} for ${n} 2-hour session${s} (30,000 to 35,000 FCFA per session depending on the place; the agency confirms the exact price).`);
  }
  function majFormule() {
    const f = formule();
    $('ct-bloc-prive').classList.toggle('u-hidden', !f || f === 'groupe');
    $('ct-bloc-adresse').classList.toggle('u-hidden', f !== 'prive_exterieur');
    $('ct-total').textContent = texteTotal();
    $('ct-total-final').textContent = texteTotal();
    $('ct-lien-wave').href = LIEN_WAVE_AGENCE + montant();
  }
  form.querySelectorAll('input[name="formule"]').forEach((r) => r.addEventListener('change', majFormule));
  $('ct-nb').addEventListener('change', majFormule);
  $('ct-objectif').addEventListener('change', () => $('ct-bloc-concours').classList.toggle('u-hidden', !['miss', 'beaute'].includes($('ct-objectif').value)));
  $('ct-age').addEventListener('input', () => $('ct-bloc-parent').classList.toggle('u-hidden', !mineure()));
  form.querySelectorAll('input[name="decision"]').forEach((r) => r.addEventListener('change', () => $('ct-bloc-wave').classList.toggle('u-hidden', decision() !== 'maintenant')));

  // ---------- étapes
  const msg = $('ct-msg');
  function montrer(n, defiler = true) {
    etape = n;
    form.querySelectorAll('.ct-etape').forEach((f) => f.classList.toggle('u-hidden', Number(f.dataset.etape) !== n));
    document.querySelectorAll('.ct-progression li').forEach((li, i) => { li.classList.toggle('actif', i === n - 1); li.classList.toggle('fait', i < n - 1); });
    $('ct-retour').classList.toggle('u-hidden', n === 1);
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
      if (formule() === 'prive_exterieur' && !$('ct-adresse').value.trim()) return erreur(T('Indiquez le lieu des cours.', 'Please give the place of the lessons.'), $('ct-adresse'));
    }
    if (n === 2) {
      if ($('ct-nom').value.trim().length < 2) return erreur(T('Indiquez votre nom.', 'Please give your name.'), $('ct-nom'));
      if (!/^[0-9 ]{6,14}$/.test($('ct-telephone').value.trim())) return erreur(T('Indiquez un numéro de téléphone valide.', 'Please give a valid phone number.'), $('ct-telephone'));
      if (!(age() >= 8 && age() <= 90)) return erreur(T('Indiquez votre âge.', 'Please give your age.'), $('ct-age'));
      if (mineure() && ($('ct-parent-nom').value.trim().length < 2 || !/^[0-9 ]{6,14}$/.test($('ct-parent-telephone').value.trim()))) {
        return erreur(T('Moins de 18 ans : indiquez le nom et le téléphone d’un parent ou tuteur.', 'Under 18: please give the name and phone of a parent or guardian.'), $('ct-parent-nom'));
      }
    }
    if (n === 3) {
      if (photos.length < 2) return erreur(T('Ajoutez 2 ou 3 photos.', 'Please add 2 or 3 photos.'), $('ct-photos'));
      if (!video && !videoEnPreparation) return erreur(T('Ajoutez la vidéo de votre marche.', 'Please add the video of your walk.'), $('ct-video'));
    }
    return true;
  }
  $('ct-suivant').addEventListener('click', () => { if (etapeValide(etape)) montrer(etape + 1); });
  $('ct-retour').addEventListener('click', () => montrer(Math.max(1, etape - 1)));

  // ---------- photos (2 ou 3)
  function rafraichirPhotos() {
    const boite = $('ct-photos-apercu');
    boite.querySelectorAll('img').forEach((im) => URL.revokeObjectURL(im.src));
    boite.innerHTML = '';
    photos.forEach((f, i) => {
      const fig = document.createElement('figure');
      const img = document.createElement('img'); img.src = URL.createObjectURL(f); img.alt = 'Photo ' + (i + 1);
      const b = document.createElement('button'); b.type = 'button'; b.textContent = '✕'; b.setAttribute('aria-label', T('Retirer la photo ', 'Remove photo ') + (i + 1));
      b.addEventListener('click', () => { photos.splice(i, 1); dejaEnvoye = null; rafraichirPhotos(); });
      fig.append(img, b); boite.appendChild(fig);
    });
    const info = $('ct-photos-info');
    info.className = 'ct-info' + (photos.length && photos.length < 2 ? ' err' : '');
    info.textContent = photos.length ? T(`${photos.length} photo${photos.length > 1 ? 's' : ''} sur 3.`, `${photos.length} photo${photos.length > 1 ? 's' : ''} out of 3.`) : '';
  }
  $('ct-photos').addEventListener('change', (e) => {
    const nouvelles = Array.from(e.target.files || []).filter((f) => /^image\//.test(f.type || '') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name || ''));
    photos = photos.concat(nouvelles).slice(0, 3);
    dejaEnvoye = null;
    e.target.value = '';
    rafraichirPhotos();
  });

  // ---------- vidéo (1 minute maximum, allégée sur l'appareil si elle est lourde)
  $('ct-video').addEventListener('change', async (e) => {
    const info = $('ct-video-info');
    const fichier = e.target.files && e.target.files[0];
    const numero = ++numeroVideo;
    video = null; videoEnPreparation = null; dejaEnvoye = null;
    cacherJauge('ct-video-jauge');
    info.className = 'ct-info';
    if (!fichier) { info.textContent = ''; return; }
    const refuser = (t) => { info.className = 'ct-info err'; info.textContent = t; e.target.value = ''; };
    if (!/^video\//.test(fichier.type || '') && !/\.(mp4|mov|m4v|3gp|webm)$/i.test(fichier.name || '')) return refuser(T("Ce fichier n'est pas une vidéo.", 'This file is not a video.'));
    if (fichier.size > VIDEO_MAX_ORIGINAL) return refuser(T(`Vidéo beaucoup trop lourde (${enMo(fichier.size)}). Filmez 1 minute maximum.`, `Video far too large (${enMo(fichier.size)}). Please film 1 minute maximum.`));
    info.textContent = T('Lecture de la vidéo…', 'Reading the video…');
    const examen = window.examinerVideo ? await window.examinerVideo(fichier) : { duree: null };
    if (numero !== numeroVideo) return;
    const duree = examen.duree || (fichier.size <= 300 * 1048576 ? await dureeVideo(fichier) : null);
    if (numero !== numeroVideo) return;
    if (duree && isFinite(duree) && duree > VIDEO_MAX_SECONDES) return refuser(T(`Vidéo trop longue (${Math.round(duree)} s) : 1 minute maximum.`, `Video too long (${Math.round(duree)} s): 1 minute maximum.`));
    info.textContent = '';
    videoEnPreparation = (async () => {
      let allegee = null;
      try {
        if (window.allegerVideo) allegee = await window.allegerVideo(fichier, (pc) => { if (numero === numeroVideo) majJauge('ct-video-jauge', pc, T('Préparation de votre vidéo…', 'Preparing your video…')); });
      } catch (err) { allegee = null; }
      if (numero !== numeroVideo) return;
      cacherJauge('ct-video-jauge');
      const choisie = allegee || (fichier.size <= VIDEO_MAX_OCTETS ? fichier : null);
      if (!choisie) { refuser(T(`Vidéo trop lourde (${enMo(fichier.size)}) : filmez 1 minute maximum, ou baissez la qualité de la caméra.`, `Video too large (${enMo(fichier.size)}): film 1 minute maximum, or lower the camera quality.`)); }
      else { video = choisie; info.textContent = '✓ ' + T('Vidéo prête', 'Video ready') + ' (' + (duree ? Math.round(duree) + ' s, ' : '') + enMo(choisie.size) + ').'; }
      videoEnPreparation = null;
    })();
  });

  // ---------- envoi
  function ligneInscription(liensPhotos, lienVideo) {
    const f = formule();
    return {
      formule: f, nb_seances: nbSeances(),
      nom: $('ct-nom').value.trim(),
      telephone: composerTelephone($('ct-indicatif'), $('ct-telephone')),
      age: age(),
      quartier: $('ct-quartier').value.trim() || null,
      objectif: $('ct-objectif').value || null,
      concours: ['miss', 'beaute'].includes($('ct-objectif').value) ? ($('ct-concours').value.trim() || null) : null,
      concours_date: ['miss', 'beaute'].includes($('ct-objectif').value) ? ($('ct-concours-date').value || null) : null,
      niveau: (form.querySelector('input[name="niveau"]:checked') || {}).value || null,
      disponibilites: f === 'groupe' ? null : ($('ct-dispo').value.trim() || null),
      adresse: f === 'prive_exterieur' ? $('ct-adresse').value.trim() : null,
      parent_nom: mineure() ? $('ct-parent-nom').value.trim() : null,
      parent_telephone: mineure() ? composerTelephone($('ct-parent-indicatif'), $('ct-parent-telephone')) : null,
      photos: liensPhotos, video: lienVideo || null,
      decision: decision(),
      reference_wave: decision() === 'maintenant' ? ($('ct-ref-wave').value.trim() || null) : null
    };
  }
  const NOMS_FORMULES = { groupe: 'En groupe (4 dimanches)', prive_salle: 'Privé dans la salle', prive_exterieur: 'Privé à l’extérieur' };
  function resume(l) {
    return [`Inscription aux cours de talons${EN ? ' (site en anglais)' : ''}`,
      `Formule : ${NOMS_FORMULES[l.formule]}${l.formule === 'groupe' ? '' : ' · ' + l.nb_seances + ' séance(s)'} · ${fcfa(montant())}`,
      `Nom : ${l.nom} · ${l.age} ans · ${l.telephone}`, l.quartier ? `Quartier : ${l.quartier}` : '',
      l.objectif ? `Objectif : ${l.objectif}${l.concours ? ' · ' + l.concours : ''}${l.concours_date ? ' le ' + l.concours_date : ''}` : '',
      l.niveau ? `Niveau : ${l.niveau}` : '', l.adresse ? `Lieu : ${l.adresse}` : '', l.disponibilites ? `Disponibilités : ${l.disponibilites}` : '',
      l.parent_nom ? `⚠️ Mineure. Parent : ${l.parent_nom} · ${l.parent_telephone}` : '',
      `Paiement : ${l.decision === 'maintenant' ? 'payé maintenant par Wave' + (l.reference_wave ? ' (réf. ' + l.reference_wave + ')' : '') : 'plus tard'}`,
      l.photos.length ? 'Photos : ' + l.photos.join(' ') : 'Photos : non reçues', 'Vidéo : ' + (l.video || 'non reçue')].filter(Boolean).join('\n');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    for (const n of [1, 2, 3]) if (!etapeValide(n)) { montrer(n); etapeValide(n); return; }
    if (!decision()) return erreur(T('Choisissez : payer maintenant ou plus tard.', 'Please choose: pay now or later.'));
    if (!$('ct-consentement').checked) return erreur(T('Cochez la case pour accepter la politique de confidentialité.', 'Please tick the box to accept the privacy policy.'), $('ct-consentement'));
    const btn = $('ct-envoyer'); btn.disabled = true; $('ct-retour').disabled = true;
    try {
      if (videoEnPreparation) { afficherMsg(msg, T('Préparation de votre vidéo…', 'Preparing your video…'), 'ok'); await videoEnPreparation; }
      if (!video) { montrer(3); erreur(T('Ajoutez la vidéo de votre marche.', 'Please add the video of your walk.'), $('ct-video')); return; }
      const nom = $('ct-nom').value.trim(), tel = composerTelephone($('ct-indicatif'), $('ct-telephone'));
      const infosDrive = { nom, email: '', phone: tel, type: 'projet', projet: 'Cours de talons' };
      // 1) photos puis vidéo vers Drive (même dossier) ; gardées pour un nouvel essai
      $('ct-envoi-jauges').classList.remove('u-hidden');
      afficherMsg(msg, T('Envoi de vos photos et de votre vidéo… gardez la page ouverte.', 'Sending your photos and video… please keep this page open.'), 'ok');
      if (!dejaEnvoye || !dejaEnvoye.liens.length || !dejaEnvoye.video) {
        majJauge('ct-jauge-photos', 0, T('Photos : préparation…', 'Photos: preparing…'));
        majJauge('ct-jauge-video', 0, T('Vidéo : en attente des photos…', 'Video: waiting for the photos…'));
        const base64 = [];
        for (const f of photos) {
          try { base64.push(await fichierEnBase64(await redimensionnerImage(await convertirSiHeic(f)))); } catch (err) { /* photo illisible : ignorée */ }
          majJauge('ct-jauge-photos', base64.length / photos.length * 50, T('Photos : préparation…', 'Photos: preparing…'));
        }
        majJauge('ct-jauge-photos', 60, T('Photos : envoi…', 'Photos: sending…'));
        const envoiPhotos = base64.length ? await envoyerPhotosVersDrive(URL_SCRIPT_PHOTOS_CASTING, { ...infosDrive, photos: base64 }) : { liens: [], echec: true, dossier: null };
        const lienVideoDrive = await envoyerVideoVersDrive(URL_SCRIPT_PHOTOS_CASTING, { ...infosDrive, dossier: envoiPhotos.dossier }, video,
          (pc) => majJauge('ct-jauge-video', pc, T(`Vidéo (${enMo(video.size)}) : envoi…`, `Video (${enMo(video.size)}): sending…`))).catch(() => null);
        dejaEnvoye = { liens: envoiPhotos.liens || [], video: lienVideoDrive };
      }
      if (dejaEnvoye.liens.length) majJauge('ct-jauge-photos', 100, T(`Photos (${dejaEnvoye.liens.length}) : envoyées ✓`, `Photos (${dejaEnvoye.liens.length}): sent ✓`));
      else jaugeEnErreur('ct-jauge-photos', T('Photos : non envoyées', 'Photos: not sent'));
      if (dejaEnvoye.video) majJauge('ct-jauge-video', 100, T('Vidéo : envoyée ✓', 'Video: sent ✓'));
      else jaugeEnErreur('ct-jauge-video', T('Vidéo : non envoyée', 'Video: not sent'));
      const envoi = { liens: dejaEnvoye.liens }, lienVideo = dejaEnvoye.video;
      // 3) l'inscription (le serveur vérifie, la base décide du statut et du montant)
      const ligne = Object.assign({ id: idInscription }, ligneInscription(envoi.liens, lienVideo));
      const { error } = await insererAvecPatience('cours_talons', ligne, (reste) => afficherMsg(msg, texteAttenteEnvoi(reste), 'ok'));
      const lienWhatsApp = 'https://wa.me/' + WHATSAPP_AGENCE + '?text=' + encodeURIComponent(resume(ligne));
      if (error && !error.pasPret) {
        afficherMsg(msg, T('Une erreur est survenue. Réessayez, ou envoyez votre inscription sur WhatsApp.', 'An error occurred. Please try again, or send your sign-up on WhatsApp.'), 'err');
        const a = document.createElement('a'); a.href = lienWhatsApp; a.target = '_blank'; a.rel = 'noopener'; a.textContent = ' ' + T('Envoyer sur WhatsApp', 'Send on WhatsApp'); msg.appendChild(a);
        return;
      }
      if (!error) envoyerNotificationEmail({ name: ligne.nom + ' (cours de talons)', telephone: ligne.telephone, email: '', message: resume(ligne) });
      if (window.jouerSon) window.jouerSon('envoi');
      msg.className = 'form-msg'; msg.textContent = '';
      const merci = $('ct-merci');
      merci.classList.remove('u-hidden');
      merci.textContent = '';
      const p1 = document.createElement('p');
      p1.textContent = error
        ? T('Merci ! Les inscriptions en ligne ouvrent très bientôt : touchez le bouton ci-dessous pour envoyer votre inscription à l’agence sur WhatsApp.', 'Thank you! Online sign-ups open very soon: tap the button below to send your sign-up to the agency on WhatsApp.')
        : (ligne.decision === 'maintenant'
          ? T('Merci ! Votre inscription est bien reçue. Dès que l’agence voit votre paiement Wave, elle vous confirme votre place sur WhatsApp.', 'Thank you! Your sign-up has been received. As soon as the agency sees your Wave payment, it confirms your place on WhatsApp.')
          : T('Merci ! Votre inscription est bien reçue. L’agence vous recontacte sur WhatsApp pour fixer la date et le paiement.', 'Thank you! Your sign-up has been received. The agency will contact you on WhatsApp to set the date and the payment.'));
      merci.appendChild(p1);
      if (error) { const a = document.createElement('a'); a.href = lienWhatsApp; a.target = '_blank'; a.rel = 'noopener'; a.className = 'btn btn--principal'; a.textContent = T('Envoyer sur WhatsApp', 'Send on WhatsApp'); merci.appendChild(a); }
      if (!envoi.liens.length || !lienVideo) {
        const p2 = document.createElement('p');
        p2.textContent = T('Vos photos ou votre vidéo n’ont pas pu partir (connexion instable ?) : envoyez-les sur WhatsApp au +225 05 45 65 66 87 avec votre nom.', 'Your photos or video could not be sent (unstable connection?): please send them on WhatsApp to +225 05 45 65 66 87 with your name.');
        merci.appendChild(p2);
      }
      form.querySelectorAll('.ct-etape, .ct-boutons').forEach((el) => el.classList.add('u-hidden'));
      if (typeof merci.scrollIntoView === 'function') merci.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } finally {
      btn.disabled = false; $('ct-retour').disabled = false;
    }
  });

  majFormule();
  montrer(1, false);  // (sans défilement au chargement)
})();
