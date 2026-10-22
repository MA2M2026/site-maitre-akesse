// Affichage des photos du site (sorti de js/app.js le 22/10/2026 pour être partagé avec la
// nouvelle Administration, admin/nouvelle/, sans recopier le code) : copies WebP légères,
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
//    (chargement sans fin) pendant 2 × DELAI_SONDE_PHOTOS ALORS QUE la même sonde par le relais
//    répond ; si Cloudflare
//    répond, ou si aucun des deux ne répond (connexion faible du visiteur), on patiente sur
//    Cloudflare : passer par Vercel n'aiderait pas et consommerait son quota (21/10/2026,
//    décision de la propriétaire : 3 visiteurs à connexion très lente basculés pour rien).
// Durée de la bascule ramenée de 12 h à 1 h le 21/10/2026 (même raison).
// Les adresses enregistrées en base ne changent pas (toujours /book-photos/) : seul
// l'affichage est converti, donc revenir en arrière = mettre PHOTOS_DIRECTES_ACTIVES à false.
const PHOTOS_DIRECTES_ACTIVES = true;
const PHOTOS_DIRECTES = 'https://photos.maitreakessemodelmanagement.com/';
const RELAIS_PHOTOS = /^(?:https:\/\/(?:www\.)?maitreakessemodelmanagement\.com)?\/book-photos\//;
const CLE_PHOTOS_RELAIS = 'ma2m_photos_relais';
const DELAI_PHOTOS_DIRECTES = 8000;
const DELAI_SONDE_PHOTOS = 5000;
const DUREE_PHOTOS_RELAIS = 3600 * 1000;
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
// le serveur est joignable. Sonde vers Cloudflare d'abord ; sans réponse après
// DELAI_SONDE_PHOTOS, une seconde sonde part vers le relais, et Cloudflare a encore ce délai
// pour répondre (sa sonde attend parfois derrière les photos en cours). Puis
// rappel(cloudflareRepond, relaisRepond) ; relaisRepond vaut null s'il n'a pas fallu le sonder
// (aucune requête Vercel quand Cloudflare répond).
function sonderPhotosDirectes(rappel) {
  const repondu = { cloudflare: false, relais: false };
  const sonder = (cle, base) => {
    const sonde = new Image();
    sonde.onload = sonde.onerror = () => { repondu[cle] = true; };
    sonde.src = base + 'sonde-connexion?' + Date.now();
    return sonde;
  };
  const cf = sonder('cloudflare', PHOTOS_DIRECTES);
  setTimeout(() => {
    if (repondu.cloudflare) { cf.onload = cf.onerror = null; rappel(true, null); return; }
    const relais = sonder('relais', '/book-photos/');
    setTimeout(() => { cf.onload = cf.onerror = relais.onload = relais.onerror = null; rappel(repondu.cloudflare, repondu.relais); }, DELAI_SONDE_PHOTOS);
  }, DELAI_SONDE_PHOTOS);
}
// Bascule justifiée : Cloudflare muet alors que le relais répond (sinon : connexion du visiteur).
function cloudflareSeulMuet(cloudflare, relais) { return !cloudflare && relais; }
function verifierPhotosDirectes() {
  if (photosParRelais || !photosDirectesEnAttente()) { gardeFouPhotos = null; return; }
  sonderPhotosDirectes((cloudflare, relais) => {
    gardeFouPhotos = null;
    if (cloudflareSeulMuet(cloudflare, relais)) passerAuRelais('Cloudflare sans réponse alors que le relais répond (photos attendues depuis ' + ((DELAI_PHOTOS_DIRECTES + 2 * DELAI_SONDE_PHOTOS) / 1000) + ' s)');
    else if (++patiencesPhotos <= 6) armerGardeFouPhotos();
  });
}
addEventListener('scroll', armerGardeFouPhotos, { passive: true });
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
