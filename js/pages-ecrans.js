// Pages en écrans (22/11/2026, demande de la propriétaire : « on doit scroller du haut jusqu'en bas, on finit par se
// perdre »). Une page dont le <main> porte data-ecrans s'affiche comme une suite d'écrans : chaque <section> directe
// du <main> devient UN écran (accueil, vidéo, présentation…, le formulaire en dernier), avec « ← Retour » et
// « Suivant → » en bas, une barre de progression en haut, et le bouton Retour du téléphone qui revient à l'écran
// précédent (adresse #ecran-N). Le formulaire garde ses propres étapes (js/candidature-etapes.js, cours de talons…) :
// sur son écran, la barre ne montre « ← Retour » que tant que le formulaire est à sa première étape.
// Sans JavaScript, la page reste la page complète d'avant (rien n'est caché dans le HTML).
// Partagé par Intégrer l'agence, Postuler à un casting, Cours de talons et Inscription (une seule pièce, règle n° 5).
(function () {
  const main = document.querySelector('main[data-ecrans]');
  if (!main) return;
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
      const parent = c.parentElement, nouvelle = s.cloneNode(false);
      nouvelle.removeAttribute('id'); nouvelle.removeAttribute('data-ecran-coupe'); nouvelle.removeAttribute('aria-labelledby');
      nouvelle.classList.add('ecran-suite');
      // (éléments directement dans la section : déplacés tels quels ; sinon dans des copies vides de TOUS leurs conteneurs
      // jusqu'à la section, sans id : la mise en page, les marges du .container, reste la même)
      let boite = nouvelle;
      const chaine = [];
      for (let e = parent; e && e !== s; e = e.parentElement) chaine.unshift(e);
      chaine.forEach((e) => { const copie = e.cloneNode(false); copie.removeAttribute('id'); boite.appendChild(copie); boite = copie; });
      for (let n = c; n;) { const suivant = n.nextSibling; boite.appendChild(n); n = suivant; }
      apres.after(nouvelle); apres = nouvelle;
    });
  });
  const ecrans = [...main.children].filter((e) => e.tagName === 'SECTION');
  if (ecrans.length < 2) return;
  // l'essentiel (un seul écran visible) s'applique tout de suite : css/pages-ecrans.css arrive en différé
  // (js/css-differe.js), sans cela la page longue s'afficherait un instant puis « sauterait »
  const base = document.createElement('style');
  base.textContent = '.ecrans-actif main>section.ecran:not(.ecran-courant){display:none}.ecrans-barre{position:fixed;left:0;right:0;bottom:0;z-index:150}';
  document.head.appendChild(base);
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
  barre.append(retour, compteur, suivant);
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
  function majBarre() {
    const surFormulaire = courant === dernier;
    retour.hidden = courant === 0 || (surFormulaire && !formulaireAuDebut());
    suivant.hidden = surFormulaire;
    // (22/11/2026, choix de la propriétaire) de simples flèches rondes ; le nom du bouton reste lu par les lecteurs d'écran
    suivant.setAttribute('aria-label', courant === 0 ? T('Commencer', 'Start') : courant === dernier - 1 ? T('Remplir le formulaire', 'Fill in the form') : T('Suivant', 'Next'));
    compteur.textContent = surFormulaire ? '' : (courant + 1) + ' / ' + ecrans.length;
    barre.hidden = retour.hidden && suivant.hidden;
    document.body.classList.toggle('ecrans-sans-barre', barre.hidden);
    document.body.classList.toggle('ecrans-dernier', surFormulaire);
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
    window.scrollTo(0, 0);
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
  suivant.addEventListener('click', () => aller(courant + 1));
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
