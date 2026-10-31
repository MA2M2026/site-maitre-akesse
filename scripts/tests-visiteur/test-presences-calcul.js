// Calcul de la liste de présence (js/presences-calcul.js, chantier 14, 01/11/2026) : les dimanches du
// mois, vert / orange / rouge / annulée, et les mentions décidées par la propriétaire le 31/10/2026.
const path = require('path');
require(path.join(__dirname, '../../js/presences-calcul.js'));
const P = globalThis.Presences;
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
ok(P.dimanchesDuMois('2026-11').join() === '2026-11-01,2026-11-08,2026-11-15,2026-11-22,2026-11-29', 'novembre 2026 : 5 dimanches trouvés');
ok(P.dimanchesDuMois('2026-12').join() === '2026-12-06,2026-12-13,2026-12-20,2026-12-27', 'décembre 2026 : 4 dimanches trouvés');
ok(P.moisVoisin('2026-12', 1) === '2027-01' && P.moisVoisin('2027-01', -1) === '2026-12', 'mois suivant / précédent (changement d’année)');
const mention = (presents, total) => P.bilan(Array.from({ length: total }, (_, i) => (i < presents ? 'present' : 'absent'))).mention;
ok(mention(4, 4) === 'assidu' && mention(5, 5) === 'assidu', 'toutes les séances : Apprenant assidu, bravo !');
ok(mention(3, 4) === 'bien' && mention(4, 5) === 'bien', '3 sur 4, 4 sur 5 : Bien');
ok(mention(2, 4) === 'passable' && mention(3, 5) === 'passable', '2 sur 4, 3 sur 5 : Passable');
ok(mention(1, 4) === 'insuffisant' && mention(2, 5) === 'insuffisant' && mention(1, 5) === 'insuffisant', '1 sur 4, 1 ou 2 sur 5 : Insuffisant');
ok(mention(0, 4) === 'absent', 'aucune : Absent tout le mois');
ok(P.MENTIONS.insuffisant.mannequin === 'À améliorer', 'pour la mannequin : « À améliorer »');
// excusée : ne compte pas contre elle ; annulée : ne compte pour personne
ok(P.bilan(['present', 'present', 'present', 'excuse']).mention === 'assidu', 'absence excusée : ne compte pas contre elle');
const nov = P.moisMannequin('2026-11', { '2026-11-01': 'present', '2026-11-08': 'excuse' }, ['2026-11-15'], '2026-10-01', '2026-11-23');
ok(nov.jours.map((j) => j.etat).join() === 'present,excuse,annulee,absent,a_venir', 'jour par jour : vert, orange, annulée, rouge (passé non coché), à venir');
ok(nov.bilan.provisoire && nov.bilan.comptees === 2, 'mois pas fini : mention provisoire, 2 séances comptées');
ok(P.etatJour('2026-11-22', undefined, false, null, '2026-11-22') === 'a_venir', 'le dimanche du jour, non coché : pas encore rouge');
ok(P.etatJour('2026-11-22', undefined, false, null, '2026-11-23') === 'absent', 'le lundi : rouge');
ok(P.etatJour('2026-11-01', undefined, false, '2026-11-05', '2026-11-23') === 'avant_entree', 'avant son entrée à l’agence : ne compte pas');
ok(P.etatJour('2026-11-01', 'present', false, '2026-11-05', '2026-11-23') === 'present', 'avant son entrée mais cochée : compte');
const s = P.synthese(P.moisEntre('2026-09', '2026-11'), { '2026-09-06': 'present', '2026-10-04': 'present' }, [], '2026-09-01', '2026-12-01');
ok(s.parMois.length === 3 && s.bilan.presents === 2 && s.bilan.comptees === 13, 'synthèse sur 3 mois : détail par mois et total (2 présences sur 13 séances)');
console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.'); process.exit(ko ? 1 : 0);
