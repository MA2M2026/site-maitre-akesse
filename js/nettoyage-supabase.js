// ================== Nettoyage des anciennes copies de photos sur Supabase ==================
// Demande de la propriétaire (30/09/2026) : supprimer de Supabase Storage les anciennes
// copies des photos d'ACTUALITÉS et d'ÉVÉNEMENTS, déjà recopiées chez Cloudflare R2
// (outil « Migration des images du site vers R2 »). Les photos des mannequins, les logos
// des partenaires et les photos de candidature / inscription ne sont PAS concernés.
//
// Sécurité : un fichier n'est supprimé que si AUCUNE fiche ne le cite encore (image de
// couverture, galerie, texte des fiches, contenu « À la une »). En cas de doute (lecture
// impossible d'une table), rien n'est supprimé. Confirmation demandée avant d'effacer.
//
// Photo encore citée par une fiche (demande du 30/09/2026 : plus AUCUNE photo chez
// Supabase) : elle est d'abord recopiée chez Cloudflare R2, l'adresse est remplacée
// dans la fiche, puis on relit les fiches ; elle n'est effacée que si plus rien ne la cite.
(function () {
  const BUCKETS = ['actualites-images', 'evenements-images'];
  const TABLES = ['actualites', 'actualite_photos', 'evenements', 'evenement_photos', 'contenu_a_la_une'];

  const CATEGORIE = { 'actualites-images': 'actualites', 'evenements-images': 'evenements' };

  function echapper(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  async function lireFiches() {
    const lectures = await Promise.all(TABLES.map(t => sb.from(t).select('*')));
    const echec = lectures.find(r => r.error);
    if (echec) throw new Error('lecture impossible des fiches (' + echec.error.message + ') — rien n’a été supprimé');
    return TABLES.map((t, i) => ({ table: t, lignes: lectures[i].data || [] }));
  }

  function cite(texte, bucket, chemin) {
    return texte.indexOf(bucket + '/' + chemin) !== -1 || texte.indexOf(bucket + '/' + encodeURI(chemin)) !== -1;
  }

  function nomFiche(table, ligne) {
    const nom = ligne.titre || ligne.nom || ligne.title || '';
    return (table.indexOf('actualite') === 0 ? 'Actualité' : table.indexOf('evenement') === 0 ? 'Événement' : 'À la une') +
      (nom ? ' « ' + nom + ' »' : '');
  }

  // Recopie chez R2 puis remplace l'adresse Supabase dans toutes les fiches qui la citent.
  async function deplacerVersR2(bucket, chemin, fiches) {
    const { data: blob, error } = await sb.storage.from(bucket).download(chemin);
    if (error || !blob) throw new Error('téléchargement impossible de ' + chemin);
    const categorie = CATEGORIE[bucket];
    const nouvelleUrl = await envoyerImageSite(categorie, 'site/' + categorie + '/' + chemin, blob);
    const motif = new RegExp('https?://[^\\s"\'<>()]*?/storage/v1/object/(?:public|sign)/' + echapper(bucket) + '/(?:' +
      echapper(chemin) + '|' + echapper(encodeURI(chemin)) + ')(?:\\?[^\\s"\'<>()]*)?', 'g');
    for (const { table, lignes } of fiches) {
      for (const ligne of lignes) {
        if (!ligne.id) continue;
        const modifs = {};
        for (const col in ligne) {
          const v = ligne[col];
          if (typeof v === 'string' && motif.test(v)) { motif.lastIndex = 0; modifs[col] = v.replace(motif, nouvelleUrl); }
          motif.lastIndex = 0;
        }
        if (Object.keys(modifs).length) {
          const { error: e2 } = await sb.from(table).update(modifs).eq('id', ligne.id);
          if (e2) throw new Error('mise à jour impossible (' + nomFiche(table, ligne) + ') : ' + e2.message);
        }
      }
    }
  }

  // Tous les fichiers d'un bucket, dossiers compris.
  async function listerTout(bucket, dossier) {
    const fichiers = [];
    let depart = 0;
    for (;;) {
      const { data, error } = await sb.storage.from(bucket).list(dossier || '', { limit: 1000, offset: depart });
      if (error) throw error;
      for (const el of data || []) {
        const chemin = (dossier ? dossier + '/' : '') + el.name;
        if (el.id === null) fichiers.push(...await listerTout(bucket, chemin));
        else fichiers.push({ chemin: chemin, taille: (el.metadata && el.metadata.size) || 0 });
      }
      if (!data || data.length < 1000) break;
      depart += 1000;
    }
    return fichiers;
  }

  async function nettoyer() {
    const btn = document.getElementById('nettoyage-supabase-btn');
    const msg = document.getElementById('nettoyage-supabase-msg');
    btn.disabled = true;
    msg.className = 'form-msg ok';
    msg.textContent = 'Vérification des fiches…';
    try {
      // 1. Tout ce que les fiches citent encore.
      let fiches = await lireFiches();
      let texte = JSON.stringify(fiches);

      // 2. Fichiers présents chez Supabase.
      const inventaire = {};
      let aDeplacer = [];
      for (const bucket of BUCKETS) {
        msg.textContent = 'Inventaire de « ' + bucket + ' »…';
        inventaire[bucket] = await listerTout(bucket, '');
        for (const f of inventaire[bucket]) if (cite(texte, bucket, f.chemin)) aDeplacer.push({ bucket: bucket, chemin: f.chemin });
      }
      const total = BUCKETS.reduce((n, b) => n + inventaire[b].length, 0);
      if (!total) {
        msg.textContent = 'Rien à nettoyer : plus aucune photo d’actualité ou d’événement sur Supabase.';
        btn.disabled = false;
        return;
      }
      if (!confirm(total + ' photo(s) d’actualités et d’événements encore sur Supabase.' +
          (aDeplacer.length ? '\n' + aDeplacer.length + ' est (sont) encore utilisée(s) par une fiche : elle(s) sera (seront) d’abord recopiée(s) chez Cloudflare, et la fiche mise à jour.' : '') +
          '\n\nTout effacer de Supabase ? Les photos restent affichées sur le site (elles sont chez Cloudflare).')) {
        msg.textContent = 'Annulé : rien n’a été supprimé.';
        btn.disabled = false;
        return;
      }

      // 3. Photos encore citées : recopie chez R2 et mise à jour des fiches, puis relecture.
      const erreursDeplacement = [];
      let n = 0;
      for (const d of aDeplacer) {
        msg.textContent = 'Recopie chez Cloudflare… ' + (++n) + ' / ' + aDeplacer.length;
        try { await deplacerVersR2(d.bucket, d.chemin, fiches); }
        catch (e) { erreursDeplacement.push(d.chemin + ' : ' + ((e && e.message) || e)); }
      }
      if (aDeplacer.length) { fiches = await lireFiches(); texte = JSON.stringify(fiches); }

      // Ce qui ne sert plus (et, par sécurité, ce qui est encore cité reste).
      const aSupprimer = {};
      const gardes = [];
      let nb = 0, octets = 0;
      for (const bucket of BUCKETS) {
        aSupprimer[bucket] = [];
        for (const f of inventaire[bucket]) {
          if (cite(texte, bucket, f.chemin)) {
            const ou = [];
            for (const { table, lignes } of fiches) for (const l of lignes) if (cite(JSON.stringify(l), bucket, f.chemin)) ou.push(nomFiche(table, l));
            gardes.push(f.chemin + ' — ' + (ou.join(', ') || 'fiche inconnue'));
            continue;
          }
          aSupprimer[bucket].push(f.chemin);
          nb++; octets += f.taille;
        }
      }
      const mo = (octets / 1048576).toFixed(1);

      // 4. Suppression par paquets de 100.
      let faits = 0;
      for (const bucket of BUCKETS) {
        const liste = aSupprimer[bucket];
        for (let i = 0; i < liste.length; i += 100) {
          const { error } = await sb.storage.from(bucket).remove(liste.slice(i, i + 100));
          if (error) throw new Error('suppression interrompue (' + error.message + ') — ' + faits + ' fichier(s) déjà supprimé(s)');
          faits += Math.min(100, liste.length - i);
          msg.textContent = 'Suppression… ' + faits + ' / ' + nb;
        }
      }
      msg.style.whiteSpace = 'pre-line';
      msg.textContent = '✓ ' + faits + ' photo(s) supprimée(s) de Supabase — ' + mo + ' Mo libérés.' +
        (aDeplacer.length - erreursDeplacement.length > 0 ? '\n' + (aDeplacer.length - erreursDeplacement.length) + ' photo(s) recopiée(s) chez Cloudflare, fiche(s) mise(s) à jour.' : '') +
        (gardes.length ? '\n\nConservée(s) car encore utilisée(s) :\n' + gardes.join('\n') : '') +
        (erreursDeplacement.length ? '\n\nProblème :\n' + erreursDeplacement.join('\n') : '');
      if (gardes.length || erreursDeplacement.length) msg.className = 'form-msg err';
    } catch (e) {
      msg.className = 'form-msg err';
      msg.textContent = 'Erreur : ' + ((e && e.message) || e);
      if (window.signalerErreur) window.signalerErreur('Nettoyage Supabase', (e && e.message) || String(e));
    }
    btn.disabled = false;
  }

  function brancher() {
    const btn = document.getElementById('nettoyage-supabase-btn');
    if (btn && typeof sb !== 'undefined' && sb) btn.addEventListener('click', nettoyer);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancher);
  else brancher();
})();
