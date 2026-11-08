// Page « Intégrer l'agence » (integrer-agence.html et en/integrer-agence.html, réorganisée le 08/11/2026) : les deux
// parcours (« Je débute » / « J'ai déjà été mannequin ») se choisissent en touchant une carte ou un bouton ; le choix
// règle tout seul la liste « Avez-vous déjà été mannequin ? » du formulaire (js/formulaire-candidature.js écoute son
// changement : photos demandées, mensurations, lien facultatif vers son travail), puis amène au formulaire.
(function () {
  'use strict';
  const liste = document.getElementById('ca-experience');
  if (!liste) return;
  const cartes = document.querySelectorAll('.ia-parcours-carte');
  function marquer(valeur) {
    cartes.forEach((c) => c.classList.toggle('choisie', c.dataset.parcours === valeur));
  }
  function choisir(valeur, versFormulaire) {
    liste.value = valeur;
    liste.dispatchEvent(new Event('change', { bubbles: true }));
    marquer(valeur);
    if (versFormulaire) {
      const cible = document.getElementById('form-casting');
      if (cible && typeof cible.scrollIntoView === 'function') cible.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }
  // boutons du haut : vont aux parcours (lien #parcours) et préparent le choix
  document.querySelectorAll('.ia-choix-rapide [data-parcours-choix]').forEach((b) => b.addEventListener('click', () => choisir(b.dataset.parcoursChoix, false)));
  // cartes : toute la carte se touche ; son bouton amène au formulaire
  cartes.forEach((c) => {
    c.addEventListener('click', (e) => choisir(c.dataset.parcours, !!e.target.closest('button')));
  });
  // la liste du formulaire garde les cartes à jour (si on choisit directement dans le formulaire)
  liste.addEventListener('change', () => marquer(liste.value));
})();
