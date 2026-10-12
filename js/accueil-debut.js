// Accueil FR et EN (index.html, en/index.html) : à charger tout en haut du <body>, SANS
// async ni defer — il doit s'exécuter avant que le reste de la page ne s'affiche.
// Avant le 12/10/2026, ce script était recopié dans les deux pages (code recopié signalé
// par SonarQube) ; il est maintenant écrit une seule fois ici.
// Empêche un flash de la porte d'entrée (les 3 photos) à chaque retour sur l'accueil
// une fois qu'elle a déjà été ouverte cette session : on marque la page tout de suite,
// avant que le navigateur n'ait la moindre chance d'afficher la section, plutôt que
// d'attendre le script de fin de page (js/accueil.js) pour la masquer.
//
// Le verrou du défilement (window.verrouillerDefilement) vient de js/verrou-defilement.js,
// chargé juste avant ce fichier.

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
