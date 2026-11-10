// Mot de passe provisoire d'une mannequin (10/11/2026, demande de la propriétaire) : connectée avec un mot de passe
// donné par l'agence (marqué mdp_provisoire, api/portail.js), la mannequin doit d'abord choisir le sien. Base SIMULÉE,
// comme une vraie personne, sur téléphone :
//  - Espace mannequin : seul l'écran « Choisissez votre mot de passe » s'affiche (pas le profil) ;
//  - trop court, ou le provisoire recopié : refusé avec un message ;
//  - un vrai mot de passe : enregistré, la marque « provisoire » est retirée, puis le profil s'ouvre ;
//  - l'accueil de l'application et « Mes paiements » renvoient vers ce choix tant qu'il n'est pas fait.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path');
const PORT = String(9900 + Math.floor(Math.random() * 30));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const ouvrir = async (adresse, provisoire, envois) => {
    const q = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage(); const errs = [], journal = [];
    q.on('pageerror', (e) => errs.push(e.message));
    await q.addInitScript((prov) => {
      const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
      const exp = Math.floor(Date.now() / 1000) + 36000;
      const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', exp }) + '.c2ln';
      localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'x',
        user: { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'awa@test.ci', user_metadata: { mdp_provisoire: prov } } }));
    }, provisoire);
    await brancher(q, { tables: { model_profiles: [{ id: 'admin-1', full_name: 'AWA KONÉ', published: false, desactive: false }], model_photos: [] }, rpc: {} }, journal);
    // compte de connexion imité : la marque « provisoire » tant que le nouveau mot de passe n'est pas enregistré
    const meta = { mdp_provisoire: provisoire };
    await q.route(/\/auth\/v1\/user/, async (route) => {
      const req = route.request();
      if (req.method() === 'PUT') { const c = JSON.parse(req.postData() || '{}'); envois.push(c); Object.assign(meta, (c && c.data) || {}); }
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'awa@test.ci', user_metadata: meta }) });
    });
    await q.goto('http://127.0.0.1:' + PORT + adresse); await q.waitForTimeout(2500);
    return { q, errs };
  };

  // 1) Espace mannequin
  const envois = [];
  let { q, errs } = await ouvrir('/app/espace-mannequin.html', true, envois);
  const titre = await q.textContent('#auth-panneau-nouveau-mdp h2').catch(() => '');
  ok(await q.isVisible('#auth-panneau-nouveau-mdp') && /Choisissez votre mot de passe/.test(titre) && !(await q.$('.stepper')), 'connectée avec le provisoire : seul « Choisissez votre mot de passe » s’affiche, pas le profil');
  ok(!(await q.isVisible('#auth-panneau-connexion')) && !(await q.isVisible('#auth-panneau-inscription')), 'ni connexion ni inscription proposées à côté');
  await q.fill('#au-nm-mdp', 'court'); await q.click('#au-nm-valider'); await q.waitForTimeout(300);
  ok(/8 caractères/.test(await q.textContent('#au-nm-msg')) && !envois.length, 'mot de passe trop court : refusé, rien n’est envoyé');
  await q.fill('#au-nm-mdp', 'MA2M-2345-ABC'); await q.click('#au-nm-valider'); await q.waitForTimeout(300);
  ok(/différent du mot de passe provisoire/.test(await q.textContent('#au-nm-msg')) && !envois.length, 'le provisoire recopié : refusé');
  await q.fill('#au-nm-mdp', 'MonSecret2026!'); await q.click('#au-nm-valider');
  await q.waitForSelector('.stepper', { timeout: 10000 }).catch(() => {});
  ok(envois.length === 1 && envois[0].password === 'MonSecret2026!' && envois[0].data && envois[0].data.mdp_provisoire === false, 'nouveau mot de passe enregistré, marque « provisoire » retirée');
  ok(await q.isVisible('.stepper'), 'ensuite, le profil s’ouvre normalement');
  ok(!errs.length, 'aucune erreur dans la page ' + errs.join(' | '));
  await q.context().close();

  // 2) accueil de l'application et Mes paiements : renvoi vers le choix du mot de passe
  for (const adresse of ['/app/', '/app/mes-paiements.html']) {
    ({ q, errs } = await ouvrir(adresse, true, []));
    await q.waitForURL(/espace-mannequin/, { timeout: 8000 }).catch(() => {});
    await q.waitForTimeout(1500);
    ok(/espace-mannequin/.test(q.url()) && await q.isVisible('#auth-panneau-nouveau-mdp'), adresse + ' : renvoi vers « Choisissez votre mot de passe »');
    await q.context().close();
  }
  // 3) sans mot de passe provisoire : rien ne change
  ({ q, errs } = await ouvrir('/app/espace-mannequin.html', false, []));
  await q.waitForSelector('.stepper', { timeout: 10000 }).catch(() => {});
  ok(await q.isVisible('.stepper') && !(await q.isVisible('#auth-panneau-nouveau-mdp')), 'mot de passe normal : le profil s’ouvre directement, comme avant');
  await q.context().close();
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.');
  process.exit(ko ? 1 : 0);
})();
