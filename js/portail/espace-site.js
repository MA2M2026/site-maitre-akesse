// Espace 1 — Administration du site (cahier v2.4, 3.1) : tout l'ancien tableau de bord, ouvert
// DANS l'Administration, avec la même connexion (aucune deuxième connexion). La tuile mène à
// tableau-de-bord.html, qui se met alors en « mode Administration » (js/mode-administration.js :
// sans argent, sans les anciens codes, verrouillage à 4 chiffres et 8 heures au plus).
(function () {
  'use strict';
  const P = window.Portail;
  P.actions['espace1-reessayer'] = () => { location.assign('/tableau-de-bord.html'); };
  P.espaces.site = {
    nav: [['accueil', 'Ouvrir l’espace']],
    pages: {
      accueil: async () => {
        if (sessionStorage.getItem('ma2m_espace1_refuse')) {
          sessionStorage.removeItem('ma2m_espace1_refuse');
          return P.entete(P.ESPACES.site) + '<div class="note erreur">Votre compte n’a pas encore les droits de l’Administration du site. ' +
            'L’administrateur principal peut vous les donner dans Sécurité › Comptes et rôles (rôle « Administrateur du site »).</div>' +
            '<p style="margin-top:12px"><button class="btn" type="button" data-action="espace1-reessayer">Réessayer</button></p>';
        }
        location.assign('/tableau-de-bord.html');
        return P.entete(P.ESPACES.site) + '<div class="carte"><p class="doux">Ouverture de l’Administration du site…</p></div>';
      }
    }
  };
})();
