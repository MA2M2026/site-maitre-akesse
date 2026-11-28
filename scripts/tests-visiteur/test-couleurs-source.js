// Garde-fou des couleurs À LA SOURCE (01/11/2026, lot 2 décidé par la propriétaire) : aucune feuille de style
// (css/*.css) ne peut plus donner un FOND noir, gris foncé, beige, ivoire, brun ou doré. Complète le gardien des
// pages affichées (couleurs-autorisees.js), qui ne voit que les pages essayées : celui-ci lit TOUTES les règles.
// Permis : rouges et roses, blanc et gris très clairs, couleurs d'état (vert, orange, bleu des pastilles), et
// ce qui est posé SUR les photos (voiles sombres --voile-photo-*, --mag-voile-*, rouge vif d'origine
// --rouge-logo, gardés à la demande de la propriétaire le 28/10/2026). Aucun navigateur : rapide.
const fs = require('fs'), path = require('path');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const CSS = path.join(__dirname, '../../css');
const SUR_PHOTO = /var\(--(voile-photo|mag-voile)[\w-]*\)|var\(--rouge-logo\)/;
// couleurs d'état (pastilles « en attente », « à surveiller » : orange et jaune foncé)
const ETATS = new Set(['154,88,0', '92,68,0', '224,145,58', '255,241,204']);

const hexa = (h) => {
  let x = h.slice(1); if (x.length <= 4) x = x.split('').map((c) => c + c).join('');
  return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16), x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1];
};
const couleursDe = (v) => [...v.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((x) => hexa(x[0]))
  .concat([...v.matchAll(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?\)/g)].map((x) => [+x[1], +x[2], +x[3], x[4] === undefined ? 1 : +x[4]]))
  .concat(/\bblack\b/.test(v) ? [[0, 0, 0, 1]] : []);
// noir et gris foncé ; beige et ivoire (clair, tirant sur le jaune) ; brun et doré (le vert ne domine pas, le rouge non plus)
function interdite([r, g, b, a]) {
  if (a < 0.15 || ETATS.has(r + ',' + g + ',' + b)) return null;
  const haut = Math.max(r, g, b), bas = Math.min(r, g, b);
  if (haut - bas <= 24 && haut < 200) return 'noir ou gris foncé';
  if (r >= 200 && g >= 180 && b >= 140 && r >= g && g - b >= 8 && r - b >= 10 && haut - bas <= 70) return 'beige ou ivoire';
  if (r > g && g > b && g >= 0.5 * r && r - b >= 40) return 'brun ou doré';
  return null;
}

// les variables de toutes les feuilles (pour lire ce que vaut var(--x))
const fichiers = fs.readdirSync(CSS).filter((f) => f.endsWith('.css'));
// (une variable peut valoir autre chose selon l'endroit : sur le rouge ou dans un bloc blanc ; TOUTES ses
// valeurs sont lues, car chacune peut s'afficher quelque part)
const vars = {};
for (const f of fichiers) for (const m of fs.readFileSync(path.join(CSS, f), 'utf8').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) (vars[m[1]] = vars[m[1]] || new Set()).add(m[2].trim());
const lire = (v, n = 0) => (n > 8 ? v : v.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (tout, nom, defaut) => (SUR_PHOTO.test(tout) ? '' : nom in vars ? [...vars[nom]].map((x) => lire(x, n + 1)).join(' ') : defaut || '')));

const fautes = [];
for (const f of fichiers) {
  fs.readFileSync(path.join(CSS, f), 'utf8').split('\n').forEach((ligne, i) => {
    for (const m of ligne.matchAll(/background(?:-color|-image)?\s*:\s*([^;}]+)/g)) {
      if (/url\(/.test(m[1])) continue;
      for (const c of couleursDe(lire(m[1]))) {
        const quoi = interdite(c);
        if (quoi) { fautes.push(f + ':' + (i + 1) + ' ' + quoi + ' (rgb ' + c.slice(0, 3).join(',') + ') : ' + ligne.trim().slice(0, 90)); break; }
      }
    }
  });
}
ok(fichiers.length > 15, 'toutes les feuilles de style lues (' + fichiers.length + ')');
ok(!fautes.length, 'aucun fond noir, gris foncé, beige, brun ou doré à la source' + (fautes.length ? ' :\n  ' + fautes.join('\n  ') : ''));
// le garde-fou voit bien une faute posée exprès
ok(interdite([0, 0, 0, 1]) && interdite([245, 240, 232, 1]) && interdite([138, 106, 31, 1]) && interdite([85, 85, 85, 1]), 'le garde-fou reconnaît le noir, le beige, le doré et le gris foncé');
ok(!interdite([124, 33, 40, 1]) && !interdite([90, 20, 27, 1]) && !interdite([255, 255, 255, 1]) && !interdite([243, 227, 229, 1]) && !interdite([30, 122, 69, 1]), 'il laisse passer le rouge mat, le rouge profond, le blanc, le rose pâle et le vert « payé »');
console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
process.exit(ko ? 1 : 0);
