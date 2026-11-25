// Page « Intégrer l'agence » (integrer-agence.html et en/integrer-agence.html). Refonte du 25/11/2026 (Agence +
// MA2M Academy, validée par la propriétaire) : trois portes d'entrée — Talent Network (« reseau »), MA2M Academy
// (« academie »), équipe de l'agence / Agency Roster (« equipe »). Toucher une carte règle la liste « Votre parcours »
// du formulaire (#ca-porte) et, quand la porte le dit, « Avez-vous déjà été mannequin ? » (Talent Network = oui,
// Academy = non) ; js/formulaire-candidature.js écoute ce changement (photos, mensurations, lien vers son travail).
(function () {
  'use strict';
  const porte = document.getElementById('ca-porte');
  const experience = document.getElementById('ca-experience');
  if (!porte || !experience) return;
  const cartes = document.querySelectorAll('.ia-parcours-carte[data-porte]');
  const EXPERIENCE_DE = { reseau: 'oui', academie: 'non' };
  function marquer(valeur) {
    cartes.forEach((c) => {
      c.classList.toggle('choisie', c.dataset.porte === valeur);
      c.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(c.dataset.porte === valeur)));
    });
  }
  // passer à « débutant·e » vide les mensurations complètes (js/formulaire-candidature.js) : on prévient d'abord
  function mensurationsRemplies() {
    return [...document.querySelectorAll('.ca-mensuration-complete select, .ca-mensuration-complete input')].some((c) => c.value);
  }
  function reglerExperience(valeur) {
    if (!valeur || valeur === experience.value) return true;
    if (valeur === 'non' && mensurationsRemplies() && !confirm(document.documentElement.lang === 'en'
      ? 'Switch to the beginner path? Your shoe size, bust, waist and hip measurements will be cleared.'
      : 'Passer au parcours débutant·e ? Votre pointure, poitrine, tour de taille et tour de hanches seront effacés.')) return false;
    experience.value = valeur;
    experience.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  function choisir(valeur, versFormulaire) {
    if (!reglerExperience(EXPERIENCE_DE[valeur])) return;
    porte.value = valeur;
    porte.dispatchEvent(new Event('change', { bubbles: true }));
    marquer(valeur);
    if (versFormulaire) allerAuFormulaire();
  }
  function allerAuFormulaire() {
    const cible = document.getElementById('form-casting');
    if (!cible) return;
    // page « en écrans » (js/pages-ecrans.js) : on va à l'écran du formulaire ; sinon, on fait défiler
    if (window.PagesEcrans && window.PagesEcrans.montrer(cible)) return;
    if (typeof cible.scrollIntoView === 'function') cible.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  // cartes : toute la carte se touche ; son bouton amène au formulaire (le lien vers MA2M Academy reste un lien)
  cartes.forEach((c) => {
    c.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      choisir(c.dataset.porte, !!e.target.closest('button'));
    });
  });
  // la liste du formulaire garde les cartes à jour (si on choisit directement dans le formulaire)
  porte.addEventListener('change', () => { marquer(porte.value); reglerExperience(EXPERIENCE_DE[porte.value]); });
  // arrivée depuis un autre lien (#academie, #reseau, #equipe), par ex. le bouton « Postuler » de la page MA2M Academy
  const voulu = (location.hash || '').replace('#porte-', '');
  if (EXPERIENCE_DE[voulu] !== undefined || voulu === 'equipe') {
    porte.value = voulu; reglerExperience(EXPERIENCE_DE[voulu]);
    setTimeout(allerAuFormulaire, 600);
  }
  marquer(porte.value);
})();
