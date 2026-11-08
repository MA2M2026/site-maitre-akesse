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
    cartes.forEach((c) => {
      c.classList.toggle('choisie', c.dataset.parcours === valeur);
      c.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(c.dataset.parcours === valeur)));
    });
  }
  // passer à « débutant·e » vide les mensurations complètes (js/formulaire-candidature.js) : on prévient d'abord
  function mensurationsRemplies() {
    return [...document.querySelectorAll('.ca-mensuration-complete select, .ca-mensuration-complete input')].some((c) => c.value);
  }
  function choisir(valeur, versFormulaire) {
    if (valeur === liste.value) { marquer(valeur); if (versFormulaire) allerAuFormulaire(); return; }
    if (valeur === 'non' && mensurationsRemplies() && !confirm(document.documentElement.lang === 'en'
      ? 'Switch to the beginner path? Your shoe size, bust, waist and hip measurements will be cleared.'
      : 'Passer au parcours débutant·e ? Votre pointure, poitrine, tour de taille et tour de hanches seront effacés.')) return;
    liste.value = valeur;
    liste.dispatchEvent(new Event('change', { bubbles: true }));
    marquer(valeur);
    if (versFormulaire) allerAuFormulaire();
  }
  function allerAuFormulaire() {
    const cible = document.getElementById('form-casting');
    if (cible && typeof cible.scrollIntoView === 'function') cible.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  // boutons du haut : vont aux parcours (lien #parcours) et préparent le choix
  document.querySelectorAll('.ia-choix-rapide [data-parcours-choix]').forEach((b) => b.addEventListener('click', () => choisir(b.dataset.parcoursChoix, false)));
  // cartes : toute la carte se touche ; son bouton amène au formulaire
  cartes.forEach((c) => {
    c.addEventListener('click', (e) => choisir(c.dataset.parcours, !!e.target.closest('button')));
  });
  // la liste du formulaire garde les cartes à jour (si on choisit directement dans le formulaire)
  liste.addEventListener('change', () => marquer(liste.value));
  marquer(liste.value);
})();
