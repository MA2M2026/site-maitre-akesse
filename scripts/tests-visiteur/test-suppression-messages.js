// Supprimer les vieux messages d'essai venus du site (demande de la propriétaire, 16/11/2026), comme une vraie
// personne dans l'Administration, base SIMULÉE (rien n'est supprimé pour de vrai) :
//  - administratrice principale : « 🗑 » sur chaque message de contact (confirmation, puis la ligne disparaît) et
//    « Supprimer ce dossier » sur une candidature et une demande recruteur ;
//  - administrateur du site : aucun bouton de suppression (la base refuse aussi : supabase-suppression-messages.sql).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const path = require('path');
const PORT = String(9870 + Math.floor(Math.random() * 25)), URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [role, ecran] of [['principal', { width: 390, height: 844 }], ['site', { width: 1366, height: 860 }]]) {
    const tel = ecran.width < 700, n = role + ' (' + (tel ? 'téléphone' : 'ordinateur') + ') : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const d = donnees(role); d.memoriser = true;
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForFunction(() => document.querySelector('.accueil-tete, .coque:not(.sans-menu)'), null, { timeout: 15000 }); await p.waitForTimeout(1200);
    // messages de contact
    await p.goto(URL_ADMIN + '#/site/b2-contacts'); await p.waitForTimeout(2000);
    const boutons = await p.$$('[data-action="contact-supprimer"]');
    if (role === 'principal') {
      ok(boutons.length === 2, n + '« 🗑 » sur chacun des 2 messages de contact');
      let question = '';
      p.once('dialog', (dl) => { question = dl.message(); dl.dismiss(); });
      await p.click('[data-action="contact-supprimer"][data-id="mc2"]'); await p.waitForTimeout(600);
      ok(/Société Lagune/.test(question) && d.tables.messages_contact.length === 2, n + 'confirmation demandée (avec le nom) ; « Annuler » ne supprime rien');
      p.once('dialog', (dl) => dl.accept());
      await p.click('[data-action="contact-supprimer"][data-id="mc2"]'); await p.waitForTimeout(1500);
      ok(d.tables.messages_contact.length === 1 && d.tables.messages_contact[0].id === 'mc1' && !(await p.$('[data-id="mc2"]')),
        n + 'confirmé : le message disparaît de la liste et de la base');
    } else ok(boutons.length === 0, n + 'aucun bouton de suppression sur les messages de contact');
    // dossiers : une candidature et une demande recruteur
    for (const [rubrique, id] of [['b2-candidatures', 'c1'], ['b2-recruteurs', (d.tables.recruiter_requests[0] || {}).id]]) {
      await p.goto(URL_ADMIN + '#/site/' + rubrique + '/' + id); await p.waitForTimeout(2200);
      const zone = !!(await p.$('[data-action="dossier-supprimer"]'));
      ok(role === 'principal' ? zone : !zone, n + rubrique + ' : bouton « Supprimer ce dossier » ' + (role === 'principal' ? 'présent' : 'absent'));
    }
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
