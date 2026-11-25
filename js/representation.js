// Page « Agence de représentation » (representation.html et en/representation.html, 25/11/2026, demande de la
// propriétaire) : deux boutons. « Simple représentation » ouvre son parcours (Talent Network) et le formulaire, réglé
// d'avance (porte « reseau », déjà mannequin : js/integrer-agence.js) ; « Intégrer l'agence et me faire représenter »
// explique que l'entrée passe par MA2M Academy et mène à son formulaire (academie.html#porte-equipe).
(function () {
  'use strict';
  const boutons = document.querySelectorAll('.rp-bouton[data-choix]');
  if (!boutons.length) return;
  const VOLETS = { simple: ['simple', 'candidature'], integrer: ['integrer'] };
  function ouvrir(choix, defiler) {
    Object.values(VOLETS).flat().forEach((id) => { const v = document.getElementById(id); if (v) v.hidden = !VOLETS[choix].includes(id); });
    boutons.forEach((b) => { const oui = b.dataset.choix === choix; b.classList.toggle('choisi', oui); b.setAttribute('aria-expanded', String(oui)); });
    const cible = document.getElementById(VOLETS[choix][0]);
    if (defiler && cible && typeof cible.scrollIntoView === 'function') cible.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  boutons.forEach((b) => b.addEventListener('click', () => ouvrir(b.dataset.choix, true)));
  // lien direct (#simple, #integrer, #candidature) : le bon volet s'ouvre
  const h = (location.hash || '').slice(1);
  if (h === 'integrer') ouvrir('integrer', true);
  else if (h === 'simple' || h === 'candidature') ouvrir('simple', true);
  else {
    // un brouillon gardé sur l'appareil (js/brouillon.js) ou un envoi coupé qui reprend (js/envoi-fiable.js) : le
    // formulaire « Simple représentation » se rouvre tout seul, pour que la candidate voie son texte et le message d'envoi
    let brouillon = null;
    try { brouillon = localStorage.getItem('ma2m_brouillon_' + location.pathname.replace(/\.html$/, '') + '_form-casting'); } catch (e) { brouillon = null; }
    if (brouillon) ouvrir('simple', false);
    // (EnvoiFiable : constante globale de js/app.js, chargé avant ce fichier)
    else if (typeof EnvoiFiable !== 'undefined' && typeof EnvoiFiable.lire === 'function') {
      Promise.resolve(EnvoiFiable.lire('candidature')).then((e) => { if (e) ouvrir('simple', false); }).catch(() => {});
    }
  }
})();
