// ================== Nettoyage des anciennes copies de photos sur Supabase ==================
// Demande de la propriétaire (30/09/2026) : plus AUCUNE photo chez Supabase Storage,
// SAUF les photos des mannequins (bucket model-photos, jamais touché ici).
// Concernés :
//   - actualités, événements, logos des partenaires, photo du mot du fondateur :
//     déjà recopiés chez Cloudflare R2 (outil « Migration des images du site vers R2 ») ;
//   - photos de candidature et d'inscription : elles vont désormais directement dans
//     Google Drive ; seules d'anciennes copies peuvent rester chez Supabase.
//
// Sécurité :
//   - un fichier n'est effacé que si AUCUNE fiche ne le cite encore ;
//   - image du site encore citée : recopiée chez R2, adresse remplacée dans la fiche,
//     puis relecture des fiches ; effacée seulement si plus rien ne la cite ;
//   - photo de candidature / inscription encore citée : jamais effacée (données
//     personnelles, sa place est dans le Drive, pas chez Cloudflare) ;
//   - lecture impossible d'une table : rien n'est effacé. Confirmation avant d'effacer.
(function () {
  // deplacer : catégorie R2 selon la table qui cite le fichier (null = ne jamais déplacer).
  const BUCKETS = [
    { bucket: 'actualites-images', tables: ['actualites', 'actualite_photos', 'contenu_a_la_une'],
      deplacer: { actualites: 'actualites', actualite_photos: 'actualites', contenu_a_la_une: 'actualites' } },
    { bucket: 'evenements-images', tables: ['evenements', 'evenement_photos', 'contenu_a_la_une'],
      deplacer: { evenements: 'evenements', evenement_photos: 'evenements', contenu_a_la_une: 'evenements' } },
    { bucket: 'partenaires-logos', tables: ['partenaires', 'mot_responsable'],
      deplacer: { partenaires: 'partenaires', mot_responsable: 'responsable' } },
    { bucket: 'casting-applications', tables: ['casting_applications', 'casting_photos'], deplacer: null },
    { bucket: 'inscriptions-photos', tables: ['inscriptions_mannequins', 'inscriptions_photos'], deplacer: null }
  ];
  const TABLES = Array.from(new Set([].concat.apply([], BUCKETS.map(b => b.tables))));
  const NOMS = {
    actualites: 'Actualité', actualite_photos: 'Photo d’actualité', evenements: 'Événement',
    evenement_photos: 'Photo d’événement', contenu_a_la_une: 'À la une', partenaires: 'Partenaire',
    mot_responsable: 'Mot du fondateur', casting_applications: 'Candidature', casting_photos: 'Photo de candidature',
    inscriptions_mannequins: 'Inscription', inscriptions_photos: 'Photo d’inscription'
  };

  function echapper(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Une table entière (par pages de 1000 : Supabase n'en renvoie pas plus d'un coup).
  async function lireTable(table) {
    const { data, error } = await lireToutesLignes(() => sb.from(table).select('*').order('id'));
    if (error) throw new Error('lecture impossible des fiches « ' + table + ' » (' + error.message + ') — rien n’a été supprimé');
    return data;
  }

  async function lireFiches() {
    const toutes = await Promise.all(TABLES.map(lireTable));
    const fiches = {};
    TABLES.forEach((t, i) => { fiches[t] = toutes[i]; });
    return fiches;
  }

  // La fiche cite-t-elle ce fichier ? Adresse complète (…/bucket/chemin) ; pour les
  // photos de candidature / inscription, aussi le chemin seul (colonne « chemin »).
  function cite(texte, conf, chemin) {
    if (texte.indexOf(conf.bucket + '/' + chemin) !== -1 || texte.indexOf(conf.bucket + '/' + encodeURI(chemin)) !== -1) return true;
    return !conf.deplacer && texte.indexOf(JSON.stringify(chemin)) !== -1;
  }

  function nomFiche(table, ligne) {
    const nom = ligne.titre || ligne.nom || ligne.title || '';
    return (NOMS[table] || table) + (nom ? ' « ' + nom + ' »' : '');
  }

  // Recopie chez R2 puis remplace l'adresse Supabase dans toutes les fiches qui la citent.
  async function deplacerVersR2(conf, chemin, fiches) {
    const table = conf.tables.find(t => fiches[t].some(l => cite(JSON.stringify(l), conf, chemin)));
    const categorie = conf.deplacer[table];
    const { data: blob, error } = await sb.storage.from(conf.bucket).download(chemin);
    if (error || !blob) throw new Error('téléchargement impossible');
    const nouvelleUrl = await envoyerImageSite(categorie, 'site/' + categorie + '/' + chemin, blob);
    const motif = new RegExp('https?://[^\\s"\'<>()]*?/storage/v1/object/(?:public|sign)/' + echapper(conf.bucket) + '/(?:' +
      echapper(chemin) + '|' + echapper(encodeURI(chemin)) + ')(?:\\?[^\\s"\'<>()]*)?', 'g');
    for (const t of conf.tables) {
      for (const ligne of fiches[t]) {
        if (ligne.id === undefined || ligne.id === null) continue;
        const modifs = {};
        for (const col in ligne) {
          const v = ligne[col];
          if (typeof v === 'string' && v.search(motif) !== -1) modifs[col] = v.replace(motif, nouvelleUrl);
        }
        // Colonne « …chemin » de la même fiche : nouveau chemin R2 (sinon, en supprimant
        // plus tard la fiche, la copie chez Cloudflare resterait orpheline).
        if (Object.keys(modifs).length) {
          for (const col in ligne) if (/chemin/.test(col) && ligne[col] === chemin) modifs[col] = 'site/' + categorie + '/' + chemin;
        }
        if (Object.keys(modifs).length) {
          const { error: e2 } = await sb.from(t).update(modifs).eq('id', ligne.id);
          if (e2) throw new Error('mise à jour impossible (' + nomFiche(t, ligne) + ') : ' + e2.message);
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

  function texteDe(fiches, conf) { return JSON.stringify(conf.tables.map(t => fiches[t])); }

  async function nettoyer() {
    const btn = document.getElementById('nettoyage-supabase-btn');
    const msg = document.getElementById('nettoyage-supabase-msg');
    btn.disabled = true;
    msg.className = 'form-msg ok';
    msg.style.whiteSpace = 'pre-line';
    msg.textContent = 'Vérification des fiches…';
    try {
      // 1. Tout ce que les fiches citent encore.
      let fiches = await lireFiches();

      // 2. Fichiers présents chez Supabase.
      const inventaire = {};
      const aDeplacer = [];
      let total = 0;
      for (const conf of BUCKETS) {
        msg.textContent = 'Inventaire de « ' + conf.bucket + ' »…';
        inventaire[conf.bucket] = await listerTout(conf.bucket, '');
        total += inventaire[conf.bucket].length;
        if (!conf.deplacer) continue;
        const texte = texteDe(fiches, conf);
        for (const f of inventaire[conf.bucket]) if (cite(texte, conf, f.chemin)) aDeplacer.push({ conf: conf, chemin: f.chemin });
      }
      if (!total) {
        msg.textContent = 'Rien à nettoyer : plus aucune photo chez Supabase (en dehors des photos des mannequins).';
        btn.disabled = false;
        return;
      }
      if (!confirm(total + ' photo(s) encore chez Supabase (actualités, événements, partenaires, candidatures, inscriptions — les mannequins ne sont pas concernés).' +
          (aDeplacer.length ? '\n' + aDeplacer.length + ' photo(s) du site encore utilisée(s) : d’abord recopiée(s) chez Cloudflare, fiche(s) mise(s) à jour.' : '') +
          '\n\nTout ce qui ne sert plus sera effacé de Supabase. Continuer ?')) {
        msg.textContent = 'Annulé : rien n’a été supprimé.';
        btn.disabled = false;
        return;
      }

      // 3. Photos du site encore citées : recopie chez R2 et mise à jour des fiches, puis relecture.
      const erreursDeplacement = [];
      let n = 0;
      for (const d of aDeplacer) {
        msg.textContent = 'Recopie chez Cloudflare… ' + (++n) + ' / ' + aDeplacer.length;
        try { await deplacerVersR2(d.conf, d.chemin, fiches); }
        catch (e) { erreursDeplacement.push(d.conf.bucket + '/' + d.chemin + ' : ' + ((e && e.message) || e)); }
      }
      if (aDeplacer.length) fiches = await lireFiches();

      // Ce qui ne sert plus (ce qui est encore cité reste, par sécurité).
      const aSupprimer = {};
      const gardes = [];
      let nb = 0, octets = 0;
      for (const conf of BUCKETS) {
        const texte = texteDe(fiches, conf);
        aSupprimer[conf.bucket] = [];
        for (const f of inventaire[conf.bucket]) {
          if (cite(texte, conf, f.chemin)) {
            const ou = [];
            for (const t of conf.tables) for (const l of fiches[t]) if (cite(JSON.stringify(l), conf, f.chemin)) ou.push(nomFiche(t, l));
            gardes.push(conf.bucket + '/' + f.chemin + ' — ' + (ou.join(', ') || 'fiche inconnue'));
            continue;
          }
          aSupprimer[conf.bucket].push(f.chemin);
          nb++; octets += f.taille;
        }
      }
      const mo = (octets / 1048576).toFixed(1);

      // 4. Suppression par paquets de 100.
      let faits = 0;
      for (const conf of BUCKETS) {
        const liste = aSupprimer[conf.bucket];
        for (let i = 0; i < liste.length; i += 100) {
          const { error } = await sb.storage.from(conf.bucket).remove(liste.slice(i, i + 100));
          if (error) throw new Error('suppression interrompue (' + error.message + ') — ' + faits + ' fichier(s) déjà supprimé(s)');
          faits += Math.min(100, liste.length - i);
          msg.textContent = 'Suppression… ' + faits + ' / ' + nb;
        }
      }
      const deplaces = aDeplacer.length - erreursDeplacement.length;
      msg.textContent = '✓ ' + faits + ' photo(s) supprimée(s) de Supabase — ' + mo + ' Mo libérés.' +
        (deplaces > 0 ? '\n' + deplaces + ' photo(s) recopiée(s) chez Cloudflare, fiche(s) mise(s) à jour.' : '') +
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
