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

// Dessin des pages par le serveur (01/11/2026, site dynamique, étape A) : les mêmes fichiers que la page
// (scripts classiques qui posent globalThis.Rendu…), une seule façon de dessiner pour les deux.
import './js/rendu-book.js';
import './js/rendu-publications.js';

export const config = {
  matcher: [
    '/actualites', '/actualites.html', '/evenements', '/evenements.html',
    '/en/actualites', '/en/actualites.html', '/en/evenements', '/en/evenements.html',
    '/partenaires', '/partenaires.html', '/en/partenaires', '/en/partenaires.html',
    '/mannequin', '/mannequin.html', '/en/mannequin', '/en/mannequin.html',
    '/book/:slug', '/en/book/:slug',
    // pages servies déjà remplies (01/11/2026, site dynamique : Book, partenaires, agenda, parcours, qui sommes-nous)
    '/mannequins', '/mannequins.html', '/en/mannequins', '/en/mannequins.html',
    '/agenda', '/agenda.html', '/en/agenda', '/en/agenda.html', '/parcours', '/parcours.html', '/en/parcours', '/en/parcours.html',
    '/qui-sommes-nous', '/qui-sommes-nous.html', '/en/qui-sommes-nous', '/en/qui-sommes-nous.html',
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
async function lireCouvertures(ids, delai) {
  const d = () => (typeof delai === 'function' ? delai() : delai || 3000);
  return (await lireSupabase('rpc/photos_couverture_petites', { ids }, d())) || lireSupabase('rpc/photos_couverture_mannequins', { ids }, d());
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
  const [en] = await versAnglaisServeur([{ titre: mot.titre, message: mot.message }], ['titre', 'message']);
  const champs = ['titre', 'message'].filter((c) => mot[c] && en[c] !== mot[c]);
  return champs.length ? Object.fromEntries(champs.map((c) => [c, en[c]])) : null;
}
// Copies anglaises de lignes (pages /en préparées par le serveur, 01/11/2026) : mêmes traductions que la page
// (table traductions_en, même empreinte que versAnglais de js/app.js) ; un texte sans traduction reste en
// français (comme dans la page). Ne modifie jamais les lignes reçues (elles sont gardées en mémoire).
async function versAnglaisServeur(lignes, champs) {
  const copies = lignes.map((l) => Object.assign({}, l));
  const textes = [...new Set(copies.flatMap((l) => champs.map((c) => l[c]).filter((v) => typeof v === 'string' && rognerBlancs(v))))];
  if (!textes.length) return copies;
  const cles = await Promise.all(textes.map(empreinteTexte));
  const parCle = new Map();
  for (let i = 0; i < cles.length; i += 80) {
    const lu = await lireSupabase('traductions_en?select=cle,en&cle=in.(' + cles.slice(i, i + 80).join(',') + ')', null, 1500).catch(() => null);
    (lu || []).forEach((x) => parCle.set(x.cle, x.en));
  }
  const parTexte = new Map(textes.map((t, i) => [t, parCle.get(cles[i])]));
  copies.forEach((l) => champs.forEach((c) => { const v = parTexte.get(l[c]); if (v) l[c] = v; }));
  return copies;
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
  // (remplacements par fonction : un « $ » venu de la base n'est jamais lu comme motif de remplacement)
  html = html.replace(marque, () => '<img id="couv-img" class="visible" src="' + echapper(photoLegere(couv.photo)) + '" alt="' + echapper(couv.full_name || '') + '" data-modele="' + echapper(couv.id) + '"')
    .replace('<main', () => '<script type="application/json" id="accueil-donnees">' + jsonSur(donnees) + '</script>\n<main');
  return reponseHtml(html, page);
}
// page complétée : mêmes en-têtes que la page d'origine, sauf taille et compression (le texte a été
// décompressé pour être complété ; Vercel le recompresse), et jamais gardée en cache
function reponseHtml(html, page) {
  const entetes = new Headers(page.headers);
  ['content-length', 'content-encoding', 'etag', 'last-modified'].forEach(k => entetes.delete(k));
  entetes.set('Cache-Control', 'no-cache, must-revalidate');
  return new Response(html, { status: 200, headers: entetes });
}

// ================== Pages préparées par le serveur : outil commun (01/11/2026, site dynamique) ==================
// Demande la page elle-même (en-tête « x-ma2m-remplie » : elle repasse ici sans être retouchée) EN MÊME
// TEMPS que la lecture de ses données, puis pose les données dans la page (bloc <script type="application/json"
// id="…">, juste après <body>, texte passé par jsonSur : rien d'injectable) ; retoucher(html, données) peut
// compléter l'en-tête (titre, photo annoncée…). Données absentes (base lente ou en panne) ou page
// inattendue : null, et la page part comme avant. Jamais gardée en cache.
const ATTENTE_FICHE = 1200;  // la base a 1,2 s au plus pour répondre
// Mémoire de quelques minutes (demande de la propriétaire, 01/11/2026) : une lecture réussie de la base est
// gardée 3 minutes par ce serveur (et partagée par les visites simultanées) ; la base n'est donc pas
// interrogée à chaque visite. Une modification faite dans l'Administration se voit au plus 3 minutes après.
// Une lecture ratée (base lente, en panne) n'est jamais gardée.
const DUREE_MEMOIRE = 3 * 60 * 1000;
const memoirePages = new Map();  // clé → { quand, promesse }
function enMemoire(cle, lire) {
  if (globalThis.MA2M_SANS_MEMOIRE) return lire();  // (essais : mémoire coupée)
  const ici = memoirePages.get(cle);
  if (ici && Date.now() - ici.quand < DUREE_MEMOIRE) return ici.promesse;
  const promesse = lire().then((d) => { if (!d) memoirePages.delete(cle); return d; }, (e) => { memoirePages.delete(cle); throw e; });
  memoirePages.set(cle, { quand: Date.now(), promesse });
  if (memoirePages.size > 500) memoirePages.delete(memoirePages.keys().next().value);
  return promesse;
}
// téléphone (photo plus légère, comme js/photos.js) : d'après le navigateur qui demande la page
const estTelephone = (requete) => requete?.headers.get('sec-ch-ua-mobile') === '?1' || /Mobi|Android|iPhone|iPod/i.test(requete?.headers.get('user-agent') || '');
async function pageRemplie(url, cheminPage, idBloc, lecture, retoucher) {
  const demandePage = fetch(new URL(cheminPage, url).toString(), { headers: { 'x-ma2m-remplie': '1', 'accept': 'text/html' }, redirect: 'manual' });
  const [donnees, page] = await Promise.all([lecture.catch(() => null), demandePage]);
  if (!page.ok || !/text\/html/.test(page.headers.get('content-type') || '')) return null;
  // données absentes : la page déjà demandée part telle quelle (elle se remplira elle-même), sans seconde demande
  if (!donnees) return new Response(page.body, { status: page.status, headers: page.headers });
  let html = await page.text();
  if (!html.includes('<body>') || !html.includes('</head>')) return null;
  if (retoucher) html = await retoucher(html, donnees);
  return reponseHtml(html.replace('<body>', () => '<body>\n<script type="application/json" id="' + idBloc + '">' + jsonSur(donnees) + '</script>'), page);
}
const photoAnnoncee = (html, adresse) => (adresse ? html.replace('</head>', () => '<link rel="preload" as="image" fetchpriority="high" href="' + echapper(adresse) + '">\n</head>') : html);

// ================== Fiche d'un mannequin préparée par le serveur (01/11/2026, site dynamique, étape 1) ==================
// Décision de la propriétaire (31/10/2026, PLAN-SERVEUR.md, chemin A). Avant, la page /book/nom partait
// vide : le téléphone chargeait ses programmes, PUIS demandait à la base le profil, les photos et l'âge,
// et seulement alors la grande photo (≈ 3,5 à 4 s). Désormais, le serveur lit ces trois réponses en même
// temps que la page et les pose dedans (bloc <script type="application/json" id="fiche-donnees">, lu par
// js/fiche-mannequin.js et js/adresse-fiche.js), avec la grande photo annoncée tout en haut (le téléphone
// la télécharge dès la première seconde) et le vrai titre et la vraie description de la mannequin (lus par
// Google et les autres moteurs sans exécuter de programme). Seulement ce que la fiche publique montre déjà
// (jamais de coordonnées, ni la date de naissance : l'âge seul). La base répond trop lentement (plus de
// 1,2 s) ou pas du tout : la fiche part comme avant et se remplit elle-même. Gardée 3 minutes en mémoire (enMemoire)
// (une fiche modifiée dans l'Administration se voit au plus 3 minutes après).
const COLONNES_PROFIL_FICHE = 'id,full_name,city,category,niveau_mannequin,height_cm,weight_kg,chest_cm,waist_cm,hips_cm,inseam_cm,shoe_size,carnation,clothing_size,eye_color,hair_color,bio,years_experience,model_types,languages,availability,video_url';
const COLONNES_PHOTOS_FICHE = 'id,url,url_miniature,url_moyenne,compcard_ordre,principale,photo_couverture,couverture_position,tri_statut,created_at';
// même choix de grande photo que photosAffichees (js/app.js) : vérifié par test-fiche-serveur.js
function couvertureFiche(photos) {
  const date = (p) => { const t = Date.parse(p.created_at); return Number.isNaN(t) ? Infinity : t; };
  const triees = photos.filter((p) => p.tri_statut !== 'ecartee').sort((x, y) => {
    if (!!x.principale !== !!y.principale) return x.principale ? -1 : 1;
    if (date(x) !== date(y)) return date(x) - date(y);
    return String(x.id) < String(y.id) ? -1 : 1;
  });
  const choisie = triees.find((p) => p.photo_couverture) || triees[0];
  return choisie ? photoLegere(choisie.url_moyenne || choisie.url) : '';
}
// Étape A (01/11/2026) : le contenu principal de la fiche écrit dans la page par le serveur (nom, catégorie,
// ville, grande photo, mensurations toujours publiques, présentation) ; la page le remplace ensuite par la
// fiche complète (projets, vidéo, compcard). Les mensurations « à reprendre » (poitrine, taille, bassin…) ne
// sont jamais écrites ici : seulement ce que la fiche publique montre toujours.
function contenuFiche(d, anglais, photo) {
  const p = d.profil, T = (fr, en) => (anglais ? en : fr);
  const categorie = p.category === 'homme' ? T('Homme', 'Man') : p.category === 'femme' ? T('Femme', 'Woman') : 'New Face';
  const mesures = [
    [T('Âge', 'Age'), d.age != null ? d.age + ' ' + T('ans', 'years') : null], [T('Taille', 'Height'), p.height_cm ? p.height_cm + ' cm' : null],
    [T('Poids', 'Weight'), p.weight_kg ? p.weight_kg + ' kg' : null], [T('Pointure', 'Shoe Size'), p.shoe_size ? (anglais ? 'EU ' : '') + p.shoe_size : null],
    [T('Yeux', 'Eyes'), p.eye_color], [T('Cheveux', 'Hair'), p.hair_color]].filter((m) => m[1]);
  return '<div class="reveal visible"><div class="profil-hero-fullbleed profil-hero--avatar"><img data-couv-img src="' + echapper(photo) + '" alt="" fetchpriority="high">' +
    '<div class="profil-hero-scrim"></div><div class="profil-hero-contenu"><div class="eyebrow eyebrow--clair">' + echapper(categorie) + '</div>' +
    '<h1>' + echapper(p.full_name || T('Mannequin', 'Model')) + '</h1><p>' + echapper(p.city || '') + '</p></div></div>' +
    (mesures.length ? '<div class="fiche-entete"><dl class="fiche-mesures" aria-label="' + T('Mensurations', 'Measurements') + '">' +
      mesures.map(([l, v]) => '<div class="fiche-mesure"><dt>' + echapper(l) + '</dt><dd>' + echapper(v) + '</dd></div>').join('') + '</dl></div>' : '') +
    (p.bio ? '<section class="fiche-carte"><h3 class="fiche-carte-titre">' + T('À propos', 'About') + '</h3><p class="mannequin-bio fiche-bio">' + echapper(p.bio) + '</p></section>' : '') + '</div>';
}
async function ficheRemplie(requete, url, id, slug, anglais) {
  if (requete.method !== 'GET') return null;
  const lecture = enMemoire('fiche-' + id, () => Promise.all([
    lireSupabase('model_profiles?id=eq.' + id + '&published=eq.true&select=' + COLONNES_PROFIL_FICHE, null, ATTENTE_FICHE),
    lireSupabase('model_photos?model_id=eq.' + id + '&select=' + COLONNES_PHOTOS_FICHE + '&order=principale.desc,created_at.asc', null, ATTENTE_FICHE),
    lireSupabase('rpc/ages_mannequins', { ids: [id] }, ATTENTE_FICHE)
  ]).then(([profils, photos, ages]) => {
    const profil = Array.isArray(profils) && profils[0];
    if (!profil || !Array.isArray(photos)) return null;
    return { id, slug, profil, photos, age: Array.isArray(ages) ? ages[0]?.age ?? null : null };
  }));
  return pageRemplie(url, (anglais ? '/en' : '') + '/mannequin', 'fiche-donnees', lecture, (html, d) => {
    const nom = d.profil.full_name || (anglais ? 'Model' : 'Mannequin');
    const description = [d.profil.full_name, d.profil.city, d.profil.height_cm ? d.profil.height_cm + ' cm' : null].filter(Boolean).join(' · ') +
      (anglais ? ' · Full book on the Maître Akesse Model Management agency website.' : " · Book complet sur le site de l'agence Maître Akesse Model Management.");
    const lien = SITE + (anglais ? '/en' : '') + '/book/' + slug;
    return photoAnnoncee(html
      .replace(/<title>[^<]*<\/title>/, () => '<title>' + echapper(nom + ' · Maître Akesse Model Management') + '</title>')
      .replace(/<meta name="description" content="[^"]*">/, () => '<meta name="description" content="' + echapper(description) + '">')
      .replace('</head>', () => '<link rel="canonical" href="' + echapper(lien) + '">\n</head>')
      .replace(/<div id="contenu" class="u-mt-2"><span class="fiche-en-chargement">[^<]*<\/span><\/div>/, () => '<div id="contenu" class="u-mt-2">' + contenuFiche(d, anglais, couvertureFiche(d.photos)) + '</div>'), couvertureFiche(d.photos));
  });
}

// ================== The Book préparé par le serveur (01/11/2026, site dynamique, étape 2) ==================
// Avant : la page partait vide, chargeait ses programmes, PUIS demandait la liste des mannequins, PUIS
// leurs photos de couverture (deux allers-retours l'un après l'autre). Désormais le serveur pose les
// deux réponses dans la page (bloc « book-donnees », lu par js/mannequins.js) : mêmes questions, mêmes
// colonnes que la page (seulement ce que le Book montre ou filtre déjà). Base lente (plus de 1,2 s au
// total) ou en panne : la page part comme avant. Gardé 3 minutes en mémoire (enMemoire : une mannequin publiée ou
// retirée se voit au plus 3 minutes après).
const COLONNES_BOOK = 'id,full_name,city,category,height_cm,chest_cm,waist_cm,hips_cm,shoe_size,eye_color,hair_color,languages,carnation,clothing_size,availability,niveau_mannequin,years_experience';
async function bookRempli(url, anglais, requete) {
  const lecture = enMemoire('book', async () => {
    const fin = Date.now() + ATTENTE_FICHE;
    const reste = () => Math.max(fin - Date.now(), 1);
    const profils = await lireSupabase('model_profiles?published=eq.true&select=' + COLONNES_BOOK + '&order=created_at.desc&limit=300', null, reste());
    if (!Array.isArray(profils) || !profils.length) return null;
    const ids = profils.map((p) => p.id);
    const photos = await lireCouvertures(ids, reste);
    return Array.isArray(photos) ? { profils, photos } : null;
  });
  const telephone = estTelephone(requete);
  // les cartes elles-mêmes écrites dans la page (js/rendu-book.js, les mêmes que la page dessine)
  return pageRemplie(url, (anglais ? '/en' : '') + '/mannequins', 'book-donnees', lecture, (html, d) => {
    const photoDe = {};
    d.photos.forEach((ph) => { photoDe[ph.model_id] = photoLegere(ph.url_petite && telephone ? ph.url_petite : ph.url); });
    const R = globalThis.RenduBook, liste = R.ordonner(d.profils.slice());
    const libelle = anglais ? 'Add to my selection' : 'Ajouter à ma sélection';
    const cartes = liste.map((p, rang) => R.carte(p, rang, { en: anglais, photo: photoDe[p.id] || '/assets/logo-dark-bg.png', selectionne: false, libelle })).join('');
    return html.replace('<div id="grille" class="medaillon-grille" data-place-reservee></div>', () => '<div id="grille" class="medaillon-grille" data-serveur="1">' + cartes + '</div>')
      .replace('<span id="f-compte"></span>', () => '<span id="f-compte">' + R.compte(liste.length, anglais) + '</span>');
  });
}

// ================== Actualités et événements préparés par le serveur (01/11/2026, site dynamique, étape 2) ==================
// Même principe que The Book : la liste et les photos (pour leur nombre) sont posées dans la page (bloc
// « publications-donnees », lu par publicationsServeur, js/publications.js), mêmes questions que la page ;
// la photo « À la une » est annoncée en tête. Base lente (plus de 1,2 s) ou en panne : comme avant.
const PUBLICATIONS_PAGES = /^\/(en\/)?(actualites|evenements)$/;
const LECTURES_PUBLICATIONS = {
  actualites: ['actualites?select=*&order=created_at.desc', 'actualite_photos?select=actualite_id'],
  evenements: ['evenements?select=*&order=date_evenement.desc.nullslast,created_at.desc', 'evenement_photos?select=evenement_id']
};
async function publicationsRemplies(url, anglais) {
  const quoi = url.pathname.match(PUBLICATIONS_PAGES)[2];
  const [liste, photos] = LECTURES_PUBLICATIONS[quoi];
  const lecture = enMemoire('publications-' + quoi, () => Promise.all([lireSupabase(liste, null, ATTENTE_FICHE), lireSupabase(photos, null, ATTENTE_FICHE)])
    .then(([l, p]) => (Array.isArray(l) && Array.isArray(p) ? { liste: l, photos: p } : null)));
  return pageRemplie(url, (anglais ? '/en/' : '/') + quoi + url.search, 'publications-donnees', lecture, async (html, d) => {
    // les cartes elles-mêmes écrites dans la page (js/rendu-publications.js, les mêmes que la page dessine),
    // en anglais sur les pages /en (traductions de l'agence)
    const R = globalThis.RenduPublications, sorte = quoi === 'actualites' ? 'actualite' : 'evenement';
    const texteLong = sorte === 'actualite' ? 'commentaire' : 'description';
    const liste = anglais ? await versAnglaisServeur(d.liste, sorte === 'actualite' ? ['titre', 'commentaire'] : ['titre', 'lieu', 'description']) : d.liste;
    const nb = {};
    d.photos.forEach((p) => { const id = p.actualite_id || p.evenement_id; nb[id] = (nb[id] || 0) + 1; });
    const extrait = (p, n) => (p[texteLong] ? R.extrait(R.texteBrut(p[texteLong]), n) : '');
    const prefixe = sorte === 'actualite' ? 'actus' : 'evenements';
    if (liste.length) {
      html = html.replace('<div id="' + prefixe + '-une" class="une-reservee"></div>', () => '<div id="' + prefixe + '-une" class="une-reservee">' +
        R.une(liste[0], { en: anglais, sorte, photo: photoLegere(liste[0].image_url || ''), extrait: extrait(liste[0], 180) }) + '</div>')
        .replace('<div id="' + prefixe + '-grille" class="news-grille"></div>', () => '<div id="' + prefixe + '-grille" class="news-grille">' +
          liste.slice(1).map((p, i) => R.carte(p, i + 1, { en: anglais, sorte, photo: photoLegere(p.image_url || ''), nbPhotos: nb[p.id] || (p.image_url ? 1 : 0), extrait: extrait(p, 110) })).join('') + '</div>');
    }
    return photoAnnoncee(html, d.liste[0]?.image_url ? photoLegere(d.liste[0].image_url) : '');
  });
}

// ================== Partenaires préparés par le serveur (01/11/2026, site dynamique, étape 2) ==================
// La liste des partenaires (même lecture que js/partenaires.js) posée dans la page (bloc « partenaires-donnees »).
async function partenairesRemplis(url, anglais) {
  const lecture = enMemoire('partenaires', () => lireSupabase('partenaires?select=*&order=created_at.desc', null, ATTENTE_FICHE).then((l) => (Array.isArray(l) ? { liste: l } : null)));
  return pageRemplie(url, (anglais ? '/en' : '') + '/partenaires' + url.search, 'partenaires-donnees', lecture, async (html, d) => {
    // les cartes écrites dans la page (js/rendu-publications.js), en anglais sur /en/partenaires
    const liste = anglais ? await versAnglaisServeur(d.liste, ['structure', 'evenement', 'role', 'description']) : d.liste;
    const R = globalThis.RenduPublications;
    return liste.length ? html.replace('<div id="partenaires-grille" class="news-grille"></div>', () => '<div id="partenaires-grille" class="news-grille">' +
      liste.map((p, i) => R.partenaire(p, i, { en: anglais, logo: p.logo_url ? photoLegere(p.logo_url) : '' })).join('') + '</div>') : html;
  });
}

// ================== Agenda préparé par le serveur (01/11/2026, site dynamique, étape 2) ==================
// Mêmes lectures que js/agenda.js (page Agenda, pas l'encart de l'accueil) : agenda_public, et les événements
// des 12 derniers mois (bloc « agenda-donnees »). Plus de 1000 événements : la page les lit elle-même.
async function agendaRempli(url, anglais) {
  const depuis = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const lecture = enMemoire('agenda-' + depuis, () => Promise.all([
    lireSupabase('rpc/agenda_public', {}, ATTENTE_FICHE),
    lireSupabase('evenements?select=id,titre,date_evenement,lieu&date_evenement=gte.' + depuis + '&order=date_evenement.asc,id.asc&limit=1000', null, ATTENTE_FICHE)
  ]).then(([agenda, evenements]) => (Array.isArray(agenda) && Array.isArray(evenements) && evenements.length < 1000 ? { agenda, evenements } : null)));
  return pageRemplie(url, (anglais ? '/en' : '') + '/agenda', 'agenda-donnees', lecture);
}

// ================== Parcours préparé par le serveur (01/11/2026, site dynamique, étape 2) ==================
// Mêmes lectures que js/parcours.js : les projets des 24 derniers mois (parcours_public, du 1er du mois il y
// a 23 mois à aujourd'hui), puis les visages des mannequins (photos de couverture). La page vérifie que la
// période est la même que la sienne (sinon elle relit la base). Bloc « parcours-donnees ».
async function parcoursRempli(url, anglais) {
  const jour = new Date(), debutMois = new Date(Date.UTC(jour.getUTCFullYear(), jour.getUTCMonth() - 23, 1));
  const debut = debutMois.toISOString().slice(0, 10), fin = jour.toISOString().slice(0, 10);
  const limite = Date.now() + ATTENTE_FICHE, reste = () => Math.max(limite - Date.now(), 1);
  const lecture = enMemoire('parcours-' + debut + '-' + fin, async () => {
    const projets = await lireSupabase('rpc/parcours_public', { p_debut: debut, p_fin: fin, p_model: null }, reste());
    if (!Array.isArray(projets)) return null;
    const ids = [...new Set(projets.flatMap((p) => (p.mannequins || []).map((m) => m.id).filter(Boolean)))];
    const photos = ids.length ? await lireCouvertures(ids, reste) : [];
    return Array.isArray(photos) ? { debut, fin, projets, photos } : null;
  });
  return pageRemplie(url, (anglais ? '/en' : '') + '/parcours', 'parcours-donnees', lecture);
}

// ================== « Qui sommes-nous » préparé par le serveur (01/11/2026, site dynamique, étape 2) ==================
// Mêmes lectures que js/qui-sommes-nous.js : événements et leurs photos, portrait du fondateur, photos des
// mannequins publiées — réduites ici à UNE photo au hasard par mannequin (la page en tire ensuite 16 au
// hasard, comme avant ; 435 photos le 01/11/2026, trop lourd à poser dans la page). Bloc « qsn-donnees ».
// Lecture par paquets de 1000 (comme lireToutesLignes, js/app.js), dans le même délai de 1,2 s.
async function lireToutesSupabase(chemin, reste) {
  const toutes = [];
  for (let depart = 0; depart < 20000; depart += 1000) {
    const paquet = await lireSupabase(chemin + '&limit=1000&offset=' + depart, null, reste());
    if (!Array.isArray(paquet)) return null;
    toutes.push(...paquet);
    if (paquet.length < 1000) return toutes;
  }
  return null;
}
async function quiSommesNousRempli(url, anglais) {
  const limite = Date.now() + ATTENTE_FICHE, reste = () => Math.max(limite - Date.now(), 1);
  const lecture = enMemoire('qsn', () => Promise.all([
    lireSupabase('evenements?select=id,titre,lieu,image_url&order=date_evenement.desc', null, reste()),
    lireToutesSupabase('evenement_photos?select=id,evenement_id,url&order=id.asc', reste),
    lireSupabase('mot_responsable?id=eq.principal&select=nom,photo_url', null, reste()),
    lireToutesSupabase('model_photos?select=id,url,url_moyenne,model_id,model_profiles!inner(published)&model_profiles.published=eq.true&order=id.asc', reste)
  ]).then(([evenements, photos, mots, photosMannequins]) => {
    if (![evenements, photos, mots, photosMannequins].every(Array.isArray)) return null;
    const parMannequin = new Map();
    photosMannequins.forEach(({ model_profiles: _p, ...ph }) => {
      const liste = parMannequin.get(ph.model_id) || [];
      liste.push(ph);
      parMannequin.set(ph.model_id, liste);
    });
    const auHasard = (l) => l[Math.floor(Math.random() * l.length)];  // chaque photo a la même chance
    return { evenements, photos, portrait: mots[0] || null, visages: [...parMannequin.values()].map(auHasard) };
  }));
  return pageRemplie(url, (anglais ? '/en' : '') + '/qui-sommes-nous', 'qsn-donnees', lecture);
}

// Aiguillage des pages préparées par le serveur (adresse propre → fonction(url, anglais))
const PAGES_REMPLIES = [
  [/^\/(en\/)?mannequins$/, bookRempli],
  [PUBLICATIONS_PAGES, publicationsRemplies],
  [/^\/(en\/)?partenaires$/, partenairesRemplis],
  [/^\/(en\/)?agenda$/, agendaRempli],
  [/^\/(en\/)?parcours$/, parcoursRempli],
  [/^\/(en\/)?qui-sommes-nous$/, quiSommesNousRempli]
];

// Adresse sans « www » (26/10/2026, inscription hstspreload.org) : le middleware passe AVANT les
// redirections de vercel.json, il renvoie donc lui-même vers www pour les adresses qu'il traite
// (sinon l'accueil était servi sans www, et ses styles, redirigés vers www, bloqués par le CSP).
// Les autres adresses suivent la première règle de vercel.json. En-tête HSTS complet dans les deux cas.
const DOMAINE_NU = 'maitreakessemodelmanagement.com';
function versWww(url) {
  return new Response(null, { status: 308, headers: {
    Location: 'https://www.' + DOMAINE_NU + url.pathname + url.search,
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload'
  } });
}

export default async function middleware(requete) {
  try {
    const url = new URL(requete.url);
    if (url.hostname === DOMAINE_NU) return versWww(url);
    if (ACCUEIL.test(url.pathname)) {
      if (requete.headers.get('x-ma2m-accueil')) return;  // (la page elle-même, demandée ci-dessous)
      try { return await accueilRempli(requete, url); } catch (e) { return; }
    }
    if (SCRIPTS_ADMIN.test(url.pathname) || SCRIPTS_NOUVELLE_ADMIN.test(url.pathname)) return await tableauProtege(requete);
    if (requete.headers.get('x-ma2m-remplie')) return;  // (page demandée par pageRemplie elle-même)
    const agent = requete.headers.get('user-agent') || '';
    const anglais = url.pathname.indexOf('/en/') === 0;
    // Adresse lisible /book/nom : on retrouve le mannequin, puis on sert sa fiche
    // à cette même adresse (la barre d'adresse garde /book/nom). Nom inconnu :
    // direction The Book.
    const joli = url.pathname.match(CHEMIN_JOLI);
    if (joli) {
      const ficheSansId = () => new Response(null, { headers: { 'x-middleware-rewrite': new URL((anglais ? '/en' : '') + '/mannequin', url).toString() } });
      let lignes = null;
      // (un visiteur n'attend pas plus de 1,2 s : sinon la fiche retrouve elle-même le mannequin)
      try { lignes = await lireSupabase('model_profiles?slug=eq.' + joli[2] + '&published=eq.true&select=id', null, ROBOTS_APERCU.test(agent) ? 2500 : ATTENTE_FICHE); } catch (error_) { lignes = null; }  // (base trop lente : la fiche se remplit dans la page)
      // Base lente ou en panne : la fiche retrouve elle-même le mannequin (js/adresse-fiche.js).
      if (lignes === null) return ROBOTS_APERCU.test(agent) ? undefined : ficheSansId();
      const id = lignes[0] && lignes[0].id;
      if (!id || !ID_VALIDE.test(id)) return Response.redirect(SITE + (anglais ? '/en' : '') + '/mannequins', 302);
      if (ROBOTS_APERCU.test(agent)) {
        const apercu = await apercuMannequin(url, anglais, id);
        if (apercu) return apercu;
      }
      // visiteur : la fiche part déjà remplie ; au moindre souci, comme avant (la page se remplit elle-même)
      const remplie = await ficheRemplie(requete, url, id, joli[2], anglais).catch(() => null);
      if (remplie) return remplie;
      return new Response(null, { headers: { 'x-middleware-rewrite': new URL((anglais ? '/en' : '') + '/mannequin?id=' + id, url).toString() } });
    }
    // pages des visiteurs préparées par le serveur (site dynamique) ; jamais les adresses en .html, qui
    // suivent le renvoi vers l'adresse propre (vercel.json, cleanUrls) ; au moindre souci : comme avant
    const remplir = requete.method === 'GET' && !ROBOTS_APERCU.test(agent) && PAGES_REMPLIES.find(([chemin]) => chemin.test(url.pathname));
    if (remplir) {
      try { return (await remplir[1](url, anglais, requete)) || undefined; } catch (e) { return; }
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
