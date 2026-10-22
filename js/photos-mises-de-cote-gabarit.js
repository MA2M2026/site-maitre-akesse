// Photos mises de côté (logique : js/photos-mises-de-cote.js).
// Écran en un seul endroit (22/10/2026) : utilisé par l'ancien tableau de bord (placé tout de
// suite dans #photos-mises-de-cote-racine) et par la nouvelle Administration, sans recopier le code.
window.GABARIT_PHOTOS_MISES_DE_COTE = `<details id="tri-photos-details">
<summary class="dossiers-entete tdb-16">
<h2 class="tdb-10">🗂️ Photos mises de côté</h2>
<span class="dossiers-compteur" id="tri-photos-compteur"></span>
</summary>
<p class="tdb-17">Il n'y a plus de tri des photos par l'IA. Restent ici les photos que l'ancienne IA avait mises de côté : c'est vous qui décidez de les remettre ou de les supprimer (définitif).</p>
<h3 class="tri-titre">Photos cachées sur la fiche publique</h3>
<div class="tri-grille" id="tri-ecartees">Ouvrez cette section pour charger les photos.</div>
<h3 class="tri-titre">À vérifier (encore en ligne)</h3>
<div class="tri-grille" id="tri-a-verifier"></div>
</details>`;
(function () {
  var racine = document.getElementById('photos-mises-de-cote-racine');
  if (racine) racine.innerHTML = window.GABARIT_PHOTOS_MISES_DE_COTE;
})();
