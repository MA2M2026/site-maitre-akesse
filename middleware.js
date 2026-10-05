// ================== Aperçu des liens partagés (actualités / événements / The Book / mannequins) ==================
// 04/10/2026 : étendu à The Book (photo du mannequin à la une) et à la fiche de CHAQUE
// mannequin publié (sa photo, son nom, catégorie · ville · taille) — jamais ses
// coordonnées personnelles.
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
    '/mannequin', '/mannequin.html', '/en/mannequin', '/en/mannequin.html',
    '/mannequins', '/mannequins.html', '/en/mannequins', '/en/mannequins.html'
  ]
};

const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
// Clé « anon public » : la même que js/supabase-config.js, publique par nature.
const CLE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmaGdoZ213bXhpZ3VodHh0c2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NzI1ODQsImV4cCI6MjEwNDI0ODU4NH0.S-JftGJNtPMLZdK6Jy9AUwwOl56JzyllkEJ0GN0eZ-M';
const SITE = 'https://www.maitreakessemodelmanagement.com';
// Uniquement des robots d'aperçu identifiés sans ambiguïté. Volontairement PAS les
// navigateurs intégrés des applis (Instagram, Facebook « FBAN », Snapchat, LINE…) :
// ce sont de vraies personnes, qui doivent voir la vraie page. Ni Google/Bing, qui
// lisent déjà la vraie page.
const ROBOTS_APERCU = /^WhatsApp\/|facebookexternalhit|facebot|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|pinterestbot|skypeuripreview|redditbot|vkshare|embedly|iframely|mastodon/i;
const ID_VALIDE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function echapper(texte) {
  return String(texte == null ? '' : texte)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Texte riche (HTML de l'éditeur) → texte simple, court, pour la description.
function texteSimple(html, max) {
  const texte = String(html || '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ').trim();
  return texte.length > max ? texte.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : texte;
}

async function lireSupabase(chemin) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), 2500);
  try {
    const rep = await fetch(SUPABASE_URL + '/rest/v1/' + chemin, {
      headers: { apikey: CLE_ANON, Authorization: 'Bearer ' + CLE_ANON },
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
function imageApercu(url) {
  if (!url) return SITE + '/assets/logo-dark-bg.png';
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

// The Book (liste) et fiche d'UN mannequin publié.
async function apercuMannequin(url, anglais) {
  const fiche = /\/mannequin(\.html)?$/.test(url.pathname);
  if (fiche) {
    const id = url.searchParams.get('id');
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
    const lien = SITE + (anglais ? '/en' : '') + '/mannequin?id=' + id;
    return pageApercu({ titre: m.full_name, description, photo: imageApercu(await photoMannequin(id)), lien, anglais, type: 'profile' });
  }
  // The Book : photo du mannequin à la une (sinon du plus récent)
  let lignes = await lireSupabase('model_profiles?published=eq.true&featured=eq.true&select=id&limit=1');
  if (!lignes || !lignes.length) lignes = await lireSupabase('model_profiles?published=eq.true&select=id&order=created_at.desc&limit=1');
  const vedette = lignes && lignes[0];
  const photo = imageApercu(vedette ? await photoMannequin(vedette.id) : '');
  return pageApercu({
    titre: anglais ? 'The Book — Our models' : 'The Book — Nos mannequins',
    description: anglais
      ? 'Browse the models of Maître Akesse Model Management, Abidjan: books, measurements and casting requests.'
      : 'Découvrez les mannequins de Maître Akesse Model Management, à Abidjan : books, mensurations et demandes de casting.',
    photo, lien: SITE + (anglais ? '/en' : '') + '/mannequins', anglais
  });
}

export default async function middleware(requete) {
  try {
    const agent = requete.headers.get('user-agent') || '';
    if (!ROBOTS_APERCU.test(agent)) return; // visiteur normal : rien ne change
    const url = new URL(requete.url);
    const anglais = url.pathname.indexOf('/en/') === 0;
    if (/\/mannequins?(\.html)?$/.test(url.pathname)) return await apercuMannequin(url, anglais);
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
    return pageApercu({ titre, description, photo: imageApercu(image), lien, anglais, type: 'article' });
  } catch (e) {
    return; // au moindre souci : la page normale, comme avant
  }
}
