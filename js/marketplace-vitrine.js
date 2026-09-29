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
  // Direction artistique (29/09/2026) : l'ouverture reprend l'affiche FORM choisie
  // par la propriétaire (nuit laquée, filets de lumière, grand nom espacé, trait,
  // accroche, ornement), en rouge et noir seulement ; puis bandeau, univers,
  // pièce à la une, engagements, collection animée au défilement.
  const ICONES = {
    livraison: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17.5" cy="17.5" r="1.6"/></svg>',
    paiement: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M10 18.5h4M9 8h6M9 11.5h4"/></svg>',
    maison: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11"/><path d="M9.5 20v-6h5v6"/></svg>',
    suivi: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>'
  };
  const FLECHE = '<span class="mp-fleche" aria-hidden="true">→</span>';
  // Emblème de la Maison : un cadre fin et une porte en arche (la « Maison »), point rouge.
  const EMBLEME = '<svg viewBox="0 0 64 64"><rect x="1.5" y="1.5" width="61" height="61"/><path d="M20 62.5V30a12 12 0 0 1 24 0v32.5"/><circle class="mp-point" cx="32" cy="42" r="2"/></svg>';

  function carteProduit(p, index) {
    const photos = premierePhoto(p);
    const stock = stockTotal(p);
    const prix = MP.prixProduit(p);
    const nouveau = Date.now() - new Date(p.created_at).getTime() < 30 * 24 * 3600 * 1000;
    const badges = [];
    if (!stock) badges.push('<span class="mp-badge epuise">Épuisé</span>');
    else if (prix.barre != null) badges.push('<span class="mp-badge promo">−' + Math.round(100 - prix.prix * 100 / prix.barre) + ' %</span>');
    else if (nouveau) badges.push('<span class="mp-badge">Nouveau</span>');
    return '<a class="mp-carte mp-apparait" data-delai="' + (index % 4) + '" href="/marketplace/produit?p=' + encodeURIComponent(p.slug) + '">' +
      '<div class="mp-carte-visuel">' +
        (photos[0] ? '<img class="mp-premiere" src="' + echapperHtml(photos[0].url_miniature || photos[0].url) + '" alt="' + echapperHtml(p.nom) + '" loading="lazy">' : '<div class="mp-carte-vide">MA2M</div>') +
        (photos[1] ? '<img class="mp-seconde" src="' + echapperHtml(photos[1].url_miniature || photos[1].url) + '" alt="" loading="lazy">' : '') +
        (badges.length ? '<div class="mp-badges">' + badges.join('') + '</div>' : '') +
        '<span class="mp-carte-voir">Voir la pièce ' + FLECHE + '</span>' +
      '</div>' +
      '<div class="mp-carte-infos">' +
        (p.categorie ? '<span class="mp-carte-cat">' + echapperHtml(p.categorie.nom) + '</span>' : '') +
        '<span class="mp-carte-nom">' + echapperHtml(p.nom) + '</span>' +
        '<span class="mp-prix">' + MP.htmlPrix(p) + '</span>' +
      '</div>' +
    '</a>';
  }

  // Lettres du grand nom qui montent une à une (le décalage est posé en JS :
  // la sécurité du site interdit les styles écrits dans le HTML).
  function lettres(texte) {
    return texte.split('').map(c => '<span class="mp-lettre">' + (c === ' ' ? '&nbsp;' : echapperHtml(c)) + '</span>').join('');
  }

  function afficherVitrine(catalogue, acces) {
    const { produits, categories } = catalogue;
    const avecPhoto = produits.filter(p => premierePhoto(p)[0]);
    const vedette = avecPhoto.find(p => p.mis_en_avant) || avecPhoto[0] || null;
    const categoriesUtilisees = categories.filter(c => produits.some(p => p.categorie && p.categorie.slug === c.slug));
    const annee = new Date().getFullYear();
    const seconde = vedette;

    principal.innerHTML =
      // ---- Ouverture : l'affiche (nuit laquée, filets de lumière rouge, grand nom espacé)
      '<section class="mp-affiche">' +
        '<div class="mp-decor" aria-hidden="true"><span class="mp-mur"></span><span class="mp-led-haut"></span><span class="mp-led-mur"></span><span class="mp-fente"></span><span class="mp-sol"></span></div>' +
        '<div class="mp-affiche-contenu">' +
          '<span class="mp-embleme mp-monte" aria-hidden="true">' + EMBLEME + '</span>' +
          '<h1 class="mp-grand-nom" aria-label="La Maison MA2M"><span id="mp-nom-grand" aria-hidden="true">' + lettres('MA2M') + '</span></h1>' +
          '<span class="mp-trait mp-monte" aria-hidden="true"></span>' +
          '<p class="mp-accroche mp-monte">La Maison · Révéler le potentiel</p>' +
          '<div class="mp-affiche-actions mp-monte">' +
            '<a class="btn btn--principal" href="#collection"><span>Découvrir la collection</span>' + FLECHE + '</a>' +
            (vedette ? '<a class="btn" href="/marketplace/produit?p=' + encodeURIComponent(vedette.slug) + '">La pièce à la une</a>' : '') +
          '</div>' +
        '</div>' +
        '<div class="mp-affiche-pied mp-monte"><span>Pièces de l’agence · Abidjan</span><div class="mp-ornement" aria-hidden="true"><span></span><i></i><span></span></div></div>' +
      '</section>' +
      // ---- Bandeau défilant (même bandeau que l'accueil du site)
      '<div class="marquee-bande mp-bande" aria-hidden="true"><div class="marquee-viewport"><div class="marquee-piste">' +
        ('<span>La Maison MA2M</span><span>✦</span><span>Pièces de l’agence</span><span>✦</span><span>Abidjan</span><span>✦</span><span>Collection ' + annee + '</span><span>✦</span>').repeat(4) +
      '</div></div></div>' +
      // ---- Univers (catégories)
      (categoriesUtilisees.length ?
        '<section class="mp-univers"><div class="container">' +
          '<div class="mp-univers-grille">' + categoriesUtilisees.map((c, i) => {
            const p = avecPhoto.find(x => x.categorie && x.categorie.slug === c.slug);
            const nb = produits.filter(x => x.categorie && x.categorie.slug === c.slug).length;
            return '<a class="mp-univers-carte mp-apparait" data-delai="' + (i % 4) + '" href="#collection" data-aller-filtre="' + echapperHtml(c.slug) + '">' +
              '<span class="mp-univers-photo">' + (p ? '<img src="' + echapperHtml(premierePhoto(p)[0].url_miniature || premierePhoto(p)[0].url) + '" alt="" loading="lazy">' : '') + '</span>' +
              '<span class="mp-univers-texte"><strong>' + echapperHtml(c.nom) + '</strong><span>' + nb + ' pièce' + (nb > 1 ? 's' : '') + '</span>' +
              '<span class="mp-univers-lien">Voir ' + FLECHE + '</span></span></a>';
          }).join('') + '</div>' +
        '</div></section>' : '') +
      // ---- Bannière éditoriale
      (seconde ?
        '<section class="mp-banniere">' +
          '<div class="mp-banniere-texte mp-apparait">' +
            '<div class="eyebrow">À la une</div>' +
            '<h2 class="mp-banniere-titre">' + echapperHtml(seconde.nom) + '<span class="oeil">.</span></h2>' +
            '<p class="mp-prix">' + MP.htmlPrix(seconde) + '</p>' +
            '<a class="btn btn--principal" href="/marketplace/produit?p=' + encodeURIComponent(seconde.slug) + '"><span>Voir la pièce</span>' + FLECHE + '</a>' +
          '</div>' +
          '<a class="mp-banniere-image" href="/marketplace/produit?p=' + encodeURIComponent(seconde.slug) + '"><img src="' + echapperHtml(premierePhoto(seconde)[0].url) + '" alt="' + echapperHtml(seconde.nom) + '" loading="lazy"></a>' +
        '</section>' : '') +
      // ---- Engagements
      '<section class="mp-engagements"><div class="container"><ul>' +
        '<li class="mp-apparait" data-delai="0">' + ICONES.livraison + '<span><strong>Livraison à domicile</strong>Abidjan et reste du pays</span></li>' +
        '<li class="mp-apparait" data-delai="1">' + ICONES.paiement + '<span><strong>Paiement mobile</strong>Wave, Orange Money, MTN</span></li>' +
        '<li class="mp-apparait" data-delai="2">' + ICONES.maison + '<span><strong>Pièces de l’agence</strong>Choisies par Maître Akesse</span></li>' +
        '<li class="mp-apparait" data-delai="3">' + ICONES.suivi + '<span><strong>Suivi de commande</strong>À chaque étape</span></li>' +
      '</ul></div></section>' +
      // ---- Collection
      '<section id="collection" class="mp-collection"><div class="container">' +
        '<div class="mp-collection-tete">' +
          '<div><div class="eyebrow">La collection</div><h2 class="u-mt-1">Nos pièces<span class="oeil">.</span></h2></div>' +
          '<div class="form-champ mp-tri"><label for="mp-tri">Trier</label><select id="mp-tri">' +
            '<option value="">Ordre de la Maison</option>' +
            '<option value="prix-asc">Prix croissant</option>' +
            '<option value="prix-desc">Prix décroissant</option>' +
            '<option value="recent">Les plus récentes</option>' +
          '</select></div>' +
        '</div>' +
        (categoriesUtilisees.length > 1 ? '<div class="filtres" id="mp-filtres"><button type="button" class="filtre-btn actif" data-filtre="">Tout</button>' +
          categoriesUtilisees.map(c => '<button type="button" class="filtre-btn" data-filtre="' + echapperHtml(c.slug) + '">' + echapperHtml(c.nom) + '</button>').join('') + '</div>' : '<div id="mp-filtres"></div>') +
        '<div id="mp-grille-zone"></div>' +
      '</div></section>' +
      // ---- Mot de la Maison
      '<section class="mp-manifeste"><div class="container mp-apparait">' +
        '<div class="mp-ornement" aria-hidden="true"><span></span><i></i><span></span></div>' +
        '<blockquote>Chaque grand parcours commence par un rêve. Le nôtre commence à Abidjan.</blockquote>' +
        '<cite>Maître Akesse Model Management</cite>' +
      '</div></section>';

    // Lettres du grand nom : décalage d'apparition.
    document.querySelectorAll('#mp-nom-grand .mp-lettre').forEach((l, i) => l.style.setProperty('--i', i));
    requestAnimationFrame(() => principal.querySelector('.mp-affiche').classList.add('mp-affiche-prete'));

    let filtre = '';
    let tri = '';
    function rendreGrille() {
      const zone = document.getElementById('mp-grille-zone');
      let liste = produits.filter(p => !filtre || (p.categorie && p.categorie.slug === filtre));
      if (tri === 'prix-asc') liste = liste.slice().sort((a, b) => MP.prixProduit(a).prix - MP.prixProduit(b).prix);
      if (tri === 'prix-desc') liste = liste.slice().sort((a, b) => MP.prixProduit(b).prix - MP.prixProduit(a).prix);
      if (tri === 'recent') liste = liste.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      if (!produits.length) {
        zone.innerHTML = '<div class="mp-attente mp-apparait"><div class="mp-ornement" aria-hidden="true"><span></span><i></i><span></span></div>' +
          '<p>La première collection de la Maison sera bientôt présentée ici.</p>' +
          (acces.admin ? '<a class="btn btn--principal" href="/marketplace/gestion"><span>Ajouter une pièce</span>' + FLECHE + '</a>' : '') + '</div>';
      } else {
        zone.innerHTML = '<div class="mp-grille">' + liste.map(carteProduit).join('') + '</div>';
      }
      MP.observerApparitions(zone);
    }
    rendreGrille();
    MP.observerApparitions(principal);

    const barreFiltres = document.getElementById('mp-filtres');
    function choisirFiltre(valeur) {
      filtre = valeur;
      barreFiltres.querySelectorAll('[data-filtre]').forEach(b => b.classList.toggle('actif', b.dataset.filtre === valeur));
      rendreGrille();
    }
    barreFiltres.addEventListener('click', e => {
      const bouton = e.target.closest('[data-filtre]');
      if (bouton) choisirFiltre(bouton.dataset.filtre);
    });
    principal.querySelectorAll('[data-aller-filtre]').forEach(a => a.addEventListener('click', () => choisirFiltre(a.dataset.allerFiltre)));
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
          '<div class="fil-ariane"><a href="/marketplace/">La Maison MA2M</a><span>/</span>' + (produit.categorie ? '<a href="/marketplace/#collection">' + echapperHtml(produit.categorie.nom) + '</a><span>/</span>' : '') + echapperHtml(produit.nom) + '</div>' +
          // Galerie façon maison de couture : les photos les unes sous les autres sur
          // ordinateur, à faire glisser du doigt sur téléphone (avec repères).
          '<div class="mp-galerie">' +
            '<div class="mp-galerie-piste" id="mp-galerie-piste">' +
              (photos.length ? photos.map((ph, i) =>
                '<button type="button" class="mp-galerie-vue" data-index="' + i + '" aria-label="Agrandir la photo ' + (i + 1) + '">' +
                  '<img src="' + echapperHtml(ph.url) + '" alt="' + (i === 0 ? echapperHtml(produit.nom) : '') + '"' + (i > 1 ? ' loading="lazy"' : '') + '></button>').join('')
                : '<div class="mp-galerie-vue"><div class="mp-carte-vide">MA2M</div></div>') +
            '</div>' +
            (photos.length > 1 ? '<div class="mp-galerie-points" id="mp-galerie-points">' + photos.map((ph, i) => '<span' + (i === 0 ? ' class="actif"' : '') + '></span>').join('') + '</div>' : '') +
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
            '<button type="button" class="btn btn--principal" id="mp-ajouter"><span>Ajouter au panier</span><span class="mp-fleche" aria-hidden="true">→</span></button>' +
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

    // Galerie : agrandissement plein écran, repères qui suivent le glissement.
    const piste = document.getElementById('mp-galerie-piste');
    piste.addEventListener('click', e => {
      const vue = e.target.closest('[data-index]');
      if (vue && photos.length && typeof ouvrirGalerieLightbox === 'function') ouvrirGalerieLightbox(photos.map(ph => ph.url), +vue.dataset.index);
    });
    const points = document.getElementById('mp-galerie-points');
    if (points) piste.addEventListener('scroll', () => {
      const i = Math.round(piste.scrollLeft / Math.max(1, piste.clientWidth));
      points.querySelectorAll('span').forEach((p, n) => p.classList.toggle('actif', n === i));
    }, { passive: true });

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
      const bouton = document.getElementById('mp-ajouter');
      bouton.classList.add('mp-ajoute');
      bouton.querySelector('span').textContent = 'Ajoutée au panier';
      setTimeout(() => { bouton.classList.remove('mp-ajoute'); bouton.querySelector('span').textContent = 'Ajouter au panier'; }, 1800);
      setTimeout(MP.ouvrirPanier, 450);
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
