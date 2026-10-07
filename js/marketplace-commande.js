// ================== MARKETPLACE — passer commande (Boutique MA2M) ==================
// marketplace/commande.html : récapitulatif du panier, coordonnées, livraison (pour
// les articles seulement), acceptation des conditions de vente, puis création de la
// commande par la base (boutique_passer_commande, Extension 98/99) qui recalcule
// elle-même prix, promotions, frais et stock. Le client est ensuite envoyé sur sa
// page de paiement et de suivi.
(function () {
  const principal = document.getElementById('mp-principal');
  const FLECHE = '<span class="mp-fleche" aria-hidden="true">→</span>';

  function champ(id, libelle, attributs, aide) {
    return '<div class="form-champ"><label for="' + id + '">' + libelle + '</label>' +
      '<input id="' + id + '" ' + attributs + '>' + (aide ? '<small class="mp-aide">' + aide + '</small>' : '') + '</div>';
  }

  async function demarrer() {
    const acces = await MP.acces;
    if (!MP.autorise(acces)) { MP.afficherIntrouvable(); return; }
    MP.afficherBandeauApercu(acces);

    const lignes = MP.lirePanier();
    if (!lignes.length) {
      principal.innerHTML = '<section class="mp-introuvable"><div><h1>Votre panier est vide<span class="oeil">.</span></h1>' +
        '<p>Choisissez un article, un billet ou un service pour commencer.</p><a class="btn btn--principal" href="/marketplace/#portes">Entrer dans la Maison ' + FLECHE + '</a></div></section>';
      return;
    }
    const avecLivraison = lignes.some(l => (l.type || 'physique') === 'physique');
    let zones = [];
    if (avecLivraison) {
      const { data } = await sbAdmin.from('boutique_zones_livraison').select('*').eq('actif', true).order('ordre').order('nom');
      zones = data || [];
    }
    const reglages = acces.reglages || {};
    const sousTotal = lignes.reduce((s, l) => s + l.prix * l.quantite, 0);

    principal.innerHTML =
      '<div class="mp-parcours">' +
        '<div class="fil-ariane"><a href="/marketplace/">La Maison MA2M</a><span>/</span>Commande</div>' +
        '<ol class="mp-etapes" aria-label="Étapes"><li class="actif">Commande</li><li>Paiement</li><li>Suivi</li></ol>' +
        '<div class="mp-commande">' +
          '<form id="mp-form-commande" class="mp-commande-form" novalidate>' +
            '<div class="eyebrow">Étape 1 sur 3</div>' +
            '<h1>Vos coordonnées<span class="oeil">.</span></h1>' +
            // Civilité devant le nom (décision de la propriétaire, 07/10/2026 : la civilité partout).
            '<div class="form-champ"><label for="mp-civilite">Civilité *</label><select id="mp-civilite" required>' +
              '<option value="">Sélectionner</option><option value="Madame">Madame</option><option value="Mademoiselle">Mademoiselle</option><option value="Monsieur">Monsieur</option></select></div>' +
            '<div class="mpg-grille2">' +
              champ('mp-nom', 'Nom et prénom *', 'type="text" autocomplete="name" maxlength="120" required') +
              champ('mp-tel', 'Téléphone *', 'type="tel" autocomplete="tel" inputmode="tel" maxlength="20" required placeholder="07 00 00 00 00"', 'Pour vous joindre au sujet de la commande.') +
            '</div>' +
            champ('mp-email', 'E-mail (facultatif)', 'type="email" autocomplete="email" maxlength="160"') +
            (avecLivraison ?
              '<h2 class="mp-sous-titre">Livraison</h2>' +
              (zones.length ?
                '<div class="form-champ"><label for="mp-zone">Zone de livraison *</label><select id="mp-zone" required><option value="">Choisissez votre zone</option>' +
                  zones.map(z => '<option value="' + echapperHtml(z.id) + '" data-tarif="' + z.tarif_fcfa + '">' + echapperHtml(z.nom) + ' — ' + MP.formaterPrix(z.tarif_fcfa) + (z.delai ? ' (' + echapperHtml(z.delai) + ')' : '') + '</option>').join('') +
                '</select></div>' +
                '<div class="mpg-grille2">' +
                  champ('mp-commune', 'Commune *', 'type="text" maxlength="80" autocomplete="address-level2" required') +
                  champ('mp-quartier', 'Quartier *', 'type="text" maxlength="120" required') +
                '</div>' +
                champ('mp-repere', 'Point de repère', 'type="text" maxlength="240" placeholder="Ex. : près de la pharmacie…"')
              : '<p class="mpg-message err">Aucune zone de livraison n’est encore proposée. Contactez l’agence.</p>')
            : '<p class="mp-info">Votre commande ne contient que des billets ou des services : rien à livrer. ' +
                (lignes.some(l => l.type === 'billet') ? 'Vos billets apparaîtront sur votre page de suivi dès que le paiement sera vérifié.' : 'L’agence vous contactera après le paiement.') + '</p>') +
            '<div class="form-champ"><label for="mp-note">Un mot pour l’agence (facultatif)</label><textarea id="mp-note" maxlength="500" rows="3"></textarea></div>' +
            '<label class="mp-case-cgv"><input type="checkbox" id="mp-cgv"> <span>J’ai lu et j’accepte les <a href="/marketplace/cgv" target="_blank" rel="noopener">conditions générales de vente</a>.</span></label>' +
            '<p class="mpg-message err" id="mp-erreur" role="alert"></p>' +
            '<button type="submit" class="btn btn--principal mp-bouton-large" id="mp-valider">Valider la commande ' + FLECHE + '</button>' +
            '<p class="mp-petit">Vous paierez à l’étape suivante par Wave, Orange Money ou MTN Mobile Money. Délai de paiement : ' + (reglages.delai_paiement_heures || 24) + ' heures.</p>' +
          '</form>' +
          '<aside class="mp-recap">' +
            '<h2>Récapitulatif</h2>' +
            '<div class="mp-recap-lignes">' + lignes.map(l =>
              '<div class="mp-recap-ligne">' +
                '<span class="mp-ligne-visuel">' + (l.photo ? '<img src="' + echapperHtml(l.photo) + '" alt="">' : '') + '</span>' +
                '<span><span class="mp-ligne-nom">' + echapperHtml(l.nom) + '</span>' +
                  '<span class="mp-ligne-variante">' + echapperHtml([MP.univers(l.type || 'physique').nom.replace(/s$/, ''), l.variante].filter(Boolean).join(' · ')) + ' — × ' + l.quantite + '</span></span>' +
                '<span class="mp-ligne-prix">' + MP.formaterPrix(l.prix * l.quantite) + '</span>' +
              '</div>').join('') + '</div>' +
            '<div class="mp-recap-totaux">' +
              '<div><span>Sous-total</span><span>' + MP.formaterPrix(sousTotal) + '</span></div>' +
              (avecLivraison ? '<div><span>Livraison</span><span id="mp-frais">Selon la zone</span></div>' : '') +
              '<div class="mp-recap-total"><span>Total</span><b id="mp-total">' + MP.formaterPrix(sousTotal) + '</b></div>' +
            '</div>' +
            '<p class="mp-petit">Montants indicatifs : le total définitif est calculé à la validation.</p>' +
            '<a class="mp-retour" href="/marketplace/">← Continuer mes achats</a>' +
          '</aside>' +
        '</div>' +
      '</div>';

    const selectZone = document.getElementById('mp-zone');
    if (selectZone) selectZone.addEventListener('change', () => {
      const option = selectZone.selectedOptions[0];
      const offerte = reglages.livraison_offerte_des_fcfa != null && sousTotal >= reglages.livraison_offerte_des_fcfa;
      const frais = option && option.value ? (offerte ? 0 : +option.dataset.tarif) : null;
      document.getElementById('mp-frais').textContent = frais == null ? 'Selon la zone' : frais === 0 ? 'Offerte' : MP.formaterPrix(frais);
      document.getElementById('mp-total').textContent = MP.formaterPrix(sousTotal + (frais || 0));
    });

    const form = document.getElementById('mp-form-commande');
    const erreur = document.getElementById('mp-erreur');
    const valeur = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      erreur.textContent = '';
      const manque = [];
      if (!valeur('mp-civilite')) manque.push('votre civilité');
      if (valeur('mp-nom').length < 2) manque.push('votre nom');
      if (valeur('mp-tel').replace(/[^0-9]/g, '').length < 8) manque.push('votre téléphone');
      if (avecLivraison && (!valeur('mp-zone') || !valeur('mp-commune') || !valeur('mp-quartier'))) manque.push('la zone, la commune et le quartier de livraison');
      if (manque.length) { erreur.textContent = 'Indiquez ' + manque.join(', ') + '.'; return; }
      if (!document.getElementById('mp-cgv').checked) { erreur.textContent = MP.messageErreur('cgv_non_acceptees'); return; }
      const bouton = document.getElementById('mp-valider');
      bouton.disabled = true;
      bouton.textContent = 'Validation…';
      try {
        const { data, error } = await sbAdmin.rpc('boutique_passer_commande', {
          p_articles: MP.lirePanier().map(l => ({ variante_id: l.variante_id, quantite: l.quantite })),
          p_client: {
            nom: [valeur('mp-civilite'), valeur('mp-nom')].filter(Boolean).join(' '), telephone: valeur('mp-tel'), email: valeur('mp-email'),
            commune: valeur('mp-commune'), quartier: valeur('mp-quartier'), repere: valeur('mp-repere'), note: valeur('mp-note')
          },
          p_zone_id: avecLivraison ? valeur('mp-zone') || null : null,
          p_cgv_acceptees: true
        });
        if (error) throw error;
        const commande = Array.isArray(data) ? data[0] : data;
        if (!commande || !commande.numero) throw new Error('reponse_vide');
        MP.ecrirePanier([]);
        MP.memoriserCommande(commande.numero, commande.jeton_suivi);
        if (window.jouerSon) window.jouerSon('envoi');
        location.href = '/marketplace/suivi?n=' + encodeURIComponent(commande.numero) + '&j=' + encodeURIComponent(commande.jeton_suivi);
      } catch (err) {
        console.warn('Boutique : commande refusée', err);
        erreur.textContent = MP.messageErreur(err);
        bouton.disabled = false;
        bouton.innerHTML = 'Valider la commande ' + FLECHE;
      }
    });
  }
  void demarrer();
})();
