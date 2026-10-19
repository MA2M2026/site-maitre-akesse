// Verrouillage de l'Administration après 15 minutes sans geste (cahier v2.3, « Appareils et
// sessions ») — partagé par la coque de l'Administration (js/portail/noyau.js) et les écrans de
// l'espace 1 ouverts dans l'Administration (js/mode-administration.js : ancien tableau de bord,
// actualités, événements, partenaires).
//   surveillerInactivitePortail({ actif, pinDefini, verrouiller }) : actif() et pinDefini()
//   renvoient vrai ou faux ; verrouiller() est appelée au bout de 15 minutes sans geste.
// À chaque geste (au plus une fois par minute), le serveur est prévenu : il verrouille aussi de
// lui-même 16 minutes après le dernier signe de vie, même si l'écran ne l'a pas fait.
(function () {
  'use strict';
  const INACTIVITE_MS = 15 * 60 * 1000;
  let minuteur = 0, dernierSigne = 0, reglages = null, branche = false;
  function relancer() {
    if (!reglages || !reglages.actif()) return;
    clearTimeout(minuteur);
    if (reglages.pinDefini() && Date.now() - dernierSigne > 60000) {
      dernierSigne = Date.now();
      sb.rpc('portail_code_appareil_activite', { p_appareil: identifiantAppareilPortail() })
        .then(() => { /* signe de vie reçu */ }, () => { /* réessayé au prochain geste */ });
    }
    minuteur = setTimeout(reglages.verrouiller, INACTIVITE_MS);
  }
  window.surveillerInactivitePortail = (r) => {
    reglages = r;
    if (!branche) {
      ['pointerdown', 'keydown', 'scroll'].forEach((t) => addEventListener(t, relancer, { passive: true }));
      branche = true;
    }
    relancer();
  };
  window.arreterInactivitePortail = () => { clearTimeout(minuteur); };
})();
