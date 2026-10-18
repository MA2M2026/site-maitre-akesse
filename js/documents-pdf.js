// Reçus de paiement (REC-AAAA-NNNNN) et documents commerciaux (devis, proforma, facture,
// avoir) en PDF, fabriqués dans le navigateur avec jsPDF (js/vendor/jspdf-4.2.1.umd.min.js).
// Partagé par le portail d'administration et l'espace du mannequin (« Mes paiements »).
// Couleurs : rouge et encre de la charte (css/jetons.css), recopiées ici car jsPDF ne lit
// pas les variables CSS.
(function () {
  'use strict';
  const ROUGE = [200, 16, 46], ENCRE = [30, 29, 28], DOUX = [94, 91, 87];
  const fcfa = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
  const dateFr = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Africa/Abidjan' }) : '';
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const UNITES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  // montant en lettres (exigé sur les factures)
  function centaines(n) {
    const c = Math.floor(n / 100), r = n % 100;
    let t = c ? (c > 1 ? UNITES[c] + ' cent' + (r ? '' : 's') : 'cent') : '';
    if (r) {
      let m;
      if (r < 20) m = UNITES[r];
      else {
        const d = Math.floor(r / 10), u = r % 10, base = (d === 7 || d === 9) ? 10 + u : u;
        m = DIZAINES[d] + (base === 1 && d !== 8 ? ' et un' : base === 11 && d === 7 ? ' et onze' : base ? '-' + UNITES[base] : (d === 8 ? 's' : ''));
      }
      t += (t ? ' ' : '') + m;
    }
    return t;
  }
  function enLettres(n) {
    n = Math.round(n);
    if (n === 0) return 'zéro';
    const parts = [];
    const mil = Math.floor(n / 1e6), k = Math.floor((n % 1e6) / 1000), r = n % 1000;
    if (mil) parts.push(centaines(mil) + ' million' + (mil > 1 ? 's' : ''));
    // « quatre-vingt mille », « deux cent mille » : pas de s devant mille
    if (k) parts.push(k === 1 ? 'mille' : centaines(k).replace(/(vingt|cent)s$/, '$1') + ' mille');
    if (r) parts.push(centaines(r));
    return parts.join(' ');
  }
  function nouveau() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFillColor(...ENCRE); doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('M A 2 M', 15, 15);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text('MAÎTRE AKESSE MODEL MANAGEMENT · ABIDJAN', 15, 21);
    doc.setFillColor(...ROUGE); doc.rect(0, 28, 210, 1.5, 'F');
    doc.setTextColor(...ENCRE);
    return doc;
  }
  function pied(doc, mention) {
    doc.setFontSize(8); doc.setTextColor(...DOUX);
    if (mention) { doc.setTextColor(...ROUGE); doc.text(mention, 15, 280); doc.setTextColor(...DOUX); }
    doc.text('www.maitreakessemodelmanagement.com', 15, 287);
  }

  window.MA2M_RECU = function (p) {
    const e = p.echeance || {}, m = e.mannequin || {}, recu = p.recu || {};
    const doc = nouveau();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text('Reçu de paiement', 15, 45);
    doc.setFontSize(11); doc.setTextColor(...ROUGE); doc.text(recu.numero || '', 15, 53); doc.setTextColor(...ENCRE);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    const mois = e.mois ? MOIS[Number(String(e.mois).slice(5, 7)) - 1] + ' ' + String(e.mois).slice(0, 4) : '';
    const lignes = [
      ['Date', dateFr(recu.emis_le || p.valide_le)],
      ['Reçu de', (m.nom || '') + (p.paye_par ? ' (payé par ' + p.paye_par + ')' : '')],
      ['Objet', e.type === 'inscription' ? 'Droit d’inscription et 1er mois de formation' : 'Droit de formation de ' + mois],
      ['Mode de paiement', { wave: 'Wave', especes: 'Espèces', virement: 'Virement', orange: 'Orange Money', mtn: 'MTN Money', moov: 'Moov Money' }[p.mode] || p.mode || ''],
      ['Montant reçu', fcfa(p.montant)],
      ['En lettres', enLettres(p.montant) + ' francs CFA']
    ];
    let y = 70;
    lignes.forEach(([k, v]) => { doc.setTextColor(...DOUX); doc.text(k, 15, y); doc.setTextColor(...ENCRE); doc.text(doc.splitTextToSize(String(v), 120), 70, y); y += 10; });
    if (p.id_transaction) { doc.setTextColor(...DOUX); doc.text('Transaction', 15, y); doc.setTextColor(...ENCRE); doc.text(String(p.id_transaction), 70, y); }
    pied(doc, 'Reçu interne de l’agence (document non fiscal tant que la facturation normalisée n’est pas activée).');
    doc.save((recu.numero || 'recu') + '.pdf');
  };

  window.MA2M_DOCUMENT = function (d, entite) {
    const TITRES = { devis: 'Devis', proforma: 'Facture proforma', facture: 'Facture', avoir: 'Avoir' };
    const doc = nouveau();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text(TITRES[d.type] || 'Document', 15, 45);
    doc.setFontSize(11); doc.setTextColor(...ROUGE); doc.text(d.numero || 'Brouillon', 15, 53); doc.setTextColor(...ENCRE);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text('Date : ' + dateFr(d.date_emission), 140, 45);
    if (d.echeance) doc.text('Échéance : ' + dateFr(d.echeance), 140, 51);
    if (entite && entite.mode_legal) {
      doc.setFontSize(8); doc.setTextColor(...DOUX);
      doc.text([entite.raison_sociale || '', 'RCCM ' + (entite.rccm || ''), 'NCC ' + (entite.ncc || '')], 15, 60);
      doc.setTextColor(...ENCRE); doc.setFontSize(10);
    }
    doc.setFont('helvetica', 'bold'); doc.text('Client', 140, 62); doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize((d.client && d.client.nom) || '', 55), 140, 68);
    let y = 85;
    doc.setFillColor(...ENCRE); doc.rect(15, y - 6, 180, 9, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
    doc.text('Désignation', 18, y); doc.text('Qté', 120, y); doc.text('Prix unitaire', 135, y); doc.text('Total', 175, y);
    doc.setTextColor(...ENCRE); doc.setFont('helvetica', 'normal'); y += 10;
    (d.lignes || []).slice().sort((a, b) => a.ordre - b.ordre).forEach((l) => {
      const total = Math.round(l.quantite * l.prix_unitaire) - (l.remise || 0);
      const des = doc.splitTextToSize(l.designation, 95);
      doc.text(des, 18, y); doc.text(String(l.quantite), 120, y); doc.text(fcfa(l.prix_unitaire), 135, y); doc.text(fcfa(total), 175, y);
      y += 7 * des.length + 2; doc.setDrawColor(221, 218, 213); doc.line(15, y - 5, 195, y - 5);
    });
    y += 4;
    doc.text('Total hors taxes', 120, y); doc.text(fcfa(d.total_ht), 175, y); y += 7;
    if (d.total_tva) { doc.text('TVA', 120, y); doc.text(fcfa(d.total_tva), 175, y); y += 7; }
    doc.setFont('helvetica', 'bold'); doc.text('Total', 120, y); doc.text(fcfa(d.total_ttc), 175, y); doc.setFont('helvetica', 'normal'); y += 10;
    doc.setFontSize(9); doc.text(doc.splitTextToSize('Arrêté à la somme de ' + enLettres(d.total_ttc) + ' francs CFA.', 180), 15, y); y += 10;
    if (d.conditions) doc.text(doc.splitTextToSize('Conditions : ' + d.conditions, 180), 15, y);
    pied(doc, d.mention || '');
    doc.save((d.numero || 'document') + '.pdf');
  };
  window.MA2M_EN_LETTRES = enLettres;
})();
