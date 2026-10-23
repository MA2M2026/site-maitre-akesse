// Espace 3 — « Rapport des cachets » (23/10/2026, demande de la propriétaire) : les cachets PAYÉS
// d'un mois (ou d'une année), avec le total des prestations, la commission de l'agence et le total
// versé aux mannequins ; le détail par personne (photo, nom) et cachet par cachet ; en PDF et en
// Excel pour le comptable. Lecture seule : rien n'est modifié. Mention « non fiscal » tant que
// l'agence n'est pas en mode légal.
// Outils communs : P.compta (js/portail/espace-compta.js), P.comptaPdf (js/portail/compta-pdf.js),
// P.xlsx (js/portail/compta-xlsx.js), window.CachetsMa2m (js/cachets-communs.js).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.compta || !P.espaces.compta) return;
  const K = window.CachetsMa2m;
  let choix = P.moisCourant().slice(0, 7);  // 'AAAA-MM' ou 'AAAA' (toute l'année)
  let dernier = null;  // dernier rapport affiché (pour le PDF et l'Excel)

  // bornes de la période, à l'heure d'Abidjan (= UTC)
  function periode(c) {
    if (/^\d{4}$/.test(c)) return { debut: c + '-01-01T00:00:00Z', fin: (Number(c) + 1) + '-01-01T00:00:00Z', titre: 'année ' + c };
    const [a, m] = c.split('-').map(Number), suivant = m === 12 ? (a + 1) + '-01' : a + '-' + String(m + 1).padStart(2, '0');
    return { debut: c + '-01T00:00:00Z', fin: suivant + '-01T00:00:00Z', titre: P.mois(c + '-01') };
  }
  // les 12 derniers mois et les 2 dernières années
  function choixPossibles() {
    const l = [], d = new Date(P.moisCourant() + 'T00:00:00Z');
    for (let i = 0; i < 12; i++) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)); l.push([x.toISOString().slice(0, 7), P.mois(x.toISOString())]); }
    const an = d.getUTCFullYear();
    l.push([String(an), 'Toute l’année ' + an], [String(an - 1), 'Toute l’année ' + (an - 1)]);
    return l;
  }
  // chiffres d'un cachet : prestation, commission, versé (anciens cachets sans commission : versé = prestation)
  const chiffres = (c) => ({ prestation: Number(c.montant_prestation || c.montant) || 0, commission: Number(c.commission) || 0, verse: Number(c.montant) || 0 });
  const motif = (c) => (K && c.motif ? K.libelle(c.motif) : '') || String(c.prestation || '').split(' · ')[0];

  function calculer(liste) {
    const total = { nb: liste.length, prestation: 0, commission: 0, verse: 0 }, parPersonne = {};
    liste.forEach((c) => {
      const x = chiffres(c), cle = c.agence_mannequin_id || 'nom:' + String(c.beneficiaire).trim().toLowerCase();
      const p = parPersonne[cle] = parPersonne[cle] || { id: c.agence_mannequin_id, nom: c.beneficiaire, nb: 0, prestation: 0, commission: 0, verse: 0 };
      p.nb++;
      ['prestation', 'commission', 'verse'].forEach((k) => { p[k] += x[k]; total[k] += x[k]; });
    });
    return { total, personnes: Object.values(parPersonne).sort((a, b) => b.verse - a.verse || String(a.nom).localeCompare(String(b.nom), 'fr')) };
  }

  async function page() {
    const per = periode(choix);
    let liste, reglage;
    try {
      [liste, reglage] = await Promise.all([
        // (toutes les lignes, par pages : la base en renvoie au plus 1 000 à la fois)
        lireToutesLignes(() => sb.from('cachets_mannequins').select('*').eq('statut', 'paye').gte('paye_le', per.debut).lt('paye_le', per.fin).order('paye_le').order('id')).then((r) => { if (r.error) throw r.error; return r.data || []; }),
        P.bd(sb.from('compta_reglages').select('*').eq('id', 1).maybeSingle()).catch(() => null)
      ]);
    } catch (e) {
      if (P.compta.cachetsAbsents(e)) return P.entete('Rapport des cachets') + '<div class="note info">« Payer les mannequins » n’est pas encore activé.</div>';
      throw e;
    }
    const { total, personnes } = calculer(liste), F = P.fcfa;
    dernier = { per, liste, total, personnes, reglage: reglage || {} };
    const nom = (x) => P.compta.nomMannequin(x.id, x.nom);  // photo et lien vers la fiche
    const selecteur = '<label class="fl" for="rc-periode">Période<select id="rc-periode" data-change="rapport-cachets-periode">' +
      choixPossibles().map((o) => '<option value="' + o[0] + '"' + (o[0] === choix ? ' selected' : '') + '>' + P.esc(o[1]) + '</option>').join('') + '</select></label>';
    return P.entete('Rapport des cachets', '<button class="btn" type="button" data-action="rapport-cachets-pdf"' + (liste.length ? '' : ' disabled') + '>⬇ PDF</button>' +
        '<button class="btn" type="button" data-action="rapport-cachets-excel"' + (liste.length ? '' : ' disabled') + '>⬇ Excel</button>') +
      '<div class="carte f">' + selecteur + '</div>' +
      '<div class="chiffres">' + P.chiffre('Cachets payés', String(total.nb)) + P.chiffre('Montant des prestations', F(total.prestation)) +
        P.chiffre('Commission de l’agence', F(total.commission), 'ok') + P.chiffre('Versé aux mannequins', F(total.verse)) + '</div>' +
      '<section class="carte"><h2>Par mannequin · ' + P.esc(per.titre) + '</h2>' + (personnes.length
        ? P.tableau(['Mannequin', '#Cachets', '#Prestations', '#Commission', '#Versé'], personnes.map((x) => '<tr><td>' + nom(x) + '</td><td class="nombre">' + x.nb + '</td><td class="nombre">' + F(x.prestation) + '</td><td class="nombre">' + F(x.commission) + '</td><td class="nombre">' + F(x.verse) + '</td></tr>'))
        : '<p class="doux">Aucun cachet payé sur cette période.</p>') + '</section>' +
      (liste.length ? '<section class="carte"><h2>Détail des cachets</h2>' + P.tableau(['Payé le', 'Reçu', 'Mannequin', 'Motif', '#Prestation', '#Commission', '#Versé'], liste.map((c) => {
        const x = chiffres(c);
        return '<tr><td>' + P.date(c.paye_le) + '</td><td>' + P.esc(c.numero_recu || '—') + '</td><td>' + nom({ id: c.agence_mannequin_id, nom: c.beneficiaire }) + '</td>' +
          '<td>' + P.esc(motif(c)) + (c.parent_nom ? '<div class="petit-texte doux">versé au parent : ' + P.esc(c.parent_nom) + '</div>' : '') + '</td><td class="nombre">' + F(x.prestation) + '</td><td class="nombre">' + F(x.commission) + '</td><td class="nombre">' + F(x.verse) + '</td></tr>';
      })) + '</section>' : '');
  }

  P.changements['rapport-cachets-periode'] = (el) => { choix = el.value; return P.afficher(); };
  const nomFichier = (ext) => 'rapport-cachets-' + choix + '.' + ext;
  P.actions['rapport-cachets-excel'] = () => {
    if (!dernier) return;
    const d = dernier;
    P.telecharger(P.xlsx([
      { nom: 'Par mannequin', largeurs: [32, 10, 16, 16, 16], lignes: [['Mannequin', 'Cachets', 'Prestations (FCFA)', 'Commission (FCFA)', 'Versé (FCFA)']]
        .concat(d.personnes.map((x) => [x.nom, x.nb, x.prestation, x.commission, x.verse]))
        .concat([['TOTAL ' + d.per.titre, d.total.nb, d.total.prestation, d.total.commission, d.total.verse]]) },
      { nom: 'Détail', largeurs: [12, 20, 30, 24, 40, 16, 16, 16, 16, 28], lignes: [['Payé le', 'Reçu', 'Mannequin', 'Motif', 'Prestation', 'Prestation (FCFA)', 'Commission (FCFA)', 'Versé (FCFA)', 'Réf. Wave', 'Versé au parent']]
        .concat(d.liste.map((c) => { const x = chiffres(c); return [P.date(c.paye_le), c.numero_recu || '', c.beneficiaire, motif(c), c.prestation || '', x.prestation, x.commission, x.verse, c.reference_wave || '', c.parent_nom || '']; })) }
    ]), nomFichier('xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };
  P.actions['rapport-cachets-pdf'] = async () => {
    if (!dernier) return;
    const d = dernier, F = P.fcfa, m = await P.comptaPdf.mise(), legal = !!d.reglage.mode_legal;
    P.comptaPdf.entete(m, d.reglage, legal);
    m.ecrire('Rapport des cachets versés aux mannequins — ' + d.per.titre, { taille: 16, gras: true, couleur: m.rouge });
    m.ecrire('Préparé le ' + P.dateHeure(new Date().toISOString()) + (legal ? '' : ' · document non fiscal (agence pas encore immatriculée)'), { taille: 9, couleur: m.gris });
    m.titre('1. Totaux', 12);
    m.tableau([{ titre: 'Rubrique', part: 3 }, { titre: 'Montant', part: 1.4, droite: true }], [['Cachets payés', String(d.total.nb)], ['Montant des prestations', F(d.total.prestation)],
      ['Commission de l’agence (recette)', F(d.total.commission)], Object.assign(['Versé aux mannequins (dépense)', F(d.total.verse)], { gras: true })]);
    m.titre('2. Par mannequin', 12);
    m.tableau([{ titre: 'Mannequin', part: 3 }, { titre: 'Cachets', part: 0.8, droite: true }, { titre: 'Prestations', part: 1.4, droite: true }, { titre: 'Commission', part: 1.4, droite: true }, { titre: 'Versé', part: 1.4, droite: true }],
      d.personnes.map((x) => [x.nom, String(x.nb), F(x.prestation), F(x.commission), F(x.verse)]));
    m.titre('3. Détail des cachets', 12);
    m.tableau([{ titre: 'Payé le', part: 1 }, { titre: 'Reçu', part: 1.7 }, { titre: 'Mannequin', part: 2.2 }, { titre: 'Motif', part: 1.5 }, { titre: 'Prestation', part: 1.3, droite: true }, { titre: 'Commission', part: 1.3, droite: true }, { titre: 'Versé', part: 1.3, droite: true }],
      d.liste.map((c) => { const x = chiffres(c); return [P.date(c.paye_le), c.numero_recu || '—', c.beneficiaire + (c.parent_nom ? ' (versé au parent : ' + c.parent_nom + ')' : ''), motif(c), F(x.prestation), F(x.commission), F(x.verse)]; }), { taille: 8 });
    P.telecharger(await m.finir('Maître Akesse Model Management · rapport des cachets · ' + d.per.titre), nomFichier('pdf'), 'application/pdf');
  };

  P.espaces.compta.pages['cachets-rapport'] = page;
  P.espaces.compta.nav.push(['cachets-rapport', 'Rapport des cachets']);  // (rangé par js/portail/espace-compta-dossier.js)
})();
