// Paiements et Comptabilité rangés comme l'Administration du site (11/11/2026, demande de la propriétaire : « tout
// rendre premium, beaucoup plus simplifié ») : chaque bloc s'ouvre sur une page d'entrée (« accueil ») avec ses
// rubriques groupées (icône + petite explication), les outils rares repliés ; dans une rubrique, le menu de côté ne
// montre plus que les rubriques de son groupe (js/admin/coque.js, P.tuileDe). Les adresses des rubriques ne
// changent pas. Chargé après les espaces (admin/index.html). Chaque rubrique est rangée dans UN groupe
// (contrôlé par test-nouvelle-admin.js) ; une rubrique ajoutée plus tard sans groupe va dans « Autres ».
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces) return;
  const GROUPES = {
    paiements: [
      { cle: 'mois', ic: '📅', titre: 'Ce mois-ci', pages: ['tableau', 'a-valider', 'mensualites', 'messages'], plus: ['matrice', 'rapprochement', 'recapitulatif', 'figes'] },
      { cle: 'mannequins', ic: '💃', titre: 'Mannequins', pages: ['registre', 'ajouter', 'codes', 'reprise'], plus: ['sorties'] },
      { cle: 'reglages', ic: '⚙️', titre: 'Réglages', pages: ['parametres'], plus: ['archives-rodage'] }
    ],
    compta: [
      { cle: 'quotidien', ic: '📒', titre: 'Au quotidien', pages: ['mois', 'recettes', 'depenses', 'cachets'], plus: ['cachets-rapport'] },
      { cle: 'tresorerie', ic: '💰', titre: 'Trésorerie', pages: ['tresorerie', 'a-recevoir', 'a-payer'], plus: ['personnel', 'materiel', 'carnet'] },
      { cle: 'cloture', ic: '🔒', titre: 'Fin du mois', pages: ['cloture-guidee', 'dossier'], plus: [] },
      { cle: 'documents', ic: '🧾', titre: 'Documents et réglages', pages: ['documents', 'impots'], plus: ['identite', 'acces'] }
    ]
  };
  const INFOS = {
    tableau: ['📊', 'Qui a payé, qui est en retard, ce mois-ci'], 'a-valider': ['✅', 'Les « J’ai payé » à vérifier'],
    mensualites: ['💳', 'Les mensualités du mois, mannequin par mannequin'], messages: ['💬', 'Rappels et relances des paiements'],
    rapprochement: ['🔗', 'Relier les paiements Wave aux mannequins'], recapitulatif: ['🧾', 'Le bilan de fin de mois'], figes: ['🧊', 'Les mois déjà arrêtés'],
    registre: ['📚', 'Toutes les mannequins de l’agence'], ajouter: ['➕', 'Une mannequin venue directement à l’agence'],
    codes: ['🔑', 'Codes pour créer leur espace, anciennes comprises'], reprise: ['🎓', 'Niveau, mois déjà faits, inscription de chacune'],
    sorties: ['🚪', 'Mannequins sorties ou suspendues'], matrice: ['🗓️', 'Tous les mois, toutes les mannequins'],
    parametres: ['⚙️', 'Montants, Wave, rappels automatiques'], 'archives-rodage': ['🗄️', 'Septembre à novembre 2026, en lecture seule'],
    mois: ['📊', 'Recettes, dépenses et solde du mois'], recettes: ['📥', 'L’argent qui entre'], depenses: ['📤', 'L’argent qui sort'],
    cachets: ['💰', 'Payer les mannequins pour leurs prestations'], 'cachets-rapport': ['📑', 'Le rapport des cachets payés'],
    tresorerie: ['🏦', 'Caisse et comptes'], 'a-recevoir': ['🤲', 'Ce qu’on nous doit'], 'a-payer': ['🧾', 'Ce qu’on doit'],
    personnel: ['👥', 'Personnel et prestataires'], materiel: ['🎥', 'Le matériel durable'], carnet: ['📇', 'Clients, fournisseurs, contacts'],
    'cloture-guidee': ['🔒', 'Arrêter le mois pas à pas'], dossier: ['📁', 'Le dossier du mois en PDF et Excel'],
    documents: ['📄', 'Devis, proforma, factures, reçus'], impots: ['🏛️', 'Impôts et taxes'], identite: ['🪪', 'L’identité légale de l’agence'],
    acces: ['🔐', 'L’accès du comptable']
  };
  const NOMS = { paiements: 'Paiements', compta: 'Comptabilité' };
  // rubriques visibles pour ce rôle (même filtre que le menu, js/portail/noyau.js)
  const visibles = (module) => P.espaces[module].nav.filter((n) => n[0] && n[0] !== 'accueil' && (!n[2] || n[2]()));
  const libelle = (module, cle) => (P.espaces[module].nav.find((n) => n[0] === cle) || [])[1] || cle;
  // groupes du bloc, avec « Autres » pour une rubrique pas encore rangée
  function groupes(module) {
    const g = GROUPES[module].map((x) => Object.assign({}, x));
    const ranges = new Set(g.flatMap((x) => x.pages.concat(x.plus)));
    const autres = visibles(module).map((n) => n[0]).filter((k) => !ranges.has(k));
    if (autres.length) g.push({ cle: 'autres', ic: '📂', titre: 'Autres', pages: autres, plus: [] });
    return g;
  }
  const rang = (module) => new Set(visibles(module).map((n) => n[0]));
  // la page d'entrée du bloc
  function pageAccueil(module) {
    const ok = rang(module), compte = P.espaces[module].compteur || {};
    const ligne = (k) => '<a class="tu-ligne" href="#/' + module + '/' + k + '"><em aria-hidden="true">' + ((INFOS[k] || [])[0] || '•') + '</em><span>' + P.esc(libelle(module, k)) +
      '<small>' + P.esc((INFOS[k] || [])[1] || '') + '</small></span>' + (compte[k] ? '<b>' + compte[k] + '</b>' : '<i aria-hidden="true">›</i>') + '</a>';
    return '<div class="tu-page"><div class="tu-tete"><a class="tu-retour" href="#/" aria-label="Retour à l’accueil">‹</a><h1>' + P.esc(NOMS[module]) + '</h1></div>' +
      groupes(module).map((g) => {
        const pages = g.pages.filter((k) => ok.has(k)), plus = g.plus.filter((k) => ok.has(k));
        if (!pages.length && !plus.length) return '';
        return '<h2 class="tu-question">' + P.esc(g.titre) + '</h2>' + (pages.length ? '<div class="tu-liste">' + pages.map(ligne).join('') + '</div>' : '') +
          (plus.length ? '<details class="tu-plus"><summary>Plus d’outils (' + plus.length + ')</summary><div class="tu-liste">' + plus.map(ligne).join('') + '</div></details>' : '');
      }).join('') + '</div>';
  }
  Object.keys(GROUPES).forEach((module) => {
    const esp = P.espaces[module];
    if (!esp) return;
    esp.pages.accueil = async () => pageAccueil(module);
    // en fin de liste : la première rubrique (Tableau du mois…) reste la page d'arrivée d'un compte à un seul bloc ;
    // les tuiles de l'accueil mènent, elles, à cette page d'entrée (js/admin/coque.js)
    esp.nav.push(['accueil', 'Toutes les rubriques']);
  });
  // menu de côté d'une rubrique : seulement son groupe (js/admin/coque.js)
  P.groupeBloc = (module, page) => {
    if (!GROUPES[module] || !P.espaces[module]) return null;
    if (page === 'accueil') return [[null, NOMS[module]], ['accueil', 'Toutes les rubriques']];  // (la page d'entrée les montre déjà toutes)
    const g = groupes(module).find((x) => x.pages.includes(page) || x.plus.includes(page));
    if (!g) return null;
    const ok = rang(module);
    return [[null, g.ic + ' ' + g.titre], ['accueil', 'Toutes les rubriques']].concat(g.pages.filter((k) => ok.has(k)).map((k) => [k, libelle(module, k)]))
      .concat(g.plus.filter((k) => ok.has(k)).length ? [[null, 'Plus d’outils']].concat(g.plus.filter((k) => ok.has(k)).map((k) => [k, libelle(module, k)])) : []);
  };
  P.GROUPES_BLOCS = GROUPES;
})();
