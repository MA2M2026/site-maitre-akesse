// ================== MARKETPLACE — outils communs (Boutique MA2M) ==================
// Chargé par toutes les pages du dossier marketplace/, après js/supabase-config.js et
// js/app.js. La boutique est FERMÉE au public tant que boutique_reglages.ouverte vaut
// false (voir Extension 98 dans supabase-extension.sql) : seul un administrateur
// connecté la voit. Tout autre visiteur voit « Page introuvable ».
//
// Les pages utilisent `sbAdmin` (client qui retrouve la connexion faite depuis le
// tableau de bord). Les règles d'accès de la base (RLS) restent la vraie protection :
// même en contournant ce fichier, un non-admin ne lirait rien tant que c'est fermé.
(function () {
  const MP = window.MP = {};

  MP.formaterPrix = function (fcfa) {
    const n = Math.round(Number(fcfa) || 0);
    return n.toLocaleString('fr-FR').replace(/ | /g, ' ') + ' FCFA';
  };

  // Prix effectif d'un produit (promotion en cours comprise) — pour l'AFFICHAGE
  // seulement : le prix réellement facturé est toujours recalculé par la base.
  MP.prixProduit = function (produit, variante) {
    if (variante && variante.prix_fcfa != null) return { prix: variante.prix_fcfa, barre: null };
    const maintenant = Date.now();
    const promoActive = produit.prix_promo_fcfa != null
      && (!produit.promo_debut || new Date(produit.promo_debut).getTime() <= maintenant)
      && (!produit.promo_fin || new Date(produit.promo_fin).getTime() > maintenant);
    return promoActive
      ? { prix: produit.prix_promo_fcfa, barre: produit.prix_fcfa }
      : { prix: produit.prix_fcfa, barre: null };
  };

  MP.htmlPrix = function (produit, variante) {
    const p = MP.prixProduit(produit, variante);
    return p.barre != null && p.barre > p.prix
      ? '<span class="promo">' + MP.formaterPrix(p.prix) + '</span><s>' + MP.formaterPrix(p.barre) + '</s>'
      : '<span>' + MP.formaterPrix(p.prix) + '</span>';
  };

  // Les trois univers de la Maison (colonne « type » des produits).
  MP.UNIVERS = [
    { cle: 'physique', nom: 'Articles', slug: 'articles', texte: 'Vêtements, accessoires et pièces de l’agence, livrés chez vous.' },
    { cle: 'billet', nom: 'Billets', slug: 'billets', texte: 'Vos places pour les événements de l’agence, avec billet à code.' },
    { cle: 'service', nom: 'Services', slug: 'services', texte: 'Shootings, formations et accompagnement par l’agence.' }
  ];
  MP.univers = function (cle) { return MP.UNIVERS.find(u => u.cle === cle || u.slug === cle) || MP.UNIVERS[0]; };

  MP.formaterDate = function (valeur, avecHeure) {
    if (!valeur) return '';
    const d = new Date(valeur);
    if (isNaN(d)) return '';
    const options = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' };
    if (avecHeure) { options.hour = '2-digit'; options.minute = '2-digit'; }
    return d.toLocaleString('fr-FR', options).replace(':', ' h ');
  };

  // Messages clairs pour les refus renvoyés par la base (voir Extensions 98 et 99).
  const ERREURS = {
    boutique_fermee: 'La boutique n’est pas encore ouverte.',
    cgv_non_acceptees: 'Merci d’accepter les conditions générales de vente.',
    nom_invalide: 'Indiquez votre nom complet.',
    telephone_invalide: 'Le numéro de téléphone ne semble pas correct.',
    email_invalide: 'L’adresse e-mail ne semble pas correcte.',
    panier_vide: 'Votre panier est vide.',
    panier_trop_grand: 'Votre panier contient trop d’articles différents.',
    trop_de_commandes: 'Plusieurs commandes attendent déjà un paiement avec ce numéro. Réglez-les ou patientez une heure.',
    quantite_invalide: 'Une quantité n’est pas valable.',
    article_indisponible: 'Un produit de votre panier n’est plus disponible. Retirez-le puis réessayez.',
    stock_insuffisant: 'Il ne reste plus assez de pièces pour un produit de votre panier.',
    evenement_passe: 'Un événement de votre panier est déjà passé.',
    zone_livraison_invalide: 'Choisissez votre zone de livraison.',
    adresse_invalide: 'Indiquez votre commune et votre quartier pour la livraison.',
    moyen_invalide: 'Choisissez le moyen de paiement utilisé.',
    reference_invalide: 'La référence de la transaction semble incomplète.',
    reference_deja_utilisee: 'Cette référence a déjà été utilisée pour une autre commande.',
    commande_introuvable: 'Aucune commande ne correspond. Vérifiez le numéro et le téléphone.',
    statut_incompatible: 'Cette commande n’attend plus de paiement.',
    transition_interdite: 'Ce changement n’est pas possible à cette étape.',
    billet_introuvable: 'Aucun billet ne porte ce code.',
    non_autorise: 'Action réservée à l’administration.'
  };
  MP.messageErreur = function (erreur) {
    const texte = String((erreur && (erreur.message || erreur)) || '');
    const cle = Object.keys(ERREURS).find(k => texte.indexOf(k) !== -1);
    return cle ? ERREURS[cle] : 'Une erreur est survenue (connexion instable ?). Réessayez dans un instant.';
  };

  MP.slugifier = function (texte) {
    let s = String(texte || '');
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'produit';
  };

  MP.toast = function (texte) {
    let el = document.getElementById('mp-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mp-toast';
      el.className = 'mp-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = texte;
    el.classList.add('visible');
    clearTimeout(MP._toastMinuteur);
    MP._toastMinuteur = setTimeout(() => el.classList.remove('visible'), 2800);
  };

  // --- Accès : admin connecté ? boutique ouverte ? ---
  MP.acces = (async function () {
    const resultat = { admin: false, ouverte: false, codeValide: false, utilisateur: null, reseau: true };
    try {
      if (typeof sbAdmin === 'undefined' || !sbAdmin) { resultat.reseau = false; return resultat; }
      const { data: { session } } = await sbAdmin.auth.getSession();
      if (session) {
        resultat.utilisateur = session.user;
        const { data } = await sbAdmin.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
        resultat.admin = !!data;
      }
      const { data: reglages } = await sbAdmin.from('boutique_reglages').select('*').eq('id', 'principal').maybeSingle();
      resultat.reglages = reglages || null;
      resultat.ouverte = !!(reglages && reglages.ouverte);
      try { resultat.codeValide = sessionStorage.getItem('ma2m_code_valide') === '1'; } catch (e) {}
    } catch (e) {
      resultat.reseau = false;
    }
    return resultat;
  })();

  // Remplace le contenu principal par « Page introuvable » (visiteur non autorisé).
  MP.afficherIntrouvable = function () {
    const principal = document.querySelector('main');
    if (!principal) return;
    principal.innerHTML =
      '<section class="mp-introuvable"><div>' +
        '<h1>Page introuvable</h1>' +
        '<p>La page que vous cherchez n’existe pas ou n’est plus disponible.</p>' +
        '<a class="btn" href="/">Retour à l’accueil</a>' +
      '</div></section>';
    document.querySelectorAll('.mp-nav, .mp-apercu').forEach(el => el.remove());
    document.title = 'Page introuvable — Maître Akesse Model Management';
  };

  MP.afficherBandeauApercu = function (acces) {
    // Le lien « Gestion » de la barre n'est montré qu'aux administrateurs.
    if (acces.admin) document.querySelectorAll('.mp-lien-admin').forEach(el => el.classList.remove('mp-cache'));
    const bandeau = document.getElementById('mp-apercu');
    if (!bandeau) return;
    if (acces.admin && !acces.ouverte) bandeau.classList.remove('mp-cache');
  };

  // Pages sans script propre (conditions de vente) : même règle d'accès que le reste.
  MP.autorise = function (acces) { return acces.admin || acces.ouverte; };
  document.addEventListener('DOMContentLoaded', async () => {
    const garde = document.querySelector('[data-mp-garde]');
    if (!garde) return;
    const acces = await MP.acces;
    if (!MP.autorise(acces)) { garde.classList.remove('mp-cache'); MP.afficherIntrouvable(); return; }
    MP.afficherBandeauApercu(acces);
    garde.classList.remove('mp-cache');
  });

  // --- Panier (gardé dans ce navigateur ; les prix sont recalculés à la commande) ---
  const CLE_PANIER = 'ma2m_boutique_panier';
  MP.lirePanier = function () {
    try {
      const brut = JSON.parse(localStorage.getItem(CLE_PANIER) || '[]');
      return Array.isArray(brut) ? brut.filter(l => l && l.variante_id && l.quantite > 0) : [];
    } catch (e) { return []; }
  };
  MP.ecrirePanier = function (lignes) {
    try { localStorage.setItem(CLE_PANIER, JSON.stringify(lignes)); } catch (e) {}
    MP.majCompteurPanier();
    document.dispatchEvent(new CustomEvent('mp-panier-change'));
  };
  MP.ajouterAuPanier = function (ligne) {
    const lignes = MP.lirePanier();
    const existante = lignes.find(l => l.variante_id === ligne.variante_id);
    if (existante) existante.quantite = Math.min(20, existante.quantite + ligne.quantite);
    else lignes.push(ligne);
    MP.ecrirePanier(lignes);
    MP.majCompteurPanier(true);
  };
  // Commandes passées depuis ce navigateur (pour les retrouver sur la page de suivi).
  const CLE_COMMANDES = 'ma2m_boutique_commandes';
  MP.commandesMemorisees = function () {
    try {
      const brut = JSON.parse(localStorage.getItem(CLE_COMMANDES) || '[]');
      return Array.isArray(brut) ? brut.filter(c => c && c.numero && c.jeton) : [];
    } catch (e) { return []; }
  };
  MP.memoriserCommande = function (numero, jeton) {
    const liste = MP.commandesMemorisees().filter(c => c.numero !== numero);
    liste.unshift({ numero: numero, jeton: jeton, date: new Date().toISOString() });
    try { localStorage.setItem(CLE_COMMANDES, JSON.stringify(liste.slice(0, 10))); } catch (e) {}
  };

  // Apparition douce des blocs au défilement (.mp-apparait → .mp-vu), avec un léger
  // décalage entre voisins (data-delai 0 à 3). Le site a son propre effet « reveal »,
  // mais il n'observe que ce qui existe au chargement ; la boutique, elle, construit
  // sa page après coup.
  MP.observerApparitions = function (racine) {
    const elements = Array.from((racine || document).querySelectorAll('.mp-apparait:not(.mp-vu)'));
    elements.forEach(el => el.style.setProperty('--d', +el.dataset.delai || 0));
    if (!('IntersectionObserver' in window)) { elements.forEach(el => el.classList.add('mp-vu')); return; }
    if (!MP._observateur) {
      MP._observateur = new IntersectionObserver(entrees => entrees.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add('mp-vu');
        MP._observateur.unobserve(en.target);
      }), { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    }
    elements.forEach(el => MP._observateur.observe(el));
  };

  MP.majCompteurPanier = function (secouer) {
    if (secouer) document.querySelectorAll('[data-mp-compte-panier]').forEach(el => {
      el.classList.remove('mp-secousse');
      void el.offsetWidth;
      el.classList.add('mp-secousse');
    });
    const n = MP.lirePanier().reduce((s, l) => s + l.quantite, 0);
    document.querySelectorAll('[data-mp-compte-panier]').forEach(el => {
      el.textContent = n;
      el.classList.toggle('mp-cache', n === 0);
    });
  };

  // Tiroir du panier (présent sur la vitrine et la fiche produit).
  function rendrePanier() {
    const zone = document.getElementById('mp-panier-lignes');
    const pied = document.getElementById('mp-panier-pied');
    if (!zone) return;
    const lignes = MP.lirePanier();
    if (!lignes.length) {
      zone.innerHTML = '<div class="mp-panier-vide"><p>Votre panier est vide.</p><a class="btn" href="/marketplace/#collection">Voir la collection</a></div>';
      pied.classList.add('mp-cache');
      return;
    }
    pied.classList.remove('mp-cache');
    zone.innerHTML = lignes.map((l, i) =>
      '<div class="mp-ligne">' +
        '<div class="mp-ligne-visuel">' + (l.photo ? '<img src="' + echapperHtml(l.photo) + '" alt="">' : '') + '</div>' +
        '<div>' +
          '<div class="mp-ligne-nom">' + echapperHtml(l.nom) + '</div>' +
          (l.variante ? '<div class="mp-ligne-variante">' + echapperHtml(l.variante) + '</div>' : '') +
          '<div class="mp-ligne-actions">' +
            '<div class="mp-quantite"><button type="button" data-mp-moins="' + i + '" aria-label="Retirer un">−</button><span>' + l.quantite + '</span><button type="button" data-mp-plus="' + i + '" aria-label="Ajouter un">+</button></div>' +
            '<button type="button" class="mp-retirer" data-mp-retirer="' + i + '">Retirer</button>' +
          '</div>' +
        '</div>' +
        '<div class="mp-ligne-prix">' + MP.formaterPrix(l.prix * l.quantite) + '</div>' +
      '</div>').join('');
    const total = lignes.reduce((s, l) => s + l.prix * l.quantite, 0);
    document.getElementById('mp-panier-total').textContent = MP.formaterPrix(total);
    const note = document.getElementById('mp-panier-note');
    if (note) note.textContent = (lignes.some(l => (l.type || 'physique') === 'physique') ? 'Les frais de livraison s’ajoutent selon votre commune. ' : '') +
      'Paiement par Wave, Orange Money ou MTN Mobile Money.';
  }

  MP.ouvrirPanier = function () {
    rendrePanier();
    document.getElementById('mp-panier').classList.add('ouvert');
    document.getElementById('mp-voile-panier').classList.add('ouvert');
    document.getElementById('mp-panier').setAttribute('aria-hidden', 'false');
  };
  MP.fermerPanier = function () {
    const panier = document.getElementById('mp-panier');
    if (!panier) return;
    panier.classList.remove('ouvert');
    document.getElementById('mp-voile-panier').classList.remove('ouvert');
    panier.setAttribute('aria-hidden', 'true');
  };

  // Hauteur réelle de l'en-tête du site, pour coller la barre de la boutique juste dessous.
  function majHauteurEntete() {
    const entete = document.querySelector('.site-header-v2');
    if (entete) document.documentElement.style.setProperty('--mp-haut-entete', entete.offsetHeight + 'px');
  }
  window.addEventListener('resize', majHauteurEntete);

  document.addEventListener('DOMContentLoaded', () => {
    majHauteurEntete();
    MP.majCompteurPanier();
    const panier = document.getElementById('mp-panier');
    if (!panier) return;
    document.querySelectorAll('[data-mp-ouvrir-panier]').forEach(b => b.addEventListener('click', MP.ouvrirPanier));
    document.getElementById('mp-voile-panier').addEventListener('click', MP.fermerPanier);
    document.getElementById('mp-panier-fermer').addEventListener('click', MP.fermerPanier);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') MP.fermerPanier(); });
    document.addEventListener('mp-panier-change', rendrePanier);
    document.getElementById('mp-panier-lignes').addEventListener('click', e => {
      const lignes = MP.lirePanier();
      const plus = e.target.closest('[data-mp-plus]');
      const moins = e.target.closest('[data-mp-moins]');
      const retirer = e.target.closest('[data-mp-retirer]');
      if (plus) { const l = lignes[+plus.dataset.mpPlus]; if (l) l.quantite = Math.min(20, l.quantite + 1); }
      else if (moins) { const l = lignes[+moins.dataset.mpMoins]; if (l) l.quantite = Math.max(1, l.quantite - 1); }
      else if (retirer) { lignes.splice(+retirer.dataset.mpRetirer, 1); }
      else return;
      MP.ecrirePanier(lignes);
    });
  });
})();
