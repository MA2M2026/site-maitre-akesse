// Écran « Vidéo de l'accueil » (js/couverture-admin.js) : choix, aperçu, compression et envoi de la vidéo.
// Écran en un seul endroit (22/10/2026) : utilisé par l'ancien tableau de bord (placé tout de
// suite dans #video-accueil-racine) et par la nouvelle Administration, sans recopier le code.
window.GABARIT_VIDEO_ACCUEIL = `<h2 class="tdb-4">Vidéo de la page d'accueil</h2>
<p class="tdb-5">Un grand espace vidéo, d'un bord à l'autre de l'écran, dans le corps de la page d'accueil (juste après « Mannequin à la une »), en français et en anglais. Tant qu'aucune vidéo n'est choisie, cet espace reste caché. La vidéo démarre sans le son ; le visiteur peut l'activer d'un appui. Verticale ou horizontale : l'espace prend la forme de votre vidéo. Un film de défilé, de shooting ou de coulisses, jusqu'à 10 minutes, filmé en HD. Pour une longue vidéo, utilisez de préférence un ordinateur : la préparation prend à peu près la durée de la vidéo.</p>
<div id="va-etat" class="tdb-31">Chargement…</div>
<div class="couv-apercu" id="va-apercu"></div>
<div class="form-champ"><label for="va-fichier">1. Choisissez une vidéo, verticale ou horizontale (MP4, MOV, WebM…)</label><input accept="video/*" id="va-fichier" type="file"/></div>
<div id="va-infos" class="tdb-31"></div>
<div class="couv-barre u-hidden" id="va-barre"><span id="va-barre-rempli"></span></div>
<div class="tdb-28">
<button class="btn btn--principal" id="va-publier-btn" disabled>2. Mettre cette vidéo sur l'accueil</button>
<button class="btn" id="va-animation-btn">Retirer la vidéo</button>
</div>
<div class="form-msg" id="va-msg"></div>`;
(function () {
  var racine = document.getElementById('video-accueil-racine');
  if (racine) racine.innerHTML = window.GABARIT_VIDEO_ACCUEIL;
})();
