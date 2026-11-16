// Audit L-7 (16/11/2026, condition du superviseur) : AUCUN champ envoyé par un formulaire public ne doit être perdu par
// la liste blanche du serveur (api/portail.js, COLONNES_FORMULAIRES). On remplit pour de vrai, dans le navigateur, les
// formulaires des pages FR et EN (base simulée, rien n'est écrit pour de vrai) et on compare, champ par champ, ce que
// chaque page envoie à la liste : intégrer l'agence, candidature à un casting, contact, demande recruteur (sélection),
// cours de talons. Le faux serveur fait aussi échouer tout envoi qui perdrait un champ (scripts/tests-visiteur/faux-serveur.js).
const { execFileSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const { COLONNES_FORMULAIRES } = require('../../api/portail.js');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const fichier = path.join(require('os').tmpdir(), 'ma2m-formulaires-' + process.pid + '.jsonl');
fs.writeFileSync(fichier, '');
for (const t of ['test-visiteur.js', 'test-contact-recruteur.js', 'test-cours-talons.js']) {
  try { execFileSync('node', [t], { cwd: __dirname, env: Object.assign({}, process.env, { FORMULAIRES_COUVERTS: fichier }), stdio: 'pipe', timeout: 480000 }); }
  catch (e) { ok(false, t + ' : la série a échoué (' + String((e.stdout || '') + (e.stderr || '')).split('\n').filter((l) => /ÉCHEC|Error/.test(l)).slice(0, 3).join(' | ') + ')'); }
}
const envois = fs.readFileSync(fichier, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
fs.unlinkSync(fichier);
const attendus = [
  ['casting_applications', 'integrer-agence.html'], ['casting_applications', 'en/integrer-agence.html'],
  ['casting_applications', 'candidature.html'], ['casting_applications', 'en/candidature.html'],
  ['messages_contact', 'contact.html'], ['messages_contact', 'en/contact.html'],
  ['recruiter_requests', 'selection.html'], ['recruiter_requests', 'en/selection.html'],
  ['cours_talons', 'cours-talons.html'], ['cours_talons', 'en/cours-talons.html']];
for (const [table, page] of attendus) {
  const ici = envois.filter((x) => x.table === table && x.page === page);
  const perdus = [...new Set(ici.flatMap((x) => x.perdus))];
  const champs = [...new Set(ici.flatMap((x) => x.champs))];
  ok(ici.length > 0 && !perdus.length, page + ' → ' + table + ' : ' + (ici.length ? champs.length + ' champs envoyés, 0 perdu' : 'AUCUN envoi observé') + (perdus.length ? ' — PERDUS : ' + perdus.join(', ') : ''));
}
// une colonne de la liste que plus aucune page n'envoie n'est pas grave, mais on la signale (liste à tenir à jour)
for (const table of Object.keys(COLONNES_FORMULAIRES)) {
  const vus = new Set(envois.filter((x) => x.table === table).flatMap((x) => x.champs));
  const jamais = COLONNES_FORMULAIRES[table].filter((c) => !vus.has(c));
  if (jamais.length) console.log('  (info) ' + table + ' : colonnes autorisées jamais envoyées par ces essais : ' + jamais.join(', '));
}
console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\n✅ Liste blanche des formulaires : aucun champ perdu, FR et EN');
process.exit(ko ? 1 : 0);
