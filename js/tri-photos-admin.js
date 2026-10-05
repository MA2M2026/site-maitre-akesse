// Tableau de bord — tri automatique des photos par IA (06/10/2026).
// À chaque envoi, api/trier-photo.js range la photo en « book » ou « digital » ;
// une photo inutilisable est supprimée définitivement (choix de la propriétaire).
// Ici, l'agence voit :
//  - les photos écartées avant ce choix (cachées) : remettre ou supprimer ;
//  - les photos « à vérifier » (l'IA hésite ; elles restent visibles) : garder ou supprimer ;
//  - les photos envoyées avant la mise en place du tri, qu'on peut faire trier.
// Les photos envoyées ces 3 derniers jours et pas encore triées (envoi coupé,
// téléphone fermé trop tôt…) sont rattrapées automatiquement à l'ouverture.
(function () {
  var details = document.getElementById('tri-photos-details');
  if (!details || typeof sb === 'undefined' || !sb) return;
  var charge = false, parId = {};

  function echapper(t) { return typeof echapperHtml === 'function' ? echapperHtml(t) : String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

  async function jeton() {
    if (typeof jetonSessionCourante === 'function') return jetonSessionCourante();
    var s = await sb.auth.getSession();
    return s && s.data && s.data.session ? s.data.session.access_token : null;
  }

  // Renvoie 'ok', 'echec', 'credit' (crédit de l'IA épuisé) ou 'non-configure'.
  // Une coupure de connexion passagère est retentée (jusqu'à 3 essais).
  async function trierUne(photoId, j) {
    for (var essai = 1; essai <= 3; essai++) {
      try {
        var r = await fetch('/api/trier-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await jeton() || j) },
          body: JSON.stringify({ photoId: String(photoId) })
        });
        if (r.ok) { var rep = await r.json().catch(function () { return {}; }); return rep.statut === 'supprimee' ? 'supprimee' : 'ok'; }
        var corps = await r.json().catch(function () { return {}; });
        if (r.status === 402) return 'credit';
        if (r.status === 503 && /non configur/i.test(corps.error || '')) return 'non-configure';
        if (r.status === 401 || r.status === 403 || r.status === 404) return 'echec';
      } catch (e) { /* connexion coupée : nouvel essai */ }
      await new Promise(function (ok) { setTimeout(ok, 1500 * essai); });
    }
    return 'echec';
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
      var r = await trierUne(res.data[i].id, j);
      if (r === 'credit' || r === 'non-configure') return;
    }
  }
  setTimeout(function () { rattraperRecentes().catch(function () {}); }, 15000);

  // Suppression définitive : la fiche en base d'abord, puis les fichiers.
  async function supprimer(p) {
    var r = await sb.from('model_photos').delete().eq('id', p.id);
    if (r.error) return r;
    if (typeof supprimerDeR2 === 'function') {
      for (var c of [p.chemin, p.chemin_miniature, p.chemin_moyenne]) if (c) await supprimerDeR2(p.model_id, c);
    }
    return r;
  }

  async function marquer(photoId, statut) {
    return sb.from('model_photos').update({ tri_statut: statut, tri_manuel: true, tri_date: new Date().toISOString() }).eq('id', photoId);
  }

  function vignette(p, nom, boutons) {
    var url = p.url_miniature || p.url;
    return '<div class="tri-vignette">' +
      '<a href="' + echapper(p.url_moyenne || p.url) + '" target="_blank" rel="noopener"><img src="' + echapper(url) + '" alt="Photo de ' + echapper(nom) + '" loading="lazy"></a>' +
      '<div class="tri-nom">' + echapper(nom) + (p.numero ? ' — photo n° ' + Number(p.numero) : '') + '</div>' +
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
    var res = await sb.from('model_photos').select('id, model_id, numero, url, url_miniature, url_moyenne, chemin, chemin_miniature, chemin_moyenne, tri_statut, tri_raison, created_at')
      .in('tri_statut', ['ecartee', 'a_verifier']).order('created_at', { ascending: false }).limit(300);
    if (res.error) {
      zoneE.textContent = 'Le tri automatique n’est pas encore activé : il reste à exécuter l’Extension 116 dans Supabase.';
      return;
    }
    var photos = res.data || [];
    parId = {}; photos.forEach(function (p) { parId[p.id] = p; });
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
      ? '<p class="tri-tout"><button class="btn tri-btn" type="button" data-statut="supprimer-tout">Supprimer définitivement toutes ces photos</button></p>' +
        ecartees.map(function (p) { return vignette(p, noms[p.model_id] || 'Mannequin', [['book', 'Remettre'], ['supprimer', 'Supprimer']]); }).join('')
      : '<div class="dossiers-vide">Aucune photo écartée.</div>';
    // Regroupées par mannequin : l'agence valide la suppression d'un clic par mannequin.
    var groupes = {};
    aVerifier.forEach(function (p) { (groupes[p.model_id] = groupes[p.model_id] || []).push(p); });
    zoneV.innerHTML = aVerifier.length
      ? Object.keys(groupes).map(function (mid) {
          var liste = groupes[mid], nom = noms[mid] || 'Mannequin';
          var proposees = liste.filter(function (p) { return /^Proposée à la suppression/.test(p.tri_raison || ''); }).length;
          return '<div class="tri-groupe"><h4 class="tri-groupe-nom">' + echapper(nom) + ' — ' + liste.length + ' photo(s)</h4>' +
            (proposees ? '<button class="btn tri-btn" type="button" data-statut="supprimer-modele" data-model="' + echapper(mid) + '">Supprimer les ' + proposees + ' photo(s) proposée(s)</button>' : '') +
            '</div>' + liste.map(function (p) { return vignette(p, nom, [['book', 'Garder'], ['supprimer', 'Supprimer']]); }).join('');
        }).join('')
      : '<div class="dossiers-vide">Aucune photo à vérifier.</div>';

    chargerRapports();
    zoneA.innerHTML = '<p class="tdb-9">L’IA regarde le book complet de chaque mannequin, comme un recruteur : elle range les photos en Book (shootings, défilés, campagnes) et Digitals &amp; Lifestyle (polaroïds, événements, castings bien pris) et propose de supprimer seulement les photos floues, prises à la légère ou de groupe. <strong>Rien n’est supprimé sans votre clic</strong> : les photos proposées apparaissent ci-dessus, dans « À vérifier ». Coût : environ 0,10 $ par mannequin.</p>' +
      '<button class="btn" type="button" id="tri-revue-btn">Lancer la revue stricte des books</button><div class="form-msg" id="tri-revue-msg"></div><div id="tri-revue-resultats" class="tri-revue-resultats"></div>';
    document.getElementById('tri-revue-btn').addEventListener('click', revueBooks);
  }

  // ---- Rapports détaillés + fiche technique + envoi WhatsApp (Extension 117) ----
  var rapports = {}, telephones = {};
  function numeroWa(tel) {
    var n = String(tel || '').replace(/[^\d]/g, '');
    if (n.indexOf('00') === 0) n = n.slice(2);
    if ((n.length === 10 && n.charAt(0) === '0') || n.length === 8) n = '225' + n; // numéro ivoirien sans indicatif
    return n.length >= 8 ? n : '';
  }
  // Liens ajoutés automatiquement au message : le book public et l'Espace mannequin
  // (où les photos portent leur numéro). Liens https simples : WhatsApp les rend
  // cliquables et ils s'ouvrent directement sur iPhone comme sur Android.
  var SITE = 'https://www.maitreakessemodelmanagement.com';
  function avecLiens(message, modelId, publie, slug) {
    var liens = (publie ? '\n\n📸 Votre book en ligne : ' + SITE + (slug ? '/book/' + encodeURIComponent(slug) : '/mannequin?id=' + modelId) : '') +
      '\n\n🔐 Votre Espace mannequin (photos numérotées, envoi des nouvelles photos) : ' + SITE + '/espace-mannequin';
    return String(message).trim() + liens;
  }
  function listeHtml(t) { return (t && t.length) ? '<ul>' + t.map(function (x) { return '<li>' + echapper(x) + '</li>'; }).join('') + '</ul>' : '<p>—</p>'; }

  async function chargerRapports() {
    var zone = document.getElementById('tri-rapports');
    if (!zone) return;
    var r = await sb.from('revues_book').select('model_id, rapport, revu_le, envoye_le').order('revu_le', { ascending: false });
    if (r.error) { zone.innerHTML = '<p class="tdb-9">Les rapports seront disponibles après l’exécution de l’Extension 117 dans Supabase.</p>'; return; }
    var lignes = r.data || [];
    if (!lignes.length) { zone.innerHTML = '<p class="tdb-9">Aucun rapport pour le moment : lancez la revue stricte des books ci-dessous.</p>'; return; }
    var ids = lignes.map(function (l) { return l.model_id; });
    var noms = {};
    var publies = {};
    var pr = await sb.from('model_profiles').select('id, full_name, published').in('id', ids);
    (pr.data || []).forEach(function (m) { noms[m.id] = m.full_name || 'Mannequin'; publies[m.id] = !!m.published; });
    // Nom d'adresse lisible (…/book/nom, Extension 118) — requête à part : sans la
    // colonne (SQL pas encore exécuté), le reste fonctionne avec l'ancienne adresse.
    var slugs = {};
    var sl = await sb.from('model_profiles').select('id, slug').in('id', ids);
    (sl.data || []).forEach(function (m) { if (m.slug) slugs[m.id] = m.slug; });
    var tel = await sb.rpc('contacts_mannequins_admin');
    telephones = {}; (tel.data || []).forEach(function (t) { telephones[t.model_id] = t.phone; });
    rapports = {};
    zone.innerHTML = lignes.map(function (l) {
      var rp = l.rapport || {}, nom = noms[l.model_id] || 'Mannequin';
      rapports[l.model_id] = rp;
      var wa = numeroWa(telephones[l.model_id]);
      return '<details class="tri-rapport"><summary><strong>' + echapper(nom) + '</strong> — revu le ' + new Date(l.revu_le).toLocaleDateString('fr-FR') +
        (l.envoye_le ? ' · <span class="tri-envoye">✓ envoyé le ' + new Date(l.envoye_le).toLocaleDateString('fr-FR') + '</span>' : ' · <span class="tri-non-envoye">pas encore envoyé</span>') + '</summary>' +
        '<p>' + (rp.gardees || 0) + ' photo(s) gardée(s), ' + (rp.proposees || 0) + ' proposée(s) à la suppression (voir « À vérifier »).</p>' +
        '<h5>Points forts</h5>' + listeHtml(rp.points_forts) +
        '<h5>À améliorer</h5>' + listeHtml(rp.a_ameliorer) +
        '<h5>Fiche technique — photos à faire</h5>' + ((rp.fiche_technique || []).length ? '<ol class="tri-fiche">' + rp.fiche_technique.map(function (f) {
          return '<li><strong>' + echapper(f.titre) + '</strong><br>Cadrage : ' + echapper(f.cadrage) + '<br>Pose : ' + echapper(f.pose) + '<br>Tenue : ' + echapper(f.tenue) + '<br>Lieu et lumière : ' + echapper(f.lieu_lumiere) + '</li>';
        }).join('') + '</ol>' : '<p>—</p>') +
        '<h5>Règles pour toutes les photos</h5>' + listeHtml(rp.regles) +
        '<h5>Message pour le mannequin (vous pouvez le modifier avant l’envoi)</h5>' +
        '<textarea class="tri-message" rows="12" data-model="' + echapper(l.model_id) + '">' + echapper(avecLiens(rp.message_mannequin || '', l.model_id, publies[l.model_id], slugs[l.model_id])) + '</textarea>' +
        '<div class="tri-actions">' +
          (wa ? '<button class="btn tri-btn" type="button" data-statut="envoyer-wa" data-model="' + echapper(l.model_id) + '">💬 Envoyer par WhatsApp</button>' : '<span class="tdb-9">Pas de numéro de téléphone pour ce mannequin.</span>') +
          '<button class="btn tri-btn" type="button" data-statut="copier-message" data-model="' + echapper(l.model_id) + '">Copier le message</button>' +
        '</div></details>';
    }).join('');
  }

  function blobEnBase64(blob) {
    return new Promise(function (ok, ko) {
      var l = new FileReader();
      l.onload = function () { ok(String(l.result).split(',')[1] || ''); };
      l.onerror = ko;
      l.readAsDataURL(blob);
    });
  }

  // Mannequins déjà revus dans les dernières 24 h (pour reprendre sans repayer après une coupure).
  function dejaRevus() {
    try { var o = JSON.parse(localStorage.getItem('ma2m_revue_books_v3') || '{}'); var n = Date.now(), r = {}; Object.keys(o).forEach(function (k) { if (n - o[k] < 86400000) r[k] = o[k]; }); return r; } catch (e) { return {}; }
  }
  function noterRevu(id) {
    try { var o = dejaRevus(); o[id] = Date.now(); localStorage.setItem('ma2m_revue_books_v3', JSON.stringify(o)); } catch (e) {}
  }

  async function revueBooks() {
    var btn = document.getElementById('tri-revue-btn');
    var msg = document.getElementById('tri-revue-msg');
    var zone = document.getElementById('tri-revue-resultats');
    var res = await sb.from('model_photos').select('id, model_id, url, url_miniature, tri_statut, created_at').order('created_at', { ascending: true }).limit(5000);
    if (res.error) { alert('Erreur : ' + res.error.message); return; }
    var parModele = {};
    (res.data || []).forEach(function (p) { if (p.tri_statut !== 'ecartee') (parModele[p.model_id] = parModele[p.model_id] || []).push(p); });
    var faits = dejaRevus();
    var ids = Object.keys(parModele).filter(function (id) { return !faits[id]; });
    if (!ids.length) { msg.style.display = 'block'; msg.className = 'form-msg ok'; msg.textContent = 'Tous les books ont déjà été revus aujourd’hui.'; return; }
    if (!confirm('Lancer la revue stricte de ' + ids.length + ' book(s) ? Coût estimé : environ ' + (ids.length * 0.1).toFixed(2).replace('.', ',') + ' $. Gardez cette page ouverte pendant la revue.')) return;
    var pr = await sb.from('model_profiles').select('id, full_name').in('id', ids);
    var noms = {}; (pr.data || []).forEach(function (m) { noms[m.id] = m.full_name || 'Mannequin'; });
    btn.disabled = true; msg.style.display = 'block'; msg.className = 'form-msg';
    var verrou = null;
    try { if (navigator.wakeLock) verrou = await navigator.wakeLock.request('screen'); } catch (e) {}
    var totalProposees = 0, echecs = 0, arret = '';
    for (var i = 0; i < ids.length; i++) {
      var mid = ids[i], nom = noms[mid] || 'Mannequin', photos = parModele[mid];
      msg.textContent = 'Revue ' + (i + 1) + ' / ' + ids.length + ' : ' + nom + ' (' + photos.length + ' photos)… gardez cette page ouverte.';
      var images = [];
      for (var k = 0; k < photos.length && images.length < 90; k++) {
        try { images.push({ id: photos[k].id, data: await blobEnBase64(await genererMiniatureDepuisUrl(photos[k].url_miniature || photos[k].url, 560, 0.6)) }); } catch (e) {}
      }
      var ligne = document.createElement('div'); ligne.className = 'tri-revue-ligne';
      var resultat = null;
      for (var essai = 1; essai <= 2 && !resultat; essai++) {
        try {
          var r = await fetch('/api/trier-photo', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await jeton()) }, body: JSON.stringify({ action: 'revue', modelId: mid, images: images }) });
          var corps = await r.json().catch(function () { return {}; });
          if (r.status === 402) { arret = 'Le crédit de l’IA est épuisé : rechargez le compte Anthropic, puis relancez (les books déjà revus ne seront pas refaits).'; break; }
          if (r.status === 503) { arret = 'Le tri automatique n’est pas configuré (clé de l’IA absente sur Vercel).'; break; }
          if (r.ok && corps.ok) resultat = corps;
        } catch (e) { /* coupure : nouvel essai */ }
      }
      if (arret) break;
      if (resultat) {
        noterRevu(mid); totalProposees += resultat.proposees || 0;
        ligne.innerHTML = '<strong>' + echapper(nom) + '</strong> : ' + (resultat.gardees || 0) + ' photo(s) gardée(s), ' + (resultat.proposees || 0) + ' proposée(s) à la suppression. Rapport détaillé ci-dessous.';
      } else {
        echecs++; ligne.innerHTML = '<strong>' + echapper(nom) + '</strong> : la revue a échoué (vous pourrez relancer).';
      }
      zone.appendChild(ligne);
    }
    try { if (verrou) verrou.release(); } catch (e) {}
    btn.disabled = false;
    msg.className = arret || echecs ? 'form-msg err' : 'form-msg ok';
    msg.textContent = arret || ('Revue terminée : ' + totalProposees + ' photo(s) proposée(s) à la suppression' + (echecs ? ', ' + echecs + ' book(s) à relancer' : '') + '. Vérifiez-les dans « À vérifier » ci-dessus.');
    var resultats = zone.innerHTML;
    await charger();
    document.getElementById('tri-revue-resultats').innerHTML = resultats;
    var m2 = document.getElementById('tri-revue-msg'); m2.style.display = 'block'; m2.className = msg.className; m2.textContent = msg.textContent;
  }

  details.addEventListener('toggle', function () { if (details.open && !charge) charger(); });
  details.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('.tri-btn');
    if (!b) return;
    var r;
    if (b.dataset.statut === 'envoyer-wa' || b.dataset.statut === 'copier-message') {
      var zoneTexte = details.querySelector('.tri-message[data-model="' + b.dataset.model + '"]');
      var texte = zoneTexte ? zoneTexte.value.trim() : '';
      if (!texte) return;
      if (b.dataset.statut === 'copier-message') {
        try { await navigator.clipboard.writeText(texte); b.textContent = '✓ Copié'; } catch (err) { zoneTexte.select(); }
        return;
      }
      window.open('https://wa.me/' + numeroWa(telephones[b.dataset.model]) + '?text=' + encodeURIComponent(texte), '_blank', 'noopener');
      await sb.from('revues_book').update({ envoye_le: new Date().toISOString() }).eq('model_id', b.dataset.model);
      b.textContent = '✓ WhatsApp ouvert';
      return;
    }
    if (b.dataset.statut === 'supprimer-modele') {
      var duModele = Object.keys(parId).map(function (k) { return parId[k]; }).filter(function (p) { return p.model_id === b.dataset.model && p.tri_statut === 'a_verifier' && /^Proposée à la suppression/.test(p.tri_raison || ''); });
      if (!confirm('Supprimer définitivement ces ' + duModele.length + ' photo(s) ? Elles ne pourront pas être récupérées.')) return;
      b.disabled = true;
      for (var n = 0; n < duModele.length; n++) {
        b.textContent = 'Suppression ' + (n + 1) + ' / ' + duModele.length + '…';
        r = await supprimer(duModele[n]);
        if (r.error) break;
      }
    } else if (b.dataset.statut === 'supprimer-tout') {
      var toutes = Object.keys(parId).map(function (k) { return parId[k]; }).filter(function (p) { return p.tri_statut === 'ecartee'; });
      if (!confirm('Supprimer définitivement ces ' + toutes.length + ' photo(s) ? Elles ne pourront pas être récupérées.')) return;
      b.disabled = true;
      for (var i = 0; i < toutes.length; i++) {
        b.textContent = 'Suppression ' + (i + 1) + ' / ' + toutes.length + '…';
        r = await supprimer(toutes[i]);
        if (r.error) break;
      }
    } else if (b.dataset.statut === 'supprimer') {
      if (!confirm('Supprimer définitivement cette photo ? Elle ne pourra pas être récupérée.')) return;
      b.disabled = true;
      r = await supprimer(parId[b.dataset.id] || { id: b.dataset.id });
    } else {
      b.disabled = true;
      r = await marquer(b.dataset.id, b.dataset.statut);
    }
    r = r || {};
    if (r.error) { alert('Erreur : ' + r.error.message); b.disabled = false; return; }
    charger();
  });
})();
