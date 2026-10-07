// ================== MARKETPLACE — paiement et suivi de commande (Boutique MA2M) ==================
// marketplace/suivi.html
//   ?n=<numéro>&j=<code de suivi> : la commande du client (lien reçu après commande).
//   sans paramètre : recherche par numéro + téléphone, et commandes passées depuis
//   ce navigateur.
// Tout passe par des fonctions de la base (boutique_suivi_commande,
// boutique_declarer_paiement) qui ne renvoient QUE la commande demandée.
(function () {
  const principal = document.getElementById('mp-principal');
  const FLECHE = '<span class="mp-fleche" aria-hidden="true">→</span>';
  const MOYENS = [
    { cle: 'wave', nom: 'Wave' },
    { cle: 'orange_money', nom: 'Orange Money' },
    { cle: 'mtn_momo', nom: 'MTN Mobile Money' }
  ];
  const STATUTS = {
    en_attente_paiement: 'En attente de paiement',
    paiement_declare: 'Paiement en cours de vérification',
    payee: 'Paiement confirmé',
    en_preparation: 'En préparation',
    expediee: 'En livraison',
    livree: 'Terminée',
    annulee: 'Annulée',
    remboursee: 'Remboursée'
  };

  function lienSuivi(c) {
    return location.origin + '/marketplace/suivi?n=' + encodeURIComponent(c.numero) + '&j=' + encodeURIComponent(c.jeton_suivi);
  }

  // Étapes affichées selon ce que contient la commande.
  function etapes(c) {
    const article = c.lignes.some(l => (l.type_produit || 'physique') === 'physique');
    const liste = [
      ['recue', 'Commande reçue', c.created_at],
      ['paiement', 'Paiement vérifié', c.payee_le]
    ];
    if (article) {
      liste.push(['expediee', 'En livraison', c.expediee_le]);
      liste.push(['livree', 'Livrée', c.livree_le]);
    } else {
      liste.push(['livree', 'Terminée', c.livree_le]);
    }
    const rang = { en_attente_paiement: 0, paiement_declare: 0, payee: 1, en_preparation: 1, expediee: 2, livree: 9 }[c.statut];
    return '<ol class="mp-frise">' + liste.map((e, i) => {
      const fait = rang != null && (i <= rang || (e[0] === 'livree' && c.statut === 'livree'));
      return '<li class="' + (fait ? 'fait' : '') + '"><span>' + e[1] + '</span>' + (fait && e[2] ? '<small>' + MP.formaterDate(e[2], true) + '</small>' : '') + '</li>';
    }).join('') + '</ol>';
  }

  function blocPaiement(c) {
    const numeros = c.paiement || {};
    const dispo = MOYENS.filter(m => numeros[m.cle]);
    return '<section class="mp-bloc-paiement">' +
      '<div class="eyebrow">Étape 2 sur 3</div>' +
      '<h2>Réglez votre commande<span class="oeil">.</span></h2>' +
      '<p class="mp-montant">' + MP.formaterPrix(c.total_fcfa) + '</p>' +
      '<p class="mp-petit">À régler avant le ' + MP.formaterDate(c.expire_le, true) + '. Passé ce délai, la commande est annulée automatiquement.</p>' +
      (dispo.length ?
        '<div class="filtres" id="mp-moyens" role="radiogroup" aria-label="Moyen de paiement">' +
          dispo.map((m, i) => '<button type="button" class="filtre-btn' + (i === 0 ? ' actif' : '') + '" data-moyen="' + m.cle + '" role="radio" aria-checked="' + (i === 0) + '">' + m.nom + '</button>').join('') + '</div>' +
        '<ol class="mp-consignes">' +
          '<li>Envoyez <strong>' + MP.formaterPrix(c.total_fcfa) + '</strong> par <strong id="mp-moyen-nom">' + dispo[0].nom + '</strong> au numéro <strong class="mp-numero" id="mp-moyen-numero">' + echapperHtml(numeros[dispo[0].cle]) + '</strong>.</li>' +
          '<li>Dans le message de confirmation reçu, repérez la <strong>référence de la transaction</strong>.</li>' +
          '<li>Inscrivez-la ci-dessous : l’agence vérifie puis confirme votre commande.</li>' +
        '</ol>' +
        '<form id="mp-form-paiement" class="mp-form-paiement" novalidate>' +
          '<div class="form-champ"><label for="mp-reference">Référence de la transaction *</label><input id="mp-reference" type="text" maxlength="60" autocomplete="off" required></div>' +
          '<p class="mpg-message err" id="mp-erreur-paiement" role="alert"></p>' +
          '<button type="submit" class="btn btn--principal" id="mp-declarer">J’ai payé — envoyer la référence ' + FLECHE + '</button>' +
        '</form>'
      : '<p class="mpg-message err">Les numéros de paiement ne sont pas encore renseignés. ' + '(Gestion → Réglages)</p>') +
    '</section>';
  }

  function blocBillets(c) {
    if (!c.billets || !c.billets.length) return '';
    return '<section class="mp-billets">' +
      '<div class="eyebrow">Vos billets</div>' +
      '<h2>' + c.billets.length + ' billet' + (c.billets.length > 1 ? 's' : '') + '<span class="oeil">.</span></h2>' +
      '<p class="mp-petit">Un billet par place. Présentez le QR code ou le code à l’entrée, sur téléphone ou imprimé.</p>' +
      '<div class="mp-billets-grille">' + c.billets.map(b =>
        '<article class="mp-billet mp-billet-' + b.statut + '">' +
          '<div class="mp-billet-texte">' +
            '<span class="mp-billet-marque">La Maison MA2M</span>' +
            '<strong>' + echapperHtml(b.nom_evenement) + '</strong>' +
            (b.libelle ? '<span>' + echapperHtml(b.libelle) + '</span>' : '') +
            (b.evenement_debut ? '<span>' + echapperHtml(MP.formaterDate(b.evenement_debut, true)) + '</span>' : '') +
            (b.evenement_lieu ? '<span>' + echapperHtml(b.evenement_lieu) + '</span>' : '') +
            '<code>' + echapperHtml(b.code) + '</code>' +
            (b.statut !== 'valide' ? '<em>' + (b.statut === 'utilise' ? 'Déjà utilisé' : 'Annulé') + '</em>' : '') +
          '</div>' +
          '<div class="mp-billet-qr" data-code="' + echapperHtml(b.code) + '"></div>' +
        '</article>').join('') + '</div>' +
    '</section>';
  }

  function dessinerQr() {
    if (typeof qrcode !== 'function') return;
    document.querySelectorAll('.mp-billet-qr[data-code]').forEach(zone => {
      // Le QR mène à la page de contrôle de la gestion (réservée aux admins).
      const qr = qrcode(0, 'M');
      qr.addData(location.origin + '/marketplace/gestion?billet=' + encodeURIComponent(zone.dataset.code));
      qr.make();
      const img = document.createElement('img');
      img.src = qr.createDataURL(5, 8);
      img.alt = 'QR code du billet ' + zone.dataset.code;
      zone.appendChild(img);
    });
  }

  function afficherCommande(c) {
    MP.memoriserCommande(c.numero, c.jeton_suivi);
    document.title = 'Commande ' + c.numero + ' — La Maison MA2M';
    const article = c.lignes.some(l => (l.type_produit || 'physique') === 'physique');
    const annulee = c.statut === 'annulee' || c.statut === 'remboursee';
    principal.innerHTML =
      '<div class="mp-parcours">' +
        '<div class="fil-ariane"><a href="/marketplace/">La Maison MA2M</a><span>/</span>Suivi de commande</div>' +
        '<ol class="mp-etapes" aria-label="Étapes"><li class="fait">Commande</li><li class="' + (c.statut === 'en_attente_paiement' ? 'actif' : 'fait') + '">Paiement</li><li class="' + (c.statut === 'en_attente_paiement' ? '' : 'actif') + '">Suivi</li></ol>' +
        '<div class="mp-suivi-tete">' +
          '<div><div class="eyebrow">Commande ' + echapperHtml(c.numero) + '</div>' +
          '<h1>' + (c.statut === 'en_attente_paiement' ? 'Merci, ' + echapperHtml(c.client_nom.split(' ')[0]) : STATUTS[c.statut] || c.statut) + '<span class="oeil">.</span></h1></div>' +
          '<span class="mp-statut mp-statut-' + c.statut + '">' + (STATUTS[c.statut] || c.statut) + '</span>' +
        '</div>' +
        (annulee ? '' : etapes(c)) +
        (c.statut === 'en_attente_paiement' ? blocPaiement(c) : '') +
        (c.statut === 'paiement_declare' ? '<section class="mp-info-bloc"><h2>Paiement reçu, vérification en cours<span class="oeil">.</span></h2><p>Référence <strong>' + echapperHtml(c.reference_paiement || '') + '</strong> (' + echapperHtml((MOYENS.find(m => m.cle === c.moyen_paiement) || {}).nom || '') + '), envoyée le ' + MP.formaterDate(c.paiement_declare_le, true) + '. L’agence confirme votre commande dès la vérification ; revenez sur cette page.</p></section>' : '') +
        (annulee ? '<section class="mp-info-bloc"><h2>' + STATUTS[c.statut] + '<span class="oeil">.</span></h2><p>' + (c.motif_annulation ? echapperHtml(c.motif_annulation) : 'Cette commande n’est plus active.') + '</p></section>' : '') +
        (c.statut === 'expediee' && c.livreur_nom ? '<section class="mp-info-bloc"><h2>Votre livreur<span class="oeil">.</span></h2><p><strong>' + echapperHtml(c.livreur_nom) + '</strong>' + (c.livreur_telephone ? ' — <a href="tel:' + echapperHtml(c.livreur_telephone) + '">' + echapperHtml(c.livreur_telephone) + '</a>' : '') + '</p></section>' : '') +
        blocBillets(c) +
        '<section class="mp-suivi-detail">' +
          '<div class="mp-recap">' +
            '<h2>Détail</h2>' +
            '<div class="mp-recap-lignes">' + c.lignes.map(l =>
              '<div class="mp-recap-ligne mp-recap-ligne-texte">' +
                '<span><span class="mp-ligne-nom">' + echapperHtml(l.nom_produit) + '</span><span class="mp-ligne-variante">' + echapperHtml([l.libelle_variante, '× ' + l.quantite].filter(Boolean).join(' · ')) + '</span></span>' +
                '<span class="mp-ligne-prix">' + MP.formaterPrix(l.total_fcfa) + '</span></div>').join('') + '</div>' +
            '<div class="mp-recap-totaux">' +
              '<div><span>Sous-total</span><span>' + MP.formaterPrix(c.sous_total_fcfa) + '</span></div>' +
              (article ? '<div><span>Livraison' + (c.zone_nom ? ' — ' + echapperHtml(c.zone_nom) : '') + '</span><span>' + (c.frais_livraison_fcfa ? MP.formaterPrix(c.frais_livraison_fcfa) : 'Offerte') + '</span></div>' : '') +
              '<div class="mp-recap-total"><span>Total</span><b>' + MP.formaterPrix(c.total_fcfa) + '</b></div>' +
            '</div>' +
          '</div>' +
          '<div class="mp-suivi-actions">' +
            (c.numero_facture ? '<a class="btn btn--principal" href="/marketplace/facture?n=' + encodeURIComponent(c.numero) + '&j=' + encodeURIComponent(c.jeton_suivi) + '">Ma facture ' + echapperHtml(c.numero_facture) + ' ' + FLECHE + '</a>' : '') +
            '<button type="button" class="btn" id="mp-copier-lien">Copier le lien de suivi</button>' +
            '<p class="mp-petit">Gardez ce lien : il permet de retrouver votre commande à tout moment. Sans lui, utilisez votre numéro de commande et votre téléphone.</p>' +
          '</div>' +
        '</section>' +
      '</div>';

    dessinerQr();
    document.getElementById('mp-copier-lien').addEventListener('click', async e => {
      try { await navigator.clipboard.writeText(lienSuivi(c)); e.target.textContent = 'Lien copié'; }
      catch (err) { window.prompt('Copiez ce lien :', lienSuivi(c)); }
    });

    const moyens = document.getElementById('mp-moyens');
    let moyen = moyens ? moyens.querySelector('.actif').dataset.moyen : null;
    if (moyens) moyens.addEventListener('click', e => {
      const b = e.target.closest('[data-moyen]');
      if (!b) return;
      moyen = b.dataset.moyen;
      moyens.querySelectorAll('[data-moyen]').forEach(x => { x.classList.toggle('actif', x === b); x.setAttribute('aria-checked', x === b); });
      document.getElementById('mp-moyen-nom').textContent = MOYENS.find(m => m.cle === moyen).nom;
      document.getElementById('mp-moyen-numero').textContent = c.paiement[moyen];
    });
    const form = document.getElementById('mp-form-paiement');
    if (form) form.addEventListener('submit', async e => {
      e.preventDefault();
      const erreur = document.getElementById('mp-erreur-paiement');
      const reference = document.getElementById('mp-reference').value.trim();
      erreur.textContent = '';
      if (reference.replace(/\s/g, '').length < 4) { erreur.textContent = MP.messageErreur('reference_invalide'); return; }
      const bouton = document.getElementById('mp-declarer');
      bouton.disabled = true;
      try {
        const { error } = await sbAdmin.rpc('boutique_declarer_paiement', { p_numero: c.numero, p_jeton: c.jeton_suivi, p_moyen: moyen, p_reference: reference });
        if (error) throw error;
        if (window.jouerSon) window.jouerSon('envoi');
        void charger(c.numero, c.jeton_suivi, null);
      } catch (err) {
        erreur.textContent = MP.messageErreur(err);
        bouton.disabled = false;
      }
    });
  }

  function afficherRecherche(message) {
    const memorisees = MP.commandesMemorisees();
    principal.innerHTML =
      '<div class="mp-parcours mp-recherche">' +
        '<div class="fil-ariane"><a href="/marketplace/">La Maison MA2M</a><span>/</span>Suivi de commande</div>' +
        '<div class="eyebrow">La Maison MA2M</div>' +
        '<h1>Suivre ma commande<span class="oeil">.</span></h1>' +
        (memorisees.length ? '<div class="mp-mes-commandes"><h2 class="mp-sous-titre">Sur cet appareil</h2>' + memorisees.map(m =>
          '<a class="btn" href="/marketplace/suivi?n=' + encodeURIComponent(m.numero) + '&j=' + encodeURIComponent(m.jeton) + '">' + echapperHtml(m.numero) + ' ' + FLECHE + '</a>').join('') + '</div>' : '') +
        '<form id="mp-form-recherche" class="mp-form-recherche" novalidate>' +
          '<div class="mpg-grille2">' +
            '<div class="form-champ"><label for="mp-r-numero">Numéro de commande</label><input id="mp-r-numero" type="text" placeholder="MA2M-2026-00001" autocomplete="off"></div>' +
            '<div class="form-champ"><label for="mp-r-tel">Téléphone utilisé pour la commande</label><input id="mp-r-tel" type="tel" inputmode="tel"></div>' +
          '</div>' +
          '<p class="mpg-message err" id="mp-erreur-recherche" role="alert">' + (message ? echapperHtml(message) : '') + '</p>' +
          '<button type="submit" class="btn btn--principal">Retrouver ma commande ' + FLECHE + '</button>' +
        '</form>' +
      '</div>';
    document.getElementById('mp-form-recherche').addEventListener('submit', e => {
      e.preventDefault();
      const numero = document.getElementById('mp-r-numero').value.trim().toUpperCase();
      const tel = document.getElementById('mp-r-tel').value.trim();
      if (!numero || tel.replace(/[^0-9]/g, '').length < 8) { document.getElementById('mp-erreur-recherche').textContent = 'Indiquez le numéro de commande et le téléphone.'; return; }
      void charger(numero, null, tel);
    });
  }

  async function charger(numero, jeton, telephone) {
    principal.innerHTML = '<div class="mp-chargement"><span></span></div>';
    try {
      const { data, error } = await sbAdmin.rpc('boutique_suivi_commande', { p_numero: numero, p_jeton: jeton, p_telephone: telephone });
      if (error) throw error;
      if (!jeton) history.replaceState(null, '', '/marketplace/suivi?n=' + encodeURIComponent(data.numero) + '&j=' + encodeURIComponent(data.jeton_suivi));
      afficherCommande(data);
    } catch (err) {
      afficherRecherche(MP.messageErreur(err));
    }
  }

  async function demarrer() {
    const acces = await MP.acces;
    if (!MP.autorise(acces)) { MP.afficherIntrouvable(); return; }
    MP.afficherBandeauApercu(acces);
    const params = new URLSearchParams(location.search);
    if (params.get('n') && params.get('j')) void charger(params.get('n'), params.get('j'), null);
    else afficherRecherche('');
  }
  void demarrer();
})();
