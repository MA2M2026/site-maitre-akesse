// Pages en écrans (22/11/2026, demande de la propriétaire : « on doit scroller du haut jusqu'en bas, on finit par se
// perdre »). Une page dont le <main> porte data-ecrans s'affiche comme une suite d'écrans : chaque <section> directe
// du <main> devient UN écran (accueil, vidéo, présentation…, le formulaire en dernier), avec « ← Retour » et
// « Suivant → » en bas, une barre de progression en haut, et le bouton Retour du téléphone qui revient à l'écran
// précédent (adresse #ecran-N). Le formulaire garde ses propres étapes (js/candidature-etapes.js, cours de talons…) :
// sur son écran, la barre ne montre « ← Retour » que tant que le formulaire est à sa première étape.
// Sans JavaScript, la page reste la page complète d'avant (rien n'est caché dans le HTML).
// Partagé par Intégrer l'agence, Postuler à un casting et Cours de talons (une seule pièce, règle n° 5). L'Inscription
// a déjà ses 4 écrans (js/inscription-simplifiee.js).
(function () {
  const main = document.querySelector('main[data-ecrans]');
  if (!main) return;
  const plein = main.dataset.ecrans === 'plein';
  const ancreDirecte = location.hash === '#inscription' || location.hash === '#candidature' || location.hash.startsWith('#porte-');
  if (plein && (new URLSearchParams(location.search).get('vue') === 'candidature' || ancreDirecte)) return;
  const fin = plein && (main.dataset.ecransFin || main.querySelector('.ma2m-couverture-presentation .ma2m-action')?.href);
  if (plein) {
    const informations = main.querySelector('.ma2m-informations-parcours');
    if (informations) {
      const accueilInfos = informations.querySelector('.ma2m-introduction-parcours');
      accueilInfos.id = informations.id;
      const rubriques = informations.querySelector('.ma2m-rubriques');
      if (rubriques) accueilInfos.appendChild(rubriques);
      const sections = [...informations.querySelectorAll(':scope > section')];
      sections.forEach((section) => { section.classList.add('ma2m-page-info'); section.hidden = false; });
      informations.replaceWith(...sections);
    }
    document.body.classList.add('ma2m-ecrans-pleins');
  }
  const EN = document.documentElement.lang === 'en';
  const T = (fr, en) => (EN ? en : fr);
  // (une adresse abîmée, ex. « #%zz » après un partage, ne doit pas bloquer la page)
  const decoder = (t) => { try { return decodeURIComponent(t); } catch (err) { return t; } };
  // une section trop longue pour un écran (ex. le programme : un écran par niveau) porte data-ecran-coupe="sélecteur" :
  // elle est coupée en plusieurs écrans, à chaque élément trouvé sauf le premier (même classe, même conteneur)
  main.querySelectorAll(':scope > section[data-ecran-coupe]').forEach((s) => {
    const coupures = [...s.querySelectorAll(s.dataset.ecranCoupe)].slice(1);
    let apres = s;
    coupures.forEach((c) => {
      const haut = apres, nouvelle = s.cloneNode(false);   // (section où se trouve l'élément : la dernière créée)
      nouvelle.removeAttribute('id'); nouvelle.removeAttribute('data-ecran-coupe'); nouvelle.removeAttribute('aria-labelledby');
      nouvelle.classList.add('ecran-suite');
      // L'élément et TOUT ce qui le suit passent dans le nouvel écran, à chaque niveau : ses suivants dans son conteneur,
      // puis les suivants de ce conteneur dans le sien… jusqu'à la section (ex. la phrase de fin du programme suit le
      // dernier mois). Les conteneurs sont recopiés vides, sans id : la mise en page (.container…) reste la même.
      const copies = new Map([[haut, nouvelle]]);
      const chaine = [];
      for (let e = c.parentElement; e && e !== haut; e = e.parentElement) chaine.unshift(e);
      let boite = nouvelle;
      chaine.forEach((e) => { const copie = e.cloneNode(false); copie.removeAttribute('id'); boite.appendChild(copie); boite = copie; copies.set(e, copie); });
      // (de l'élément vers la section, dans l'ordre d'avant le déplacement : chaine = ses conteneurs d'origine)
      [c].concat(chaine.slice().reverse()).forEach((e) => {
        const dest = copies.get(e === c ? c.parentElement : e.parentElement);
        for (let n = e === c ? c : e.nextSibling; n;) { const suivant = n.nextSibling; dest.appendChild(n); n = suivant; }
      });
      apres.after(nouvelle); apres = nouvelle;
    });
  });
  const ecrans = [...main.children].filter((e) => e.tagName === 'SECTION' && (!plein || !e.matches('#candidature, #inscription')));
  if (ecrans.length < 2) return;
  // (css/pages-ecrans.css est chargé normalement dans le <head> de chaque page : un seul écran visible dès l'affichage,
  // sans style ajouté par le script, que la protection CSP des pages refuserait)
  document.body.classList.add('ecrans-actif');
  ecrans.forEach((e, i) => { e.classList.add('ecran'); e.dataset.ecran = String(i + 1); });

  const progression = document.createElement('div');
  progression.className = 'ecrans-progression'; progression.setAttribute('aria-hidden', 'true');
  progression.appendChild(document.createElement('span'));
  main.prepend(progression);

  const barre = document.createElement('nav');
  barre.className = 'ecrans-barre lx-boutons';   // (boutons arrondis avec un reflet, comme les pages luxe : css/luxe.css)
  barre.setAttribute('aria-label', T('Navigation entre les écrans', 'Screen navigation'));
  // flèche dessinée (taille libre : le texte des boutons a une taille imposée, css/bouton-ma2m.css)
  const fleche = (sens) => '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
    + (sens > 0 ? '<path d="M4 12h15M13 6l6 6-6 6"/>' : '<path d="M20 12H5M11 6l-6 6 6 6"/>') + '</svg>';
  const retour = document.createElement('button'); retour.type = 'button'; retour.className = 'btn btn--principal ecrans-retour'; retour.innerHTML = fleche(-1); retour.setAttribute('aria-label', T('Retour', 'Back'));
  const compteur = document.createElement('span'); compteur.className = 'ecrans-compteur'; compteur.setAttribute('aria-live', 'polite');
  const suivant = document.createElement('button'); suivant.type = 'button'; suivant.className = 'btn btn--principal ecrans-suivant';
  suivant.innerHTML = fleche(1);
  // (23/11/2026, choix de la propriétaire) plus de grand bas de page sur ces pages : une petite ligne « Mentions légales ·
  // Confidentialité » en bas de CHAQUE écran, dans la barre (toujours visible, même pendant le formulaire)
  const legal = document.createElement('p'); legal.className = 'ecrans-legal';
  [['mentions-legales.html', T('Mentions légales', 'Legal notice')], ['politique-confidentialite.html', T('Confidentialité', 'Privacy')]].forEach(([href, texte], k) => {
    if (k) legal.append(' · ');
    const a = document.createElement('a'); a.href = href; a.textContent = texte; legal.appendChild(a);
  });
  if (plein) {
    retour.className = 'ecrans-retour';
    retour.textContent = T('← Retour', '← Back');
    const entete = document.querySelector('.header-v2-droite');
    (entete || main).prepend(retour);
    barre.append(suivant, legal);
  } else barre.append(legal, retour, compteur, suivant);
  document.body.appendChild(barre);

  const dernier = ecrans.length - 1;
  const formulaire = ecrans[dernier].querySelector('form');
  // formulaire à sa première étape (ou sans étapes) : « ← Retour » ramène à l'écran d'avant
  const formulaireAuDebut = () => {
    // (étapes des candidatures : .lx-etape[hidden] ; cours de talons : .ct-etape.u-hidden)
    const etapes = formulaire ? [...formulaire.querySelectorAll('.lx-etape, .ct-etape')] : [];
    return !etapes.length || !(etapes[0].hidden || etapes[0].classList.contains('u-hidden'));
  };
  let courant = -1;
  // place laissée à un écran : la fenêtre moins l'en-tête du site et la barre du bas (téléphone, tablette, ordinateur) ;
  // --ecran-dispo sert à css/pages-ecrans.css (un écran remplit exactement la fenêtre, sans défiler)
  function mesurer() {
    // (haut du contenu = haut du <main> + la fine barre de progression : le <main> ne colle pas en haut, sa position ne
    // dépend pas du défilement, contrairement à la barre de progression « collante »)
    const haut = main.getBoundingClientRect().top + window.scrollY + progression.offsetHeight;
    const dispo = Math.max(200, Math.round(window.innerHeight - haut - barre.offsetHeight));
    document.documentElement.style.setProperty('--ecran-dispo', dispo + 'px');
    document.documentElement.style.setProperty('--ecran-barre', barre.offsetHeight + 'px');
  }
  window.addEventListener('resize', () => mesurer());
  // (l'en-tête peut changer de hauteur quand les polices ou le logo arrivent : on remesure)
  window.addEventListener('load', () => mesurer());
  if ('fonts' in document) document.fonts.ready.then(() => mesurer()).catch(() => { /* rien */ });   /* (SonarCloud S6544) */
  if (!plein) ecrans[dernier].classList.add('ecran-formulaire');
  function majBarre() {
    if (plein) {
      retour.hidden = courant === 0;
      suivant.textContent = courant === dernier ? T('Commencer', 'Start') : T('Continuer', 'Continue');
      suivant.setAttribute('aria-label', suivant.textContent);
      mesurer();
      return;
    }
    const surFormulaire = courant === dernier;
    retour.hidden = courant === 0 || (surFormulaire && !formulaireAuDebut());
    suivant.hidden = surFormulaire;
    // (22/11/2026, choix de la propriétaire) de simples flèches rondes ; le nom du bouton reste lu par les lecteurs d'écran
    suivant.setAttribute('aria-label', courant === 0 ? T('Commencer', 'Start') : courant === dernier - 1 ? T('Remplir le formulaire', 'Fill in the form') : T('Suivant', 'Next'));
    compteur.textContent = surFormulaire ? '' : (courant + 1) + ' / ' + ecrans.length;
    // (formulaire après sa 1re étape : ses propres boutons prennent le relais ; la barre ne garde que la petite ligne)
    const sansFleches = retour.hidden && suivant.hidden;
    barre.classList.toggle('ecrans-barre--legal', sansFleches);
    document.body.classList.toggle('ecrans-sans-barre', sansFleches);
    document.body.classList.toggle('ecrans-dernier', surFormulaire);
    mesurer();
  }
  function aller(i, ajouterHistorique) {
    i = Math.max(0, Math.min(dernier, i));
    if (i === courant) return;
    const avant = courant;
    ecrans.forEach((e, k) => {
      const vu = k === i;
      e.classList.toggle('ecran-courant', vu);
      if (!vu) e.querySelectorAll('video').forEach((v) => { try { v.pause(); } catch (err) { /* rien */ } });
    });
    courant = i;
    if (ecrans[i].classList.contains('reveal')) ecrans[i].classList.add('visible');
    ecrans[i].querySelectorAll('.reveal:not(.visible)').forEach((r) => r.classList.add('visible'));
    progression.firstChild.style.width = Math.round(((i + 1) / ecrans.length) * 100) + '%';
    majBarre();
    if (plein) ecrans[i].scrollTop = 0;
    window.scrollTo({ top: 0, behavior: plein ? 'instant' : 'auto' }); mesurer();
    if (ajouterHistorique !== false) { try { history.pushState({ ecran: i, de: avant }, '', '#ecran-' + (i + 1)); } catch (err) { /* rien */ } }
    // (lecteurs d'écran) le titre du nouvel écran prend le focus, sans faire défiler
    const titre = i > 0 && ecrans[i].querySelector('h1, h2');
    if (titre) { if (!titre.hasAttribute('tabindex')) titre.setAttribute('tabindex', '-1'); titre.focus({ preventScroll: true }); }
  }
  // « ← Retour » : si l'écran d'avant est l'entrée précédente de l'historique, on y remonte (comme le bouton Retour du
  // téléphone), sinon on remplace l'entrée : quitter la page ne demande pas d'appuyer une fois par écran visité
  retour.addEventListener('click', () => {
    const st = history.state;
    if (st && st.ecran === courant && st.de === courant - 1) { history.back(); return; }
    const cible = courant - 1;
    aller(cible, false);
    try { history.replaceState({ ecran: cible }, '', '#ecran-' + (cible + 1)); } catch (err) { /* rien */ }
  });
  suivant.addEventListener('click', () => {
    if (plein && courant === dernier && fin) location.href = fin;
    else aller(courant + 1);
  });
  window.addEventListener('popstate', (ev) => {
    const n = ev.state && Number.isInteger(ev.state.ecran) ? ev.state.ecran : ecranDeAdresse();
    aller(n, false);
  });
  // un lien « #parcours », « #candidature »… mène à l'écran qui le contient (au lieu de faire défiler)
  document.addEventListener('click', (ev) => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const a = ev.target.closest && ev.target.closest('a[href^="#"]');
    if (!a) return;
    const id = decoder(a.getAttribute('href').slice(1));
    const cible = id && document.getElementById(id);
    const ecran = cible && cible.closest('section.ecran');
    if (!ecran) return;
    ev.preventDefault();
    aller(ecrans.indexOf(ecran));
  });
  // le formulaire change d'étape : la barre suit (Retour seulement à la première étape)
  if (formulaire) new MutationObserver(majBarre).observe(formulaire, { subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });

  function ecranDeAdresse() {
    const h = decoder(location.hash.slice(1));
    const m = /^ecran-(\d+)$/.exec(h);
    if (m) return Number(m[1]) - 1;
    const cible = h && document.getElementById(h);
    const ecran = cible && cible.closest('section.ecran');
    return ecran ? ecrans.indexOf(ecran) : 0;
  }
  // pour les autres scripts de la page : montrer l'écran qui contient un élément (ex. « Je choisis ce parcours » →
  // le formulaire, js/integrer-agence.js)
  window.PagesEcrans = {
    montrer(el) {
      const e = el && el.closest && el.closest('section.ecran');
      if (!e) return false;
      const i = ecrans.indexOf(e);
      if (i === courant) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); else aller(i);
      return true;
    }
  };
  const depart = ecranDeAdresse();
  try { history.replaceState({ ecran: depart }, ''); } catch (err) { /* rien */ }
  aller(depart, false);
})();
