// Page « Places limitées » (places.html, 23/10/2026, demande de la propriétaire) : le lien
// personnel (?c=jeton ; &p=1 dans le message du parent d'une mineure, même jeton) ouvre cette
// page, sans compte. Premier arrivé, premier servi (places_prendre : le serveur décide) ; on
// peut se désister (places_rendre). La grille montre les places prises (photo ou initiales,
// jamais les noms des autres) et se met à jour toute seule. Fonctions : supabase-places.sql ;
// commun avec confirmer.html : js/lien-public.js.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var jeton = params.get('c') || '', parent = params.get('p') === '1';
  var L = window.LienPublic, rpc = L.rpc;
  var etat = null, dejaVues = null, enCours = false;  // dejaVues : places déjà montrées (les nouvelles apparaissent en grandissant)
  function montrerEtat(classe, titre, texte) {
    var b = $('pl-etat');
    b.hidden = false; b.className = 'pl-etat ' + (classe || '');
    b.textContent = '';
    var s = document.createElement('strong'); s.textContent = titre; b.appendChild(s);
    if (texte) b.appendChild(document.createTextNode(texte));
  }
  // (textes partagés avec le serveur, qui écrit la page avant de l'envoyer : js/lien-public.js)
  function dessiner() {
    var e = etat, pris = e.statut === 'pris', libres = L.placesRestantes(e);
    $('pl-titre').textContent = e.titre;
    $('pl-details').textContent = L.placesDetails(e, parent);
    $('pl-prendre').hidden = pris || e.passe || !e.ouvert || !libres;
    $('pl-rendre').hidden = !pris || e.passe;
    $('pl-boutons').hidden = $('pl-prendre').hidden && $('pl-rendre').hidden;
    montrerEtat.apply(null, L.placesEtat(e, parent));
    dessinerGrilles();
  }
  function dessinerGrilles() {
    var boite = $('pl-grilles');
    boite.textContent = '';
    var premier = !dejaVues;
    dejaVues = dejaVues || {};
    [['femme', 'Femmes', etat.places_femmes], ['homme', 'Hommes', etat.places_hommes]].forEach(function (g) {
      if (!g[2]) return;
      var prises = etat.pris.filter(function (x) { return x.sexe === g[0]; });
      var h = document.createElement('h2'); h.textContent = g[1] + ' : ' + prises.length + ' / ' + g[2];
      var ul = document.createElement('ul'); ul.className = 'pl-grille';
      for (var i = 0; i < g[2]; i++) {
        var x = prises[i], li = document.createElement('li');
        li.className = 'pl-case' + (x ? ' prise' : '') + (x && x.moi ? ' moi' : '');
        if (x) {
          var cle = g[0] + (x.initiales || '') + (x.photo || '') + (x.moi ? '*' : '');
          if (!dejaVues[cle] && !premier) li.className += ' nouvelle';
          dejaVues[cle] = true;
          li.textContent = x.initiales || '';
          li.setAttribute('aria-label', x.moi ? 'Votre place' : 'Place prise');
          if (x.photo) {
            var img = document.createElement('img');
            img.alt = ''; img.loading = 'lazy';
            img.src = typeof urlLegere === 'function' ? urlLegere(x.photo) : x.photo;
            img.onerror = function () { var s = typeof urlDeSecours === 'function' && urlDeSecours(this.getAttribute('src')); this.onerror = null; if (s) this.src = s; else this.remove(); };
            li.appendChild(img);
          }
        } else li.setAttribute('aria-label', 'Place libre');
        ul.appendChild(li);
      }
      boite.appendChild(h); boite.appendChild(ul);
    });
    boite.hidden = !boite.childNodes.length;
  }
  var introuvable = function () { L.introuvable($('pl-details')); };
  function charger() {
    return rpc('places_lire', { p_jeton: jeton }).then(function (e) {
      if (!e) { introuvable(); return; }
      etat = e; etat.pris = etat.pris || [];
      dessiner();
    });
  }
  function agir(nom, p) {
    if (enCours) return;
    enCours = true;
    $('pl-prendre').disabled = $('pl-rendre').disabled = true;
    rpc(nom, p).then(function (rep) {
      return charger().then(function () {
        if (rep === 'complet') montrerEtat('oups', 'Oups… plus de place disponible.', 'Quelqu’un a été plus rapide. Rendez-vous au prochain projet !');
        else if (rep === 'ferme') montrerEtat('oups', 'Les inscriptions sont fermées.', 'Rendez-vous au prochain projet !');
        else if (rep === 'desiste') montrerEtat('', 'C’est noté : la place est libérée.', ' Merci de nous avoir prévenus.');
      });
    }).catch(function () {
      montrerEtat('oups', 'Connexion impossible.', ' Réessayez dans un instant.');
    }).then(function () {
      enCours = false;
      $('pl-prendre').disabled = $('pl-rendre').disabled = false;
    });
  }
  if (!L.jetonValable(jeton)) { introuvable(); return; }
  charger().catch(function () { $('pl-details').textContent = 'Connexion impossible pour le moment. Réessayez dans un instant.'; });
  $('pl-prendre').addEventListener('click', function () { agir('places_prendre', { p_jeton: jeton, p_parent: parent }); });
  $('pl-rendre').addEventListener('click', function () {
    if (confirm('Vous désister ? Votre place sera libérée pour une autre personne.')) agir('places_rendre', { p_jeton: jeton });
  });
  // la grille se remplit sous les yeux : nouvelle lecture toutes les 15 s, page visible seulement
  setInterval(function () { if (!document.hidden && !enCours && etat) charger().catch(function () { /* hors ligne : on réessaiera */ }); }, 15000);
})();
