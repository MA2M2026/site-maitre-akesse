// Fiche d'une mannequin, case « lien vidéo » (08/11/2026, phase 3 V1 : une phrase écrite dans cette case devenait un lien
// cassé vers le site, trouvé par le relevé des liens, scripts/visiteur/liens.mjs) : seule une vraie adresse web devient
// un lien ou une vidéo intégrée ; une phrase n'affiche rien. Dessin partagé js/rendu-fiche.js (serveur et page).
import '../../js/partage.js';
import '../../js/tailles.js';
import '../../js/rendu-fiche.js';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const dessin = (video_url) => globalThis.RenduFiche.fiche({ profil: { id: 'x', full_name: 'ESSAI', video_url }, photos: [], projets: [], age: '' }, { en: false });
const html = (v) => { const d = dessin(v); return typeof d === 'string' ? d : JSON.stringify(d).replace(/\\"/g, '"'); };
ok(!/Voir la vidéo/.test(html('Trois édition/du festival abidjan pagne, Shooting pour le magazine Jolideh')), 'une phrase dans la case vidéo : pas de lien (avant : lien cassé)');
ok(/href="https:\/\/vimeo\.example\/123"/.test(html('https://vimeo.example/123')), 'une adresse http(s) : lien « Voir la vidéo »');
ok(/href="https:\/\/www\.exemple\.ci\/film"/.test(html('www.exemple.ci/film')), 'une adresse www.… : lien en https');
ok(/youtube\.com\/embed\/abc123/.test(html('https://www.youtube.com/watch?v=abc123')), 'YouTube : vidéo intégrée');
ok(!/Voir la vidéo|<iframe/.test(html('')) && !/Voir la vidéo/.test(html('javascript:alert(1)')), 'vide ou « javascript: » : rien');
console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
process.exit(ko ? 1 : 0);
