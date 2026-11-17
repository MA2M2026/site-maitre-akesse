// (17/11/2026, chantier L-18, demande de la propriétaire) RATTRAPAGE DES ANCIENNES PHOTOS : les candidatures et les
// inscriptions aux cours de talons reçues AVANT L-17 n'ont leurs photos que dans Google Drive, et Google ne les sert
// pas de façon fiable à l'Administration (elles apparaissent puis disparaissent). Ici, UN dossier à la fois, ses
// photos Drive sont copiées chez Cloudflare R2, puis la base est mise à jour : l'Administration les affiche alors
// depuis Cloudflare, comme les nouvelles (règle « M ≤ N », js/admin/coque.js).
//  - Tout ou rien : si une seule photo du dossier échoue, les copies déposées PAR CET APPEL et que rien ne cite sont
//    retirées, rien n'est noté ; le dossier reste affiché depuis Drive, comme avant, et peut être repris plus tard.
//  - Rien n'est supprimé : ni dans le Drive, ni les lignes Drive de casting_photos (cachées par la règle M ≤ N).
//    Cours de talons : les liens Drive de « photos » sont remplacés par leurs copies (le nombre ne change pas, la limite
//    de 5 tient) ; ils restent dans le journal medias_drive.
//  - Nom FIXE de chaque copie (empreinte de l'identifiant Drive) : relancer ne crée jamais de doublon.
//  - Seules les adresses Drive au format exact sont suivies (jamais une adresse libre lue dans la base).
//  - Le choix du dossier lit la base par pages (la base ne rend que 1 000 lignes à la fois) : aucun dossier oublié.
// Appelé par api/r2-presigner.js (action « rattrapage_drive »), réservé à l'administratrice principale.
const crypto = require('crypto');
const { SUPABASE_URL, enTetesService, creerClientR2 } = require('./_commun.js');
const { effacerFichiersR2, extensionImage, nouvellePhotoDossier } = require('./_r2.js');

const LIEN_DRIVE = /^https:\/\/drive\.google\.com\/thumbnail\?id=([A-Za-z0-9_-]{10,120})&sz=w2000$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TAILLE_MAX = 15 * 1024 * 1024;
const PHOTOS_MAX = 20;          // (medias_drive_enregistrer accepte 20 photos au plus par envoi)
const EN_MEME_TEMPS = 3;        // (photos demandées à Google en même temps : pas de rafale)
const BUDGET_MS = 22000;        // (la fonction a 30 s : on garde de quoi tout retirer en cas d'échec)
const PAGE = 500;

const lire = async (url) => { const r = await fetch(SUPABASE_URL + '/rest/v1/' + url, { headers: enTetesService() }); if (!r.ok) throw new Error('lecture de la base impossible (' + r.status + ')'); return r.json(); };
const nomFixe = (idDrive) => crypto.createHash('sha256').update(idDrive).digest('hex').slice(0, 32);
const avecDelai = (promesse, ms, quoi) => Promise.race([promesse, new Promise((_, ko) => setTimeout(() => ko(new Error(quoi + ' : délai dépassé')), ms))]);

// Télécharge une photo Drive (8 s au plus) : { octets, ext } ou une erreur parlante
async function telecharger(lien) {
  if (!LIEN_DRIVE.test(lien)) throw new Error('adresse Drive inattendue');
  const arret = new AbortController(), minuteur = setTimeout(() => arret.abort(), 8000);
  try {
    const rep = await fetch(lien, { signal: arret.signal, redirect: 'follow' });
    if (!rep.ok) throw new Error('Google répond ' + rep.status);
    const octets = new Uint8Array(await rep.arrayBuffer());
    if (!octets.length || octets.length > TAILLE_MAX) throw new Error('photo vide ou trop lourde');
    const ext = extensionImage(Array.from(octets.slice(0, 16)));
    if (!ext) throw new Error('Google n’a pas renvoyé une image');
    return { octets, ext };
  } finally { clearTimeout(minuteur); }
}

// Le prochain dossier à rattraper (le plus récent d'abord), hors « exclus » : { id, liens, encore } ou { id: null }.
async function prochainDossier(source, exclus) {
  for (let debut = 0; debut < 200000; debut += PAGE) {
    if (source === 'candidature') {
      const drive = await lire('casting_photos?select=application_id,url&chemin=is.null&url=like.https://drive.google.com/thumbnail*&order=created_at.desc,id.asc&limit=' + PAGE + '&offset=' + debut);
      const parDossier = new Map();
      drive.forEach((x) => { const id = x.application_id; if (id && UUID.test(id) && !exclus.has(id)) (parDossier.get(id) || parDossier.set(id, []).get(id)).push(x.url); });
      const ids = [...parDossier.keys()], dejaR2 = new Set();
      for (let i = 0; i < ids.length; i += 50) {
        (await lire('casting_photos?select=application_id&chemin=like.r2:*&application_id=in.(' + ids.slice(i, i + 50).join(',') + ')&limit=1000')).forEach((x) => dejaR2.add(x.application_id));
      }
      const id = ids.find((x) => !dejaR2.has(x));
      if (id) {
        // toutes les lignes Drive de CE dossier (elles peuvent déborder de la page)
        const liens = (await lire('casting_photos?select=url&chemin=is.null&application_id=eq.' + id + '&limit=100')).map((x) => x.url);
        return { id, liens, encore: true };
      }
      if (drive.length < PAGE) return { id: null };
    } else {
      const lignes = await lire('cours_talons?select=id,photos&order=cree_le.desc,id.asc&limit=' + PAGE + '&offset=' + debut);
      const t = lignes.find((x) => !exclus.has(x.id) && Array.isArray(x.photos) && x.photos.some((p) => LIEN_DRIVE.test(String(p))) && !x.photos.some((p) => String(p).startsWith('r2:')));
      if (t) return { id: t.id, liens: t.photos, encore: true };
      if (lignes.length < PAGE) return { id: null };
    }
  }
  return { id: null };
}

// Parmi des fichiers déposés, ceux que la base ne cite PAS (les seuls qu'on peut retirer sans risque)
async function nonCites(source, id, cles) {
  const cites = new Set();
  if (source === 'candidature') (await lire('casting_photos?select=chemin&application_id=eq.' + id + '&chemin=like.r2:*')).forEach((x) => cites.add(x.chemin));
  else (await lire('cours_talons?select=photos&id=eq.' + id)).forEach((x) => (Array.isArray(x.photos) ? x.photos : []).forEach((p) => cites.add(p)));
  return cles.filter((k) => !cites.has('r2:' + k));
}

// Rattrape UN dossier. Réponse : { fini: true } | { fait: id, photos: n } | { echec: id, raison }
async function rattraperUnDossier(source, exclusListe) {
  if (source !== 'candidature' && source !== 'cours_talons') return { statut: 400, corps: { error: 'Source inconnue.' } };
  const exclus = new Set((Array.isArray(exclusListe) ? exclusListe : []).filter((x) => typeof x === 'string' && UUID.test(x)).slice(0, 500));
  const d = await prochainDossier(source, exclus);
  if (!d.id) return { statut: 200, corps: { fini: true } };
  const id = String(d.id).toLowerCase(), dossier = source === 'candidature' ? 'candidatures' : 'cours-talons', debut = Date.now();
  const liensDrive = [...new Set(d.liens.filter((l) => LIEN_DRIVE.test(String(l))))].slice(0, PHOTOS_MAX);
  const deposes = [];
  try {
    if (!liensDrive.length) throw new Error('aucune photo Drive lisible');
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const client = creerClientR2(), copies = [];
    // par petits groupes (jamais de rafale chez Google) ; tout s'arrête si le temps manque
    for (let i = 0; i < liensDrive.length; i += EN_MEME_TEMPS) {
      if (Date.now() - debut > BUDGET_MS) throw new Error('trop long pour un seul passage');
      const groupe = await Promise.allSettled(liensDrive.slice(i, i + EN_MEME_TEMPS).map(async (lien) => {
        const { octets, ext } = await telecharger(lien);
        const cle = nouvellePhotoDossier(dossier, id, ext, nomFixe(LIEN_DRIVE.exec(lien)[1]));
        deposes.push(cle);   // (noté AVANT l'envoi : un envoi coupé est retiré aussi)
        await avecDelai(client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: cle, Body: octets, ContentType: ext === 'jpg' ? 'image/jpeg' : 'image/' + ext })), 8000, 'dépôt chez Cloudflare');
        return { lien, chemin: 'r2:' + cle };
      }));
      const rate = groupe.find((x) => x.status === 'rejected');
      if (rate) throw rate.reason;
      groupe.forEach((x) => copies.push(x.value));
    }
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
    return { statut: 200, corps: { fait: d.id, photos: copies.length } };
  } catch (e) {
    // (tout ou rien) seulement ce que la base ne cite pas : jamais une copie déjà utilisée par un autre passage
    if (deposes.length) await nonCites(source, d.id, deposes).then((l) => (l.length ? effacerFichiersR2(l) : null)).catch(() => {});
    return { statut: 200, corps: { echec: d.id, raison: String((e && e.message) || e).slice(0, 160) } };
  }
}

module.exports = { rattraperUnDossier, LIEN_DRIVE };
