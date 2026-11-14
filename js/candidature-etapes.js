// Formulaire de candidature en étapes (14/11/2026, maquette validée par la propriétaire : maquettes/postuler-casting.html)
// — « Postuler à un casting » et « Intégrer l'agence » (FR/EN), dans l'« architecture » premium des cours de talons :
// barre de progression (1 Le casting / Votre parcours, 2 Vous, 3 Mensurations, 4 Photos & vidéo), une étape à la fois
// avec « Retour » / « Suivant » (chaque étape vérifiée avant de passer), puis le résumé « Votre candidature » avec
// « Changer » sur chaque ligne, et « Envoyer ». Les castings ouverts deviennent des cartes à toucher.
// Rien ne change à l'envoi (js/formulaire-candidature.js) : ce script RANGE les champs existants (mêmes identifiants,
// mêmes écouteurs) dans des étapes. À charger APRÈS js/formulaire-candidature.js.
(function () {
  'use strict';
  const form = document.getElementById('form-casting');
  if (!form || form.dataset.etapes) return;
  form.dataset.etapes = '1';
  const EN = document.documentElement.lang === 'en';
  const T = (fr, en) => (EN ? en : fr);
  const projet = form.dataset.parcours === 'projet';
  const $ = (id) => document.getElementById(id);
  const enfants = Array.from(form.children).filter((e) => e.tagName !== 'SCRIPT');
  const intro = enfants.find((e) => e.classList.contains('ca-7'));
  if (!intro || !$('btn-envoyer')) return;   // (champs pas encore écrits : rien à ranger)

  const NOMS = [projet ? T('Le casting', 'The casting') : T('Votre parcours', 'Your path'), T('Vous', 'You'), T('Mensurations', 'Measurements'), T('Photos & vidéo', 'Photos & video')];
  const TITRES = [projet ? T('Choisissez le casting', 'Choose the casting') : T('Votre parcours', 'Your path'), T('Parlez-nous de vous', 'Tell us about yourself'),
    T('Vos mensurations', 'Your measurements'), T('Vos photos et votre vidéo', 'Your photos and video')];

  // ---------- construction : barre, 4 étapes, résumé
  const el = (tag, cls, texte) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texte) e.textContent = texte; return e; };
  const barre = el('ol', 'lx-progression'); barre.setAttribute('aria-label', T('Étapes', 'Steps'));
  NOMS.forEach((n) => barre.appendChild(el('li', '', n)));
  form.parentNode.insertBefore(barre, form);
  const etapes = TITRES.map((titre, i) => {
    const f = el('fieldset', 'lx-etape'); f.dataset.etape = String(i + 1);
    const leg = el('legend', 'u-lecteur-ecran', T('Étape ', 'Step ') + (i + 1) + ' : ' + titre); f.appendChild(leg);
    const t = el('div', 'lx-etape-titre'); t.appendChild(el('span', '', String(i + 1))); t.appendChild(el('h3', '', titre)); f.appendChild(t);
    return f;
  });
  const debut = enfants.slice(0, enfants.indexOf(intro));
  const grilles = enfants.filter((e) => e.classList.contains('form-grille') && !e.id);
  const [grilleVous, grilleMesures] = grilles;
  const champDe = (id) => $(id) && $(id).closest('.form-champ');
  // 1 : le casting (cartes) ou le parcours (déjà mannequin ?)
  if (projet) etapes[0].appendChild(el('p', 'lx-consigne', T('👆 Touchez le casting qui vous intéresse.', '👆 Tap the casting you are interested in.')));
  debut.forEach((e) => etapes[0].appendChild(e));
  // 2 : vous (identité, études, parent d'une mineure, genre et civilité, message)
  [intro, grilleVous, $('ca-bloc-etudes'), $('ca-bloc-parent')].filter(Boolean).forEach((e) => etapes[1].appendChild(e));
  const grilleGenre = el('div', 'form-grille');
  [champDe('ca-genre'), $('ca-civilite-wrap')].filter(Boolean).forEach((e) => grilleGenre.appendChild(e));
  etapes[1].appendChild(grilleGenre);
  if (champDe('ca-message')) etapes[1].appendChild(champDe('ca-message'));
  // 3 : mensurations (le reste de la grille)
  if (grilleMesures) etapes[2].appendChild(grilleMesures);
  // 4 : photos, vidéo, accord
  [champDe('ca-photos'), champDe('ca-video'), $('ca-consentement') && $('ca-consentement').closest('.form-champ')].filter(Boolean).forEach((e) => etapes[3].appendChild(e));
  // résumé + envoi
  const resume = el('fieldset', 'lx-etape lx-resume'); resume.dataset.etape = '5';
  resume.appendChild(el('legend', 'u-lecteur-ecran', T('Votre candidature', 'Your application')));
  const tr = el('div', 'lx-etape-titre'); tr.appendChild(el('span', '', '✓')); tr.appendChild(el('h3', '', T('Votre candidature', 'Your application'))); resume.appendChild(tr);
  const consigneResume = el('p', 'lx-consigne', T('Vérifiez avant d’envoyer : tout est modifiable.', 'Check before sending: everything can be changed.'));
  resume.appendChild(consigneResume);
  const recap = el('div', 'lx-recap'); resume.appendChild(recap);
  const navResume = el('div', 'lx-boutons lx-etape-boutons');
  const retourResume = el('button', 'btn lx-retour', T('← Retour', '← Back')); retourResume.type = 'button';
  navResume.appendChild(retourResume); navResume.appendChild($('btn-envoyer')); resume.appendChild(navResume);
  [$('ca-msg'), $('ca-envoi-jauges')].filter(Boolean).forEach((e) => resume.appendChild(e));
  const autre = el('button', 'btn lx-recommencer u-hidden', T('Envoyer une autre candidature', 'Send another application')); autre.type = 'button';
  resume.appendChild(autre);
  // boutons de chaque étape et leur message
  const msgs = etapes.map((f, i) => {
    const nav = el('div', 'lx-boutons lx-etape-boutons');
    if (i > 0) { const r = el('button', 'btn lx-retour', T('← Retour', '← Back')); r.type = 'button'; r.addEventListener('click', () => montrer(i)); nav.appendChild(r); }
    const s = el('button', 'btn btn--principal lx-suivant', T('Suivant →', 'Next →')); s.type = 'button';
    s.addEventListener('click', () => { if (valide(i + 1)) montrer(i + 2); });
    nav.appendChild(s); f.appendChild(nav);
    const m = el('div', 'form-msg'); m.setAttribute('role', 'alert'); f.appendChild(m);
    return m;
  });
  etapes.forEach((f) => form.insertBefore(f, form.firstChild && form.querySelector(':scope > script')));
  form.insertBefore(resume, form.querySelector(':scope > script'));
  retourResume.addEventListener('click', () => montrer(4));
  form.classList.add('lx-en-etapes');

  // ---------- navigation
  let courante = 1;
  function montrer(n, defiler) {
    courante = n;
    etapes.concat([resume]).forEach((f, i) => { f.hidden = i + 1 !== n; });
    Array.from(barre.children).forEach((li, i) => { li.className = i + 1 < n ? 'fait' : i + 1 === n ? 'actif' : ''; });
    msgs.forEach((m) => { m.className = 'form-msg'; m.textContent = ''; });
    if (n === 5) dessinerResume();
    if (defiler !== false && typeof barre.scrollIntoView === 'function') barre.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function erreur(i, texte, champ) {
    if (typeof afficherMsg === 'function') afficherMsg(msgs[i - 1], texte, 'err'); else msgs[i - 1].textContent = texte;
    if (champ && typeof champ.focus === 'function') champ.focus();
    return false;
  }
  // un champ obligatoire est vérifié s'il n'est pas dans un bloc caché par la page (études, parent, mensurations…)
  const cache = (c) => !!c.closest('.u-hidden, [hidden]:not(.lx-etape)') || [...function* () { for (let x = c; x && x !== form; x = x.parentElement) yield x; }()].some((x) => x.style && x.style.display === 'none');
  function valide(i) {
    const f = etapes[i - 1];
    if (i === 1 && projet && !$('ca-projet').value) return erreur(1, T('Choisissez un casting (ou « Mon casting n’est pas dans la liste »).', 'Choose a casting (or “My casting is not in the list”).'));
    for (const c of f.querySelectorAll('input, select, textarea')) {
      if (cache(c) || c.disabled || c.type === 'file') continue;
      if (!c.checkValidity()) {
        const lab = c.id && document.querySelector('label[for="' + c.id + '"]');
        if (typeof c.reportValidity === 'function' && c.offsetParent) c.reportValidity();
        return erreur(i, T('Merci de compléter : ', 'Please complete: ') + (lab ? lab.textContent.replace(/\s*\*\s*$/, '').trim() : T('le champ indiqué', 'the highlighted field')) + '.', c);
      }
    }
    if (i === 2) {
      const age = typeof calculerAgeCandidature === 'function' ? calculerAgeCandidature() : null;
      if (age !== null && typeof AGE_MINIMUM !== 'undefined' && age < AGE_MINIMUM) return erreur(2, T(`L'agence accepte les candidatures à partir de ${AGE_MINIMUM} ans.`, `The agency accepts applications from age ${AGE_MINIMUM}.`), $('ca-naissance'));
      if ($('ca-ville').value === 'Abidjan' && $('ca-commune') && $('ca-commune').value === 'Abidjan') return erreur(2, T('Merci de préciser votre commune à Abidjan.', 'Please specify your district in Abidjan.'), $('ca-commune'));
    }
    if (i === 4) {
      const n = typeof photosSelectionnees !== 'undefined' ? photosSelectionnees.length : 0, min = typeof photosMin === 'function' ? photosMin() : 4;
      if (n < min) return erreur(4, T(`Ajoutez au moins ${min} photos (${n} pour l’instant).`, `Please add at least ${min} photos (${n} so far).`), $('ca-photos'));
      if (n > 12) return erreur(4, T('12 photos au plus : retirez-en quelques-unes.', '12 photos at most: please remove a few.'), $('ca-photos'));
      if (!(typeof videoChoisie !== 'undefined' && videoChoisie) && !(typeof videoEnPreparation !== 'undefined' && videoEnPreparation)) return erreur(4, T('Ajoutez votre vidéo de présentation (3 minutes au plus).', 'Please add your introduction video (3 minutes at most).'), $('ca-video'));
    }
    return true;
  }

  // ---------- résumé « Votre candidature » (chaque ligne : « Changer » ramène à son étape)
  const val = (id) => ($(id) && $(id).value ? String($(id).value).trim() : '');
  const texteOption = (id) => { const s = $(id); return s && s.selectedIndex > 0 ? s.options[s.selectedIndex].textContent.trim() : ''; };
  function ligne(icone, titre, sous, etape, contenu) {
    const d = el('div', 'lx-recap-ligne');
    d.appendChild(el('em', '', icone));
    const s = el('span'); if (contenu) s.appendChild(contenu); else s.appendChild(el('b', '', titre)); if (sous) s.appendChild(el('small', '', sous)); d.appendChild(s);
    const c = el('button', 'lx-changer', T('Changer', 'Change')); c.type = 'button'; c.dataset.boutonLibre = ''; c.addEventListener('click', () => montrer(etape)); d.appendChild(c);
    recap.appendChild(d);
  }
  function dessinerResume() {
    recap.textContent = '';
    if (projet) { const p = val('ca-projet') === '__autre__' ? val('ca-projet-autre') : val('ca-projet'); const info = (window.CASTINGS_INFOS || {})[p] || {}; ligne('🎫', p, [info.date, info.lieu].filter(Boolean).join(' · '), 1); }
    else ligne('🎓', texteOption('ca-experience'), val('ca-lien-travail'), 1);
    const age = typeof calculerAgeCandidature === 'function' ? calculerAgeCandidature() : null;
    const civ = val('ca-genre') === 'homme' ? T('Monsieur', 'Mr') : texteOption('ca-civilite');
    ligne('👤', [civ, val('ca-nom')].filter(Boolean).join(' '), [age !== null ? age + T(' ans', ' years old') : '', [val('ca-ville') === '__autre__' ? val('ca-ville-autre') : val('ca-ville'), val('ca-commune') && val('ca-commune') !== '__autre__' ? val('ca-commune') : val('ca-commune-autre')].filter(Boolean).join(', '),
      [val('ca-indicatif'), val('ca-telephone-numero')].filter(Boolean).join(' '), val('ca-email')].filter(Boolean).join(' · '), 2);
    const mesures = [val('ca-poitrine'), val('ca-tourtaille'), val('ca-hanches')].filter(Boolean);
    ligne('📏', [val('ca-taille') ? (Number(val('ca-taille')) / 100).toFixed(2).replace('.', EN ? '.' : ',') + ' m' : '', mesures.length === 3 ? mesures.join(' – ') : ''].filter(Boolean).join(' · '),
      [val('ca-poids') ? val('ca-poids') + ' kg' : '', val('ca-vetements') ? T('Taille ', 'Size ') + val('ca-vetements') : '', val('ca-pointure') ? T('Pointure ', 'Shoe ') + val('ca-pointure') : ''].filter(Boolean).join(' · '), 3);
    const vign = el('span', 'lx-vignettes');
    document.querySelectorAll('#ca-photos-apercu img').forEach((img, k) => { if (k < 5) { const i = el('i'); i.style.backgroundImage = 'url("' + img.src + '")'; vign.appendChild(i); } });
    const n = typeof photosSelectionnees !== 'undefined' ? photosSelectionnees.length : 0;
    ligne('📷', '', (n + ' photo' + (n > 1 ? 's' : '')) + ' · ' + (typeof videoChoisie !== 'undefined' && videoChoisie ? T('vidéo ajoutée', 'video added') : T('vidéo en préparation', 'video being prepared')), 4, vign);
  }

  // ---------- castings en cartes (« Postuler à un casting »)
  const PHOTOS = ['assets/cours-talons/mannequin-podium.jpg?v=2', 'assets/cours-talons/galerie-tailleur.jpg?v=1', 'assets/cours-talons/galerie-blanc.jpg?v=1', 'assets/cours-talons/galerie-drapeau.jpg?v=1'];
  const racine = location.pathname.indexOf('/en/') === 0 ? '../' : '';
  function dessinerCastings() {
    const select = $('ca-projet');
    if (!select) return;
    let boite = $('lx-castings');
    if (!boite) {
      boite = el('div', 'lx-castings'); boite.id = 'lx-castings'; boite.setAttribute('role', 'radiogroup'); boite.setAttribute('aria-label', T('Castings ouverts', 'Open castings'));
      const champ = select.closest('.form-champ'); champ.classList.add('lx-champ-discret'); champ.parentNode.insertBefore(boite, champ);
      const lien = el('button', 'lx-casting-autre', T('Mon casting n’est pas dans la liste', 'My casting is not in the list')); lien.type = 'button'; lien.dataset.boutonLibre = ''; lien.id = 'lx-casting-autre';
      lien.addEventListener('click', () => { select.value = '__autre__'; select.dispatchEvent(new Event('change', { bubbles: true })); majCartes(); const a = $('ca-projet-autre'); if (a) a.focus(); });
      boite.after(lien);
    }
    boite.textContent = '';
    const infos = window.CASTINGS_INFOS || {};
    Array.from(select.options).filter((o) => o.value && o.value !== '__autre__').forEach((o, k) => {
      const i = infos[o.value] || {};
      const carte = el('button', 'lx-casting'); carte.type = 'button'; carte.dataset.boutonLibre = ''; carte.setAttribute('role', 'radio'); carte.dataset.valeur = o.value;
      const ph = el('span', 'lx-casting-photo'); ph.style.backgroundImage = 'url("' + racine + PHOTOS[k % PHOTOS.length] + '")'; ph.setAttribute('aria-hidden', 'true'); carte.appendChild(ph);
      const t = el('span', 'lx-casting-texte');
      t.appendChild(el('small', '', T('Casting ouvert', 'Open casting')));
      t.appendChild(el('b', '', o.textContent.trim()));
      if (i.description) t.appendChild(el('span', 'lx-casting-desc', i.description));
      const meta = el('span', 'lx-casting-meta');
      if (i.date) meta.appendChild(el('i', '', '📅 ' + i.date));
      if (i.lieu) meta.appendChild(el('i', '', '📍 ' + i.lieu));
      if (meta.children.length) t.appendChild(meta);
      carte.appendChild(t);
      carte.addEventListener('click', () => { select.value = o.value; select.dispatchEvent(new Event('change', { bubbles: true })); majCartes(); });
      boite.appendChild(carte);
    });
    majCartes();
  }
  function majCartes() {
    const v = $('ca-projet') ? $('ca-projet').value : '';
    document.querySelectorAll('#lx-castings .lx-casting').forEach((c) => { const on = c.dataset.valeur === v; c.classList.toggle('choisi', on); c.setAttribute('aria-checked', on ? 'true' : 'false'); });
    const a = $('lx-casting-autre'); if (a) a.classList.toggle('choisi', v === '__autre__');
  }
  if (projet) {
    // (les cartes montrent déjà la description de chaque casting : pas de doublon sous la liste)
    const desc = $('ca-projet-description'); if (desc) desc.classList.add('lx-champ-discret');
    dessinerCastings();
    document.addEventListener('ma2m:castings', dessinerCastings);   // (liste des castings chargée : js/formulaire-candidature.js)
    $('ca-projet').addEventListener('change', majCartes);
  }

  // ---------- après l'envoi (le formulaire est vidé) et reprise d'un envoi coupé : on reste sur le message
  form.addEventListener('reset', () => setTimeout(() => {
    recap.textContent = ''; consigneResume.hidden = true; navResume.hidden = true; autre.classList.remove('u-hidden');
    if (projet) majCartes();
  }, 0));
  autre.addEventListener('click', () => { consigneResume.hidden = false; navResume.hidden = false; autre.classList.add('u-hidden'); const m = $('ca-msg'); if (m) { m.className = 'form-msg'; m.textContent = ''; } montrer(1); });
  const msgEnvoi = $('ca-msg');
  if (msgEnvoi && typeof MutationObserver === 'function') {
    new MutationObserver(() => { if (msgEnvoi.textContent.trim() && courante !== 5) montrer(5, false); }).observe(msgEnvoi, { childList: true, characterData: true, subtree: true });
  }
  montrer(1, false);
  window.CandidatureEtapes = { montrer: (n) => montrer(n), etape: () => courante };
})();
