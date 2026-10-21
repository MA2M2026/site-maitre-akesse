// Page « Confirmer ma présence » (confirmer.html, Extension 141, 21/10/2026) : le lien personnel
// du message de convocation (?c=jeton) ouvre cette page, sans compte. Elle montre le projet et
// enregistre « confirmé » ou « absent » (fonctions convocation_lire / convocation_repondre ;
// le jeton seul donne accès, rien d'autre n'est lisible).
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var jeton = new URLSearchParams(location.search).get('c') || '';
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function rpc(nom, params) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + nom, {
      method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function dateFr(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return '';
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return JOURS[d.getUTCDay()] + ' ' + (+m[3] === 1 ? '1er' : +m[3]) + ' ' + MOIS[+m[2] - 1] + ' ' + m[1];
  }
  function afficherReponse(reponse) {
    $('cf-resultat').textContent = reponse === 'confirme' ? '✅ Merci ! Votre présence est confirmée. À bientôt.'
      : reponse === 'absent' ? '❌ C’est noté : vous ne pourrez pas venir. Merci de nous avoir prévenus.' : '';
    $('cf-oui').classList.toggle('actif', reponse === 'confirme');
    $('cf-non').classList.toggle('actif', reponse === 'absent');
  }
  function introuvable() { $('cf-details').textContent = 'Ce lien n’est pas valable, ou le projet a été annulé. Contactez l’agence sur WhatsApp.'; }
  if (!/^[0-9a-f]{36}$/.test(jeton) || typeof SUPABASE_URL === 'undefined') { introuvable(); return; }
  rpc('convocation_lire', { p_jeton: jeton }).then(function (lignes) {
    var p = lignes && lignes[0];
    if (!p) { introuvable(); return; }
    $('cf-titre').textContent = p.titre;
    $('cf-details').textContent = 'Bonjour ' + p.nom + (p.parent ? ' (message pour son parent)' : '') + ' — ' + dateFr(p.date_debut)
      + (p.heure_convocation ? ', convocation à ' + p.heure_convocation.replace(':', 'h') : '')
      + ([p.lieu, p.ville].filter(Boolean).length ? ', ' + [p.lieu, p.ville].filter(Boolean).join(', ') : '') + '.';
    if (p.passe) { $('cf-resultat').textContent = 'Ce projet est terminé.'; return; }
    $('cf-boutons').hidden = false;
    afficherReponse(p.reponse);
  }).catch(function () { $('cf-details').textContent = 'Connexion impossible pour le moment. Réessayez dans un instant.'; });
  function repondre(reponse) {
    $('cf-oui').disabled = $('cf-non').disabled = true;
    rpc('convocation_repondre', { p_jeton: jeton, p_reponse: reponse }).then(function (ok) {
      if (ok === true) afficherReponse(reponse);
      else $('cf-resultat').textContent = 'Votre réponse n’a pas pu être enregistrée (projet terminé ou annulé).';
    }).catch(function () { $('cf-resultat').textContent = 'Connexion impossible : réessayez dans un instant.'; })
      .then(function () { $('cf-oui').disabled = $('cf-non').disabled = false; });
  }
  $('cf-oui').addEventListener('click', function () { repondre('confirme'); });
  $('cf-non').addEventListener('click', function () { repondre('absent'); });
})();
