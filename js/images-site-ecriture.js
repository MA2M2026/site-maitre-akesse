// Images du site (actualités, événements, partenaires, couverture, vidéo, mot du fondateur) : envoi et suppression,
// réservés à l'agence (phase 2, W4, 02/11/2026 : avant dans js/app.js, chargé par toutes les pages publiques).
// Servi seulement à l'Administration connectée (middleware.js, SCRIPTS_ADMIN : « introuvable » sinon).
// Utilise sbAdmin (js/supabase-config.js) et envoyerAvecProgression, verifierEnvoiR2 (js/app.js).
// Sur Cloudflare R2, via api/r2-site-images.js (3 essais) ; progression (facultatif) : fonction appelée avec la part
// envoyée (0 à 1), utile pour les longues vidéos de l'accueil.
async function envoyerImageSite(categorie, chemin, fichier, progression) {
  // (photos des pages, actualités, événements, partenaires : lieu GPS et téléphone retirés — sansDonneesCachees, js/app.js)
  if (typeof sansDonneesCachees === 'function') fichier = await sansDonneesCachees(fichier, 4000, 0.92);
  const { data: { session } } = await sbAdmin.auth.getSession();
  if (!session) throw new Error('Session expirée, reconnectez-vous.');
  let derniereErreur;
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const reponsePresign = await fetch('/api/r2-site-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
        body: JSON.stringify({ categorie, chemin, contentType: fichier.type || 'image/jpeg', taille: fichier.size })
      });
      const resultat = await reponsePresign.json().catch(() => ({}));
      if (!reponsePresign.ok) throw new Error(resultat.error || "Échec de la préparation de l'envoi.");
      const reponseUpload = await envoyerAvecProgression(resultat.uploadUrl, fichier, progression);
      if (!reponseUpload.ok) throw new Error("Échec de l'envoi du fichier.");
      await verifierEnvoiR2('/api/r2-site-images', session.access_token, { categorie, chemin, contentType: fichier.type || 'image/jpeg' });
      return resultat.publicUrl;
    } catch (e) {
      derniereErreur = e;
      if (e && e.refuse) break;  // (pas un vrai fichier du type annoncé : inutile de réessayer)
      if (essai < 3) await new Promise(r => setTimeout(r, 700 * essai));
    }
  }
  throw derniereErreur;
}

// Autre action sur un fichier du site (suppression ; pour la note d'intégration : 'lire',
// 'nettoyer'). Renvoie la réponse du serveur, ou lève une erreur.
async function actionImageSite(corps) {
  const { data: { session } } = await sbAdmin.auth.getSession();
  if (!session) throw new Error('Session expirée, reconnectez-vous.');
  const rep = await fetch('/api/r2-site-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
    body: JSON.stringify(corps)
  });
  const resultat = await rep.json().catch(() => ({}));
  if (!rep.ok) throw new Error(resultat.error || 'Le serveur a refusé la demande.');
  return resultat;
}

async function supprimerImageSite(categorie, chemin) {
  if (!chemin) return;
  try { await actionImageSite({ action: 'suppression', categorie, chemin }); } catch (e) {}
}

// Pendant la période de transition, certaines lignes ont encore leur
// ancienne image chez Supabase Storage (chemin sans préfixe "site/"),
// pendant que les nouvelles passent déjà par R2 — trie et supprime au
// bon endroit selon le cas, sans que chaque page ait à s'en soucier.
async function supprimerCheminsImagesSite(categorie, bucketSupabase, chemins) {
  const versR2 = [];
  const versSupabase = [];
  (chemins || []).filter(Boolean).forEach(c => (c.startsWith('site/' + categorie + '/') ? versR2 : versSupabase).push(c));
  await Promise.all(versR2.map(c => supprimerImageSite(categorie, c)));
  if (versSupabase.length) await sbAdmin.storage.from(bucketSupabase).remove(versSupabase);
}

