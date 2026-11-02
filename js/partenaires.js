// Page Partenaires (partenaires.html et en/partenaires.html) : un seul script pour le
// français et l'anglais (11/10/2026 : avant, deux copies dans les pages). EN, T : js/app.js.
window.partenairesData = [];


async function chargerPartenaires() {
  const grille = document.getElementById('partenaires-grille');
  const vide = document.getElementById('partenaires-vide');
  const d = donneesServeur('partenaires-donnees');  // préparés par le serveur (middleware.js ; js/app.js)
  const serveur = d && Array.isArray(d.liste) ? d : null;
  if (!serveur && !sb) {
    // "sb" peut valoir null sur une connexion instable (échec de chargement de
    // la bibliothèque Supabase, servie depuis un CDN) — message clair plutôt
    // que de laisser croire qu'il n'y a simplement aucun partenaire.
    vide.textContent = T('Le chargement des partenaires a échoué (connexion instable ?). Rechargez la page.', 'Failed to load partners (unstable connection?). Reload the page.');
    vide.style.display = 'block';
    return;
  }
  const { data, error } = serveur ? { data: serveur.liste, error: null } : await sb.from('partenaires').select('id, nom, structure, evenement, role, description, logo_url, created_at').order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    grille.innerHTML = '';
    vide.style.display = 'block';
    return;
  }
  await versAnglais(data, ['structure', 'evenement', 'role', 'description']);  // (page anglaise, js/app.js)
  // après la traduction (grand test du 26/10/2026) : masquer ce message libère la place
  // réservée à la liste (css/style.css) ; avant, le bas de page remontait le temps de traduire
  vide.style.display = 'none';
  window.partenairesData = data;

  // cartes dessinées comme par le serveur (js/rendu-publications.js), après la traduction anglaise
  grille.innerHTML = data.map((p, i) => window.RenduPublications.partenaire(p, i, { en: EN, logo: p.logo_url ? urlLegere(p.logo_url) : '' })).join('');

  grille.querySelectorAll('.news-carte').forEach(carte => {
    carte.addEventListener('click', () => ouvrirPartModal(parseInt(carte.dataset.index)));
  });

  const idDepuisUrl = new URLSearchParams(window.location.search).get('partenaire');
  if (idDepuisUrl) {
    const index = data.findIndex(p => p.id === idDepuisUrl);
    if (index > -1) ouvrirPartModal(index);
  }
}
chargerPartenaires().catch(e => { if (window.signalerErreur) window.signalerErreur('Partenaires : chargement', (e && e.message) || String(e)); });

function ouvrirPartModal(index) {
  const p = window.partenairesData[index];
  if (!p) return;
  window.partenaireModalCourant = p.id;

  document.getElementById('part-modal-logo').src = urlLegere(p.logo_url) || (EN ? '../' : '') + 'assets/logo-dark-bg.png';
  document.getElementById('part-modal-fond').src = document.getElementById('part-modal-logo').src;
  document.getElementById('part-une-nom').textContent = p.nom || '';
  document.getElementById('part-une-role').textContent = [p.role, p.structure].filter(x => x && !/^(autre|other)$/i.test(x)).join(' · ');
  document.querySelector('#part-modal .news-modal-contenu').scrollTop = 0;
  document.getElementById('part-modal-logo').onclick = () => {
    if (p.logo_url) ouvrirGalerieLightbox([p.logo_url], 0);
  };
  document.getElementById('part-modal-role').textContent = p.role || '';
  document.getElementById('part-modal-nom').textContent = p.nom || '';
  document.getElementById('part-modal-structure').textContent = p.structure || '';
  document.getElementById('part-modal-evenement').textContent = p.evenement || '';
  document.getElementById('part-modal-description').innerHTML = rendreContenuRiche(p.description);

  document.getElementById('part-modal-nom').style.display = 'block';
  document.getElementById('part-modal-structure').style.display = 'block';
  document.getElementById('part-modal-evenement').style.display = 'block';
  document.getElementById('part-modal-description').style.display = 'block';

  afficherPartModal();
}
// Verrouille le défilement de la page tant que la fiche est ouverte (même mécanisme,
// compatible iPhone, que celui du menu — voir js/app.js).
let partModalEstOuverte = false;
function afficherPartModal() {
  document.getElementById('part-modal').classList.add('active');
  if (!partModalEstOuverte) { partModalEstOuverte = true; window.verrouillerDefilement(); window.fenetreOuverte(fermerPartModal); }
}
document.getElementById('part-une-suite').addEventListener('click', () => {
  document.querySelector('#part-modal .news-modal-corps').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
function fermerPartModal() {
  document.getElementById('part-modal').classList.remove('active');
  if (partModalEstOuverte) { partModalEstOuverte = false; window.deverrouillerDefilement(); window.fenetreFermee(fermerPartModal); }
}
document.getElementById('part-modal-fermer').addEventListener('click', fermerPartModal);

// (phase 2, W4, 02/11/2026) ajouter, modifier ou supprimer un partenaire : dans l'Administration seulement ; plus aucun
// code d'écriture dans la page publique.
