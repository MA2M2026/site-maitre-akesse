// « Mes paiements » du mannequin (cahier v2.4, 5.6 et 5.7) : ses 24 mois de formation (vert payé,
// orange en attente de validation, rouge non payé), le paiement du mois avec Wave, puis
// « J'ai payé » — sans capture ni référence. Seule l'agence valide un mois (espace 2).
// Base : mes_mensualites() et mensualite_declarer() (supabase-administration.sql, section 9).
// « Mes cachets reçus » (22/10/2026) : cachets payés par l'agence, avec leur reçu (mes_cachets,
// supabase-cachets-recus.sql ; outils communs window.CachetsMa2m, js/cachets-communs.js).
(function () {
  'use strict';
  const zone = document.getElementById('mp-zone');
  if (!zone) return;
  const LIEN_WAVE = 'https://pay.wave.com/m/M_ci_5eXs19LXWW_D/c/ci/?amount=';
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fcfa = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
  const nomMois = (d) => MOIS[Number(String(d).slice(5, 7)) - 1] + ' ' + String(d).slice(0, 4);
  const ETATS = { paye: ['Payé', 'ok'], attente: ['En attente de validation', 'alerte'], non_paye: ['Non payé', 'erreur'], a_payer: ['À payer avant le 5', 'info'], a_venir: ['À venir', 'neutre'] };
  let donnees = null, waveOuvert = {}, lienWave = null, recus = [], numeros = {}, cachets = [];
  const numeroValide = (n) => /^[0-9+ ]{6,20}$/.test(String(n || '').trim());

  async function charger() {
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return { connexion: true };
    const { data, error } = await sb.rpc('mes_mensualites');
    if (error) throw error;
    if (data && data.inscrit) await complements(data);
    return data;
  }
  // Lien Wave géré dans les Paramètres de l'agence et historique des reçus : si la base ne les
  // fournit pas encore, la page garde le lien de secours et simplement n'affiche pas les reçus.
  async function complements(d) {
    try {
      const r = await sb.rpc('lien_paiement', { p_type: 'mensualite', p_montant: Number(d.mensualite) });
      lienWave = !r.error && typeof r.data === 'string' && /^https:\/\//.test(r.data) ? r.data : null;
    } catch (e) { lienWave = null; }
    try {
      const r = await sb.rpc('mes_recus');
      recus = r.error || !Array.isArray(r.data) ? [] : r.data;
    } catch (e) { recus = []; }
    try {
      const r = await sb.rpc('mes_cachets');
      cachets = r.error || !Array.isArray(r.data) ? [] : r.data;
    } catch (e) { cachets = []; }
  }
  const adresseWave = (montant) => lienWave || (LIEN_WAVE + Number(montant));
  function carteAPayer(m) {
    return '<div class="mp-carte"><div class="mp-ligne"><span><b>Mensualité · ' + esc(nomMois(m.mois)) + '</b></span><b class="mp-montant">' + fcfa(donnees.mensualite) + '</b></div>' +
      '<p class="mp-petit">Moyen de paiement : <b>Wave</b> · Orange Money, MTN Money et Moov Money : bientôt.</p>' +
      '<a class="btn btn--principal" data-mp="wave" data-mois="' + esc(m.mois) + '" href="' + esc(adresseWave(donnees.mensualite)) + '" target="_blank" rel="noopener">1 · Payer avec Wave</a>' +
      '<label class="mp-petit" for="mp-num-' + esc(m.mois) + '">Numéro mobile money qui paie</label>' +
      '<input class="mp-num" id="mp-num-' + esc(m.mois) + '" data-num="' + esc(m.mois) + '" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="+225 07 00 00 00 00" value="' + esc(numeros[m.mois] || '') + '">' +
      '<button class="btn" type="button" data-mp="paye" data-mois="' + esc(m.mois) + '"' + (waveOuvert[m.mois] && numeroValide(numeros[m.mois]) ? '' : ' disabled') + '>2 · J’ai payé</button>' +
      '<p class="mp-petit">Après avoir payé dans Wave, revenez ici, indiquez le numéro qui a payé, puis appuyez sur « J’ai payé ». Pas de capture : l’agence vérifie dans Wave Business.</p>' +
      '<p class="mp-petit">Paiement en espèces ? Remettez-le à l’agence : il apparaîtra ici dès que l’agence l’aura validé.</p></div>';
  }
  function afficher(message) {
    if (!donnees) { zone.innerHTML = '<div class="mp-carte mp-doux">Chargement…</div>'; return; }
    if (donnees.connexion) { zone.innerHTML = '<div class="mp-carte"><h1>Mes paiements</h1><p class="mp-doux">Connectez-vous d’abord à votre espace mannequin.</p><a class="btn btn--principal" href="espace-mannequin.html">Se connecter</a></div>'; return; }
    if (!donnees.inscrit) { zone.innerHTML = '<div class="mp-carte"><h1>Mes paiements</h1><p class="mp-doux">Votre espace n’est pas encore rattaché au registre de l’agence. Contactez l’agence.</p></div>'; return; }
    const mois = donnees.mois || [];
    const ouverts = mois.filter((m) => m.etat === 'a_payer' || m.etat === 'non_paye');
    const courant = mois.find((m) => String(m.mois).slice(0, 7) === new Date().toISOString().slice(0, 7));
    const payes = mois.filter((m) => m.etat === 'paye').length;
    const bandeau = !courant ? '' : courant.etat === 'paye' ? '<div class="mp-bandeau vert">À jour pour ' + esc(nomMois(courant.mois)) + '. Merci !</div>'
      : courant.etat === 'attente' ? '<div class="mp-bandeau bleu">Paiement déclaré : l’agence le vérifie. Vous serez prévenu(e) dès qu’il est confirmé.</div>'
      : courant.etat === 'non_paye' ? '<div class="mp-bandeau rouge">Votre paiement de ' + esc(MOIS[Number(String(courant.mois).slice(5, 7)) - 1]) + ' n’est pas encore fait.</div>'
      : '<div class="mp-bandeau bleu">À payer avant le 5 : ' + fcfa(donnees.mensualite) + '</div>';
    zone.innerHTML = '<div class="mp-tete"><h1>Mes paiements</h1><div class="mp-doux">' + esc(donnees.nom || '') + (donnees.mineur ? ' · mineur : les messages vont au parent' : '') + '</div></div>' +
      (message ? '<div class="mp-bandeau ' + message[1] + '" role="status">' + esc(message[0]) + '</div>' : '') + bandeau +
      ouverts.map(carteAPayer).join('') +
      '<h2>Ma formation · 24 mois</h2><p class="mp-doux">' + payes + ' mois réglé' + (payes > 1 ? 's' : '') + ' sur 24.</p>' +
      '<div class="mp-calendrier" role="list">' + mois.map((m, i) => {
        const e = ETATS[m.etat] || [m.etat, 'neutre'];
        return '<div class="mp-mois ' + e[1] + '" role="listitem"><span class="mp-mois-num">' + (i + 1) + '</span><b>' + esc(nomMois(m.mois)) + '</b><span>' + esc(e[0]) + '</span></div>';
      }).join('') + '</div>' + historique() + mesCachets();
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
  zone.addEventListener('input', (ev) => {
    const c = ev.target.closest('[data-num]');
    if (!c) return;
    numeros[c.getAttribute('data-num')] = c.value;
    const b = zone.querySelector('[data-mp="paye"][data-mois="' + c.getAttribute('data-num') + '"]');
    if (b) b.disabled = !(waveOuvert[c.getAttribute('data-num')] && numeroValide(c.value));
  });
  zone.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-mp]');
    if (!el) return;
    const mois = el.getAttribute('data-mois');
    if (el.getAttribute('data-mp') === 'wave') { waveOuvert[mois] = true; setTimeout(() => afficher(), 300); return; }
    el.disabled = true;
    try {
      let { error } = await sb.rpc('mensualite_declarer_avec_numero', { p_mois: mois, p_numero: String(numeros[mois] || '').trim() });
      if (error && error.code === 'PGRST202') ({ error } = await sb.rpc('mensualite_declarer', { p_mois: mois }));
      if (error) throw error;
      donnees = await charger();
      afficher(['Merci ! L’agence vérifie votre paiement. Vous serez prévenu(e) par e-mail et WhatsApp dès qu’il est confirmé.', 'bleu']);
    } catch (e) {
      afficher([String((e && e.message) || e).replace(/^.*?ERROR:\s*/, '') || 'Connexion impossible. Réessayez.', 'rouge']);
    }
  });
  afficher();
  charger().then((d) => { donnees = d; afficher(); }, (e) => { donnees = { inscrit: false }; afficher([String((e && e.message) || 'Connexion impossible. Réessayez.'), 'rouge']); });
})();
