// Tableau de bord — « Rapport des profils » (demande de la propriétaire, 06/10/2026).
// Le site passe en revue chaque mannequin et dit ce qui manque : mensurations non
// remplies ou incohérentes (js/tailles.js), photo de profil, couverture, compcard,
// book trop petit, photos à remplacer signalées par la revue stricte des books (IA,
// déjà faite : aucun coût en plus). Pour chaque profil « à compléter », un message
// personnel est rédigé ; on coche plusieurs mannequins et chacune reçoit SON message,
// séparément, par WhatsApp (un appui par personne : l'envoi automatique n'existe
// qu'avec l'offre payante de WhatsApp). Les envois sont notés sur cet appareil.
(function () {
  var details = document.getElementById('rapport-profils-details');
  if (!details || typeof sb === 'undefined' || !sb) return;
  var charge = false, profils = [], telephones = {};
  var suppDisponibles = true; // colonnes de l'Extension 121 lisibles ?
  var envoyesCetteFois = {}; // file d'envoi : on passe à la suivante (la date reste notée pour la prochaine fois)
  var BOOK_MINIMUM = 6;
  var CLE_ENVOIS = 'ma2m_rapport_profils_envois';

  function echapper(t) { return echapperHtml(t); }
  function envois() { try { return JSON.parse(localStorage.getItem(CLE_ENVOIS) || '{}') || {}; } catch (e) { return {}; } }
  function noterEnvoi(id) { var o = envois(); o[id] = new Date().toISOString(); try { localStorage.setItem(CLE_ENVOIS, JSON.stringify(o)); } catch (e) {} }

  // Mensurations attendues (mêmes champs que l'étape « Informations physiques »).
  function mesuresAttendues(p) {
    var homme = p.category === 'homme';
    return [
      ['height_cm', 'taille'], ['weight_kg', 'poids'], ['chest_cm', 'tour de poitrine'], ['waist_cm', 'tour de taille'],
      ['hips_cm', 'tour de bassin']
    ].concat(suppDisponibles ? (homme ? [['neck_cm', 'tour de cou']] : []).concat([['shoulder_cm', 'largeur d’épaules'], ['arm_cm', 'longueur de bras']]) : []).concat([
      ['inseam_cm', 'entrejambe']
    ]).concat(suppDisponibles ? [['head_cm', 'tour de tête']] : []).concat([
      ['shoe_size', 'pointure'], ['eye_color', 'couleur des yeux'], ['hair_color', 'couleur des cheveux']
    ]);
  }

  // Liste des points à corriger pour un profil.
  function analyser(p, photos) {
    var manquantes = mesuresAttendues(p).filter(function (m) { return p[m[0]] === null || p[m[0]] === undefined || p[m[0]] === ''; }).map(function (m) { return m[1]; });
    var t = ma2mTailles(p), libelles = { chest_cm: 'tour de poitrine', waist_cm: 'tour de taille', hips_cm: 'tour de bassin' };
    var aReprendre = t.aReprendre.map(function (c) { return libelles[c]; });
    var book = photos.filter(function (ph) { return ph.tri_statut !== 'ecartee'; });
    var photosPb = [];
    if (!book.some(function (ph) { return ph.principale; })) photosPb.push('ajoutez une photo de profil');
    if (!book.some(function (ph) { return ph.photo_couverture; })) photosPb.push('choisissez une photo de couverture');
    // Compcard : les cases non choisies sont complétées automatiquement avec les photos
    // du book (completerEmplacementsPhotos) ; un book suffisant suffit donc.
    if (book.length < BOOK_MINIMUM) photosPb.push('ajoutez des photos à votre book (' + book.length + ' sur ' + BOOK_MINIMUM + ' minimum)');
    // Remarques de la revue stricte des books (IA) : photos à remplacer ou proposées à la suppression
    book.forEach(function (ph) {
      if (ph.tri_statut !== 'a_verifier' || !ph.tri_raison) return;
      var raison = String(ph.tri_raison).replace(/^(Proposée à la suppression|À remplacer \([^)]*\))\s*:\s*/, '');
      photosPb.push('photo n°' + (ph.numero || '?') + ' à remplacer : ' + raison);
    });
    var aVerifier = t.aVerifier.map(function (c) { return libelles[c]; });
    var exces = t.exces ? { taille: t.generale, maximum: t.maximum, texte: ma2mTexteExces(t) } : null;
    return { manquantes: manquantes, aReprendre: aReprendre, aVerifier: aVerifier, exces: exces, photos: photosPb, aJour: !manquantes.length && !aReprendre.length && !aVerifier.length && !exces && !photosPb.length };
  }

  function message(p, a) {
    var l = ['Bonjour ' + prenomDe(p.full_name) + ',', '', 'Votre profil MA2M n’est pas encore complet. Voici ce qu’il vous reste à faire :'];
    if (a.manquantes.length) l.push('', '📏 Mensurations à compléter : ' + a.manquantes.join(', ') + '.');
    if (a.aReprendre.length) l.push('', '⚠️ Mensurations à reprendre (elles ne vont pas ensemble) : ' + a.aReprendre.join(', ') + '. Mesurez-vous avec un mètre ruban, sans serrer. Tant qu’elles ne sont pas corrigées, vos mensurations sont cachées sur votre fiche, et après 7 jours votre fiche est retirée du site.');
    if (a.aVerifier.length) l.push('', '⚠️ Mesure à vérifier (beaucoup trop grande par rapport aux autres) : ' + a.aVerifier.join(', ') + '.');
    if (a.exces) l.push('', '❌ ' + a.exces.texte[0], a.exces.texte.slice(1).map(function (x) { return '• ' + x; }).join('\n'));
    if (a.photos.length) l.push('', '📸 Photos :', a.photos.map(function (x) { return '• ' + x.charAt(0).toUpperCase() + x.slice(1); }).join('\n'));
    l.push('', 'Merci de vous rendre dans votre Espace mannequin pour compléter votre profil : ' + MA2M_SITE + '/espace-mannequin', '', 'L’agence Maître Akesse Model Management');
    return l.join('\n');
  }

  function ligneHtml(p, dates) {
    var a = p.analyse, deja = dates[p.id], wa = numeroWhatsApp(telephones[p.id]);
    var points = [];
    if (a.manquantes.length) points.push('<li><strong>Mensurations manquantes :</strong> ' + echapper(a.manquantes.join(', ')) + '</li>');
    if (a.aReprendre.length) points.push('<li class="rp-rouge"><strong>Mensurations à reprendre :</strong> ' + echapper(a.aReprendre.join(', ')) + '</li>');
    if (a.aVerifier.length) points.push('<li class="rp-rouge"><strong>Mesure à vérifier :</strong> ' + echapper(a.aVerifier.join(', ')) + '</li>');
    if (a.exces) points.push('<li class="rp-rouge"><strong>❌ Mensurations excessives :</strong> taille ' + echapper(a.exces.taille) + ' (maximum ' + echapper(a.exces.maximum) + ')</li>');
    a.photos.forEach(function (x) { points.push('<li><strong>Photo :</strong> ' + echapper(x) + '</li>'); });
    return '<div class="rp-profil' + (a.aJour ? ' rp-ok' : '') + '" data-profil="' + echapper(p.id) + '">' +
      '<label class="rp-entete">' + (a.aJour ? '' : '<input type="checkbox" class="rp-choix" data-id="' + echapper(p.id) + '">') +
      '<strong>' + echapper(p.full_name) + '</strong>' + (p.published ? '' : ' <span class="rp-gris">(non publiée)</span>') +
      ' <span class="rp-etat">' + (a.aJour ? '✓ À jour' : 'À compléter') + '</span>' +
      (deja ? ' <span class="rp-gris">· dernier message le ' + new Date(deja).toLocaleDateString('fr-FR') + '</span>' : '') +
      (!a.aJour && !wa ? ' <span class="rp-gris">· pas de numéro WhatsApp : le message sera copié, à coller où vous voulez</span>' : '') + '</label>' +
      (a.aJour ? '' : '<ul class="rp-points">' + points.join('') + '</ul>' +
        '<details class="rp-message"><summary>Voir / modifier le message</summary><textarea rows="10" data-id="' + echapper(p.id) + '">' + echapper(message(p, a)) + '</textarea></details>') +
      '</div>';
  }

  // Message envoyé AUJOURD'HUI : le profil passe dans « Messages envoyés » (replié).
  // Le lendemain, s'il n'est toujours pas à jour, il revient dans la liste.
  function envoyeAujourdhui(id, dates) {
    var d = (dates || envois())[id];
    return !!d && new Date(d).toDateString() === new Date().toDateString();
  }

  function afficher() {
    var zone = document.getElementById('rapport-profils-liste');
    var aCompleter = profils.filter(function (p) { return !p.analyse.aJour; });
    var dates = envois();
    var aEnvoyer = aCompleter.filter(function (p) { return !envoyeAujourdhui(p.id, dates); });
    var envoyes = aCompleter.filter(function (p) { return envoyeAujourdhui(p.id, dates); });
    var aJour = profils.filter(function (p) { return p.analyse.aJour; });
    zone.innerHTML = '<p class="rp-resume"><strong>' + profils.length + '</strong> profils passés en revue : <strong>' + aJour.length + '</strong> à jour, <strong>' + aCompleter.length + '</strong> à compléter' +
      (envoyes.length ? ' (dont <strong>' + envoyes.length + '</strong> déjà prévenue' + (envoyes.length > 1 ? 's' : '') + ' aujourd’hui)' : '') + '.</p>' +
      '<div class="rp-boutons"><button class="btn" type="button" id="rp-actualiser">🔄 Actualiser le rapport</button>' +
      '<button class="btn" type="button" id="rp-tout">Cocher toutes les mannequins à prévenir</button>' +
      '<button class="btn btn--principal" type="button" id="rp-envoyer" disabled>💬 Envoyer sur WhatsApp</button></div>' +
      '<p class="tdb-9" id="rp-aide">Cochez les mannequins, puis appuyez sur « Envoyer » : WhatsApp s’ouvre avec le message de la première, appuyez sur Envoyer dans WhatsApp, revenez ici et appuyez à nouveau pour la suivante. Chacune reçoit son propre message, puis passe dans « Messages envoyés ». « Actualiser » refait l’analyse pour voir qui a corrigé.</p>' +
      '<div id="rp-a-envoyer">' + aEnvoyer.map(function (p) { return ligneHtml(p, dates); }).join('') + '</div>' +
      '<details class="rp-groupe" id="rp-envoyes"' + (envoyes.length ? '' : ' hidden') + '><summary>Messages envoyés aujourd’hui (<span id="rp-nb-envoyes">' + envoyes.length + '</span>)</summary>' + envoyes.map(function (p) { return ligneHtml(p, dates); }).join('') + '</details>' +
      '<details class="rp-groupe"><summary>Profils à jour (' + aJour.length + ')</summary>' + aJour.map(function (p) { return ligneHtml(p, dates); }).join('') + '</details>';
    majBouton();
  }

  function choisis() {
    return Array.prototype.map.call(details.querySelectorAll('.rp-choix:checked'), function (c) { return c.dataset.id; });
  }
  function suivant() {
    return choisis().filter(function (id) { return !envoyesCetteFois[id]; })[0] || null;
  }
  function majBouton() {
    var b = document.getElementById('rp-envoyer'); if (!b) return;
    var liste = choisis(), id = suivant();
    var p = id && profils.find(function (x) { return x.id === id; });
    b.disabled = !p;
    b.textContent = p ? (numeroWhatsApp(telephones[id]) ? '💬 Envoyer à ' : '📋 Copier le message de ') + p.full_name + (liste.length > 1 ? ' (encore ' + (liste.length - 1) + ' après)' : '')
      : (Object.keys(envoyesCetteFois).length ? '✓ Tout le monde a été fait' : '💬 Envoyer sur WhatsApp');
  }

  // Profils avec les mensurations de l'Extension 121 ; tant que le SQL n'est pas
  // exécuté, relecture sans elles (et elles ne sont pas réclamées aux mannequins).
  var CHAMPS_PROFIL = 'id, full_name, category, published, height_cm, weight_kg, chest_cm, waist_cm, hips_cm, inseam_cm, shoe_size, eye_color, hair_color';
  async function lireProfils() {
    var lire = function (champs) { return lireToutesLignes(function () { return sb.from('model_profiles').select(champs).not('full_name', 'is', null).order('id'); }); };
    var r = await lire(CHAMPS_PROFIL + ', shoulder_cm, arm_cm, neck_cm, head_cm');
    suppDisponibles = !r.error;
    return r.error ? lire(CHAMPS_PROFIL) : r;
  }

  var enCours = false;
  async function charger() {
    if (enCours) return;
    enCours = true;
    try { await chargerInterne(); } finally { enCours = false; }
  }
  async function chargerInterne() {
    charge = true;
    var zone = document.getElementById('rapport-profils-liste');
    zone.textContent = 'Analyse des profils…';
    var r = await Promise.all([
      lireProfils(),
      lireToutesLignes(function () { return sb.from('model_photos').select('id, model_id, numero, principale, photo_couverture, compcard_ordre, tri_statut, tri_raison').order('id'); }),
      sb.rpc('contacts_mannequins_admin')
    ]);
    var pr = r[0], ph = r[1], tel = r[2];
    // Sans la liste complète des profils ou des photos, le rapport serait faux : on s'arrête.
    if (pr.error || ph.error) { charge = false; zone.textContent = 'Impossible de lire les profils ou les photos : ' + (pr.error || ph.error).message + '. Fermez et rouvrez la section pour réessayer.'; return; }
    var parModele = {}; ph.data.forEach(function (x) { (parModele[x.model_id] = parModele[x.model_id] || []).push(x); });
    telephones = {}; (tel.data || []).forEach(function (t) { telephones[t.model_id] = t.phone; });
    profils = pr.data.filter(function (p) { return String(p.full_name).trim(); }).map(function (p) {
      p.analyse = analyser(p, parModele[p.id] || []);
      return p;
    }).sort(function (a, b) { return String(a.full_name).localeCompare(String(b.full_name), 'fr'); });
    afficher();
  }

  details.addEventListener('toggle', function () { if (details.open && !charge) charger(); });
  details.addEventListener('change', function (e) {
    if (!e.target.classList || !e.target.classList.contains('rp-choix')) return;
    // recocher un profil déjà prévenu = le renvoyer (ex. WhatsApp n'est pas parti)
    if (e.target.checked) delete envoyesCetteFois[e.target.dataset.id];
    majBouton();
  });
  details.addEventListener('click', function (e) {
    if (e.target.id === 'rp-actualiser') {
      if (enCours) return;
      envoyesCetteFois = {};
      charger();
    } else if (e.target.id === 'rp-tout') {
      details.querySelectorAll('#rp-a-envoyer .rp-choix').forEach(function (c) { c.checked = true; });
      majBouton();
    } else if (e.target.id === 'rp-envoyer') {
      var id = suivant(); if (!id) return;
      var zoneTexte = details.querySelector('textarea[data-id="' + id + '"]');
      var texte = zoneTexte ? zoneTexte.value : '', numero = numeroWhatsApp(telephones[id]);
      if (numero) window.open('https://wa.me/' + numero + '?text=' + encodeURIComponent(texte), '_blank', 'noopener');
      else {
        // sans numéro : copie du message ; si la copie échoue, le message est montré
        // sélectionné (à copier à la main) et le profil n'est PAS noté comme prévenu
        var copie = navigator.clipboard ? navigator.clipboard.writeText(texte).then(function () { return true; }, function () { return false; }) : Promise.resolve(false);
        copie.then(function (ok) {
          if (ok) { marquerEnvoye(id, false); return; }
          var det = zoneTexte && zoneTexte.closest('details'); if (det) det.open = true;
          if (zoneTexte) { zoneTexte.focus(); zoneTexte.select(); }
          alert('Copie impossible sur cet appareil : le message est sélectionné, copiez-le à la main.');
        });
        return;
      }
      marquerEnvoye(id, true);
    }
  });
  function marquerEnvoye(id, whatsapp) {
    noterEnvoi(id); envoyesCetteFois[id] = true;
    // le profil quitte la liste « à prévenir » et passe dans « Messages envoyés »
    var ligne = details.querySelector('[data-profil="' + id + '"]'), groupe = document.getElementById('rp-envoyes');
    if (ligne && groupe) {
      var c = ligne.querySelector('.rp-choix'); if (c) c.checked = false;
      ligne.querySelector('.rp-entete').insertAdjacentHTML('beforeend', ' <span class="rp-envoye">' + (whatsapp ? '✓ WhatsApp ouvert' : '✓ Message copié') + '</span>');
      groupe.appendChild(ligne); groupe.hidden = false;
      document.getElementById('rp-nb-envoyes').textContent = groupe.querySelectorAll('.rp-profil').length;
    }
    majBouton();
  }
})();
