// Phase 3 V1 — tous les liens internes du site en ligne (FR + EN), lus comme un visiteur : pages du plan du site
// (/sitemap.xml) puis chaque lien, image, script et feuille de style de même origine trouvé dans ces pages.
// Lecture seule (GET/HEAD), aucun formulaire envoyé. Sortie : une ligne par lien cassé, puis le total.
//   NODE_USE_ENV_PROXY=1 node scripts/visiteur/liens.mjs [--url https://www.maitreakessemodelmanagement.com] [--json sortie.json]
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--url', 'https://www.maitreakessemodelmanagement.com').replace(/\/$/, '');
const SORTIE = arg('--json', null);
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const origine = new URL(BASE).origin;
const vus = new Map();  // adresse → { statut, depuis }
async function lire(u, page) {
  for (let essai = 0; essai < 3; essai++) {
    try {
      const r = await fetch(u, { headers: { 'user-agent': UA, accept: page ? 'text/html' : '*/*' }, redirect: 'follow' });
      return { statut: r.status, texte: page && r.ok ? await r.text() : null, type: r.headers.get('content-type') || '' };
    } catch (e) { if (essai === 2) return { statut: 0, erreur: String(e.message || e) }; await new Promise((x) => setTimeout(x, 800)); }
  }
}
const plan = await (await fetch(BASE + '/sitemap.xml')).text();
const pages = [...new Set([...plan.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, origine)))];
const liens = new Map();
let n = 0;
for (const p of pages) {
  const r = await lire(p, true); n++;
  vus.set(p, { statut: r.statut, depuis: 'plan du site' });
  if (!r.texte) continue;
  const html = r.texte.replace(/<script type="application\/(ld\+)?json"[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<noscript[^>]*>(?![\s\S]*?css-complet)[\s\S]*?<\/noscript>/g, (m) => m);
  // (adresse de base de la page, comme le navigateur : <base href="/"> ou "/en/")
  const baseTag = (html.match(/<base\s+href="([^"]+)"/) || [])[1];
  const racine = baseTag ? new URL(baseTag, p).href : p;
  for (const m of html.matchAll(/\s(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)) {
    if (/^<base/.test(html.slice(m.index + 1, m.index + 6))) continue;
    let u; try { u = new URL(m[1].replace(/&amp;/g, '&'), racine); } catch (e) { continue; }
    if (u.origin !== origine || !/^https?:$/.test(u.protocol)) continue;
    if (/^\/(api|_vercel)\//.test(u.pathname)) continue;
    if (!liens.has(u.href)) liens.set(u.href, p);
  }
}
const aVerifier = [...liens].filter(([u]) => !vus.has(u));
const parLot = 8;
for (let i = 0; i < aVerifier.length; i += parLot) {
  await Promise.all(aVerifier.slice(i, i + parLot).map(async ([u, depuis]) => { const r = await lire(u, false); vus.set(u, { statut: r.statut, depuis, erreur: r.erreur }); }));
}
const casses = [...vus].filter(([, v]) => !(v.statut >= 200 && v.statut < 400));
casses.forEach(([u, v]) => console.log('CASSÉ ' + v.statut + ' ' + u.replace(origine, '') + '  (depuis ' + String(v.depuis).replace(origine, '') + ')' + (v.erreur ? ' ' + v.erreur : '')));
console.log('PAGES ' + n + ' | ADRESSES VÉRIFIÉES ' + vus.size + ' | CASSÉES ' + casses.length);
if (SORTIE) (await import('fs')).writeFileSync(SORTIE, JSON.stringify({ base: BASE, date: new Date().toISOString(), pages: n, adresses: vus.size, casses: casses.map(([u, v]) => ({ u, ...v })) }, null, 1));
process.exit(casses.length ? 1 : 0);
