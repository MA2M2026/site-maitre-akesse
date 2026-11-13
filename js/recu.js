// Page « Reçu de paiement » d'un cachet (recu.html, 22/10/2026 ; reçu officiel détaillé le 13/11/2026, demande de la
// propriétaire : il sert de preuve — qui, quoi, quand, de quelle heure à quelle heure, où, avec quel partenaire, pour le
// compte de l'agence, cachet total, commission, impôts, frais, net versé, moyen et référence). Le lien personnel
// (?r=jeton) envoyé sur WhatsApp, ou ouvert depuis l'Espace mannequin, montre le reçu sans compte (cachet_recu_lire :
// seulement un cachet payé). Outils communs : window.CachetsMa2m (js/cachets-communs.js), noms des moyens :
// window.MoyensPaiement (js/moyens-paiement.js).
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var K = window.CachetsMa2m;
  var jeton = new URLSearchParams(location.search).get('r') || '';
  function introuvable() { $('rc-etat').textContent = 'Ce reçu est introuvable : vérifiez le lien, ou contactez l’agence sur WhatsApp (+225 05 45 65 66 87).'; }
  // une ligne « intitulé · valeur » (texte seulement : rien de la base n'est lu comme du HTML) ; vide = pas de ligne
  function ligne(dl, titre, valeur, classe) {
    if (valeur === null || valeur === undefined || valeur === '') return;
    var d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
    if (classe) d.className = classe;
    dt.textContent = titre; dd.textContent = valeur; d.appendChild(dt); d.appendChild(dd); dl.appendChild(d);
  }
  var heure = function (h) { return h ? String(h).slice(0, 5).replace(':', ' h ') : ''; };
  var jourSeul = function (d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''; };
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
    var p = $('rc-prestation'), d = $('rc-detail'), v = $('rc-paiement');
    ligne(p, 'Mannequin', c.beneficiaire);
    if (c.parent_nom) ligne(p, 'Versé au parent', c.parent_nom);
    ligne(p, 'Prestation', c.prestation || K.libelle(c.motif));
    ligne(p, 'Date', jourSeul(c.date_prestation));
    ligne(p, 'Horaires', c.heure_debut ? 'de ' + heure(c.heure_debut) + (c.heure_fin ? ' à ' + heure(c.heure_fin) : '') : '');
    ligne(p, 'Lieu', c.lieu);
    ligne(p, 'Partenaire', c.partenaire);
    ligne(p, 'Pour le compte de', 'Maître Akesse Model Management');
    // détail : cachet total, commission, impôts, frais (sans total de prestation : le net seul, comme avant)
    if (c.montant_prestation) {
      ligne(d, 'Cachet total de la prestation', K.fcfa(c.montant_prestation));
      if (c.commission) ligne(d, 'Commission de l’agence' + (c.commission_taux ? ' (' + String(Number(c.commission_taux)).replace('.', ',') + ' %)' : ''), '− ' + K.fcfa(c.commission), 'retenue');
    }
    if (Number(c.impots) > 0) ligne(d, 'Impôts retenus', '− ' + K.fcfa(c.impots), 'retenue');
    (Array.isArray(c.frais) ? c.frais : []).forEach(function (x) { if (x && x.libelle) ligne(d, 'Frais : ' + x.libelle, '− ' + K.fcfa(x.montant), 'retenue'); });
    ligne(v, 'Payé le', K.jour(c.paye_le));
    ligne(v, 'Moyen de paiement', window.MoyensPaiement ? window.MoyensPaiement.nom(c.moyen || 'wave') : 'Wave');
    ligne(v, 'Référence', c.reference_wave);
    $('rc-montant').textContent = K.fcfa(c.montant);
    ['rc-prestation-bloc', 'rc-montant-bloc', 'rc-paiement-bloc', 'rc-merci', 'rc-actions'].forEach(function (id) { $(id).hidden = false; });
    $('rc-detail-bloc').hidden = !d.children.length;
    document.title = 'Reçu ' + (c.numero || '') + ' · Maître Akesse Model Management';
  }).catch(function () { $('rc-etat').textContent = 'Connexion impossible pour le moment. Réessayez dans un instant.'; });
  $('rc-imprimer').addEventListener('click', function () { window.print(); });
})();
