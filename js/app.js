// ================== Surveillance des erreurs réelles du site ==================
// Capte toute erreur JavaScript qui se produit VRAIMENT dans le navigateur d'un
// visiteur (pas une relecture de code) et l'enregistre pour l'agence, consultable
// depuis le tableau de bord — plutôt que de découvrir un bug par hasard, des mois
// plus tard, si quelqu'un pense à le signaler. Enregistré tout en haut du fichier,
// avant tout le reste, pour capter les erreurs le plus tôt possible.
(function surveillanceErreurs() {
  function envoyerErreur(message, pile) {
    if (typeof sb === 'undefined' || !sb || !message) return;
    // Anti-spam : au plus un envoi de cette erreur précise par navigateur, par jour —
    // évite qu'une même erreur répétée (ex. survenant à chaque clic) ne remplisse le
    // journal ou ne fasse gonfler artificiellement son importance.
    const texte = String(message).slice(0, 500);
    try {
      const cle = 'ma2m_err_' + texte.length + '_' + texte.slice(0, 40);
      const derniereFois = sessionStorage.getItem(cle);
      if (derniereFois) return;
      sessionStorage.setItem(cle, '1');
    } catch (e) {}

    sb.from('journal_erreurs').insert({
      message: texte,
      page: window.location.pathname,
      pile: pile ? String(pile).slice(0, 1000) : null,
      user_agent: navigator.userAgent.slice(0, 300)
    }).then(() => {}).catch(() => {});
  }

  window.addEventListener('error', (e) => {
    envoyerErreur(e.message, e.error && e.error.stack);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const raison = e.reason;
    envoyerErreur(raison && raison.message ? raison.message : String(raison), raison && raison.stack);
  });
})();

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
  const ZONES_DEFILEMENT_AUTORISE = '.menu-overlay, .news-modal-contenu, .modal-overlay, .tdb-menu-panel, .projets-liste-scroll';
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

// Niveau New Face / Amateur / Professionnel, déduit de years_experience :
// sert de valeur par défaut suggérée (espace-mannequin.html pré-remplit son
// champ "Catégorie" avec ce résultat la première fois, mais la mannequin
// peut ensuite choisir directement) et reste la seule règle utilisée par
// mannequin.html (fiche publique, où le champ n'existe pas) et par
// espace-mannequin-ancien.html (figé). Règle : 0 an ou vide -> New Face ;
// 1-2 ans -> Amateur ; 3 ans et plus -> Professionnel.
function deriverNiveauMannequin(anneesExperience) {
  const annees = anneesExperience === '' || anneesExperience === null || anneesExperience === undefined
    ? NaN : parseInt(anneesExperience, 10);
  if (isNaN(annees) || annees === 0) return 'New Face';
  if (annees <= 2) return 'Amateur';
  return 'Professionnel';
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
  body: '<path d="M4 3h10M4 15h10M6 3v5.5c0 1.2-1 1.6-1 3.5s1 2.3 1 3M12 3v5.5c0 1.2 1 1.6 1 3.5s-1 2.3-1 3"/>',
  grad: '<path d="M1.5 7 9 3.5 16.5 7 9 10.5 1.5 7Z"/><path d="M5 8.6v3.4c0 1 1.8 2 4 2s4-1 4-2V8.6"/><path d="M16.5 7v4.5"/>',
  star: '<path d="M9 2.2l1.9 3.9 4.3.6-3.1 3 .7 4.3L9 12l-3.8 2 .7-4.3-3.1-3 4.3-.6L9 2.2Z"/>',
  medal: '<circle cx="9" cy="11" r="4.3"/><path d="M6.4 6.6 4 2M11.6 6.6 14 2M7.4 11l1.1 1.4L11 9.6"/>',
  image: '<rect x="1.7" y="3" width="14.6" height="12" rx="1"/><circle cx="6" cy="7.3" r="1.3"/><path d="M2 13.5l4-4 3 3 2.6-2.6L16.3 13"/>',
  calendar: '<rect x="2" y="3.3" width="14" height="12.2" rx="1"/><path d="M2 7h14M5.5 1.8v3M12.5 1.8v3"/>',
  pin: '<path d="M9 16.3S3.8 11 3.8 7.1a5.2 5.2 0 0 1 10.4 0C14.2 11 9 16.3 9 16.3Z"/><circle cx="9" cy="7.1" r="1.9"/>',
  globe: '<circle cx="9" cy="9" r="7"/><path d="M2 9h14M9 2c2.2 2 2.2 12 0 14M9 2c-2.2 2-2.2 12 0 14"/>',
  home: '<path d="M2.5 8.2 9 2.7l6.5 5.5"/><path d="M4 7v8h10V7"/><path d="M7.3 15V10.7h3.4V15"/>',
  phone: '<path d="M4 2.5h2.3l1 3.3-1.7 1.3a9 9 0 0 0 4.3 4.3l1.3-1.7 3.3 1v2.3c0 .9-.8 1.6-1.7 1.4C7.9 13.6 4.4 10.1 3.6 5.2 3.4 4.3 4 3.5 4 2.5Z"/>',
  insta: '<rect x="2" y="2" width="14" height="14" rx="4"/><circle cx="9" cy="9" r="3.4"/><circle cx="13.2" cy="4.8" r=".9"/>',
  link: '<path d="M7.5 10.5 10.5 7.5"/><path d="M8.6 5.5 10 4a2.9 2.9 0 0 1 4.1 4.1l-1.5 1.5"/><path d="M9.4 12.5 8 14a2.9 2.9 0 0 1-4.1-4.1l1.5-1.5"/>',
  mail: '<rect x="2" y="4" width="14" height="10" rx="1.5"/><path d="M2.5 4.8 9 9.8l6.5-5"/>',
};
function mcvIcon(name, size) {
  size = size || 18;
  return '<svg viewBox="0 0 18 18" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' + (MCV_ICONS[name] || '') + '</svg>';
}

const LIBELLES_COMPETENCES = {
  runway: 'Runway / Défilé', pose: 'Pose photographique', editorial: 'Editorial', campagne: 'Fashion campaign',
  fitting: 'Fitting', presentation: 'Présentation de collection', expression: 'Expression corporelle',
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

// d = { nomComplet, dateNaissance, villeNaissance, lieuNaissance, nationalite, ville,
//   quartier, citation, bio, instagram, niveauMannequin, mannequinId, photoCvUrl,
//   compcardPhotos: [url|null, ...] (jusqu'à 5), physique: {...}, formation: {...},
//   competences: {...}, experiences: [{ type, nom, lieu, annee }, ...] }
// Renvoie le HTML à placer à l'intérieur d'un conteneur .cv-sheet — n'inclut pas
// le conteneur lui-même ni les boutons d'action (fermer/imprimer), propres à
// chaque page.
function construireHtmlCv(d) {
  const p = d.physique || {}, f = d.formation || {};
  const groups = groupExperiences(d.experiences);
  const heroPhoto = d.photoCvUrl ? '<img src="' + d.photoCvUrl + '" alt="Photo">' : '';
  const handle = d.instagram ? String(d.instagram).replace(/^@/, '') : '';
  const lienFichePublique = 'https://www.maitreakessemodelmanagement.com/mannequin.html?id=' + encodeURIComponent(d.mannequinId || '');
  const compcardPhotosCv = [0, 1, 2, 3, 4].map(function (i) {
    const url = (d.compcardPhotos || [])[i];
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
        '<li>' + mcvIcon('phone') + '<div><span class="k">Contact agence</span><span class="v">+225 27 22 23 11 76<br>+225 05 45 65 66 87<br>infos.ma2m@gmail.com</span></div></li>' +
      '</ul>' +
      '<div class="mcv-cat"><span class="lbl">Catégorie</span><span class="val">' + echapperHtml(d.niveauMannequin || '') + '</span></div>' +
      (d.citation ? '<blockquote class="mcv-quote">« ' + echapperHtml(d.citation) + ' »</blockquote>' : '') +
      '<div class="mcv-agency"><img src="assets/logo-header.png" alt="Maître Akesse Model Management"></div>' +
    '</aside><div class="mcv-right"><div class="mcv-main"><div class="mcv-topline">Model CV</div>' +
      '<section class="mcv-sec mcv-sec-subtile"><h4>' + mcvIcon('user') + ' Profil</h4><p class="mcv-profile-text">' + echapperHtml(d.bio || 'Profil à compléter.') + '</p></section>' +
      '<section class="mcv-sec"><h4>' + mcvIcon('body') + ' Informations physiques</h4><div class="mcv-two-col">' +
        '<ul class="mcv-kv"><li><span>Taille</span><b>' + (p.taille ? p.taille + ' cm' : '—') + '</b></li><li><span>Poids</span><b>' + (p.poids ? p.poids + ' kg' : '—') + '</b></li>' +
        '<li><span>Mensurations</span><b>' + ([p.poitrine, p.tourTaille, p.hanches || p.entrejambe].some(Boolean) ? [p.poitrine || '–', p.tourTaille || '–', p.hanches || p.entrejambe || '–'].join(' / ') : '—') + '</b></li>' +
        '<li><span>Pointure</span><b>' + (p.pointure || '—') + '</b></li></ul>' +
        '<ul class="mcv-kv"><li><span>Taille vêtements</span><b>' + (p.tailleVet || '—') + '</b></li><li><span>Couleur des yeux</span><b>' + (p.yeux || '—') + '</b></li>' +
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
        '<div class="mcv-qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=8&color=241a12&bgcolor=ffffff&data=' + encodeURIComponent(lienFichePublique) + '" alt="QR code vers la fiche publique" width="140" height="140"><span>Scannez pour ouvrir la fiche</span></div>' +
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
    if (!reponse.ok) return null;
    blob = await reponse.blob();
  } catch (e) {
    return null;
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
    img.onerror = () => resolve(null);
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

  const photosChoisies = photos.filter(p => p.compcard_ordre).sort((a, b) => a.compcard_ordre - b.compcard_ordre);
  const urlsPhotos = (photosChoisies.length ? photosChoisies : photos.slice(0, 5)).map(p => p.url);
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
  const niveauMannequin = profil.niveau_mannequin || deriverNiveauMannequin(profil.years_experience);
  ctx.fillStyle = ROUGECLAIR;
  ctx.font = `${fpx(13)}px Arial, sans-serif`;
  ctx.fillText(['Mannequin', niveauMannequin, profil.city].filter(Boolean).join(' '), px(15), px(y));

  // --- Mensurations (grille 3 colonnes) ---
  y += 11;
  const champs = [
    ['Taille', profil.height_cm ? profil.height_cm + ' cm' : null],
    ['Poids', profil.weight_kg ? profil.weight_kg + ' kg' : null],
    ['Poitrine', profil.chest_cm ? profil.chest_cm + ' cm' : null],
    ['Tour de taille', profil.waist_cm ? profil.waist_cm + ' cm' : null],
    [profil.category === 'homme' ? 'Entrejambe' : 'Hanches', profil.category === 'homme' ? (profil.inseam_cm ? profil.inseam_cm + ' cm' : null) : (profil.hips_cm ? profil.hips_cm + ' cm' : null)],
    ['Pointure', profil.shoe_size || null],
    ['Carnation', profil.carnation || null],
    ['Taille vêtements', profil.clothing_size || null],
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
  ctx.fillText('+225 27 22 23 11 76   ·   +225 05 45 65 68 87', px(15), px(yPiedPage + 16.5));
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
    script.crossOrigin = 'anonymous';
    script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('jsPDF n\'a pas pu être chargé'));
    document.body.appendChild(script);
  });
  return promesseJsPdf;
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
    const nomFichier = 'fiche-' + (ficheData.profil.full_name || 'mannequin').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();

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
const CONTENU_RICHE_BALISES_AUTORISEES = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a'];
const CONTENU_RICHE_ATTRIBUTS_AUTORISES = ['href', 'target', 'rel'];

// Rend un contenu (nouveau HTML ou ancien texte brut) prêt à être injecté avec
// .innerHTML : convertit l'ancien texte brut en paragraphes puis nettoie systématiquement
// via DOMPurify (si la bibliothèque a pu charger ; repli sur du texte échappé sinon).
function rendreContenuRiche(texte) {
  const html = texteEstDejaHtml(texte) ? String(texte) : convertirTexteBrutEnHtml(texte);
  if (!html) return '';
  if (typeof DOMPurify === 'undefined') return echapperHtml(texte || '').replace(/\n/g, '<br>');
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: CONTENU_RICHE_BALISES_AUTORISEES,
    ALLOWED_ATTR: CONTENU_RICHE_ATTRIBUTS_AUTORISES
  });
}

// Version texte brut (pour les extraits de carte, tronqués à N caractères) : dépouille
// tout le HTML éventuel pour ne garder que le texte lisible.
function texteBrutDepuis(texte) {
  if (!texte) return '';
  if (!texteEstDejaHtml(texte)) return String(texte);
  const conteneur = document.createElement('div');
  conteneur.innerHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(String(texte)) : '';
  return conteneur.textContent || conteneur.innerText || '';
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

function creerEditeurRiche(idConteneur, placeholder) {
  const conteneur = document.getElementById(idConteneur);
  if (!conteneur) return null;
  if (typeof Quill === 'undefined') return creerRepliEditeur(conteneur, placeholder);
  const quill = new Quill(conteneur, {
    theme: 'snow',
    placeholder: placeholder || 'Écrivez ici… (vous pouvez coller un texte déjà mis en forme depuis Word)',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ header: [2, 3, false] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote'],
        ['clean']
      ]
    }
  });
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

// Pastille WhatsApp flottante, injectée sur toutes les pages
document.addEventListener('DOMContentLoaded', () => {
  const bouton = document.createElement('a');
  bouton.href = 'https://wa.me/message/HJAMXGXHCL46I1';
  bouton.target = '_blank';
  bouton.rel = 'noopener';
  bouton.className = 'whatsapp-flottant';
  bouton.setAttribute('aria-label', 'Nous contacter sur WhatsApp');
  bouton.innerHTML = '<svg viewBox="0 0 32 32" fill="#fff"><path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.386.7 4.61 1.902 6.475L4 29l7.727-1.868A11.94 11.94 0 0016 27c6.628 0 12-5.373 12-12S22.629 3 16.001 3zm0 21.6c-1.98 0-3.833-.55-5.41-1.505l-.388-.23-4.586 1.108 1.146-4.47-.253-.397A9.58 9.58 0 016.4 15c0-5.302 4.299-9.6 9.601-9.6 5.301 0 9.6 4.298 9.6 9.6 0 5.301-4.299 9.6-9.6 9.6zm5.263-7.19c-.288-.144-1.705-.841-1.969-.937-.264-.096-.456-.144-.648.144-.192.288-.744.937-.912 1.129-.168.192-.336.216-.624.072-.288-.144-1.216-.448-2.316-1.428-.856-.763-1.434-1.706-1.602-1.994-.168-.288-.018-.443.126-.587.129-.129.288-.336.432-.504.144-.168.192-.288.288-.48.096-.192.048-.36-.024-.504-.072-.144-.648-1.563-.888-2.14-.234-.562-.472-.486-.648-.495-.168-.009-.36-.011-.552-.011-.192 0-.504.072-.768.36-.264.288-1.008.985-1.008 2.403s1.032 2.786 1.176 2.978c.144.192 2.03 3.1 4.92 4.347.688.297 1.224.474 1.643.606.69.22 1.318.189 1.815.115.554-.083 1.705-.697 1.945-1.371.24-.674.24-1.251.168-1.371-.072-.12-.264-.192-.552-.336z"/></svg>';
  document.body.appendChild(bouton);
});

// Récupère l'adresse IP publique du visiteur auprès d'un service standard, puis la
// transforme immédiatement en empreinte anonyme (jamais l'adresse en clair) — sert
// uniquement à distinguer une vraie visite d'un simple rechargement de page.
async function empreinteVisiteur() {
  try {
    const controleur = new AbortController();
    const delaiMax = setTimeout(() => controleur.abort(), 2500);
    const reponse = await fetch('https://api.ipify.org?format=json', { signal: controleur.signal });
    clearTimeout(delaiMax);
    const { ip } = await reponse.json();
    const donnees = new TextEncoder().encode(ip);
    const hachage = await crypto.subtle.digest('SHA-256', donnees);
    return Array.from(new Uint8Array(hachage)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return null;
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
        return { liens: resultat.liens, echec: false };
      }
    } catch (e) {}
    if (essai < tentatives) await new Promise(r => setTimeout(r, 1500));
  }
  return { liens: [], echec: true };
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
  const cle = 'ma2m_vue_' + window.location.pathname;
  try {
    if (sessionStorage.getItem(cle)) return;
    sessionStorage.setItem(cle, '1');
  } catch (e) {}

  const idMannequin = new URLSearchParams(window.location.search).get('id');
  const surPageMannequin = /\/mannequin(\.html)?$/.test(window.location.pathname);
  const modelId = (surPageMannequin && idMannequin) ? idMannequin : null;
  const ipHash = await empreinteVisiteur();

  sb.from('page_views').insert({ page: window.location.pathname, ip_hash: ipHash, model_id: modelId }).then(() => {}).catch(() => {});
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
  if (dejaInstalle || refusePrecedemment || estNavigateurIntegre) return;

  const estIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  let evenementInstall = null;

  function creerPastille(texteClic) {
    const pastille = document.createElement('button');
    pastille.id = 'pastille-installer';
    pastille.innerHTML = `
      <span class="pastille-installer-icone">⬇</span>
      <span>Installer l'app MA2M</span>
      <span class="pastille-installer-fermer" title="Fermer">✕</span>
    `;
    document.body.appendChild(pastille);

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
        <button class="modale-ios-fermer" title="Fermer">✕</button>
        <h3>Installer l'app sur votre écran d'accueil</h3>
        <ol>
          <li>Appuyez sur l'icône <strong>Partager</strong> <span class="u-icone-partage">⬆️</span> en bas de Safari</li>
          <li>Faites défiler et choisissez <strong>« Sur l'écran d'accueil »</strong></li>
          <li>Appuyez sur <strong>« Ajouter »</strong> en haut à droite</li>
        </ol>
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
