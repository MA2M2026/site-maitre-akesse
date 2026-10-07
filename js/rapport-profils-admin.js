// Tableau de bord — « Rapport des profils » (demande de la propriétaire, 06/10/2026 ;
// nouvelle version le 07/10/2026). Le site passe en revue chaque mannequin et rédige
// pour elle un rapport de SENSIBILISATION (jamais de menace) : civilité et nom, points
// forts, profil complet à x %, 3 priorités, puis identité, expérience et parcours,
// mensurations (tailles calculées haut / bas / générale : S ou M recommandé, L toléré),
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
  var BOOK_MINIMUM = 6;
  // Historique des envois remis à zéro avec la nouvelle version du rapport (07/10/2026).
  var CLE_ENVOIS = 'ma2m_rapport_profils_envois_v2';
  // Deux catégories de photos (Book / Lifestyle) : expliquées dans le rapport une fois en service.
  var CATEGORIES_PHOTOS_ACTIVES = false;

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
      ['inseam_cm', 'entrejambe'],
      ['shoe_size', 'pointure'], ['eye_color', 'couleur des yeux'], ['hair_color', 'couleur des cheveux']
    ]);
  }

  function vide(v) { return v === null || v === undefined || String(v).trim() === ''; }
  function civilite(p) { return (p.category === 'homme' ? 'Monsieur ' : 'Mlle ') + String(p.full_name || '').trim(); }

  // Libellés courts (liste du tableau de bord) des points à compléter.
  var LIBELLES = {
    naissance: 'date de naissance', nationalite: 'nationalité', ville: 'ville de résidence',
    presentation: 'présentation', presentationCourte: 'présentation trop courte', instagram: 'Instagram (ou « Je n’ai pas Instagram »)',
    experiences: 'expériences', etudes: 'niveau d’études', formation: 'formations', langues: 'langues parlées',
    profil: 'photo de profil', couverture: 'photo de couverture', identiques: 'profil et couverture identiques', book: 'book trop léger'
  };

  // Analyse d'un profil : chaque rubrique liste ses points à compléter (des clés) ; le
  // score compte les éléments déjà en place. Rien n'est calculé par l'IA.
  function analyser(p, photos, nbProjets) {
    var points = 0, total = 0;
    function manque(liste, cle, ok) { total++; if (ok) points++; else liste.push(cle); }
    var a = { identite: [], parcours: [], mesures: [], photos: [], forts: [], priorites: [], nbPhotos: photos.length, nbProjets: nbProjets };

    manque(a.identite, 'naissance', !vide(p.date_naissance));
    manque(a.identite, 'nationalite', !vide(p.nationalite));
    manque(a.identite, 'ville', !vide(p.city));
    // Présentation : absente, ou trop courte (moins de 80 caractères, une phrase à peine)
    if (vide(p.bio)) manque(a.identite, 'presentation', false);
    else manque(a.identite, 'presentationCourte', String(p.bio).trim().length >= 80);
    manque(a.identite, 'instagram', !vide(p.instagram) || p.sans_instagram === true);

    // New Face (débutante) : ne pas encore avoir d'expérience est normal — ni compté, ni réclamé.
    a.newFace = niveauNormalise(p.niveau_mannequin, p.years_experience) === 'New Face';
    if (!a.newFace || nbProjets > 0) manque(a.parcours, 'experiences', nbProjets > 0);
    manque(a.parcours, 'formation', !vide(p.formation_mannequin));
    manque(a.parcours, 'etudes', !vide(p.niveau_etude));
    manque(a.parcours, 'langues', !vide(p.languages));

    // Mensurations
    a.manquantes = mesuresAttendues(p).filter(function (m) { return vide(p[m[0]]); }).map(function (m) { return m[1]; });
    total++; if (!a.manquantes.length) points++;
    var t = ma2mTailles(p), libelles = { chest_cm: 'tour de poitrine', waist_cm: 'tour de taille', hips_cm: 'tour de bassin' };
    a.aReprendre = t.aReprendre.map(function (c) { return libelles[c]; });
    a.aVerifier = t.aVerifier.map(function (c) { return libelles[c]; });
    a.exces = !!t.exces;
    total++; if (!a.aReprendre.length && !a.aVerifier.length && !a.exces) points++;
    a.tailles = t.aReprendre.length ? null : { haut: t.haut && t.haut.lettre, bas: t.bas && t.bas.lettre, generale: t.generale };
    a.tolere = !a.exces && [t.haut, t.bas].some(function (x) { return x && x.lettre === 'L'; });
    if (a.manquantes.length) a.mesures.push('À compléter : ' + a.manquantes.join(', '));
    if (a.aReprendre.length) a.mesures.push('À reprendre : ' + a.aReprendre.join(' et '));
    if (a.aVerifier.length) a.mesures.push('À vérifier : ' + a.aVerifier.join(', '));

    // Photos (en dernier)
    var principale = photos.filter(function (ph) { return ph.principale; })[0];
    var couverture = photos.filter(function (ph) { return ph.photo_couverture; })[0];
    manque(a.photos, 'profil', !!principale);
    manque(a.photos, 'couverture', !!couverture);
    if (principale && couverture) manque(a.photos, 'identiques', principale.id !== couverture.id);
    manque(a.photos, 'book', photos.length >= BOOK_MINIMUM);

    a.score = total ? Math.round(points * 100 / total) : 0;

    // Points forts (3 au plus)
    if (p.published) a.forts.push('votre fiche est en ligne sur le site de l’agence');
    if (!a.manquantes.length && !a.aReprendre.length && !a.exces) a.forts.push('vos mensurations sont complètes');
    if (nbProjets > 0) a.forts.push(nbProjets > 1 ? nbProjets + ' expériences sont déjà renseignées' : 'une première expérience est déjà renseignée');
    if (photos.length >= BOOK_MINIMUM) a.forts.push('votre book compte déjà ' + photos.length + ' photos');
    a.forts = a.forts.slice(0, 3);

    // 3 priorités, de la plus importante à la moins importante
    if (a.exces || a.aReprendre.length || a.aVerifier.length) a.priorites.push('Vérifier vos mensurations');
    else if (a.manquantes.length) a.priorites.push('Compléter vos mensurations');
    if (a.identite.length) a.priorites.push('Compléter votre identité (' + a.identite.length + ' élément' + (a.identite.length > 1 ? 's' : '') + ')');
    if (a.parcours.length) a.priorites.push(a.parcours.indexOf('experiences') !== -1 ? 'Ajouter vos expériences' : 'Compléter votre parcours');
    if (a.photos.length) a.priorites.push('Enrichir vos photos');
    a.priorites = a.priorites.slice(0, 3);
    a.aJour = !a.identite.length && !a.parcours.length && !a.mesures.length && !a.exces && !a.photos.length;
    return a;
  }

  function barre(score) { var n = Math.round(score / 10); return '▰'.repeat(n) + '▱'.repeat(10 - n); }
  function joindre(liste) { return liste.length > 1 ? liste.slice(0, -1).join(', ') + ' et ' + liste[liste.length - 1] : liste[0] || ''; }

  // Message WhatsApp (*gras*, _italique_) — version choisie par la propriétaire le
  // 07/10/2026 (la première proposée) : points forts, score, priorités, puis chaque
  // rubrique à compléter, les mensurations toujours expliquées, les photos en dernier
  // avec les deux catégories (Book / Lifestyle).
  var TEXTES = {
    naissance: 'Votre date de naissance', nationalite: 'Votre nationalité', ville: 'Votre ville de résidence',
    presentation: 'Une présentation de quelques phrases _(votre parcours, votre style, ce qui vous distingue)_',
    presentationCourte: 'Une présentation un peu plus détaillée : _quelques phrases sur votre parcours, votre style, ce qui vous distingue_',
    instagram: 'Votre compte Instagram _(ou cochez « Je n’ai pas Instagram »)_',
    experiences: 'Vos expériences : défilés, shootings, castings, événements. _Même les plus petites comptent !_',
    formation: 'Vos formations de mannequinat _(ou « aucune » si vous débutez)_',
    etudes: 'Votre niveau d’études', langues: 'Les langues que vous parlez'
  };
  function message(p, a) {
    var l = ['Bonjour *' + civilite(p) + '*,', '',
      'Merci pour votre engagement aux côtés de *Maître Akesse Model Management*. Voici le point sur votre profil, pour vous aider à le rendre encore plus attractif auprès des recruteurs et des organisateurs.'];
    if (a.forts.length) { var f = joindre(a.forts); l.push('', '✨ *Vos points forts :* ' + f + '.'); }
    l.push('', '📊 *Votre profil est complet à ' + a.score + ' %*', barre(a.score));
    if (a.priorites.length) l.push('', '🎯 *Vos priorités :*', a.priorites.map(function (x, i) { return ['1️⃣', '2️⃣', '3️⃣'][i] + ' ' + x; }).join('\n'));
    if (a.identite.length) l.push('', '👤 *À ajouter à votre identité :*', a.identite.map(function (k) { return '• ' + TEXTES[k]; }).join('\n'));
    if (a.newFace && !a.nbProjets) l.push('', '🌱 *Vous débutez en tant que New Face :* c’est tout à fait normal de ne pas encore avoir d’expérience. _Dès votre premier casting, shooting ou défilé, pensez à l’ajouter dans votre Espace._');
    if (a.parcours.length) l.push('', '🏆 *À ajouter à votre ' + (a.newFace && !a.nbProjets ? 'parcours' : 'expérience et à votre parcours') + ' :*', a.parcours.map(function (k) { return '• ' + TEXTES[k]; }).join('\n'));

    // Mensurations : toujours expliquées, pour que la mannequin connaisse ses tailles exactes
    l.push('', '📏 *Vos mensurations*');
    if (a.tailles && (a.tailles.haut || a.tailles.bas)) {
      l.push('_Calculées automatiquement par le site d’après vos mesures :_ taille haut *' + (a.tailles.haut || 'non calculée') + '*, taille bas *' + (a.tailles.bas || 'non calculée') + '*, taille générale *' + (a.tailles.generale || 'non calculée') + '*.');
    }
    l.push('L’agence recommande les tailles *S ou M*. La taille *L* est tolérée. Connaître vos tailles exactes vous aide à garder votre silhouette et à ne pas dépasser ces repères.');
    if (a.aReprendre.length) l.push('⚠️ Votre ' + joindre(a.aReprendre) + ' ne vont pas ensemble : une mesure est sûrement fausse. Mesurez-vous avec un mètre ruban, sans serrer. _En attendant, vos mensurations restent cachées sur votre fiche._');
    else if (a.exces) l.push('💬 Votre taille calculée dépasse aujourd’hui la taille L. Commencez par vérifier vos mesures _(mètre ruban à plat, sans serrer, sans vêtement épais)_ : une erreur de saisie est vite arrivée. Si elles sont justes, l’agence est là pour en parler avec vous et vous conseiller.');
    else if (a.tolere) l.push('👌 Vous êtes en taille L : elle est acceptée. Veillez simplement à ne pas aller au-delà.');
    else if (a.tailles && (a.tailles.haut || a.tailles.bas)) l.push('✅ Vous êtes dans les tailles recommandées : bravo, continuez ainsi.');
    if (a.aVerifier.length) l.push('🔎 À vérifier : votre ' + joindre(a.aVerifier) + ' _(beaucoup plus grand que vos autres mesures, sans doute une erreur de saisie)_.');
    if (a.manquantes.length) l.push('📝 À compléter : ' + joindre(a.manquantes) + '.');

    // Photos (en dernier)
    if (a.photos.length) {
      l.push('', '📸 *Vos photos :*');
      if (a.photos.indexOf('profil') !== -1) l.push('• Ajoutez une *photo de profil*.');
      if (a.photos.indexOf('couverture') !== -1) l.push('• Choisissez une *photo de couverture*.');
      if (a.photos.indexOf('identiques') !== -1) l.push('• Votre photo de profil et votre photo de couverture sont *la même photo* : choisissez une autre photo pour la couverture, votre book n’en sera que plus riche.');
      if (a.photos.indexOf('book') !== -1) l.push('• Votre book n’est pas encore assez riche _(' + a.nbPhotos + ' photo' + (a.nbPhotos > 1 ? 's' : '') + ')_ : ajoutez-en pour arriver à *' + BOOK_MINIMUM + ' au moins*, avec des tenues et des ambiances variées.');
    }
    if (CATEGORIES_PHOTOS_ACTIVES) l.push('', '💡 *Bon à savoir :* vos photos sont désormais rangées automatiquement en deux catégories, _vous n’avez rien à faire_ :',
      '📒 *Book* : les photos professionnelles _(shootings, défilés, campagnes)_',
      '🌿 *Lifestyle / digitales* : les polaroïds, les photos que vous aimez, vos castings et vos sorties',
      'Plusieurs photos dans la même tenue sous différents angles, ou avec le logo d’un organisateur, sont tout à fait normales.');

    l.push('', '👉 *Pour mettre votre profil à jour*, rendez-vous dans votre Espace mannequin :', MA2M_SITE + '/espace-mannequin',
      '', '🤝 _L’agence reste à vos côtés : pour toute question, écrivez-nous sur WhatsApp._',
      '', '*Maître Akesse Model Management*', 'Le ' + new Date().toLocaleDateString('fr-FR'));
    return l.join('\n');
  }

  function ligneHtml(p, dates) {
    var a = p.analyse, deja = dates[p.id], wa = numeroWhatsApp(telephones[p.id]);
    var points = [];
    if (a.exces) points.push('<li class="rp-rouge"><strong>Mensurations :</strong> taille calculée au-delà de L</li>');
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
    var r = await lire(CHAMPS_PROFIL + ', shoulder_cm, arm_cm, neck_cm');
    suppDisponibles = !r.error;
    if (r.error) r = await lire(CHAMPS_PROFIL);
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
      lireToutesLignes(function () { return sb.from('model_photos').select('id, model_id, principale, photo_couverture, tri_statut').order('id'); }),
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
      p.analyse = analyser(p, parModele[p.id] || [], projets[p.id] || 0);
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
