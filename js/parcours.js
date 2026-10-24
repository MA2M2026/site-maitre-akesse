// Parcours MA2M (parcours.html et en/parcours.html, 11/10/2026) : bilan public des
// activités des mannequins, mois par mois, calculé à partir de l'agenda du tableau de bord
// (Extension 136, aucune saisie en double). Rien de privé : type, titre, dates, lieu,
// ville, pays, nom et photo des mannequins dont le profil est public.
// Pensé pour rester lisible à 30-40 mannequins : seules les mannequins actives du mois
// apparaissent, triées par nombre d'activités, les suivantes derrière « Voir les autres ».
// Outils communs : EN, T, libelleTypeAgenda, dateAgenda, lienFicheMannequin, ma2mParcours,
// ma2mCompteParType, echapperHtml (js/app.js).
(function () {
  const VISAGES_MAX = 18;
  const MOIS_HISTOIRE = 24; // les deux dernières années
  const $ = (id) => document.getElementById(id);
  const PHOTO_DEFAUT = '/assets/logo-dark-bg.png';
  const animer = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  let projets = [];        // tous les projets réalisés de la période
  let photos = {};         // id mannequin → photo de couverture
  let moisChoisi = '';     // « AAAA-MM »
  let typeChoisi = '';     // '' = tous
  let tousLesVisages = false;

  const cleMois = (date) => date.slice(0, 7);
  function libelleMois(cle, court) {
    const d = new Date(cle + '-15T12:00:00');
    return d.toLocaleDateString(EN ? 'en-GB' : 'fr-FR', court ? { month: 'short', year: '2-digit' } : { month: 'long', year: 'numeric' });
  }

  // Un projet sur plusieurs mois compte dans chacun de ces mois (frise, contenu, filtres).
  const dansLeMois = (p, cle) => cleMois(p.date_debut) <= cle && cleMois(p.date_fin || p.date_debut) >= cle;
  const projetsMois = () => projets.filter(p => dansLeMois(p, moisChoisi));
  const projetsDuMois = () => projetsMois().filter(p => !typeChoisi || p.type === typeChoisi);

  // Entrée en scène au défilement (12/10/2026) : chaque élément reçoit .pm-entree, puis .pm-vu
  // quand il arrive à l'écran (css/parcours.css). quandVisible : action lancée à ce moment-là
  // (ex. le compteur qui défile). Sans IntersectionObserver ou sans animation : tout de suite.
  const observateur = animer && 'IntersectionObserver' in window ? new IntersectionObserver((entrees) => {
    entrees.forEach(e => {
      if (!e.isIntersecting) return;
      observateur.unobserve(e.target);
      e.target.classList.add('pm-vu');
      if (e.target.quandVisible) e.target.quandVisible();
      // entrée terminée : on retire .pm-entree pour rendre aux survols leurs propres transitions
      setTimeout(() => e.target.classList.remove('pm-entree'), 1800 + (parseInt(getComputedStyle(e.target).getPropertyValue('--delai'), 10) || 0));
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }) : null;
  // Avant de redessiner une zone : ses éléments pas encore vus ne sont plus observés.
  function oublier(zone) {
    if (observateur) zone.querySelectorAll('.pm-entree:not(.pm-vu)').forEach(el => observateur.unobserve(el));
  }
  function mettreEnScene(elements, quandVisible) {
    elements.forEach(el => {
      if (quandVisible) el.quandVisible = () => quandVisible(el);
      if (!observateur) { el.classList.add('pm-vu'); if (el.quandVisible) el.quandVisible(); return; }
      el.classList.add('pm-entree');
      observateur.observe(el);
    });
  }
  // Titre de la page : chaque mot se lève derrière un cache (css : .pm-mot).
  function decouperTitre() {
    const h1 = document.querySelector('.parcours-ouverture h1');
    if (!h1 || !animer) return;
    let i = 0;
    const frag = document.createDocumentFragment();
    [...h1.childNodes].forEach(n => {
      const morceaux = n.nodeType === 3 ? n.textContent.split(/(\s+)/) : [n];
      morceaux.forEach(m => {
        if (typeof m === 'string' && !m.trim()) { if (m) frag.appendChild(document.createTextNode(m)); return; }
        const cache = document.createElement('span'), mot = document.createElement('span');
        cache.className = 'pm-mot';
        mot.style.setProperty('--i', i++);
        mot.appendChild(typeof m === 'string' ? document.createTextNode(m) : m);
        cache.appendChild(mot); frag.appendChild(cache);
      });
    });
    h1.textContent = '';
    h1.appendChild(frag);
  }

  // Compteur animé de 0 à la valeur (« motion design ») ; valeur finale directe sans animation.
  function compter(el, valeur) {
    if (!animer || valeur < 2) { el.textContent = valeur; return; }
    const debut = performance.now(), duree = 900;
    (function etape(t) {
      const k = Math.min(1, (t - debut) / duree);
      el.textContent = Math.round(valeur * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(etape);
    })(debut);
  }

  function dessinerMois() {
    const frise = $('parcours-mois');
    const aujourdhui = new Date();
    const liste = [];
    for (let i = 0; i < MOIS_HISTOIRE; i++) {
      const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - i, 15);
      liste.push(dateLocaleIso(d).slice(0, 7));
    }
    frise.textContent = '';
    liste.reverse().forEach(cle => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'parcours-mois-btn' + (cle === moisChoisi ? ' actif' : '') + (projets.some(p => dansLeMois(p, cle)) ? ' plein' : '');
      b.textContent = libelleMois(cle, true);
      b.setAttribute('aria-pressed', cle === moisChoisi ? 'true' : 'false');
      b.addEventListener('click', () => { moisChoisi = cle; typeChoisi = ''; tousLesVisages = false; afficher(); });
      frise.appendChild(b);
    });
    const actif = frise.querySelector('.actif');
    if (actif) frise.scrollLeft = actif.offsetLeft - frise.clientWidth / 2 + actif.clientWidth / 2; // .parcours-mois est positionnée (css)
  }

  function dessinerFiltres() {
    const zone = $('parcours-filtres');
    const types = ma2mCompteParType(projetsMois());
    zone.textContent = '';
    if (types.length < 2) return;
    [['', T('Tout', 'All')]].concat(types.map(([t]) => [t, libelleTypeAgenda(t, EN)])).forEach(([t, nom]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'parcours-filtre' + (t === typeChoisi ? ' actif' : '');
      b.textContent = nom;
      b.addEventListener('click', () => { typeChoisi = t; tousLesVisages = false; afficher(); });
      zone.appendChild(b);
    });
  }

  function dessinerChiffres(duMois, mannequins) {
    const zone = $('parcours-chiffres');
    oublier(zone);
    const villes = new Set(duMois.map(p => p.ville).filter(Boolean));
    const pl = (n, un, plusieurs) => (n > 1 ? plusieurs : un);
    const cases = [[duMois.length, pl(duMois.length, T('activité', 'activity'), T('activités', 'activities'))]]
      .concat(ma2mCompteParType(duMois).slice(0, 3).map(([t, n]) => [n, nombreTypeAgenda(t, n, EN).replace(/^\d+ /, '')]))
      .concat([[mannequins.length, pl(mannequins.length, T('mannequin en action', 'model at work'), T('mannequins en action', 'models at work'))], [villes.size, pl(villes.size, T('ville', 'city'), T('villes', 'cities'))]]);
    zone.innerHTML = cases.map(([n, l], i) =>
      `<div class="parcours-chiffre" data-ordre="${i}"><strong data-valeur="${n}">0</strong><span>${echapperHtml(l)}</span></div>`).join('');
    const tuiles = [...zone.querySelectorAll('.parcours-chiffre')];
    tuiles.forEach((c, i) => c.style.setProperty('--delai', (i * 90) + 'ms'));
    // le compteur démarre quand la case arrive à l'écran
    mettreEnScene(tuiles, c => compter(c.querySelector('strong'), Number(c.querySelector('strong').dataset.valeur)));
  }

  // Mannequins actives du mois avec leurs projets, de la plus active à la moins active.
  function mannequinsDuMois(duMois) {
    const parId = new Map();
    duMois.forEach(p => (p.mannequins || []).forEach(m => {
      // une mannequin écrite à la main (sans profil, Extension 137) n'a pas d'identifiant
      const cle = m.id || 'nom:' + String(m.nom || '').trim().toLowerCase();
      if (!parId.has(cle)) parId.set(cle, { ...m, projets: [] });
      parId.get(cle).projets.push(p);
    }));
    return [...parId.values()].sort((a, b) => b.projets.length - a.projets.length || a.nom.localeCompare(b.nom));
  }

  function carteVisage(m, i) {
    const a = document.createElement('button');
    a.type = 'button';
    a.className = 'parcours-visage';
    a.style.setProperty('--delai', (i % 6) * 70 + 'ms'); // cascade par rangée
    a.innerHTML = `<span class="parcours-visage-photo"><img src="${echapperHtml(photos[m.id] || PHOTO_DEFAUT)}" alt="" loading="lazy"></span>`
      + `<span class="parcours-visage-nom">${echapperHtml(m.nom)}</span>`
      + `<span class="parcours-visage-badge" aria-label="${m.projets.length} ${T('activités', 'activities')}">${m.projets.length}</span>`;
    a.addEventListener('click', () => ouvrirDetail(m));
    return a;
  }

  function dessinerVisages(mannequins) {
    const mur = $('parcours-visages');
    oublier(mur);
    mur.textContent = '';
    const montres = tousLesVisages ? mannequins : mannequins.slice(0, VISAGES_MAX);
    montres.forEach((m, i) => mur.appendChild(carteVisage(m, i)));
    mettreEnScene([...mur.children]);
    const plus = $('parcours-plus');
    const reste = mannequins.length - montres.length;
    plus.hidden = reste <= 0;
    plus.textContent = T(`Voir les ${reste} autres`, `See the other ${reste}`);
  }

  function ouvrirDetail(m) {
    const d = $('parcours-detail');
    d.innerHTML = `<div class="parcours-detail-tete"><img src="${echapperHtml(photos[m.id] || PHOTO_DEFAUT)}" alt="">`
      + `<div><h3>${echapperHtml(m.nom)}</h3><p>${m.projets.length} ${m.projets.length > 1 ? T('activités en', 'activities in') : T('activité en', 'activity in')} ${echapperHtml(libelleMois(moisChoisi))}</p></div>`
      + `<button type="button" class="parcours-detail-fermer" aria-label="${T('Fermer', 'Close')}">✕</button></div>`
      + '<ul>' + m.projets.map(p => `<li><span class="parcours-type">${echapperHtml(libelleTypeAgenda(p.type, EN))}</span>`
        + `<strong>${echapperHtml(p.titre)}</strong><em>${echapperHtml(dateLieuProjet(p))}</em></li>`).join('') + '</ul>'
      + (lienFicheMannequin(m) ? `<a class="btn" href="${lienFicheMannequin(m)}">${T('Voir le book', 'View the book')}</a>` : '');
    d.hidden = false;
    d.querySelector('.parcours-detail-fermer').addEventListener('click', () => { d.hidden = true; });
    d.scrollIntoView({ behavior: animer ? 'smooth' : 'auto', block: 'nearest' });
  }

  function dessinerProjets(duMois) {
    const zone = $('parcours-projets');
    oublier(zone);
    zone.innerHTML = duMois.map((p) => {
      const visages = (p.mannequins || []);
      return '<article class="parcours-projet">'
        + `<span class="parcours-type">${echapperHtml(libelleTypeAgenda(p.type, EN))}</span>`
        + `<h3>${echapperHtml(p.titre)}</h3>`
        + `<p class="parcours-projet-meta">${echapperHtml(dateLieuProjet(p))}</p>`
        + `<div class="parcours-projet-visages">` + visages.slice(0, 6).map(m => {
          const img = `<img src="${echapperHtml(photos[m.id] || PHOTO_DEFAUT)}" alt="${echapperHtml(m.nom)}" loading="lazy">`;
          const lien = lienFicheMannequin(m);
          return lien ? `<a href="${lien}" title="${echapperHtml(m.nom)}">${img}</a>` : `<span title="${echapperHtml(m.nom)}">${img}</span>`;
        }).join('')
        + (visages.length > 6 ? `<span class="parcours-projet-plus">+${visages.length - 6}</span>` : '') + '</div></article>';
    }).join('');
    // délai d'apparition en cascade (propriété CSS posée en JavaScript : la sécurité du site
    // interdit les attributs style écrits dans le HTML)
    zone.querySelectorAll('.parcours-projet').forEach((c, i) => c.style.setProperty('--delai', (i % 3) * 110 + 'ms'));
    mettreEnScene([...zone.querySelectorAll('.parcours-projet')]);
  }

  function afficher() {
    const duMois = projetsDuMois();
    const mannequins = mannequinsDuMois(duMois);
    $('parcours-titre-mois').textContent = libelleMois(moisChoisi);
    $('parcours-detail').hidden = true;
    dessinerMois();
    dessinerFiltres();
    dessinerChiffres(duMois, mannequins);
    dessinerVisages(mannequins);
    dessinerProjets(duMois);
    $('parcours-vide').hidden = duMois.length > 0;
    $('parcours-contenu').hidden = !duMois.length;
    // relance l'animation d'apparition à chaque changement de mois
    const scene = $('parcours-scene');
    scene.classList.remove('joue'); scene.getBoundingClientRect(); scene.classList.add('joue');  // relance l'animation
  }

  async function demarrer() {
    try { decouperTitre(); } catch (e) { /* titre laissé tel quel : l'animation est un plus */ }
    mettreEnScene([...document.querySelectorAll('.parcours-sous-titre')]);
    const fin = new Date(), debut = new Date(fin.getFullYear(), fin.getMonth() - MOIS_HISTOIRE + 1, 1);
    projets = await ma2mParcours(dateLocaleIso(debut), dateLocaleIso(fin));
    const ids = [...new Set(projets.flatMap(p => (p.mannequins || []).map(m => m.id).filter(Boolean)))];
    if (ids.length && typeof sb !== 'undefined' && sb) {
      // petits visages : la petite version (480 px) quand elle existe (js/photos.js)
      (await lirePhotosCouverture(sb, ids)).forEach(c => { photos[c.model_id] = urlLegere(urlGrille(c, true)); });
    }
    // Mois affiché au départ : le plus récent qui a des activités (sinon le mois en cours).
    const recents = projets.map(p => cleMois(p.date_fin || p.date_debut)).sort();
    moisChoisi = recents.length ? recents[recents.length - 1] : dateLocaleIso(fin).slice(0, 7);
    $('parcours-plus').addEventListener('click', () => { tousLesVisages = true; afficher(); });
    afficher();
  }
  // place gardée pour le programme le temps qu'il arrive (journal du 24/10/2026 : la page sautait
  // à l'arrivée des chiffres ; même principe que The Book, js/gabarit.js)
  demarrer().finally(() => { if (typeof libererPlaceListe === 'function') libererPlaceListe($('parcours-scene')); }).catch(e => { if (window.signalerErreur) window.signalerErreur('Parcours MA2M : chargement', (e && e.message) || String(e)); });
})();
