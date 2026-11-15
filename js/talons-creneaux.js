// Choix des créneaux des cours PRIVÉS de talons (maquettes validées par la propriétaire, 14 et 15/11/2026 :
// maquettes/creneaux-prives.html et creneaux-prives-v2.html). Écrit UNE fois (règle 5 du site) et utilisé par :
//   * le formulaire d'inscription (js/cours-talons.js : « Je choisis maintenant ») ;
//   * la page « Mon programme » de l'élève (js/programme-talons.js : choisir après son paiement, déplacer une séance).
// Les heures libres viennent de la base (cours_talons_creneaux_libres, supabase-creneaux-prives.sql : du lundi au
// samedi, 10 h – 20 h, séance de 2 h, 1 h 30 de pause entre deux cours, sans les indisponibilités de l'agence) ; la base
// revérifie tout à l'enregistrement. Abidjan est à l'heure UTC toute l'année : les heures sont en UTC.
window.TalonsCreneaux = (function () {
  'use strict';
  var TC = window.TalonsCommun;
  var HEURES = [10, 11, 12, 13, 14, 15, 16, 17, 18];
  var JOURS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MOIS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var JOURS_A_VOIR = 42, JOURS_LUS = 245;   // 6 semaines affichées ; 35 semaines lues (« chaque semaine », jusqu'à 28 séances)
  var ECART = 3.5 * 3600000;                // 2 h de cours + 1 h 30 de pause
  var JOUR = 86400000;

  var cleHeure = function (t) { return new Date(t).toISOString().slice(0, 13); };
  var demainUTC = function () { var d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)); };
  // « Mardi 17 novembre » / « Tuesday 17 November »
  function dateLongue(t, en) {
    var d = new Date(t), j = en ? JOURS_EN[d.getUTCDay()] : TC.JOURS[d.getUTCDay()];
    return j.charAt(0).toUpperCase() + j.slice(1) + ' ' + (d.getUTCDate() === 1 && !en ? '1er' : d.getUTCDate()) + ' ' + (en ? MOIS_EN[d.getUTCMonth()] : TC.MOIS[d.getUTCMonth()]);
  }
  function heureTexte(h, en) { return en ? (h > 12 ? h - 12 + ' pm' : h === 12 ? '12 pm' : h + ' am') : h + ' h'; }
  // pour l'agence (toujours en français) : « jeu. 19 nov. 14 h, … »
  function pourAgence(l) {
    return l.map(function (t) { var d = new Date(t); return TC.JOURS[d.getUTCDay()].slice(0, 3) + '. ' + d.getUTCDate() + ' ' + TC.MOIS_COURTS[d.getUTCMonth()] + ' ' + d.getUTCHours() + ' h'; }).join(', ');
  }
  function bouton(classe, html, quoi, valeur, actif, etiquette) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = classe; b.innerHTML = html; b.dataset[quoi] = valeur; b.disabled = !actif;
    b.setAttribute('data-bouton-libre', '');   // (style du site écarté : css/bouton-ma2m.css)
    if (etiquette) b.setAttribute('aria-label', etiquette);
    return b;
  }

  // o : { jours, heures, liste, titre (éléments), repeter (case à cocher ou null), en (anglais), nb () → nombre de
  // séances à choisir, lire (p_du, p_jours) → promesse de la liste des heures libres, trop (nb) → message quand tout est
  // déjà choisi, change () → après chaque changement }
  function creer(o) {
    var libres = null, chargement = null, jourChoisi = null, choisis = [], dernierNb = 0, lecture = 0;   // libres : null = en lecture, false = indisponible
    var T = function (fr, en) { return o.en ? en : fr; };
    // libre pour elle : libre dans la base et à 3 h 30 au moins de ses autres choix
    function libreIci(t) {
      var iso = t.toISOString();
      return !!libres && libres.has(cleHeure(t)) && !choisis.some(function (c) { return c !== iso && Math.abs(new Date(c) - t) < ECART; });
    }
    function charger(neuf) {
      if (neuf) chargement = null;
      if (chargement) return chargement;
      libres = null;
      var n = ++lecture;   // (une lecture plus ancienne qui revient après une plus récente est ignorée)
      chargement = Promise.resolve().then(function () { return o.lire(demainUTC().toISOString().slice(0, 10), JOURS_LUS); })
        .then(function (l) { if (n === lecture) libres = Array.isArray(l) ? new Set(l.map(cleHeure)) : false; }, function () { if (n === lecture) libres = false; })
        .then(function () { if (n === lecture) apres(); });
      return chargement;
    }
    // après un changement : la page appelante redessine (change), sinon on redessine ici — une seule fois
    function apres() { if (o.change) o.change(); else dessiner(); }
    // « chaque semaine » : le même jour et la même heure, semaine après semaine (une semaine déjà prise est sautée)
    function remplirSemaines(iso) {
      choisis = [];
      for (var w = 0; choisis.length < o.nb() && w < JOURS_LUS / 7; w++) { var t = new Date(Date.parse(iso) + w * 7 * JOUR); if (libreIci(t)) choisis.push(t.toISOString()); }
    }
    // nombre de séances changé : liste raccourcie, ou complétée (« chaque semaine ») quand il augmente
    function ajuster() {
      var n = o.nb();
      choisis = choisis.slice(0, n);
      if (n > dernierNb && libres && choisis.length && choisis.length < n && o.repeter && o.repeter.checked) remplirSemaines(choisis[0]);
      dernierNb = n;
    }
    function dessiner() {
      o.jours.textContent = ''; o.heures.textContent = ''; o.liste.textContent = '';
      if (libres === null) { o.jours.textContent = T('Lecture des créneaux libres…', 'Loading free slots…'); return; }
      var d0 = demainUTC(), jourListe = [];
      var avecLibre = function (d) { return HEURES.some(function (h) { return libreIci(new Date(d.getTime() + h * 3600000)); }); };
      for (var k = 0; k < JOURS_A_VOIR; k++) { var d = new Date(d0.getTime() + k * JOUR); if (d.getUTCDay() !== 0) jourListe.push(d); }
      if (!jourChoisi || !jourListe.some(function (x) { return x.toISOString().slice(0, 10) === jourChoisi; })) jourChoisi = (jourListe.filter(avecLibre)[0] || jourListe[0]).toISOString().slice(0, 10);
      jourListe.forEach(function (x) {
        var iso = x.toISOString().slice(0, 10), j = (o.en ? JOURS_EN : TC.JOURS)[x.getUTCDay()];
        var b = bouton('ct-jour' + (iso === jourChoisi ? ' on' : ''), '<small>' + j.slice(0, 3) + '</small><b>' + x.getUTCDate() + '</b><i>' + (o.en ? MOIS_EN[x.getUTCMonth()].slice(0, 3) : TC.MOIS_COURTS[x.getUTCMonth()]) + '</i>',
          'jour', iso, avecLibre(x) || choisis.some(function (c) { return c.slice(0, 10) === iso; }), dateLongue(x, o.en));
        b.setAttribute('aria-pressed', iso === jourChoisi ? 'true' : 'false');
        o.jours.appendChild(b);
      });
      HEURES.forEach(function (h) {
        var t = new Date(Date.parse(jourChoisi + 'T00:00:00Z') + h * 3600000), iso = t.toISOString(), pris = choisis.indexOf(iso) >= 0, libre = libreIci(t);
        var b = bouton('ct-heure' + (pris ? ' on' : libre ? '' : ' pris'), heureTexte(h, o.en), 'heure', iso, pris || libre,
          dateLongue(t, o.en) + ', ' + heureTexte(h, o.en) + (pris ? T(' (choisi)', ' (chosen)') : libre ? '' : T(' (déjà pris)', ' (taken)')));
        b.setAttribute('aria-pressed', pris ? 'true' : 'false');
        o.heures.appendChild(b);
      });
      var nb = o.nb(), reste = nb - choisis.length;
      if (o.titre) o.titre.textContent = (nb > 1 ? T('Vos ' + nb + ' séances', 'Your ' + nb + ' sessions') : T('Votre séance', 'Your session')) + (reste > 0 ? T(' · encore ' + reste + ' à choisir', ' · ' + reste + ' still to choose') : '');
      choisis.forEach(function (iso, i) {
        var li = document.createElement('li'), h = new Date(iso).getUTCHours();
        var em = document.createElement('em'); em.textContent = String(i + 1);
        var s = document.createElement('span'); s.textContent = dateLongue(iso, o.en);
        var sm = document.createElement('small'); sm.textContent = heureTexte(h, o.en) + ' – ' + heureTexte(h + 2, o.en);
        var x = bouton('ct-retirer', '✕', 'retirer', iso, true, T('Retirer la séance du ', 'Remove the session of ') + dateLongue(iso, o.en));
        li.append(em, s, sm, x); o.liste.appendChild(li);
      });
      o.liste.classList.toggle('u-hidden', !choisis.length);
    }
    o.jours.addEventListener('click', function (e) { var b = e.target.closest('[data-jour]'); if (b) { jourChoisi = b.dataset.jour; dessiner(); } });
    o.liste.addEventListener('click', function (e) {
      var b = e.target.closest('[data-retirer]');
      if (b) { choisis = choisis.filter(function (c) { return c !== b.dataset.retirer; }); apres(); }
    });
    o.heures.addEventListener('click', function (e) {
      var b = e.target.closest('[data-heure]');
      if (!b) return;
      var iso = b.dataset.heure, nb = o.nb();
      if (choisis.indexOf(iso) >= 0) choisis = choisis.filter(function (c) { return c !== iso; });
      else if (o.repeter && o.repeter.checked) remplirSemaines(iso);
      else if (nb === 1) choisis = [iso];
      else if (choisis.length >= nb) { if (o.trop) o.trop(nb); return; }
      else choisis = choisis.concat(iso).sort((x, y) => x.localeCompare(y));
      apres();
    });
    return {
      charger: charger, dessiner: dessiner, ajuster: ajuster,
      etat: function () { return libres; },
      choisis: function () { return choisis.slice(); },
      vider: function () { choisis = []; },
      // après un refus de la base (créneau pris entre-temps) : relire, et garder seulement ce qui est encore libre
      relire: function () { return charger(true).then(function () { choisis = choisis.filter(function (c) { return libres && libres.has(cleHeure(c)); }); }); }
    };
  }
  return { creer: creer, pourAgence: pourAgence, dateLongue: dateLongue, heureTexte: heureTexte };
})();
