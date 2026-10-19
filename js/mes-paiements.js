// « Mes paiements » du mannequin (cahier v2.4, 5.6 et 5.7) : ses 24 mois de formation (vert payé,
// orange en attente de validation, rouge non payé), le paiement du mois avec Wave, puis
// « J'ai payé » — sans capture ni référence. Seule l'agence valide un mois (espace 2).
// Base : mes_mensualites() et mensualite_declarer() (supabase-administration.sql, section 9).
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
  let donnees = null, waveOuvert = {};

  async function charger() {
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return { connexion: true };
    const { data, error } = await sb.rpc('mes_mensualites');
    if (error) throw error;
    return data;
  }
  function carteAPayer(m) {
    return '<div class="mp-carte"><div class="mp-ligne"><span><b>Mensualité · ' + esc(nomMois(m.mois)) + '</b></span><b class="mp-montant">' + fcfa(donnees.mensualite) + '</b></div>' +
      '<a class="btn btn--principal" data-mp="wave" data-mois="' + esc(m.mois) + '" href="' + LIEN_WAVE + Number(donnees.mensualite) + '" target="_blank" rel="noopener">1 · Payer avec Wave</a>' +
      '<button class="btn" type="button" data-mp="paye" data-mois="' + esc(m.mois) + '"' + (waveOuvert[m.mois] ? '' : ' disabled') + '>2 · J’ai payé</button>' +
      '<p class="mp-petit">Après avoir payé dans Wave, revenez ici et appuyez sur « J’ai payé ». Pas de capture, pas de référence : l’agence vérifie dans Wave Business.</p></div>';
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
      }).join('') + '</div>';
  }
  zone.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-mp]');
    if (!el) return;
    const mois = el.getAttribute('data-mois');
    if (el.getAttribute('data-mp') === 'wave') { waveOuvert[mois] = true; setTimeout(() => afficher(), 300); return; }
    el.disabled = true;
    try {
      const { error } = await sb.rpc('mensualite_declarer', { p_mois: mois });
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
