// Envois programmés des convocations, côté serveur (api/portail.js, ?tache=convocations) :
// joué avec une fausse base et un faux EmailJS (rien ne part pour de vrai).
// Vérifie : appel refusé sans la bonne clé ; e-mail envoyé au bon destinataire avec le bon texte
// (parent pour un mineur) ; échec noté quand EmailJS refuse ou qu'il n'y a pas d'adresse ;
// WhatsApp arrivés à l'heure → un seul e-mail d'alerte à l'agence ; clé EmailJS absente → rien
// ne part et c'est noté.
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-service-essai';
const CLE = 'a'.repeat(48);
const projet = { id: 'p1', type: 'defile', titre: 'Africa in Rhythm', date_debut: '2026-11-15', lieu: 'Hôtel Ivoire', heure_convocation: '15:00', deroule: [{ heure: '15:00', activite: 'Accueil' }], a_prevoir: 'Escarpins noirs' };
let appels, dus;
global.fetch = async (url, opt) => {
  const corps = opt && opt.body ? JSON.parse(opt.body) : null;
  appels.push({ url: String(url), corps });
  const rep = (status, json) => ({ ok: status < 300, status, json: async () => json });
  if (/rpc\/convocations_cle_valide/.test(url)) return rep(200, corps.p_cle === CLE);
  if (/rpc\/convocations_a_traiter/.test(url)) return rep(200, dus);
  if (/rpc\/convocations_resultat/.test(url)) return rep(200, null);
  if (/journal_erreurs/.test(url)) return rep(201, null);
  if (/api\.emailjs\.com/.test(url)) return corps.template_params.to_email === 'refus@test.ci' ? rep(400, {}) : rep(200, {});
  return rep(404, {});
};
const handler = require('../../api/portail.js');
function appeler(cle) {
  return new Promise((resoudre) => {
    const res = { code: 0, status(c) { this.code = c; return this; }, json(j) { resoudre({ code: this.code, j }); } };
    handler({ method: 'GET', query: { tache: 'convocations' }, headers: cle ? { 'x-cle-convocations': cle } : {} }, res);
  });
}
(async () => {
  appels = []; dus = [];
  let r = await appeler('mauvaise-cle-mais-assez-longue-pour-etre-testee-xx');
  ok(r.code === 401 && !appels.some((a) => /a_traiter/.test(a.url)), 'mauvaise clé : refusé, rien n’est lu');
  r = await appeler(null);
  ok(r.code === 401, 'sans clé : refusé');

  process.env.EMAILJS_PRIVATE_KEY = 'cle-emailjs-essai';
  appels = [];
  dus = [
    { id: 'e1', sorte: 'convocation', canal: 'email', projet, participant: { nom: 'Mademoiselle Awa Koné', email: 'awa@test.ci' } },
    { id: 'e2', sorte: 'rappel', canal: 'email', projet, participant: { nom: 'Petite Ama', parent: true, parent_nom: 'Madame Ama Mère', email: 'mere@test.ci' } },
    { id: 'e3', sorte: 'convocation', canal: 'email', projet, participant: { nom: 'Monsieur Refus', email: 'refus@test.ci' } },
    { id: 'e4', sorte: 'convocation', canal: 'email', projet, participant: { nom: 'Monsieur Sans Adresse' } },
    { id: 'w1', sorte: 'convocation', canal: 'whatsapp', projet, participant: { nom: 'Mademoiselle Awa Koné', telephone: '0700000001' } },
    { id: 'w2', sorte: 'convocation', canal: 'whatsapp', projet, participant: { nom: 'Monsieur Refus', telephone: '0700000002' } }
  ];
  r = await appeler(CLE);
  const mails = appels.filter((a) => /emailjs/.test(a.url)).map((a) => a.corps);
  const resultats = appels.filter((a) => /convocations_resultat/.test(a.url)).map((a) => a.corps);
  ok(r.code === 200 && r.j.envoyes === 2 && r.j.echecs === 2 && r.j.whatsapp === 2, 'bonne clé : 2 e-mails envoyés, 2 échecs, 2 WhatsApp à faire ' + JSON.stringify(r.j));
  const awa = mails.find((m) => m.template_params.to_email === 'awa@test.ci');
  ok(awa && awa.accessToken === 'cle-emailjs-essai' && /Vous êtes convoquée à 15h00 précises/.test(awa.template_params.message) && !/\*/.test(awa.template_params.message), 'e-mail d’Awa : convocation à 15h00, sans marques WhatsApp');
  const mere = mails.find((m) => m.template_params.to_email === 'mere@test.ci');
  ok(mere && mere.template_params.to_name === 'Madame Ama Mère' && /Bonjour Madame Ama Mère/.test(mere.template_params.message) && /c’est demain/.test(mere.template_params.message), 'mineure : le rappel part au parent');
  ok(resultats.find((x) => x.p_id === 'e1').p_ok === true && resultats.find((x) => x.p_id === 'e3').p_ok === false && /400/.test(resultats.find((x) => x.p_id === 'e3').p_erreur), 'EmailJS refuse : échec noté avec la raison');
  ok(/adresse/.test(resultats.find((x) => x.p_id === 'e4').p_erreur) && !mails.some((m) => !m.template_params.to_email), 'sans adresse : rien n’est envoyé, échec noté');
  const alerte = mails.filter((m) => m.template_params.to_email === 'infos.ma2m@gmail.com');
  ok(alerte.length === 1 && /2 message\(s\)/.test(alerte[0].template_params.message) && /Africa in Rhythm/.test(alerte[0].template_params.message), 'WhatsApp à l’heure : un seul e-mail d’alerte à l’agence');
  ok(!resultats.some((x) => /^w/.test(x.p_id)), 'les WhatsApp ne sont pas marqués envoyés par le serveur');
  ok(appels.some((a) => /journal_erreurs/.test(a.url)), 'échecs notés au journal');

  delete process.env.EMAILJS_PRIVATE_KEY;
  appels = [];
  dus = [{ id: 'e5', sorte: 'convocation', canal: 'email', projet, participant: { nom: 'Mademoiselle Awa Koné', email: 'awa@test.ci' } }];
  r = await appeler(CLE);
  ok(r.code === 200 && !appels.some((a) => /emailjs/.test(a.url)) && /Clé EmailJS absente/.test(appels.find((a) => /convocations_resultat/.test(a.url)).corps.p_erreur), 'clé EmailJS absente : rien ne part, la raison est notée');

  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.');
  process.exit(ko ? 1 : 0);
})();
