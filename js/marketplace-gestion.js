// ================== MARKETPLACE — tableau de bord de la boutique ==================
// marketplace/gestion.html : produits des trois univers (articles, billets,
// services ; photos sur Cloudflare R2, versions, stock/places, prix, promotions),
// commandes (vérification des paiements, expédition, remboursement), contrôle des
// billets à l'entrée, catégories, zones de livraison, réglages (paiement, identité
// du vendeur pour les factures).
// Réservé aux administrateurs ayant validé leur code (2e facteur) dans cet onglet ;
// les règles de la base (RLS, Extension 98) refusent de toute façon toute écriture
// à un non-admin.
(function () {
  const principal = document.getElementById('mp-principal');
  let etat = { produits: [], categories: [], zones: [], reglages: null, commandes: [] };
  let editeurDescription = null;
  // Code de billet attendu (ex. MA2M-1A2B3-C4D5E) : rien d'autre n'est gardé depuis l'adresse.
  const CODE_BILLET = /^[A-Za-z0-9-]{4,40}$/;

  const nouvelId = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.floor(aleatoire() * 16);
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
    await sbAdmin.rpc('boutique_annuler_expirees').then(() => {}, () => {});
    const [produits, categories, zones, reglages, commandes] = await Promise.all([
      sbAdmin.from('boutique_produits')
        .select('*, photos:boutique_photos(id, url, url_miniature, chemin, ordre), variantes:boutique_variantes(*), categorie:boutique_categories(nom)')
        .order('ordre').order('created_at', { ascending: false }),
      sbAdmin.from('boutique_categories').select('*').order('ordre').order('nom'),
      sbAdmin.from('boutique_zones_livraison').select('*').order('ordre').order('nom'),
      sbAdmin.from('boutique_reglages').select('*').eq('id', 'principal').maybeSingle(),
      sbAdmin.from('boutique_commandes').select('*, lignes:boutique_lignes(*), billets:boutique_billets(code, statut, libelle, nom_evenement)')
        .order('created_at', { ascending: false }).limit(300)
    ]);
    const erreur = produits.error || categories.error || zones.error || reglages.error || commandes.error;
    if (erreur) throw erreur;
    etat = { produits: produits.data || [], categories: categories.data || [], zones: zones.data || [], reglages: reglages.data, commandes: commandes.data || [] };
  }

  // ------------------------------------------------------------ Structure
  function afficherStructure() {
    principal.innerHTML =
      '<div class="container mpg">' +
        '<div class="mpg-tete"><div><div class="eyebrow">La Maison MA2M</div><h1 class="u-mt-1">Gestion de la boutique<span class="oeil">.</span></h1></div>' +
          '<a class="btn" href="/marketplace/">Voir la boutique</a></div>' +
        '<div class="filtres mpg-onglets" role="tablist">' +
          '<button type="button" class="filtre-btn mpg-onglet actif" data-onglet="produits">Produits<span class="mpg-nb" id="mpg-nb-produits"></span></button>' +
          '<button type="button" class="filtre-btn mpg-onglet" data-onglet="commandes">Commandes<span class="mpg-nb" id="mpg-nb-commandes"></span></button>' +
          '<button type="button" class="filtre-btn mpg-onglet" data-onglet="billets">Billets</button>' +
          '<button type="button" class="filtre-btn mpg-onglet" data-onglet="categories">Catégories</button>' +
          '<button type="button" class="filtre-btn mpg-onglet" data-onglet="livraison">Livraison</button>' +
          '<button type="button" class="filtre-btn mpg-onglet" data-onglet="reglages">Réglages</button>' +
        '</div>' +
        '<section class="mpg-panneau actif" data-panneau="produits" id="mpg-produits"></section>' +
        '<section class="mpg-panneau" data-panneau="commandes" id="mpg-commandes"></section>' +
        '<section class="mpg-panneau" data-panneau="billets" id="mpg-billets"></section>' +
        '<section class="mpg-panneau" data-panneau="categories" id="mpg-categories"></section>' +
        '<section class="mpg-panneau" data-panneau="livraison" id="mpg-livraison"></section>' +
        '<section class="mpg-panneau" data-panneau="reglages" id="mpg-reglages"></section>' +
      '</div>';
    principal.querySelector('.mpg-onglets').addEventListener('click', e => {
      const b = e.target.closest('[data-onglet]');
      if (b) ouvrirOnglet(b.dataset.onglet);
    });
    afficherListeProduits();
    afficherCommandes();
    afficherControleBillets();
    afficherCategories();
    afficherZones();
    afficherReglages();
  }

  function ouvrirOnglet(nom) {
    principal.querySelectorAll('.mpg-onglet').forEach(o => o.classList.toggle('actif', o.dataset.onglet === nom));
    principal.querySelectorAll('.mpg-panneau').forEach(p => p.classList.toggle('actif', p.dataset.panneau === nom));
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
            '<div class="mpg-produit-meta"><span>' + MP.univers(p.type || 'physique').nom.replace(/s$/, '') + '</span><span>' + MP.formaterPrix(MP.prixProduit(p).prix) + '</span><span>' + (p.type === 'billet' ? 'Places' : p.type === 'service' ? 'Créneaux' : 'Stock') + ' : ' + stock + '</span>' +
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
    const base = 'site/boutique/' + produitId + '/' + Date.now() + '-' + suffixeAleatoire();
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
    const p = produit || { nom: '', type: 'physique', statut: 'brouillon', prix_fcfa: '', mis_en_avant: false, ordre: 0 };
    let type = p.type || 'physique';
    const zone = document.getElementById('mpg-produits');
    zone.innerHTML =
      '<div class="mpg-barre"><h2>' + (estNouveau ? 'Nouveau produit' : 'Modifier le produit') + '</h2>' +
        '<button type="button" class="btn" id="mpg-retour">← Retour à la liste</button></div>' +
      '<form class="mpg-form" id="mpg-form-produit" novalidate>' +
        '<div class="mpg-bloc"><div class="eyebrow">L’essentiel</div>' +
          '<div class="form-champ"><label>Que vendez-vous ?</label><div class="filtres mpg-types" id="mpg-types">' +
            MP.UNIVERS.map(u => '<button type="button" class="filtre-btn' + (u.cle === type ? ' actif' : '') + '" data-type="' + u.cle + '">' + u.nom.replace(/s$/, '') + '</button>').join('') +
          '</div><small id="mpg-type-aide"></small></div>' +
          '<div class="mpg-grille2">' +
            '<div class="form-champ"><label for="mpg-nom">Nom du produit *</label><input id="mpg-nom" maxlength="140" required value="' + echapperHtml(p.nom) + '"></div>' +
            '<div class="form-champ"><label for="mpg-categorie">Rayon</label><select id="mpg-categorie"></select>' +
              '<small>Les rayons se gèrent dans l’onglet « Catégories ».</small></div>' +
            '<div class="form-champ"><label for="mpg-statut">Statut</label><select id="mpg-statut">' +
              Object.keys(LIBELLES_STATUT).map(s => '<option value="' + s + '"' + (s === p.statut ? ' selected' : '') + '>' + LIBELLES_STATUT[s] + '</option>').join('') + '</select></div>' +
          '</div>' +
          '<label class="mpg-case"><input type="checkbox" id="mpg-avant"' + (p.mis_en_avant ? ' checked' : '') + '> Mettre en avant (grande photo d’accueil de la boutique, en premier dans la liste)</label>' +
        '</div>' +
        '<div class="mpg-bloc" data-pour="billet"><div class="eyebrow">L’événement</div><div class="mpg-grille2">' +
          '<div class="form-champ"><label for="mpg-ev-date">Date et heure *</label><input id="mpg-ev-date" type="datetime-local" value="' + versLocal(p.evenement_debut) + '"></div>' +
          '<div class="form-champ"><label for="mpg-ev-lieu">Lieu</label><input id="mpg-ev-lieu" maxlength="160" placeholder="Sofitel Abidjan Hôtel Ivoire" value="' + echapperHtml(p.evenement_lieu || '') + '"></div>' +
        '</div><p class="mpg-aide">Une fois la date passée, les billets ne sont plus vendus.</p></div>' +
        '<div class="mpg-bloc" data-pour="service"><div class="eyebrow">Déroulement du service</div>' +
          '<div class="form-champ"><label for="mpg-modalites">Ce que le client doit savoir</label><textarea id="mpg-modalites" rows="4" maxlength="1500" placeholder="Durée, lieu, ce qui est inclus, comment le rendez-vous est fixé…">' + echapperHtml(p.service_modalites || '') + '</textarea></div>' +
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
        '<div class="mpg-bloc"><div class="eyebrow" id="mpg-versions-titre">Tailles, couleurs et stock</div>' +
          '<p class="mpg-aide" id="mpg-versions-aide"></p>' +
          '<div class="mpg-table-wrap"><table class="mpg-table"><thead><tr><th id="mpg-col-taille">Taille</th><th class="mpg-col-couleur">Couleur</th><th>Prix spécifique</th><th id="mpg-col-stock">Stock</th><th>Actif</th><th></th></tr></thead><tbody id="mpg-variantes"></tbody></table></div>' +
          '<div><button type="button" class="btn-mini-admin" id="mpg-ajout-variante">+ Ajouter une version</button></div>' +
        '</div>' +
        '<div class="mpg-bloc"><div class="eyebrow">Description</div>' +
          '<div class="editeur-riche"><div id="mpg-description"></div></div>' +
          '<div class="mpg-grille2">' +
            '<div class="form-champ" data-pour="physique"><label for="mpg-composition">Composition</label><input id="mpg-composition" maxlength="300" value="' + echapperHtml(p.composition || '') + '"></div>' +
            '<div class="form-champ" data-pour="physique"><label for="mpg-entretien">Entretien</label><input id="mpg-entretien" maxlength="300" value="' + echapperHtml(p.entretien || '') + '"></div>' +
            '<div class="form-champ" data-pour="physique"><label for="mpg-poids">Poids (grammes)</label><input id="mpg-poids" type="number" min="0" inputmode="numeric" value="' + (p.poids_g != null ? p.poids_g : '') + '"></div>' +
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
          '<td><input type="text" data-champ="taille" maxlength="40" placeholder="' + (type === 'billet' ? 'Standard' : type === 'service' ? 'Formule 1 h' : 'M') + '" value="' + echapperHtml(v.taille || '') + '"></td>' +
          '<td class="mpg-col-couleur"><input type="text" data-champ="couleur" maxlength="40" placeholder="Noir" value="' + echapperHtml(v.couleur || '') + '"></td>' +
          '<td><input type="number" data-champ="prix" min="0" step="100" inputmode="numeric" placeholder="—" value="' + (v.prix_fcfa != null ? v.prix_fcfa : '') + '"></td>' +
          '<td><input type="number" data-champ="stock" min="0" inputmode="numeric" value="' + (v.stock || 0) + '"></td>' +
          '<td><input type="checkbox" data-champ="actif"' + (v.actif !== false ? ' checked' : '') + ' aria-label="Actif"></td>' +
          '<td><button type="button" class="mpg-suppr" data-suppr-variante aria-label="Supprimer cette version">✕</button></td>' +
        '</tr>').join('');
    }
    rendreVariantes();

    // --- Sorte de produit : adapte les blocs et les libellés
    const TEXTES_TYPE = {
      physique: ['Tailles, couleurs et stock', 'Une ligne par version (par exemple « M · Noir »). Laissez taille et couleur vides pour un produit unique. Le prix spécifique est facultatif.', 'Taille', 'Stock', 'Un article livré à domicile (vêtement, accessoire, objet).'],
      billet: ['Places', 'Une ligne par type de place (par exemple « Standard », « VIP ») avec son nombre de places. Chaque place achetée donne un billet à code.', 'Type de place', 'Places', 'Une place pour un événement : le client reçoit un billet à code, sans livraison.'],
      service: ['Formules', 'Une ligne par formule (par exemple « Shooting 1 h »). Le nombre indique combien de clients vous pouvez accepter.', 'Formule', 'Disponibles', 'Une prestation de l’agence (shooting, formation…) : rendez-vous fixé après paiement.']
    };
    let rayonChoisi = p.categorie_id || '';
    function rendreRayons() {
      const select = document.getElementById('mpg-categorie');
      if (select.options.length) rayonChoisi = select.value;
      const liste = etat.categories.filter(c => (c.univers || 'physique') === type);
      select.innerHTML = '<option value="">— Aucun —</option>' + liste.map(c => '<option value="' + c.id + '"' + (c.id === rayonChoisi ? ' selected' : '') + '>' + echapperHtml(c.nom) + '</option>').join('');
    }
    function appliquerType() {
      rendreRayons();
      const t = TEXTES_TYPE[type];
      document.getElementById('mpg-versions-titre').textContent = t[0];
      document.getElementById('mpg-versions-aide').textContent = t[1];
      document.getElementById('mpg-col-taille').textContent = t[2];
      document.getElementById('mpg-col-stock').textContent = t[3];
      document.getElementById('mpg-type-aide').textContent = t[4];
      document.querySelectorAll('#mpg-form-produit [data-pour]').forEach(el => el.classList.toggle('mp-cache', el.dataset.pour !== type));
      document.querySelectorAll('#mpg-form-produit .mpg-col-couleur').forEach(el => el.classList.toggle('mp-cache', type !== 'physique'));
      document.querySelectorAll('#mpg-types [data-type]').forEach(b => b.classList.toggle('actif', b.dataset.type === type));
    }
    document.getElementById('mpg-types').addEventListener('click', e => {
      const b = e.target.closest('[data-type]');
      if (!b) return;
      type = b.dataset.type;
      variantes = lireVariantesDuTableau();
      rendreVariantes();
      appliquerType();
    });
    appliquerType();
    document.getElementById('mpg-ajout-variante').addEventListener('click', () => {
      variantes = lireVariantesDuTableau();
      variantes.push({ taille: '', couleur: '', prix_fcfa: null, stock: 0, actif: true });
      rendreVariantes();
      appliquerType();
    });
    document.getElementById('mpg-variantes').addEventListener('click', e => {
      const b = e.target.closest('[data-suppr-variante]');
      if (!b) return;
      variantes = lireVariantesDuTableau();
      const index = Array.from(document.querySelectorAll('#mpg-variantes tr')).indexOf(b.closest('tr'));
      variantes.splice(index, 1);
      if (!variantes.length) variantes.push({ taille: '', couleur: '', prix_fcfa: null, stock: 0, actif: true });
      rendreVariantes();
      appliquerType();
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
      if (type !== 'physique') versions.forEach(v => { v.couleur = ''; });
      const cles = versions.map(v => (v.taille + '|' + v.couleur).toLowerCase());
      if (new Set(cles).size !== cles.length) { message(msg, 'Deux versions ont la même taille et la même couleur.', 'err'); return; }
      if (statut === 'en_vente' && !photos.length) { message(msg, 'Ajoutez au moins une photo avant de mettre le produit en vente.', 'err'); return; }
      const dateEvenement = document.getElementById('mpg-ev-date').value;
      if (type === 'billet' && !dateEvenement) { message(msg, 'Indiquez la date et l’heure de l’événement.', 'err'); return; }

      const debut = document.getElementById('mpg-promo-debut').value;
      const fin = document.getElementById('mpg-promo-fin').value;
      const donnees = {
        id: id,
        nom: nom,
        type: type,
        evenement_debut: type === 'billet' && dateEvenement ? new Date(dateEvenement).toISOString() : null,
        evenement_lieu: type === 'billet' ? (document.getElementById('mpg-ev-lieu').value.trim() || null) : null,
        service_modalites: type === 'service' ? (document.getElementById('mpg-modalites').value.trim() || null) : null,
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
        photosRetirees.forEach(ph => { if (ph.chemin) { void supprimerImageSite('boutique', ph.chemin); void supprimerImageSite('boutique', ph.chemin.replace(/\.jpg$/, '-mini.jpg')); } });
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
        (produit.photos || []).forEach(ph => { if (ph.chemin) { void supprimerImageSite('boutique', ph.chemin); void supprimerImageSite('boutique', ph.chemin.replace(/\.jpg$/, '-mini.jpg')); } });
        await chargerTout();
        afficherListeProduits();
        MP.toast('Produit supprimé.');
      } catch (err) {
        message(msg, erreurLisible(err), 'err');
      }
    });
  }

  // ------------------------------------------------------------ Commandes
  const STATUTS = {
    en_attente_paiement: 'En attente de paiement',
    paiement_declare: 'Paiement à vérifier',
    payee: 'Payée',
    en_preparation: 'En préparation',
    expediee: 'En livraison',
    livree: 'Terminée',
    annulee: 'Annulée',
    remboursee: 'Remboursée'
  };
  const MOYENS = { wave: 'Wave', orange_money: 'Orange Money', mtn_momo: 'MTN Mobile Money' };
  const FILTRES_COMMANDES = [
    ['verifier', 'À vérifier', ['paiement_declare']],
    ['attente', 'En attente de paiement', ['en_attente_paiement']],
    ['cours', 'À préparer / livrer', ['payee', 'en_preparation', 'expediee']],
    ['terminees', 'Terminées', ['livree']],
    ['annulees', 'Annulées', ['annulee', 'remboursee']],
    ['toutes', 'Toutes', null]
  ];
  let filtreCommandes = null;
  let rechercheCommandes = '';

  // Historique lisible : « payee → expediee » devient « Payée → En livraison ».
  const ACTIONS = { commande_creee: 'Commande créée', paiement_declare: 'Paiement déclaré par le client', annulation_automatique: 'Annulée automatiquement', billet_utilise: 'Billet utilisé à l’entrée' };
  function libelleJournal(texte) {
    return String(texte || '').split(' ').map(m => ACTIONS[m] || STATUTS[m] || MOYENS[m] || m).join(' ');
  }

  function numeroWhatsapp(tel) {
    let n = String(tel || '').replace(/[^0-9]/g, '');
    if (n.length === 10 && n[0] === '0') n = '225' + n;
    return n;
  }
  function lienSuiviClient(c) {
    return location.origin + '/marketplace/suivi?n=' + encodeURIComponent(c.numero) + '&j=' + encodeURIComponent(c.jeton_suivi);
  }

  function afficherCommandes() {
    const zone = document.getElementById('mpg-commandes');
    const aVerifier = etat.commandes.filter(c => c.statut === 'paiement_declare').length;
    document.getElementById('mpg-nb-commandes').textContent = aVerifier || '';
    if (!filtreCommandes) filtreCommandes = aVerifier ? 'verifier' : 'toutes';
    const filtre = FILTRES_COMMANDES.find(f => f[0] === filtreCommandes);
    const q = rechercheCommandes.toLowerCase();
    const liste = etat.commandes.filter(c => (!filtre[2] || filtre[2].indexOf(c.statut) !== -1) &&
      (!q || [c.numero, c.client_nom, c.client_telephone, c.reference_paiement].join(' ').toLowerCase().indexOf(q) !== -1));
    zone.innerHTML =
      '<div class="mpg-barre"><h2>Commandes</h2><button type="button" class="btn" id="mpg-actualiser">Actualiser</button></div>' +
      '<p class="mpg-aide">Quand un client a payé, il inscrit sa référence : la commande passe dans « À vérifier ». Vérifiez dans votre application Wave, Orange Money ou MTN que la somme est bien arrivée, puis confirmez. La facture et les billets sont alors créés automatiquement.</p>' +
      '<div class="filtres" id="mpg-filtres-commandes">' + FILTRES_COMMANDES.map(f => {
        const nb = f[2] ? etat.commandes.filter(c => f[2].indexOf(c.statut) !== -1).length : etat.commandes.length;
        return '<button type="button" class="filtre-btn' + (f[0] === filtreCommandes ? ' actif' : '') + '" data-filtre-commandes="' + f[0] + '">' + f[1] + (nb ? ' · ' + nb : '') + '</button>';
      }).join('') + '</div>' +
      '<div class="form-champ mpg-recherche"><label for="mpg-recherche-commande">Rechercher</label><input id="mpg-recherche-commande" type="search" placeholder="Numéro, nom, téléphone ou référence" value="' + echapperHtml(rechercheCommandes) + '"></div>' +
      '<div class="mpg-liste" id="mpg-liste-commandes">' + (liste.length ? liste.map(c =>
        '<div class="mpg-commande" data-id="' + c.id + '" role="button" tabindex="0">' +
          '<div><div class="mpg-produit-nom">' + echapperHtml(c.numero) + ' — ' + echapperHtml(c.client_nom) + '</div>' +
            '<div class="mpg-produit-meta"><span>' + MP.formaterDate(c.created_at, true) + '</span><span>' + MP.formaterPrix(c.total_fcfa) + '</span>' +
            '<span>' + (c.lignes || []).reduce((s, l) => s + l.quantite, 0) + ' article(s)</span>' +
            (c.reference_paiement ? '<span>' + (MOYENS[c.moyen_paiement] || '') + ' · ' + echapperHtml(c.reference_paiement) + '</span>' : '') + '</div></div>' +
          '<span class="mpg-statut st-' + c.statut + '">' + STATUTS[c.statut] + '</span>' +
        '</div>').join('') : '<div class="mpg-vide">Aucune commande ici pour le moment.</div>') + '</div>';

    document.getElementById('mpg-actualiser').addEventListener('click', async () => { await chargerTout(); afficherCommandes(); MP.toast('Commandes à jour.'); });
    document.getElementById('mpg-filtres-commandes').addEventListener('click', e => {
      const b = e.target.closest('[data-filtre-commandes]');
      if (!b) return;
      filtreCommandes = b.dataset.filtreCommandes;
      afficherCommandes();
    });
    const recherche = document.getElementById('mpg-recherche-commande');
    recherche.addEventListener('input', () => {
      rechercheCommandes = recherche.value;
      clearTimeout(afficherCommandes._t);
      afficherCommandes._t = setTimeout(() => { afficherCommandes(); const r = document.getElementById('mpg-recherche-commande'); r.focus(); r.setSelectionRange(r.value.length, r.value.length); }, 300);
    });
    zone.querySelectorAll('.mpg-commande').forEach(el => {
      const ouvrir = () => ouvrirCommande(etat.commandes.find(c => c.id === el.dataset.id));
      el.addEventListener('click', ouvrir);
      el.addEventListener('keydown', e => { if (e.key === 'Enter') void ouvrir(); });
    });
  }

  async function ouvrirCommande(c) {
    const zone = document.getElementById('mpg-commandes');
    const article = (c.lignes || []).some(l => (l.type_produit || 'physique') === 'physique');
    const { data: journal } = await sbAdmin.from('boutique_journal').select('*').eq('commande_id', c.id).order('created_at');
    const actions = [];
    if (c.statut === 'paiement_declare') {
      actions.push(['payee', 'Paiement reçu — confirmer', true]);
      actions.push(['en_attente_paiement', 'Paiement introuvable', false, 'Motif communiqué au client (ex. : référence introuvable)']);
    }
    if (c.statut === 'en_attente_paiement') actions.push(['payee', 'Marquer comme payée', true]);
    if (['en_attente_paiement', 'paiement_declare'].indexOf(c.statut) !== -1) actions.push(['annulee', 'Annuler la commande', false, 'Motif de l’annulation']);
    if (article && c.statut === 'payee') actions.push(['en_preparation', 'En préparation', false]);
    if (article && ['payee', 'en_preparation'].indexOf(c.statut) !== -1) actions.push(['expediee', 'Remettre au livreur', true]);
    if (!article && ['payee', 'en_preparation'].indexOf(c.statut) !== -1) actions.push(['livree', 'Marquer comme terminée', true]);
    if (c.statut === 'expediee') actions.push(['livree', 'Livrée', true]);
    if (['payee', 'en_preparation', 'expediee', 'livree'].indexOf(c.statut) !== -1) actions.push(['remboursee', 'Remboursée', false, 'Motif et moyen du remboursement']);
    const messageWa = 'Bonjour ' + c.client_nom.split(' ')[0] + ', ici La Maison MA2M au sujet de votre commande ' + c.numero + '. Suivi : ' + lienSuiviClient(c);

    zone.innerHTML =
      '<div class="mpg-barre"><h2>Commande ' + echapperHtml(c.numero) + '</h2><button type="button" class="btn" id="mpg-retour-commandes">← Retour aux commandes</button></div>' +
      '<div class="mpg-commande-detail">' +
        '<div class="mpg-bloc"><div class="eyebrow">État</div>' +
          '<p><span class="mpg-statut st-' + c.statut + '">' + STATUTS[c.statut] + '</span></p>' +
          (c.statut === 'paiement_declare' ?
            '<div class="mpg-a-verifier"><p>Le client dit avoir payé <strong>' + MP.formaterPrix(c.total_fcfa) + '</strong> par <strong>' + (MOYENS[c.moyen_paiement] || '') + '</strong>.</p>' +
            '<p>Référence : <strong class="mpg-reference">' + echapperHtml(c.reference_paiement || '') + '</strong></p>' +
            '<p class="mpg-aide">Vérifiez dans votre application que ce paiement est bien arrivé avant de confirmer.</p></div>' : '') +
          (c.statut === 'en_attente_paiement' ? '<p class="mpg-aide">À payer avant le ' + MP.formaterDate(c.expire_le, true) + ' ; sinon annulation automatique.</p>' : '') +
          (c.motif_annulation ? '<p>Motif : ' + echapperHtml(c.motif_annulation) + '</p>' : '') +
          (c.livreur_nom ? '<p>Livreur : ' + echapperHtml(c.livreur_nom) + (c.livreur_telephone ? ' — ' + echapperHtml(c.livreur_telephone) : '') + '</p>' : '') +
          (c.statut === 'payee' || c.statut === 'en_preparation' ? (article ? '<div class="mpg-grille2 mpg-livreur"><div class="form-champ"><label for="mpg-livreur-nom">Livreur</label><input id="mpg-livreur-nom" maxlength="80"></div><div class="form-champ"><label for="mpg-livreur-tel">Téléphone du livreur</label><input id="mpg-livreur-tel" inputmode="tel" maxlength="30"></div></div>' : '') : '') +
          '<div class="mpg-actions">' + actions.map((a, i) => '<button type="button" class="btn' + (a[2] ? ' btn--principal' : '') + (a[0] === 'annulee' || a[0] === 'remboursee' ? ' mpg-bouton-danger' : '') + '" data-action="' + i + '">' + a[1] + '</button>').join('') + '</div>' +
          '<div class="mpg-message" id="mpg-msg-commande" role="status"></div>' +
        '</div>' +
        '<div class="mpg-bloc"><div class="eyebrow">Client</div>' +
          '<p><strong>' + echapperHtml(c.client_nom) + '</strong><br><a href="tel:' + echapperHtml(c.client_telephone) + '">' + echapperHtml(c.client_telephone) + '</a>' +
          (c.client_email ? '<br>' + echapperHtml(c.client_email) : '') + '</p>' +
          (article ? '<p>' + echapperHtml([c.zone_nom, c.adresse_commune, c.adresse_quartier].filter(Boolean).join(' · ')) + (c.adresse_repere ? '<br>Repère : ' + echapperHtml(c.adresse_repere) : '') + '</p>' : '') +
          (c.note_client ? '<p class="mpg-aide">Note du client : ' + echapperHtml(c.note_client) + '</p>' : '') +
          '<div class="mpg-actions">' +
            '<a class="btn" href="https://wa.me/' + numeroWhatsapp(c.client_telephone) + '?text=' + encodeURIComponent(messageWa) + '" target="_blank" rel="noopener">Écrire sur WhatsApp</a>' +
            '<a class="btn" href="' + echapperHtml(lienSuiviClient(c)) + '" target="_blank" rel="noopener">Page du client</a>' +
            (c.numero_facture ? '<a class="btn" href="/marketplace/facture?n=' + encodeURIComponent(c.numero) + '&j=' + encodeURIComponent(c.jeton_suivi) + '" target="_blank" rel="noopener">Facture ' + echapperHtml(c.numero_facture) + '</a>' : '') +
          '</div>' +
        '</div>' +
        '<div class="mpg-bloc"><div class="eyebrow">Contenu</div>' +
          '<div class="mpg-table-wrap"><table class="mpg-table"><thead><tr><th>Produit</th><th>Qté</th><th>Prix</th><th>Total</th></tr></thead><tbody>' +
            (c.lignes || []).map(l => '<tr><td>' + echapperHtml(l.nom_produit) + (l.libelle_variante ? ' · ' + echapperHtml(l.libelle_variante) : '') + '<br><small>' + MP.univers(l.type_produit || 'physique').nom.replace(/s$/, '') + '</small></td><td>' + l.quantite + '</td><td>' + MP.formaterPrix(l.prix_unitaire_fcfa) + '</td><td>' + MP.formaterPrix(l.total_fcfa) + '</td></tr>').join('') +
            (article ? '<tr><td>Livraison</td><td></td><td></td><td>' + MP.formaterPrix(c.frais_livraison_fcfa) + '</td></tr>' : '') +
            '<tr><td><strong>Total</strong></td><td></td><td></td><td><strong>' + MP.formaterPrix(c.total_fcfa) + '</strong></td></tr>' +
          '</tbody></table></div>' +
          ((c.billets || []).length ? '<p class="mpg-aide">Billets : ' + c.billets.map(b => echapperHtml(b.code) + ' (' + ({ valide: 'valide', utilise: 'utilisé', annule: 'annulé' }[b.statut]) + ')').join(', ') + '</p>' : '') +
        '</div>' +
        '<div class="mpg-bloc"><div class="eyebrow">Historique</div><ul class="mpg-journal">' +
          (journal || []).map(j => '<li><span>' + MP.formaterDate(j.created_at, true) + '</span> ' + echapperHtml(libelleJournal(j.action)) + (j.detail ? ' — ' + echapperHtml(libelleJournal(j.detail)) : '') + '</li>').join('') +
        '</ul></div>' +
      '</div>';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('mpg-retour-commandes').addEventListener('click', afficherCommandes);
    zone.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', async () => {
      const a = actions[+b.dataset.action];
      let detail = null;
      if (a[3]) {
        detail = prompt(a[3] + ' :');
        if (detail === null) return;
      } else if (a[0] === 'payee' && !confirm('Confirmer que ' + MP.formaterPrix(c.total_fcfa) + ' ont bien été reçus pour la commande ' + c.numero + ' ?')) return;
      const msg = document.getElementById('mpg-msg-commande');
      const livreurNom = document.getElementById('mpg-livreur-nom');
      const livreurTel = document.getElementById('mpg-livreur-tel');
      zone.querySelectorAll('[data-action]').forEach(x => { x.disabled = true; });
      message(msg, 'Enregistrement…');
      const { error } = await sbAdmin.rpc('boutique_changer_statut', {
        p_commande_id: c.id, p_statut: a[0], p_detail: detail,
        p_livreur_nom: livreurNom ? livreurNom.value.trim() || null : null,
        p_livreur_telephone: livreurTel ? livreurTel.value.trim() || null : null
      });
      if (error) {
        message(msg, MP.messageErreur(error), 'err');
        zone.querySelectorAll('[data-action]').forEach(x => { x.disabled = false; });
        return;
      }
      await chargerTout();
      afficherListeProduits();
      void ouvrirCommande(etat.commandes.find(x => x.id === c.id));
      document.getElementById('mpg-nb-commandes').textContent = etat.commandes.filter(x => x.statut === 'paiement_declare').length || '';
      MP.toast('Commande : ' + STATUTS[a[0]].toLowerCase() + '.');
    }));
  }

  // ------------------------------------------------------------ Contrôle des billets
  function afficherControleBillets(codeDepart) {
    const zone = document.getElementById('mpg-billets');
    zone.innerHTML =
      '<div class="mpg-barre"><h2>Contrôle des billets</h2></div>' +
      '<p class="mpg-aide">À l’entrée d’un événement : scannez le QR code du billet avec l’appareil photo du téléphone (il ouvre cette page), ou tapez le code. Un billet ne peut servir qu’une fois.</p>' +
      '<form class="mpg-bloc" id="mpg-form-billet"><div class="form-champ"><label for="mpg-code-billet">Code du billet</label><input id="mpg-code-billet" autocomplete="off" autocapitalize="characters" placeholder="MA2M-XXXXX-XXXXX" value="' + echapperHtml(codeDepart || '') + '"></div>' +
      '<div class="mpg-actions"><button type="submit" class="btn btn--principal">Vérifier</button></div></form>' +
      '<div id="mpg-resultat-billet"></div>';
    const form = document.getElementById('mpg-form-billet');
    async function verifier(marquer) {
      const code = document.getElementById('mpg-code-billet').value.trim();
      const resultat = document.getElementById('mpg-resultat-billet');
      if (!code) return;
      resultat.innerHTML = '<div class="mp-chargement"><span></span></div>';
      const { data, error } = await sbAdmin.rpc('boutique_controler_billet', { p_code: code, p_marquer: !!marquer });
      if (error) { resultat.innerHTML = '<div class="mpg-billet-verdict refuse"><strong>Billet refusé</strong><p>' + echapperHtml(MP.messageErreur(error)) + '</p></div>'; return; }
      const ok = data.statut === 'valide';
      const vientDEtreValide = marquer && data.statut_avant === 'valide';
      resultat.innerHTML = '<div class="mpg-billet-verdict ' + (vientDEtreValide ? 'accepte' : ok ? 'valide' : 'refuse') + '">' +
        '<strong>' + (vientDEtreValide ? 'Entrée validée ✓' : ok ? 'Billet valide' : data.statut === 'utilise' ? 'Déjà utilisé le ' + MP.formaterDate(data.utilise_le, true) : 'Billet annulé') + '</strong>' +
        '<p>' + echapperHtml(data.nom_evenement) + (data.libelle ? ' · ' + echapperHtml(data.libelle) : '') + '<br>' + echapperHtml(data.client_nom) + ' — commande ' + echapperHtml(data.commande) + '<br><code>' + echapperHtml(data.code) + '</code></p>' +
        (ok ? '<button type="button" class="btn btn--principal" id="mpg-valider-entree">Valider l’entrée</button>' : '') + '</div>';
      const bouton = document.getElementById('mpg-valider-entree');
      if (bouton) bouton.addEventListener('click', () => verifier(true));
      if (vientDEtreValide && window.jouerSon) window.jouerSon('envoi');
    }
    form.addEventListener('submit', e => { e.preventDefault(); void verifier(false); });
    if (codeDepart) void verifier(false);
  }

  // ------------------------------------------------------------ Catégories
  function afficherCategories() {
    const zone = document.getElementById('mpg-categories');
    zone.innerHTML =
      '<div class="mpg-barre"><h2>Catégories (rayons)</h2></div>' +
      '<p class="mpg-aide">Les rayons à l’intérieur des trois portes. Ils apparaissent tous dans la boutique ; un rayon sans produit en vente affiche « bientôt ». « Masquer » retire un rayon de la boutique sans le supprimer.</p>' +
      '<form class="mpg-bloc" id="mpg-form-categorie"><div class="eyebrow">Nouveau rayon</div><div class="mpg-grille2">' +
        '<div class="form-champ"><label for="mpg-cat-univers">Porte</label><select id="mpg-cat-univers">' + MP.UNIVERS.map(u => '<option value="' + u.cle + '">' + u.nom + '</option>').join('') + '</select></div>' +
        '<div class="form-champ"><label for="mpg-cat-nom">Nom du rayon</label><input id="mpg-cat-nom" maxlength="80" placeholder="Vêtements"></div>' +
        '<div class="form-champ"><label for="mpg-cat-ordre">Ordre</label><input id="mpg-cat-ordre" type="number" inputmode="numeric" value="0"></div>' +
      '</div><div class="mpg-actions"><button type="submit" class="btn btn--principal">Ajouter</button><span class="mpg-message" id="mpg-msg-cat"></span></div></form>' +
      MP.UNIVERS.map(u => '<h3 class="mpg-porte-titre">' + u.nom + '</h3><div class="mpg-liste">' + (etat.categories.filter(c => (c.univers || 'physique') === u.cle).map(c =>
        '<div class="mpg-ligne" data-id="' + c.id + '"><div><div class="mpg-ligne-titre">' + echapperHtml(c.nom) + '</div>' +
          '<div class="mpg-ligne-sous">' + (c.actif ? 'Visible' : 'Masquée') + ' · ordre ' + c.ordre + ' · ' +
          etat.produits.filter(p => p.categorie_id === c.id).length + ' produit(s)</div></div>' +
          '<div class="mpg-ligne-actions"><button type="button" class="btn-mini-admin" data-basculer>' + (c.actif ? 'Masquer' : 'Afficher') + '</button>' +
          '<button type="button" class="btn-mini-admin mpg-bouton-danger" data-supprimer>Supprimer</button></div></div>').join('') ||
        '<div class="mpg-vide">Aucun rayon dans cette porte.</div>') + '</div>').join('');
    document.getElementById('mpg-form-categorie').addEventListener('submit', async e => {
      e.preventDefault();
      const nom = document.getElementById('mpg-cat-nom').value.trim();
      const msg = document.getElementById('mpg-msg-cat');
      if (!nom) { message(msg, 'Indiquez un nom.', 'err'); return; }
      const base = MP.slugifier(nom);
      let slug = base, n = 2;
      while (etat.categories.some(c => c.slug === slug)) slug = base + '-' + n++;
      const { error } = await sbAdmin.from('boutique_categories').insert({ nom: nom, slug: slug, univers: document.getElementById('mpg-cat-univers').value, ordre: parseInt(document.getElementById('mpg-cat-ordre').value, 10) || 0 });
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
        '<div class="mpg-bloc"><div class="eyebrow">Bandeau défilant</div>' +
          '<p class="mpg-aide">Le bandeau rouge qui défile sur l’accueil de la boutique. Désactivé ou vide, il affiche le texte habituel : « La Maison MA2M ✦ Articles ✦ Billets ✦ Services ».</p>' +
          '<div class="form-champ"><label for="mpg-bandeau">Message</label><input id="mpg-bandeau" maxlength="160" placeholder="Billets du Gala en vente — livraison offerte dès 50 000 FCFA" value="' + echapperHtml(r.bandeau_texte || '') + '"></div>' +
          '<label class="mpg-case"><input type="checkbox" id="mpg-bandeau-actif"' + (r.bandeau_actif ? ' checked' : '') + '> Afficher ce message dans le bandeau</label>' +
        '</div>' +
        '<div class="mpg-bloc"><div class="eyebrow">Identité du vendeur (factures)</div>' +
          '<p class="mpg-aide">Imprimée sur chaque facture. À remplir avec votre comptable ; la mention fiscale (TVA ou régime d’imposition) doit être validée par lui.</p>' +
          '<div class="mpg-grille2">' +
            '<div class="form-champ"><label for="mpg-v-nom">Raison sociale</label><input id="mpg-v-nom" maxlength="200" placeholder="Maître Akesse Model Management" value="' + echapperHtml(r.vendeur_raison_sociale || '') + '"></div>' +
            '<div class="form-champ"><label for="mpg-v-forme">Forme juridique</label><input id="mpg-v-forme" maxlength="200" placeholder="SARL au capital de …" value="' + echapperHtml(r.vendeur_forme_juridique || '') + '"></div>' +
            '<div class="form-champ"><label for="mpg-v-rccm">N° RCCM</label><input id="mpg-v-rccm" maxlength="200" value="' + echapperHtml(r.vendeur_rccm || '') + '"></div>' +
            '<div class="form-champ"><label for="mpg-v-ncc">N° compte contribuable (NCC)</label><input id="mpg-v-ncc" maxlength="200" value="' + echapperHtml(r.vendeur_ncc || '') + '"></div>' +
            '<div class="form-champ"><label for="mpg-v-adresse">Adresse</label><input id="mpg-v-adresse" maxlength="200" value="' + echapperHtml(r.vendeur_adresse || '') + '"></div>' +
            '<div class="form-champ"><label for="mpg-v-tel">Téléphone</label><input id="mpg-v-tel" maxlength="200" inputmode="tel" value="' + echapperHtml(r.vendeur_telephone || '') + '"></div>' +
            '<div class="form-champ"><label for="mpg-v-email">E-mail</label><input id="mpg-v-email" maxlength="200" type="email" value="' + echapperHtml(r.vendeur_email || '') + '"></div>' +
            '<div class="form-champ"><label for="mpg-v-mention">Mention fiscale</label><input id="mpg-v-mention" maxlength="200" value="' + echapperHtml(r.mention_fiscale || '') + '"></div>' +
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
        bandeau_texte: document.getElementById('mpg-bandeau').value.trim() || null,
        bandeau_actif: document.getElementById('mpg-bandeau-actif').checked,
        vendeur_raison_sociale: document.getElementById('mpg-v-nom').value.trim() || null,
        vendeur_forme_juridique: document.getElementById('mpg-v-forme').value.trim() || null,
        vendeur_rccm: document.getElementById('mpg-v-rccm').value.trim() || null,
        vendeur_ncc: document.getElementById('mpg-v-ncc').value.trim() || null,
        vendeur_adresse: document.getElementById('mpg-v-adresse').value.trim() || null,
        vendeur_telephone: document.getElementById('mpg-v-tel').value.trim() || null,
        vendeur_email: document.getElementById('mpg-v-email').value.trim() || null,
        mention_fiscale: document.getElementById('mpg-v-mention').value.trim() || null,
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
      // Billet scanné dans un nouvel onglet : on garde le code pour après la validation.
      try { const code = new URLSearchParams(location.search).get('billet'); if (code && CODE_BILLET.test(code)) sessionStorage.setItem('ma2m_billet_a_controler', code); } catch (e) {}
      return;
    }
    try {
      await chargerTout();
      afficherStructure();
      let code = new URLSearchParams(location.search).get('billet');
      try { if (!code) code = sessionStorage.getItem('ma2m_billet_a_controler'); sessionStorage.removeItem('ma2m_billet_a_controler'); } catch (e) {}
      if (code && CODE_BILLET.test(code)) { ouvrirOnglet('billets'); afficherControleBillets(code); }
      else if (etat.commandes.some(c => c.statut === 'paiement_declare')) ouvrirOnglet('commandes');
    } catch (e) {
      console.error('Boutique : chargement du tableau de bord impossible', e);
      principal.innerHTML = '<section class="mp-introuvable"><div><h1>Un instant…</h1><p>' + echapperHtml(erreurLisible(e)) +
        '</p><p>Si le message parle d’une table inconnue, la commande de la boutique n’a pas encore été lancée dans Supabase.</p></div></section>';
    }
  }
  void demarrer();
})();
