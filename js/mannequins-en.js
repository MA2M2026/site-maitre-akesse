let tousLesProfils = [];
let categorieActive = 'tous';

async function chargerMannequins() {
  const vide = document.getElementById('vide');
  if (!sb) {
    vide.textContent = 'Failed to load the Book (unstable connection?). Please reload the page.';
    vide.style.display = 'block';
    return;
  }

  const { data: profils, error } = await sb
    .from('model_profiles')
    .select('id, full_name, city, category, height_cm, carnation, clothing_size, availability')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(300);

  if (error || !profils || profils.length === 0) {
    vide.style.display = 'block';
    return;
  }

  const ids = profils.map(p => p.id);
  const { data: photos } = await sb.rpc('photos_couverture_mannequins', { ids });

  const photoParMannequin = {};
  (photos || []).forEach(p => {
    photoParMannequin[p.model_id] = p.url;
  });

  profils.forEach(profil => {
    profil.photoUrl = photoParMannequin[profil.id] || '../assets/logo-dark-bg.png';
  });

  tousLesProfils = profils;
  appliquerFiltres();
}

function appliquerFiltres() {
  const grille = document.getElementById('grille');
  const vide = document.getElementById('vide');
  grille.innerHTML = '';

  const tailleMin = parseInt(document.getElementById('f-taille-min').value) || 0;
  const tailleMax = parseInt(document.getElementById('f-taille-max').value) || 9999;
  const carnation = document.getElementById('f-carnation').value;
  const vetements = document.getElementById('f-vetements').value.trim().toLowerCase();
  const disponibilite = document.getElementById('f-disponibilite').value;
  const recherche = document.getElementById('f-recherche').value.trim().toLowerCase();

  const resultats = tousLesProfils.filter(p => {
    if (categorieActive !== 'tous' && (p.category || 'new-faces') !== categorieActive) return false;
    if (p.height_cm && (p.height_cm < tailleMin || p.height_cm > tailleMax)) return false;
    if (carnation && p.carnation !== carnation) return false;
    if (vetements && !(p.clothing_size || '').toLowerCase().includes(vetements)) return false;
    if (disponibilite && p.availability !== disponibilite) return false;
    if (recherche && !(p.full_name || '').toLowerCase().includes(recherche)) return false;
    return true;
  });

  if (resultats.length === 0) {
    vide.style.display = 'block';
    return;
  }
  vide.style.display = 'none';

  resultats.forEach(profil => {
    const carte = document.createElement('div');
    carte.className = 'medaillon-carte reveal';
    const dejaSelectionne = estDansSelection(profil.id);
    carte.innerHTML = `
      <button class="btn-selection${dejaSelectionne ? ' est-selectionne' : ''}" data-id="${profil.id}">
        ${dejaSelectionne ? '✓' : '+'}
      </button>
      <a href="mannequin.html?id=${profil.id}" class="u-flex-col-centre">
        <div class="medaillon-photo">
          <img src="${echapperHtml(profil.photoUrl)}" alt="${echapperHtml(profil.full_name || 'Model')}" loading="lazy">
          <div class="book-carte-legende">
            <div class="medaillon-nom">${echapperHtml(profil.full_name || 'Model')}</div>
            <div class="medaillon-info">${echapperHtml(profil.city || '')}${profil.height_cm ? ' · ' + profil.height_cm + ' cm' : ''}</div>
          </div>
        </div>
      </a>
    `;
    grille.appendChild(carte);

    carte.querySelector('.btn-selection').addEventListener('click', (e) => {
      e.preventDefault();
      if (estDansSelection(profil.id)) {
        retirerSelection(profil.id);
      } else {
        ajouterSelection({ id: profil.id, full_name: profil.full_name, height_cm: profil.height_cm, photoUrl: profil.photoUrl });
      }
      appliquerFiltres();
    });
  });
}

document.querySelectorAll('.filtre-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filtre-btn').forEach(b => b.classList.remove('actif'));
    btn.classList.add('actif');
    categorieActive = btn.dataset.cat;
    appliquerFiltres();
  });
});

['f-taille-min', 'f-taille-max', 'f-carnation', 'f-vetements', 'f-disponibilite', 'f-recherche'].forEach(id => {
  document.getElementById(id).addEventListener('input', appliquerFiltres);
});

chargerMannequins();
