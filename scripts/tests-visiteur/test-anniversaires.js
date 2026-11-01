// Anniversaires automatiques (chantier 14, partie 3, 01/11/2026) : la tâche du matin du serveur
// (api/portail.js, vercel.json : tous les jours à 8 h) souhaite chaque anniversaire du jour une seule fois :
// message dans l'application (noté par la base), e-mail à la mannequin ou à son parent si elle est mineure,
// récapitulatif à l'agence avec les messages WhatsApp déjà écrits. Base et EmailJS simulés : rien ne part.
const path = require('path'), fs = require('fs');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const { messageAnniversaire } = require('../../js/messages-anniversaire.js');
const { EMAIL_AGENCE } = require('../../js/messages-convocations.js');
const il_y_a = (ans) => { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - ans); return d.toISOString().slice(0, 10); };

// les messages eux-mêmes
const majeure = messageAnniversaire({ nom: 'KONÉ AWA', email: 'awa@test.ci', telephone: '0707070707', date_naissance: il_y_a(21) });
ok(majeure.titre === '🎂 Joyeux anniversaire, Koné Awa !' && /^Joyeux anniversaire, Koné Awa ! 🎂/.test(majeure.application) && majeure.email.adresse === 'awa@test.ci', 'majeure : message chaleureux à son nom, e-mail à elle');
ok(!/\d{4}-\d\d-\d\d/.test(majeure.application) && !/21 ans/.test(majeure.application), 'à elle : jamais sa date de naissance ni son âge');
const mineure = messageAnniversaire({ nom: 'YAO CHLOÉ', email: 'chloe@test.ci', date_naissance: il_y_a(15), parent_nom: 'Madame Yao', parent_email: 'maman@test.ci', parent_telephone: '0505050505' });
ok(mineure.mineur && mineure.email.adresse === 'maman@test.ci' && /^Bonjour Madame Yao,/.test(mineure.email.texte) && /15 ans/.test(mineure.email.texte) && mineure.whatsapp.numero === '2250505050505',
  'mineure : e-mail et WhatsApp au parent (« Bonjour Madame Yao », 15 ans)');
ok(/^Joyeux anniversaire, Yao Chloé ! 🎂/.test(mineure.application), 'mineure : dans son application, le message est pour elle');

// la tâche du matin
(async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-essai';
  process.env.CRON_SECRET = 'secret-essai';
  const envois = [], notes = [], journal = [];
  const deja = new Set();
  let liste = [];
  global.fetch = async (url, o) => {
    if (/rpc\/anniversaires_du_jour/.test(url)) return { ok: true, json: async () => liste.filter((m) => !deja.has(m.id)) };
    if (/rpc\/anniversaire_noter/.test(url)) { const c = JSON.parse(o.body); notes.push(c); const nouveau = !deja.has(c.p_mannequin); deja.add(c.p_mannequin); return { ok: true, json: async () => nouveau }; }
    if (/rpc\/mensualites_relances/.test(url)) return { ok: true, json: async () => [] };
    if (/journal_erreurs/.test(url)) { journal.push(JSON.parse(o.body)); return { ok: true }; }
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
  liste = [{ id: 'm1', nom: 'KONÉ AWA', email: 'awa@test.ci', telephone: '0707070707', date_naissance: il_y_a(21) },
    { id: 'm2', nom: 'YAO CHLOÉ', email: 'chloe@test.ci', date_naissance: il_y_a(15), parent_nom: 'Madame Yao', parent_email: 'maman@test.ci', parent_telephone: '0505050505' }];
  process.env.EMAILJS_PRIVATE_KEY = 'cle-privee-essai';
  let r = await appeler(14);
  ok(r.statut === 200 && r.corps.anniversaires === 2, 'un jour sans relance (le 14) : les anniversaires partent quand même');
  const premiers = notes.filter((n) => n.p_email_ok === null);
  ok(premiers.length === 2 && premiers[0].p_titre === '🎂 Joyeux anniversaire, Koné Awa !', 'chaque anniversaire est noté AVANT l’e-mail (message dans l’application)');
  ok(notes.filter((n) => n.p_email_ok === true).length === 2, 'puis l’e-mail parti est noté dans la base');
  const destinataires = envois.map((e) => e.template_params.to_email);
  ok(destinataires.includes('awa@test.ci') && destinataires.includes('maman@test.ci') && !destinataires.includes('chloe@test.ci'), 'e-mails : à la majeure, au parent de la mineure (pas à la mineure)');
  const recap = envois.find((e) => e.template_params.to_email === EMAIL_AGENCE);
  ok(recap && /Anniversaires du jour/.test(recap.template_params.message) && /Koné Awa \(21 ans\)/.test(recap.template_params.message) && /wa\.me\/2250505050505\?text=/.test(recap.template_params.message) && /message à son parent/.test(recap.template_params.message),
    'l’agence reçoit le récapitulatif, avec les messages WhatsApp déjà écrits');
  const avant = envois.length;
  r = await appeler(14);
  ok(r.corps.anniversaires === 0 && envois.length === avant, 'relancée le même jour : rien n’est envoyé deux fois');
  // sans clé EmailJS : noté (message dans l'application), pas d'e-mail, panne au journal
  liste.push({ id: 'm3', nom: 'BAMBA FATOU', email: 'fatou@test.ci', date_naissance: il_y_a(19) });
  delete process.env.EMAILJS_PRIVATE_KEY;
  r = await appeler(14);
  ok(r.corps.anniversaires === 1 && envois.length === avant && journal.some((j) => /Anniversaires/.test(j.message) && /clé EmailJS absente/.test(j.message)), 'sans clé EmailJS : message dans l’application seulement, panne notée au journal');
  ok(!fs.readFileSync(path.join(__dirname, '../../vercel.json'), 'utf8').includes('"0 8 3,5 * *"') && /"schedule": "0 8 \* \* \*"/.test(fs.readFileSync(path.join(__dirname, '../../vercel.json'), 'utf8')), 'la tâche du matin passe tous les jours à 8 h (avant : seulement le 3 et le 5)');
  // panne de la base au moment de noter : rien n'est envoyé, mais la panne est notée au journal
  liste = [{ id: 'm9', nom: 'DIALLO SARA', email: 'sara@test.ci', date_naissance: il_y_a(20) }];
  process.env.EMAILJS_PRIVATE_KEY = 'cle-privee-essai';
  const vraiFetch = global.fetch, avantPanne = envois.length;
  global.fetch = async (url, o) => (/rpc\/anniversaire_noter/.test(url) ? { ok: false, status: 500, json: async () => ({ message: 'panne' }), text: async () => 'panne' } : vraiFetch(url, o));
  r = await appeler(14);
  global.fetch = vraiFetch;
  ok(r.corps.anniversaires === 0 && envois.length === avantPanne && journal.some((j) => /\[Anniversaires\] Diallo Sara : non noté/.test(j.message)), 'panne au moment de noter : rien n’est envoyé, la panne est notée au journal');
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.'); process.exit(ko ? 1 : 0);
})();
