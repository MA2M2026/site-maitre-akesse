// Documents des mannequins qui expirent (chantier 14, partie 3, 01/11/2026), comme l'agence, base SIMULÉE (rien
// n'est écrit pour de vrai) : 1) l'alerte du matin du serveur (api/portail.js) envoie un seul e-mail à l'agence,
// sans bloquer les anniversaires ni les relances ; 2) la rubrique « Documents des mannequins » de l'Administration,
// sur téléphone et ordinateur : tri par urgence en rouge / orange / vert, ajouter, corriger, supprimer.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const { EMAIL_AGENCE } = require('../../js/messages-convocations.js');
const chemin = require('path');
const PORT = String(9490 + Math.floor(Math.random() * 40));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const dansJours = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

async function serveur() {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-essai';
  process.env.CRON_SECRET = 'secret-essai';
  process.env.EMAILJS_PRIVATE_KEY = 'cle-privee-essai';
  const envois = [], journal = [];
  let alertes = [], panne = false;
  global.fetch = async (url, o) => {
    if (/rpc\/documents_alertes_du_jour/.test(url)) { if (panne) return { ok: false, status: 500, json: async () => ({ message: 'panne' }), text: async () => 'panne' }; const a = alertes; alertes = []; return { ok: true, json: async () => a }; }
    if (/rpc\/anniversaires_du_jour/.test(url)) return { ok: true, json: async () => [] };
    if (/rpc\/mensualites_relances/.test(url)) return { ok: true, json: async () => [] };
    if (/journal_erreurs/.test(url)) { if (o.method !== 'POST') return { ok: true, json: async () => [] }; journal.push(JSON.parse(o.body)); return { ok: true }; }
    if (/api\.emailjs\.com/.test(url)) { envois.push(JSON.parse(o.body)); return { ok: true }; }
    return { ok: true, json: async () => ({}), text: async () => '' };
  };
  const portail = require('../../api/portail.js');
  const appeler = async (jour) => {
    const vrai = Date.prototype.getUTCDate; Date.prototype.getUTCDate = function () { return jour; };
    let statut = 0, corps = null;
    const res = { status(s) { statut = s; return this; }, json(c) { corps = c; return this; }, setHeader() {} };
    try { await portail({ method: 'GET', headers: { authorization: 'Bearer secret-essai' }, query: {} }, res); } finally { Date.prototype.getUTCDate = vrai; }
    return { statut, corps };
  };
  alertes = [{ quoi: 'expire', nom: 'KONÉ AWA', sorte: 'autorisation_parentale', libelle: null, expire_le: '2026-11-01' },
    { quoi: 'bientot', nom: 'YAO CHLOÉ', sorte: 'piece_identite', libelle: 'passeport', expire_le: '2026-11-20' }];
  let r = await appeler(14);
  ok(r.statut === 200 && r.corps.documents === 2, 'serveur : un jour ordinaire, les alertes de documents partent');
  const mail = envois.filter((e) => e.template_params.to_email === EMAIL_AGENCE);
  const texte = mail.length ? mail[0].template_params.message : '';
  ok(mail.length === 1 && /EXPIRÉS :\n• KONÉ AWA : Autorisation parentale, fin le 01\/11\/2026/.test(texte) && /moins de 30 jours :\n• YAO CHLOÉ : Pièce d’identité \(passeport\), fin le 20\/11\/2026/.test(texte),
    'serveur : un seul e-mail à l’agence, expirés puis bientôt, dates en français');
  r = await appeler(14);
  ok(r.corps.documents === 0 && envois.length === 1, 'serveur : rien de nouveau, aucun e-mail');
  panne = true;
  r = await appeler(3);
  ok(r.statut === 200 && r.corps.documents === 0 && journal.some((j) => /\[Documents\]/.test(j.message)) && r.corps.relances === 0, 'serveur : une panne des documents est notée au journal et n’empêche pas les relances du 3');
  panne = false;
  delete process.env.EMAILJS_PRIVATE_KEY;
  alertes = [{ quoi: 'bientot', nom: 'BAMBA FATOU', sorte: 'contrat', libelle: null, expire_le: '2026-11-25' }];
  r = await appeler(14);
  ok(r.corps.documents === 1 && envois.length === 1 && journal.some((j) => /\[Documents\].*clé EmailJS absente/.test(j.message)), 'serveur : sans clé EmailJS, la panne est notée au journal');
}

async function administration() {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('dialog', (dl) => dl.accept());
    const d = donnees('principal');
    let docs = [{ id: 'd1', mannequin: 'r1', nom: 'AWA KONÉ', sorte: 'contrat', libelle: 'contrat 2026', expire_le: dansJours(200), note: null },
      { id: 'd2', mannequin: 'r2', nom: 'BINTOU TRAORÉ', sorte: 'autorisation_parentale', libelle: null, expire_le: dansJours(-3), note: 'Demander à la maman' },
      { id: 'd3', mannequin: 'r1', nom: 'AWA KONÉ', sorte: 'piece_identite', libelle: 'passeport', expire_le: dansJours(12), note: null }];
    d.rpc.documents_liste = () => ({ documents: docs, mannequins: [{ id: 'r1', nom: 'AWA KONÉ' }, { id: 'r2', nom: 'BINTOU TRAORÉ' }] });
    d.rpc.document_enregistrer = () => 'nouveau';
    d.rpc.document_supprimer = () => null;
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');
    const appels = (quoi) => journal.filter((j) => j[0] === 'rpc' && j[1] === quoi).map((j) => JSON.parse(j[2] || '{}'));
    await p.goto(URL_ADMIN + '#/site/b2-documents'); await p.waitForSelector('.doc-ligne'); await p.waitForTimeout(500);
    ok(/Documents des mannequins/.test(await p.textContent('body')), n + 'la rubrique « Documents des mannequins » s’ouvre');
    const ordre = await p.$$eval('.doc-ligne', (ls) => ls.map((l) => l.className.replace('doc-ligne ', '') + ':' + l.querySelector('b').textContent));
    ok(JSON.stringify(ordre) === JSON.stringify(['rouge:BINTOU TRAORÉ', 'orange:AWA KONÉ', 'vert:AWA KONÉ']), n + 'triés par urgence : expiré (rouge), bientôt (orange), valable (vert) ' + ordre.join(', '));
    ok(/Expiré depuis 3 jours/.test(await p.textContent('.doc-ligne.rouge')) && /Expire dans 12 jours/.test(await p.textContent('.doc-ligne.orange')) && /1 expiré/.test(await p.textContent('.doc-resume')) && /1 bientôt/.test(await p.textContent('.doc-resume')),
      n + 'les jours restants et le résumé (1 expiré, 1 bientôt)');
    // ajouter
    await p.selectOption('.doc-form select[name="mannequin"]', 'r2');
    await p.selectOption('.doc-form select[name="sorte"]', 'piece_identite');
    await p.fill('.doc-form input[name="libelle"]', 'carte d’identité');
    await p.fill('.doc-form input[name="expire_le"]', dansJours(400));
    await p.click('.doc-form button[type="submit"]'); await p.waitForTimeout(700);
    const a = appels('document_enregistrer').pop() || {};
    ok(a.p_id === null && a.p_mannequin === 'r2' && a.p_sorte === 'piece_identite' && a.p_libelle === 'carte d’identité' && a.p_expire_le === dansJours(400), n + '« Ajouter » : le document part avec sa date de fin');
    // corriger la date de l'autorisation expirée
    await p.waitForSelector('.doc-ligne');
    await p.click('.doc-ligne.rouge [data-action="document-modifier"]'); await p.waitForSelector('.doc-form[data-id="d2"]');
    ok(/Corriger le document/.test(await p.textContent('.doc-form')) && await p.inputValue('.doc-form input[name="note"]') === 'Demander à la maman' && await p.inputValue('.doc-form select[name="mannequin"]') === 'r2',
      n + '« Modifier » : le formulaire reprend le document');
    await p.fill('.doc-form input[name="expire_le"]', dansJours(365));
    await p.click('.doc-form button[type="submit"]'); await p.waitForTimeout(700);
    const c = appels('document_enregistrer').pop() || {};
    ok(c.p_id === 'd2' && c.p_expire_le === dansJours(365) && c.p_sorte === 'autorisation_parentale', n + 'correction enregistrée (nouvelle date de fin)');
    await p.waitForSelector('.doc-form:not([data-id])');
    ok(true, n + 'après la correction, le formulaire revient à « Ajouter »');
    // supprimer
    await p.click('.doc-ligne.vert [data-action="document-supprimer"]'); await p.waitForTimeout(700);
    ok((appels('document_supprimer').pop() || {}).p_id === 'd1', n + '« Supprimer » (après confirmation)');
    await p.waitForSelector('.doc-ligne');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne déborde de l’écran');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'textes lisibles ' + pales.slice(0, 3).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    // base pas encore installée : message clair
    d.rpc.documents_liste = { erreur: 'Could not find the function public.documents_liste' };
    await p.goto(URL_ADMIN + '#/site/b2-presences'); await p.waitForTimeout(600);
    await p.goto(URL_ADMIN + '#/site/b2-documents'); await p.waitForTimeout(1500);
    ok(/supabase-documents\.sql/.test(await p.textContent('body')), n + 'base pas encore installée : le fichier à coller est indiqué');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
}

(async () => {
  await serveur();
  await administration();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
