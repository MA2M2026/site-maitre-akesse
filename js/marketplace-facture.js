// ================== MARKETPLACE — facture (Boutique MA2M) ==================
// marketplace/facture.html?n=<numéro>&j=<code de suivi>
// Facture imprimable (ou enregistrable en PDF par le navigateur), émise quand
// l'agence a confirmé le paiement : numéro F-AAAA-NNNNN sans trou, attribué par la
// base. Identité du vendeur : Gestion → Réglages (Extension 99).
(function () {
  const principal = document.getElementById('mp-principal');
  const MOYENS = { wave: 'Wave', orange_money: 'Orange Money', mtn_momo: 'MTN Mobile Money' };

  function afficherFacture(c, admin) {
    const v = c.vendeur || {};
    const manque = texte => admin ? '<span class="mp-a-completer">[' + texte + ' — à compléter dans Gestion → Réglages]</span>' : '';
    const article = c.lignes.some(l => (l.type_produit || 'physique') === 'physique');
    document.title = 'Facture ' + c.numero_facture + ' — La Maison MA2M';
    principal.innerHTML =
      '<article class="mp-facture">' +
        '<header class="mp-facture-tete">' +
          '<div>' +
            '<img src="/assets/logo-header.png" alt="Maître Akesse Model Management" class="mp-facture-logo">' +
            '<p class="mp-facture-vendeur"><strong>' + echapperHtml(v.nom || 'Maître Akesse Model Management') + '</strong>' +
              (v.forme_juridique ? '<br>' + echapperHtml(v.forme_juridique) : '') +
              '<br>' + (v.adresse ? echapperHtml(v.adresse) : manque('adresse')) +
              '<br>RCCM : ' + (v.rccm ? echapperHtml(v.rccm) : manque('RCCM')) +
              '<br>N° compte contribuable : ' + (v.ncc ? echapperHtml(v.ncc) : manque('NCC')) +
              (v.telephone ? '<br>' + echapperHtml(v.telephone) : '') +
              (v.email ? '<br>' + echapperHtml(v.email) : '') + '</p>' +
          '</div>' +
          '<div class="mp-facture-titre">' +
            '<h1>Facture</h1>' +
            '<p><strong>N° ' + echapperHtml(c.numero_facture) + '</strong><br>Date : ' + MP.formaterDate(c.payee_le) + '<br>Commande : ' + echapperHtml(c.numero) + '<br>du ' + MP.formaterDate(c.created_at) + '</p>' +
          '</div>' +
        '</header>' +
        '<section class="mp-facture-client"><h2>Facturé à</h2><p><strong>' + echapperHtml(c.client_nom) + '</strong><br>' + echapperHtml(c.client_telephone || '') +
          (c.client_email ? '<br>' + echapperHtml(c.client_email) : '') +
          (article ? '<br>' + echapperHtml([c.adresse_quartier, c.adresse_commune].filter(Boolean).join(', ')) : '') + '</p></section>' +
        '<table class="mp-facture-table">' +
          '<thead><tr><th>Désignation</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead>' +
          '<tbody>' + c.lignes.map(l => '<tr><td>' + echapperHtml(l.nom_produit) + (l.libelle_variante ? '<br><small>' + echapperHtml(l.libelle_variante) + '</small>' : '') + '</td>' +
            '<td>' + l.quantite + '</td><td>' + MP.formaterPrix(l.prix_unitaire_fcfa) + '</td><td>' + MP.formaterPrix(l.total_fcfa) + '</td></tr>').join('') +
          (article ? '<tr><td>Livraison' + (c.zone_nom ? ' — ' + echapperHtml(c.zone_nom) : '') + '</td><td>1</td><td>' + MP.formaterPrix(c.frais_livraison_fcfa) + '</td><td>' + MP.formaterPrix(c.frais_livraison_fcfa) + '</td></tr>' : '') +
          '</tbody>' +
          '<tfoot><tr><td colspan="3">Total</td><td>' + MP.formaterPrix(c.total_fcfa) + '</td></tr></tfoot>' +
        '</table>' +
        '<p class="mp-facture-paiement">Payée le ' + MP.formaterDate(c.payee_le) + (c.moyen_paiement ? ' par ' + (MOYENS[c.moyen_paiement] || '') : '') +
          (c.reference_paiement ? ' — référence ' + echapperHtml(c.reference_paiement) : '') + '.</p>' +
        '<p class="mp-facture-mention">' + (v.mention_fiscale ? echapperHtml(v.mention_fiscale) : manque('mention fiscale : TVA / régime d’imposition, à confirmer avec le comptable')) + '</p>' +
        '<footer class="mp-facture-pied">La Maison MA2M — boutique de Maître Akesse Model Management · Abidjan, Côte d’Ivoire · Conditions générales de vente acceptées le ' + MP.formaterDate(c.cgv_acceptees_le) + '.</footer>' +
      '</article>';
  }

  async function demarrer() {
    const acces = await MP.acces;
    if (!MP.autorise(acces)) { MP.afficherIntrouvable(); return; }
    const params = new URLSearchParams(location.search);
    const numero = params.get('n');
    const jeton = params.get('j');
    const retour = document.getElementById('mp-facture-retour');
    if (numero && jeton) retour.href = '/marketplace/suivi?n=' + encodeURIComponent(numero) + '&j=' + encodeURIComponent(jeton);
    document.getElementById('mp-imprimer').addEventListener('click', () => window.print());
    try {
      if (!numero || !jeton) throw new Error('commande_introuvable');
      const { data, error } = await sbAdmin.rpc('boutique_suivi_commande', { p_numero: numero, p_jeton: jeton, p_telephone: null });
      if (error) throw error;
      if (!data.numero_facture) {
        principal.innerHTML = '<section class="mp-introuvable"><div><h1>Facture pas encore disponible</h1><p>La facture est émise dès que l’agence a confirmé votre paiement.</p></div></section>';
        document.getElementById('mp-imprimer').classList.add('mp-cache');
        return;
      }
      afficherFacture(data, acces.admin);
    } catch (err) {
      principal.innerHTML = '<section class="mp-introuvable"><div><h1>Facture introuvable</h1><p>' + echapperHtml(MP.messageErreur(err)) + '</p></div></section>';
      document.getElementById('mp-imprimer').classList.add('mp-cache');
    }
  }
  void demarrer();
})();
