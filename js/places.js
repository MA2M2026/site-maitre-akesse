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
  var L = window.LienPublic, rpc = L.rpc, dateFr = L.dateFr;
  var etat = null, dejaVues = null, enCours = false;  // dejaVues : places déjà montrées (les nouvelles apparaissent en grandissant)
  var homme = function () { return etat && etat.sexe === 'homme'; };
  var accord = function (f, h) { return homme() ? h : f; };
  function montrerEtat(classe, titre, texte) {
    var b = $('pl-etat');
    b.hidden = false; b.className = 'pl-etat ' + (classe || '');
    b.textContent = '';
    var s = document.createElement('strong'); s.textContent = titre; b.appendChild(s);
    if (texte) b.appendChild(document.createTextNode(texte));
  }
  function restantes() {
    var total = homme() ? etat.places_hommes : etat.places_femmes;
    return Math.max(0, total - etat.pris.filter(function (x) { return x.sexe === etat.sexe; }).length);
  }
  function dessiner() {
    var e = etat, pris = e.statut === 'pris', libres = restantes();
    $('pl-titre').textContent = e.titre;
    var qui = parent ? 'Bonjour ! Message pour le parent de ' + e.nom : 'Bonjour ' + [e.civilite, e.nom].filter(Boolean).join(' ');
    $('pl-details').textContent = qui + ' · ' + dateFr(e.date_debut) + (e.heure_evenement ? ', ' + e.heure_evenement.replace(':', 'h') : '')
      + ([e.lieu, e.ville].filter(Boolean).length ? ', ' + [e.lieu, e.ville].filter(Boolean).join(', ') : '') + '.';
    $('pl-prendre').hidden = pris || e.passe || !e.ouvert || !libres;
    $('pl-rendre').hidden = !pris || e.passe;
    $('pl-boutons').hidden = $('pl-prendre').hidden && $('pl-rendre').hidden;
    if (e.passe) montrerEtat('oups', 'Ce projet est terminé.', '');
    else if (pris && parent && e.pris_par === 'mannequin') montrerEtat('bravo', '🎉 ' + accord('Votre fille', 'Votre fils') + ' a déjà pris sa place !', accord('Elle est sélectionnée', 'Il est sélectionné') + '. Vous recevrez la convocation avec tous les détails.');
    else if (pris && !parent && e.pris_par === 'parent') montrerEtat('bravo', '🎉 Bravo, vous êtes ' + accord('sélectionnée', 'sélectionné') + ' !', 'Votre parent a déjà pris votre place. Vous recevrez la convocation avec tous les détails.');
    else if (pris) montrerEtat('bravo', '🎉 Bravo, ' + (parent ? accord('votre fille est sélectionnée', 'votre fils est sélectionné') : 'vous êtes ' + accord('sélectionnée', 'sélectionné')) + ' !', 'Vous recevrez la convocation avec tous les détails.');
    else if (!e.ouvert) montrerEtat('oups', 'Les inscriptions sont fermées.', 'Rendez-vous au prochain projet !');
    else if (!libres) montrerEtat('oups', 'Oups… plus de place disponible.', 'Rendez-vous au prochain projet !');
    else montrerEtat('', (libres > 1 ? 'Il reste ' + libres + ' places' : 'Il reste 1 place') + ' pour les ' + accord('femmes', 'hommes') + '.', ' Premier arrivé, premier servi !' + (e.statut === 'desiste' ? ' (Vous vous étiez ' + accord('désistée', 'désisté') + ' : vous pouvez reprendre une place.)' : ''));
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
