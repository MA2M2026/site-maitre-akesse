// ================== Tableau de bord — nouvelle présentation (version blanche) ==================
// Restructuration demandée par la propriétaire (04/10/2026) d'après la maquette blanche validée :
//   - en haut, 3 boutons = les 3 blocs ;
//   - un grand cadre blanc : menu de gauche regroupé (Bloc 1 — Pilotage, Analyses…), barre de
//     recherche (mannequin, candidature, casting), titre de page + 2 raccourcis ;
//   - « Vue d'ensemble » : 8 cartes de chiffres + « Alertes & rappels », calculés sur les vraies données.
// Les rubriques elles-mêmes restent celles du tableau de bord (sections [data-section]) : ce
// fichier les range autrement. Depuis le 04/10, c'est la seule présentation (l'ancienne,
// sombre, n'est plus proposée) ; elle ne s'applique qu'une fois connecté, l'écran de
// connexion gardant son habillage.
(function () {
  var ACCUEIL = 'v2-ensemble';

  // ---------- Icônes au trait ----------
  var P = {
    grille: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    courbe: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    etoile: '<path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.8 6.5 19.5l1-6.3L3 8.9 9 8z"/>',
    trophee: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/>',
    coche: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9"/>',
    camembert: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 4"/>',
    tendance: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
    fichier: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>',
    eclair: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
    ajoutPersonne: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0114 0M19 8v6M16 11h6"/>',
    bouclier: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 16l-5-5L5 21"/>',
    fichierOk: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/>',
    megaphone: '<path d="M3 11v2a1 1 0 001 1h3l6 4V6L7 10H4a1 1 0 00-1 1z"/><path d="M17 8a5 5 0 010 8"/>',
    calendrier: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    mallette: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/>',
    message: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
    nuage: '<path d="M7 18a5 5 0 111-9.9A6 6 0 0119 10a4 4 0 01-1 8z"/>',
    corbeille: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
    envoi: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3"/>',
    alerte: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>',
    cle: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
    cadenas: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
    personne: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    appareil: '<rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>',
    drapeau: '<path d="M4 21V4M4 4h12l-2 4 2 4H4"/>',
    plume: '<path d="M20 4c-6 0-12 4-14 12l-2 4 4-2c8-2 12-8 12-14z"/><path d="M8 16l6-6"/>',
    journal: '<path d="M4 4h13v16H6a2 2 0 01-2-2z"/><path d="M17 8h3v10a2 2 0 01-2 2M8 8h5M8 12h5M8 16h3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
    sortie: '<path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
    retour: '<path d="M3 12a9 9 0 109-9 9.5 9.5 0 00-6.5 2.7L3 8"/><path d="M3 3v5h5"/>',
    loupe: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    burger: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    croix: '<path d="M6 6l12 12M18 6L6 18"/>',
    groupe: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M17 11a3 3 0 100-6M21.5 20a5 5 0 00-4-4.9"/>',
    horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    oeil: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
  };
  function svg(nom, cls) {
    return '<svg class="' + (cls || 'v2-ico') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[nom] || '') + '</svg>';
  }

  // ---------- Nouvelle organisation du menu ----------
  // [clé, libellé, icône, pastille] — la clé est soit une rubrique existante (data-tdb-cible),
  // soit une page de cette présentation (v2-…), soit un lien (lien:adresse).
  var MENU = [
    { bloc: 1, nom: 'Pilotage & activité', groupes: [
      { titre: 'Bloc 1 — Pilotage', items: [
        [ACCUEIL, 'Vue d’ensemble', 'grille'],
        ['b1-stats', 'Statistiques', 'courbe'],
        ['b1-vedette', 'Mannequin à la une', 'etoile'],
        ['v2-top3', 'Top 3 & classement', 'trophee'],
        ['b1-a-traiter', 'À traiter', 'coche', 'aTraiter']
      ] },
      { titre: 'Analyses', items: [
        ['b1-repartition', 'Répartition des profils', 'camembert'],
        ['b1-evolution', 'Évolution des candidatures', 'tendance'],
        ['b1-derniers-dossiers', 'Derniers dossiers', 'fichier'],
        ['b1-actions-rapides', 'Actions rapides', 'eclair']
      ] }
    ] },
    { bloc: 2, nom: 'Mannequins & castings', groupes: [
      { titre: 'Bloc 2 — Mannequins', items: [
        ['b2-inscriptions', 'Inscriptions', 'ajoutPersonne', 'inscriptions'],
        ['b2-validations', 'Validations en attente', 'bouclier', 'validations'],
        ['b2-mannequins-publies', 'Mannequins publiés', 'image'],
        ['b2-tri-photos', 'Photos triées par l’IA', 'image'],
        ['b2-rapport-profils', 'Rapport des profils', 'fichierOk'],
        ['b2-fiches-evenement', 'Fiches événement', 'fichier']
      ] },
      { titre: 'Castings', items: [
        ['b2-candidatures', 'Candidatures', 'fichierOk', 'candidatures'],
        ['b2-projets', 'Projets & castings', 'calendrier'],
        ['b2-messages-groupes', 'Messages groupés', 'megaphone']
      ] },
      { titre: 'Relations', items: [
        ['b2-recruteurs', 'Demandes recruteurs', 'mallette', 'recruteurs'],
        ['b2-contacts', 'Messages de contact', 'message']
      ] }
    ] },
    { bloc: 3, nom: 'Administration du site', groupes: [
      { titre: 'Bloc 3 — Contenu du site', items: [
        ['b3c-vedette-admin', 'Choisir le mannequin à la une', 'etoile'],
        ['b3c-bandeau', 'Bandeau d’information', 'drapeau'],
        ['b3c-mot-fondateur', 'Mot du fondateur', 'plume'],
        ['b3c-agenda', 'Agenda du site', 'calendrier'],
        ['b3c-couverture', 'Couverture du site (vidéo)', 'appareil'],
        ['b3d-video-accueil', "Vidéo de la page d'accueil", 'appareil'],
        ['b3c-instagram', 'Flux Instagram', 'appareil'],
        ['lien:actualites.html', 'Publier une actualité', 'journal'],
        ['lien:evenements.html', 'Publier un événement', 'calendrier']
      ] },
      { titre: 'Sécurité & accès', items: [
        ['b3b-codes-inscription', 'Codes d’inscription', 'cle'],
        ['b3b-acces-bloques', 'Accès bloqués', 'cadenas'],
        ['b3b-code-permanent', 'Code « Créer mon compte »', 'cle'],
        ['b3b-code-validation', 'Code de validation', 'bouclier'],
        ['b3b-creer-admin', 'Créer un compte admin', 'personne']
      ] },
      { titre: 'Médias & stockage', items: [
        ['b3a-drive', 'Drive & transferts', 'nuage'],
        ['b3a-nettoyage', 'Nettoyage des photos', 'corbeille'],
        ['b3a-erreurs', 'Erreurs du site', 'alerte']
      ] }
    ] }
  ];
  // Pages composées de plusieurs rubriques existantes (la première sert de rubrique « principale »).
  var COMPOSEES = {
    'v2-ensemble': ['b1-stats'],
    'v2-top3': ['b1-top3', 'b1-classement']
  };
  var PAGES = {};
  MENU.forEach(function (b) {
    b.groupes.forEach(function (g) {
      g.items.forEach(function (it) {
        if (it[0].indexOf('lien:') === 0) return;
        PAGES[it[0]] = { cle: it[0], libelle: it[1], bloc: b.bloc, groupe: g.titre, principal: (COMPOSEES[it[0]] || [it[0]])[0] };
      });
    });
  });

  var courant = null;
  var donnees = null, chargeLe = 0, chargementEnCours = null;

  // ---------- Outils ----------
  function estV2() { return document.body.classList.contains('tdb-v2'); }
  function blocVisible() { var b = document.getElementById('bloc-tableau'); return !!b && getComputedStyle(b).display !== 'none'; }
  function appliquer() {
    var visible = blocVisible();
    document.body.classList.toggle('tdb-v2', visible);
    // Cet appareil a ouvert le tableau de bord : le bouton « Admin » du site public
    // s'affiche désormais pour lui seul (caché à tous les autres visiteurs, js/menu.js).
    if (visible) { try { localStorage.setItem('ma2m_appareil_admin', '1'); } catch (e) {} }
  }
  function itemOrigine(cle) { return document.querySelector('#tdb-menu-panel .tdb-menu-item[data-tdb-cible="' + cle + '"]'); }
  function client() { try { return sb || null; } catch (e) { return null; } }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function texte(tag, cls, t) { var e = el(tag, cls); e.textContent = t; return e; }
  function pluriel(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }

  // ---------- Navigation ----------
  function ouvrir(cle) {
    var page = PAGES[cle] || PAGES[ACCUEIL];
    courant = page.cle;
    var origine = itemOrigine(page.principal);
    if (origine) origine.click();
    if (page.cle !== page.principal || !origine) {
      try { history.replaceState(history.state, '', location.pathname + location.search + '#' + page.cle); } catch (e) {}
    }
    rendrePage();
    fermerMenuMobile();
  }
  // Rubriques à afficher pour la page courante (après le travail de la navigation d'origine).
  function rendrePage() {
    if (!estV2() || !courant) return;
    var page = PAGES[courant];
    var cles = courant === ACCUEIL ? [] : (COMPOSEES[courant] || [courant]);
    document.querySelectorAll('[data-section]').forEach(function (s) {
      s.classList.toggle('tdb-actif', cles.indexOf(s.dataset.section) !== -1);
    });
    document.body.className = document.body.className.replace(/\bv2-page-\S+/g, '').trim();
    document.body.classList.add('v2-page-' + courant);
    rendreMenu(page.bloc);
    document.querySelectorAll('.v2-bloc').forEach(function (p) {
      var on = Number(p.dataset.bloc) === page.bloc;
      p.classList.toggle('actif', on);
      p.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var titre = document.getElementById('v2-titre'), sous = document.getElementById('v2-sous-titre');
    if (titre) titre.textContent = courant === ACCUEIL ? 'Tableau de bord' : page.libelle;
    if (sous) sous.textContent = courant === ACCUEIL ? 'Bonjour Maître Akesse — voici l’activité de l’agence aujourd’hui.' : page.groupe.replace(/^Bloc \d — /, '');
    if (courant === ACCUEIL) chargerVue(false);
    // « Accès bloqués » est rangé dans un volet repliable qui charge la liste à l'ouverture.
    if (courant === 'b3b-acces-bloques' || courant === 'b2-tri-photos' || courant === 'b2-fiches-evenement' || courant === 'b2-rapport-profils') {
      var volet = document.querySelector('[data-section="' + courant + '"] details');
      if (volet && !volet.open) volet.open = true;
    }
  }
  // Ouvre la rubrique qui contient l'élément demandé, puis s'y rend (boutons « Actions rapides »,
  // « Choisir un mannequin à la une »… qui visaient des listes cachées depuis le menu par blocs).
  function allerVers(id) {
    var cible = document.getElementById(id);
    if (!cible) return;
    var section = cible.closest('[data-section]');
    if (section) {
      var cle = section.dataset.section, page = PAGES[cle] ? cle : null;
      if (!page) Object.keys(COMPOSEES).forEach(function (k) { if (!page && COMPOSEES[k].indexOf(cle) !== -1) page = k; });
      if (page) ouvrir(page);
    }
    setTimeout(function () {
      cible.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(cible.tagName)) cible.focus({ preventScroll: true });
    }, 120);
  }
  window.ma2mAllerVers = allerVers;

  // Clic sur une notification du téléphone (?notif=candidature&id=…) : ouvrir la bonne page et la fiche.
  function ouvrirDepuisNotification() {
    var params = new URLSearchParams(location.search);
    var type = params.get('notif'), id = params.get('id');
    if (!type) return false;
    try { history.replaceState(history.state, '', location.pathname + location.hash); } catch (e) {}
    var conf = { candidature: ['b2-candidatures', 'casting'], recruteur: ['b2-recruteurs', 'recruteur'], contact: ['b2-contacts', null], blocage: ['b3b-acces-bloques', null] }[type];
    if (!conf) return false;
    ouvrir(conf[0]);
    if (conf[1] && id && typeof window.ouvrirFicheDossier === 'function') window.ouvrirFicheDossier(conf[1], id);
    return true;
  }
  // Quand une autre partie du tableau de bord ouvre une rubrique (cloche, liens internes…).
  function suivreOrigine() {
    if (!estV2()) return;
    var actif = document.querySelector('#tdb-menu-panel .tdb-menu-item.actif[data-tdb-cible]');
    if (!actif) return;
    var cible = actif.dataset.tdbCible;
    if (!(courant && PAGES[courant] && PAGES[courant].principal === cible) && PAGES[cible]) courant = cible;
    rendrePage();
  }

  // ---------- Menu de gauche ----------
  var blocAffiche = null;
  function rendreMenu(bloc) {
    var liste = document.getElementById('v2-menu-liste');
    if (!liste) return;
    if (blocAffiche !== bloc) {
      blocAffiche = bloc;
      liste.innerHTML = '';
      MENU[bloc - 1].groupes.forEach(function (g) {
        liste.appendChild(texte('div', 'v2-groupe', g.titre));
        g.items.forEach(function (it) {
          var lien = it[0].indexOf('lien:') === 0;
          var a = el(lien ? 'a' : 'button', 'v2-lien', svg(it[2]));
          if (lien) a.href = it[0].slice(5); else { a.type = 'button'; a.dataset.page = it[0]; }
          a.appendChild(texte('span', 'v2-lien-texte', it[1]));
          if (it[3]) { var p = el('span', 'v2-pastille'); p.dataset.compteur = it[3]; p.hidden = true; a.appendChild(p); }
          liste.appendChild(a);
        });
      });
      majPastilles();
    }
    liste.querySelectorAll('.v2-lien[data-page]').forEach(function (b) {
      var on = b.dataset.page === courant;
      b.classList.toggle('actif', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  function compteurs() {
    var c = {};
    var total = document.getElementById('a-traiter-total');
    c.aTraiter = total ? (parseInt((total.textContent || '').replace(/\D+/g, ''), 10) || 0) : 0;
    if (donnees) {
      c.inscriptions = donnees.inscriptionsAVerifier; c.validations = donnees.validations;
      c.candidatures = donnees.candidaturesNouvelles; c.recruteurs = donnees.recruteursNonLus;
    }
    return c;
  }
  function majPastilles() {
    var c = compteurs();
    document.querySelectorAll('.v2-pastille[data-compteur]').forEach(function (p) {
      var n = c[p.dataset.compteur] || 0;
      p.textContent = n > 99 ? '99+' : String(n);
      p.hidden = !n;
    });
  }
  function ouvrirMenuMobile() {
    var cote = document.getElementById('v2-cote');
    if (!cote || cote.classList.contains('ouvert')) return;
    cote.classList.add('ouvert');
    document.getElementById('v2-voile').classList.add('ouvert');
    if (window.verrouillerDefilement) window.verrouillerDefilement();
  }
  function fermerMenuMobile() {
    var cote = document.getElementById('v2-cote');
    if (!cote || !cote.classList.contains('ouvert')) return;
    cote.classList.remove('ouvert');
    document.getElementById('v2-voile').classList.remove('ouvert');
    if (window.deverrouillerDefilement) window.deverrouillerDefilement();
  }

  // ---------- Vue d'ensemble : chiffres réels ----------
  function compter(requete) {
    return requete.then(function (r) { return r && !r.error ? (r.count || 0) : null; }, function () { return null; });
  }
  function chargerVue(forcer) {
    var s = client();
    if (!s || !estV2()) return;
    if (!forcer && donnees && Date.now() - chargeLe < 60000) { rendreVue(); return; }
    if (chargementEnCours) return;
    var aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
    var debutMois = new Date(aujourdhui); debutMois.setDate(1);
    var debutSemaine = new Date(aujourdhui); debutSemaine.setDate(aujourdhui.getDate() - ((aujourdhui.getDay() + 6) % 7));
    var depuis7j = new Date(Date.now() - 7 * 864e5);
    var jour = aujourdhui.getFullYear() + '-' + String(aujourdhui.getMonth() + 1).padStart(2, '0') + '-' + String(aujourdhui.getDate()).padStart(2, '0');
    var tete = { count: 'exact', head: true };
    var nombre = function (r) { return r && !r.error ? Number(r.data) || 0 : null; };
    chargementEnCours = Promise.all([
      compter(s.from('model_profiles').select('id', tete).eq('published', true)),
      compter(s.from('model_profiles').select('id', tete).eq('published', true).gte('created_at', debutMois.toISOString())),
      compter(s.from('casting_applications').select('id', tete)),
      compter(s.from('casting_applications').select('id', tete).eq('status', 'nouvelle')),
      compter(s.from('inscriptions_mannequins').select('id', tete).eq('statut', 'en attente de paiement')),
      compter(s.from('casting_projets').select('id', tete).eq('actif', true)),
      s.from('casting_projets').select('nom, date_casting, lieu').eq('actif', true).gte('date_casting', jour).order('date_casting', { ascending: true }).limit(1)
        .then(function (r) { return r && !r.error && r.data && r.data[0] ? r.data[0] : null; }, function () { return null; }),
      s.rpc('stats_visites_reelles_site', { depuis: aujourdhui.toISOString() }).then(nombre, function () { return null; }),
      s.rpc('stats_visites_reelles_site', { depuis: depuis7j.toISOString() }).then(nombre, function () { return null; }),
      compter(s.from('recruiter_requests').select('id', tete)),
      compter(s.from('recruiter_requests').select('id', tete).eq('status', 'nouvelle')),
      compter(s.from('messages_contact').select('id', tete).gte('created_at', debutSemaine.toISOString())),
      compter(s.from('model_profiles').select('id', tete).eq('en_attente_validation', true))
    ]).then(function (r) {
      donnees = {
        publies: r[0], publiesMois: r[1], candidatures: r[2], candidaturesNouvelles: r[3], inscriptionsAVerifier: r[4],
        castingsActifs: r[5], prochainCasting: r[6], visitesAujourdhui: r[7], visites7j: r[8], recruteurs: r[9],
        recruteursNonLus: r[10], messagesSemaine: r[11], validations: r[12]
      };
      chargeLe = Date.now();
      chargementEnCours = null;
      rendreVue();
      majPastilles();
    }, function () { chargementEnCours = null; });
  }
  function dateCasting(iso) {
    if (!iso) return null;
    var d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    if (isNaN(d)) return null;
    var auj = new Date(); auj.setHours(12, 0, 0, 0);
    var ecart = Math.round((d - auj) / 864e5);
    if (ecart === 0) return 'aujourd’hui';
    if (ecart === 1) return 'demain';
    if (ecart > 1 && ecart < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long' });
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }
  function rendreVue() {
    var vue = document.getElementById('v2-vue');
    if (!vue || !donnees) return;
    var d = donnees, v = function (n) { return n == null ? '—' : String(n); };
    var prochain = d.prochainCasting ? dateCasting(d.prochainCasting.date_casting) : null;
    var cartes = [
      ['Mannequins publiés', 'groupe', 'c1', d.publies, d.publiesMois ? '▲ ' + d.publiesMois + ' ce mois-ci' : 'profils en ligne', d.publiesMois ? 'hausse' : '', 'b2-mannequins-publies'],
      ['Candidatures reçues', 'fichierOk', 'c2', d.candidatures, 'dont ' + pluriel(d.candidaturesNouvelles || 0, 'nouvelle', 'nouvelles'), '', 'b2-candidatures'],
      ['Inscriptions à vérifier', 'horloge', 'c3', d.inscriptionsAVerifier, 'paiements à confirmer', '', 'b2-inscriptions'],
      ['Castings actifs', 'calendrier', 'c4', d.castingsActifs, prochain ? 'prochain : ' + prochain : 'aucune date prévue', '', 'b2-projets'],
      ['Visites aujourd’hui', 'oeil', 'c4', d.visitesAujourdhui, d.visites7j != null ? d.visites7j + ' sur 7 jours' : 'visiteurs distincts', '', 'b1-stats'],
      ['Demandes recruteurs', 'mallette', 'c2', d.recruteurs, pluriel(d.recruteursNonLus || 0, 'non lue', 'non lues'), '', 'b2-recruteurs'],
      ['Messages de contact', 'message', 'c1', d.messagesSemaine, 'cette semaine', '', 'b2-contacts'],
      ['Validations en attente', 'alerte', 'c3', d.validations, 'profils à valider', d.validations ? 'baisse' : '', 'b2-validations']
    ];
    var grille = el('div', 'v2-cartes');
    cartes.forEach(function (c) {
      var carte = el('button', 'v2-carte');
      carte.type = 'button';
      carte.dataset.page = c[6];
      var haut = el('div', 'v2-carte-haut');
      haut.appendChild(document.createTextNode(c[0]));
      haut.appendChild(el('span', 'v2-puce ' + c[2], svg(c[1], 'v2-puce-ico')));
      carte.appendChild(haut);
      carte.appendChild(texte('div', 'v2-valeur', v(c[3])));
      carte.appendChild(texte('small', c[5], c[4]));
      grille.appendChild(carte);
    });

    var alertes = el('div', 'v2-alertes');
    alertes.appendChild(el('h2', null, '🔔 Alertes &amp; rappels'));
    var lignes = [];
    if (d.inscriptionsAVerifier) lignes.push({ c: '#c98c28', gras: pluriel(d.inscriptionsAVerifier, 'inscription', 'inscriptions'), apres: d.inscriptionsAVerifier > 1 ? ' attendent la vérification de leur paiement' : ' attend la vérification de son paiement', voir: 'Voir →', page: 'b2-inscriptions' });
    if (d.validations) lignes.push({ c: '#d55468', gras: pluriel(d.validations, 'profil mannequin', 'profils mannequins'), apres: d.validations > 1 ? ' attendent votre validation avant publication' : ' attend votre validation avant publication', voir: 'Voir →', page: 'b2-validations' });
    if (d.prochainCasting && prochain) {
      var pc = d.prochainCasting;
      lignes.push({ c: '#6f88e0', avant: 'Casting « ' + (pc.nom || 'sans nom') + ' » ', gras: prochain + (pc.lieu ? ' — ' + pc.lieu : ''), apres: ' — penser à envoyer le rappel', voir: 'Messages →', page: 'b2-messages-groupes' });
    }
    if (d.candidaturesNouvelles) lignes.push({ c: '#2f8a57', gras: pluriel(d.candidaturesNouvelles, 'nouvelle candidature', 'nouvelles candidatures'), apres: ' à examiner', voir: 'Voir →', page: 'b2-candidatures' });
    if (d.recruteursNonLus) lignes.push({ c: '#4f6cc9', gras: pluriel(d.recruteursNonLus, 'demande recruteur', 'demandes recruteurs'), apres: d.recruteursNonLus > 1 ? ' pas encore lues' : ' pas encore lue', voir: 'Voir →', page: 'b2-recruteurs' });
    if (!lignes.length) alertes.appendChild(texte('div', 'v2-alerte v2-alerte-vide', '✅ Rien à traiter pour le moment.'));
    lignes.forEach(function (l) {
      var ligne = el('button', 'v2-alerte');
      ligne.type = 'button';
      ligne.dataset.page = l.page;
      var point = el('span', 'v2-point'); point.style.background = l.c;
      ligne.appendChild(point);
      var phrase = el('span', 'v2-phrase');
      if (l.avant) phrase.appendChild(document.createTextNode(l.avant));
      phrase.appendChild(texte('b', null, l.gras));
      phrase.appendChild(document.createTextNode(l.apres));
      ligne.appendChild(phrase);
      ligne.appendChild(texte('span', 'v2-voir', l.voir));
      alertes.appendChild(ligne);
    });
    vue.innerHTML = '';
    vue.appendChild(grille);
    vue.appendChild(alertes);
  }

  // ---------- Recherche : mannequin, candidature, casting (+ rubriques) ----------
  function sansAccents(t) { return (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  var minuteurRecherche = null, numeroRecherche = 0;
  function rechercher(q, res) {
    var n = ++numeroRecherche;
    var qn = sansAccents(q);
    var groupes = [];
    var rubriques = Object.keys(PAGES).filter(function (k) { return sansAccents(PAGES[k].libelle).indexOf(qn) !== -1; }).slice(0, 4)
      .map(function (k) { return { texte: PAGES[k].libelle, detail: PAGES[k].groupe.replace(/^Bloc \d — /, ''), page: k }; });
    if (rubriques.length) groupes.push(['Rubriques', rubriques]);
    var s = client();
    var motif = q.replace(/[%_,()*\\]/g, ' ').trim();
    var enLigne = !!s && motif.length >= 2;
    afficherResultats(res, groupes, !enLigne);
    if (!enLigne) return;
    var like = '%' + motif + '%';
    Promise.all([
      s.from('model_profiles').select('id, full_name, city').ilike('full_name', like).limit(4),
      s.from('casting_applications').select('id, full_name, status').ilike('full_name', like).order('created_at', { ascending: false }).limit(4),
      s.from('inscriptions_mannequins').select('id, full_name, statut').ilike('full_name', like).order('created_at', { ascending: false }).limit(4),
      s.from('casting_projets').select('id, nom, lieu').ilike('nom', like).limit(3)
    ].map(function (p) { return p.then(function (r) { return (r && !r.error && r.data) || []; }, function () { return []; }); })).then(function (r) {
      if (n !== numeroRecherche) return;
      if (r[0].length) groupes.push(['Mannequins', r[0].map(function (m) { return { texte: m.full_name, detail: m.city || 'Mannequin', page: 'b2-mannequins-publies' }; })]);
      if (r[1].length) groupes.push(['Candidatures', r[1].map(function (c) { return { texte: c.full_name, detail: c.status || '', fiche: ['casting', c.id], page: 'b2-candidatures' }; })]);
      if (r[2].length) groupes.push(['Inscriptions', r[2].map(function (c) { return { texte: c.full_name, detail: c.statut || '', fiche: ['inscription', c.id], page: 'b2-inscriptions' }; })]);
      if (r[3].length) groupes.push(['Castings', r[3].map(function (c) { return { texte: c.nom, detail: c.lieu || 'Projet', page: 'b2-projets' }; })]);
      afficherResultats(res, groupes, true);
    });
  }
  function afficherResultats(res, groupes, termine) {
    res.innerHTML = '';
    groupes.forEach(function (g) {
      res.appendChild(texte('div', 'v2-res-titre', g[0]));
      g[1].forEach(function (it) {
        var b = el('button', 'v2-res');
        b.type = 'button';
        b.dataset.page = it.page;
        if (it.fiche) { b.dataset.ficheSource = it.fiche[0]; b.dataset.ficheId = it.fiche[1]; }
        b.appendChild(texte('span', 'v2-res-nom', it.texte || '—'));
        if (it.detail) b.appendChild(texte('span', 'v2-res-detail', it.detail));
        res.appendChild(b);
      });
    });
    if (!groupes.length) res.appendChild(texte('span', 'v2-vide', termine ? 'Aucun résultat' : 'Recherche…'));
    res.classList.add('ouvert');
  }

  // ---------- Construction ----------
  function construire() {
    var shell = document.querySelector('#bloc-tableau .db-shell');
    var main = document.querySelector('#bloc-tableau .db-main');
    var topbar = document.querySelector('#bloc-tableau .db-topbar');
    if (!shell || !main || !topbar || document.getElementById('v2-blocs')) return;

    // 3 blocs au-dessus du cadre.
    var nav = el('nav', 'v2-blocs');
    nav.id = 'v2-blocs';
    nav.setAttribute('aria-label', 'Les 3 blocs du tableau de bord');
    MENU.forEach(function (b) {
      var p = el('button', 'v2-bloc', '<span class="v2-num">' + b.bloc + '</span>');
      p.type = 'button';
      p.dataset.bloc = b.bloc;
      p.setAttribute('aria-pressed', 'false');
      p.appendChild(texte('span', 'v2-libelle', b.nom));
      nav.appendChild(p);
    });
    shell.parentNode.insertBefore(nav, shell);
    nav.addEventListener('click', function (e) {
      var p = e.target.closest('.v2-bloc');
      if (p) ouvrir(MENU[Number(p.dataset.bloc) - 1].groupes[0].items[0][0]);
    });

    // Menu de gauche.
    var cote = el('aside', 'v2-cote');
    cote.id = 'v2-cote';
    cote.setAttribute('aria-label', 'Menu du tableau de bord');
    cote.innerHTML = '<div class="v2-cote-haut"><a class="v2-marque" href="index.html"><img src="assets/logo-header.png" alt="Maître Akesse Model Management"></a>'
      + '<button type="button" class="v2-fermer" aria-label="Fermer le menu">' + svg('croix') + '</button></div>'
      + '<nav class="v2-menu-liste" id="v2-menu-liste"></nav>'
      + '<div class="v2-cote-bas">'
      + '<a class="v2-lien v2-lien-discret" href="index.html">' + svg('globe') + '<span class="v2-lien-texte">Retour au site public</span></a>'
      + '<button type="button" class="v2-lien v2-lien-discret" data-action="deconnexion">' + svg('sortie') + '<span class="v2-lien-texte">Se déconnecter</span></button>'
      + '</div>';
    shell.insertBefore(cote, main);
    var voile = el('div', 'v2-voile');
    voile.id = 'v2-voile';
    document.body.appendChild(voile);
    voile.addEventListener('click', fermerMenuMobile);
    cote.querySelector('.v2-fermer').addEventListener('click', fermerMenuMobile);
    cote.addEventListener('click', function (e) {
      var b = e.target.closest('[data-page], [data-action]');
      if (!b) return;
      if (b.dataset.page) { ouvrir(b.dataset.page); return; }
      if (b.dataset.action === 'deconnexion') { var d = document.getElementById('tdb-menu-deconnexion-rapide'); if (d) d.click(); }
    });

    // Barre du haut : menu (téléphone) + recherche ; la cloche et le profil existants restent à droite.
    var burger = el('button', 'v2-burger', svg('burger'));
    burger.type = 'button';
    burger.setAttribute('aria-label', 'Ouvrir le menu');
    burger.addEventListener('click', ouvrirMenuMobile);
    var champ = el('label', 'v2-recherche', svg('loupe'));
    var input = el('input');
    input.id = 'v2-recherche';
    input.type = 'search';
    input.autocomplete = 'off';
    input.placeholder = 'Rechercher un mannequin, une candidature, un casting…';
    champ.appendChild(input);
    var res = el('div', 'v2-resultats');
    res.id = 'v2-resultats';
    champ.appendChild(res);
    topbar.insertBefore(champ, topbar.firstChild);
    topbar.insertBefore(burger, topbar.firstChild);
    input.addEventListener('input', function () {
      clearTimeout(minuteurRecherche);
      var q = input.value.trim();
      if (!q) { res.innerHTML = ''; res.classList.remove('ouvert'); return; }
      minuteurRecherche = setTimeout(function () { rechercher(q, res); }, 250);
    });
    res.addEventListener('click', function (e) {
      var b = e.target.closest('.v2-res');
      if (!b) return;
      ouvrir(b.dataset.page);
      if (b.dataset.ficheSource && typeof window.ouvrirFicheDossier === 'function') window.ouvrirFicheDossier(b.dataset.ficheSource, b.dataset.ficheId);
      input.value = ''; res.innerHTML = ''; res.classList.remove('ouvert');
    });
    document.addEventListener('click', function (e) { if (!champ.contains(e.target)) res.classList.remove('ouvert'); });

    // Titre de page + raccourcis.
    var entete = el('div', 'v2-entete');
    entete.id = 'v2-entete';
    entete.innerHTML = '<div><h1 id="v2-titre">Tableau de bord</h1><p id="v2-sous-titre"></p></div>'
      + '<div class="v2-entete-actions"><button type="button" class="v2-action" data-page="b2-messages-groupes">📣 Messages groupés</button>'
      + '<button type="button" class="v2-action v2-action-principale" data-page="b2-projets" data-focus="nouveau-projet-nom">＋ Nouveau casting</button></div>';
    topbar.parentNode.insertBefore(entete, topbar.nextSibling);

    // Vue d'ensemble.
    var vue = el('div', 'v2-vue');
    vue.id = 'v2-vue';
    entete.parentNode.insertBefore(vue, entete.nextSibling);

    // Clics dans le contenu (raccourcis, cartes, alertes) : ouvrir la page indiquée.
    main.addEventListener('click', function (e) {
      if (!estV2()) return;
      var b = e.target.closest('#v2-entete [data-page], #v2-vue [data-page]');
      if (!b) return;
      ouvrir(b.dataset.page);
      if (b.dataset.focus) { var f = document.getElementById(b.dataset.focus); if (f) setTimeout(function () { f.focus(); }, 80); }
    });
    // « Voir tout » de l'activité récente (à côté du mannequin à la une) : ouvre les statistiques.
    document.addEventListener('click', function (e) {
      if (estV2() && e.target.closest && e.target.closest('.ref-header-activity .see')) ouvrir('b1-stats');
    });

    var menuOrigine = document.getElementById('tdb-menu-panel');
    if (menuOrigine) new MutationObserver(suivreOrigine).observe(menuOrigine, { subtree: true, attributes: true, attributeFilter: ['class'] });
    var total = document.getElementById('a-traiter-total');
    if (total) new MutationObserver(majPastilles).observe(total, { childList: true, characterData: true, subtree: true });
  }

  // Après connexion : ouvrir la page gardée dans l'adresse (#…), celle d'une notification,
  // ou à défaut la vue d'ensemble (l'écran « 3 blocs » d'origine reste masqué).
  // Appelée dès que le tableau de bord s'affiche, avant que l'écran ne soit dessiné : le menu
  // et la page arrivent déjà en place (avant : 50 ms plus tard, la page « sautait », journal du 04/10).
  function apresAffichage() {
    appliquer();
    if (!estV2()) return;
    if (ouvrirDepuisNotification()) return;
    var landing = document.getElementById('tdb-landing');
    if (landing && landing.style.display !== 'none') {
      var h = decodeURIComponent(location.hash.slice(1));
      ouvrir(PAGES[h] ? h : ACCUEIL);
    } else if (!courant) {
      suivreOrigine();
    }
  }

  // Verrouillage après 15 min d'inactivité : certains gestes ne comptaient pas comme une
  // activité (défilement à l'intérieur d'une fiche ouverte, molette, saisie dans un champ
  // dont un script arrête la propagation…) — le tableau de bord pouvait alors se verrouiller
  // en plein travail (« la page saute pour revenir sur le site », 04/10). On écoute ces gestes
  // en phase de capture, pour qu'aucun ne passe inaperçu.
  var derniereRelance = 0;
  function relancerMinuteur() {
    var t = Date.now();
    if (t - derniereRelance < 1000) return;
    derniereRelance = t;
    try { if (minuteurInactivite) demarrerMinuteurInactivite(); } catch (e) {}
  }
  ['pointerdown', 'touchstart', 'touchmove', 'wheel', 'scroll', 'keydown', 'input', 'change', 'click'].forEach(function (evt) {
    document.addEventListener(evt, relancerMinuteur, { capture: true, passive: true });
  });

  function demarrer() {
    try { localStorage.removeItem('ma2m_tdb_v2'); } catch (e) {}
    construire();
    appliquer();
    var bloc = document.getElementById('bloc-tableau');
    if (bloc) new MutationObserver(function () { appliquer(); if (blocVisible()) apresAffichage(); })
      .observe(bloc, { attributes: true, attributeFilter: ['style', 'class'] });
    var landing = document.getElementById('tdb-landing');
    if (landing) new MutationObserver(function () { apresAffichage(); })
      .observe(landing, { attributes: true, attributeFilter: ['style'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
