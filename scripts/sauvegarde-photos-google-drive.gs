// Sauvegarde des photos des mannequins MA2M dans Google Drive (06/10/2026).
// Script Google Apps Script, à coller dans https://script.google.com depuis le compte
// Google de l'agence. Il copie chaque photo des mannequins dans le dossier
// « Sauvegarde photos MA2M » de Google Drive (un sous-dossier par mannequin).
// Il ne télécharge que les photos pas encore copiées, reprend là où il s'est arrêté
// et n'efface JAMAIS rien dans Google Drive : une photo supprimée du site reste ici.
// La liste des photos est donnée par la base (Extension 122) contre la clé secrète
// créée dans Supabase. Voir README-TECHNIQUE.md, « Sauvegarde des photos ».

// ▼▼▼ Seule ligne à modifier : collez la clé affichée par Supabase entre les guillemets ▼▼▼
const CLE_SAUVEGARDE = 'COLLEZ_LA_CLE_ICI';
// ▲▲▲ ▲▲▲ ▲▲▲

const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
// Clé publique du site (la même que dans les pages du site : elle ne donne accès à rien de privé).
const SUPABASE_CLE_PUBLIQUE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmaGdoZ213bXhpZ3VodHh0c2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NzI1ODQsImV4cCI6MjEwNDI0ODU4NH0.S-JftGJNtPMLZdK6Jy9AUwwOl56JzyllkEJ0GN0eZ-M';
const NOM_DOSSIER = 'Sauvegarde photos MA2M';
const DUREE_MAX_MS = 4 * 60 * 1000; // Google arrête un passage au bout de 6 minutes

// À lancer UNE fois : première copie + passage automatique toutes les heures.
function installer() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sauvegarder') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sauvegarder').timeBased().everyHours(1).create();
  sauvegarder();
}

function sauvegarder() {
  // Un seul passage à la fois (déclencheur horaire + lancement à la main).
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(1000)) { Logger.log('Un passage est déjà en cours.'); return; }
  try { sauvegarderSansVerrou_(); } finally { verrou.releaseLock(); }
}

function sauvegarderSansVerrou_() {
  const debut = Date.now();
  if (!CLE_SAUVEGARDE || CLE_SAUVEGARDE.indexOf('COLLEZ') === 0) throw new Error('Collez d’abord la clé de Supabase à la ligne CLE_SAUVEGARDE.');
  const photos = listePhotos_();

  const racine = dossier_(DriveApp.getRootFolder(), NOM_DOSSIER);
  // Index : photo déjà copiée (1) ou absente du stockage (« absente », plus réessayée).
  const index = lireIndex_(racine);
  const dossiers = {};
  let copiees = 0, erreurs = 0, restantes = 0, depuisSauvegarde = 0;

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (index[p.photo_id]) continue;
    // marge large : un téléchargement lent ne doit pas faire dépasser les 6 minutes
    if (Date.now() - debut > DUREE_MAX_MS) { restantes++; continue; }
    try {
      const fichier = UrlFetchApp.fetch(p.url, { muteHttpExceptions: true, followRedirects: true });
      const code = fichier.getResponseCode();
      if (code === 404) { index[p.photo_id] = 'absente'; continue; }
      if (code !== 200) { erreurs++; continue; }
      const cleDossier = String(p.model_id).slice(0, 8);
      const dossier = dossiers[cleDossier] || (dossiers[cleDossier] = dossierMannequin_(racine, cleDossier, p.mannequin));
      const blob = fichier.getBlob();
      const nom = 'photo-' + (p.numero != null ? String(p.numero).padStart(3, '0') : 'sans-numero') + '-' + String(p.photo_id).slice(0, 8) + '.' + extension_(blob, p.url);
      dossier.createFile(blob.setName(nom));
      index[p.photo_id] = 1;
      copiees++;
      // index enregistré régulièrement : un passage coupé ne recopie pas ce qui est fait
      if (++depuisSauvegarde >= 10) { ecrireIndex_(racine, index); depuisSauvegarde = 0; }
    } catch (e) {
      erreurs++;
    }
  }
  ecrireIndex_(racine, index);
  const total = Object.keys(index).filter(function (k) { return index[k] === 1; }).length;
  const absentes = Object.keys(index).length - total;
  const bilan = new Date().toLocaleString('fr-FR') + ' — ' + photos.length + ' photos sur le site, ' + total +
    ' sauvegardées en tout (' + copiees + ' nouvelles ce passage)' + (restantes ? ', ' + restantes + ' à copier au prochain passage' : '') +
    (erreurs ? ', ' + erreurs + ' erreur(s), nouvel essai au prochain passage' : '') + (absentes ? ', ' + absentes + ' photo(s) introuvable(s) sur le site, ignorée(s)' : '') + '.';
  PropertiesService.getScriptProperties().setProperty('dernier_bilan', bilan);
  remplacerFichier_(racine, '_dernier-passage.txt', bilan);
  Logger.log(bilan);
}

// Liste complète des photos, par paquets de 1000 (la base n'en renvoie pas plus d'un coup).
function listePhotos_() {
  const toutes = [];
  for (let depart = 0; ; depart += 1000) {
    const rep = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/photos_a_sauvegarder', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { apikey: SUPABASE_CLE_PUBLIQUE, Authorization: 'Bearer ' + SUPABASE_CLE_PUBLIQUE, 'Range-Unit': 'items', Range: depart + '-' + (depart + 999) },
      payload: JSON.stringify({ cle: CLE_SAUVEGARDE })
    });
    const code = rep.getResponseCode();
    if (code !== 200 && code !== 206) throw new Error('Liste des photos refusée (' + code + ') : ' + rep.getContentText().slice(0, 300));
    const paquet = JSON.parse(rep.getContentText());
    toutes.push.apply(toutes, paquet);
    if (paquet.length < 1000) return toutes;
  }
}

// ---- outils ----
function dossier_(parent, nom) {
  const it = parent.getFoldersByName(nom);
  return it.hasNext() ? it.next() : parent.createFolder(nom);
}
// Dossier d'une mannequin, retrouvé par son identifiant (entre parenthèses) même si
// son nom change ; créé au premier besoin.
function dossierMannequin_(racine, cle, nom) {
  const it = racine.searchFolders('title contains "(' + cle + ')"');
  return it.hasNext() ? it.next() : racine.createFolder(nettoyer_(nom) + ' (' + cle + ')');
}
// Extension d'après le vrai type du fichier téléchargé (sinon d'après l'adresse).
function extension_(blob, url) {
  const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heic', 'image/gif': 'gif', 'image/avif': 'avif' };
  const t = String(blob.getContentType() || '').toLowerCase().split(';')[0];
  if (types[t]) return types[t];
  return (String(url).split('?')[0].match(/\.(jpe?g|png|webp|heic|gif|avif)$/i) || ['', 'jpg'])[1].toLowerCase().replace('jpeg', 'jpg');
}
function nettoyer_(t) { return String(t || 'Sans nom').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 80) || 'Sans nom'; }
// Liste des photos déjà copiées, gardée dans un petit fichier du dossier (identifiants seulement).
function lireIndex_(racine) {
  const it = racine.getFilesByName('_index-sauvegarde.json');
  if (!it.hasNext()) return {};
  try { return JSON.parse(it.next().getBlob().getDataAsString()) || {}; } catch (e) { return {}; }
}
function ecrireIndex_(racine, index) { remplacerFichier_(racine, '_index-sauvegarde.json', JSON.stringify(index)); }
function remplacerFichier_(racine, nom, contenu) {
  const it = racine.getFilesByName(nom);
  if (it.hasNext()) it.next().setContent(contenu);
  else racine.createFile(nom, contenu, 'text/plain');
}
