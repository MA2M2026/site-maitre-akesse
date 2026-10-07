// Faux serveur Supabase / EmailJS pour tester le site comme un visiteur, SANS toucher à la vraie base.
const SUPA = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
function brancher(page, donnees, journal) {
  const user = { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'admin@test.ci' };
  return page.route(/^https?:\/\/(?!127\.0\.0\.1)(?!dfhghgmwmxiguhtxtsle)/, r => r.abort()).then(() => Promise.all([
    page.route(SUPA + '/**', async (route) => {
      const req = route.request(), url = new URL(req.url()), m = req.method();
      const objet = /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
      const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'content-range': '0-0/' + (Array.isArray(body) ? body.length : 1), ...extra }, body: JSON.stringify(body) });
      if (url.pathname.startsWith('/auth/v1/token')) { const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
        const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 }) + '.c2lnbmF0dXJl';
        return json({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'faux', user }); }
      if (url.pathname.startsWith('/auth/v1/user')) return json(user);
      if (url.pathname.startsWith('/auth/v1/')) return json({});
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const nom = url.pathname.split('/').pop();
        journal.push(['rpc', nom, req.postData()]);
        return json(donnees.rpc && nom in donnees.rpc ? donnees.rpc[nom] : []);
      }
      if (url.pathname.startsWith('/rest/v1/')) {
        const table = url.pathname.split('/')[3];
        if (m !== 'GET' && m !== 'HEAD') {
          journal.push([m, table, url.search, req.postData()]);
          if (m === 'PATCH') { const maj = JSON.parse(req.postData() || '{}'); (donnees.tables[table] || []).forEach(l => { let ok = true; for (const [k, v] of url.searchParams) if (/^eq\./.test(v) && String(l[k]) !== v.slice(3)) ok = false; if (ok) Object.assign(l, maj); }); }
          return route.fulfill({ status: 204, body: '' });
        }
        let lignes = (donnees.tables[table] || []).slice();
        for (const [k, v] of url.searchParams) { if (/^eq\./.test(v)) lignes = lignes.filter(l => String(l[k]) === v.slice(3)); }
        if (objet) return lignes[0] ? json(lignes[0]) : json({ code: 'PGRST116', message: 'aucune ligne' }, 406);
        return json(lignes);
      }
      return json({});
    }),
    page.route(/127\.0\.0\.1:\d+\/api\//, async (route) => {
      const u = new URL(route.request().url());
      journal.push(['API', u.pathname, route.request().postData()]);
      const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000, email: 'admin@test.ci' }) + '.c2lnbmF0dXJl';
      const rep = (donnees.api && donnees.api[u.pathname]) || (u.pathname === '/api/connexion-protegee' ? { access_token: jeton, refresh_token: 'faux' } : { ok: true });
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rep) });
    }),
    page.route(/api\.emailjs\.com/, async (route) => { journal.push(['EMAIL', route.request().postData()]); route.fulfill({ status: 200, body: 'OK' }); })
  ]));
}
module.exports = { brancher };
