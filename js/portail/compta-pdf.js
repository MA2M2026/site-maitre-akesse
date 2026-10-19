// PDF de la comptabilité (espace 3) : documents (devis, proformas, factures, avoirs, reçus) et
// « Dossier du mois » (résumé + justificatifs). Fabriqués dans le navigateur avec pdf-lib
// (copie locale js/vendor/pdf-lib-1.17.1.min.js, chargée seulement au premier PDF).
// P.comptaPdf.mise() donne une page A4 avec un curseur : titres, paragraphes, tableaux, sauts
// de page automatiques ; les polices standard du PDF n'ont que l'alphabet latin : texte()
// remplace les rares caractères impossibles.
(function () {
  'use strict';
  const P = window.Portail;
  const A4 = [595.28, 841.89], MARGE = 46;
  let chargement = null;
  function charger() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    if (!chargement) {
      chargement = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = '/js/vendor/pdf-lib-1.17.1.min.js';
        s.onload = () => resolve(window.PDFLib);
        s.onerror = () => { chargement = null; reject(new Error('Outil PDF indisponible. Vérifiez la connexion puis réessayez.')); };
        document.head.appendChild(s);
      });
    }
    return chargement;
  }
  // Caractères de la police standard (WinAnsi) : latin, accents, guillemets, tirets, euro…
  const EN_PLUS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  const texte = (s) => String(s == null ? '' : s).replace(/[   ]/g, ' ').replace(/→/g, '->').replace(/[−‐‑]/g, '-').replace(/⇄/g, '<>').replace(/[^\n\x20-\x7e\xa0-\xff]/g, (c) => (EN_PLUS.indexOf(c) !== -1 ? c : '?'));

  // Mise en page : curseur y descendant, nouvelle page quand il manque de la place
  async function mise() {
    const L = await charger();
    const doc = await L.PDFDocument.create();
    const police = await doc.embedFont(L.StandardFonts.Helvetica), gras = await doc.embedFont(L.StandardFonts.HelveticaBold);
    const gris = L.rgb(0.37, 0.36, 0.34), noir = L.rgb(0.1, 0.1, 0.1), rouge = L.rgb(0.62, 0.07, 0.11);
    const m = { L, doc, police, gras, gris, noir, rouge, largeur: A4[0] - 2 * MARGE, page: null, y: 0 };
    m.nouvellePage = () => { m.page = doc.addPage(A4); m.y = A4[1] - MARGE; };
    m.place = (h) => { if (!m.page || m.y - h < MARGE + 20) m.nouvellePage(); };
    // découpe en lignes tenant dans la largeur
    m.couper = (t, taille, f, largeur) => {
      const lignes = [];
      texte(t).split('\n').forEach((para) => {
        let cur = '';
        para.split(' ').forEach((mot) => {
          const essai = cur ? cur + ' ' + mot : mot;
          if (f.widthOfTextAtSize(essai, taille) <= largeur || !cur) cur = essai; else { lignes.push(cur); cur = mot; }
        });
        lignes.push(cur);
      });
      return lignes;
    };
    m.ecrire = (t, o) => {
      o = o || {};
      const taille = o.taille || 10, f = o.gras ? gras : police, largeur = o.largeur || m.largeur, x = o.x != null ? o.x : MARGE;
      m.couper(t, taille, f, largeur).forEach((l) => {
        m.place(taille + 4);
        const dx = o.droite ? largeur - f.widthOfTextAtSize(l, taille) : 0;
        m.page.drawText(l, { x: x + dx, y: m.y - taille, size: taille, font: f, color: o.couleur || noir });
        m.y -= taille + 4;
      });
    };
    m.espace = (h) => { m.y -= h; };
    m.titre = (t, taille) => { m.place(90); m.espace(6); m.ecrire(t, { taille: taille || 14, gras: true, couleur: rouge }); m.espace(4); };
    m.trait = () => { m.place(8); m.page.drawLine({ start: { x: MARGE, y: m.y }, end: { x: A4[0] - MARGE, y: m.y }, thickness: 0.6, color: gris }); m.espace(8); };
    // Tableau : colonnes [{ titre, part (proportion de la largeur), droite }], lignes de textes
    m.tableau = (colonnes, lignes, o) => {
      o = o || {};
      const taille = o.taille || 9, total = colonnes.reduce((s, c) => s + c.part, 0);
      const larg = colonnes.map((c) => c.part / total * m.largeur);
      const rangee = (cellules, f, fond) => {
        const coupees = cellules.map((c, i) => m.couper(c, taille, f, larg[i] - 6));
        const h = Math.max.apply(null, coupees.map((c) => c.length)) * (taille + 3) + 6;
        m.place(fond ? h + 2 * (taille + 9) : h);  // (l'en-tête ne reste jamais seul en bas de page)
        if (fond) m.page.drawRectangle({ x: MARGE, y: m.y - h, width: m.largeur, height: h, color: L.rgb(0.93, 0.92, 0.9) });
        let x = MARGE;
        coupees.forEach((c, i) => {
          c.forEach((l, k) => {
            const dx = colonnes[i].droite ? larg[i] - 3 - f.widthOfTextAtSize(l, taille) : 3;
            m.page.drawText(l, { x: x + dx, y: m.y - 3 - (k + 1) * (taille + 3) + 3, size: taille, font: f, color: noir });
          });
          x += larg[i];
        });
        m.y -= h;
        m.page.drawLine({ start: { x: MARGE, y: m.y }, end: { x: A4[0] - MARGE, y: m.y }, thickness: 0.3, color: gris });
      };
      rangee(colonnes.map((c) => c.titre), gras, true);
      if (!lignes.length) rangee(colonnes.map((c, i) => (i ? '' : 'Rien.')), police);
      lignes.forEach((l) => rangee(l.map((v) => String(v == null ? '' : v)), l.gras ? gras : police));
      m.espace(8);
    };
    // pied de page sur chaque page : numéro et mention
    m.finir = async (mention) => {
      const pages = doc.getPages();
      pages.forEach((pg, i) => {
        const t = texte((mention ? mention + '   ·   ' : '') + 'Page ' + (i + 1) + ' sur ' + pages.length);
        pg.drawText(t, { x: MARGE, y: 24, size: 7.5, font: police, color: gris });
      });
      return doc.save();
    };
    return m;
  }

  const TITRES = { devis: 'DEVIS', proforma: 'FACTURE PROFORMA', facture: 'FACTURE', avoir: 'AVOIR', recu: 'REÇU' };
  // En-tête de l'agence : identité commerciale, et identité légale une fois le mode légal activé
  function entete(m, r, fiscal) {
    m.nouvellePage();
    m.ecrire(fiscal && r.raison_sociale ? r.raison_sociale : r.nom_commercial || 'Maître Akesse Model Management', { taille: 15, gras: true });
    const lignes = [r.adresse, [r.telephone, r.email].filter(Boolean).join(' · ')];
    if (fiscal) lignes.push([r.forme_juridique, r.rccm && 'RCCM ' + r.rccm, r.ncc && 'NCC ' + r.ncc, r.regime_fiscal].filter(Boolean).join(' · '));
    lignes.filter(Boolean).forEach((l) => m.ecrire(l, { taille: 9, couleur: m.gris }));
    m.espace(6); m.trait();
  }
  // PDF d'un document numéroté (doc : ligne de compta_documents ; origine : numéro du document corrigé)
  async function documentPdf(d, r, origine) {
    const m = await mise();
    entete(m, r, d.fiscal);
    m.ecrire(TITRES[d.type] + ' N° ' + d.numero, { taille: 16, gras: true, couleur: m.rouge });
    m.ecrire('Date : ' + P.date(d.date_doc) + (d.validite ? '   ·   Valable jusqu’au ' + P.date(d.validite) : ''), { taille: 10 });
    if (origine) m.ecrire((d.type === 'avoir' ? 'Corrige la facture N° ' : d.type === 'recu' ? 'Pour la facture N° ' : 'Suite au document N° ') + origine, { taille: 10 });
    if (d.fne_reference) m.ecrire('Référence FNE : ' + d.fne_reference, { taille: 10 });
    if (d.annule) m.ecrire('DOCUMENT ANNULÉ — ' + (d.motif_annulation || ''), { taille: 11, gras: true, couleur: m.rouge });
    m.espace(8);
    const dest = d.destinataire || {};
    m.ecrire(d.type === 'recu' ? 'Reçu de :' : 'Destinataire :', { taille: 9, couleur: m.gris });
    m.ecrire(dest.nom || '', { taille: 11, gras: true });
    [dest.telephone, dest.email].filter(Boolean).forEach((l) => m.ecrire(l, { taille: 9 }));
    m.espace(10);
    m.tableau([{ titre: 'Désignation', part: 6 }, { titre: 'Quantité', part: 1.3, droite: true }, { titre: 'Prix unitaire', part: 2, droite: true }, { titre: 'Montant', part: 2, droite: true }],
      (d.lignes || []).map((l) => [l.designation, String(l.quantite).replace('.', ','), P.fcfa(l.prix), P.fcfa(Math.round(l.quantite * l.prix))]));
    const totaux = d.tva ? [['Total hors taxes', P.fcfa(d.total_ht)], ['TVA ' + String(d.tva_taux).replace('.', ',') + ' %', P.fcfa(d.tva)], [d.type === 'recu' ? 'Montant reçu' : 'Total TTC', P.fcfa(d.total_ttc)]]
      : [[d.type === 'recu' ? 'Montant reçu' : 'Total', P.fcfa(d.total_ttc)]];
    totaux.forEach((t, i) => m.ecrire(t[0] + ' : ' + t[1], { taille: i === totaux.length - 1 ? 12 : 10, gras: i === totaux.length - 1, droite: true }));
    if (d.notes) { m.espace(10); m.ecrire(d.notes, { taille: 9 }); }
    if (!d.fiscal) { m.espace(14); m.ecrire('Document non fiscal — l’agence n’est pas encore immatriculée : ce document ne vaut pas facture au sens fiscal.', { taille: 9, gras: true, couleur: m.rouge }); }
    if (r.pied_de_page) { m.espace(8); m.ecrire(r.pied_de_page, { taille: 8, couleur: m.gris }); }
    return m.finir(d.numero + (d.fiscal ? '' : ' · non fiscal'));
  }

  P.comptaPdf = { charger, texte, mise, entete, documentPdf };
})();
