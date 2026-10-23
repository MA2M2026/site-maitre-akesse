// Nouvelle Administration « vivante » (PLAN-NOUVELLE-ADMINISTRATION.md, 22/10/2026) : la
// décoration de la maison. La connexion, les droits et l'aiguillage restent dans
// js/portail/noyau.js (les fondations) ; ce fichier remplace seulement P.coque (en-tête, menu,
// barre du bas sur téléphone) et P.vuePortail (l'accueil vivant), et apporte les visages.
(function () {
  'use strict';
  const P = window.Portail;
  if (!P) return;

  // ---------- Visages (vignettes légères des photos du Book, js/photos.js) ----------
  // « 1 photo », « 3 photos » (jamais « photo(s) »)
  P.pluriel = (n, un, plusieurs) => n + ' ' + (n > 1 ? plusieurs : un);
  // (la civilité devant le nom ne compte pas : « Mademoiselle GRÂCE YAO » → GY)
  P.initiales = (nom) => String(nom || '').trim().split(/\s+/).filter((x, i, t) => !(t.length > 1 && /^(madame|mademoiselle|monsieur)$/i.test(x))).map((x) => x.charAt(0)).slice(0, 2).join('').toUpperCase();
  P.visage = (url, nom, classe) => '<span class="vis ' + (classe || '') + '"><span class="ini" aria-hidden="true">' + P.esc(P.initiales(nom)) + '</span>' +
    (url ? '<img src="' + P.esc(urlLegere(url)) + '" alt="" loading="lazy" decoding="async">' : '') + '</span>';
  // une photo affichée apparaît en fondu (l'évènement « load » ne remonte pas : capture)
  document.addEventListener('load', (e) => {
    if (e.target.tagName === 'IMG' && e.target.parentNode && e.target.parentNode.classList && e.target.parentNode.classList.contains('vis')) e.target.classList.add('charge');
  }, true);
  // Photo de couverture de chaque mannequin publiée : { id: url }
  P.photosCouverture = async (ids) => {
    if (!ids.length) return {};
    const lignes = await P.rpc('photos_couverture_mannequins', { ids });
    const parId = {};
    (lignes || []).forEach((p) => { parId[p.model_id] = p.url; });
    return parId;
  };
  // Nombre qui défile jusqu'à sa valeur (attribut data-compte)
  P.animerChiffres = (racine) => {
    (racine || document).querySelectorAll('[data-compte]').forEach((el) => {
      const cible = Number(el.dataset.compte) || 0, suffixe = el.dataset.suffixe || '';
      const ecrire = (v) => { el.textContent = Math.round(v).toLocaleString('fr-FR') + suffixe; };
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || !cible) { ecrire(cible); return; }
      const t0 = performance.now();
      const pas = (t) => { const k = Math.min(1, (t - t0) / 1100); ecrire(cible * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(pas); };
      requestAnimationFrame(pas);
    });
  };
  // Page de connexion : un mur des visages du Book derrière le texte (photos publiques)
  let murVisages = null;
  async function visagesPublics() {
    if (!murVisages) {
      murVisages = (async () => {
        const profils = await P.bd(sb.from('model_profiles').select('id, full_name').eq('published', true).order('created_at', { ascending: false }).limit(16));
        const photos = await P.photosCouverture(profils.map((m) => m.id));
        return profils.filter((m) => photos[m.id]).map((m) => [photos[m.id], m.full_name]);
      })().catch(() => []);
    }
    return murVisages;
  }
  new MutationObserver(() => {
    const g = document.querySelector('.connexion .g');
    if (!g || g.querySelector('.mur-fond')) return;
    const mur = document.createElement('div');
    mur.className = 'mur-fond'; mur.setAttribute('aria-hidden', 'true');
    g.prepend(mur);
    visagesPublics().then((v) => { if (mur.isConnected) mur.innerHTML = v.slice(0, 8).map((x) => P.visage(x[0], x[1])).join(''); }, () => { /* pas de visages : le fond reste uni */ });
  }).observe(document.getElementById('app'), { childList: true });

  // Téléphone : chaque ligne d'un tableau devient une petite carte (css « .tableau » en bas de
  // admin-vivante.css) ; chaque case reçoit le titre de sa colonne. La matrice reste une grille.
  function etiqueterTableaux() {
    document.querySelectorAll('.tableau table:not(.matrice):not([data-etiquete])').forEach((t) => {
      t.setAttribute('data-etiquete', '');
      const titres = Array.from(t.querySelectorAll('thead th'), (th) => th.textContent.trim());
      t.querySelectorAll('tbody tr').forEach((tr) => Array.from(tr.children).forEach((td, i) => { if (titres[i] && !td.hasAttribute('colspan')) td.setAttribute('data-titre', titres[i]); }));
    });
  }
  // Écrans repris de l'ancien tableau de bord (.ecran-partage) : titres sans émoji, comme les
  // autres pages, et longues explications repliées sous « En savoir plus » (visite du 22/10/2026).
  const EMOJI_DEBUT = /^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u;
  function harmoniserEcransPartages() {
    // (grande visite du 22/10/2026 : aucun émoji en tête des titres, boutons, choix et pastilles, partout)
    // (seulement les éléments nouveaux : ceux déjà vus portent data-sans-emoji)
    document.querySelectorAll('#contenu :is(h1, h2, h3, button, a.btn, label.btn, option, summary, .pastille, .btn-mini-admin):not([data-sans-emoji])').forEach((h) => {
      h.setAttribute('data-sans-emoji', '');
      const t = h.firstChild;
      if (t && t.nodeType === 3 && EMOJI_DEBUT.test(t.textContent)) t.textContent = t.textContent.replace(EMOJI_DEBUT, '');
      else if (t && t.nodeType === 1 && t.matches('img.emoji')) t.remove();
    });
    document.querySelectorAll('.ecran-partage:not([data-harmonise])').forEach((ecran) => {
      ecran.setAttribute('data-harmonise', '');
      ecran.querySelectorAll('p.tdb-5, p.tdb-9, p.tdb-12, p.tdb-17').forEach((p) => {
        if (p.textContent.length < 160 || p.closest('details.aide')) return;
        const d = document.createElement('details');
        d.className = 'aide';
        d.innerHTML = '<summary>En savoir plus</summary>';
        p.replaceWith(d); d.appendChild(p);
      });
    });
  }
  // Formulaires de saisie (blocs 2 et 3) : repliés derrière « ＋ … », la liste d'abord (grande visite du
  // 22/10/2026) ; un appui les ouvre. Les pages elles-mêmes ne changent pas (même logique partout).
  const SAISIES = ['compta-ecrire', 'compta-virement', 'compta-compte', 'compta-document', 'compta-impot', 'compta-dette',
    'compta-payer-personne', 'compta-materiel', 'compta-tiers', 'lien-ajouter'];
  function replierSaisies() {
    document.querySelectorAll('#contenu form.carte.f[data-form]:not([data-replie])').forEach((form) => {
      if (!SAISIES.includes(form.getAttribute('data-form'))) return;
      form.setAttribute('data-replie', '');
      const titre = form.querySelector('h2'), bouton = document.createElement('button');
      bouton.type = 'button'; bouton.className = 'btn rouge ouvrir-saisie';
      bouton.textContent = '＋ ' + (titre ? titre.textContent.trim() : 'Nouvelle saisie');
      bouton.setAttribute('aria-expanded', 'false');
      form.hidden = true;
      form.before(bouton);
      bouton.addEventListener('click', () => { form.hidden = false; bouton.remove(); const champ = form.querySelector('input, select, textarea'); if (champ) champ.focus(); });
    });
  }
  // Menu : la rubrique ouverte reste visible (menu long sur un ordinateur portable)
  function rubriqueVisible() {
    const a = document.querySelector('.lateral .nav.actif:not([data-vu])');
    if (!a) return;
    a.setAttribute('data-vu', '');
    const menu = a.closest('.lateral'), r = a.getBoundingClientRect(), m = menu.getBoundingClientRect();
    if (r.bottom > m.bottom - 40 || r.top < m.top) menu.scrollTop += r.top - m.top - m.height / 3;
  }
  // Visages partout (demande de la propriétaire, 22/10/2026 : « les photos des mannequins partout où
  // se trouve leur nom, et cliquables ») : devant chaque lien vers la fiche d'une mannequin des
  // Paiements (#/paiements/fiche/<id du registre>), sa photo du Book en médaillon, qui ouvre la même
  // fiche ; initiales tant que la photo arrive, ou si elle n'est pas inscrite sur le site.
  const photoDuRegistre = {};  // id du registre → adresse de la photo ('' : pas de photo)
  const paquets = (l, n) => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, i * n + n));
  // lecture par paquets de n identifiants (une longue liste ne tient pas dans une adresse) :
  // lire(paquet) renvoie une liste ; les réponses sont mises bout à bout. Partagé par les pages.
  P.parPaquets = async (ids, n, lire) => {
    let tous = [];
    for (const p of paquets(ids, n)) tous = tous.concat((await lire(p)) || []);
    return tous;
  };
  // compte du site : donné par la page (data-compte) ; sinon cherché dans le registre (par paquets
  // de 100, pour des adresses courtes) ; puis les photos de tous ces comptes
  async function chercherPhotos(ids, compteDe) {
    ids.forEach((id) => { photoDuRegistre[id] = ''; });  // (une seule recherche par mannequin)
    const inconnus = ids.filter((id) => !compteDe[id]);
    for (const p of paquets(inconnus, 100)) {
      (await P.bd(sb.from('agence_mannequins').select('id, user_id').in('id', p))).forEach((l) => { if (l.user_id) compteDe[l.id] = l.user_id; });
    }
    const comptes = [...new Set(ids.map((id) => compteDe[id]).filter(Boolean))];
    for (const p of paquets(comptes, 100)) {
      const parCompte = await P.photosCouverture(p);
      ids.forEach((id) => { if (parCompte[compteDe[id]]) photoDuRegistre[id] = parCompte[compteDe[id]]; });
    }
  }
  // Même règle pour les fiches du Book (#/site/b2-mannequins-publies/<id du profil>, 23/10/2026 :
  // « partout où il y a le nom d'un mannequin, sa photo cliquable, avec son nom à côté »).
  const photoDuProfil = {};  // id du profil → adresse de la photo ('' : pas de photo)
  const photoDeCandidature = {};  // id de la candidature → première photo jointe
  async function chercherPhotosProfils(ids) {
    ids.forEach((id) => { photoDuProfil[id] = ''; });
    for (const p of paquets(ids, 100)) Object.assign(photoDuProfil, await P.photosCouverture(p));
  }
  const FICHES = [
    { liens: 'a[href^="#/paiements/fiche/"]', photos: photoDuRegistre, attribut: 'data-visage-registre',
      chercher: (ids, liens) => { const compteDe = {}; liens.forEach((a) => { if (a.dataset.compte) compteDe[a.getAttribute('href').split('/').pop()] = a.dataset.compte; }); return chercherPhotos(ids, compteDe); } },
    { liens: 'a[href^="#/site/b2-mannequins-publies/"]', photos: photoDuProfil, attribut: 'data-visage-profil', chercher: chercherPhotosProfils,
      // (le lien du nom seulement : pas « CV », pas un lien qui porte déjà sa photo)
      garde: (a) => /^#\/site\/b2-mannequins-publies\/[^/]+$/.test(a.getAttribute('href')) && !a.querySelector('img, .vis') },
    // candidature (codes d'accès…) : sa première photo jointe (P.photosDossiers, js/admin/site-dossiers.js)
    { liens: 'a[href^="#/site/b2-candidatures/"]', photos: photoDeCandidature, attribut: 'data-visage-candidature',
      chercher: async (ids) => { ids.forEach((id) => { photoDeCandidature[id] = ''; }); if (P.photosDossiers) Object.assign(photoDeCandidature, await P.photosDossiers('b2-candidatures', ids)); },
      garde: (a) => /^#\/site\/b2-candidatures\/[^/]+$/.test(a.getAttribute('href')) && !a.querySelector('img, .vis') }
  ];
  function visagesDesFiches() {
    FICHES.forEach((f) => {
      const liens = [...document.querySelectorAll('#contenu ' + f.liens + ':not(.btn):not(.visage-lien):not(.retour-liste):not([data-visage])')].filter((a) => !f.garde || f.garde(a));
      // emplacements d'une photo dans une case à cocher ou un choix (la photo sélectionne, le nom est à côté)
      const places = [...document.querySelectorAll('#contenu [' + f.attribut + ']:not([data-vu]), #fenetre [' + f.attribut + ']:not([data-vu])')];
      if (!liens.length && !places.length) return;
      const poserLien = (a) => {
        const id = a.getAttribute('href').split('/').pop(), nom = a.textContent.trim();
        const v = a.previousElementSibling && a.previousElementSibling.classList.contains('visage-lien') ? a.previousElementSibling : null;
        const html = '<a class="visage-lien" href="' + P.esc(a.getAttribute('href')) + '" tabindex="-1" aria-hidden="true">' + P.visage(f.photos[id] || '', nom, 'rond-vis') + '</a>';
        if (v) v.outerHTML = html; else a.insertAdjacentHTML('beforebegin', html);
      };
      const poserPlace = (el) => { el.setAttribute('data-vu', ''); el.innerHTML = P.visage(f.photos[el.getAttribute(f.attribut)] || '', el.dataset.nom || '', 'rond-vis'); };
      liens.forEach((a) => { a.setAttribute('data-visage', ''); poserLien(a); });
      places.forEach(poserPlace);
      const idsLiens = liens.map((a) => a.getAttribute('href').split('/').pop());
      const manquants = [...new Set(idsLiens.concat(places.map((el) => el.getAttribute(f.attribut))))].filter((id) => id && !(id in f.photos));
      if (manquants.length) {
        // (photos arrivées : on les pose partout où ces mannequins sont affichées MAINTENANT,
        // la page a pu être redessinée pendant la recherche)
        f.chercher(manquants, liens).then(() => {
          document.querySelectorAll('#contenu ' + f.liens + '[data-visage]').forEach((a) => { if (manquants.includes(a.getAttribute('href').split('/').pop())) poserLien(a); });
          document.querySelectorAll('#contenu [' + f.attribut + '], #fenetre [' + f.attribut + ']').forEach((el) => { if (manquants.includes(el.getAttribute(f.attribut))) poserPlace(el); });
        }, () => { /* initiales gardées */ });
      }
    });
  }
  // Un nom écrit seul (tiers d'une écriture de la Comptabilité, bénéficiaire d'un cachet…) :
  // emplacement <span data-visage-nom="Nom">. Si c'est une mannequin du registre, sa photo s'y
  // place ; sinon (fournisseur, client…), rien.
  const registreParNom = {};  // nom en minuscules → id du registre ('' : pas une mannequin)
  const nomsEnCours = new Set();  // noms en cours de recherche (pas encore de réponse)
  async function chercherNoms(noms) {
    noms.forEach((n) => nomsEnCours.add(n.toLowerCase()));
    const compteDe = {}, trouves = {};
    for (const p of paquets(noms, 50)) {
      (await P.bd(sb.from('agence_mannequins').select('id, full_name, user_id').in('full_name', p))).forEach((l) => {
        trouves[String(l.full_name).toLowerCase()] = l.id;
        if (l.user_id) compteDe[l.id] = l.user_id;
      });
    }
    const ids = [...new Set(Object.values(trouves).filter((id) => !(id in photoDuRegistre)))];
    if (ids.length) await chercherPhotos(ids, compteDe);
    noms.forEach((n) => { const k = n.toLowerCase(); registreParNom[k] = trouves[k] || ''; nomsEnCours.delete(k); });
  }
  function visagesParNom() {
    const places = [...document.querySelectorAll('#contenu [data-visage-nom]:not([data-vu]), #fenetre [data-visage-nom]:not([data-vu])')];
    if (!places.length) return;
    const poser = (el) => {
      const id = registreParNom[el.dataset.visageNom.toLowerCase()];
      if (id === undefined) return;
      el.setAttribute('data-vu', '');
      el.innerHTML = id ? P.visage(photoDuRegistre[id] || '', el.dataset.visageNom, 'rond-vis') : '';
    };
    places.forEach(poser);
    const inconnus = [...new Set(places.map((el) => el.dataset.visageNom).filter((n) => n && !(n.toLowerCase() in registreParNom) && !nomsEnCours.has(n.toLowerCase())))];
    // (réponse arrivée : on reprend tous les emplacements affichés MAINTENANT)
    if (inconnus.length) chercherNoms(inconnus).then(() => visagesParNom(), () => { inconnus.forEach((n) => nomsEnCours.delete(n.toLowerCase())); });
  }
  // (regroupé : une seule passe après une rafale de changements, pas une par image des chiffres animés)
  let retouche = 0;
  const retoucheur = new MutationObserver(() => {
    if (retouche) return;
    retouche = setTimeout(() => { retouche = 0; etiqueterTableaux(); harmoniserEcransPartages(); replierSaisies(); rubriqueVisible(); visagesDesFiches(); visagesParNom(); }, 60);
  });
  retoucheur.observe(document.getElementById('app'), { childList: true, subtree: true });
  // (la fenêtre par-dessus la page : ses choix à photos aussi)
  new MutationObserver(() => { visagesDesFiches(); visagesParNom(); }).observe(document.getElementById('fenetre'), { childList: true, subtree: true });

  // ---------- Choisir une mannequin par sa photo (23/10/2026) ----------
  // Au lieu d'une liste déroulante de noms : une recherche et une grille de médaillons, le nom à
  // côté. Le choix remplit un champ caché (nom du formulaire inchangé) et déclenche son
  // data-change, comme la liste d'avant. items : [{ id, nom, note }] ; sorte : 'registre' (photo par
  // le registre des Paiements) ou 'profil' (photo du Book) ; autres : [[valeur, libellé]] proposés
  // en premier (« Personne extérieure », « Tous les mannequins »…).
  P.choixVisages = (o) => {
    const bouton = (valeur, contenu, nomTexte) => '<button type="button" class="cvi-item" role="option" aria-selected="' + (String(o.valeur || '') === String(valeur)) + '" data-valeur="' + P.esc(valeur) + '" data-texte="' + P.esc(String(nomTexte || '').toLowerCase()) + '">' + contenu + '</button>';
    return '<div class="choix-visages large"><span class="fl-titre">' + P.esc(o.libelle || 'Mannequin') + '</span>' +
      '<input type="hidden" id="' + P.esc(o.id) + '" name="' + P.esc(o.nom) + '" value="' + P.esc(o.valeur || '') + '"' + (o.change ? ' data-change="' + P.esc(o.change) + '"' : '') + '>' +
      (o.items.length > 8 ? '<input type="search" class="cvi-recherche" placeholder="Rechercher un nom…" aria-label="Rechercher une mannequin">' : '') +
      '<div class="cvi-grille" role="listbox" aria-label="' + P.esc(o.libelle || 'Mannequin') + '">' +
      (o.autres || []).map((x) => bouton(x[0], '<span class="cvi-autre" aria-hidden="true">' + (x[2] || '＋') + '</span><span class="cvi-nom">' + P.esc(x[1]) + '</span>', x[1])).join('') +
      o.items.map((m) => bouton(m.id, '<span data-visage-' + o.sorte + '="' + P.esc(m.id) + '" data-nom="' + P.esc(m.nom) + '"></span><span class="cvi-nom">' + P.esc(m.nom) + (m.note ? '<small class="doux">' + P.esc(m.note) + '</small>' : '') + '</span>', m.nom)).join('') +
      '</div></div>';
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.cvi-item');
    if (!b) return;
    const boite = b.closest('.choix-visages'), champ = boite.querySelector('input[type=hidden]');
    boite.querySelectorAll('.cvi-item').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    champ.value = b.dataset.valeur;
    champ.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.addEventListener('input', (e) => {
    if (!e.target.classList || !e.target.classList.contains('cvi-recherche')) return;
    const q = e.target.value.trim().toLowerCase();
    e.target.closest('.choix-visages').querySelectorAll('.cvi-item').forEach((x) => { x.hidden = !!q && !x.dataset.texte.includes(q); });
  });

  P.compte = (n, suffixe) => '<span data-compte="' + (Number(n) || 0) + '"' + (suffixe ? ' data-suffixe="' + P.esc(suffixe) + '"' : '') + '>0' + P.esc(suffixe || '') + '</span>';

  // ---------- Les trois blocs ----------
  const ICONES = {
    accueil: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    site: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 21h8M12 18v3"/>',
    paiements: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11h20M6 15h4"/>',
    compta: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 10h8M8 14h8M8 18h5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
  };
  const icone = (cle, taille) => '<svg width="' + (taille || 20) + '" height="' + (taille || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONES[cle] + '</svg>';
  const COURT = { site: 'Le site', paiements: 'Paiements', compta: 'Compta' };
  const premierePage = P.premierePage;  // js/portail/noyau.js
  const blocsPermis = () => ['site', 'paiements', 'compta'].filter((k) => P.moi.espaces[k] && P.espaces[k]);
  const lienSecurite = () => P.moi.role === 'principal' ? ['#/securite/comptes', 'Sécurité et journal'] : ['#/securite/codes', 'Mes codes de secours'];

  function enTete(titre, court) {
    return '<header class="haut"><a class="marque" href="#/" aria-label="Accueil de l’Administration">' +
      '<img class="logo-portail logo-haut" src="/assets/logo-header-clair.png" width="600" height="182" alt="Maître Akesse Model Management"></a>' +
      '<div class="bloc-actuel"><span class="long">' + P.esc(titre) + '</span>' + (court ? '<span class="court">' + P.esc(court) + '</span>' : '') + '</div>' +
      '<div class="qui"><b>' + P.esc(P.moi.nom) + '</b>' + P.esc(P.ROLES[P.moi.role]) + '</div></header>';
  }
  function barreBas(module, avecMenu) {
    return '<nav class="onglets-bas" aria-label="Blocs de l’Administration">' +
      '<a href="#/"' + (!module ? ' class="actif" aria-current="page"' : '') + '>' + icone('accueil') + 'Accueil</a>' +
      blocsPermis().map((k) => '<a href="#/' + k + '/' + premierePage(P.espaces[k]) + '"' + (k === module ? ' class="actif" aria-current="page"' : '') + '>' + icone(k) + COURT[k] + '</a>').join('') +
      (avecMenu ? '<button type="button" data-action="menu-ouvrir" aria-controls="menu-lateral" aria-expanded="false">' + icone('menu') + 'Rubriques</button>' : '') +
      '</nav>';
  }

  // Coque d'un bloc : en-tête, menu des rubriques (à gauche ; en bas, en tiroir, sur téléphone)
  P.coque = (module, page, html) => {
    const esp = P.espaces[module];
    const nav = esp.nav.filter((n) => !n[2] || n[2]()).map((n) => !n[0] ? '<div class="titre-menu">' + P.esc(n[1]) + '</div>' :
      '<a class="nav' + (n[0] === page ? ' actif' : '') + '" href="#/' + module + '/' + n[0] + '"' + (n[0] === page ? ' aria-current="page"' : '') + '><span>' + P.esc(n[1]) + '</span>' +
      (esp.compteur && esp.compteur[n[0]] ? '<span class="compteur">' + esp.compteur[n[0]] + '</span>' : '') + '</a>').join('');
    const blocs = '<div class="blocs">' + '<a class="bloc" href="#/">' + icone('accueil') + 'Accueil</a>' +
      blocsPermis().map((k) => '<a class="bloc' + (k === module ? ' actif' : '') + '" href="#/' + k + '/' + premierePage(P.espaces[k]) + '">' + icone(k) + P.esc(P.ESPACES[k]) + '</a>').join('') + '</div>';
    const secu = lienSecurite();
    return '<div class="coque">' + enTete(P.ESPACES[module] || 'Sécurité', { site: 'Administration du site', paiements: 'Paiements', compta: 'Comptabilité' }[module]) +
      '<div class="voile-menu" data-action="menu-fermer"></div>' +
      '<nav class="lateral" id="menu-lateral" aria-label="' + P.esc(P.ESPACES[module] || 'Sécurité') + '">' + blocs + nav +
      '<div class="lateral-pied"><a class="btn petit clair" href="' + secu[0] + '">' + P.esc(secu[1]) + '</a>' +
      '<button class="btn petit clair" data-action="deconnexion">Déconnexion</button></div></nav>' +
      '<main class="contenu" id="contenu">' + html + '</main>' + barreBas(module, true) + '</div>';
  };

  // ---------- Accueil vivant ----------
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  function dateDuJour() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Abidjan' }));
    return { jour: JOURS[d.getDay()], date: d.getDate() + ' ' + P.MOIS[d.getMonth()] };
  }
  // Une lecture qui échoue ne casse pas l'accueil : sa carte disparaît simplement
  // (partagés avec les pièces du bloc 1 : P.essai, P.nombre)
  const essai = P.essai = (promesse) => Promise.resolve(promesse).catch(() => null);
  const nombre = P.nombre = async (requete) => { const r = await requete; if (r.error) throw r.error; return r.count || 0; };

  async function donneesSite() {
    const aujourdhui = P.aujourdhui();
    const [profils, nouvelles, projets, aValider, recruteurs] = await Promise.all([
      essai(P.bd(sb.from('model_profiles').select('id, full_name, niveau_mannequin, city').eq('published', true).order('created_at', { ascending: false }).limit(40))),
      essai(nombre(sb.from('casting_applications').select('id', { count: 'exact', head: true }).eq('status', 'nouvelle'))),
      essai(P.bd(sb.from('agenda_projets').select('id, titre, type, date_debut, date_fin, lieu, ville, annule, mannequin_ids').eq('annule', false).or('date_debut.gte.' + aujourdhui + ',date_fin.gte.' + aujourdhui).order('date_debut').limit(10))),  // en cours ou à venir
      essai(nombre(sb.from('model_profiles').select('id', { count: 'exact', head: true }).eq('en_attente_validation', true))),
      essai(nombre(sb.from('recruiter_requests').select('id', { count: 'exact', head: true }).eq('status', 'nouvelle')))
    ]);
    const prochain = (projets || []).find((p) => (p.date_fin || p.date_debut) >= aujourdhui) || null;
    let reponses = null;
    if (prochain) {
      const parts = await essai(P.bd(sb.from('convocation_participants').select('id, model_id, parent, reponse').eq('projet_id', prochain.id)));
      if (parts && parts.length) {
        const vus = {}, uniques = [];
        parts.forEach((x) => { const g = x.model_id || x.id; if (!vus[g] || (!vus[g].reponse && x.reponse)) { if (!vus[g]) uniques.push(g); vus[g] = x; } });
        reponses = { total: uniques.length, confirme: uniques.filter((g) => vus[g].reponse === 'confirme').length, sans: uniques.filter((g) => !vus[g].reponse).length };
      }
    }
    const liste = profils || [];
    const photos = await essai(P.photosCouverture(liste.map((p) => p.id).concat(prochain ? prochain.mannequin_ids || [] : []).filter((x, i, l) => l.indexOf(x) === i))) || {};
    return { profils: liste, photos, nouvelles, prochain, reponses, aValider, recruteurs };
  }
  async function donneesPaiements() {
    const declares = await essai(nombre(sb.from('paiements_mannequins').select('id', { count: 'exact', head: true }).eq('statut', 'declare')));
    return { declares };
  }
  async function donneesCompta() {
    const soldes = await essai(P.rpc('compta_soldes'));
    return { total: soldes ? soldes.reduce((s, x) => s + (Number(x.solde) || 0), 0) : null };
  }

  function dateCourte(d) { const s = String(d).slice(0, 10).split('-'); return Number(s[2]) + ' ' + P.MOIS[Number(s[1]) - 1]; }
  function affiche(site) {
    const p = site.prochain;
    if (!p) return '';
    const auj = P.aujourdhui(), quand = p.date_debut === auj || (p.date_fin && p.date_debut <= auj && p.date_fin >= auj) ? 'Aujourd’hui' : 'Prochain projet · ' + dateCourte(p.date_debut);
    const ids = (p.mannequin_ids || []).filter((id) => site.photos[id]).slice(0, 4);
    const fond = (ids.length ? ids.map((id) => [site.photos[id], '']) : site.profils.slice(0, 4).map((m) => [site.photos[m.id], m.full_name]));
    const r = site.reponses;
    return '<a class="affiche apparait" href="#/site/b2-convocations" style="--i:1"><span class="fond">' + fond.map((f) => P.visage(f[0], f[1])).join('') + '</span>' +
      '<span class="txt"><span class="surtitre">' + P.esc(quand) + (p.lieu || p.ville ? ' · ' + P.esc([p.lieu, p.ville].filter(Boolean).join(', ')) : '') + '</span>' +
      '<span class="titre">' + P.esc(p.titre) + '</span>' +
      (r ? '<span class="surtitre">Réponses : ' + r.confirme + ' sur ' + r.total + ' confirmées' + (r.sans ? ' · ' + r.sans + ' sans réponse' : '') + '</span>' +
        '<span class="jauge"><i data-largeur="' + Math.round(100 * r.confirme / Math.max(1, r.total)) + '"></i></span>' : '<span class="surtitre">Aucune convocation envoyée pour l’instant</span>') +
      '</span></a>';
  }
  function taches(site, paiements) {
    const t = [];
    if (site && site.nouvelles) t.push(['#/site/b2-candidatures', 'Candidatures à étudier', 'Casting et agence', site.nouvelles, true]);
    if (site && site.aValider) t.push(['#/site/b2-validations', 'Fiches mannequins à valider', 'Espace mannequin', site.aValider, true]);
    if (site && site.recruteurs) t.push(['#/site/b2-recruteurs', 'Demandes de recruteurs à lire', 'Marques et organisateurs', site.recruteurs, true]);
    if (site && site.reponses && site.reponses.sans) t.push(['#/site/b2-convocations', 'Mannequins sans réponse', site.prochain.titre, site.reponses.sans, true]);
    if (paiements && paiements.declares) t.push(['#/paiements/a-valider', 'Paiements « J’ai payé » à valider', 'Wave et espèces', paiements.declares, true]);
    if (!t.length) return '<div class="taches apparait" style="--i:2"><div class="tache"><span class="point"></span><span class="t">Rien d’urgent<small>Tout est à jour pour le moment.</small></span></div></div>';
    return '<div class="taches apparait" style="--i:2">' + t.map((x) => '<a class="tache" href="' + x[0] + '"><span class="point' + (x[4] ? ' chaud' : '') + '"></span>' +
      '<span class="t">' + P.esc(x[1]) + '<small>' + P.esc(x[2]) + '</small></span><b>' + P.compte(x[3]) + '</b></a>').join('') + '</div>';
  }
  function ruban(site) {
    const avecPhoto = site.profils.filter((m) => site.photos[m.id]);
    if (!avecPhoto.length) return '';
    const carte = (m, cache) => '<a class="carte-vis" href="#/site/b2-mannequins-publies/' + P.esc(encodeURIComponent(m.id)) + '"' + (cache ? ' aria-hidden="true" tabindex="-1"' : '') + '>' + P.visage(site.photos[m.id], m.full_name) +
      '<b>' + P.esc(m.full_name) + '</b><span>' + P.esc([m.niveau_mannequin, m.city].filter(Boolean).join(' · ')) + '</span></a>';
    return '<div class="section-titre apparait" style="--i:4"><h2>Nos mannequins</h2><a href="#/site/b2-mannequins-publies">Tout voir →</a></div>' +
      '<div class="ruban apparait" style="--i:5"><div class="piste">' + avecPhoto.map((m) => carte(m, false)).join('') + avecPhoto.map((m) => carte(m, true)).join('') + '</div></div>';
  }
  function blocsAccueil(site, paiements, compta) {
    const cartes = blocsPermis().map((k, i) => {
      const lien = '#/' + k + '/' + premierePage(P.espaces[k]);
      let grand = '', legende = '';
      if (k === 'site' && site) { grand = P.compte(site.profils.length); legende = 'mannequins publiés au Book'; }
      if (k === 'paiements' && paiements) { grand = paiements.declares == null ? '—' : P.compte(paiements.declares); legende = 'paiements déclarés à valider'; }
      if (k === 'compta' && compta) { grand = compta.total == null ? '—' : P.compte(compta.total, ' F'); legende = 'en caisse et en banque'; }
      return '<a class="bloc-accueil apparait' + (i === 0 ? ' noir' : '') + '" style="--i:' + (3 + i) + '" href="' + lien + '">' +
        '<span class="nom">' + P.esc(P.ESPACES[k]) + '</span><span><span class="grand">' + grand + '</span><span class="legende" style="display:block">' + P.esc(legende) + '</span></span>' +
        '<span class="pied"><span>Ouvrir</span><span class="fleche" aria-hidden="true">→</span></span></a>';
    }).join('');
    return '<div class="blocs-accueil">' + cartes + '</div>';
  }

  P.vuePortail = async () => {
    const d = dateDuJour();
    const [site, paiements, compta] = await Promise.all([
      P.moi.espaces.site ? essai(donneesSite()) : null,
      P.moi.espaces.paiements ? essai(donneesPaiements()) : null,
      P.moi.espaces.compta ? essai(donneesCompta()) : null
    ]);
    const phrase = {
      principal: 'Voici l’essentiel de la journée. Touchez un bloc pour y entrer.',
      site: 'Le site au quotidien : mannequins, castings, contenu. Aucune donnée financière.',
      caisse: 'Les paiements des mannequins : à valider, en retard, messages.',
      compta: 'La comptabilité de l’agence. Sur les mannequins, vous ne voyez que des totaux.'
    }[P.moi.role];
    const secu = lienSecurite();
    return '<div class="coque sans-menu">' + enTete('Bonjour, ' + P.moi.nom) +
      '<main class="contenu" id="contenu">' +
      '<div class="accueil-tete"><div class="date">' + P.esc(d.jour.charAt(0).toUpperCase() + d.jour.slice(1)) + '<span>' + P.esc(d.date) + '</span></div>' +
      '<p class="bonjour">' + P.esc(phrase) + '</p></div>' +
      (site ? affiche(site) : '') +
      taches(site, paiements) +
      blocsAccueil(site, paiements, compta) +
      (site ? ruban(site) : '') +
      '<div class="pied-portail"><span class="ligne"><a class="btn petit" href="' + secu[0] + '">' + P.esc(secu[1]) + '</a>' +
      (P.installee() ? '' : '<button class="btn petit" data-action="installer">Installer l’application</button>') +
      '<button class="btn petit" data-action="deconnexion">Déconnexion</button></span><a href="/" class="retour">Voir le site public →</a></div>' +
      '</main>' + barreBas('', false) + '</div>';
  };
  P.apresPortail = () => {
    P.animerChiffres(document.getElementById('app'));
    // la jauge des réponses se remplit après l'apparition de l'affiche
    setTimeout(() => document.querySelectorAll('.affiche .jauge i[data-largeur]').forEach((i) => { i.style.width = i.dataset.largeur + '%'; }), 350);
    // anciennes photos du Book : versions légères refaites en arrière-plan, une fois par session
    // (js/photos.js ; avant, par l'ancien tableau de bord, 8 secondes après la connexion)
    if (P.moi.espaces.site && typeof rattraperPhotosEnArrierePlan === 'function') {
      setTimeout(() => rattraperPhotosEnArrierePlan().catch((e) => console.warn('Rattrapage des photos :', e)), 8000);
    }
  };
})();
