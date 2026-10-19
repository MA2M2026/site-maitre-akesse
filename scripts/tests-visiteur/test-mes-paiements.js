// « Mes paiements » (mes-paiements.html, mannequin connectée) et page de paiement à lien personnel
// (paiement/?t=…, sans compte), cahier v2.3 sections 7.2, 7.6 et 15 : comme une vraie personne, sur
// téléphone et ordinateur, base SIMULÉE. Vérifie le bandeau (rouge si non payé), le bouton Payer qui
// ouvre le bon lien Wave, « J'ai payé » grisé avant Wave puis envoyé à la base, l'historique et les
// reçus, le lien expiré, la lisibilité.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { lirePageEntiere } = require('./lisibilite');
const PORT = String(9100 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JETON = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'u-awa', role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 }) + '.c2ln';
const SESSION = { access_token: JETON, refresh_token: 'faux', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user: { id: 'u-awa', email: 'awa@test.ci', aud: 'authenticated', role: 'authenticated' } };
const MESPAIEMENTS = {
  inscrit: true, prenom: 'Awa', nom: 'Awa Koné', statut: 'actif', mineur: false, jour_limite: 5, telephone: '0700000001',
  echeances: [
    { id: 'd2', type: 'mensualite', mois: '2026-10-01', montant_du: 10000, montant_paye: 0, date_limite: '2026-10-05', statut: 'non_paye', lien_wave: 'https://pay.wave.com/m/essai-10000', recus: null },
    { id: 'd1', type: 'inscription', mois: '2026-09-01', montant_du: 25000, montant_paye: 25000, date_limite: '2026-09-08', statut: 'payee', lien_wave: null,
      recus: [{ numero: 'REC-2026-00007', emis_le: '2026-09-03T10:00:00Z', montant: 25000, mode: 'wave', paye_par: null }] }],
  formation: { debut: '2026-09-01', duree: 24, mois: Array.from({ length: 24 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8 + i, 1)).toISOString().slice(0, 10);
    return { mois: d, statut: i === 0 ? 'payee' : i === 1 ? 'non_paye' : i === 2 ? 'payee' : 'a_venir', mode: i === 0 ? 'wave' : i === 2 ? 'especes' : null };
  }) },
  notifications: [{ texte: 'Bonjour Awa, rappel : le paiement d’octobre 2026 (10 000 FCFA) n’est pas encore reçu.', le: '2026-10-03T06:00:00Z' }]
};

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    // 1. Mannequin connectée
    {
      const ctx = await b.newContext({ viewport: ecran }); const p = await ctx.newPage(); const errs = [], journal = [], ouverts = [];
      p.on('pageerror', (e) => errs.push(e.message)); ctx.on('page', (x) => ouverts.push(x));
      await p.addInitScript((s) => { localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify(s)); }, SESSION);
      await brancher(p, { tables: {}, rpc: { mannequin_mes_paiements: () => MESPAIEMENTS, mannequin_declarer_paiement: null } }, journal);
      await p.goto('http://127.0.0.1:' + PORT + '/mes-paiements.html'); await p.waitForSelector('.mp-bandeau', { timeout: 8000 });
      const t = () => p.evaluate(() => document.getElementById('mp-zone').innerText);
      ok((await t()).includes('n’est pas encore fait') && await p.$('.mp-bandeau.rouge'), nomEcran + ' : bandeau rouge « paiement pas encore fait » après le 5');
      ok(await p.isDisabled('[data-mp=paye]'), nomEcran + ' : « J’ai payé » grisé avant d’ouvrir Wave');
      ok((await p.getAttribute('[data-mp=wave]', 'href')) === 'https://pay.wave.com/m/essai-10000', nomEcran + ' : le bouton Payer porte le lien Wave du bon montant');
      ok((await t()).includes('REC-2026-00007') && (await t()).includes('rappel'), nomEcran + ' : historique, reçu et notifications affichés');
      ok((await p.$$('.mp-calendrier .mp-mois')).length === 24 && (await t()).includes('2 mois réglés sur 24'), nomEcran + ' : calendrier des 24 mois de formation');
      ok(/Payé · Wave/.test(await t()) && /Payé · espèces/.test(await t()), nomEcran + ' : le calendrier dit comment chaque mois a été payé (Wave, espèces)');
      const mal = (await lirePageEntiere(p)).map((x) => x.texte.slice(0, 25) + ' (' + x.contraste + ')');
      ok(!mal.length, nomEcran + ' : textes lisibles ' + mal.join(' | '));
      await p.click('[data-mp=wave]'); await p.waitForTimeout(500);
      ok(ouverts.length === 1 && !(await p.isDisabled('[data-mp=paye]')), nomEcran + ' : Wave ouvert, « J’ai payé » disponible');
      await p.click('[data-mp=paye]'); await p.waitForTimeout(800);
      const appel = journal.find((j) => j[0] === 'rpc' && j[1] === 'mannequin_declarer_paiement');
      ok(appel && /"p_echeance":"d2"/.test(appel[2]) && /"p_numero":"0700000001"/.test(appel[2]), nomEcran + ' : déclaration envoyée à la base (échéance, numéro payeur)');
      ok((await t()).includes('L’agence vérifie votre paiement'), nomEcran + ' : message de confirmation');
      ok(!errs.length, nomEcran + ' : aucune erreur de page ' + errs.join(' | '));
      await ctx.close();
    }
    // 2. Lien personnel sans compte
    {
      const ctx = await b.newContext({ viewport: ecran }); const p = await ctx.newPage(); const errs = [], appels = [];
      p.on('pageerror', (e) => errs.push(e.message));
      await brancher(p, { tables: {}, api: { '/api/portail': (c) => { appels.push(c); return c.t === 'jeton-valable-essai-123456' ? (c.action === 'lien_lire' ? { ok: true, prenom: 'Yao', mois: '2026-10-01', type: 'mensualite', montant: 20000, statut: 'a_payer', lien_wave: 'https://pay.wave.com/m/essai-20000', numero: '0700000002' } : { ok: true }) : { ok: false }; } } }, []);
      await p.goto('http://127.0.0.1:' + PORT + '/paiement/?t=jeton-valable-essai-123456'); await p.waitForSelector('[data-mp=wave]', { timeout: 8000 });
      const t = () => p.evaluate(() => document.getElementById('mp-zone').innerText);
      ok((await t()).includes('20 000 FCFA') && (await t()).includes('sans compte'), nomEcran + ' : lien personnel → montant et mention « sans compte »');
      const liens = await p.$$eval('header a, footer a', (l) => l.map((a) => a.getAttribute('href')).filter(Boolean));
      ok(liens.length > 0 && await p.evaluate(() => [...document.querySelectorAll('header a, footer a')].every((a) => !a.href.includes('/paiement/') || a.href.includes('?'))), nomEcran + ' : liens du haut et du bas corrects depuis le dossier paiement/');
      await p.click('[data-mp=wave]'); await p.waitForTimeout(400); await p.click('[data-mp=paye]'); await p.waitForTimeout(800);
      ok(appels.some((a) => a.action === 'lien_declarer' && a.numero === '0700000002'), nomEcran + ' : « J’ai payé » envoyé avec le numéro payeur');
      await p.goto('http://127.0.0.1:' + PORT + '/paiement/?t=jeton-expire-essai-0000000'); await p.waitForSelector('.mp-carte h1');
      ok(/lien expiré ou invalide/i.test(await t()), nomEcran + ' : lien expiré refusé');
      ok(!errs.length, nomEcran + ' : aucune erreur de page (lien) ' + errs.join(' | '));
      await ctx.close();
    }
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
