// Espace mannequin, parcours guidé (12/10/2026) : la mannequin remplit l'étape « identité »
// (mineure : contacts du parent), clique « Enregistrer », puis l'étape « mensurations ». On
// vérifie que tout part vers la base (profil, case Instagram, civilité, parent, épaules…) et
// qu'elle passe bien à l'étape suivante. Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
(async () => {
  const PORT = String(8900 + Math.floor(Math.random() * 90));
  const srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [], journal = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    const b64 = o => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const exp = Math.floor(Date.now() / 1000) + 36000;
    const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', exp }) + '.c2ln';
    localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'x', user: { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'awa@test.ci' } }));
  });
  await brancher(p, { tables: { model_profiles: [{ id: 'admin-1', full_name: 'AWA KONÉ', published: false, desactive: false }] }, rpc: {} }, journal);
  await p.goto('http://127.0.0.1:' + PORT + '/espace-mannequin.html'); await p.waitForTimeout(3500);
  const r = {};
  // Étape 1 : identité d'une mineure de 16 ans
  await p.evaluate(() => { state.meta.currentStep = 1; render(); });
  const naissance = (new Date().getFullYear() - 16) + '-03-10';
  await p.evaluate((naissance) => {
    const mettre = (id, v) => { const el = document.getElementById(id); if (!el) return; if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    mettre('f-dob', naissance);
    if (document.getElementById('f-civilite')) mettre('f-civilite', document.getElementById('f-civilite').options[1].value);
    mettre('f-sans-instagram', true);
    const pc = document.getElementById('f-parent-civilite'); if (pc) mettre('f-parent-civilite', pc.options[1].value);
    mettre('f-parent-nom', 'Mariam Koné'); mettre('f-parent-numero', '0700000000'); mettre('f-parent-email', 'mariam@test.ci');
  }, naissance);
  await p.click('#save1'); await p.waitForTimeout(1500);
  const patch = t => journal.filter(j => j[0] === 'PATCH' && j[1] === t).map(j => JSON.parse(j[3] || '{}'));
  const profils = patch('model_profiles');
  r.instagram = profils.some(x => x.sans_instagram === true);
  r.civilite = profils.some(x => 'civilite' in x);
  r.parent = journal.some(j => j[0] === 'POST' && j[1] === 'contacts_parents' && /Mariam/.test(j[3] || ''));
  r.etape2 = await p.evaluate(() => state.meta.currentStep);
  // Étape 2 : mensurations, dont les épaules (enregistrées à part)
  await p.evaluate(() => { const e = document.getElementById('f-epaules'); if (e) { e.value = '40'; e.dispatchEvent(new Event('input', { bubbles: true })); } });
  await p.click('#save2'); await p.waitForTimeout(1500);
  r.epaules = patch('model_profiles').some(x => x.shoulder_cm === 40);
  r.etape3 = await p.evaluate(() => state.meta.currentStep);
  const ok = r.instagram && r.civilite && r.parent && r.etape2 === 2 && r.epaules && r.etape3 === 3 && !errs.length;
  console.log((ok ? '✓' : '❌ ÉCHEC') + ' Espace mannequin, enregistrement identité (mineure) puis mensurations : ' + JSON.stringify(r) + ' | erreurs : ' + JSON.stringify(errs.slice(0, 3)));
  if (!ok) process.exitCode = 1; await b.close(); srv.kill();
})();
