// Verrouillage de l'Administration après 15 minutes sans geste (cahier v2.3, « Appareils et
// sessions ») — utilisé par la coque de l'Administration (js/portail/noyau.js).
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
  // Heure (ms) du dernier code de l'application d'authentification, lue dans le jeton de
  // connexion (0 si absent : la base décide alors, voir portail_appareil_ok)
  window.dernierCodeApplicationPortail = (session) => {
    try {
      const charge = JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const t = (charge.amr || []).filter((m) => /totp/.test(m.method)).map((m) => m.timestamp);
      return t.length ? Math.max.apply(null, t) * 1000 : 0;
    } catch (e) { return 0; }
  };
  // Session de 8 heures au plus après ce code
  window.SESSION_MAX_PORTAIL_MS = 8 * 3600 * 1000;
})();
