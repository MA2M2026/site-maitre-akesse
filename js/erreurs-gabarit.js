// Écran « Erreurs du site » (js/erreurs-site.js) : résumé, filtres, liste des erreurs, copie pour Claude.
// Écran en un seul endroit (22/10/2026) : utilisé par l'ancien tableau de bord (placé tout de
// suite dans #erreurs-racine) et par la nouvelle Administration, sans recopier le code.
window.GABARIT_ERREURS = `<div class="dossiers-entete">
<h2 class="tdb-10">🔴 Erreurs réelles du site (7 derniers jours)</h2>
<span class="dossiers-compteur" id="erreurs-compteur"></span>
</div>
<p class="tdb-12">Chaque problème vécu par un vrai visiteur est enregistré ici automatiquement : affichage (page qui dépasse, zoom qui change tout seul, blocs qui sautent, page vide), connexion et lenteur, photos, code du site, sécurité. Chaque fiche dit <strong>où</strong> (page, élément, appareil, dernier clic), <strong>ce qui s'est passé</strong> en clair et <strong>que faire</strong>. Les 🔴 sont à corriger en priorité, les 🟠 à surveiller. Les lenteurs dues à la connexion des visiteurs ne sont plus listées : une seule ligne les compte. Touchez une case de couleur pour ne voir que ces erreurs, puis « Copier pour Claude » pour les envoyer toutes d’un coup. S’il y en a beaucoup, « Télécharger le fichier pour Claude » crée un fichier complet, rangé par gravité, à joindre à la conversation (rien n’est coupé). Une erreur corrigée disparaît toute seule ; si elle est encore là, c’est qu’elle n’est pas réglée. Une liste vide est bon signe.</p>
<p class="journal-nettoyage" id="erreurs-nettoyage" hidden></p>
<p class="journal-connexion" id="erreurs-connexion" hidden></p>
<div id="erreurs-resume"></div>
<button class="btn journal-btn journal-copier-tout" id="erreurs-telecharger-btn" type="button" hidden>⬇️ Télécharger le fichier pour Claude (toutes les erreurs)</button>
<button class="btn journal-btn journal-copier-tout" id="erreurs-copier-tout-btn" type="button" hidden>📋 Copier pour Claude</button>
<div id="liste-erreurs"></div>
<button class="btn journal-btn journal-copier-tout" id="erreurs-copier-tout-bas-btn" type="button" hidden>📋 Copier pour Claude</button>
<button class="btn tdb-18" id="erreurs-tout-effacer-btn">Tout marquer comme vu (effacer le journal)</button>`;
(function () {
  var racine = document.getElementById('erreurs-racine');
  if (racine) racine.innerHTML = window.GABARIT_ERREURS;
})();
