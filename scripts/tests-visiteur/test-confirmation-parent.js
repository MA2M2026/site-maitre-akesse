// « Confirmation du parent » (confirmation-parent.html, 24/11/2026, décision de la propriétaire), comme un vrai parent,
// sur téléphone et ordinateur : il ouvre le lien personnel reçu de l'agence, lit ce qu'il confirme ; refusé sans nom
// complet, refusé avec le nom de l'enfant ; il confirme avec son nom ; il change d'avis et refuse ; lien inconnu ; lien
// incomplet. Base SIMULÉE (mêmes réponses que supabase-parent-candidature.sql) : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { lirePageEntiere } = require('./lisibilite');
const PORT = String(9600 + Math.floor(Math.random() * 90));
const BASE = 'http://127.0.0.1:' + PORT + '/confirmation-parent.html?j=';
const JETON = '7d3f1c2a-5b6e-4c8d-9a0b-1c2d3e4f5a6b';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const comparable = (x) => String(x || '').toLowerCase().replace(/^(madame|monsieur|mademoiselle)\s+/, '').split(/\s+/).filter(Boolean).sort().join(' ');

function donnees() {
  const c = { jeton: JETON, candidate: 'Amon Emira', nom: null, confirme_le: null, refuse_le: null };
  const etat = () => (c.refuse_le ? 'refuse' : c.confirme_le ? 'confirme' : 'en_attente');
  return {
    cand: c, tables: {},
    rpc: {
      candidature_parent_lire: (x) => (x.p_jeton === c.jeton ? { candidate: c.candidate, parent_nom: c.nom, etat: etat() } : null),
      candidature_parent_repondre: (x) => {
        if (x.p_jeton !== c.jeton) throw new Error('Lien inconnu ou expiré.');
        if ((x.p_parent_nom || '').trim().length < 3) throw new Error('Écrivez votre nom complet.');
        if (comparable(x.p_parent_nom) === comparable(c.candidate)) throw new Error('Écrivez le nom du parent, pas celui de la candidate.');
        if (x.p_accepte) Object.assign(c, { confirme_le: new Date().toISOString(), refuse_le: null, nom: x.p_parent_nom.trim() });
        else Object.assign(c, { refuse_le: new Date().toISOString(), confirme_le: null, nom: x.p_parent_nom.trim() });
        return x.p_accepte ? 'confirme' : 'refuse';
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
    const reponses = () => journal.filter((j) => j[0] === 'rpc' && j[1] === 'candidature_parent_repondre').length;

    await p.goto(BASE + JETON); await p.waitForSelector('#ap-form:not([hidden])', { timeout: 8000 });
    const t1 = await p.textContent('#ap-texte');
    ok(/Amon Emira a envoyé une candidature/.test(t1) && /mineure/.test(t1) && /parent ou tuteur légal/.test(t1) && await p.isVisible('#ap-accepter') && await p.isVisible('#ap-refuser'),
      n + 'lien ouvert : nom de l’enfant, ce qu’il confirme, boutons « Je confirme » et « Je refuse »');
    await p.fill('#ap-nom', 'Ma'); await p.click('#ap-accepter'); await p.waitForTimeout(400);
    ok(!reponses() && /Votre nom complet/.test(await p.textContent('#ap-etat')), n + 'nom trop court : rien n’est envoyé, on lui demande son nom complet');
    await p.fill('#ap-nom', 'Emira Amon'); await p.click('#ap-accepter'); await p.waitForTimeout(800);
    ok(!d.cand.confirme_le && /pas celui de votre enfant/.test(await p.textContent('#ap-etat')), n + 'nom de l’enfant écrit à la place du parent : refusé, avec une explication claire');
    await p.fill('#ap-nom', '  Madame Awa Amon  '); await p.click('#ap-accepter'); await p.waitForFunction(() => /confirmée/.test(document.getElementById('ap-etat').textContent), null, { timeout: 5000 }).catch(() => {});
    ok(d.cand.confirme_le && d.cand.nom === 'Madame Awa Amon' && /Candidature confirmée\. Par Madame Awa Amon/.test(await p.textContent('#ap-etat')), n + '« Je confirme » : confirmation enregistrée avec son nom');
    await p.reload(); await p.waitForFunction(() => /confirmée/.test(document.getElementById('ap-etat').textContent), null, { timeout: 8000 }).catch(() => {});
    ok(/Candidature confirmée/.test(await p.textContent('#ap-etat')) && /changer d’avis/.test(await p.textContent('#ap-etat')), n + 'retour sur le lien : déjà confirmée, il peut encore changer d’avis');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'textes lisibles ' + pales.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne dépasse de l’écran');
    await p.fill('#ap-nom', 'Madame Awa Amon'); await p.click('#ap-refuser'); await p.waitForFunction(() => /refusée/.test(document.getElementById('ap-etat').textContent), null, { timeout: 5000 }).catch(() => {});
    ok(d.cand.refuse_le && !d.cand.confirme_le && /Candidature refusée/.test(await p.textContent('#ap-etat')), n + '« Je refuse » (après confirmation) : refus enregistré');
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
