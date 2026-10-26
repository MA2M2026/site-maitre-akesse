// ================== Aperçu des liens partagés (actualités / événements / partenaires / fiches des mannequins) ==================
// 20/10/2026 : étendu à la fiche d'UN partenaire (?partenaire=ID : son nom, son texte, son logo).
// 04/10/2026 : étendu à la fiche de CHAQUE mannequin publié (sa photo, son nom,
// catégorie · ville · taille) — jamais ses coordonnées personnelles. (The Book lui-même
// n'est plus ici depuis le 14/10/2026 : son image d'aperçu est assets/apercus/, comme les
// autres pages.)
// Demande de la propriétaire (29/09/2026) : quand on colle le lien d'UNE actualité
// ou d'UN événement dans WhatsApp, Facebook, Instagram, Telegram…, l'aperçu doit
// montrer SA photo, SON titre et SON texte — pas le logo général de l'agence.
//
// Pourquoi ici : ces applis n'exécutent pas le JavaScript de la page ; elles lisent
// seulement les balises « og: » du HTML brut, qui sont les mêmes pour toute la page
// actualites.html. Ce fichier (Routing Middleware Vercel) s'exécute AVANT la page :
//   - visiteur normal → on ne fait RIEN, la page s'affiche exactement comme avant ;
//   - robot d'aperçu (WhatsApp, Facebook…) sur un lien ?actu=ID ou ?evenement=ID →
//     on lui renvoie une petite page qui ne contient que les bonnes balises
//     (titre, texte, photo de CETTE fiche), lues dans Supabase (quelques octets de
//     texte : aucune photo ne transite par Supabase ; la photo est servie par R2
//     via l'optimiseur d'images de Vercel, en version allégée pour WhatsApp).
// En cas de souci (Supabase lent, fiche introuvable…), on laisse passer : le robot
// voit alors l'aperçu général de la page, comme avant. Jamais de page cassée.

export const config = {
  matcher: [
    '/actualites', '/actualites.html', '/evenements', '/evenements.html',
    '/en/actualites', '/en/actualites.html', '/en/evenements', '/en/evenements.html',
    '/partenaires', '/partenaires.html', '/en/partenaires', '/en/partenaires.html',
    '/mannequin', '/mannequin.html', '/en/mannequin', '/en/mannequin.html',
    '/book/:slug', '/en/book/:slug',
    // page d'accueil servie déjà remplie (23/10/2026)
    '/', '/index.html', '/en', '/en/', '/en/index.html',
    // scripts réservés de l'Administration (13/10/2026 ; l'ancien tableau de bord est démoli le 23/10/2026)
    '/js/video-accueil-gabarit.js', '/js/couverture-admin.js', '/js/photos-mises-de-cote-gabarit.js', '/js/photos-mises-de-cote.js',
    '/js/fiches-evenement-gabarit.js', '/js/fiches-evenement-admin.js', '/js/rapport-profils-gabarit.js', '/js/rapport-profils-admin.js', '/js/agenda-gabarit.js', '/js/agenda-admin.js', '/js/agenda-outils.js', '/js/convocations-gabarit.js', '/js/convocations-page.js', '/js/convocations-admin.js', '/js/messages-convocations.js',
    '/js/messages-candidats.js', '/js/messages-groupes-gabarit.js', '/js/messages-groupes.js', '/js/nettoyage-supabase.js', '/js/note-integration.js', '/js/erreurs-corrigees.js', '/js/erreurs-gabarit.js', '/js/erreurs-site.js', '/js/defile-repartition.js', '/js/cartes-acces.js',
    // pièces du bloc 1 de la nouvelle Administration (PLAN-NOUVELLE-ADMINISTRATION.md, 22/10/2026)
    '/js/admin/:fichier*'
  ]
};

// ================== Scripts réservés de l'Administration (13/10/2026, demande de la propriétaire) ==================
// Avant, n'importe qui pouvait télécharger les scripts de l'administration (sans pouvoir lire ni
// modifier les données, protégées par la base). Désormais :
//  - avec la clé « ma2m_admin » (cookie signé posé après la double authentification de
//    l'Administration, api/acces-tableau.js ; voir cookieAccesTableau dans api/_commun.js) → ils passent ;
//  - sans clé → ils répondent « introuvable ».
// Prudence : clé serveur absente → on laisse passer (comportement d'avant) ; la propriétaire ne
// doit jamais être enfermée dehors. (L'ancien tableau de bord, protégé ici aussi, est démoli le
// 23/10/2026 ; son adresse renvoie vers /admin/, vercel.json.)
// ⚠ Même liste que dans config.matcher ci-dessus (vérifié par test-tableau-protege.js).
const SCRIPTS_ADMIN = /^\/js\/(erreurs-gabarit|erreurs-site|note-integration|video-accueil-gabarit|agenda-gabarit|fiches-evenement-gabarit|rapport-profils-gabarit|photos-mises-de-cote-gabarit|couverture-admin|photos-mises-de-cote|fiches-evenement-admin|rapport-profils-admin|agenda-admin|agenda-outils|convocations-gabarit|convocations-page|convocations-admin|messages-convocations|messages-candidats|defile-repartition|cartes-acces|messages-groupes-gabarit|messages-groupes|nettoyage-supabase|erreurs-corrigees)\.js$/;
// Nouvelle Administration : les pièces du bloc 1 (js/admin/site-*.js) sont réservées de la même
// façon ; js/admin/coque.js et js/admin/site.js (décoration, menu) restent publics.
const SCRIPTS_NOUVELLE_ADMIN = /^\/js\/admin\/site-[\w-]+\.js$/;
function base64url(octets) {
  let b = '';
  new Uint8Array(octets).forEach(o => { b += String.fromCodePoint(o); });
  return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');  // « = » n'existe qu'en fin de base64
}
async function signer(secret, texte) {
  const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(await crypto.subtle.sign('HMAC', cle, new TextEncoder().encode(texte)));
}
function egalSur(a, b) {  // comparaison sans fuite de durée
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.codePointAt(i) ^ b.codePointAt(i);
  return d === 0;
}
async function cleAccesValide(requete, secret) {
  const m = (requete.headers.get('cookie') || '').match(/(?:^|;\s*)ma2m_admin=v1\.([0-9a-f-]{36})\.(\d{9,12})\.([A-Za-z0-9_-]{20,})/);
  if (!m || Number(m[2]) < Date.now() / 1000) return false;
  return egalSur(await signer(secret, 'tableau|' + m[1] + '|' + m[2]), m[3]);
}
async function tableauProtege(requete) {
  const secret = typeof process !== 'undefined' && process.env ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
  if (!secret) return;  // configuration absente : comme avant
  if (await cleAccesValide(requete, secret)) return;
  return new Response('Introuvable', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}


const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
// Clé « anon public » : la même que js/supabase-config.js, publique par nature.
const CLE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmaGdoZ213bXhpZ3VodHh0c2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NzI1ODQsImV4cCI6MjEwNDI0ODU4NH0.S-JftGJNtPMLZdK6Jy9AUwwOl56JzyllkEJ0GN0eZ-M';
const SITE = 'https://www.maitreakessemodelmanagement.com';
// Uniquement des robots d'aperçu identifiés sans ambiguïté. Volontairement PAS les
// navigateurs intégrés des applis (Instagram, Facebook « FBAN », Snapchat, LINE…) :
// ce sont de vraies personnes, qui doivent voir la vraie page. Ni Google/Bing, qui
// lisent déjà la vraie page.
const ROBOTS_APERCU = /(?:^WhatsApp\/)|facebookexternalhit|facebot|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|pinterestbot|skypeuripreview|redditbot|vkshare|embedly|iframely|mastodon/i;
// Adresse lisible d'une fiche (06/10/2026) : /book/roxane-ouattara ou /en/book/roxane-ouattara
// (colonne slug, Extension 118).
const CHEMIN_JOLI = /^\/(en\/)?book\/([a-z0-9-]{1,80})\/?$/;
const ID_VALIDE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function echapper(texte) {
  return String(texte == null ? '' : texte)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Retire le dernier mot entamé et les espaces qui le précèdent (texte sans espace : inchangé).
// Sans expression régulière (SonarCloud S8786, 26/10/2026).
function sansDernierMot(s) {
  const blanc = (c) => c === ' ' || c === '\n' || c === '\t' || c === '\r';
  let fin = s.length;
  while (fin > 0 && !blanc(s[fin - 1])) fin--;
  if (fin === 0) return s;
  while (fin > 0 && blanc(s[fin - 1])) fin--;
  return s.slice(0, fin);
}

// Texte riche (HTML de l'éditeur) → texte simple, court, pour la description.
function texteSimple(html, max) {
  const texte = String(html || '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, ' ')
    .replace(/<[^<>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ').trim();
  return texte.length > max ? sansDernierMot(texte.slice(0, max - 1)) + '…' : texte;
}

// corps : envoi (POST, fonctions « rpc/… ») ; null si la base répond une erreur
async function lireSupabase(chemin, corps, delai) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delai || 2500);
  try {
    const rep = await fetch(SUPABASE_URL + '/rest/v1/' + chemin, {
      method: corps ? 'POST' : 'GET',
      headers: Object.assign({ apikey: CLE_ANON, Authorization: 'Bearer ' + CLE_ANON }, corps ? { 'Content-Type': 'application/json' } : {}),
      body: corps ? JSON.stringify(corps) : undefined,
      signal: controleur.signal
    });
    if (!rep.ok) return null;
    return await rep.json();
  } finally {
    clearTimeout(minuteur);
  }
}

// Version allégée de la photo (WhatsApp n'affiche pas les images trop lourdes),
// produite et mise en cache par l'optimiseur d'images de Vercel.
// Sans photo : l'image d'aperçu de la page (assets/apercus/, 14/10/2026), pas le logo seul.
function imageApercu(url, anglais, page) {
  if (!url) return SITE + '/assets/apercus/' + (anglais ? 'en-' : 'fr-') + page + '.jpg?v=2';
  const absolue = /^https?:\/\//i.test(url) ? url : SITE + (url.charAt(0) === '/' ? '' : '/') + url;
  return SITE + '/_vercel/image?url=' + encodeURIComponent(absolue) + '&w=1080&q=75';
}

// Petite page d'aperçu : uniquement les balises lues par WhatsApp, Facebook, Instagram…
function pageApercu({ titre, description, photo, lien, anglais, type }) {
  const nomSite = 'Maître Akesse Model Management';
  const html = '<!DOCTYPE html><html lang="' + (anglais ? 'en' : 'fr') + '"><head><meta charset="utf-8">' +
    '<title>' + echapper(titre + ' — ' + nomSite) + '</title>' +
    '<meta name="description" content="' + echapper(description) + '">' +
    '<meta property="og:type" content="' + (type || 'website') + '">' +
    '<meta property="og:site_name" content="' + echapper(nomSite) + '">' +
    '<meta property="og:title" content="' + echapper(titre) + '">' +
    '<meta property="og:description" content="' + echapper(description) + '">' +
    '<meta property="og:image" content="' + echapper(photo) + '">' +
    '<meta property="og:image:alt" content="' + echapper(titre) + '">' +
    '<meta property="og:url" content="' + echapper(lien) + '">' +
    '<meta property="og:locale" content="' + (anglais ? 'en_US' : 'fr_FR') + '">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="' + echapper(titre) + '">' +
    '<meta name="twitter:description" content="' + echapper(description) + '">' +
    '<meta name="twitter:image" content="' + echapper(photo) + '">' +
    '<link rel="canonical" href="' + echapper(lien) + '">' +
    '</head><body><h1>' + echapper(titre) + '</h1><p>' + echapper(description) + '</p>' +
    '<p><a href="' + echapper(lien) + '">' + echapper(nomSite) + '</a></p></body></html>';
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' }
  });
}

// Meilleure photo d'un mannequin pour l'aperçu : photo principale, sinon couverture, sinon la première.
async function photoMannequin(id) {
  const photos = await lireSupabase('model_photos?model_id=eq.' + id + '&select=url,url_moyenne,principale,photo_couverture&order=created_at.asc&limit=40');
  if (!photos || !photos.length) return '';
  const p = photos.find(x => x.principale) || photos.find(x => x.photo_couverture) || photos[0];
  return p.url_moyenne || p.url || '';
}

// Fiche d'UN mannequin publié.
async function slugMannequin(id) {
  try {
    const lignes = await lireSupabase('model_profiles?id=eq.' + id + '&published=eq.true&select=slug');
    const slug = lignes && lignes[0] && lignes[0].slug;
    return slug && /^[a-z0-9-]{1,80}$/.test(slug) ? slug : '';
  } catch (e) { return ''; }
}

// The Book (liste) : plus de photo du mannequin à la une depuis le 14/10/2026 (demande de la
// propriétaire : l'aperçu doit montrer la PAGE) ; c'est l'image assets/apercus/…-mannequins.jpg
// des balises og: de la page qui est lue.
async function apercuMannequin(url, anglais, idFiche) {
  const id = idFiche || url.searchParams.get('id');
  if (!id || !ID_VALIDE.test(id)) return;
  const lignes = await lireSupabase('model_profiles?id=eq.' + id + '&published=eq.true&select=id,full_name,city,category,height_cm,niveau_mannequin');
  const m = lignes && lignes[0];
  if (!m || !m.full_name) return;
  const categorie = m.category === 'femme' ? (anglais ? 'Female model' : 'Mannequin femme')
    : m.category === 'homme' ? (anglais ? 'Male model' : 'Mannequin homme') : 'New Face';
  const details = [categorie, m.city, m.height_cm ? (m.height_cm / 100).toFixed(2).replace('.', anglais ? '.' : ',') + ' m' : ''].filter(Boolean).join(' · ');
  const description = details + ' — ' + (anglais
    ? 'Discover the full book on Maître Akesse Model Management.'
    : 'Découvrez son book complet sur Maître Akesse Model Management.');
  const slug = await slugMannequin(id);
  const lien = SITE + (anglais ? '/en' : '') + (slug ? '/book/' + slug : '/mannequin?id=' + id);
  return pageApercu({ titre: m.full_name, description, photo: imageApercu(await photoMannequin(id), anglais, 'mannequin'), lien, anglais, type: 'profile' });
}

// Fiche d'UN partenaire (?partenaire=ID, 20/10/2026 : « chaque élément du site a son aperçu ») :
// son nom, sa description et son logo ; sans logo, l'image de la page Partenaires.
async function apercuPartenaire(url, anglais) {
  const id = url.searchParams.get('partenaire');
  if (!id || !ID_VALIDE.test(id)) return;
  const lignes = await lireSupabase('partenaires?id=eq.' + id + '&select=nom,description,logo_url');
  const p = lignes && lignes[0];
  if (!p || !p.nom) return;
  const description = texteSimple(p.description, 220) || (anglais
    ? 'A partner of Maître Akesse Model Management.'
    : 'Partenaire de Maître Akesse Model Management.');
  const lien = SITE + url.pathname.replace(/\.html$/, '') + '?partenaire=' + id;
  return pageApercu({ titre: p.nom, description, photo: imageApercu(p.logo_url, anglais, 'partenaires'), lien, anglais, type: 'website' });
}

// ================== Page d'accueil déjà remplie (23/10/2026, demande de la propriétaire) ==================
// Avant, le serveur envoyait une page vide : le téléphone chargeait ses programmes, puis
// interrogeait deux fois la base, et seulement alors demandait la photo de couverture (5 à 12 s à
// la première visite, même en Wi-Fi). Désormais, la page part avec la liste des mannequins
// publiées et leurs photos (bloc <script type="application/json" id="accueil-donnees">, lu par
// js/accueil.js) et la photo de couverture déjà en place : le téléphone la télécharge dès la
// première seconde. Les photos viennent de Cloudflare ; la copie Vercel (/book-photos/) reste la
// roue de secours (js/photos.js). Liste gardée 5 minutes (une mannequin publiée apparaît au plus
// 5 minutes après ; une mannequin retirée disparaît tout de suite : js/accueil.js revérifie).
// La page n'attend JAMAIS la base plus de 0,8 s : sinon elle part comme avant (remplie par le
// navigateur), et la liste arrive pour les visiteurs suivants.
// (Coût : chaque ouverture de l'accueil passe deux fois par ce fichier, la seconde pour relire la
// page elle-même — sans nouvelle fonction serveur.)
const ACCUEIL = /^\/(en\/?)?(index\.html)?$/;
// ⚠ Même règle que urlLegere et mêmes réglages que js/photos.js (vérifié par test-accueil-serveur.js) :
// copie WebP, servie directement par Cloudflare ; retour en arrière = PHOTOS_DIRECTES_ACTIVES à false.
const PHOTOS_DIRECTES_ACTIVES = true;  // 24/10/2026 : de nouveau par Cloudflare (cause trouvée : ECH, désactivé — voir README-TECHNIQUE.md)
const PHOTOS_DIRECTES = 'https://photos.maitreakessemodelmanagement.com/';
const RELAIS_PHOTOS = /^(?:https:\/\/(?:www\.)?maitreakessemodelmanagement\.com)?\/book-photos\//;
const MARQUE_WEBP = /\/(miniatures|moyennes|petites)\/[^/?]*-w\.jpg(\?.*)?$/;
const DUREE_ACCUEIL = 5 * 60 * 1000;
const ATTENTE_ACCUEIL = 800;
let memoireAccueil = null;  // { quand, donnees }
let lectureAccueil = null;  // lecture de la base en cours (partagée par les visites simultanées)
function photoLegere(url) {
  if (typeof url !== 'string') return '';
  const legere = MARQUE_WEBP.test(url) ? url.replace(/\.jpg(\?|$)/, '.webp$1') : url;
  if (!PHOTOS_DIRECTES_ACTIVES) return legere.indexOf(PHOTOS_DIRECTES) === 0 ? '/book-photos/' + legere.slice(PHOTOS_DIRECTES.length) : legere;
  return legere.replace(RELAIS_PHOTOS, PHOTOS_DIRECTES);
}
// photos de couverture avec leur petite version (comme lirePhotosCouverture, js/photos.js) ;
// l'ancienne fonction tant que supabase-photos-petites.sql n'est pas installé
async function lireCouvertures(ids) {
  return (await lireSupabase('rpc/photos_couverture_petites', { ids }, 3000)) || lireSupabase('rpc/photos_couverture_mannequins', { ids }, 3000);
}
// les mannequins publiées avec leur photo de couverture (les mêmes questions que js/accueil.js)
async function lireDonneesAccueil() {
  const profils = await lireSupabase('model_profiles?published=eq.true&select=id,full_name,city,category,height_cm,featured&order=created_at.desc&limit=200', null, 3000);
  if (!profils) throw new Error('base : mannequins');
  // (en même temps : le mot de Maître Akesse et les castings ouverts, écrits dans la page pour
  // qu'elle ne saute pas quand ils arrivent — 24/10/2026 ; s'ils manquent, le navigateur les lit)
  const [couvertures, mots, castings] = await Promise.all([
    profils.length ? lireCouvertures(profils.map(p => p.id)) : [],
    lireSupabase('mot_responsable?id=eq.principal&select=nom,titre,message,photo_url', null, 3000).catch(() => null),
    lireSupabase('casting_projets?actif=eq.true&select=id&limit=1', null, 3000).catch(() => null)]);
  if (!couvertures) throw new Error('base : photos');
  const photoDe = {};
  couvertures.forEach(c => { if (c.url) photoDe[c.model_id] = c; });
  const donnees = { profils: profils.filter(p => photoDe[p.id]).map(p => Object.assign({ photo: photoDe[p.id].url, petite: photoDe[p.id].url_petite || null }, p)), nombre: profils.length };
  if (Array.isArray(mots)) donnees.mot = mots[0] || null;
  if (Array.isArray(castings)) donnees.castingOuvert = castings.length > 0;
  // le mot en anglais pour l'accueil anglais (traductions_en, même empreinte que versAnglais, js/app.js)
  if (donnees.mot) donnees.motEn = await motEnAnglais(donnees.mot).catch(() => null);
  return donnees;
}
// Retire espaces, tabulations et retours à la ligne en début et en fin (pas les espaces
// insécables : même règle que js/app.js et traduction_cle en base). Sans expression régulière (SonarCloud
// S8786, 26/10/2026 : une expression « ^…+|…+$ » peut devenir très lente sur un long texte).
function rognerBlancs(s) {
  let debut = 0, fin = s.length;
  while (debut < fin && ' \t\r\n'.includes(s[debut])) debut++;
  while (fin > debut && ' \t\r\n'.includes(s[fin - 1])) fin--;
  return s.slice(debut, fin);
}
async function empreinteTexte(t) {
  const propre = rognerBlancs(String(t == null ? '' : t));
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(propre));
  return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, '0')).join('');
}
async function motEnAnglais(mot) {
  const champs = ['titre', 'message'].filter((c) => mot[c]);
  const cles = await Promise.all(champs.map((c) => empreinteTexte(mot[c])));
  const lignes = await lireSupabase('traductions_en?select=cle,en&cle=in.(' + cles.join(',') + ')', null, 2000);
  const en = {};
  champs.forEach((c, i) => { const l = (lignes || []).find((x) => x.cle === cles[i]); if (l) en[c] = l.en; });
  return Object.keys(en).length ? en : null;
}
// Texte d'un élément de la page (repéré par son id) ; brut : déjà écrit pour du HTML
function texteElement(html, id, texte, brut) {
  return html.replace(new RegExp('(<[a-z0-9]+ [^>]*id="' + id + '"[^>]*>)[^<]*(</)'), (m, debut, fin) => debut + (brut ? texte : echapper(texte)) + fin);
}
// Valeur d'un attribut data-… d'un élément (déjà écrite pour du HTML), ou null
function attributElement(html, id, nom) {
  const m = html.match(new RegExp('id="' + id + '"[^>]*\\sdata-' + nom + '="([^"]*)"'));
  return m ? m[1] : null;
}
// Mot de Maître Akesse et casting ouvert : les mêmes textes que js/accueil.js, venus de la page
function completerAccueil(html, donnees, anglais) {
  const mot = donnees.mot && anglais && donnees.motEn ? Object.assign({}, donnees.mot, donnees.motEn) : donnees.mot;
  if (mot && mot.message) {
    const rubrique = attributElement(html, 'edito-rubrique', 'mot');
    if (rubrique) html = texteElement(html, 'edito-rubrique', rubrique, true);
    html = texteElement(html, 'edito-texte', mot.message);
    html = texteElement(html, 'edito-nom', mot.nom || 'Maître Akesse');
    html = texteElement(html, 'edito-fonction', mot.titre || '');
    html = html.replace('<p class="signature u-hidden" id="edito-signature">', '<p class="signature" id="edito-signature">');
    const sommaire = attributElement(html, 'edito', 'sommaire-mot');
    if (sommaire) html = html.replace(/(id="edito" data-sommaire=")[^"]*"/, (m, debut) => debut + sommaire + '"');
  }
  if (donnees.castingOuvert) {
    ['dos-rubrique', 'dos-texte', 'dos-bouton'].forEach((id) => {
      const texte = attributElement(html, id, 'casting');
      if (texte) html = texteElement(html, id, texte, true);
    });
    const lien = attributElement(html, 'dos-bouton', 'casting-lien');
    if (lien) html = html.replace(/(<a [^>]*id="dos-bouton"[^>]*\shref=")[^"]*"/, (m, debut) => debut + lien + '"');
  }
  return html;
}
// liste fraîche (ou vieille de moins de 5 minutes) ; sinon on lance la lecture (une seule à la fois)
// et on l'attend au plus ATTENTE_ACCUEIL ; une liste plus ancienne sert en attendant
function donneesAccueil() {
  const fraiche = memoireAccueil && Date.now() - memoireAccueil.quand < DUREE_ACCUEIL;
  if (fraiche) return Promise.resolve(memoireAccueil.donnees);
  if (!lectureAccueil) {
    lectureAccueil = lireDonneesAccueil()
      .then(donnees => { memoireAccueil = { quand: Date.now(), donnees }; return donnees; })
      // base lente ou en panne : on ne réessaie pas avant 1 minute (liste précédente gardée)
      .catch(() => { memoireAccueil = { quand: Date.now() - DUREE_ACCUEIL + 60 * 1000, donnees: memoireAccueil ? memoireAccueil.donnees : null }; return null; })
      .finally(() => { lectureAccueil = null; });
  }
  const ancienne = memoireAccueil ? memoireAccueil.donnees : null;
  return Promise.race([lectureAccueil.then(d => d || ancienne), new Promise(ok => setTimeout(() => ok(ancienne), ATTENTE_ACCUEIL))]);
}
// JSON posé dans la page : jamais de « < » brut (pas de fin de bloc possible)
const jsonSur = (x) => JSON.stringify(x).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
async function accueilRempli(requete, url) {
  if (requete.method !== 'GET') return;
  const donnees = await donneesAccueil();
  if (!donnees || !donnees.profils.length) return;
  const page = await fetch(url.toString(), { headers: { 'x-ma2m-accueil': '1', 'accept': 'text/html' }, redirect: 'manual' });
  if (!page.ok || !/text\/html/.test(page.headers.get('content-type') || '')) return;
  let html = await page.text();
  const marque = '<img id="couv-img" class="visible" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt=""';
  if (html.indexOf(marque) === -1 || html.indexOf('<main') === -1) return;
  // couverture : une mannequin au hasard à chaque visite (pas celle « À la une »)
  const une = donnees.profils.find(p => p.featured) || donnees.profils[0];
  const autres = donnees.profils.filter(p => p.id !== une.id);
  const couv = autres.length ? autres[Math.floor(Math.random() * autres.length)] : une;
  html = completerAccueil(html, donnees, /^\/en(\/|$)/.test(url.pathname));
  html = html.replace(marque, '<img id="couv-img" class="visible" src="' + echapper(photoLegere(couv.photo)) + '" alt="' + echapper(couv.full_name || '') + '" data-modele="' + echapper(couv.id) + '"')
    .replace('<main', '<script type="application/json" id="accueil-donnees">' + jsonSur(donnees) + '</script>\n<main');
  const entetes = new Headers(page.headers);
  // (le texte a été décompressé pour être complété ; Vercel le recompresse)
  ['content-length', 'content-encoding', 'etag', 'last-modified'].forEach(k => entetes.delete(k));
  entetes.set('Cache-Control', 'no-cache, must-revalidate');
  return new Response(html, { status: 200, headers: entetes });
}

export default async function middleware(requete) {
  try {
    const url = new URL(requete.url);
    if (ACCUEIL.test(url.pathname)) {
      if (requete.headers.get('x-ma2m-accueil')) return;  // (la page elle-même, demandée ci-dessous)
      try { return await accueilRempli(requete, url); } catch (e) { return; }
    }
    if (SCRIPTS_ADMIN.test(url.pathname) || SCRIPTS_NOUVELLE_ADMIN.test(url.pathname)) return await tableauProtege(requete);
    const agent = requete.headers.get('user-agent') || '';
    const anglais = url.pathname.indexOf('/en/') === 0;
    // Adresse lisible /book/nom : on retrouve le mannequin, puis on sert sa fiche
    // à cette même adresse (la barre d'adresse garde /book/nom). Nom inconnu :
    // direction The Book.
    const joli = url.pathname.match(CHEMIN_JOLI);
    if (joli) {
      const ficheSansId = () => new Response(null, { headers: { 'x-middleware-rewrite': new URL((anglais ? '/en' : '') + '/mannequin', url).toString() } });
      let lignes = null;
      try { lignes = await lireSupabase('model_profiles?slug=eq.' + joli[2] + '&published=eq.true&select=id'); } catch (x) { lignes = null; }
      // Base lente ou en panne : la fiche retrouve elle-même le mannequin (js/adresse-fiche.js).
      if (lignes === null) return ROBOTS_APERCU.test(agent) ? undefined : ficheSansId();
      const id = lignes[0] && lignes[0].id;
      if (!id || !ID_VALIDE.test(id)) return Response.redirect(SITE + (anglais ? '/en' : '') + '/mannequins', 302);
      if (ROBOTS_APERCU.test(agent)) {
        const apercu = await apercuMannequin(url, anglais, id);
        if (apercu) return apercu;
      }
      return new Response(null, { headers: { 'x-middleware-rewrite': new URL((anglais ? '/en' : '') + '/mannequin?id=' + id, url).toString() } });
    }
    if (!ROBOTS_APERCU.test(agent)) return; // visiteur normal : rien ne change
    if (/\/mannequin(\.html)?$/.test(url.pathname)) return await apercuMannequin(url, anglais);
    if (/\/partenaires(\.html)?$/.test(url.pathname)) return await apercuPartenaire(url, anglais);
    const estEvenement = url.pathname.indexOf('evenements') !== -1;
    const id = url.searchParams.get(estEvenement ? 'evenement' : 'actu');
    if (!id || !ID_VALIDE.test(id)) return;

    let titre = '';
    let description = '';
    let image = '';
    if (estEvenement) {
      const lignes = await lireSupabase('evenements?id=eq.' + id + '&select=titre,description,lieu,date_evenement,image_url');
      const e = lignes && lignes[0];
      if (!e) return;
      titre = e.titre || '';
      let date = '';
      if (e.date_evenement) {
        try {
          date = new Date(e.date_evenement + 'T12:00:00Z').toLocaleDateString(anglais ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
        } catch (x) { date = ''; }
      }
      const entete = [date, e.lieu].filter(Boolean).join(' · ');
      description = [entete, texteSimple(e.description, 200)].filter(Boolean).join(' — ');
      image = e.image_url;
      if (!image) {
        const photos = await lireSupabase('evenement_photos?evenement_id=eq.' + id + '&select=url&order=created_at.asc&limit=1');
        image = photos && photos[0] && photos[0].url;
      }
    } else {
      const lignes = await lireSupabase('actualites?id=eq.' + id + '&select=titre,commentaire,categorie,image_url');
      const a = lignes && lignes[0];
      if (!a) return;
      titre = a.titre || '';
      description = texteSimple(a.commentaire, 220);
      image = a.image_url;
      if (!image) {
        const photos = await lireSupabase('actualite_photos?actualite_id=eq.' + id + '&select=url&order=created_at.asc&limit=1');
        image = photos && photos[0] && photos[0].url;
      }
    }
    if (!titre) return;

    const lien = SITE + url.pathname.replace(/\.html$/, '') + '?' + (estEvenement ? 'evenement' : 'actu') + '=' + id;
    return pageApercu({ titre, description, photo: imageApercu(image, anglais, estEvenement ? 'evenements' : 'actualites'), lien, anglais, type: 'article' });
  } catch (e) {
    // au moindre souci : la page normale, comme avant (adresse lisible : The Book)
    try {
      const u = new URL(requete.url);
      if (CHEMIN_JOLI.test(u.pathname)) return Response.redirect(SITE + (u.pathname.indexOf('/en/') === 0 ? '/en' : '') + '/mannequins', 302);
    } catch (x) {}
    return;
  }
}
