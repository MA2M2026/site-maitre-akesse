// Tableau de bord — tri automatique des photos par IA (06/10/2026).
// À chaque envoi, api/trier-photo.js range la photo en « book », « digital » ou
// « écartée ». Ici, l'agence voit :
//  - les photos écartées (cachées sur le site et dans l'espace de la mannequin,
//    jamais supprimées) avec un bouton « Remettre » ;
//  - les photos « à vérifier » (l'IA hésite ; elles restent visibles) ;
//  - les photos envoyées avant la mise en place du tri, qu'on peut faire trier.
// Les photos envoyées ces 3 derniers jours et pas encore triées (envoi coupé,
// téléphone fermé trop tôt…) sont rattrapées automatiquement à l'ouverture.
(function () {
  var details = document.getElementById('tri-photos-details');
  if (!details || typeof sb === 'undefined' || !sb) return;
  var charge = false;

  function echapper(t) { return typeof echapperHtml === 'function' ? echapperHtml(t) : String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

  async function jeton() {
    if (typeof jetonSessionCourante === 'function') return jetonSessionCourante();
    var s = await sb.auth.getSession();
    return s && s.data && s.data.session ? s.data.session.access_token : null;
  }

  async function trierUne(photoId, j) {
    var r = await fetch('/api/trier-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + j },
      body: JSON.stringify({ photoId: String(photoId) })
    });
    if (r.status === 503) throw new Error('non-configure');
    return r.ok;
  }

  // Rattrapage discret : photos récentes jamais triées (une fois par session).
  async function rattraperRecentes() {
    try { if (sessionStorage.getItem('ma2m_rattrapage_tri')) return; sessionStorage.setItem('ma2m_rattrapage_tri', '1'); } catch (e) {}
    var depuis = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    var res = await sb.from('model_photos').select('id').is('tri_statut', null).eq('tri_manuel', false)
      .gte('created_at', depuis).lt('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString()).limit(40);
    if (res.error || !res.data || !res.data.length) return; // tri pas encore installé, ou rien à faire
    var j = await jeton(); if (!j) return;
    for (var i = 0; i < res.data.length; i++) {
      try { await trierUne(res.data[i].id, j); } catch (e) { return; }
    }
  }
  setTimeout(function () { rattraperRecentes().catch(function () {}); }, 15000);

  async function marquer(photoId, statut) {
    return sb.from('model_photos').update({ tri_statut: statut, tri_manuel: true, tri_date: new Date().toISOString() }).eq('id', photoId);
  }

  function vignette(p, nom, boutons) {
    var url = p.url_miniature || p.url;
    return '<div class="tri-vignette">' +
      '<a href="' + echapper(p.url_moyenne || p.url) + '" target="_blank" rel="noopener"><img src="' + echapper(url) + '" alt="Photo de ' + echapper(nom) + '" loading="lazy"></a>' +
      '<div class="tri-nom">' + echapper(nom) + '</div>' +
      '<div class="tri-raison">' + echapper(p.tri_raison || '') + '</div>' +
      '<div class="tri-actions">' + boutons.map(function (b) {
        return '<button class="btn tri-btn" type="button" data-id="' + echapper(p.id) + '" data-statut="' + b[0] + '">' + b[1] + '</button>';
      }).join('') + '</div></div>';
  }

  async function charger() {
    charge = true;
    var zoneE = document.getElementById('tri-ecartees');
    var zoneV = document.getElementById('tri-a-verifier');
    var zoneA = document.getElementById('tri-anciennes');
    zoneE.textContent = 'Chargement…'; zoneV.textContent = ''; zoneA.textContent = '';
    var res = await sb.from('model_photos').select('id, model_id, url, url_miniature, url_moyenne, tri_statut, tri_raison, created_at')
      .in('tri_statut', ['ecartee', 'a_verifier']).order('created_at', { ascending: false }).limit(300);
    if (res.error) {
      zoneE.textContent = 'Le tri automatique n’est pas encore activé : il reste à exécuter l’Extension 116 dans Supabase.';
      return;
    }
    var photos = res.data || [];
    var ids = Array.from(new Set(photos.map(function (p) { return p.model_id; })));
    var noms = {};
    if (ids.length) {
      var pr = await sb.from('model_profiles').select('id, full_name').in('id', ids);
      (pr.data || []).forEach(function (m) { noms[m.id] = m.full_name || 'Mannequin'; });
    }
    var ecartees = photos.filter(function (p) { return p.tri_statut === 'ecartee'; });
    var aVerifier = photos.filter(function (p) { return p.tri_statut === 'a_verifier'; });
    document.getElementById('tri-photos-compteur').textContent = ecartees.length + ' écartée(s) · ' + aVerifier.length + ' à vérifier';
    zoneE.innerHTML = ecartees.length
      ? ecartees.map(function (p) { return vignette(p, noms[p.model_id] || 'Mannequin', [['book', 'Remettre']]); }).join('')
      : '<div class="dossiers-vide">Aucune photo écartée.</div>';
    zoneV.innerHTML = aVerifier.length
      ? aVerifier.map(function (p) { return vignette(p, noms[p.model_id] || 'Mannequin', [['book', 'Garder'], ['ecartee', 'Cacher']]); }).join('')
      : '<div class="dossiers-vide">Aucune photo à vérifier.</div>';

    var anc = await sb.from('model_photos').select('id', { count: 'exact', head: true }).is('tri_statut', null).eq('tri_manuel', false);
    var n = anc.count || 0;
    zoneA.innerHTML = n
      ? '<p class="tdb-9">' + n + ' photo(s) pas encore triée(s) (envoyées avant la mise en place du tri). Coût estimé : ' + (n * 0.02 < 1 ? 'moins d’1 $' : 'environ ' + Math.ceil(n * 0.02) + ' $') + ' au total.</p><button class="btn" type="button" id="tri-anciennes-btn">Trier ces photos</button><div class="form-msg" id="tri-anciennes-msg"></div>'
      : '<p class="tdb-9">Toutes les photos sont triées.</p>';
    var btn = document.getElementById('tri-anciennes-btn');
    if (btn) btn.addEventListener('click', trierAnciennes);
  }

  async function trierAnciennes() {
    var btn = document.getElementById('tri-anciennes-btn');
    var msg = document.getElementById('tri-anciennes-msg');
    if (!confirm('Faire trier par l’IA toutes les photos pas encore triées ? Cela peut prendre plusieurs minutes ; gardez cette page ouverte.')) return;
    btn.disabled = true; msg.style.display = 'block'; msg.className = 'form-msg';
    var res = await sb.from('model_photos').select('id').is('tri_statut', null).eq('tri_manuel', false).order('created_at', { ascending: true }).limit(1000);
    var liste = res.data || [];
    var j = await jeton();
    if (!j) { msg.className = 'form-msg err'; msg.textContent = 'Session expirée — reconnectez-vous.'; btn.disabled = false; return; }
    var faites = 0, echecs = 0;
    for (var i = 0; i < liste.length; i++) {
      msg.textContent = 'Tri en cours : ' + (i + 1) + ' / ' + liste.length + '…';
      try { if (await trierUne(liste[i].id, j)) faites++; else echecs++; }
      catch (e) { msg.className = 'form-msg err'; msg.textContent = 'Le tri automatique n’est pas configuré (clé de l’IA absente sur Vercel).'; btn.disabled = false; return; }
      if (echecs >= 5 && faites === 0) break;
    }
    await charger();
    var bilan = document.createElement('div');
    bilan.className = echecs ? 'form-msg err' : 'form-msg ok'; bilan.style.display = 'block';
    bilan.textContent = faites + ' photo(s) triée(s)' + (echecs ? ', ' + echecs + ' échec(s) — vous pourrez relancer plus tard.' : '.');
    document.getElementById('tri-anciennes').prepend(bilan);
  }

  details.addEventListener('toggle', function () { if (details.open && !charge) charger(); });
  details.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('.tri-btn');
    if (!b) return;
    b.disabled = true;
    var r = await marquer(b.dataset.id, b.dataset.statut);
    if (r.error) { alert('Erreur : ' + r.error.message); b.disabled = false; return; }
    charger();
  });
})();
