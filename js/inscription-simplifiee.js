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
  const E = { ecran: 'code', code: '', naissance: '', c: null, note: null, erreur: '', correction: false,
    reglement: false, parent: false, waveOuvert: false, occupe: false, numero: null, lien: null };
  const numeroValide = (n) => /^[0-9+ ]{6,20}$/.test(String(n || '').trim());

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
  const dateLisible = (iso) => String(iso || '').split('-').reverse().join('/');
  const etapes = (n) => { Array.prototype.forEach.call(barre.children, (i, k) => { i.className = k < n ? 'on' : ''; }); };
  const bandeau = (t, type) => t ? '<div class="inn-bandeau ' + type + '" role="alert">' + esc(t) + '</div>' : '';
  const ligne = (a, b) => b ? '<div class="inn-ligne"><span>' + esc(a) + '</span><b>' + esc(b) + '</b></div>' : '';
  const champ = (id, libelle, valeur, type) => '<div class="form-champ"><label for="' + id + '">' + esc(libelle) + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(valeur) + '"></div>';
  const mineur = () => !!(E.c && E.c.mineur);

  function ecranCode() {
    etapes(1);
    return '<div class="inn-carte"><div><h1>' + T('Inscription nouveaux mannequins', 'New model registration') + '</h1>' +
      '<p class="inn-doux">' + T('Réservée aux mannequins retenus. Entrez le code personnel transmis par l’agence.', 'For selected models only. Enter the personal code sent by the agency.') + '</p></div>' +
      champ('inn-code', T('Code d’inscription', 'Registration code'), E.code) +
      champ('inn-naissance', T('Votre date de naissance', 'Your date of birth'), E.naissance, 'date') +
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
      return '<div class="inn-carte">' + tete + '<div>' + ligne(T('Nom', 'Name'), c.full_name) + ligne(T('Date de naissance', 'Date of birth'), dateLisible(c.date_naissance)) +
        ligne(T('Téléphone', 'Phone'), c.telephone) + ligne('E-mail', c.email) + ligne(T('Ville', 'City'), c.ville) +
        (mineur() ? ligne(T('Parent ou tuteur', 'Parent or guardian'), c.parent_nom) + ligne(T('Téléphone du parent', 'Parent’s phone'), c.parent_telephone) : '') +
        ligne(T('Casting', 'Casting'), c.casting) + '</div>' +
        (mineur() && !(c.parent_nom && c.parent_telephone) ? '<div class="inn-note">' + T('Mineur : le nom et le téléphone du parent sont obligatoires. Touchez « Non, corriger ».', 'Minor: the parent’s name and phone are required. Tap “No, correct”.') + '</div>' : '') +
        '<p style="font-weight:700;margin:0">' + T('Ces informations sont-elles exactes ?', 'Is this information correct?') + '</p>' +
        '<button class="btn btn--principal" type="button" data-a="oui"' + (mineur() && !(c.parent_nom && c.parent_telephone) ? ' disabled' : '') + '>' + T('Oui, continuer', 'Yes, continue') + '</button>' +
        '<button class="btn" type="button" data-a="corriger">' + T('Non, corriger', 'No, correct') + '</button></div>';
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
      '<div><div class="inn-surtitre" style="margin-bottom:0.4rem">' + T('Moyen de paiement', 'Payment method') + '</div><div class="inn-operateurs">' +
      '<span class="inn-op actif">Wave</span><span class="inn-op bientot">Orange Money · ' + T('bientôt', 'soon') + '</span><span class="inn-op bientot">MTN Money · ' + T('bientôt', 'soon') + '</span><span class="inn-op bientot">Moov Money · ' + T('bientôt', 'soon') + '</span></div></div>' +
      (mineur() ? '<label class="inn-case" for="inn-parent"><input id="inn-parent" type="checkbox"' + (E.parent ? ' checked' : '') + '><span>' +
        T('Je suis ' + esc(E.c.parent_nom) + ', parent ou tuteur légal, et j’autorise cette inscription.', 'I am ' + esc(E.c.parent_nom) + ', parent or legal guardian, and I authorise this registration.') + '</span></label>' : '') +
      '<label class="inn-case" for="inn-regl"><input id="inn-regl" type="checkbox"' + (E.reglement ? ' checked' : '') + '><span>' + T('J’ai lu et j’accepte le règlement de l’agence.', 'I have read and accept the agency’s rules.') + '</span></label>' +
      '<button class="btn btn--principal" type="button" id="inn-vers-paiement" data-a="paiement"' + (reglementPret() ? '' : ' disabled') + '>' + T('Continuer vers le paiement', 'Continue to payment') + '</button></div>';
  }

  // Lien Wave de 25 000 FCFA géré dans les Paramètres de l'agence ; repli sur le lien d'origine
  async function chargerLien() {
    try {
      if (typeof sb === 'undefined') return;
      const r = await sb.rpc('lien_paiement', { p_type: 'inscription', p_montant: 25000 });
      E.lien = !r.error && typeof r.data === 'string' && /^https:\/\//.test(r.data) ? r.data : null;
    } catch (e) { E.lien = null; }
  }

  function ecranPaiement() {
    etapes(4);
    if (E.numero === null) E.numero = (E.c && E.c.telephone) || '';
    return '<div class="inn-carte"><div><div class="inn-surtitre">' + T('Étape 3 sur 3', 'Step 3 of 3') + '</div><h2>' + T('Paiement de l’inscription', 'Registration payment') + '</h2></div>' +
      '<div>' + ligne(T('Inscription', 'Registration'), '15 000 FCFA') + ligne(T('1er mois de formation', '1st month of training'), '10 000 FCFA') +
      '<div class="inn-total"><b>Total</b><b>25 000 FCFA</b></div></div>' + bandeau(E.erreur, 'erreur') +
      '<a class="btn btn--principal" data-a="wave" href="' + esc(E.lien || LIEN_WAVE) + '" target="_blank" rel="noopener">' + T('1 · Payer avec Wave', '1 · Pay with Wave') + '</a>' +
      champ('inn-num', T('Numéro mobile money qui paie', 'Mobile money number that pays'), E.numero, 'tel') +
      '<button class="btn" type="button" data-a="paye"' + (E.waveOuvert && numeroValide(E.numero) && !E.occupe ? '' : ' disabled') + '>' + T('2 · J’ai payé', '2 · I have paid') + '</button>' +
      '<p class="inn-petit">' + T('Après avoir payé dans Wave, revenez ici, vérifiez le numéro qui a payé, puis appuyez sur « J’ai payé ». Pas de capture d’écran, pas de référence.', 'After paying in Wave, come back here, check the number that paid, then tap “I have paid”. No screenshot, no reference needed.') + '</p></div>';
  }

  function ecranMerci() {
    etapes(4);
    return '<div class="inn-carte"><div class="inn-bandeau info">' + T('Merci ! L’agence vérifie votre paiement. Vous serez prévenu(e) par e-mail et WhatsApp dès qu’il est confirmé.', 'Thank you! The agency is checking your payment. You will be notified by e-mail and WhatsApp as soon as it is confirmed.') + '</div>' +
      '<p class="inn-doux">' + T('Ensuite, l’agence vous enverra le code pour créer votre espace mannequin. Vous pouvez fermer cette page.', 'Next, the agency will send you the code to create your model space. You can close this page.') + '</p></div>';
  }

  const ECRANS = { code: ecranCode, recap: ecranRecap, reglement: ecranReglement, paiement: ecranPaiement, merci: ecranMerci };
  const dessiner = () => { zone.innerHTML = ECRANS[E.ecran](); };
  const aller = (ecran) => { E.ecran = ecran; E.erreur = ''; E.correction = false; dessiner(); window.scrollTo(0, 0); };

  // Appel au serveur ; un refus de code dit combien d'essais il reste (messageAccesRefuse, js/app.js)
  async function serveur(donnees) {
    const rep = await fetch('/api/code-protege', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ code: E.code, naissance: E.naissance, appareil: idAppareilMa2m() }, donnees)) });
    return { rep, r: await rep.json().catch(() => ({})) };
  }
  const COUPURE = T('Connexion impossible. Vérifiez votre connexion internet puis réessayez.', 'Connection failed. Check your internet connection and try again.');
  // Note d'intégration (règlement) : adresse secrète servie directement par Cloudflare
  const adresseNote = (chemin) => typeof chemin === 'string' && chemin.startsWith('prive/note-integration/') && /^[\w/.-]+$/.test(chemin) ? PHOTOS_DIRECTES + chemin : null;

  async function entrer() {
    E.code = document.getElementById('inn-code').value.trim().toUpperCase();
    E.naissance = document.getElementById('inn-naissance').value;
    if (!E.code || !E.naissance) { E.erreur = T('Entrez votre code et votre date de naissance.', 'Enter your code and date of birth.'); dessiner(); return; }
    E.occupe = true; dessiner();
    try {
      const { rep, r } = await serveur({ type: 'inscription-code' });
      E.occupe = false;
      if (rep.ok && r.casting) { E.c = r.casting; E.note = adresseNote(r.note); aller('recap'); return; }
      E.erreur = messageAccesRefuse(rep, r, T('Code ou date de naissance incorrect', 'Wrong code or date of birth')) || T('Code ou date de naissance incorrect.', 'Wrong code or date of birth.');
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
    const infos = { full_name: c.full_name, telephone: c.telephone, email: c.email, ville: c.ville, reglement: 'accepte', moyen: 'wave', numero_payeur: String(E.numero || '').trim() };
    if (mineur()) Object.assign(infos, { parent_nom: c.parent_nom, parent_telephone: c.parent_telephone, parent_email: c.parent_email, accord_parent: c.parent_nom });
    try {
      const { rep, r } = await serveur({ type: 'inscription-payer', infos });
      E.occupe = false;
      if (rep.ok) { aller('merci'); return; }
      // (seuls nos propres messages s'affichent, jamais un message technique de la base)
      E.erreur = r.error === 'dossier' ? (/obligatoires|règlement|invalide/.test(r.message || '') ? r.message : T('Informations incomplètes. Vérifiez puis réessayez.', 'Incomplete information. Check and try again.'))
        : messageAccesRefuse(rep, r, T('Ce code n’est plus valable', 'This code is no longer valid')) || T('Impossible d’enregistrer votre paiement. Contactez l’agence.', 'Your payment could not be recorded. Please contact the agency.');
    } catch (e) {
      E.occupe = false;
      E.erreur = T('Connexion coupée : votre déclaration n’a peut-être pas été reçue. Réessayez, ou contactez l’agence si ce message revient.', 'Connection lost: your declaration may not have been received. Try again, or contact the agency if this message returns.');
    }
    dessiner();
  }

  zone.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b || b.disabled) return;
    const a = b.getAttribute('data-a');
    if (a === 'entrer') entrer();
    else if (a === 'oui') aller('reglement');
    else if (a === 'corriger') { E.correction = true; dessiner(); }
    else if (a === 'enregistrer') enregistrer();
    else if (a === 'paiement') { aller('paiement'); chargerLien().then(() => { if (E.ecran === 'paiement') dessiner(); }); }
    else if (a === 'wave') { E.waveOuvert = true; setTimeout(dessiner, 300); }  // le lien Wave s'ouvre dans un autre onglet
    else if (a === 'paye') paye();
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
    if (b) b.disabled = !(E.waveOuvert && numeroValide(E.numero) && !E.occupe);
  });
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
      const b = zone.querySelector('.btn--principal:not([disabled])');
      if (b) b.click();
    }
  });
  dessiner();
})();
