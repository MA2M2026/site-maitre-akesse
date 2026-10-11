// Formulaire de candidature PARTAGÉ (nettoyage du code recopié, 11/10/2026) : une seule
// copie pour candidature.html, integrer-agence.html et leurs versions anglaises (avant,
// quatre copies de ~650 lignes à corriger quatre fois). Le parcours vient de la page :
// <form id="form-casting" data-parcours="projet"> (casting précis) ou "agence" (intégrer
// l'agence, parcours débutant allégé). La langue vient de <html lang="en">.
const EN = document.documentElement.lang === 'en';
const T = (fr, en) => (EN ? en : fr);
const PARCOURS = document.getElementById('form-casting').dataset.parcours === 'agence' ? 'agence' : 'projet';

// Sans bornes min/max, le calendrier natif du champ "date de naissance" laisse
// défiler des années totalement absurdes (ex. 2090) et impose souvent de faire
// défiler très loin pour atteindre un âge plausible — d'où l'impression que la
// sélection "ne marche pas" alors qu'il faut juste taper la date à la main.
(function limiterDateNaissance() {
  const champ = document.getElementById('ca-naissance');
  if (!champ) return;
  const aujourdhui = new Date();
  champ.max = aujourdhui.toISOString().slice(0, 10);
  champ.min = new Date(aujourdhui.getFullYear() - 100, aujourdhui.getMonth(), aujourdhui.getDate()).toISOString().slice(0, 10);
})();

// --- Mensurations en listes déroulantes plutôt qu'en saisie libre : évite les
// fautes de frappe (ex. "17O" au lieu de "170") et les valeurs invraisemblables.
// remplirSelectNombres, configurerSelectAvecAutre et valeurSelectOuAutre : js/app.js. ---
remplirSelectNombres('ca-poids', 35, 130, 1, ' kg');
remplirSelectNombres('ca-poitrine', 70, 130, 1, ' cm');
remplirSelectNombres('ca-tourtaille', 55, 110, 1, ' cm');
remplirSelectNombres('ca-hanches', 70, 130, 1, ' cm');
remplirSelectNombres('ca-pointure', 34, 46, 1, '');

// --- Ville en liste déroulante (avec "Autre" en secours) plutôt qu'en saisie
// libre : évite les fautes/variantes d'orthographe (Man/Mann, Yakro/Yamoussoukro...). ---
function remplirSelectListe(id, liste) {
  const champ = document.getElementById(id);
  if (!champ) return;
  champ.appendChild(new Option('—', ''));
  liste.forEach(v => champ.appendChild(new Option(v, v)));
  champ.appendChild(new Option(T('Autre', 'Other'), 'Autre'));
}
// VILLES_CI vient désormais de js/villes-cote-ivoire.js (partagé avec
// espace-mannequin.html et espace-mannequin-MA2M-premium-20.html).
remplirSelectListe('ca-ville', VILLES_CI);
configurerSelectAvecAutre('ca-ville', 'ca-ville-autre');
brancherCascadeAbidjan('ca-ville', 'ca-commune-wrap', 'ca-commune', 'ca-commune-autre');
configurerSelectAvecAutre('ca-commune', 'ca-commune-autre');
if (EN) [...document.getElementById('ca-commune').options].forEach(o => {
  if (o.value === 'Abidjan') o.text = 'Abidjan (no specific district)';
  if (o.value === 'Autre') o.text = 'Other';
});

function redimensionnerImage(fichier, coteMax = 2800, qualite = 0.88) {
  return new Promise((resolve) => {
    // On ne retouche que les JPEG : un PNG/GIF/WebP peut avoir de la transparence,
    // qui deviendrait un fond noir en le convertissant en JPEG (pas de canal alpha).
    if (fichier.type !== 'image/jpeg' || fichier.size < 900 * 1024) { resolve(fichier); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const coteActuel = Math.max(img.width, img.height);
        const ratio = coteActuel > coteMax ? coteMax / coteActuel : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob || blob.size >= fichier.size) { resolve(fichier); return; }
          resolve(new File([blob], fichier.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
        }, 'image/jpeg', qualite);
      } catch (e) {
        resolve(fichier);
      }
    };
    img.onerror = () => resolve(fichier);
    img.src = URL.createObjectURL(fichier);
  });
}

function fichierEnBase64(fichier) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result);
    lecteur.onerror = reject;
    lecteur.readAsDataURL(fichier);
  });
}

// Les photos de candidature (potentiellement des milliers lors d'un gros casting)
// partent directement vers Google Drive via ce script, plutôt que vers Supabase —
// pour ne pas charger le stockage Supabase (plan gratuit) pendant un casting massif.
// Seul le lien de chaque photo est ensuite enregistré dans Supabase (casting_photos.url).
const URL_SCRIPT_PHOTOS_CASTING = 'https://script.google.com/macros/s/AKfycbxzPeaTLvMqZKtBvJJabLeZBh6JJ9ZaggPYUY8XAoh1-tyBq1Byi3lBm3SkhkH8rqNxxg/exec';

function afficherMsg(el, texte, type) {
  el.className = 'form-msg ' + type;
  el.textContent = texte;
}

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
  const { data: projets } = await sb.from('casting_projets').select('id, nom, description').eq('actif', true).order('ordre_affichage', { ascending: true }).order('nom');
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
function photosMin() { return estDebutant() ? 3 : 4; }
function majParcours() {
  if (PARCOURS !== 'agence') return;
  const debutant = estDebutant();
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
  return cat ? cat + (classe ? ' — ' + classe : '') : null;
}

// --- Vidéo de présentation : obligatoire, 1 minute maximum. Une vidéo lourde
// (4K, 60 images/s…) est d'abord ALLÉGÉE par l'appareil du candidat (js/video-allegee.js,
// 30/09) ; si l'appareil ne sait pas le faire, la vidéo d'origine part telle quelle,
// à condition de ne pas dépasser 60 Mo (au-delà, l'envoi échoue sur mobile). ---
const VIDEO_MAX_OCTETS = 60 * 1024 * 1024;
const VIDEO_MAX_ORIGINAL = 2 * 1024 * 1024 * 1024; // avant allègement
const VIDEO_MAX_SECONDES = 65; // 1 minute annoncée (décision du 30/09), petite marge
let videoChoisie = null;
let videoEnPreparation = null; // promesse tant que l'allègement n'est pas fini
let numeroVideo = 0;           // pour ignorer une ancienne vidéo remplacée entre-temps
// Durée lue directement dans le fichier (boîte « mvhd » des vidéos MP4/MOV/3GP de
// téléphone) : l'ancienne méthode passait par un lecteur vidéo que la sécurité du
// site bloque (journal du 30/09 : « media-src → blob »). null si illisible.
async function dureeVideo(fichier) {
  try {
    const octets = new Uint8Array(await fichier.arrayBuffer());
    const vue = new DataView(octets.buffer);
    for (let i = 4; i < octets.length - 32; i++) {
      if (octets[i] !== 0x6d || octets[i + 1] !== 0x76 || octets[i + 2] !== 0x68 || octets[i + 3] !== 0x64) continue; // "mvhd"
      const version = octets[i + 4];
      const echelle = vue.getUint32(i + (version === 1 ? 24 : 16));
      const duree = version === 1
        ? vue.getUint32(i + 28) * 4294967296 + vue.getUint32(i + 32)
        : vue.getUint32(i + 20);
      return echelle ? duree / echelle : null;
    }
  } catch (e) {}
  return null;
}
function majJauge(id, pc, titre) {
  const j = document.getElementById(id);
  if (!j) return;
  pc = Math.max(0, Math.min(100, Math.round(pc)));
  j.classList.remove('u-hidden', 'en-erreur');
  j.classList.toggle('terminee', pc >= 100);
  j.querySelector('.jauge-remplie').style.width = pc + '%';
  j.querySelector('.jauge-pc').textContent = pc + ' %';
  j.setAttribute('aria-valuenow', pc);
  if (titre) j.querySelector('.jauge-titre').textContent = titre;
}
function jaugeEnErreur(id, titre) {
  const j = document.getElementById(id);
  if (!j) return;
  j.classList.add('en-erreur'); j.classList.remove('terminee');
  if (titre) j.querySelector('.jauge-titre').textContent = titre;
}
function cacherJauge(id) { const j = document.getElementById(id); if (j) j.classList.add('u-hidden'); }
function montrerApercuVideo(adresseImage, texte) {
  const bloc = document.getElementById('ca-video-apercu');
  const img = bloc.querySelector('img');
  if (adresseImage) { img.src = adresseImage; img.classList.remove('u-hidden'); } else { img.removeAttribute('src'); img.classList.add('u-hidden'); }
  bloc.querySelector('.video-apercu-texte').textContent = texte || '';
  bloc.classList.toggle('u-hidden', !adresseImage && !texte);
}
const enMo = (octets) => EN ? (octets / 1048576).toFixed(1) + ' MB' : (octets / 1048576).toFixed(1).replace('.', ',') + ' Mo';
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
    info.textContent = T(`Vidéo beaucoup trop lourde (${enMo(fichier.size)}). Filmez 1 minute maximum.`, `Video far too large (${enMo(fichier.size)}). Please film 1 minute maximum.`);
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
    info.textContent = T(`Vidéo trop longue (${Math.round(duree)} s) : 1 minute maximum.`, `Video too long (${Math.round(duree)} s): 1 minute maximum.`);
    e.target.value = ''; return;
  }
  montrerApercuVideo(examen.apercu, examen.apercu ? T('Votre vidéo : vérifiez que c\'est bien la bonne.', 'Your video: please check it is the right one.') : '');

  const refuserTropLourde = () => {
    info.style.color = 'var(--rouge)';
    info.textContent = T(`Vidéo trop lourde (${enMo(fichier.size)}) et cet appareil ne peut pas l'alléger : 60 Mo maximum. Filmez 1 minute maximum, ou baissez la qualité de la caméra (720p au lieu de 1080p ou 4K).`, `Video too large (${enMo(fichier.size)}) and this device cannot reduce it: 60 MB maximum. Film 1 minute maximum, or lower the camera quality (720p instead of 1080p or 4K).`);
    e.target.value = '';
  };
  info.textContent = '';
  videoEnPreparation = (async () => {
    let allegee = null;
    try {
      if (window.allegerVideo) allegee = await window.allegerVideo(fichier, (pc) => {
        if (numero === numeroVideo) majJauge('ca-video-jauge', pc, T('Préparation de votre vidéo (allègement pour un envoi rapide)…', 'Preparing your video (reducing it for a faster upload)…'));
      });
    } catch (err) {
      allegee = null;
      if (window.signalerErreur) window.signalerErreur('Vidéo non allégée (envoi de l\'originale)', (err && err.message) || String(err), enMo(fichier.size) + ', ' + (fichier.type || 'type inconnu'));
    }
    if (numero !== numeroVideo) return;
    if (allegee) { majJauge('ca-video-jauge', 100, T('Vidéo préparée', 'Video ready')); videoPrete(allegee, duree, fichier); }
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

function rafraichirApercuPhotos() {
  const compteur = document.getElementById('ca-photos-compteur');
  const apercu = document.getElementById('ca-photos-apercu');
  const n = photosSelectionnees.length;
  const min = photosMin();
  const pl = n > 1 ? 's' : '';
  compteur.textContent = n >= min
    ? T(`${n} photo${pl} sélectionnée${pl}.`, `${n} photo${pl} selected.`)
    : T(`${n} photo${pl} sélectionnée${pl} — ${min} minimum requises.`, `${n} photo${pl} selected — ${min} minimum required.`);
  compteur.style.color = n >= min ? 'var(--gris)' : 'var(--rouge)';

  apercu.innerHTML = photosSelectionnees.map((f, i) => `
    <div class="ca-photo-vignette ca-20">
      <img src="${URL.createObjectURL(f)}" class="ca-21" alt="Photo ${i + 1}">
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
document.getElementById('ca-visionneuse').addEventListener('click', fermerVisionneuse);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermerVisionneuse(); });

document.getElementById('ca-photos').addEventListener('change', (e) => {
  photosSelectionnees.push(...Array.from(e.target.files || []));
  e.target.value = '';
  rafraichirApercuPhotos();
});

document.getElementById('ca-photo-remplacement').addEventListener('change', (e) => {
  const fichier = e.target.files[0];
  e.target.value = '';
  if (!fichier || indexPhotoARemplacer === null) return;
  photosSelectionnees[indexPhotoARemplacer] = fichier;
  indexPhotoARemplacer = null;
  rafraichirApercuPhotos();
});

// --- La liste "Taille" elle-même commence à la taille minimale requise selon le
// genre (175 cm femmes, 185 cm hommes) — impossible de choisir en dessous, donc
// plus besoin de bloquer/refuser une candidature après coup. Mineurs exemptés :
// liste complète (140 cm et plus) tant que la date de naissance l'indique. ---
function remplirTailleSelonGenre() {
  const genre = document.getElementById('ca-genre').value;
  const indication = document.getElementById('ca-taille-indication');
  const mineur = estMineur();
  const champ = document.getElementById('ca-taille');
  const valeurActuelle = champ.value;
  const min = mineur ? 140 : (genre === 'homme' ? 185 : (genre === 'femme' ? 175 : 140));

  champ.innerHTML = '';
  champ.appendChild(new Option('—', ''));
  for (let v = min; v <= 210; v++) champ.appendChild(new Option(v + ' cm', v));
  if ([...champ.options].some(o => o.value === valeurActuelle)) champ.value = valeurActuelle;

  if (mineur) { indication.textContent = T('Pas de taille minimale pour les candidatures de mineurs.', 'No minimum height for applications from minors.'); }
  else if (genre === 'homme') { indication.textContent = T('Taille minimale requise : 185 cm', 'Minimum height required: 185 cm'); }
  else if (genre === 'femme') { indication.textContent = T('Taille minimale requise : 175 cm', 'Minimum height required: 175 cm'); }
  else { indication.textContent = ''; }
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

document.getElementById('form-casting').addEventListener('submit', async (e) => {
  e.preventDefault();
  // Évite les envois multiples : un visiteur qui tape plusieurs fois sur
  // "Envoyer" (le temps que la validation s'exécute) ne déclenche l'envoi
  // qu'une seule fois (journal du site, 01-02/10/2026 : 4 clics en 2 s).
  if (document.getElementById('btn-envoyer').disabled) return;
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

  if (document.getElementById('ca-ville').value === 'Abidjan' && document.getElementById('ca-commune').value === 'Abidjan') {
    afficherMsg(msg, T('Merci de préciser votre commune à Abidjan.', 'Please specify your district in Abidjan.'), 'err');
    return;
  }

  const fichiersPhotos = photosSelectionnees;
  const minPhotos = photosMin();
  if (fichiersPhotos.length < minPhotos) {
    afficherMsg(msg, T(`Merci d'ajouter au moins ${minPhotos} photos (${fichiersPhotos.length} sélectionnée${fichiersPhotos.length > 1 ? 's' : ''} pour l'instant).`, `Please add at least ${minPhotos} photos (${fichiersPhotos.length} selected so far).`), 'err');
    return;
  }
  if (videoEnPreparation) {
    afficherMsg(msg, T('Votre vidéo est en cours de préparation — l\'envoi démarre dès qu\'elle est prête…', 'Your video is being prepared — sending will start as soon as it is ready…'), 'ok');
    document.getElementById('btn-envoyer').disabled = true;
    await videoEnPreparation;
    document.getElementById('btn-envoyer').disabled = false;
  }
  if (!videoChoisie) {
    afficherMsg(msg, T('Merci d\'ajouter votre vidéo de présentation (1 minute maximum).', 'Please add your introduction video (1 minute maximum).'), 'err');
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
    message: document.getElementById('ca-message').value.trim(),
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

  let nbPhotosEchouees = 0;
  let dossierDrive = null;
  // Jauges : les photos sont d'abord préparées une par une (0 → 50 %), puis
  // envoyées ensemble ; pendant l'envoi la jauge avance selon le temps estimé,
  // sans jamais dépasser 95 % avant la réponse de Google.
  document.getElementById('ca-envoi-jauges').classList.remove('u-hidden');
  majJauge('ca-jauge-photos', 0, T(`Photos (${fichiersPhotos.length}) : préparation…`, `Photos (${fichiersPhotos.length}): preparing…`));
  majJauge('ca-jauge-video', 0, T('Vidéo : en attente des photos…', 'Video: waiting for the photos…'));
  let minuteurPhotos = null;
  try {
    const photosBase64 = [];
    let prepares = 0;
    for (const fichierOriginal of fichiersPhotos) {
      try {
        const fichierConverti = await convertirSiHeic(fichierOriginal);
        const fichier = await redimensionnerImage(fichierConverti);
        photosBase64.push(await fichierEnBase64(fichier));
      } catch (e) {
        nbPhotosEchouees++;
      }
      majJauge('ca-jauge-photos', ++prepares / fichiersPhotos.length * 50, T(`Photos (${fichiersPhotos.length}) : préparation…`, `Photos (${fichiersPhotos.length}): preparing…`));
    }

    const octetsPhotos = photosBase64.reduce((t, b) => t + b.length, 0);
    const debitEstime = ((navigator.connection && navigator.connection.downlink) || 1) * 125000 * 0.6; // octets/s
    const dureeEstimee = Math.max(3, octetsPhotos / debitEstime + 3);
    const debutEnvoiPhotos = Date.now();
    majJauge('ca-jauge-photos', 50, T(`Photos (${fichiersPhotos.length}) : envoi…`, `Photos (${fichiersPhotos.length}): sending…`));
    minuteurPhotos = setInterval(() => {
      const ecoule = (Date.now() - debutEnvoiPhotos) / 1000;
      majJauge('ca-jauge-photos', 50 + 45 * (1 - Math.exp(-ecoule / dureeEstimee * 1.6)), T(`Photos (${fichiersPhotos.length}) : envoi…`, `Photos (${fichiersPhotos.length}): sending…`));
    }, 300);
    const { liens, echec, dossier } = await envoyerPhotosVersDrive(URL_SCRIPT_PHOTOS_CASTING, {
      nom: candidature.full_name,
      email: candidature.email,
      phone: candidature.phone,
      type: PARCOURS,
      projet: projetNom || '',
      photos: photosBase64
    });

    clearInterval(minuteurPhotos);
    if (echec) jaugeEnErreur('ca-jauge-photos', T('Photos : non envoyées', 'Photos: not sent'));
    else majJauge('ca-jauge-photos', 100, T(`Photos (${liens.length}) : envoyées ✓`, `Photos (${liens.length}): sent ✓`));
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
    clearInterval(minuteurPhotos);
    jaugeEnErreur('ca-jauge-photos', T('Photos : non envoyées', 'Photos: not sent'));
  }
  Promise.resolve(journaliserPhotosEchouees('candidature', candidature.id, nbPhotosEchouees)).catch(() => {});

  // Vidéo de présentation : envoyée APRÈS les photos (elle est plus lourde), dans le
  // même dossier Drive ; son lien est ensuite rattaché à la candidature.
  let lienVideo = null;
  afficherMsg(msg, T('Envoi de votre vidéo… gardez la page ouverte.', 'Sending your video… please keep this page open.'), 'ok');
  majJauge('ca-jauge-video', 0, T(`Vidéo (${enMo(videoChoisie.size)}) : envoi…`, `Video (${enMo(videoChoisie.size)}): sending…`));
  try {
    lienVideo = await envoyerVideoVersDrive(URL_SCRIPT_PHOTOS_CASTING, {
      nom: candidature.full_name, email: candidature.email, phone: candidature.phone,
      type: PARCOURS, projet: projetNom || '', dossier: dossierDrive
    }, videoChoisie, (pc) => majJauge('ca-jauge-video', pc, T(`Vidéo (${enMo(videoChoisie.size)}) : envoi…`, `Video (${enMo(videoChoisie.size)}): sending…`)));
    if (lienVideo) await sb.rpc('ajouter_video_candidature', { p_id: candidature.id, p_url: lienVideo });
    if (lienVideo) majJauge('ca-jauge-video', 100, T('Vidéo : envoyée ✓', 'Video: sent ✓'));
    else jaugeEnErreur('ca-jauge-video', T('Vidéo : non envoyée', 'Video: not sent'));
  } catch (e) {
    lienVideo = null;
    jaugeEnErreur('ca-jauge-video', T('Vidéo : non envoyée', 'Video: not sent'));
    if (window.signalerErreur) window.signalerErreur('Vidéo de candidature non envoyée', 'lecture du fichier sur le téléphone : ' + ((e && e.message) || e), (videoChoisie ? (videoChoisie.size / 1048576).toFixed(1) + ' Mo, ' + (videoChoisie.type || 'type inconnu') : ''));
  }

  envoyerNotificationEmail({
    name: candidature.full_name,
    telephone: candidature.phone,
    email: candidature.email,
    message: `Nouvelle candidature casting${EN ? ' (site en anglais)' : ''}.\nPostule pour : ${PARCOURS === 'projet' ? 'Projet/casting : ' + projetNom : "Intégrer l'agence" + (candidature.experience_mannequin === 'non' ? ' — Débutant(e)' : ' — Déjà mannequin')}\nVille : ${candidature.city || '-'}${candidature.quartier ? ' — ' + candidature.quartier : ''}\nNiveau d'études : ${candidature.niveau_etudes || candidature.situation_scolaire || '-'}\nTaille de vêtements : ${candidature.clothing_size || '-'}\nVidéo : ${lienVideo || 'non reçue'}\nTaille : ${candidature.height_cm || '-'} cm\nMessage : ${candidature.message || '-'}${mineur ? `\n⚠️ MINEUR — Parent/tuteur : ${candidature.parent_nom || '-'} — ${candidature.parent_telephone || '-'}` : ''}`
  });

  if (window.jouerSon) window.jouerSon('envoi');
  const soucis = [];
  if (nbPhotosEchouees) soucis.push(T(`${nbPhotosEchouees} photo${nbPhotosEchouees > 1 ? 's n\'ont' : ' n\'a'} pas pu être envoyée${nbPhotosEchouees > 1 ? 's' : ''}`, `${nbPhotosEchouees} photo${nbPhotosEchouees > 1 ? 's' : ''} could not be sent`));
  if (!lienVideo) soucis.push(T('votre vidéo n\'a pas pu être envoyée — envoyez-la sur WhatsApp au +225 05 45 65 66 87 en indiquant votre nom', 'your video could not be sent — please send it on WhatsApp to +225 05 45 65 66 87 with your name'));
  afficherMsg(msg, soucis.length
    ? T(`Candidature envoyée, mais ${soucis.join(' ; ')} (connexion instable ?). Le reste du dossier est bien enregistré.`, `Application sent, but ${soucis.join('; ')} (unstable connection?). The rest of your application has been saved.`)
    : T('Merci ! Votre candidature a bien été envoyée. Notre équipe vous recontactera si votre profil est retenu.', 'Thank you! Your application has been sent. Our team will contact you if your profile is selected.'), 'ok');
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
