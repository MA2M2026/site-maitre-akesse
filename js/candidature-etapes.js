// Présentation partagée des formulaires de candidature, à charger après le formulaire.
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

  const NOMS = [projet ? T('Casting', 'Casting') : T('Profil', 'Profile'), T('Identité', 'Identity'), T('Taille', 'Size'), T('Photos', 'Photos'), T('Vidéo', 'Video')];
  const TITRES = [projet ? T('Choisissez le casting', 'Choose the casting') : T('Votre parcours', 'Your path'), T('Parlez-nous de vous', 'Tell us about yourself'),
    T('Vos mensurations', 'Your measurements'), T('Ajoutez vos photos', 'Add your photos'), T('Ajoutez votre vidéo', 'Add your video')];

  // ---------- construction des étapes
  const el = (tag, cls, texte) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texte) e.textContent = texte; return e; };
  const vueCandidature = new URLSearchParams(location.search).get('vue') === 'candidature';
  const barre = el('ol', 'lx-progression'); barre.setAttribute('aria-label', T('Étapes', 'Steps'));
  const nomsProgression = NOMS.concat([T('Vérification', 'Review'), T('Envoi', 'Submission')]);
  nomsProgression.forEach((nom, index) => {
    const item = el('li', '', vueCandidature ? '' : nom);
    if (vueCandidature) {
      const rang = index + 1;
      const total = nomsProgression.length;
      const anneau = el('span', 'ma2m-progression-anneau', String(rang).padStart(2, '0'));
      anneau.setAttribute('aria-hidden', 'true');
      anneau.style.setProperty('--avance', (rang / total) * 100 + '%');
      const description = el('span', 'ma2m-progression-description');
      description.append(
        el('small', '', T('Étape ', 'Step ') + rang + T(' sur ', ' of ') + total),
        el('strong', '', nom)
      );
      item.append(anneau, description);
    }
    barre.appendChild(item);
  });
  form.parentNode.insertBefore(barre, form);
  // (« Aucun casting n'est ouvert » : le formulaire est caché par la page, la barre des étapes aussi)
  const majBarre = () => { barre.hidden = form.classList.contains('u-hidden'); };
  majBarre();
  if (typeof MutationObserver === 'function') new MutationObserver(majBarre).observe(form, { attributes: true, attributeFilter: ['class'] });
  const etapes = TITRES.map((titre, i) => {
    const f = el('fieldset', 'lx-etape'); f.dataset.etape = String(i + 1);
    const leg = el('legend', 'u-lecteur-ecran', T('Étape ', 'Step ') + (i + 1) + ' : ' + titre); f.appendChild(leg);
    const t = el('div', 'lx-etape-titre'); t.appendChild(el('span', '', String(i + 1))); t.appendChild(el('h3', '', titre));
    t.dataset.motEditorial = nomsProgression[i].toLocaleUpperCase();
    f.appendChild(t);
    return f;
  });
  if (vueCandidature) {
    document.body.classList.add('ma2m-vue-candidature');
    form.closest('main').removeAttribute('data-ecrans');
    const entete = el('div', 'ma2m-entete-formulaire');
    const retour = form.parentElement.querySelector('.ma2m-autres-parcours');
    retour.textContent = T('← Parcours', '← Paths');
    entete.append(retour, el('span', '', 'MA2M'));
    const section = form.closest('#candidature');
    section.prepend(entete);
  }
  const debut = enfants.slice(0, enfants.indexOf(intro));
  const grilles = enfants.filter((e) => e.classList.contains('form-grille') && !e.id);
  const [grilleVous, grilleMesures] = grilles;
  const champDe = (id) => $(id) && $(id).closest('.form-champ');
  // 1 : le casting (cartes) ou le parcours (déjà mannequin ?)
  if (projet) etapes[0].appendChild(el('p', 'lx-consigne', T('👆 Touchez le casting qui vous intéresse.', '👆 Tap the casting you are interested in.')));
  debut.forEach((e) => etapes[0].appendChild(e));
  if (vueCandidature && !projet) {
    const experience = etapes[0].querySelector('#ca-experience');
    const groupe = experience.closest('.form-champ');
    const cartes = el('div', 'ma2m-experiences');
    cartes.setAttribute('role', 'group');
    cartes.setAttribute('aria-label', T('Votre expérience', 'Your experience'));
    const choix = [['non', T('Je débute', 'I am a beginner')], ['oui', T('Je suis mannequin', 'I already model')]];
    choix.forEach(([valeur, texte]) => {
      const bouton = el('button', 'ma2m-experience', texte);
      bouton.type = 'button';
      bouton.dataset.boutonLibre = '';
      bouton.dataset.valeur = valeur;
      bouton.addEventListener('click', () => {
        experience.value = valeur;
        experience.dispatchEvent(new Event('change', { bubbles: true }));
      });
      cartes.appendChild(bouton);
    });
    const synchroniser = () => {
      Array.from(cartes.children).forEach((bouton) => {
        bouton.setAttribute('aria-pressed', String(bouton.dataset.valeur === experience.value));
      });
    };
    experience.addEventListener('change', synchroniser);
    form.addEventListener('reset', () => setTimeout(synchroniser, 0));
    experience.classList.add('u-lecteur-ecran');
    experience.tabIndex = -1;
    groupe.appendChild(cartes);
    synchroniser();
  }

  // 2 : vous (identité, études, parent d'une mineure, genre et civilité, message)
  [intro, grilleVous, $('ca-bloc-etudes'), $('ca-bloc-parent')].filter(Boolean).forEach((e) => etapes[1].appendChild(e));
  const grilleGenre = el('div', 'form-grille');
  [champDe('ca-genre'), $('ca-civilite-wrap')].filter(Boolean).forEach((e) => grilleGenre.appendChild(e));
  etapes[1].appendChild(grilleGenre);
  if (champDe('ca-message')) etapes[1].appendChild(champDe('ca-message'));
  // Dans la nouvelle vue, les coordonnées utilisent les champs existants, regroupés selon le sujet.
  const questions = [];
  let questionCourante = 0;
  if (vueCandidature) {
    const question = (titre, elements) => {
      const bloc = el('div', 'ma2m-question');
      bloc.dataset.titre = titre;
      bloc.append(...elements.filter(Boolean));
      questions.push(bloc);
      etapes[1].appendChild(bloc);
    };
    const coordonnee = (id) => grilleVous.querySelector('#' + id).closest('.form-champ');
    question(T('Vos coordonnées', 'Your contact details'), [
      intro, coordonnee('ca-nom'), coordonnee('ca-email'), coordonnee('ca-indicatif')
    ]);
    question(T('Mieux vous connaître', 'Tell us about yourself'), [
      coordonnee('ca-ville'), grilleVous.querySelector('#ca-commune-wrap'), coordonnee('ca-majorite'),
      grilleGenre, etapes[1].querySelector('#ca-message').closest('.form-champ')
    ]);
    question(T('Votre parent ou tuteur', 'Your parent or guardian'), [etapes[1].querySelector('#ca-bloc-parent')]);
    grilleVous.remove();
  }
  // 3 : mensurations (le reste de la grille)
  if (grilleMesures) etapes[2].appendChild(grilleMesures);
  etapes[3].appendChild(champDe('ca-photos'));
  etapes[4].appendChild(champDe('ca-video'));

  const resume = el('fieldset', 'lx-etape lx-resume');
  const verification = etapes.length + 1;
  const confirmation = verification + 1;
  resume.dataset.etape = String(verification);
  resume.appendChild(el('legend', 'u-lecteur-ecran', T('Votre candidature', 'Your application')));
  const tr = el('div', 'lx-etape-titre'); tr.appendChild(el('span', '', '✓')); tr.appendChild(el('h3', '', T('Votre candidature', 'Your application'))); resume.appendChild(tr);
  const consigneResume = el('p', 'lx-consigne', T('Vérifiez avant d’envoyer : tout est modifiable.', 'Check before sending: everything can be changed.'));
  resume.appendChild(consigneResume);
  const accord = champDe('ca-consentement');
  const recap = el('div', 'lx-recap'); resume.appendChild(recap);
  const navResume = el('div', 'lx-boutons lx-etape-boutons');
  const retourResume = el('button', 'btn lx-retour', T('← Retour', '← Back')); retourResume.type = 'button';
  navResume.appendChild(retourResume); navResume.appendChild($('btn-envoyer')); resume.appendChild(navResume);
  if (accord) navResume.before(accord);
  resume.prepend(retourResume);
  const resultat = el('section', 'lx-etape lx-reception');
  const accueil = el('a', 'ma2m-action ma2m-retour-accueil', T('⌂ Retour à l’accueil', '⌂ Back to home'));
  accueil.href = EN ? '/en/' : '/';
  resultat.dataset.etape = String(confirmation);
  const titreResultat = el('h3', '', T('Votre envoi', 'Your submission'));
  resultat.appendChild(titreResultat);
  const msgEnvoi = $('ca-msg');
  const jauges = $('ca-envoi-jauges');
  [msgEnvoi, jauges].filter(Boolean).forEach((e) => resume.appendChild(e));
  const autre = el('button', 'btn lx-recommencer', T('Faire une autre candidature', 'Start another application'));
  autre.type = 'button';
  resultat.append(autre, accueil);
  const ecrans = [...etapes, resume, resultat];
  // boutons de chaque étape et leur message
  const msgs = etapes.map((f, i) => {
    const nav = el('div', 'lx-boutons lx-etape-boutons');
    if (i > 0) { const r = el('button', 'btn lx-retour', T('← Retour', '← Back')); r.type = 'button'; r.addEventListener('click', () => reculer(i + 1)); f.prepend(r); }
    const s = el('button', 'btn btn--principal lx-suivant', T('Continuer →', 'Continue →')); s.type = 'button';
    s.addEventListener('click', () => {
      const n = i + 1;
      if (!valide(n)) return;
      if (n === 2 && questions.length) {
        const prochaine = trouverQuestion(1);
        if (prochaine !== -1) { montrerQuestion(prochaine); return; }
      }
      montrer(n + 1);
    });
    nav.appendChild(s); f.appendChild(nav);
    const m = el('div', 'form-msg'); m.setAttribute('role', 'alert'); f.appendChild(m);
    f.addEventListener('change', (event) => {
      if (event.target.matches('#ca-photos, #ca-video, #ca-video-consignes')) {
        m.className = 'form-msg';
        m.textContent = '';
      }
    });
    return m;
  });
  [...etapes, resume].forEach((f) => {
    const contenu = el('div', 'ma2m-contenu-etape');
    const nav = f.querySelector(':scope > .lx-etape-boutons');
    Array.from(f.children).filter((e) => e !== nav && e.tagName !== 'LEGEND').forEach((e) => contenu.appendChild(e));
    f.insertBefore(contenu, nav);
  });
  ecrans.forEach((f) => form.insertBefore(f, form.querySelector(':scope > script')));
  retourResume.addEventListener('click', () => montrer(verification - 1));
  form.classList.add('lx-en-etapes');

  // ---------- navigation
  let courante = 1;
  function questionsUtiles() {
    return questions.map((bloc, index) => index).filter(index =>
      !questions[index].querySelector('#ca-bloc-parent') || $('ca-majorite').value === 'mineur');
  }
  function majProgression() {
    if (!vueCandidature) return;
    const utiles = questionsUtiles();
    const total = ecrans.length + utiles.length - 1;
    const rang = courante === 2 ? 2 + utiles.indexOf(questionCourante) : courante > 2 ? courante + utiles.length - 1 : courante;
    const item = barre.children[courante - 1];
    const anneau = item.querySelector('.ma2m-progression-anneau');
    anneau.textContent = String(rang).padStart(2, '0');
    anneau.style.setProperty('--avance', (rang / total) * 100 + '%');
    item.querySelector('small').textContent = T('Étape ', 'Step ') + rang + T(' sur ', ' of ') + total;
  }
  function trouverQuestion(sens) {
    for (let i = questionCourante + sens; i >= 0 && i < questions.length; i += sens) {
      if (questions[i].querySelector('#ca-bloc-parent') && $('ca-majorite').value !== 'mineur') continue;
      return i;
    }
    return -1;
  }
  function montrerQuestion(index, defiler = true) {
    questionCourante = index;
    questions.forEach((bloc, i) => { bloc.hidden = i !== index; });
    const titre = etapes[1].querySelector('h3');
    titre.textContent = questions[index].dataset.titre;
    etapes[1].querySelector('.ma2m-contenu-etape').scrollTop = 0;
    titre.parentElement.dataset.motEditorial = [T('IDENTITÉ', 'IDENTITY'), T('PROFIL', 'PROFILE'), T('PARENT', 'GUARDIAN')][index];
    majProgression();
    msgs[1].className = 'form-msg';
    msgs[1].textContent = '';
    if (defiler) {
      titre.tabIndex = -1;
      titre.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }
  function reculer(n) {
    if (n === 2 && questions.length) {
      const precedente = trouverQuestion(-1);
      if (precedente !== -1) { montrerQuestion(precedente); return; }
    }
    if (n === 3 && questions.length) {
      montrer(2, true, questionsUtiles().at(-1));
      return;
    }
    montrer(n - 1);
  }
  function montrer(n, defiler, question = 0) {
    courante = n;
    ecrans.forEach((f, i) => { f.hidden = i + 1 !== n; });
    Array.from(barre.children).forEach((li, i) => {
      li.className = i + 1 < n ? 'fait' : i + 1 === n ? 'actif' : '';
      if (i + 1 === n) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
    msgs.forEach((m) => { m.className = 'form-msg'; m.textContent = ''; });
    if (n === 2 && questions.length) montrerQuestion(question, false);
    else majProgression();
    if (n === verification) dessinerResume();
    const contenu = ecrans[n - 1].querySelector('.ma2m-contenu-etape');
    if (contenu) contenu.scrollTop = 0;
    if (defiler !== false) {
      const titre = ecrans[n - 1].querySelector('h3');
      titre.tabIndex = -1;
      titre.focus({ preventScroll: true });
      if (vueCandidature) window.scrollTo(0, 0);
      else barre.scrollIntoView({ block: 'start' });
    }
  }
  function erreur(i, texte, champ) {
    if (typeof afficherMsg === 'function') afficherMsg(msgs[i - 1], texte, 'err'); else msgs[i - 1].textContent = texte;
    if (champ && typeof champ.focus === 'function') champ.focus();
    return false;
  }
  // un champ obligatoire est vérifié s'il n'est pas dans un bloc caché par la page (études, parent, mensurations…)
  const cache = (c) => !!c.closest('.u-hidden, [hidden]:not(.lx-etape)') || [...function* () { for (let x = c; x && x !== form; x = x.parentElement) yield x; }()].some((x) => x.style && x.style.display === 'none');
  function valide(i) {
    const f = i === 2 && questions.length ? questions[questionCourante] : etapes[i - 1];
    if (i === 1 && projet && !$('ca-projet').value) return erreur(1, T('Choisissez un casting (ou « Mon casting n’est pas dans la liste »).', 'Choose a casting (or “My casting is not in the list”).'));
    // (d'abord ce qui compte le plus : l'âge minimum, les photos et la vidéo)
    if (i === 4) {
      const n = typeof photosSelectionnees !== 'undefined' ? photosSelectionnees.length : 0, min = typeof photosMin === 'function' ? photosMin() : 4;
      if (n < min) return erreur(4, T(`Ajoutez au moins ${min} photos (${n} pour l’instant).`, `Please add at least ${min} photos (${n} so far).`), $('ca-photos'));
      if (n > 12) return erreur(4, T('12 photos au plus : retirez-en quelques-unes.', '12 photos at most: please remove a few.'), $('ca-photos'));
    }
    if (i === 5 && !(typeof videoChoisie !== 'undefined' && videoChoisie) && !(typeof videoEnPreparation !== 'undefined' && videoEnPreparation)) return erreur(5, T('Ajoutez votre vidéo de présentation (3 minutes au plus).', 'Please add your introduction video (3 minutes at most).'), $('ca-video'));
    for (const c of f.querySelectorAll('input, select, textarea')) {
      if (cache(c) || c.disabled || c.type === 'file') continue;
      if (!c.checkValidity()) {
        const lab = c.id && document.querySelector('label[for="' + c.id + '"]');
        if (typeof c.reportValidity === 'function' && c.offsetParent) c.reportValidity();
        return erreur(i, T('Merci de compléter : ', 'Please complete: ') + (lab ? lab.textContent.replace(/\s*\*\s*$/, '').trim() : T('le champ indiqué', 'the highlighted field')) + '.', c);
      }
    }
    if (i === 2) {
      if ((!questions.length || f.contains($('ca-ville'))) && $('ca-ville').value === 'Abidjan' && $('ca-commune') && $('ca-commune').value === 'Abidjan') return erreur(2, T('Merci de préciser votre commune à Abidjan.', 'Please specify your district in Abidjan.'), $('ca-commune'));
      // (24/11/2026, décision de la propriétaire) mineur : les coordonnées du parent ne peuvent pas être les siennes
      // (la base refuse aussi : supabase-parent-candidature.sql ; le nom de famille seul peut être le même)
      if ((!questions.length || f.contains($('ca-bloc-parent'))) && $('ca-majorite') && $('ca-majorite').value === 'mineur' && typeof coordonneesParentCopiees === 'function') {
        // (numéros avec leur indicatif, comme ils seront enregistrés et comparés par la base)
        const numero = (ind, num) => (typeof composerTelephone === 'function' ? composerTelephone($(ind), $(num)) : val(num));
        const copie = coordonneesParentCopiees({ nom: val('ca-nom'), telephone: numero('ca-indicatif', 'ca-telephone-numero'), email: val('ca-email'),
          parentNom: val('ca-parent-nom'), parentTelephone: numero('ca-parent-indicatif', 'ca-parent-telephone-numero'), parentEmail: val('ca-parent-email') });
        if (copie === 'telephone') return erreur(2, T('Le WhatsApp du parent doit être celui de votre parent ou tuteur, pas le vôtre.', 'The parent’s WhatsApp must be your parent’s or guardian’s number, not yours.'), $('ca-parent-telephone-numero'));
        if (copie === 'email') return erreur(2, T('L’e-mail du parent doit être celui de votre parent ou tuteur, pas le vôtre.', 'The parent’s email must be your parent’s or guardian’s, not yours.'), $('ca-parent-email'));
        if (copie === 'nom') return erreur(2, T('Écrivez le nom de votre parent ou tuteur, pas le vôtre.', 'Enter your parent’s or guardian’s name, not yours.'), $('ca-parent-nom'));
      }
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
    const photo = document.querySelector('#ca-photos-apercu img');
    const couverture = el('div', 'ma2m-dossier-couverture');
    if (photo) {
      const portrait = photo.cloneNode();
      portrait.removeAttribute('class');
      portrait.alt = '';
      couverture.appendChild(portrait);
    }
    const identite = el('div', 'ma2m-dossier-identite');
    identite.appendChild(el('strong', '', val('ca-nom')));
    const taille = val('ca-taille');
    const date = new Intl.DateTimeFormat(EN ? 'en' : 'fr', { dateStyle: 'medium' }).format(new Date());
    identite.appendChild(el('small', '', taille ? date + ' · ' + taille + ' cm' : date));
    couverture.appendChild(identite);
    recap.appendChild(couverture);
    if (projet) { const p = val('ca-projet') === '__autre__' ? val('ca-projet-autre') : val('ca-projet'); const info = (window.CASTINGS_INFOS || {})[p] || {}; ligne('🎫', p, [info.date, info.lieu].filter(Boolean).join(' · '), 1); }
    else ligne('🎓', [$('ca-porte') && val('ca-porte') ? texteOption('ca-porte') : '', texteOption('ca-experience')].filter(Boolean).join(' · '), val('ca-lien-travail'), 1);  // (porte : refonte du 25/11/2026)
    const age = $('ca-majorite') && $('ca-majorite').value ? texteOption('ca-majorite') : '';  // (ARTCI : majeure ou mineure)
    const civ = val('ca-genre') === 'homme' ? T('Monsieur', 'Mr') : texteOption('ca-civilite');
    ligne('👤', [civ, val('ca-nom')].filter(Boolean).join(' '), [age, [val('ca-ville') === '__autre__' ? val('ca-ville-autre') : val('ca-ville'), val('ca-commune') && val('ca-commune') !== '__autre__' ? val('ca-commune') : val('ca-commune-autre')].filter(Boolean).join(', '),
      [val('ca-indicatif'), val('ca-telephone-numero')].filter(Boolean).join(' '), val('ca-email')].filter(Boolean).join(' · '), 2);
    const mesures = [val('ca-poitrine'), val('ca-tourtaille'), val('ca-hanches')].filter(Boolean);
    ligne('📏', [val('ca-taille') ? (Number(val('ca-taille')) / 100).toFixed(2).replace('.', EN ? '.' : ',') + ' m' : '', mesures.length === 3 ? mesures.join(' – ') : ''].filter(Boolean).join(' · '),
      [val('ca-poids') ? val('ca-poids') + ' kg' : '', val('ca-vetements') ? T('Taille ', 'Size ') + val('ca-vetements') : '', val('ca-pointure') ? T('Pointure ', 'Shoe ') + val('ca-pointure') : ''].filter(Boolean).join(' · '), 3);
    const vign = el('span', 'lx-vignettes');
    document.querySelectorAll('#ca-photos-apercu img').forEach((img, k) => { if (k < 5) { const i = el('i'); i.style.backgroundImage = 'url("' + img.src + '")'; vign.appendChild(i); } });
    const n = typeof photosSelectionnees !== 'undefined' ? photosSelectionnees.length : 0;
    ligne('📷', T('Photos', 'Photos'), n + ' photo' + (n > 1 ? 's' : ''), 4, vign);
    ligne('▶', T('Vidéo', 'Video'), typeof videoChoisie !== 'undefined' && videoChoisie ? T('Vidéo ajoutée', 'Video added') : T('Vidéo en préparation', 'Video being prepared'), 5);
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

  form.addEventListener('ma2m:candidature-enregistree', (event) => {
    resultat.toggleAttribute('data-medias-recus', event.detail.mediasRecus);
    titreResultat.textContent = event.detail.mediasRecus
      ? T('Félicitations !', 'Congratulations!')
      : T('Dossier enregistré', 'Application saved');
    if (event.detail.mediasRecus) {
      const envoi = el('p', '', T('Votre candidature a bien été envoyée.', 'Your application has been sent.'));
      const suite = el('p', '', T('Notre équipe va l’étudier et vous contactera bientôt.', 'Our team will review it and contact you soon.'));
      msgEnvoi.replaceChildren(envoi, suite);
    }
    const fiche = $('ca-fiche-inscription');
    [msgEnvoi, fiche, jauges].filter(Boolean).forEach((e) => autre.before(e));
    montrer(confirmation);
  });
  autre.addEventListener('click', () => {
    msgEnvoi.className = 'form-msg';
    msgEnvoi.textContent = '';
    $('ca-fiche-inscription')?.remove();
    [msgEnvoi, jauges].filter(Boolean).forEach((e) => resume.querySelector('.ma2m-contenu-etape').appendChild(e));
    if (projet) majCartes();
    montrer(1);
  });
  if (msgEnvoi && typeof MutationObserver === 'function') {
    new MutationObserver(() => {
      if (msgEnvoi.textContent.trim() && courante < verification) montrer(verification, false);
    }).observe(msgEnvoi, { childList: true, characterData: true, subtree: true });
  }
  montrer(1, false);
  window.CandidatureEtapes = { montrer: (n, defiler) => montrer(n, defiler), etape: () => courante };
})();
