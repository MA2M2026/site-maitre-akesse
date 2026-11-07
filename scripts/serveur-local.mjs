#!/usr/bin/env node
// Serveur local d'essai (phase 2, 02/11/2026) : sert le dépôt comme Vercel (adresses sans .html) en passant par
// middleware.js, pour mesurer les pages AVANT la mise en ligne (node scripts/verify-dynamic.mjs --url http://127.0.0.1:PORT).
// Le serveur lit la VRAIE base en lecture seule (clé publique, mêmes lectures que le site) ; il n'écrit jamais.
// Usage : NODE_USE_ENV_PROXY=1 node scripts/serveur-local.mjs [port]
import http from 'node:http';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || 8787);
const SITE = 'https://www.maitreakessemodelmanagement.com';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain' };

function fichierDe(chemin) {
  let p = decodeURIComponent(chemin.split('?')[0]);
  if (p.includes('..')) return null;
  if (p.endsWith('/')) p += 'index';
  const candidats = [p, p + '.html'];
  for (const c of candidats) {
    const f = path.join(RACINE, c);
    if (f.startsWith(RACINE) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}
function reponseFichier(chemin) {
  const f = fichierDe(chemin);
  if (!f) return new Response('introuvable', { status: 404, headers: { 'content-type': 'text/plain' } });
  return new Response(fs.readFileSync(f), { status: 200, headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache, must-revalidate' } });
}

// les demandes du middleware vers le site lui-même restent ici ; le reste (base) part pour de vrai, en lecture
const vraiFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  const url = new URL(String(u));
  if (url.origin === SITE) return reponseFichier(url.pathname);
  if (o && o.method && !/^(GET|HEAD)$/i.test(o.method) && !/\/rest\/v1\/rpc\//.test(url.pathname)) throw new Error('écriture refusée (serveur local)');
  return vraiFetch(u, o);
};
const copie = path.join(RACINE, 'mw-local-' + process.pid + '.mjs');
fs.copyFileSync(path.join(RACINE, 'middleware.js'), copie);
process.on('exit', () => { try { fs.unlinkSync(copie); } catch (e) { /* déjà retirée */ } });
['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => process.exit(0)));
const { default: middleware, config } = await import(pathToFileURL(copie).href);
const motifs = config.matcher.map((m) => new RegExp('^' + m.replace(/[.]/g, '\\.').replace(/:[a-z]+\*/g, '.*').replace(/:[a-z]+/g, '[^/]+') + '$'));

http.createServer(async (req, res) => {
  try {
    // (seulement un chemin de CE site : une adresse complète venue d'ailleurs n'est jamais suivie)
    const url = new URL(/^\/(?!\/)/.test(req.url) ? req.url : '/', SITE);
    if (url.origin !== SITE) throw new Error('adresse refusée');
    let rep;
    if (motifs.some((m) => m.test(url.pathname))) {
      const r = await middleware(new Request(url.toString(), { method: req.method, headers: req.headers }));
      if (r && r.headers.get('x-middleware-rewrite')) rep = reponseFichier(new URL(r.headers.get('x-middleware-rewrite')).pathname);
      else rep = r;
    }
    if (!rep) rep = reponseFichier(url.pathname);
    const entetes = {};
    rep.headers.forEach((v, k) => { if (!/^(content-length|content-encoding|location)$/i.test(k)) entetes[k] = v; });
    const loc = rep.headers.get('location');
    if (loc) entetes.location = loc.replace(SITE, '');
    let corps = Buffer.from(await rep.arrayBuffer());
    // (compression comme Vercel, pour des mesures de vitesse réalistes)
    if (/gzip/.test(req.headers['accept-encoding'] || '') && /text|javascript|json|svg/.test(entetes['content-type'] || '')) { corps = zlib.gzipSync(corps); entetes['content-encoding'] = 'gzip'; }
    res.writeHead(rep.status, entetes);
    res.end(corps);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' }); res.end(String(e));
  }
}).listen(PORT, '127.0.0.1', () => console.log('serveur local : http://127.0.0.1:' + PORT));
