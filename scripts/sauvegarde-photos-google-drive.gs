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
const DUREE_MAX_MS = 5 * 60 * 1000; // Google arrête un passage au bout de 6 minutes

// À lancer UNE fois : première copie + passage automatique toutes les heures.
function installer() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sauvegarder') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sauvegarder').timeBased().everyHours(1).create();
  sauvegarder();
}

function sauvegarder() {
  const debut = Date.now();
  if (!CLE_SAUVEGARDE || CLE_SAUVEGARDE.indexOf('COLLEZ') === 0) throw new Error('Collez d’abord la clé de Supabase à la ligne CLE_SAUVEGARDE.');
  const rep = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/photos_a_sauvegarder', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SUPABASE_CLE_PUBLIQUE, Authorization: 'Bearer ' + SUPABASE_CLE_PUBLIQUE },
    payload: JSON.stringify({ cle: CLE_SAUVEGARDE })
  });
  if (rep.getResponseCode() !== 200) throw new Error('Liste des photos refusée (' + rep.getResponseCode() + ') : ' + rep.getContentText().slice(0, 300));
  const photos = JSON.parse(rep.getContentText());

  const proprietes = PropertiesService.getScriptProperties();
  const racine = dossier_(DriveApp.getRootFolder(), NOM_DOSSIER);
  const dejaCopiees = lireIndex_(racine);
  const dossiers = {};
  let copiees = 0, erreurs = 0, restantes = 0;

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (dejaCopiees[p.photo_id]) continue;
    if (Date.now() - debut > DUREE_MAX_MS) { restantes++; continue; }
    try {
      const fichier = UrlFetchApp.fetch(p.url, { muteHttpExceptions: true, followRedirects: true });
      if (fichier.getResponseCode() !== 200) { erreurs++; continue; }
      const nomDossier = nettoyer_(p.mannequin) + ' (' + String(p.model_id).slice(0, 8) + ')';
      const dossier = dossiers[nomDossier] || (dossiers[nomDossier] = dossier_(racine, nomDossier));
      const extension = (String(p.url).split('?')[0].match(/\.(jpe?g|png|webp|heic|gif)$/i) || ['', 'jpg'])[1].toLowerCase();
      const nom = 'photo-' + (p.numero != null ? String(p.numero).padStart(3, '0') : 'sans-numero') + '-' + String(p.photo_id).slice(0, 8) + '.' + extension;
      dossier.createFile(fichier.getBlob().setName(nom));
      dejaCopiees[p.photo_id] = 1;
      copiees++;
    } catch (e) {
      erreurs++;
    }
  }
  ecrireIndex_(racine, dejaCopiees);
  const bilan = new Date().toLocaleString('fr-FR') + ' — ' + photos.length + ' photos sur le site, ' + Object.keys(dejaCopiees).length +
    ' sauvegardées en tout (' + copiees + ' nouvelles ce passage)' + (restantes ? ', ' + restantes + ' à copier au prochain passage' : '') + (erreurs ? ', ' + erreurs + ' erreur(s), nouvel essai au prochain passage' : '') + '.';
  proprietes.setProperty('dernier_bilan', bilan);
  remplacerFichier_(racine, '_dernier-passage.txt', bilan);
  Logger.log(bilan);
}

// ---- outils ----
function dossier_(parent, nom) {
  const it = parent.getFoldersByName(nom);
  return it.hasNext() ? it.next() : parent.createFolder(nom);
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
