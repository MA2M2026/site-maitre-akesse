// Fiches événement (logique : js/fiches-evenement-admin.js).
// Écran en un seul endroit (22/10/2026) : utilisé par l'ancien tableau de bord (placé tout de
// suite dans #fiches-evenement-racine) et par la nouvelle Administration, sans recopier le code.
window.GABARIT_FICHES_EVENEMENT = `<details id="fiches-evenement-details">
<summary class="dossiers-entete tdb-16">
<h2 class="tdb-10">📋 Fiches événement (défilés)</h2>
</summary>
<p class="tdb-17">Pour chaque mannequin, une fiche PDF prête à envoyer aux organisateurs d'un défilé : identité, contacts, mensurations, taille haut et bas, régime et allergies, droit à l'image, Instagram, TikTok, Facebook et lien du book. Elle est préparée au moment du téléchargement, donc toujours à jour. Réservée à l'agence : les mannequins ne peuvent pas la télécharger. Aucune pièce d'identité.</p>
<div id="fiches-evenement-liste">Ouvrez cette section pour charger la liste.</div>
</details>`;
(function () {
  var racine = document.getElementById('fiches-evenement-racine');
  if (racine) racine.innerHTML = window.GABARIT_FICHES_EVENEMENT;
})();
