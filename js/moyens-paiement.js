// Moyens de paiement (12/11/2026, demande de la propriétaire) : UNE copie pour les pages de paiement des mannequins
// (js/mes-paiements.js : site et application) et l'Administration (js/portail/espace-paiements.js).
// Six moyens préparés — Wave, Orange Money, MTN Money, Moov Money, carte bancaire (Visa), virement — allumés un par
// un dans l'Administration (Paramètres > Moyens de paiement) avec leur numéro, lien ou RIB : le jour où l'agence a le
// compte, rien à changer dans le site. Base : supabase-moyens-paiement.sql (moyens_paiement, moyens_paiement_publics,
// mensualite_declarer_avec_numero et mensualites_payer_avance avec le moyen). Tant que ce fichier n'est pas collé : Wave seul, comme avant.
(function () {
  'use strict';
  const NOMS = { wave: 'Wave', orange_money: 'Orange Money', mtn_money: 'MTN Money', moov_money: 'Moov Money', carte: 'Carte bancaire (Visa)',
    virement: 'Virement bancaire', cheque: 'Chèque', especes: 'Espèces', avant_systeme: 'Avant le nouveau système' };
  const PREPARES = ['wave', 'orange_money', 'mtn_money', 'moov_money', 'carte', 'virement'];
  const MOBILE = ['orange_money', 'mtn_money', 'moov_money'];
  // tous les moyens d'un paiement fait ou reçu par l'agence (cachets, clients), dans cet ordre partout
  const TOUS = ['wave', 'orange_money', 'mtn_money', 'moov_money', 'carte', 'virement', 'cheque', 'especes'];
  const esc = (s) => window.echapperHtml(s == null ? '' : s);  // (js/app.js)
  // (js/cachets-communs.js s'il est chargé, sinon enFcfa de js/app.js : pages d'inscription et cours de talons)
  const fcfa = (n) => (window.CachetsMa2m ? window.CachetsMa2m.fcfa(n) : window.enFcfa(n));
  // pages en anglais (cours de talons EN, inscription) : les phrases des consignes en anglais
  const EN = /^en/i.test(document.documentElement.lang || '');
  const T = (fr, en) => (EN ? en : fr);
  const NOMS_EN = { orange_money: 'Orange Money', mtn_money: 'MTN Money', moov_money: 'Moov Money', carte: 'Bank card (Visa)', virement: 'Bank transfer', cheque: 'Cheque', especes: 'Cash' };
  const nom = (code) => (EN && NOMS_EN[code]) || NOMS[code] || code || '';
  const nomCourt = (code) => nom(code).replace(/ \(Visa\)$/, '');
  // Wave et la carte se paient par un lien (« J'ai payé » s'ouvre après le lien) ; les autres par numéro ou RIB
  const parLien = (code) => code === 'wave' || code === 'carte';
  // montant en grand, « F » en petit (cartes premium)
  const grandF = (n) => fcfa(n).replace(/\s?FCFA$/, '') + ' <small>F</small>';
  // la carte façon carte bancaire (css/paiements-premium.css) : o = { etiquette, grand (HTML), sous, bas: [[titre, valeur]] }
  const carte = (o) => '<div class="pp-cb"><div class="pp-cb-tete"><img src="/assets/logo-header.png" alt="" width="86" height="26"><span>' + esc(o.etiquette || '') + '</span></div>' +
    '<div class="pp-cb-grand">' + o.grand + '</div>' + (o.sous ? '<div class="pp-cb-sous">' + esc(o.sous) + '</div>' : '') +
    ((o.bas || []).length ? '<div class="pp-cb-bas">' + o.bas.map((x) => '<div><b>' + esc(x[0]) + '</b>' + esc(x[1]) + '</div>').join('') + '</div>' : '') + '</div>';

  // moyens allumés (Wave seul si la base ne répond pas ou si le fichier n'est pas encore collé)
  async function charger(sb) {
    try {
      const { data, error } = await sb.rpc('moyens_paiement_publics');
      if (error || !Array.isArray(data) || !data.length) throw error || new Error('vide');
      return data.filter((m) => PREPARES.indexOf(m.code) >= 0);
    } catch (e) { return [{ code: 'wave', nom: 'Wave' }]; }
  }

  // (13/11/2026, maquette premium validée) initiales dans la pastille de chaque tuile
  const ABR = { wave: 'W', orange_money: 'OM', mtn_money: 'MTN', moov_money: 'MV', carte: 'CB', virement: 'VB', cheque: 'CH', especes: 'ES' };
  const tuile = (code, libelle, choisi, attrs, bientot) => '<button type="button" data-bouton-libre class="pp-moyen' + (choisi ? ' choisi' : '') + (bientot ? ' bientot' : '') + '" ' + attrs +
    ' aria-pressed="' + !!choisi + '"' + (bientot ? ' disabled' : '') + '><i aria-hidden="true">' + (ABR[code] || '•') + '</i>' + esc(libelle) + '</button>';

  // « Mes paiements » : les moyens allumés en tuiles, puis les autres « bientôt » (estompés) ; cle : le paiement concerné
  // (Wave n'est jamais annoncé « bientôt » : s'il est éteint, c'est un choix de l'agence)
  function choix(moyens, choisi, cle) {
    const allumes = moyens.map((m) => m.code), bientot = PREPARES.filter((c) => c !== 'wave' && allumes.indexOf(c) < 0);
    if (moyens.length < 2 && !bientot.length) return '';
    return '<div class="pp-choix" role="group" aria-label="Moyen de paiement">' +
      moyens.map((m) => tuile(m.code, EN ? nom(m.code) : (m.nom || nom(m.code)), m.code === choisi, 'data-moyen="' + esc(m.code) + '" data-mois="' + esc(cle) + '"')).join('') +
      bientot.map((c) => tuile(c, nomCourt(c) + T(' · bientôt', ' · soon'), false, 'data-bientot="' + c + '"', true)).join('') + '</div>';
  }

  // formulaires de l'agence (encaisser, recette, payer un cachet) : tuiles + champ caché « nom » (codes : TOUS par défaut) ;
  // attrsChamp : attributs du champ caché (ex. data-change pour réagir au choix)
  function tuiles(nomChamp, choisi, attrsChamp, codes) {
    return '<div class="pp-choix" role="group" aria-label="Moyen de paiement" data-pp-champ="' + esc(nomChamp) + '">' +
      '<input type="hidden" name="' + esc(nomChamp) + '" value="' + esc(choisi || '') + '" ' + (attrsChamp || '') + '>' +
      (codes || TOUS).map((c) => tuile(c, nom(c), c === choisi, 'data-pp-moyen="' + c + '"')).join('') + '</div>';
  }
  // un toucher sur une tuile d'un formulaire : elle est choisie, le champ caché prend sa valeur et prévient (change)
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-pp-moyen]');
    const zone = b && b.closest('[data-pp-champ]');
    if (!zone) return;
    zone.querySelectorAll('[data-pp-moyen]').forEach((x) => { x.classList.toggle('choisi', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    const champ = zone.querySelector('input[type=hidden]');
    champ.value = b.getAttribute('data-pp-moyen');
    champ.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // où et comment payer (Wave : seulement la phrase de l'agence, son lien est dans js/mes-paiements.js) ; cle : le
  // paiement concerné (porté par le lien de la carte, pour ouvrir « J'ai payé » ensuite)
  function consigne(m, montant, cle) {
    if (!m) return '';
    const libre = m.consignes ? '<p class="pp-legende">' + esc(m.consignes) + '</p>' : '';
    const copier = (v) => '<div class="pp-num"><span>' + esc(v || '') + '</span><button type="button" data-bouton-libre data-pp-copier="' + esc(v || '') + '">' + T('Copier', 'Copy') + '</button></div>';
    if (MOBILE.indexOf(m.code) >= 0) {
      return '<div class="pp-consigne"><p>' + T('Envoyez ', 'Send ') + '<b>' + fcfa(montant) + '</b>' + T(' par ', ' by ') + esc(EN ? nom(m.code) : (m.nom || nom(m.code))) + T(' au numéro de l’agence', ' to the agency number') +
        (m.titulaire ? T(' (au nom de ', ' (name: ') + esc(m.titulaire) + ')' : '') + ' :</p>' + copier(m.numero) + '</div>' + libre;
    }
    if (m.code === 'carte') {
      return '<a class="btn btn--principal pp-gros" data-bouton-libre data-mp="lien" data-mois="' + esc(cle) + '" href="' + esc(m.lien || '#') + '" target="_blank" rel="noopener">' + T('1 · Payer ', '1 · Pay ') + fcfa(montant) + T(' par carte', ' by card') + '</a>' + libre;
    }
    if (m.code === 'virement') {
      return '<div class="pp-consigne"><p>' + T('Virez ', 'Transfer ') + '<b>' + fcfa(montant) + '</b>' + (m.titulaire ? T(' à ', ' to ') + esc(m.titulaire) : '') + ' :</p>' + copier(m.rib) + '</div>' + libre;
    }
    return libre;
  }
  // « Copier » : le numéro ou le RIB dans le presse-papiers
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-pp-copier]');
    if (!b) return;
    if (!b.dataset.libelle) b.dataset.libelle = b.textContent;  // (un 2e toucher ne garde pas « Copié ✓ » pour toujours)
    const valeur = b.getAttribute('data-pp-copier');
    const fini = (ok) => { b.textContent = ok ? T('Copié ✓', 'Copied ✓') : T('Copiez-le à la main', 'Copy it by hand'); clearTimeout(b._t); b._t = setTimeout(() => { if (b.isConnected) b.textContent = b.dataset.libelle; }, 1800); };
    // (sans presse-papiers moderne, ex. certaines applications : copie à l'ancienne par un champ caché)
    const ancienne = () => { const z = document.createElement('textarea'); z.value = valeur; z.setAttribute('readonly', ''); z.style.position = 'fixed'; z.style.opacity = '0';
      document.body.appendChild(z); z.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (er) { ok = false; } z.remove(); return ok; };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(valeur).then(() => fini(true), () => fini(ancienne()));
    else fini(ancienne());
  });

  window.MoyensPaiement = { NOMS, PREPARES, MOBILE, TOUS, ABR, nom, nomCourt, parLien, grandF, carte, charger, choix, tuiles, consigne };
})();
