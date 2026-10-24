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
    programme();
    if (p.passe) { $('cf-resultat').textContent = 'Ce projet est terminé.'; return; }
    $('cf-boutons').hidden = false;
    afficherReponse(p.reponse);
    // l'enfant ou son parent a déjà répondu (23/10/2026) : on le dit, la réponse reste modifiable
    if (!p.reponse && p.autre_reponse) {
      $('cf-resultat').textContent = (p.parent ? p.nom : 'Votre parent') + ' a déjà répondu : '
        + (p.autre_reponse === 'confirme' ? 'présence confirmée ✅.' : 'ne pourra pas venir.') + ' Vous pouvez aussi répondre ci-dessous.';
    }
  }).catch(function () { $('cf-details').textContent = 'Connexion impossible pour le moment. Réessayez dans un instant.'; });
  // Défilé programmé (24/10/2026, supabase-defiles.sql) : la fiche programme — ses passages à elle,
  // puis tout le programme avec les visages des autres mannequins (initiales sans photo)
  function el(tag, classe, texte, parent) { var e = document.createElement(tag); if (classe) e.className = classe; if (texte) e.textContent = texte; if (parent) parent.appendChild(e); return e; }
  function visage(m, parent) {
    var v = el('span', 'cf-vis' + (m.moi ? ' moi' : ''), '', parent);
    v.title = m.nom || '';
    if (m.photo) { var img = el('img', '', '', v); img.alt = ''; img.loading = 'lazy'; img.src = typeof urlLegere === 'function' ? urlLegere(m.photo) : m.photo; }
    else v.textContent = String(m.nom || '?').replace(/^(Madame|Mademoiselle|Monsieur)\s+/, '').split(/\s+/).slice(0, 2).map(function (x) { return x.charAt(0); }).join('').toUpperCase();
  }
  var jourFr = function (j) { return new Date(j + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); };
  var ligne = function (x) { return [x.debut ? x.debut.replace(':', 'h') : 'heure à préciser', x.salle, x.theme].filter(Boolean).join(' · '); };
  function programme() {
    rpc('defile_programme', { p_jeton: jeton }).then(function (d) {
      var passages = d && d.passages;
      if (!passages || !passages.length) return;
      var boite = $('cf-programme');
      boite.textContent = '';
      el('h2', '', 'Votre programme', boite).id = 'cf-programme-titre';
      var siens = passages.filter(function (x) { return x.moi; });
      var mes = el('ul', 'cf-mes-passages', '', boite);
      if (!siens.length) el('li', '', 'Vos passages seront bientôt programmés.', mes);
      siens.forEach(function (x) { var li = el('li', '', '', mes); el('b', '', jourFr(x.jour), li); el('span', '', ' — ' + ligne(x), li); });
      el('h2', '', 'Le programme complet', boite);
      var jour = null, bloc = null;
      passages.forEach(function (x) {
        if (x.jour !== jour) { jour = x.jour; el('h3', 'cf-jour', jourFr(jour), boite); bloc = el('div', 'cf-passages', '', boite); }
        var carte = el('article', 'cf-passage' + (x.moi ? ' moi' : ''), '', bloc);
        el('p', 'cf-passage-titre', ligne(x), carte);
        var ronds = el('div', 'cf-ronds', '', carte);
        (x.mannequins || []).forEach(function (m) { visage(m, ronds); });
      });
      boite.hidden = false;
    }).catch(function () { /* pas de programme : la page reste comme avant */ });
  }
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
