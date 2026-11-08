// « Accord du parent » (accord-parent.html, 08/11/2026, site vivant ; choix B de la propriétaire), comme un vrai
// parent, sur téléphone et ordinateur : il ouvre son lien personnel, lit à quoi il consent (prénom seulement),
// « J'accepte » refusé sans nom complet, puis accepté avec son nom ; il retire son accord ; lien inconnu ; lien
// incomplet. Base SIMULÉE (mêmes réponses que supabase-site-vivant.sql) : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { lirePageEntiere } = require('./lisibilite');
const PORT = String(9700 + Math.floor(Math.random() * 90));
const BASE = 'http://127.0.0.1:' + PORT + '/accord-parent.html?j=';
const JETON = '0f8fad5b-d9cb-469f-a165-70867728950e';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

function donnees() {
  const a = { jeton: JETON, prenom: 'AMA', parent_nom: null, accepte_le: null, retire_le: null };
  const etat = () => (a.retire_le ? 'retire' : a.accepte_le ? 'accepte' : 'en_attente');
  return {
    accord: a, tables: {},
    rpc: {
      accord_parent_lire: (x) => (x.p_jeton === a.jeton ? { prenom: a.prenom, parent_nom: a.parent_nom, etat: etat() } : null),
      accord_parent_repondre: (x) => {
        if (x.p_jeton !== a.jeton) throw new Error('Lien inconnu ou expiré.');
        if (x.p_accepte) {
          if ((x.p_parent_nom || '').trim().length < 3) throw new Error('Écrivez votre nom complet.');
          Object.assign(a, { accepte_le: new Date().toISOString(), retire_le: null, parent_nom: x.p_parent_nom.trim() }); return 'accepte';
        }
        a.retire_le = new Date().toISOString(); return 'retire';
      }
    }
  };
}

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    p.on('dialog', (dl) => dl.accept());
    const d = donnees(); await brancher(p, d, journal);
    const texte = () => p.evaluate(() => document.querySelector('main').innerText.replace(/\s+/g, ' '));

    // 1. Le parent ouvre son lien : ce qu'il accepte, le prénom seulement
    await p.goto(BASE + JETON); await p.waitForSelector('#ap-form:not([hidden])', { timeout: 8000 });
    const t1 = await texte();
    ok(/photo de AMA sur la page d’accueil/.test(t1) && /retirer à tout moment/.test(t1) && await p.isVisible('#ap-accepter') && !(await p.isVisible('#ap-retirer')), n + 'lien ouvert : ce qu’il accepte (prénom seulement), bouton « J’accepte »');
    // 2. Sans nom complet : rien n'est envoyé
    await p.fill('#ap-nom', 'Ma'); await p.click('#ap-accepter'); await p.waitForTimeout(400);
    ok(!journal.some((j) => j[0] === 'rpc' && j[1] === 'accord_parent_repondre') && /Votre nom complet/.test(await p.textContent('#ap-etat')), n + 'nom trop court : rien n’est envoyé, on lui demande son nom complet');
    // 3. Accepte avec son nom
    await p.fill('#ap-nom', '  Madame Mariam Koné  '); await p.click('#ap-accepter'); await p.waitForSelector('#ap-retirer-bloc:not([hidden])', { timeout: 5000 }).catch(() => {});
    ok(journal.some((j) => j[0] === 'rpc' && j[1] === 'accord_parent_repondre' && /"p_accepte":true/.test(j[2])) && d.accord.parent_nom === 'Madame Mariam Koné' && /Accord donné\. Par Madame Mariam Koné/.test(await p.textContent('#ap-etat')) && await p.isHidden('#ap-form'),
      n + '« J’accepte » : accord enregistré avec son nom, le formulaire disparaît');
    // 4. Il revient plus tard : accord déjà donné, bouton pour le retirer
    await p.reload(); await p.waitForSelector('#ap-retirer-bloc:not([hidden])', { timeout: 8000 }).catch(() => {});
    ok(/Accord donné/.test(await p.textContent('#ap-etat')) && await p.isVisible('#ap-retirer'), n + 'retour sur le lien : accord déjà donné, « Retirer mon accord » proposé');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'textes lisibles ' + pales.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne dépasse de l’écran');
    // 5. Il retire son accord ; il peut de nouveau accepter
    await p.click('#ap-retirer'); await p.waitForSelector('#ap-form:not([hidden])', { timeout: 5000 }).catch(() => {});
    ok(d.accord.retire_le && /Accord retiré\./.test(await p.textContent('#ap-etat')) && /ne paraît plus sur l’accueil/.test(await p.textContent('#ap-etat')) && await p.isVisible('#ap-accepter'), n + 'accord retiré : la photo quitte l’accueil, il peut de nouveau accepter');
    // 6. Lien inconnu, lien incomplet
    await p.goto(BASE + '11111111-2222-3333-4444-555555555555'); await p.waitForFunction(() => !/Chargement/.test(document.getElementById('ap-texte').textContent), null, { timeout: 8000 }).catch(() => {});
    ok(/n’est pas \(ou plus\) valable/.test(await p.textContent('#ap-texte')) && await p.isHidden('#ap-form'), n + 'lien inconnu : « pas (ou plus) valable », pas de formulaire');
    const avant = journal.length;
    await p.goto(BASE + 'abc'); await p.waitForTimeout(800);
    ok(/Lien incomplet/.test(await p.textContent('#ap-texte')) && journal.length === avant && await p.isHidden('#ap-form'), n + 'lien incomplet : message, rien n’est demandé à la base');
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
