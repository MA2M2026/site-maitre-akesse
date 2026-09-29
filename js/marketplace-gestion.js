// ================== MARKETPLACE — tableau de bord de la boutique ==================
// marketplace/gestion.html : produits (photos sur Cloudflare R2, tailles/couleurs,
// stock, prix, promotions), catégories, zones de livraison, réglages.
// Réservé aux administrateurs ayant validé leur code (2e facteur) dans cet onglet ;
// les règles de la base (RLS, Extension 98) refusent de toute façon toute écriture
// à un non-admin.
(function () {
  const principal = document.getElementById('mp-principal');
  let etat = { produits: [], categories: [], zones: [], reglages: null };
  let editeurDescription = null;

  const nouvelId = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });

  function message(el, texte, type) {
    if (!el) return;
    el.textContent = texte || '';
    el.className = 'mpg-message' + (type ? ' ' + type : '');
  }

  function erreurLisible(e) {
    const m = (e && (e.message || e.details)) || String(e || '');
    if (/duplicate key|23505/.test(m)) return 'Ce nom existe déjà : choisissez un nom légèrement différent.';
    if (/row-level security|permission|42501/.test(m)) return 'Action refusée : reconnectez-vous en administratrice.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Connexion coupée : vérifiez votre réseau puis réessayez.';
    return 'Erreur : ' + m;
  }

  // ------------------------------------------------------------ Chargement
  async function chargerTout() {
    const [produits, categories, zones, reglages] = await Promise.all([
      sbAdmin.from('boutique_produits')
        .select('*, photos:boutique_photos(id, url, url_miniature, chemin, ordre), variantes:boutique_variantes(*), categorie:boutique_categories(nom)')
        .order('ordre').order('created_at', { ascending: false }),
      sbAdmin.from('boutique_categories').select('*').order('ordre').order('nom'),
      sbAdmin.from('boutique_zones_livraison').select('*').order('ordre').order('nom'),
      sbAdmin.from('boutique_reglages').select('*').eq('id', 'principal').maybeSingle()
    ]);
    const erreur = produits.error || categories.error || zones.error || reglages.error;
    if (erreur) throw erreur;
    etat = { produits: produits.data || [], categories: categories.data || [], zones: zones.data || [], reglages: reglages.data };
  }

  // ------------------------------------------------------------ Structure
  function afficherStructure() {
    principal.innerHTML =
      '<div class="container mpg">' +
        '<div class="mpg-tete"><div><div class="eyebrow">La Maison MA2M</div><h1 class="u-mt-1">Gestion de la boutique<span class="oeil">.</span></h1></div>' +
          '<a class="btn" href="/marketplace/">Voir la boutique</a></div>' +
        '<div class="filtres mpg-onglets" role="tablist">' +
          '<button type="button" class="filtre-btn mpg-onglet actif" data-onglet="produits">Produits<span class="mpg-nb" id="mpg-nb-produits"></span></button>' +
          '<button type="button" class="filtre-btn mpg-onglet" data-onglet="commandes">Commandes</button>' +
          '<button type="button" class="filtre-btn mpg-onglet" data-onglet="categories">Catégories</button>' +
          '<button type="button" class="filtre-btn mpg-onglet" data-onglet="livraison">Livraison</button>' +
          '<button type="button" class="filtre-btn mpg-onglet" data-onglet="reglages">Réglages</button>' +
        '</div>' +
        '<section class="mpg-panneau actif" data-panneau="produits" id="mpg-produits"></section>' +
        '<section class="mpg-panneau" data-panneau="commandes"><div class="mpg-bientot"><h3>Commandes</h3>' +
          '<p>Cette partie sera ajoutée à la prochaine étape : réception des commandes, vérification des paiements Wave, Orange Money et MTN, expédition et suivi.</p></div></section>' +
        '<section class="mpg-panneau" data-panneau="categories" id="mpg-categories"></section>' +
        '<section class="mpg-panneau" data-panneau="livraison" id="mpg-livraison"></section>' +
        '<section class="mpg-panneau" data-panneau="reglages" id="mpg-reglages"></section>' +
      '</div>';
    principal.querySelector('.mpg-onglets').addEventListener('click', e => {
      const b = e.target.closest('[data-onglet]');
      if (!b) return;
      principal.querySelectorAll('.mpg-onglet').forEach(o => o.classList.toggle('actif', o === b));
      principal.querySelectorAll('.mpg-panneau').forEach(p => p.classList.toggle('actif', p.dataset.panneau === b.dataset.onglet));
    });
    afficherListeProduits();
    afficherCategories();
    afficherZones();
    afficherReglages();
  }

  // ------------------------------------------------------------ Produits : liste
  const LIBELLES_STATUT = { brouillon: 'Brouillon', en_vente: 'En vente', retire: 'Retiré' };
  function afficherListeProduits() {
    const zone = document.getElementById('mpg-produits');
    document.getElementById('mpg-nb-produits').textContent = etat.produits.length ? etat.produits.length : '';
    zone.innerHTML =
      '<div class="mpg-barre"><h2>Produits</h2><button type="button" class="btn btn--principal" id="mpg-nouveau">+ Nouveau produit</button></div>' +
      '<p class="mpg-aide">Un produit en « Brouillon » n’est visible que par vous. Passez-le « En vente » quand il est prêt : il apparaîtra dans la boutique (toujours fermée au public pour l’instant).</p>' +
      (etat.produits.length ? '<div class="mpg-liste">' + etat.produits.map(p => {
        const photo = (p.photos || []).slice().sort((a, b) => a.ordre - b.ordre)[0];
        const stock = (p.variantes || []).filter(v => v.actif).reduce((s, v) => s + v.stock, 0);
        return '<div class="mpg-produit" data-id="' + p.id + '" role="button" tabindex="0">' +
          '<div class="mpg-produit-visuel">' + (photo ? '<img src="' + echapperHtml(photo.url_miniature || photo.url) + '" alt="">' : 'MA2M') + '</div>' +
          '<div><div class="mpg-produit-nom">' + echapperHtml(p.nom) + '</div>' +
            '<div class="mpg-produit-meta"><span>' + MP.formaterPrix(MP.prixProduit(p).prix) + '</span><span>Stock : ' + stock + '</span>' +
            (p.categorie ? '<span>' + echapperHtml(p.categorie.nom) + '</span>' : '') + (p.mis_en_avant ? '<span>★ Mis en avant</span>' : '') + '</div></div>' +
          '<span class="mpg-statut ' + p.statut + '">' + LIBELLES_STATUT[p.statut] + '</span>' +
        '</div>';
      }).join('') + '</div>' : '<div class="mpg-vide">Aucun produit pour le moment. Commencez par « Nouveau produit ».</div>');
    document.getElementById('mpg-nouveau').addEventListener('click', () => ouvrirEditeur(null));
    zone.querySelectorAll('.mpg-produit').forEach(el => {
      const ouvrir = () => ouvrirEditeur(etat.produits.find(p => p.id === el.dataset.id));
      el.addEventListener('click', ouvrir);
      el.addEventListener('keydown', e => { if (e.key === 'Enter') ouvrir(); });
    });
  }

  // ------------------------------------------------------------ Photos
  function chargerImage(fichier) {
    return new Promise((ok, ko) => {
      const url = URL.createObjectURL(fichier);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); ok(img); };
      img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('Photo illisible par ce navigateur.')); };
      img.src = url;
    });
  }
  function reduire(img, cote, qualite) {
    const echelle = Math.min(1, cote / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * echelle);
    canvas.height = Math.round(img.naturalHeight * echelle);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return new Promise((ok, ko) => canvas.toBlob(b => b ? ok(b) : ko(new Error('Conversion impossible.')), 'image/jpeg', qualite));
  }
  async function preparerPhoto(fichier, produitId) {
    let source = fichier;
    if (/heic|heif/i.test(fichier.type) || /\.(heic|heif)$/i.test(fichier.name)) {
      source = await window.heic2any({ blob: fichier, toType: 'image/jpeg', quality: 0.9 });
    }
    const img = await chargerImage(source);
    const [grande, miniature] = await Promise.all([reduire(img, 1800, 0.86), reduire(img, 640, 0.82)]);
    const base = 'site/boutique/' + produitId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const url = await envoyerImageSite('boutique', base + '.jpg', new File([grande], 'photo.jpg', { type: 'image/jpeg' }));
    const urlMiniature = await envoyerImageSite('boutique', base + '-mini.jpg', new File([miniature], 'mini.jpg', { type: 'image/jpeg' }));
    return { url: url, url_miniature: urlMiniature, chemin: base + '.jpg' };
  }

  // ------------------------------------------------------------ Produits : éditeur
  function ouvrirEditeur(produit) {
    const estNouveau = !produit;
    const id = produit ? produit.id : nouvelId();
    let photos = produit ? (produit.photos || []).slice().sort((a, b) => a.ordre - b.ordre) : [];
    const photosRetirees = [];
    let variantes = produit ? (produit.variantes || []).slice().sort((a, b) => a.ordre - b.ordre) : [];
    if (!variantes.length) variantes = [{ taille: '', couleur: '', prix_fcfa: null, stock: 0, actif: true }];
    const versLocal = iso => {
      if (!iso) return '';
      const d = new Date(iso);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };
    const p = produit || { nom: '', statut: 'brouillon', prix_fcfa: '', mis_en_avant: false, ordre: 0 };
    const zone = document.getElementById('mpg-produits');
    zone.innerHTML =
      '<div class="mpg-barre"><h2>' + (estNouveau ? 'Nouveau produit' : 'Modifier le produit') + '</h2>' +
        '<button type="button" class="btn" id="mpg-retour">← Retour à la liste</button></div>' +
      '<form class="mpg-form" id="mpg-form-produit" novalidate>' +
        '<div class="mpg-bloc"><div class="eyebrow">L’essentiel</div>' +
          '<div class="mpg-grille2">' +
            '<div class="form-champ"><label for="mpg-nom">Nom du produit *</label><input id="mpg-nom" maxlength="140" required value="' + echapperHtml(p.nom) + '"></div>' +
            '<div class="form-champ"><label for="mpg-categorie">Catégorie</label><select id="mpg-categorie"><option value="">— Aucune —</option>' +
              etat.categories.map(c => '<option value="' + c.id + '"' + (c.id === p.categorie_id ? ' selected' : '') + '>' + echapperHtml(c.nom) + '</option>').join('') + '</select>' +
              (etat.categories.length ? '' : '<small>Créez vos catégories dans l’onglet « Catégories ».</small>') + '</div>' +
            '<div class="form-champ"><label for="mpg-statut">Statut</label><select id="mpg-statut">' +
              Object.keys(LIBELLES_STATUT).map(s => '<option value="' + s + '"' + (s === p.statut ? ' selected' : '') + '>' + LIBELLES_STATUT[s] + '</option>').join('') + '</select></div>' +
          '</div>' +
          '<label class="mpg-case"><input type="checkbox" id="mpg-avant"' + (p.mis_en_avant ? ' checked' : '') + '> Mettre en avant (grande photo d’accueil de la boutique, en premier dans la liste)</label>' +
        '</div>' +
        '<div class="mpg-bloc"><div class="eyebrow">Photos</div>' +
          '<p class="mpg-aide">La première photo est la photo principale. Photos verticales conseillées. Elles sont allégées automatiquement avant l’envoi.</p>' +
          '<div class="mpg-photos" id="mpg-photos"></div>' +
          '<div class="mpg-progression" id="mpg-progression"></div>' +
        '</div>' +
        '<div class="mpg-bloc"><div class="eyebrow">Prix</div>' +
          '<div class="mpg-grille2">' +
            '<div class="form-champ"><label for="mpg-prix">Prix (FCFA, toutes taxes comprises) *</label><input id="mpg-prix" type="number" min="0" step="100" inputmode="numeric" value="' + (p.prix_fcfa != null ? p.prix_fcfa : '') + '"></div>' +
            '<div class="form-champ"><label for="mpg-promo">Prix promotionnel (facultatif)</label><input id="mpg-promo" type="number" min="0" step="100" inputmode="numeric" value="' + (p.prix_promo_fcfa != null ? p.prix_promo_fcfa : '') + '"></div>' +
            '<div class="form-champ"><label for="mpg-promo-debut">Début de la promotion</label><input id="mpg-promo-debut" type="datetime-local" value="' + versLocal(p.promo_debut) + '"></div>' +
            '<div class="form-champ"><label for="mpg-promo-fin">Fin de la promotion</label><input id="mpg-promo-fin" type="datetime-local" value="' + versLocal(p.promo_fin) + '"></div>' +
          '</div>' +
        '</div>' +
        '<div class="mpg-bloc"><div class="eyebrow">Tailles, couleurs et stock</div>' +
          '<p class="mpg-aide">Une ligne par version du produit (par exemple « M · Noir »). Laissez taille et couleur vides pour un produit unique. Le prix spécifique est facultatif.</p>' +
          '<div class="mpg-table-wrap"><table class="mpg-table"><thead><tr><th>Taille</th><th>Couleur</th><th>Prix spécifique</th><th>Stock</th><th>Actif</th><th></th></tr></thead><tbody id="mpg-variantes"></tbody></table></div>' +
          '<div><button type="button" class="btn-mini-admin" id="mpg-ajout-variante">+ Ajouter une version</button></div>' +
        '</div>' +
        '<div class="mpg-bloc"><div class="eyebrow">Description</div>' +
          '<div class="editeur-riche"><div id="mpg-description"></div></div>' +
          '<div class="mpg-grille2">' +
            '<div class="form-champ"><label for="mpg-composition">Composition</label><input id="mpg-composition" maxlength="300" value="' + echapperHtml(p.composition || '') + '"></div>' +
            '<div class="form-champ"><label for="mpg-entretien">Entretien</label><input id="mpg-entretien" maxlength="300" value="' + echapperHtml(p.entretien || '') + '"></div>' +
            '<div class="form-champ"><label for="mpg-poids">Poids (grammes)</label><input id="mpg-poids" type="number" min="0" inputmode="numeric" value="' + (p.poids_g != null ? p.poids_g : '') + '"></div>' +
            '<div class="form-champ"><label for="mpg-ordre">Ordre d’affichage</label><input id="mpg-ordre" type="number" inputmode="numeric" value="' + (p.ordre || 0) + '"><small>Plus petit = plus haut dans la liste.</small></div>' +
          '</div>' +
        '</div>' +
        '<div class="mpg-actions">' +
          '<button type="submit" class="btn btn--principal" id="mpg-enregistrer">Enregistrer</button>' +
          (estNouveau ? '' : '<a class="btn" href="/marketplace/produit?p=' + encodeURIComponent(p.slug) + '" target="_blank" rel="noopener">Voir la fiche</a>') +
          (estNouveau ? '' : '<button type="button" class="btn mpg-bouton-danger mpg-droite" id="mpg-supprimer">Supprimer le produit</button>') +
        '</div>' +
        '<div class="mpg-message" id="mpg-msg-produit" role="status"></div>' +
      '</form>';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    editeurDescription = creerEditeurRiche('mpg-description', 'Décrivez la pièce : matière, coupe, esprit, conseils de style…');
    if (editeurDescription && p.description) chargerContenuDansEditeur(editeurDescription, p.description);

    // --- Photos
    function rendrePhotos() {
      const conteneur = document.getElementById('mpg-photos');
      conteneur.innerHTML = photos.map((ph, i) =>
        '<div class="mpg-photo">' + (i === 0 ? '<span class="mpg-photo-une">Principale</span>' : '') +
          '<img src="' + echapperHtml(ph.url_miniature || ph.url) + '" alt="">' +
          '<div class="mpg-photo-actions">' +
            '<button type="button" data-gauche="' + i + '" aria-label="Avancer">←</button>' +
            '<button type="button" data-suppr="' + i + '" aria-label="Retirer">✕</button>' +
            '<button type="button" data-droite="' + i + '" aria-label="Reculer">→</button>' +
          '</div></div>').join('') +
        '<label class="mpg-ajout-photo"><input type="file" id="mpg-fichiers" accept="image/*" multiple><span>+ Ajouter des photos</span></label>';
      document.getElementById('mpg-fichiers').addEventListener('change', async e => {
        const fichiers = Array.from(e.target.files || []);
        const progression = document.getElementById('mpg-progression');
        for (let i = 0; i < fichiers.length; i++) {
          progression.textContent = 'Envoi de la photo ' + (i + 1) + ' sur ' + fichiers.length + '…';
          try {
            photos.push(await preparerPhoto(fichiers[i], id));
            rendrePhotos();
          } catch (err) {
            progression.textContent = 'La photo « ' + fichiers[i].name + ' » n’a pas pu être envoyée : ' + (err.message || err);
            if (window.signalerErreur) window.signalerErreur('Envoi de photo boutique échoué', fichiers[i].name + ' : ' + (err.message || err));
            return;
          }
        }
        progression.textContent = fichiers.length ? 'Photos ajoutées. N’oubliez pas d’enregistrer.' : '';
      });
    }
    document.getElementById('mpg-photos').addEventListener('click', e => {
      const g = e.target.closest('[data-gauche]'), d = e.target.closest('[data-droite]'), s = e.target.closest('[data-suppr]');
      if (g) { const i = +g.dataset.gauche; if (i > 0) [photos[i - 1], photos[i]] = [photos[i], photos[i - 1]]; }
      else if (d) { const i = +d.dataset.droite; if (i < photos.length - 1) [photos[i + 1], photos[i]] = [photos[i], photos[i + 1]]; }
      else if (s) { photosRetirees.push(photos.splice(+s.dataset.suppr, 1)[0]); }
      else return;
      rendrePhotos();
    });
    rendrePhotos();

    // --- Versions (variantes)
    function lireVariantesDuTableau() {
      return Array.from(document.querySelectorAll('#mpg-variantes tr')).map((tr, i) => ({
        id: tr.dataset.id || undefined,
        taille: tr.querySelector('[data-champ="taille"]').value.trim(),
        couleur: tr.querySelector('[data-champ="couleur"]').value.trim(),
        prix_fcfa: tr.querySelector('[data-champ="prix"]').value === '' ? null : Math.max(0, parseInt(tr.querySelector('[data-champ="prix"]').value, 10) || 0),
        stock: Math.max(0, parseInt(tr.querySelector('[data-champ="stock"]').value, 10) || 0),
        actif: tr.querySelector('[data-champ="actif"]').checked,
        ordre: i
      }));
    }
    function rendreVariantes() {
      document.getElementById('mpg-variantes').innerHTML = variantes.map(v =>
        '<tr' + (v.id ? ' data-id="' + v.id + '"' : '') + '>' +
          '<td><input type="text" data-champ="taille" maxlength="20" placeholder="M" value="' + echapperHtml(v.taille || '') + '"></td>' +
          '<td><input type="text" data-champ="couleur" maxlength="40" placeholder="Noir" value="' + echapperHtml(v.couleur || '') + '"></td>' +
          '<td><input type="number" data-champ="prix" min="0" step="100" inputmode="numeric" placeholder="—" value="' + (v.prix_fcfa != null ? v.prix_fcfa : '') + '"></td>' +
          '<td><input type="number" data-champ="stock" min="0" inputmode="numeric" value="' + (v.stock || 0) + '"></td>' +
          '<td><input type="checkbox" data-champ="actif"' + (v.actif !== false ? ' checked' : '') + ' aria-label="Actif"></td>' +
          '<td><button type="button" class="mpg-suppr" data-suppr-variante aria-label="Supprimer cette version">✕</button></td>' +
        '</tr>').join('');
    }
    rendreVariantes();
    document.getElementById('mpg-ajout-variante').addEventListener('click', () => {
      variantes = lireVariantesDuTableau();
      variantes.push({ taille: '', couleur: '', prix_fcfa: null, stock: 0, actif: true });
      rendreVariantes();
    });
    document.getElementById('mpg-variantes').addEventListener('click', e => {
      const b = e.target.closest('[data-suppr-variante]');
      if (!b) return;
      variantes = lireVariantesDuTableau();
      const index = Array.from(document.querySelectorAll('#mpg-variantes tr')).indexOf(b.closest('tr'));
      variantes.splice(index, 1);
      if (!variantes.length) variantes.push({ taille: '', couleur: '', prix_fcfa: null, stock: 0, actif: true });
      rendreVariantes();
    });

    document.getElementById('mpg-retour').addEventListener('click', () => afficherListeProduits());

    // --- Enregistrer
    document.getElementById('mpg-form-produit').addEventListener('submit', async e => {
      e.preventDefault();
      const msg = document.getElementById('mpg-msg-produit');
      const bouton = document.getElementById('mpg-enregistrer');
      const nom = document.getElementById('mpg-nom').value.trim();
      const prix = parseInt(document.getElementById('mpg-prix').value, 10);
      const promoBrut = document.getElementById('mpg-promo').value;
      const promo = promoBrut === '' ? null : parseInt(promoBrut, 10);
      const statut = document.getElementById('mpg-statut').value;
      const versions = lireVariantesDuTableau();
      if (!nom) { message(msg, 'Indiquez le nom du produit.', 'err'); return; }
      if (!(prix >= 0)) { message(msg, 'Indiquez un prix valide.', 'err'); return; }
      if (promo != null && !(promo >= 0 && promo < prix)) { message(msg, 'Le prix promotionnel doit être inférieur au prix normal.', 'err'); return; }
      const cles = versions.map(v => (v.taille + '|' + v.couleur).toLowerCase());
      if (new Set(cles).size !== cles.length) { message(msg, 'Deux versions ont la même taille et la même couleur.', 'err'); return; }
      if (statut === 'en_vente' && !photos.length) { message(msg, 'Ajoutez au moins une photo avant de mettre le produit en vente.', 'err'); return; }

      const debut = document.getElementById('mpg-promo-debut').value;
      const fin = document.getElementById('mpg-promo-fin').value;
      const donnees = {
        id: id,
        nom: nom,
        categorie_id: document.getElementById('mpg-categorie').value || null,
        statut: statut,
        mis_en_avant: document.getElementById('mpg-avant').checked,
        prix_fcfa: prix,
        prix_promo_fcfa: promo,
        promo_debut: debut ? new Date(debut).toISOString() : null,
        promo_fin: fin ? new Date(fin).toISOString() : null,
        description: lireContenuEditeur(editeurDescription) || (editeurDescription && editeurDescription.value) || null,
        composition: document.getElementById('mpg-composition').value.trim() || null,
        entretien: document.getElementById('mpg-entretien').value.trim() || null,
        poids_g: document.getElementById('mpg-poids').value === '' ? null : Math.max(0, parseInt(document.getElementById('mpg-poids').value, 10) || 0),
        ordre: parseInt(document.getElementById('mpg-ordre').value, 10) || 0,
        updated_at: new Date().toISOString()
      };
      bouton.disabled = true;
      message(msg, 'Enregistrement…');
      try {
        // Adresse de la fiche (unique) : tirée du nom, avec un suffixe si déjà prise.
        if (estNouveau || (produit && produit.nom !== nom)) {
          const base = MP.slugifier(nom);
          const { data: pris } = await sbAdmin.from('boutique_produits').select('slug').like('slug', base + '%').neq('id', id);
          const existants = new Set((pris || []).map(x => x.slug));
          let slug = base, n = 2;
          while (existants.has(slug)) slug = base + '-' + n++;
          donnees.slug = slug;
        }
        const { error: errProduit } = estNouveau
          ? await sbAdmin.from('boutique_produits').insert(donnees)
          : await sbAdmin.from('boutique_produits').update(donnees).eq('id', id);
        if (errProduit) throw errProduit;

        // Photos : suppression des retirées, puis réécriture de l'ordre.
        const idsRetires = photosRetirees.filter(ph => ph.id).map(ph => ph.id);
        if (idsRetires.length) {
          const { error } = await sbAdmin.from('boutique_photos').delete().in('id', idsRetires);
          if (error) throw error;
        }
        for (let i = 0; i < photos.length; i++) {
          const ph = photos[i];
          const { error } = ph.id
            ? await sbAdmin.from('boutique_photos').update({ ordre: i }).eq('id', ph.id)
            : await sbAdmin.from('boutique_photos').insert({ produit_id: id, url: ph.url, url_miniature: ph.url_miniature, chemin: ph.chemin, ordre: i });
          if (error) throw error;
        }
        photosRetirees.forEach(ph => { if (ph.chemin) { supprimerImageSite('boutique', ph.chemin); supprimerImageSite('boutique', ph.chemin.replace(/\.jpg$/, '-mini.jpg')); } });
        photosRetirees.length = 0;

        // Versions : suppression des retirées, mise à jour des existantes, ajout des nouvelles.
        const anciennes = produit ? (produit.variantes || []).map(v => v.id) : [];
        const gardees = versions.filter(v => v.id).map(v => v.id);
        const aSupprimer = anciennes.filter(x => gardees.indexOf(x) === -1);
        if (aSupprimer.length) {
          const { error } = await sbAdmin.from('boutique_variantes').delete().in('id', aSupprimer);
          if (error) throw error;
        }
        for (const v of versions) {
          const ligne = { produit_id: id, taille: v.taille || null, couleur: v.couleur || null, prix_fcfa: v.prix_fcfa, stock: v.stock, actif: v.actif, ordre: v.ordre };
          const { error } = v.id
            ? await sbAdmin.from('boutique_variantes').update(ligne).eq('id', v.id)
            : await sbAdmin.from('boutique_variantes').insert(ligne);
          if (error) throw error;
        }

        await chargerTout();
        afficherListeProduits();
        MP.toast('Produit enregistré.');
      } catch (err) {
        console.warn('Boutique : enregistrement du produit', err);
        message(msg, erreurLisible(err), 'err');
        bouton.disabled = false;
      }
    });

    // --- Supprimer
    const boutonSuppr = document.getElementById('mpg-supprimer');
    if (boutonSuppr) boutonSuppr.addEventListener('click', async () => {
      if (!confirm('Supprimer définitivement « ' + p.nom + ' » et ses photos ? Les commandes passées gardent leur historique.')) return;
      const msg = document.getElementById('mpg-msg-produit');
      try {
        const { error } = await sbAdmin.from('boutique_produits').delete().eq('id', id);
        if (error) throw error;
        (produit.photos || []).forEach(ph => { if (ph.chemin) { supprimerImageSite('boutique', ph.chemin); supprimerImageSite('boutique', ph.chemin.replace(/\.jpg$/, '-mini.jpg')); } });
        await chargerTout();
        afficherListeProduits();
        MP.toast('Produit supprimé.');
      } catch (err) {
        message(msg, erreurLisible(err), 'err');
      }
    });
  }

  // ------------------------------------------------------------ Catégories
  function afficherCategories() {
    const zone = document.getElementById('mpg-categories');
    zone.innerHTML =
      '<div class="mpg-barre"><h2>Catégories</h2></div>' +
      '<p class="mpg-aide">Les familles de produits de la boutique (Vêtements, Accessoires, Billets…). Vous pouvez en ajouter à tout moment.</p>' +
      '<form class="mpg-bloc" id="mpg-form-categorie"><div class="eyebrow">Nouvelle catégorie</div><div class="mpg-grille2">' +
        '<div class="form-champ"><label for="mpg-cat-nom">Nom</label><input id="mpg-cat-nom" maxlength="80" placeholder="Vêtements"></div>' +
        '<div class="form-champ"><label for="mpg-cat-ordre">Ordre</label><input id="mpg-cat-ordre" type="number" inputmode="numeric" value="0"></div>' +
      '</div><div class="mpg-actions"><button type="submit" class="btn btn--principal">Ajouter</button><span class="mpg-message" id="mpg-msg-cat"></span></div></form>' +
      '<div class="mpg-liste">' + (etat.categories.map(c =>
        '<div class="mpg-ligne" data-id="' + c.id + '"><div><div class="mpg-ligne-titre">' + echapperHtml(c.nom) + '</div>' +
          '<div class="mpg-ligne-sous">' + (c.actif ? 'Visible' : 'Masquée') + ' · ordre ' + c.ordre + ' · ' +
          etat.produits.filter(p => p.categorie_id === c.id).length + ' produit(s)</div></div>' +
          '<div class="mpg-ligne-actions"><button type="button" class="btn-mini-admin" data-basculer>' + (c.actif ? 'Masquer' : 'Afficher') + '</button>' +
          '<button type="button" class="btn-mini-admin mpg-bouton-danger" data-supprimer>Supprimer</button></div></div>').join('') ||
        '<div class="mpg-vide">Aucune catégorie.</div>') + '</div>';
    document.getElementById('mpg-form-categorie').addEventListener('submit', async e => {
      e.preventDefault();
      const nom = document.getElementById('mpg-cat-nom').value.trim();
      const msg = document.getElementById('mpg-msg-cat');
      if (!nom) { message(msg, 'Indiquez un nom.', 'err'); return; }
      const base = MP.slugifier(nom);
      let slug = base, n = 2;
      while (etat.categories.some(c => c.slug === slug)) slug = base + '-' + n++;
      const { error } = await sbAdmin.from('boutique_categories').insert({ nom: nom, slug: slug, ordre: parseInt(document.getElementById('mpg-cat-ordre').value, 10) || 0 });
      if (error) { message(msg, erreurLisible(error), 'err'); return; }
      await chargerTout(); afficherCategories(); MP.toast('Catégorie ajoutée.');
    });
    zone.querySelectorAll('.mpg-ligne').forEach(ligne => {
      const cat = etat.categories.find(c => c.id === ligne.dataset.id);
      ligne.querySelector('[data-basculer]').addEventListener('click', async () => {
        const { error } = await sbAdmin.from('boutique_categories').update({ actif: !cat.actif }).eq('id', cat.id);
        if (error) { MP.toast(erreurLisible(error)); return; }
        await chargerTout(); afficherCategories();
      });
      ligne.querySelector('[data-supprimer]').addEventListener('click', async () => {
        if (!confirm('Supprimer la catégorie « ' + cat.nom + ' » ? Ses produits resteront, sans catégorie.')) return;
        const { error } = await sbAdmin.from('boutique_categories').delete().eq('id', cat.id);
        if (error) { MP.toast(erreurLisible(error)); return; }
        await chargerTout(); afficherCategories(); afficherListeProduits();
      });
    });
  }

  // ------------------------------------------------------------ Zones de livraison
  function afficherZones() {
    const zone = document.getElementById('mpg-livraison');
    zone.innerHTML =
      '<div class="mpg-barre"><h2>Zones de livraison</h2></div>' +
      '<p class="mpg-aide">Chaque zone a son tarif et son délai, affichés au client avant qu’il valide sa commande (exemple : « Abidjan — Cocody », 2 000 FCFA, 24 à 48 h).</p>' +
      '<form class="mpg-bloc" id="mpg-form-zone"><div class="eyebrow">Nouvelle zone</div><div class="mpg-grille2">' +
        '<div class="form-champ"><label for="mpg-zone-nom">Nom de la zone</label><input id="mpg-zone-nom" maxlength="80" placeholder="Abidjan — Cocody"></div>' +
        '<div class="form-champ"><label for="mpg-zone-tarif">Tarif (FCFA)</label><input id="mpg-zone-tarif" type="number" min="0" step="100" inputmode="numeric" placeholder="2000"></div>' +
        '<div class="form-champ"><label for="mpg-zone-delai">Délai annoncé</label><input id="mpg-zone-delai" maxlength="60" placeholder="24 à 48 h"></div>' +
        '<div class="form-champ"><label for="mpg-zone-ordre">Ordre</label><input id="mpg-zone-ordre" type="number" inputmode="numeric" value="0"></div>' +
      '</div><div class="mpg-actions"><button type="submit" class="btn btn--principal">Ajouter</button><span class="mpg-message" id="mpg-msg-zone"></span></div></form>' +
      '<div class="mpg-liste">' + (etat.zones.map(z =>
        '<div class="mpg-ligne" data-id="' + z.id + '"><div><div class="mpg-ligne-titre">' + echapperHtml(z.nom) + ' — ' + MP.formaterPrix(z.tarif_fcfa) + '</div>' +
          '<div class="mpg-ligne-sous">' + (z.delai ? echapperHtml(z.delai) + ' · ' : '') + (z.actif ? 'Proposée' : 'Désactivée') + '</div></div>' +
          '<div class="mpg-ligne-actions"><button type="button" class="btn-mini-admin" data-basculer>' + (z.actif ? 'Désactiver' : 'Activer') + '</button>' +
          '<button type="button" class="btn-mini-admin mpg-bouton-danger" data-supprimer>Supprimer</button></div></div>').join('') ||
        '<div class="mpg-vide">Aucune zone de livraison.</div>') + '</div>';
    document.getElementById('mpg-form-zone').addEventListener('submit', async e => {
      e.preventDefault();
      const msg = document.getElementById('mpg-msg-zone');
      const nom = document.getElementById('mpg-zone-nom').value.trim();
      const tarif = parseInt(document.getElementById('mpg-zone-tarif').value, 10);
      if (!nom || !(tarif >= 0)) { message(msg, 'Indiquez un nom et un tarif.', 'err'); return; }
      const { error } = await sbAdmin.from('boutique_zones_livraison').insert({
        nom: nom, tarif_fcfa: tarif, delai: document.getElementById('mpg-zone-delai').value.trim() || null,
        ordre: parseInt(document.getElementById('mpg-zone-ordre').value, 10) || 0
      });
      if (error) { message(msg, erreurLisible(error), 'err'); return; }
      await chargerTout(); afficherZones(); MP.toast('Zone ajoutée.');
    });
    zone.querySelectorAll('.mpg-ligne').forEach(ligne => {
      const z = etat.zones.find(x => x.id === ligne.dataset.id);
      ligne.querySelector('[data-basculer]').addEventListener('click', async () => {
        const { error } = await sbAdmin.from('boutique_zones_livraison').update({ actif: !z.actif }).eq('id', z.id);
        if (error) { MP.toast(erreurLisible(error)); return; }
        await chargerTout(); afficherZones();
      });
      ligne.querySelector('[data-supprimer]').addEventListener('click', async () => {
        if (!confirm('Supprimer la zone « ' + z.nom + ' » ?')) return;
        const { error } = await sbAdmin.from('boutique_zones_livraison').delete().eq('id', z.id);
        if (error) { MP.toast(erreurLisible(error)); return; }
        await chargerTout(); afficherZones();
      });
    });
  }

  // ------------------------------------------------------------ Réglages
  function afficherReglages() {
    const zone = document.getElementById('mpg-reglages');
    const r = etat.reglages || {};
    zone.innerHTML =
      '<div class="mpg-barre"><h2>Réglages</h2></div>' +
      '<form class="mpg-form" id="mpg-form-reglages">' +
        '<div class="mpg-bloc"><div class="eyebrow">État de la boutique</div>' +
          '<p>' + (r.ouverte ? '<strong>Ouverte au public.</strong>' : '<strong>Fermée au public</strong> : vous seule la voyez. Elle sera ouverte à la fin de la construction, après vos tests et la relecture des documents légaux.') + '</p>' +
        '</div>' +
        '<div class="mpg-bloc"><div class="eyebrow">Paiement</div>' +
          '<p class="mpg-aide">Numéros qui recevront les paiements, affichés au client après sa commande. Valeurs d’essai possibles pendant les tests.</p>' +
          '<div class="mpg-grille2">' +
            '<div class="form-champ"><label for="mpg-wave">Numéro Wave</label><input id="mpg-wave" inputmode="tel" maxlength="30" value="' + echapperHtml(r.numero_wave || '') + '"></div>' +
            '<div class="form-champ"><label for="mpg-om">Numéro Orange Money</label><input id="mpg-om" inputmode="tel" maxlength="30" value="' + echapperHtml(r.numero_orange_money || '') + '"></div>' +
            '<div class="form-champ"><label for="mpg-mtn">Numéro MTN Mobile Money</label><input id="mpg-mtn" inputmode="tel" maxlength="30" value="' + echapperHtml(r.numero_mtn_momo || '') + '"></div>' +
            '<div class="form-champ"><label for="mpg-delai">Délai de paiement (heures)</label><input id="mpg-delai" type="number" min="1" max="168" inputmode="numeric" value="' + (r.delai_paiement_heures || 24) + '"><small>Passé ce délai, une commande non payée est annulée et son stock revient.</small></div>' +
          '</div>' +
        '</div>' +
        '<div class="mpg-bloc"><div class="eyebrow">Livraison</div><div class="mpg-grille2">' +
          '<div class="form-champ"><label for="mpg-offerte">Livraison offerte à partir de (FCFA)</label><input id="mpg-offerte" type="number" min="0" step="1000" inputmode="numeric" placeholder="Jamais" value="' + (r.livraison_offerte_des_fcfa != null ? r.livraison_offerte_des_fcfa : '') + '"></div>' +
        '</div></div>' +
        '<div class="mpg-actions"><button type="submit" class="btn btn--principal">Enregistrer les réglages</button><span class="mpg-message" id="mpg-msg-reglages"></span></div>' +
      '</form>';
    document.getElementById('mpg-form-reglages').addEventListener('submit', async e => {
      e.preventDefault();
      const msg = document.getElementById('mpg-msg-reglages');
      const delai = Math.min(168, Math.max(1, parseInt(document.getElementById('mpg-delai').value, 10) || 24));
      const offerte = document.getElementById('mpg-offerte').value;
      const { error } = await sbAdmin.from('boutique_reglages').update({
        numero_wave: document.getElementById('mpg-wave').value.trim() || null,
        numero_orange_money: document.getElementById('mpg-om').value.trim() || null,
        numero_mtn_momo: document.getElementById('mpg-mtn').value.trim() || null,
        delai_paiement_heures: delai,
        livraison_offerte_des_fcfa: offerte === '' ? null : Math.max(0, parseInt(offerte, 10) || 0),
        updated_at: new Date().toISOString()
      }).eq('id', 'principal');
      if (error) { message(msg, erreurLisible(error), 'err'); return; }
      await chargerTout();
      message(msg, 'Réglages enregistrés.', 'ok');
    });
  }

  // ------------------------------------------------------------ Démarrage
  async function demarrer() {
    const acces = await MP.acces;
    if (!acces.admin) { MP.afficherIntrouvable(); return; }
    MP.afficherBandeauApercu(acces);
    if (!acces.codeValide) {
      principal.innerHTML = '<section class="mp-introuvable"><div><h1>Vérification de sécurité</h1>' +
        '<p>Pour protéger la boutique, validez d’abord votre code dans le tableau de bord de l’agence, puis revenez ici par le lien « Marketplace » en haut de page.</p>' +
        '<a class="btn btn--principal" href="/tableau-de-bord.html">Valider mon code</a></div></section>';
      return;
    }
    try {
      await chargerTout();
      afficherStructure();
    } catch (e) {
      console.error('Boutique : chargement du tableau de bord impossible', e);
      principal.innerHTML = '<section class="mp-introuvable"><div><h1>Un instant…</h1><p>' + echapperHtml(erreurLisible(e)) +
        '</p><p>Si le message parle d’une table inconnue, la commande de la boutique n’a pas encore été lancée dans Supabase.</p></div></section>';
    }
  }
  demarrer();
})();
