// Partenaires : outils communs à la page publique (js/partenaires.js) et à la nouvelle
// Administration (js/admin/site-contenu.js), partagés le 22/10/2026 (règle « jamais de copie »).
const ROLES_PARTENAIRES = [['DA', 'DA (Directeur artistique)'], ['Styliste', 'Styliste'], ['Directeur de casting', 'Directeur de casting'],
  ['Promoteur', 'Promoteur'], ['Organisateur', 'Organisateur'], ['Régisseur', 'Régisseur'], ['Autre', 'Autre']];

// Envoie le logo d'un partenaire (HEIC converti) dans site/partenaires/<id>/ ; renvoie
// { logo_url, logo_chemin }, ou null si l'envoi a échoué.
async function envoyerLogoPartenaire(id, fichierOriginal) {
  const fichier = await convertirSiHeic(fichierOriginal, 0.9);
  const chemin = `site/partenaires/${id}/${Date.now()}-${nomFichierSur(fichier.name)}`;
  try {
    return { logo_url: await envoyerImageSite('partenaires', chemin, fichier), logo_chemin: chemin };
  } catch (e) { return null; }
}

// Supprime un partenaire puis son logo (base d'abord : si elle refuse, le logo reste).
// Renvoie true si le partenaire a bien été supprimé.
async function effacerPartenaire(p) {
  const { data, error } = await sbAdmin.from('partenaires').delete().eq('id', p.id).select('id');
  if (error || !data || !data.length) return false;
  if (p.logo_chemin) await supprimerCheminsImagesSite('partenaires', 'partenaires-logos', [p.logo_chemin]);
  return true;
}
