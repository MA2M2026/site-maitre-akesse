// Inscription simplifiée après un casting retenu (cahier v2.4, section 4), en 4 écrans, français
// et anglais (EN, T : js/app.js) :
//   1. code individuel + date de naissance complète ;
//   2. « Bonjour …, félicitations » : informations du casting à confirmer ou corriger ;
//   3. règlement (accord du parent pour un mineur), moyen de paiement : Wave ;
//   4. 25 000 FCFA (15 000 d'inscription + 10 000 du 1er mois), puis « J'ai payé » — sans capture
//      ni référence. Le paiement apparaît en orange dans l'Administration (espace 2).
// Tout passe par le serveur du site (api/code-protege.js) : code vérifié dans la base, essais
// ratés comptés et bloqués côté serveur.
(function () {
  'use strict';
  const zone = document.getElementById('inn-ecran');
  const barre = document.getElementById('inn-etapes');
  if (!zone) return;
  const LIEN_WAVE = 'https://pay.wave.com/m/M_ci_5eXs19LXWW_D/c/ci/?amount=25000';
  const E = { ecran: 'code', code: '', naissance: '', tel4: '', c: null, note: null, erreur: '', correction: false,
    reglement: false, parent: false, waveOuvert: false, occupe: false, numero: null, lien: null };
  const numeroValide = (n) => /^[0-9+ ]{6,20}$/.test(String(n || '').trim());

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
  const dateLisible = (iso) => String(iso || '').split('-').reverse().join('/');
  // (14/11/2026, maquette validée par la propriétaire : maquettes/inscription-mannequin.html) étapes nommées, cochées une à une
  const NOMS_ETAPES = [T('Code', 'Code'), T('Vos infos', 'Your details'), T('Règlement', 'Rules'), T('Paiement', 'Payment')];
  Array.prototype.forEach.call(barre.children, (li, k) => { li.textContent = NOMS_ETAPES[k]; });
  const etapes = (n, fini) => { Array.prototype.forEach.call(barre.children, (i, k) => { i.className = fini || k + 1 < n ? 'fait' : k + 1 === n ? 'actif' : ''; }); };
  const prenom = () => String((E.c && (E.c.salutation || E.c.full_name)) || '').trim();
  const bandeau = (t, type) => t ? '<div class="inn-bandeau ' + type + '" role="alert">' + esc(t) + '</div>' : '';
  const ligne = (a, b) => b ? '<div class="inn-ligne"><span>' + esc(a) + '</span><b>' + esc(b) + '</b></div>' : '';
  const champ = (id, libelle, valeur, type) => '<div class="form-champ"><label for="' + id + '">' + esc(libelle) + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(valeur) + '"></div>';
  const mineur = () => !!(E.c && E.c.mineur);

  function ecranCode() {
    etapes(1);
    return '<div class="inn-une"><div><small>' + T('Retenue au casting', 'Selected at the casting') + '</small><h1>' + T('Bienvenue chez <em>MA2M</em>', 'Welcome to <em>MA2M</em>') + '</h1></div></div>' +
      '<div class="inn-carte inn-carte--sous-une"><div><h2 class="u-lecteur-ecran">' + T('Inscription nouveaux mannequins', 'New model registration') + '</h2>' +
      '<p class="inn-doux">' + T('Réservée aux mannequins retenus : entrez le code personnel que l’agence vous a envoyé, votre date de naissance et les 4 derniers chiffres du numéro WhatsApp donné à votre candidature.', 'For selected models only: enter the personal code sent by the agency, your date of birth and the last 4 digits of the WhatsApp number given in your application.') + '</p></div>' +
      champ('inn-code', T('Code d’inscription', 'Registration code'), E.code) +
      champ('inn-naissance', T('Votre date de naissance', 'Your date of birth'), E.naissance, 'date') +
      // (22/11/2026, minimisation ARTCI) la candidature n'a plus de date de naissance : ces 4 chiffres protègent le code
      champ('inn-tel4', T('4 derniers chiffres de votre numéro WhatsApp', 'Last 4 digits of your WhatsApp number'), E.tel4, 'tel') +
      bandeau(E.erreur, 'erreur') +
      '<button class="btn btn--principal" type="button" data-a="entrer"' + (E.occupe ? ' disabled' : '') + '>' + T('Continuer', 'Continue') + '</button>' +
      '<p class="inn-petit">' + T('Le code ne sert qu’une fois. Après plusieurs essais ratés, l’accès est bloqué un moment.', 'The code works only once. After several failed attempts, access is blocked for a while.') + '</p></div>';
  }

  function ecranRecap() {
    etapes(2);
    const c = E.c;
    const tete = '<div><div class="inn-surtitre">' + T('Étape 1 sur 3', 'Step 1 of 3') + '</div><h2>' + T('Bonjour ' + esc(c.salutation) + ', félicitations !', 'Hello ' + esc(c.salutation) + ', congratulations!') + '</h2>' +
      '<p class="inn-doux">' + T('Vous avez été retenu(e). Vos informations du casting sont déjà chez nous.', 'You have been selected. Your casting details are already with us.') + '</p></div>';
    if (!E.correction) {
      // (14/11/2026) « Bonjour …, félicitations ! » en grand, carte « Future mannequin MA2M », informations en relevé
      const info = (ic, titre, valeur) => valeur ? '<div><em aria-hidden="true">' + ic + '</em><span><small>' + esc(titre) + '</small>' + esc(valeur) + '</span></div>' : '';
      return '<div class="inn-bravo"><h2>' + T('Bonjour <em>' + esc(prenom()) + '</em>,<br>félicitations !', 'Hello <em>' + esc(prenom()) + '</em>,<br>congratulations!') + '</h2>' +
        '<p>' + T('Vous avez été retenu(e). Vos informations du casting sont déjà chez nous.', 'You have been selected. Your casting details are already with us.') + '</p></div>' +
        '<div class="inn-cb"><div class="inn-cb-tete"><span>' + T('FUTURE MANNEQUIN MA2M', 'FUTURE MA2M MODEL') + '</span><span>' + new Date().getFullYear() + '</span></div>' +
        '<div class="inn-cb-nom">' + esc(String(c.full_name || '').toUpperCase()) + '</div>' +
        '<div class="inn-cb-bas"><div><b>' + T('CASTING', 'CASTING') + '</b>' + esc(c.casting || '—') + '</div><div><b>' + T('FORMATION', 'TRAINING') + '</b>' + T('Niveau 1', 'Level 1') + '</div></div></div>' +
        '<div class="inn-releve">' + info('🎂', T('Naissance', 'Date of birth'), dateLisible(c.date_naissance)) + info('📱', 'WhatsApp', c.telephone) + info('✉️', 'E-mail', c.email) + info('📍', T('Ville', 'City'), c.ville) +
        (mineur() ? info('👪', T('Parent ou tuteur', 'Parent or guardian'), c.parent_nom) + info('📞', T('Téléphone du parent', 'Parent’s phone'), c.parent_telephone) : '') + '</div>' +
        '<div class="inn-carte inn-carte--nue">' +
        (mineur() && !(c.parent_nom && c.parent_telephone) ? '<div class="inn-note">' + T('Mineur : le nom et le téléphone du parent sont obligatoires. Touchez « Non, corriger ».', 'Minor: the parent’s name and phone are required. Tap “No, correct”.') + '</div>' : '') +
        '<p class="inn-question">' + T('Ces informations sont-elles exactes ?', 'Is this information correct?') + '</p>' +
        '<button class="btn btn--principal inn-btn-blanc" data-bouton-libre type="button" data-a="oui"' + (mineur() && !(c.parent_nom && c.parent_telephone) ? ' disabled' : '') + '>' + T('Oui, continuer', 'Yes, continue') + '</button>' +
        '<button class="btn inn-btn-contour" data-bouton-libre type="button" data-a="corriger">' + T('Non, corriger', 'No, correct') + '</button></div>';
    }
    return '<div class="inn-carte">' + tete +
      champ('inn-nom', T('Nom et prénoms', 'Full name'), c.full_name) + champ('inn-tel', T('Téléphone (WhatsApp)', 'Phone (WhatsApp)'), c.telephone, 'tel') +
      champ('inn-mail', 'E-mail', c.email, 'email') + champ('inn-ville', T('Ville', 'City'), c.ville) +
      (mineur() ? champ('inn-pnom', T('Nom du parent ou tuteur', 'Parent or guardian’s name'), c.parent_nom) + champ('inn-ptel', T('Téléphone du parent', 'Parent’s phone'), c.parent_telephone, 'tel') +
        champ('inn-pmail', T('E-mail du parent', 'Parent’s e-mail'), c.parent_email, 'email') : '') +
      '<div class="inn-note">' + T('Une date de naissance incorrecte se corrige auprès de l’agence (elle change le statut mineur ou majeur).', 'A wrong date of birth must be corrected with the agency (it changes minor or adult status).') + '</div>' +
      bandeau(E.erreur, 'erreur') +
      '<button class="btn btn--principal" type="button" data-a="enregistrer">' + T('Enregistrer et continuer', 'Save and continue') + '</button></div>';
  }

  const reglementPret = () => E.reglement && (!mineur() || E.parent);
  function ecranReglement() {
    etapes(3);
    return '<div class="inn-carte"><div><div class="inn-surtitre">' + T('Étape 2 sur 3', 'Step 2 of 3') + '</div><h2>' + T('Règlement et paiement', 'Rules and payment') + '</h2></div>' +
      (E.note ? '<a class="btn" href="' + esc(E.note) + '" target="_blank" rel="noopener">' + T('Lire le règlement (PDF)', 'Read the rules (PDF)') + '</a>' : '') +
      (mineur() ? '<label class="inn-case" for="inn-parent"><input id="inn-parent" type="checkbox"' + (E.parent ? ' checked' : '') + '><span>' +
        T('Je suis ' + esc(E.c.parent_nom) + ', parent ou tuteur légal, et j’autorise cette inscription.', 'I am ' + esc(E.c.parent_nom) + ', parent or legal guardian, and I authorise this registration.') + '</span></label>' : '') +
      '<label class="inn-case" for="inn-regl"><input id="inn-regl" type="checkbox"' + (E.reglement ? ' checked' : '') + '><span>' + T('J’ai lu et j’accepte le règlement de l’agence.', 'I have read and accept the agency’s rules.') + '</span></label>' +
      '<button class="btn btn--principal" type="button" id="inn-vers-paiement" data-a="paiement"' + (reglementPret() ? '' : ' disabled') + '>' + T('Continuer vers le paiement', 'Continue to payment') + '</button></div>';
  }

  // Lien Wave de 25 000 FCFA géré dans les Paramètres de l'agence ; repli sur le lien d'origine
  async function chargerLien() {
    // (13/11/2026) moyens allumés par l'agence (js/moyens-paiement.js), choisis au paiement
    if (window.MoyensPaiement && typeof sb !== 'undefined') E.moyens = await window.MoyensPaiement.charger(sb);
    try {
      if (typeof sb === 'undefined') return;
      const r = await sb.rpc('lien_paiement', { p_type: 'inscription', p_montant: 25000 });
      E.lien = !r.error && typeof r.data === 'string' && /^https:\/\//.test(r.data) ? r.data : null;
    } catch (e) { E.lien = null; }
  }

  // (13/11/2026, maquette premium validée) le montant en grand, le moyen en tuiles, où payer, numéro, grand bouton
  const MP = window.MoyensPaiement;
  const moyenInn = () => (E.moyens || []).find((m) => m.code === E.moyen) || (E.moyens || [])[0] || { code: 'wave', nom: 'Wave' };
  const parLien = (code) => (MP ? MP.parLien(code) : code === 'wave');
  const peutPayer = () => (!parLien(moyenInn().code) || E.waveOuvert) && numeroValide(E.numero) && !E.occupe;
  function ecranPaiement() {
    etapes(4);
    if (E.numero === null) E.numero = (E.c && E.c.telephone) || '';
    const m = moyenInn(), mobile = m.code === 'wave' || (MP && MP.MOBILE.indexOf(m.code) >= 0);
    return '<div class="inn-carte"><div><div class="inn-surtitre">' + T('Étape 3 sur 3', 'Step 3 of 3') + '</div><h2>' + T('Paiement de l’inscription', 'Registration payment') + '</h2></div>' +
      '<div class="pp-blanc mp-pp"><span class="pp-s">' + T('Inscription + 1er mois', 'Registration + 1st month') + '</span><div class="pp-montant"><b>25 000 FCFA</b><span>' + T('en une fois', 'in one payment') + '</span></div>' +
      '<div class="pp-tva"><span>' + T('Inscription', 'Registration') + ' <b>15 000 FCFA</b></span><span>' + T('1er mois', '1st month') + ' <b>10 000 FCFA</b></span></div>' +
      (MP ? MP.choix(E.moyens || [m], m.code, 'inscription') : '') + bandeau(E.erreur, 'erreur') + '<div class="mp-pp-suite">' +
      (m.code === 'wave' ? '<a class="btn btn--principal pp-gros" data-bouton-libre data-a="wave" href="' + esc(E.lien || LIEN_WAVE) + '" target="_blank" rel="noopener">' + T('1 · Payer avec Wave', '1 · Pay with Wave') + '</a>' : '') +
      (MP ? MP.consigne(m, 25000, 'inscription') : '') +
      champ('inn-num', mobile ? T('Numéro mobile money qui a payé', 'Mobile money number that paid') : T('Votre numéro de téléphone', 'Your phone number'), E.numero, 'tel') +
      '<button class="btn btn--principal pp-gros" data-bouton-libre type="button" data-a="paye"' + (peutPayer() ? '' : ' disabled') + '>' + (parLien(m.code) ? T('2 · J’ai payé', '2 · I have paid') : T('J’ai payé', 'I have paid')) + '</button>' +
      '<p class="inn-petit">' + (m.code === 'wave' ? T('Après avoir payé dans Wave, revenez ici, vérifiez le numéro qui a payé, puis appuyez sur « J’ai payé ». Pas de capture d’écran, pas de référence.', 'After paying in Wave, come back here, check the number that paid, then tap “I have paid”. No screenshot, no reference.')
        : T('Après avoir payé, revenez ici, vérifiez le numéro, puis appuyez sur « J’ai payé ». L’agence vérifie la réception avant de valider.', 'After paying, come back here, check the number, then tap “I have paid”. The agency checks the payment before confirming.')) + '</p></div></div></div>';
  }

  // (14/11/2026) les 3 premiers mois de sa formation (formation_programme, lisible sans compte : supabase-programme-mannequins.sql)
  async function chargerProgramme() {
    try {
      if (typeof sb === 'undefined') return;
      const r = await sb.from('formation_programme').select('mois, theme').eq('niveau', 1).order('mois').limit(3);
      E.programme = !r.error && Array.isArray(r.data) ? r.data.slice(0, 3) : null;
    } catch (e) { E.programme = null; }
  }
  function ecranMerci() {
    etapes(4, true);
    const suite = [[T('Paiement envoyé', 'Payment sent'), T('L’agence le vérifie.', 'The agency is checking it.')],
      [T('Votre code d’espace', 'Your space code'), T('Par WhatsApp et e-mail, pour créer votre compte.', 'By WhatsApp and e-mail, to create your account.')],
      [T('Votre programme', 'Your programme'), T('Dans l’application MA2M Mannequin, mois après mois.', 'In the MA2M Mannequin app, month after month.')]];
    const prog = Array.isArray(E.programme) && E.programme.length ? '<p class="inn-titre-sec">' + T('Votre formation commence par…', 'Your training starts with…') + '</p><div class="inn-mois">' +
      E.programme.map((m) => '<div><small>' + T('Mois ', 'Month ') + esc(m.mois) + '</small><b>' + esc(m.theme) + '</b></div>').join('') + '</div>' : '';
    return '<div class="inn-bravo"><h2>' + T('Merci, <em>' + esc(prenom()) + '</em> !', 'Thank you, <em>' + esc(prenom()) + '</em>!') + '</h2><p>' + T('Votre inscription est envoyée. Voici la suite.', 'Your registration has been sent. Here is what comes next.') + '</p></div>' +
      '<ol class="inn-suite">' + suite.map((s, k) => '<li' + (k === 0 ? ' class="ok"' : '') + '><span aria-hidden="true">' + (k === 0 ? '✓' : k + 1) + '</span><div><b>' + esc(s[0]) + '</b><small>' + esc(s[1]) + '</small></div></li>').join('') + '</ol>' + prog +
      '<div class="inn-carte inn-carte--nue"><div class="inn-bandeau info">' + T('Merci ! L’agence vérifie votre paiement. Vous serez prévenu(e) par e-mail et WhatsApp dès qu’il est confirmé.', 'Thank you! The agency is checking your payment. You will be notified by e-mail and WhatsApp as soon as it is confirmed.') + '</div>' +
      '<p class="inn-doux">' + T('Ensuite, l’agence vous enverra le code pour créer votre espace mannequin. Vous pouvez fermer cette page.', 'Next, the agency will send you the code to create your model space. You can close this page.') + '</p></div>';
  }

  const ECRANS = { code: ecranCode, recap: ecranRecap, reglement: ecranReglement, paiement: ecranPaiement, merci: ecranMerci };
  const dessiner = () => { zone.innerHTML = ECRANS[E.ecran](); };
  const aller = (ecran) => { E.ecran = ecran; E.erreur = ''; E.correction = false; dessiner(); window.scrollTo(0, 0); };

  // Appel au serveur ; un refus de code dit combien d'essais il reste (messageAccesRefuse, js/app.js)
  async function serveur(donnees) {
    const rep = await fetch('/api/code-protege', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ code: E.code, naissance: E.naissance, tel4: E.tel4, appareil: idAppareilMa2m() }, donnees)) });
    return { rep, r: await rep.json().catch(() => ({})) };
  }
  const COUPURE = T('Connexion impossible. Vérifiez votre connexion internet puis réessayez.', 'Connection failed. Check your internet connection and try again.');
  // Note d'intégration (règlement) : adresse secrète servie directement par Cloudflare
  const adresseNote = (chemin) => typeof chemin === 'string' && chemin.startsWith('prive/note-integration/') && /^[\w/.-]+$/.test(chemin) ? PHOTOS_DIRECTES + chemin : null;

  async function entrer() {
    E.code = document.getElementById('inn-code').value.trim().toUpperCase();
    E.naissance = document.getElementById('inn-naissance').value;
    E.tel4 = document.getElementById('inn-tel4').value.replace(/\D/g, '').slice(-4);
    if (!E.code || !E.naissance || E.tel4.length < 4) { E.erreur = T('Entrez votre code, votre date de naissance et les 4 derniers chiffres de votre numéro WhatsApp.', 'Enter your code, your date of birth and the last 4 digits of your WhatsApp number.'); dessiner(); return; }
    E.occupe = true; dessiner();
    try {
      const { rep, r } = await serveur({ type: 'inscription-code' });
      E.occupe = false;
      if (rep.ok && r.casting) { E.c = r.casting; E.note = adresseNote(r.note); aller('recap'); return; }
      E.erreur = messageAccesRefuse(rep, r, T('Code, date de naissance ou chiffres du numéro incorrects', 'Wrong code, date of birth or phone digits')) || T('Code, date de naissance ou chiffres du numéro incorrects.', 'Wrong code, date of birth or phone digits.');
    } catch (e) { E.occupe = false; E.erreur = COUPURE; }
    dessiner();
  }
  function enregistrer() {
    const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const c = Object.assign({}, E.c, { full_name: v('inn-nom'), telephone: v('inn-tel'), email: v('inn-mail'), ville: v('inn-ville') });
    if (mineur()) Object.assign(c, { parent_nom: v('inn-pnom'), parent_telephone: v('inn-ptel'), parent_email: v('inn-pmail') });
    if (!c.full_name || c.telephone.replace(/\D/g, '').length < 8) { E.erreur = T('Nom et numéro de téléphone complet obligatoires.', 'Full name and a complete phone number are required.'); dessiner(); return; }
    if (mineur() && (!c.parent_nom || c.parent_telephone.replace(/\D/g, '').length < 8)) { E.erreur = T('Mineur : nom et téléphone du parent obligatoires.', 'Minor: parent’s name and phone are required.'); dessiner(); return; }
    E.c = c; aller('reglement');
  }
  async function paye() {
    E.occupe = true; dessiner();
    const c = E.c;
    const infos = { full_name: c.full_name, telephone: c.telephone, email: c.email, ville: c.ville, reglement: 'accepte', moyen: moyenInn().code, numero_payeur: String(E.numero || '').trim() };
    if (mineur()) Object.assign(infos, { parent_nom: c.parent_nom, parent_telephone: c.parent_telephone, parent_email: c.parent_email, accord_parent: c.parent_nom });
    try {
      const { rep, r } = await serveur({ type: 'inscription-payer', infos });
      E.occupe = false;
      if (rep.ok) { aller('merci'); void chargerProgramme().then(() => { if (E.ecran === 'merci') dessiner(); }); return; }
      // (seuls nos propres messages s'affichent, jamais un message technique de la base)
      E.erreur = r.error === 'dossier' ? (/obligatoires|règlement|invalide|indisponible/.test(r.message || '') ? r.message : T('Informations incomplètes. Vérifiez puis réessayez.', 'Incomplete information. Check and try again.'))
        : messageAccesRefuse(rep, r, T('Ce code n’est plus valable', 'This code is no longer valid')) || T('Impossible d’enregistrer votre paiement. Contactez l’agence.', 'Your payment could not be recorded. Please contact the agency.');
    } catch (e) {
      E.occupe = false;
      E.erreur = T('Connexion coupée : votre déclaration n’a peut-être pas été reçue. Réessayez, ou contactez l’agence si ce message revient.', 'Connection lost: your declaration may not have been received. Try again, or contact the agency if this message returns.');
    }
    dessiner();
  }

  zone.addEventListener('click', (e) => {
    // (13/11/2026) moyen choisi en tuile ; lien de paiement par carte ouvert (comme le lien Wave)
    const t = e.target.closest('[data-moyen]');
    if (t) { E.moyen = t.getAttribute('data-moyen'); E.waveOuvert = false; dessiner(); return; }
    if (e.target.closest('[data-mp="lien"]')) { E.waveOuvert = true; setTimeout(dessiner, 300); return; }
    const b = e.target.closest('[data-a]');
    if (!b || b.disabled) return;
    const a = b.getAttribute('data-a');
    if (a === 'entrer') void entrer();
    else if (a === 'oui') aller('reglement');
    else if (a === 'corriger') { E.correction = true; dessiner(); }
    else if (a === 'enregistrer') enregistrer();
    else if (a === 'paiement') { aller('paiement'); void chargerLien().then(() => { if (E.ecran === 'paiement') dessiner(); }); }
    else if (a === 'wave') { E.waveOuvert = true; setTimeout(dessiner, 300); }  // le lien Wave s'ouvre dans un autre onglet
    else if (a === 'paye') void paye();
  });
  zone.addEventListener('change', (e) => {
    if (e.target.id === 'inn-regl') E.reglement = e.target.checked;
    else if (e.target.id === 'inn-parent') E.parent = e.target.checked;
    const b = document.getElementById('inn-vers-paiement');
    if (b) b.disabled = !reglementPret();
  });
  zone.addEventListener('input', (e) => {
    if (e.target.id !== 'inn-num') return;
    E.numero = e.target.value;
    const b = zone.querySelector('[data-a="paye"]');
    if (b) b.disabled = !peutPayer();
  });
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
      const b = zone.querySelector('.btn--principal:not([disabled])');
      if (b) b.click();
    }
  });
  dessiner();
})();
