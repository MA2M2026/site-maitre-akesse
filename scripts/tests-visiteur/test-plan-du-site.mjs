// Plan du site pour Google (07/11/2026, W10 ; planDuSite, middleware.js) : les pages fixes du fichier sitemap.xml,
// plus chaque fiche publiée (/book/nom, FR et EN), chaque actualité et chaque événement ; un nom bizarre n'est jamais
// écrit ; base en panne → le fichier fixe seul. Base simulée : aucune requête réelle (fetch remplacé).
import { fileURLToPath } from 'url'; import path from 'path'; import fs from 'fs';
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
globalThis.MA2M_SANS_MEMOIRE = true;
const ID = '11111111-1111-1111-1111-111111111111';
let panne = false;
globalThis.fetch = async (url) => {
  const u = String(url), json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('supabase.co')) {
    if (panne) throw new Error('base en panne');
    if (u.includes('model_profiles?')) return json([{ slug: 'awa-kone', created_at: '2026-10-01T10:00:00Z' }, { slug: 'x"><script>', created_at: null }]);
    if (u.includes('/actualites?')) return json([{ id: ID, created_at: '2026-10-02T10:00:00Z' }]);
    if (u.includes('/evenements?')) return json([{ id: ID, date_evenement: '2026-12-05' }]);
    return json([]);
  }
  if (new URL(u).pathname === '/sitemap.xml') return new Response(fs.readFileSync(path.join(racine, 'sitemap.xml'), 'utf8'), { headers: { 'content-type': 'application/xml' } });
  return new Response('introuvable', { status: 404 });
};
const { default: middleware } = await import(path.join(racine, 'middleware.js'));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const plan = () => middleware(new Request('https://www.maitreakessemodelmanagement.com/sitemap.xml', { headers: { 'user-agent': 'Googlebot/2.1' } }));
let rep = await plan(), xml = await rep.text();
const fixes = (fs.readFileSync(path.join(racine, 'sitemap.xml'), 'utf8').match(/<url>/g) || []).length;
ok(/application\/xml/.test(rep.headers.get('content-type')) && /s-maxage=3600/.test(rep.headers.get('cache-control')), 'plan du site : du XML, mis en cache une heure');
ok((xml.match(/<url>/g) || []).length === fixes + 6, 'les ' + fixes + ' pages fixes + la fiche (FR, EN), l’actualité (FR, EN) et l’événement (FR, EN)');
ok(xml.includes('<loc>https://www.maitreakessemodelmanagement.com/book/awa-kone</loc>') && xml.includes('/en/book/awa-kone</loc>') && xml.includes('<lastmod>2026-10-01</lastmod>'), 'chaque fiche publiée : /book/nom et /en/book/nom, avec sa date');
ok(xml.includes('/actualites?actu=' + ID + '</loc>') && xml.includes('/evenements?evenement=' + ID + '</loc>'), 'chaque actualité et chaque événement');
ok(!xml.includes('<script') && !xml.includes('x&quot;'), 'un nom bizarre n’est jamais écrit dans le plan');
panne = true;
xml = await (await plan()).text();
ok((xml.match(/<url>/g) || []).length === fixes, 'base en panne : le plan fixe seul, comme avant');
console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
process.exit(ko ? 1 : 0);
