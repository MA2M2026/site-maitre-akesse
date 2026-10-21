// Liens d'invitation et « mot de passe oublié » de l'Administration (21/10/2026) : la base n'accepte
// comme adresse de retour que le site principal ; ils doivent donc revenir par
// https://www.maitreakessemodelmanagement.com/admin/ (qui renvoie vers l'Administration en gardant
// la clé du lien), jamais directement par admin.… (sinon l'invité arrivait sur l'accueil public).
const fs = require('fs'); const path = require('path');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const lire = (f) => fs.readFileSync(path.resolve(__dirname, '../..', f), 'utf8');
const RETOUR = 'https://www.maitreakessemodelmanagement.com/admin/';
const api = lire('api/portail.js'), noyau = lire('js/portail/noyau.js'), vercel = lire('vercel.json');
ok(api.includes("const RETOUR_ADMINISTRATION = '" + RETOUR + "'") && /invite\?redirect_to=' \+ encodeURIComponent\(RETOUR_ADMINISTRATION\)/.test(api), 'invitation : retour par ' + RETOUR);
ok(noyau.includes("redirectTo: '" + RETOUR + "#/nouveau-mot-de-passe'"), 'mot de passe oublié : retour par ' + RETOUR);
ok(/"source": "\/admin\/", "has": \[\{ "type": "host", "value": "www\.maitreakessemodelmanagement\.com" \}\], "destination": "https:\/\/admin\.maitreakessemodelmanagement\.com\/admin\/"/.test(vercel), 'www…/admin/ renvoie bien vers l’Administration');
console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.');
process.exit(ko ? 1 : 0);
