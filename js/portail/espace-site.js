// Espace 1 — Administration du site (cahier V3, 3.1) : l'ancien tableau de bord vit DANS le cadre
// du portail — même en-tête, même menu sombre, même bouton « Retour au portail » que les espaces
// 2 et 3. Chaque rubrique du menu ouvre la page correspondante de l'ancien tableau de bord
// (tableau-de-bord.html, actualités…) dans la zone centrale, sans quitter le portail et sans
// deuxième connexion. Les pages sont migrées une à une vers de vraies pages du portail ; en
// attendant, le cadre garde toutes les fonctions (js/mode-administration.js : sans argent, sans les
// anciens codes, verrouillage à 4 chiffres et 8 heures au plus).
(function () {
  'use strict';
  const P = window.Portail;
  const TDB = '/tableau-de-bord.html?cadre=1#';
  // [clé du menu, libellé, adresse de la page] — une adresse commençant par « # » désigne une rubrique
  // de l'ancien tableau de bord ; sinon c'est une page entière (actualités…)
  const MENU = [
    [null, 'Pilotage'],
    ['v2-ensemble', 'Vue d’ensemble', '#v2-ensemble'],
    ['b1-a-traiter', 'À traiter', '#b1-a-traiter'],
    ['v2-top3', 'Top 3 et classement', '#v2-top3'],
    ['b1-repartition', 'Répartition des profils', '#b1-repartition'],
    ['b1-evolution', 'Évolution des candidatures', '#b1-evolution'],
    [null, 'Mannequins'],
    ['b2-mannequins-publies', 'Mannequins', '#b2-mannequins-publies'],
    ['b2-validations', 'Validations en attente', '#b2-validations'],
    ['b3c-vedette-admin', 'Mannequin à la une', '#b3c-vedette-admin'],
    ['b2-tri-photos', 'Photos triées par l’IA', '#b2-tri-photos'],
    ['b2-rapport-profils', 'Rapport des profils', '#b2-rapport-profils'],
    ['b2-fiches-evenement', 'Fiches événement', '#b2-fiches-evenement'],
    [null, 'Castings'],
    ['b2-candidatures', 'Candidatures casting', '#b2-candidatures'],
    ['b2-projets', 'Projets et castings', '#b2-projets'],
    ['b2-messages-groupes', 'Messages groupés', '#b2-messages-groupes'],
    [null, 'Relations'],
    ['b2-recruteurs', 'Demandes recruteurs', '#b2-recruteurs'],
    ['b2-contacts', 'Messages de contact', '#b2-contacts'],
    [null, 'Contenu du site'],
    ['actualites', 'Actualités', '/actualites.html?cadre=1'],
    ['evenements', 'Événements', '/evenements.html?cadre=1'],
    ['partenaires', 'Partenaires', '/partenaires.html?cadre=1'],
    ['b3c-mot-fondateur', 'Mot du fondateur', '#b3c-mot-fondateur'],
    ['b3c-agenda', 'Agenda du site', '#b3c-agenda'],
    ['b3d-video-accueil', 'Vidéo de l’accueil', '#b3d-video-accueil'],
    ['b3c-instagram', 'Flux Instagram', '#b3c-instagram'],
    [null, 'Accès et outils'],
    ['b3b-codes-inscription', 'Codes d’accès', '#b3b-codes-inscription'],
    ['b3b-acces-bloques', 'Accès bloqués', '#b3b-acces-bloques'],
    ['b3a-drive', 'Drive et transferts', '#b3a-drive'],
    ['b3a-nettoyage', 'Nettoyage des photos', '#b3a-nettoyage'],
    ['b3a-erreurs', 'Erreurs du site', '#b3a-erreurs']
  ];
  const PAGES = {};
  MENU.forEach((m) => { if (m[0]) PAGES[m[0]] = m; });
  const adresse = (cle) => PAGES[cle][2].charAt(0) === '#' ? TDB + PAGES[cle][2].slice(1) : PAGES[cle][2];
  const genre = (cle) => PAGES[cle][2].charAt(0) === '#' ? 'tdb' : cle;

  function ouvrirDans(cadre, cle) {
    if (cadre.dataset.genre === genre(cle)) {
      // même page : on change seulement de rubrique, sans rien recharger
      try { cadre.contentWindow.ma2mOuvrirPage(cle); return; } catch (e) { /* page pas encore prête : rechargement ci-dessous */ }
    }
    cadre.dataset.genre = genre(cle);
    cadre.classList.add('cadre-cache');
    cadre.src = adresse(cle);
  }
  // la page de l'espace 1 apparaît quand elle a fini de charger (l'événement ne « remonte » pas : capture)
  // Pour le tableau de bord, la page se charge puis vérifie la session quelques secondes : on garde
  // « Chargement… » à l'écran jusqu'à la fin de cette vérification (9 s au plus), au lieu d'un écran noir.
  document.addEventListener('load', (e) => {
    const cadre = e.target;
    if (!cadre || cadre.id !== 'cadre-ancien') return;
    const montrer = () => cadre.classList.remove('cadre-cache');
    let essais = 0;
    const attendre = () => {
      let enCours = false;
      try { enCours = !!cadre.contentDocument.getElementById('tdb-verif-msg'); } catch (err) { enCours = false; }
      if (enCours && ++essais < 45) setTimeout(attendre, 200); else montrer();
    };
    attendre();
  }, true);

  P.actions['espace1-reessayer'] = () => { P.afficher(); };
  const pages = {};
  Object.keys(PAGES).forEach((cle) => {
    pages[cle] = async () => {
      const refus = sessionStorage.getItem('ma2m_espace1_refuse');
      if (refus) {
        sessionStorage.removeItem('ma2m_espace1_refuse');
        return P.entete(P.ESPACES.site) + '<div class="note erreur">' + (refus === 'ouverture'
          ? 'L’Administration du site n’a pas pu s’ouvrir (connexion internet coupée ou serveur occupé). Réessayez dans un instant.'
          : 'Votre compte n’a pas encore accès à l’Administration du site. Demandez à l’administrateur principal.') + '</div>' +
          '<p style="margin-top:12px"><button class="btn" type="button" data-action="espace1-reessayer">Réessayer</button></p>';
      }
      return '<p class="cadre-chargement">Chargement…</p><iframe id="cadre-ancien" class="cadre-ancien cadre-cache" title="' + P.esc(PAGES[cle][1]) + '" data-genre="' + genre(cle) + '" src="' + P.esc(adresse(cle)) + '"></iframe>';
    };
  });
  P.espaces.site = {
    nav: MENU.map((m) => m[0] ? [m[0], m[1]] : [null, m[1]]),
    pages,
    // rubrique choisie dans le menu alors que le cadre est déjà ouvert
    garder: (cle) => {
      const cadre = document.getElementById('cadre-ancien');
      if (cadre) { cadre.title = PAGES[cle][1]; ouvrirDans(cadre, cle); }
    }
  };
})();
