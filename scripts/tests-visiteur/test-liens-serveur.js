// Site dynamique, étape B (01/11/2026) : les pages d'un lien personnel arrivent DÉJÀ ÉCRITES par le serveur
// (middleware.js) : le reçu d'un cachet (/recu?r=…) et les places limitées (/places?c=…). Base SIMULÉE, rien
// n'est écrit. Jamais gardées en mémoire (données personnelles) ; lien non valable ou base en panne : la page
// part comme avant ; un nom piégé ne peut rien injecter ; dans le navigateur, la page marche comme avant.
const { chromium } = require('playwright'); const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');
const RACINE = path.resolve(__dirname, '../..');
const PORT = String(9620 + Math.floor(Math.random() * 30));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const JR = '11111111-2222-3333-4444-555555555555', JP = 'a'.repeat(36);
const recu = { numero: 'MA2M-CA-2026-0007', beneficiaire: 'Awa <img src=x onerror=alert(1)>', prestation: 'Défilé · Gala', motif: 'defile', paye_le: '2026-10-20T10:00:00Z', montant: 40000, reference_wave: 'T-123' };
const places = { titre: 'Défilé Cacao', nom: 'Awa Koné', civilite: 'Mademoiselle', sexe: 'femme', date_debut: '2026-11-15', heure_evenement: '18:00', lieu: 'Sofitel', ville: 'Abidjan',
  places_femmes: 4, places_hommes: 2, ouvert: true, passe: false, statut: 'invite', pris: [{ sexe: 'femme', initiales: 'MB', photo: null }] };
let panne = false, lectures = 0;
const json = (x) => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } });

async function middleware() {
  const copie = path.join(RACINE, 'mw-liens-' + process.pid + '.mjs');
  fs.copyFileSync(path.join(RACINE, 'middleware.js'), copie);
  globalThis.fetch = async (u) => {
    u = String(u);
    if (u.includes('supabase.co')) {
      lectures++;
      if (panne) throw new Error('base en panne');
      if (u.includes('cachet_recu_lire')) return json([recu]);
      if (u.includes('places_lire')) return json(places);
      return json([]);
    }
    const page = new URL(u).pathname.replace(/^\//, '') + '.html';
    return new Response(fs.readFileSync(path.join(RACINE, page), 'utf8'), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  return (await import(pathToFileURL(copie).href)).default;
}
const visible = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '');

(async () => {
  const mw = await middleware();
  const demander = (chemin, init) => mw(new Request('https://www.maitreakessemodelmanagement.com/' + chemin, init));
  // 1. le serveur seul
  const htmlRecu = await (await demander('recu?r=' + JR)).text();
  const v = visible(htmlRecu);
  ok(/<b id="rc-numero">MA2M-CA-2026-0007<\/b>/.test(v) && /id="rc-etat"[^>]*>Paiement effectué ✓</.test(v) && /<strong id="rc-montant">40 000 FCFA<\/strong>/.test(v) && /id="rc-date">20 octobre 2026</.test(v),
    'reçu : numéro, état, date et montant écrits dans le HTML avant tout programme');
  ok(/id="rc-lignes">/.test(v) && /id="rc-montant-bloc">/.test(v) && /id="rc-ref-ligne">/.test(v) && /id="rc-ref">T-123</.test(v), 'reçu : les blocs du reçu sont visibles (plus cachés)');
  ok(!/<img src=x onerror/.test(htmlRecu) && /Awa &lt;img src=x onerror=alert\(1\)&gt;/.test(v), 'reçu : un nom piégé ne peut rien injecter');
  const htmlPlaces = await (await demander('places?c=' + JP)).text();
  const vp = visible(htmlPlaces);
  ok(/<h1 id="pl-titre">Défilé Cacao<span class="oeil">/.test(vp) && /id="pl-details"[^>]*>Bonjour Mademoiselle Awa Koné · dimanche 15 novembre 2026, 18h00, Sofitel, Abidjan\.</.test(vp),
    'places : titre et phrase d’accueil écrits dans le HTML avant tout programme');
  ok(/<div class="pl-etat " id="pl-etat" role="status" aria-live="polite"><strong>Il reste 3 places pour les femmes\.<\/strong> Premier arrivé, premier servi !<\/div>/.test(vp), 'places : le nombre de places restantes aussi');
  const htmlParent = visible(await (await demander('places?c=' + JP + '&p=1')).text());
  ok(/Bonjour ! Message pour le parent de Awa Koné/.test(htmlParent), 'places : lien du parent : la phrase pour le parent');
  const avant = lectures; await demander('recu?r=' + JR); await demander('recu?r=' + JR);
  ok(lectures - avant === 2, 'jamais gardées en mémoire (données personnelles) : la base est lue à chaque visite');
  ok(await demander('recu?r=abc') === undefined && await demander('places?c=xyz') === undefined, 'lien non valable : la page habituelle (« lien non valable »)');
  panne = true;
  const r = await demander('recu?r=' + JR);
  ok(!r || !/Paiement effectué/.test(await r.text()), 'base en panne : la page part comme avant (elle se remplit elle-même)');
  panne = false;

  // 2. dans le navigateur : la page marche comme avant à partir du HTML du serveur
  let srv; process.on('exit', () => { if (srv) srv.kill(); fs.rmSync(path.join(RACINE, 'mw-liens-' + process.pid + '.mjs'), { force: true }); });
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: RACINE, stdio: 'ignore' }); await new Promise((x) => setTimeout(x, 900));
  const b = await chromium.launch();
  for (const [chemin, html, verif] of [['recu?r=' + JR, htmlRecu, '#rc-montant'], ['places?c=' + JP, htmlPlaces, '#pl-grilles li']]) {
    const p = await b.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.route(/supabase\.co/, (x) => x.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(/recu/.test(x.request().url()) ? [recu] : places) }));
    await p.route(new RegExp('/' + chemin.split('?')[0] + '\\?'), (x) => x.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
    await p.goto('http://127.0.0.1:' + PORT + '/' + chemin); await p.waitForTimeout(1500);
    ok(await p.isVisible(verif) && !(await p.$('img[src="x"]')) && !errs.length, chemin.split('?')[0] + ' dans le navigateur : la page marche comme avant, rien d’injecté ' + errs.join(' | '));
    await p.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
