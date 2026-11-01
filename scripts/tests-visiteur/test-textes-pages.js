// Étape C (01/11/2026) : textes des pages modifiables depuis l'Administration (Services, Qui sommes-nous, Intégrer
// l'agence, Mentions légales, Confidentialité). Base SIMULÉE, rien n'est écrit. Le serveur (middleware.js) pose le
// texte enregistré à la place du texte d'origine, échappé (du texte seul) ; le point rouge des titres reste ;
// l'anglais sur les pages anglaises ; sans texte enregistré (ou table absente) : la page telle qu'écrite.
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url'), { execFileSync } = require('child_process');
const RACINE = path.resolve(__dirname, '../..');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
let lignes = [], panne = false;
const json = (x, s = 200) => new Response(JSON.stringify(x), { status: s, headers: { 'content-type': 'application/json' } });

(async () => {
  // 0. les repères : les mêmes en français et en anglais (scripts/textes-pages.py)
  let sortie = '';
  try { sortie = execFileSync('python3', [path.join(RACINE, 'scripts/textes-pages.py'), '--verifier'], { encoding: 'utf8' }); ok(true, 'repères des 5 pages : mêmes en français et en anglais'); } catch (e) { ok(false, 'repères des 5 pages ' + (e.stdout || '')); }
  console.log(sortie.trim());
  globalThis.MA2M_SANS_MEMOIRE = true;
  const copie = path.join(RACINE, 'mw-textes-' + process.pid + '.mjs');
  fs.copyFileSync(path.join(RACINE, 'middleware.js'), copie);
  process.on('exit', () => fs.rmSync(copie, { force: true }));
  globalThis.fetch = async (u) => {
    u = String(u);
    if (u.includes('supabase.co')) {
      if (panne) return json({ message: 'relation "textes_pages" does not exist' }, 404);
      if (u.includes('textes_pages')) return json(lignes.filter((l) => u.includes('page=eq.' + l.page)));
      return json([]);
    }
    const page = new URL(u).pathname.replace(/^\//, '') + '.html';
    return new Response(fs.readFileSync(path.join(RACINE, page), 'utf8'), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  const mw = (await import(pathToFileURL(copie).href)).default;
  const demander = async (chemin) => { const r = await mw(new Request('https://www.maitreakessemodelmanagement.com/' + chemin)); return r ? r.text() : null; };
  const visible = (h) => (h || '').replace(/<script[\s\S]*?<\/script>/g, '');

  lignes = [
    { page: 'services', cle: 'services-2', fr: 'Nouveau texte <script>alert(1)</script>\nDeuxième ligne', en: null },
    { page: 'services', cle: 'services-52', fr: 'Un nouveau projet', en: 'A new project' },
    { page: 'mentions-legales', cle: 'mentions-legales-13', fr: 'Dernière mise à jour : 1er novembre 2026', en: 'Last updated: 1 November 2026' }
  ];
  const fr = visible(await demander('services'));
  ok(fr.includes('data-texte="services-2">Nouveau texte &lt;script&gt;alert(1)&lt;/script&gt;<br>Deuxième ligne</p>') && !fr.includes('<script>alert(1)'), 'Services : le texte enregistré remplace l’original, échappé (rien d’injectable), retour à la ligne gardé');
  ok(/<h2><span data-texte="services-52">Un nouveau projet<\/span><span class="oeil">\?<\/span><\/h2>/.test(fr), 'titre : texte changé, le point rouge reste');
  ok(fr.includes('data-texte="services-1">Nos services'), 'les autres textes restent ceux d’origine');
  const en = visible(await demander('en/services'));
  ok(/<span data-texte="services-52">A new project<\/span>/.test(en) && !en.includes('Nouveau texte'), 'page anglaise : l’anglais enregistré ; sans anglais, le texte anglais d’origine');
  ok(visible(await demander('mentions-legales')).includes('>Dernière mise à jour : 1er novembre 2026<'), 'Mentions légales : modifiable aussi');
  const qsn = await demander('qui-sommes-nous');
  ok(qsn === null || !/data-texte="[^"]+">Nouveau texte/.test(qsn), 'Qui sommes-nous : les textes d’une autre page ne s’y mélangent pas');
  lignes = [];
  ok((await demander('integrer-agence')) === null || visible(await demander('integrer-agence')).includes('data-texte="integrer-agence-1">Intégrer l'), 'sans texte enregistré : la page telle qu’écrite');
  panne = true;
  const sansTable = await demander('services');
  ok(sansTable === null || visible(sansTable).includes('data-texte="services-1">Nos services'), 'table pas encore créée (SQL pas collé) : la page telle qu’écrite, jamais cassée');
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
