// Cachets des mannequins : ce qui sert à plusieurs pages (22/10/2026), sans recopier le code —
// l'Administration (« Payer les mannequins », js/portail/espace-compta-cachets.js), la page du reçu
// (recu.html, js/recu.js) et l'Espace mannequin (« Mes cachets »).
// Base : cachets_mannequins.motif, numero_recu, jeton (supabase-cachets-recus.sql).
// (01/11/2026 : aussi importé par middleware.js, qui écrit le reçu dans la page : window, ou globalThis côté serveur)
(function (racine) {
  'use strict';
  var MOTIFS = [['defile', 'Défilé'], ['shooting', 'Shooting photo'], ['campagne', 'Campagne publicitaire'], ['video', 'Tournage vidéo'],
    ['evenement', 'Événement / hôtesse'], ['casting', 'Casting rémunéré'], ['autre', 'Autre']];
  var libelle = function (motif) { var m = MOTIFS.filter(function (x) { return x[0] === motif; })[0]; return m ? m[1] : ''; };
  var SITE = 'https://www.maitreakessemodelmanagement.com';
  // (même format que « Mes paiements », qui s'en sert aussi)
  var fcfa = function (n) { return (Math.round(Number(n) || 0) || 0).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ') + ' FCFA'; };
  var jour = function (iso) { return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' }) : ''; };
  // Reçu officiel (13/11/2026) : les lignes de ses trois blocs, UNE fois pour la page (js/recu.js) et le serveur qui l'écrit
  // d'avance (middleware.js). c : ligne de cachet_recu_lire. Chaque ligne : [intitulé, valeur, classe] ; valeur vide = pas de ligne.
  var heure = function (h) { return h ? String(h).slice(0, 5).replace(':', ' h ') : ''; };
  var jourSeul = function (d) { return d ? new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' }) : ''; };
  function lignesRecu(c) {
    var M = racine.MoyensPaiement, plein = function (l) { return l.filter(function (x) { return x[1] !== null && x[1] !== undefined && x[1] !== ''; }); };
    var frais = (Array.isArray(c.frais) ? c.frais : []).filter(function (x) { return x && x.libelle; });
    var totalFrais = frais.reduce(function (n, x) { return n + (Number(x.montant) || 0); }, 0), impots = Number(c.impots) || 0;
    var detail = [];
    if (c.montant_prestation) {
      detail.push(['Cachet total de la prestation', fcfa(c.montant_prestation)]);
      if (c.commission) detail.push(['Commission de l’agence' + (c.commission_taux ? ' (' + String(Number(c.commission_taux)).replace('.', ',') + ' %)' : ''), '− ' + fcfa(c.commission), 'retenue']);
    } else if (impots > 0 || totalFrais > 0) detail.push(['Cachet', fcfa(Number(c.montant) + impots + totalFrais)]);  // (sans commission : le calcul se raccorde au net)
    if (impots > 0) detail.push(['Impôts retenus', '− ' + fcfa(impots), 'retenue']);
    frais.forEach(function (x) { detail.push(['Frais : ' + x.libelle, '− ' + fcfa(x.montant), 'retenue']); });
    return {
      prestation: plein([['Mannequin', c.beneficiaire], ['Versé au parent', c.parent_nom], ['Prestation', c.prestation || libelle(c.motif)], ['Date', jourSeul(c.date_prestation)],
        ['Horaires', c.heure_debut ? 'de ' + heure(c.heure_debut) + (c.heure_fin ? ' à ' + heure(c.heure_fin) : '') : ''], ['Lieu', c.lieu], ['Partenaire', c.partenaire],
        ['Pour le compte de', 'Maître Akesse Model Management']]),
      detail: detail,
      paiement: plein([['Payé le', jour(c.paye_le)], ['Moyen de paiement', M ? M.nom(c.moyen || 'wave') : 'Wave'], ['Référence', c.reference_wave]])
    };
  }
  racine.CachetsMa2m = {
    lignesRecu: lignesRecu,
    MOTIFS: MOTIFS,
    libelle: libelle,
    fcfa: fcfa,
    jour: jour,
    // lien personnel du reçu (la page ne montre qu'un cachet payé)
    lienRecu: function (jeton) { return SITE + '/recu?r=' + encodeURIComponent(jeton); },
    // message WhatsApp du reçu (c : cachet payé, avec numero_recu, montant, motif, prestation… ;
    // parent : nom du parent quand la mannequin est mineure — le message lui est adressé)
    texteRecu: function (c, parent) {
      var quoi = c.prestation || libelle(c.motif);  // (la prestation commence par le motif)
      return 'Bonjour ' + (parent || c.beneficiaire) + ',\n\nMaître Akesse Model Management vous confirme le paiement ' + (parent ? 'du cachet de ' + c.beneficiaire + '. Merci pour son travail !' : 'de votre cachet. Merci pour votre travail !') + '\n\n' +
        '🧾 Reçu n° ' + (c.numero_recu || '—') + '\n📅 Payé le ' + jour(c.paye_le) + '\n🎬 ' + quoi + '\n💰 Montant reçu : ' + fcfa(c.montant) +
        // (13/11/2026) moyen utilisé, et le lieu de la prestation quand il est connu
        (c.lieu ? '\n📍 ' + c.lieu : '') +
        (c.moyen && racine.MoyensPaiement ? '\n💳 Payé par ' + racine.MoyensPaiement.nom(c.moyen) : '') +
        (c.reference_wave ? '\n🔖 Référence : ' + c.reference_wave : '') +
        '\n\nVotre reçu (à garder ou enregistrer en PDF) :\n' + racine.CachetsMa2m.lienRecu(c.jeton);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
