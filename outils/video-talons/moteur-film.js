// Moteur commun des films en motion design « noir profond » (10/11/2026) : film-talons.html, film-agence.html.
// Le film décrit ses scènes en HTML (data-de, data-voix, data-mot, data-anim…, voir l'en-tête de film-talons.html) ;
// ce moteur prépare les éléments et fournit window.rendre(t) (image exacte à l'instant t), lu par fabrique-talons.js.
if (/format=large/.test(location.search)) document.body.classList.add('large');
const LARGE = document.body.classList.contains('large'), W = LARGE ? 1920 : 1080, H = LARGE ? 1080 : 1920;
document.querySelectorAll('[data-seulement="vertical"]').forEach((e) => { if (LARGE) e.remove(); });
const T = window.T;
// (mot sans accents ni élision : « l'Atelier » → « atelier », « m'inscris » → « inscris »)
const ACCENTS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
const APOS = new RegExp('[' + String.fromCharCode(0x2019) + "']", 'g');
const normal = (m) => m.toLowerCase().normalize('NFD').replace(ACCENTS, '').replace(APOS, "'").replace(/^(?:[ldjmnstc]|qu)'/, '');
const lisse = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const sortie = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
const ressort = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2));
// hasard reproductible (même graine → mêmes blocs à chaque rendu)
const graine = (n) => () => { n = (n + 0x6D2B79F5) | 0; let x = Math.imul(n ^ (n >>> 15), 1 | n); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
// symboles des médaillons (dessin au trait, 100 × 100)
const SYMBOLES = {
  talon: '<path d="M12 70 L56 70 C66 70 72 64 78 56 L84 44 C86 40 84 34 80 34 C76 34 74 38 70 42 C62 50 52 52 42 50 C32 48 22 52 16 58 C12 62 12 66 12 70 Z"/><path d="M80 56 L84 84"/><path d="M12 70 L12 74"/>',
  couronne: '<path d="M18 72 L13 32 L34 50 L50 22 L66 50 L87 32 L82 72 Z"/><path d="M18 82 L82 82"/>',
  diamant: '<path d="M22 40 L36 22 L64 22 L78 40 L50 80 Z"/><path d="M22 40 L78 40"/><path d="M40 40 L50 80 L60 40 M36 22 L40 40 M64 22 L60 40"/>',
  etoile: '<path d="M50 13 L60 39 L88 40 L66 57 L74 85 L50 69 L26 85 L34 57 L12 40 L40 39 Z"/>',
  horloge: '<circle cx="50" cy="50" r="33"/><path d="M50 29 L50 50 L65 59"/>',
  maison: '<path d="M16 50 L50 21 L84 50"/><path d="M27 42 L27 81 L73 81 L73 42"/><path d="M43 81 L43 62 L57 62 L57 81"/>',
  personne: '<circle cx="50" cy="35" r="14"/><path d="M22 83 C22 63 35 55 50 55 C65 55 78 63 78 83"/>',
  groupe: '<circle cx="50" cy="33" r="12"/><circle cx="24" cy="43" r="9"/><circle cx="76" cy="43" r="9"/><path d="M30 80 C30 62 40 55 50 55 C60 55 70 62 70 80"/><path d="M10 78 C10 66 16 60 24 60 M90 78 C90 66 84 60 76 60"/>',
  posture: '<circle cx="50" cy="18" r="9"/><path d="M50 29 L50 60 M34 40 L66 40 M50 60 L40 86 M50 60 L60 86"/>',
  tete: '<circle cx="50" cy="52" r="15"/><path d="M28 88 C28 74 38 70 50 70 C62 70 72 74 72 88"/><path d="M50 30 L50 10 M41 19 L50 10 L59 19"/>',
  equilibre: '<path d="M50 16 L50 80 M32 82 L68 82 M18 30 L82 30"/><path d="M18 30 L8 54 L28 54 Z M82 30 L72 54 L92 54 Z"/>',
  fluidite: '<path d="M10 38 C22 26 36 50 50 38 C64 26 78 50 90 38"/><path d="M10 62 C22 50 36 74 50 62 C64 50 78 74 90 62"/>',
  escalier: '<path d="M14 82 L14 66 L34 66 L34 50 L54 50 L54 34 L74 34 L74 18 L88 18"/><path d="M14 82 L88 82"/>',
  lieu: '<path d="M50 87 C50 87 24 58 24 40 C24 24 36 13 50 13 C64 13 76 24 76 40 C76 58 50 87 50 87 Z"/><circle cx="50" cy="40" r="9"/>',
  liste: '<path d="M28 18 L72 18 L72 84 L28 84 Z"/><path d="M38 38 L62 38 M38 52 L62 52 M38 66 L54 66"/>',
  photo: '<path d="M14 34 L33 34 L39 23 L61 23 L67 34 L86 34 L86 77 L14 77 Z"/><circle cx="50" cy="55" r="13"/>',
  camera: '<path d="M12 31 L64 31 L64 71 L12 71 Z"/><path d="M64 45 L88 32 L88 70 L64 57"/>',
  paiement: '<path d="M33 12 L67 12 L67 88 L33 88 Z"/><path d="M44 78 L56 78"/><path d="M41 47 L48 55 L60 37"/>',
  info: '<circle cx="50" cy="50" r="34"/><path d="M50 44 L50 70"/><circle cx="50" cy="31" r="2.5"/>',
  coeur: '<path d="M50 82 C20 62 13 45 21 32 C29 20 45 23 50 36 C55 23 71 20 79 32 C87 45 80 62 50 82 Z"/>'
};
window.MANQUES = [];
// début d'une scène : un peu avant sa première phrase, mais jamais avant la fin de la phrase précédente (une voix
// qui enchaîne sans pause ne doit pas voir la transition couper la fin de la scène d'avant)
const CLES = Object.keys(T.phrases);
function debutScene(cle, mot) {
  // data-demot : la scène commence sur un MOT de la phrase (ex. « âge » : le « 14+ » arrive quand la voix le dit)
  if (mot) { const m = (T.mots[cle] || []).find((x) => normal(x[0]).startsWith(normal(mot))); if (m) return Math.max(0, m[1] - 0.3); window.MANQUES.push('scène ' + cle + ' : ' + mot); }
  const i = CLES.indexOf(cle), d = T.phrases[cle][0];
  const finAvant = i > 0 ? T.phrases[CLES[i - 1]][1] - 0.05 : 0;
  return Math.max(0, Math.min(d, Math.max(d - 0.55, finAvant)));
}
// instant d'un élément : début du mot (data-mot) dans sa phrase, sinon début de la phrase, + data-retard
function instant(el) {
  const cle = el.dataset.voix, mots = T.mots[cle] || [];
  if (!T.phrases[cle]) { window.MANQUES.push('phrase ' + cle); return 0; }
  let t = T.phrases[cle][0];
  if (el.dataset.mot) { const m = mots.find((x) => normal(x[0]).startsWith(normal(el.dataset.mot))); if (m) t = m[1]; else window.MANQUES.push(cle + ' : ' + el.dataset.mot); }
  return t + Number(el.dataset.retard || 0);
}
// préparation : mots, lettres, volets, médaillons, positions
document.querySelectorAll('[data-anim="mots"]').forEach((el) => {
  el.innerHTML = el.textContent.split(/(\s+)/).map((p) => (/^\s+$/.test(p) ? p : '<span class="mot">' + p + '</span>')).join('');
});
document.querySelectorAll('[data-anim="lettres"]').forEach((el) => {
  el.innerHTML = el.textContent.split(/(\s+)/).map((p) => (/^\s+$/.test(p) ? p : '<span class="mot">' + [...p].map((c) => '<span class="lettre">' + c + '</span>').join('') + '</span>')).join('');
});
document.querySelectorAll('[data-anim="bloc"]').forEach((el) => {
  const c = document.createElement('span'); c.className = 'contenu'; c.style.display = 'inline-block';
  while (el.firstChild) c.appendChild(el.firstChild);
  el.appendChild(c); const b = document.createElement('i'); b.className = 'balai'; el.appendChild(b);
});
document.querySelectorAll('.medaillon').forEach((el) => {
  if (el.dataset.photo) el.classList.add('photo-med');
  el.innerHTML = '<b class="onde"></b><span class="anneau"></span><span class="disque">' + (el.dataset.photo ? '<img src="medaillons/' + el.dataset.photo + '.jpg">' : '<svg viewBox="0 0 100 100">' + (SYMBOLES[el.dataset.symbole] || '') + '</svg>') + '</span>' + (el.dataset.num ? '<span class="num">' + el.dataset.num + '</span>' : '');
});
document.querySelectorAll('[data-pos]').forEach((el) => {
  const [x, y] = (LARGE ? el.dataset.posl : el.dataset.pos).split(',').map(Number);
  if (el.dataset.l) { el.style.width = el.dataset.l + 'px'; el.style.height = el.dataset.h + 'px'; }
  const r = el.getBoundingClientRect();
  el.style.left = (x - (Number(el.dataset.l) || r.width) / 2) + 'px'; el.style.top = (y - (Number(el.dataset.h) || r.height) / 2) + 'px';
});
// chaque scène : un « plateau » (texte, médaillons, vignettes) qui bouge en parallaxe, et des blocs de fond
const scenes = [...document.querySelectorAll('.scene')].map((el, i) => {
  const plateau = document.createElement('div'); plateau.className = 'plateau';
  [...el.children].forEach((c) => { if (!c.classList.contains('photo') && !c.classList.contains('mosaique')) plateau.appendChild(c); });
  const r = graine(97 + i * 31), formes = [];
  const arriere = document.createElement('div'), avant = document.createElement('div'); arriere.className = avant.className = 'fond-blocs';
  const types = ['plein', 'voile', 'contour', 'voile', 'contour rond', 'contour rond', 'plein', 'voile'];  // (pas de fines lignes : elles barraient le texte)
  types.forEach((ty, k) => {
    const f = document.createElement('div'); f.className = 'forme ' + ty;
    const grand = ty.startsWith('plein') ? 160 + r() * 260 : 90 + r() * 240;
    const l = ty === 'lame' ? 300 + r() * 300 : grand, h = ty.includes('rond') ? l : ty === 'lame' ? 2 : grand * (0.5 + r() * 0.9);
    // positions réparties tout autour (bords et coins), jamais au centre du texte
    const cote = k % 4, x = cote === 0 ? -l * 0.3 + r() * W * 0.25 : cote === 1 ? W * 0.72 + r() * W * 0.2 : r() * W * 0.9, y = cote === 2 ? -h * 0.3 + r() * H * 0.18 : cote === 3 ? H * 0.82 + r() * H * 0.12 : r() * H * 0.85;
    f.style.width = l + 'px'; f.style.height = h + 'px'; f.style.left = x + 'px'; f.style.top = y + 'px';
    (ty.startsWith('plein') ? arriere : avant).appendChild(f);
    formes.push({ f, retard: 0.15 + k * 0.11, rot: (r() - 0.5) * 30, vit: 0.25 + r() * 0.4, amp: 18 + r() * 34, ph: r() * 6.28 });
  });
  el.insertBefore(arriere, el.firstChild); el.appendChild(avant); el.appendChild(plateau);
  return { el, plateau, formes, debut: debutScene(el.dataset.de, el.dataset.demot), transition: el.dataset.transition || 'fondu',
    photos: [...el.querySelectorAll('.photo, .photo-m')],
    elements: [...el.querySelectorAll('[data-voix]')].map((x) => ({ x, t: instant(x), anim: x.dataset.anim || 'monte',
      mots: [...x.querySelectorAll(x.dataset.anim === 'lettres' ? '.lettre' : '.mot')], contenu: x.querySelector(':scope > .contenu'), balai: x.querySelector(':scope > .balai'),
      onde: x.querySelector(':scope > .onde'), anneau: x.querySelector(':scope > .anneau'), ph: (x.dataset.symbole || x.textContent).length,
      // data-finvoix (+ data-finmot) : l'élément s'efface quand la voix dit ce mot (deux images à la même place, l'une après l'autre)
      tf: x.dataset.finvoix ? instant({ dataset: { voix: x.dataset.finvoix, mot: x.dataset.finmot || '', retard: x.dataset.finretard || 0 } }) : null })) };
});
scenes.forEach((s, i) => { s.fin = i + 1 < scenes.length ? scenes[i + 1].debut + 1.0 : T.duree + 10; });
scenes.forEach((s) => s.photos.forEach((p) => { const img = p.querySelector('img'); if (p.dataset.cadrage && img) img.style.objectPosition = p.dataset.cadrage; }));
// barres de transition, poussière de lumière
const barres = document.getElementById('barres'); for (let k = 0; k < 7; k++) barres.appendChild(document.createElement('i'));
const lesBarres = [...barres.children];
const poussiere = document.getElementById('poussiere'), rp = graine(5), grains = [];
for (let k = 0; k < 34; k++) { const g = document.createElement('i'); poussiere.appendChild(g); grains.push({ g, x: rp() * W, y: rp() * H, v: 14 + rp() * 30, a: 0.15 + rp() * 0.4, ph: rp() * 6.28, d: 0.4 + rp() * 0.8 }); }
const fmt = (n) => Math.round(n).toLocaleString('fr-FR').replace(new RegExp('[' + String.fromCharCode(0xa0, 0x202f) + ']', 'g'), ' ');
function animer(e, t) {
  const q = (t - e.t) / 0.85, x = e.x, s = x.style;
  switch (e.anim) {
    case 'glisse': { const k = sortie(q); s.opacity = k; s.transform = 'translateX(' + (-90 * (1 - k)) + 'px)'; s.letterSpacing = (0.42 + 0.5 * (1 - k)) + 'em'; break; }
    case 'zoom': { const k = sortie(q); s.opacity = k; s.transform = 'perspective(1200px) translateY(' + (80 * (1 - k)) + 'px) rotateY(' + (-70 * (1 - k)) + 'deg) scale(' + (0.8 + 0.2 * k) + ')'; break; }
    case 'leve': { // bloc qui se soulève : couché vers l'arrière, il se redresse en montant, puis flotte
      const k = sortie((t - e.t) / 1.1); s.opacity = Math.min(1, (t - e.t) * 2.5);
      s.transform = 'perspective(1400px) translateY(' + (220 * (1 - k) + 7 * Math.sin((t - e.t) * 1.3)) + 'px) rotateX(' + (68 * (1 - k)) + 'deg) rotateY(' + (2.5 * Math.sin((t - e.t) * 0.8) * k) + 'deg) scale(' + (0.86 + 0.14 * k) + ')'; break; }
    case 'bloc': { // un volet blanc balaie, puis se retire en révélant le texte
      const u = (t - e.t) / 0.8, a = sortie(u / 0.45), b = sortie((u - 0.45) / 0.55);
      s.opacity = 1; e.balai.style.transformOrigin = b > 0 ? '100% 50%' : '0 50%'; e.balai.style.transform = 'scaleX(' + (b > 0 ? 1 - b : a) + ')';
      e.contenu.style.opacity = a >= 1 ? 1 : 0; e.contenu.style.transform = 'translateX(' + (-30 * (1 - b)) + 'px)'; break; }
    case 'masque': { const k = sortie(q * 1.1); s.display = 'inline-block'; s.clipPath = 'inset(0 ' + (100 * (1 - k)) + '% 0 0)'; s.opacity = Math.min(1, k * 3); s.transform = 'translateX(' + (24 * (1 - k)) + 'px)'; break; }
    case 'trait': { const k = sortie(q); s.transform = 'scaleX(' + k + ')'; s.opacity = k > 0 ? 1 : 0; break; }
    case 'pop': { const k = ressort(q * 1.15); s.opacity = Math.min(1, Math.max(0, q * 3)); s.transform = 'translateY(' + (60 * (1 - k)) + 'px) rotate(' + (-10 * (1 - k)) + 'deg) scale(' + (0.4 + 0.6 * k) + ')'; break; }
    case 'compteur': { // data-depart (0), data-decimales (0, virgule française), data-duree (1,3 s)
      const k = sortie((t - e.t) / Number(x.dataset.duree || 1.3)), dep = Number(x.dataset.depart || 0), dec = Number(x.dataset.decimales || 0);
      const v = dep + (Number(x.dataset.valeur) - dep) * k; x.textContent = dec ? v.toFixed(dec).replace('.', ',') : fmt(v); x.style.display = 'inline-block'; x.style.transform = 'scale(' + (1 + 0.12 * Math.sin(Math.PI * lisse((t - e.t - 1.2) / 0.5))) + ')'; break; }
    case 'mots': { s.opacity = 1; e.mots.forEach((m, i) => { const k = sortie((t - e.t - i * 0.16) / 0.75); m.style.opacity = k; m.style.transform = 'perspective(800px) translateY(' + (60 * (1 - k)) + 'px) rotateX(' + (-70 * (1 - k)) + 'deg)'; m.style.filter = k < 1 ? 'blur(' + (8 * (1 - k)) + 'px)' : ''; }); break; }
    case 'lettres': { s.opacity = 1; e.mots.forEach((m, i) => { const k = sortie((t - e.t - i * 0.035) / 0.7); m.style.opacity = Math.min(1, k * 1.6); m.style.transform = 'perspective(600px) translateY(' + (70 * (1 - k)) + 'px) rotateX(' + (-95 * (1 - k)) + 'deg) scale(' + (1.3 - 0.3 * k) + ')'; }); break; }
    case 'medaillon': { // arrive en tournant avec un rebond, onde de choc, puis flotte ; l'anneau tourne sans cesse
      const d = t - e.t, k = ressort(d / 0.9); s.opacity = Math.min(1, d * 4);
      s.transform = 'translateY(' + (6 * Math.sin(d * 1.7 + e.ph)) + 'px) rotate(' + (-200 * (1 - sortie(d / 1.0))) + 'deg) scale(' + k + ')';
      e.anneau.style.transform = 'rotate(' + (d * 40) + 'deg) scale(' + (1 + 0.04 * Math.sin(d * 2)) + ')';
      const o = lisse((d - 0.2) / 1.2); e.onde.style.opacity = d > 0.2 ? 0.9 * (1 - o) : 0; e.onde.style.transform = 'scale(' + (1 + 1.4 * o) + ')'; break; }
    case 'vignette': { // photo encadrée : arrive de biais en se soulevant, puis flotte doucement
      const d = t - e.t, k = sortie(d / 1.2), rot = Number(x.dataset.rot || 0); s.opacity = Math.min(1, d * 3);
      s.transform = 'perspective(1400px) translateY(' + (260 * (1 - k) + 10 * Math.sin(d * 0.9 + rot)) + 'px) rotateX(' + (55 * (1 - k)) + 'deg) rotate(' + (rot * (2 - k) + 1.5 * Math.sin(d * 0.7)) + 'deg) scale(' + (0.7 + 0.3 * k) + ')';
      const img = x.querySelector('img'); img.style.transform = 'scale(' + (1.25 - 0.15 * Math.min(1, d / 8)) + ')'; break; }
    case 'nuage': { // photo lancée de loin (data-dx, data-dy) en tournant, qui se pose à sa place puis flotte
      const d = t - e.t, k = sortie(d / 1.4), rot = Number(x.dataset.rot || 0); s.opacity = Math.min(1, d * 3);
      s.transform = 'translate(' + (Number(x.dataset.dx || 0) * (1 - k)) + 'px,' + (Number(x.dataset.dy || 0) * (1 - k) + 8 * Math.sin(d + rot)) + 'px) rotate(' + (rot + 40 * (1 - k)) + 'deg) scale(' + (0.4 + 0.6 * k) + ')'; break; }
    case 'ouvre': { // porte : glisse sur le côté (data-sens = -1 gauche, 1 droite)
      const k = lisse((t - e.t) / 1.1); s.opacity = 1; s.transform = 'translateX(' + (Number(x.dataset.sens || 1) * 105 * k) + '%)'; break; }
    case 'trace': { // tracé SVG qui se dessine (data-duree, 1,6 s)
      const L = x.getTotalLength(), k = lisse((t - e.t) / Number(x.dataset.duree || 1.6)); s.opacity = 1; s.strokeDasharray = L; s.strokeDashoffset = L * (1 - k); break; }
    case 'defile': { // bande de photos qui défile sans fin (data-vitesse px/s)
      const d = t - e.t; s.opacity = Math.min(1, d * 2); s.transform = 'translateX(' + (-Number(x.dataset.vitesse || 120) * d) + 'px)'; break; }
    case 'tampon': { // tampon frappé : arrive grand, se plaque avec un petit choc
      const d = t - e.t, k = sortie(d / 0.35); s.opacity = Math.min(1, d * 6);
      s.transform = 'rotate(' + (Number(x.dataset.rot || -12)) + 'deg) scale(' + (2.6 - 1.6 * k + 0.06 * Math.sin(Math.min(1, d / 0.6) * Math.PI * 3) * (1 - Math.min(1, d / 0.6))) + ')'; break; }
    case 'deplace': { // va de (data-x0, data-y0) à (data-x1, data-y1) en data-duree secondes
      const k = lisse((t - e.t) / Number(x.dataset.duree || 1.3)), g = (a) => Number((LARGE && x.dataset[a + 'l'] !== undefined ? x.dataset[a + 'l'] : x.dataset[a]) || 0); s.opacity = 1;  // (data-y1l… : valeur du format horizontal)
      s.transform = 'translate(' + (g('x0') + (g('x1') - g('x0')) * k) + 'px,' + (g('y0') + (g('y1') - g('y0')) * k) + 'px)'; break; }
    default: { const k = sortie(q); s.opacity = k; s.transform = 'translateY(' + (50 * (1 - k)) + 'px)'; }
  }
  if (e.tf !== null && t > e.tf) s.opacity = (s.opacity === '' ? 1 : Number(s.opacity)) * (1 - lisse((t - e.tf) / 0.35));
}
function avant(e) {
  const s = e.x.style;
  if (e.anim === 'compteur') { const dec = Number(e.x.dataset.decimales || 0), dep = Number(e.x.dataset.depart || 0); e.x.textContent = dec ? dep.toFixed(dec).replace('.', ',') : fmt(dep); return; }
  if (e.anim === 'mots' || e.anim === 'lettres') { s.opacity = 1; e.mots.forEach((m) => { m.style.opacity = 0; }); return; }
  if (e.anim === 'bloc') { s.opacity = 1; e.contenu.style.opacity = 0; e.balai.style.transform = 'scaleX(0)'; return; }
  if (e.anim === 'ouvre') { s.opacity = 1; s.transform = ''; return; }
  if (e.anim === 'trace') { const L = e.x.getTotalLength(); s.strokeDasharray = L; s.strokeDashoffset = L; return; }
  s.opacity = 0;
}
function entree(s, t, premier) {
  const k = lisse((t - s.debut) / 0.9), st = s.el.style;
  st.opacity = ''; st.clipPath = '';
  if (premier) { st.opacity = lisse(t / 1.2); return; }
  if (k >= 1) return;
  if (s.transition === 'fondu') st.opacity = k;
  else if (s.transition === 'rideau') st.clipPath = 'inset(0 0 0 ' + (100 * (1 - k)) + '%)';
  else if (s.transition === 'volet') st.clipPath = LARGE ? 'inset(' + (100 * (1 - k)) + '% 0 0 0)' : 'inset(0 0 ' + (100 * (1 - k)) + '% 0)';
  else if (s.transition === 'cercle') st.clipPath = 'circle(' + (150 * k) + '% at 50% 50%)';
}
// barres (rapides : la voix peut enchaîner sans pause) : sept blocs montent couvrir l'image, la scène change dessous, puis ils s'envolent vers le haut
function rendreBarres(t) {
  let actif = null; scenes.forEach((s) => { if (s.transition === 'barres' && t > s.debut - 0.3 && t < s.debut + 0.8) actif = s; });
  lesBarres.forEach((b, j) => {
    if (!actif) { b.style.visibility = 'hidden'; return; }
    const u = t - (actif.debut - 0.3), c = sortie((u - j * 0.02) / 0.18), o = sortie((u - 0.5 - j * 0.05) / 0.35);
    b.style.visibility = c > 0 && o < 1 ? 'visible' : 'hidden';
    b.style.transform = 'translateY(' + (o > 0 ? -100 * o : 100 * (1 - c)) + '%)';
  });
}
const eclat = document.getElementById('eclat'), lueur = document.getElementById('lueur'), reflets = [...document.querySelectorAll('.bouton i')];
window.rendre = (t) => {
  scenes.forEach((s, i) => {
    const visible = t >= s.debut && t < s.fin;
    s.el.style.visibility = visible ? 'visible' : 'hidden';
    s.el.style.zIndex = i + 1;
    if (!visible) return;
    entree(s, t, i === 0);
    const p = (t - s.debut) / Math.max(1, s.fin - s.debut), d = t - s.debut;
    // la scène suivante arrive : celle-ci recule et s'enfonce
    const suivante = scenes[i + 1], k2 = suivante && t > suivante.debut ? lisse((t - suivante.debut) / 0.9) : 0;
    const ke = sortie(d / 1.2);
    // caméra : le plateau (texte, médaillons) dérive en 3D, les photos dans l'autre sens (parallaxe)
    const ry = 2.4 * Math.sin(t * 0.42 + i), rx = 1.6 * Math.cos(t * 0.35 + i), dx = 12 * Math.sin(t * 0.3 + i), dy = 9 * Math.cos(t * 0.27 + i);
    s.plateau.style.transform = 'perspective(2200px) translate(' + dx + 'px,' + (dy - 90 * k2) + 'px) rotateY(' + ry + 'deg) rotateX(' + rx + 'deg) scale(' + ((1.07 - 0.07 * ke) * (1 - 0.08 * k2)) + ')';
    s.plateau.style.opacity = 1 - 0.6 * k2;
    s.photos.forEach((ph, k) => {
      const img = ph.querySelector('img'); if (!img) return;
      const m = ph.dataset.mouvement || (ph.classList.contains('photo-m') ? 'mosaique' : 'recule');
      const px = -1.6 * dx, py = -1.6 * dy;
      if (m === 'mosaique') { // les cases se soulèvent une à une
        const e2 = sortie((t - s.debut - Number(ph.parentElement.dataset.pas || 0.12) * k) / 1.0);  // data-pas : écart entre deux cases
        ph.style.transform = 'perspective(1200px) translateY(' + (200 * (1 - e2)) + 'px) rotateX(' + (80 * (1 - e2)) + 'deg)'; ph.style.opacity = e2;
        img.style.transform = 'scale(' + (1.3 - 0.2 * lisse(d / 6)) + ')'; img.style.opacity = 0.75; return; }
      ph.style.transform = 'translateX(' + ((LARGE ? 140 : 0) * (1 - ke)) + 'px) translateY(' + ((LARGE ? 0 : -120) * (1 - ke) + 60 * k2) + 'px)';
      let tr = 'translate(' + px + 'px,' + py + 'px) ';
      if (m === 'avance') tr += 'scale(' + (1.0 + 0.18 * p) + ')';
      else if (m === 'panorama') tr += 'scale(1.12) translateX(' + ((LARGE ? 60 : 70) * (2 * p - 1)) + 'px)';
      else tr += 'scale(' + (1.2 - 0.16 * p) + ')';
      img.style.transform = tr;
    });
    // blocs de fond : se soulèvent l'un après l'autre, puis dérivent et tournent lentement
    s.formes.forEach((f) => {
      const e2 = sortie((d - f.retard) / 1.1), u = t * f.vit + f.ph;
      f.f.style.opacity = e2;
      f.f.style.transform = 'perspective(1200px) translate(' + (f.amp * Math.sin(u) - 1.2 * dx) + 'px,' + (300 * (1 - e2) + f.amp * Math.cos(u * 0.8) - 120 * k2) + 'px) rotateX(' + (75 * (1 - e2)) + 'deg) rotate(' + (f.rot * (1 - e2) * 2 + 6 * Math.sin(u * 0.6)) + 'deg)';
    });
    s.elements.forEach((e) => (t < e.t ? avant(e) : animer(e, t)));
  });
  rendreBarres(t);
  grains.forEach((g) => { const y = ((g.y - t * g.v) % H + H) % H; g.g.style.transform = 'translate(' + (g.x + 20 * Math.sin(t * 0.5 + g.ph)) + 'px,' + y + 'px) scale(' + g.d + ')'; g.g.style.opacity = g.a * (0.5 + 0.5 * Math.sin(t * 1.3 + g.ph)); });
  lueur.style.transform = 'translate(' + (W * 0.3 * Math.sin(t * 0.21)) + 'px,' + (H * 0.25 * Math.cos(t * 0.17)) + 'px)';
  const c = (t % 9) / 9;
  eclat.style.left = (-40 + 160 * lisse(Math.min(1, c * 2.4))) + '%'; eclat.style.transform = 'skewX(-12deg)';
  reflets.forEach((r) => { r.style.left = (-40 + 180 * lisse(Math.min(1, ((t % 3) / 3) * 1.6))) + '%'; });
};
window.rendre(0);
