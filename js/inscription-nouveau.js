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
            reglement: false, parent: false, numero: '', waveOuvert: false, occupe: false };
  var MONTANT = '25 000 FCFA';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dateFr(iso) { return String(iso).split('-').reverse().join('/'); }
  function age(iso) {
    var p = iso.split('-'), n = new Date(), a = n.getFullYear() - (+p[0]);
    if (n.getMonth() + 1 < +p[1] || (n.getMonth() + 1 === +p[1] && n.getDate() < +p[2])) a--;
    return a;
  }
  function mineur() { return E.candidat && age(E.candidat.naissance) < 18; }
  function prenom() { return E.candidat ? E.candidat.nom.split(' ')[0] : ''; }
  function etapes(n) { Array.prototype.forEach.call(barre.children, function (i, k) { i.className = k < n ? 'on' : ''; }); }
  function bandeau(t, type) { return t ? '<div class="inn-bandeau ' + type + '" role="alert">' + esc(t) + '</div>' : ''; }
  function ligne(a, b) { return '<div class="inn-ligne"><span>' + esc(a) + '</span><b>' + esc(b) + '</b></div>'; }

  function ecranCode() {
    etapes(1);
    return '<div class="inn-carte"><div><h1>Inscription nouveaux mannequins</h1>' +
      '<p class="inn-doux">Réservée aux mannequins retenus. Entrez le code transmis par l\'agence.</p></div>' +
      '<div class="form-champ"><label for="inn-code">Code d\'inscription</label><input id="inn-code" type="text" autocomplete="off" autocapitalize="characters" placeholder="MA2M-XXXX-00" value="' + esc(E.code) + '"></div>' +
      '<div class="form-champ"><label for="inn-naissance">Votre date de naissance</label><input id="inn-naissance" type="date" value="' + esc(E.naissance) + '"></div>' +
      bandeau(E.erreur, 'erreur') +
      '<button class="btn btn--principal" data-a="entrer"' + (E.occupe ? ' disabled' : '') + '>Continuer</button>' +
      '<p class="inn-petit">Le code ne fonctionne qu\'une fois. Après 3 essais ratés, il est bloqué : il faut contacter l\'agence.</p></div>';
  }

  function ecranRecap() {
    etapes(2);
    var c = E.candidat;
    var tete = '<div><div class="inn-surtitre">Étape 1 sur 3</div><h2>Bonjour ' + esc(prenom()) + ', félicitations !</h2>' +
      '<p class="inn-doux">Vous avez été retenu(e). Vos informations sont déjà chez nous.</p></div>';
    if (!E.correction) {
      return '<div class="inn-carte">' + tete + '<div>' + ligne('Nom', c.nom) + ligne('Date de naissance', dateFr(c.naissance)) +
        ligne('Téléphone', c.telephone) + (c.email ? ligne('E-mail', c.email) : '') +
        (mineur() && c.parent ? ligne('Parent ou tuteur', c.parent.nom) : '') + ligne('Origine', c.origine) + '</div>' +
        '<p style="font-weight:700;margin:0">Ces informations sont-elles exactes ?</p>' +
        '<button class="btn btn--principal" data-a="oui">Oui, continuer</button><button class="btn" data-a="corriger">Non, corriger</button></div>';
    }
    return '<div class="inn-carte">' + tete +
      '<div class="form-champ"><label for="inn-tel">Téléphone</label><input id="inn-tel" type="tel" value="' + esc(c.telephone) + '"></div>' +
      '<div class="form-champ"><label for="inn-mail">E-mail</label><input id="inn-mail" type="email" value="' + esc(c.email) + '"></div>' +
      '<div class="inn-note">Un nom ou une date de naissance incorrects se corrigent auprès de l\'agence, qui vérifie : cela change le statut mineur ou majeur.</div>' +
      bandeau(E.erreur, 'erreur') +
      '<button class="btn btn--principal" data-a="enregistrer"' + (E.occupe ? ' disabled' : '') + '>Enregistrer et continuer</button></div>';
  }

  function numeroValide() { return E.numero.replace(/\D/g, '').length >= 8; }
  function reglementPret() { return E.reglement && numeroValide() && (!mineur() || E.parent); }

  function ecranReglement() {
    etapes(3);
    return '<div class="inn-carte"><div><div class="inn-surtitre">Étape 2 sur 3</div><h2>Règlement et paiement</h2></div>' +
      '<div><div class="inn-surtitre" style="margin-bottom:0.4rem">Moyen de paiement</div><div class="inn-operateurs">' +
      '<span class="inn-op actif">Wave</span><span class="inn-op bientot">Orange Money · bientôt</span><span class="inn-op bientot">MTN Money · bientôt</span><span class="inn-op bientot">Moov Money · bientôt</span></div></div>' +
      '<div class="form-champ"><label for="inn-num">Numéro Wave qui va payer</label><input id="inn-num" type="tel" inputmode="tel" placeholder="07 00 00 00 00" value="' + esc(E.numero) + '"></div>' +
      (mineur() ? '<label class="inn-case" for="inn-parent"><input id="inn-parent" type="checkbox"' + (E.parent ? ' checked' : '') + '><span>Je suis le parent ou le tuteur légal et j\'autorise cette inscription.</span></label>' : '') +
      '<label class="inn-case" for="inn-regl"><input id="inn-regl" type="checkbox"' + (E.reglement ? ' checked' : '') + '><span>J\'ai lu et j\'accepte le règlement de l\'agence.</span></label>' +
      '<button class="btn btn--principal" id="inn-vers-paiement" data-a="paiement"' + (reglementPret() ? '' : ' disabled') + '>Continuer vers le paiement</button></div>';
  }

  function ecranPaiement() {
    etapes(4);
    return '<div class="inn-carte"><div><div class="inn-surtitre">Étape 3 sur 3</div><h2>Paiement de l\'inscription</h2></div>' +
      '<div>' + ligne('Inscription', '15 000 FCFA') + ligne('1er mois de formation', '10 000 FCFA') +
      '<div class="inn-total"><b>Total</b><b>' + MONTANT + '</b></div></div>' +
      bandeau(E.erreur, 'erreur') +
      '<button class="btn btn--principal" data-a="wave">1 · Payer avec Wave</button>' +
      '<button class="btn" data-a="paye"' + (E.waveOuvert && !E.occupe ? '' : ' disabled') + '>2 · J\'ai payé</button>' +
      '<p class="inn-petit">Après avoir payé dans Wave, revenez ici et appuyez sur « J\'ai payé ». Rien d\'autre à faire, pas de capture d\'écran.' +
      (SOURCE.simule ? ' (Démonstration : « Payer avec Wave » ne paie rien, il débloque seulement le bouton suivant.)' : '') + '</p></div>';
  }

  function ecranMerci() {
    etapes(4);
    return '<div class="inn-carte"><div class="inn-bandeau info">Merci ! L\'agence vérifie votre paiement. Vous serez prévenu(e) par SMS et e-mail dès qu\'il est confirmé.</div>' +
      '<p class="inn-doux">Vous pouvez fermer cette page. Aucune capture à envoyer.</p></div>';
  }

  var ECRANS = { code: ecranCode, recap: ecranRecap, reglement: ecranReglement, paiement: ecranPaiement, merci: ecranMerci };
  function dessiner(garderFocus) {
    var actif = garderFocus && document.activeElement && document.activeElement.id;
    zone.innerHTML = ECRANS[E.ecran]();
    if (actif) { var el = document.getElementById(actif); if (el) { el.focus(); if (el.setSelectionRange && el.type === 'text') { try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} } } }
  }
  function aller(ecran) { E.ecran = ecran; E.erreur = ''; E.correction = false; dessiner(false); window.scrollTo(0, 0); }

  var MESSAGES = {
    inconnu: 'Code ou date de naissance incorrect.',
    bloque: 'Code bloqué après 3 essais. Contactez l\'agence.',
    deja_utilise: 'Ce code a déjà été utilisé. Contactez l\'agence si besoin.'
  };

  zone.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    var a = b.getAttribute('data-a');
    if (a === 'entrer') {
      var code = document.getElementById('inn-code').value, nais = document.getElementById('inn-naissance').value;
      E.code = code.trim().toUpperCase(); E.naissance = nais;
      if (!E.code || !E.naissance) { E.erreur = 'Entrez votre code et votre date de naissance.'; dessiner(false); return; }
      E.occupe = true; dessiner(false);
      Promise.resolve(SOURCE.verifierCode(E.code, E.naissance)).then(function (r) {
        E.occupe = false;
        if (r && r.ok) { E.candidat = r.candidat; E.numero = r.candidat.telephone || ''; aller('recap'); return; }
        E.erreur = (MESSAGES[r && r.raison] || MESSAGES.inconnu) + (r && r.essais && r.raison === 'inconnu' ? ' Essai ' + r.essais + ' sur 3.' : '');
        dessiner(false);
      });
    } else if (a === 'oui') { aller('reglement'); }
    else if (a === 'corriger') { E.correction = true; dessiner(false); }
    else if (a === 'enregistrer') {
      var tel = document.getElementById('inn-tel').value.trim(), mail = document.getElementById('inn-mail').value.trim();
      if (tel.replace(/\D/g, '').length < 8) { E.erreur = 'Le numéro de téléphone est trop court.'; dessiner(false); return; }
      E.occupe = true; dessiner(false);
      Promise.resolve(SOURCE.corriger(E.code, { telephone: tel, email: mail })).then(function (r) {
        E.occupe = false;
        if (r && r.ok) { E.candidat.telephone = tel; E.candidat.email = mail; E.numero = tel; aller('reglement'); }
        else { E.erreur = 'Impossible d\'enregistrer. Réessayez ou contactez l\'agence.'; dessiner(false); }
      });
    } else if (a === 'paiement') { aller('paiement'); }
    else if (a === 'wave') { E.waveOuvert = true; dessiner(false); }
    else if (a === 'paye') {
      E.occupe = true; dessiner(false);
      Promise.resolve(SOURCE.declarerPaiement(E.code, { numero: E.numero, operateur: 'wave' })).then(function (r) {
        E.occupe = false;
        if (r && r.ok) aller('merci');
        else { E.erreur = 'Impossible d\'enregistrer votre paiement. Réessayez ou contactez l\'agence.'; dessiner(false); }
      });
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
