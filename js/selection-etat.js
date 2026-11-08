// Page « Ma sélection » : décide AVANT l'affichage si la sélection est vide, pour ne
// pas montrer le formulaire puis le cacher une fois tout chargé (le bas de page
// « sautait » — score 0,30 relevé le 30/09). Voir « Ma sélection » dans css/style.css.
(function () {
  let vide = true, nombre = 0;
  try { nombre = (JSON.parse(localStorage.getItem('ma2m_selection')) || []).length; vide = !nombre; } catch (e) {}
  if (vide) document.documentElement.classList.add('selection-vide');
  // (08/11/2026, phase 3 V1) place des profils choisis réservée d'avance : la liste arrivait avec les programmes et
  // poussait le formulaire de 233 px pour 2 profils (saut mesuré sur téléphone)
  else document.documentElement.style.setProperty('--selection-n', String(Math.min(nombre, 50)));
})();
