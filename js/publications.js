// Fonctions communes aux pages Actualités et Événements (FR et EN), partagées le 11/10/2026
// (avant, recopiées dans js/actualites.js et js/evenements.js).
let newsModalEstOuverte = false;

// Tables et dossiers d'images des publications, partagés par les pages publiques et la
// nouvelle Administration (js/admin/site-contenu.js).
const PUBLICATIONS = {
  actualites: { table: 'actualites', tablePhotos: 'actualite_photos', colonne: 'actualite_id', dossier: 'actualites', seau: 'actualites-images' },
  evenements: { table: 'evenements', tablePhotos: 'evenement_photos', colonne: 'evenement_id', dossier: 'evenements', seau: 'evenements-images' }
};
const CATEGORIES_ACTUALITES = ['Casting', 'Mannequinat', 'Conseils', 'Événements'];

// Lien YouTube / Vimeo collé par l'agence → adresse du lecteur intégré (null si non reconnu).
function urlVideoIntegree(url) {
  if (!url) return null;
  try {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let id = '';
      if (url.includes('youtu.be/')) id = url.split('youtu.be/')[1].split(/[?&]/)[0];
      else if (url.includes('/shorts/')) id = url.split('/shorts/')[1].split(/[?&]/)[0];
      else if (url.includes('/live/')) id = url.split('/live/')[1].split(/[?&]/)[0];
      else if (url.includes('/embed/')) id = url.split('/embed/')[1].split(/[?&]/)[0];
      else if (url.includes('v=')) id = url.split('v=')[1].split('&')[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.includes('vimeo.com')) {
      const id = url.split('vimeo.com/')[1].split(/[?&]/)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch (e) { return null; }
  return null;
}

function extraitTexte(texte, longueur) {
  if (!texte) return '';
  if (texte.length <= longueur) return texte;
  // Coupe entre deux mots (et non au milieu d'un mot : « Cette nouvel… »).
  let coupe = texte.slice(0, longueur);
  const espace = coupe.lastIndexOf(' ');
  if (espace > longueur * 0.6) coupe = coupe.slice(0, espace);
  // ponctuation et espaces de fin retirés un à un (sans expression régulière : SonarCloud S8786)
  let fin = coupe.length;
  while (fin > 0 && (/\s/.test(coupe[fin - 1]) || ',;:.-–—('.includes(coupe[fin - 1]))) fin--;
  return coupe.slice(0, fin) + '…';
}

function ouvrirNewsModal() {
  document.getElementById('news-modal').classList.add('active');
  if (!newsModalEstOuverte) { newsModalEstOuverte = true; window.verrouillerDefilement(); window.fenetreOuverte(fermerNewsModal); }
}

function fermerNewsModal() {
  document.getElementById('news-modal').classList.remove('active');
  if (window.ficheFermee) window.ficheFermee();
  if (newsModalEstOuverte) { newsModalEstOuverte = false; window.deverrouillerDefilement(); window.fenetreFermee(fermerNewsModal); }
}

function fermerRedaction() {
  document.getElementById('redaction-overlay').classList.remove('active');
  window.deverrouillerDefilement();
}

function apercuImageCouverture(url) {
  const img = document.getElementById('red-apercu-img');
  img.src = url || '';
  img.classList.toggle('u-hidden', !url);
}

// ---- Partagé le 12/10/2026 (code recopié signalé par SonarQube) ----

// Photos d'une publication dans la fenêtre de lecture : galerie (2 photos ou plus) ou photo
// seule, chacune ouvre la visionneuse plein écran. avant : HTML placé avant (ex. vidéo).
function afficherMediasPublication(zoneMedia, listePhotos, avant) {
  let mediaHtml = avant || '';
  if (listePhotos.length > 1) {
    // Composition adaptée au nombre de photos (voir .news-modal-galerie[data-count] dans
    // css/style.css) ; au-delà de 4, on garde une grille régulière classique.
    const compteGalerie = Math.min(listePhotos.length, 4);
    mediaHtml += `<div class="news-modal-galerie" data-count="${compteGalerie}">${listePhotos.map(p => `<div class="gal-item"><img src="${echapperHtml(urlLegere(p.url))}" loading="lazy" alt=""></div>`).join('')}</div>`;
  } else if (listePhotos.length === 1) {
    mediaHtml += `<img class="news-modal-img" src="${echapperHtml(urlLegere(listePhotos[0].url))}" alt="">`;
  }
  zoneMedia.innerHTML = mediaHtml;
  window.lightboxPhotos = listePhotos.map(p => p.url);
  zoneMedia.querySelectorAll('img').forEach((img, i) => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => ouvrirGalerieLightbox(window.lightboxPhotos, i));
  });
}

// ---- Partagé le 20/10/2026 (code recopié signalé par jscpd) ----

// Rédaction en cours : id de la publication modifiée (null = nouvelle) et photos choisies.
const redaction = { id: null, images: [] };

// Fenêtre de rédaction (administratrice) : aperçu des photos choisies, boutons ouvrir /
// annuler / fermer / supprimer. question : confirmation avant suppression ; recharger : la
// liste de la page.
function brancherRedaction(t, ouvrirRedaction, question, recharger) {
  document.getElementById('red-images').addEventListener('change', (e) => {
    const fichiers = Array.from(e.target.files || []);
    redaction.images = fichiers;
    const conteneur = document.getElementById('red-images-apercu');
    conteneur.innerHTML = '';
    fichiers.forEach(fichier => {
      conteneur.insertAdjacentHTML('beforeend', `<div class="ria-item"><img src="${URL.createObjectURL(fichier)}" alt=""></div>`);
    });
    if (fichiers.length) apercuImageCouverture(URL.createObjectURL(fichiers[0]));
  });
  document.getElementById('ouvrir-redaction-btn').addEventListener('click', () => ouvrirRedaction(null));
  document.getElementById('red-annuler-btn').addEventListener('click', fermerRedaction);
  document.getElementById('redaction-fermer').addEventListener('click', fermerRedaction);
  document.getElementById('redaction-overlay').addEventListener('click', (e) => { if (e.target.id === 'redaction-overlay') fermerRedaction(); });
  document.getElementById('red-supprimer-btn').addEventListener('click', () => {
    void supprimerPublication(t, redaction.id, question, recharger);
  });
}

// Ouvre la fenêtre de rédaction, vide ou remplie avec la publication existante ; les champs
// propres à la page (catégorie, date, lieu…) sont remplis ensuite par la page.
// textes : { nouvelle, modifier, images, publier } (titre de la fenêtre, champ photos, bouton).
function ouvrirRedactionPublication(existante, textes) {
  redaction.id = existante ? existante.id : null;
  redaction.images = [];
  document.getElementById('redaction-titre-mode').textContent = existante ? textes.modifier : textes.nouvelle;
  document.getElementById('red-titre').value = existante ? (existante.titre || '') : '';
  document.getElementById('red-images').value = '';
  document.getElementById('red-images-label').textContent = existante ? T('Ajouter des photos (s’ajoutent à celles déjà en ligne)', 'Add photos (added to those already online)') : textes.images;
  document.getElementById('red-enregistrer-btn').textContent = existante ? T('Enregistrer', 'Save') : textes.publier;
  document.getElementById('red-supprimer-btn').classList.toggle('u-hidden', !existante);
  document.getElementById('red-msg').style.display = 'none';
  document.getElementById('red-images-apercu').innerHTML = '';
  apercuImageCouverture(existante ? existante.image_url : null);
  document.getElementById('redaction-overlay').classList.add('active');
  window.verrouillerDefilement();
}

// Message sous le formulaire de rédaction (classe : 'ok' ou 'err').
function messageRedaction(classe, texte) {
  const msg = document.getElementById('red-msg');
  msg.className = 'form-msg ' + classe; msg.textContent = texte; msg.style.display = 'block';
}

// Publie la rédaction en cours (ou enregistre la modification) : photos d'abord, puis la
// publication. champs : colonnes propres à la page ; publiee(n) : message après publication.
async function enregistrerPublication(t, champs, publiee, recharger) {
  const fichiers = redaction.images;
  messageRedaction('ok', fichiers.length ? T(`Envoi de ${fichiers.length} photo(s) en cours…`, `Uploading ${fichiers.length} photo(s)…`) : T('Enregistrement…', 'Saving…'));
  const r = await sauverPublication(t, redaction.id, champs, fichiers);
  if (!r.ok) { messageRedaction('err', redaction.id ? T('Erreur lors de la modification.', 'Error while updating.') : T("Erreur d'enregistrement.", 'Error saving.')); return; }
  messageRedaction('ok', redaction.id ? T('Modifications enregistrées !', 'Changes saved!') : publiee(r.photos));
  await recharger();
  setTimeout(fermerRedaction, 900);
}

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

// Fenêtre de lecture : ouverture (type : 'actu' ou 'evenement', pour le suivi des fiches) et,
// pour l'administratrice, modifier / supprimer la publication ouverte, se déconnecter.
// liste() : les publications chargées par la page.
let publicationOuverte = null;
function montrerFichePublication(type, p) {
  ouvrirNewsModal();
  publicationOuverte = p.id;
  if (window.ficheOuverte) window.ficheOuverte(type, p.id, p.titre);
  document.getElementById('news-modal-admin-actions').style.display = window.estAdminConnecte ? 'block' : 'none';
}
function brancherFicheLecture(t, liste, ouvrirRedaction, question, recharger) {
  document.getElementById('news-modal-fermer').addEventListener('click', fermerNewsModal);
  document.getElementById('news-modal').addEventListener('click', (e) => { if (e.target.id === 'news-modal') fermerNewsModal(); });
  void verifierAdmin();
  document.getElementById('news-modal-modifier-btn').addEventListener('click', () => {
    const p = (liste() || []).find(x => x.id === publicationOuverte);
    if (!p) return;
    fermerNewsModal();
    ouvrirRedaction(p);
  });
  document.getElementById('news-modal-supprimer-btn').addEventListener('click', () => {
    void supprimerPublication(t, publicationOuverte, question, recharger, fermerNewsModal);
  });
  document.getElementById('admin-logout-btn').addEventListener('click', async () => {
    await sbAdmin.auth.signOut();
    document.getElementById('admin-bloc').style.display = 'none';
    window.estAdminConnecte = false;
  });
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

// Supprime une publication puis ses images. Base d'abord : si la suppression échoue, les
// images restent intactes. t : comme ci-dessus + dossier et seau des images. fermer : la
// fenêtre à refermer ensuite (rédaction par défaut, ou fenêtre de lecture).
async function supprimerPublication(t, id, question, recharger, fermer) {
  if (!id || !confirm(question)) return;
  if (!(await effacerPublication(t, id))) { alert(T('La suppression a échoué. Réessayez.', 'Deletion failed. Please try again.')); return; }
  (fermer || fermerRedaction)();
  void recharger();
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
