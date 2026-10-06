// ================== Compatibilité anciens téléphones ==================
// crypto.randomUUID n'existe que depuis iOS 15.4 / Chrome 92 : sur un iPhone plus
// ancien, l'envoi d'une candidature ou d'une sélection recruteur plantait sans
// message (audit du 28 septembre 2026). Équivalent standard (UUID v4) basé sur
// crypto.getRandomValues, disponible partout.
if (window.crypto && typeof window.crypto.randomUUID !== 'function' && typeof window.crypto.getRandomValues === 'function') {
  try {
    window.crypto.randomUUID = function () {
      const o = window.crypto.getRandomValues(new Uint8Array(16));
      o[6] = (o[6] & 0x0f) | 0x40;
      o[8] = (o[8] & 0x3f) | 0x80;
      const hex = Array.prototype.map.call(o, function (b) { return (b + 0x100).toString(16).slice(1); }).join('');
      return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
    };
  } catch (e) {}
}

// ================== Surveillance des erreurs réelles du site ==================
// Déplacée dans js/surveillance.js (chargé tout en haut de chaque page, bien avant
// ce fichier) et élargie aux dysfonctionnements silencieux. Ici, un simple relais
// pour signaler aussi les échecs que le code rattrape sans planter.
function signalerProbleme(categorie, message, detail) {
  if (window.signalerErreur) window.signalerErreur(categorie, message, detail);
}

// ================== Conversion des photos HEIC (iPhone) en JPEG ==================
// Remplace la bibliothèque heic2any (retirée le 28 septembre 2026) : elle utilise
// « new Function » (évaluation de code), interdit par nos règles de sécurité (CSP,
// pas de 'unsafe-eval') — d'où une erreur « EvalError » à CHAQUE chargement des pages
// d'envoi de photos (l'essentiel du journal d'erreurs ce jour-là), sans jamais
// réussir à convertir quoi que ce soit, en plus de peser 1,3 Mo par page.
// Même signature que heic2any({ blob, toType, quality }) pour ne rien changer aux
// pages qui l'appellent. La conversion est faite par le navigateur lui-même : ça
// marche là où il sait lire le HEIC (Safari sur iPhone/Mac, d'où viennent ces
// photos — et l'iPhone convertit d'ailleurs souvent tout seul en JPEG à l'envoi).
// Ailleurs la promesse échoue : les pages gardent alors leur comportement habituel
// (envoi du fichier d'origine), et la surveillance le signale.
if (typeof window.heic2any === 'undefined') {
  window.heic2any = async function (options) {
    const url = URL.createObjectURL(options.blob);
    try {
      const img = await new Promise(function (ok, ko) {
        const i = new Image();
        i.onload = function () { ok(i); };
        i.onerror = function () { ko(new Error('Photo HEIC illisible par ce navigateur')); };
        i.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      return await new Promise(function (ok, ko) {
        canvas.toBlob(function (b) { b ? ok(b) : ko(new Error('Conversion JPEG impossible')); }, options.toType || 'image/jpeg', options.quality || 0.85);
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  };
}

// Conversion d'une photo HEIC (iPhone) en JPEG avant envoi — fonction unique pour
// tout le site (06/10/2026 : elle était recopiée dans 14 pages et scripts, ce qui
// obligeait à corriger 14 fois le moindre problème). En cas d'échec, le fichier
// d'origine est renvoyé tel quel (comportement inchangé).
async function convertirSiHeic(fichier, qualite) {
  const estHeic = /image\/hei(c|f)/i.test(fichier.type) || /\.(heic|heif)$/i.test(fichier.name);
  if (!estHeic || typeof heic2any === 'undefined') return fichier;
  try {
    const resultat = await heic2any({ blob: fichier, toType: 'image/jpeg', quality: qualite || 0.85 });
    const blobFinal = Array.isArray(resultat) ? resultat[0] : resultat;
    return new File([blobFinal], fichier.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
  } catch (e) {
    console.error('Conversion HEIC échouée, envoi du fichier original :', e);
    return fichier;
  }
}

// ================== Verrou de défilement fiable, y compris sur iPhone ==================
// `overflow: hidden` seul (utilisé auparavant) ne bloque PAS le défilement tactile sur
// iOS Safari — limitation connue et documentée d'iOS, pas un bug ponctuel. La seule
// méthode qui fonctionne réellement sur iPhone consiste à figer la page en
// position:fixed à sa position de défilement exacte, puis à la restaurer à l'identique
// une fois déverrouillée. Un compteur permet à plusieurs éléments (porte d'entrée, menu,
// modales) de verrouiller/déverrouiller sans se marcher dessus si jamais ils se
// chevauchent. Utilisé par le menu et toutes les superpositions plein écran du site.
//
// Sur l'accueil (index.html / en/index.html), ces mêmes fonctions sont déjà définies
// plus tôt, dans un script tout en haut de <body> (avant ce fichier, chargé en fin de
// page) — pour verrouiller la porte d'entrée immédiatement, sans laisser le temps à un
// visiteur rapide de faire défiler avant que le verrou ne s'active. On ne les redéfinit
// donc ici que si elles n'existent pas déjà, pour ne jamais écraser un verrou déjà posé.
if (!window.verrouillerDefilement) (function verrouDefilementIOS() {
  let positionSauvegardee = 0;
  let compteur = 0;

  // Deuxième ligne de défense : certains navigateurs/WebViews embarqués (in-app
  // browsers de messageries, réseaux sociaux, etc.) ignorent parfois le simple
  // position:fixed. On bloque donc aussi directement le geste de balayage tactile
  // tant que la page est verrouillée — sauf à l'intérieur des zones qui ont
  // légitimement leur propre défilement interne (menu, fiches, tiroir du tableau
  // de bord), pour ne pas les casser.
  const ZONES_DEFILEMENT_AUTORISE = '.menu-overlay, .news-modal-contenu, .modal-overlay, .tdb-menu-panel, .projets-liste-scroll, .redaction-shell';
  function bloquerGesteTactile(e) {
    if (e.target.closest(ZONES_DEFILEMENT_AUTORISE)) return;
    e.preventDefault();
  }

  window.verrouillerDefilement = function () {
    if (compteur === 0) {
      positionSauvegardee = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + positionSauvegardee + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.addEventListener('touchmove', bloquerGesteTactile, { passive: false });
    }
    compteur++;
  };

  window.deverrouillerDefilement = function () {
    compteur = Math.max(0, compteur - 1);
    if (compteur === 0) {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      window.scrollTo(0, positionSauvegardee);
      document.removeEventListener('touchmove', bloquerGesteTactile, { passive: false });
    }
  };
})();

// ================== Retour arrière fiable, sur toutes les pages ==================
// Sur mobile/tablette, le bouton "retour" restaure très souvent une page depuis
// le cache du navigateur (bfcache) exactement telle qu'elle était figée en la
// quittant — sans jamais relancer les scripts. Il est arrivé qu'une page reste
// figée dans un état intermédiaire (défilement verrouillé sans possibilité de le
// déverrouiller). On ne force un rechargement complet QUE dans ce cas précis
// (détecté via le verrou de défilement resté actif) — jamais pour un retour
// arrière normal, pour ne pas retélécharger inutilement les photos et données à
// chaque navigation.
window.addEventListener('pageshow', (evenement) => {
  if (evenement.persisted && document.body.style.position === 'fixed') {
    window.location.reload();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // Animation d'apparition au scroll (fade-in + translation)
  // Observe aussi bien les éléments déjà présents au chargement que ceux
  // ajoutés dynamiquement ensuite (fiches mannequins, actualités… chargées depuis la base).
  const observerReveal = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observerReveal.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.reveal').forEach(el => observerReveal.observe(el));

  const observerAjouts = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.classList && node.classList.contains('reveal')) observerReveal.observe(node);
        node.querySelectorAll && node.querySelectorAll('.reveal').forEach(el => observerReveal.observe(el));
      });
    });
  });
  observerAjouts.observe(document.body, { childList: true, subtree: true });
});

// Sécurité : neutralise tout HTML dans un texte avant de l'insérer dans la page
// (protège contre les injections XSS via un nom, un titre, un commentaire...)
// Neutralise un texte avant de l'insérer dans le HTML — protège aussi bien le contenu
// texte que les attributs (src="...", alt="...", data-chemin="...", etc.), en échappant
// systématiquement les caractères qui pourraient casser la structure de la page.
function echapperHtml(texte) {
  if (texte === null || texte === undefined) return '';
  return String(texte)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Niveau des mannequins (décision de la propriétaire, 06/10/2026) : DEUX niveaux seulement,
// « New Face » et « Professionnel » (le mot « Amateur » n'est plus utilisé ; une ancienne
// valeur « Amateur » compte comme New Face). Sur le site public, la compcard et le CV,
// « Professionnel » s'affiche « Main Board », comme dans les grandes agences.
// Règle d'ancienneté : de 0 à 2 ans → New Face ; plus de 2 ans → Professionnel.
function deriverNiveauMannequin(anneesExperience) {
  const annees = anneesExperience === '' || anneesExperience === null || anneesExperience === undefined
    ? NaN : parseInt(anneesExperience, 10);
  return !isNaN(annees) && annees > 2 ? 'Professionnel' : 'New Face';
}
// Niveau à utiliser pour un profil : la valeur enregistrée (Amateur → New Face), sinon la
// règle d'ancienneté.
function niveauNormalise(stocke, anneesExperience) {
  if (stocke === 'Professionnel') return 'Professionnel';
  if (stocke === 'New Face' || stocke === 'Amateur') return 'New Face';
  return deriverNiveauMannequin(anneesExperience);
}
function libelleNiveauPublic(niveau) { return niveau === 'Professionnel' ? 'Main Board' : 'New Face'; }
// Années couvertes par les expériences saisies (de la plus ancienne année à aujourd'hui).
function anneesDepuisPremiereExperience(experiences) {
  const annees = (experiences || []).map(function (e) { const m = String((e && e.annee) || '').match(/(19|20)\d{2}/); return m ? parseInt(m[0], 10) : NaN; })
    .filter(function (a) { return !isNaN(a) && a <= new Date().getFullYear(); });
  return annees.length ? new Date().getFullYear() - Math.min.apply(null, annees) : 0;
}
// Contrôle en coulisses : « Professionnel » coché n'est gardé que si le parcours le justifie
// (plus de 2 ans entre la première expérience et aujourd'hui, ou ancienneté déjà déclarée
// de plus de 2 ans) ; sinon la mannequin reste New Face, même avec dix expériences la même
// année.
function niveauControle(choix, experiences, anneesExperience) {
  if (choix !== 'Professionnel') return 'New Face';
  const annees = Math.max(anneesDepuisPremiereExperience(experiences), parseInt(anneesExperience, 10) || 0);
  return annees > 2 ? 'Professionnel' : 'New Face';
}

// ================== CV mannequin ("Model CV") ==================
// Gabarit partagé entre l'aperçu personnel du mannequin (espace-mannequin.html)
// et l'outil admin du tableau de bord (tableau-de-bord.html) — un seul endroit
// à maintenir pour les deux. construireHtmlCv() prend un objet de données simple
// (pas de dépendance à un état global) et renvoie le HTML à placer à l'intérieur
// d'un conteneur ayant la classe .cv-sheet (styles définis localement dans
// chaque page, qui ont chacune leur propre système de variables CSS).
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function formaterPeriode(valeur) {
  if (!valeur) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur);
  if (m) { const mois = MOIS_FR[parseInt(m[2], 10) - 1]; return mois ? (parseInt(m[3], 10) + ' ' + mois + ' ' + m[1]) : valeur; }
  const m2 = /^(\d{4})-(\d{2})$/.exec(valeur);
  if (m2) { const mois = MOIS_FR[parseInt(m2[2], 10) - 1]; return mois ? (mois.charAt(0).toUpperCase() + mois.slice(1) + ' ' + m2[1]) : valeur; }
  return valeur;
}

const MCV_ICONS = {
  user: '<circle cx="9" cy="6.2" r="3"/><path d="M3.2 16c.6-3.3 3-5.2 5.8-5.2s5.2 1.9 5.8 5.2"/>',
  body: '<rect x="3.2" y="1.8" width="11.6" height="14.4" rx="1.6"/><path d="M5.7 5.4h1.9M5.4 8.4h2.5M5.7 11.4h1.9M5.4 14h2.5"/>',
  grad: '<path d="M1.5 7 9 3.5 16.5 7 9 10.5 1.5 7Z"/><path d="M5 8.6v3.4c0 1 1.8 2 4 2s4-1 4-2V8.6"/><path d="M16.5 7v4.5"/>',
  star: '<path d="M9 2 11.1 6.5 16 7.2 12.5 10.6 13.3 15.5 9 13.2 4.7 15.5 5.5 10.6 2 7.2 6.9 6.5 9 2Z"/>',
  medal: '<circle cx="9" cy="11.3" r="4.1"/><path d="M6.6 7 4.3 2.2M11.4 7 13.7 2.2"/><path d="M7.2 11.3 8.4 12.6 11 9.9"/>',
  image: '<rect x="1.7" y="3" width="14.6" height="12" rx="1"/><circle cx="6" cy="7.3" r="1.3"/><path d="M2 13.5l4-4 3 3 2.6-2.6L16.3 13"/>',
  calendar: '<rect x="2" y="3.3" width="14" height="12.2" rx="1"/><path d="M2 7h14M5.5 1.8v3M12.5 1.8v3"/>',
  pin: '<path d="M9 16.3S3.8 11 3.8 7.1a5.2 5.2 0 0 1 10.4 0C14.2 11 9 16.3 9 16.3Z"/><circle cx="9" cy="7.1" r="1.9"/>',
  globe: '<circle cx="9" cy="9" r="7"/><path d="M2 9h14M9 2c2.2 2 2.2 12 0 14M9 2c-2.2 2-2.2 12 0 14"/>',
  home: '<path d="M2.5 8.2 9 2.7l6.5 5.5"/><path d="M4 7v8h10V7"/><path d="M7.3 15V10.7h3.4V15"/>',
  phone: '<path d="M5.8 2.3 7.4 2.3 8.4 5.3 6.6 6.7C7.4 8.7 8.9 10.2 10.9 11l1.4-1.8 3 1v1.6c0 1-.8 1.8-1.8 1.6C9.2 12.6 5.9 9.3 5.1 5 4.9 4 5 3.3 5.8 2.3Z"/>',
  insta: '<rect x="2" y="2" width="14" height="14" rx="4"/><circle cx="9" cy="9" r="3.4"/><circle cx="13.2" cy="4.8" r=".9"/>',
  link: '<path d="M7.5 10.5 10.5 7.5"/><path d="M8.6 5.5 10 4a2.9 2.9 0 0 1 4.1 4.1l-1.5 1.5"/><path d="M9.4 12.5 8 14a2.9 2.9 0 0 1-4.1-4.1l1.5-1.5"/>',
  mail: '<rect x="2" y="4" width="14" height="10" rx="1.5"/><path d="M2.5 4.8 9 9.8l6.5-5"/>',
};
function mcvIcon(name, size) {
  size = size || 18;
  return '<svg viewBox="0 0 18 18" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' + (MCV_ICONS[name] || '') + '</svg>';
}

const LIBELLES_COMPETENCES = {
  runway: 'Défilé', pose: 'Pose photographique', editorial: 'Éditorial', campagne: 'Campagne de mode',
  fitting: 'Essayage', presentation: 'Présentation de collection', expression: 'Expression corporelle',
  equipe: 'Travail en équipe', discipline: 'Discipline professionnelle'
};
const ORDRE_COMPETENCES = ['runway', 'pose', 'editorial', 'campagne', 'fitting', 'presentation', 'expression', 'equipe', 'discipline'];
const ORDRE_CATEGORIES_PROJETS = ['Défilés', 'Campagnes & Éditoriaux', 'Shootings', 'Autres expériences'];
function categoriserProjet(type) {
  if (type === 'Défilé') return 'Défilés';
  if (['Campagne', 'Publicité', 'Éditorial', 'Lookbook'].indexOf(type) !== -1) return 'Campagnes & Éditoriaux';
  if (type === 'Shooting') return 'Shootings';
  return 'Autres expériences';
}
function groupExperiences(experiences) {
  const groupes = ORDRE_CATEGORIES_PROJETS.map(function (label) { return { label: label, items: [] }; });
  (experiences || []).forEach(function (e) {
    const cat = categoriserProjet(e.type);
    const groupe = groupes.find(function (g) { return g.label === cat; });
    const meta = [e.lieu, formaterPeriode(e.annee)].filter(Boolean).filter(function (x) { return x !== '—'; });
    groupe.items.push((e.nom || 'Expérience') + (meta.length ? ' (' + meta.join(', ') + ')' : ''));
  });
  return groupes.filter(function (g) { return g.items.length; });
}

// Remplissage automatique des cases photo du CV et de la compcard (demande de la
// propriétaire, 28 septembre 2026) : tant qu'un mannequin n'a pas choisi de photo
// pour une case, elle est remplie avec ses photos du Book plutôt que laissée vide.
// Son propre choix reste toujours prioritaire, et rien n'est enregistré en base :
// dès qu'il choisit, c'est son choix qui s'affiche.
// choisies : tableau d'URL (ou null) par case ; reserve : URL du Book par ordre de
// préférence. Une même photo n'apparaît jamais deux fois tant qu'il en reste d'autres.
function completerEmplacementsPhotos(choisies, reserve, nb) {
  const res = [];
  for (let i = 0; i < nb; i++) res.push((choisies || [])[i] || null);
  const prises = new Set(res.filter(Boolean));
  const dispo = [];
  (reserve || []).forEach(function (u) { if (u && !prises.has(u) && dispo.indexOf(u) === -1) dispo.push(u); });
  for (let i = 0; i < nb; i++) if (!res[i] && dispo.length) res[i] = dispo.shift();
  return res;
}
// Photo principale du CV + 5 photos du portfolio, complétées automatiquement.
// d.photosBook : URL des photos du Book, photo de profil en premier.
function photosCvCompletees(d) {
  const book = (d.photosBook || []).filter(Boolean);
  const hero = d.photoCvUrl || book[0] || '';
  const reserve = book.filter(function (u) { return u !== hero; }).concat(hero ? [hero] : []);
  return { hero: hero, compcard: completerEmplacementsPhotos(d.compcardPhotos, reserve, 5) };
}

// « Poitrine / taille / hanches » du CV (HTML et image) ; mesures incohérentes
// (js/tailles.js) : non affichées (« — »), comme sur la fiche publique.
function texteMensurationsCv(p, sexe) {
  if (typeof ma2mMesuresAReprendre === 'function' && ma2mMesuresAReprendre({ category: sexe, chest_cm: p.poitrine, waist_cm: p.tourTaille, hips_cm: p.hanches })) return '—';
  return [p.poitrine, p.tourTaille, p.hanches || p.entrejambe].some(Boolean) ? [p.poitrine || '–', p.tourTaille || '–', p.hanches || p.entrejambe || '–'].join(' / ') : '—';
}

// d = { nomComplet, dateNaissance, villeNaissance, lieuNaissance, nationalite, ville,
//   quartier, citation, bio, instagram, niveauMannequin, mannequinId, photoCvUrl,
//   compcardPhotos: [url|null, ...] (jusqu'à 5), photosBook: [url, ...] (complète les
//   cases vides, voir photosCvCompletees), physique: {...}, formation: {...},
//   competences: {...}, experiences: [{ type, nom, lieu, annee }, ...] }
// Renvoie le HTML à placer à l'intérieur d'un conteneur .cv-sheet — n'inclut pas
// le conteneur lui-même ni les boutons d'action (fermer/imprimer), propres à
// chaque page.
function construireHtmlCv(d) {
  const p = d.physique || {}, f = d.formation || {};
  const groups = groupExperiences(d.experiences);
  const photosAuto = photosCvCompletees(d);
  const heroPhoto = photosAuto.hero ? '<img src="' + photosAuto.hero + '" alt="Photo">' : '';
  const handle = d.instagram ? String(d.instagram).replace(/^@/, '') : '';
  const lienFichePublique = 'https://www.maitreakessemodelmanagement.com/mannequin.html?id=' + encodeURIComponent(d.mannequinId || '');
  const compcardPhotosCv = [0, 1, 2, 3, 4].map(function (i) {
    const url = photosAuto.compcard[i];
    return url ? '<img src="' + url + '" alt="Compcard ' + (i + 1) + '">' : '<div></div>';
  }).join('');
  return (
    '<div class="private-note">Document privé — visible uniquement par ' + echapperHtml((d.nomComplet || '').split(' ')[0] || 'le mannequin') + ' et l’administrateur MA2M</div>' +
    '<div class="mcv-wrap"><aside class="mcv-side">' +
      '<div class="mcv-photo">' + heroPhoto + mcvIcon('user', 48) + '<div class="mcv-photo-logo"><img src="assets/logo-header.png" alt="Maître Akesse Model Management"></div></div>' +
      '<div class="mcv-tagline">Former · Révéler · Valoriser</div>' +
      '<div class="mcv-name"><span class="mcv-nom">' + echapperHtml(d.nomComplet || '') + '</span></div>' +
      '<div class="mcv-divider"></div>' +
      '<ul class="mcv-info-list">' +
        '<li>' + mcvIcon('calendar') + '<div><span class="k">Date de naissance</span><span class="v">' + formaterPeriode(d.dateNaissance) + '</span></div></li>' +
        '<li>' + mcvIcon('pin') + '<div><span class="k">Lieu de naissance</span><span class="v">' + echapperHtml([d.villeNaissance, d.lieuNaissance].filter(Boolean).join(', ') || '—') + '</span></div></li>' +
        '<li>' + mcvIcon('globe') + '<div><span class="k">Nationalité</span><span class="v">' + echapperHtml(d.nationalite || '—') + '</span></div></li>' +
        '<li>' + mcvIcon('home') + '<div><span class="k">Ville de résidence</span><span class="v">' + echapperHtml([d.ville, d.quartier].filter(Boolean).join(', ') || '—') + '</span></div></li>' +
        '<li>' + mcvIcon('phone') + '<div><span class="k">Contact agence</span><span class="v">' + MA2M_TELEPHONES.concat(MA2M_EMAIL).join('<br>') + '</span></div></li>' +
      '</ul>' +
      '<div class="mcv-cat"><span class="lbl">Catégorie</span><span class="val">' + echapperHtml(d.niveauMannequin ? libelleNiveauPublic(d.niveauMannequin) : '') + '</span></div>' +
      (d.citation ? '<blockquote class="mcv-quote">« ' + echapperHtml(d.citation) + ' »</blockquote>' : '') +
      '<div class="mcv-agency"><img src="assets/logo-header.png" alt="Maître Akesse Model Management"></div>' +
    '</aside><div class="mcv-right"><div class="mcv-main"><div class="mcv-topline">Model CV</div>' +
      '<section class="mcv-sec mcv-sec-subtile"><h4>' + mcvIcon('user') + ' Profil</h4><p class="mcv-profile-text">' + echapperHtml(d.bio || 'Profil à compléter.') + '</p></section>' +
      '<section class="mcv-sec"><h4>' + mcvIcon('body') + ' Informations physiques</h4><div class="mcv-two-col">' +
        '<ul class="mcv-kv"><li><span>Taille</span><b>' + (p.taille ? p.taille + ' cm' : '—') + '</b></li><li><span>Poids</span><b>' + (p.poids ? p.poids + ' kg' : '—') + '</b></li>' +
        '<li><span>Mensurations</span><b>' + echapperHtml(texteMensurationsCv(p, d.sexe)) + '</b></li>' +
        '<li><span>Pointure</span><b>' + (p.pointure || '—') + '</b></li></ul>' +
        '<ul class="mcv-kv"><li><span>Taille vêtements</span><b>' + echapperHtml(p.tailleVet || '—') + '</b></li><li><span>Couleur des yeux</span><b>' + (p.yeux || '—') + '</b></li>' +
        '<li><span>Couleur des cheveux</span><b>' + (p.cheveux || '—') + '</b></li><li><span>Carnation</span><b>' + (p.carnation || '—') + '</b></li></ul>' +
      '</div></section>' +
      '<section class="mcv-sec"><h4>' + mcvIcon('grad') + ' Formation</h4><ul class="mcv-kv">' +
        '<li><span>Niveau d’étude</span><b>' + (f.niveau || '—') + '</b></li><li><span>Établissement</span><b>' + (f.etablissement || '—') + '</b></li>' +
        '<li><span>Formation particulière</span><b>' + (f.particuliere || 'Aucune') + '</b></li><li><span>Formation mannequin</span><b>' + (f.mannequin || '—') + '</b></li></ul></section>' +
      '<section class="mcv-sec"><h4>' + mcvIcon('star') + ' Expérience professionnelle</h4>' +
        (groups.length ? groups.map(function (g) { return '<div class="mcv-expgroup"><div class="gh">' + g.label + '</div><ul>' + g.items.map(function (i) { return '<li>' + echapperHtml(i) + '</li>'; }).join('') + '</ul></div>'; }).join('')
          : '<p class="p20-11">Aucune expérience renseignée pour le moment.</p>') + '</section>' +
      '<section class="mcv-sec"><div class="mcv-bottom-row"><div><h4>' + mcvIcon('medal') + ' Compétences mannequin</h4><div class="mcv-skills">' +
        ORDRE_COMPETENCES.map(function (cle) { const pct = (((d.competences || {})[cle] || 3) / 5) * 100; return '<div class="mcv-skill-row"><span class="lbl">' + LIBELLES_COMPETENCES[cle] + '</span><div class="mcv-skill-bar"><i data-largeur="' + pct + '"></i></div></div>'; }).join('') +
        '</div></div><div><h4>' + mcvIcon('image') + ' Portfolio</h4><div class="mcv-portfolio">' +
        '<div class="mcv-portfolio-photos">' + compcardPhotosCv + '</div>' +
        (handle ? '<div class="soc">' + mcvIcon('insta', 15) + ' @' + echapperHtml(handle) + '</div>' : '') +
        '<div class="soc">' + mcvIcon('link', 15) + ' <a href="' + lienFichePublique + '" target="_blank" rel="noopener" class="p20-6">Voir la fiche publique</a></div>' +
        '<div class="mcv-qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&color=241a12&bgcolor=ffffff&data=' + encodeURIComponent(lienFichePublique) + '" alt="QR code vers la fiche publique" width="260" height="260"><span>Scannez pour ouvrir la fiche</span></div>' +
        '</div></div></div></section>' +
    '</div></div></div>'
  );
}

// ================== Champs mensurations/apparence en listes déroulantes ==================
// Mensurations en listes déroulantes plutôt qu'en saisie libre : évite les fautes
// de frappe (ex. "17O" au lieu de "170") et les valeurs invraisemblables — déjà en
// production sur espace-mannequin-ancien.html, repris ici pour espace-mannequin.html
// (l'ancien Premium 20, devenu la page définitive) sans dupliquer une 3e fois cette
// même logique.
function remplirSelectNombres(id, min, max, pas, suffixe) {
  const champ = document.getElementById(id);
  if (!champ) return;
  champ.appendChild(new Option('—', ''));
  for (let v = min; v <= max; v += pas) {
    champ.appendChild(new Option(v + (suffixe || ''), v));
  }
}

// Bascule l'affichage du champ "Autre" (texte libre) selon que le select est sur
// l'option "Autre" ou non — utilisé par tous les selects qui acceptent une valeur
// hors liste (ville, carnation, yeux, cheveux, taille de vêtements...).
function configurerSelectAvecAutre(idSelect, idAutre) {
  const select = document.getElementById(idSelect);
  const autre = document.getElementById(idAutre);
  if (!select || !autre) return;
  select.addEventListener('change', () => {
    autre.style.display = select.value === 'Autre' ? 'block' : 'none';
    if (select.value !== 'Autre') autre.value = '';
  });
}
function valeurSelectOuAutre(idSelect, idAutre) {
  const select = document.getElementById(idSelect);
  const autre = document.getElementById(idAutre);
  if (!select) return '';
  if (select.value === 'Autre') return ((autre && autre.value) || '').trim();
  return select.value;
}
function definirSelectOuAutre(idSelect, idAutre, valeur) {
  const select = document.getElementById(idSelect);
  const autre = document.getElementById(idAutre);
  if (!select) return;
  const options = Array.from(select.options).map(o => o.value);
  if (valeur && options.includes(valeur)) {
    select.value = valeur;
    if (autre) { autre.style.display = 'none'; autre.value = ''; }
  } else if (valeur) {
    select.value = 'Autre';
    if (autre) { autre.style.display = 'block'; autre.value = valeur; }
  } else {
    select.value = '';
    if (autre) { autre.style.display = 'none'; autre.value = ''; }
  }
}

// ================== Fiche Compcard (PDF/JPEG) ==================
// Générateur partagé entre la fiche publique (mannequin.html) et l'espace mannequin
// (téléchargement personnel) : un seul rendu, jamais deux générateurs qui pourraient
// diverger silencieusement l'un de l'autre.

// Charge une photo à sa pleine résolution d'origine (jamais réduite ici) : la netteté
// finale dépend uniquement de la qualité de la photo importée, jamais d'une compression
// ajoutée par le générateur de fiche.
//
// On télécharge d'abord la photo nous-mêmes (fetch) puis on la relit depuis une URL
// locale (blob:) plutôt que de charger l'image directement depuis le nom de domaine de
// Supabase avec crossOrigin="anonymous" : cette dernière méthode dépend d'un en-tête CORS
// correctement présent sur CHAQUE réponse, et échouait silencieusement (canvas "entaché")
// pour certaines photos — d'où des fiches Compcard où seules une ou deux photos
// apparaissaient sans message d'erreur. Le passage par fetch+blob évite ce problème
// d'origine croisée.
async function chargerImageHauteRes(url) {
  let blob;
  try {
    const reponse = await fetch(url);
    if (!reponse.ok) return null; // déjà signalé par la surveillance des requêtes
    blob = await reponse.blob();
  } catch (e) {
    return null; // idem (réseau injoignable)
  }
  const urlLocale = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        URL.revokeObjectURL(urlLocale);
        resolve({ canvas, largeur: canvas.width, hauteur: canvas.height });
      } catch (e) {
        URL.revokeObjectURL(urlLocale);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(urlLocale);
      signalerProbleme('Photo illisible pour la fiche/CV', url);
      resolve(null);
    };
    img.src = urlLocale;
  });
}

// Charge une image du site (même origine, ex. le logo), sans filigrane.
function chargerImageLocale(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve({ canvas, largeur: canvas.width, hauteur: canvas.height });
    };
    img.onerror = () => { signalerProbleme('Image du site non chargée', url); resolve(null); };
    img.src = url;
  });
}

// Icônes de réseaux sociaux, dessinées en vectoriel (jamais en emoji, dont le rendu est
// flou et incohérent d'un système à l'autre une fois agrandi).
function dessinerIconeReseau(ctx, cle, cx, cy, taille, couleurGlyphe) {
  ctx.save();
  ctx.strokeStyle = couleurGlyphe;
  ctx.fillStyle = couleurGlyphe;
  ctx.lineWidth = Math.max(1, taille * 0.09);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = taille / 2;
  switch (cle) {
    case 'instagram': {
      const c = r * 1.55;
      const rr = c * 0.32;
      ctx.beginPath();
      ctx.moveTo(cx - c / 2 + rr, cy - c / 2);
      ctx.lineTo(cx + c / 2 - rr, cy - c / 2);
      ctx.quadraticCurveTo(cx + c / 2, cy - c / 2, cx + c / 2, cy - c / 2 + rr);
      ctx.lineTo(cx + c / 2, cy + c / 2 - rr);
      ctx.quadraticCurveTo(cx + c / 2, cy + c / 2, cx + c / 2 - rr, cy + c / 2);
      ctx.lineTo(cx - c / 2 + rr, cy + c / 2);
      ctx.quadraticCurveTo(cx - c / 2, cy + c / 2, cx - c / 2, cy + c / 2 - rr);
      ctx.lineTo(cx - c / 2, cy - c / 2 + rr);
      ctx.quadraticCurveTo(cx - c / 2, cy - c / 2, cx - c / 2 + rr, cy - c / 2);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + c * 0.28, cy - c * 0.28, r * 0.09, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'facebook':
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${taille * 1.55}px Arial, Helvetica, sans-serif`;
      ctx.fillText('f', cx + taille * 0.02, cy + taille * 0.08);
      break;
    case 'tiktok':
      ctx.beginPath();
      ctx.arc(cx - r * 0.2, cy + r * 0.4, r * 0.46, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.24, cy + r * 0.4);
      ctx.lineTo(cx + r * 0.24, cy - r * 0.8);
      ctx.quadraticCurveTo(cx + r * 0.5, cy - r * 0.32, cx + r * 0.8, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.8, cy + r * 0.12);
      ctx.quadraticCurveTo(cx + r * 0.52, cy + r * 0.08, cx + r * 0.36, cy - r * 0.14);
      ctx.lineTo(cx + r * 0.36, cy + r * 0.4);
      ctx.closePath(); ctx.fill();
      break;
    case 'youtube':
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.42, cy - r * 0.55);
      ctx.lineTo(cx + r * 0.6, cy);
      ctx.lineTo(cx - r * 0.42, cy + r * 0.55);
      ctx.closePath(); ctx.fill();
      break;
  }
  ctx.restore();
}

// Construit la fiche Compcard sur un grand canvas (qualité impression professionnelle,
// 400 dpi sur une page A4 — net même de très près sur un écran géant) à partir de
// { profil, photos, projets } :
// - profil : colonnes model_profiles utiles (full_name, city, category,
//   years_experience, height_cm, weight_kg, chest_cm, waist_cm, hips_cm, inseam_cm,
//   shoe_size, carnation, clothing_size, eye_color, hair_color)
// - photos : tableau de { url, compcard_ordre } (url = pleine résolution)
// - projets : tableau quelconque, seule sa longueur sert (résumé du parcours en pied de page)
async function construireCanvasCompcard(ficheData) {
  const { profil, photos, projets } = ficheData;
  const NOIR = '#060504', BORDEAUX = '#7a1220', BLANC = '#ffffff', GRIS = '#a79f96', ROUGECLAIR = '#cf3b52';
  const LARGEUR_MM = 210, HAUTEUR_MM = 297;
  const DPI = 400;
  const ESCALE = DPI / 25.4;
  const px = mm => mm * ESCALE;
  const fpx = pt => pt * 0.3528 * ESCALE;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(LARGEUR_MM * ESCALE);
  canvas.height = Math.round(HAUTEUR_MM * ESCALE);
  const ctx = canvas.getContext('2d');

  await Promise.all([
    document.fonts.load('700 100px Arial'),
    document.fonts.load('500 100px Arial')
  ]);
  if (document.fonts.ready) await document.fonts.ready;

  // Chaque case garde la photo choisie pour elle ; les cases vides sont complétées
  // avec les autres photos du Book (voir completerEmplacementsPhotos).
  const choisiesParCase = [1, 2, 3, 4, 5].map(n => { const ph = photos.find(p => p.compcard_ordre === n); return ph ? ph.url : null; });
  const urlsPhotos = completerEmplacementsPhotos(choisiesParCase, photos.map(p => p.url), 5).filter(Boolean);
  const [logo, ...imagesPhotos] = await Promise.all([
    chargerImageLocale('assets/logo-dark-bg.png'),
    ...urlsPhotos.map(u => chargerImageHauteRes(u))
  ]);

  function dessinerCouvrant(image, xMm, yMm, lMm, hMm, ancrage) {
    if (!image) return;
    const ratioImage = image.largeur / image.hauteur;
    const ratioCadre = lMm / hMm;
    let sx = 0, sy = 0, sL = image.largeur, sH = image.hauteur;
    if (ratioImage > ratioCadre) { sL = image.hauteur * ratioCadre; sx = (image.largeur - sL) / 2; }
    else { sH = image.largeur / ratioCadre; sy = (image.hauteur - sH) / 2; }
    if (ancrage === 'haut') {
      // Marge de sécurité volontaire : on laisse un peu de champ au-dessus du sujet
      // plutôt que de coller pile sur le haut de la tête, pour ne jamais risquer de
      // rogner cheveux/coiffure sur les photos où le sujet est déjà proche du bord.
      const zoom = 0.93;
      const nSL = sL * zoom, nSH = sH * zoom;
      sx = sx + (sL - nSL) / 2;
      sy = sy + (sH - nSH) * 0.6;
      sL = nSL; sH = nSH;
    }
    ctx.drawImage(image.canvas, sx, sy, sL, sH, px(xMm), px(yMm), px(lMm), px(hMm));
  }

  // --- Fond noir "brillant", effet laqué/miroir : un dégradé diagonal avec un reflet
  // clair traversant le noir profond, plutôt qu'un aplat plat.
  const degradeNoir = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  degradeNoir.addColorStop(0, '#0c0a08');
  degradeNoir.addColorStop(0.22, '#020202');
  degradeNoir.addColorStop(0.46, '#241f1a');
  degradeNoir.addColorStop(0.5, '#2e2822');
  degradeNoir.addColorStop(0.54, '#241f1a');
  degradeNoir.addColorStop(0.78, '#020202');
  degradeNoir.addColorStop(1, '#0c0a08');
  ctx.fillStyle = degradeNoir;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // --- En-tête bordeaux : logo + "COMPCARD" ---
  const hEntete = 30;
  ctx.fillStyle = BORDEAUX;
  ctx.fillRect(0, 0, canvas.width, px(hEntete));
  if (logo) {
    const hLogoMm = 19;
    const wLogoMm = hLogoMm * (logo.largeur / logo.hauteur);
    ctx.drawImage(logo.canvas, px(15), px(6), px(wLogoMm), px(hLogoMm));
  }
  ctx.fillStyle = BLANC;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `bold ${fpx(30)}px Arial, sans-serif`;
  ctx.fillText('COMPCARD', px(195), px(20));

  // --- Photos : 1 grande + grille de 4 ---
  const yPhotos = hEntete + 4, hPhotos = 130;
  dessinerCouvrant(imagesPhotos[0], 15, yPhotos, 92, hPhotos, 'haut');

  const cellulesX = [112, 155.5];
  const cellulesY = [yPhotos, yPhotos + 67];
  const lCellule = 39.5, hCellule = 63;
  let idxGrille = 1;
  for (const y of cellulesY) {
    for (const x of cellulesX) {
      dessinerCouvrant(imagesPhotos[idxGrille], x, y, lCellule, hCellule);
      idxGrille++;
    }
  }

  // --- Logo discret au centre, entre les photos : jamais perdu si la fiche est
  // rognée physiquement (les bords partent en premier, jamais le centre).
  if (logo) {
    const hBadgeMm = 20;
    const wBadgeMm = hBadgeMm * (logo.largeur / logo.hauteur);
    const centreXmm = (15 + 195) / 2;
    const centreYmm = yPhotos + hPhotos / 2;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = px(2.5);
    ctx.drawImage(logo.canvas, px(centreXmm - wBadgeMm / 2), px(centreYmm - hBadgeMm / 2), px(wBadgeMm), px(hBadgeMm));
    ctx.restore();
  }

  // --- Nom et catégorie (texte blanc, lisible sur fond noir) ---
  let y = yPhotos + hPhotos + 13;
  ctx.textAlign = 'left';
  ctx.fillStyle = BLANC;
  ctx.font = `bold ${fpx(27)}px Arial, sans-serif`;
  ctx.fillText((profil.full_name || 'Mannequin').toUpperCase(), px(15), px(y));
  y += 9;
  const niveauMannequin = libelleNiveauPublic(niveauNormalise(profil.niveau_mannequin, profil.years_experience));
  ctx.fillStyle = ROUGECLAIR;
  ctx.font = `${fpx(13)}px Arial, sans-serif`;
  ctx.fillText([niveauMannequin, profil.city].filter(Boolean).join(' · '), px(15), px(y));

  // --- Mensurations (grille 3 colonnes) ---
  y += 11;
  // Mesures incohérentes (« à reprendre », js/tailles.js) : mensurations non affichées
  const masquer = typeof ma2mMesuresAReprendre === 'function' && ma2mMesuresAReprendre(profil);
  const champs = [
    ['Taille', profil.height_cm ? profil.height_cm + ' cm' : null],
    ['Poids', profil.weight_kg ? profil.weight_kg + ' kg' : null],
    ['Poitrine', !masquer && profil.chest_cm ? profil.chest_cm + ' cm' : null],
    ['Tour de taille', !masquer && profil.waist_cm ? profil.waist_cm + ' cm' : null],
    [profil.category === 'homme' ? 'Entrejambe' : 'Bassin', masquer ? null : profil.category === 'homme' ? (profil.inseam_cm ? profil.inseam_cm + ' cm' : null) : (profil.hips_cm ? profil.hips_cm + ' cm' : null)],
    ['Pointure', profil.shoe_size || null],
    ['Carnation', profil.carnation || null],
    ['Taille vêtements', (typeof ma2mTailleVetements === 'function' ? ma2mTailleVetements(profil) : profil.clothing_size) || null],
    ['Yeux', profil.eye_color || null],
    ['Cheveux', profil.hair_color || null]
  ].filter(([, v]) => v);

  const yGrilleDebut = y;
  const PITCH = 13;
  champs.forEach(([label, valeur], i) => {
    const col = i % 3, ligne = Math.floor(i / 3);
    const xMm = 15 + col * 60, yy = yGrilleDebut + ligne * PITCH;
    ctx.fillStyle = GRIS;
    ctx.font = `${fpx(9.5)}px Arial, sans-serif`;
    ctx.fillText(label.toUpperCase(), px(xMm), px(yy));
    ctx.fillStyle = BLANC;
    ctx.font = `bold ${fpx(13.5)}px Arial, sans-serif`;
    ctx.fillText(String(valeur), px(xMm), px(yy + 6));
  });
  const yFinGrille = yGrilleDebut + Math.ceil(champs.length / 3) * PITCH;

  // --- Pied de page bordeaux : toujours à une hauteur sûre (jamais chevauché ni
  // coupé), contacts et réseaux sociaux bien visibles quel que soit le nombre
  // d'informations renseignées sur le profil.
  const yPiedPage = Math.min(Math.max(yFinGrille + 8, 250), 253);

  // --- Résumé du parcours : seulement si la place restante avant le pied de page
  // bordeaux est suffisante. Avec un profil ayant les 10 mensurations remplies ET des
  // projets, cette ligne peut finir à moins de 1mm du pied de page (qui est alors
  // plafonné à 253mm) — un simple écart de rendu de police selon l'appareil du
  // visiteur suffirait à les faire se chevaucher. On préfère omettre cette ligne
  // facultative plutôt que risquer ce chevauchement.
  if (projets && projets.length && yFinGrille + 3 + 5 < yPiedPage) {
    ctx.fillStyle = GRIS;
    ctx.font = `italic ${fpx(9.5)}px Arial, sans-serif`;
    ctx.fillText(`${projets.length} projet${projets.length > 1 ? 's' : ''} réalisé${projets.length > 1 ? 's' : ''} — book complet sur maitreakessemodelmanagement.com`, px(15), px(yFinGrille + 3));
  }
  const hPiedPage = HAUTEUR_MM - yPiedPage;
  ctx.fillStyle = BORDEAUX;
  ctx.fillRect(0, px(yPiedPage), canvas.width, px(hPiedPage));
  ctx.fillStyle = BLANC;
  ctx.font = `bold ${fpx(12)}px Arial, sans-serif`;
  ctx.fillText('CONTACT OFFICIEL MA2M', px(15), px(yPiedPage + 9));
  ctx.font = `${fpx(11)}px Arial, sans-serif`;
  ctx.fillText(MA2M_TELEPHONES.join('   ·   '), px(15), px(yPiedPage + 16.5));
  ctx.fillText('scoutmodel.ma2m@gmail.com', px(15), px(yPiedPage + 23.5));

  // Réseaux sociaux : icônes vectorielles blanches + le pseudo, sur la même ligne.
  const reseaux = ['instagram', 'facebook', 'tiktok', 'youtube'];
  let xIcone = 15;
  reseaux.forEach(cle => {
    dessinerIconeReseau(ctx, cle, px(xIcone + 2.2), px(yPiedPage + 29), px(4.4), BLANC);
    xIcone += 7.5;
  });
  ctx.font = `${fpx(10.5)}px Arial, sans-serif`;
  ctx.fillText('@maitreakessemodelmanagement', px(xIcone + 3), px(yPiedPage + 30.5));

  ctx.font = `italic ${fpx(7)}px Arial, sans-serif`;
  ctx.fillText(`Document officiel généré le ${new Date().toLocaleDateString('fr-FR')} depuis maitreakessemodelmanagement.com — toute demande de booking passe exclusivement par l'agence.`, px(15), px(yPiedPage + hPiedPage - 6));

  return canvas;
}

// Charge jsPDF seulement quand on en a réellement besoin (bouton "Fiche en PDF") au lieu
// de l'imposer à chaque visite de la page — ça allège nettement le chargement initial,
// surtout sur mobile, pour une bibliothèque que la plupart des visiteurs n'utilisent jamais.
let promesseJsPdf = null;
function chargerJsPdf() {
  if (window.jspdf) return Promise.resolve();
  if (promesseJsPdf) return promesseJsPdf;
  promesseJsPdf = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/js/vendor/jspdf-4.2.1.umd.min.js'; // copie locale (jsdelivr trop lent depuis certains réseaux ivoiriens)
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('jsPDF n\'a pas pu être chargé'));
    document.body.appendChild(script);
  });
  return promesseJsPdf;
}

// Coordonnées officielles de l'agence pour les documents générés (PDF), à un seul endroit.
const MA2M_SITE = 'https://www.maitreakessemodelmanagement.com';
const MA2M_TELEPHONES = ['+225 27 22 23 11 76', '+225 05 45 65 66 87'];
const MA2M_EMAIL = 'infos.ma2m@gmail.com';
const MA2M_CONTACT_PDF = 'CONTACT OFFICIEL MA2M  ·  ' + MA2M_TELEPHONES.join('  ·  ') + '  ·  ' + MA2M_EMAIL;

// Lit TOUTES les lignes d'une requête Supabase, par paquets de 1000 (la base ne
// renvoie jamais plus de 1000 lignes d'un coup). fabrique() renvoie une requête
// neuve (sb.from(…).select(…)…) avec un ordre stable. Renvoie { data, error }.
async function lireToutesLignes(fabrique) {
  const toutes = [];
  for (let depart = 0; ; depart += 1000) {
    const { data, error } = await fabrique().range(depart, depart + 999);
    if (error) return { data: toutes, error };
    toutes.push(...(data || []));
    if (!data || data.length < 1000) return { data: toutes, error: null };
  }
}

// Agenda MA2M (Extension 124) : libellés des types de projet [français, anglais] et
// date lisible (« jeu. 15 oct. 2026 », ou « 15 – 17 oct. 2026 » sur plusieurs jours),
// partagés par le tableau de bord et la page Agenda.
const MA2M_TYPES_AGENDA = {
  shooting: ['Shooting', 'Photo shoot'],
  defile: ['Défilé', 'Fashion show'],
  casting: ['Casting', 'Casting'],
  formation: ['Formation', 'Training'],
  evenement: ['Événement', 'Event'],
  autre: ['Projet', 'Project']
};
function libelleTypeAgenda(type, enAnglais) {
  const l = MA2M_TYPES_AGENDA[type] || MA2M_TYPES_AGENDA.autre;
  return l[enAnglais ? 1 : 0];
}
function dateAgenda(debut, fin, enAnglais) {
  const langue = enAnglais ? 'en-GB' : 'fr-FR';
  const d = new Date(debut + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '';
  const complet = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  if (!fin || fin === debut) return d.toLocaleDateString(langue, complet);
  const f = new Date(fin + 'T12:00:00');
  return d.toLocaleDateString(langue, { day: 'numeric', month: 'short' }) + ' – ' + f.toLocaleDateString(langue, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Date du jour au format AAAA-MM-JJ (heure de l'appareil), et projets d'agenda séparés
// en « à venir » (du plus proche au plus lointain) et « réalisés » (du plus récent au
// plus ancien) ; un projet sur plusieurs jours reste « à venir » jusqu'à son dernier jour.
function dateDuJour(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function separerAgenda(projets) {
  const jour = dateDuJour();
  const cle = p => String(p.date_debut || '');
  const tries = (projets || []).slice().sort((x, y) => {
    if (cle(x) === cle(y)) return 0;
    return cle(x) < cle(y) ? -1 : 1;
  });
  return {
    avenir: tries.filter(p => (p.date_fin || p.date_debut) >= jour),
    passes: tries.filter(p => (p.date_fin || p.date_debut) < jour).reverse()
  };
}

// Copie mélangée d'une liste (mélange de Fisher-Yates) : photos de l'accueil, visages et
// photos d'événements de la page « Qui sommes-nous »…
function melanger(liste) {
  const copie = liste.slice();
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

// Prénom (premier mot du nom complet), pour personnaliser les messages.
function prenomDe(nomComplet) { return String(nomComplet || '').trim().split(/\s+/)[0] || ''; }

// Numéro au format WhatsApp (wa.me) : chiffres seuls, indicatif ivoirien ajouté s'il
// manque. Chaîne vide si le numéro est inutilisable. Partagé par le tableau de bord
// (messages groupés, rapports de revue, rapport des profils).
function numeroWhatsApp(tel) {
  let n = String(tel || '').replace(/[^\d]/g, '');
  if (n.indexOf('00') === 0) n = n.slice(2);
  if ((n.length === 10 && n.charAt(0) === '0') || n.length === 8) n = '225' + n; // numéro ivoirien sans indicatif
  return n.length >= 8 ? n : '';
}

// Place une photo sur une case (1 à 5) de la compcard d'un mannequin, ou l'en retire
// (caseN = null). Fonction partagée par l'Espace mannequin et le tableau de bord
// (06/10/2026). La photo qui occupait déjà la case la quitte — APRÈS la pose de la
// nouvelle, pour qu'un échec ne laisse jamais la case vide. Renvoie l'erreur ou null.
async function affecterCaseCompcard(modelId, photoId, caseN) {
  const r = await sb.from('model_photos').update({ compcard_ordre: caseN }).eq('id', photoId).eq('model_id', modelId);
  if (r.error || caseN == null) return r.error || null;
  const l = await sb.from('model_photos').update({ compcard_ordre: null }).eq('model_id', modelId).eq('compcard_ordre', caseN).neq('id', photoId);
  return l.error || null;
}

// Date et heure ajoutées au nom des fichiers téléchargés (compcard, CV) : avec un nom
// toujours identique, le téléphone ouvrait l'ANCIEN fichier déjà enregistré (signalé
// le 06/10/2026 : compcard JPEG avec les anciennes photos). Ex. « -2026-10-06-14h32-05 ».
function horodatageFichier() {
  const d = new Date(), deux = (n) => String(n).padStart(2, '0');
  return '-' + d.getFullYear() + '-' + deux(d.getMonth() + 1) + '-' + deux(d.getDate()) + '-' + deux(d.getHours()) + 'h' + deux(d.getMinutes()) + '-' + deux(d.getSeconds());
}

// Génère et télécharge la fiche (PDF ou JPEG) à partir de ficheData ({ profil, photos,
// projets }), en désactivant/réactivant pendant la génération les deux boutons désignés
// par leur id (idBtnPdf/idBtnJpeg — chaque page peut leur donner l'id de son choix).
async function genererFiche(format, ficheData, idBtnPdf, idBtnJpeg) {
  if (!ficheData || !ficheData.profil) return;
  const btnPdf = idBtnPdf ? document.getElementById(idBtnPdf) : null;
  const btnJpeg = idBtnJpeg ? document.getElementById(idBtnJpeg) : null;
  const btnActif = format === 'jpeg' ? btnJpeg : btnPdf;
  const texteOriginal = btnActif ? btnActif.textContent : '';
  if (btnPdf) btnPdf.disabled = true;
  if (btnJpeg) btnJpeg.disabled = true;
  if (btnActif) btnActif.textContent = 'Génération…';

  try {
    if (format !== 'jpeg') await chargerJsPdf();
    const canvas = await construireCanvasCompcard(ficheData);
    const nomFichier = 'fiche-' + (ficheData.profil.full_name || 'mannequin').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase() + horodatageFichier();

    if (format === 'jpeg') {
      const lien = document.createElement('a');
      lien.href = canvas.toDataURL('image/jpeg', 0.98);
      lien.download = nomFichier + '.jpg';
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
    } else {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      doc.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, 210, 297);
      doc.save(nomFichier + '.pdf');
    }
  } catch (e) {
    signalerProbleme('Génération de fichier échouée', (e && e.message) || String(e), e && e.stack);
    alert('Une erreur est survenue pendant la génération du fichier. Réessayez.');
  } finally {
    if (btnPdf) btnPdf.disabled = false;
    if (btnJpeg) btnJpeg.disabled = false;
    if (btnActif) btnActif.textContent = texteOriginal;
  }
}

// Découpe un texte en lignes qui tiennent chacune dans une largeur donnée (en px), pour
// dessiner un paragraphe multi-lignes sur canvas — measureText() sert à la fois à mesurer
// (peu importe la taille du canvas utilisé pour mesurer) et à dessiner, du moment que
// ctx.font est identique dans les deux cas.
function envelopperLignesCanvas(ctxMesure, texte, largeurMaxPx, police) {
  ctxMesure.font = police;
  const mots = String(texte || '').split(/\s+/).filter(Boolean);
  if (!mots.length) return [''];
  const lignes = [];
  let ligne = '';
  mots.forEach(function (mot) {
    const essai = ligne ? ligne + ' ' + mot : mot;
    if (ligne && ctxMesure.measureText(essai).width > largeurMaxPx) {
      lignes.push(ligne);
      ligne = mot;
    } else {
      ligne = essai;
    }
  });
  if (ligne) lignes.push(ligne);
  return lignes;
}

// Dessine une icône du CV (MCV_ICONS, viewBox 18x18, contour seul) sur canvas à partir de
// son fragment SVG — évite d'avoir à recoder chaque icône à la main une deuxième fois en
// commandes canvas : on réinterprète directement les <circle> et <path d="…"> déjà écrits
// pour l'affichage HTML (voir mcvIcon() ci-dessus).
function dessinerIconeMcvCanvas(ctx, cle, xPx, yPx, taillePx, couleur) {
  const frag = MCV_ICONS[cle];
  if (!frag) return;
  ctx.save();
  ctx.translate(xPx, yPx);
  ctx.scale(taillePx / 18, taillePx / 18);
  ctx.strokeStyle = couleur;
  ctx.fillStyle = couleur;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const reCircle = /<circle cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.-]+)"\s*\/>/g;
  let m;
  while ((m = reCircle.exec(frag))) {
    ctx.beginPath();
    ctx.arc(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), 0, Math.PI * 2);
    ctx.stroke();
  }
  const reRect = /<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"(?: rx="([\d.-]+)")?\s*\/>/g;
  while ((m = reRect.exec(frag))) {
    const rx = m[5] ? parseFloat(m[5]) : 0;
    ctx.beginPath();
    if (rx && ctx.roundRect) ctx.roundRect(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4]), rx);
    else ctx.rect(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4]));
    ctx.stroke();
  }
  const rePath = /<path d="([^"]+)"\s*\/>/g;
  while ((m = rePath.exec(frag))) {
    ctx.stroke(new Path2D(m[1]));
  }
  ctx.restore();
}

// Charge (une seule fois) le générateur de QR code hébergé sur le site — voir
// js/qrcode-generator.js pour le pourquoi (plus de service extérieur).
let promesseQrLib = null;
function chargerQrLib() {
  if (window.qrcode) return Promise.resolve();
  if (promesseQrLib) return promesseQrLib;
  promesseQrLib = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/js/qrcode-generator.js';
    script.onload = () => resolve();
    script.onerror = () => { promesseQrLib = null; reject(new Error('QR indisponible')); };
    document.body.appendChild(script);
  });
  return promesseQrLib;
}

// Dessine un QR code net (modules pleins, sans image intermédiaire) dans un carré de
// tailleMm, fond blanc + petite marge. Ne fait rien si le générateur n'a pas pu charger.
function dessinerQrCanvas(ctx, texte, xPx, yPx, taillePx, couleur) {
  if (!window.qrcode) return false;
  const qr = window.qrcode(0, 'M');
  qr.addData(texte);
  qr.make();
  const n = qr.getModuleCount(), marge = 2;
  const module = taillePx / (n + marge * 2);
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(xPx, yPx, taillePx, taillePx);
  ctx.fillStyle = couleur;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(xPx + (c + marge) * module, yPx + (r + marge) * module, Math.ceil(module), Math.ceil(module));
    }
  }
  ctx.restore();
  return true;
}

// Construit le CV sur un grand canvas (qualité impression, 300 dpi), même principe que
// construireCanvasCompcard() ci-dessus : un dessin recomposé à la main plutôt qu'une
// "photographie" de la page (html2canvas), pour un rendu garanti identique quel que soit
// l'appareil.
//
// Hauteur : le CV n'a pas une longueur fixe (un mannequin peut renseigner une dizaine de
// défilés ou plus). Plutôt que d'ESTIMER la hauteur à part (l'ancienne méthode surestimait
// et laissait un grand vide en bas — retour de la propriétaire, 28 sept. 2026), le dessin
// complet est fait deux fois par la même fonction : une première fois « à blanc » sur un
// canvas jetable pour relever où s'arrête réellement chaque colonne, puis pour de vrai à
// la hauteur exacte. Impossible que les deux divergent.
//
// Bas de la colonne droite (même retour) : compétences sur deux colonnes, puis le
// portfolio en une rangée de photos, puis Instagram + lien vers la fiche + QR code.
// d : même objet que celui attendu par construireHtmlCv() ci-dessus.
// Le canvas renvoyé porte canvas.zonesLiens = [{ x, y, l, h, url }] (en mm) pour que le
// PDF rende le lien et le QR cliquables.
async function construireCanvasCv(d) {
  const p = d.physique || {}, f = d.formation || {};
  const groupes = groupExperiences(d.experiences);
  const NOIR = '#060504', BORDEAUX2 = '#9c1c2c', OR = '#d55468', IVOIRE = '#f4f0ea';
  const TEXTE_SOMBRE = '#2a2622', TEXTE_GRIS = '#6b6560', TEXTE_GRIS_CLAIR = '#8a8378', TRAIT = '#ddd0b8';
  const LARGEUR_MM = 210, SIDEBAR_MM = 68, MAIN_MM = LARGEUR_MM - SIDEBAR_MM;
  const DPI = 300;
  const ESCALE = DPI / 25.4;
  const px = function (mm) { return mm * ESCALE; };
  const fpx = function (pt) { return pt * 0.3528 * ESCALE; };

  await Promise.all([
    document.fonts.load('600 100px Jost'), document.fonts.load('400 100px Jost'), document.fonts.load('italic 400 100px Jost'),
    document.fonts.load('600 100px "Cormorant Garamond"')
  ]);
  if (document.fonts.ready) await document.fonts.ready;

  const lienFichePublique = 'https://www.maitreakessemodelmanagement.com/mannequin.html?id=' + encodeURIComponent(d.mannequinId || '');
  const photosAuto = photosCvCompletees(d);
  const [photoHero, logo, ...photosPortfolio] = await Promise.all([
    photosAuto.hero ? chargerImageHauteRes(photosAuto.hero) : Promise.resolve(null),
    chargerImageLocale('assets/logo-header.png'),
    ...[0, 1, 2, 3, 4].map(function (i) { const u = photosAuto.compcard[i]; return u ? chargerImageHauteRes(u) : Promise.resolve(null); }),
    chargerQrLib().catch(function () { return null; })
  ]);
  photosPortfolio.pop(); // résultat de chargerQrLib, pas une photo
  if (!window.qrcode) signalerProbleme('QR code absent du CV', 'le générateur de QR code n\'a pas pu se charger');
  const photosPresentes = photosPortfolio.filter(Boolean);
  const handle = d.instagram ? String(d.instagram).replace(/^@/, '') : '';

  const PAD_SIDEBAR = 7, PAD_MAIN = 8;
  const hPhotoHero = SIDEBAR_MM; // photo carrée pleine largeur (ratio 1/1, plus sûr que 3/4 quelle que soit la photo fournie)
  const hBanniere = 9;
  const RESERVE_LOGO_BAS = 22; // logo de l'agence en pied de colonne gauche

  function dessinerTout(ctx, hColonnes) {
    const zonesLiens = [];
    function dessinerCouvrant(image, xMm, yMm, lMm, hMm) {
      if (!image) return;
      const ratioImage = image.largeur / image.hauteur, ratioCadre = lMm / hMm;
      let sx = 0, sy = 0, sL = image.largeur, sH = image.hauteur;
      if (ratioImage > ratioCadre) { sL = image.hauteur * ratioCadre; sx = (image.largeur - sL) / 2; }
      else { sH = image.largeur / ratioCadre; sy = (image.hauteur - sH) / 2; }
      ctx.drawImage(image.canvas, sx, sy, sL, sH, px(xMm), px(yMm), px(lMm), px(hMm));
    }

    // --- Bandeau "document privé" ---
    ctx.fillStyle = '#2c1116';
    ctx.fillRect(0, 0, px(LARGEUR_MM), px(hBanniere));
    ctx.fillStyle = '#f0d3d7';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `400 ${fpx(9)}px Jost, sans-serif`;
    ctx.fillText('Document privé — visible uniquement par ' + ((d.nomComplet || '').split(' ')[0] || 'le mannequin') + ' et l’administrateur MA2M', px(LARGEUR_MM) / 2, px(hBanniere / 2));

    // ============== COLONNE GAUCHE (sidebar sombre) ==============
    const yColDebut = hBanniere;
    const degradeSidebar = ctx.createLinearGradient(0, px(yColDebut), px(SIDEBAR_MM) * 0.6, px(yColDebut + hColonnes));
    degradeSidebar.addColorStop(0, '#141010');
    degradeSidebar.addColorStop(0.55, NOIR);
    degradeSidebar.addColorStop(1, NOIR);
    ctx.fillStyle = degradeSidebar;
    ctx.fillRect(0, px(yColDebut), px(SIDEBAR_MM), px(hColonnes));

    dessinerCouvrant(photoHero, 0, yColDebut, SIDEBAR_MM, hPhotoHero);
    const degradePhoto = ctx.createLinearGradient(0, px(yColDebut), 0, px(yColDebut + hPhotoHero));
    degradePhoto.addColorStop(0, 'rgba(13,10,8,.55)');
    degradePhoto.addColorStop(0.3, 'rgba(13,10,8,0)');
    degradePhoto.addColorStop(0.62, 'rgba(13,10,8,0)');
    degradePhoto.addColorStop(1, 'rgba(13,10,8,.6)');
    ctx.fillStyle = degradePhoto;
    ctx.fillRect(0, px(yColDebut), px(SIDEBAR_MM), px(hPhotoHero));
    if (logo) {
      const hLogoMm = 6.5, wLogoMm = hLogoMm * (logo.largeur / logo.hauteur);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = px(1);
      ctx.drawImage(logo.canvas, px(4), px(yColDebut + 4), px(wLogoMm), px(hLogoMm));
      ctx.restore();
    }

    let y = yColDebut + hPhotoHero + 8;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = OR;
    ctx.font = `400 ${fpx(6.2)}px Jost, sans-serif`;
    ctx.fillText('F O R M E R   ·   R É V É L E R   ·   V A L O R I S E R', px(SIDEBAR_MM / 2), px(y));
    y += 6;

    ctx.textAlign = 'left';
    ctx.fillStyle = IVOIRE;
    const lignesNom = envelopperLignesCanvas(ctx, d.nomComplet || '', px(SIDEBAR_MM - PAD_SIDEBAR * 2), `600 ${fpx(16)}px "Cormorant Garamond", serif`);
    ctx.font = `600 ${fpx(16)}px "Cormorant Garamond", serif`;
    lignesNom.forEach(function (ligne) { y += 7.5; ctx.fillText(ligne, px(PAD_SIDEBAR), px(y)); });
    y += 6;

    ctx.strokeStyle = BORDEAUX2; ctx.lineWidth = px(0.35);
    ctx.beginPath(); ctx.moveTo(px(PAD_SIDEBAR), px(y)); ctx.lineTo(px(SIDEBAR_MM - PAD_SIDEBAR), px(y)); ctx.stroke();
    y += 6;

    const infosCv = [
      ['calendar', 'Date de naissance', [formaterPeriode(d.dateNaissance)]],
      ['pin', 'Lieu de naissance', [[d.villeNaissance, d.lieuNaissance].filter(Boolean).join(', ') || '—']],
      ['globe', 'Nationalité', [d.nationalite || '—']],
      ['home', 'Ville de résidence', [[d.ville, d.quartier].filter(Boolean).join(', ') || '—']],
      ['phone', 'Contact agence', MA2M_TELEPHONES.concat(MA2M_EMAIL)]
    ];
    infosCv.forEach(function (ligne) {
      dessinerIconeMcvCanvas(ctx, ligne[0], px(PAD_SIDEBAR), px(y - 3.2), px(4.2), OR);
      ctx.fillStyle = 'rgba(244,240,234,.55)';
      ctx.font = `400 ${fpx(6.6)}px Jost, sans-serif`;
      ctx.fillText(ligne[1].toUpperCase(), px(PAD_SIDEBAR + 6.5), px(y));
      y += 4;
      ctx.fillStyle = IVOIRE;
      ligne[2].forEach(function (valeur) {
        const lignesVal = envelopperLignesCanvas(ctx, valeur, px(SIDEBAR_MM - PAD_SIDEBAR * 2 - 6.5), `400 ${fpx(9.5)}px Jost, sans-serif`);
        lignesVal.forEach(function (l) { ctx.fillText(l, px(PAD_SIDEBAR + 6.5), px(y)); y += 4.2; });
      });
      y += 4;
    });

    y += 4;
    ctx.strokeStyle = 'rgba(244,237,225,.14)'; ctx.lineWidth = px(0.3);
    ctx.beginPath(); ctx.moveTo(px(PAD_SIDEBAR), px(y)); ctx.lineTo(px(SIDEBAR_MM - PAD_SIDEBAR), px(y)); ctx.stroke();
    y += 5;
    ctx.fillStyle = 'rgba(244,240,234,.55)';
    ctx.font = `400 ${fpx(6.6)}px Jost, sans-serif`;
    ctx.fillText('CATÉGORIE', px(PAD_SIDEBAR), px(y));
    y += 5;
    ctx.fillStyle = IVOIRE;
    ctx.font = `500 ${fpx(11)}px Jost, sans-serif`;
    ctx.fillText(d.niveauMannequin ? libelleNiveauPublic(d.niveauMannequin) : '—', px(PAD_SIDEBAR), px(y));

    if (d.citation) {
      y += 6;
      ctx.strokeStyle = 'rgba(244,237,225,.1)'; ctx.lineWidth = px(0.3);
      ctx.beginPath(); ctx.moveTo(px(PAD_SIDEBAR), px(y)); ctx.lineTo(px(SIDEBAR_MM - PAD_SIDEBAR), px(y)); ctx.stroke();
      y += 6;
      ctx.fillStyle = '#e8e0d2';
      const lignesCitation = envelopperLignesCanvas(ctx, '« ' + d.citation + ' »', px(SIDEBAR_MM - PAD_SIDEBAR * 2), `italic 400 ${fpx(11)}px "Cormorant Garamond", serif`);
      lignesCitation.forEach(function (l) { ctx.fillText(l, px(PAD_SIDEBAR), px(y)); y += 5.5; });
    }
    const finSidebar = y - yColDebut;

    if (logo) {
      const hLogoBasMm = 7, wLogoBasMm = hLogoBasMm * (logo.largeur / logo.hauteur);
      ctx.save(); ctx.globalAlpha = 0.9;
      ctx.drawImage(logo.canvas, px(SIDEBAR_MM / 2 - wLogoBasMm / 2), px(yColDebut + hColonnes - hLogoBasMm - 8), px(wLogoBasMm), px(hLogoBasMm));
      ctx.restore();
    }

    // ============== COLONNE DROITE (contenu clair) ==============
    ctx.fillStyle = IVOIRE;
    ctx.fillRect(px(SIDEBAR_MM), px(yColDebut), px(MAIN_MM), px(hColonnes));

    const xMain = SIDEBAR_MM + PAD_MAIN, lMain = MAIN_MM - PAD_MAIN * 2;
    let ym = yColDebut + PAD_MAIN;
    ctx.textAlign = 'right'; ctx.fillStyle = TEXTE_GRIS_CLAIR;
    ctx.font = `400 ${fpx(6.8)}px Jost, sans-serif`;
    ctx.fillText('M O D E L   C V', px(SIDEBAR_MM + MAIN_MM - PAD_MAIN), px(ym));
    ym += 6;

    function titreSection(icone, libelle) {
      dessinerIconeMcvCanvas(ctx, icone, px(xMain), px(ym - 3.2), px(4.4), BORDEAUX2);
      ctx.textAlign = 'left'; ctx.fillStyle = TEXTE_SOMBRE;
      ctx.font = `600 ${fpx(8.4)}px Jost, sans-serif`;
      ctx.fillText(libelle.toUpperCase(), px(xMain + 6.5), px(ym));
      ctx.strokeStyle = TRAIT; ctx.lineWidth = px(0.3);
      const largeurTexte = ctx.measureText(libelle.toUpperCase()).width / ESCALE;
      ctx.beginPath(); ctx.moveTo(px(xMain + 6.5 + largeurTexte + 1.5), px(ym - 1.5)); ctx.lineTo(px(xMain + lMain), px(ym - 1.5)); ctx.stroke();
      ym += 6;
    }

    // --- Profil ---
    titreSection('user', 'Profil');
    ctx.fillStyle = TEXTE_GRIS_CLAIR;
    envelopperLignesCanvas(ctx, d.bio || 'Profil à compléter.', px(lMain), `italic 400 ${fpx(10.5)}px Jost, sans-serif`).forEach(function (l) {
      ctx.fillText(l, px(xMain), px(ym)); ym += 5.2;
    });
    ym += 4;

    // --- Informations physiques ---
    titreSection('body', 'Informations physiques');
    const colInfosPhysiques = [
      [['Taille', p.taille ? p.taille + ' cm' : '—'], ['Poids', p.poids ? p.poids + ' kg' : '—'],
       ['Mensurations', texteMensurationsCv(p, d.sexe)],
       ['Pointure', p.pointure || '—']],
      [['Taille vêtements', p.tailleVet || '—'], ['Couleur des yeux', p.yeux || '—'], ['Couleur des cheveux', p.cheveux || '—'], ['Carnation', p.carnation || '—']]
    ];
    const yInfosDebut = ym;
    const largeurColMm = (lMain - 5) / 2;
    colInfosPhysiques.forEach(function (col, iCol) {
      let yc = yInfosDebut;
      const xcMm = xMain + iCol * (largeurColMm + 5);
      col.forEach(function (ligne) {
        ctx.strokeStyle = TRAIT; ctx.lineWidth = px(0.25);
        ctx.beginPath(); ctx.moveTo(px(xcMm), px(yc + 2)); ctx.lineTo(px(xcMm + largeurColMm), px(yc + 2)); ctx.stroke();
        ctx.textAlign = 'left'; ctx.fillStyle = TEXTE_GRIS;
        ctx.font = `400 ${fpx(8.2)}px Jost, sans-serif`;
        ctx.fillText(ligne[0], px(xcMm), px(yc));
        ctx.textAlign = 'right'; ctx.fillStyle = TEXTE_SOMBRE;
        ctx.font = `500 ${fpx(8.6)}px Jost, sans-serif`;
        ctx.fillText(String(ligne[1]), px(xcMm + largeurColMm), px(yc));
        yc += 7;
      });
    });
    ym = yInfosDebut + 4 * 7 + 6;

    // --- Formation ---
    titreSection('grad', 'Formation');
    ctx.textAlign = 'left';
    [['Niveau d’étude', f.niveau || '—'], ['Établissement', f.etablissement || '—'], ['Formation particulière', f.particuliere || 'Aucune'], ['Formation mannequin', f.mannequin || '—']].forEach(function (ligne) {
      ctx.strokeStyle = TRAIT; ctx.lineWidth = px(0.25);
      ctx.beginPath(); ctx.moveTo(px(xMain), px(ym + 2)); ctx.lineTo(px(xMain + lMain), px(ym + 2)); ctx.stroke();
      ctx.fillStyle = TEXTE_GRIS; ctx.font = `400 ${fpx(8.2)}px Jost, sans-serif`;
      ctx.fillText(ligne[0], px(xMain), px(ym));
      ctx.textAlign = 'right'; ctx.fillStyle = TEXTE_SOMBRE; ctx.font = `500 ${fpx(8.6)}px Jost, sans-serif`;
      ctx.fillText(String(ligne[1]), px(xMain + lMain), px(ym));
      ctx.textAlign = 'left';
      ym += 7;
    });
    ym += 4;

    // --- Expérience professionnelle (autant de lignes que nécessaire) ---
    titreSection('star', 'Expérience professionnelle');
    if (groupes.length) {
      groupes.forEach(function (g) {
        ctx.fillStyle = TEXTE_SOMBRE; ctx.font = `600 ${fpx(7.6)}px Jost, sans-serif`;
        ctx.fillText(g.label.toUpperCase(), px(xMain), px(ym));
        ym += 5;
        g.items.forEach(function (item) {
          ctx.fillStyle = BORDEAUX2;
          ctx.beginPath(); ctx.arc(px(xMain + 1), px(ym - 1.6), px(0.55), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = TEXTE_SOMBRE;
          envelopperLignesCanvas(ctx, item, px(lMain - 3.5), `400 ${fpx(8.4)}px Jost, sans-serif`).forEach(function (l) {
            ctx.fillText(l, px(xMain + 3.5), px(ym)); ym += 4.6;
          });
          ym += 0.6;
        });
        ym += 1.5;
      });
    } else {
      ctx.fillStyle = TEXTE_GRIS_CLAIR; ctx.font = `italic 400 ${fpx(8.4)}px Jost, sans-serif`;
      ctx.fillText('Aucune expérience renseignée pour le moment.', px(xMain), px(ym));
      ym += 6;
    }
    ym += 4;

    // --- Compétences : deux colonnes ---
    titreSection('medal', 'Compétences mannequin');
    const nbGauche = Math.ceil(ORDRE_COMPETENCES.length / 2);
    const largeurColSkills = (lMain - 8) / 2;
    const ySkillsDebut = ym;
    ORDRE_COMPETENCES.forEach(function (cle, i) {
      const pct = (((d.competences || {})[cle] || 3) / 5);
      const iCol = i < nbGauche ? 0 : 1;
      const xs = xMain + iCol * (largeurColSkills + 8);
      const ys = ySkillsDebut + (i - iCol * nbGauche) * 7;
      ctx.textAlign = 'left'; ctx.fillStyle = TEXTE_SOMBRE; ctx.font = `400 ${fpx(7.6)}px Jost, sans-serif`;
      ctx.fillText(LIBELLES_COMPETENCES[cle], px(xs), px(ys));
      const yBarre = ys + 1.5, lBarre = largeurColSkills, hBarre = 1.4;
      ctx.fillStyle = '#e3d9c4';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px(xs), px(yBarre), px(lBarre), px(hBarre), px(0.7)) : ctx.rect(px(xs), px(yBarre), px(lBarre), px(hBarre));
      ctx.fill();
      const degradeBarre = ctx.createLinearGradient(px(xs), 0, px(xs + lBarre * pct), 0);
      degradeBarre.addColorStop(0, BORDEAUX2); degradeBarre.addColorStop(1, OR);
      ctx.fillStyle = degradeBarre;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px(xs), px(yBarre), px(lBarre * pct), px(hBarre), px(0.7)) : ctx.rect(px(xs), px(yBarre), px(lBarre * pct), px(hBarre));
      ctx.fill();
    });
    ym = ySkillsDebut + nbGauche * 7 + 4;

    // --- Portfolio : une rangée de photos (5 emplacements), tout en bas ---
    if (photosPresentes.length) {
      titreSection('image', 'Portfolio');
      const ecart = 2, lPhoto = (lMain - ecart * 4) / 5, hPhoto = lPhoto * 4 / 3;
      const lRangee = photosPresentes.length * lPhoto + (photosPresentes.length - 1) * ecart;
      const xRangee = xMain + (lMain - lRangee) / 2;
      photosPresentes.forEach(function (photo, i) {
        dessinerCouvrant(photo, xRangee + i * (lPhoto + ecart), ym - 1, lPhoto, hPhoto);
      });
      ym += hPhoto + 6;
    }

    // --- En ligne : Instagram + lien vers la fiche publique + QR code ---
    titreSection('link', 'En ligne');
    const tailleQr = 24;
    const xQr = xMain + lMain - tailleQr;
    const yBlocLiens = ym - 2;
    let yl = ym + 3;
    ctx.textAlign = 'left';
    if (handle) {
      dessinerIconeMcvCanvas(ctx, 'insta', px(xMain), px(yl - 3.3), px(4.2), BORDEAUX2);
      ctx.fillStyle = TEXTE_GRIS; ctx.font = `400 ${fpx(6.6)}px Jost, sans-serif`;
      ctx.fillText('INSTAGRAM', px(xMain + 6.5), px(yl - 0.2));
      ctx.fillStyle = TEXTE_SOMBRE; ctx.font = `500 ${fpx(9)}px Jost, sans-serif`;
      ctx.fillText('@' + handle, px(xMain + 6.5), px(yl + 4.2));
      zonesLiens.push({ x: xMain, y: yl - 4, l: 70, h: 10, url: 'https://www.instagram.com/' + encodeURIComponent(handle) });
      yl += 12;
    }
    dessinerIconeMcvCanvas(ctx, 'link', px(xMain), px(yl - 3.3), px(4.2), BORDEAUX2);
    ctx.fillStyle = TEXTE_GRIS; ctx.font = `400 ${fpx(6.6)}px Jost, sans-serif`;
    ctx.fillText('FICHE EN LIGNE', px(xMain + 6.5), px(yl - 0.2));
    ctx.fillStyle = BORDEAUX2; ctx.font = `500 ${fpx(9)}px Jost, sans-serif`;
    ctx.fillText('maitreakessemodelmanagement.com', px(xMain + 6.5), px(yl + 4.2));
    zonesLiens.push({ x: xMain, y: yl - 4, l: 80, h: 10, url: lienFichePublique });
    yl += 10;

    if (dessinerQrCanvas(ctx, lienFichePublique, px(xQr), px(yBlocLiens), px(tailleQr), '#241a12')) {
      ctx.strokeStyle = TRAIT; ctx.lineWidth = px(0.25);
      ctx.strokeRect(px(xQr), px(yBlocLiens), px(tailleQr), px(tailleQr));
      ctx.textAlign = 'center'; ctx.fillStyle = TEXTE_GRIS; ctx.font = `400 ${fpx(6)}px Jost, sans-serif`;
      ctx.fillText('Scannez pour ouvrir la fiche', px(xQr + tailleQr / 2), px(yBlocLiens + tailleQr + 3.8));
      zonesLiens.push({ x: xQr, y: yBlocLiens, l: tailleQr, h: tailleQr, url: lienFichePublique });
      yl = Math.max(yl, yBlocLiens + tailleQr + 4);
    }
    ym = yl + PAD_MAIN;

    return { finSidebar: finSidebar, finMain: ym - yColDebut, zonesLiens: zonesLiens };
  }

  // Passe 1 : dessin « à blanc » pour connaître la hauteur réelle de chaque colonne.
  const essai = document.createElement('canvas');
  essai.width = 1; essai.height = 1;
  const fins = dessinerTout(essai.getContext('2d'), 297);
  const hColonnes = Math.max(fins.finSidebar + RESERVE_LOGO_BAS, fins.finMain);

  // Passe 2 : dessin réel, à la hauteur exacte.
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(px(LARGEUR_MM));
  canvas.height = Math.round(px(hBanniere + hColonnes));
  const resultat = dessinerTout(canvas.getContext('2d'), hColonnes);
  canvas.zonesLiens = resultat.zonesLiens;
  return canvas;
}

// Génère et télécharge le CV (PDF ou JPEG) d'un mannequin à partir de son objet de
// données (même format que celui attendu par construireHtmlCv()) — dessiné directement
// sur canvas (construireCanvasCv), jamais une "photographie" de la page, pour un rendu
// fidèle garanti quel que soit l'appareil.
async function genererCvFichier(format, donneesCv, idBtnPdf, idBtnJpeg) {
  if (!donneesCv) return;
  const btnPdf = idBtnPdf ? document.getElementById(idBtnPdf) : null;
  const btnJpeg = idBtnJpeg ? document.getElementById(idBtnJpeg) : null;
  const btnActif = format === 'jpeg' ? btnJpeg : btnPdf;
  const texteOriginal = btnActif ? btnActif.textContent : '';
  if (btnPdf) btnPdf.disabled = true;
  if (btnJpeg) btnJpeg.disabled = true;
  if (btnActif) btnActif.textContent = 'Génération…';

  try {
    if (format !== 'jpeg') await chargerJsPdf();
    const canvas = await construireCanvasCv(donneesCv);
    const nomFichier = 'cv-' + (donneesCv.nomComplet || 'mannequin').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase() + horodatageFichier();

    if (format === 'jpeg') {
      const lien = document.createElement('a');
      lien.href = canvas.toDataURL('image/jpeg', 0.95);
      lien.download = nomFichier + '.jpg';
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
    } else {
      const { jsPDF } = window.jspdf;
      const largeurMm = 210;
      const hauteurMm = largeurMm * canvas.height / canvas.width;
      const doc = new jsPDF({ unit: 'mm', format: [largeurMm, hauteurMm] });
      doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, largeurMm, hauteurMm);
      // Lien vers la fiche, Instagram et QR code cliquables dans le PDF (mêmes mm que le canvas).
      (canvas.zonesLiens || []).forEach(function (z) { doc.link(z.x, z.y, z.l, z.h, { url: z.url }); });
      doc.save(nomFichier + '.pdf');
    }
  } catch (e) {
    signalerProbleme('Génération de fichier échouée', (e && e.message) || String(e), e && e.stack);
    alert('Une erreur est survenue pendant la génération du fichier. Réessayez.');
  } finally {
    if (btnPdf) btnPdf.disabled = false;
    if (btnJpeg) btnJpeg.disabled = false;
    if (btnActif) btnActif.textContent = texteOriginal;
  }
}

// Nettoie un nom de fichier avant de l'utiliser dans un chemin de stockage (Supabase Storage) :
// ne garde que lettres/chiffres/point/tiret/underscore, pour éviter qu'un nom de fichier
// bricolé ne perturbe le chemin de stockage ou son affichage ailleurs sur le site.
function nomFichierSur(nom) {
  if (!nom) return 'fichier';
  try { nom = nom.normalize('NFKD'); } catch (e) {}
  return nom.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'fichier';
}

// ================== Images du site (actualités/événements/partenaires) sur
// Cloudflare R2, via api/r2-site-images.js — remplace l'envoi direct vers
// Supabase Storage, dont le quota gratuit de bande passante était dépassé
// (voir README-TECHNIQUE.md, diagnostic du 28 septembre 2026). Même
// principe de nouvelle tentative (3 essais) que uploaderVersR2() dans
// espace-mannequin.html/tableau-de-bord.html pour les photos du Book. ==================
// progression (facultatif) : fonction appelée avec la part envoyée (0 à 1) — utile pour les
// longues vidéos de l'accueil (plusieurs dizaines de Mo, 06/10/2026).
function envoyerAvecProgression(url, fichier, progression) {
  return new Promise((ok, ko) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', fichier.type || 'image/jpeg');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) progression(e.loaded / e.total); };
    xhr.onload = () => ok({ ok: xhr.status >= 200 && xhr.status < 300 });
    xhr.onerror = () => ko(new Error("Échec de l'envoi du fichier (connexion)."));
    xhr.send(fichier);
  });
}
async function envoyerImageSite(categorie, chemin, fichier, progression) {
  const { data: { session } } = await sbAdmin.auth.getSession();
  if (!session) throw new Error('Session expirée — reconnectez-vous.');
  let derniereErreur;
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const reponsePresign = await fetch('/api/r2-site-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
        body: JSON.stringify({ categorie, chemin, contentType: fichier.type || 'image/jpeg', taille: fichier.size })
      });
      const resultat = await reponsePresign.json().catch(() => ({}));
      if (!reponsePresign.ok) throw new Error(resultat.error || "Échec de la préparation de l'envoi.");
      const reponseUpload = progression
        ? await envoyerAvecProgression(resultat.uploadUrl, fichier, progression)
        : await fetch(resultat.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': fichier.type || 'image/jpeg' },
          body: fichier
        });
      if (!reponseUpload.ok) throw new Error("Échec de l'envoi du fichier.");
      return resultat.publicUrl;
    } catch (e) {
      derniereErreur = e;
      if (essai < 3) await new Promise(r => setTimeout(r, 700 * essai));
    }
  }
  throw derniereErreur;
}

async function supprimerImageSite(categorie, chemin) {
  if (!chemin) return;
  try {
    const { data: { session } } = await sbAdmin.auth.getSession();
    if (!session) return;
    await fetch('/api/r2-site-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ action: 'suppression', categorie, chemin })
    });
  } catch (e) {}
}

// Pendant la période de transition, certaines lignes ont encore leur
// ancienne image chez Supabase Storage (chemin sans préfixe "site/"),
// pendant que les nouvelles passent déjà par R2 — trie et supprime au
// bon endroit selon le cas, sans que chaque page ait à s'en soucier.
async function supprimerCheminsImagesSite(categorie, bucketSupabase, chemins) {
  const versR2 = [];
  const versSupabase = [];
  (chemins || []).filter(Boolean).forEach(c => (c.startsWith('site/' + categorie + '/') ? versR2 : versSupabase).push(c));
  await Promise.all(versR2.map(c => supprimerImageSite(categorie, c)));
  if (versSupabase.length) await sbAdmin.storage.from(bucketSupabase).remove(versSupabase);
}

// ================== Texte enrichi (actualités, événements, partenaires) ==================
// Les champs "commentaire"/"description" étaient de simples <textarea> : un mannequin
// pouvait coller un texte mis en forme dans Word (gras, titres, paragraphes), mais un
// <textarea> ne peut physiquement contenir QUE du texte brut — toute la mise en forme
// disparaissait déjà au moment du copier-coller, avant même l'enregistrement. Ces
// champs utilisent désormais un éditeur enrichi (Quill), qui enregistre du HTML.
// Ces fonctions permettent d'afficher correctement À LA FOIS ce nouveau contenu ET les
// anciens textes bruts déjà enregistrés (en leur redonnant au moins leurs paragraphes et
// retours à la ligne, la seule chose qu'un ancien <textarea> pouvait préserver).

function texteEstDejaHtml(texte) {
  return /<[a-z][\s\S]*>/i.test(String(texte || ''));
}

// Ancien texte brut → paragraphes HTML équivalents (une ligne vide = nouveau paragraphe).
function convertirTexteBrutEnHtml(texte) {
  const paragraphes = String(texte || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (!paragraphes.length) return '';
  return paragraphes.map(p => '<p>' + echapperHtml(p).replace(/\n/g, '<br>') + '</p>').join('');
}

// Liste blanche volontairement réduite : assez pour une "belle mise en page" (gras,
// italique, titres, listes, citation, paragraphes) sans jamais autoriser de script ou
// d'attribut dangereux, même si la source du texte est un admin — défense en profondeur.
const CONTENU_RICHE_BALISES_AUTORISEES = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a'];
const CONTENU_RICHE_ATTRIBUTS_AUTORISES = ['href', 'target', 'rel', 'class', 'data-list'];
// Seules classes conservées : alignement (centré, à droite, justifié) et retrait des
// listes imbriquées, telles que l'éditeur les pose — tout le reste est retiré.
const CONTENU_RICHE_CLASSES_AUTORISEES = /^ql-(align-(center|right|justify)|indent-[1-8])$/;

// Quill 2 enregistre TOUTES les listes dans un seul <ol>, le type réel étant porté par
// chaque <li data-list="bullet|ordered"> (sa propre feuille de style fait la
// différence). Sur les pages publiques, sans cette feuille, une liste à puces
// s'affichait donc numérotée, et deux listes qui se suivent étaient fusionnées. On
// reconstruit ici de vrais <ul>/<ol>, et on retire les pastilles internes de Quill.
function normaliserListesQuill(racine) {
  racine.querySelectorAll('.ql-ui').forEach(el => el.remove());
  racine.querySelectorAll('ol, ul').forEach(liste => {
    const items = Array.from(liste.children).filter(li => li.tagName === 'LI' && li.hasAttribute('data-list'));
    if (!items.length) return;
    const parent = liste.parentNode;
    let courant = null;
    let typeCourant = '';
    Array.from(liste.children).forEach(li => {
      const type = li.getAttribute('data-list') === 'bullet' ? 'ul' : 'ol';
      if (!courant || type !== typeCourant) {
        courant = document.createElement(type);
        typeCourant = type;
        parent.insertBefore(courant, liste);
      }
      li.removeAttribute('data-list');
      courant.appendChild(li);
    });
    liste.remove();
  });
}

// Rend un contenu (nouveau HTML ou ancien texte brut) prêt à être injecté avec
// .innerHTML : convertit l'ancien texte brut en paragraphes puis nettoie systématiquement
// via DOMPurify (si la bibliothèque a pu charger ; repli sur du texte échappé sinon).
function rendreContenuRiche(texte) {
  const html = texteEstDejaHtml(texte) ? String(texte) : convertirTexteBrutEnHtml(texte);
  if (!html) return '';
  if (typeof DOMPurify === 'undefined') return echapperHtml(texte || '').replace(/\n/g, '<br>');
  const propre = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: CONTENU_RICHE_BALISES_AUTORISEES,
    ALLOWED_ATTR: CONTENU_RICHE_ATTRIBUTS_AUTORISES,
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true
  });
  propre.querySelectorAll('[class]').forEach(el => {
    const gardees = el.className.split(/\s+/).filter(c => CONTENU_RICHE_CLASSES_AUTORISEES.test(c));
    if (gardees.length) el.className = gardees.join(' ');
    else el.removeAttribute('class');
  });
  const conteneur = document.createElement('div');
  conteneur.appendChild(propre);
  normaliserListesQuill(conteneur);
  return conteneur.innerHTML;
}

// Version texte brut (pour les extraits de carte, tronqués à N caractères) : dépouille
// tout le HTML éventuel pour ne garder que le texte lisible.
function texteBrutDepuis(texte) {
  if (!texte) return '';
  if (!texteEstDejaHtml(texte)) return String(texte);
  const conteneur = document.createElement('div');
  // Un espace après chaque bloc (paragraphe, titre, puce) : sinon "Puce un" et
  // "Puce deux" se retrouvaient collés ("Puce unPuce deux") dans l'extrait.
  const avecEspaces = String(texte).replace(/<\/(p|h[1-6]|li|blockquote)>/gi, '$& ');
  conteneur.innerHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(avecEspaces) : '';
  return (conteneur.textContent || conteneur.innerText || '').replace(/\s+/g, ' ').trim();
}

// Crée un éditeur de texte enrichi (Quill) dans le conteneur donné — barre d'outils
// volontairement réduite (gras/italique/souligné, titres, listes, citation) : de quoi
// reproduire une mise en page Word sans complexité inutile. Le collage d'un texte déjà
// mis en forme (Word, Claude…) est automatiquement nettoyé par Quill (styles Office
// superflus retirés, structure — gras/italique/titres/paragraphes — conservée).
// Renvoie null si la bibliothèque n'a pas pu charger (CDN indisponible) plutôt que de
// planter la page — le conteneur reste alors simplement vide.
// Repli utilisé quand Quill ne peut pas s'afficher correctement (script indisponible,
// ou chargé sans sa feuille de style — voir plus bas) : une simple zone de texte, pour
// que l'admin puisse toujours écrire quelque chose plutôt que de se retrouver sans
// aucun moyen de saisir son commentaire/sa description. Expose la même interface
// minimale que Quill (getText/setText/root.innerHTML) pour rester compatible avec
// lireContenuEditeur/chargerContenuDansEditeur sans les modifier.
function creerRepliEditeur(conteneur, placeholder) {
  conteneur.innerHTML = '';
  const zone = document.createElement('textarea');
  zone.rows = 8;
  zone.placeholder = placeholder || 'Écrivez ici…';
  conteneur.appendChild(zone);
  return {
    getText: () => zone.value,
    setText: (t) => { zone.value = t || ''; },
    root: {
      get innerHTML() { return convertirTexteBrutEnHtml(zone.value); },
      set innerHTML(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = String(html || '');
        zone.value = tmp.textContent || tmp.innerText || '';
      }
    }
  };
}

// Collage depuis Word, Google Docs, Claude… : beaucoup de mises en forme y sont
// écrites en style ("font-weight:700", "text-align:center"…). Or la sécurité du site
// (CSP, qui interdit les styles écrits dans le HTML) empêche le navigateur de lire ces
// styles pendant le collage : Quill perdait alors le gras, l'italique, le souligné et
// le centrage. On relit donc ici le texte brut de l'attribut "style" pour retrouver
// ces mises en forme, sans jamais appliquer le style lui-même.
function lireStyleBrut(node, propriete) {
  const brut = node.getAttribute && node.getAttribute('style');
  if (!brut) return '';
  const m = brut.match(new RegExp('(?:^|;)\\s*' + propriete + '\\s*:\\s*([^;]+)', 'i'));
  return m ? m[1].trim().toLowerCase() : '';
}

function ajouterLectureStylesCollage(quill) {
  if (!quill || !quill.clipboard || typeof Quill === 'undefined') return;
  const Delta = Quill.import('delta');
  const BLOCS = /^(P|DIV|H[1-6]|LI|BLOCKQUOTE)$/;
  quill.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
    const inline = {};
    const poids = lireStyleBrut(node, 'font-weight');
    if (poids === 'bold' || poids === 'bolder' || parseInt(poids, 10) >= 600) inline.bold = true;
    if (lireStyleBrut(node, 'font-style') === 'italic') inline.italic = true;
    const deco = lireStyleBrut(node, 'text-decoration') + ' ' + lireStyleBrut(node, 'text-decoration-line');
    if (/underline/.test(deco)) inline.underline = true;
    if (/line-through/.test(deco)) inline.strike = true;
    const vertical = lireStyleBrut(node, 'vertical-align');
    if (vertical === 'super') inline.script = 'super';
    else if (vertical === 'sub') inline.script = 'sub';
    let alignement = lireStyleBrut(node, 'text-align') || (node.getAttribute('align') || '').toLowerCase();
    if (!/^(center|right|justify)$/.test(alignement) || !BLOCS.test(node.tagName)) alignement = '';
    if (!Object.keys(inline).length && !alignement) return delta;
    const resultat = new Delta();
    delta.ops.forEach(op => {
      if (typeof op.insert !== 'string') { resultat.push(op); return; }
      op.insert.split(/(\n)/).forEach(morceau => {
        if (!morceau) return;
        if (morceau === '\n') {
          const attrs = Object.assign({}, op.attributes);
          if (alignement && attrs.align === undefined) attrs.align = alignement;
          resultat.insert('\n', Object.keys(attrs).length ? attrs : undefined);
        } else {
          const attrs = Object.assign({}, inline, op.attributes);
          resultat.insert(morceau, Object.keys(attrs).length ? attrs : undefined);
        }
      });
    });
    return resultat;
  });
}

// Texte copié depuis l'application Claude (bouton « Copier ») ou un autre outil qui
// écrit en « Markdown » : la mise en forme y est notée avec des symboles (**gras**,
// *italique*, « ## » pour un titre, « - » pour une puce) et le presse-papiers ne
// contient que ce texte brut, sans aucune mise en forme. Sans conversion, ces
// symboles apparaissaient tels quels ou la mise en page était perdue. On reconnaît ce
// format et on le transforme en vraie mise en forme au moment du collage.
function ressembleMarkdown(texte) {
  return /(^|\n)[ \t]{0,3}(#{1,6}[ \t]|[-*+][ \t]|\d+[.)][ \t]|>)|\*\*[^*\n]+\*\*|__[^_\n]+__|(^|[\s(])\*[^*\s][^*\n]*\*|~~[^~\n]+~~|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)/.test(texte);
}

function markdownEnLigneVersHtml(texte) {
  let t = echapperHtml(texte);
  t = t.replace(/`([^`\n]+)`/g, '$1');
  t = t.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/(\*\*\*|___)(?=\S)([^\n]*?\S)\1/g, '<strong><em>$2</em></strong>');
  t = t.replace(/(\*\*|__)(?=\S)([^\n]*?\S)\1/g, '<strong>$2</strong>');
  t = t.replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*(?!\*)/g, '$1<em>$2</em>');
  t = t.replace(/(^|[^_\w])_(?=\S)([^_\n]*?\S)_(?![_\w])/g, '$1<em>$2</em>');
  t = t.replace(/~~(?=\S)([^~\n]*?\S)~~/g, '<s>$1</s>');
  return t;
}

function markdownVersHtml(texte) {
  const lignes = String(texte || '').replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let liste = '';
  const fermerListe = () => { if (liste) { html.push('</' + liste + '>'); liste = ''; } };
  lignes.forEach(ligne => {
    const brute = ligne.trim();
    let m;
    if (!brute || /^([-*_])(\s*\1){2,}$/.test(brute)) { fermerListe(); return; }
    if ((m = brute.match(/^(#{1,6})\s+(.*?)\s*#*$/))) {
      fermerListe();
      const niveau = Math.min(m[1].length, 3);
      html.push('<h' + niveau + '>' + markdownEnLigneVersHtml(m[2]) + '</h' + niveau + '>');
    } else if ((m = brute.match(/^[-*+•]\s+(.*)$/)) || (m = brute.match(/^\d+[.)]\s+(.*)$/))) {
      const type = /^\d/.test(brute) ? 'ol' : 'ul';
      if (liste !== type) { fermerListe(); html.push('<' + type + '>'); liste = type; }
      html.push('<li>' + markdownEnLigneVersHtml(m[1]) + '</li>');
    } else if ((m = brute.match(/^>\s?(.*)$/))) {
      fermerListe();
      html.push('<blockquote>' + markdownEnLigneVersHtml(m[1]) + '</blockquote>');
    } else {
      fermerListe();
      html.push('<p>' + markdownEnLigneVersHtml(brute) + '</p>');
    }
  });
  fermerListe();
  return html.join('');
}

function ajouterCollageMarkdown(quill) {
  if (!quill || !quill.root || !quill.clipboard) return;
  // Phase de capture : passe avant le gestionnaire de collage de Quill.
  quill.root.addEventListener('paste', (e) => {
    const donnees = e.clipboardData;
    if (!donnees) return;
    const html = donnees.getData('text/html') || '';
    const texte = donnees.getData('text/plain') || '';
    if (html.trim() || !texte.trim() || !ressembleMarkdown(texte)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const selection = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
    if (selection.length) quill.deleteText(selection.index, selection.length, 'user');
    const avant = quill.getLength();
    quill.clipboard.dangerouslyPasteHTML(selection.index, markdownVersHtml(texte), 'user');
    quill.setSelection(selection.index + (quill.getLength() - avant), 0, 'silent');
  }, true);
}

function creerEditeurRiche(idConteneur, placeholder) {
  const conteneur = document.getElementById(idConteneur);
  if (!conteneur) return null;
  if (typeof Quill === 'undefined') return creerRepliEditeur(conteneur, placeholder);
  const quill = new Quill(conteneur, {
    theme: 'snow',
    placeholder: placeholder || 'Écrivez ici… (vous pouvez coller un texte déjà mis en forme depuis Word)',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ header: [1, 2, 3, false] }],
        [{ align: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'link'],
        ['clean']
      ]
    }
  });
  ajouterLectureStylesCollage(quill);
  ajouterCollageMarkdown(quill);
  // Le script Quill peut charger sans sa feuille de style associée (CDN lent ou
  // partiellement indisponible sur le réseau du visiteur) : l'éditeur serait alors
  // fonctionnel mais complètement non stylé — en particulier, le menu déroulant des
  // titres (H2/H3) resterait déplié en permanence au lieu d'être masqué par défaut
  // (symptôme observé : gros triangles superposés, bien plus déroutant qu'un champ
  // simplement vide). "display:none" par défaut sur .ql-picker-options vient
  // uniquement de quill.snow.css — jamais de notre propre feuille — c'est donc un
  // signal fiable que la feuille de style a bien été appliquée.
  const barreOutils = conteneur.previousElementSibling;
  const optionsMenu = barreOutils ? barreOutils.querySelector('.ql-picker-options') : null;
  const stylesAppliques = optionsMenu && getComputedStyle(optionsMenu).display === 'none';
  if (!stylesAppliques) {
    if (barreOutils) barreOutils.remove();
    return creerRepliEditeur(conteneur, placeholder);
  }
  return quill;
}

// Charge un contenu existant (nouveau HTML ou ancien texte brut) dans un éditeur Quill —
// utilisé à l'ouverture du formulaire de modification d'une fiche déjà publiée.
function chargerContenuDansEditeur(quill, texte) {
  if (!quill) return;
  quill.root.innerHTML = texteEstDejaHtml(texte) ? String(texte) : convertirTexteBrutEnHtml(texte);
}

// Lit le HTML actuel d'un éditeur Quill, ou '' s'il est resté vide — Quill laisse
// toujours au moins "<p><br></p>" même sans saisie, il faut donc le détecter via le
// texte brut plutôt que de tester le HTML directement.
function lireContenuEditeur(quill) {
  if (!quill) return '';
  return quill.getText().trim() ? quill.root.innerHTML : '';
}

// ================== Effets sonores ==================
// Demande de la propriétaire (29/09/2026) : un son discret au clic sur
// « Entrer » (porte d'entrée de l'accueil), pour commencer. Le son est fabriqué par le
// navigateur (Web Audio) : aucun fichier à télécharger, rien qui ralentisse le site.
// Il ne se joue qu'après un geste du visiteur (les navigateurs l'imposent de toute
// façon) et jamais si le visiteur a coupé le son (clé ma2m_son_coupe).
window.jouerSon = function (nom) {
  try {
    if (localStorage.getItem('ma2m_son_coupe') === '1') return;
  } catch (e) {}
  try {
    const Contexte = window.AudioContext || window.webkitAudioContext;
    if (!Contexte) return;
    const ctx = window.__ma2mAudio || (window.__ma2mAudio = new Contexte());
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime + 0.02;
    const sortie = ctx.createGain();
    sortie.gain.value = 2.5;
    sortie.connect(ctx.destination);
    if (nom === 'entree') {
      // « Rideau » (choisi par la propriétaire parmi 5 essais) : souffle d'air filtré
      // qui monte puis retombe, comme un rideau de défilé qui s'ouvre (≈ 1,8 s).
      const taille = Math.floor(ctx.sampleRate * 2);
      const tampon = ctx.createBuffer(1, taille, ctx.sampleRate);
      const donnees = tampon.getChannelData(0);
      for (let i = 0; i < taille; i++) donnees[i] = Math.random() * 2 - 1;
      const souffle = ctx.createBufferSource();
      souffle.buffer = tampon;
      const filtre = ctx.createBiquadFilter();
      filtre.type = 'bandpass';
      filtre.Q.value = 0.8;
      filtre.frequency.setValueAtTime(300, t);
      filtre.frequency.exponentialRampToValueAtTime(3500, t + 0.9);
      filtre.frequency.exponentialRampToValueAtTime(1200, t + 1.8);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      souffle.connect(filtre); filtre.connect(gain); gain.connect(sortie);
      souffle.start(t); souffle.stop(t + 2);
    } else if (nom === 'menu') {
      // Souffle d'étoffe court, de la même famille que « Rideau » (≈ 0,4 s).
      const taille = Math.floor(ctx.sampleRate * 0.5);
      const tampon = ctx.createBuffer(1, taille, ctx.sampleRate);
      const donnees = tampon.getChannelData(0);
      for (let i = 0; i < taille; i++) donnees[i] = Math.random() * 2 - 1;
      const souffle = ctx.createBufferSource();
      souffle.buffer = tampon;
      const filtre = ctx.createBiquadFilter();
      filtre.type = 'bandpass';
      filtre.Q.value = 1;
      filtre.frequency.setValueAtTime(700, t);
      filtre.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      souffle.connect(filtre); filtre.connect(gain); gain.connect(sortie);
      souffle.start(t); souffle.stop(t + 0.45);
    } else if (nom === 'coeur') {
      // Petite note cristalline (mi aigu + son harmonique), ≈ 0,3 s.
      [[1318.5, 0.05, 0.35], [2637, 0.012, 0.2]].forEach(([frequence, volume, duree]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequence;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(volume, t + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
        osc.connect(gain); gain.connect(sortie);
        osc.start(t); osc.stop(t + duree + 0.05);
      });
    } else if (nom === 'envoi') {
      // « Bien reçu » : deux notes douces qui montent (sol puis do), ≈ 0,6 s.
      [[783.99, 0], [1046.5, 0.15]].forEach(([frequence, decalage]) => {
        const debut = t + decalage;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = frequence;
        gain.gain.setValueAtTime(0.0001, debut);
        gain.gain.exponentialRampToValueAtTime(0.06, debut + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, debut + 0.45);
        osc.connect(gain); gain.connect(sortie);
        osc.start(debut); osc.stop(debut + 0.5);
      });
    }
  } catch (e) {}
};

// Sur iPhone/iPad, le son n'est autorisé que s'il est « réveillé » pendant un geste
// du visiteur. Les formulaires jouent leur son après l'envoi (donc après ce geste) :
// on réveille le lecteur audio dès le clic sur « Envoyer », sans rien jouer.
document.addEventListener('submit', () => {
  try {
    if (localStorage.getItem('ma2m_son_coupe') === '1') return;
    const Contexte = window.AudioContext || window.webkitAudioContext;
    if (!Contexte) return;
    const ctx = window.__ma2mAudio || (window.__ma2mAudio = new Contexte());
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) {}
}, true);

// Libère la place réservée au bloc « À la une » (classe .une-reservee, voir
// css/style.css) dès qu'il est rempli, que le message « Aucune… » s'affiche, ou
// au bout de 12 s au plus tard (connexion coupée) : jamais de grand vide durable.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.une-reservee').forEach(zone => {
    const vide = zone.parentElement ? zone.parentElement.querySelector('[id$="-vide"]') : null;
    let observateur = null;
    let minuteur = null;
    function liberer() {
      zone.classList.remove('une-reservee');
      if (observateur) observateur.disconnect();
      clearTimeout(minuteur);
    }
    function verifier() {
      if (zone.children.length || (vide && getComputedStyle(vide).display !== 'none')) liberer();
    }
    minuteur = setTimeout(liberer, 12000);
    if (window.MutationObserver) {
      observateur = new MutationObserver(verifier);
      observateur.observe(zone, { childList: true });
      if (vide) observateur.observe(vide, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    verifier();
  });
});

// ================== Partage d'une actualité / d'un événement ==================
// Demande de la propriétaire (29/09/2026) : quand une fiche est ouverte, l'adresse
// du navigateur devient celle de CETTE fiche (?actu=ID ou ?evenement=ID), et des
// boutons Partager / WhatsApp / Copier le lien envoient ce lien précis. Collé dans
// WhatsApp, Facebook…, il affiche l'aperçu de la fiche (voir middleware.js).
// Appelé par les pages actualités/événements (FR et EN) à l'ouverture et à la
// fermeture de la fiche.
(function () {
  let ficheCourante = null;
  function anglais() { return (document.documentElement.lang || '').indexOf('en') === 0; }
  function remplacerAdresse(url) {
    try { history.replaceState(history.state, '', url.pathname + url.search + url.hash); } catch (e) {}
  }
  // Liens marqués (UTM, validé le 29/09) : Google Analytics indique ensuite d'où
  // viennent les visiteurs (WhatsApp, lien copié, partage du téléphone) et pour
  // quelle fiche. L'aperçu du lien (middleware.js) n'en est pas affecté.
  function lienFiche(source) {
    const url = new URL(location.origin + location.pathname);
    url.searchParams.set(ficheCourante.param, ficheCourante.id);
    if (source) {
      url.searchParams.set('utm_source', source);
      url.searchParams.set('utm_medium', 'partage');
      url.searchParams.set('utm_campaign', ficheCourante.param === 'evenement' ? 'evenement' : 'actualite');
    }
    return url.toString();
  }
  async function copierLien(lien, bouton) {
    let ok = false;
    try { await navigator.clipboard.writeText(lien); ok = true; } catch (e) {
      try {
        const zone = document.createElement('textarea');
        zone.value = lien; zone.setAttribute('readonly', ''); zone.style.position = 'fixed'; zone.style.opacity = '0';
        document.body.appendChild(zone); zone.select(); ok = document.execCommand('copy'); zone.remove();
      } catch (x) {}
    }
    const avant = bouton.textContent;
    bouton.textContent = ok ? (anglais() ? '✓ Link copied' : '✓ Lien copié') : (anglais() ? 'Copy failed' : 'Copie impossible');
    setTimeout(() => { bouton.textContent = avant; }, 2200);
  }
  async function clicPartage(e) {
    const bouton = e.target.closest('[data-partage]');
    if (!bouton || !ficheCourante) return;
    const titre = ficheCourante.titre;
    const action = bouton.dataset.partage;
    const lien = lienFiche(action === 'whatsapp' ? 'whatsapp' : action === 'partager' ? 'partage_telephone' : 'lien_copie');
    if (action === 'partager' && navigator.share) {
      try { await navigator.share({ title: titre, text: titre, url: lien }); } catch (x) {}
    } else if (action === 'whatsapp') {
      window.open('https://wa.me/?text=' + encodeURIComponent((titre ? titre + '\n' : '') + lien), '_blank', 'noopener');
    } else {
      copierLien(lien, bouton);
    }
  }
  window.ficheOuverte = function (param, id, titre) {
    try {
      if (!id) return;
      ficheCourante = { param: param, id: id, titre: titre || '' };
      const url = new URL(location.href);
      url.searchParams.set(param, id);
      remplacerAdresse(url);
      let barre = document.getElementById('news-modal-partage');
      if (!barre) {
        const texte = document.getElementById('news-modal-texte');
        if (!texte) return;
        const en = anglais();
        barre = document.createElement('div');
        barre.id = 'news-modal-partage';
        barre.className = 'fiche-partage';
        barre.innerHTML =
          (navigator.share ? '<button type="button" class="fiche-partage-btn" data-partage="partager">' + (en ? '↗ Share' : '↗ Partager') + '</button>' : '') +
          '<button type="button" class="fiche-partage-btn" data-partage="whatsapp">WhatsApp</button>' +
          '<button type="button" class="fiche-partage-btn" data-partage="copier">' + (en ? '🔗 Copy link' : '🔗 Copier le lien') + '</button>';
        texte.insertAdjacentElement('beforebegin', barre);
        barre.addEventListener('click', clicPartage);
      }
    } catch (e) {}
  };
  window.ficheFermee = function () {
    try {
      ficheCourante = null;
      const url = new URL(location.href);
      if (!url.searchParams.has('actu') && !url.searchParams.has('evenement')) return;
      url.searchParams.delete('actu');
      url.searchParams.delete('evenement');
      remplacerAdresse(url);
    } catch (e) {}
  };
})();

// Pastille WhatsApp flottante, injectée sur toutes les pages
document.addEventListener('DOMContentLoaded', () => {
  const bouton = document.createElement('a');
  bouton.href = 'https://wa.me/message/HJAMXGXHCL46I1';
  bouton.target = '_blank';
  bouton.rel = 'noopener';
  bouton.className = 'whatsapp-flottant';
  bouton.setAttribute('aria-label', (document.documentElement.lang || '').indexOf('en') === 0 ? 'Contact us on WhatsApp' : 'Nous contacter sur WhatsApp');
  bouton.innerHTML = '<svg viewBox="0 0 32 32" fill="#fff"><path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.386.7 4.61 1.902 6.475L4 29l7.727-1.868A11.94 11.94 0 0016 27c6.628 0 12-5.373 12-12S22.629 3 16.001 3zm0 21.6c-1.98 0-3.833-.55-5.41-1.505l-.388-.23-4.586 1.108 1.146-4.47-.253-.397A9.58 9.58 0 016.4 15c0-5.302 4.299-9.6 9.601-9.6 5.301 0 9.6 4.298 9.6 9.6 0 5.301-4.299 9.6-9.6 9.6zm5.263-7.19c-.288-.144-1.705-.841-1.969-.937-.264-.096-.456-.144-.648.144-.192.288-.744.937-.912 1.129-.168.192-.336.216-.624.072-.288-.144-1.216-.448-2.316-1.428-.856-.763-1.434-1.706-1.602-1.994-.168-.288-.018-.443.126-.587.129-.129.288-.336.432-.504.144-.168.192-.288.288-.48.096-.192.048-.36-.024-.504-.072-.144-.648-1.563-.888-2.14-.234-.562-.472-.486-.648-.495-.168-.009-.36-.011-.552-.011-.192 0-.504.072-.768.36-.264.288-1.008.985-1.008 2.403s1.032 2.786 1.176 2.978c.144.192 2.03 3.1 4.92 4.347.688.297 1.224.474 1.643.606.69.22 1.318.189 1.815.115.554-.083 1.705-.697 1.945-1.371.24-.674.24-1.251.168-1.371-.072-.12-.264-.192-.552-.336z"/></svg>';
  document.body.appendChild(bouton);
});

// Identifiant anonyme de visiteur, pour compter les visiteurs uniques (statistiques
// du tableau de bord). Avant le 30/09/2026, l'adresse IP du visiteur était envoyée à
// un service extérieur (ipify) pour en tirer une empreinte : retiré (données
// minimales, aucun service tiers). Désormais : un simple nombre tiré au hasard,
// sans lien avec la personne — gardé dans ce navigateur seulement si le visiteur a
// accepté les cookies de mesure d'audience, sinon valable pour la visite en cours.
async function empreinteVisiteur() {
  const nouveau = () => {
    const octets = new Uint8Array(32);
    crypto.getRandomValues(octets);
    return Array.from(octets).map(b => b.toString(16).padStart(2, '0')).join('');
  };
  try {
    let accord = false;
    try { accord = localStorage.getItem('ma2m_cookies') === 'oui'; } catch (e) {}
    const stockage = accord ? localStorage : sessionStorage;
    let id = stockage.getItem('ma2m_visiteur');
    if (!id) { id = nouveau(); stockage.setItem('ma2m_visiteur', id); }
    return id;
  } catch (e) {
    try { return nouveau(); } catch (x) { return null; }
  }
}

// Doit être EXACTEMENT le même texte que celui défini côté script Google
// Apps Script (CLE_ATTENDUE) — évite qu'un script tiers, qui aurait
// simplement trouvé l'adresse du endpoint, puisse l'appeler directement en
// dehors du site. Ce n'est pas un secret absolu (visible ici, comme
// n'importe quel code de ce fichier public), mais ça arrête l'immense
// majorité des abus automatisés qui ne visitent jamais le vrai site.
const CLE_SCRIPT_PHOTOS_DRIVE = 'b56772fb9c5075517dc36a6b20db10734701e262274f3beb';

// Envoi des photos (candidature/inscription) vers Google Drive via l'Apps
// Script partagé — centralise ce qui était dupliqué à l'identique entre
// candidature.html et inscription-mannequin.html (FR/EN), et ajoute une
// vraie tentative de nouvel essai : jusqu'ici, une simple coupure réseau
// pendant l'envoi faisait perdre les photos pour de bon, sans aucun moyen
// de rattraper le coup. Un second essai automatique, après une courte
// pause, résout la grande majorité des échecs purement transitoires.
// Envoi d'un formulaire public (candidature, contact, demande de sélection) avec patience.
// La base limite le nombre d'envois par minute (protection contre les robots). Lors d'un
// vrai afflux (annonce de casting, jour de casting où tout le monde est sur le même
// Wi-Fi), un envoi refusé pour cette seule raison était perdu avec « Erreur lors de
// l'envoi » (constaté lors de l'audit du 30/09). Il est désormais retenté tout seul,
// en affichant un compte à rebours. Les autres erreurs sont renvoyées telles quelles.
async function insererAvecPatience(table, ligne, surAttente) {
  const attentes = [15, 25, 35];
  for (let essai = 0; ; essai++) {
    const { error } = await sb.from(table).insert(ligne);
    if (!error) return { error: null };
    // Déjà enregistré lors d'un essai précédent dont la réponse s'est perdue.
    if (error.code === '23505' && ligne && ligne.id) return { error: null };
    const limiteAtteinte = error.code === '42501' || /row-level security/i.test(error.message || '');
    if (!limiteAtteinte || essai >= attentes.length) return { error };
    for (let reste = attentes[essai]; reste > 0; reste--) {
      if (surAttente) surAttente(reste);
      await new Promise(ok => setTimeout(ok, 1000));
    }
  }
}
function texteAttenteEnvoi(secondes) {
  return (document.documentElement.lang || '').indexOf('en') === 0
    ? `Many submissions right now — trying again automatically in ${secondes} s. Please keep this page open.`
    : `Beaucoup d'envois en ce moment — nouvel essai automatique dans ${secondes} s. Merci de garder la page ouverte.`;
}

async function envoyerPhotosVersDrive(urlScript, payload, tentatives = 2) {
  const payloadAvecCle = { ...payload, cle: CLE_SCRIPT_PHOTOS_DRIVE };
  for (let essai = 1; essai <= tentatives; essai++) {
    try {
      const reponse = await fetch(urlScript, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payloadAvecCle)
      });
      const resultat = await reponse.json();
      if (resultat.ok && Array.isArray(resultat.liens)) {
        return { liens: resultat.liens, echec: false, dossier: resultat.dossier || null };
      }
    } catch (e) {}
    if (essai < tentatives) await new Promise(r => setTimeout(r, 1500));
  }
  return { liens: [], echec: true, dossier: null };
}

// Vidéo de présentation (candidatures) : envoyée à part, après les photos, vers le
// même programme Google, EN MORCEAUX de 4 Mo (constaté le 30/09 : une vidéo de
// téléphone de 20 Mo envoyée d'un seul bloc faisait échouer le programme Google).
// Chaque morceau est retenté ; après une coupure, on reprend là où Google s'est
// arrêté. Renvoie le lien de la vidéo, ou null (cause notée dans le Journal MA2M).
const TAILLE_MORCEAU_VIDEO = 4 * 1024 * 1024; // multiple de 256 Ko (exigé par Google Drive)
async function appelScriptDrive(urlScript, donnees) {
  const reponse = await fetch(urlScript, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...donnees, cle: CLE_SCRIPT_PHOTOS_DRIVE })
  });
  const texte = await reponse.text();
  try { return JSON.parse(texte); }
  catch (e) { throw new Error(`HTTP ${reponse.status}, réponse non lisible « ${texte.slice(0, 60).replace(/\s+/g, ' ')} »`); }
}
function morceauEnBase64(blob) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result).split(',')[1] || '');
    lecteur.onerror = () => reject(lecteur.error || new Error('lecture impossible'));
    lecteur.readAsDataURL(blob);
  });
}
async function envoyerVideoVersDrive(urlScript, infos, fichier, surProgres) {
  const causes = [];
  const debut = Date.now();
  const total = fichier.size;
  const typeVideo = /^video\//.test(fichier.type || '') ? fichier.type
    : /\.mov$/i.test(fichier.name || '') ? 'video/quicktime' : 'video/mp4';
  const pause = (ms) => new Promise(r => setTimeout(r, ms));
  let lien = null;
  try {
    let session = null;
    for (let essai = 1; !session && essai <= 3; essai++) {
      try {
        const r = await appelScriptDrive(urlScript, { ...infos, action: 'video_debut', typeVideo, taille: total });
        if (r.ok && r.session) session = r.session;
        else causes.push('ouverture : ' + (r.erreur || JSON.stringify(r).slice(0, 80)));
      } catch (e) { causes.push(`ouverture essai ${essai} : ${(e && e.message) || e}`); }
      if (!session && essai < 3) await pause(3000);
    }
    if (!session) throw new Error('envoi non ouvert');

    let position = 0, echecsDeSuite = 0;
    while (!lien && position < total) {
      if (surProgres) surProgres(Math.floor(position / total * 100));
      try {
        const morceau = await morceauEnBase64(fichier.slice(position, Math.min(position + TAILLE_MORCEAU_VIDEO, total)));
        const r = await appelScriptDrive(urlScript, { ...infos, action: 'video_morceau', session, debut: position, total, morceau });
        if (r.ok && r.video) { lien = r.video; break; }
        if (!r.ok) throw new Error(r.erreur || 'refusé');
        position = typeof r.recu === 'number' && r.recu > position ? r.recu : Math.min(position + TAILLE_MORCEAU_VIDEO, total);
        echecsDeSuite = 0;
      } catch (e) {
        causes.push(`morceau à ${(position / 1048576).toFixed(1)} Mo : ${(e && e.message) || e} (en ligne : ${navigator.onLine})`);
        if (++echecsDeSuite > 4) throw new Error('trop de coupures');
        await pause(3000 * echecsDeSuite);
        // Reprise : demander à Google ce qu'il a déjà reçu.
        try {
          const etat = await appelScriptDrive(urlScript, { ...infos, action: 'video_etat', session, total });
          if (etat.ok && etat.video) lien = etat.video;
          else if (etat.ok && typeof etat.recu === 'number') position = etat.recu;
        } catch (e2) {}
      }
    }
    if (surProgres && lien) surProgres(100);
  } catch (e) {
    causes.push((e && e.message) || String(e));
  }
  if (!lien && window.signalerErreur) {
    const conn = navigator.connection || {};
    window.signalerErreur('Vidéo de candidature non envoyée',
      `${infos.nom || '?'} — vidéo ${(total / 1048576).toFixed(1)} Mo (${typeVideo}), ${Math.round((Date.now() - debut) / 1000)} s au total, réseau ${conn.effectiveType || '?'}${conn.downlink ? ' ~' + conn.downlink + ' Mbit/s' : ''}`,
      causes.slice(-6).join(' | '));
  }
  return lien;
}

// Journalise, côté base de données, les photos qui n'ont vraiment pas pu être
// envoyées (même après nouvel essai) — jusqu'ici, l'agence ne pouvait
// découvrir un dossier avec des photos manquantes qu'en l'ouvrant et en
// comptant lui-même, sans aucune alerte. Écriture ouverte (comme
// journal_erreurs/page_views), limitée en fréquence par visiteur.
async function journaliserPhotosEchouees(source, dossierId, nbEchouees) {
  if (!sb || !nbEchouees || !dossierId) return;
  try {
    await sb.from('photos_upload_echouees').insert({ source, dossier_id: dossierId, nb_photos_echouees: nbEchouees });
  } catch (e) {}
}

// Comptage de visites (statistiques pour le tableau de bord admin)
// Une seule visite comptée par page et par session de navigation, pour limiter
// l'impact d'un rechargement en boucle (accidentel ou automatisé). L'empreinte IP
// anonyme permet en plus de compter les vraies visites distinctes (pas de vraie
// personne = pas de doublon), notamment pour le classement des fiches mannequins.
document.addEventListener('DOMContentLoaded', async () => {
  if (!sb) return;
  // Clé par page ET par fiche : avant, toutes les fiches mannequin partageaient la
  // même clé (/mannequin) — seule la première fiche vue dans la session était
  // comptée, ce qui faussait le classement des mannequins les plus vus.
  // Adresse lisible /book/nom (06/10/2026) : comptée comme la fiche du mannequin,
  // retrouvé par son nom d'adresse (js/adresse-fiche.js).
  let chemin = window.location.pathname;
  let idMannequin = new URLSearchParams(window.location.search).get('id');
  const joli = chemin.match(/^\/(en\/)?book\/[a-z0-9-]{1,80}\/?$/);
  if (joli) {
    chemin = (joli[1] ? '/en' : '') + '/mannequin';
    idMannequin = typeof window.ma2mIdFiche === 'function' ? await window.ma2mIdFiche() : null;
  }
  const cle = 'ma2m_vue_' + chemin + (idMannequin ? '?id=' + idMannequin : '');
  try {
    if (sessionStorage.getItem(cle)) return;
    sessionStorage.setItem(cle, '1');
  } catch (e) {}

  const surPageMannequin = /\/mannequin(\.html)?$/.test(chemin);
  const modelId = (surPageMannequin && idMannequin) ? idMannequin : null;
  const ipHash = await empreinteVisiteur();

  sb.from('page_views').insert({ page: chemin, ip_hash: ipHash, model_id: modelId }).then(() => {}).catch(() => {});
});

// Protection des images : empêche le clic-droit/enregistrer, le glisser-déposer et
// l'appui long (copier une image) sur l'ensemble du site, SAUF sur le tableau de
// bord de l'administrateur qui doit pouvoir télécharger les photos normalement.
// NB : ceci décourage la récupération "facile" d'une image, mais ne peut techniquement
// pas empêcher une vraie capture d'écran (impossible à bloquer depuis un site web).
(function protectionImages() {
  const estAdmin = window.location.pathname.includes('tableau-de-bord');
  if (estAdmin) return;

  document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'IMG') e.preventDefault();
  });

  document.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'IMG') e.preventDefault();
  });

  // Empêche aussi la sélection tactile prolongée (menu "Enregistrer l'image" sur mobile)
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('img').forEach(img => { img.draggable = false; });
  });
  const observateurImages = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IMG') node.draggable = false;
        node.querySelectorAll && node.querySelectorAll('img').forEach(img => { img.draggable = false; });
      });
    });
  });
  observateurImages.observe(document.body || document.documentElement, { childList: true, subtree: true });
})();

// ================== Installation sur l'écran d'accueil (PWA) ==================
(function installationEcranAccueil() {
  // Enregistre le service worker (nécessaire pour l'installabilité sur Android/Chrome)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    });
  }

  const CLE_REFUS = 'ma2m_installation_refusee';
  const dejaInstalle = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const refusePrecedemment = (() => { try { return localStorage.getItem(CLE_REFUS) === '1'; } catch (e) { return false; } })();
  // Les navigateurs intégrés (Instagram, Facebook) ne peuvent pas installer une PWA sur
  // l'écran d'accueil : les instructions "Partager > Sur l'écran d'accueil" ne s'y appliquent
  // pas (le bouton Partager de ces apps ne propose pas cette option). Autant ne pas montrer
  // une bannière qui promet une fonctionnalité indisponible dans ce contexte.
  const estNavigateurIntegre = /Instagram|FBAN|FBAV|FB_IAB|MessengerForiOS/i.test(navigator.userAgent);
  // Une seule apparition par visite (relevé le 30/09 : la pastille revenait sur chaque
  // page et cachait le contenu en bas de l'écran des téléphones tant qu'on ne l'avait pas
  // fermée). Elle s'efface aussi d'elle-même au bout de 12 s ou dès qu'on fait défiler.
  const CLE_VUE = 'ma2m_installation_vue';
  const dejaVueCetteVisite = (() => { try { return sessionStorage.getItem(CLE_VUE) === '1'; } catch (e) { return false; } })();
  if (dejaInstalle || refusePrecedemment || estNavigateurIntegre || dejaVueCetteVisite) return;
  const anglais = (document.documentElement.lang || '').indexOf('en') === 0;

  const estIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  let evenementInstall = null;

  function creerPastille(texteClic) {
    const pastille = document.createElement('button');
    pastille.id = 'pastille-installer';
    pastille.innerHTML = `
      <span class="pastille-installer-icone">⬇</span>
      <span>${anglais ? 'Install the MA2M app' : "Installer l'app MA2M"}</span>
      <span class="pastille-installer-fermer" title="${anglais ? 'Close' : 'Fermer'}">✕</span>
    `;
    document.body.appendChild(pastille);
    try { sessionStorage.setItem(CLE_VUE, '1'); } catch (e) {}

    // Disparition douce (sans la marquer « refusée » : elle reviendra à une prochaine visite).
    function effacer() {
      window.removeEventListener('scroll', auDefilement);
      if (!pastille.isConnected) return;
      pastille.classList.add('pastille-installer--sortie');
      setTimeout(() => pastille.remove(), 400);
    }
    function auDefilement() { if (window.scrollY > window.innerHeight * 0.6) effacer(); }
    window.addEventListener('scroll', auDefilement, { passive: true });
    setTimeout(effacer, 12000);

    pastille.querySelector('.pastille-installer-fermer').addEventListener('click', (e) => {
      e.stopPropagation();
      pastille.remove();
      try { localStorage.setItem(CLE_REFUS, '1'); } catch (err) {}
    });

    pastille.addEventListener('click', texteClic);
    return pastille;
  }

  if (estIOS) {
    // iOS/Safari n'a pas d'invite automatique : on explique la manipulation
    const pastille = creerPastille(() => {
      afficherInstructionsIOS();
    });
  } else {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      evenementInstall = e;
      creerPastille(async () => {
        if (!evenementInstall) return;
        evenementInstall.prompt();
        await evenementInstall.userChoice;
        evenementInstall = null;
        const p = document.getElementById('pastille-installer');
        if (p) p.remove();
      });
    });
  }

  function afficherInstructionsIOS() {
    const fond = document.createElement('div');
    fond.className = 'modale-ios-fond';
    fond.innerHTML = `
      <div class="modale-ios-contenu">
        <button class="modale-ios-fermer" title="${anglais ? 'Close' : 'Fermer'}">✕</button>
        ${anglais ? `<h3>Install the app on your home screen</h3>
        <ol>
          <li>Tap the <strong>Share</strong> icon <span class="u-icone-partage">⬆️</span> at the bottom of Safari</li>
          <li>Scroll down and choose <strong>“Add to Home Screen”</strong></li>
          <li>Tap <strong>“Add”</strong> in the top right corner</li>
        </ol>` : `<h3>Installer l'app sur votre écran d'accueil</h3>
        <ol>
          <li>Appuyez sur l'icône <strong>Partager</strong> <span class="u-icone-partage">⬆️</span> en bas de Safari</li>
          <li>Faites défiler et choisissez <strong>« Sur l'écran d'accueil »</strong></li>
          <li>Appuyez sur <strong>« Ajouter »</strong> en haut à droite</li>
        </ol>`}
      </div>
    `;
    document.body.appendChild(fond);
    fond.addEventListener('click', (e) => { if (e.target === fond) fond.remove(); });
    fond.querySelector('.modale-ios-fermer').addEventListener('click', () => fond.remove());
  }
})();

// ================== Lightbox plein écran lumineux, réutilisable partout ==================
// Ouvre une image (ou une série d'images, avec balayage/flèches pour naviguer) en vrai
// plein écran, sur fond clair. Utilisation : ouvrirGalerieLightbox([urls...], indexDepart)
(function () {
  let urls = [];
  let index = 0;
  let lightboxEstOuverte = false;

  function creerLightboxGlobal() {
    if (document.getElementById('lightbox-global')) return;
    const div = document.createElement('div');
    div.className = 'lightbox-global';
    div.id = 'lightbox-global';
    div.innerHTML = `
      <button class="lightbox-fermer" id="lbg-fermer">Fermer ✕</button>
      <button class="lightbox-fleche lightbox-precedent" id="lbg-precedent">&#10094;</button>
      <div class="lightbox-conteneur" id="lbg-conteneur"><img class="lightbox-img" id="lbg-img" src="" alt=""></div>
      <button class="lightbox-fleche lightbox-suivant" id="lbg-suivant">&#10095;</button>
      <div class="lightbox-compteur" id="lbg-compteur"></div>
    `;
    document.body.appendChild(div);

    document.getElementById('lbg-fermer').addEventListener('click', fermer);
    document.getElementById('lbg-precedent').addEventListener('click', (e) => { e.stopPropagation(); naviguer(-1); });
    document.getElementById('lbg-suivant').addEventListener('click', (e) => { e.stopPropagation(); naviguer(1); });
    div.addEventListener('click', (e) => { if (e.target === div || e.target.id === 'lbg-conteneur') fermer(); });

    // Balayage tactile (mobile) pour passer à l'image suivante/précédente
    let departX = null;
    div.addEventListener('touchstart', (e) => { departX = e.touches[0].clientX; }, { passive: true });
    div.addEventListener('touchend', (e) => {
      if (departX === null) return;
      const diff = e.changedTouches[0].clientX - departX;
      if (Math.abs(diff) > 45) naviguer(diff > 0 ? -1 : 1);
      departX = null;
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
      if (!div.classList.contains('active')) return;
      if (e.key === 'Escape') fermer();
      if (e.key === 'ArrowLeft') naviguer(-1);
      if (e.key === 'ArrowRight') naviguer(1);
    });
  }

  function afficher() {
    document.getElementById('lbg-img').src = urls[index];
    const multi = urls.length > 1;
    document.getElementById('lbg-compteur').textContent = multi ? `${index + 1} / ${urls.length}` : '';
    document.getElementById('lbg-precedent').style.display = multi ? 'flex' : 'none';
    document.getElementById('lbg-suivant').style.display = multi ? 'flex' : 'none';
  }

  function naviguer(delta) {
    index = (index + delta + urls.length) % urls.length;
    afficher();
  }

  function fermer() {
    const el = document.getElementById('lightbox-global');
    if (el) el.classList.remove('active');
    if (lightboxEstOuverte) { lightboxEstOuverte = false; window.deverrouillerDefilement(); }
  }

  window.ouvrirGalerieLightbox = function (listeUrls, indexDepart) {
    if (!listeUrls || !listeUrls.length) return;
    creerLightboxGlobal();
    urls = listeUrls;
    index = indexDepart || 0;
    afficher();
    document.getElementById('lightbox-global').classList.add('active');
    if (!lightboxEstOuverte) { lightboxEstOuverte = true; window.verrouillerDefilement(); }
  };
})();

// Boutons « touche » (30/09) : sur téléphone, le doigt quitte souvent l'écran avant
// qu'on voie le bouton s'enfoncer — on le garde enfoncé (et rouge) un court instant,
// avec une petite vibration sur Android. Le style est dans css/style.css.
document.addEventListener('pointerdown', function (e) {
  var t = e.target.closest && e.target.closest('.btn, .btn-mini-admin, .filtre-btn, .fiche-partage-btn, .journal-btn, .lang-switch, .mp-panier-btn, .mpg-bouton-danger');
  if (!t || t.disabled || t.closest('#bloc-tableau')) return;
  t.classList.add('touche-appuyee');
  setTimeout(function () { t.classList.remove('touche-appuyee'); }, 160);
  try { if (navigator.vibrate) navigator.vibrate(8); } catch (err) {}
}, { passive: true });
