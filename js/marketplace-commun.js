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
    const bandeau = document.getElementById('mp-apercu');
    if (!bandeau) return;
    if (acces.admin && !acces.ouverte) bandeau.classList.remove('mp-cache');
  };

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
  };
  MP.majCompteurPanier = function () {
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
      zone.innerHTML = '<div class="mp-panier-vide"><p>Votre panier est vide</p><span>Découvrez la collection de la Maison.</span></div>';
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
    document.getElementById('mp-commander').addEventListener('click', () => {
      MP.toast('La commande et le paiement arrivent à la prochaine étape de construction.');
    });
  });
})();
