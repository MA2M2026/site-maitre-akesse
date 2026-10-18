// Parcours d'inscription simplifié après un casting validé : 4 écrans (démonstration 18/10/2026).
//   1. code individuel + date de naissance
//   2. récapitulatif « Ces informations sont-elles exactes ? »
//   3. règlement + numéro mobile money (+ accord du parent si mineur)
//   4. paiement de 25 000 FCFA, puis « J'ai payé »
// Toutes les données viennent de window.MA2M_INSCRIPTION_SOURCE (js/inscription-nouveau-simule.js
// pour la démonstration). Ce fichier ne parle jamais directement à la base de données.
(function () {
  'use strict';
  var SOURCE = window.MA2M_INSCRIPTION_SOURCE;
  var zone = document.getElementById('inn-ecran');
  var barre = document.getElementById('inn-etapes');
  if (!SOURCE || !zone) return;
  if (!SOURCE.simule) { var d = document.getElementById('inn-demo'); if (d) d.hidden = true; }

  var E = { ecran: 'code', code: '', naissance: '', candidat: null, erreur: '', correction: false,
            reglement: false, parent: false, numero: '', waveOuvert: false, occupe: false,
            saisie: null }; // téléphone / e-mail tapés à l'écran « Corriger » (gardés si l'envoi échoue)
  // montants renvoyés par le serveur (réglages de l'agence) ; valeurs du cahier par défaut (démonstration)
  var TARIF = { total: 25000, inscription: 15000, mois: 10000 };
  function fcfa(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA'; }

  // Textes en anglais pour la page en/inscription-mannequin.html (même parcours)
  var EN = document.documentElement.lang === 'en' ? {
    'Inscription nouveaux mannequins': 'New model registration',
    'Réservée aux mannequins retenus. Entrez le code transmis par l\'agence.': 'For selected models only. Enter the code given to you by the agency.',
    'Code d\'inscription': 'Registration code',
    'Votre date de naissance': 'Your date of birth',
    'Continuer': 'Continue',
    'Le code ne fonctionne qu\'une fois. Après 3 essais ratés, il est bloqué : il faut contacter l\'agence.': 'The code works only once. After 3 failed attempts it is blocked: please contact the agency.',
    'Étape 1 sur 3': 'Step 1 of 3',
    'Étape 2 sur 3': 'Step 2 of 3',
    'Étape 3 sur 3': 'Step 3 of 3',
    ', félicitations !': ', congratulations!',
    'Vous avez été retenu(e). Vos informations sont déjà chez nous.': 'You have been selected. We already have your details.',
    'Nom': 'Name',
    'Date de naissance': 'Date of birth',
    'Téléphone': 'Phone',
    'E-mail': 'Email',
    'Parent ou tuteur': 'Parent or guardian',
    'Origine': 'Origin',
    'Ces informations sont-elles exactes ?': 'Is this information correct?',
    'Oui, continuer': 'Yes, continue',
    'Non, corriger': 'No, correct it',
    'Un nom ou une date de naissance incorrects se corrigent auprès de l\'agence, qui vérifie : cela change le statut mineur ou majeur.': 'A wrong name or date of birth is corrected by the agency, which checks it: it changes the minor or adult status.',
    'Enregistrer et continuer': 'Save and continue',
    'Règlement et paiement': 'Rules and payment',
    'Moyen de paiement': 'Payment method',
    'Orange Money · bientôt': 'Orange Money · soon',
    'MTN Money · bientôt': 'MTN Money · soon',
    'Moov Money · bientôt': 'Moov Money · soon',
    'Numéro Wave qui va payer': 'Wave number that will pay',
    'Je suis le parent ou le tuteur légal et j\'autorise cette inscription.': 'I am the parent or legal guardian and I authorise this registration.',
    'J\'ai lu et j\'accepte le règlement de l\'agence.': 'I have read and accept the agency rules.',
    'Continuer vers le paiement': 'Continue to payment',
    'Paiement de l\'inscription': 'Registration payment',
    'Inscription': 'Registration',
    '1er mois de formation': '1st month of training',
    '1 · Payer avec Wave': '1 · Pay with Wave',
    '2 · J\'ai payé': '2 · I have paid',
    'Après avoir payé dans Wave, revenez ici et appuyez sur « J\'ai payé ». Rien d\'autre à faire, pas de capture d\'écran.': 'After paying in Wave, come back here and tap “I have paid”. Nothing else to do, no screenshot.',
    'Merci ! L\'agence vérifie votre paiement. Vous serez prévenu(e) par SMS et e-mail dès qu\'il est confirmé.': 'Thank you! The agency is checking your payment. You will be notified by text message and email as soon as it is confirmed.',
    'Vous pouvez fermer cette page. Aucune capture à envoyer.': 'You can close this page. No screenshot to send.',
    'Code ou date de naissance incorrect.': 'Incorrect code or date of birth.',
    'Code bloqué après 3 essais. Contactez l\'agence.': 'Code blocked after 3 attempts. Please contact the agency.',
    'Ce code a déjà été utilisé. Contactez l\'agence si besoin.': 'This code has already been used. Contact the agency if needed.',
    'Connexion impossible. Vérifiez votre connexion internet puis réessayez.': 'Connection failed. Check your internet connection and try again.',
    'Entrez votre code et votre date de naissance.': 'Enter your code and your date of birth.',
    'Le numéro de téléphone est trop court.': 'The phone number is too short.',
    'Impossible d\'enregistrer. Réessayez ou contactez l\'agence.': 'Could not save. Try again or contact the agency.',
    'Le lien de paiement n\'est pas encore disponible. Contactez l\'agence.': 'The payment link is not available yet. Please contact the agency.',
    'Impossible d\'enregistrer votre paiement. Réessayez ou contactez l\'agence.': 'Could not record your payment. Try again or contact the agency.',
    'Connexion coupée : votre déclaration n\'a peut-être pas été reçue. Réessayez, ou contactez l\'agence si ce message revient.': 'Connection lost: your declaration may not have been received. Try again, or contact the agency if this message comes back.',
    'Note d\'information et procédure d\'intégration': 'Information note and integration procedure',
    'Lisez ce document avant de continuer : parcours d\'intégration, formation, règles de l\'agence et frais.': 'Read this document before continuing: integration path, training, agency rules and fees.',
    'Lire et télécharger le document (PDF)': 'Read and download the document (PDF)',
    'Casting en ligne': 'Online casting',
    'Casting direct': 'Direct casting'
  } : null;
  function t(fr) { return (EN && EN[fr]) || fr; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dateFr(iso) { return String(iso).split('-').reverse().join('/'); } // jj/mm/aaaa aussi en anglais (usage ivoirien)
  function age(iso) {
    var p = iso.split('-'), n = new Date(), a = n.getFullYear() - (+p[0]);
    if (n.getMonth() + 1 < +p[1] || (n.getMonth() + 1 === +p[1] && n.getDate() < +p[2])) a--;
    return a;
  }
  function mineur() { return E.candidat && age(E.candidat.naissance) < 18; }
  function prenom() { return E.candidat ? E.candidat.nom.split(' ')[0] : ''; }
  function etapes(n) { Array.prototype.forEach.call(barre.children, function (i, k) { i.className = k < n ? 'on' : ''; }); }
  function bandeau(t, type) { return t ? '<div class="inn-bandeau ' + type + '" role="alert">' + esc(t) + '</div>' : ''; }
  // numéro lisible à l'écran : 0700000001 → 07 00 00 00 01 (la valeur envoyée ne change pas)
  function telLisible(n) { var c = String(n || '').replace(/\s+/g, ''); return /^\d{10}$/.test(c) ? c.replace(/(\d{2})(?=\d)/g, '$1 ') : (n || ''); }
  function ligne(a, b) { return '<div class="inn-ligne"><span>' + esc(a) + '</span><b>' + esc(b) + '</b></div>'; }

  function ecranCode() {
    etapes(1);
    return '<div class="inn-carte"><div><h1>' + t('Inscription nouveaux mannequins') + '</h1>' +
      '<p class="inn-doux">' + t('Réservée aux mannequins retenus. Entrez le code transmis par l\'agence.') + '</p></div>' +
      '<div class="form-champ"><label for="inn-code">' + t('Code d\'inscription') + '</label><input id="inn-code" type="text" autocomplete="off" autocapitalize="characters" placeholder="MA2M-XXXX-00" value="' + esc(E.code) + '"></div>' +
      '<div class="form-champ"><label for="inn-naissance">' + t('Votre date de naissance') + '</label><input id="inn-naissance" type="date" value="' + esc(E.naissance) + '"></div>' +
      bandeau(E.erreur, 'erreur') +
      '<button class="btn btn--principal" data-a="entrer"' + (E.occupe ? ' disabled' : '') + '>' + t('Continuer') + '</button>' +
      '<p class="inn-petit">' + t('Le code ne fonctionne qu\'une fois. Après 3 essais ratés, il est bloqué : il faut contacter l\'agence.') + '</p></div>';
  }

  function ecranRecap() {
    etapes(2);
    var c = E.candidat;
    var tete = '<div><div class="inn-surtitre">' + t('Étape 1 sur 3') + '</div><h2>' + (EN ? 'Hello ' : 'Bonjour ') + esc(prenom()) + t(', félicitations !') + '</h2>' +
      '<p class="inn-doux">' + t('Vous avez été retenu(e). Vos informations sont déjà chez nous.') + '</p></div>';
    if (!E.correction) {
      return '<div class="inn-carte">' + tete + '<div>' + ligne(t('Nom'), c.nom) + ligne(t('Date de naissance'), dateFr(c.naissance)) +
        ligne(t('Téléphone'), telLisible(c.telephone)) + (c.email ? ligne(t('E-mail'), c.email) : '') +
        (mineur() && c.parent ? ligne(t('Parent ou tuteur'), c.parent.nom) : '') + ligne(t('Origine'), t(c.origine)) + '</div>' +
        '<p class="inn-question">' + t('Ces informations sont-elles exactes ?') + '</p>' +
        '<button class="btn btn--principal" data-a="oui">' + t('Oui, continuer') + '</button><button class="btn" data-a="corriger">' + t('Non, corriger') + '</button></div>';
    }
    return '<div class="inn-carte">' + tete +
      '<div class="form-champ"><label for="inn-tel">Téléphone</label><input id="inn-tel" type="tel" value="' + esc(E.saisie ? E.saisie.telephone : c.telephone) + '"></div>' +
      '<div class="form-champ"><label for="inn-mail">E-mail</label><input id="inn-mail" type="email" value="' + esc(E.saisie ? E.saisie.email : c.email) + '"></div>' +
      '<div class="inn-note">' + t('Un nom ou une date de naissance incorrects se corrigent auprès de l\'agence, qui vérifie : cela change le statut mineur ou majeur.') + '</div>' +
      bandeau(E.erreur, 'erreur') +
      '<button class="btn btn--principal" data-a="enregistrer"' + (E.occupe ? ' disabled' : '') + '>' + t('Enregistrer et continuer') + '</button></div>';
  }

  function numeroValide() { return E.numero.replace(/\D/g, '').length >= 8; }
  function reglementPret() { return E.reglement && numeroValide() && (!mineur() || E.parent); }

  // Note d'information et procédure d'intégration (règlement, formation, frais) : servie
  // directement par Cloudflare (PHOTOS_DIRECTES, js/app.js), jamais par le relais mis en cache.
  function blocNote() {
    var chemin = SOURCE.note && SOURCE.note();
    if (typeof chemin !== 'string' || chemin.indexOf('prive/note-integration/') !== 0 || !/^[\w/.-]+$/.test(chemin) || typeof PHOTOS_DIRECTES === 'undefined') return '';
    return '<div class="inn-note" id="bloc-note-integration"><b>' + t('Note d\'information et procédure d\'intégration') + '</b><br>' +
      t('Lisez ce document avant de continuer : parcours d\'intégration, formation, règles de l\'agence et frais.') +
      '<br><a id="note-integration-lire" class="btn" href="' + esc(PHOTOS_DIRECTES + chemin) + '" target="_blank" rel="noopener">' + t('Lire et télécharger le document (PDF)') + '</a></div>';
  }

  function ecranReglement() {
    etapes(3);
    return '<div class="inn-carte"><div><div class="inn-surtitre">' + t('Étape 2 sur 3') + '</div><h2>' + t('Règlement et paiement') + '</h2></div>' +
      '<div><div class="inn-surtitre inn-surtitre-serre">' + t('Moyen de paiement') + '</div><div class="inn-operateurs">' +
      '<span class="inn-op actif">Wave</span><span class="inn-op bientot">' + t('Orange Money · bientôt') + '</span><span class="inn-op bientot">' + t('MTN Money · bientôt') + '</span><span class="inn-op bientot">' + t('Moov Money · bientôt') + '</span></div></div>' +
      blocNote() +
      '<div class="form-champ"><label for="inn-num">' + t('Numéro Wave qui va payer') + '</label><input id="inn-num" type="tel" inputmode="tel" placeholder="07 00 00 00 00" value="' + esc(E.numero) + '"></div>' +
      (mineur() ? '<label class="inn-case" for="inn-parent"><input id="inn-parent" type="checkbox"' + (E.parent ? ' checked' : '') + '><span>' + t('Je suis le parent ou le tuteur légal et j\'autorise cette inscription.') + '</span></label>' : '') +
      '<label class="inn-case" for="inn-regl"><input id="inn-regl" type="checkbox"' + (E.reglement ? ' checked' : '') + '><span>' + t('J\'ai lu et j\'accepte le règlement de l\'agence.') + '</span></label>' +
      '<button class="btn btn--principal" id="inn-vers-paiement" data-a="paiement"' + (reglementPret() ? '' : ' disabled') + '>' + t('Continuer vers le paiement') + '</button></div>';
  }

  function ecranPaiement() {
    etapes(4);
    return '<div class="inn-carte"><div><div class="inn-surtitre">' + t('Étape 3 sur 3') + '</div><h2>' + t('Paiement de l\'inscription') + '</h2></div>' +
      '<div>' + ligne(t('Inscription'), fcfa(TARIF.inscription)) + ligne(t('1er mois de formation'), fcfa(TARIF.mois)) +
      '<div class="inn-total"><b>Total</b><b>' + fcfa(TARIF.total) + '</b></div></div>' +
      bandeau(E.erreur, 'erreur') +
      '<button class="btn btn--principal" data-a="wave">' + t('1 · Payer avec Wave') + '</button>' +
      '<button class="btn" data-a="paye"' + (E.waveOuvert && !E.occupe ? '' : ' disabled') + '>' + t('2 · J\'ai payé') + '</button>' +
      '<p class="inn-petit">' + t('Après avoir payé dans Wave, revenez ici et appuyez sur « J\'ai payé ». Rien d\'autre à faire, pas de capture d\'écran.') + '' +
      (SOURCE.simule ? ' (Démonstration : « Payer avec Wave » ne paie rien, il débloque seulement le bouton suivant.)' : '') + '</p></div>';
  }

  function ecranMerci() {
    etapes(4);
    return '<div class="inn-carte"><div class="inn-bandeau info">' + t('Merci ! L\'agence vérifie votre paiement. Vous serez prévenu(e) par SMS et e-mail dès qu\'il est confirmé.') + '</div>' +
      '<p class="inn-doux">' + t('Vous pouvez fermer cette page. Aucune capture à envoyer.') + '</p></div>';
  }

  var ECRANS = { code: ecranCode, recap: ecranRecap, reglement: ecranReglement, paiement: ecranPaiement, merci: ecranMerci };
  function dessiner(garderFocus) {
    var actif = garderFocus && document.activeElement && document.activeElement.id;
    zone.innerHTML = ECRANS[E.ecran]();
    if (actif) { var el = document.getElementById(actif); if (el) { el.focus(); if (el.setSelectionRange && el.type === 'text') { try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} } } }
  }
  function aller(ecran) { E.ecran = ecran; E.erreur = ''; E.correction = false; E.saisie = null; dessiner(false); window.scrollTo(0, 0); }

  var MESSAGES = {
    inconnu: t('Code ou date de naissance incorrect.'),
    bloque: t('Code bloqué après 3 essais. Contactez l\'agence.'),
    deja_utilise: t('Ce code a déjà été utilisé. Contactez l\'agence si besoin.')
  };

  // Appel à la base : si la connexion coupe ou qu'une erreur survient, le bouton ne reste pas
  // bloqué sur « en cours » ; un message invite à réessayer (remarque SonarQube, 18/10/2026).
  // La cause est notée dans la console (relevée par le journal des erreurs du site).
  var COUPURE = t('Connexion impossible. Vérifiez votre connexion internet puis réessayez.');
  function appeler(action, suite, messageCoupure) {
    Promise.resolve().then(action).then(suite).catch(function (err) {
      console.error('Inscription simplifiée :', err);
      E.occupe = false;
      E.erreur = messageCoupure || COUPURE;
      dessiner(false);
    });
  }

  zone.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    var a = b.getAttribute('data-a');
    if (a === 'entrer') {
      var code = document.getElementById('inn-code').value, nais = document.getElementById('inn-naissance').value;
      E.code = code.trim().toUpperCase(); E.naissance = nais;
      if (!E.code || !E.naissance) { E.erreur = t('Entrez votre code et votre date de naissance.'); dessiner(false); return; }
      E.occupe = true; dessiner(false);
      appeler(function () { return SOURCE.verifierCode(E.code, E.naissance); }, function (r) {
        E.occupe = false;
        if (r && r.ok) { if (r.montant) TARIF = { total: r.montant, inscription: r.droit_inscription, mois: r.premier_mois }; E.candidat = r.candidat; E.numero = r.candidat.telephone || ''; aller('recap'); return; }
        E.erreur = (MESSAGES[r && r.raison] || MESSAGES.inconnu) + (r && r.essais && r.raison === 'inconnu' ? (EN ? ' Attempt ' + r.essais + ' of 3.' : ' Essai ' + r.essais + ' sur 3.') : '');
        dessiner(false);
      });
    } else if (a === 'oui') { aller('reglement'); }
    else if (a === 'corriger') { E.correction = true; dessiner(false); }
    else if (a === 'enregistrer') {
      var tel = document.getElementById('inn-tel').value.trim(), mail = document.getElementById('inn-mail').value.trim();
      E.saisie = { telephone: tel, email: mail };
      if (tel.replace(/\D/g, '').length < 8) { E.erreur = t('Le numéro de téléphone est trop court.'); dessiner(false); return; }
      E.occupe = true; dessiner(false);
      appeler(function () { return SOURCE.corriger(E.code, { telephone: tel, email: mail }); }, function (r) {
        E.occupe = false;
        if (r && r.ok) { E.candidat.telephone = tel; E.candidat.email = mail; E.numero = tel; aller('reglement'); }
        else { E.erreur = t('Impossible d\'enregistrer. Réessayez ou contactez l\'agence.'); dessiner(false); }
      });
    } else if (a === 'paiement') { aller('paiement'); }
    else if (a === 'wave') {
      // vraie source : le lien Wave Business de 25 000 FCFA s'ouvre (dans le navigateur, pour que l'appli Wave se lance)
      var lien = SOURCE.lienWave && SOURCE.lienWave();
      if (lien) window.open(lien, '_blank', 'noopener');
      else if (!SOURCE.simule) { E.erreur = t('Le lien de paiement n\'est pas encore disponible. Contactez l\'agence.'); dessiner(false); return; }
      E.waveOuvert = true; dessiner(false);
    }
    else if (a === 'paye') {
      E.occupe = true; dessiner(false);
      appeler(function () { return SOURCE.declarerPaiement(E.code, { numero: E.numero, operateur: 'wave', reglement: E.reglement, parent: E.parent }); }, function (r) {
        E.occupe = false;
        if (r && r.ok) aller('merci');
        else { E.erreur = t('Impossible d\'enregistrer votre paiement. Réessayez ou contactez l\'agence.'); dessiner(false); }
      }, // la déclaration a pu arriver malgré la coupure : message adapté
      t('Connexion coupée : votre déclaration n\'a peut-être pas été reçue. Réessayez, ou contactez l\'agence si ce message revient.'));
    }
  });
  zone.addEventListener('input', function (e) {
    if (e.target.id === 'inn-num') { E.numero = e.target.value; var b = document.getElementById('inn-vers-paiement'); if (b) b.disabled = !reglementPret(); }
  });
  zone.addEventListener('change', function (e) {
    if (e.target.id === 'inn-regl') E.reglement = e.target.checked;
    else if (e.target.id === 'inn-parent') E.parent = e.target.checked;
    var b = document.getElementById('inn-vers-paiement'); if (b) b.disabled = !reglementPret();
  });
  zone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
      var b = zone.querySelector('.btn--principal:not([disabled])'); if (b) b.click();
    }
  });
  dessiner(false);
})();
