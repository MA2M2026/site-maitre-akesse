// Tableau de bord — « Rapport des profils » (demande de la propriétaire, 06/10/2026 ;
// nouvelle version le 07/10/2026). Le site passe en revue chaque mannequin et rédige
// pour elle un rapport de SENSIBILISATION (jamais de menace) : civilité et nom, points
// forts, profil complet à x %, 3 priorités, puis identité, expérience et parcours,
// mensurations (tailles calculées haut / bas / générale : femmes S ou M recommandé, L toléré ;
// hommes M ou L recommandé, XL toléré),
// et les photos en dernier. Calculé par le site lui-même : AUCUNE remarque de l'IA
// (une même tenue sous plusieurs angles ou le logo d'un organisateur ne sont pas des
// erreurs). On coche plusieurs mannequins et chacune reçoit SON message, séparément,
// par WhatsApp (un appui par personne : l'envoi automatique n'existe qu'avec l'offre
// payante de WhatsApp). Les envois sont notés sur cet appareil.
(function () {
  var details = document.getElementById('rapport-profils-details');
  if (!details || typeof sb === 'undefined' || !sb) return;
  var charge = false, profils = [], telephones = {};
  var suppDisponibles = true; // colonnes de l'Extension 121 lisibles ?
  var envoyesCetteFois = {}; // file d'envoi : on passe à la suivante (la date reste notée pour la prochaine fois)
  var BOOK_MINIMUM = MA2M_PHOTOS_MINIMUM; // js/analyse-profil.js
  // Historique des envois remis à zéro avec la nouvelle version du rapport (07/10/2026).
  var CLE_ENVOIS = 'ma2m_rapport_profils_envois_v2';

  function echapper(t) { return echapperHtml(t); }
  function envois() { try { return JSON.parse(localStorage.getItem(CLE_ENVOIS) || '{}') || {}; } catch (e) { return {}; } }
  function noterEnvoi(id) { var o = envois(); o[id] = new Date().toISOString(); try { localStorage.setItem(CLE_ENVOIS, JSON.stringify(o)); } catch (e) {} }

  function civilite(p) { return (p.category === 'homme' ? 'Monsieur ' : 'Mlle ') + String(p.full_name || '').trim(); }

  // Libellés courts (liste du tableau de bord) des points à compléter.
  var LIBELLES = {
    naissance: 'date de naissance', nationalite: 'nationalité', ville: 'ville de résidence',
    presentation: 'présentation', presentationCourte: 'présentation trop courte', instagram: 'Instagram (ou « Je n’ai pas Instagram »)',
    experiences: 'expériences', etudes: 'niveau d’études', formation: 'formations', langues: 'langues parlées',
    profil: 'photo de profil non choisie', couverture: 'couverture non choisie', identiques: 'même photo en profil et en couverture', book: 'moins de 10 photos'
  };

  function barre(score) { var n = Math.round(score / 10); return '▰'.repeat(n) + '▱'.repeat(10 - n); }
  function joindre(liste) { return liste.length > 1 ? liste.slice(0, -1).join(', ') + ' et ' + liste[liste.length - 1] : liste[0] || ''; }

  // Textes du message WhatsApp, élément par élément.
  var TEXTES = {
    naissance: 'Votre date de naissance', nationalite: 'Votre nationalité', ville: 'Votre ville de résidence',
    presentation: 'Une présentation de quelques phrases _(votre parcours, votre style, ce qui vous distingue)_',
    presentationCourte: 'Une présentation un peu plus détaillée : _quelques phrases sur votre parcours, votre style, ce qui vous distingue_',
    instagram: 'Votre compte Instagram _(ou cochez « Je n’ai pas Instagram »)_',
    experiences: 'Vos expériences : défilés, shootings, castings, événements. _Même les plus petites comptent !_',
    etudes: 'Votre niveau d’études', langues: 'Les langues que vous parlez'
  };
  // Diagnostic des photos, tel que la fiche publique les montre.
  function lignesPhotos(a) {
    var v = a.photosVues, r = [];
    if (!a.nbPhotos) r.push('• Votre book est vide : ajoutez vos photos dans votre Espace, puis choisissez une *photo de profil* (un portrait) et une *autre photo* pour la couverture.');
    else if (a.nbPhotos === 1) r.push('• Vous n’avez qu’*une seule photo* : ajoutez-en d’autres, puis ' + (v.profilChoisi ? 'choisissez une *autre photo* pour la couverture.' : 'choisissez une *photo de profil* (un portrait) et une *autre photo* pour la couverture.'));
    else if (!v.profilChoisi && !v.couvertureChoisie) r.push('• Vous n’avez pas encore choisi votre *photo de profil* ni votre *photo de couverture*. Votre fiche affiche donc *la même photo aux deux endroits*. Choisissez un portrait pour le profil et *une autre photo* pour la couverture, par exemple une photo en plein pied.');
    else {
      if (!v.profilChoisi) r.push('• Choisissez votre *photo de profil* (un portrait) : pour l’instant, le site prend automatiquement votre plus ancienne photo.');
      if (!v.couvertureChoisie) r.push('• Choisissez votre *photo de couverture* : pour l’instant, votre fiche reprend votre photo de profil.');
      else if (v.identiques) r.push('• Votre photo de profil et votre photo de couverture sont *la même photo* : remplacez l’une des deux par une autre photo de votre book.');
    }
    var reste = BOOK_MINIMUM - a.nbPhotos;
    if (reste > 0) r.push('• ' + (a.nbPhotos ? 'Vous avez publié ' + a.nbPhotos + ' photo' + (a.nbPhotos > 1 ? 's' : '') + '. Il' : 'Il') + ' vous reste *' + reste + ' photo' + (reste > 1 ? 's' : '') + ' à publier* pour arriver au minimum de *' + BOOK_MINIMUM + ' photos*, dans le Book ou dans Lifestyle, avec des tenues et des ambiances variées.');
    return r;
  }

  // Message WhatsApp (*gras*, _italique_). Décision de la propriétaire (07/10/2026, soir) :
  // seulement ce qui reste à régler, bloc par bloc, avec les mêmes chiffres que les ronds
  // rouges de l'Espace mannequin (ma2mPointsParBloc, js/analyse-profil.js). Ce qui est réglé
  // disparaît, sans « bravo » ; plus de points forts, de priorités ni de « Bon à savoir ».
  var BLOCS_MESSAGE = { identite: ['👤', 'Identité'], physique: ['📏', 'Physique (mensurations)'], formation: ['🎓', 'Formation'], experiences: ['👠', 'Expérience'], photos: ['📸', 'Photos'] };
  function titreBloc(k, n) { return BLOCS_MESSAGE[k][0] + ' *' + BLOCS_MESSAGE[k][1] + (n ? ' : ' + n + ' élément' + (n > 1 ? 's' : '') : '') + '*'; }
  function message(p, a) {
    var pts = ma2mPointsParBloc(a);
    var l = ['Bonjour *' + civilite(p) + '*,', '',
      'Voici ce qu’il reste à compléter sur votre profil. Dans votre Espace mannequin, chaque bloc concerné porte un *rond rouge* 🔴 avec le même chiffre, et les cases à remplir sont encadrées en rouge.',
      '', '📊 *Votre profil est complet à ' + a.score + ' %*', barre(a.score)];
    if (pts.nb.identite) l.push('', titreBloc('identite', pts.nb.identite), a.identite.map(function (k) { return '• ' + TEXTES[k]; }).join('\n'));
    if (pts.nb.physique || a.exces) { l.push('', titreBloc('physique', pts.nb.physique)); mensurations(l, a); }
    if (pts.nb.formation) l.push('', titreBloc('formation', pts.nb.formation), '• ' + TEXTES.etudes);
    if (pts.nb.experiences) l.push('', titreBloc('experiences', pts.nb.experiences), pts.elements.experiences.map(function (k) { return '• ' + TEXTES[k]; }).join('\n'));
    if (pts.nb.photos) l.push('', titreBloc('photos', pts.nb.photos), lignesPhotos(a).join('\n'));
    l.push('', '👉 *Pour mettre votre profil à jour*, rendez-vous dans votre Espace mannequin :', MA2M_SITE + '/espace-mannequin',
      '', '🤝 _L’agence reste à vos côtés : pour toute question, écrivez-nous sur WhatsApp._',
      '', '*Maître Akesse Model Management*', 'Le ' + new Date().toLocaleDateString('fr-FR'));
    return l.join('\n');
  }

  // Mensurations : seulement ce qui reste à régler (manquantes, incohérentes, trop grandes).
  function mensurations(l, a) {
    if (a.manquantes.length) l.push('📝 À compléter : ' + joindre(a.manquantes) + '.');
    if (a.aReprendre.length) l.push('⚠️ Votre ' + joindre(a.aReprendre) + ' ne vont pas ensemble : une mesure est sûrement fausse. Mesurez-vous avec un mètre ruban, sans serrer. _En attendant, vos mensurations restent cachées sur votre fiche._');
    else if (a.exces) l.push('💬 Votre taille calculée dépasse aujourd’hui la taille ' + a.tolereLettre + ' ' + (a.homme ? '_(pour les hommes, l’agence recommande M ou L, XL tolérée)_' : '_(l’agence recommande S ou M, L tolérée)_') + '. Commencez par vérifier vos mesures _(mètre ruban à plat, sans serrer, sans vêtement épais)_ : une erreur de saisie est vite arrivée. Si elles sont justes, l’agence est là pour en parler avec vous et vous conseiller.');
    if (a.aVerifier.length) l.push('🔎 À vérifier : votre ' + joindre(a.aVerifier) + ' _(beaucoup plus grand que vos autres mesures, sans doute une erreur de saisie)_.');
  }

  function ligneHtml(p, dates) {
    var a = p.analyse, deja = dates[p.id], wa = numeroWhatsApp(telephones[p.id]);
    var points = [];
    if (a.exces) points.push('<li class="rp-rouge"><strong>Mensurations :</strong> taille calculée au-delà de ' + echapper(a.tolereLettre) + '</li>');
    a.mesures.forEach(function (x) { points.push('<li' + (/^À reprendre|^À vérifier/.test(x) ? ' class="rp-rouge"' : '') + '><strong>Mensurations :</strong> ' + echapper(x) + '</li>'); });
    var lib = function (liste) { return echapper(liste.map(function (k) { return LIBELLES[k]; }).join(' ; ')); };
    if (a.identite.length) points.push('<li><strong>Identité :</strong> ' + lib(a.identite) + '</li>');
    if (a.parcours.length) points.push('<li><strong>Parcours :</strong> ' + lib(a.parcours) + '</li>');
    if (a.photos.length) points.push('<li><strong>Photos :</strong> ' + lib(a.photos) + ' (' + a.nbPhotos + ' photo' + (a.nbPhotos > 1 ? 's' : '') + ')</li>');
    return '<div class="rp-profil' + (a.aJour ? ' rp-ok' : '') + '" data-profil="' + echapper(p.id) + '">' +
      '<label class="rp-entete">' + (a.aJour ? '' : '<input type="checkbox" class="rp-choix" data-id="' + echapper(p.id) + '">') +
      '<strong>' + echapper(civilite(p)) + '</strong>' + (p.published ? '' : ' <span class="rp-gris">(non publiée)</span>') +
      ' <span class="rp-etat">' + (a.aJour ? '✓ À jour' : 'Complet à ' + a.score + ' %') + '</span>' +
      (deja ? ' <span class="rp-gris rp-date-envoi">· dernier message le ' + new Date(deja).toLocaleDateString('fr-FR') + '</span>' : '') +
      (!a.aJour && !wa ? ' <span class="rp-gris">· pas de numéro WhatsApp : le message sera copié, à coller où vous voulez</span>' : '') + '</label>' +
      (a.aJour ? '' : '<ul class="rp-points">' + points.join('') + '</ul>' +
        '<details class="rp-message"><summary>Voir / modifier le message</summary><textarea rows="16" data-id="' + echapper(p.id) + '">' + echapper(message(p, a)) + '</textarea></details>') +
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
      '<button class="btn" type="button" id="rp-reinitialiser">↺ Réinitialiser l’historique des envois</button>' +
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

  // Profils avec les mensurations de l'Extension 121 et la case « pas d'Instagram »
  // (Extension 126) ; si une de ces colonnes manque, relecture sans elles.
  var CHAMPS_PROFIL = 'id, full_name, category, published, height_cm, weight_kg, chest_cm, waist_cm, hips_cm, inseam_cm, shoe_size, eye_color, hair_color, ' +
    'date_naissance, nationalite, city, bio, instagram, niveau_etude, formation_mannequin, languages, niveau_mannequin, years_experience';
  async function lireProfils() {
    var lire = function (champs) { return lireToutesLignes(function () { return sb.from('model_profiles').select(champs).not('full_name', 'is', null).order('id'); }); };
    var r = await lire(sansChampsPrives(CHAMPS_PROFIL) + ', shoulder_cm, arm_cm, neck_cm');
    suppDisponibles = !r.error;
    if (r.error) r = await lire(sansChampsPrives(CHAMPS_PROFIL));
    // Date de naissance, nationalité : lues par la fonction sécurisée (Extension 131).
    if (!r.error) await completerProfilsPrives(r.data);
    // Case « Je n'ai pas Instagram » (Extension 126), lue à part : si la colonne manque, rien d'autre n'est perdu.
    var si = await lire('id, sans_instagram');
    if (!r.error && !si.error) { var sans = {}; si.data.forEach(function (x) { sans[x.id] = x.sans_instagram; }); r.data.forEach(function (x) { x.sans_instagram = sans[x.id] === true; }); }
    return r;
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
      lireToutesLignes(function () { return sb.from('model_photos').select('id, model_id, principale, photo_couverture, tri_statut, created_at').order('id'); }),
      sb.rpc('contacts_mannequins_admin'),
      lireToutesLignes(function () { return sb.from('model_projects').select('id, model_id').order('id'); })
    ]);
    var pr = r[0], ph = r[1], tel = r[2], pj = r[3];
    var projets = {}; (pj.data || []).forEach(function (x) { projets[x.model_id] = (projets[x.model_id] || 0) + 1; });
    // Sans la liste complète des profils ou des photos, le rapport serait faux : on s'arrête.
    if (pr.error || ph.error || pj.error) { charge = false; zone.textContent = 'Impossible de lire les profils, les photos ou les expériences : ' + (pr.error || ph.error || pj.error).message + '. Fermez et rouvrez la section pour réessayer.'; return; }
    // Les photos écartées du book (masquées sur la fiche publique) ne comptent pas.
    var parModele = {}; ph.data.filter(function (x) { return x.tri_statut !== 'ecartee'; }).forEach(function (x) { (parModele[x.model_id] = parModele[x.model_id] || []).push(x); });
    telephones = {}; (tel.data || []).forEach(function (t) { telephones[t.model_id] = t.phone; });
    profils = pr.data.filter(function (p) { return String(p.full_name).trim(); }).map(function (p) {
      p.analyse = ma2mAnalyserProfil(p, parModele[p.id] || [], projets[p.id] || 0, suppDisponibles);
      return p;
    }).sort(function (a, b) { return String(a.full_name).localeCompare(String(b.full_name), 'fr'); });
    afficher();
  }

  details.addEventListener('toggle', function () { if (details.open && !charge) void charger(); });
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
      void charger();
    } else if (e.target.id === 'rp-reinitialiser') {
      if (!confirm('Effacer l’historique des messages envoyés (sur cet appareil) ? Toutes les mannequins à compléter reviendront dans la liste.')) return;
      try { localStorage.removeItem(CLE_ENVOIS); localStorage.removeItem('ma2m_rapport_profils_envois'); } catch (err) {}
      envoyesCetteFois = {};
      // Sans tout reconstruire : les messages modifiés et les cases cochées restent tels quels.
      var aEnvoyer = document.getElementById('rp-a-envoyer'), groupe = document.getElementById('rp-envoyes');
      if (groupe) { groupe.querySelectorAll('.rp-profil').forEach(function (x) { aEnvoyer.appendChild(x); }); groupe.hidden = true; document.getElementById('rp-nb-envoyes').textContent = '0'; }
      details.querySelectorAll('.rp-envoye, .rp-date-envoi').forEach(function (x) { x.remove(); });
      majBouton();
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
        void copie.then(function (ok) {
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
