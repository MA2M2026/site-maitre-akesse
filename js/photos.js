// Affichage des photos du site (sorti de js/app.js le 22/10/2026 pour être partagé avec la
// nouvelle Administration, admin/index.html, sans recopier le code) : copies WebP légères,
// photos servies directement par Cloudflare avec la roue de secours du relais Vercel.
// À charger AVANT js/app.js (qui s'en sert) sur toutes les pages.
// Journal des erreurs : window.signalerErreur (js/surveillance.js), s'il est présent.
// ---- Photos légères en WebP (12/10/2026, demande de la propriétaire) ----
// Chaque version réduite (miniature 800 px, moyenne 1400 px) est envoyée en JPEG ET, quand
// le navigateur sait écrire le WebP (Chrome, Firefox, Edge… ; pas Safari), en WebP, environ
// 30 % plus léger. Le nom du JPEG se termine alors par « -w.jpg » et la copie WebP porte le
// même nom en « .webp » : aucune colonne de plus dans la base. Les photos d'origine ne
// changent jamais.
// Seules les versions réduites (dossiers miniatures/ et moyennes/) portent la marque : une
// photo d'origine dont le nom finirait par « -w.jpg » n'est jamais concernée.
const MARQUE_WEBP = /\/(miniatures|moyennes)\/[^/?]*-w\.jpg(\?.*)?$/;
function cheminWebp(chemin) { return typeof chemin === 'string' && /\/(miniatures|moyennes)\/[^/?]*-w\.jpg$/.test(chemin) ? chemin.replace(/\.jpg$/, '.webp') : null; }
// Adresse JPEG de secours d'une copie WebP (null si ce n'en est pas une).
function urlJpegDeSecours(url) { return typeof url === 'string' && /\/(miniatures|moyennes)\/[^/?]*-w\.webp(\?|$)/.test(url) ? url.replace(/\.webp(\?|$)/, '.jpg$1') : null; }
// Ce navigateur sait-il ÉCRIRE du WebP (fabriquer les copies) ? Safari, non : ses envois
// restent en JPEG seul, et le tableau de bord les rattrapera depuis un autre navigateur.
function navigateurEcritWebp() {
  try { return document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp'); } catch (e) { return false; }
}
// ---- Photos servies directement par Cloudflare (13/10/2026, demande de la propriétaire) ----
// Avant, chaque photo affichée passait par le relais Vercel « /book-photos/ » et comptait
// dans le quota Vercel (100 Go/mois). Les pages publiques demandent désormais la photo
// directement au domaine photos.maitreakessemodelmanagement.com (Cloudflare R2, trafic
// gratuit), AVEC UNE ROUE DE SECOURS : le 13/10/2026, ce domaine restait parfois
// injoignable quelques minutes depuis un téléphone sur une box Orange CI (connexion
// coupée, ERR_CONNECTION_CLOSED). Le visiteur passe au relais Vercel pendant 1 h (sans
// rien lui demander, noté une fois dans le journal des erreurs pour suivre le rodage) :
//  - quand une photo directe échoue ET que la même photo s'affiche par le relais (une
//    photo simplement absente, qui échoue des deux côtés, ne compte pas) ;
//  - quand des photos directes attendues à l'écran ne sont toujours pas là après
//    DELAI_PHOTOS_DIRECTES ET qu'une petite sonde vers Cloudflare reste sans réponse
//    (chargement sans fin) pendant DELAI_SONDE_PHOTOS ALORS QUE la même sonde par le relais,
//    partie en même temps, répond ; si Cloudflare
//    répond, ou si aucun des deux ne répond (connexion faible du visiteur), on patiente sur
//    Cloudflare : passer par Vercel n'aiderait pas et consommerait son quota (21/10/2026,
//    décision de la propriétaire : 3 visiteurs à connexion très lente basculés pour rien).
// Durée de la bascule ramenée de 12 h à 1 h le 21/10/2026 (même raison).
// Délais raccourcis le 23/10/2026 (8 s + 2 × 5 s → 2,5 s + 2 s : sur sa box Orange, la
// propriétaire attendait les photos de l'accueil ; Cloudflare y coupait la connexion ou ne
// répondait plus). Une connexion seulement lente ne bascule toujours pas : Cloudflare répond
// à la sonde, même quand les photos mettent du temps.
// Les adresses enregistrées en base ne changent pas (toujours /book-photos/) : seul
// l'affichage est converti, donc revenir en arrière = mettre PHOTOS_DIRECTES_ACTIVES à false.
const PHOTOS_DIRECTES_ACTIVES = true;
const PHOTOS_DIRECTES = 'https://photos.maitreakessemodelmanagement.com/';
const RELAIS_PHOTOS = /^(?:https:\/\/(?:www\.)?maitreakessemodelmanagement\.com)?\/book-photos\//;
const CLE_PHOTOS_RELAIS = 'ma2m_photos_relais';
const DELAI_PHOTOS_DIRECTES = 2500;
const DELAI_SONDE_PHOTOS = 2000;
const DUREE_PHOTOS_RELAIS = 3600 * 1000;
// Photo du Book à TÉLÉCHARGER par le navigateur (CV, compcard, rattrapage) : toujours par le relais
// de la même adresse que la page. Depuis l'Administration (admin.…), l'adresse www ou l'adresse
// directe des photos est refusée par la sécurité du navigateur (connect-src) : CV sans photos
// (signalé par la propriétaire le 22/10/2026).
function urlPhotoMemeOrigine(url) {
  if (typeof url !== 'string') return url;
  if (RELAIS_PHOTOS.test(url)) return url.replace(RELAIS_PHOTOS, '/book-photos/');
  return url.indexOf(PHOTOS_DIRECTES) === 0 ? '/book-photos/' + url.slice(PHOTOS_DIRECTES.length) : url;
}
// Lu une seule fois par page, puis mis à jour par passerAuRelais.
let photosParRelais = (function () {
  if (!PHOTOS_DIRECTES_ACTIVES) return true;
  try { return Number(localStorage.getItem(CLE_PHOTOS_RELAIS)) > Date.now(); } catch (e) { return false; }
})();
function estPhotoDirecte(url) { return typeof url === 'string' && url.startsWith(PHOTOS_DIRECTES); }
// Adresse par le relais Vercel d'une photo directe (null si ce n'en est pas une).
function urlParRelais(url) { return estPhotoDirecte(url) ? '/book-photos/' + url.slice(PHOTOS_DIRECTES.length) : null; }
// Une fois au relais, toute photo directe de la page — déjà là mais pas encore affichée, ou
// ajoutée plus tard (filtres, sélection, adresses gardées en mémoire par un script) —
// repart aussitôt par le relais.
let observateurRelais = null;
function relayerPhotosDirectes() {
  if (observateurRelais || typeof MutationObserver === 'undefined') return;
  const relayer = (img, memeAffichee) => {
    if (!memeAffichee && img.complete && img.naturalWidth) return;
    const relais = urlParRelais(img.getAttribute('src'));
    if (relais) img.src = relais;
  };
  observateurRelais = new MutationObserver(changements => changements.forEach(c => {
    if (c.type === 'attributes') { if (c.target.tagName === 'IMG') relayer(c.target, true); return; }
    c.addedNodes.forEach(n => {
      if (n.tagName === 'IMG') relayer(n, true);
      else if (n.querySelectorAll) n.querySelectorAll('img').forEach(img => relayer(img, true));
    });
  }));
  observateurRelais.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
  document.querySelectorAll('img').forEach(img => relayer(img, false));
}
if (photosParRelais && PHOTOS_DIRECTES_ACTIVES) relayerPhotosDirectes();
const prechargementsDirects = new Set();
function passerAuRelais(raison) {
  if (photosParRelais) return;
  photosParRelais = true;
  try { localStorage.setItem(CLE_PHOTOS_RELAIS, String(Date.now() + DUREE_PHOTOS_RELAIS)); } catch (e) {}
  prechargementsDirects.forEach(pre => { const relais = urlParRelais(pre.getAttribute('src')); if (relais) pre.src = relais; });
  relayerPhotosDirectes();
  document.dispatchEvent(new Event('ma2m:photos-relais'));  // la vidéo de l'accueil suit (js/video-accueil.js)
  if (window.signalerErreur) window.signalerErreur('photos', 'Photos directes Cloudflare injoignables → relais Vercel', raison);
}
// Garde-fou contre le chargement sans fin (aucune erreur n'arrive dans ce cas). Armé à
// chaque photo directe préparée et à chaque défilement (photos « lazy » qui partent).
let gardeFouPhotos = null;
let patiencesPhotos = 0;
function armerGardeFouPhotos() {
  if (gardeFouPhotos || photosParRelais) return;
  gardeFouPhotos = setTimeout(verifierPhotosDirectes, DELAI_PHOTOS_DIRECTES);
}
function photosDirectesEnAttente() {
  return prechargementsDirects.size > 0 || Array.from(document.images).some(img => {
    if (img.complete || !estPhotoDirecte(img.getAttribute('src'))) return false;
    const r = img.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.width > 0;
  });
}
// Lenteur ou domaine muet ? Une adresse inexistante répond tout de suite (erreur 404) quand
// le serveur est joignable. Deux petites sondes partent ensemble, vers Cloudflare et vers le
// relais ; après DELAI_SONDE_PHOTOS : rappel(cloudflareRepond, relaisRepond).
function sonderPhotosDirectes(rappel) {
  const repondu = { cloudflare: false, relais: false };
  const sonder = (cle, base) => {
    const sonde = new Image();
    sonde.onload = sonde.onerror = () => { repondu[cle] = true; };
    sonde.src = base + 'sonde-connexion?' + Date.now();
    return sonde;
  };
  const cf = sonder('cloudflare', PHOTOS_DIRECTES), relais = sonder('relais', '/book-photos/');
  setTimeout(() => { cf.onload = cf.onerror = relais.onload = relais.onerror = null; rappel(repondu.cloudflare, repondu.relais); }, DELAI_SONDE_PHOTOS);
}
// Bascule justifiée : Cloudflare muet alors que le relais répond (sinon : connexion du visiteur).
function cloudflareSeulMuet(cloudflare, relais) { return !cloudflare && relais; }
function verifierPhotosDirectes() {
  if (photosParRelais || !photosDirectesEnAttente()) { gardeFouPhotos = null; return; }
  sonderPhotosDirectes((cloudflare, relais) => {
    gardeFouPhotos = null;
    if (cloudflareSeulMuet(cloudflare, relais)) passerAuRelais('Cloudflare sans réponse alors que le relais répond (photos attendues depuis ' + ((DELAI_PHOTOS_DIRECTES + DELAI_SONDE_PHOTOS) / 1000) + ' s)');
    else if (++patiencesPhotos <= 6) armerGardeFouPhotos();
  });
}
addEventListener('scroll', armerGardeFouPhotos, { passive: true });
// photos directes déjà écrites dans la page (accueil rempli par le serveur, middleware.js) :
// surveillées dès l'arrivée de ce fichier
armerGardeFouPhotos();
// Adresse à afficher : la copie WebP quand elle existe, servie directement par Cloudflare,
// ou par le relais une fois la bascule faite. Peut être rappelée sur une adresse déjà
// convertie (photos gardées en mémoire d'une visite à l'autre : accueil, sélection).
function urlLegere(url) {
  if (typeof url !== 'string') return url;
  let legere = MARQUE_WEBP.test(url) ? url.replace(/\.jpg(\?|$)/, '.webp$1') : url;
  legere = urlParRelais(legere) || legere;
  if (photosParRelais || !RELAIS_PHOTOS.test(legere)) return legere;
  armerGardeFouPhotos();
  return legere.replace(RELAIS_PHOTOS, PHOTOS_DIRECTES);
}
// Adresse de secours d'une photo qui n'a pas pu s'afficher : d'abord le JPEG, au même
// endroit (copie WebP absente — ancienne photo pas encore rattrapée — ou navigateur qui
// ne lit pas le WebP) ; puis, pour une photo directe, la même photo par le relais.
function urlDeSecours(url) { return urlJpegDeSecours(url) || urlParRelais(url); }
// Préchargement d'une photo (new Image(), hors de la page) avec la même roue de secours ;
// surSucces(url) reçoit l'adresse qui a fonctionné.
function prechargerPhoto(url, surSucces, prioritaire) {
  const pre = new Image();
  if (prioritaire) pre.fetchPriority = 'high';
  let parSecoursRelais = false;
  if (estPhotoDirecte(url)) prechargementsDirects.add(pre);
  pre.onload = () => {
    prechargementsDirects.delete(pre);
    if (parSecoursRelais) passerAuRelais('échec de ' + url);
    surSucces(pre.getAttribute('src'));
  };
  pre.onerror = () => {
    prechargementsDirects.delete(pre);
    const echec = pre.getAttribute('src'), secours = urlDeSecours(echec);
    if (!secours) return;
    if (estPhotoDirecte(echec) && !estPhotoDirecte(secours)) parSecoursRelais = true;
    pre.src = secours;
  };
  pre.src = url;
}
// Images de la page : même roue de secours.
document.addEventListener('error', function (e) {
  const img = e.target;
  if (img?.tagName !== 'IMG') return;
  const echec = img.getAttribute('src'), secours = urlDeSecours(echec);
  if (!secours) return;
  if (estPhotoDirecte(echec) && !estPhotoDirecte(secours)) img.dataset.secoursRelais = echec;
  img.src = secours;
}, true);
// Photo directe qui s'affiche par le relais : Cloudflare est bien en cause, on bascule.
document.addEventListener('load', function (e) {
  const img = e.target;
  if (img?.tagName !== 'IMG' || !img.dataset.secoursRelais) return;
  const echec = img.dataset.secoursRelais;
  delete img.dataset.secoursRelais;
  passerAuRelais('échec de ' + echec);
}, true);

// Rattrapage automatique des anciennes photos du Book (demande de la propriétaire,
// 06/10/2026 : plus de boutons à appuyer). Les nouvelles photos ont déjà, dès leur envoi,
// leur miniature nette (800 px) et leur version moyenne. Pour les photos plus anciennes,
// l'Administration fait le travail toute seule, en arrière-plan, quelques secondes après
// l'ouverture (js/admin/coque.js ; déplacé de l'ancien tableau de bord à sa démolition, 23/10/2026) : il fabrique la miniature ou la version moyenne qui manque, à partir de
// la photo d'origine (jamais modifiée), puis met à jour la fiche de la photo. Une fois
// par ouverture ; si la page est fermée avant la fin, il reprend à la suivante. Après 5
// échecs (réseau faible), il s'arrête et réessaiera la prochaine fois.
// Une version (miniature ou moyenne) refaite à partir de l'original ; false si la copie
// WebP attendue n'a pas pu être envoyée.
async function refaireVersion(photo, original, maj, cle, dossier, fin, cote, qualite) {
  const v = await envoyerVersionPhoto(photo.model_id, original, dossier, fin, cote, qualite);
  if (!v) throw new Error('Image illisible');
  maj['url_' + cle] = v.url; maj['chemin_' + cle] = v.chemin;
  return !!cheminWebp(v.chemin);
}
async function rattraperPhotosEnArrierePlan() {
  try { if (sessionStorage.getItem('ma2m_rattrapage_photos')) return; sessionStorage.setItem('ma2m_rattrapage_photos', '1'); } catch (e) {}
  const { data: photos, error } = await sb.from('model_photos')
    .select('id, model_id, url, url_miniature, url_moyenne, chemin_miniature, chemin_moyenne');
  if (error || !photos) return;
  // Versions à (re)faire : absente, ancienne miniature (< 800 px), ou sans copie WebP légère
  // quand ce navigateur sait l'écrire (12/10/2026 ; voir envoyerVersionPhoto dans js/app.js).
  // Copies WebP : sur un ordinateur ou une tablette (écran de 700 px et plus ; 14/10/2026 : la
  // propriétaire travaille surtout sur tablette, les copies ne se faisaient donc jamais) hors
  // connexion mobile signalée — environ 370 photos d'origine à télécharger — et 40 photos au
  // plus par ouverture.
  // Une photo à la fois (pas en parallèle) pour ménager la connexion.
  const c = navigator.connection || {};
  const donneesMobiles = c.saveData || c.type === 'cellular' || /(^|-)(2g|3g)$/.test(c.effectiveType || '');
  let webp = navigateurEcritWebp() && !donneesMobiles && window.matchMedia('(min-width: 700px) and (min-height: 600px)').matches; // pas un téléphone tenu en largeur
  const miniatureAFaire = p => !p.url_miniature || !/-n800(-w)?\.jpg$/.test(p.chemin_miniature || '') || (webp && !cheminWebp(p.chemin_miniature));
  const moyenneAFaire = p => !p.url_moyenne || (webp && !cheminWebp(p.chemin_moyenne));
  const aFaire = photos.filter(p => p.url && (miniatureAFaire(p) || moyenneAFaire(p))).slice(0, 40);
  let echecs = 0, faites = 0;
  for (const photo of aFaire) {
    if (echecs >= 5) break;
    const mini = miniatureAFaire(photo), moyenne = moyenneAFaire(photo);
    if (!mini && !moyenne) continue;  // plus rien à faire sans WebP
    try {
      // par le relais de la même adresse (20/10/2026 : depuis admin.…, l'adresse www enregistrée
      // en base était refusée par la sécurité du navigateur, connect-src)
      const reponse = await fetch(urlPhotoMemeOrigine(photo.url));
      if (!reponse.ok) throw new Error('Téléchargement échoué (HTTP ' + reponse.status + ')');
      const original = await reponse.blob();
      const maj = {};
      let webpOk = true;
      if (mini) webpOk = await refaireVersion(photo, original, maj, 'miniature', 'miniatures', '-n800', 800, 0.75);
      if (moyenne) webpOk = (await refaireVersion(photo, original, maj, 'moyenne', 'moyennes', '', 1400, 0.78)) && webpOk;
      if (!webpOk) webp = false;  // copie WebP refusée : on n'insiste pas pour les suivantes
      // seulement si la photo n'a pas été remplacée entre-temps (bouton « Remplacer »)
      const { error: erreurMaj } = await sb.from('model_photos').update(maj).eq('id', photo.id).eq('url', photo.url);
      if (erreurMaj) throw erreurMaj;
      faites++;
    } catch (e) {
      echecs++;
      console.warn('Rattrapage photo', photo.id, e);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  if (aFaire.length) console.info('Rattrapage des photos :', faites, 'faite(s) sur', aFaire.length, '—', echecs, 'échec(s).');
}
