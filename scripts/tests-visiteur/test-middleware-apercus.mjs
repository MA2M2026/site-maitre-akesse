// Aperçus servis par middleware.js aux robots (WhatsApp…), 14/10/2026 : fiche d'un mannequin,
// actualité, événement, partenaire (20/10/2026). Sans photo, l'image d'aperçu de la page (assets/apercus/) remplace le
// logo ; The Book (liste) ne passe plus par le middleware (image de la page). Base simulée :
// aucune requête réelle (fetch remplacé).
import { fileURLToPath } from 'url'; import path from 'path';
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ID = '11111111-1111-1111-1111-111111111111';
let photo = '', logo = '';
globalThis.fetch = async (url) => {
  const u = String(url), json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('model_profiles?slug=eq.')) return json([{ id: ID }]);
  if (u.includes('select=slug')) return json([{ slug: 'awa-kone' }]);
  if (u.includes('model_profiles?id=eq.')) return json([{ id: ID, full_name: 'Awa Koné', city: 'Abidjan', category: 'femme', height_cm: 178 }]);
  if (u.includes('model_photos?')) return json(photo ? [{ url: photo, principale: true }] : []);
  if (u.includes('actualites?id=eq.')) return json([{ titre: 'Casting', commentaire: 'Texte', image_url: '' }]);
  if (u.includes('partenaires?id=eq.')) return json([{ nom: 'Orange Fashion', description: '<p>Partenaire mode</p>', logo_url: logo }]);
  if (u.includes('evenements?id=eq.')) return json([{ titre: 'Défilé', description: 'Texte', date_evenement: '2026-10-01', image_url: '' }]);
  return json([]);
};
const { default: middleware, config } = await import(path.join(racine, 'middleware.js'));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const robot = (chemin) => middleware(new Request('https://www.maitreakessemodelmanagement.com' + chemin, { headers: { 'user-agent': 'WhatsApp/2.23.20.0 A' } }));
const image = async (rep) => rep ? ((await rep.text()).match(/property="og:image" content="([^"]*)"/) || [])[1] : '';

ok(!config.matcher.some(m => /mannequins/.test(m)), 'The Book (liste) ne passe plus par le middleware : aperçu = image de la page');
ok((await image(await robot('/book/awa-kone'))).endsWith('/assets/apercus/fr-mannequin.jpg?v=2'), 'fiche sans photo → image « Profil mannequin » (plus le logo seul)');
ok((await image(await robot('/en/book/awa-kone'))).endsWith('/assets/apercus/en-mannequin.jpg?v=2'), 'fiche anglaise sans photo → image « Model profile »');
photo = 'https://photos.maitreakessemodelmanagement.com/' + ID + '/a.jpg';
ok((await image(await robot('/book/awa-kone'))).includes('_vercel/image?url=' + encodeURIComponent(photo)), 'fiche avec photo → photo du mannequin (inchangé)');
ok((await image(await robot('/actualites?actu=' + ID))).endsWith('/assets/apercus/fr-actualites.jpg?v=2'), 'actualité sans photo → image « Actualités »');
ok((await image(await robot('/en/evenements?evenement=' + ID))).endsWith('/assets/apercus/en-evenements.jpg?v=2'), 'événement anglais sans photo → image « Our events »');
// fiche d'un partenaire (20/10/2026) : son nom ; sans logo, l'image de la page Partenaires
let rep = await robot('/partenaires?partenaire=' + ID); let html = rep ? await rep.text() : '';
ok(/og:title" content="Orange Fashion"/.test(html) && /og:image" content="[^"]*\/assets\/apercus\/fr-partenaires\.jpg\?v=2"/.test(html), 'partenaire sans logo → son nom, image « Nos partenaires »');
logo = 'https://www.maitreakessemodelmanagement.com/book-photos/site/partenaires/x.png';
ok((await image(await robot('/en/partenaires?partenaire=' + ID))).includes('_vercel/image?url=' + encodeURIComponent(logo)), 'partenaire avec logo → son logo');
ok((await robot('/partenaires')) === undefined && config.matcher.includes('/partenaires'), 'page Partenaires sans ?partenaire → balises de la page');
ok((await robot('/actualites')) === undefined, 'page Actualités sans ?actu → balises de la page (image de la page)');
console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
