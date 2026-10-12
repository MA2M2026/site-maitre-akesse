// Espace mannequin : les projets réalisés avec l'agence (agenda) s'ajoutent tout seuls à ses
// expériences ; une ligne qu'elle a écrite pour le même projet est signalée et n'apparaît
// qu'une fois sur le CV (12/10/2026). Base simulée, rien n'est écrit.
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
  await brancher(p, { tables: { model_profiles: [{ id: 'admin-1', full_name: 'AWA KONÉ', published: true, desactive: false, slug: 'awa-kone' }],
    model_projects: [{ id: 'x1', model_id: 'admin-1', type_projet: 'Défilé', titre: 'Cacao fashion show', ville: 'Abidjan', periode: '2026' }, { id: 'x2', model_id: 'admin-1', type_projet: 'Shooting', titre: 'Shooting perso', periode: '2025' },
    // cas réel du 12/10/2026 : nom de l'agence précédé d'un autre mot, date complète
    { id: 'x3', model_id: 'admin-1', type_projet: 'Défilé', titre: 'JNCC/ cacao fashion show', ville: 'Abidjan', periode: '2026-09-03' }] },
    rpc: { parcours_public: [{ id: 'e1', type: 'defile', titre: 'CACAO FASHION SHOW', date_debut: '2026-09-02', date_fin: '2026-09-03', lieu: 'Sofitel', ville: 'Abidjan', pays: "Côte d'Ivoire", mannequins: [] }] } }, journal);
  await p.goto('http://127.0.0.1:' + PORT + '/espace-mannequin.html'); await p.waitForTimeout(4000);
  const r = await p.evaluate(() => ({ agence: (state.experiencesAgence || []).map(e => e.nom + '|' + e.annee), etape: stepExperience().includes('Ajoutés automatiquement par l’agence'), doublon: (stepExperience().match(/exp-doublon/g) || []).length,
    cv: donneesCvDepuisEtat().experiences.map(e => e.nom),
    // formulaire enrichi (12/10/2026) : date, pays, ville, lieu, promoteur — tout facultatif
    champs: ['nom', 'annee', 'pays', 'lieu', 'salle', 'promoteur'].every(c => stepExperience().includes('data-expf="' + c + '"')),
    facultatif: stepExperience().includes('aucune case n’est obligatoire') }));
  // enregistrement d'une expérience complétée : les nouvelles cases partent bien vers la base
  await p.evaluate(() => Store.updateExperience('x2', { type: 'Shooting', nom: 'Shooting perso', lieu: 'Abidjan', annee: '03/09/2025', pays: "Côte d'Ivoire", salle: 'Studio Lumière', promoteur: 'Styliste Awa' }));
  await p.waitForTimeout(500);
  const envoi = journal.filter(j => j[0] === 'PATCH' && j[1] === 'model_projects').map(j => JSON.parse(j[3])).pop() || {};
  r.envoi = [envoi.lieu, envoi.pays, envoi.promoteur, envoi.periode].join(' | ');
  const ok = r.champs && r.facultatif && r.envoi === "Studio Lumière | Côte d'Ivoire | Styliste Awa | 03/09/2025" && r.agence.length === 1 && r.etape && r.doublon === 2 && JSON.stringify(r.cv) === '["CACAO FASHION SHOW","Shooting perso"]' && !errs.length;
  console.log((ok ? '✓' : '❌ ÉCHEC') + ' Espace mannequin, expériences de l’agence : ' + JSON.stringify(r) + ' | erreurs : ' + JSON.stringify(errs.slice(0, 3)));
  if (!ok) process.exitCode = 1; await b.close(); srv.kill();
})();
