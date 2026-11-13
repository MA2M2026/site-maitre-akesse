// Formulaire de candidature PARTAGÉ (nettoyage du code recopié, 11/10/2026) : une seule
// copie pour candidature.html, integrer-agence.html et leurs versions anglaises (avant,
// quatre copies de ~650 lignes à corriger quatre fois). Le parcours vient de la page :
// <form id="form-casting" data-parcours="projet"> (casting précis) ou "agence" (intégrer
// l'agence, parcours débutant allégé). La langue vient de <html lang="en">.
const PARCOURS = document.getElementById('form-casting').dataset.parcours === 'agence' ? 'agence' : 'projet';

// Sans bornes min/max, le calendrier natif du champ "date de naissance" laisse
// défiler des années totalement absurdes (ex. 2090) et impose souvent de faire
// défiler très loin pour atteindre un âge plausible — d'où l'impression que la
// sélection "ne marche pas" alors qu'il faut juste taper la date à la main.
const AGE_MINIMUM = 14;
(function limiterDateNaissance() {
  const champ = document.getElementById('ca-naissance');
  if (!champ) return;
  const aujourdhui = new Date();
  // 14 ans au moins (décision de la propriétaire, 20/10/2026 : mineurs acceptés dès 14 ans, plus d'âge maximum)
  champ.max = new Date(aujourdhui.getFullYear() - AGE_MINIMUM, aujourdhui.getMonth(), aujourdhui.getDate()).toISOString().slice(0, 10);
  champ.min = new Date(aujourdhui.getFullYear() - 100, aujourdhui.getMonth(), aujourdhui.getDate()).toISOString().slice(0, 10);
})();

// --- Mensurations en listes déroulantes plutôt qu'en saisie libre : évite les
// fautes de frappe (ex. "17O" au lieu de "170") et les valeurs invraisemblables.
// remplirSelectNombres, remplirSelectListe, configurerSelectAvecAutre, valeurSelectOuAutre : js/app.js. ---
remplirSelectNombres('ca-poids', 35, 130, 1, ' kg');
remplirSelectNombres('ca-poitrine', 70, 130, 1, ' cm');
remplirSelectNombres('ca-tourtaille', 55, 110, 1, ' cm');
remplirSelectNombres('ca-hanches', 70, 130, 1, ' cm');
remplirSelectNombres('ca-pointure', 34, 46, 1, '');

// --- Ville en liste déroulante (avec "Autre" en secours) plutôt qu'en saisie
// libre : évite les fautes/variantes d'orthographe (Man/Mann, Yakro/Yamoussoukro...). ---
// VILLES_CI vient de js/app.js (depuis le 20/10/2026 ; partagé avec
// espace-mannequin.html et espace-mannequin-MA2M-premium-20.html).
remplirSelectListe('ca-ville', VILLES_CI);
configurerSelectAvecAutre('ca-ville', 'ca-ville-autre');
brancherCascadeAbidjan('ca-ville', 'ca-commune-wrap', 'ca-commune', 'ca-commune-autre');
configurerSelectAvecAutre('ca-commune', 'ca-commune-autre');
if (EN) [...document.getElementById('ca-commune').options].forEach(o => {
  if (o.value === 'Abidjan') o.text = 'Abidjan (no specific district)';
  if (o.value === 'Autre') o.text = 'Other';
});

// redimensionnerImage, fichierEnBase64, URL_SCRIPT_PHOTOS_CASTING, afficherMsg, majJauge, jaugeEnErreur, cacherJauge,
// enMo et dureeVideo : js/app.js (partagés avec les cours de talons, 08/11/2026).

// --- Projet/casting concerné : liste des castings actifs. S'il n'y en a aucun,
// la page reste accessible (C-8/C-9 du cahier des charges) mais le formulaire
// est remplacé par un message — impossible de postuler tant qu'aucun casting
// n'est ouvert. Le blocage réel (si quelqu'un contourne l'interface) est fait
// côté serveur par la policy RLS sur casting_applications. ---
let DESCRIPTIONS_PROJETS = {};
async function chargerProjetsActifs() {
  const selectProjet = document.getElementById('ca-projet');
  // Le formulaire reste caché le temps de savoir s'il y a des castings ouverts : avant,
  // il s'affichait puis disparaissait d'un coup au profit du message « Aucun casting… »,
  // faisant sauter la page (journal du 04/10). Le bloc garde une hauteur minimale.
  const finChargement = () => { const c = document.getElementById('ca-chargement'); if (c) c.remove(); };
  if (!sb) { finChargement(); document.getElementById('form-casting').classList.remove('u-hidden'); return; }
  // (liste posée par le serveur dans la page : middleware.js, page-donnees, 01/11/2026 ; sinon lue ici)
  const serveur = typeof donneesServeur === 'function' ? donneesServeur('page-donnees') : null;
  const { data: projets } = serveur && Array.isArray(serveur.projets) ? { data: serveur.projets }
    : await sb.from('casting_projets').select('id, nom, description').eq('actif', true).order('ordre_affichage', { ascending: true }).order('nom');
  const liste = projets || [];
  DESCRIPTIONS_PROJETS = {};
  liste.forEach(p => { if (p.description) DESCRIPTIONS_PROJETS[p.nom] = p.description; });
  selectProjet.innerHTML = `<option value="">${T('Sélectionner', 'Select')}</option>`
    + liste.map(p => `<option value="${echapperHtml(p.nom)}">${echapperHtml(p.nom)}</option>`).join('')
    + `<option value="__autre__">${T('Autre (précisez)', 'Other (specify)')}</option>`;

  const aucunCasting = liste.length === 0;
  document.getElementById('ca-aucun-casting').classList.toggle('u-hidden', !aucunCasting);
  document.getElementById('form-casting').classList.toggle('u-hidden', aucunCasting);
  finChargement();
}
if (PARCOURS === 'projet') {
  // En cas de panne réseau, le formulaire s'affiche quand même (il ne doit jamais rester caché).
  chargerProjetsActifs().catch(() => {
    const c = document.getElementById('ca-chargement'); if (c) c.remove();
    document.getElementById('form-casting').classList.remove('u-hidden');
  });
  document.getElementById('ca-projet').addEventListener('change', (e) => {
    const estAutre = e.target.value === '__autre__';
    document.getElementById('ca-bloc-projet-autre').style.display = estAutre ? 'block' : 'none';
    document.getElementById('ca-projet-autre').required = estAutre;

    const descriptionEl = document.getElementById('ca-projet-description');
    const description = DESCRIPTIONS_PROJETS[e.target.value];
    if (description) { descriptionEl.textContent = description; descriptionEl.style.display = 'block'; }
    else { descriptionEl.style.display = 'none'; }
  });
}

// --- Parcours (validé par la propriétaire le 30/09) ---------------------------
// Candidature casting : formulaire complet, tout obligatoire, 4 photos minimum.
// Intégrer l'agence : jamais mannequin = DÉBUTANT·E, formulaire allégé (pas de
// pointure/poitrine/tour de taille/hanches, 3 photos minimum) ; déjà mannequin =
// formulaire COMPLET, 4 photos. Pour tous : résidence complète, niveau d'études,
// poids, taille de vêtements, vidéo.
function estDebutant() {
  return PARCOURS === 'agence' && document.getElementById('ca-experience').value === 'non';
}
// le lien facultatif vers son travail (déjà mannequin) passe en tête du message lu par l'agence
function messageAvecLien() {
  const texte = document.getElementById('ca-message').value.trim();
  const champ = document.getElementById('ca-lien-travail');
  const lien = champ && !document.getElementById('ca-lien-bloc').classList.contains('u-hidden') ? champ.value.trim() : '';
  return lien ? T('Lien vers mon travail : ', 'Link to my work: ') + lien + (texte ? '\n\n' + texte : '') : texte;
}
function photosMin() { return estDebutant() ? 3 : 4; }
function majParcours() {
  if (PARCOURS !== 'agence') return;
  const debutant = estDebutant();
  // lien facultatif vers son travail, pour « déjà mannequin » (page Intégrer l'agence, 08/11/2026)
  const lienBloc = document.getElementById('ca-lien-bloc');
  if (lienBloc) lienBloc.classList.toggle('u-hidden', document.getElementById('ca-experience').value !== 'oui');
  document.querySelectorAll('.ca-mensuration-complete').forEach(bloc => {
    bloc.style.display = debutant ? 'none' : '';
    const champ = bloc.querySelector('select, input');
    champ.required = !debutant;
    if (debutant) champ.value = '';
  });
  document.getElementById('ca-photos-label').textContent = debutant
    ? T('Photos (3 minimum : un portrait, une photo en pied, une autre au choix) *', 'Photos (3 minimum: a portrait, a full-body photo, another of your choice) *')
    : T('Photos (4 minimum : portrait, plein pied, sans maquillage, autre...) *', 'Photos (4 minimum: portrait, full body, no makeup, other...) *');
  if (photosSelectionnees.length) rafraichirApercuPhotos();
}
if (PARCOURS === 'agence') document.getElementById('ca-experience').addEventListener('change', majParcours);

// --- Niveau d'études : trois grandes catégories qui se déroulent ---
const CLASSES_ETUDES = {
  Primaire: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'],
  Secondaire: ['6e', '5e', '4e', '3e', '2nde', '1re', 'Terminale'],
  'Supérieur': ['BTS', 'Licence 1', 'Licence 2', 'Licence 3', 'Master 1', 'Master 2', 'Doctorat', 'Autre formation supérieure']
};
const CLASSES_ETUDES_EN = { 'Licence 1': 'Bachelor year 1', 'Licence 2': 'Bachelor year 2', 'Licence 3': 'Bachelor year 3', 'Doctorat': 'PhD', 'Autre formation supérieure': 'Other higher education' };
function majEtudes() {
  const situation = document.getElementById('ca-scolarite').value;
  const jamais = situation === 'jamais scolarisé(e)';
  const cat = document.getElementById('ca-etudes-cat');
  const classe = document.getElementById('ca-etudes-classe');
  document.getElementById('ca-etudes-cat-wrap').style.display = jamais ? 'none' : '';
  document.getElementById('ca-etudes-cat-label').textContent = situation === "plus à l'école" ? T('Dernier niveau atteint *', 'Last level reached *') : T("Niveau d'études *", 'Education level *');
  cat.required = !jamais;
  if (jamais) cat.value = '';
  const liste = CLASSES_ETUDES[cat.value];
  document.getElementById('ca-etudes-classe-wrap').style.display = liste && !jamais ? 'block' : 'none';
  classe.required = !!liste && !jamais;
  if (liste && classe.dataset.categorie !== cat.value) {
    classe.innerHTML = `<option value="">${T('Sélectionner', 'Select')}</option>` + liste.map(c => `<option value="${c}">${EN ? CLASSES_ETUDES_EN[c] || c : c}</option>`).join('');
    classe.dataset.categorie = cat.value;
  }
}
document.getElementById('ca-scolarite').addEventListener('change', majEtudes);
document.getElementById('ca-etudes-cat').addEventListener('change', majEtudes);
function niveauEtudesChoisi() {
  const cat = document.getElementById('ca-etudes-cat').value;
  const classe = document.getElementById('ca-etudes-classe').value;
  return cat ? cat + (classe ? ' · ' + classe : '') : null;
}

// --- Vidéo de présentation : obligatoire, 3 minutes maximum (décision de la propriétaire, 10/11/2026 ; 1 minute avant).
// Allégée en 480p pour un envoi rapide (VIDEO_ALLEGEMENT_RAPIDE, js/app.js). Une vidéo lourde
// (4K, 60 images/s…) est d'abord ALLÉGÉE par l'appareil du candidat (js/video-allegee.js,
// 30/09) ; si l'appareil ne sait pas le faire, la vidéo d'origine part telle quelle,
// à condition de ne pas dépasser 60 Mo (au-delà, l'envoi échoue sur mobile). ---
const VIDEO_MAX_OCTETS = VIDEO_ENVOI_MAX_OCTETS;          // (js/app.js : limite du programme Google Drive)
const VIDEO_MAX_ORIGINAL = VIDEO_ORIGINALE_MAX_OCTETS;    // avant allègement (js/app.js)
const VIDEO_MAX_SECONDES = VIDEO_DUREE_MAX_SECONDES; // 3 minutes annoncées (js/app.js), petite marge
let videoChoisie = null;
let videoEnPreparation = null; // promesse tant que l'allègement n'est pas fini
let numeroVideo = 0;           // pour ignorer une ancienne vidéo remplacée entre-temps
function montrerApercuVideo(adresseImage, texte) {
  const bloc = document.getElementById('ca-video-apercu');
  const img = bloc.querySelector('img');
  if (adresseImage) { img.src = adresseImage; img.classList.remove('u-hidden'); } else { img.removeAttribute('src'); img.classList.add('u-hidden'); }
  bloc.querySelector('.video-apercu-texte').textContent = texte || '';
  bloc.classList.toggle('u-hidden', !adresseImage && !texte);
}
function videoPrete(fichier, duree, origine) {
  videoChoisie = fichier;
  const info = document.getElementById('ca-video-info');
  info.style.color = 'var(--gris)';
  info.textContent = `✓ ${T('Vidéo prête', 'Video ready')} (${duree ? Math.round(duree) + ' s, ' : ''}${enMo(fichier.size)}${origine && origine.size > fichier.size ? T(', allégée depuis ', ', reduced from ') + enMo(origine.size) : ''}).`;
}
document.getElementById('ca-video').addEventListener('change', async (e) => {
  const info = document.getElementById('ca-video-info');
  const fichier = e.target.files && e.target.files[0];
  const numero = ++numeroVideo;
  videoChoisie = null;
  videoEnPreparation = null;
  cacherJauge('ca-video-jauge');
  montrerApercuVideo(null, '');
  info.style.color = 'var(--rouge)';
  if (!fichier) { info.textContent = ''; return; }
  if (!/^video\//.test(fichier.type || '') && !/\.(mp4|mov|m4v|3gp|webm)$/i.test(fichier.name || '')) { info.textContent = T("Ce fichier n'est pas une vidéo.", 'This file is not a video.'); e.target.value = ''; return; }
  if (fichier.size > VIDEO_MAX_ORIGINAL) {
    info.textContent = T(`Vidéo beaucoup trop lourde (${enMo(fichier.size)}). Filmez 3 minutes maximum.`, `Video far too large (${enMo(fichier.size)}). Please film 3 minutes maximum.`);
    e.target.value = ''; return;
  }
  info.style.color = 'var(--gris)';
  info.textContent = T('Lecture de la vidéo…', 'Reading the video…');
  const examen = window.examinerVideo ? await window.examinerVideo(fichier) : { duree: null, apercu: null };
  if (numero !== numeroVideo) return;
  const duree = examen.duree || (fichier.size <= 300 * 1048576 ? await dureeVideo(fichier) : null);
  if (numero !== numeroVideo) return;
  if (duree && isFinite(duree) && duree > VIDEO_MAX_SECONDES) {
    info.style.color = 'var(--rouge)';
    info.textContent = T(`Vidéo trop longue (${dureeLisible(duree)}) : 3 minutes maximum.`, `Video too long (${dureeLisible(duree)}): 3 minutes maximum.`);
    e.target.value = ''; return;
  }
  montrerApercuVideo(examen.apercu, examen.apercu ? T('Votre vidéo : vérifiez que c\'est bien la bonne.', 'Your video: please check it is the right one.') : '');

  const refuserTropLourde = () => {
    info.style.color = 'var(--rouge)';
    info.textContent = T(`Vidéo trop lourde (${enMo(fichier.size)}) et cet appareil ne peut pas l'alléger : 60 Mo maximum. Filmez 3 minutes maximum, ou baissez la qualité de la caméra (720p au lieu de 1080p ou 4K).`, `Video too large (${enMo(fichier.size)}) and this device cannot reduce it: 60 MB maximum. Film 3 minutes maximum, or lower the camera quality (720p instead of 1080p or 4K).`);
    e.target.value = '';
  };
  info.textContent = '';
  videoEnPreparation = (async () => {
    let allegee = null;
    try {
      if (window.allegerVideo) allegee = await window.allegerVideo(fichier, (pc) => {
        if (numero === numeroVideo) majJauge('ca-video-jauge', pc, T('Préparation de votre vidéo (allègement pour un envoi rapide)…', 'Preparing your video (reducing it for a faster upload)…'));
      }, VIDEO_ALLEGEMENT_RAPIDE);
    } catch (err) {
      allegee = null;
      if (window.signalerErreur) window.signalerErreur('Vidéo non allégée (envoi de l\'originale)', (err && err.message) || String(err), enMo(fichier.size) + ', ' + (fichier.type || 'type inconnu'));
    }
    if (numero !== numeroVideo) return;
    if (allegee && allegee.size <= VIDEO_MAX_OCTETS) { majJauge('ca-video-jauge', 100, T('Vidéo préparée', 'Video ready')); videoPrete(allegee, duree, fichier); }
    else if (fichier.size <= VIDEO_MAX_OCTETS) { cacherJauge('ca-video-jauge'); videoPrete(fichier, duree, null); }
    else { cacherJauge('ca-video-jauge'); montrerApercuVideo(null, ''); refuserTropLourde(); }
    videoEnPreparation = null;
  })();
});

// --- Photos : 3 ou 4 minimum selon le parcours, avec aperçu, compteur en direct,
// et gestion individuelle (ajouter/supprimer/remplacer une seule photo sans
// reprendre toute la sélection depuis le début — cahier des charges, étape 5). ---
let photosSelectionnees = [];
let indexPhotoARemplacer = null;

const adressesApercu = new WeakMap();
const adresseApercu = (f) => { if (!adressesApercu.has(f)) adressesApercu.set(f, URL.createObjectURL(f)); return adressesApercu.get(f); };
function rafraichirApercuPhotos() {
  const compteur = document.getElementById('ca-photos-compteur');
  const apercu = document.getElementById('ca-photos-apercu');
  const n = photosSelectionnees.length;
  const min = photosMin();
  const pl = n > 1 ? 's' : '';
  compteur.textContent = n >= min
    ? T(`${n} photo${pl} sélectionnée${pl}.`, `${n} photo${pl} selected.`)
    : T(`${n} photo${pl} sélectionnée${pl} · ${min} minimum requises.`, `${n} photo${pl} selected · ${min} minimum required.`);
  compteur.style.color = n >= min ? 'var(--gris)' : 'var(--rouge)';

  apercu.innerHTML = photosSelectionnees.map((f, i) => `
    <div class="ca-photo-vignette ca-20">
      <img src="${adresseApercu(f)}" class="ca-21" alt="Photo ${i + 1}">
      <button type="button" class="ca-photo-remplacer ca-22" data-index="${i}" title="${T('Remplacer cette photo', 'Replace this photo')}">⇄</button>
      <button type="button" class="ca-photo-suppr ca-23" data-index="${i}" title="${T('Supprimer cette photo', 'Remove this photo')}">✕</button>
    </div>
  `).join('');

  document.getElementById('ca-photos-consigne').classList.toggle('u-hidden', n === 0);
  apercu.querySelectorAll('.ca-photo-vignette img').forEach(img => {
    img.addEventListener('click', () => ouvrirVisionneuse(img.src));
  });
  apercu.querySelectorAll('.ca-photo-suppr').forEach(btn => {
    btn.addEventListener('click', () => {
      photosSelectionnees.splice(Number(btn.dataset.index), 1);
      rafraichirApercuPhotos();
    });
  });
  apercu.querySelectorAll('.ca-photo-remplacer').forEach(btn => {
    btn.addEventListener('click', () => {
      indexPhotoARemplacer = Number(btn.dataset.index);
      document.getElementById('ca-photo-remplacement').click();
    });
  });
}

// Photo en grand, pour vérifier que ce sont bien les bonnes avant d'envoyer.
function ouvrirVisionneuse(adresse) {
  const v = document.getElementById('ca-visionneuse');
  v.querySelector('img').src = adresse;
  v.classList.remove('u-hidden');
  v.querySelector('.visionneuse-fermer').focus();
}
function fermerVisionneuse() { document.getElementById('ca-visionneuse').classList.add('u-hidden'); }
// La visionneuse est créée ici (12/10/2026 : avant, recopiée dans les 4 pages de candidature).
(function creerVisionneuse() {
  const v = document.createElement('div');
  v.id = 'ca-visionneuse'; v.className = 'visionneuse u-hidden';
  v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', T('Photo en grand', 'Full-size photo'));
  v.innerHTML = '<img alt=""><button type="button" class="btn visionneuse-fermer">' + T('✕ Fermer', '✕ Close') + '</button>';
  document.getElementById('form-casting').closest('section').appendChild(v);
})();
document.getElementById('ca-visionneuse').addEventListener('click', fermerVisionneuse);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermerVisionneuse(); });

// (12/11/2026) chaque photo est lue et allégée DÈS QU'ELLE EST CHOISIE (preparerPhotosEnvoi, js/app.js) : à l'envoi,
// plus rien à relire sur le téléphone. photosEnPreparation : l'envoi attend la fin de la préparation.
let photosEnPreparation = Promise.resolve();
function preparerPuis(fichiers, ranger) {
  const compteur = document.getElementById('ca-photos-compteur');
  compteur.textContent = T('Préparation des photos…', 'Preparing the photos…');
  const travail = photosEnPreparation.then(() => preparerPhotosEnvoi(fichiers)).then(({ pretes, illisibles }) => {
    ranger(pretes);
    rafraichirApercuPhotos();
    if (illisibles.length) { compteur.textContent += ' ' + textePhotosIllisibles(illisibles); compteur.style.color = 'var(--rouge)'; }
  });
  photosEnPreparation = travail.catch(() => {});
}
document.getElementById('ca-photos').addEventListener('change', (e) => {
  const fichiers = Array.from(e.target.files || []);
  e.target.value = '';
  preparerPuis(fichiers, (pretes) => { photosSelectionnees.push(...pretes); });
});

document.getElementById('ca-photo-remplacement').addEventListener('change', (e) => {
  const fichier = e.target.files[0], rang = indexPhotoARemplacer;
  e.target.value = '';
  indexPhotoARemplacer = null;
  if (!fichier || rang === null) return;
  preparerPuis([fichier], (pretes) => { if (pretes[0]) photosSelectionnees[rang] = pretes[0]; });
});

// Liste « Taille » selon le genre (taille minimale, mineurs exemptés) : js/app.js.
function remplirTailleSelonGenre() {
  remplirTailleMinimale('ca', estMineur(), T('Pas de taille minimale pour les candidatures de mineurs.', 'No minimum height for applications from minors.'));
}
document.getElementById('ca-genre').addEventListener('change', remplirTailleSelonGenre);
// Civilité choisie par la candidate (décision de la propriétaire, 07/10/2026) : Madame ou
// Mademoiselle pour une femme ; « Monsieur » d'office pour un homme. Sert aux messages.
function majCivilite() {
  const femme = document.getElementById('ca-genre').value === 'femme';
  document.getElementById('ca-civilite-wrap').style.display = femme ? 'block' : 'none';
  document.getElementById('ca-civilite').required = femme;
}
document.getElementById('ca-genre').addEventListener('change', majCivilite);
majCivilite();
remplirTailleSelonGenre();

// --- Gestion mineur / parent-tuteur ---
function calculerAgeCandidature() {
  const valeur = document.getElementById('ca-naissance').value;
  if (!valeur) return null;
  const naissance = new Date(valeur);
  const aujourdhui = new Date();
  let age = aujourdhui.getFullYear() - naissance.getFullYear();
  if (aujourdhui < new Date(aujourdhui.getFullYear(), naissance.getMonth(), naissance.getDate())) age -= 1;
  return age;
}
function estMineur() {
  const age = calculerAgeCandidature();
  return age !== null && age < 18;
}
document.getElementById('ca-naissance').addEventListener('change', () => {
  // moins de 14 ans : le navigateur bloque l'envoi avec NOTRE phrase (et non « la valeur doit
  // être inférieure ou égale à… »)
  const age = calculerAgeCandidature(), champNaissance = document.getElementById('ca-naissance');
  champNaissance.setCustomValidity(age !== null && age < AGE_MINIMUM ? T(`L'agence accepte les candidatures à partir de ${AGE_MINIMUM} ans.`, `The agency accepts applications from age ${AGE_MINIMUM}.`) : '');
  const blocParent = document.getElementById('ca-bloc-parent');
  const mineur = estMineur();
  blocParent.style.display = mineur ? 'block' : 'none';
  document.getElementById('ca-parent-nom').required = mineur;
  document.getElementById('ca-parent-civilite').required = mineur;
  document.getElementById('ca-parent-telephone-numero').required = mineur;
  document.getElementById('ca-parent-email').required = mineur;
  remplirTailleSelonGenre();
  majConsentement();
});

// Le consentement générique ne suffit pas à prouver qu'un parent a bien
// donné son accord (rien n'empêche un mineur de cocher la case lui-même) —
// on rend donc la case à cocher indisponible tant que le nom du parent/
// tuteur n'a pas été renseigné, et on reformule le texte comme une véritable
// attestation nominative ("je soussigné(e) [nom du parent]...").
function majConsentement() {
  const label = document.getElementById('ca-consentement-label');
  const checkbox = document.getElementById('ca-consentement');
  const lienPolitique = '<a href="politique-confidentialite.html" target="_blank" class="ca-19">' + T('politique de confidentialité', 'privacy policy') + '</a>';
  const mineur = estMineur();
  if (!mineur) {
    label.innerHTML = T(`J'ai pris connaissance de la ${lienPolitique}. *`, `I have read the ${lienPolitique}. *`);
    checkbox.disabled = false;
    return;
  }
  const parentNom = document.getElementById('ca-parent-nom').value.trim();
  const nomCandidat = document.getElementById('ca-nom').value.trim();
  if (!parentNom) {
    label.innerHTML = T('Merci de renseigner ci-dessus le nom du parent ou tuteur légal pour activer ce consentement. *', 'Please enter the name of the parent or legal guardian above to enable this consent. *');
    checkbox.checked = false;
    checkbox.disabled = true;
    return;
  }
  checkbox.disabled = false;
  label.innerHTML = T(
    `Je soussigné(e) <strong>${echapperHtml(parentNom)}</strong>, parent ou tuteur légal${nomCandidat ? ` de <strong>${echapperHtml(nomCandidat)}</strong>` : ''}, certifie autoriser cette candidature et avoir pris connaissance de la ${lienPolitique}. *`,
    `I, the undersigned <strong>${echapperHtml(parentNom)}</strong>, parent or legal guardian${nomCandidat ? ` of <strong>${echapperHtml(nomCandidat)}</strong>` : ''}, certify that I authorise this application and have read the ${lienPolitique}. *`);
}
document.getElementById('ca-parent-nom').addEventListener('input', majConsentement);
document.getElementById('ca-nom').addEventListener('input', majConsentement);

majParcours();
remplirIndicatifs(document.getElementById('ca-indicatif'));
remplirIndicatifs(document.getElementById('ca-parent-indicatif'));

// ---------- Envoi des photos et de la vidéo (12/11/2026 : sorti du formulaire pour pouvoir REPRENDRE un envoi coupé) ----------
// etat : { candidature, projetNom, parcours, photos (déjà prêtes), video, page, photosFaites, dossier, nbPhotosEchouees,
//         videoFaite, lienVideo, agencePrevenue } gardé dans le téléphone (EnvoiFiable, js/app.js) à chaque étape franchie.
async function envoyerMedias(etat) {
  const { candidature, projetNom, mineur } = etat, fichiersPhotos = etat.photos || [], videoChoisie = etat.video, PARCOURS = etat.parcours, msg = document.getElementById('ca-msg');
  document.getElementById('ca-envoi-jauges').classList.remove('u-hidden');
  let nbPhotosEchouees = 0;
  let dossierDrive = null;
  if (etat.photosFaites) { dossierDrive = etat.dossier || null; nbPhotosEchouees = etat.nbPhotosEchouees || 0; }
  else {
    // Jauges (10/11/2026) : UNE PAR PHOTO, préparée (0 → 25 %), puis envoyées ensemble (un seul envoi : le programme
    // Google crée un dossier par envoi) ; pendant l'envoi les jauges avancent selon le temps estimé, sans dépasser
    // 95 % avant la réponse de Google, puis passent au vert. Photos réduites à 1600 px (PHOTO_COTE_ENVOI, js/app.js).
    document.getElementById('ca-envoi-jauges').classList.remove('u-hidden');
    const boiteJauges = document.getElementById('ca-jauges-photos');
    boiteJauges.textContent = '';
    const idsPhotos = fichiersPhotos.map((f, i) => { boiteJauges.appendChild(creerJauge('ca-jauge-photo-' + (i + 1))); return 'ca-jauge-photo-' + (i + 1); });
    const nomPhoto = (i) => 'Photo ' + (i + 1);
    idsPhotos.forEach((id, i) => majJauge(id, 0, nomPhoto(i) + T(' : en attente…', ': waiting…')));
    majJauge('ca-jauge-video', 0, T('Vidéo : en attente des photos…', 'Video: waiting for the photos…'));
    let arreterPhotos = () => {};
    const rangsEnvoyes = [];
    try {
      const photosBase64 = [];
      for (let i = 0; i < fichiersPhotos.length; i++) {
        majJauge(idsPhotos[i], 10, nomPhoto(i) + T(' : préparation…', ': preparing…'));
        try {
          photosBase64.push(await fichierEnBase64(fichiersPhotos[i]));  // (déjà prête en mémoire depuis le choix)
          rangsEnvoyes.push(i);
          majJauge(idsPhotos[i], 25, nomPhoto(i) + T(' : prête', ': ready'));
        } catch (e) {
          nbPhotosEchouees++;
          jaugeEnErreur(idsPhotos[i], nomPhoto(i) + T(' : illisible', ': unreadable'));
        }
      }

      const octetsPhotos = photosBase64.reduce((t, b) => t + b.length, 0);
      const debitEstime = ((navigator.connection && navigator.connection.downlink) || 1) * 125000 * 0.6; // octets/s
      const idsEnvoyes = rangsEnvoyes.map((i) => idsPhotos[i]);
      idsEnvoyes.forEach((id, k) => majJauge(id, 25, nomPhoto(rangsEnvoyes[k]) + T(' : envoi…', ': sending…')));
      arreterPhotos = avancerDoucement(idsEnvoyes, 25, 95, Math.max(3000, (octetsPhotos / debitEstime + 3) * 1000 / 1.6), null);
      const { liens, echec, dossier } = await envoyerPhotosVersDrive(URL_SCRIPT_PHOTOS_CASTING, {
        nom: candidature.full_name,
        email: candidature.email,
        phone: candidature.phone,
        type: PARCOURS,
        projet: projetNom || '',
        photos: photosBase64
      });

      arreterPhotos();
      // (Google peut écarter une photo sans dire laquelle : comptée comme manquante, jauges selon jaugesPhotosArrivees)
      const manquantes = jaugesPhotosArrivees(idsPhotos, rangsEnvoyes, echec ? 0 : liens.length, nomPhoto);
      if (!echec) nbPhotosEchouees = Math.max(nbPhotosEchouees, manquantes);
      dossierDrive = dossier || null;
      if (!echec) {
        for (const lien of liens) {
          const { error: erreurInsertPhoto } = await sb.from('casting_photos').insert({ application_id: candidature.id, url: lien, chemin: null });
          if (erreurInsertPhoto) {
            nbPhotosEchouees++;
            sb.from('journal_erreurs').insert({
              message: 'DIAGNOSTIC casting_photos insert: ' + erreurInsertPhoto.message,
              page: window.location.pathname,
              pile: erreurInsertPhoto.code ? ('code=' + erreurInsertPhoto.code + ' details=' + erreurInsertPhoto.details) : null
            }).then(() => {}).catch(() => {});
          }
        }
      } else {
        nbPhotosEchouees = fichiersPhotos.length;
      }
    } catch (e) {
      // Une coupure réseau ne doit jamais bloquer tout l'envoi (le dossier est déjà
      // enregistré côté Supabase) — on signale juste que les photos n'ont pas pu partir.
      nbPhotosEchouees = fichiersPhotos.length;
      arreterPhotos();
      idsPhotos.forEach((id, i) => jaugeEnErreur(id, nomPhoto(i) + T(' : non envoyée', ': not sent')));
    }
    Promise.resolve(journaliserPhotosEchouees('candidature', candidature.id, nbPhotosEchouees)).catch(() => {});
    // (au moins une photo arrivée : l'étape est franchie ; aucune, à cause du réseau : la reprise réessaiera)
    if (nbPhotosEchouees < fichiersPhotos.length) { Object.assign(etat, { photosFaites: true, dossier: dossierDrive, nbPhotosEchouees }); await EnvoiFiable.garder('candidature', etat); }
  }

  // Vidéo de présentation : envoyée APRÈS les photos (elle est plus lourde), dans le
  // même dossier Drive ; son lien est ensuite rattaché à la candidature.
  let lienVideo = null;
  if (etat.videoFaite) lienVideo = etat.lienVideo || null;
  else if (etat.lienVideo) {
    // (vidéo déjà sur Drive, page coupée avant de la rattacher au dossier : on ne fait que la rattacher)
    lienVideo = etat.lienVideo;
    const { error: erreurVideo } = await sb.rpc('ajouter_video_candidature', { p_id: candidature.id, p_url: lienVideo });
    if (!erreurVideo) { etat.videoFaite = true; await EnvoiFiable.garder('candidature', etat); }
  } else {
    afficherMsg(msg, T('Envoi de votre vidéo… Vous pouvez passer sur une autre application : l’envoi continue, et s’il est coupé, il reprendra quand vous reviendrez sur cette page.', 'Sending your video… You can switch to another app: sending continues, and if it is interrupted it will resume when you come back to this page.'), 'ok');
    try {
      lienVideo = await envoyerVideoAvecJauge(URL_SCRIPT_PHOTOS_CASTING, {
        nom: candidature.full_name, email: candidature.email, phone: candidature.phone,
        type: PARCOURS, projet: projetNom || '', dossier: dossierDrive
      }, videoChoisie, 'ca-jauge-video');
      if (lienVideo) {
        etat.lienVideo = lienVideo; await EnvoiFiable.garder('candidature', etat);
        const { error: erreurVideo } = await sb.rpc('ajouter_video_candidature', { p_id: candidature.id, p_url: lienVideo });
        // (la vidéo est sur Drive et son lien part dans l'e-mail à l'agence ; on note seulement l'échec de l'ajout au dossier)
        if (erreurVideo && window.signalerErreur) window.signalerErreur('Vidéo non ajoutée au dossier de candidature', erreurVideo.message || String(erreurVideo), lienVideo);
      else { etat.videoFaite = true; await EnvoiFiable.garder('candidature', etat); }
      }
    } catch (e) {
      lienVideo = null;
      jaugeEnErreur('ca-jauge-video', T('Vidéo : non envoyée', 'Video: not sent'));
      if (window.signalerErreur) window.signalerErreur('Vidéo de candidature non envoyée', 'lecture du fichier sur le téléphone : ' + ((e && e.message) || e), (videoChoisie ? (videoChoisie.size / 1048576).toFixed(1) + ' Mo, ' + (videoChoisie.type || 'type inconnu') : ''));
    }

  }

  if (etat.agencePrevenue && !etat.agenceComplete && etat.photosFaites && etat.videoFaite) {
    // (envoi repris : l'agence avait reçu un premier e-mail incomplet ; elle apprend que tout est arrivé)
    envoyerNotificationEmail({ name: candidature.full_name, telephone: candidature.phone, email: candidature.email,
      message: 'Complément de candidature : les photos et la vidéo de ' + candidature.full_name + ' sont maintenant arrivées (envoi repris automatiquement).' + (lienVideo ? '\nVidéo : ' + lienVideo : '') });
    etat.agenceComplete = true; await EnvoiFiable.garder('candidature', etat);
  }
  if (!etat.agencePrevenue) {
    envoyerNotificationEmail({
      name: candidature.full_name,
      telephone: candidature.phone,
      email: candidature.email,
      message: `Nouvelle candidature casting${EN ? ' (site en anglais)' : ''}.\nPostule pour : ${PARCOURS === 'projet' ? 'Projet/casting : ' + projetNom : "Intégrer l'agence" + (candidature.experience_mannequin === 'non' ? ' · Débutant(e)' : ' · Déjà mannequin')}\nVille : ${candidature.city || '-'}${candidature.quartier ? ' · ' + candidature.quartier : ''}\nNiveau d'études : ${candidature.niveau_etudes || candidature.situation_scolaire || '-'}\nTaille de vêtements : ${candidature.clothing_size || '-'}\nVidéo : ${lienVideo || 'non reçue'}\nTaille : ${candidature.height_cm || '-'} cm\nMessage : ${candidature.message || '-'}${mineur ? `\n⚠️ MINEUR. Parent ou tuteur : ${candidature.parent_nom || '-'} — ${candidature.parent_telephone || '-'}` : ''}`
    });
    etat.agencePrevenue = true; etat.agenceComplete = !!(etat.photosFaites && etat.videoFaite); await EnvoiFiable.garder('candidature', etat);
  }

  if (window.jouerSon) window.jouerSon('envoi');
  const soucis = [];
  if (nbPhotosEchouees) soucis.push(T(`${nbPhotosEchouees} photo${nbPhotosEchouees > 1 ? 's n\'ont' : ' n\'a'} pas pu être envoyée${nbPhotosEchouees > 1 ? 's' : ''}`, `${nbPhotosEchouees} photo${nbPhotosEchouees > 1 ? 's' : ''} could not be sent`));
  if (!lienVideo) soucis.push(T('votre vidéo n\'a pas pu être envoyée, envoyez-la sur WhatsApp au +225 05 45 65 66 87 en indiquant votre nom', 'your video could not be sent, please send it on WhatsApp to +225 05 45 65 66 87 with your name'));
  const complet = etat.photosFaites && etat.videoFaite;
  etat.essais = (etat.essais || 0) + 1;
  const reprendra = !complet && etat.essais < 3 && etat.fichiersGardes;
  if (reprendra) { soucis.length = 0; soucis.push(T('l’envoi n’est pas terminé (connexion instable ?) : il repartira tout seul quand vous reviendrez sur cette page', 'sending is not finished (unstable connection?): it will resume automatically when you come back to this page')); await EnvoiFiable.garder('candidature', etat); }
  else if (!complet) await EnvoiFiable.oublier('candidature');  // (3 essais : on n'insiste plus, la consigne WhatsApp reste affichée)
  afficherMsg(msg, soucis.length
    ? T(`Candidature envoyée, mais ${soucis.join(' ; ')} (connexion instable ?). Le reste du dossier est bien enregistré.`, `Application sent, but ${soucis.join('; ')} (unstable connection?). The rest of your application has been saved.`)
    : T('Merci ! Votre candidature a bien été envoyée. Notre équipe vous recontactera si votre profil est retenu.', 'Thank you! Your application has been sent. Our team will contact you if your profile is selected.'), 'ok');
  if (complet) {
    await EnvoiFiable.oublier('candidature');
    void EnvoiFiable.prevenir(T('Candidature envoyée ✓', 'Application sent ✓'), T('Merci ! Votre candidature est bien arrivée chez Maître Akesse Model Management.', 'Thank you! Your application has reached Maître Akesse Model Management.'), etat.page);
  }
  return complet;
}

document.getElementById('form-casting').addEventListener('submit', async (e) => {
  e.preventDefault();
  // Évite les envois multiples : un visiteur qui tape plusieurs fois sur
  // "Envoyer" (le temps que la validation s'exécute) ne déclenche l'envoi
  // qu'une seule fois (journal du site, 01-02/10/2026 : 4 clics en 2 s).
  if (document.getElementById('btn-envoyer').disabled) return;
  EnvoiFiable.demanderNotifications();  // (12/11/2026 : « Candidature envoyée ✓ » si elle passe sur une autre application)
  const msg = document.getElementById('ca-msg');

  const genre = document.getElementById('ca-genre').value;
  const taille = parseInt(document.getElementById('ca-taille').value) || 0;
  const mineur = estMineur();

  let projetNom = '';
  if (PARCOURS === 'projet') {
    const projetSelect = document.getElementById('ca-projet').value;
    projetNom = projetSelect === '__autre__' ? document.getElementById('ca-projet-autre').value.trim() : projetSelect;
    if (!projetNom) {
      afficherMsg(msg, T('Merci de préciser le projet ou casting concerné.', 'Please specify the project or casting concerned.'), 'err');
      return;
    }
  }

  const age = calculerAgeCandidature();
  if (age !== null && age < AGE_MINIMUM) {
    afficherMsg(msg, T(`L'agence accepte les candidatures à partir de ${AGE_MINIMUM} ans.`, `The agency accepts applications from age ${AGE_MINIMUM}.`), 'err');
    return;
  }

  if (document.getElementById('ca-ville').value === 'Abidjan' && document.getElementById('ca-commune').value === 'Abidjan') {
    afficherMsg(msg, T('Merci de préciser votre commune à Abidjan.', 'Please specify your district in Abidjan.'), 'err');
    return;
  }

  await photosEnPreparation;  // (photos encore en préparation : on attend, quelques secondes)
  const fichiersPhotos = photosSelectionnees;
  const minPhotos = photosMin();
  if (fichiersPhotos.length < minPhotos) {
    afficherMsg(msg, T(`Merci d'ajouter au moins ${minPhotos} photos (${fichiersPhotos.length} sélectionnée${fichiersPhotos.length > 1 ? 's' : ''} pour l'instant).`, `Please add at least ${minPhotos} photos (${fichiersPhotos.length} selected so far).`), 'err');
    return;
  }
  if (videoEnPreparation) {
    afficherMsg(msg, T('Votre vidéo est en cours de préparation, l\'envoi démarre dès qu\'elle est prête…', 'Your video is being prepared, sending will start as soon as it is ready…'), 'ok');
    document.getElementById('btn-envoyer').disabled = true;
    await videoEnPreparation;
    document.getElementById('btn-envoyer').disabled = false;
  }
  if (!videoChoisie) {
    afficherMsg(msg, T('Merci d\'ajouter votre vidéo de présentation (3 minutes maximum).', 'Please add your introduction video (3 minutes maximum).'), 'err');
    return;
  }
  if (fichiersPhotos.length > 12) {
    afficherMsg(msg, T(`12 photos maximum par candidature (${fichiersPhotos.length} sélectionnées). Retirez-en quelques-unes.`, `12 photos maximum per application (${fichiersPhotos.length} selected). Please remove a few.`), 'err');
    return;
  }

  const btn = document.getElementById('btn-envoyer');
  btn.disabled = true;
  afficherMsg(msg, T('Envoi en cours…', 'Sending…'), 'ok');

  const candidature = {
    full_name: document.getElementById('ca-nom').value.trim(),
    email: document.getElementById('ca-email').value.trim(),
    phone: composerTelephone(document.getElementById('ca-indicatif'), document.getElementById('ca-telephone-numero')),
    city: villeAvecCommune(valeurSelectOuAutre('ca-ville', 'ca-ville-autre'), 'ca-commune', 'ca-commune-autre'),
    quartier: document.getElementById('ca-quartier').value.trim() || null,
    date_naissance: document.getElementById('ca-naissance').value || null,
    genre: genre,
    civilite: genre === 'homme' ? 'Monsieur' : (document.getElementById('ca-civilite').value || null),
    height_cm: taille,
    shoe_size: document.getElementById('ca-pointure').value.trim(),
    weight_kg: parseInt(document.getElementById('ca-poids').value) || null,
    chest_cm: parseInt(document.getElementById('ca-poitrine').value) || null,
    waist_cm: parseInt(document.getElementById('ca-tourtaille').value) || null,
    hips_cm: parseInt(document.getElementById('ca-hanches').value) || null,
    message: messageAvecLien(),
    parent_nom: mineur ? [document.getElementById('ca-parent-civilite').value, document.getElementById('ca-parent-nom').value.trim()].filter(Boolean).join(' ') : null,
    parent_telephone: mineur ? composerTelephone(document.getElementById('ca-parent-indicatif'), document.getElementById('ca-parent-telephone-numero')) : null,
    parent_email: mineur ? (document.getElementById('ca-parent-email').value.trim().toLowerCase() || null) : null,
    type_candidature: PARCOURS,
    projet_nom: PARCOURS === 'projet' ? projetNom : null,
    experience_mannequin: PARCOURS === 'agence' ? document.getElementById('ca-experience').value : 'oui',
    situation_scolaire: document.getElementById('ca-scolarite').value || null,
    niveau_etudes: niveauEtudesChoisi(),
    clothing_size: document.getElementById('ca-vetements').value || null
  };

  candidature.id = crypto.randomUUID();

  const { error: erreurInsert } = await insererAvecPatience('casting_applications', candidature,
    (reste) => afficherMsg(msg, texteAttenteEnvoi(reste), 'ok'));

  if (erreurInsert) {
    afficherMsg(msg, T("Erreur lors de l'envoi. Réessayez ou contactez-nous directement.", 'Error while sending. Please try again or contact us directly.'), 'err');
    btn.disabled = false;
    return;
  }

  // (12/11/2026) le dossier est gardé dans le téléphone pendant l'envoi : s'il est coupé, il reprend tout seul
  const etat = { candidature, projetNom, mineur, parcours: PARCOURS, photos: fichiersPhotos, video: videoChoisie, page: location.pathname, photosFaites: false };
  await EnvoiFiable.garder('candidature', etat);
  await EnvoiFiable.seul('candidature', () => envoyerMedias(etat), true);
  document.getElementById('form-casting').reset();
  document.getElementById('ca-bloc-parent').style.display = 'none';
  if (PARCOURS === 'projet') document.getElementById('ca-bloc-projet-autre').style.display = 'none';
  videoChoisie = null;
  numeroVideo++;
  document.getElementById('ca-video-info').textContent = '';
  cacherJauge('ca-video-jauge');
  montrerApercuVideo(null, '');
  photosSelectionnees = [];
  rafraichirApercuPhotos();
  majParcours();
  majEtudes();
  document.getElementById('ca-photos-compteur').textContent = '';
  document.getElementById('ca-photos-apercu').innerHTML = '';
  document.getElementById('ca-photos-consigne').classList.add('u-hidden');
  document.getElementById('ca-consentement').disabled = false;
  majConsentement();
  btn.disabled = false;
});

// Reprise d'un envoi coupé (12/11/2026) : à l'ouverture de la page, s'il reste des photos ou une vidéo à envoyer
window.MA2M_REPRISE_ICI = 'candidature';
void (async () => {
  const etat = await EnvoiFiable.lire('candidature');
  if (!etat || !etat.candidature) return;
  const msg = document.getElementById('ca-msg'), btn = document.getElementById('btn-envoyer');
  const prenom = String(etat.candidature.full_name || '').trim().split(/\s+/)[0];
  btn.disabled = true;
  afficherMsg(msg, T(`La candidature de ${prenom} n’avait pas fini de s’envoyer : nous terminons l’envoi de ses photos et de sa vidéo…`, `${prenom}'s application had not finished sending: we are finishing sending the photos and video…`), 'ok');
  // (téléphone partagé, ou envoi déjà fait autrement) : « Annuler cet envoi »
  const annuler = document.createElement('button');
  annuler.type = 'button'; annuler.className = 'lien-annuler-envoi'; annuler.textContent = T('Annuler cet envoi', 'Cancel this submission');
  annuler.addEventListener('click', async () => { await EnvoiFiable.oublier('candidature'); location.reload(); });
  msg.appendChild(annuler);
  msg.scrollIntoView({ block: 'center' });
  try { await EnvoiFiable.seul('candidature', () => envoyerMedias(etat), false); } finally { btn.disabled = false; }
})();
