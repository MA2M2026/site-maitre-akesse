// Menu mobile
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('ouvert'));
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('ouvert')));
  }

  // Effet glassmorphism renforcé au scroll sur le header
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

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
    const reponse = await fetch('https://api.ipify.org?format=json');
    const { ip } = await reponse.json();
    const donnees = new TextEncoder().encode(ip);
    const hachage = await crypto.subtle.digest('SHA-256', donnees);
    return Array.from(new Uint8Array(hachage)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return null;
  }
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
  const modelId = (window.location.pathname.endsWith('mannequin.html') && idMannequin) ? idMannequin : null;
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
  if (dejaInstalle || refusePrecedemment) return;

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
          <li>Appuyez sur l'icône <strong>Partager</strong> <span style="font-size:1.1em;">⬆️</span> en bas de Safari</li>
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
