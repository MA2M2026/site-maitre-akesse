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
import './js/cachets-communs.js';
import './js/lien-public.js';
import './js/gabarit.js';
import './js/partage.js';
import './js/formulaire-candidature-champs.js';
import './js/rendu-agenda.js';
import './js/parcours.js';
import './js/tailles.js';
import './js/cadrages-photos.js';
import './js/rendu-fiche.js';

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
    // 100 % dynamique, étape 1 (01/11/2026) : contact et candidature (mur de photos, liste des castings)
    '/contact', '/contact.html', '/en/contact', '/en/contact.html', '/candidature', '/candidature.html', '/en/candidature', '/en/candidature.html',
    // pages de texte modifiables depuis l'Administration (étape C, 01/11/2026)
    '/services', '/services.html', '/en/services', '/en/services.html', '/integrer-agence', '/integrer-agence.html', '/en/integrer-agence', '/en/integrer-agence.html',
    '/mentions-legales', '/mentions-legales.html', '/en/mentions-legales', '/en/mentions-legales.html',
    '/politique-confidentialite', '/politique-confidentialite.html', '/en/politique-confidentialite', '/en/politique-confidentialite.html',
    // pages d'un lien personnel écrites par le serveur (étape B, 01/11/2026)
    '/recu', '/places',
    // plan du site pour Google, fabriqué depuis la base (07/11/2026, W10)
    '/sitemap.xml',
    // page d'accueil servie déjà remplie (23/10/2026)
    '/', '/index.html', '/en', '/en/', '/en/index.html',
    // scripts réservés de l'Administration (13/10/2026 ; l'ancien tableau de bord est démoli le 23/10/2026)
    '/js/video-accueil-gabarit.js', '/js/couverture-admin.js', '/js/photos-mises-de-cote-gabarit.js', '/js/photos-mises-de-cote.js',
    '/js/fiches-evenement-gabarit.js', '/js/fiches-evenement-admin.js', '/js/rapport-profils-gabarit.js', '/js/rapport-profils-admin.js', '/js/agenda-gabarit.js', '/js/agenda-admin.js', '/js/agenda-outils.js', '/js/convocations-gabarit.js', '/js/convocations-page.js', '/js/convocations-admin.js', '/js/messages-convocations.js',
    '/js/publications-ecriture.js', '/js/partenaires-communs.js', '/js/images-site-ecriture.js', '/js/messages-candidats.js', '/js/messages-groupes-gabarit.js', '/js/messages-groupes.js', '/js/nettoyage-supabase.js', '/js/note-integration.js', '/js/erreurs-corrigees.js', '/js/erreurs-gabarit.js', '/js/erreurs-site.js', '/js/defile-repartition.js', '/js/cartes-acces.js',
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
const SCRIPTS_ADMIN = /^\/js\/(publications-ecriture|partenaires-communs|images-site-ecriture|erreurs-gabarit|erreurs-site|note-integration|video-accueil-gabarit|agenda-gabarit|fiches-evenement-gabarit|rapport-profils-gabarit|photos-mises-de-cote-gabarit|couverture-admin|photos-mises-de-cote|fiches-evenement-admin|rapport-profils-admin|agenda-admin|agenda-outils|convocations-gabarit|convocations-page|convocations-admin|messages-convocations|messages-candidats|defile-repartition|cartes-acces|messages-groupes-gabarit|messages-groupes|nettoyage-supabase|erreurs-corrigees)\.js$/;
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
// (strict : une erreur de la base autre que « n'existe pas encore » (404) est une erreur, pas un « rien »)
async function lireSupabase(chemin, corps, delai, strict) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delai || 2500);
  try {
    const rep = await fetch(SUPABASE_URL + '/rest/v1/' + chemin, {
      method: corps ? 'POST' : 'GET',
      headers: Object.assign({ apikey: CLE_ANON, Authorization: 'Bearer ' + CLE_ANON }, corps ? { 'Content-Type': 'application/json' } : {}),
      body: corps ? JSON.stringify(corps) : undefined,
      signal: controleur.signal
    });
    if (!rep.ok) { if (strict && rep.status !== 404) throw new Error('base ' + rep.status); return null; }
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
  // (07/11/2026 : WhatsApp ne montrait plus d'aperçu — l'outil d'images de Vercel refusait l'adresse directe des photos,
  // absente de vercel.json, et la copie WebP n'est pas lue partout ; on part toujours du JPEG, qui existe à côté)
  const absolue = (/^https?:\/\//i.test(url) ? url : SITE + (url.charAt(0) === '/' ? '' : '/') + url).replace(/-w\.webp(\?|$)/i, '-w.jpg$1');
  return SITE + '/_vercel/image?url=' + encodeURIComponent(absolue) + '&w=1080&q=75';
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
const DUREE_ACCUEIL = 3 * 60 * 1000;  // (3 minutes comme les autres pages : 100 % dynamique, plus de vérification par le navigateur)
const ATTENTE_ACCUEIL = 800;
let memoireAccueil = null;  // { quand, donnees }
let lectureAccueil = null;  // lecture de la base en cours (partagée par les visites simultanées)
// Photo envoyée à la taille de l'écran par l'outil d'images de Vercel (07/11/2026, vitesse de « Qui sommes-nous » :
// les photos d'événements sont les originaux, 300 à 650 Ko chacune) ; largeurs permises : vercel.json (640, 1080).
// Seulement pour les photos SANS version réduite (événements, portrait) : l'offre gratuite de Vercel limite le nombre
// de photos différentes transformées par mois ; les photos des mannequins ont déjà leurs versions (miniature, moyenne).
function photoReduite(url, largeur) {
  const p = photoLegere(url);
  if (!p) return '';
  const absolue = /^https?:\/\//i.test(p) ? p : SITE + (p.charAt(0) === '/' ? '' : '/') + p;
  return SITE + '/_vercel/image?url=' + encodeURIComponent(absolue) + '&w=' + (largeur || 1080) + '&q=75';
}
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
  const profils = await lireSupabase('model_profiles?published=eq.true&select=id,slug,full_name,city,category,height_cm,featured&order=created_at.desc&limit=200', null, 3000);
  if (!profils) throw new Error('base : mannequins');
  // (en même temps : le mot de Maître Akesse et les castings ouverts, écrits dans la page pour
  // qu'elle ne saute pas quand ils arrivent — 24/10/2026 ; s'ils manquent, le navigateur les lit)
  // (100 % dynamique, 01/11/2026 : aussi les partenaires, Instagram, les 3 prochains projets de l'agenda, la vidéo
  // de l'accueil et les versions moyennes des photos ; chacun manquant, la page le lit elle-même comme avant)
  const [couvertures, mots, castings, partenaires, instagram, agenda, video, moyennes, eligibles] = await Promise.all([
    profils.length ? lireCouvertures(profils.map(p => p.id)) : [],
    lireSupabase('mot_responsable?id=eq.principal&select=nom,titre,message,photo_url', null, 3000).catch(() => null),
    lireSupabase('casting_projets?actif=eq.true&select=id&limit=1', null, 3000).catch(() => null),
    lireSupabase('partenaires?select=id,nom,logo_url&order=created_at.desc&limit=14', null, 3000).catch(() => null),
    lireSupabase('instagram_posts_cache?id=eq.principal&select=posts', null, 3000).catch(() => null),
    lireSupabase('rpc/agenda_public', { seulement_a_venir: true, limite: 3 }, 3000).catch(() => null),
    lireSupabase('reglages_site?cle=eq.video_accueil&select=valeur', null, 3000).catch(() => null),
    profils.length ? lireSupabase('model_photos?select=model_id,url_miniature,url_moyenne&url_moyenne=not.is.null&model_id=in.(' + profils.map(p => p.id).join(',') + ')', null, 3000).catch(() => null) : [],
    // (site vivant, 08/11/2026) qui peut paraître en couverture, « À la une » et dans les visages : majeures, ou
    // mineures avec l'accord donné par un parent (supabase-site-vivant.sql) ; null tant que le fichier n'est pas collé
    // (prudence : base en panne ou trop lente → personne plutôt qu'une mineure sans accord ; fichier pas collé → null)
    lireSupabase('rpc/vitrine_eligibles', {}, 3000, true).catch(() => 'panne')]);
  if (!couvertures) throw new Error('base : photos');
  const photoDe = {};
  couvertures.forEach(c => { if (c.url) photoDe[c.model_id] = c; });
  const donnees = { profils: profils.filter(p => photoDe[p.id]).map(p => Object.assign({ photo: photoDe[p.id].url, petite: photoDe[p.id].url_petite || null }, p)), nombre: profils.length };
  if (Array.isArray(mots)) donnees.mot = mots[0] || null;
  if (Array.isArray(eligibles)) donnees.vitrine = eligibles.map((x) => x.model_id);
  // (base en panne pour la vitrine : la liste précédente si on l'a, sinon personne ; relue au bout de 30 s)
  else if (eligibles === 'panne') { const avant = memoireAccueil && memoireAccueil.donnees && memoireAccueil.donnees.vitrine; donnees.vitrine = Array.isArray(avant) ? avant : []; donnees.vitrineIncertaine = true; }
  if (Array.isArray(castings)) donnees.castingOuvert = castings.length > 0;
  if (Array.isArray(partenaires)) donnees.partenaires = partenaires;
  if (Array.isArray(instagram)) donnees.instagram = (instagram[0] && Array.isArray(instagram[0].posts)) ? instagram[0].posts : [];
  if (Array.isArray(agenda)) donnees.agenda = agenda;
  if (Array.isArray(video)) donnees.video = (video[0] && video[0].valeur) || null;
  // version moyenne (plus nette) de la photo de chaque mannequin, pour la couverture qui défile
  if (Array.isArray(moyennes)) donnees.moyennesLues = true;
  if (Array.isArray(moyennes)) donnees.profils.forEach((p) => { const m = moyennes.find((x) => x.model_id === p.id && x.url_miniature === p.photo); if (m) p.moyenne = m.url_moyenne; });
  // le mot en anglais pour l'accueil anglais (traductions_en, même empreinte que versAnglais, js/app.js)
  if (donnees.mot) donnees.motEn = await motEnAnglais(donnees.mot).catch(() => null);
  // (phase 2) l'encart Agenda de l'accueil anglais, traduit comme la page le ferait (versAnglais)
  if (Array.isArray(donnees.agenda) && donnees.agenda.length) donnees.agendaEn = await versAnglaisServeur(donnees.agenda, ['titre', 'lieu', 'description'], 3000).catch(() => null);
  return donnees;
}
// rognerBlancs et empreinteTexte : js/partage.js (partagées avec les pages, js/app.js)
const { rognerBlancs, empreinteTexte } = globalThis.Partage;
async function motEnAnglais(mot) {
  const [en] = await versAnglaisServeur([{ titre: mot.titre, message: mot.message }], ['titre', 'message'], 3000);
  const champs = ['titre', 'message'].filter((c) => mot[c] && en[c] !== mot[c]);
  return champs.length ? Object.fromEntries(champs.map((c) => [c, en[c]])) : null;
}
// Copies anglaises de lignes (pages /en préparées par le serveur, 01/11/2026) : mêmes traductions que la page
// (table traductions_en, même empreinte que versAnglais de js/app.js) ; un texte sans traduction reste en
// français (comme dans la page). Ne modifie jamais les lignes reçues (elles sont gardées en mémoire).
// Traductions gardées 3 minutes (comme les données) ; les lectures manquantes partent ensemble et ne durent
// jamais plus de 0,8 s : au-delà, le texte reste en français (la page le traduit ensuite elle-même).
const memoireTraductions = new Map();  // texte → { quand, en (ou null : pas de traduction) }
async function versAnglaisServeur(lignes, champs, delai = 800) {
  const copies = lignes.map((l) => Object.assign({}, l));
  const textes = [...new Set(copies.flatMap((l) => champs.map((c) => l[c]).filter((v) => typeof v === 'string' && rognerBlancs(v))))];
  const frais = (t) => { const m = memoireTraductions.get(t); return m && Date.now() - m.quand < DUREE_MEMOIRE && !globalThis.MA2M_SANS_MEMOIRE; };
  const manquants = textes.filter((t) => !frais(t));
  if (manquants.length) {
    const cles = await Promise.all(manquants.map(empreinteTexte));
    const parCle = new Map(), paquets = [];
    for (let i = 0; i < cles.length; i += 80) paquets.push(cles.slice(i, i + 80));
    const lus = await Promise.all(paquets.map((p) => lireSupabase('traductions_en?select=cle,en&cle=in.(' + p.join(',') + ')', null, delai).catch(() => null)));
    if (lus.every(Array.isArray)) {
      lus.forEach((lu) => lu.forEach((x) => parCle.set(x.cle, x.en)));
      manquants.forEach((t, i) => memoireTraductions.set(t, { quand: Date.now(), en: parCle.get(cles[i]) || null }));
      if (memoireTraductions.size > 5000) memoireTraductions.clear();
    }
  }
  copies.forEach((l) => champs.forEach((c) => { const m = memoireTraductions.get(l[c]); if (m && m.en) l[c] = m.en; }));
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
// Phase 2 (02/11/2026) : le reste du magazine écrit par le serveur, comme js/accueil.js le dessine : mois de l'édition,
// « En couverture », photos d'ambiance, partenaires, Instagram, film, puis numéros de page et sommaire (d'après les
// pages réellement affichées). La page reprend ensuite ces éléments (défilement de la couverture, clics).
function magazineComplet(html, donnees, anglais, une, couv, photoDe) {
  const mois = new Date().toLocaleDateString(anglais ? 'en-GB' : 'fr-FR', { month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' });
  const edition = mois.charAt(0).toUpperCase() + mois.slice(1);
  html = html.replace(/<span class="mag-date"><\/span>/g, () => '<span class="mag-date">' + echapper(edition) + '</span>')
    .replace(/<span class="mag-signature-folio"><\/span>/g, () => '<span class="mag-signature-folio">MA2M · ' + echapper(edition) + '</span>');
  if (couv.full_name) {
    html = html.replace(/<a class="modele" id="couv-modele" href="[^"]*" data-hasard hidden>En couverture<strong id="couv-modele-nom"><\/strong><\/a>/, () => '<a class="modele" id="couv-modele" href="' + echapper(globalThis.RenduBook.lienFiche(couv, anglais)) + '" data-hasard>En couverture<strong id="couv-modele-nom">' + echapper(couv.full_name) + '</strong></a>')
      .replace(/<a class="modele" id="couv-modele" href="[^"]*" data-hasard hidden>On the cover<strong id="couv-modele-nom"><\/strong><\/a>/, () => '<a class="modele" id="couv-modele" href="' + echapper(globalThis.RenduBook.lienFiche(couv, anglais)) + '" data-hasard>On the cover<strong id="couv-modele-nom">' + echapper(couv.full_name) + '</strong></a>');
  }
  // photos d'ambiance (sommaire, agence, dos ; édito sans photo du mot) : d'autres visages que la couverture
  const autres = donnees.profils.filter((p) => p.id !== une.id && p.id !== couv.id);
  const reste = autres.length ? autres : [une];
  const poserPhoto = (id, m) => { html = html.replace(new RegExp('<img id="' + id + '" src="data:image\\/gif;base64,[^"]*" alt=""'), () => '<img id="' + id + '" src="' + echapper(photoDe(m)) + '" alt="' + echapper(m.full_name || '') + '"'); };
  [['sommaire-img', 0], ['agence-img', 1], ['dos-img', 2]].forEach(([id, i]) => poserPhoto(id, reste[i % reste.length]));
  html = html.replace('<figcaption id="sommaire-legende" data-hasard></figcaption>', () => '<figcaption id="sommaire-legende" data-hasard>' + echapper(reste[0].full_name || '') + '</figcaption>');
  const mot = donnees.mot;
  if (mot && mot.message && mot.photo_url) html = html.replace(/<img id="edito-img" src="data:image\/gif;base64,[^"]*" alt=""/, () => '<img id="edito-img" data-mot="1" src="' + echapper(photoReduite(mot.photo_url, 640)) + '" alt="' + echapper(mot.nom || 'Maître Akesse') + '"');
  else poserPhoto('edito-img', reste[3 % reste.length]);
  // partenaires (9 logos au plus) et Instagram (9 publications au plus) : la page s'affiche s'il y en a
  const logos = Array.isArray(donnees.partenaires) ? donnees.partenaires.filter((p) => p.logo_url).slice(0, 9) : [];
  if (logos.length) {
    html = html.replace('<div class="logos" id="confiance-liste"></div>', () => '<div class="logos" id="confiance-liste">' + logos.map((p) => '\n      <a href="partenaires.html?partenaire=' + encodeURIComponent(p.id) + '" title="' + echapper(p.nom || '') + '">\n        <img src="' + echapper(photoLegere(p.logo_url)) + '" alt="' + echapper(p.nom || '') + '" loading="lazy">\n      </a>').join('') + '</div>')
      .replace(/(<article class="mag-page p-partenaires[^"]*" id="ils-nous-font-confiance"[^>]*?) hidden>/, (_, d) => d + '>');
  }
  const posts = Array.isArray(donnees.instagram) ? donnees.instagram.filter((p) => p && p.image).slice(0, 9) : [];
  if (posts.length) {
    html = html.replace('<div class="grille" id="instagram-grille"></div>', () => '<div class="grille" id="instagram-grille">' + posts.map((p) => '\n      <a href="' + echapper(/^https:\/\//i.test(p.lien || '') ? p.lien : 'https://www.instagram.com/maitreakessemodelmanagement') + '" target="_blank" rel="noopener" title="' + echapper(p.legende || '') + '">\n        <img src="' + echapper(p.image) + '" alt="' + echapper(p.legende || (anglais ? 'Instagram post' : 'Publication Instagram')) + '" loading="lazy">\n      </a>').join('') + '</div>')
      .replace(/(<article class="mag-page p-instagram[^"]*" id="flux-instagram"[^>]*?) hidden>/, (_, d) => d + '>');
  }
  // agenda : les 3 prochains projets (js/rendu-agenda.js, comme js/agenda.js) ; l'encart s'affiche s'il y en a
  if (Array.isArray(donnees.agenda) && donnees.agenda.length) {
    const encart = globalThis.RenduAgenda.encartAccueil(anglais && Array.isArray(donnees.agendaEn) ? donnees.agendaEn : donnees.agenda, anglais);
    if (encart) html = html.replace('<div id="agenda-accueil" class="agenda-liste-publique"></div>', () => '<div id="agenda-accueil" class="agenda-liste-publique">' + encart + '</div>')
      .replace(/(<article class="mag-page p-agenda" id="agenda"[^>]*?) hidden>/, (_, d) => d + '>');
  }
  // film : seulement un fichier du dossier prévu (même règle que js/video-accueil.js) ; la page le charge à l'approche
  const v = donnees.video;
  if (v && v.type === 'video' && typeof v.chemin === 'string' && /^site\/video-accueil\/[A-Za-z0-9._-]+\.(mp4|webm)$/.test(v.chemin)) {
    html = html.replace('<article class="mag-page p-film u-hidden" id="video-accueil"', () => '<article class="mag-page p-film' + (v.largeur && v.hauteur && v.hauteur > v.largeur ? ' video-verticale' : '') + '" id="video-accueil" data-confirme="1"');
  }
  // numéros de page et sommaire : les pages affichées, dans l'ordre (comme numeroter, js/accueil.js)
  // (découpe à chaque « <article class="mag-page » : une page du magazine peut contenir d'autres <article>, ex. l'agenda)
  const lignes = []; let n = 0;
  const morceaux = html.split('<article class="mag-page');
  html = morceaux[0] + morceaux.slice(1).map((m) => {
    const tete = m.match(/^([^"]*)" id="([a-z-]+)"([^>]*)>/);
    if (!tete || /\bu-hidden\b/.test(tete[1]) || /\shidden(\s|$)/.test(tete[3])) return '<article class="mag-page' + m;
    const num = String(++n).padStart(2, '0');
    const sommaire = (tete[3].match(/data-sommaire="([^"]*)"/) || [])[1];
    if (sommaire) { const [titre, sous] = sommaire.split('|'); lignes.push('<li><a href="#' + tete[2] + '"><b>' + num + '</b><div><strong>' + titre + '</strong><span>' + (sous || '') + '</span></div></a></li>'); }
    return '<article class="mag-page' + m.replace('<div class="mag-folio"><span class="num"></span>', () => '<div class="mag-folio"><span class="num">' + num + '</span>');
  }).join('');
  return html.replace('<ol id="sommaire-liste"></ol>', () => '<ol id="sommaire-liste">' + lignes.join('') + '</ol>');
}
// liste fraîche (ou vieille de moins de 5 minutes) ; sinon on lance la lecture (une seule à la fois)
// et on l'attend au plus ATTENTE_ACCUEIL ; une liste plus ancienne sert en attendant
function donneesAccueil() {
  const fraiche = memoireAccueil && Date.now() - memoireAccueil.quand < DUREE_ACCUEIL;
  if (fraiche) return Promise.resolve(memoireAccueil.donnees);
  if (!lectureAccueil) {
    lectureAccueil = lireDonneesAccueil()
      .then(donnees => { memoireAccueil = { quand: Date.now() - (donnees.vitrineIncertaine ? DUREE_ACCUEIL - 30 * 1000 : 0), donnees }; return donnees; })
      // base lente ou en panne : on ne réessaie pas avant 1 minute (liste précédente gardée)
      .catch(() => { memoireAccueil = { quand: Date.now() - DUREE_ACCUEIL + 60 * 1000, donnees: memoireAccueil ? memoireAccueil.donnees : null }; return null; })
      .finally(() => { lectureAccueil = null; });
  }
  const ancienne = memoireAccueil ? memoireAccueil.donnees : null;
  // (définitif, 02/11/2026) rien en mémoire (serveur qui vient de démarrer, juste après une mise en ligne) : on attend la
  // base jusqu'à 3 s au lieu de 0,8 s, pour que même le tout premier visiteur reçoive l'accueil complet (photo comprise)
  return Promise.race([lectureAccueil.then(d => d || ancienne), new Promise(ok => setTimeout(() => ok(ancienne), ancienne ? ATTENTE_ACCUEIL : 3000))]);
}
// JSON posé dans la page : jamais de « < » brut (pas de fin de bloc possible)
const jsonSur = (x) => JSON.stringify(x).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
// ================== Site vivant (08/11/2026, phase 3 V4 ; décisions de la propriétaire, DECISIONS.md) ==================
// Groupe et numéro de visite du visiteur : témoin « ma2m_v=<groupe 0-5>.<visite> » (aucune donnée personnelle, 30 jours,
// déclaré dans la politique de confidentialité). Robots (Google, aperçus WhatsApp / Facebook, outils) et première visite :
// la page de base (groupe 0, visite 0), identique pour tous.
const ROBOTS_VITRINE = /bot|crawl|spider|slurp|curl|wget|python|node-fetch|undici|axios|lighthouse|headless/i;
function tirageVisiteur(requete) {
  const agent = requete.headers.get('user-agent') || '';
  if (!agent || ROBOTS_APERCU.test(agent) || ROBOTS_VITRINE.test(agent)) return { groupe: 0, visite: 0, robot: true };
  const m = String(requete.headers.get('cookie') || '').match(/(?:^|;\s*)ma2m_v=([0-5])\.(\d{1,6})/);
  if (!m) return { groupe: Math.floor(Math.random() * 6), visite: 0, robot: false, nouveau: true };
  return { groupe: Number(m[1]), visite: Number(m[2]), robot: false };
}
const tourner = (liste, n) => { const k = liste.length ? ((n % liste.length) + liste.length) % liste.length : 0; return liste.slice(k).concat(liste.slice(0, k)); };
async function accueilRempli(requete, url) {
  if (requete.method !== 'GET') return;
  const donnees = await donneesAccueil();
  if (!donnees || !donnees.profils.length) return;
  const page = await fetch(url.toString(), { headers: entetesInternes(url, 'x-ma2m-accueil'), redirect: 'manual' });
  if (!page.ok || !/text\/html/.test(page.headers.get('content-type') || '')) return;
  let html = await page.text();
  const marque = '<img id="couv-img" class="visible" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt=""';
  if (html.indexOf(marque) === -1 || html.indexOf('<main') === -1) return;
  // (site vivant, 08/11/2026) seules les mannequins de la vitrine : couverture, « À la une », visages
  const vitrine = globalThis.RenduBook.vitrineDe(donnees.profils, donnees.vitrine);
  if (!vitrine.length) return;  // (personne dans la vitrine : la page de base, sans mannequins)
  const tirage = tirageVisiteur(requete);
  // « À la une » : celle que l'agence a épinglée (si elle est dans la vitrine), sinon la première
  const une = vitrine.find(p => p.featured) || vitrine[0];
  const autres = vitrine.filter(p => p.id !== une.id);
  // couverture : selon le groupe tiré au hasard à la première visite, puis tour à tour d'une visite à l'autre (jamais
  // deux fois de suite la même, chacune son tour) ; robots : toujours la même
  const couv = !autres.length ? une : tirage.robot ? autres[0] : autres[(globalThis.RenduBook.decalageGroupe(tirage.groupe, autres.length) + tirage.visite) % autres.length];
  const anglais = /^\/en(\/|$)/.test(url.pathname);
  // (définitif, 02/11/2026) page anglaise : le mot du fondateur et l'agenda TOUJOURS traduits avant l'envoi, même juste
  // après une mise en ligne (la liste gardée en mémoire pouvait encore être sans traduction : la page arrivait en français)
  if (anglais && donnees.mot && donnees.mot.message && !donnees.motEn) donnees.motEn = await motEnAnglais(donnees.mot).catch(() => null);
  if (anglais && Array.isArray(donnees.agenda) && donnees.agenda.length && !donnees.agendaEn) donnees.agendaEn = await versAnglaisServeur(donnees.agenda, ['titre', 'lieu', 'description'], 1500).catch(() => null);
  html = completerAccueil(html, donnees, anglais);
  // étape A (01/11/2026) : les visages (6 femmes, 3 hommes), « À la une » et le nombre de mannequins écrits
  // dans la page (js/rendu-book.js, le même dessin que js/accueil.js)
  // (07/11/2026) versions nettes de la couverture et de « À la une » pas lues avec la liste : la même petite lecture
  // que la page (js/accueil.js, moyenneDe), pour ces deux photos seulement, avant l'envoi (sinon la page les remplaçait)
  if (!donnees.moyennesLues && (!une.moyenne || !couv.moyenne)) {
    const ids = [...new Set([une.id, couv.id])].filter((x) => ID_VALIDE.test(x || ''));
    const lues = ids.length ? await lireSupabase('model_photos?select=model_id,url_miniature,url_moyenne&url_moyenne=not.is.null&model_id=in.(' + ids.join(',') + ')', null, 800).catch(() => null) : null;
    if (Array.isArray(lues)) [une, couv].forEach((m) => { const x = lues.find((l) => l.model_id === m.id && l.url_miniature === m.photo); if (x && !m.moyenne) m.moyenne = x.url_moyenne; });
  }
  const R = globalThis.RenduBook, telephone = estTelephone(requete);
  const photoDe = (m) => photoLegere(m.petite && telephone ? m.petite : m.photo);
  // (visages : la vitrine seulement ; ordre qui tourne d'une visite à l'autre, la même page que les robots à la première)
  const ordreVisages = tirage.visite > 0 ? tourner(vitrine, R.decalageGroupe(tirage.groupe, vitrine.length) + tirage.visite) : vitrine;
  const visages = R.visagesAccueil(ordreVisages);
  const grille = (id, liste) => (h) => h.replace('<div class="grille" id="' + id + '"></div>', () => '<div class="grille" id="' + id + '">' + liste.map((m) => R.vignetteAccueil(m, { en: anglais, photo: photoDe(m) })).join('') + '</div>');
  html = grille('grille-hommes', visages.hommes)(grille('grille-femmes', visages.femmes)(html));
  html = texteElement(html, 'une-nom', une.full_name || (anglais ? 'Model' : 'Mannequin'));
  html = texteElement(html, 'une-info', R.infoUne(une, anglais));
  html = html.replace('<a href="mannequins.html" id="une-lien">', () => '<a href="' + echapper(R.lienFiche(une, anglais)) + '" id="une-lien">')
    // (version moyenne, la même que la page pose ensuite : pas de seconde photo à télécharger)
    .replace(/<img id="une-img" src="data:image\/gif;base64,[^"]*" alt="" loading="lazy">/, () => '<img id="une-img" src="' + echapper(photoLegere(une.moyenne || une.photo)) + '" alt="' + echapper(une.full_name || '') + '" loading="lazy" fetchpriority="low">');
  if (donnees.nombre) html = texteElement(html, 'couv-nombre', R.nombreAccueil(donnees.nombre, anglais));
  // (remplacements par fonction : un « $ » venu de la base n'est jamais lu comme motif de remplacement)
  // (08/11/2026) la version nette directement, quand elle est connue : avant, la miniature partait d'abord puis la page
  // la remplaçait par la version nette — deux photos, et la grande arrivait tard (mesuré par Lighthouse)
  html = html.replace(marque, () => '<img id="couv-img" class="visible" src="' + echapper(photoLegere(couv.moyenne || couv.photo)) + '" alt="' + echapper(couv.full_name || '') + '" data-modele="' + echapper(couv.id) + '"')
    .replace('<main', () => '<script type="application/json" id="accueil-donnees">' + jsonSur(Object.assign({}, donnees, { profils: vitrine, vitrine: undefined, vitrineIncertaine: undefined, groupe: tirage.robot ? undefined : tirage.groupe, ordreVisages: ordreVisages.map((m) => m.id) })) + '</script>\n<main');
  // (photos d'ambiance : la vitrine seulement, jamais une mineure sans accord)
  html = magazineComplet(html, Object.assign({}, donnees, { profils: vitrine }), anglais, une, couv, photoDe);
  // (W7, 02/11/2026) la photo de couverture annoncée tout en haut de l'en-tête : le téléphone la demande dès la
  // première seconde, avant les styles et les programmes (c'est la plus grande image de la page, mesurée par Lighthouse)
  html = photoAnnoncee(html, photoLegere(couv.moyenne || couv.photo));
  const blocEn = await blocTraductions(url);
  if (blocEn) html = html.replace('<main', () => blocEn.trim() + '\n<main');
  const reponse = reponseHtml(html, page, url);
  // (site vivant) visite suivante : numéro + 1 ; la page dépend du témoin (Vary), en-tête de contrôle x-ma2m-variant ;
  // témoin seulement RENOUVELÉ par le serveur : la page le crée (js/accueil.js), sauf si le visiteur a refusé les cookies
  reponse.headers.set('x-ma2m-variant', tirage.groupe + '.' + tirage.visite);
  reponse.headers.set('Vary', (reponse.headers.get('Vary') || '') + ', Cookie');
  // (cache : même règle que les autres pages ; une copie gardée l'est par valeur du témoin — Vary: Cookie — et une
  // réponse qui pose un témoin n'est pas gardée par le réseau de Vercel)
  if (!tirage.robot && !tirage.nouveau) reponse.headers.append('Set-Cookie', 'ma2m_v=' + tirage.groupe + '.' + Math.min(tirage.visite + 1, 999999) + '; Path=/; Max-Age=2592000; SameSite=Lax; Secure');
  return reponse;
}

// ================== En-tête complet de chaque page (phase 2, 02/11/2026) ==================
// Le même en-tête pour tous (visiteurs, Google, WhatsApp…) : plus de petite page réservée aux robots.
// metaEntite : titre, description, adresse officielle (canonical), balises og:/twitter: d'UN élément (fiche,
// article, événement, partenaire) ; enteteComplete : adresse officielle de la page (www, sans .html) et données
// structurées (JSON-LD : organisation, page, fil d'Ariane) quand la page n'en a pas déjà.
const NOM_SITE = 'Maître Akesse Model Management';
const ldJson = (objet) => '<script type="application/ld+json">' + jsonSur(objet) + '</script>';
function poserMeta(html, attribut, nom, valeur) {
  const motif = new RegExp('<meta ' + attribut + '="' + nom.replace(/[:.]/g, '\\$&') + '" content="[^"]*">');
  const balise = '<meta ' + attribut + '="' + nom + '" content="' + echapper(valeur) + '">';
  return motif.test(html) ? html.replace(motif, () => balise) : html.replace('</head>', () => balise + '\n</head>');
}
function poserCanonique(html, lien) {
  const balise = '<link rel="canonical" href="' + echapper(lien) + '">';
  return /<link rel="canonical" href="[^"]*">/.test(html) ? html.replace(/<link rel="canonical" href="[^"]*">/, () => balise) : html.replace('</head>', () => balise + '\n</head>');
}
// o : { titre, description, photo, lien, lienFr, lienEn, type, ld }
function metaEntite(html, o) {
  html = html.replace(/<title>[^<]*<\/title>/, () => '<title>' + echapper(o.titre + ' · ' + NOM_SITE) + '</title>');
  html = poserMeta(html, 'name', 'description', o.description);
  html = poserMeta(html, 'property', 'og:type', o.type || 'website');
  html = poserMeta(html, 'property', 'og:title', o.titre);
  html = poserMeta(html, 'property', 'og:description', o.description);
  html = poserMeta(html, 'property', 'og:url', o.lien);
  if (o.photo) {
    html = poserMeta(html, 'property', 'og:image', o.photo);
    html = poserMeta(html, 'property', 'og:image:alt', o.titre);
    // (dimensions inconnues pour une photo de la base : balises de l'image par défaut retirées)
    html = html.replace(/<meta property="og:image:(width|height|type)" content="[^"]*">\n?/g, '');
    html = poserMeta(html, 'name', 'twitter:image', o.photo);
  }
  html = poserMeta(html, 'name', 'twitter:title', o.titre);
  html = poserMeta(html, 'name', 'twitter:description', o.description);
  html = poserCanonique(html, o.lien);
  if (o.lienFr && o.lienEn) {
    html = html.replace(/<link rel="alternate" hreflang="fr" href="[^"]*">/, () => '<link rel="alternate" hreflang="fr" href="' + echapper(o.lienFr) + '">')
      .replace(/<link rel="alternate" hreflang="en" href="[^"]*">/, () => '<link rel="alternate" hreflang="en" href="' + echapper(o.lienEn) + '">')
      .replace(/<link rel="alternate" hreflang="x-default" href="[^"]*">/, () => '<link rel="alternate" hreflang="x-default" href="' + echapper(o.lienFr) + '">');
  }
  if (o.ld) html = html.replace('</head>', () => ldJson(o.ld) + '\n</head>');
  return html;
}
function enteteComplete(html, url, anglais) {
  const chemin = url.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
  if (!/<link rel="canonical"/.test(html)) html = poserCanonique(html, SITE + chemin);
  if (!/property="og:url"/.test(html)) html = poserMeta(html, 'property', 'og:url', (html.match(/<link rel="canonical" href="([^"]*)">/) || [])[1] || SITE + chemin);
  const titre = ((html.match(/<title>([^<]*)<\/title>/) || [])[1] || NOM_SITE).replace(/&amp;/g, '&');
  // (adresse officielle de la page, avec sa partie « ?… » pour une fiche ou un article : la même que la balise canonical)
  const officielle = ((html.match(/<link rel="canonical" href="([^"]*)">/) || [])[1] || SITE + chemin).replace(/&amp;/g, '&');
  // (pages sans balises d'aperçu : mentions légales, confidentialité) titre, description et image de l'accueil
  if (!/property="og:title"/.test(html)) html = poserMeta(html, 'property', 'og:title', titre);
  if (!/property="og:description"/.test(html)) html = poserMeta(html, 'property', 'og:description', ((html.match(/<meta name="description" content="([^"]*)">/) || [])[1] || NOM_SITE).replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'));
  if (!/property="og:image"/.test(html)) html = poserMeta(html, 'property', 'og:image', SITE + '/assets/apercus/' + (anglais ? 'en' : 'fr') + '-index.jpg?v=2');
  if (!/property="og:type"/.test(html)) html = poserMeta(html, 'property', 'og:type', 'website');
  const accueil = SITE + (anglais ? '/en/' : '/');
  const morceaux = chemin.replace(/^\/en/, '').split('/').filter(Boolean);
  const ariane = [{ '@type': 'ListItem', position: 1, name: anglais ? 'Home' : 'Accueil', item: accueil }];
  if (morceaux.length) ariane.push({ '@type': 'ListItem', position: 2, name: titre.split(/ [|·—] /)[0], item: officielle });
  const graphe = [{ '@type': 'WebPage', name: titre, url: officielle, inLanguage: anglais ? 'en' : 'fr' }, { '@type': 'BreadcrumbList', itemListElement: ariane }];
  if (!/application\/ld\+json/.test(html)) graphe.unshift({ '@type': 'Organization', name: NOM_SITE, url: SITE + '/', logo: SITE + '/assets/logo-header-clair.png' });
  return html.replace('</head>', () => ldJson({ '@context': 'https://schema.org', '@graph': graphe }) + '\n</head>');
}

// Page complétée (phase 2, 02/11/2026) : la barre du haut, le menu, le bas de page et les réseaux sont écrits
// ici (js/gabarit.js, même dessin que dans le navigateur) : la page est complète sans programme.
// En-têtes : ceux de la page d'origine (sécurité, CSP…) SAUF ceux qui décrivent la réponse d'origine elle-même
// (taille, compression, cache de Vercel, âge, date) : avant, « x-vercel-cache: HIT » et « age » étaient recopiés
// et faisaient croire que la page complétée venait du cache. Politique de cache explicite :
//  - pages publiques : « public, max-age=0, s-maxage=60, stale-while-revalidate=120 » (le navigateur revérifie
//    à chaque visite ; une modification faite dans l'Administration se voit au plus 180 s après, mémoire de
//    3 minutes de ce serveur comprise : DUREE_MEMOIRE) ;
//  - pages d'un lien personnel (/recu, /places) : « private, no-store ».
const ENTETES_RETIRES = /^(content-length|content-encoding|etag|last-modified|age|date|server|cache-control|set-cookie|x-matched-path|x-vercel-[\w-]+)$/i;
const VERSION = (typeof process !== 'undefined' && process.env && process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7);
function reponseHtml(html, page, url, personnel) {
  const anglais = /<html[^>]*\slang="en"/.test(html.slice(0, 400));
  html = globalThis.RenduGabarit.remplirHtml(html, anglais);
  // (formulaires publics : champs de la candidature et listes déroulantes écrits ici, js/formulaire-candidature-champs.js
  // et js/partage.js)
  html = globalThis.ListesFormulaires.remplirSelectsHtml(globalThis.ChampsCandidature.remplirHtml(html, anglais), anglais);
  if (url) html = enteteComplete(html, url, anglais);
  const entetes = new Headers();
  page.headers.forEach((v, k) => { if (!ENTETES_RETIRES.test(k)) entetes.set(k, v); });
  entetes.set('Cache-Control', personnel ? 'private, no-store' : 'public, max-age=0, s-maxage=60, stale-while-revalidate=120');
  // (la photo choisie dépend du téléphone ou de l'ordinateur : un cache partagé doit garder les deux versions à part)
  entetes.set('Vary', 'Sec-CH-UA-Mobile, User-Agent');
  entetes.set('x-ma2m-render', 'ssr');
  entetes.set('x-ma2m-build', VERSION);
  return new Response(html, { status: 200, headers: entetes });
}
// Page publique sans données à poser (base lente ou en panne, ou page sans données) : elle part quand même
// complétée (barre du haut, menu, bas de page), jamais vide.
async function pageNue(url, enteteBoucle) {
  const page = await fetch(url.toString(), { headers: entetesInternes(url, enteteBoucle), redirect: 'manual' });
  if (!page.ok || !/text\/html/.test(page.headers.get('content-type') || '')) return undefined;
  return reponseHtml(await page.text(), page, url, /^\/(recu|places)$/.test(url.pathname));
}

// ================== Plan du site pour Google, fabriqué depuis la base (07/11/2026, W10) ==================
// Les pages fixes (fichier sitemap.xml du dépôt, lu tel quel) + chaque fiche publiée (/book/nom, FR et EN), chaque
// actualité (?actu=…) et chaque événement (?evenement=…), lus avec la clé publique (la base ne montre que ce qui est
// public). Base lente ou en panne : le fichier fixe seul, comme avant. Mis en cache une heure.
async function planDuSite(url) {
  const fixe = await fetch(url.toString(), { headers: entetesInternes(url, 'x-ma2m-remplie') });
  if (!fixe.ok) return;
  const xml = await fixe.text();
  const [profils, actus, evts] = await Promise.all([
    lireSupabase('model_profiles?published=eq.true&slug=not.is.null&select=slug,created_at&order=created_at.desc&limit=1000', null, 3000).catch(() => null),
    lireSupabase('actualites?select=id,created_at&order=created_at.desc&limit=500', null, 3000).catch(() => null),
    lireSupabase('evenements?select=id,date_evenement&order=date_evenement.desc&limit=500', null, 3000).catch(() => null)
  ]);
  const ligne = (chemin, date, priorite) => '  <url>\n    <loc>' + echapper(SITE + chemin) + '</loc>\n' + (date ? '    <lastmod>' + String(date).slice(0, 10) + '</lastmod>\n' : '') + '    <priority>' + priorite + '</priority>\n  </url>\n';
  let ajout = '';
  (profils || []).forEach((p) => { if (/^[a-z0-9-]{1,120}$/.test(p.slug || '')) ajout += ligne('/book/' + p.slug, p.created_at, '0.7') + ligne('/en/book/' + p.slug, p.created_at, '0.6'); });
  (actus || []).forEach((a) => { if (ID_VALIDE.test(a.id)) ajout += ligne('/actualites?actu=' + a.id, a.created_at, '0.5') + ligne('/en/actualites?actu=' + a.id, a.created_at, '0.4'); });
  // (événements sans date : celle de l'événement est souvent dans l'avenir, refusée par Google)
  (evts || []).forEach((e) => { if (ID_VALIDE.test(e.id)) ajout += ligne('/evenements?evenement=' + e.id, null, '0.5') + ligne('/en/evenements?evenement=' + e.id, null, '0.4'); });
  return new Response(xml.replace('</urlset>', () => ajout + '</urlset>'), { status: 200, headers: { 'content-type': 'application/xml; charset=utf-8',
    'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400', 'x-ma2m-render': 'ssr', 'x-ma2m-build': VERSION } });
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
  const demandePage = fetch(new URL(cheminPage, url).toString(), { headers: entetesInternes(url, 'x-ma2m-remplie'), redirect: 'manual' });
  const murPromesse = murDuSite().catch(() => null);  // (en même temps que la page ; gardé 3 minutes)
  const traductionsPromesse = blocTraductions(url);
  const [donnees, page] = await Promise.all([lecture.catch(() => null), demandePage]);
  if (!page.ok || !/text\/html/.test(page.headers.get('content-type') || '')) return null;
  // données absentes : la page déjà demandée part telle quelle (elle se remplira elle-même), sans seconde demande
  // 100 % dynamique (01/11/2026) : les visages du mur de photos derrière le titre (js/app.js, murDeTitre) écrits dans
  // chaque page qui en a un (js/gabarit.js, poserMur) ; pas sur l'accueil, Qui sommes-nous ni la fiche (grande photo)
  const poserLeMur = async (h) => {
    const avecMur = /<h1[\s>]/.test(h) && h.includes('site-header-v2') && !/id="couverture"|qsn-ouverture|profil-hero-fullbleed/.test(h);
    const mur = avecMur ? await murPromesse : null;
    if (!mur || !mur.length) return h;
    h = globalThis.RenduGabarit.poserMur(h, mur);
    // (W7) le premier visage du mur annoncé dans l'en-tête quand la page n'annonce pas déjà sa grande photo : c'est
    // souvent la plus grande image du haut de page (mesuré par Lighthouse sur The Book)
    const premier = (h.match(/<div class="mur-titre" aria-hidden="true"><img [^>]*src="([^"]+)"/) || [])[1];
    return premier && !/<link rel="preload" as="image"/.test(h) ? photoAnnoncee(h, premier.replace(/&amp;/g, '&')) : h;
  };
  // données absentes : la page déjà demandée part sans elles (elle se remplira elle-même), complétée, sans seconde demande
  if (!donnees) return reponseHtml(await poserLeMur(await page.text()), page, url, /^\/(recu|places)/.test(cheminPage));
  let html = await page.text();
  // (« <body> », ou « <body class=… »)
  if (!/<body[\s>]/.test(html) || !html.includes('</head>')) return null;
  if (retoucher) html = await retoucher(html, donnees);
  html = await poserLeMur(html);
  const blocEn = await traductionsPromesse;
  return reponseHtml(html.replace(/<body[^>]*>/, (b) => b + '\n<script type="application/json" id="' + idBloc + '">' + jsonSur(donnees) + '</script>' + blocEn), page, url, /^\/(recu|places)/.test(cheminPage));
}
// (phase 2 : annoncée tout en haut de l'en-tête, pour partir le plus tôt possible)
const photoAnnoncee = (html, adresse) => {
  if (!adresse) return html;
  const balise = '<link rel="preload" as="image" fetchpriority="high" href="' + echapper(adresse) + '">';
  return enHautDeLaPage(html, balise);
};
// (W7) une annonce tout en haut de l'en-tête, AVANT les scripts de surveillance et de mesure qui bloquent la lecture de
// la page ; (09/11/2026, validateur W3C) mais après <base href> s'il y en a un : <base> doit précéder tout lien
const enHautDeLaPage = (html, balise) => {
  if (/<base [^>]*>/i.test(html)) return html.replace(/<base [^>]*>/i, (m) => m + '\n' + balise);
  return /<head>/i.test(html) ? html.replace(/<head>/i, (m) => m + '\n' + balise) : html.replace('</head>', () => balise + '\n</head>');
};

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
const COLONNES_PHOTOS_FICHE = 'id,url,url_miniature,url_moyenne,url_petite,compcard_ordre,principale,photo_couverture,couverture_position,tri_statut,created_at';
// même choix de grande photo que photosAffichees (js/app.js) : vérifié par test-fiche-serveur.js
function choixCouverture(photos) {
  const date = (p) => { const t = Date.parse(p.created_at); return Number.isNaN(t) ? Infinity : t; };
  const triees = photos.filter((p) => p.tri_statut !== 'ecartee').sort((x, y) => {
    if (!!x.principale !== !!y.principale) return x.principale ? -1 : 1;
    if (date(x) !== date(y)) return date(x) - date(y);
    return String(x.id) < String(y.id) ? -1 : 1;
  });
  return triees.find((p) => p.photo_couverture) || triees[0] || null;
}
function couvertureFiche(photos) {
  const choisie = choixCouverture(photos);
  return choisie ? photoLegere(choisie.url_moyenne || choisie.url) : '';
}
// (phase 2, 02/11/2026 : la fiche complète est écrite par js/rendu-fiche.js, ficheRemplie ci-dessous ; les mensurations
// « à reprendre » y restent cachées, comme sur la page)
// (01/11/2026, « ça doit être instantané ») la photo que la carte du Book montrait déjà (même règle que
// photos_couverture_petites : principale d'abord, puis la plus ancienne ; petite version sur téléphone) : déjà
// dans le téléphone, elle s'affiche AUSSITÔT sous la grande photo, qui la recouvre dès qu'elle arrive
// (01/11/2026, remarque de la propriétaire) seulement si c'est LA MÊME photo que la grande : jamais une première
// photo différente qui serait remplacée par une autre
function photoDeLaCarte(photos, telephone) {
  const p = photos[0];  // (photos lues triées principale d'abord, puis par date)
  const grande = choixCouverture(photos);
  if (!p || !grande || grande.id !== p.id) return '';
  return photoLegere(p.url_miniature && p.url_petite && telephone ? p.url_petite : (p.url_miniature || p.url));
}
// premier jour du mois, dix ans plus tôt (même période que ma2mExperiencesAgence, js/app.js)
const dixAnsAvant = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear() - 10, d.getUTCMonth(), 1)).toISOString().slice(0, 10); };
async function ficheRemplie(requete, url, id, slug, anglais) {
  if (requete.method !== 'GET') return null;
  const lecture = enMemoire('fiche-' + id, () => Promise.all([
    lireSupabase('model_profiles?id=eq.' + id + '&published=eq.true&select=' + COLONNES_PROFIL_FICHE, null, ATTENTE_FICHE),
    lireSupabase('model_photos?model_id=eq.' + id + '&select=' + COLONNES_PHOTOS_FICHE + '&order=principale.desc,created_at.asc', null, ATTENTE_FICHE),
    lireSupabase('rpc/ages_mannequins', { ids: [id] }, ATTENTE_FICHE),
    // (100 % dynamique, 01/11/2026) aussi les expériences, le parcours avec l'agence (10 ans, comme
    // ma2mExperiencesAgence, js/app.js) et les mesures de l'Extension 121 ; manquants, la page les lit elle-même
    lireSupabase('model_projects?model_id=eq.' + id + '&select=id,model_id,type_projet,titre,periode,pays,ville,promoteur,lieu,created_at&order=created_at.desc', null, ATTENTE_FICHE).catch(() => null),
    lireSupabase('rpc/parcours_public', { p_debut: dixAnsAvant(), p_fin: new Date().toISOString().slice(0, 10), p_model: id }, ATTENTE_FICHE).catch(() => null),
    lireSupabase('model_profiles?id=eq.' + id + '&select=shoulder_cm,arm_cm,neck_cm', null, ATTENTE_FICHE).catch(() => null)
  ]).then(([profils, photos, ages, projets, parcours, mesures]) => {
    const profil = Array.isArray(profils) && profils[0];
    if (!profil || !Array.isArray(photos)) return null;
    const d = { id, slug, profil, photos, age: Array.isArray(ages) ? ages[0]?.age ?? null : null };
    if (Array.isArray(projets)) d.projets = projets;
    if (Array.isArray(parcours)) d.parcours = parcours;
    if (Array.isArray(mesures)) d.mesures = mesures[0] || {};
    return d;
  }));
  return pageRemplie(url, (anglais ? '/en' : '') + '/mannequin', 'fiche-donnees', lecture, async (html, d) => {
    // (phase 2, 02/11/2026) la fiche COMPLÈTE écrite ici par le même dessin que la page (js/rendu-fiche.js) : mesures et
    // tailles, à propos, parcours (projets de l'agence + expériences saisies), vidéo, boutons, photos du Book, contact.
    // Page anglaise : présentation et types d'expérience traduits, comme la page le fait (versAnglais).
    const P = globalThis.Partage;
    const projetsFusionnes = P.fusionnerExperiences(P.experiencesDepuisParcours(d.parcours || [], anglais), d.projets || []);
    const [profilPage, ...projetsPage] = anglais ? await versAnglaisServeur([Object.assign({}, d.profil, d.mesures || {}), ...projetsFusionnes], ['bio', 'type_projet']) : [Object.assign({}, d.profil, d.mesures || {}), ...projetsFusionnes];
    const vues = P.photosAffichees(d.photos);
    const dessin = globalThis.RenduFiche.fiche({ profil: profilPage, photos: d.photos, projets: projetsPage, age: d.age != null ? d.age : '' }, {
      en: anglais, urlLegere: photoLegere,
      photoHero: vues.couverture ? photoLegere(vues.couverture.url_moyenne || vues.couverture.url) : '/assets/logo-dark-bg.png',
      photoAvatar: vues.profil ? photoLegere(vues.profil.url_miniature || vues.profil.url) : '/assets/logo-dark-bg.png' });
    // (la photo que la carte du Book montrait déjà, sous la grande photo le temps qu'elle arrive : 01/11/2026)
    const apercu = photoDeLaCarte(d.photos, estTelephone(requete)), grande = vues.couverture ? photoLegere(vues.couverture.url_moyenne || vues.couverture.url) : '';
    if (apercu && apercu !== grande) dessin.contenu = dessin.contenu.replace('<img data-couv-img', () => '<img class="hero-apercu" src="' + echapper(apercu) + '" alt="" aria-hidden="true" fetchpriority="high">\n        <img data-couv-img');
    const nom = d.profil.full_name || (anglais ? 'Model' : 'Mannequin');
    const description = [d.profil.full_name, d.profil.city, d.profil.height_cm ? d.profil.height_cm + ' cm' : null].filter(Boolean).join(' · ') +
      (anglais ? ' · Full book on the Maître Akesse Model Management agency website.' : " · Book complet sur le site de l'agence Maître Akesse Model Management.");
    // (adresse /mannequin?id=… ouverte depuis une carte du Book : pas encore de nom d'adresse connu ici)
    const lien = SITE + (anglais ? '/en' : '') + (slug ? '/book/' + slug : '/mannequin?id=' + id);
    const chemin = slug ? '/book/' + slug : '/mannequin?id=' + id;
    const couv = couvertureFiche(d.photos);
    const photoApercu = imageApercu(couv || '', anglais, 'mannequin');
    // (phase 2, 02/11/2026 : balises og: et données structurées de la mannequin, pour tous ; jamais de coordonnées)
    const personne = { '@type': 'Person', name: nom, url: lien, image: photoApercu, jobTitle: anglais ? 'Model' : 'Mannequin',
      worksFor: { '@type': 'Organization', name: NOM_SITE, url: SITE + '/' } };
    if (d.profil.city) personne.homeLocation = { '@type': 'Place', name: d.profil.city };
    if (d.profil.height_cm) personne.height = { '@type': 'QuantitativeValue', value: d.profil.height_cm, unitCode: 'CMT' };
    return photoAnnoncee(metaEntite(html, { titre: nom, description, photo: photoApercu, lien, lienFr: SITE + chemin, lienEn: SITE + '/en' + chemin, type: 'profile',
      ld: { '@context': 'https://schema.org', '@type': 'ProfilePage', url: lien, mainEntity: personne } })
      .replace(/<div id="contenu" class="u-mt-2"><span class="fiche-en-chargement">[^<]*<\/span><\/div>/, () => '<div id="contenu" class="u-mt-2">' + dessin.contenu + '</div>')
      .replace('<div id="galerie" class="book-grille-ig reveal reveal-delay-1"></div>', () => '<div id="galerie" class="book-grille-ig reveal reveal-delay-1">' + dessin.galerie + '</div>')
      .replace('<div id="fiche-contact-bas"></div>', () => '<div id="fiche-contact-bas">' + dessin.contact + '</div>'), grande);
  });
}

// ================== The Book préparé par le serveur (01/11/2026, site dynamique, étape 2) ==================
// Avant : la page partait vide, chargeait ses programmes, PUIS demandait la liste des mannequins, PUIS
// leurs photos de couverture (deux allers-retours l'un après l'autre). Désormais le serveur pose les
// deux réponses dans la page (bloc « book-donnees », lu par js/mannequins.js) : mêmes questions, mêmes
// colonnes que la page (seulement ce que le Book montre ou filtre déjà). Base lente (plus de 1,2 s au
// total) ou en panne : la page part comme avant. Gardé 3 minutes en mémoire (enMemoire : une mannequin publiée ou
// retirée se voit au plus 3 minutes après).
const COLONNES_BOOK = 'id,slug,full_name,city,category,height_cm,chest_cm,waist_cm,hips_cm,shoe_size,eye_color,hair_color,languages,carnation,clothing_size,availability,niveau_mannequin,years_experience';
async function bookRempli(url, anglais, requete) {
  const lecture = enMemoire('book', async () => {
    const fin = Date.now() + ATTENTE_FICHE;
    const reste = () => Math.max(fin - Date.now(), 1);
    const profils = await lireSupabase('model_profiles?published=eq.true&select=' + COLONNES_BOOK + '&order=created_at.desc&limit=300', null, reste());
    if (!Array.isArray(profils) || !profils.length) return null;
    const ids = profils.map((p) => p.id);
    const [photos, mdm] = await Promise.all([lireCouvertures(ids, reste), lireSupabase('rpc/mannequin_du_mois_actuelle', {}, reste()).catch(() => null)]);
    return Array.isArray(photos) ? { profils, photos, mdm: mdm && typeof mdm === 'object' && !Array.isArray(mdm) ? mdm : null } : null;
  });
  const telephone = estTelephone(requete);
  // les cartes elles-mêmes écrites dans la page (js/rendu-book.js, les mêmes que la page dessine)
  return pageRemplie(url, (anglais ? '/en' : '') + '/mannequins', 'book-donnees', lecture, (html, d) => {
    // Book filtré par l'adresse (?categorie=, ?niveau= : liens Femmes, Hommes, New Faces) : la page dessine la
    // liste filtrée elle-même (pas de cartes écrites ici qui disparaîtraient aussitôt)
    if (url.searchParams.has('categorie') || url.searchParams.has('niveau')) return html;
    const photoDe = {};
    d.photos.forEach((ph) => { photoDe[ph.model_id] = photoLegere(ph.url_petite && telephone ? ph.url_petite : ph.url); });
    const R = globalThis.RenduBook, liste = R.ordonner(d.profils.slice());
    const libelle = anglais ? 'Add to my selection' : 'Ajouter à ma sélection';
    const cartes = liste.map((p, rang) => R.carte(p, rang, { en: anglais, photo: photoDe[p.id] || '/assets/logo-dark-bg.png', selectionne: false, libelle })).join('');
    return html.replace('<div id="grille" class="medaillon-grille" data-place-reservee></div>', () => R.bandeauMdm(d.mdm, anglais) + '<div id="grille" class="medaillon-grille" data-serveur="1">' + cartes + '</div>')
      .replace('<span id="f-compte"></span>', () => '<span id="f-compte">' + R.compte(liste.length, anglais) + '</span>');
  });
}

// ================== Actualités et événements préparés par le serveur (01/11/2026, site dynamique, étape 2) ==================
// Même principe que The Book : la liste et les photos (pour leur nombre) sont posées dans la page (bloc
// « publications-donnees », lu par publicationsServeur, js/publications.js), mêmes questions que la page ;
// la photo « À la une » est annoncée en tête. Base lente (plus de 1,2 s) ou en panne : comme avant.
const PUBLICATIONS_PAGES = /^\/(en\/)?(actualites|evenements)$/;
const LECTURES_PUBLICATIONS = {
  actualites: ['actualites?select=id,titre,image_url,commentaire,created_at,video_url,featured,categorie&order=created_at.desc', 'actualite_photos?select=actualite_id'],
  evenements: ['evenements?select=id,titre,date_evenement,lieu,description,image_url,created_at&order=date_evenement.desc.nullslast,created_at.desc', 'evenement_photos?select=evenement_id']
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
    // (phase 2) filtres par catégorie des actualités, visibles d'avance (classe u-hidden retirée, comme la page le fait)
    const filtres = sorte === 'actualite' ? R.filtresActualites(d.liste, anglais) : '';
    if (filtres) html = html.replace('<div id="actus-filtres" class="filtres-categories reveal u-hidden"></div>', () => '<div id="actus-filtres" class="filtres-categories reveal">' + filtres + '</div>');
    if (liste.length) {
      html = html.replace('<div id="' + prefixe + '-une" class="une-reservee"></div>', () => '<div id="' + prefixe + '-une" class="une-reservee">' +
        R.une(liste[0], { en: anglais, sorte, photo: photoLegere(liste[0].image_url || ''), extrait: extrait(liste[0], 180) }) + '</div>')
        .replace('<div id="' + prefixe + '-grille" class="news-grille"></div>', () => '<div id="' + prefixe + '-grille" class="news-grille">' +
          liste.slice(1).map((p, i) => R.carte(p, i + 1, { en: anglais, sorte, photo: photoLegere(p.image_url || ''), nbPhotos: nb[p.id] || (p.image_url ? 1 : 0), extrait: extrait(p, 110) })).join('') + '</div>');
    }
    // (phase 2, 02/11/2026) lien d'UN article ou événement (?actu=… / ?evenement=…) : son titre, son extrait et sa
    // photo dans l'en-tête, pour tous (avant : petite page réservée aux robots d'aperçu)
    const idEl = url.searchParams.get(sorte === 'actualite' ? 'actu' : 'evenement');
    const el = idEl && ID_VALIDE.test(idEl) && liste.find((p) => p.id === idEl);
    if (el && el.titre) {
      const chemin = '/' + quoi + '?' + (sorte === 'actualite' ? 'actu' : 'evenement') + '=' + el.id;
      const lien = SITE + (anglais ? '/en' : '') + chemin;
      let entete = '';
      if (el.date_evenement) { try { entete = new Date(el.date_evenement + 'T12:00:00Z').toLocaleDateString(anglais ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); } catch (x) { entete = ''; } }
      const description = [[entete, el.lieu].filter(Boolean).join(' · '), texteSimple(el[texteLong], 200)].filter(Boolean).join(' — ') || NOM_SITE;
      const photo = imageApercu(el.image_url, anglais, quoi);
      const ld = sorte === 'actualite'
        ? { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: el.titre, image: photo, datePublished: el.created_at, url: lien, publisher: { '@type': 'Organization', name: NOM_SITE, url: SITE + '/' } }
        : { '@context': 'https://schema.org', '@type': 'Event', name: el.titre, image: photo, url: lien, startDate: el.date_evenement || undefined,
          location: el.lieu ? { '@type': 'Place', name: el.lieu, address: el.lieu } : undefined, organizer: { '@type': 'Organization', name: NOM_SITE, url: SITE + '/' } };
      html = metaEntite(html, { titre: el.titre, description, photo, lien, lienFr: SITE + chemin, lienEn: SITE + '/en' + chemin, type: 'article', ld });
    }
    return photoAnnoncee(html, d.liste[0]?.image_url ? photoLegere(d.liste[0].image_url) : '');
  });
}

// ================== Partenaires préparés par le serveur (01/11/2026, site dynamique, étape 2) ==================
// La liste des partenaires (même lecture que js/partenaires.js) posée dans la page (bloc « partenaires-donnees »).
async function partenairesRemplis(url, anglais) {
  const lecture = enMemoire('partenaires', () => lireSupabase('partenaires?select=id,nom,structure,evenement,role,description,logo_url,created_at&order=created_at.desc', null, ATTENTE_FICHE).then((l) => (Array.isArray(l) ? { liste: l } : null)));
  return pageRemplie(url, (anglais ? '/en' : '') + '/partenaires' + url.search, 'partenaires-donnees', lecture, async (html, d) => {
    // les cartes écrites dans la page (js/rendu-publications.js), en anglais sur /en/partenaires
    const liste = anglais ? await versAnglaisServeur(d.liste, ['structure', 'evenement', 'role', 'description']) : d.liste;
    const R = globalThis.RenduPublications;
    // (phase 2, 02/11/2026) lien d'UN partenaire (?partenaire=…) : son nom, sa description et son logo dans l'en-tête
    const idP = url.searchParams.get('partenaire');
    const pa = idP && ID_VALIDE.test(idP) && liste.find((p) => p.id === idP);
    if (pa && pa.nom) {
      const chemin = '/partenaires?partenaire=' + pa.id;
      html = metaEntite(html, { titre: pa.nom, description: texteSimple(pa.description, 220) || (anglais ? 'A partner of ' : 'Partenaire de ') + NOM_SITE,
        photo: imageApercu(pa.logo_url, anglais, 'partenaires'), lien: SITE + (anglais ? '/en' : '') + chemin, lienFr: SITE + chemin, lienEn: SITE + '/en' + chemin });
    }
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
  return pageRemplie(url, (anglais ? '/en' : '') + '/agenda', 'agenda-donnees', lecture, async (html, d) => {
    // (phase 2, 02/11/2026) la page complète écrite ici, par le même dessin que la page (js/rendu-agenda.js) : calendrier
    // du mois, projets à venir, projets réalisés ; textes de l'agence en anglais sur /en (comme versAnglais, js/agenda.js)
    const [agenda, evenements] = anglais ? await Promise.all([versAnglaisServeur(d.agenda, ['titre', 'lieu', 'description']), versAnglaisServeur(d.evenements, ['titre', 'lieu', 'description'])]) : [d.agenda, d.evenements];
    const r = globalThis.RenduAgenda.pageAgenda(agenda, evenements, anglais);
    return html.replace(/(<section id="agenda-calendrier" class="cal" aria-label="[^"]*">)<\/section>/, (_, o) => o + r.calendrier + '</section>' + r.calendrierSuite)
      .replace(/<div id="agenda-avenir" class="agenda-liste-publique"><p class="agenda-vide">[^<]*<\/p><\/div>/, () => '<div id="agenda-avenir" class="agenda-liste-publique">' + r.avenir + '</div>' + r.avenirSuite)
      .replace('<div id="agenda-passes" class="agenda-liste-publique"></div>', () => '<div id="agenda-passes" class="agenda-liste-publique">' + r.passes + '</div>' + r.passesSuite);
  });
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
  return pageRemplie(url, (anglais ? '/en' : '') + '/parcours', 'parcours-donnees', lecture, async (html, d) => {
    // (phase 2, 02/11/2026) la scène complète écrite ici par le même dessin que la page (js/parcours.js, RenduParcours) :
    // frise des mois, titre du mois, chiffres, filtres, visages, projets ; le mois le plus récent qui a des activités
    const photos = {};
    d.photos.forEach((c) => { if (c.url) photos[c.model_id] = photoLegere(c.url_petite || c.url); });
    // (page anglaise : titres et lieux traduits, comme la page le fait, js/parcours.js)
    const projets = anglais ? await versAnglaisServeur(d.projets, ['titre', 'lieu']) : d.projets;
    const z = globalThis.RenduParcours.page(projets, photos, anglais, new Date());
    // zones vides de la page : contenu écrit ; zones à texte fixe (parcours-vide) ou à enfants (parcours-contenu) : seulement cachées ou non
    ['parcours-mois', 'parcours-titre-mois', 'parcours-chiffres', 'parcours-filtres', 'parcours-visages', 'parcours-plus', 'parcours-detail', 'parcours-projets'].forEach((id) => {
      html = html.replace(new RegExp('<(nav|h2|div|button)([^>]*) id="' + id + '"([^>]*)><\\/\\1>'), (_, tag, avant, apres) =>
        '<' + tag + avant + ' id="' + id + '"' + apres.replace(/\s+hidden\b/, '') + (z[id].cache ? ' hidden' : '') + '>' + z[id].html + '</' + tag + '>');
    });
    ['parcours-vide', 'parcours-contenu'].forEach((id) => {
      html = html.replace(new RegExp('(<(?:p|div)[^>]* id="' + id + '")([^>]*)>'), (_, debut, apres) => debut + apres.replace(/\s+hidden\b/, '') + (z[id].cache ? ' hidden' : '') + '>');
    });
    return html;
  });
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
    lireToutesSupabase('model_photos?select=id,url,url_moyenne,url_miniature,model_id,model_profiles!inner(published)&model_profiles.published=eq.true&order=id.asc', reste)
  ]).then(([evenements, photos, mots, photosMannequins]) => {
    if (![evenements, photos, mots, photosMannequins].every(Array.isArray)) return null;
    const parMannequin = new Map();
    photosMannequins.forEach(({ model_profiles: _p, ...ph }) => {
      const liste = parMannequin.get(ph.model_id) || [];
      liste.push(ph);
      parMannequin.set(ph.model_id, liste);
    });
    return { evenements, photos, portrait: mots[0] || null, parMannequin: [...parMannequin.values()] };
  })).then((d) => {
    if (!d) return null;
    // tirage à CHAQUE visite (hors mémoire) : chaque photo a la même chance
    const auHasard = (l) => l[Math.floor(Math.random() * l.length)];
    return { evenements: d.evenements, photos: d.photos, portrait: d.portrait, visages: d.parMannequin.map(auHasard) };
  });
  return pageRemplie(url, (anglais ? '/en' : '') + '/qui-sommes-nous', 'qsn-donnees', lecture, async (html, d) => {
    // étape A (01/11/2026) : les cartes des événements déjà réalisés écrites dans la page (titre, lieu), après les
    // deux cartes du texte ; la page les reconnaît (même clé que cleTitre, js/qui-sommes-nous.js), y pose les
    // photos et met les titres en forme. Un événement sans photo n'a pas de carte (comme dans la page).
    const evenements = anglais ? await versAnglaisServeur(d.evenements, ['titre', 'lieu']) : d.evenements;
    const cle = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const lisible = globalThis.Partage.titreLisible;
    // (phase 2, 02/11/2026) photos écrites dans la page, comme js/qui-sommes-nous.js les choisit (au hasard à chaque
    // visite) ; la première de chaque cadre déjà affichée (classe « actif ») : visible sans programme. La page les reprend.
    const melanger = (l) => l.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const urlsDe = (e) => { const u = d.photos.filter((p) => p.evenement_id === e.id).map((p) => p.url); if (!u.length && e.image_url) u.push(e.image_url); return u.filter(Boolean); };
    // (07/11/2026) à la taille de l'écran ; seule la première est chargée tout de suite, les autres attendent leur tour
    // (cachées tant qu'elles ne sont pas « suivante » : css/qui-sommes-nous.css, js/qui-sommes-nous.js)
    // (ouverture : 640 px sur téléphone, 1080 px sur grand écran ; cartes du bas : toutes « lazy », même la première)
    const imgs = (urls, alt, largeur, basDePage) => urls.map((u, i) => '<img src="' + echapper(photoReduite(u, largeur)) + '"' +
      (largeur === 1080 ? ' srcset="' + echapper(photoReduite(u, 640)) + ' 640w, ' + echapper(photoReduite(u, 1080)) + ' 1080w" sizes="100vw"' : '') +
      ' alt="' + echapper(alt || '') + '" decoding="async"' + (i ? ' loading="lazy"' : (basDePage ? ' loading="lazy"' : '') + ' class="actif"') +
      // (08/11/2026, phase 3 V1) ouverture : la photo visible passe d'abord, les suivantes attendent (les 3 se partageaient
      // la connexion : 4 s pour la première en 4G lente, mesuré)
      (largeur === 1080 ? (i ? ' fetchpriority="low"' : ' fetchpriority="high"') : '') +
      // (la suivante préparée et la dernière déjà là pour le fondu, comme quand la page s'anime : mêmes photos avec ou sans programme)
      (i === 1 ? ' class="suivant"' : i > 1 && i === urls.length - 1 ? ' class="precedent"' : '') + '>').join('');
    const toutes = []; evenements.forEach((e) => urlsDe(e).forEach((u) => toutes.push(u)));
    if (toutes.length) {
      const ouverture = melanger(toutes).slice(0, 8);
      // (08/11/2026, phase 3 V1) la première photo de l'ouverture annoncée tout en haut de la page, à la taille de l'écran
      // (comme la couverture de l'accueil et la photo des fiches) : elle était découverte tard (2,3 s d'attente mesurée)
      const annonce = '<link rel="preload" as="image" fetchpriority="high" href="' + echapper(photoReduite(ouverture[0], 1080)) + '" imagesrcset="' +
        echapper(photoReduite(ouverture[0], 640)) + ' 640w, ' + echapper(photoReduite(ouverture[0], 1080)) + ' 1080w" imagesizes="100vw">';
      html = /<head>/i.test(html) ? enHautDeLaPage(html, annonce) : html;
      html = html.replace('<div class="qsn-diaporama" id="qsn-diaporama" aria-hidden="true"></div>', () => '<div class="qsn-diaporama" id="qsn-diaporama" aria-hidden="true" data-hasard>' + imgs(ouverture, '', 1080) + '</div>')
        .replace('<div class="qsn-marques-fond" id="qsn-marques-fond" aria-hidden="true"></div>', () => '<div class="qsn-marques-fond" id="qsn-marques-fond" aria-hidden="true" data-hasard><img src="' + echapper(photoReduite(melanger(toutes)[0], 1080)) + '" alt="" decoding="async" loading="lazy"></div>');
    }
    // visages : une photo par mannequin (tirée par la lecture), 16 au hasard, deux rangées (la 2e à l'envers)
    const visages = melanger(d.visages.filter((v) => v && (v.url || v.url_moyenne))).slice(0, 16);
    if (visages.length >= 4) {
      const lien = (v, cache) => '<a href="mannequin.html?id=' + encodeURIComponent(v.model_id) + '"' + (cache ? ' aria-hidden="true" tabindex="-1"' : '') + '><img src="' + echapper(photoLegere(v.url_miniature || v.url_moyenne || v.url)) + '" alt="' + (anglais ? 'Model of the agency' : 'Mannequin de l\'agence') + '" decoding="async" loading="lazy"></a>';
      const rangee = visages.map((v) => lien(v, false)).join('') + visages.map((v) => lien(v, true)).join('');
      const inverse = [...visages, ...visages].reverse().map((v) => lien(v, true)).join('');
      html = html.replace('<section class="qsn-visages" aria-label="Nos mannequins" hidden>', () => '<section class="qsn-visages" aria-label="Nos mannequins">')
        .replace('<section class="qsn-visages" aria-label="Our models" hidden>', () => '<section class="qsn-visages" aria-label="Our models">')
        .replace('<div class="qsn-visages-piste" id="qsn-visages-piste"></div>', () => '<div class="qsn-visages-piste" id="qsn-visages-piste" data-hasard>' + rangee + '</div><div class="qsn-visages-piste qsn-visages-inverse" data-hasard>' + inverse + '</div>');
    }
    // portrait du fondateur
    if (d.portrait && d.portrait.photo_url) {
      html = html.replace(/<img id="qsn-portrait-img" src="data:image\/gif;base64,[^"]*" alt="([^"]*)" hidden>/, (_, alt) => '<img id="qsn-portrait-img" src="' + echapper(photoReduite(d.portrait.photo_url, 640)) + '" alt="' + alt + '" loading="lazy" decoding="async">')
        .replace('<figure class="qsn-portrait reveal qsn-rideau">', () => '<figure class="qsn-portrait reveal qsn-rideau avec-photo">');
    }
    const vus = new Set([...html.matchAll(/data-evenement="([^"]*)"/g)].map((m) => m[1]));
    const avecPhoto = new Set(d.photos.map((p) => p.evenement_id));
    const cartes = [];
    evenements.forEach((e) => {
      const t = cle(e.titre);
      if (!t || vus.has(t) || !(avecPhoto.has(e.id) || e.image_url)) return;
      vus.add(t);
      cartes.push('<article class="qsn-evenement reveal" data-evenement="' + echapper(t) + '" data-serveur="1"><div class="qsn-evenement-photo qsn-rideau"></div>' +
        '<h3>' + echapper(lisible(e.titre)) + '</h3>' + (e.lieu ? '<p>' + echapper(lisible(e.lieu)) + '</p>' : '') + '</article>');
    });
    const debut = html.indexOf('<div class="qsn-evenements" id="qsn-evenements">'), fin = debut < 0 ? -1 : html.indexOf('\n    </div>', debut);
    if (cartes.length && fin > 0) html = html.slice(0, fin) + '\n      ' + cartes.join('\n      ') + html.slice(fin);
    // photos de chaque carte (celles de la page et celles ajoutées ci-dessus) : 6 au hasard parmi les événements du même nom
    html = html.replace(/(<article class="qsn-evenement[^"]*" data-evenement="([^"]*)"[^>]*>\s*)<div class="qsn-evenement-photo qsn-rideau"><\/div>(\s*<h3>([^<]*)<\/h3>)?/g, (tout, debutCarte, cleCarte, h3, titreCarte) => {
      const urls = []; evenements.filter((e) => cle(e.titre) === cleCarte.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')).forEach((e) => urlsDe(e).forEach((u) => urls.push(u)));
      if (!urls.length) return debutCarte + '<div class="qsn-evenement-photo qsn-rideau" hidden></div>' + (h3 || '');
      return debutCarte + '<div class="qsn-evenement-photo qsn-rideau" data-hasard>' + imgs(melanger(urls).slice(0, 6), titreCarte ? titreCarte.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&') : '', 640, true) + '</div>' + (h3 || '');
    });
    // (comme js/qui-sommes-nous.js : le nom n'est changé que si le portrait a une photo)
    if (d.portrait && d.portrait.nom && d.portrait.photo_url) html = texteElement(html, 'qsn-portrait-nom', d.portrait.nom);
    return poserTextes(html, await textesDePage('qui-sommes-nous').catch(() => null), anglais);
  });
}

// ================== 100 % dynamique, étape 4 (01/11/2026) : traductions anglaises ==================
// Toutes les traductions (table traductions_en : 62 textes, 26 Ko le 01/11/2026) posées dans chaque page anglaise ;
// versAnglais (js/app.js) les y lit au lieu de les demander à la base. Gardées 3 minutes.
const toutesTraductions = () => enMemoire('traductions', () => lireSupabase('traductions_en?select=cle,en', null, 1000)
  .then((l) => (Array.isArray(l) ? Object.fromEntries(l.map((r) => [r.cle, r.en])) : null)));
const blocTraductions = async (url) => {
  if (!/^\/en(\/|$)/.test(url.pathname)) return '';
  const t = await toutesTraductions().catch(() => null);
  return t ? '\n<script type="application/json" id="traductions-donnees">' + jsonSur(t) + '</script>' : '';
};

// ================== 100 % dynamique, étape 1 (01/11/2026) ==================
// Mur de photos : les 24 dernières mannequins publiées, petite version de leur photo de couverture (comme
// js/app.js : urlGrille(l, true)) ; gardé 3 minutes. Le tirage des 8 visages reste fait par la page.
const murDuSite = () => enMemoire('mur', async () => {
  const profils = await lireSupabase('model_profiles?published=eq.true&select=id&order=created_at.desc&limit=24', null, ATTENTE_FICHE);
  if (!Array.isArray(profils) || !profils.length) return null;
  const lignes = await lireCouvertures(profils.map((p) => p.id), ATTENTE_FICHE);
  return Array.isArray(lignes) ? lignes.filter((l) => l.url).map((l) => photoLegere(l.url_petite || l.url)) : null;
});
// Contact (rien d'autre à lire que le mur) et candidature (la liste des castings ouverts, lue par
// js/formulaire-candidature.js) ; base lente ou en panne : la page part comme avant
const PAGES_FORMULAIRES = /^\/(en\/)?(contact|candidature)$/;
async function formulairesRemplis(url, anglais) {
  const page = PAGES_FORMULAIRES.exec(url.pathname)[2];
  const lecture = page === 'candidature'
    ? enMemoire('castings', () => lireSupabase('casting_projets?actif=eq.true&select=id,nom,description&order=ordre_affichage.asc,nom.asc', null, ATTENTE_FICHE)).then((l) => (Array.isArray(l) ? { projets: l } : null))
    : Promise.resolve({});
  // (phase 2, 02/11/2026) candidature : la liste des castings ouverts écrite dans la page, et le bon bloc montré d'avance
  // (le formulaire, ou « Aucun casting n'est ouvert… »), comme chargerProjetsActifs (js/formulaire-candidature.js)
  const retoucher = page !== 'candidature' ? null : (html, d) => {
    if (!Array.isArray(d.projets)) return html;
    const aucun = d.projets.length === 0;
    const options = '<option value="">' + (anglais ? 'Select' : 'Sélectionner') + '</option>' +
      d.projets.map((p) => '<option value="' + echapper(p.nom) + '">' + echapper(p.nom) + '</option>').join('') +
      '<option value="__autre__">' + (anglais ? 'Other (specify)' : 'Autre (précisez)') + '</option>';
    return html.replace(/<p id="ca-chargement"[^>]*>[^<]*<\/p>\s*/, '')
      .replace('<div id="ca-aucun-casting" class="ca-24 u-hidden"', () => '<div id="ca-aucun-casting" class="ca-24' + (aucun ? '' : ' u-hidden') + '"')
      .replace('<form id="form-casting" data-parcours="projet" class="u-hidden">', () => '<form id="form-casting" data-parcours="projet"' + (aucun ? ' class="u-hidden"' : '') + '>')
      .replace(/(<select id="ca-projet" required>)[\s\S]*?(<\/select>)/, (_, o, f) => o + options + f);
  };
  return pageRemplie(url, (anglais ? '/en/' : '/') + page, 'page-donnees', lecture, retoucher);
}

// ================== Étape C (01/11/2026) : textes des pages modifiables depuis l'Administration ==================
// Services, Qui sommes-nous, Intégrer l'agence, Mentions légales, Politique de confidentialité : chaque texte simple
// porte un repère data-texte="page-N" (le même en français et en anglais, scripts/textes-pages.py). Le texte choisi
// dans Administration › Textes des pages (table textes_pages, supabase-textes-pages.sql) remplace celui de la page,
// échappé (du texte seul, jamais de code ; un retour à la ligne devient <br>). Sans texte enregistré (ou base lente,
// 1 s au plus) : la page part telle qu'écrite. Gardé 3 minutes en mémoire (une modification se voit au plus 3 minutes après).
const PAGES_TEXTES = /^\/(en\/)?(services|qui-sommes-nous|integrer-agence|mentions-legales|politique-confidentialite)$/;
// (table pas encore créée ou base en panne : « aucun texte », gardé 3 minutes aussi, pour ne pas redemander à chaque visite)
const textesDePage = (page) => enMemoire('textes:' + page, () => lireSupabase('textes_pages?page=eq.' + page + '&select=cle,fr,en', null, 1000).catch(() => null).then((l) => (Array.isArray(l) ? l : [])));
function poserTextes(html, lignes, anglais) {
  const textes = new Map();
  (Array.isArray(lignes) ? lignes : []).forEach((l) => {
    const t = String((anglais ? l.en : l.fr) || '').trim();
    if (t) textes.set(l.cle, t);
  });
  if (!textes.size) return html;
  // (le texte d'un repère : du texte et des <br>, jusqu'à la balise suivante — fermante, ou point rouge du titre)
  return html.replace(/(<\w+\b[^>]*? data-texte="([a-z-]+-\d+)"[^>]*>)[^<]*(?:<br\s*\/?>[^<]*)*(?=<)/g,
    (tout, ouvrante, cle) => (textes.has(cle) ? ouvrante + echapper(textes.get(cle)).replace(/\r?\n/g, '<br>') : tout));
}
async function textesRemplis(url, anglais) {
  const page = PAGES_TEXTES.exec(url.pathname)[2];
  const lecture = textesDePage(page).then((l) => (Array.isArray(l) && l.length ? l : null));
  return pageRemplie(url, (anglais ? '/en/' : '/') + page, 'textes-donnees', lecture, (html, l) => poserTextes(html, l, anglais));
}

// ================== Étape B (01/11/2026) : pages d'un lien personnel écrites par le serveur ==================
// Reçu d'un cachet (/recu?r=jeton) et places limitées (/places?c=jeton) : lues avec la clé publique et le seul
// jeton du lien (comme la page), JAMAIS gardées en mémoire (données personnelles, et les places changent sans
// arrêt). Mêmes outils que la page (js/cachets-communs.js, js/lien-public.js). Lien non valable, base lente :
// la page part comme avant et se remplit elle-même.
const JETON_RECU = /^[0-9a-f-]{36}$/, JETON_PLACES = /^[0-9a-f]{36}$/;
const montrer = (html, id) => html.replace(new RegExp('(<[a-z0-9]+ [^>]*id="' + id + '"[^>]*?) hidden>'), (m, debut) => debut + '>');
async function recuRempli(url) {
  const jeton = url.searchParams.get('r') || '';
  if (!JETON_RECU.test(jeton)) return null;
  const lecture = lireSupabase('rpc/cachet_recu_lire', { p_jeton: jeton }, ATTENTE_FICHE).then((l) => (Array.isArray(l) && l[0] ? { recu: l[0] } : null));
  return pageRemplie(url, '/recu' + url.search, 'recu-donnees', lecture, (html, d) => {
    const c = d.recu, K = globalThis.CachetsMa2m;
    html = [['rc-numero', c.numero || '—'], ['rc-etat', 'Paiement effectué ✓'], ['rc-qui', c.beneficiaire], ['rc-quoi', c.prestation || K.libelle(c.motif)],
      ['rc-date', K.jour(c.paye_le)], ['rc-montant', K.fcfa(c.montant)]].reduce((h, [id, t]) => texteElement(h, id, t || ''), html);
    if (c.reference_wave) html = montrer(texteElement(html, 'rc-ref', c.reference_wave), 'rc-ref-ligne');
    html = ['rc-lignes', 'rc-montant-bloc', 'rc-merci', 'rc-actions'].reduce((h, id) => montrer(h, id), html);
    return html.replace(/<title>[^<]*<\/title>/, () => '<title>' + echapper('Reçu ' + (c.numero || '') + ' · Maître Akesse Model Management') + '</title>');
  });
}
async function placesRempli(url) {
  const jeton = url.searchParams.get('c') || '', parent = url.searchParams.get('p') === '1';
  if (!JETON_PLACES.test(jeton)) return null;
  const lecture = lireSupabase('rpc/places_lire', { p_jeton: jeton }, ATTENTE_FICHE).then((e) => (e && typeof e === 'object' && e.titre ? { places: e } : null));
  return pageRemplie(url, '/places' + url.search, 'places-donnees', lecture, (html, d) => {
    const L = globalThis.LienPublic, e = Object.assign({ pris: [] }, d.places), [classe, titre, texte] = L.placesEtat(e, parent);
    // (titre suivi du point décoratif <span class="oeil">)
    html = texteElement(html.replace(/(<h1 id="pl-titre">)[^<]*(<span)/, (m, a, b) => a + echapper(e.titre) + b), 'pl-details', L.placesDetails(e, parent));
    return html.replace(/<div class="pl-etat" id="pl-etat" role="status" aria-live="polite" hidden><\/div>/, () =>
      '<div class="pl-etat ' + echapper(classe) + '" id="pl-etat" role="status" aria-live="polite"><strong>' + echapper(titre) + '</strong>' + echapper(texte) + '</div>');
  });
}

// Aiguillage des pages préparées par le serveur (adresse propre → fonction(url, anglais))
const PAGES_REMPLIES = [
  [/^\/(en\/)?mannequins$/, bookRempli],
  [PUBLICATIONS_PAGES, publicationsRemplies],
  [/^\/(en\/)?partenaires$/, partenairesRemplis],
  [/^\/(en\/)?agenda$/, agendaRempli],
  [/^\/(en\/)?parcours$/, parcoursRempli],
  [/^\/(en\/)?qui-sommes-nous$/, quiSommesNousRempli],
  [PAGES_TEXTES, textesRemplis],
  [PAGES_FORMULAIRES, formulairesRemplis],
  [/^\/recu$/, recuRempli],
  [/^\/places$/, placesRempli]
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

// Demande interne de la page elle-même : repère anti-boucle, et les témoins du visiteur (versions d'essai Vercel
// protégées par une connexion : sans eux, la page interne répond « non autorisé » et rien n'était écrit)
function entetesInternes(url, repere) {
  const h = { [repere]: '1', 'accept': 'text/html' };
  if (url.temoins) h.cookie = url.temoins;
  return h;
}
export default async function middleware(requete) {
  try {
    const url = new URL(requete.url);
    Object.defineProperty(url, 'temoins', { value: requete.headers.get('cookie') || '' });
    if (url.hostname === DOMAINE_NU) return versWww(url);
    if (ACCUEIL.test(url.pathname)) {
      if (requete.headers.get('x-ma2m-accueil')) return;  // (la page elle-même, demandée ci-dessous)
      if (requete.method !== 'GET') return;
      // (base lente ou en panne : la page part quand même complète, sans les mannequins)
      try { return (await accueilRempli(requete, url)) || await pageNue(url, 'x-ma2m-accueil'); } catch (e) { return; }
    }
    if (SCRIPTS_ADMIN.test(url.pathname) || SCRIPTS_NOUVELLE_ADMIN.test(url.pathname)) return await tableauProtege(requete);
    if (requete.headers.get('x-ma2m-remplie')) return;  // (page demandée par pageRemplie elle-même)
    if (url.pathname === '/sitemap.xml') return await planDuSite(url);
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
      if (lignes === null) return ficheSansId();
      const id = lignes[0] && lignes[0].id;
      if (!id || !ID_VALIDE.test(id)) return Response.redirect(SITE + (anglais ? '/en' : '') + '/mannequins', 302);
      // (phase 2, 02/11/2026 : visiteurs ET robots d'aperçu reçoivent la même fiche, avec ses balises og:)
      // la fiche part déjà remplie ; au moindre souci, comme avant (la page se remplit elle-même)
      const remplie = await ficheRemplie(requete, url, id, joli[2], anglais).catch(() => null);
      if (remplie) return remplie;
      return new Response(null, { headers: { 'x-middleware-rewrite': new URL((anglais ? '/en' : '') + '/mannequin?id=' + id, url).toString() } });
    }
    // fiche ouverte depuis une carte du Book (/mannequin?id=…, après le renvoi de mannequin.html) : écrite par le
    // serveur comme /book/nom (étape A, 01/11/2026) ; au moindre souci, la page habituelle
    if (/^\/(en\/)?mannequin$/.test(url.pathname) && requete.method === 'GET' && ID_VALIDE.test(url.searchParams.get('id') || '')) {
      const remplie = await ficheRemplie(requete, url, url.searchParams.get('id'), null, anglais).catch(() => null);
      if (remplie) return remplie;
      return;
    }
    // pages des visiteurs préparées par le serveur (site dynamique) ; jamais les adresses en .html, qui
    // suivent le renvoi vers l'adresse propre (vercel.json, cleanUrls) ; au moindre souci : comme avant
    // (phase 2, 02/11/2026 : la même page pour tous, robots d'aperçu compris ; base lente : la page part quand même
    // complète, barre du haut, menu et bas de page écrits)
    const remplir = requete.method === 'GET' && PAGES_REMPLIES.find(([chemin]) => chemin.test(url.pathname));
    if (remplir) {
      try { return (await remplir[1](url, anglais, requete)) || await pageNue(url, 'x-ma2m-remplie'); } catch (e) { return; }
    }
    // (phase 2, 02/11/2026) plus de petite page réservée aux robots d'aperçu : toutes les pages ci-dessus sont les mêmes
    // pour tous ; les autres adresses (.html…) suivent les renvois de vercel.json vers l'adresse propre
    return;
  } catch (e) {
    // au moindre souci : la page normale, comme avant (adresse lisible : The Book)
    try {
      const u = new URL(requete.url);
      if (CHEMIN_JOLI.test(u.pathname)) return Response.redirect(SITE + (u.pathname.indexOf('/en/') === 0 ? '/en' : '') + '/mannequins', 302);
    } catch (x) {}
    return;
  }
}
