// Scripts réservés de l'Administration (13/10/2026 ; ancien tableau de bord démoli le 23/10/2026) :
// sans clé d'accès, le serveur (middleware.js) répond « introuvable » pour les scripts réservés
// (écrans partagés et pièces js/admin/site-*.js). Une clé signée valide (posée après la double
// authentification, api/acces-tableau.js) les laisse passer ; une fausse ou périmée, non.
// L'ancienne adresse du tableau de bord renvoie vers /admin/. (Le parcours d'une vraie personne,
// connexion puis chargement des pièces, est essayé dans test-nouvelle-admin.js.)
const fs = require('fs'); const path = require('path'); const os = require('os');
const RACINE = path.resolve(__dirname, '../..');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const ADMIN = '11111111-2222-3333-4444-555555555555';

(async () => {
  const tmp = path.join(os.tmpdir(), 'mw-' + process.pid + '.mjs');
  fs.writeFileSync(tmp, fs.readFileSync(path.join(RACINE, 'middleware.js')));
  const mw = (await import(tmp)).default;
  const req = (chemin, cookie) => new Request('https://admin.maitreakessemodelmanagement.com' + chemin, { headers: cookie ? { cookie } : {} });
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  ok((await mw(req('/js/agenda-admin.js'))) === undefined, 'sans clé serveur configurée : scripts livrés comme avant (jamais enfermée dehors)');
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-de-test-tres-secrete';
  const { cookieAccesTableau, cleAccesTableauValide } = require(path.join(RACINE, 'api/_commun.js'));
  const bonneCle = cookieAccesTableau(ADMIN).split(';')[0];
  let r = await mw(req('/js/agenda-admin.js')); ok(r && r.status === 404 && r.headers.get('cache-control') === 'no-store', 'sans clé : écran partagé réservé introuvable');
  r = await mw(req('/js/admin/site-mannequins.js')); ok(r && r.status === 404, 'sans clé : pièce de l’Administration introuvable');
  r = await mw(req('/js/agenda-admin.js', 'ma2m_admin=v1.' + ADMIN + '.9999999999.faussesignaturefaussesignature')); ok(r && r.status === 404, 'fausse clé : refusée');
  const perimee = 'ma2m_admin=v1.' + ADMIN + '.1000000000.' + bonneCle.split('.').pop();
  r = await mw(req('/js/agenda-admin.js', perimee)); ok(r && r.status === 404, 'clé périmée : refusée');
  ok((await mw(req('/js/agenda-admin.js', 'autre=1; ' + bonneCle))) === undefined && (await mw(req('/js/admin/site-mannequins.js', bonneCle))) === undefined, 'bonne clé : scripts réservés livrés');
  ok((await mw(req('/js/app.js'))) === undefined && (await mw(req('/js/admin/coque.js'))) === undefined && (await mw(req('/js/admin/site.js'))) === undefined, 'scripts publics (décoration, menu) : toujours livrés');
  ok(cleAccesTableauValide({ headers: { cookie: bonneCle } }, ADMIN) && !cleAccesTableauValide({ headers: { cookie: perimee } }, ADMIN), 'côté serveur : une clé valide est reconnue, une périmée non');

  // la liste des scripts protégés est la même partout, et couvre les pièces chargées par l'Administration
  const src = fs.readFileSync(path.join(RACINE, 'middleware.js'), 'utf8');
  const duMatcher = [...src.matchAll(/'\/js\/([\w-]+)\.js'/g)].map(m => m[1]).sort();
  const duRegex = src.match(/const SCRIPTS_ADMIN = \/\^\\\/js\\\/\(([^)]+)\)/)[1].split('|').sort();
  const vercel = JSON.parse(fs.readFileSync(path.join(RACINE, 'vercel.json'), 'utf8'));
  const regleVercel = vercel.headers.map(h => h.source.match(/^\/js\/\(([^)]+)\)\\\.js$/)).filter(Boolean);
  const deVercel = regleVercel.length === 1 ? regleVercel[0][1].split('|').sort() : [];
  const pieces = [...fs.readFileSync(path.join(RACINE, 'js/admin/site.js'), 'utf8').matchAll(/'\/js\/([\w-]+)\.js'/g)].map(m => m[1]);
  const publics = ['publications', 'partenaires-communs', 'couverture-admin'].filter((n) => !duRegex.includes(n));  // aussi utilisés par les pages publiques
  ok(pieces.length > 10 && JSON.stringify(duMatcher) === JSON.stringify(duRegex) && JSON.stringify(deVercel) === JSON.stringify(duRegex)
    && pieces.every(n => duRegex.includes(n) || publics.includes(n)), 'scripts protégés : même liste dans le filtre et vercel.json, et toutes les pièces de l’Administration couvertes (' + duRegex.length + ' ; ' + pieces.filter(n => !duRegex.includes(n) && !publics.includes(n)).join(', ') + ')');
  ok(!/tableau-de-bord|tableau-v2/.test(src.split('export default')[0].split('export const config')[1] || ''), 'filtre : plus aucune trace de l’ancien tableau de bord');
  // l'ancienne adresse du tableau de bord (signets, liens d'avant) mène à l'Administration
  ok(['/tableau-de-bord', '/tableau-de-bord.html'].every(s => vercel.redirects.some(x => x.source === s && !x.has && x.destination === '/admin/')), 'ancienne adresse du tableau de bord → /admin/');
  ok(!fs.existsSync(path.join(RACINE, 'tableau-de-bord.html')), 'ancien tableau de bord retiré du site');
  fs.unlinkSync(tmp);
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})().catch(e => { console.log('❌ ÉCHEC', e.stack); process.exit(1); });
