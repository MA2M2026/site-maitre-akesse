// Tableau de bord — « Photos mises de côté ». Le tri des photos par IA est retiré
// (décision de la propriétaire, 07/10/2026 : le Book / Lifestyle est décidé par le site,
// categoriePhoto dans js/app.js). Il reste seulement les photos que l'ancienne IA avait
// mises de côté, pour que l'agence décide elle-même :
//  - photos écartées (cachées sur la fiche publique) : remettre ou supprimer ;
//  - photos « à vérifier » (encore visibles) : garder ou supprimer.
// Rien n'est supprimé sans le clic de l'agence (confirmation à chaque suppression).
(function () {
  var details = document.getElementById('tri-photos-details');
  if (!details || typeof sb === 'undefined' || !sb) return;
  var charge = false, parId = {};

  // Suppression définitive : la fiche en base d'abord, puis les fichiers.
  async function supprimer(p) {
    var r = await sb.from('model_photos').delete().eq('id', p.id);
    if (r.error) return r;
    if (typeof supprimerDeR2 === 'function') {
      for (var c of [p.chemin, p.chemin_miniature, p.chemin_moyenne]) if (c) await supprimerDeR2(p.model_id, c);
    }
    return r;
  }

  function vignette(p, nom, boutons) {
    var url = p.url_miniature || p.url;
    return '<div class="tri-vignette">' +
      '<a href="' + echapperHtml(p.url_moyenne || p.url) + '" target="_blank" rel="noopener"><img src="' + echapperHtml(url) + '" alt="Photo de ' + echapperHtml(nom) + '" loading="lazy"></a>' +
      '<div class="tri-nom">' + echapperHtml(nom) + (p.numero ? ' — photo n° ' + Number(p.numero) : '') + '</div>' +
      '<div class="tri-actions">' + boutons.map(function (b) {
        return '<button class="btn tri-btn" type="button" data-id="' + echapperHtml(p.id) + '" data-statut="' + b[0] + '">' + b[1] + '</button>';
      }).join('') + '</div></div>';
  }

  async function charger() {
    charge = true;
    var zoneE = document.getElementById('tri-ecartees');
    var zoneV = document.getElementById('tri-a-verifier');
    zoneE.textContent = 'Chargement…'; zoneV.textContent = '';
    var res = await sb.from('model_photos').select('id, model_id, numero, url, url_miniature, url_moyenne, chemin, chemin_miniature, chemin_moyenne, tri_statut, created_at')
      .in('tri_statut', ['ecartee', 'a_verifier']).order('created_at', { ascending: false }).limit(300);
    if (res.error) { charge = false; zoneE.textContent = 'Lecture impossible : ' + res.error.message; return; }
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
    document.getElementById('tri-photos-compteur').textContent = ecartees.length + ' cachée(s) · ' + aVerifier.length + ' à vérifier';
    zoneE.innerHTML = ecartees.length
      ? ecartees.map(function (p) { return vignette(p, noms[p.model_id] || 'Mannequin', [['book', 'Remettre'], ['supprimer', 'Supprimer']]); }).join('')
      : '<div class="dossiers-vide">Aucune photo cachée.</div>';
    zoneV.innerHTML = aVerifier.length
      ? aVerifier.map(function (p) { return vignette(p, noms[p.model_id] || 'Mannequin', [['book', 'Garder'], ['supprimer', 'Supprimer']]); }).join('')
      : '<div class="dossiers-vide">Aucune photo à vérifier.</div>';
  }

  details.addEventListener('toggle', function () { if (details.open && !charge) void charger(); });
  details.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('.tri-btn');
    if (!b) return;
    var r;
    if (b.dataset.statut === 'supprimer') {
      if (!confirm('Supprimer définitivement cette photo ? Elle ne pourra pas être récupérée.')) return;
      b.disabled = true;
      r = await supprimer(parId[b.dataset.id] || { id: b.dataset.id });
    } else {
      b.disabled = true;
      r = await sb.from('model_photos').update({ tri_statut: 'book', tri_manuel: true, tri_date: new Date().toISOString() }).eq('id', b.dataset.id);
    }
    if (r && r.error) { alert('Erreur : ' + r.error.message); b.disabled = false; return; }
    void charger();
  });
})();
