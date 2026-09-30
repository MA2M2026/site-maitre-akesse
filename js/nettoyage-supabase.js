// ================== Nettoyage des anciennes copies de photos sur Supabase ==================
// Demande de la propriétaire (30/09/2026) : supprimer de Supabase Storage les anciennes
// copies des photos d'ACTUALITÉS et d'ÉVÉNEMENTS, déjà recopiées chez Cloudflare R2
// (outil « Migration des images du site vers R2 »). Les photos des mannequins, les logos
// des partenaires et les photos de candidature / inscription ne sont PAS concernés.
//
// Sécurité : un fichier n'est supprimé que si AUCUNE fiche ne le cite encore (image de
// couverture, galerie, texte des fiches, contenu « À la une »). En cas de doute (lecture
// impossible d'une table), rien n'est supprimé. Confirmation demandée avant d'effacer.
(function () {
  const BUCKETS = ['actualites-images', 'evenements-images'];
  const TABLES = ['actualites', 'actualite_photos', 'evenements', 'evenement_photos', 'contenu_a_la_une'];

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
      const lectures = await Promise.all(TABLES.map(t => sb.from(t).select('*')));
      const echec = lectures.find(r => r.error);
      if (echec) throw new Error('lecture impossible des fiches (' + echec.error.message + ') — rien n’a été supprimé');
      const texte = JSON.stringify(lectures.map(r => r.data));

      // 2. Fichiers présents chez Supabase, et ceux qui ne servent plus.
      const aSupprimer = {};
      let nbGardes = 0, nb = 0, octets = 0;
      for (const bucket of BUCKETS) {
        msg.textContent = 'Inventaire de « ' + bucket + ' »…';
        const fichiers = await listerTout(bucket, '');
        aSupprimer[bucket] = [];
        for (const f of fichiers) {
          if (texte.indexOf(bucket + '/' + f.chemin) !== -1 || texte.indexOf(bucket + '/' + encodeURI(f.chemin)) !== -1) { nbGardes++; continue; }
          aSupprimer[bucket].push(f.chemin);
          nb++; octets += f.taille;
        }
      }
      const mo = (octets / 1048576).toFixed(1);
      if (!nb) {
        msg.textContent = 'Rien à nettoyer : aucune ancienne copie d’actualité ou d’événement sur Supabase' + (nbGardes ? ' (' + nbGardes + ' fichier(s) encore utilisé(s), conservé(s)).' : '.');
        btn.disabled = false;
        return;
      }
      if (!confirm(nb + ' ancienne(s) copie(s) de photos d’actualités et d’événements (' + mo + ' Mo) ne servent plus à aucune fiche.' +
          (nbGardes ? '\n' + nbGardes + ' fichier(s) encore utilisé(s) seront conservés.' : '') +
          '\n\nLes supprimer de Supabase ? Les photos restent affichées sur le site (elles sont chez Cloudflare).')) {
        msg.textContent = 'Annulé : rien n’a été supprimé.';
        btn.disabled = false;
        return;
      }

      // 3. Suppression par paquets de 100.
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
      msg.textContent = '✓ ' + faits + ' ancienne(s) copie(s) supprimée(s) — ' + mo + ' Mo libérés sur Supabase.' +
        (nbGardes ? ' ' + nbGardes + ' fichier(s) encore utilisé(s) conservé(s).' : '');
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
