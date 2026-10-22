// Nouvelle Administration — bloc 1 « Administration du site », reconstruit à neuf, rubrique par
// rubrique (PLAN-NOUVELLE-ADMINISTRATION.md). Plus de cadre vers l'ancien tableau de bord :
// chaque rubrique est une page du portail, dans un fichier js/admin/site-*.js qui l'ajoute à
// P.espaces.site.pages. Une rubrique pas encore reconstruite l'indique clairement.
(function () {
  'use strict';
  const P = window.Portail;
  if (!P) return;
  // [clé, libellé] ; une entrée sans clé est un titre de groupe
  const MENU = [
    [null, 'Pilotage'],
    ['v2-ensemble', 'Vue d’ensemble'], ['b1-a-traiter', 'À traiter'], ['v2-top3', 'Top 3 et classement'],
    ['b1-repartition', 'Répartition des profils'], ['b1-evolution', 'Évolution des candidatures'],
    [null, 'Castings'],
    ['b2-candidatures', 'Candidatures casting'], ['b2-projets', 'Projets et castings'],
    ['b2-messages-groupes', 'Messages groupés'], ['b2-convocations', 'Convocations'],
    [null, 'Mannequins'],
    ['b2-mannequins-publies', 'Mannequins'], ['b2-validations', 'Validations en attente'], ['b3c-vedette-admin', 'Mannequin à la une'],
    ['b2-tri-photos', 'Photos triées par l’IA'], ['b2-rapport-profils', 'Rapport des profils'], ['b2-fiches-evenement', 'Fiches événement'],
    [null, 'Relations'],
    ['b2-recruteurs', 'Demandes recruteurs'], ['b2-contacts', 'Messages de contact'],
    [null, 'Contenu du site'],
    ['actualites', 'Actualités'], ['evenements', 'Événements'], ['partenaires', 'Partenaires'],
    ['b3c-mot-fondateur', 'Mot du fondateur'], ['b3c-agenda', 'Agenda du site'], ['b3d-video-accueil', 'Vidéo de l’accueil'], ['b3c-instagram', 'Flux Instagram'],
    [null, 'Accès et outils'],
    ['b3b-codes-inscription', 'Codes d’accès'], ['b3b-acces-bloques', 'Accès bloqués'], ['b3a-drive', 'Drive et transferts'],
    ['b3a-nettoyage', 'Nettoyage des photos'], ['b3a-erreurs', 'Erreurs du site']
  ];
  const pages = {};
  MENU.forEach((m) => {
    if (!m[0]) return;
    pages[m[0]] = async () => P.entete(m[1]) +
      '<div class="carte"><h2>Pièce en construction</h2><p class="doux">Cette rubrique est en cours de reconstruction dans la nouvelle Administration. ' +
      'Elle reste disponible dans l’Administration actuelle en attendant.</p></div>';
  });
  P.espaces.site = { nav: MENU, pages, apres: {} };
})();
