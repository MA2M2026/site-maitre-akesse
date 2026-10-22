// Journal des erreurs (tableau de bord) : avec de vraies lignes du journal de la propriétaire
// (12/10/2026), vérifie ce que le nettoyage automatique efface (js/erreurs-corrigees.js) et
// comment le reste est classé (REGLES_ERREURS, js/erreurs-site.js). Rien n'est écrit.
const fs = require('fs'); const path = require('path');
const racine = path.resolve(__dirname, '../..');
const window = {}; eval(fs.readFileSync(path.join(racine, 'js/erreurs-corrigees.js'), 'utf8'));
const tdb = fs.readFileSync(path.join(racine, 'js/erreurs-site.js'), 'utf8');
const debut = tdb.indexOf('const REGLES_ERREURS = '), fin = tdb.indexOf('\n}\n', tdb.indexOf('function analyserErreur(')) + 2;
eval(tdb.slice(debut, fin)); // règles de classement + analyserErreur, telles quelles
const debutC = tdb.indexOf('function regleCorrespond('), finC = tdb.indexOf('\n}\n', tdb.indexOf('function estErreurCorrigee(')) + 2;
eval(tdb.slice(debutC, finC)); // la règle du nettoyage automatique (regleCorrespond + estErreurCorrigee), telle quelle
const efface = (message, ua, date) => estErreurCorrigee({ message, pile: '', user_agent: ua, created_at: date }, window.MA2M_ERREURS_CORRIGEES);
const PHX = 'Mozilla/5.0 (Linux; U; Android 12; fr-fr; TECNO KI5k) Chrome/105.0 Mobile Safari/537.36 PHX/22.4';
const BRAVE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) Version/18.6.2 Mobile/15E148 Safari/604.1 Brave';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) Version/26.6.1 Mobile/15E148 Safari/604.1';
const cas = [ // [message, navigateur, date, attendu : 'efface' ou la gravité]
  ['[Bloqué par la sécurité] style-src-attr → script/style en ligne', BRAVE, '2026-10-10T21:57:00Z', 'efface'],
  ['[Zoom automatique] /mannequins : input#f-recherche « ex. : Bolli » (texte 14 px)', IPHONE, '2026-10-10T18:34:00Z', 'efface'],
  ['[Bloqué par la sécurité] style-src-elem → script/style en ligne', PHX, '2026-10-10T16:14:00Z', 'efface'],
  ['[Erreur JavaScript] Erreur inconnue', PHX, '2026-10-10T16:14:00Z', 'efface'],
  ['[Requête en échec] POST dfhghgmwmxiguhtxtsle.supabase.co/auth/v1/token → 400 {"code":"refresh_token_not_found"}', IPHONE, '2026-10-12T09:43:00Z', 'efface'],
  ['[Bloqué par la sécurité] script-src-elem → https://connect.facebook.net/en_US/pcm.js', IPHONE, '2026-10-08T21:52:00Z', 'efface'],
  ['[Erreur JavaScript] The I/O read operation failed.', IPHONE, '2026-10-08T15:57:00Z', 'efface'],
  ['[Bloqué par la sécurité] connect-src → https://www.google.com/g/collect?v=2', IPHONE, '2026-10-07T14:53:00Z', 'efface'],
  ['[Page plus large que l\'écran] /mannequins : button.filtre-btn.filtre-niveau-btn « Main Board » dépasse de 12 px', IPHONE, '2026-10-06T09:21:00Z', 'efface'],
  ['[Requête en échec] POST /api/trier-photo → 402', IPHONE, '2026-10-07T11:05:00Z', 'efface'],
  ['[Requête en échec] POST /api/code-protege → 502', IPHONE, '2026-10-10T15:37:00Z', 'efface'],
  ['[Erreur signalée par le code] Notification e-mail non envoyée : {"status":0,"text":""}', IPHONE, '2026-10-07T21:50:00Z', 'info'],
  ['[Erreur signalée par le code] Notification e-mail non envoyée : {"status": 0, "text": ""}', IPHONE, '2026-10-07T21:50:00Z', 'info'],
  ['[Erreur signalée par le code] Échec du chargement du profil : délai dépassé', IPHONE, '2026-10-07T10:00:00Z', 'surveiller'],
  // une vraie erreur venue du même navigateur, ou la même alerte venue d'un autre navigateur, reste
  ['[Requête en échec] POST dfhghgmwmxiguhtxtsle.supabase.co/rest/v1/model_projects → 400', PHX, '2026-10-10T16:14:00Z', 'corriger'],
  ['[Bloqué par la sécurité] style-src-attr → script/style en ligne', IPHONE, '2026-10-10T21:57:00Z', 'corriger'],
  // une erreur qui reviendrait APRÈS la correction doit réapparaître
  ['[Zoom automatique] /mannequins : input#f-recherche « ex. : Bolli » (texte 14 px)', IPHONE, '2026-10-13T10:00:00Z', 'corriger'],
  ['[Erreur JavaScript] maFonction is not defined', IPHONE, '2026-10-12T10:00:00Z', 'corriger']
];
let ko = 0;
for (const [m, ua, d, attendu] of cas) {
  const obtenu = efface(m, ua, d) ? 'efface' : analyserErreur(m).gravite;
  if (obtenu !== attendu) { ko++; console.log('❌ ÉCHEC journal : ' + m.slice(0, 70) + ' → ' + obtenu + ' (attendu : ' + attendu + ')'); }
}
console.log((ko ? '❌ ÉCHEC' : '✓') + ' journal : ' + (cas.length - ko) + '/' + cas.length + ' lignes bien traitées');
if (ko) process.exitCode = 1;
