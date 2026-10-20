// Accueil FR et EN (index.html, en/index.html) : à charger tout en haut du <body>, SANS
// async ni defer — il doit s'exécuter avant que le reste de la page ne s'affiche.
// Avant le 12/10/2026, ce script était recopié dans les deux pages (code recopié signalé
// par SonarQube) ; il est maintenant écrit une seule fois ici.
// (Jusqu'au 20/10/2026, ce script verrouillait aussi le défilement tant que la porte d'entrée
// n'était pas ouverte : la porte a été remplacée par la couverture du magazine.)

// Accueil : si « Mannequin à la une » / « Mot de Maître Akesse » étaient vides lors de la
// dernière visite, on ne leur réserve pas de place (voir .section-reservee, css/style.css).
try {
  ['mannequin-vedette', 'mot-responsable'].forEach(function (id) {
    if (localStorage.getItem('ma2m_bloc_vide_' + id) === '1') document.documentElement.classList.add('vide-' + id);
  });
} catch (e) {}

// Affiche le logo animé dès maintenant, avant même que le reste de la page (dont la
// magazine) ne soit parsé — sinon, le temps que js/accueil.js (fin de page) ne
// s'exécute pour l'afficher, la couverture apparaît brièvement à l'écran, non couverte. #logo-splash n'existe pas
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
