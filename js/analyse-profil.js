// Analyse d'un profil de mannequin : règle UNIQUE, partagée par le Rapport des profils
// du tableau de bord (js/rapport-profils-admin.js) et les pastilles rouges de l'Espace
// mannequin (js/espace-mannequin.js), décision de la propriétaire du 07/10/2026 : ce que
// la mannequin voit sur le site correspond toujours au message qu'elle reçoit.
// Entrée : une ligne model_profiles (noms de colonnes de la base), ses photos (hors
// photos écartées) et son nombre d'expériences. Dépend de js/app.js (niveauNormalise,
// photosAffichees) et de js/tailles.js (ma2mTailles). Rien n'est calculé par l'IA.

// 10 photos au moins, Book et Lifestyle ensemble ; à partir de 10, le book est riche.
var MA2M_PHOTOS_MINIMUM = 10;

// Mensurations attendues (mêmes champs que l'étape « Informations physiques »).
function ma2mMesuresAttendues(p, avecSupp) {
  var homme = p.category === 'homme';
  return [
    ['height_cm', 'taille'], ['weight_kg', 'poids'], ['chest_cm', 'tour de poitrine'], ['waist_cm', 'tour de taille'],
    ['hips_cm', 'tour de bassin']
  ].concat(avecSupp ? (homme ? [['neck_cm', 'tour de cou']] : []).concat([['shoulder_cm', 'largeur d’épaules'], ['arm_cm', 'longueur de bras']]) : []).concat([
    ['inseam_cm', 'entrejambe'],
    ['shoe_size', 'pointure'], ['eye_color', 'couleur des yeux'], ['hair_color', 'couleur des cheveux']
  ]);
}

function ma2mVide(v) { return v === null || v === undefined || String(v).trim() === ''; }

// Analyse d'un profil : chaque rubrique liste ses points à compléter (des clés) ; le
// score compte les éléments déjà en place. Rien n'est calculé par l'IA.
function ma2mAnalyserProfil(p, photos, nbProjets, avecSupp) {
  var points = 0, total = 0;
  function manque(liste, cle, ok) { total++; if (ok) points++; else liste.push(cle); }
  var a = { identite: [], parcours: [], mesures: [], photos: [], forts: [], priorites: [], nbPhotos: photos.length, nbProjets: nbProjets };

  manque(a.identite, 'naissance', !ma2mVide(p.date_naissance));
  manque(a.identite, 'nationalite', !ma2mVide(p.nationalite));
  manque(a.identite, 'ville', !ma2mVide(p.city));
  // Présentation : absente, ou trop courte (moins de 80 caractères, une phrase à peine)
  if (ma2mVide(p.bio)) manque(a.identite, 'presentation', false);
  else manque(a.identite, 'presentationCourte', String(p.bio).trim().length >= 80);
  manque(a.identite, 'instagram', !ma2mVide(p.instagram) || p.sans_instagram === true);

  // New Face (débutante) : ne pas encore avoir d'expérience est normal — ni compté, ni réclamé.
  a.newFace = niveauNormalise(p.niveau_mannequin, p.years_experience) === 'New Face';
  if (!a.newFace || nbProjets > 0) manque(a.parcours, 'experiences', nbProjets > 0);
  manque(a.parcours, 'etudes', !ma2mVide(p.niveau_etude));
  manque(a.parcours, 'langues', !ma2mVide(p.languages));
  // Formations de mannequinat : facultatives (beaucoup n'en ont pas suivi) ; simple
  // suggestion ajoutée à la rubrique « parcours » quand celle-ci a déjà autre chose à
  // compléter (pour ne pas allonger le message d'un profil complet), jamais comptée.
  a.sansFormation = ma2mVide(p.formation_mannequin);

  // Mensurations
  var absentes = ma2mMesuresAttendues(p, avecSupp).filter(function (m) { return ma2mVide(p[m[0]]); });
  a.manquantes = absentes.map(function (m) { return m[1]; });
  a.manquantesCols = absentes.map(function (m) { return m[0]; }); // pastilles de l'Espace mannequin
  total++; if (!a.manquantes.length) points++;
  var t = ma2mTailles(p), libelles = { chest_cm: 'tour de poitrine', waist_cm: 'tour de taille', hips_cm: 'tour de bassin' };
  a.aReprendre = t.aReprendre.map(function (c) { return libelles[c]; });
  a.aVerifier = t.aVerifier.map(function (c) { return libelles[c]; });
  a.aReprendreCols = t.aReprendre.slice(); a.aVerifierCols = t.aVerifier.slice();
  a.exces = !!t.exces;
  total++; if (!a.aReprendre.length && !a.aVerifier.length && !a.exces) points++;
  a.tailles = t.aReprendre.length ? null : { haut: t.haut && t.haut.lettre, bas: t.bas && t.bas.lettre, generale: t.generale };
  a.homme = t.homme; a.tolereLettre = t.maximum; // L (femmes) ou XL (hommes)
  a.tolere = !a.exces && [t.haut, t.bas].some(function (x) { return x && x.lettre === t.maximum; });
  if (a.manquantes.length) a.mesures.push('À compléter : ' + a.manquantes.join(', '));
  if (a.aReprendre.length) a.mesures.push('À reprendre : ' + a.aReprendre.join(' et '));
  if (a.aVerifier.length) a.mesures.push('À vérifier : ' + a.aVerifier.join(', '));

  // Photos (en dernier)
  // Même logique que la fiche publique (mannequin.html) : sans photo de profil choisie,
  // la fiche affiche la plus ancienne photo ; sans couverture choisie, elle reprend la
  // photo de profil. Le rapport décrit donc ce que les recruteurs voient vraiment.
  // Règle partagée photosAffichees (js/app.js).
  var vues = photosAffichees(photos);
  a.photosVues = { profilChoisi: vues.profilChoisi, couvertureChoisie: !!vues.couvertureChoisie, identiques: !!vues.profil && vues.profil === vues.couverture };
  manque(a.photos, 'profil', vues.profilChoisi);
  // Un seul point pour la couverture : choisie ET différente de la photo de profil
  total++;
  if (!vues.couvertureChoisie) a.photos.push('couverture');
  else if (a.photosVues.identiques) a.photos.push('identiques');
  else points++;
  manque(a.photos, 'book', photos.length >= MA2M_PHOTOS_MINIMUM);

  a.score = total ? Math.round(points * 100 / total) : 0;

  // Points forts (3 au plus)
  if (p.published) a.forts.push('votre fiche est en ligne sur le site de l’agence');
  if (!a.manquantes.length && !a.aReprendre.length && !a.exces) a.forts.push('vos mensurations sont complètes');
  if (nbProjets > 0) a.forts.push(nbProjets > 1 ? nbProjets + ' expériences sont déjà renseignées' : 'une première expérience est déjà renseignée');
  if (photos.length >= MA2M_PHOTOS_MINIMUM) a.forts.push('votre book compte déjà ' + photos.length + ' photos');
  a.forts = a.forts.slice(0, 3);

  // 3 priorités, de la plus importante à la moins importante
  if (a.exces || a.aReprendre.length || a.aVerifier.length) a.priorites.push('Vérifier vos mensurations');
  else if (a.manquantes.length) a.priorites.push('Compléter vos mensurations');
  if (a.identite.length) a.priorites.push('Compléter votre identité (' + a.identite.length + ' élément' + (a.identite.length > 1 ? 's' : '') + ')');
  if (a.parcours.length) a.priorites.push(a.parcours.indexOf('experiences') !== -1 ? 'Ajouter vos expériences' : 'Compléter votre parcours');
  var reste = Math.max(0, MA2M_PHOTOS_MINIMUM - photos.length);
  if (a.photos.length) a.priorites.push('Enrichir vos photos' + (reste ? ' (encore ' + reste + ' photo' + (reste > 1 ? 's' : '') + ' à publier)' : ''));
  a.priorites = a.priorites.slice(0, 3);
  a.aJour = !a.identite.length && !a.parcours.length && !a.mesures.length && !a.exces && !a.photos.length;
  return a;
}


// Éléments à remplir ou à corriger, bloc par bloc, dans l'ordre des blocs de l'Espace
// mannequin (décision de la propriétaire, 07/10/2026 : le rapport WhatsApp suit les ronds
// rouges de l'Espace, avec les mêmes chiffres). Chaque élément est une clé de l'analyse
// (identité, parcours, photos) ou une colonne de mensuration. Le chiffre d'un bloc est son
// nombre d'éléments ; pour les photos, chaque photo qui manque pour arriver au minimum
// compte en plus.
var MA2M_BLOCS = ['identite', 'physique', 'formation', 'experiences', 'photos'];
function ma2mPointsParBloc(a) {
  var b = { identite: a.identite.slice(), physique: [], formation: [], experiences: [], photos: [] };
  a.manquantesCols.concat(a.aReprendreCols, a.aVerifierCols).forEach(function (c) { if (b.physique.indexOf(c) === -1) b.physique.push(c); });
  if (a.parcours.indexOf('etudes') !== -1) b.formation.push('etudes');
  ['experiences', 'langues'].forEach(function (k) { if (a.parcours.indexOf(k) !== -1) b.experiences.push(k); });
  a.photos.forEach(function (k) { if (k !== 'book') b.photos.push(k); });
  var nb = {};
  MA2M_BLOCS.forEach(function (k) { nb[k] = b[k].length; });
  if (a.photos.indexOf('book') !== -1) { b.photos.push('book'); nb.photos += MA2M_PHOTOS_MINIMUM - a.nbPhotos; }
  return { elements: b, nb: nb };
}
