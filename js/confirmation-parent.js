// Page « Confirmation du parent » (confirmation-parent.html, 24/11/2026, décision de la propriétaire) : le parent d'une
// candidate ou d'un candidat mineur ouvre le lien personnel envoyé par l'agence (?j=jeton), écrit son nom et confirme
// ou refuse la candidature. Sa réponse est DÉFINITIVE (un enfant qui verrait le lien ne peut pas la changer) : pour
// revenir dessus, la famille contacte l'agence. Seul le premier mot du nom de l'enfant est montré.
// Base : supabase-parent-candidature.sql (le nom de l'enfant n'est pas accepté comme nom du parent).
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var jeton = new URLSearchParams(location.search).get('j') || '';
  var rpc = window.LienPublic.rpc;
  function etat(classe, titre, texte) { window.LienPublic.etat($('ap-etat'), classe, titre, texte); }
  var CONTACT = ' Pour changer votre réponse, contactez l’agence.';
  function dessiner(e) {
    var enfant = e.candidate || 'Votre enfant';
    $('ap-texte').textContent = enfant + ' a envoyé une candidature à l’agence Maître Akesse Model Management. Comme cette ' +
      'personne est mineure, l’agence ne donne aucune suite sans votre accord. Confirmez-vous que vous êtes son parent ou ' +
      'tuteur légal et que vous autorisez cette candidature ? Votre réponse sera définitive.';
    $('ap-form').hidden = e.etat !== 'en_attente';
    if (e.etat === 'confirme') etat('ok', 'Candidature confirmée.', (e.parent_nom ? 'Par ' + e.parent_nom + '. ' : '') + 'Merci !' + CONTACT);
    else if (e.etat === 'refuse') etat('', 'Candidature refusée.', 'L’agence n’y donnera pas suite.' + CONTACT);
    else $('ap-etat').hidden = true;
  }
  function lire() {
    return rpc('candidature_parent_lire', { p_jeton: jeton }).then(function (e) {
      if (!e) { $('ap-texte').textContent = 'Ce lien n’est pas (ou plus) valable. Demandez un nouveau lien à l’agence.'; $('ap-form').hidden = true; return; }
      dessiner(e);
    });
  }
  function repondre(accepte, bouton) {
    var nom = $('ap-nom').value.trim();
    if (nom.length < 3) { etat('erreur', 'Votre nom complet,', 's’il vous plaît.'); $('ap-nom').focus(); return; }
    bouton.disabled = true;
    return rpc('candidature_parent_repondre', { p_jeton: jeton, p_accepte: accepte, p_parent_nom: nom })
      .then(function () {
        // (réponse enregistrée : si la relecture échoue ensuite, on le dit quand même, sans « Pas enregistré »)
        return lire().catch(function () { $('ap-form').hidden = true; etat('ok', accepte ? 'Candidature confirmée.' : 'Candidature refusée.', 'Votre réponse est enregistrée. Merci !'); });
      }, function (err) {
        var m = String((err && err.message) || '');
        if (/REPONSE_DEJA_DONNEE/.test(m)) return lire().catch(function () { etat('', 'Réponse déjà enregistrée.', CONTACT.trim()); });
        etat('erreur', 'Pas enregistré.', /nom du parent/.test(m) ? 'Écrivez votre propre nom (parent ou tuteur), pas celui de votre enfant.' : 'Vérifiez votre nom complet et la connexion, puis réessayez.');
      })
      .then(function () { bouton.disabled = false; });
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (!/^[0-9a-f-]{36}$/i.test(jeton) || typeof SUPABASE_URL === 'undefined') { $('ap-texte').textContent = 'Lien incomplet. Ouvrez le lien reçu de l’agence en entier.'; return; }
    lire().catch(function () { $('ap-texte').textContent = 'Connexion impossible pour le moment. Réessayez dans un instant.'; });
    $('ap-form').addEventListener('submit', function (ev) { ev.preventDefault(); repondre(true, $('ap-accepter')); });
    $('ap-refuser').addEventListener('click', function () {
      if (window.confirm('Refuser cette candidature ? L’agence n’y donnera pas suite. Votre réponse sera définitive.')) repondre(false, $('ap-refuser'));
    });
  });
})();
