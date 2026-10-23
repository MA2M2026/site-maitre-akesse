// Page « Confirmer ma présence » (confirmer.html, Extension 141, 21/10/2026) : le lien personnel
// du message de convocation (?c=jeton) ouvre cette page, sans compte. Elle montre le projet et
// enregistre « confirmé » ou « absent » (fonctions convocation_lire / convocation_repondre ;
// le jeton seul donne accès, rien d'autre n'est lisible). Commun avec places.html : js/lien-public.js.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var jeton = new URLSearchParams(location.search).get('c') || '';
  var L = window.LienPublic, rpc = L.rpc, dateFr = L.dateFr;
  function afficherReponse(reponse) {
    $('cf-resultat').textContent = reponse === 'confirme' ? '✅ Merci ! Votre présence est confirmée. À bientôt.'
      : reponse === 'absent' ? '❌ C’est noté : vous ne pourrez pas venir. Merci de nous avoir prévenus.' : '';
    $('cf-oui').classList.toggle('actif', reponse === 'confirme');
    $('cf-non').classList.toggle('actif', reponse === 'absent');
  }
  var introuvable = function () { L.introuvable($('cf-details')); };
  if (!L.jetonValable(jeton)) { introuvable(); return; }
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
    // l'enfant ou son parent a déjà répondu (23/10/2026) : on le dit, la réponse reste modifiable
    if (!p.reponse && p.autre_reponse) {
      $('cf-resultat').textContent = (p.parent ? p.nom : 'Votre parent') + ' a déjà répondu : '
        + (p.autre_reponse === 'confirme' ? 'présence confirmée ✅.' : 'ne pourra pas venir.') + ' Vous pouvez aussi répondre ci-dessous.';
    }
  }).catch(function () { $('cf-details').textContent = 'Connexion impossible pour le moment. Réessayez dans un instant.'; });
  function repondre(reponse) {
    $('cf-oui').disabled = $('cf-non').disabled = true;
    var reactiver = function () { $('cf-oui').disabled = $('cf-non').disabled = false; };
    rpc('convocation_repondre', { p_jeton: jeton, p_reponse: reponse }).then(function (ok) {
      reactiver();
      if (ok === true) afficherReponse(reponse);
      else $('cf-resultat').textContent = 'Votre réponse n’a pas pu être enregistrée (projet terminé ou annulé).';
    }).catch(function () {
      reactiver();
      $('cf-resultat').textContent = 'Connexion impossible : réessayez dans un instant.';
    });
  }
  $('cf-oui').addEventListener('click', function () { repondre('confirme'); });
  $('cf-non').addEventListener('click', function () { repondre('absent'); });
})();
