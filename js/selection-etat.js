// Page « Ma sélection » : décide AVANT l'affichage si la sélection est vide, pour ne
// pas montrer le formulaire puis le cacher une fois tout chargé (le bas de page
// « sautait » — score 0,30 relevé le 30/09). Voir « Ma sélection » dans css/style.css.
(function () {
  var vide = true;
  try { vide = !(JSON.parse(localStorage.getItem('ma2m_selection')) || []).length; } catch (e) {}
  if (vide) document.documentElement.classList.add('selection-vide');
})();
