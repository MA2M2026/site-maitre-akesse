// Site vivant (08/11/2026, phase 3 V4 ; middleware.js tirageVisiteur / vitrineAccueil), base SIMULÉE, 600 visites :
//  - une mannequin hors vitrine (mineure sans accord d'un parent) n'apparaît JAMAIS : couverture, « À la une », visages ;
//  - « À la une » épinglée par l'agence ; chaque mannequin de la vitrine a son tour en couverture (aucune à 0, aucune
//    à plus de 2 fois sa part) ; jamais deux fois de suite la même pour un visiteur ;
//  - robots (Google, WhatsApp) et première visite : la même page, 20 fois de suite ; témoin ma2m_v créé par la page
//    (groupe donné par le serveur), seulement renouvelé par le serveur, jamais aux robots ; en-tête x-ma2m-variant ;
//  - données posées dans la page (JSON) : la vitrine seule (jamais la mineure sans accord) ;
//  - fichier SQL pas collé : toutes les mannequins, comme avant.
import { fileURLToPath, pathToFileURL } from 'url'; import path from 'path'; import fs from 'fs';
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
globalThis.MA2M_SANS_MEMOIRE = true;
const CF = 'https://photos.maitreakessemodelmanagement.com/';
const profils = [
  { id: 'v1', full_name: 'AWA EPINGLEE', category: 'femme', featured: true },
  { id: 'v2', full_name: 'MARIAM DEUX', category: 'femme' }, { id: 'v3', full_name: 'GRACE TROIS', category: 'femme' },
  { id: 'v4', full_name: 'NADIA QUATRE', category: 'femme' }, { id: 'v5', full_name: 'KOFFI CINQ', category: 'homme' },
  { id: 'v6', full_name: 'YAO SIX', category: 'homme' }, { id: 'm1', full_name: 'MINEURE SANSACCORD', category: 'femme' }];
let vitrine = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'];
globalThis.fetch = async (u) => {
  u = String(u); const json = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
  if (u.includes('supabase.co')) {
    if (u.includes('rpc/vitrine_eligibles')) return vitrine === 'panne' ? new Response('{"message":"erreur"}', { status: 503 }) : vitrine ? json(vitrine.map((id) => ({ model_id: id }))) : new Response('{"code":"PGRST202"}', { status: 404 });
    if (/mot_responsable|casting_projets|partenaires|instagram_posts_cache|agenda_public|reglages_site|model_photos\?|traductions_en/.test(u)) return json([]);
    if (u.includes('model_profiles')) return json(profils);
    return json(profils.map((p) => ({ model_id: p.id, url: CF + p.id + '/miniatures/1-a-w.jpg', url_petite: null })));
  }
  const chemin = new URL(u).pathname.startsWith('/en') ? 'en/index.html' : 'index.html';
  return new Response(fs.readFileSync(path.join(racine, chemin), 'utf8'), { headers: { 'content-type': 'text/html; charset=utf-8' } });
};
const copie = path.join(racine, 'mw-vivant-' + process.pid + '.mjs'); fs.copyFileSync(path.join(racine, 'middleware.js'), copie);
process.on('exit', () => { try { fs.unlinkSync(copie); } catch (e) { /* déjà retirée */ } });
const mw = (await import(pathToFileURL(copie).href)).default;
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const NAV = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1';
const visite = async (ua, temoin) => { const r = await mw(new Request('https://www.maitreakessemodelmanagement.com/', { headers: Object.assign({ 'user-agent': ua }, temoin ? { cookie: temoin } : {}) })); return { r, h: await r.text() }; };
const couv = (h) => (h.match(/data-modele="([^"]+)"/) || [])[1];
const une = (h) => (h.match(/id="une-nom">([^<]*)</) || [])[1];
const grilles = (h) => (h.match(/id="grille-femmes">[\s\S]*?id="grille-hommes">[\s\S]*?<\/div>/) || [''])[0];

// 600 visites : 6 groupes × 100 visites qui se suivent
const vues = {}; let mineure = false, deuxFois = false, epingle = true, temoinsOk = true, variantes = new Set();
for (let g = 0; g < 6; g++) {
  let temoin = null, avant = null;
  for (let n = 0; n < 100; n++) {
    const { r, h } = await visite(NAV, temoin);
    const pose = (r.headers.get('set-cookie') || '').match(/ma2m_v=([0-5]\.\d+)/);
    // première visite : pas de témoin du serveur (la page le crée avec le groupe donné, sauf refus des cookies)
    if (n === 0) { const g = (h.match(/"groupe":([0-5])/) || [])[1]; if (pose || g === undefined) temoinsOk = false; temoin = 'ma2m_v=' + g + '.1'; }
    else { if (!pose || !/Max-Age=2592000/.test(r.headers.get('set-cookie')) || !/SameSite=Lax/.test(r.headers.get('set-cookie'))) temoinsOk = false; temoin = 'ma2m_v=' + (pose ? pose[1] : '0.1'); }
    variantes.add(r.headers.get('x-ma2m-variant'));
    const c = couv(h); vues[c] = (vues[c] || 0) + 1;
    if (/SANSACCORD|"m1"/.test(h)) mineure = true;
    if (n > 0 && c === avant) deuxFois = true;
    if (une(h) !== 'AWA EPINGLEE') epingle = false;
    avant = c;
  }
}
const autres = ['v2', 'v3', 'v4', 'v5', 'v6'], part = 600 / autres.length;
ok(!mineure, '600 visites : la mineure sans accord d’un parent n’apparaît JAMAIS (couverture, À la une, visages, photos d’ambiance, données de la page)');
ok(epingle, '« À la une » : toujours celle que l’agence a épinglée');
ok(autres.every((id) => vues[id] > 0 && vues[id] <= 2 * part), 'chacune son tour en couverture : ' + autres.map((id) => id + '=' + (vues[id] || 0)).join(' ') + ' (part attendue ' + part + ')');
ok(!deuxFois, 'jamais deux fois de suite la même couverture pour un même visiteur');
ok(temoinsOk && variantes.size > 6, 'témoin ma2m_v : créé par la page à la première visite (groupe donné), puis renouvelé (30 jours, SameSite=Lax) ; ' + variantes.size + ' variantes (en-tête x-ma2m-variant)');
// robots : la même page 20 fois, sans témoin
for (const [nom, ua] of [['Google', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'], ['WhatsApp', 'WhatsApp/2.23.20.0 A']]) {
  const pages = new Set(); let temoin = false;
  for (let i = 0; i < 20; i++) { const { r, h } = await visite(ua); pages.add(couv(h) + '|' + une(h) + '|' + grilles(h)); if (r.headers.get('set-cookie')) temoin = true; }
  ok(pages.size === 1 && !temoin, nom + ' : la même page 20 fois de suite, aucun témoin');
}
// première visite d'un navigateur : visages dans l'ordre de base (comme les robots)
const base = grilles((await visite('WhatsApp/2.23.20.0 A')).h);
ok(grilles((await visite(NAV)).h) === base, 'première visite : les visages dans le même ordre que pour les robots');
// caches : copies séparées par valeur du témoin (Vary: Cookie)
const cacheVisiteur = (await visite(NAV, 'ma2m_v=1.2')).r.headers.get('cache-control'), cacheRobot = (await visite('WhatsApp/2.23.20.0 A')).r.headers.get('cache-control');
ok(/s-maxage=\d+/.test(cacheVisiteur) && /public/.test(cacheRobot) && /Cookie/.test((await visite(NAV)).r.headers.get('vary')), 'caches : même règle que les autres pages (contrôle W3-CACHE), copies séparées par témoin (Vary: Cookie) (' + cacheVisiteur + ' / ' + cacheRobot + ')');
ok(grilles((await visite(NAV, 'ma2m_v=3.4')).h) !== base, 'visite suivante : l’ordre des visages change');
// premières couvertures des 6 groupes : différentes même quand le nombre de mannequins est un multiple de 7 ou de 3
const R = globalThis.RenduBook;
const repartition = [7, 3, 6, 12].every((n) => new Set([0, 1, 2, 3, 4, 5].map((g) => R.decalageGroupe(g, n) % n)).size === Math.min(6, n));
ok(repartition, 'les 6 groupes de visiteurs commencent chacun ailleurs dans la liste (7, 3, 6, 12 mannequins)');
// fichier pas collé : comme avant (toutes)
vitrine = null;
// (nouvelle copie du programme : la liste gardée en mémoire 3 minutes par la première est ignorée)
const copie2 = path.join(racine, 'mw-vivant2-' + process.pid + '.mjs'); fs.copyFileSync(path.join(racine, 'middleware.js'), copie2);
process.on('exit', () => { try { fs.unlinkSync(copie2); } catch (e) { /* déjà retirée */ } });
const mw2 = (await import(pathToFileURL(copie2).href)).default;
const vuesAvant = new Set();
for (let i = 0; i < 40; i++) { const r = await mw2(new Request('https://www.maitreakessemodelmanagement.com/', { headers: { 'user-agent': NAV, cookie: 'ma2m_v=2.' + (i + 1) } })); vuesAvant.add(couv(await r.text())); }
ok(vuesAvant.has('m1'), 'fichier SQL pas encore collé : toutes les mannequins, comme avant');
// base en panne au moment de lire la vitrine : par prudence, personne (jamais la mineure sans accord)
vitrine = 'panne';
const copie3 = path.join(racine, 'mw-vivant3-' + process.pid + '.mjs'); fs.copyFileSync(path.join(racine, 'middleware.js'), copie3);
process.on('exit', () => { try { fs.unlinkSync(copie3); } catch (e) { /* déjà retirée */ } });
const mw3 = (await import(pathToFileURL(copie3).href)).default;
let enPanne = false;
for (let i = 0; i < 20; i++) { const r = await mw3(new Request('https://www.maitreakessemodelmanagement.com/', { headers: { 'user-agent': NAV, cookie: 'ma2m_v=4.' + (i + 1) } })); if (r && /SANSACCORD|"m1"/.test(await r.text())) enPanne = true; }
ok(!enPanne, 'base en panne au moment de lire la vitrine : la mineure sans accord n’apparaît pas (prudence)');
console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
process.exit(ko ? 1 : 0);
