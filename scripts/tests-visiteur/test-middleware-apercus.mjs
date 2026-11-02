// Aperçus (WhatsApp, Facebook…) : depuis la phase 2 (02/11/2026, « même page pour tous »), un robot d'aperçu reçoit
// EXACTEMENT la page des visiteurs, complète, avec dans son en-tête les balises og:/twitter: de l'élément partagé
// (fiche d'un mannequin, actualité, événement, partenaire). Sans photo, l'image d'aperçu de la page
// (assets/apercus/) ; avec photo, la photo (via /_vercel/image). Base simulée : aucune requête réelle (fetch remplacé).
import { fileURLToPath } from 'url'; import path from 'path'; import fs from 'fs';
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
globalThis.MA2M_SANS_MEMOIRE = true;
const ID = '11111111-1111-1111-1111-111111111111';
let photo = '', logo = '';
globalThis.fetch = async (url) => {
  const u = String(url), json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('supabase.co')) {
    if (u.includes('model_profiles?slug=eq.')) return json([{ id: ID }]);
    if (u.includes('model_profiles?id=eq.')) return json([{ id: ID, full_name: 'Awa Koné', city: 'Abidjan', category: 'femme', height_cm: 178 }]);
    if (u.includes('model_photos?')) return json(photo ? [{ id: 'p1', url: photo, principale: true, created_at: '2026-10-01' }] : []);
    if (u.includes('/actualites?')) return json([{ id: ID, titre: 'Casting', commentaire: 'Texte', image_url: '', created_at: '2026-10-01T10:00:00Z' }]);
    if (u.includes('/partenaires?')) return json([{ id: ID, nom: 'Orange Fashion', description: '<p>Partenaire mode</p>', logo_url: logo, created_at: '2026-10-01T10:00:00Z' }]);
    if (u.includes('/evenements?')) return json([{ id: ID, titre: 'Défilé', description: 'Texte', date_evenement: '2026-10-01', image_url: '', created_at: '2026-10-01T10:00:00Z' }]);
    return json([]);
  }
  // la page elle-même (demandée par le serveur)
  const p = new URL(u).pathname.replace(/^\//, '').replace(/\/$/, '/index') || 'index';
  const f = path.join(racine, p + (p.endsWith('.html') ? '' : '.html'));
  return fs.existsSync(f) ? new Response(fs.readFileSync(f, 'utf8'), { headers: { 'content-type': 'text/html; charset=utf-8' } }) : new Response('introuvable', { status: 404 });
};
const { default: middleware } = await import(path.join(racine, 'middleware.js'));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const demande = (chemin, ua) => middleware(new Request('https://www.maitreakessemodelmanagement.com' + chemin, { headers: { 'user-agent': ua } }));
const robot = (chemin) => demande(chemin, 'WhatsApp/2.23.20.0 A');
const visiteur = (chemin) => demande(chemin, 'Mozilla/5.0 (iPhone) Mobile');
const texte = async (rep) => (rep ? await rep.text() : '');
const image = (html) => (html.match(/property="og:image" content="([^"]*)"/) || [])[1] || '';
const visible = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

for (const chemin of ['/mannequins', '/book/awa-kone', '/actualites?actu=' + ID, '/partenaires?partenaire=' + ID, '/en/evenements?evenement=' + ID]) {
  const [a, b] = [await texte(await robot(chemin)), await texte(await visiteur(chemin))];
  ok(a.length > 1000 && visible(a) === visible(b) && image(a) === image(b), chemin + ' : le robot d’aperçu reçoit exactement la page des visiteurs (complète)');
}
let html = await texte(await robot('/book/awa-kone'));
ok(image(html).endsWith('/assets/apercus/fr-mannequin.jpg?v=2') && /og:title" content="Awa Koné"/.test(html) && /"@type":"ProfilePage"/.test(html), 'fiche sans photo → son nom, image « Profil mannequin », données structurées ProfilePage');
ok(image(await texte(await robot('/en/book/awa-kone'))).endsWith('/assets/apercus/en-mannequin.jpg?v=2'), 'fiche anglaise sans photo → image « Model profile »');
ok(/<link rel="canonical" href="https:\/\/www\.maitreakessemodelmanagement\.com\/book\/awa-kone">/.test(html) && /hreflang="en" href="https:\/\/www\.maitreakessemodelmanagement\.com\/en\/book\/awa-kone"/.test(html), 'fiche : adresse officielle et version anglaise exactes');
photo = 'https://photos.maitreakessemodelmanagement.com/' + ID + '/a.jpg';
ok(image(await texte(await robot('/book/awa-kone'))).includes('_vercel/image?url=' + encodeURIComponent(photo)), 'fiche avec photo → photo du mannequin');
html = await texte(await robot('/actualites?actu=' + ID));
ok(image(html).endsWith('/assets/apercus/fr-actualites.jpg?v=2') && /og:title" content="Casting"/.test(html) && /"@type":"NewsArticle"/.test(html), 'actualité sans photo → son titre, image « Actualités », NewsArticle');
html = await texte(await robot('/en/evenements?evenement=' + ID));
ok(image(html).endsWith('/assets/apercus/en-evenements.jpg?v=2') && /"@type":"Event"/.test(html), 'événement anglais sans photo → image « Our events », Event');
html = await texte(await robot('/partenaires?partenaire=' + ID));
ok(/og:title" content="Orange Fashion"/.test(html) && image(html).endsWith('/assets/apercus/fr-partenaires.jpg?v=2'), 'partenaire sans logo → son nom, image « Nos partenaires »');
logo = 'https://www.maitreakessemodelmanagement.com/book-photos/site/partenaires/x.png';
ok(image(await texte(await robot('/en/partenaires?partenaire=' + ID))).includes('_vercel/image?url=' + encodeURIComponent(logo)), 'partenaire avec logo → son logo');
html = await texte(await robot('/actualites'));
ok(image(html).endsWith('/assets/apercus/fr-actualites.jpg?v=2') && !/og:title" content="Casting"/.test(html), 'page Actualités sans ?actu → balises de la page');
// adresse sans « www » (26/10/2026, hstspreload.org) : renvoi vers www, avec l'en-tête HSTS complet
for (const chemin of ['/', '/en/', '/book/awa-kone?x=1', '/actualites']) {
  const r = await middleware(new Request('https://maitreakessemodelmanagement.com' + chemin, { headers: { 'user-agent': 'Mozilla/5.0' } }));
  ok(r && r.status === 308 && r.headers.get('location') === 'https://www.maitreakessemodelmanagement.com' + chemin
    && /includeSubDomains; preload/.test(r.headers.get('strict-transport-security') || ''), 'sans www ' + chemin + ' → www (308, HSTS complet)');
}
console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
