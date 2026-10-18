// « Mes paiements » (cahier v2.3, sections 7.2, 7.6 et 15) : le mannequin (ou son parent) voit ce
// qu'il doit, paie avec le lien Wave Business, appuie sur « J'ai payé » (sans capture ni référence),
// suit ses reçus. Deux façons d'arriver ici, même écran :
//  - mes-paiements.html : mannequin connectée à son espace (fonction mannequin_mes_paiements) ;
//  - paiement/?t=… : lien personnel sans compte (api/portail.js, actions lien_lire et lien_declarer).
(function () {
  'use strict';
  const zone = document.getElementById('mp-zone');
  if (!zone) return;
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fcfa = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
  const nomMois = (d) => MOIS[Number(String(d).slice(5, 7)) - 1] + ' ' + String(d).slice(0, 4);
  const STATUT = { a_payer: ['À payer', 'info'], declare: ['Paiement déclaré', 'alerte'], payee: ['Payée', 'ok'], refusee: ['Non retrouvé', 'alerte'],
    non_paye: ['Non payé', 'erreur'], exoneree: ['Exonérée', 'neutre'] };
  const jeton = new URLSearchParams(location.search).get('t');
  const parLien = document.body.hasAttribute('data-lien-personnel');
  let donnees = null, waveOuvert = {};

  async function serveur(action, extra) {
    const rep = await fetch('/api/portail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action, t: jeton }, extra || {})) });
    if (rep.status === 429) throw new Error('Trop d’essais. Réessayez plus tard ou contactez l’agence.');
    const r = await rep.json().catch(() => ({}));
    if (!rep.ok) throw new Error(r.error || 'Erreur serveur.');
    return r;
  }
  async function charger() {
    if (parLien) {
      const r = jeton ? await serveur('lien_lire') : { ok: false };
      if (!r.ok) return { invalide: true };
      return { inscrit: true, prenom: r.prenom, telephone: r.numero, jour_limite: null, notifications: [],
        echeances: [{ id: 'lien', type: r.type, mois: r.mois, montant_du: r.montant, montant_paye: 0, statut: r.statut, lien_wave: r.lien_wave, recus: [] }] };
    }
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return { connexion: true };
    const { data, error } = await sb.rpc('mannequin_mes_paiements');
    if (error) throw error;
    return data;
  }

  function bandeau(e, jourLimite) {
    if (!e) return '';
    if (e.statut === 'payee') return '<div class="mp-bandeau vert">À jour pour ' + esc(nomMois(e.mois)) + '. Merci !</div>';
    if (e.statut === 'declare') return '<div class="mp-bandeau bleu">Paiement déclaré. L’agence le vérifie dans Wave Business : vous serez prévenu(e) dès qu’il est confirmé.</div>';
    if (e.statut === 'non_paye') return '<div class="mp-bandeau rouge">Votre paiement de ' + esc(MOIS[Number(String(e.mois).slice(5, 7)) - 1]) + ' n’est pas encore fait.</div>';
    if (e.statut === 'refusee') return '<div class="mp-bandeau rouge">Paiement non retrouvé. Réessayez ou contactez l’agence.' + (e.motif ? ' (' + esc(e.motif) + ')' : '') + '</div>';
    return '<div class="mp-bandeau bleu">À payer' + (jourLimite ? ' avant le ' + jourLimite : '') + ' : ' + fcfa(e.montant_du - e.montant_paye) + '</div>';
  }
  function carteAPayer(e) {
    const reste = e.montant_du - e.montant_paye;
    return '<div class="mp-carte"><div class="mp-ligne"><span class="mp-doux"><b>' + (e.type === 'inscription' ? 'Inscription + 1er mois' : 'Droit de formation · ' + esc(nomMois(e.mois))) + '</b></span><b class="mp-montant">' + fcfa(reste) + '</b></div>' +
      '<div class="form-champ"><label for="mp-num-' + esc(e.id) + '">Numéro Wave qui paie</label><input id="mp-num-' + esc(e.id) + '" type="tel" inputmode="tel" value="' + esc(donnees.telephone || '') + '"></div>' +
      (e.lien_wave ? '<a class="btn btn--principal" data-mp="wave" data-id="' + esc(e.id) + '" href="' + esc(e.lien_wave) + '" target="_blank" rel="noopener">1 · Payer avec Wave</a>'
        : '<div class="mp-bandeau bleu">Le lien de paiement de ce montant n’est pas encore prêt : contactez l’agence.</div>') +
      '<button class="btn" data-mp="paye" data-id="' + esc(e.id) + '"' + (waveOuvert[e.id] ? '' : ' disabled') + '>2 · J’ai payé</button>' +
      '<p class="mp-petit">Aucune référence à saisir, aucune capture obligatoire : l’agence vérifie votre paiement dans Wave Business.</p>' +
      (!parLien ? '<details><summary class="mp-petit">Joindre une capture (facultatif, si l’agence la demande)</summary><input type="file" accept="image/*,application/pdf" data-mp="capture" data-id="' + esc(e.id) + '" aria-label="Capture du reçu Wave"></details>' : '') +
      '</div>';
  }
  function afficher(message) {
    if (!donnees) { zone.innerHTML = '<div class="mp-carte mp-doux">Chargement…</div>'; return; }
    if (donnees.invalide) { zone.innerHTML = '<div class="mp-carte"><h1>Lien expiré ou invalide</h1><p class="mp-doux">Ce lien de paiement n’est plus valable. Demandez un nouveau lien à l’agence.</p></div>'; return; }
    if (donnees.connexion) { zone.innerHTML = '<div class="mp-carte"><h1>Mes paiements</h1><p class="mp-doux">Connectez-vous d’abord à votre espace mannequin.</p><a class="btn btn--principal" href="espace-mannequin.html">Se connecter</a></div>'; return; }
    if (!donnees.inscrit) { zone.innerHTML = '<div class="mp-carte"><h1>Mes paiements</h1><p class="mp-doux">Aucun paiement à suivre pour le moment. Si vous êtes membre de l’agence, vérifiez que votre téléphone et votre e-mail sont les mêmes que ceux donnés à l’agence, ou contactez-la.</p></div>'; return; }
    const ech = donnees.echeances || [];
    const ouverte = ech.find((e) => ['a_payer', 'refusee', 'non_paye'].includes(e.statut));
    const courante = ouverte || ech[0];
    zone.innerHTML = '<div class="mp-tete"><h1>Mes paiements</h1><div class="mp-doux">' + esc(donnees.prenom || '') +
      (donnees.mineur ? ' · mineur : les messages vont au parent' : '') + (parLien ? ' · accès par lien personnel, sans compte' : '') + '</div></div>' +
      (message ? '<div class="mp-bandeau ' + message[1] + '" role="status">' + esc(message[0]) + '</div>' : '') +
      bandeau(courante, donnees.jour_limite) +
      ech.filter((e) => ['a_payer', 'refusee', 'non_paye'].includes(e.statut)).map(carteAPayer).join('') +
      (parLien && donnees.echeances[0].statut === 'payee' ? '' : '') +
      ((donnees.notifications || []).length ? '<h2>Notifications</h2>' + donnees.notifications.map((n) => '<div class="mp-carte mp-notif"><div class="mp-petit">' + new Date(n.le).toLocaleDateString('fr-FR') + '</div>' + esc(n.texte) + '</div>').join('') : '') +
      (!parLien ? '<h2>Historique</h2>' + (ech.length ? ech.map((e) => '<div class="mp-ligne mp-histo"><div><b>' + esc(nomMois(e.mois)) + '</b><div class="mp-petit">' + (e.type === 'inscription' ? 'Inscription + 1er mois' : 'Mensualité') + ' · ' + fcfa(e.montant_du) + '</div>' +
        (e.recus || []).map((r, i) => '<button class="mp-lien" data-mp="recu" data-id="' + esc(e.id) + '" data-i="' + i + '">Reçu ' + esc(r.numero) + '</button>').join(' ') + '</div>' +
        '<span class="mp-pastille ' + (STATUT[e.statut] || ['', 'neutre'])[1] + '">' + esc((STATUT[e.statut] || [e.statut])[0]) + '</span></div>').join('') : '<p class="mp-doux">Aucune échéance pour le moment.</p>') : '');
  }

  zone.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-mp]');
    if (!el) return;
    const action = el.getAttribute('data-mp'), id = el.getAttribute('data-id');
    if (action === 'wave') { waveOuvert[id] = true; setTimeout(() => afficher(), 300); return; }
    if (action === 'recu') {
      const e = donnees.echeances.find((x) => x.id === id), r = e.recus[Number(el.getAttribute('data-i'))];
      window.MA2M_RECU({ montant: r.montant, mode: r.mode, paye_par: r.paye_par, recu: { numero: r.numero, emis_le: r.emis_le }, echeance: { type: e.type, mois: e.mois, mannequin: { nom: donnees.nom || donnees.prenom } } });
      return;
    }
    if (action === 'paye') {
      el.disabled = true;
      const numero = (document.getElementById('mp-num-' + id) || {}).value || '';
      try {
        if (parLien) {
          const r = await serveur('lien_declarer', { numero });
          if (!r.ok) throw new Error('Lien expiré : demandez un nouveau lien à l’agence.');
        } else {
          const { error } = await sb.rpc('mannequin_declarer_paiement', { p_echeance: id, p_numero: numero });
          if (error) throw error;
        }
        donnees = await charger();
        afficher(['L’agence vérifie votre paiement. Vous serez prévenu(e) par SMS et e-mail dès qu’il est confirmé.', 'bleu']);
      } catch (e) {
        afficher([String(e.message || e).replace(/^.*?ERROR:\s*/, '') || 'Connexion impossible. Réessayez.', 'rouge']);
      }
    }
  });
  // capture facultative : stockage privé, nom de fichier régénéré, empreinte pour repérer une capture réutilisée
  zone.addEventListener('change', async (ev) => {
    const el = ev.target.closest('[data-mp="capture"]');
    if (!el || !el.files || !el.files[0]) return;
    let fichier = el.files[0];
    try {
      if (typeof convertirSiHeic === 'function') fichier = await convertirSiHeic(fichier);
      if (fichier.size > 5 * 1024 * 1024) throw new Error('Fichier trop lourd (5 Mo au plus).');
      const type = fichier.type === 'application/pdf' ? 'pdf' : fichier.type === 'image/png' ? 'png' : fichier.type === 'image/webp' ? 'webp' : 'jpg';
      const empreinte = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await fichier.arrayBuffer())), (o) => o.toString(16).padStart(2, '0')).join('');
      const chemin = el.getAttribute('data-id') + '/' + crypto.randomUUID() + '.' + type;
      const envoi = await sb.storage.from('preuves-paiement').upload(chemin, fichier, { contentType: fichier.type || 'image/jpeg' });
      if (envoi.error) throw envoi.error;
      const { error } = await sb.rpc('mannequin_joindre_preuve', { p_echeance: el.getAttribute('data-id'), p_chemin: chemin, p_empreinte: empreinte });
      if (error) throw error;
      donnees = await charger();
      afficher(['Capture envoyée. L’agence va vérifier et valider.', 'bleu']);
    } catch (e) {
      afficher([String(e.message || e) || 'Envoi impossible.', 'rouge']);
    }
  });

  afficher();
  charger().then((d) => { donnees = d; afficher(); })
    .catch((e) => { donnees = { connexion: false, inscrit: false }; afficher([String(e.message || 'Connexion impossible. Réessayez.'), 'rouge']); });
})();
