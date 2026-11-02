// Écriture des Actualités et des Événements (phase 2, W4, 02/11/2026) : réservé à l'Administration (/admin/,
// js/admin/site-contenu.js). Servi seulement à l'agence connectée (middleware.js, SCRIPTS_ADMIN : « introuvable » sinon).
// Lecture (tables, vidéos, fenêtre de lecture) : js/publications-lecture.js, chargé avant.

// Publie (id null) ou modifie une publication : photos d'abord, puis la ligne, puis ses photos.
// Renvoie { ok, id, photos } ; ok est faux si rien n'a été enregistré (session expirée comprise).
async function sauverPublication(t, idExistant, champs, fichiers) {
  const id = idExistant || crypto.randomUUID();
  const urls = await envoyerPhotosPublication(t, id, fichiers || []);
  const requete = idExistant ? sbAdmin.from(t.table).update(champs).eq('id', id)
    : sbAdmin.from(t.table).insert({ id, ...champs, image_url: urls.length ? urls[0].url : null });
  const { data, error } = await requete.select('id');
  if (error || !data || !data.length) return { ok: false, id, photos: 0 };
  await enregistrerPhotosPublication(t, id, urls, !!idExistant);
  return { ok: true, id, photos: urls.length };
}

// Envoie les photos choisies (HEIC converties) dans site/<t.dossier>/<id>/ ; une photo qui
// échoue est sautée. Renvoie [{ url, chemin }].
async function envoyerPhotosPublication(t, id, fichiers) {
  const dossier = t.dossier;
  const urls = [];
  for (const fichierOriginal of fichiers) {
    const fichier = await convertirSiHeic(fichierOriginal);
    const chemin = `site/${dossier}/${id}/${Date.now()}-${nomFichierSur(fichier.name)}`;
    try {
      const url = await envoyerImageSite(dossier, chemin, fichier);
      urls.push({ url, chemin });
    } catch (e) { continue; }
  }
  return urls;
}

// Enregistre les photos envoyées pour une publication ; en modification, la première
// devient la couverture si la publication n'en avait pas encore.
// t : { table: 'actualites', tablePhotos: 'actualite_photos', colonne: 'actualite_id' }
async function enregistrerPhotosPublication(t, id, urls, modification) {
  for (const photo of urls) {
    await sbAdmin.from(t.tablePhotos).insert({ [t.colonne]: id, url: photo.url, chemin: photo.chemin });
  }
  if (modification && urls.length) {
    const { data: actuelle } = await sbAdmin.from(t.table).select('image_url').eq('id', id).maybeSingle();
    if (actuelle && !actuelle.image_url) await sbAdmin.from(t.table).update({ image_url: urls[0].url }).eq('id', id);
  }
}

// Couverture d'une publication modifiée — UNE règle, pour l'aperçu de l'Administration
// (js/admin/site-contenu.js) et pour l'enregistrement : la photo choisie si elle reste (ancienneUrl : une
// photo remplacée est encore désignée par son ancienne adresse), sinon une ancienne image hors de la liste
// (horsListe), sinon la première photo restante. liste = [{ url, ancienneUrl, retiree }].
function choisirCouverture(liste, couverture) {
  const designe = (p) => !!couverture && (p.url === couverture || p.ancienneUrl === couverture);
  const gardees = liste.filter((p) => !p.retiree);
  const visee = gardees.find(designe);
  if (visee) return { photo: visee };
  if (couverture && !liste.some(designe)) return { horsListe: couverture };
  return { photo: gardees[0] || null };
}

// Photos déjà en ligne d'une publication modifiée (31/10/2026, demande de la propriétaire : avant,
// seul le texte se modifiait) : liste = photos dans l'ordre voulu [{ id, url, chemin, created_at,
// retiree, remplacement (fichier ou null) }], couverture = adresse de la photo de couverture choisie.
// Ordre : remplacements (nouvelle photo envoyée, la même ligne pointe vers elle), lignes retirées, ordre,
// couverture, PUIS les anciens fichiers (retirés ou remplacés) sont effacés du stockage. Si une étape
// échoue : false, et ce qui est déjà fait reste noté sur les photos (ancienneUrl, aEffacer) pour qu'un
// nouvel essai termine le travail. L'ordre suit created_at (pages publiques, pas de colonne d'ordre) :
// les photos gardées sont renumérotées à partir de la plus ancienne, avant les photos ajoutées maintenant.
// Remplacements : nouvelle photo envoyée, la même ligne pointe vers elle ; si la base refuse, le nouveau fichier est effacé
async function remplacerPhotosEnLigne(t, id, gardees) {
  for (const p of gardees.filter((x) => x.remplacement)) {
    const [nouvelle] = await envoyerPhotosPublication(t, id, [p.remplacement]);
    if (!nouvelle) return false;
    const { data, error } = await sbAdmin.from(t.tablePhotos).update({ url: nouvelle.url, chemin: nouvelle.chemin }).eq('id', p.id).select('id');
    if (error || !data?.length) { await supprimerCheminsImagesSite(t.dossier, t.seau, [nouvelle.chemin]); return false; }
    Object.assign(p, { ancienneUrl: p.ancienneUrl || p.url, aEffacer: (p.aEffacer || []).concat(p.chemin || []), url: nouvelle.url, chemin: nouvelle.chemin, remplacement: null });
  }
  return true;
}

// Lignes retirées ; moins de lignes effacées que prévu : refus de la base, ou déjà effacées (nouvel essai) ? on vérifie
async function retirerPhotosEnLigne(t, retirees) {
  if (!retirees.length) return true;
  const ids = retirees.map((p) => p.id);
  const { data, error } = await sbAdmin.from(t.tablePhotos).delete().in('id', ids).select('id');
  if (error || !data) return false;
  if (data.length === ids.length) return true;
  const { data: restantes, error: e2 } = await sbAdmin.from(t.tablePhotos).select('id').in('id', ids);
  return !e2 && !!restantes && !restantes.length;
}

async function appliquerPhotosEnLigne(t, id, liste, couverture) {
  const retirees = liste.filter((p) => p.retiree), gardees = liste.filter((p) => !p.retiree);
  if (!(await remplacerPhotosEnLigne(t, id, gardees)) || !(await retirerPhotosEnLigne(t, retirees))) return false;
  const depart = Math.min(...liste.map((p) => Date.parse(p.created_at)).filter((x) => !Number.isNaN(x)), Date.now() - 86400000);
  const ordres = gardees.map((p, i) => [p, new Date(depart + i * 1000).toISOString()]).filter(([p, quand]) => Date.parse(p.created_at) !== Date.parse(quand));
  const reponses = await Promise.all(ordres.map(([p, quand]) => sbAdmin.from(t.tablePhotos).update({ created_at: quand }).eq('id', p.id)));
  if (reponses.some((r) => r.error)) return false;
  ordres.forEach(([p, quand]) => { p.created_at = quand; });
  const choix = choisirCouverture(liste, couverture);
  let image = choix.photo ? choix.photo.url : choix.horsListe || null;
  if (!image) {
    const { data: premiere } = await sbAdmin.from(t.tablePhotos).select('url').eq(t.colonne, id).order('created_at', { ascending: true }).limit(1);
    image = premiere?.[0]?.url || null;
  }
  const { error } = await sbAdmin.from(t.table).update({ image_url: image }).eq('id', id);
  if (error) return false;
  const chemins = retirees.map((p) => p.chemin).concat(...gardees.map((p) => p.aEffacer || [])).filter(Boolean);
  if (chemins.length) await supprimerCheminsImagesSite(t.dossier, t.seau, chemins);
  gardees.forEach((p) => { p.aEffacer = []; });
  return true;
}

// Efface une publication puis ses images (base d'abord : si elle refuse, les images restent).
// Renvoie true si la publication a bien été supprimée.
async function effacerPublication(t, id) {
  const { data: photos } = await sbAdmin.from(t.tablePhotos).select('chemin').eq(t.colonne, id);
  const chemins = (photos || []).map(p => p.chemin).filter(Boolean);
  const { data, error } = await sbAdmin.from(t.table).delete().eq('id', id).select('id');
  if (error || !data || !data.length) return false;
  if (chemins.length) await supprimerCheminsImagesSite(t.dossier, t.seau, chemins);
  return true;
}
