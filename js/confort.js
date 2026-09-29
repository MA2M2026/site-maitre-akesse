// ================== Confort de navigation (toutes les pages) ==================
// Ajouts validés par la propriétaire le 29/09/2026 :
//   - un œil pour voir le mot de passe qu'on tape ;
//   - un bouton « retour en haut » sur les pages longues ;
//   - un lien « Aller au contenu », invisible tant qu'on n'utilise pas le clavier
//     (il sert aux personnes qui naviguent au clavier ou avec un lecteur d'écran).
// Aucun style écrit dans le HTML (sécurité du site) : tout passe par des classes
// (voir « Confort de navigation » dans css/style.css).
(function () {
  const anglais = (document.documentElement.lang || '').indexOf('en') === 0;
  const T = anglais
    ? { voir: 'Show password', cacher: 'Hide password', haut: 'Back to top', contenu: 'Skip to content' }
    : { voir: 'Afficher le mot de passe', cacher: 'Masquer le mot de passe', haut: 'Retour en haut de la page', contenu: 'Aller au contenu' };

  const OEIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const OEIL_BARRE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/></svg>';

  // --- Œil sur chaque champ mot de passe (y compris ceux ajoutés plus tard) ---
  function equiperMotDePasse(champ) {
    if (champ.dataset.oeil) return;
    champ.dataset.oeil = '1';
    const cadre = document.createElement('span');
    cadre.className = 'champ-mdp';
    champ.parentNode.insertBefore(cadre, champ);
    cadre.appendChild(champ);
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'champ-mdp-oeil';
    bouton.setAttribute('aria-label', T.voir);
    bouton.setAttribute('aria-pressed', 'false');
    bouton.innerHTML = OEIL;
    bouton.addEventListener('click', () => {
      const visible = champ.type === 'password';
      champ.type = visible ? 'text' : 'password';
      bouton.innerHTML = visible ? OEIL_BARRE : OEIL;
      bouton.setAttribute('aria-label', visible ? T.cacher : T.voir);
      bouton.setAttribute('aria-pressed', String(visible));
      champ.focus();
    });
    cadre.appendChild(bouton);
  }
  function equiperTout(racine) {
    (racine || document).querySelectorAll('input[type="password"]:not([data-oeil])').forEach(equiperMotDePasse);
  }

  // --- Bouton retour en haut ---
  function boutonHaut() {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'retour-haut';
    bouton.setAttribute('aria-label', T.haut);
    bouton.title = T.haut;
    bouton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    bouton.addEventListener('click', () => {
      const doux = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      window.scrollTo({ top: 0, behavior: doux ? 'smooth' : 'auto' });
    });
    document.body.appendChild(bouton);
    let attente = false;
    function maj() {
      attente = false;
      bouton.classList.toggle('visible', window.scrollY > window.innerHeight * 1.5);
      // Au-dessus du bouton « Ma sélection » quand il est affiché (même coin).
      const panier = document.getElementById('ma2m-panier-widget');
      bouton.classList.toggle('retour-haut--rehausse', !!(panier && panier.offsetParent !== null));
    }
    window.addEventListener('scroll', () => { if (!attente) { attente = true; requestAnimationFrame(maj); } }, { passive: true });
    maj();
  }

  // --- Lien « Aller au contenu » (premier élément atteint avec la touche Tab) ---
  function lienContenu() {
    // Le premier bloc de contenu (sur l'accueil : la grande image #porte-entree), pas le menu.
    const candidats = [document.querySelector('main'), document.getElementById('contenu')]
      .concat(Array.from(document.querySelectorAll('section')));
    const cible = candidats.find(el => el && !el.closest('.menu-overlay'));
    if (!cible) return;
    if (!cible.id) cible.id = 'contenu-principal';
    if (!cible.hasAttribute('tabindex')) cible.setAttribute('tabindex', '-1');
    const lien = document.createElement('a');
    lien.className = 'lien-evitement';
    lien.href = '#' + cible.id;
    lien.textContent = T.contenu;
    lien.addEventListener('click', e => { e.preventDefault(); cible.focus(); cible.scrollIntoView(); });
    document.body.insertBefore(lien, document.body.firstChild);
  }

  function demarrer() {
    try { lienContenu(); } catch (e) {}
    try { equiperTout(); } catch (e) {}
    try { boutonHaut(); } catch (e) {}
    // Champs créés après coup (fenêtres du tableau de bord, etc.).
    try {
      let prevu = false;
      new MutationObserver(mutations => {
        if (prevu || !mutations.some(m => m.addedNodes.length)) return;
        prevu = true;
        requestAnimationFrame(() => { prevu = false; equiperTout(); });
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
