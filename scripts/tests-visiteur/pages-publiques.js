// Pages publiques et base simulée communes aux tests de lisibilité (test-visuel.js,
// test-lisibilite-photos.js) — un seul endroit pour la liste des pages.
const tables = {
  model_profiles: [{ id: 'a1', full_name: 'Awa Koné', city: 'Abidjan', height_cm: 178, weight_kg: 55, category: 'femme', genre: 'femme', published: true, featured: true, slug: 'awa-kone' }],
  model_photos: [{ id: 'p1', model_id: 'a1', url: 'https://x/1.jpg', principale: true, categorie: 'book' }],
  actualites: [{ id: 'n1', titre: 'Casting Orange', contenu: '<p>Texte</p>', categorie: 'Casting', created_at: '2026-10-01T10:00:00Z', a_la_une: true }],
  evenements: [{ id: 'e1', titre: 'Défilé Abidjan', contenu: '<p>D</p>', date_evenement: '2026-09-20', created_at: '2026-09-21T10:00:00Z' }],
  partenaires: [{ id: 'pa', nom: 'Orange CI', logo_url: 'https://x/o.png' }],
  bandeau_annonce: [], instagram_posts_cache: [], mot_responsable: [], admins: []
};
const rpc = { photos_couverture_mannequins: [{ model_id: 'a1', url: 'https://x/1.jpg' }] };
// Toutes les pages publiques (le tableau de bord et la gestion de la boutique sont protégés et
// couverts par test-admin.js / test-boutique.js)
const pages = [
  'index', 'qui-sommes-nous', 'mannequins', 'mannequin.html?id=a1', 'actualites', 'evenements', 'agenda', 'parcours',
  'partenaires', 'services', 'selection', 'contact', 'integrer-agence', 'candidature', 'inscription-mannequin',
  'mentions-legales', 'politique-confidentialite'
].flatMap(n => [n, 'en/' + n]).concat(['espace-mannequin', 'reinitialiser-mot-de-passe', '404',
  'marketplace/index', 'marketplace/cgv', 'marketplace/suivi', 'marketplace/commande'])
  .map(n => (n.includes('.html') ? n : n + '.html'));
module.exports = { tables, rpc, pages };
