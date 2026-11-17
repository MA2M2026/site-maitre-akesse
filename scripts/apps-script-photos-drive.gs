// =====================================================================
// Programme Google (Apps Script) « Projet sans titre » — compte Google de l'agence.
// Reçoit les photos (et désormais la VIDÉO de présentation) envoyées avec une
// candidature ou une inscription, les range dans le Google Drive de l'agence
// (un dossier par personne) et renvoie leurs liens au site.
//
// Copie de référence gardée dans le dépôt du site (scripts/apps-script-photos-drive.gs).
// Pour le mettre à jour : script.google.com → « Projet sans titre » → Code.gs →
// tout remplacer par ce texte → Enregistrer → Déployer → Gérer les déploiements →
// crayon → Version : « Nouvelle version » → Déployer (l'adresse reste la même).
//
// Envois possibles (même adresse) :
//   1) photos : { cle, nom, email, phone, type, projet, photos: [dataURL image…] }
//      → { ok, liens: [...], dossier: <id du dossier de la personne> }
//   2) vidéo EN MORCEAUX (depuis le 30/09 — une vidéo de téléphone de 20 Mo envoyée
//      d'un seul bloc faisait échouer le programme, faute de mémoire) :
//      a) { cle, action:'video_debut', nom, email, phone, type, projet, dossier,
//           typeVideo, taille }                → { ok, session, dossier }
//      b) { cle, action:'video_morceau', session, debut, total, morceau: base64 }
//           → { ok, suite:true } … puis au dernier morceau { ok, video: <lien> }
//      c) { cle, action:'video_etat', session, total } → { ok, recu } (reprise
//           après une coupure de connexion)
//   3) ancienne vidéo d'un seul bloc { …, video: dataURL } : gardée pour les
//      petites vidéos et les pages pas encore mises à jour.
// La vidéo part après les photos : si elle échoue, les photos sont déjà arrivées.
//   4) { cle, action:'retrouver', source, ref } (15/11/2026) : retrouve dans Drive le dossier d'une candidature ou
//      d'une inscription et enregistre ses photos dans la base (appelé par la base elle-même, toutes les 15 min
//      pour un dossier sans photo, et par le bouton « Récupérer les photos depuis Drive » de l'Administration).
//   5) { cle, action:'controle' } (15/11/2026) : contrôle de santé du matin (supabase-medias-drive-controle.sql) :
//      une petite image d'essai fait tout le trajet (Drive, partage par lien, annonce à la base), puis à la corbeille.
//   6) { cle, action:'corbeille', source, ref } (17/11/2026, L-18) : appelé par la base quand l'agence supprime une
//      candidature ou une inscription au cours de talons : son dossier Drive va à la CORBEILLE (jamais définitif).
//
// DEPUIS LE 15/11/2026 : chaque envoi porte { source:'candidature'|'cours_talons', ref:<numéro du dossier> }, et
// le programme ENREGISTRE LUI-MÊME les liens dans la base du site (media_drive_recu, supabase-medias-drive.sql) :
// l'Administration n'attend plus la réponse renvoyée au téléphone de la candidate (souvent perdue).
// Un même envoi recommencé (même ref) réutilise le même dossier et les mêmes fichiers : jamais de double.
// ⚠️ Mot secret : Paramètres du projet (roue dentée) → Propriétés du script → propriété SECRET_SITE. Il n'est
// JAMAIS écrit dans ce fichier (le dépôt est public) ; sans lui, le programme marche comme avant.
//
// Nécessite l'autorisation « se connecter à un service externe » (UrlFetchApp) :
// Google la demande une fois au moment du déploiement.
// =====================================================================

// Doit être EXACTEMENT le même texte que CLE_SCRIPT_PHOTOS_DRIVE dans js/app.js du site.
var CLE_ATTENDUE = 'b56772fb9c5075517dc36a6b20db10734701e262274f3beb';
var ID_DOSSIER_RACINE = '1hHOId-298nSWbUsRCLStpbAMZD4bgQzl';
var NB_PHOTOS_MAX = 20;
var TAILLE_MAX_OCTETS = 15 * 1024 * 1024;        // par photo
var TAILLE_MAX_VIDEO_OCTETS = 60 * 1024 * 1024;  // vidéo de présentation (~30 s)
var TAILLE_MAX_MORCEAU = 8 * 1024 * 1024;        // le site envoie des morceaux de 4 Mo
var DEBUT_SESSION = 'https://www.googleapis.com/upload/drive/v3/files?';
// Base du site (clé « anon » : publique par nature, la même que dans js/supabase-config.js)
var SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
var SUPABASE_CLE_PUBLIQUE = 'sb_publishable_-k2vIvxdu1Ya-WzZWgj2Fg_8eyTmOmu';  // (clé publique courte : la longue s'abîmait au copier-coller, 15/11/2026)
var NB_PHOTOS_RETROUVEES_MAX = 12;
// (16/11/2026, audit L-7 = B-P6) : la clé CLE_ATTENDUE est visible dans le code public du site ; n'importe qui pourrait
// donc remplir le Drive de l'agence. Deux freins : (1) un budget par heure pour TOUT le programme (assez large pour un
// jour de casting : ~150 candidates × 6 photos de 2 Mo + vidéos) ; (2) seules les vraies images (JPEG, PNG, WEBP,
// HEIC) sont rangées, d'après les premiers octets du fichier et non d'après ce que l'envoi prétend.
var BUDGET_OCTETS_PAR_HEURE = 3 * 1024 * 1024 * 1024;   // 3 Go
var BUDGET_FICHIERS_PAR_HEURE = 1500;

// Réserve octets / fichiers dans le budget de l'heure en cours ; false si le budget est dépassé (rien n'est rangé).
function reserverBudget(octets, fichiers) {
  var cache = CacheService.getScriptCache();
  var heure = 'budget_' + Math.floor(Date.now() / 3600000);
  var verrou = LockService.getScriptLock();
  if (!verrou.tryLock(5000)) return true;  // (verrou indisponible : on ne bloque pas une vraie candidate pour ça)
  try {
    var etat = JSON.parse(cache.get(heure) || '{"o":0,"f":0}');
    if (etat.o + octets > BUDGET_OCTETS_PAR_HEURE || etat.f + fichiers > BUDGET_FICHIERS_PAR_HEURE) return false;
    etat.o += octets; etat.f += fichiers;
    cache.put(heure, JSON.stringify(etat), 3700);
    return true;
  } finally { verrou.releaseLock(); }
}
// Vraie image d'après ses premiers octets (JPEG, PNG, WEBP, HEIC/HEIF/AVIF), pas d'après l'étiquette « data:image/… ».
function estVraieImage(octets) {
  if (!octets || octets.length < 12) return false;
  var b = function (i) { return octets[i] & 255; };
  var texte = function (i, n) { var t = ''; for (var k = 0; k < n; k++) t += String.fromCharCode(b(i + k)); return t; };
  if (b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF) return true;                 // JPEG
  if (b(0) === 0x89 && texte(1, 3) === 'PNG') return true;                          // PNG
  if (texte(0, 4) === 'RIFF' && texte(8, 4) === 'WEBP') return true;               // WEBP
  if (texte(4, 4) === 'ftyp' && /^(heic|heix|hevc|mif1|msf1|avif)$/.test(texte(8, 4))) return true;  // HEIC (iPhone)
  return false;
}

function reponse(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.cle !== CLE_ATTENDUE) {
      return reponse({ ok: false, erreur: 'non_autorise' });
    }

    var dossierRacine = DriveApp.getFolderById(ID_DOSSIER_RACINE);

    // ---------- 2) Vidéo en morceaux ----------
    if (data.action === 'video_debut') return videoDebut(dossierRacine, data);
    if (data.action === 'video_morceau') return videoMorceau(dossierRacine, data);
    if (data.action === 'video_etat') return videoEtat(data);
    if (data.action === 'retrouver') return reponse(retrouver(dossierRacine, data));
    if (data.action === 'controle') return reponse(controle(dossierRacine));
    if (data.action === 'corbeille') return reponse(corbeille(dossierRacine, data));

    // ---------- 3) Vidéo d'un seul bloc (petites vidéos) ----------
    if (data.video) {
      var video = String(data.video);
      var entete = video.slice(0, 40);
      var typeVideo = (entete.match(/^data:(video\/[a-z0-9.+-]+);base64,/i) || [])[1];
      if (!typeVideo) return reponse({ ok: false, erreur: 'pas_une_video' });
      var partieVideo = video.split(',')[1] || '';
      var tailleVideo = Math.floor(partieVideo.length * 0.75);
      if (tailleVideo === 0 || tailleVideo > TAILLE_MAX_VIDEO_OCTETS) {
        return reponse({ ok: false, erreur: 'video_trop_lourde' });
      }
      if (!reserverBudget(tailleVideo, 1)) return reponse({ ok: false, erreur: 'occupe' });
      var dossierVideo = dossierDeLaPersonne(dossierRacine, data);
      var extension = (typeVideo.split('/')[1] || 'mp4').replace('quicktime', 'mov');
      var blobVideo = Utilities.newBlob(Utilities.base64Decode(partieVideo), typeVideo, 'video-presentation.' + extension);
      var fichierVideo = dossierVideo.createFile(blobVideo);
      fichierVideo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var lienVideo = 'https://drive.google.com/file/d/' + fichierVideo.getId() + '/view';

      var feuilleV = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      feuilleV.appendRow([new Date(), data.nom, data.email, data.phone, data.type, data.projet || '', 'VIDÉO : ' + lienVideo]);
      var enregistreV = signalerAuSite(data, dossierVideo.getId(), [], lienVideo);

      return reponse({ ok: true, video: lienVideo, dossier: dossierVideo.getId(), enregistre: enregistreV });
    }

    // ---------- 1) Envoi des photos (inchangé) ----------
    var photos = data.photos || [];
    if (!Array.isArray(photos) || photos.length > NB_PHOTOS_MAX) {
      return reponse({ ok: false, erreur: 'trop_de_photos' });
    }
    var octetsAnnonces = photos.reduce(function (t, p) { return t + (typeof p === 'string' ? Math.floor(p.length * 0.75) : 0); }, 0);
    if (!reserverBudget(octetsAnnonces, photos.length)) return reponse({ ok: false, erreur: 'occupe' });

    // Dossier de la personne : celui de ce même envoi s'il existe déjà (envoi recommencé après une réponse perdue),
    // sinon un nouveau, dans le sous-dossier de catégorie ("Inscription à l'agence", le nom du casting, "Cours de
    // talons" ou "Intégrer l'agence", créé s'il n'existe pas encore).
    var dossierCandidat = dossierDeLEnvoi(dossierRacine, data);
    // (15/11/2026, demande de la propriétaire) le lien du DOSSIER est enregistré dans la base EN PREMIER, avant même
    // de ranger les photos : quoi qu'il arrive ensuite, l'Administration a toujours au moins le dossier Drive.
    signalerAuSite(data, dossierCandidat.getId(), [], null, 1);  // (un seul essai : ne pas retarder les photos)

    var liensPhotos = [];
    photos.forEach(function (photoBase64, index) {
      // Chaque photo est isolée dans son propre bloc : si UNE photo pose
      // problème (fichier corrompu, trop lourd, pas une vraie image...), les
      // autres continuent d'être envoyées normalement au lieu de tout faire
      // échouer.
      try {
        if (typeof photoBase64 !== 'string' || photoBase64.indexOf('data:image/') !== 0) {
          return;
        }
        var partieBase64 = photoBase64.split(',')[1] || '';
        var tailleApprox = Math.floor(partieBase64.length * 0.75);
        if (tailleApprox === 0 || tailleApprox > TAILLE_MAX_OCTETS) {
          return;
        }

        var nomFichier = 'photo-' + (index + 1) + '.jpg';
        var dejaLa = dossierCandidat.getFilesByName(nomFichier);  // (envoi recommencé : déjà arrivée)
        var fichier;
        if (dejaLa.hasNext()) fichier = dejaLa.next();
        else {
          var octetsPhoto = Utilities.base64Decode(partieBase64);
          if (!estVraieImage(octetsPhoto)) return;  // (16/11/2026 : pas une vraie image → pas rangée dans le Drive)
          fichier = dossierCandidat.createFile(Utilities.newBlob(octetsPhoto, 'image/jpeg', nomFichier));
        }
        fichier.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        liensPhotos.push(lienPhoto(fichier));
      } catch (erreurPhoto) {
        // On continue avec les photos suivantes — celle-ci sera simplement
        // absente du résultat renvoyé au site.
      }
    });

    var feuille = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    feuille.appendRow([new Date(), data.nom, data.email, data.phone, data.type, data.projet || '', liensPhotos.join('\n')]);
    // (15/11/2026) les liens sont enregistrés dans la base PAR LE PROGRAMME, avant même de répondre au téléphone
    var enregistre = signalerAuSite(data, dossierCandidat.getId(), liensPhotos, null);

    return reponse({ ok: true, liens: liensPhotos, dossier: dossierCandidat.getId(), enregistre: enregistre });
  } catch (err) {
    return reponse({ ok: false, erreur: err.message });
  }
}

// a) Ouvre un envoi « en plusieurs fois » auprès de Google Drive, directement dans le
// dossier de la personne. Google renvoie une adresse d'envoi (session) propre à ce
// seul fichier, valable une semaine.
function videoDebut(dossierRacine, data) {
  var typeVideo = String(data.typeVideo || '');
  if (!/^video\/[a-z0-9.+-]+$/i.test(typeVideo)) return reponse({ ok: false, erreur: 'pas_une_video' });
  var taille = Number(data.taille);
  if (!(taille > 0 && taille <= TAILLE_MAX_VIDEO_OCTETS)) return reponse({ ok: false, erreur: 'video_trop_lourde' });
  var dossier = dossierDeLaPersonne(dossierRacine, data);
  var extension = (typeVideo.split('/')[1] || 'mp4').replace('quicktime', 'mov');
  var rep = UrlFetchApp.fetch(DEBUT_SESSION + 'uploadType=resumable&fields=id', {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      'X-Upload-Content-Type': typeVideo,
      'X-Upload-Content-Length': String(taille)
    },
    payload: JSON.stringify({ name: 'video-presentation.' + extension, parents: [dossier.getId()], mimeType: typeVideo }),
    muteHttpExceptions: true
  });
  var entetes = rep.getHeaders();
  var session = entetes.Location || entetes.location;
  if (!session) return reponse({ ok: false, erreur: 'session_refusee ' + rep.getResponseCode() + ' ' + rep.getContentText().slice(0, 150) });
  signalerAuSite(data, dossier.getId(), [], null, 1);
  return reponse({ ok: true, session: session, dossier: dossier.getId() });
}

// b) Transmet un morceau à Google Drive. Au dernier morceau, Drive crée le fichier :
// on le partage « lecture par lien », on note la ligne dans la feuille, on renvoie le lien.
function videoMorceau(dossierRacine, data) {
  var session = String(data.session || '');
  if (session.indexOf(DEBUT_SESSION) !== 0) return reponse({ ok: false, erreur: 'session_invalide' });
  var debut = Number(data.debut), total = Number(data.total);
  var octets = Utilities.base64Decode(String(data.morceau || ''));
  if (!octets.length || octets.length > TAILLE_MAX_MORCEAU || !(total > 0 && total <= TAILLE_MAX_VIDEO_OCTETS) || !(debut >= 0) || debut + octets.length > total) {
    return reponse({ ok: false, erreur: 'morceau_invalide' });
  }
  if (!reserverBudget(octets.length, debut === 0 ? 1 : 0)) return reponse({ ok: false, erreur: 'occupe' });
  var rep = UrlFetchApp.fetch(session, {
    method: 'put',
    contentType: 'application/octet-stream',
    headers: { 'Content-Range': 'bytes ' + debut + '-' + (debut + octets.length - 1) + '/' + total },
    payload: octets,
    muteHttpExceptions: true
  });
  var code = rep.getResponseCode();
  if (code === 308) return reponse({ ok: true, suite: true, recu: plageRecue(rep) });
  if (code !== 200 && code !== 201) return reponse({ ok: false, erreur: 'morceau_refuse ' + code + ' ' + rep.getContentText().slice(0, 150) });
  return reponse(videoTerminee(rep, data));
}

function videoTerminee(rep, data) {
  var fichier = DriveApp.getFileById(JSON.parse(rep.getContentText()).id);
  fichier.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var lien = 'https://drive.google.com/file/d/' + fichier.getId() + '/view';
  var feuille = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  feuille.appendRow([new Date(), data.nom || '', data.email || '', data.phone || '', data.type || '', data.projet || '', 'VIDÉO : ' + lien]);
  var dossierVideo = fichier.getParents().hasNext() ? fichier.getParents().next().getId() : null;
  return { ok: true, video: lien, enregistre: signalerAuSite(data, dossierVideo, [], lien) };
}

// c) Après une coupure : combien d'octets Google a déjà reçus pour cette vidéo ?
function videoEtat(data) {
  var session = String(data.session || '');
  if (session.indexOf(DEBUT_SESSION) !== 0) return reponse({ ok: false, erreur: 'session_invalide' });
  var rep = UrlFetchApp.fetch(session, {
    method: 'put',
    headers: { 'Content-Range': 'bytes */' + Number(data.total) },
    muteHttpExceptions: true
  });
  var code = rep.getResponseCode();
  if (code === 308) return reponse({ ok: true, recu: plageRecue(rep) });
  if (code === 200 || code === 201) return reponse(videoTerminee(rep, data));
  return reponse({ ok: false, erreur: 'etat_' + code });
}

function plageRecue(rep) {
  var entetes = rep.getHeaders();
  var plage = entetes.Range || entetes.range || '';
  var m = String(plage).match(/bytes=0-(\d+)/);
  return m ? Number(m[1]) + 1 : 0;
}

// Dossier où ranger la vidéo : celui des photos de la même personne (identifiant
// renvoyé par l'envoi des photos) — uniquement s'il se trouve bien dans le dossier
// racine de l'agence (racine → catégorie → personne). Sinon, un nouveau dossier.
function dossierDeLaPersonne(dossierRacine, data) {
  if (data.dossier) {
    try {
      var dossier = DriveApp.getFolderById(String(data.dossier));
      var parents = dossier.getParents();
      while (parents.hasNext()) {
        var categorie = parents.next();
        var grandsParents = categorie.getParents();
        while (grandsParents.hasNext()) {
          if (grandsParents.next().getId() === dossierRacine.getId()) return dossier;
        }
      }
    } catch (e) {}
  }
  // (15/11/2026) dossier des photos inconnu du téléphone (réponse perdue) : celui de ce même envoi (même ref)
  if (refValide(data)) return dossierDeLEnvoi(dossierRacine, data);
  var dossierCategorie = obtenirOuCreerSousDossier(dossierRacine, nomSousDossierPour(data));
  return dossierCategorie.createFolder(nomDossierPersonne(data));
}

// (12/11/2026, demande de la propriétaire : voir dans le Drive à quelle heure la personne a postulé) nom du dossier de
// la personne : « Awa Koné — 12/11/2026 à 14h49 », à l'heure d'Abidjan (avant : new Date().toLocaleString('fr-FR'),
// qui dépend du réglage du programme et pouvait donner une autre heure ou un format illisible)
function nomDossierPersonne(data) {
  return (data.nom || 'Candidat') + ' — ' + Utilities.formatDate(new Date(), 'Africa/Abidjan', "dd/MM/yyyy 'à' HH'h'mm");
}

function nomSousDossierPour(data) {
  if (data.type === 'inscription') return "Inscription à l'agence";
  if (data.type === 'projet' && data.projet) return data.projet;
  return "Intégrer l'agence";
}

function obtenirOuCreerSousDossier(parent, nom) {
  var dossiers = parent.getFoldersByName(nom);
  if (dossiers.hasNext()) return dossiers.next();
  return parent.createFolder(nom);
}

function lienPhoto(fichier) {
  return 'https://drive.google.com/thumbnail?id=' + fichier.getId() + '&sz=w2000';
}

// ---------- 15/11/2026 : enregistrement par le programme lui-même ----------
function refValide(data) {
  return (data.source === 'candidature' || data.source === 'cours_talons')
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(data.ref || ''));
}
function secretSite() {
  return PropertiesService.getScriptProperties().getProperty('SECRET_SITE') || '';
}
function appelBase(fonction, parametres) {
  var rep = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/' + fonction, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: SUPABASE_CLE_PUBLIQUE, Authorization: 'Bearer ' + SUPABASE_CLE_PUBLIQUE },
    payload: JSON.stringify(parametres),
    muteHttpExceptions: true
  });
  if (rep.getResponseCode() !== 200) throw new Error('base ' + rep.getResponseCode() + ' ' + rep.getContentText().slice(0, 150));
  return JSON.parse(rep.getContentText() || 'null');
}
// Enregistre dans la base du site le dossier, les photos et la vidéo d'un envoi. Renvoie true si c'est fait.
// (2 essais ; un échec ne bloque jamais l'envoi : la surveillance de la base le rattrapera)
function signalerAuSite(data, dossierId, photos, video, essais) {
  if (!refValide(data) || !secretSite()) return false;
  var nbEssais = essais || 2;
  for (var essai = 1; essai <= nbEssais; essai++) {
    try {
      appelBase('media_drive_recu', { p_secret: secretSite(), p_source: data.source, p_ref: data.ref,
        p_dossier: dossierId || null, p_photos: photos || [], p_video: video || null });
      return true;
    } catch (e) {
      if (essai === nbEssais) console.error('signalerAuSite : ' + e.message);
      else Utilities.sleep(1500);
    }
  }
  return false;
}

// Dossier d'un envoi de photos : le même si ce même envoi (même ref) a déjà commencé, sinon un nouveau.
// (verrou : deux essais simultanés du même téléphone ne créent pas deux dossiers)
function dossierDeLEnvoi(dossierRacine, data) {
  if (!refValide(data)) {
    return obtenirOuCreerSousDossier(dossierRacine, nomSousDossierPour(data)).createFolder(nomDossierPersonne(data));
  }
  var cache = CacheService.getScriptCache(), cle = 'dossier_' + data.ref;
  var connu = cache.get(cle);
  if (connu) { try { return DriveApp.getFolderById(connu); } catch (e) {} }
  // (envoi repris des heures plus tard : la base connaît peut-être déjà le dossier ; demandé AVANT le verrou)
  if (secretSite()) {
    try {
      var infos = appelBase('media_drive_infos', { p_secret: secretSite(), p_source: data.source, p_ref: data.ref });
      if (infos && infos.dossiers && infos.dossiers.length) {
        var dejaConnu = DriveApp.getFolderById(infos.dossiers[0]);
        cache.put(cle, dejaConnu.getId(), 21600);
        return dejaConnu;
      }
    } catch (e) {}
  }
  // Verrou très court (seulement : relire le cache, créer le dossier) pour que deux essais simultanés du même
  // téléphone ne créent pas deux dossiers. Jamais bloquant : sans verrou au bout de 20 s, on continue quand même.
  var verrou = LockService.getScriptLock();
  var verrouille = verrou.tryLock(20000);
  try {
    connu = cache.get(cle);
    if (connu) { try { return DriveApp.getFolderById(connu); } catch (e) {} }
    var dossier = obtenirOuCreerSousDossier(dossierRacine, nomSousDossierPour(data)).createFolder(nomDossierPersonne(data));
    dossier.setDescription('ref:' + data.ref);
    cache.put(cle, dossier.getId(), 21600);
    return dossier;
  } finally {
    if (verrouille) verrou.releaseLock();
  }
}

// 4) Retrouver le dossier Drive d'une candidature ou d'une inscription, et enregistrer ses photos (et sa vidéo)
// dans la base. Dossier connu de la base → celui-là ; sinon (anciens dossiers, avant le 15/11/2026) : le dossier
// dont le nom commence par le nom de la personne, créé à moins de 3 heures de son envoi, qui a le plus de photos.
function retrouver(dossierRacine, data) {
  if (!refValide(data) || !secretSite()) return { ok: false, erreur: 'non_configure' };
  var infos = appelBase('media_drive_infos', { p_secret: secretSite(), p_source: data.source, p_ref: data.ref });
  if (!infos) return { ok: false, erreur: 'dossier_inconnu' };
  var candidats = [];
  (infos.dossiers || []).forEach(function (id) { try { candidats.push(DriveApp.getFolderById(id)); } catch (e) {} });
  if (!candidats.length) candidats = dossiersAuNomDe(dossierRacine, infos, data.ref);
  var meilleur = null, meilleurNb = 0;
  candidats.forEach(function (dossier) {
    var nb = imagesDe(dossier).length;
    if (nb > meilleurNb) { meilleur = dossier; meilleurNb = nb; }
  });
  if (!meilleur && candidats.length) meilleur = candidats[0];
  if (!meilleur) return { ok: true, nb: 0, trouve: false };
  var liens = imagesDe(meilleur).slice(0, NB_PHOTOS_RETROUVEES_MAX).map(function (f) {
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return lienPhoto(f);
  });
  var lienVideo = null;
  var fichiers = meilleur.getFiles();
  while (fichiers.hasNext() && !lienVideo) {
    var f = fichiers.next();
    if (String(f.getMimeType()).indexOf('video/') === 0) {
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      lienVideo = 'https://drive.google.com/file/d/' + f.getId() + '/view';
    }
  }
  if (!meilleur.getDescription()) meilleur.setDescription('ref:' + data.ref);
  signalerAuSite(data, meilleur.getId(), liens, lienVideo);
  return { ok: true, nb: liens.length, trouve: true };
}

// 6) (17/11/2026, L-18) L'agence a supprimé une candidature ou une inscription au cours de talons : son dossier
// Drive va à la CORBEILLE (jamais d'effacement définitif : récupérable 30 jours dans la corbeille de Google Drive).
// Seulement ce que la base autorise (media_drive_a_jeter : suppression faite par l'agence, ligne disparue), et
// seulement un dossier de personne rangé sous le dossier principal (jamais le dossier principal ni un sous-dossier).
function corbeille(dossierRacine, data) {
  if (!refValide(data) || !secretSite()) return { ok: false, erreur: 'non_configure' };
  var ids = appelBase('media_drive_a_jeter', { p_secret: secretSite(), p_source: data.source, p_ref: data.ref }) || [];
  var nb = 0;
  ids.forEach(function (id) {
    try {
      var dossier = DriveApp.getFolderById(id);
      if (dossierDePersonne(dossierRacine, dossier, data.ref)) { dossier.setTrashed(true); nb++; }
    } catch (e) { /* dossier déjà parti : rien à faire */ }
  });
  appelBase('media_drive_jete', { p_secret: secretSite(), p_ref: data.ref, p_nb: nb });
  return { ok: true, nb: nb };
}
// dossier d'une personne : rangé dans un sous-dossier du dossier principal, et marqué à son nom (ou pas encore marqué)
function dossierDePersonne(dossierRacine, dossier, ref) {
  var racine = dossierRacine.getId();
  if (dossier.getId() === racine) return false;
  var description = dossier.getDescription() || '';
  if (description && description !== 'ref:' + ref) return false;
  var parents = dossier.getParents();
  while (parents.hasNext()) {
    var parent = parents.next();
    if (parent.getId() === racine) return false;
    var grandsParents = parent.getParents();
    while (grandsParents.hasNext()) { if (grandsParents.next().getId() === racine) return true; }
  }
  return false;
}

// 5) Contrôle de santé du matin : le même trajet qu'une vraie photo, avec une image d'essai de 1 point, rangée dans
// « Contrôle automatique » puis mise à la corbeille. Réussi → la base le note ; sinon la base alerte l'agence.
function controle(dossierRacine) {
  if (!secretSite()) return { ok: false, erreur: 'mot_secret_absent' };
  var dossier = obtenirOuCreerSousDossier(dossierRacine, 'Contrôle automatique');
  var image = Utilities.newBlob(Utilities.base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), 'image/png', 'essai.png');
  var fichier = dossier.createFile(image);
  try {
    fichier.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    appelBase('media_drive_controle_ok', { p_secret: secretSite(), p_details: 'photo d\'essai ' + fichier.getId() + ' écrite, partagée, annoncée' });
    return { ok: true };
  } finally {
    fichier.setTrashed(true);
  }
}

// photos d'un dossier, dans l'ordre (photo-1, photo-2…)
function imagesDe(dossier) {
  var liste = [], fichiers = dossier.getFiles();
  while (fichiers.hasNext()) {
    var f = fichiers.next();
    if (String(f.getMimeType()).indexOf('image/') === 0) liste.push(f);
  }
  return liste.sort(function (a, b) { return a.getName().localeCompare(b.getName(), 'fr', { numeric: true }); });
}

// Seulement dans la catégorie de cette personne (casting, Intégrer l'agence, Cours de talons…), dossier créé juste
// APRÈS sa candidature (de 0 à 90 min : la candidature est enregistrée avant ses photos) ou juste AVANT son inscription
// au cours de talons (enregistrée après ses photos), et jamais un dossier marqué pour un autre envoi (« ref: »).
function dossiersAuNomDe(dossierRacine, infos, ref) {
  var nom = String(infos.nom || '').trim();
  if (!nom) return [];
  var quand = new Date(infos.cree_le).getTime(), trouves = [];
  var avant = infos.projet === 'Cours de talons' ? 90 : 2, apres = infos.projet === 'Cours de talons' ? 5 : 90;  // minutes
  var debut = nom.toLowerCase() + ' — ';
  var requete = "title contains '" + nom.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  var categories = dossierRacine.getFoldersByName(nomSousDossierPour(infos));
  while (categories.hasNext()) {
    var dossiers = categories.next().searchFolders(requete);
    while (dossiers.hasNext()) {
      var d = dossiers.next();
      if (d.getName().toLowerCase().indexOf(debut) !== 0) continue;
      var marque = String(d.getDescription() || '');
      if (marque.indexOf('ref:') === 0 && marque !== 'ref:' + ref) continue;
      var ecart = (d.getDateCreated().getTime() - quand) / 60000;
      if (ecart >= -avant && ecart <= apres) trouves.push(d);
    }
  }
  return trouves;
}

// À lancer UNE fois à la main (menu des fonctions → « autoriser » → Exécuter) après
// avoir collé ce code : Google demande alors l'autorisation « se connecter à un
// service externe », nécessaire à l'envoi des vidéos en morceaux.
function autoriser() {
  UrlFetchApp.fetch('https://www.googleapis.com/discovery/v1/apis?name=drive', { muteHttpExceptions: true });
  LockService.getScriptLock(); CacheService.getScriptCache();
  console.log(secretSite() ? 'Mot secret SECRET_SITE : présent ✓' : '⚠️ Mot secret SECRET_SITE absent des Propriétés du script');
  DriveApp.getFolderById(ID_DOSSIER_RACINE).getName();
}
