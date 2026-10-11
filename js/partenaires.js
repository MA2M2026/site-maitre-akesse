// Page Partenaires (partenaires.html et en/partenaires.html) : un seul script pour le
// français et l'anglais (11/10/2026 : avant, deux copies dans les pages). EN, T : js/app.js.
window.partenairesData = [];

const quillPDescription = creerEditeurRiche('p-description-editeur', EN ? 'Write here… (you can paste text already formatted from Word)' : undefined);
const quillEditPDescription = creerEditeurRiche('edit-p-description-editeur', EN ? 'Write here… (you can paste text already formatted from Word)' : undefined);

async function chargerPartenaires() {
  const grille = document.getElementById('partenaires-grille');
  const vide = document.getElementById('partenaires-vide');
  if (!sb) {
    // "sb" peut valoir null sur une connexion instable (échec de chargement de
    // la bibliothèque Supabase, servie depuis un CDN) — message clair plutôt
    // que de laisser croire qu'il n'y a simplement aucun partenaire.
    vide.textContent = T('Le chargement des partenaires a échoué (connexion instable ?). Rechargez la page.', 'Failed to load partners (unstable connection?). Reload the page.');
    vide.style.display = 'block';
    return;
  }
  const { data, error } = await sb.from('partenaires').select('*').order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    grille.innerHTML = '';
    vide.style.display = 'block';
    return;
  }
  vide.style.display = 'none';
  window.partenairesData = data;

  grille.innerHTML = data.map((p, i) => `
    <div class="news-carte reveal" data-index="${i}">
      <div class="news-img ${EN ? 'enpt-9' : 'pt-9'}">
        ${p.logo_url
          ? `<img src="${echapperHtml(p.logo_url)}" loading="lazy" alt="${echapperHtml(p.nom)}" class="${EN ? 'enpt-10' : 'pt-10'}">`
          : `<span class="${EN ? 'enpt-11' : 'pt-11'}">${echapperHtml((p.nom || '?').charAt(0))}</span>`}
      </div>
      <div class="news-corps">
        <div class="news-date">${echapperHtml(p.role || '')}</div>
        <h3>${echapperHtml(p.nom || '')}</h3>
        <span class="news-lire">${T('Voir la fiche →', 'View Details →')}</span>
      </div>
    </div>
  `).join('');

  grille.querySelectorAll('.news-carte').forEach(carte => {
    carte.addEventListener('click', () => ouvrirPartModal(parseInt(carte.dataset.index)));
  });

  const idDepuisUrl = new URLSearchParams(window.location.search).get('partenaire');
  if (idDepuisUrl) {
    const index = data.findIndex(p => p.id === idDepuisUrl);
    if (index > -1) ouvrirPartModal(index);
  }
}
void chargerPartenaires();

function ouvrirPartModal(index) {
  const p = window.partenairesData[index];
  if (!p) return;
  window.partenaireModalCourant = p.id;

  document.getElementById('part-modal-logo').src = p.logo_url || (EN ? '../' : '') + 'assets/logo-dark-bg.png';
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
  document.getElementById('part-modal-edition').style.display = 'none';
  document.getElementById('part-modal-admin-actions').style.display = window.estAdminConnecte ? 'block' : 'none';

  afficherPartModal();
}
// Verrouille le défilement de la page tant que la fiche est ouverte (même mécanisme,
// compatible iPhone, que celui du menu — voir js/app.js).
let partModalEstOuverte = false;
function afficherPartModal() {
  document.getElementById('part-modal').classList.add('active');
  if (!partModalEstOuverte) { partModalEstOuverte = true; window.verrouillerDefilement(); }
}
document.getElementById('part-une-suite').addEventListener('click', () => {
  document.querySelector('#part-modal .news-modal-corps').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
function fermerPartModal() {
  document.getElementById('part-modal').classList.remove('active');
  if (partModalEstOuverte) { partModalEstOuverte = false; window.deverrouillerDefilement(); }
}
document.getElementById('part-modal-fermer').addEventListener('click', fermerPartModal);

// --- Modification / suppression directement depuis la fiche ouverte (admin) ---
document.getElementById('part-modal-modifier-btn').addEventListener('click', () => {
  const p = window.partenairesData.find(x => x.id === window.partenaireModalCourant);
  if (!p) return;
  document.getElementById('edit-p-nom').value = p.nom || '';
  document.getElementById('edit-p-structure').value = p.structure || '';
  document.getElementById('edit-p-evenement').value = p.evenement || '';
  document.getElementById('edit-p-role').value = p.role || '';
  chargerContenuDansEditeur(quillEditPDescription, p.description);
  document.getElementById('edit-p-logo').value = '';
  document.getElementById('edit-p-msg').style.display = 'none';

  document.getElementById('part-modal-nom').style.display = 'none';
  document.getElementById('part-modal-structure').style.display = 'none';
  document.getElementById('part-modal-evenement').style.display = 'none';
  document.getElementById('part-modal-description').style.display = 'none';
  document.getElementById('part-modal-admin-actions').style.display = 'none';
  document.getElementById('part-modal-edition').style.display = 'block';
});

document.getElementById('edit-p-annuler-btn').addEventListener('click', () => {
  document.getElementById('part-modal-edition').style.display = 'none';
  document.getElementById('part-modal-nom').style.display = 'block';
  document.getElementById('part-modal-structure').style.display = 'block';
  document.getElementById('part-modal-evenement').style.display = 'block';
  document.getElementById('part-modal-description').style.display = 'block';
  document.getElementById('part-modal-admin-actions').style.display = 'block';
});

document.getElementById('edit-p-enregistrer-btn').addEventListener('click', async () => {
  const id = window.partenaireModalCourant;
  const msg = document.getElementById('edit-p-msg');
  const nom = document.getElementById('edit-p-nom').value.trim();
  if (!nom) { msg.className = 'form-msg err'; msg.textContent = T('Le nom est obligatoire.', 'Name is required.'); msg.style.display = 'block'; return; }

  msg.className = 'form-msg ok'; msg.textContent = T('Enregistrement…', 'Saving…'); msg.style.display = 'block';

  const maj = {
    nom,
    structure: document.getElementById('edit-p-structure').value.trim(),
    evenement: document.getElementById('edit-p-evenement').value.trim(),
    role: document.getElementById('edit-p-role').value,
    description: lireContenuEditeur(quillEditPDescription)
  };

  const logoInput = document.getElementById('edit-p-logo');
  if (logoInput.files[0]) {
    const fichier = await convertirSiHeic(logoInput.files[0], 0.9);
    const chemin = `site/partenaires/${id}/${Date.now()}-${nomFichierSur(fichier.name)}`;
    try {
      maj.logo_url = await envoyerImageSite('partenaires', chemin, fichier);
      maj.logo_chemin = chemin;
    } catch (e) {}
  }

  const { error } = await sbAdmin.from('partenaires').update(maj).eq('id', id);
  if (error) { msg.className = 'form-msg err'; msg.textContent = T('Erreur lors de la modification.', 'Error while updating.'); return; }

  msg.className = 'form-msg ok'; msg.textContent = T('Partenaire modifié !', 'Partner updated!');
  await chargerPartenaires();
  const index = window.partenairesData.findIndex(x => x.id === id);
  if (index > -1) ouvrirPartModal(index);
});

document.getElementById('part-modal-supprimer-btn').addEventListener('click', async () => {
  const id = window.partenaireModalCourant;
  if (!confirm(T('Supprimer définitivement ce partenaire ?', 'Permanently delete this partner?'))) return;
  const p = window.partenairesData.find(x => x.id === id);
  // Base d'abord : si la suppression échoue, les images restent intactes.
  const { error: erreurSuppression } = await sbAdmin.from('partenaires').delete().eq('id', id);
  if (erreurSuppression) { alert(T('La suppression a échoué. Réessayez.', 'Deletion failed. Please try again.')); return; }
  if (p && p.logo_chemin) await supprimerCheminsImagesSite('partenaires', 'partenaires-logos', [p.logo_chemin]);
  fermerPartModal();
  void chargerPartenaires();
});

// --- Ajout d'un nouveau partenaire ---
document.getElementById('p-publier-btn').addEventListener('click', async () => {
  const msg = document.getElementById('p-msg');
  const nom = document.getElementById('p-nom').value.trim();
  if (!nom) { msg.className = 'form-msg err'; msg.textContent = T('Le nom est obligatoire.', 'Name is required.'); msg.style.display = 'block'; return; }

  msg.className = 'form-msg ok'; msg.textContent = T('Enregistrement…', 'Saving…'); msg.style.display = 'block';

  const idPartenaire = crypto.randomUUID();
  let logo_url = null, logo_chemin = null;
  const logoInput = document.getElementById('p-logo');
  if (logoInput.files[0]) {
    const fichier = await convertirSiHeic(logoInput.files[0], 0.9);
    const chemin = `site/partenaires/${idPartenaire}/${Date.now()}-${nomFichierSur(fichier.name)}`;
    try {
      logo_url = await envoyerImageSite('partenaires', chemin, fichier);
      logo_chemin = chemin;
    } catch (e) {}
  }

  const { error } = await sbAdmin.from('partenaires').insert({
    id: idPartenaire, nom,
    structure: document.getElementById('p-structure').value.trim(),
    evenement: document.getElementById('p-evenement').value.trim(),
    role: document.getElementById('p-role').value,
    description: lireContenuEditeur(quillPDescription),
    logo_url, logo_chemin
  });

  if (error) { msg.className = 'form-msg err'; msg.textContent = T("Erreur d'enregistrement.", 'Error saving.'); return; }

  msg.className = 'form-msg ok'; msg.textContent = T('Partenaire ajouté !', 'Partner added!');
  document.getElementById('p-nom').value = '';
  document.getElementById('p-structure').value = '';
  document.getElementById('p-evenement').value = '';
  document.getElementById('p-role').value = '';
  if (quillPDescription) quillPDescription.setText('');
  logoInput.value = '';
  void chargerPartenaires();
});

// Aucune interface de connexion sur cette page publique : un admin se connecte
// depuis tableau-de-bord.html, puis sa session est simplement détectée ici pour
// révéler le panneau d'ajout de partenaire — sans aucune trace visible pour un visiteur.
document.getElementById('admin-logout-btn').addEventListener('click', async () => {
  await sbAdmin.auth.signOut();
  window.location.reload();
});

void verifierAdmin();
