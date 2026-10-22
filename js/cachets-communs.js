// Cachets des mannequins : ce qui sert à plusieurs pages (22/10/2026), sans recopier le code —
// l'Administration (« Payer les mannequins », js/portail/espace-compta-cachets.js), la page du reçu
// (recu.html, js/recu.js) et l'Espace mannequin (« Mes cachets »).
// Base : cachets_mannequins.motif, numero_recu, jeton (supabase-cachets-recus.sql).
(function () {
  'use strict';
  var MOTIFS = [['defile', 'Défilé'], ['shooting', 'Shooting photo'], ['campagne', 'Campagne publicitaire'], ['video', 'Tournage vidéo'],
    ['evenement', 'Événement / hôtesse'], ['casting', 'Casting rémunéré'], ['autre', 'Autre']];
  var libelle = function (motif) { var m = MOTIFS.filter(function (x) { return x[0] === motif; })[0]; return m ? m[1] : ''; };
  var SITE = 'https://www.maitreakessemodelmanagement.com';
  var fcfa = function (n) { return Number(n || 0).toLocaleString('fr-FR').replace(/ /g, ' ') + ' FCFA'; };
  var jour = function (iso) { return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' }) : ''; };
  window.CachetsMa2m = {
    MOTIFS: MOTIFS,
    libelle: libelle,
    fcfa: fcfa,
    jour: jour,
    // lien personnel du reçu (la page ne montre qu'un cachet payé)
    lienRecu: function (jeton) { return SITE + '/recu?r=' + encodeURIComponent(jeton); },
    // message WhatsApp du reçu (c : cachet payé, avec numero_recu, montant, motif, prestation…)
    texteRecu: function (c) {
      var quoi = c.prestation || libelle(c.motif);  // (la prestation commence par le motif)
      return 'Bonjour ' + c.beneficiaire + ',\n\nMaître Akesse Model Management vous confirme le paiement de votre cachet. Merci pour votre travail !\n\n' +
        '🧾 Reçu n° ' + (c.numero_recu || '—') + '\n📅 Payé le ' + jour(c.paye_le) + '\n🎬 ' + quoi + '\n💰 Montant reçu : ' + fcfa(c.montant) +
        (c.reference_wave ? '\n🔖 Référence Wave : ' + c.reference_wave : '') +
        '\n\nVotre reçu (à garder ou enregistrer en PDF) :\n' + window.CachetsMa2m.lienRecu(c.jeton);
    }
  };
})();
