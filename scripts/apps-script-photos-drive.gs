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
      var dossierVideo = dossierDeLaPersonne(dossierRacine, data);
      var extension = (typeVideo.split('/')[1] || 'mp4').replace('quicktime', 'mov');
      var blobVideo = Utilities.newBlob(Utilities.base64Decode(partieVideo), typeVideo, 'video-presentation.' + extension);
      var fichierVideo = dossierVideo.createFile(blobVideo);
      fichierVideo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var lienVideo = 'https://drive.google.com/file/d/' + fichierVideo.getId() + '/view';

      var feuilleV = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      feuilleV.appendRow([new Date(), data.nom, data.email, data.phone, data.type, data.projet || '', 'VIDÉO : ' + lienVideo]);

      return reponse({ ok: true, video: lienVideo, dossier: dossierVideo.getId() });
    }

    // ---------- 1) Envoi des photos (inchangé) ----------
    var photos = data.photos || [];
    if (photos.length > NB_PHOTOS_MAX) {
      return reponse({ ok: false, erreur: 'trop_de_photos' });
    }

    // Sous-dossier de catégorie : "Inscription à l'agence", le nom du casting
    // (ex: "Casting 1"), ou "Intégrer l'agence" pour les candidatures générales
    // — créé automatiquement s'il n'existe pas encore, réutilisé sinon.
    var dossierCategorie = obtenirOuCreerSousDossier(dossierRacine, nomSousDossierPour(data));

    var nomDossier = (data.nom || 'Candidat') + ' — ' + new Date().toLocaleString('fr-FR');
    var dossierCandidat = dossierCategorie.createFolder(nomDossier);

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

        var blob = Utilities.newBlob(Utilities.base64Decode(partieBase64), 'image/jpeg', 'photo-' + (index + 1) + '.jpg');
        var fichier = dossierCandidat.createFile(blob);
        fichier.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        liensPhotos.push('https://drive.google.com/thumbnail?id=' + fichier.getId() + '&sz=w2000');
      } catch (erreurPhoto) {
        // On continue avec les photos suivantes — celle-ci sera simplement
        // absente du résultat renvoyé au site.
      }
    });

    var feuille = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    feuille.appendRow([new Date(), data.nom, data.email, data.phone, data.type, data.projet || '', liensPhotos.join('\n')]);

    return reponse({ ok: true, liens: liensPhotos, dossier: dossierCandidat.getId() });
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
  return { ok: true, video: lien };
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
  var dossierCategorie = obtenirOuCreerSousDossier(dossierRacine, nomSousDossierPour(data));
  return dossierCategorie.createFolder((data.nom || 'Candidat') + ' — ' + new Date().toLocaleString('fr-FR'));
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
