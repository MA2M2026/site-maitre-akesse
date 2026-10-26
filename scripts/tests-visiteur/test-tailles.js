// Tailles des mannequins femmes (js/tailles.js) : grille de l'agence du 26/10/2026 et règle n° 1
// de la propriétaire (une mesure pile sur la limite de deux tailles reste dans la plus petite).
// Sans navigateur ni base.
global.window = {};
require('../../js/tailles.js');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const T = (poitrine, taille, bassin) => window.ma2mTailles({ category: 'femme', chest_cm: poitrine, waist_cm: taille, hips_cm: bassin });
const haut = (p) => T(p, null, null).haut.lettre, bas = (p, t, b) => (T(p, t, b).bas || {}).lettre;  // (poitrine voisine : sinon « mesures à reprendre »)
// le tableau de la propriétaire, ligne par ligne
ok(haut(80) === 'XS' && haut(84) === 'XS' && haut(85) === 'S' && haut(89) === 'S' && haut(90) === 'M' && haut(93) === 'M' && haut(94) === 'L' && haut(99) === 'L', 'poitrine : XS 80-84, S 85-89, M 90-93, L 94-99');
ok(bas(80, 60, 88) === 'XS' && bas(85, 66, 93) === 'S' && bas(90, 71, 97) === 'M' && bas(94, 75, 102) === 'L' && bas(94, 81, 109) === 'L', 'taille et bassin : XS, S, M, L du tableau');
// règle n° 1 : les limites communes restent dans la plus petite taille
ok(bas(85, 70, 93) === 'S' && bas(80, 60, 92) === 'XS' && bas(85, 66, 96) === 'S', 'règle n° 1 : taille 70 = S, bassin 92 = XS, bassin 96 = S');
// deux profils types (mesures vérifiées avec la propriétaire, noms fictifs)
ok(T(85, 68, 95).generale === 'S' && !T(85, 68, 95).exces, 'profil 85 / 68 / 95 : S');
ok(T(92, 73, 107).generale === 'M-L' && !T(92, 73, 107).exces, 'profil 92 / 73 / 107 : M-L, plus « excessive »');
ok(T(92, 73, 110).exces === true, 'bassin 110 (XL) : au-delà du L, signalé');
const H = window.ma2mTailles({ category: 'homme', chest_cm: 96, waist_cm: 80 });
ok(H.generale === 'M', 'hommes : grille inchangée (96 / 80 : M)');
console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
process.exit(ko ? 1 : 0);
