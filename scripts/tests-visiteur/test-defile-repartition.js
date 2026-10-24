// Programmation défilé : répartition automatique (js/defile-repartition.js, 24/10/2026), sans
// navigateur. Exemple de la propriétaire : 40 mannequins retenues (30 femmes, 10 hommes ; agence et
// extérieures), un défilé sur 3 jours avec plusieurs passages par jour dans différentes salles.
const { repartirDefile, conflitsDefile } = require('../../js/defile-repartition.js');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const vivier = [];
for (let i = 0; i < 30; i++) vivier.push({ cle: 'f' + i, sexe: 'femme' });
for (let i = 0; i < 10; i++) vivier.push({ cle: 'h' + i, sexe: 'homme' });
const passages = [
  { id: 'j1a', jour: '2026-12-01', debut: '17:00', femmes: 5, hommes: 2 },
  { id: 'j1b', jour: '2026-12-01', debut: '17:30', femmes: 5, hommes: 2 },   // même heure, autre salle
  { id: 'j1c', jour: '2026-12-01', debut: '20:00', femmes: 7, hommes: 3 },
  { id: 'j2a', jour: '2026-12-02', debut: '18:00', femmes: 10, hommes: 5 },
  { id: 'j2b', jour: '2026-12-02', debut: '21:00', femmes: 10, hommes: 5 },
  { id: 'j3a', jour: '2026-12-03', debut: '19:00', femmes: 3, hommes: 1 }];
const r = repartirDefile(passages, vivier, {});
const sexe = (c) => c[0] === 'h' ? 'homme' : 'femme';
ok(passages.every((p) => r.affectations[p.id].filter((c) => sexe(c) === 'femme').length === p.femmes && r.affectations[p.id].filter((c) => sexe(c) === 'homme').length === p.hommes),
  'chaque passage a son nombre de femmes et d’hommes');
ok(!conflitsDefile(passages, r.affectations).length, 'personne n’est dans deux passages trop rapprochés (17h00 et 17h30 le même jour)');
ok(passages.every((p) => new Set(r.affectations[p.id]).size === r.affectations[p.id].length), 'personne n’est deux fois dans le même passage');
const nf = Object.keys(r.compte).filter((c) => c[0] === 'f').map((c) => r.compte[c]);
ok(Math.max(...nf) - Math.min(...nf) <= 1, 'travail partagé entre les femmes (de ' + Math.min(...nf) + ' à ' + Math.max(...nf) + ' passages)');
ok(!Object.keys(r.manques).length, 'aucune place vide');
// choix faits à la main gardés
const r2 = repartirDefile(passages, vivier, { j3a: ['f29', 'h9'] });
ok(r2.affectations.j3a.indexOf('f29') >= 0 && r2.affectations.j3a.indexOf('h9') >= 0 && r2.affectations.j3a.length === 4, 'les mannequins choisies à la main restent à leur place, le reste se complète');
// pas assez d'hommes
const r3 = repartirDefile([{ id: 'x', jour: '2026-12-01', debut: '18:00', femmes: 2, hommes: 12 }], vivier, {});
ok(r3.manques.x && r3.manques.x.homme === 2 && !r3.manques.x.femme, 'il manque 2 hommes : signalé');
// même demande, même résultat
ok(JSON.stringify(repartirDefile(passages, vivier, {}).affectations) === JSON.stringify(r.affectations), 'même demande, même répartition');
// heure inconnue le même jour : jamais deux fois la même personne
const r4 = repartirDefile([{ id: 'a', jour: '2026-12-05', debut: '', femmes: 30, hommes: 0 }, { id: 'b', jour: '2026-12-05', debut: '', femmes: 1, hommes: 0 }], vivier, {});
ok(r4.manques.b && r4.manques.b.femme === 1, 'heure inconnue le même jour : prudence, pas deux passages pour la même');
// absente (réponse à la convocation) : garde sa place choisie à la main, jamais placée ailleurs
const r5 = repartirDefile(passages, vivier.map((v) => Object.assign({}, v, { horsChoix: v.cle === 'f1' })), { j3a: ['f1'] });
ok(r5.affectations.j3a.indexOf('f1') >= 0 && passages.every((p) => p.id === 'j3a' || r5.affectations[p.id].indexOf('f1') < 0), 'absente : sa place choisie à la main est gardée, elle n’est placée nulle part ailleurs');
console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
process.exit(ko ? 1 : 0);
