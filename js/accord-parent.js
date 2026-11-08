// Page « Accord du parent » (accord-parent.html, 08/11/2026, site vivant ; décision de la propriétaire, choix B) :
// le parent d'une mannequin mineure ouvre son lien personnel (?j=jeton), lit à quoi il consent, écrit son nom et
// appuie sur « J'accepte » ; il peut retirer son accord à tout moment avec le même lien. Sans accord, la mannequin
// ne paraît jamais sur l'accueil (couverture, « À la une », visages). Base : supabase-site-vivant.sql.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var jeton = new URLSearchParams(location.search).get('j') || '';
  var rpc = window.LienPublic.rpc;
  function etat(classe, titre, texte) {
    var b = $('ap-etat'); b.hidden = false; b.className = 'pl-etat ' + (classe || ''); b.textContent = '';
    var s = document.createElement('strong'); s.textContent = titre; b.appendChild(s);
    if (texte) b.appendChild(document.createTextNode(' ' + texte));
  }
  function dessiner(e) {
    var prenom = e.prenom || 'votre enfant';
    $('ap-texte').textContent = 'L’agence Maître Akesse Model Management souhaite montrer la photo de ' + prenom +
      ' sur la page d’accueil de son site (couverture, « À la une », visages des mannequins). Comme elle est mineure, ' +
      'votre accord est nécessaire. Vous pouvez le retirer à tout moment avec ce même lien ; sa photo est alors retirée de l’accueil.';
    $('ap-form').hidden = e.etat === 'accepte';
    $('ap-retirer-bloc').hidden = e.etat !== 'accepte';
    if (e.etat === 'accepte') etat('ok', 'Accord donné.', (e.parent_nom ? 'Par ' + e.parent_nom + '. ' : '') + 'Merci !');
    else if (e.etat === 'retire') etat('', 'Accord retiré.', 'La photo de ' + prenom + ' ne paraît plus sur l’accueil. Vous pouvez de nouveau accepter ci-dessous.');
    else $('ap-etat').hidden = true;
  }
  function lire() {
    return rpc('accord_parent_lire', { p_jeton: jeton }).then(function (e) {
      if (!e) { $('ap-texte').textContent = 'Ce lien n’est pas (ou plus) valable. Demandez un nouveau lien à l’agence.'; return; }
      dessiner(e);
    });
  }
  function repondre(accepte, nom, bouton) {
    bouton.disabled = true;
    return rpc('accord_parent_repondre', { p_jeton: jeton, p_accepte: accepte, p_parent_nom: nom || null })
      .then(lire)
      .catch(function () { etat('erreur', 'Pas enregistré.', accepte ? 'Vérifiez votre nom complet et la connexion, puis réessayez.' : 'Vérifiez la connexion, puis réessayez.'); })
      .then(function () { bouton.disabled = false; });
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (!/^[0-9a-f-]{36}$/i.test(jeton) || typeof SUPABASE_URL === 'undefined') { $('ap-texte').textContent = 'Lien incomplet. Ouvrez le lien reçu de l’agence en entier.'; return; }
    lire().catch(function () { $('ap-texte').textContent = 'Connexion impossible pour le moment. Réessayez dans un instant.'; });
    $('ap-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var nom = $('ap-nom').value.trim();
      if (nom.length < 3) { etat('erreur', 'Votre nom complet,', 's’il vous plaît.'); return; }
      repondre(true, nom, $('ap-accepter'));
    });
    $('ap-retirer').addEventListener('click', function () {
      if (window.confirm('Retirer votre accord ? La photo ne paraîtra plus sur l’accueil.')) repondre(false, null, $('ap-retirer'));
    });
  });
})();
