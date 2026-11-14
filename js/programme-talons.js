// « Mon programme » de l'Atelier Talons & Élégance (programme-talons.html, 14/11/2026, maquette validée par la
// propriétaire). Le lien personnel envoyé sur WhatsApp (?c=jeton) ouvre cette page, sans compte : la base
// (programme_talons_lire, supabase-programme-talons.sql) ne répond qu'avec le bon jeton et une fois le paiement validé.
// Vouvoiement partout (« Madame … », demande de la propriétaire du 14/11/2026). Abidjan est à l'heure UTC toute
// l'année : les heures sont lues en UTC. « Ajouter à mon calendrier » : un fichier .ics avec toutes les séances à
// venir et un rappel la veille (iPhone et Android l'ajoutent d'un coup à l'agenda).
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var L = window.LienPublic;
  var jeton = new URLSearchParams(location.search).get('c') || '';
  var T = window.TalonsCommun;   // js/talons-commun.js
  var JOURS = T.JOURS, MOIS = T.MOIS, MOIS_COURTS = T.MOIS_COURTS, heure = T.heure;
  var FORMULES = { groupe: 'Formule en groupe', prive_salle: 'Cours privés, dans notre salle', prive_exterieur: 'Cours privés, au lieu de votre choix' };
  var LIEU_DEFAUT = T.LIEU_SALLE;
  var NUMERO_AGENCE = T.NUMERO_AGENCE;
  var JOUR = 86400000;

  function jourCle(d) { return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); }
  function plage(s) { return heure(s.debut) + ' – ' + heure(s.fin); }
  function dateCourte(d) { return d.getUTCDate() + ' ' + MOIS_COURTS[d.getUTCMonth()]; }
  function dateLongue(d) { var j = JOURS[d.getUTCDay()]; return j.charAt(0).toUpperCase() + j.slice(1) + ' ' + (d.getUTCDate() === 1 ? '1er' : d.getUTCDate()) + ' ' + MOIS[d.getUTCMonth()]; }
  function erreur(texte) { $('pt-accroche').textContent = texte; }

  if (!L || !L.jetonValable(jeton)) { erreur('Ce lien n’est pas valable. Écrivez-nous sur WhatsApp, nous vous renverrons votre programme.'); return; }

  L.rpc('programme_talons_lire', { p_jeton: jeton }).then(function (p) {
    if (!p || !p.nom) { erreur('Ce lien n’est pas valable, ou votre paiement n’est pas encore validé. Écrivez-nous sur WhatsApp.'); return; }
    afficher(p);
  }).catch(function () { erreur('Connexion impossible pour le moment. Réessayez dans un instant.'); });

  function afficher(p) {
    var maintenant = new Date();
    var seances = (p.seances || []).map(function (s, i) {
      var debut = new Date(s.debut), fin = new Date(s.fin);
      return { id: s.id || '', n: i + 1, debut: debut, fin: fin, lieu: s.lieu || LIEU_DEFAUT, theme: s.theme || '', faite: !!s.faite || fin < maintenant };
    }).filter(function (s) { return !isNaN(s.debut) && !isNaN(s.fin); });
    var aVenir = seances.filter(function (s) { return !s.faite; });
    var prochaine = aVenir[0] || null;
    var demain = false;
    var nom = [p.civilite, String(p.nom || '').trim()].filter(Boolean).join(' ');

    document.title = 'Mon programme · ' + nom + ' | Atelier Talons & Élégance';
    var h1 = $('pt-titre'); h1.textContent = 'Bienvenue,'; h1.appendChild(document.createElement('br'));
    var em = document.createElement('em'); em.textContent = nom; h1.appendChild(em);
    $('pt-accroche').textContent = p.formule === 'groupe' ? 'Quatre dimanches pour marcher avec assurance.' : 'Vos séances privées pour marcher avec assurance.';
    $('pt-wa').href = 'https://wa.me/' + NUMERO_AGENCE + '?text=' + encodeURIComponent('Bonjour, je suis ' + nom + ', élève de l’Atelier Talons & Élégance (' + p.numero + '). J’ai une question : ');

    // carte d'élève
    $('pt-numero').textContent = 'N° ' + p.numero;
    $('pt-periode').textContent = seances.length ? dateCourte(seances[0].debut) + (seances.length > 1 ? ' → ' + dateCourte(seances[seances.length - 1].debut) : '') : 'Dates à venir';
    var nb = seances.length || p.nb_seances || 0;
    $('pt-formule').textContent = (FORMULES[p.formule] || 'Atelier talons') + ' · ' + nb + ' séance' + (nb > 1 ? 's' : '');
    var faites = seances.length - aVenir.length;
    $('pt-faites').textContent = faites + ' / ' + nb;
    $('pt-progres').style.width = nb ? Math.round(100 * faites / nb) + '%' : '0';
    var plages = seances.map(plage).filter(function (x, i, t) { return t.indexOf(x) === i; });
    $('pt-horaire').textContent = plages.length === 1 ? plages[0] : plages.length ? 'Selon la séance' : 'À venir';

    // prochaine séance
    if (prochaine) {
      var jours = Math.round((Date.UTC(prochaine.debut.getUTCFullYear(), prochaine.debut.getUTCMonth(), prochaine.debut.getUTCDate()) -
        Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate())) / JOUR);
      demain = jours === 1;
      var quand = jours <= 0 ? 'c’est aujourd’hui' : jours === 1 ? 'c’est demain' : 'dans ' + jours + ' jours';
      $('pt-proch-titre').textContent = (prochaine.n === 1 ? 'Votre première séance, ' : 'Votre prochaine séance, ') + quand;
      $('pt-proch-detail').textContent = dateLongue(prochaine.debut) + ' · ' + heure(prochaine.debut) + ' · ' + prochaine.lieu;
    } else {
      $('pt-proch-titre').textContent = seances.length ? 'Programme terminé : bravo !' : 'Vos séances seront bientôt programmées';
      $('pt-proch-detail').textContent = seances.length ? 'Merci d’avoir suivi l’Atelier Talons & Élégance.' : 'Nous vous écrirons sur WhatsApp avec les dates.';
    }

    // séances
    var frise = $('pt-seances'); frise.textContent = '';
    if (!seances.length) { var vide = document.createElement('p'); vide.className = 'pt-vide'; vide.textContent = 'Les dates de vos séances apparaîtront ici.'; frise.appendChild(vide); }
    seances.forEach(function (s) {
      var l = document.createElement('div');
      l.className = 'pt-seance' + (s === prochaine ? ' proche' : '') + (s.faite ? ' faite' : '');
      var date = document.createElement('div'); date.className = 'pt-date';
      [['small', JOURS[s.debut.getUTCDay()].slice(0, 3)], ['b', String(s.debut.getUTCDate())], ['small', MOIS_COURTS[s.debut.getUTCMonth()]]].forEach(function (x) {
        var e = document.createElement(x[0]); e.textContent = x[1]; date.appendChild(e);
      });
      var t = document.createElement('div'); t.className = 'pt-seance-t';
      var a = document.createElement('small'); a.textContent = 'Séance ' + s.n + (s.faite ? ' · faite ✓' : s === prochaine && demain ? ' · demain' : '');
      var b = document.createElement('b'); b.textContent = s.theme || 'Séance ' + s.n;
      var c = document.createElement('span'); c.textContent = plage(s) + ' · ' + s.lieu;
      t.appendChild(a); t.appendChild(b); t.appendChild(c);
      l.appendChild(date); l.appendChild(t); frise.appendChild(l);
    });

    // le jour J (lieu et heure de la prochaine séance, sinon de la dernière)
    var reference = prochaine || seances[seances.length - 1];
    var lieu = reference ? reference.lieu : LIEU_DEFAUT;
    $('pt-lieu').textContent = lieu;
    $('pt-itineraire').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lieu + ', Abidjan');
    if (reference) {
      var arrivee = new Date(reference.debut.getTime() - 15 * 60000);
      $('pt-arrivee').textContent = 'Arrivée à ' + heure(arrivee);
      $('pt-arrivee-detail').textContent = 'Le cours commence à ' + heure(reference.debut) + ' précises.';
    } else {
      $('pt-arrivee').textContent = 'Arrivée 15 minutes avant';
      $('pt-arrivee-detail').textContent = 'L’heure exacte vous sera envoyée avec vos dates.';
    }
    $('pt-signature').textContent = prochaine ? 'À ' + JOURS[prochaine.debut.getUTCDay()] + ', avec élégance.' : 'Avec élégance.';

    calendrier(seances, maintenant);
    var bouton = $('pt-ics');
    if (!aVenir.length) { bouton.hidden = true; } else {
      $('pt-ics-note').textContent = (aVenir.length > 1 ? 'Les ' + aVenir.length + ' séances s’ajoutent' : 'La séance s’ajoute') + ' d’un coup à votre téléphone, avec un rappel la veille.';
      bouton.addEventListener('click', function () { telechargerIcs(aVenir, p, nom); });
    }
    $('pt-contenu').hidden = false;
  }

  // calendrier : le mois de la prochaine séance ; flèches pour aller d'un mois à l'autre entre la première et la dernière
  function calendrier(seances, maintenant) {
    if (!seances.length) { $('pt-bloc-cal').hidden = true; return; }
    var cours = {};
    seances.forEach(function (s) { var k = jourCle(s.debut); cours[k] = cours[k] === false ? false : s.faite; });
    var moisDe = function (d) { return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
    var premier = moisDe(seances[0].debut), dernier = moisDe(seances[seances.length - 1].debut);
    var prochaine = seances.filter(function (s) { return !s.faite; })[0];
    var actuel = moisDe((prochaine || seances[seances.length - 1]).debut);
    var aujourdhui = jourCle(maintenant);
    function dessiner() {
      var an = Math.floor(actuel / 12), mois = actuel % 12;
      $('pt-mois').textContent = MOIS[mois] + ' ' + an;
      $('pt-avant').disabled = actuel <= premier; $('pt-apres').disabled = actuel >= dernier;
      var cal = $('pt-cal'); cal.textContent = '';
      ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(function (j) { var e = document.createElement('div'); e.className = 'j'; e.textContent = j; e.setAttribute('aria-hidden', 'true'); cal.appendChild(e); });
      var debut = new Date(Date.UTC(an, mois, 1));
      var decalage = (debut.getUTCDay() + 6) % 7;                       // lundi en premier
      var case0 = new Date(debut.getTime() - decalage * JOUR);
      var cases = Math.ceil((decalage + new Date(Date.UTC(an, mois + 1, 0)).getUTCDate()) / 7) * 7;
      for (var i = 0; i < cases; i++) {
        var d = new Date(case0.getTime() + i * JOUR), k = jourCle(d);
        var e = document.createElement('div');
        e.className = 'd' + (d.getUTCMonth() !== mois ? ' hors' : '') + (k in cours ? ' cours' + (cours[k] ? ' faite' : '') : '') + (k === aujourdhui ? ' auj' : '');
        var s = document.createElement('span'); s.textContent = d.getUTCDate(); e.appendChild(s);
        if (k in cours) e.setAttribute('aria-label', d.getUTCDate() + ' ' + MOIS[d.getUTCMonth()] + ' : séance' + (cours[k] ? ' faite' : ''));
        cal.appendChild(e);
      }
    }
    $('pt-avant').addEventListener('click', function () { if (actuel > premier) { actuel--; dessiner(); } });
    $('pt-apres').addEventListener('click', function () { if (actuel < dernier) { actuel++; dessiner(); } });
    dessiner();
  }

  // RFC 5545 : une ligne fait au plus 75 octets ; la suite repart sur la ligne suivante, précédée d'une espace
  // (sans couper un caractère accentué en deux)
  function replier(ligne) {
    var out = [], cur = '', taille = 0, limite = 75;
    Array.from(ligne).forEach(function (c) {
      var t = new TextEncoder().encode(c).length;
      if (taille + t > limite) { out.push(cur); cur = ' '; taille = 1; limite = 75; }
      cur += c; taille += t;
    });
    out.push(cur);
    return out.join('\r\n');
  }
  // Fichier .ics (RFC 5545) : une entrée par séance à venir, rappel la veille ; textes échappés, lignes CRLF repliées.
  // UID = identifiant de la séance dans la base : un nouveau téléchargement remplace les séances au lieu de les doubler.
  function ics(seances, p, nom) {
    var esc = function (t) { return String(t).replace(/[\\;,]/g, function (c) { return '\\' + c; }).replace(/\r?\n/g, '\\n'); };
    var z = function (d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
    var lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Maitre Akesse Model Management//Atelier talons//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    seances.forEach(function (s) {
      lignes.push('BEGIN:VEVENT', 'UID:' + (s.id ? 'talons-' + s.id : p.numero + '-' + z(s.debut)) + '@maitreakessemodelmanagement.com', 'DTSTAMP:' + z(new Date()),
        'DTSTART:' + z(s.debut), 'DTEND:' + z(s.fin),
        'SUMMARY:' + esc('Atelier talons MA2M · Séance ' + s.n + (s.theme ? ' · ' + s.theme : '')),
        'LOCATION:' + esc(s.lieu + ', Abidjan'),
        'DESCRIPTION:' + esc(nom + ' : arrivée 15 minutes avant. À prévoir : talons de 7 à 10 cm, tenue près du corps, ballerines, une bouteille d’eau. ' + location.origin + location.pathname + '?c=' + jeton),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc('Demain : atelier talons MA2M à ' + heure(s.debut)), 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT');
    });
    lignes.push('END:VCALENDAR');
    return lignes.map(replier).join('\r\n') + '\r\n';
  }
  function telechargerIcs(seances, p, nom) {
    var url = URL.createObjectURL(new Blob([ics(seances, p, nom)], { type: 'text/calendar;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url; a.download = 'atelier-talons-ma2m.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    $('pt-ics-note').textContent = 'Ouvrez le fichier reçu, puis « Ajouter » : vos séances seront dans votre agenda.';
  }
})();
