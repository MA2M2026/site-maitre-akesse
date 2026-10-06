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
  var envoyesCetteFois = {}; // file d'envoi : on passe à la suivante (la date reste notée pour la prochaine fois)
  var BOOK_MINIMUM = 6;
  var CLE_ENVOIS = 'ma2m_rapport_profils_envois';

  function echapper(t) { return echapperHtml(t); }
  function prenom(p) { return String(p.full_name || '').trim().split(/\s+/)[0] || ''; }
  function envois() { try { return JSON.parse(localStorage.getItem(CLE_ENVOIS) || '{}') || {}; } catch (e) { return {}; } }
  function noterEnvoi(id) { var o = envois(); o[id] = new Date().toISOString(); try { localStorage.setItem(CLE_ENVOIS, JSON.stringify(o)); } catch (e) {} }

  // Mensurations attendues (mêmes champs que l'étape « Informations physiques »).
  function mesuresAttendues(p) {
    var homme = p.category === 'homme';
    return [
      ['height_cm', 'taille'], ['weight_kg', 'poids'], ['chest_cm', 'tour de poitrine'], ['waist_cm', 'tour de taille'],
      ['hips_cm', homme ? 'tour de bassin' : 'tour de hanches']
    ].concat(homme ? [['neck_cm', 'tour de cou']] : []).concat([
      ['shoulder_cm', 'largeur d’épaules'], ['arm_cm', 'longueur de bras'], ['inseam_cm', 'entrejambe'],
      ['head_cm', 'tour de tête'], ['shoe_size', 'pointure'], ['eye_color', 'couleur des yeux'], ['hair_color', 'couleur des cheveux']
    ]);
  }

  // Liste des points à corriger pour un profil.
  function analyser(p, photos) {
    var manquantes = mesuresAttendues(p).filter(function (m) { return p[m[0]] === null || p[m[0]] === undefined || p[m[0]] === ''; }).map(function (m) { return m[1]; });
    var t = ma2mTailles(p), libelles = { chest_cm: 'tour de poitrine', waist_cm: 'tour de taille', hips_cm: 'tour de hanches' };
    var aReprendre = t.aReprendre.map(function (c) { return libelles[c]; });
    var book = photos.filter(function (ph) { return ph.tri_statut !== 'ecartee'; });
    var casesCompcard = {}; book.forEach(function (ph) { if (ph.compcard_ordre) casesCompcard[ph.compcard_ordre] = true; });
    var vides = 5 - Object.keys(casesCompcard).length;
    var photosPb = [];
    if (!book.some(function (ph) { return ph.principale; })) photosPb.push('ajoutez une photo de profil');
    if (!book.some(function (ph) { return ph.photo_couverture; })) photosPb.push('choisissez une photo de couverture');
    if (vides > 0) photosPb.push('complétez votre compcard (' + vides + ' case' + (vides > 1 ? 's' : '') + ' vide' + (vides > 1 ? 's' : '') + ')');
    if (book.length < BOOK_MINIMUM) photosPb.push('ajoutez des photos à votre book (' + book.length + ' sur ' + BOOK_MINIMUM + ' minimum)');
    // Remarques de la revue stricte des books (IA) : photos à remplacer ou proposées à la suppression
    book.forEach(function (ph) {
      if (ph.tri_statut !== 'a_verifier' || !ph.tri_raison) return;
      var raison = String(ph.tri_raison).replace(/^(Proposée à la suppression|À remplacer \([^)]*\))\s*:\s*/, '');
      photosPb.push('photo n°' + (ph.numero || '?') + ' à remplacer : ' + raison);
    });
    return { manquantes: manquantes, aReprendre: aReprendre, photos: photosPb, aJour: !manquantes.length && !aReprendre.length && !photosPb.length };
  }

  function message(p, a) {
    var l = ['Bonjour ' + (prenom(p) || '') + ',', '', 'Votre profil MA2M n’est pas encore complet. Voici ce qu’il vous reste à faire :'];
    if (a.manquantes.length) l.push('', '📏 Mensurations à compléter : ' + a.manquantes.join(', ') + '.');
    if (a.aReprendre.length) l.push('', '⚠️ Mensurations à reprendre (elles ne vont pas ensemble) : ' + a.aReprendre.join(', ') + '. Mesurez-vous avec un mètre ruban, sans serrer. Tant qu’elles ne sont pas corrigées, vos mensurations sont cachées sur votre fiche, et après 7 jours votre fiche est retirée du site.');
    if (a.photos.length) l.push('', '📸 Photos :', a.photos.map(function (x) { return '• ' + x.charAt(0).toUpperCase() + x.slice(1); }).join('\n'));
    l.push('', 'Merci de vous rendre dans votre Espace mannequin pour compléter votre profil : ' + MA2M_SITE + '/espace-mannequin', '', 'L’agence Maître Akesse Model Management');
    return l.join('\n');
  }

  function ligneHtml(p) {
    var a = p.analyse, deja = envois()[p.id], wa = numeroWhatsApp(telephones[p.id]);
    var points = [];
    if (a.manquantes.length) points.push('<li><strong>Mensurations manquantes :</strong> ' + echapper(a.manquantes.join(', ')) + '</li>');
    if (a.aReprendre.length) points.push('<li class="rp-rouge"><strong>Mensurations à reprendre :</strong> ' + echapper(a.aReprendre.join(', ')) + '</li>');
    a.photos.forEach(function (x) { points.push('<li><strong>Photo :</strong> ' + echapper(x) + '</li>'); });
    return '<div class="rp-profil' + (a.aJour ? ' rp-ok' : '') + '">' +
      '<label class="rp-entete">' + (a.aJour ? '' : '<input type="checkbox" class="rp-choix" data-id="' + echapper(p.id) + '"' + (wa ? '' : ' disabled') + '>') +
      '<strong>' + echapper(p.full_name) + '</strong>' + (p.published ? '' : ' <span class="rp-gris">(non publiée)</span>') +
      ' <span class="rp-etat">' + (a.aJour ? '✓ À jour' : 'À compléter') + '</span>' +
      (deja ? ' <span class="rp-gris">· message envoyé le ' + new Date(deja).toLocaleDateString('fr-FR') + '</span>' : '') +
      (!a.aJour && !wa ? ' <span class="rp-gris">· pas de numéro WhatsApp</span>' : '') + '</label>' +
      (a.aJour ? '' : '<ul class="rp-points">' + points.join('') + '</ul>' +
        '<details class="rp-message"><summary>Voir / modifier le message</summary><textarea rows="10" data-id="' + echapper(p.id) + '">' + echapper(message(p, a)) + '</textarea></details>') +
      '</div>';
  }

  function afficher() {
    var zone = document.getElementById('rapport-profils-liste');
    var aCompleter = profils.filter(function (p) { return !p.analyse.aJour; });
    zone.innerHTML = '<p class="rp-resume"><strong>' + profils.length + '</strong> profils passés en revue : <strong>' + (profils.length - aCompleter.length) + '</strong> à jour, <strong>' + aCompleter.length + '</strong> à compléter.</p>' +
      '<div class="rp-boutons"><button class="btn" type="button" id="rp-tout">Cocher tous les profils à compléter</button>' +
      '<button class="btn btn--principal" type="button" id="rp-envoyer" disabled>💬 Envoyer sur WhatsApp</button></div>' +
      '<p class="tdb-9" id="rp-aide">Cochez les mannequins, puis appuyez sur « Envoyer » : WhatsApp s’ouvre avec le message de la première, appuyez sur Envoyer dans WhatsApp, revenez ici et appuyez à nouveau pour la suivante. Chacune reçoit son propre message.</p>' +
      aCompleter.concat(profils.filter(function (p) { return p.analyse.aJour; })).map(ligneHtml).join('');
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
    b.textContent = p ? '💬 Envoyer à ' + p.full_name + ' (' + (liste.indexOf(id) + 1) + ' sur ' + liste.length + ')'
      : (liste.length ? '✓ Tout le monde a été fait' : '💬 Envoyer sur WhatsApp');
  }

  async function charger() {
    charge = true;
    var zone = document.getElementById('rapport-profils-liste');
    zone.textContent = 'Analyse des profils…';
    var pr = await sb.from('model_profiles').select('id, full_name, category, published, height_cm, weight_kg, chest_cm, waist_cm, hips_cm, inseam_cm, shoe_size, eye_color, hair_color').not('full_name', 'is', null).order('full_name');
    if (pr.error) { zone.textContent = 'Erreur : ' + pr.error.message; return; }
    // Mensurations de l'Extension 121 : requête à part (vide si le SQL n'est pas encore exécuté).
    var supp = {};
    var rs = await sb.from('model_profiles').select('id, shoulder_cm, arm_cm, neck_cm, head_cm');
    if (!rs.error) (rs.data || []).forEach(function (m) { supp[m.id] = m; });
    var ph = await sb.from('model_photos').select('model_id, numero, principale, photo_couverture, compcard_ordre, tri_statut, tri_raison').limit(10000);
    var parModele = {}; (ph.data || []).forEach(function (x) { (parModele[x.model_id] = parModele[x.model_id] || []).push(x); });
    var tel = await sb.rpc('contacts_mannequins_admin');
    telephones = {}; (tel.data || []).forEach(function (t) { telephones[t.model_id] = t.phone; });
    profils = (pr.data || []).filter(function (p) { return String(p.full_name).trim(); }).map(function (p) {
      p = Object.assign(p, supp[p.id] || { shoulder_cm: '', arm_cm: '', neck_cm: '', head_cm: '' });
      p.analyse = analyser(p, parModele[p.id] || []);
      return p;
    });
    afficher();
  }

  details.addEventListener('toggle', function () { if (details.open && !charge) charger(); });
  details.addEventListener('change', function (e) { if (e.target.classList && e.target.classList.contains('rp-choix')) majBouton(); });
  details.addEventListener('click', function (e) {
    if (e.target.id === 'rp-tout') {
      details.querySelectorAll('.rp-choix:not(:disabled)').forEach(function (c) { c.checked = true; });
      majBouton();
    } else if (e.target.id === 'rp-envoyer') {
      var id = suivant(); if (!id) return;
      var zoneTexte = details.querySelector('textarea[data-id="' + id + '"]');
      window.open('https://wa.me/' + numeroWhatsApp(telephones[id]) + '?text=' + encodeURIComponent(zoneTexte ? zoneTexte.value : ''), '_blank', 'noopener');
      noterEnvoi(id); envoyesCetteFois[id] = true;
      var entete = details.querySelector('.rp-choix[data-id="' + id + '"]');
      if (entete) entete.parentNode.insertAdjacentHTML('beforeend', ' <span class="rp-envoye">✓ WhatsApp ouvert</span>');
      majBouton();
    }
  });
})();
