// Audit R-09 (16/11/2026) : une demande de booking (page Sélection) n'arrive JAMAIS à l'agence sans la liste des
// mannequins choisis, et le recruteur ne voit « Merci » que si tout est bien arrivé.
//  1. serveur (api/portail.js, base et Cloudflare simulés) : demande + liste enregistrées ensemble ; liste refusée →
//     demande retirée et erreur ; sélection vide ou fabriquée → refus ; envoi recommencé → liste jamais en double ;
//  2. navigateur (FR téléphone, EN ordinateur) : la liste part avec la demande ; en cas d'échec, un message vrai et la
//     sélection gardée. Rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const chemin = require('path');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const M1 = '11111111-1111-4111-8111-111111111111', M2 = '22222222-2222-4222-8222-222222222222';

async function serveur() {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-essai'; process.env.TURNSTILE_SECRET_KEY = 'secret-essai';
  const appels = []; let listeRefusee = false, doublon = false, listeDejaLa = false;
  global.fetch = async (url, o = {}) => {
    const u = String(url), m = o.method || 'GET';
    const json = (x, s = 200) => ({ ok: s < 300, status: s, json: async () => x, text: async () => JSON.stringify(x) });
    appels.push([m, u, o.body ? JSON.parse(o.body) : null]);
    if (u.includes('siteverify')) return json({ success: true });
    if (u.includes('/rpc/formulaire_public_enregistrer')) return doublon ? json({ message: 'duplicate key value violates unique constraint' }, 409) : json('d1');
    if (u.includes('/rest/v1/recruiter_request_models') && m === 'GET') return json(listeDejaLa ? [{ request_id: 'x' }] : []);
    if (u.includes('/rest/v1/recruiter_request_models') && m === 'POST') return listeRefusee ? json({ message: 'refus' }, 500) : json({}, 201);
    if (u.includes('/rest/v1/recruiter_requests') && m === 'DELETE') return json({}, 204);
    return json({}, 201);
  };
  const portail = require('../../api/portail.js');
  const appeler = async (ligne) => {
    let statut = 0, rep = null; appels.length = 0;
    const res = { status(s) { statut = s; return this; }, json(c) { rep = c; return this; }, setHeader() {} };
    await portail({ method: 'POST', headers: { 'x-forwarded-for': '41.2.3.4' }, body: { action: 'formulaire', table: 'recruiter_requests', ligne, jeton: 'jeton' } }, res);
    return { statut, rep };
  };
  const demande = (modeles) => ({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', company: 'Marque', contact_name: 'Awa', email: 'awa@marque.ci', _modeles: modeles });
  const liste = [{ model_id: M1, model_name_snapshot: 'Awa Koné', model_height_snapshot: 178 }, { model_id: M2, model_name_snapshot: 'Fatou', model_height_snapshot: null }];
  let r = await appeler(demande(liste));
  const postListe = appels.find((a) => a[0] === 'POST' && a[1].includes('recruiter_request_models'));
  const rpc = appels.find((a) => a[1].includes('formulaire_public_enregistrer'));
  ok(r.statut === 200 && postListe && postListe[2].length === 2 && postListe[2].every((l) => l.request_id === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'serveur : demande et liste des 2 mannequins enregistrées ensemble');
  ok(rpc && !('_modeles' in rpc[2].p_ligne), 'serveur : la liste n’est pas glissée dans la demande elle-même');
  listeRefusee = true; r = await appeler(demande(liste)); listeRefusee = false;
  ok(r.statut === 500 && appels.some((a) => a[0] === 'DELETE' && a[1].includes('/rest/v1/recruiter_requests?id=eq.aaaaaaaa')), 'serveur : liste refusée → demande retirée, erreur au recruteur (pas de « Merci »)');
  r = await appeler(demande([]));
  ok(r.statut === 400 && !appels.some((a) => a[1].includes('formulaire_public_enregistrer')), 'serveur : sélection vide → refusée, rien d’enregistré');
  r = await appeler(Object.assign(demande(liste), { _modeles: undefined }));
  ok(r.statut === 400, 'serveur : demande sans liste → refusée');
  r = await appeler(demande([{ model_id: 'pas-un-identifiant' }]));
  ok(r.statut === 400, 'serveur : mannequin fabriqué (identifiant invalide) → refusé');
  r = await appeler(demande(Array.from({ length: 61 }, () => ({ model_id: M1 }))));
  ok(r.statut === 400, 'serveur : plus de 60 mannequins → refusé');
  doublon = true; listeDejaLa = true; r = await appeler(demande(liste));
  ok(r.statut === 200 && !appels.some((a) => a[0] === 'POST' && a[1].includes('recruiter_request_models')) && !appels.some((a) => a[0] === 'DELETE'), 'serveur : envoi recommencé (réponse perdue), liste déjà là → rien en double, rien retiré');
  listeDejaLa = false; r = await appeler(demande(liste));
  ok(r.statut === 200 && appels.some((a) => a[0] === 'POST' && a[1].includes('recruiter_request_models')), 'serveur : envoi recommencé, liste absente → liste ajoutée');
  listeRefusee = true; r = await appeler(demande(liste)); listeRefusee = false; doublon = false;
  ok(r.statut === 500 && !appels.some((a) => a[0] === 'DELETE'), 'serveur : envoi recommencé dont la liste échoue → erreur, mais une demande déjà reçue n’est jamais retirée');
}

async function navigateur() {
  const PORT = String(9600 + Math.floor(Math.random() * 60));
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [page, ecran, echec] of [['selection.html', { width: 390, height: 844 }, false], ['en/selection.html', { width: 1280, height: 900 }, false], ['selection.html', { width: 390, height: 844 }, true], ['en/selection.html', { width: 1280, height: 900 }, true]]) {
    const n = page + ' ' + ecran.width + 'px' + (echec ? ' (envoi refusé)' : '') + ' : ';
    const ctx = await b.newContext({ viewport: ecran }); const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(([a, c]) => { try { localStorage.setItem('ma2m_cookies', 'non'); localStorage.setItem('ma2m_selection', JSON.stringify([{ id: a, full_name: 'Awa Koné', height_cm: 178, photoUrl: '' }, { id: c, full_name: 'Fatou Bamba', height_cm: 180, photoUrl: '' }])); } catch (e) { /* */ } }, [M1, M2]);
    await brancher(p, { tables: {}, rpc: {}, formulaire: echec ? () => ({ statut: 500, error: 'Envoi impossible pour le moment, réessayez.', selection: true }) : null }, journal);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1500);
    await p.selectOption('#re-civilite', page.startsWith('en') ? 'Monsieur' : 'Madame'); await p.fill('#re-nom', 'Awa Diallo'); await p.fill('#re-email', 'awa@marque.ci');
    if (await p.$('#re-consentement')) await p.check('#re-consentement');
    await p.click('#btn-envoyer-recruteur'); await p.waitForTimeout(3000);
    const texte = await p.textContent('body');
    const demandes = journal.filter((j) => j[0] === 'POST' && j[1] === 'recruiter_requests').map((j) => JSON.parse(j[3]));
    const listes = journal.filter((j) => j[0] === 'POST' && j[1] === 'recruiter_request_models').map((j) => JSON.parse(j[3]));
    const directes = journal.filter((j) => j[0] === 'POST' && j[1] === 'recruiter_request_models' && j[2] !== '');
    if (!echec) {
      ok(demandes.length === 1 && listes.length === 1 && listes[0].length === 2 && listes[0].every((l) => l.request_id === demandes[0].id), n + 'la liste des 2 mannequins part avec la demande');
      ok(/Merci|Thank You/.test(texte), n + '« Merci » affiché seulement après l’envoi complet');
    } else {
      ok(!/Merci !|Thank You!/.test(texte) && /n'a pas été envoyée|was not sent/.test(texte), n + 'message vrai : la demande n’a pas été envoyée');
      ok(await p.evaluate(() => (JSON.parse(localStorage.getItem('ma2m_selection') || '[]')).length === 2), n + 'la sélection est gardée pour réessayer');
    }
    ok(!directes.length, n + 'plus aucune écriture directe de la liste depuis la page');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
}

(async () => {
  await serveur();
  await navigateur();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\n✅ Demande de booking : jamais sans sa liste (R-09)');
  process.exit(ko ? 1 : 0);
})();
