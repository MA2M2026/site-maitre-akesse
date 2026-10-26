// Page « Reçu de paiement » d'un cachet (recu.html, 22/10/2026) : le lien personnel (?r=jeton) envoyé
// sur WhatsApp, ou ouvert depuis l'Espace mannequin, montre le reçu sans compte (fonction
// cachet_recu_lire : seulement un cachet payé, et seulement ce qu'un reçu montre).
// Outils communs : window.CachetsMa2m (js/cachets-communs.js).
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var K = window.CachetsMa2m;
  var jeton = new URLSearchParams(location.search).get('r') || '';
  function introuvable() { $('rc-etat').textContent = 'Ce reçu est introuvable : vérifiez le lien, ou contactez l’agence sur WhatsApp (+225 05 45 65 66 87).'; }
  if (!/^[0-9a-f-]{36}$/.test(jeton) || typeof SUPABASE_URL === 'undefined' || !K) { introuvable(); return; }
  fetch(SUPABASE_URL + '/rest/v1/rpc/cachet_recu_lire', {
    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_jeton: jeton })
  }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (lignes) {
    var c = lignes && lignes[0];
    if (!c) { introuvable(); return; }
    $('rc-numero').textContent = c.numero || '—';
    $('rc-etat').textContent = 'Paiement effectué ✓';
    $('rc-qui').textContent = c.beneficiaire;
    $('rc-quoi').textContent = c.prestation || K.libelle(c.motif);
    $('rc-date').textContent = K.jour(c.paye_le);
    if (c.reference_wave) { $('rc-ref').textContent = c.reference_wave; $('rc-ref-ligne').hidden = false; }
    $('rc-montant').textContent = K.fcfa(c.montant);
    ['rc-lignes', 'rc-montant-bloc', 'rc-merci', 'rc-actions'].forEach(function (id) { $(id).hidden = false; });
    document.title = 'Reçu ' + (c.numero || '') + ' · Maître Akesse Model Management';
  }).catch(function () { $('rc-etat').textContent = 'Connexion impossible pour le moment. Réessayez dans un instant.'; });
  $('rc-imprimer').addEventListener('click', function () { window.print(); });
})();
