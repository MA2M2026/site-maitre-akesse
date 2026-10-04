// ================== Tableau de bord — nouvelle présentation (version blanche) ==================
// Demande de la propriétaire (04/10/2026), d'après un modèle « Dashboard Pro » :
//   - en haut, 3 boutons arrondis = les 3 blocs du tableau de bord ;
//   - dessous, un grand cadre blanc : menu à gauche (avec icônes), barre de recherche,
//     titre de la page, puis la rubrique choisie ;
//   - une page « Vue d'ensemble » : les chiffres clés + les alertes à traiter.
// Tout repose sur la navigation existante (menu .tdb-menu-item / sections [data-section]) :
// ce fichier ne fait que la réorganiser à l'écran. Un bouton permet de revenir à l'ancienne
// présentation (mémorisé sur l'appareil, clé ma2m_tdb_v2).
(function () {
  var CLE = 'ma2m_tdb_v2';
  var ENSEMBLE = 'v2-ensemble';
  var BLOCS = [
    ['tdb-bloc-1', 'Pilotage & activité'],
    ['tdb-bloc-2', 'Mannequins & castings'],
    ['tdb-bloc-3', 'Administration du site']
  ];

  // Icônes au trait (style « Lucide »), une par rubrique du menu.
  var P = {
    grille: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    etoile: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    courbe: '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>',
    trophee: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    barres: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    coche: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>',
    camembert: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
    tendance: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    fichier: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    eclair: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    ajoutPersonne: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
    bouclier: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 16l-5-5L5 21"/>',
    fichierOk: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 15l2 2 4-4"/>',
    megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 8a5 5 0 0 1 0 8"/>',
    calendrier: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    mallette: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    nuage: '<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/>',
    corbeille: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
    envoi: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    alerte: '<path d="M12 3L2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    cle: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
    cadenas: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    personne: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    appareil: '<rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>',
    drapeau: '<path d="M4 21V4M4 4h12l-2 4 2 4H4"/>',
    plume: '<path d="M20 4c-6 0-12 4-14 12l-2 4 4-2c8-2 12-8 12-14z"/><path d="M8 16l6-6"/>',
    lien: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    point: '<circle cx="12" cy="12" r="3"/>'
  };
  var ICONES = {
    'v2-ensemble': 'grille', 'b1-vedette': 'etoile', 'b1-stats': 'courbe', 'b1-top3': 'trophee', 'b1-classement': 'barres',
    'b1-a-traiter': 'coche', 'b1-repartition': 'camembert', 'b1-evolution': 'tendance', 'b1-derniers-dossiers': 'fichier',
    'b1-actions-rapides': 'eclair', 'b2-inscriptions': 'ajoutPersonne', 'b2-validations': 'bouclier', 'b2-mannequins-publies': 'image',
    'b2-candidatures': 'fichierOk', 'b2-messages-groupes': 'megaphone', 'b2-projets': 'calendrier', 'b2-recruteurs': 'mallette',
    'b2-contacts': 'message', 'b3a-drive': 'nuage', 'b3a-nettoyage': 'corbeille', 'b3a-miniatures': 'image', 'b3a-migration-r2': 'envoi',
    'b3a-erreurs': 'alerte', 'b3b-code-validation': 'bouclier', 'b3b-codes-inscription': 'cle', 'b3b-code-permanent': 'cadenas',
    'b3b-creer-admin': 'personne', 'b3c-instagram': 'appareil', 'b3c-vedette-admin': 'etoile', 'b3c-bandeau': 'drapeau',
    'b3c-mot-fondateur': 'plume'
  };
  function svg(nom) {
    return '<svg class="v2-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[nom] || P.point) + '</svg>';
  }
  // Les alertes « À traiter » ouvrent la bonne rubrique (avant : elles faisaient défiler
  // vers une liste cachée depuis l'arrivée du menu par blocs).
  var ALERTES = [
    [/validation/i, 'b2-validations'], [/candidature/i, 'b2-candidatures'],
    [/inscription/i, 'b2-inscriptions'], [/recruteur/i, 'b2-recruteurs']
  ];

  function estV2() { return document.body.classList.contains('tdb-v2'); }
  function actif() {
    try { return localStorage.getItem(CLE) !== '0'; } catch (e) { return true; }
  }
  function appliquer(on) {
    document.body.classList.toggle('tdb-v2', on);
    var bouton = document.getElementById('v2-bascule');
    if (bouton) bouton.textContent = on ? '↺ Ancienne présentation' : '✨ Nouvelle présentation';
  }
  function item(cle) { return document.querySelector('.tdb-menu-item[data-tdb-cible="' + cle + '"]'); }
  function aller(cle) { var b = item(cle); if (b) b.click(); }

  function blocActif() {
    var it = document.querySelector('.tdb-menu-item.actif[data-tdb-cible]');
    var bloc = it && it.closest('.tdb-menu-bloc');
    return bloc ? bloc.id : null;
  }
  function libelle(btn) {
    var l = btn && btn.querySelector('.v2-lib');
    return l ? l.textContent : (btn ? btn.textContent.trim() : '');
  }
  function majEtat() {
    var id = blocActif();
    document.querySelectorAll('.v2-bloc').forEach(function (p) {
      var on = p.dataset.bloc === id;
      p.classList.toggle('actif', on);
      p.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var courant = document.querySelector('.tdb-menu-item.actif[data-tdb-cible]');
    var ensemble = !!courant && courant.dataset.tdbCible === ENSEMBLE;
    document.body.classList.toggle('v2-mode-ensemble', ensemble);
    var titre = document.getElementById('v2-titre');
    if (titre) titre.textContent = (!courant || ensemble) ? 'Tableau de bord' : libelle(courant);
  }

  // « Vue d'ensemble » = les chiffres clés (Statistiques) + les alertes (À traiter) sur une page.
  function ouvrirEnsemble() {
    aller('b1-stats');
    document.querySelectorAll('[data-section]').forEach(function (el) {
      el.classList.toggle('tdb-actif', el.id === 'stats-grille' || el.dataset.section === 'b1-a-traiter');
    });
    document.querySelectorAll('.tdb-menu-item[data-tdb-cible]').forEach(function (b) {
      b.classList.toggle('actif', b.dataset.tdbCible === ENSEMBLE);
    });
    try { history.replaceState(history.state, '', location.pathname + location.search + '#' + ENSEMBLE); } catch (e) {}
    majEtat();
  }
  function ouvrirBloc(id) {
    if (id === 'tdb-bloc-1') { ouvrirEnsemble(); return; }
    var premier = document.querySelector('#' + id + ' .tdb-menu-item[data-tdb-cible]');
    if (premier) premier.click();
  }

  function decorerMenu(menu) {
    // Entrée « Vue d'ensemble » en tête du bloc 1.
    var bloc1 = document.getElementById('tdb-bloc-1');
    var premier = bloc1 && bloc1.querySelector('.tdb-menu-item');
    if (premier && !item(ENSEMBLE)) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tdb-menu-item v2-seulement';
      b.dataset.tdbCible = ENSEMBLE;
      b.textContent = 'Vue d’ensemble';
      b.addEventListener('click', ouvrirEnsemble);
      premier.parentNode.insertBefore(b, premier);
    }
    // Icône + libellé sans émoji (l'ancienne présentation garde son texte d'origine).
    menu.querySelectorAll('.tdb-menu-item').forEach(function (btn) {
      if (btn.querySelector('.v2-ico')) return;
      var texte = btn.textContent.trim();
      var propre = texte.replace(/^[^\p{L}\p{N}]+/u, '');
      var nom = ICONES[btn.dataset.tdbCible] || (btn.tagName === 'A' ? 'lien' : 'point');
      btn.innerHTML = svg(nom) + '<span class="v1-lib"></span><span class="v2-lib"></span>';
      btn.querySelector('.v1-lib').textContent = texte;
      btn.querySelector('.v2-lib').textContent = propre;
    });
    // Pastille rouge sur « À traiter » = nombre d'actions en attente.
    var aTraiter = item('b1-a-traiter'), total = document.getElementById('a-traiter-total');
    if (aTraiter && total && !aTraiter.querySelector('.v2-badge')) {
      var badge = document.createElement('span');
      badge.className = 'v2-badge';
      aTraiter.appendChild(badge);
      var maj = function () {
        var n = parseInt((total.textContent || '').replace(/\D+/g, ''), 10) || 0;
        badge.textContent = n > 99 ? '99+' : String(n);
        badge.hidden = !n;
      };
      new MutationObserver(maj).observe(total, { childList: true, characterData: true, subtree: true });
      maj();
    }
  }

  function construire() {
    var bloc = document.getElementById('bloc-tableau');
    var shell = document.querySelector('#bloc-tableau .db-shell');
    var main = document.querySelector('#bloc-tableau .db-main');
    var menu = document.getElementById('tdb-menu-panel');
    var topbar = document.querySelector('#bloc-tableau .db-topbar');
    if (!bloc || !shell || !main || !menu || !topbar || document.getElementById('v2-blocs')) return;

    // Les 3 blocs, au-dessus du grand cadre blanc.
    var nav = document.createElement('nav');
    nav.id = 'v2-blocs';
    nav.className = 'v2-blocs';
    nav.setAttribute('aria-label', 'Les 3 blocs du tableau de bord');
    nav.innerHTML = BLOCS.map(function (b, i) {
      return '<button type="button" class="v2-bloc" data-bloc="' + b[0] + '" aria-pressed="false"><span class="v2-num">' + (i + 1) + '</span><span class="v2-libelle">' + b[1] + '</span></button>';
    }).join('');
    shell.parentNode.insertBefore(nav, shell);
    nav.addEventListener('click', function (e) {
      var p = e.target.closest('.v2-bloc');
      if (p) ouvrirBloc(p.dataset.bloc);
    });

    // Le menu devient la colonne de gauche du cadre, avec le logo.
    if (!menu.querySelector('.v2-marque')) {
      var marque = document.createElement('a');
      marque.className = 'v2-marque';
      marque.href = 'index.html';
      marque.innerHTML = '<img src="assets/logo-header.png" alt="Maître Akesse Model Management">';
      menu.insertBefore(marque, menu.firstChild);
    }
    shell.insertBefore(menu, main);
    decorerMenu(menu);

    // Barre du haut : recherche à gauche, bouton de bascule à droite.
    var droite = topbar.querySelector('.db-topbar-droite');
    // Bascule entre les deux présentations : dans la barre du haut (nouvelle présentation)
    // et dans le menu (l'ancienne présentation masque cette barre).
    var basculer = function () {
      var on = !estV2();
      var fermer = document.getElementById('tdb-menu-fermer');
      if (menu.classList.contains('ouvert') && fermer) fermer.click();
      try { localStorage.setItem(CLE, on ? '1' : '0'); } catch (e) {}
      appliquer(on);
      var courant = document.querySelector('.tdb-menu-item.actif[data-tdb-cible]');
      if (on && !courant) ouvrirEnsemble();
      else if (!on && courant && courant.dataset.tdbCible === ENSEMBLE) aller('b1-stats');
      majEtat();
    };
    if (droite && !document.getElementById('v2-bascule')) {
      var bascule = document.createElement('button');
      bascule.type = 'button';
      bascule.id = 'v2-bascule';
      bascule.className = 'v2-bascule';
      bascule.addEventListener('click', basculer);
      droite.insertBefore(bascule, droite.firstChild);
    }
    var repere = document.getElementById('tdb-menu-deconnexion-rapide');
    if (repere && !document.getElementById('v2-bascule-menu')) {
      var dansMenu = document.createElement('button');
      dansMenu.type = 'button';
      dansMenu.id = 'v2-bascule-menu';
      dansMenu.className = 'tdb-menu-accueil v2-bascule-menu';
      dansMenu.textContent = '✨ Nouvelle présentation (version blanche)';
      dansMenu.addEventListener('click', basculer);
      repere.parentNode.insertBefore(dansMenu, repere.nextSibling);
    }
    if (!document.getElementById('v2-recherche')) {
      var champ = document.createElement('label');
      champ.className = 'v2-recherche';
      champ.innerHTML = svg('point').replace(P.point, '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>') + '<input id="v2-recherche" type="search" placeholder="Rechercher une rubrique : inscriptions, castings, codes…" autocomplete="off"><div class="v2-resultats" id="v2-resultats"></div>';
      topbar.insertBefore(champ, topbar.firstChild);
      var input = champ.querySelector('input'), res = champ.querySelector('.v2-resultats');
      var sansAccents = function (t) { return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
      input.addEventListener('input', function () {
        var q = sansAccents(input.value.trim());
        if (!q) { res.innerHTML = ''; res.classList.remove('ouvert'); return; }
        var trouves = Array.prototype.slice.call(document.querySelectorAll('.tdb-menu-item[data-tdb-cible]'))
          .filter(function (b) { return sansAccents(libelle(b)).indexOf(q) !== -1; }).slice(0, 8);
        res.innerHTML = '';
        if (!trouves.length) res.innerHTML = '<span class="v2-vide">Aucune rubrique trouvée</span>';
        trouves.forEach(function (b) {
          var r = document.createElement('button');
          r.type = 'button';
          r.dataset.cible = b.dataset.tdbCible;
          r.textContent = libelle(b);
          res.appendChild(r);
        });
        res.classList.add('ouvert');
      });
      res.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-cible]');
        if (!b) return;
        aller(b.dataset.cible);
        input.value = ''; res.innerHTML = ''; res.classList.remove('ouvert');
      });
      document.addEventListener('click', function (e) { if (!champ.contains(e.target)) res.classList.remove('ouvert'); });
    }

    // Titre de la page + 2 raccourcis, sous la barre du haut.
    if (!document.getElementById('v2-entete')) {
      var entete = document.createElement('div');
      entete.id = 'v2-entete';
      entete.className = 'v2-entete';
      entete.innerHTML = '<div><h1 id="v2-titre">Tableau de bord</h1><p>Bonjour Maître Akesse — voici l’activité de l’agence aujourd’hui.</p></div>'
        + '<div class="v2-entete-actions"><button type="button" class="v2-action" data-aller="b2-messages-groupes">📣 Messages groupés</button>'
        + '<button type="button" class="v2-action v2-action-principale" data-aller="b2-projets">+ Nouveau casting</button></div>';
      topbar.parentNode.insertBefore(entete, topbar.nextSibling);
      entete.addEventListener('click', function (e) {
        var b = e.target.closest('[data-aller]');
        if (!b) return;
        aller(b.dataset.aller);
        if (b.dataset.aller === 'b2-projets') {
          var nom = document.getElementById('nouveau-projet-nom');
          if (nom) setTimeout(function () { nom.focus(); }, 80);
        }
      });
    }

    // Alertes cliquables (nouvelle présentation uniquement).
    document.addEventListener('click', function (e) {
      if (!estV2()) return;
      var a = e.target.closest && e.target.closest('.a-traiter-item');
      if (!a) return;
      var texte = a.textContent;
      for (var i = 0; i < ALERTES.length; i++) {
        if (ALERTES[i][0].test(texte)) { e.stopPropagation(); e.preventDefault(); aller(ALERTES[i][1]); return; }
      }
    }, true);

    new MutationObserver(majEtat).observe(menu, { subtree: true, attributes: true, attributeFilter: ['class'] });
    majEtat();
  }

  // Après connexion, l'ancienne présentation ouvre l'écran « 3 blocs » ; ici on ouvre
  // directement la vue d'ensemble, le menu de gauche remplaçant cet écran.
  function apresAffichage() {
    if (!estV2()) return;
    var landing = document.getElementById('tdb-landing');
    if (landing && landing.style.display !== 'none' && !blocActif()) ouvrirEnsemble();
  }

  function demarrer() {
    construire();
    appliquer(actif());
    var bloc = document.getElementById('bloc-tableau');
    if (bloc) new MutationObserver(function () { if (bloc.style.display !== 'none') setTimeout(apresAffichage, 50); })
      .observe(bloc, { attributes: true, attributeFilter: ['style', 'class'] });
    var landing = document.getElementById('tdb-landing');
    if (landing) new MutationObserver(function () { setTimeout(apresAffichage, 50); })
      .observe(landing, { attributes: true, attributeFilter: ['style'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
