// Faux serveur Supabase / EmailJS pour tester le site comme un visiteur, SANS toucher à la vraie base.
const SUPA = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
// Portail d'administration (donnees.portail = { aal, facteurs }) : double authentification imitée.
// Le code « 000000 » est refusé ; tout autre code à 6 chiffres est accepté.
function brancher(page, donnees, journal) {
  const portail = donnees.portail || null;
  const user = Object.assign({ id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'admin@test.ci' },
    portail ? { factors: portail.facteurs ? [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Portail' }] : [], user_metadata: portail.meta || {} } : {});
  const b64j = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jetonPortail = (aal) => b64j({ alg: 'HS256', typ: 'JWT' }) + '.' + b64j({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', email: 'admin@test.ci',
    exp: Math.floor(Date.now() / 1000) + 36000, aal, amr: aal === 'aal2' ? [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }, { method: 'totp', timestamp: Math.floor(Date.now() / 1000) }] : [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] }) + '.c2lnbmF0dXJl';
  const sessionPortail = (aal) => ({ access_token: jetonPortail(aal), token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'faux-' + aal, user });
  // Rattrapage des anciennes photos (Administration, js/photos.js) : il écrit dans la base 8 s après
  // l'accueil ; mis de côté sauf pour l'essai qui le vérifie (donnees.rattrapage = true).
  const sansRattrapage = donnees.rattrapage ? Promise.resolve() : page.addInitScript(() => { try { sessionStorage.setItem('ma2m_rattrapage_photos', '1'); } catch (e) { /* stockage bloqué */ } });
  return sansRattrapage.then(() => page.route(/^https?:\/\/(?!127\.0\.0\.1)(?!dfhghgmwmxiguhtxtsle)/, r => r.abort())).then(() => Promise.all([
    page.route(SUPA + '/**', async (route) => {
      const req = route.request(), url = new URL(req.url()), m = req.method();
      const objet = /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
      const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'content-range': '0-0/' + (Array.isArray(body) ? body.length : 1), 'access-control-expose-headers': 'content-range', ...extra }, body: JSON.stringify(body) });
      if (portail && url.pathname.startsWith('/auth/v1/token')) {
        const corps = JSON.parse(req.postData() || '{}');
        return json(sessionPortail(String(corps.refresh_token || '').includes('aal2') ? 'aal2' : (portail.aal || 'aal1')));
      }
      if (portail && url.pathname === '/auth/v1/factors' && m === 'POST') {
        journal.push(['MFA', 'inscription']);
        return json({ id: 'f-nouveau', type: 'totp', friendly_name: 'Portail', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"/>', secret: 'SECRETESSAI', uri: 'otpauth://totp/essai' } });
      }
      if (portail && /\/auth\/v1\/factors\/[^/]+\/challenge$/.test(url.pathname)) return json({ id: 'c1', expires_at: Math.floor(Date.now() / 1000) + 300 });
      if (portail && /\/auth\/v1\/factors\/[^/]+\/verify$/.test(url.pathname)) {
        const corps = JSON.parse(req.postData() || '{}');
        journal.push(['MFA', 'code', corps.code]);
        if (corps.code === '000000') return json({ code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' }, 422);
        user.factors = [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Portail' }];
        return json(sessionPortail('aal2'));
      }
      if (portail && /\/auth\/v1\/factors\/[^/]+$/.test(url.pathname) && m === 'DELETE') return json({ id: 'f' });
      if (url.pathname.startsWith('/auth/v1/token')) { const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
        const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 }) + '.c2lnbmF0dXJl';
        return json({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'faux', user }); }
      if (url.pathname.startsWith('/auth/v1/user')) return json(user);
      if (url.pathname.startsWith('/auth/v1/')) return json({});
      // stockage privé : dépôt d'un fichier (noté au journal), lien de lecture temporaire
      if (url.pathname.startsWith('/storage/v1/object/sign/')) return json({ signedURL: '/object/sign/' + url.pathname.slice(25) + '?token=essai' });
      // téléchargement d'un fichier privé : donnees.fichiers[chemin] = { type, octets } (sinon 404)
      if (url.pathname.startsWith('/storage/v1/object/') && m === 'GET') {
        const f = (donnees.fichiers || {})[decodeURIComponent(url.pathname.slice(19))];
        journal.push(['TELECHARGE', decodeURIComponent(url.pathname.slice(19))]);
        return f ? route.fulfill({ status: 200, contentType: f.type, body: f.octets }) : json({ statusCode: '404', error: 'not_found', message: 'Object not found' }, 400);
      }
      if (url.pathname.startsWith('/storage/v1/object/') && m === 'POST') {
        journal.push(['STOCKAGE', url.pathname.slice(19), req.headers()['content-type'] || '']);
        return json({ Key: url.pathname.slice(19), Id: 'f-' + journal.length });
      }
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const nom = url.pathname.split('/').pop();
        journal.push(['rpc', nom, req.postData()]);
        // photos_couverture_petites (24/10/2026) : mêmes photos que photos_couverture_mannequins
        // quand l'essai ne la décrit pas
        const cle = nom === 'photos_couverture_petites' && donnees.rpc && !(nom in donnees.rpc) && 'photos_couverture_mannequins' in donnees.rpc ? 'photos_couverture_mannequins' : nom;
        const valeur = donnees.rpc && cle in donnees.rpc ? donnees.rpc[cle] : [];
        if (valeur && valeur.erreur) return json({ message: valeur.erreur, code: 'P0001' }, 400);
        return json(typeof valeur === 'function' ? valeur(JSON.parse(req.postData() || '{}')) : valeur);
      }
      if (url.pathname.startsWith('/rest/v1/')) {
        const table = url.pathname.split('/')[3];
        if (m !== 'GET' && m !== 'HEAD') {
          journal.push([m, table, url.search, req.postData()]);
          // insert(…).select().single() : la vraie base renvoie la ligne créée
          if (m === 'POST' && objet) { const cree = JSON.parse(req.postData() || '{}'); return json({ id: 'nouveau-' + journal.length, ...(Array.isArray(cree) ? cree[0] : cree) }, 201); }
          if (m === 'POST' && /return=representation/.test(req.headers()['prefer'] || '')) {
            const cree = [].concat(JSON.parse(req.postData() || '{}')).map((l, i) => ({ id: 'nouveau-' + journal.length + '-' + i, ...l }));
            // lien personnel des convocations : tiré au hasard par la vraie base (valeur par défaut)
            if (table === 'convocation_participants') cree.forEach((l, i) => { if (!l.jeton) l.jeton = (String(journal.length) + 'abcdef' + i).padEnd(36, '0').slice(0, 36); });
            // upsert (resolution=merge-duplicates) : la ligne de même id est remplacée, pas doublée
            if (donnees.memoriser && /merge-duplicates/.test(req.headers()['prefer'] || '')) donnees.tables[table] = (donnees.tables[table] || []).filter((l) => !cree.some((c) => c.id === l.id));
            if (donnees.memoriser) (donnees.tables[table] = donnees.tables[table] || []).push(...cree);
            return json(cree, 201);
          }
          // donnees.refus[table] = message : la base refuse la modification (garde-fou)
          if (m === 'PATCH' && donnees.refus && donnees.refus[table]) return json({ message: donnees.refus[table], code: 'P0001' }, 400);
          if (m === 'PATCH') {
            const maj = JSON.parse(req.postData() || '{}'), touchees = [];
            (donnees.tables[table] || []).forEach(l => { let ok = true; for (const [k, v] of url.searchParams) { if (/^eq\./.test(v) && String(l[k]) !== v.slice(3)) ok = false; const dans = v.match(/^in\.\((.*)\)$/); if (dans && !dans[1].split(',').map(x => x.replace(/^"|"$/g, '')).includes(String(l[k]))) ok = false; } if (ok) { Object.assign(l, maj); touchees.push(l); } });
            // update(…).select() : la vraie base renvoie les lignes modifiées (aucune si refusé)
            if (/return=representation/.test(req.headers()['prefer'] || '')) return json(touchees);
          }
          // delete(…).select() : la vraie base renvoie les lignes supprimées ; base mémorisée : retirées
          if (m === 'DELETE' && /return=representation/.test(req.headers()['prefer'] || '')) {
            const garde = (l) => { for (const [k, v] of url.searchParams) { if (/^eq\./.test(v) && String(l[k]) !== v.slice(3)) return true; const dans = v.match(/^in\.\((.*)\)$/); if (dans && !dans[1].split(',').map(x => x.replace(/^"|"$/g, '')).includes(String(l[k]))) return true; } return false; };
            const avant = donnees.tables[table] || [];
            const parties = avant.filter((l) => !garde(l));
            if (donnees.memoriser) donnees.tables[table] = avant.filter(garde);
            return json(parties);
          }
          return route.fulfill({ status: 204, body: '' });
        }
        let lignes = (donnees.tables[table] || []).slice();
        for (const [k, v] of url.searchParams) { if (/^neq\./.test(v)) lignes = lignes.filter(l => String(l[k]) !== v.slice(4)); if (/^eq\./.test(v)) lignes = lignes.filter(l => (k === 'suivi' && !(k in l)) || String(l[k]) === v.slice(3)); if (/^(gte|lte)\./.test(v)) { const borne = v.slice(4), haut = v[0] === 'g'; lignes = lignes.filter(l => l[k] != null && (haut ? String(l[k]) >= borne : String(l[k]) <= borne)); } const dans = v.match(/^in\.\((.*)\)$/); if (dans) { const liste = dans[1].split(',').map(x => x.replace(/^"|"$/g, '')); lignes = lignes.filter(l => liste.includes(String(l[k]))); } }
        // is.null / not.is.null : colonne vide ou remplie (mannequins extérieures, 23/10/2026)
        for (const [k, v] of url.searchParams) { if (v === 'is.null') lignes = lignes.filter(l => l[k] == null); if (v === 'not.is.null') lignes = lignes.filter(l => l[k] != null); }
        // order=colonne.desc : tri comme la vraie base (une seule colonne)
        const ordre = (url.searchParams.get('order') || '').match(/^(\w+)\.(asc|desc)/);
        if (ordre) lignes.sort((a, b) => (String(a[ordre[1]] ?? '') < String(b[ordre[1]] ?? '') ? -1 : String(a[ordre[1]] ?? '') > String(b[ordre[1]] ?? '') ? 1 : 0) * (ordre[2] === 'desc' ? -1 : 1));
        // not.in.("a","b") : exclure ces valeurs (candidatures rangées à part)
        for (const [k, v] of url.searchParams) {
          const exclus = v.match(/^not\.in\.\((.*)\)$/);
          if (exclus) { const liste = exclus[1].split(',').map(x => x.replace(/^"|"$/g, '')); lignes = lignes.filter(l => !liste.includes(String(l[k]))); }
        }
        // or=(a.eq.x,b.ilike.y,and(c.eq.z,d.eq.w)) : conditions simples (recherche de doublons)
        if (url.searchParams.get('or')) {
          const morceaux = (t) => { const r = []; let n = 0, cur = ''; for (const ch of t) { if (ch === '(') n++; if (ch === ')') n--; if (ch === ',' && !n) { r.push(cur); cur = ''; } else cur += ch; } if (cur) r.push(cur); return r; };
          const vrai = (l, c) => { if (/^and\(/.test(c)) return morceaux(c.slice(4, -1)).every((x) => vrai(l, x)); const m = c.match(/^([\w]+)\.(eq|ilike|gte|lte)\.(.*)$/); if (!m) return false;
            if (m[2] === 'gte' || m[2] === 'lte') return l[m[1]] != null && (m[2] === 'gte' ? String(l[m[1]]) >= m[3] : String(l[m[1]]) <= m[3]);
            return m[2] === 'eq' ? String(l[m[1]]) === m[3] : String(l[m[1]] || '').toLowerCase() === m[3].toLowerCase(); };
          const conds = morceaux(url.searchParams.get('or').replace(/^\(|\)$/g, ''));
          lignes = lignes.filter((l) => conds.some((c) => vrai(l, c)));
        }
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
      const repPortail = portail && u.pathname === '/api/connexion-protegee' ? (() => { const x = sessionPortail(portail.aal || 'aal1'); return { access_token: x.access_token, refresh_token: x.refresh_token }; })() : null;
      let rep = (donnees.api && donnees.api[u.pathname]) || repPortail || (u.pathname === '/api/connexion-protegee' ? { access_token: jeton, refresh_token: 'faux' } : { ok: true });
      if (typeof rep === 'function') rep = rep(JSON.parse(route.request().postData() || '{}'));
      // « statut » : imiter un refus du serveur (ex. 403 « confirmez votre code »)
      const statut = (rep && rep.statut) || 200; if (rep && rep.statut) { rep = Object.assign({}, rep); delete rep.statut; }
      route.fulfill({ status: statut, contentType: 'application/json', body: JSON.stringify(rep) });
    }),
    page.route(/api\.emailjs\.com/, async (route) => { journal.push(['EMAIL', route.request().postData()]); route.fulfill({ status: 200, body: 'OK' }); })
  ]));
}
module.exports = { brancher };
