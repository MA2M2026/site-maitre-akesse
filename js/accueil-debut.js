// Accueil FR et EN (index.html, en/index.html) : à charger tout en haut du <body>, SANS
// async ni defer — il doit s'exécuter avant que le reste de la page ne s'affiche.
// Avant le 12/10/2026, ce script était recopié dans les deux pages (code recopié signalé
// par SonarQube) ; il est maintenant écrit une seule fois ici.
// Empêche un flash de la porte d'entrée (les 3 photos) à chaque retour sur l'accueil
// une fois qu'elle a déjà été ouverte cette session : on marque la page tout de suite,
// avant que le navigateur n'ait la moindre chance d'afficher la section, plutôt que
// d'attendre le script de fin de page (js/accueil.js) pour la masquer.
//
// Verrouille aussi le défilement ICI, tout en haut de la page, si la porte n'a pas
// encore été ouverte — et non dans js/accueil.js (chargé tout en bas de la page) :
// sinon, le temps que le navigateur charge tout le reste avant d'atteindre ce script,
// un visiteur rapide peut faire glisser l'écran avant que le verrou ne s'active, et se
// retrouve bloqué au milieu de la page au lieu du haut. Défini ici (et non dans
// js/app.js) pour la même raison : ce fichier externe arrive lui aussi trop tard.
(function () {
  let positionSauvegardee = 0;
  let compteur = 0;
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

let ma2mPorteDejaOuverte = false;
try { ma2mPorteDejaOuverte = sessionStorage.getItem('ma2m_porte_ouverte'); } catch (e) {}

if (ma2mPorteDejaOuverte) {
  document.documentElement.classList.add('porte-deja-vue');
} else {
  document.body.classList.add('porte-verrouillee');
  document.documentElement.classList.add('porte-verrouillee');
  window.verrouillerDefilement();
}

// Accueil : si « Mannequin à la une » / « Mot de Maître Akesse » étaient vides lors de la
// dernière visite, on ne leur réserve pas de place (voir .section-reservee, css/style.css).
try {
  ['mannequin-vedette', 'mot-responsable'].forEach(function (id) {
    if (localStorage.getItem('ma2m_bloc_vide_' + id) === '1') document.documentElement.classList.add('vide-' + id);
  });
} catch (e) {}

// Affiche le logo animé dès maintenant, avant même que le reste de la page (dont la
// porte d'entrée) ne soit parsé — sinon, le temps que js/accueil.js (fin de page) ne
// s'exécute pour l'afficher, la première diapositive de la porte d'entrée (le texte
// "MA2M") apparaît brièvement à l'écran, non couverte. #logo-splash n'existe pas
// encore dans le DOM à ce stade (plus bas dans la page) : on pose donc la classe sur
// <html>, avec une règle CSS ciblant #logo-splash par id (voir css/splash.css) — pas
// besoin d'attendre que l'élément existe pour que la règle s'applique dès son arrivée.
let ma2mIntroDejaVue = false;
try { ma2mIntroDejaVue = sessionStorage.getItem('ma2m_intro_vue'); } catch (e) {}
const ma2mReduitMouvement = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!ma2mIntroDejaVue && !ma2mReduitMouvement) {
  document.documentElement.classList.add('intro-a-venir');
  document.body.classList.add('splash-active');
}
