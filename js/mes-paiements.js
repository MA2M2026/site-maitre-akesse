// « Mes paiements » du mannequin (cahier v2.4, 5.6 et 5.7) : ses 18 mois de cours (01/11/2026 : décembre,
// janvier et février sont des congés sans mensualité, en gris ; vert payé, orange en attente de validation, rouge non payé), le paiement du mois avec Wave, puis
// « J'ai payé » — sans capture ni référence. Seule l'agence valide un mois (espace 2).
// Base : mes_mensualites() et mensualite_declarer() (supabase-administration.sql, section 9).
// « Mes cachets reçus » (22/10/2026) : cachets payés par l'agence, avec leur reçu (mes_cachets,
// supabase-cachets-recus.sql ; outils communs window.CachetsMa2m, js/cachets-communs.js).
// Paiement à l'avance (26/10/2026, décision de la propriétaire : jusqu'à 3 mois, même prix) : quand
// rien n'est à payer, 1 à 3 mois suivants (moisPayablesAvance, js/app.js) en un seul paiement Wave,
// puis « J'ai payé » les déclare tous ensemble, tout ou rien (mensualites_payer_avance,
// supabase-paiement-avance.sql : une seule ligne au montant total à vérifier pour l'agence).
// (11/11/2026, demande de la propriétaire) le même programme sert aussi dans l'application (js/mannequin-app.js) :
// « Payer avec Wave » et « Payer à l'avance » s'ouvrent dans un volet de la nouvelle page Paiements, sans
// changer de page — window.PaiementMa2m.monter(zone, { mode: 'payer' | 'recus', surDeclare }).
(function () {
  'use strict';
  const LIEN_WAVE = LIEN_WAVE_AGENCE;  // (js/app.js)
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fcfa = window.CachetsMa2m.fcfa;  // (js/cachets-communs.js, chargé avant)
  const nomMois = (d) => MOIS[Number(String(d).slice(5, 7)) - 1] + ' ' + String(d).slice(0, 4);
  const ETATS = { paye: ['Payé', 'ok'], attente: ['En attente de validation', 'alerte'], non_paye: ['Non payé', 'erreur'], a_payer: ['À payer avant le 5', 'info'], a_venir: ['À venir', 'neutre'], conge: ['Congés : pas de mensualité', 'conge'], termine: ['Formation terminée', 'neutre'], rodage: ['Rodage : rien à payer', 'neutre'] };
  const numeroValide = (n) => /^[0-9+ ]{6,20}$/.test(String(n || '').trim());
  // mode : 'page' (cette page entière), 'payer' (seulement les paiements à faire) ou 'recus' (reçus et cachets)
  function monter(zone, options) {
  const mode = (options && options.mode) || 'page', surDeclare = (options && options.surDeclare) || null;
  let donnees = null, waveOuvert = {}, liensWave = {}, recus = [], numeros = {}, cachets = [], nbAvance = 1;
  // (12/11/2026) moyens de paiement allumés par l'agence (js/moyens-paiement.js) et moyen choisi pour chaque paiement
  const MP = window.MoyensPaiement;
  let moyens = [{ code: 'wave', nom: 'Wave' }], moyenChoisi = {};
  const moyenDe = (cle) => moyens.find((m) => m.code === moyenChoisi[cle]) || moyens[0];

  async function charger() {
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return { connexion: true };
    // (10/11/2026) mot de passe provisoire donné par l'agence : le choisir d'abord (js/supabase-config.js)
    if (allerChoisirMdpSiProvisoire(s.session.user)) return new Promise(() => {});
    const { data, error } = await sb.rpc('mes_mensualites');
    if (error) throw error;
    if (data && data.inscrit) await complements(data);
    return data;
  }
  // Lien Wave géré dans les Paramètres de l'agence et historique des reçus : si la base ne les
  // fournit pas encore, la page garde le lien de secours et simplement n'affiche pas les reçus.
  async function complements(d) {
    // (les trois en même temps : une connexion lente n'attend qu'une fois)
    // (liens Wave du montant d'un mois, et de 2 et 3 mois si le paiement à l'avance est proposé)
    const montants = Array.from({ length: Math.max(1, moisPayablesAvance(d.mois).length) }, (_, i) => (i + 1) * Number(d.mensualite));
    if (MP) MP.charger(sb).then((l) => { moyens = l; if (donnees) afficher(); });
    const [mesRecus, mesCachets, ...liens] = await Promise.allSettled([sb.rpc('mes_recus'), sb.rpc('mes_cachets')]
      .concat(montants.map((m) => sb.rpc('lien_paiement', { p_type: 'mensualite', p_montant: m }))));
    const donneesDe = (x) => (x.status === 'fulfilled' && !x.value.error ? x.value.data : null);
    liensWave = {};
    liens.forEach((l, i) => { if (typeof donneesDe(l) === 'string' && /^https:\/\//.test(donneesDe(l))) liensWave[montants[i]] = donneesDe(l); });
    recus = Array.isArray(donneesDe(mesRecus)) ? donneesDe(mesRecus) : [];
    cachets = Array.isArray(donneesDe(mesCachets)) ? donneesDe(mesCachets) : [];
  }
  // lien Wave des Paramètres de l'agence pour ce montant, sinon le lien de secours au bon montant
  const adresseWave = (montant) => liensWave[Number(montant)] || (LIEN_WAVE + Number(montant));
  // Moyen choisi, où payer, numéro du payeur, « J'ai payé » (cle : le mois, ou « avance » pour plusieurs mois).
  // Wave et carte : on passe d'abord par le lien ; Orange, MTN, Moov et virement : le numéro ou le RIB est affiché.
  const parLien = (code) => code === 'wave' || code === 'carte';
  const peutDeclarer = (cle) => (!parLien(moyenDe(cle).code) || waveOuvert[cle]) && numeroValide(numeros[cle]);
  function blocPaiement(cle, montant) {
    const m = moyenDe(cle), code = m.code, mobile = code === 'wave' || (MP && MP.MOBILE.indexOf(code) >= 0);
    const ou = code === 'wave' ? '<a class="btn btn--principal" data-mp="wave" data-mois="' + esc(cle) + '" href="' + esc(adresseWave(montant)) + '" target="_blank" rel="noopener">1 · Payer avec Wave</a>'
      : MP ? MP.consigne(m, montant).replace('data-mp="lien"', 'data-mp="lien" data-mois="' + esc(cle) + '"') : '';
    const apres = code === 'wave' ? 'Après avoir payé dans Wave, revenez ici, indiquez le numéro qui a payé, puis appuyez sur « J’ai payé ». Pas de capture : l’agence vérifie dans Wave Business.'
      : 'Après avoir payé, revenez ici, indiquez ' + (mobile ? 'le numéro qui a payé' : 'votre numéro de téléphone') + ', puis appuyez sur « J’ai payé ». L’agence vérifie la réception avant de valider.';
    return (MP ? MP.choix(moyens, code, cle) : '<p class="mp-petit">Moyen de paiement : <b>Wave</b></p>') + ou +
      '<label class="mp-petit" for="mp-num-' + esc(cle) + '">' + (mobile ? 'Numéro mobile money qui paie' : 'Votre numéro de téléphone') + '</label>' +
      '<input class="mp-num" id="mp-num-' + esc(cle) + '" data-num="' + esc(cle) + '" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="+225 07 00 00 00 00" value="' + esc(numeros[cle] || '') + '">' +
      '<button class="btn" type="button" data-mp="paye" data-mois="' + esc(cle) + '"' + (peutDeclarer(cle) ? '' : ' disabled') + '>' + (parLien(code) ? '2 · ' : '') + 'J’ai payé</button>' +
      '<p class="mp-petit">' + apres + '</p>' +
      '<p class="mp-petit">Paiement en espèces ? Remettez-le à l’agence : il apparaîtra ici dès que l’agence l’aura validé.</p>';
  }
  function carteAPayer(m) {
    return '<div class="mp-carte"><div class="mp-ligne"><span><b>Mensualité · ' + esc(nomMois(m.mois)) + '</b></span><b class="mp-montant">' + fcfa(donnees.mensualite) + '</b></div>' +
      blocPaiement(m.mois, donnees.mensualite) + '</div>';
  }
  function carteAvance(liste) {
    nbAvance = Math.min(Math.max(1, nbAvance), liste.length);
    const choisis = liste.slice(0, nbAvance), total = nbAvance * Number(donnees.mensualite);
    return '<div class="mp-carte" id="avance"><div class="mp-ligne"><span><b>Payer à l’avance</b></span><b class="mp-montant">' + fcfa(total) + '</b></div>' +
      '<p class="mp-petit">Jusqu’à ' + MA2M_AVANCE_MAX + ' mois à l’avance, au même prix, en un seul paiement.</p>' +
      '<label class="mp-petit" for="mp-avance-nb">Nombre de mois</label>' +
      '<select class="mp-num" id="mp-avance-nb" data-avance-nb>' + liste.map((m, i) => '<option value="' + (i + 1) + '"' + (i + 1 === nbAvance ? ' selected' : '') + '>' + (i + 1) + ' mois · ' + fcfa((i + 1) * Number(donnees.mensualite)) + '</option>').join('') + '</select>' +
      '<p class="mp-petit">Mois payés : <b>' + esc(choisis.map((m) => nomMois(m.mois)).join(', ')) + '</b></p>' +
      blocPaiement('avance', total) + '</div>';
  }
  function afficher(message) {
    if (!donnees) { zone.innerHTML = '<div class="mp-carte mp-doux">Chargement…</div>'; return; }
    if (donnees.connexion) { zone.innerHTML = '<div class="mp-carte"><h1>Mes paiements</h1><p class="mp-doux">Connectez-vous d’abord à votre espace mannequin.</p><a class="btn btn--principal" href="espace-mannequin.html">Se connecter</a></div>'; return; }
    if (!donnees.inscrit) { zone.innerHTML = '<div class="mp-carte"><h1>Mes paiements</h1><p class="mp-doux">Votre espace n’est pas encore rattaché au registre de l’agence. Contactez l’agence.</p></div>'; return; }
    const mois = donnees.mois || [];
    const ouverts = mois.filter((m) => m.etat === 'a_payer' || m.etat === 'non_paye');
    const courant = mois.find((m) => String(m.mois).slice(0, 7) === new Date().toISOString().slice(0, 7));
    const bandeauMessage = message ? '<div class="mp-bandeau ' + message[1] + '" role="status">' + esc(message[0]) + '</div>' : '';
    if (mode === 'payer') {
      const avance = moisPayablesAvance(mois);  // (js/app.js)
      zone.innerHTML = bandeauMessage + ouverts.map(carteAPayer).join('') + (avance.length ? carteAvance(avance) : '') +
        (ouverts.length || avance.length || message ? '' : '<div class="mp-carte mp-doux">Rien à payer pour le moment.</div>');
      return;
    }
    if (mode === 'recus') { zone.innerHTML = historique() + mesCachets() || '<div class="mp-carte mp-doux">Aucun reçu pour le moment.</div>'; return; }
    const { payes, total } = bilanFormation(donnees);  // (js/app.js)
    const situation = situationFormation(donnees);  // (js/app.js : niveau, mois X sur 9, agence fermée)
    const bandeau = !courant ? '' : courant.etat === 'paye' ? '<div class="mp-bandeau vert">À jour pour ' + esc(nomMois(courant.mois)) + '. Merci !</div>'
      : courant.etat === 'attente' ? '<div class="mp-bandeau bleu">Paiement déclaré : l’agence le vérifie. Vous serez prévenu(e) dès qu’il est confirmé.</div>'
      : courant.etat === 'rodage' || (situation && situation.ferme && courant.etat !== 'conge') ? '<div class="mp-bandeau vert">' + esc(situation ? situation.lignes[0] : 'Rien à payer ce mois-ci.') + '</div>'
      : courant.etat === 'conge' ? '<div class="mp-bandeau vert">Congés : pas de mensualité en ' + esc(MOIS[Number(String(courant.mois).slice(5, 7)) - 1]) + '.</div>'
      : courant.etat === 'non_paye' ? '<div class="mp-bandeau rouge">Votre paiement de ' + esc(MOIS[Number(String(courant.mois).slice(5, 7)) - 1]) + ' n’est pas encore fait.</div>'
      : '<div class="mp-bandeau bleu">À payer avant le 5 : ' + fcfa(donnees.mensualite) + '</div>';
    zone.innerHTML = '<div class="mp-tete"><h1>Mes paiements</h1><div class="mp-doux">' + esc(donnees.nom || '') + (donnees.mineur ? ' · mineur : les messages vont au parent' : '') + '</div></div>' +
      bandeauMessage + bandeau +
      ouverts.map(carteAPayer).join('') +
      (moisPayablesAvance(mois).length ? carteAvance(moisPayablesAvance(mois)) : '') +
      // (« agence fermée » est déjà dans le bandeau du haut : pas répété ici)
      (situation ? '<h2>Ma formation · ' + esc(situation.titre) + '</h2><p class="mp-doux">' + situation.lignes.slice(situation.ferme && courant ? 1 : 0).map(esc).join('<br>') + '</p>'
        : '<h2>Ma formation · ' + total + ' mois de cours</h2><p class="mp-doux">' + payes + ' mois réglé' + (payes > 1 ? 's' : '') + ' sur ' + total + '. Décembre, janvier et février sont des congés : pas de mensualité.</p>') +
      '<div class="mp-calendrier" role="list">' + numeroter(mois).map(([m, n]) => {
        const conge = m.conge || m.etat === 'conge';
        const e = conge && m.etat === 'paye' ? ['Payé · compte pour le mois de cours suivant', 'ok'] : conge ? ETATS.conge : ETATS[m.etat] || [m.etat, 'neutre'];
        return '<div class="mp-mois ' + e[1] + '" role="listitem">' + (n ? '<span class="mp-mois-num">' + n + '</span>' : '') + '<b>' + esc(nomMois(m.mois)) + '</b><span>' + esc(e[0]) + '</span></div>';
      }).join('') + '</div>' + historique() + mesCachets();
  }
  // numéro de chaque mois de cours (1 à 18) ; les congés et le rodage n'ont pas de numéro ; à la reprise, la
  // numérotation suit les mois déjà faits avant (faits_avant, supabase-reprise-mars.sql)
  function numeroter(mois) {
    let n = Number(donnees.faits_avant) || 0;
    return mois.map((m) => [m, m.conge || m.etat === 'conge' || m.etat === 'rodage' ? 0 : ++n]);
  }
  function historique() {
    if (!recus.length) return '';
    return '<h2>Mes paiements validés</h2>' + '<div class="mp-carte">' + recus.map((r) =>
      '<div class="mp-histo mp-ligne"><span><b>' + esc(r.objet === 'inscription' ? 'Inscription' : r.mois ? nomMois(r.mois) : 'Mensualité') + '</b><br><span class="mp-petit">' +
      esc(r.montant ? fcfa(r.montant) : 'Avant le nouveau système') + '</span></span>' +
      '<span class="mp-petit">' + (r.numero ? 'Reçu ' + esc(r.numero) : '—') + '</span></div>').join('') + '</div>';
  }
  function mesCachets() {
    const K = window.CachetsMa2m;
    if (!cachets.length || !K) return '';
    return '<h2>Mes cachets reçus</h2><div class="mp-carte">' + cachets.map((c) =>
      '<div class="mp-histo mp-ligne"><span><b>' + esc(c.prestation || K.libelle(c.motif)) + '</b><br><span class="mp-petit">Payé le ' + esc(K.jour(c.paye_le)) + (c.numero ? ' · reçu ' + esc(c.numero) : '') + '</span></span>' +
      '<span class="mp-cachet"><b class="mp-montant">' + fcfa(c.montant) + '</b><br><a class="mp-petit" href="' + esc(K.lienRecu(c.jeton)) + '" target="_blank" rel="noopener">Voir le reçu</a></span></div>').join('') + '</div>';
  }
  zone.addEventListener('change', (ev) => {
    if (!ev.target.matches('[data-avance-nb]')) return;
    nbAvance = Number(ev.target.value) || 1;
    waveOuvert.avance = false;  // nouveau montant : repasser par Wave
    afficher();
  });
  zone.addEventListener('input', (ev) => {
    const c = ev.target.closest('[data-num]');
    if (!c) return;
    numeros[c.getAttribute('data-num')] = c.value;
    const b = zone.querySelector('[data-mp="paye"][data-mois="' + c.getAttribute('data-num') + '"]');
    if (b) b.disabled = !peutDeclarer(c.getAttribute('data-num'));
  });
  zone.addEventListener('click', async (ev) => {
    const choixMoyen = ev.target.closest('[data-moyen]');
    if (choixMoyen) { moyenChoisi[choixMoyen.getAttribute('data-mois')] = choixMoyen.getAttribute('data-moyen'); waveOuvert[choixMoyen.getAttribute('data-mois')] = false; afficher(); return; }
    const el = ev.target.closest('[data-mp]');
    if (!el) return;
    const mois = el.getAttribute('data-mois');
    if (el.getAttribute('data-mp') === 'wave' || el.getAttribute('data-mp') === 'lien') { waveOuvert[mois] = true; setTimeout(() => afficher(), 300); return; }
    el.disabled = true;
    const numero = String(numeros[mois] || '').trim();
    try {
      let error;
      // à l'avance : tous les mois choisis en une fois, tout ou rien (un seul paiement Wave)
      if (mois === 'avance') ({ error } = await sb.rpc('mensualites_payer_avance', { p_nb: nbAvance, p_numero: numero }));
      else {
        ({ error } = await sb.rpc('mensualite_declarer_avec_numero', { p_mois: mois, p_numero: numero }));
        if (error && error.code === 'PGRST202') ({ error } = await sb.rpc('mensualite_declarer', { p_mois: mois }));
      }
      if (error) throw error;
      // moyen autre que Wave : noté sur le(s) paiement(s) qui vienne(nt) d'être déclaré(s) (sans bloquer si la base ne le sait pas encore)
      const moyen = moyenDe(mois).code;
      if (moyen !== 'wave') { try { await sb.rpc('paiements_preciser_moyen', { p_moyen: moyen }); } catch (e) { /* noté Wave : l'agence corrige au besoin */ } }
      const nb = mois === 'avance' ? nbAvance : 1;
      donnees = await charger();
      waveOuvert = {}; moyenChoisi = {}; nbAvance = 1;
      if (surDeclare) surDeclare();
      afficher(['Merci ! L’agence vérifie votre paiement' + (nb > 1 ? ' (' + nb + ' mois)' : '') + '. Vous serez prévenu(e) par e-mail et WhatsApp dès qu’il est confirmé.', 'bleu']);
    } catch (e) {
      afficher([String((e && e.message) || e).replace(/^.*?ERROR:\s*/, '') || 'Connexion impossible. Réessayez.', 'rouge']);
    }
  });
  afficher();
  // (« Payer à l'avance » de l'application : /app/mes-paiements.html#avance, la carte est dessinée après le chargement)
  const versAvance = () => { const c = location.hash === '#avance' && document.getElementById('avance'); if (c) c.scrollIntoView({ block: 'start' }); };
  charger().then((d) => { donnees = d; afficher(); versAvance(); }, (e) => { donnees = { inscrit: false }; afficher([String((e && e.message) || 'Connexion impossible. Réessayez.'), 'rouge']); });
  }
  window.PaiementMa2m = { monter };
  const zonePage = document.getElementById('mp-zone');
  if (zonePage) monter(zonePage);
})();
