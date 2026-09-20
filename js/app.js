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

// ================== Retour arrière fiable, sur toutes les pages ==================
// Sur mobile/tablette, le bouton "retour" restaure très souvent une page depuis
// le cache du navigateur (bfcache) exactement telle qu'elle était figée en la
// quittant — sans jamais relancer les scripts. Une page peut alors rester figée
// dans un état intermédiaire (écran superposé, menu ouvert, animation en cours)
// et ne plus répondre aux appuis, jusqu'à un rafraîchissement manuel complet.
// Plutôt que de rattraper chaque état possible un par un, on force ici le même
// résultat qu'un rafraîchissement manuel — automatiquement et invisiblement —
// à chaque fois qu'une page restaurée de cette façon est réaffichée, pour
// garantir qu'elle reparte toujours d'un état propre.
window.addEventListener('pageshow', (evenement) => {
  if (evenement.persisted) window.location.reload();
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
  }

  window.ouvrirGalerieLightbox = function (listeUrls, indexDepart) {
    if (!listeUrls || !listeUrls.length) return;
    creerLightboxGlobal();
    urls = listeUrls;
    index = indexDepart || 0;
    afficher();
    document.getElementById('lightbox-global').classList.add('active');
  };
})();
