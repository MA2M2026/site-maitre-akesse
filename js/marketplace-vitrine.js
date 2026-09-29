// ================== MARKETPLACE — vitrine et fiche produit (Boutique MA2M) ==================
// marketplace/index.html (accueil de la boutique) et marketplace/produit.html?p=<slug>.
// Tant que la boutique est fermée, seul un administrateur connecté y accède ;
// tout autre visiteur voit « Page introuvable ».
(function () {
  const principal = document.getElementById('mp-principal');
  const estFiche = /produit(\.html)?$/.test(location.pathname.replace(/\/$/, ''));

  function premierePhoto(produit) {
    const photos = (produit.photos || []).slice().sort((a, b) => a.ordre - b.ordre);
    return photos;
  }

  function stockTotal(produit) {
    return (produit.variantes || []).filter(v => v.actif).reduce((s, v) => s + v.stock, 0);
  }

  async function chargerCatalogue() {
    const [{ data: produits, error }, { data: categories }] = await Promise.all([
      sbAdmin.from('boutique_produits')
        .select('*, photos:boutique_photos(url, url_miniature, ordre), variantes:boutique_variantes(id, taille, couleur, prix_fcfa, stock, actif, ordre), categorie:boutique_categories(nom, slug)')
        .eq('statut', 'en_vente')
        .order('mis_en_avant', { ascending: false })
        .order('ordre', { ascending: true })
        .order('created_at', { ascending: false }),
      sbAdmin.from('boutique_categories').select('*').eq('actif', true).order('ordre').order('nom')
    ]);
    if (error) throw error;
    return { produits: produits || [], categories: categories || [] };
  }

  // ---------------------------------------------------------------- Vitrine
  function carteProduit(p) {
    const photos = premierePhoto(p);
    const stock = stockTotal(p);
    const prix = MP.prixProduit(p);
    const nouveau = Date.now() - new Date(p.created_at).getTime() < 30 * 24 * 3600 * 1000;
    const badges = [];
    if (!stock) badges.push('<span class="mp-badge epuise">Épuisé</span>');
    else if (prix.barre != null) badges.push('<span class="mp-badge promo">−' + Math.round(100 - prix.prix * 100 / prix.barre) + ' %</span>');
    else if (nouveau) badges.push('<span class="mp-badge">Nouveau</span>');
    return '<a class="mp-carte" href="produit.html?p=' + encodeURIComponent(p.slug) + '" data-categorie="' + echapperHtml(p.categorie ? p.categorie.slug : '') + '">' +
      '<div class="mp-carte-visuel">' +
        (photos[0] ? '<img class="mp-premiere" src="' + echapperHtml(photos[0].url_miniature || photos[0].url) + '" alt="' + echapperHtml(p.nom) + '" loading="lazy">' : '<div class="mp-carte-vide">MA2M</div>') +
        (photos[1] ? '<img class="mp-seconde" src="' + echapperHtml(photos[1].url_miniature || photos[1].url) + '" alt="" loading="lazy">' : '') +
        (badges.length ? '<div class="mp-badges">' + badges.join('') + '</div>' : '') +
      '</div>' +
      '<div class="mp-carte-infos">' +
        (p.categorie ? '<span class="mp-carte-cat">' + echapperHtml(p.categorie.nom) + '</span>' : '') +
        '<span class="mp-carte-nom">' + echapperHtml(p.nom) + '</span>' +
        '<span class="mp-prix">' + MP.htmlPrix(p) + '</span>' +
      '</div>' +
    '</a>';
  }

  function afficherVitrine(catalogue, acces) {
    const { produits, categories } = catalogue;
    const vedette = produits.find(p => p.mis_en_avant && premierePhoto(p)[0]) || produits.find(p => premierePhoto(p)[0]);
    const categoriesUtilisees = categories.filter(c => produits.some(p => p.categorie && p.categorie.slug === c.slug));

    const photoVedette = vedette ? premierePhoto(vedette)[0] : null;
    principal.innerHTML =
      '<section class="u-pb-1 mp-entree"><div class="container">' +
        '<div class="eyebrow">Boutique de l’agence</div>' +
        '<h1>La Maison MA2M<span class="oeil">.</span></h1>' +
        '<p class="u-mt-1-2">Révéler le potentiel. Construire l’image. Créer des opportunités. ' +
          'Les pièces et accessoires de Maître Akesse Model Management, en vente directe depuis Abidjan.</p>' +
      '</div></section>' +
      (vedette ?
        '<a class="vedette-fullbleed mp-vedette" href="produit.html?p=' + encodeURIComponent(vedette.slug) + '">' +
          '<img src="' + echapperHtml(photoVedette.url) + '" alt="' + echapperHtml(vedette.nom) + '">' +
          '<div class="vedette-scrim"></div>' +
          '<div class="vedette-contenu">' +
            '<span class="vedette-badge">À la une</span>' +
            '<h2>' + echapperHtml(vedette.nom) + '</h2>' +
            '<p class="mp-prix">' + MP.htmlPrix(vedette) + '</p>' +
            '<span class="vedette-cta">Voir la pièce</span>' +
          '</div>' +
        '</a>' : '') +
      '<section id="collection"><div class="container">' +
        '<div class="eyebrow">La collection</div>' +
        '<h2 class="u-mt-1">Nos pièces<span class="oeil">.</span></h2>' +
        '<div class="mp-outils u-mt-1-8">' +
          (categoriesUtilisees.length > 1 ? '<div class="filtres" id="mp-filtres"><button type="button" class="filtre-btn actif" data-filtre="">Tout</button>' +
            categoriesUtilisees.map(c => '<button type="button" class="filtre-btn" data-filtre="' + echapperHtml(c.slug) + '">' + echapperHtml(c.nom) + '</button>').join('') + '</div>' : '<div id="mp-filtres"></div>') +
          '<div class="form-champ mp-tri"><label for="mp-tri">Trier</label><select id="mp-tri">' +
            '<option value="">Ordre de la Maison</option>' +
            '<option value="prix-asc">Prix croissant</option>' +
            '<option value="prix-desc">Prix décroissant</option>' +
            '<option value="recent">Les plus récentes</option>' +
          '</select></div>' +
        '</div>' +
        '<div id="mp-grille-zone"></div>' +
        '<p class="mp-pratique">Livraison à domicile à Abidjan et dans le reste du pays. Paiement par Wave, Orange Money ou MTN Mobile Money.</p>' +
      '</div></section>';

    let filtre = '';
    let tri = '';
    function rendreGrille() {
      const zone = document.getElementById('mp-grille-zone');
      let liste = produits.filter(p => !filtre || (p.categorie && p.categorie.slug === filtre));
      if (tri === 'prix-asc') liste = liste.slice().sort((a, b) => MP.prixProduit(a).prix - MP.prixProduit(b).prix);
      if (tri === 'prix-desc') liste = liste.slice().sort((a, b) => MP.prixProduit(b).prix - MP.prixProduit(a).prix);
      if (tri === 'recent') liste = liste.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      if (!produits.length) {
        zone.innerHTML = '<div class="mannequins-vide">Aucune pièce en vente pour le moment.' +
          (acces.admin ? ' <a href="gestion.html">Ajouter un produit dans la gestion de la boutique.</a>' : '') + '</div>';
        return;
      }
      zone.innerHTML = '<div class="mp-grille">' + liste.map(carteProduit).join('') + '</div>';
    }
    rendreGrille();
    const barreFiltres = document.getElementById('mp-filtres');
    barreFiltres.addEventListener('click', e => {
      const bouton = e.target.closest('[data-filtre]');
      if (!bouton) return;
      filtre = bouton.dataset.filtre;
      barreFiltres.querySelectorAll('[data-filtre]').forEach(b => b.classList.toggle('actif', b === bouton));
      rendreGrille();
    });
    document.getElementById('mp-tri').addEventListener('change', e => { tri = e.target.value; rendreGrille(); });
  }

  // ---------------------------------------------------------------- Fiche produit
  function afficherFiche(produit) {
    const photos = premierePhoto(produit);
    const variantes = (produit.variantes || []).filter(v => v.actif).sort((a, b) => a.ordre - b.ordre);
    const tailles = [...new Set(variantes.map(v => v.taille).filter(Boolean))];
    const couleurs = [...new Set(variantes.map(v => v.couleur).filter(Boolean))];
    let tailleChoisie = tailles.length === 1 ? tailles[0] : null;
    let couleurChoisie = couleurs.length === 1 ? couleurs[0] : null;
    let quantite = 1;
    document.title = produit.nom + ' — La Maison MA2M';

    const description = produit.description ? rendreContenuRiche(produit.description) : '';
    principal.innerHTML =
      '<div class="mp-fiche">' +
        '<div>' +
          '<div class="fil-ariane"><a href="index.html">La Maison MA2M</a><span>/</span>' + (produit.categorie ? '<a href="index.html#collection">' + echapperHtml(produit.categorie.nom) + '</a><span>/</span>' : '') + echapperHtml(produit.nom) + '</div>' +
          '<div class="mp-galerie">' +
            '<div class="mp-galerie-principale" id="mp-galerie-principale">' +
              (photos[0] ? '<img id="mp-photo-principale" src="' + echapperHtml(photos[0].url) + '" alt="' + echapperHtml(produit.nom) + '">' : '<div class="mp-carte-vide">MA2M</div>') +
            '</div>' +
            (photos.length > 1 ? '<div class="mp-miniatures" id="mp-miniatures">' + photos.map((ph, i) =>
              '<button type="button" class="mp-miniature' + (i === 0 ? ' actif' : '') + '" data-index="' + i + '" aria-label="Photo ' + (i + 1) + '"><img src="' + echapperHtml(ph.url_miniature || ph.url) + '" alt=""></button>').join('') + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="mp-infos">' +
          (produit.categorie ? '<div class="eyebrow">' + echapperHtml(produit.categorie.nom) + '</div>' : '') +
          '<h1>' + echapperHtml(produit.nom) + '</h1>' +
          '<div class="mp-prix" id="mp-fiche-prix">' + MP.htmlPrix(produit) + '</div>' +
          (tailles.length ? '<div class="mp-choix"><div class="mp-choix-titre"><span>Taille</span><b id="mp-taille-choisie">' + echapperHtml(tailleChoisie || '') + '</b></div><div class="filtres mp-pastilles" id="mp-tailles">' +
            tailles.map(t => '<button type="button" class="filtre-btn" data-taille="' + echapperHtml(t) + '">' + echapperHtml(t) + '</button>').join('') + '</div></div>' : '') +
          (couleurs.length ? '<div class="mp-choix"><div class="mp-choix-titre"><span>Couleur</span><b id="mp-couleur-choisie">' + echapperHtml(couleurChoisie || '') + '</b></div><div class="filtres mp-pastilles" id="mp-couleurs">' +
            couleurs.map(c => '<button type="button" class="filtre-btn" data-couleur="' + echapperHtml(c) + '">' + echapperHtml(c) + '</button>').join('') + '</div></div>' : '') +
          '<div class="mp-stock" id="mp-stock"></div>' +
          '<div class="mp-achat">' +
            '<div class="mp-quantite"><button type="button" id="mp-qte-moins" aria-label="Moins">−</button><span id="mp-qte">1</span><button type="button" id="mp-qte-plus" aria-label="Plus">+</button></div>' +
            '<button type="button" class="btn btn--principal" id="mp-ajouter">Ajouter au panier</button>' +
          '</div>' +
          '<div class="mp-accordeon">' +
            (description ? '<details open><summary>Description</summary><div class="mp-texte contenu-riche" id="mp-description"></div></details>' : '') +
            ((produit.composition || produit.entretien) ? '<details><summary>Composition & entretien</summary><div class="mp-texte">' +
              (produit.composition ? '<p><strong>Composition :</strong> ' + echapperHtml(produit.composition) + '</p>' : '') +
              (produit.entretien ? '<p><strong>Entretien :</strong> ' + echapperHtml(produit.entretien) + '</p>' : '') + '</div></details>' : '') +
            '<details><summary>Livraison et paiement</summary><div class="mp-texte"><p>Livraison à domicile. Le tarif et le délai dépendent de votre commune ; ils sont indiqués avant que vous validiez la commande.</p><p>Paiement par Wave, Orange Money ou MTN Mobile Money. La commande est confirmée dès que l’agence a vérifié le paiement.</p></div></details>' +
          '</div>' +
        '</div>' +
      '</div>';
    // rendreContenuRiche (js/app.js) renvoie un HTML déjà nettoyé par DOMPurify.
    if (description) document.getElementById('mp-description').innerHTML = description;

    // Galerie
    const principale = document.getElementById('mp-photo-principale');
    const miniatures = document.getElementById('mp-miniatures');
    if (miniatures) miniatures.addEventListener('click', e => {
      const b = e.target.closest('[data-index]');
      if (!b) return;
      principale.src = photos[+b.dataset.index].url;
      miniatures.querySelectorAll('.mp-miniature').forEach(m => m.classList.toggle('actif', m === b));
    });
    if (principale && typeof ouvrirGalerieLightbox === 'function') {
      document.getElementById('mp-galerie-principale').addEventListener('click', () => {
        const actuelle = photos.findIndex(ph => ph.url === principale.getAttribute('src'));
        ouvrirGalerieLightbox(photos.map(ph => ph.url), Math.max(0, actuelle));
      });
    }

    function varianteChoisie() {
      return variantes.find(v => (!tailles.length || v.taille === tailleChoisie) && (!couleurs.length || v.couleur === couleurChoisie)) || null;
    }
    function majEtat() {
      document.querySelectorAll('[data-taille]').forEach(b => {
        const dispo = variantes.some(v => v.taille === b.dataset.taille && (!couleurChoisie || v.couleur === couleurChoisie) && v.stock > 0);
        b.disabled = !dispo;
        b.classList.toggle('actif', b.dataset.taille === tailleChoisie);
      });
      document.querySelectorAll('[data-couleur]').forEach(b => {
        const dispo = variantes.some(v => v.couleur === b.dataset.couleur && (!tailleChoisie || v.taille === tailleChoisie) && v.stock > 0);
        b.disabled = !dispo;
        b.classList.toggle('actif', b.dataset.couleur === couleurChoisie);
      });
      const tc = document.getElementById('mp-taille-choisie'); if (tc) tc.textContent = tailleChoisie || '';
      const cc = document.getElementById('mp-couleur-choisie'); if (cc) cc.textContent = couleurChoisie || '';
      const v = varianteChoisie();
      const stock = document.getElementById('mp-stock');
      const bouton = document.getElementById('mp-ajouter');
      document.getElementById('mp-fiche-prix').innerHTML = MP.htmlPrix(produit, v);
      if (!variantes.length || !variantes.some(x => x.stock > 0)) {
        stock.textContent = 'Épuisé pour le moment';
        bouton.disabled = true;
      } else if (!v) {
        stock.textContent = tailles.length && !tailleChoisie ? 'Choisissez votre taille' : 'Choisissez une couleur';
        stock.classList.remove('faible');
        bouton.disabled = false;
      } else if (v.stock <= 0) {
        stock.textContent = 'Épuisé dans cette version';
        bouton.disabled = true;
      } else {
        stock.textContent = v.stock <= 3 ? 'Plus que ' + v.stock + ' disponible' + (v.stock > 1 ? 's' : '') : 'En stock';
        stock.classList.toggle('faible', v.stock <= 3);
        bouton.disabled = false;
        quantite = Math.min(quantite, v.stock);
      }
      document.getElementById('mp-qte').textContent = quantite;
    }
    document.querySelectorAll('[data-taille]').forEach(b => b.addEventListener('click', () => { tailleChoisie = b.dataset.taille; majEtat(); }));
    document.querySelectorAll('[data-couleur]').forEach(b => b.addEventListener('click', () => { couleurChoisie = b.dataset.couleur; majEtat(); }));
    document.getElementById('mp-qte-moins').addEventListener('click', () => { quantite = Math.max(1, quantite - 1); majEtat(); });
    document.getElementById('mp-qte-plus').addEventListener('click', () => {
      const v = varianteChoisie();
      quantite = Math.min(v ? v.stock : 20, 20, quantite + 1);
      majEtat();
    });
    document.getElementById('mp-ajouter').addEventListener('click', () => {
      const v = varianteChoisie();
      if (!v) { MP.toast(tailles.length && !tailleChoisie ? 'Choisissez d’abord votre taille.' : 'Choisissez d’abord une couleur.'); return; }
      const dejaDansPanier = (MP.lirePanier().find(l => l.variante_id === v.id) || { quantite: 0 }).quantite;
      if (dejaDansPanier + quantite > v.stock) { MP.toast('Stock insuffisant : ' + v.stock + ' disponible(s) au total.'); return; }
      MP.ajouterAuPanier({
        variante_id: v.id,
        produit_slug: produit.slug,
        nom: produit.nom,
        variante: [v.taille, v.couleur].filter(Boolean).join(' · '),
        prix: MP.prixProduit(produit, v).prix,
        photo: photos[0] ? (photos[0].url_miniature || photos[0].url) : '',
        quantite: quantite
      });
      if (window.jouerSon) window.jouerSon('coeur');
      MP.ouvrirPanier();
    });
    majEtat();
  }

  async function demarrer() {
    const acces = await MP.acces;
    if (!acces.admin && !acces.ouverte) { MP.afficherIntrouvable(); return; }
    MP.afficherBandeauApercu(acces);
    try {
      if (estFiche) {
        const slug = new URLSearchParams(location.search).get('p') || '';
        const { data: produit } = await sbAdmin.from('boutique_produits')
          .select('*, photos:boutique_photos(url, url_miniature, ordre), variantes:boutique_variantes(id, taille, couleur, prix_fcfa, stock, actif, ordre), categorie:boutique_categories(nom, slug)')
          .eq('slug', slug).maybeSingle();
        if (!produit || (produit.statut !== 'en_vente' && !acces.admin)) { MP.afficherIntrouvable(); return; }
        afficherFiche(produit);
      } else {
        afficherVitrine(await chargerCatalogue(), acces);
      }
    } catch (e) {
      console.error('Boutique : chargement impossible', e);
      principal.innerHTML = '<section class="mp-introuvable"><div><h1>Un instant…</h1><p>La boutique n’a pas pu se charger (connexion instable ?). Rechargez la page.</p></div></section>';
    }
  }
  demarrer();
})();
