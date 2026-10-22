// Rapport des profils (logique : js/rapport-profils-admin.js).
// Écran en un seul endroit (22/10/2026) : utilisé par l'ancien tableau de bord (placé tout de
// suite dans #rapport-profils-racine) et par la nouvelle Administration, sans recopier le code.
window.GABARIT_RAPPORT_PROFILS = `<details id="rapport-profils-details">
<summary class="dossiers-entete tdb-16">
<h2 class="tdb-10">🩺 Rapport des profils</h2>
</summary>
<p class="tdb-17">Le site passe en revue chaque mannequin : identité, parcours, mensurations manquantes ou incohérentes, photo de profil, couverture et nombre de photos (10 au moins). Pour chaque profil à compléter, un message personnel est prêt : cochez les mannequins et envoyez-le par WhatsApp, chacune reçoit le sien.</p>
<div id="rapport-profils-liste">Ouvrez cette section pour lancer l’analyse.</div>
</details>`;
(function () {
  var racine = document.getElementById('rapport-profils-racine');
  if (racine) racine.innerHTML = window.GABARIT_RAPPORT_PROFILS;
})();
