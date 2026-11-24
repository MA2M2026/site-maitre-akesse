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
// (même normalisation que nom_comparable dans la base : sans civilité, sans accents, sans ponctuation, mots rangés)
const comparable = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^\s*(madame|mademoiselle|monsieur|mme|mlle|mr|m)\.?\s+/, '')
  .replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).sort((a, b) => a.localeCompare(b)).join(' ');

function donnees() {
  const c = { jeton: JETON, candidate: 'Amon Emira', nom: null, confirme_le: null, refuse_le: null };
  const etat = () => (c.refuse_le ? 'refuse' : c.confirme_le ? 'confirme' : 'en_attente');
  return {
    cand: c, tables: {},
    rpc: {
      candidature_parent_lire: (x) => (x.p_jeton === c.jeton ? { candidate: c.candidate.split(' ')[0], parent_nom: c.nom, etat: etat() } : null),
      candidature_parent_repondre: (x) => {
        if (x.p_jeton !== c.jeton) throw new Error('Lien inconnu ou expiré.');
        if (c.confirme_le || c.refuse_le) throw new Error('REPONSE_DEJA_DONNEE');
        if ((x.p_parent_nom || '').trim().length < 3) throw new Error('Écrivez votre nom complet.');
        const mots = comparable(x.p_parent_nom).split(' '), enfant = comparable(c.candidate).split(' ');
        if (mots.length < 2) throw new Error('Écrivez votre nom complet (prénom et nom).');
        if (mots.join(' ') === enfant.join(' ')) throw new Error('Écrivez le nom du parent, pas celui de la candidate.');
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
    ok(/^Amon a envoyé une candidature/.test(t1) && !/Emira/.test(t1) && /définitive/.test(t1) && /mineure/.test(t1) && /parent ou tuteur légal/.test(t1) && await p.isVisible('#ap-accepter') && await p.isVisible('#ap-refuser'),
      n + 'lien ouvert : premier mot du nom de l’enfant seulement, ce qu’il confirme (réponse définitive), boutons « Je confirme » et « Je refuse »');
    await p.fill('#ap-nom', 'Ma'); await p.click('#ap-accepter'); await p.waitForTimeout(400);
    ok(!reponses() && /Votre nom complet/.test(await p.textContent('#ap-etat')), n + 'nom trop court : rien n’est envoyé, on lui demande son nom complet');
    await p.fill('#ap-nom', 'Madame Amon'); await p.click('#ap-accepter'); await p.waitForTimeout(800);
    ok(!d.cand.confirme_le && /prénom et votre nom/.test(await p.textContent('#ap-etat')), n + 'nom en un seul mot : refusé, on lui demande son prénom et son nom');
    await p.fill('#ap-nom', 'Emira'); await p.fill('#ap-nom', 'Emira Amon'); await p.click('#ap-accepter'); await p.waitForTimeout(800);
    ok(!d.cand.confirme_le && /pas celui de votre enfant/.test(await p.textContent('#ap-etat')), n + 'nom de l’enfant écrit à la place du parent : refusé, avec une explication claire');
    await p.fill('#ap-nom', '  Madame Awa Amon  '); await p.click('#ap-accepter'); await p.waitForFunction(() => /confirmée/.test(document.getElementById('ap-etat').textContent), null, { timeout: 5000 }).catch(() => {});
    ok(d.cand.confirme_le && d.cand.nom === 'Madame Awa Amon' && /Candidature confirmée\. Par Madame Awa Amon/.test(await p.textContent('#ap-etat')), n + '« Je confirme » : confirmation enregistrée avec son nom');
    await p.reload(); await p.waitForFunction(() => /confirmée/.test(document.getElementById('ap-etat').textContent), null, { timeout: 8000 }).catch(() => {});
    ok(/Candidature confirmée/.test(await p.textContent('#ap-etat')) && /contactez l’agence/.test(await p.textContent('#ap-etat')) && await p.isHidden('#ap-form'),
      n + 'retour sur le lien : déjà confirmée, plus de formulaire (réponse définitive : contacter l’agence pour la changer)');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'textes lisibles ' + pales.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne dépasse de l’écran');
    // Un autre parent refuse ; un second onglet resté ouvert ne peut plus changer la réponse
    Object.assign(d.cand, { confirme_le: null, refuse_le: null, nom: null });
    await p.goto(BASE + JETON); await p.waitForSelector('#ap-form:not([hidden])', { timeout: 8000 });
    const p2 = await ctx.newPage(); await brancher(p2, d, journal); await p2.goto(BASE + JETON); await p2.waitForSelector('#ap-form:not([hidden])', { timeout: 8000 });
    await p.fill('#ap-nom', 'Madame Awa Amon'); await p.click('#ap-refuser'); await p.waitForFunction(() => /refusée/.test(document.getElementById('ap-etat').textContent), null, { timeout: 5000 }).catch(() => {});
    ok(d.cand.refuse_le && !d.cand.confirme_le && /Candidature refusée/.test(await p.textContent('#ap-etat')) && await p.isHidden('#ap-form'), n + '« Je refuse » : refus enregistré, plus de formulaire');
    await p2.fill('#ap-nom', 'Autre Adulte'); await p2.click('#ap-accepter'); await p2.waitForFunction(() => /refusée/.test(document.getElementById('ap-etat').textContent), null, { timeout: 5000 }).catch(() => {});
    ok(d.cand.refuse_le && !d.cand.confirme_le && /Candidature refusée/.test(await p2.textContent('#ap-etat')) && await p2.isHidden('#ap-form'), n + 'autre onglet resté ouvert : impossible de remplacer la réponse, il voit le refus');
    await p2.close();
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
