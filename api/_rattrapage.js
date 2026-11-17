// (17/11/2026, chantier L-18, demande de la propriétaire) RATTRAPAGE DES ANCIENNES PHOTOS : les candidatures et les
// inscriptions aux cours de talons reçues AVANT L-17 n'ont leurs photos que dans Google Drive, et Google ne les sert
// pas de façon fiable à l'Administration (elles apparaissent puis disparaissent). Ici, UN dossier à la fois, ses
// photos Drive sont copiées chez Cloudflare R2, puis la base est mise à jour : l'Administration les affiche alors
// depuis Cloudflare, comme les nouvelles (règle « M ≤ N », js/admin/coque.js).
//  - Tout ou rien : si une seule photo du dossier échoue, les copies déjà déposées sont retirées et rien n'est noté ;
//    le dossier reste affiché depuis Drive, comme avant, et peut être repris plus tard.
//  - Rien n'est supprimé : ni dans le Drive, ni les lignes Drive de casting_photos (cachées par la règle M ≤ N).
//    Cours de talons : les liens Drive de « photos » sont remplacés par leurs copies (le nombre ne change pas, la limite
//    de 5 tient) ; ils restent dans le journal medias_drive.
//  - Nom FIXE de chaque copie (empreinte de l'identifiant Drive) : relancer ne crée jamais de doublon.
//  - Seules les adresses Drive au format exact sont suivies (jamais une adresse libre lue dans la base).
// Appelé par api/r2-presigner.js (action « rattrapage_drive »), réservé à l'administratrice principale.
const crypto = require('crypto');
const { SUPABASE_URL, enTetesService, creerClientR2 } = require('./_commun.js');
const { effacerFichiersR2 } = require('./_r2.js');

const LIEN_DRIVE = /^https:\/\/drive\.google\.com\/thumbnail\?id=([A-Za-z0-9_-]{10,120})&sz=w2000$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TAILLE_MAX = 15 * 1024 * 1024;
const PHOTOS_MAX = 20;   // (medias_drive_enregistrer accepte 20 photos au plus par envoi)

// Format d'image d'après les premiers octets : 'jpg', 'png', 'webp', ou null
function extensionDe(o) {
  if (o.length >= 3 && o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff) return 'jpg';
  if (o.length >= 8 && o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4e && o[3] === 0x47) return 'png';
  if (o.length >= 12 && String.fromCharCode(...o.slice(0, 4)) === 'RIFF' && String.fromCharCode(...o.slice(8, 12)) === 'WEBP') return 'webp';
  return null;
}
const nomFixe = (dossier, id, idDrive, ext) => dossier + '/' + id + '/' + crypto.createHash('sha256').update(idDrive).digest('hex').slice(0, 32) + '.' + ext;
const lire = (url) => fetch(SUPABASE_URL + '/rest/v1/' + url, { headers: enTetesService() }).then((r) => (r.ok ? r.json() : null));

// Télécharge une photo Drive (8 s au plus) : { octets, ext } ou une erreur parlante
async function telecharger(lien) {
  if (!LIEN_DRIVE.test(lien)) throw new Error('adresse Drive inattendue');
  const arret = new AbortController(), minuteur = setTimeout(() => arret.abort(), 8000);
  try {
    const rep = await fetch(lien, { signal: arret.signal, redirect: 'follow' });
    if (!rep.ok) throw new Error('Google répond ' + rep.status);
    const octets = new Uint8Array(await rep.arrayBuffer());
    if (!octets.length || octets.length > TAILLE_MAX) throw new Error('photo vide ou trop lourde');
    const ext = extensionDe(octets);
    if (!ext) throw new Error('Google n’a pas renvoyé une image');
    return { octets, ext };
  } finally { clearTimeout(minuteur); }
}

// Le prochain dossier à rattraper (le plus récent d'abord), hors « exclus » (échecs déjà vus par la page) ;
// renvoie { id, liens, restants } ou { id: null, restants: 0 }.
async function prochainDossier(source, exclus) {
  if (source === 'candidature') {
    const drive = await lire('casting_photos?select=application_id,url&chemin=is.null&url=like.https://drive.google.com/thumbnail*&order=created_at.desc&limit=2000');
    const r2 = await lire('casting_photos?select=application_id&chemin=like.r2:*&limit=10000');
    if (!Array.isArray(drive) || !Array.isArray(r2)) throw new Error('lecture de la base impossible');
    const dejaR2 = new Set(r2.map((x) => x.application_id)), parDossier = new Map();
    drive.forEach((x) => { if (x.application_id && !dejaR2.has(x.application_id) && !exclus.has(x.application_id)) (parDossier.get(x.application_id) || parDossier.set(x.application_id, []).get(x.application_id)).push(x.url); });
    const premier = parDossier.keys().next();
    return premier.done ? { id: null, restants: 0 } : { id: premier.value, liens: parDossier.get(premier.value), restants: parDossier.size };
  }
  const lignes = await lire('cours_talons?select=id,photos&order=cree_le.desc&limit=1000');
  if (!Array.isArray(lignes)) throw new Error('lecture de la base impossible');
  const aFaire = lignes.filter((x) => !exclus.has(x.id) && Array.isArray(x.photos) && x.photos.some((p) => LIEN_DRIVE.test(String(p))) && !x.photos.some((p) => String(p).startsWith('r2:')));
  return aFaire.length ? { id: aFaire[0].id, liens: aFaire[0].photos, restants: aFaire.length } : { id: null, restants: 0 };
}

// Rattrape UN dossier. Réponse : { fini: true } | { fait: id, photos: n, restants } | { echec: id, raison, restants }
async function rattraperUnDossier(source, exclusListe) {
  if (source !== 'candidature' && source !== 'cours_talons') return { statut: 400, corps: { error: 'Source inconnue.' } };
  const exclus = new Set((Array.isArray(exclusListe) ? exclusListe : []).filter((x) => typeof x === 'string' && UUID.test(x)).slice(0, 500));
  const d = await prochainDossier(source, exclus);
  if (!d.id) return { statut: 200, corps: { fini: true, restants: 0 } };
  const id = String(d.id).toLowerCase(), dossier = source === 'candidature' ? 'candidatures' : 'cours-talons';
  const liensDrive = d.liens.filter((l) => LIEN_DRIVE.test(String(l))).slice(0, PHOTOS_MAX);
  const deposes = [];
  try {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const client = creerClientR2();
    // (toutes les photos vont jusqu'au bout avant de décider : aucun dépôt n'échappe au retrait en cas d'échec)
    const essais = await Promise.allSettled(liensDrive.map(async (lien) => {
      const { octets, ext } = await telecharger(lien);
      const cle = nomFixe(dossier, id, LIEN_DRIVE.exec(lien)[1], ext);
      await client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: cle, Body: octets, ContentType: ext === 'jpg' ? 'image/jpeg' : 'image/' + ext }));
      deposes.push(cle);
      return { lien, chemin: 'r2:' + cle };
    }));
    const rate = essais.find((x) => x.status === 'rejected');
    if (rate) throw rate.reason;
    if (!essais.length) throw new Error('aucune photo Drive lisible');
    const copies = essais.map((x) => x.value);
    if (source === 'candidature') {
      // une seule écriture pour tout le dossier (tout ou rien) ; url = nom de rangement (colonne obligatoire, L-17)
      const rep = await fetch(SUPABASE_URL + '/rest/v1/casting_photos', {
        method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(copies.map((c) => ({ application_id: d.id, url: c.chemin, chemin: c.chemin })))
      });
      if (!rep.ok) throw new Error('base : ' + rep.status);
    } else {
      // seulement si « photos » n'a pas changé entre-temps (sinon rien n'est écrit)
      const nouvelles = d.liens.map((p) => { const c = copies.find((x) => x.lien === p); return c ? c.chemin : p; });
      const rep = await fetch(SUPABASE_URL + '/rest/v1/cours_talons?id=eq.' + encodeURIComponent(d.id) + '&photos=eq.' + encodeURIComponent(JSON.stringify(d.liens)), {
        method: 'PATCH', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ photos: nouvelles })
      });
      const l = rep.ok ? await rep.json().catch(() => null) : null;
      if (!Array.isArray(l) || l.length !== 1) throw new Error('inscription modifiée entre-temps ou base : ' + rep.status);
    }
    return { statut: 200, corps: { fait: d.id, photos: copies.length, restants: d.restants - 1 } };
  } catch (e) {
    if (deposes.length) await effacerFichiersR2(deposes).catch(() => {});   // (tout ou rien)
    return { statut: 200, corps: { echec: d.id, raison: String((e && e.message) || e).slice(0, 160), restants: d.restants } };
  }
}

module.exports = { rattraperUnDossier, extensionDe, LIEN_DRIVE };
