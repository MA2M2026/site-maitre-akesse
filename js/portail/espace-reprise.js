// Reprise du 1er mars 2027 (PLAN-REPRISE-MARS.md ; base : supabase-reprise-mars.sql, Extension 154).
// Trois écrans, en phrases simples :
//  - Paiements › « Reprise du 1er mars » : chaque mannequin revue une fois (statut, formation en 1 ou 2 niveaux,
//    mois déjà faits → « il reste N mois »), les inscriptions jamais notées (encaissée avant le système, à recevoir,
//    abandonnée), puis le bilan d'ouverture (caisse comptée, solde Wave, écart noté une fois avec sa raison).
//  - Paiements › « Archives – période de rodage » : septembre à novembre 2026 en lecture seule (rien n'est
//    réclamé), avec une copie Excel et PDF.
//  - Comptabilité › « Clôture guidée » : rien en suspens, chaque compte compté, écart régularisé avec sa raison,
//    mois verrouillé, puis le bilan du mois en PDF et Excel (le « Dossier du mois », js/portail/espace-compta-dossier.js).
// Tant que le fichier SQL n'est pas collé, chaque écran le dit simplement (rien ne casse).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces || !P.espaces.paiements) return;
  const STATUTS = { actif: 'Active', suspendu: 'Suspendue', sorti: 'Sortie' };
  const ETATS_ARCHIVE = { paye: 'Payé', attente: 'En attente', rodage: 'Non payé (jamais réclamé)', conge: 'Congés', termine: 'Formation terminée' };
  const NOTE_ABSENT = '<div class="note alerte">Cette partie s’ouvrira quand l’étape d’installation « supabase-reprise-mars.sql » sera faite dans Supabase.</div>';
  const absent = (e) => /reprise_etat|archives_rodage|compta_cloturer_complet|function|fonction|schema cache/i.test(String(e && (e.message || e)));
  const nombre = (v) => { const n = Number(String(v == null ? '' : v).replace(/\s/g, '')); return Number.isFinite(n) ? Math.round(n) : NaN; };
  const dateLongue = (iso) => { const s = String(iso).slice(0, 10); return (s.slice(8, 10) === '01' ? '1er' : String(Number(s.slice(8, 10)))) + ' ' + P.mois(s).toLowerCase(); };

  // Comptage des comptes (bilan d'ouverture et clôture) : un champ « montant compté » et une raison si écart
  function champsComptage(lignes) {
    return P.tableau(['Compte', '#Selon le système', 'Montant compté (FCFA)', 'Raison de l’écart (si différent)'], lignes.map((c) =>
      '<tr><td><b>' + P.esc(c.nom) + '</b></td><td class="nombre">' + P.fcfa(c.fin) + '</td>' +
      '<td><input class="num" name="montant-' + c.compte_id + '" inputmode="numeric" pattern="[0-9 ]*" required aria-label="Montant compté pour ' + P.esc(c.nom) + '" value="' + Math.max(0, Number(c.fin) || 0) + '"></td>' +
      '<td><input name="motif-' + c.compte_id + '" maxlength="200" aria-label="Raison de l’écart pour ' + P.esc(c.nom) + '" placeholder="ex. frais Wave non notés"></td></tr>'));
  }
  function lireComptage(f, lignes) {
    return lignes.map((c) => {
      const montant = nombre(f.get('montant-' + c.compte_id)), motif = String(f.get('motif-' + c.compte_id) || '').trim();
      if (!Number.isFinite(montant) || montant < 0) throw new Error('Montant compté manquant pour ' + c.nom + '.');
      if (montant !== Number(c.fin) && !motif) throw new Error('Écart de ' + P.fcfa(montant - Number(c.fin)) + ' sur ' + c.nom + ' : indiquez-en la raison.');
      return { compte_id: c.compte_id, montant, motif };
    });
  }
  const resumeComptage = (l, noms) => P.tableau(['Compte', '#Selon le système', '#Compté', '#Écart', 'Raison'], (l || []).map((c) =>
    '<tr><td>' + P.esc(noms[c.compte_id] || '') + '</td><td class="nombre">' + P.fcfa(c.solde_systeme) + '</td><td class="nombre">' + P.fcfa(c.solde_reel) + '</td>' +
    '<td class="nombre">' + (Number(c.ecart) ? P.fcfa(c.ecart) : '—') + '</td><td>' + P.esc(c.motif || '') + '</td></tr>'));

  // ---------- Paiements › Reprise du 1er mars ----------
  async function reprise() {
    let r;
    try { r = await P.rpc('reprise_etat'); } catch (e) { if (absent(e)) return P.entete('Reprise du 1er mars') + NOTE_ABSENT; throw e; }
    const liste = (r.mannequins || []).filter((m) => m.statut !== 'sorti' || !m.vue_le);
    const vues = liste.filter((m) => m.vue_le).length;
    const sansInscription = (r.mannequins || []).filter((m) => m.statut !== 'sorti' && !m.inscription && !m.inscription_due);
    const principal = P.moi.role === 'principal', ouvert = String(r.aujourdhui) >= String(r.date_reprise);
    const noms = {};
    (r.comptes || []).forEach((c) => { noms[c.id] = c.nom; });
    let ouverture = '';
    if (r.ouverture && r.ouverture.length) {
      ouverture = '<p>' + P.pastille('Bilan d’ouverture fait le ' + P.date(r.ouverture[0].compte_le), 'ok') + '</p>' + resumeComptage(r.ouverture, noms);
    } else if (!P.moi.espaces.compta) {
      ouverture = '<p class="doux">Le bilan d’ouverture se fait depuis un compte qui a la Comptabilité (administrateur principal).</p>';
    } else if (!ouvert) {
      ouverture = '<p class="doux">À faire le ' + P.esc(dateLongue(r.date_reprise)) + ' : vous compterez la caisse et noterez le solde Wave du jour.</p>';
    } else {
      const lignes = await P.rpc('compta_tresorerie', { p_debut: r.date_reprise, p_fin: addJour(P.aujourdhui()) });
      P.etat.repriseComptes = (lignes || []).filter((c) => noms[c.compte_id]);
      ouverture = '<form class="f" data-form="reprise-ouverture"><p>Comptez l’argent de la caisse et regardez le solde dans l’application Wave, puis notez-les. S’il y a une différence avec le système, écrivez pourquoi : elle sera notée une seule fois.</p>' +
        champsComptage(P.etat.repriseComptes) + '<div class="ligne" style="margin-top:12px"><button class="btn rouge" type="submit">Enregistrer le bilan d’ouverture</button></div></form>';
    }
    return P.entete('Reprise du 1er mars', P.pastille(vues + ' sur ' + liste.length + ' revues', vues === liste.length && liste.length ? 'ok' : 'alerte')) +
      '<div class="note info">L’agence est fermée jusqu’au ' + P.esc(dateLongue(r.date_reprise)) + '. Septembre à novembre 2026 restent dans les « Archives – période de rodage » : rien n’est effacé, rien n’est réclamé. À partir de mars : 10 000 FCFA par mois et 15 000 FCFA d’inscription, pour toutes.</div>' +
      '<div class="carte"><h2>1. Chaque mannequin, une fois</h2><p class="doux">Pour chacune : son statut, sa formation (1 niveau de 9 mois, ou 2 niveaux), et les mois de cours qu’elle a déjà faits avant la reprise. Le site calcule les mois qui restent.</p>' +
      (liste.length ? P.tableau(['Mannequin', 'Statut', 'Formation', 'Mois déjà faits', ''], liste.map((m) =>
        '<tr><td>' + P.lienFiche(m.id, m.nom) + (m.vue_le ? '<div class="petit-texte doux">revue le ' + P.esc(P.date(m.vue_le)) + (m.mois_faits !== null ? ' · il reste ' + Math.max(0, m.niveaux * 9 - m.mois_faits) + ' mois' : '') + '</div>' : '') + '</td>' +
        '<td><select form="rp-' + m.id + '" name="statut" aria-label="Statut de ' + P.esc(m.nom) + '"' + (principal ? '' : ' disabled') + '>' +
          Object.keys(STATUTS).map((k) => '<option value="' + k + '"' + (k === m.statut ? ' selected' : '') + '>' + STATUTS[k] + '</option>').join('') + '</select></td>' +
        '<td><select form="rp-' + m.id + '" name="niveaux" aria-label="Formation de ' + P.esc(m.nom) + '"><option value="2"' + (Number(m.niveaux) !== 1 ? ' selected' : '') + '>2 niveaux (18 mois)</option><option value="1"' + (Number(m.niveaux) === 1 ? ' selected' : '') + '>1 niveau (9 mois)</option></select></td>' +
        '<td><input form="rp-' + m.id + '" class="num" name="mois_faits" type="number" min="0" max="18" required value="' + (m.mois_faits === null || m.mois_faits === undefined ? '' : Number(m.mois_faits)) + '" aria-label="Mois déjà faits par ' + P.esc(m.nom) + '"></td>' +
        '<td><form id="rp-' + m.id + '" data-form="reprise-mannequin" data-id="' + m.id + '" data-statut="' + P.esc(m.statut) + '"><button class="btn petit' + (m.vue_le ? '' : ' rouge') + '" type="submit">' + (m.vue_le ? 'Modifier' : 'Enregistrer') + '</button></form></td></tr>'))
        : '<p class="doux">Aucun mannequin dans le registre.</p>') +
      (principal ? '' : '<p class="petit-texte doux">Le statut se change depuis le compte de l’administrateur principal.</p>') + '</div>' +
      '<div class="carte"><h2>2. Inscriptions jamais notées</h2>' +
      (sansInscription.length ? '<p class="doux">Pour chacune : déjà payée avant le nouveau système (rien n’est ajouté aux comptes), à recevoir (elle va dans « Ce qu’on nous doit »), ou abandonnée (rien n’est réclamé).</p>' +
        P.tableau(['Mannequin', '#Montant', ''], sansInscription.map((m) =>
          '<tr><td>' + P.esc(m.nom) + '</td><td><input class="num" id="ri-' + m.id + '" inputmode="numeric" value="15000" aria-label="Montant de l’inscription de ' + P.esc(m.nom) + '"></td><td class="ligne">' +
          [['encaissee', 'Déjà payée'], ['a_recevoir', 'À recevoir'], ['abandonnee', 'Abandonnée']].map((c) =>
            '<button class="btn petit" type="button" data-action="reprise-inscription" data-id="' + m.id + '" data-nom="' + P.esc(m.nom) + '" data-choix="' + c[0] + '">' + c[1] + '</button>').join('') + '</td></tr>'))
        : '<p>' + P.pastille('Toutes les inscriptions sont notées', 'ok') + '</p>') + '</div>' +
      '<div class="carte"><h2>3. Bilan d’ouverture (le jour de la reprise)</h2>' + ouverture + '</div>';
  }
  function addJour(iso) { const d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
  P.formulaires['reprise-mannequin'] = async (f, form) => {
    const id = form.getAttribute('data-id');
    const niveaux = Number(f.get('niveaux')), faits = nombre(f.get('mois_faits'));
    const statut = P.moi.role === 'principal' ? String(f.get('statut') || form.getAttribute('data-statut')) : form.getAttribute('data-statut');
    if (!Number.isFinite(faits) || faits < 0 || faits > niveaux * 9) { P.message('Mois déjà faits : de 0 à ' + niveaux * 9 + ' pour ' + niveaux + ' niveau' + (niveaux > 1 ? 'x' : '') + '.'); return; }
    try {
      const r = await P.sensible(() => P.rpc('reprise_mannequin_enregistrer', { p_id: id, p_statut: statut, p_niveaux: niveaux, p_mois_faits: faits }));
      P.message('Enregistré : il reste ' + r.reste + ' mois de formation.');
      await P.afficher();
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['reprise-inscription'] = async (el) => {
    const id = el.getAttribute('data-id'), choix = el.getAttribute('data-choix'), nom = el.getAttribute('data-nom');
    const champ = document.getElementById('ri-' + id), montant = nombre(champ && champ.value);
    if (choix !== 'abandonnee' && (!Number.isFinite(montant) || montant <= 0)) { P.message('Indiquez le montant de l’inscription.'); return; }
    const phrase = { encaissee: 'L’inscription de ' + nom + ' a été payée avant le nouveau système (' + P.fcfa(montant) + ') ?',
      a_recevoir: 'L’inscription de ' + nom + ' (' + P.fcfa(montant) + ') va dans « Ce qu’on nous doit ». Continuer ?',
      abandonnee: 'Ne jamais réclamer l’inscription de ' + nom + ' ?' }[choix];
    if (!confirm(phrase)) return;
    try { await P.sensible(() => P.rpc('reprise_inscription', { p_id: id, p_choix: choix, p_montant: choix === 'abandonnee' ? 0 : montant })); P.message('Inscription notée.'); await P.afficher(); } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.formulaires['reprise-ouverture'] = async (f) => {
    try {
      const comptages = lireComptage(f, P.etat.repriseComptes || []);
      if (!confirm('Enregistrer le bilan d’ouverture ? Il ne se fait qu’une fois.')) return;
      await P.sensible(() => P.rpc('compta_ouverture', { p_comptages: comptages }));
      P.message('Bilan d’ouverture enregistré. Bonne reprise !');
      await P.afficher();
    } catch (e) { P.message(P.erreurTexte(e)); }
  };

  // ---------- Paiements › Archives – période de rodage (lecture seule) ----------
  async function archives() {
    let a;
    try { a = await P.rpc('archives_rodage'); } catch (e) { if (absent(e)) return P.entete('Archives – période de rodage') + NOTE_ABSENT; throw e; }
    P.etat.archivesRodage = a;
    const mois = moisDe(a), encaisse = (a.paiements || []).filter((p) => p.statut === 'valide').reduce((s, p) => s + Number(p.montant || 0), 0);
    return P.entete('Archives – période de rodage', P.pastille('Lecture seule', 'neutre')) +
      '<div class="note info">' + P.esc(P.mois(a.debut)) + ' à ' + P.esc(P.mois(a.fin).toLowerCase()) + ' : période de rodage. Rien n’est effacé et rien n’est modifiable ; les mois non payés ne sont jamais réclamés.</div>' +
      '<div class="grille chiffres">' + P.chiffre('Mannequins', (a.mannequins || []).length) + P.chiffre('Paiements validés', (a.paiements || []).filter((p) => p.statut === 'valide').length, 'vert') + P.chiffre('Encaissé', P.fcfa(encaisse), 'vert') + '</div>' +
      '<div class="carte"><h2>Copie à garder</h2><div class="ligne"><button class="btn rouge" type="button" data-action="archives-copie" data-format="xlsx">Télécharger en Excel</button><button class="btn rouge" type="button" data-action="archives-copie" data-format="pdf">Télécharger en PDF</button></div></div>' +
      '<div class="carte"><h2>Mois par mannequin</h2>' + P.tableau(['Mannequin', 'Statut'].concat(mois.map((m) => P.mois(m))), (a.mannequins || []).map((m) =>
        '<tr><td>' + P.esc(m.nom) + '</td><td>' + P.esc(STATUTS[m.statut] || m.statut) + '</td>' + mois.map((x) => '<td>' + P.esc(ETATS_ARCHIVE[(m.etats || {})[x]] || '—') + '</td>').join('') + '</tr>')) + '</div>' +
      '<div class="carte"><h2>Paiements reçus</h2>' + P.tableau(['Date', 'Mannequin', 'Pour', '#Montant', 'État'], (a.paiements || []).map((p) =>
        '<tr><td>' + P.esc(P.date(p.le)) + '</td><td>' + P.esc(p.nom) + '</td><td>' + P.esc(pour(p)) + '</td><td class="nombre">' + (p.montant ? P.fcfa(p.montant) : '—') + '</td><td>' + P.esc(p.statut === 'valide' ? 'Validé' : p.statut === 'declare' ? 'En attente' : 'Refusé') + '</td></tr>')) + '</div>';
  }
  function moisDe(a) {
    const l = [];
    for (let d = String(a.debut).slice(0, 10); d <= String(a.fin).slice(0, 10);) { l.push(d); const [y, m] = d.split('-').map(Number); d = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); }
    return l;
  }
  const pour = (p) => (p.objet === 'inscription' ? 'Inscription' : p.mois ? 'Mensualité de ' + P.mois(p.mois).toLowerCase() : 'Mensualité');
  const SENS = { recette: 'Recette', depense: 'Dépense', virement: 'Virement' };
  P.actions['archives-copie'] = async (el) => {
    const a = P.etat.archivesRodage;
    if (!a) return;
    const mois = moisDe(a), nom = 'Archives-rodage-' + String(a.debut).slice(0, 7) + '-a-' + String(a.fin).slice(0, 7) + '-MA2M';
    el.disabled = true;
    try {
      const tab = {
        mannequins: [['Mannequin', 'Statut', 'Mensualité (FCFA)'].concat(mois.map((m) => P.mois(m)))].concat((a.mannequins || []).map((m) =>
          [m.nom, STATUTS[m.statut] || m.statut, Number(m.mensualite || 0)].concat(mois.map((x) => ETATS_ARCHIVE[(m.etats || {})[x]] || '—')))),
        paiements: [['Date', 'Mannequin', 'Pour', 'Montant (FCFA)', 'Mode', 'État']].concat((a.paiements || []).map((p) =>
          [P.date(p.le), p.nom, pour(p), Number(p.montant || 0), p.mode === 'avant_systeme' ? 'Avant le nouveau système' : p.mode || '', p.statut === 'valide' ? 'Validé' : p.statut === 'declare' ? 'En attente' : 'Refusé'])),
        ecritures: [['Date', 'Sens', 'Libellé', 'Compte', 'Montant (FCFA)', 'Annulée']].concat((a.ecritures || []).map((e) =>
          [P.date(e.date), SENS[e.sens] || e.sens, e.libelle, e.compte, Number(e.montant), e.annule ? 'Oui' : ''])),
        tresorerie: [['Compte', 'Solde au début', 'Entrées', 'Sorties', 'Solde à la fin']].concat((a.tresorerie || []).map((c) =>
          [c.nom, c.ouvert ? Number(c.debut) : '', Number(c.entrees), Number(c.sorties), c.ouvert ? Number(c.fin) : '']))
      };
      if (el.getAttribute('data-format') === 'xlsx') {
        P.telecharger(P.xlsx([{ nom: 'Mannequins', lignes: tab.mannequins, largeurs: [28, 12, 16].concat(mois.map(() => 24)) },
          { nom: 'Paiements', lignes: tab.paiements, largeurs: [11, 28, 26, 14, 22, 12] }, { nom: 'Écritures', lignes: tab.ecritures, largeurs: [11, 10, 40, 18, 14, 9] },
          { nom: 'Trésorerie', lignes: tab.tresorerie, largeurs: [22, 16, 14, 14, 16] }]), nom + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else {
        const m = await P.comptaPdf.mise();
        m.ecrire('Archives – période de rodage · ' + P.mois(a.debut) + ' à ' + P.mois(a.fin), { taille: 16, gras: true, couleur: m.rouge });
        m.ecrire('Copie faite le ' + P.dateHeure(new Date().toISOString()) + ' · lecture seule : rien n’est réclamé pour cette période.', { taille: 9, couleur: m.gris });
        const colonnes = (l, parts) => l[0].map((t, i) => ({ titre: t, part: parts[i] || 1, droite: typeof (l[1] || [])[i] === 'number' }));
        const texte = (l) => l.slice(1).map((r) => r.map((v) => (typeof v === 'number' ? P.fcfa(v) : v)));
        m.titre('1. Mois par mannequin', 12); m.tableau(colonnes(tab.mannequins, [2.4, 1.1, 1.3]).filter((c, i) => i !== 2), texte(tab.mannequins).map((r) => r.filter((v, i) => i !== 2)), { taille: 8 });
        m.titre('2. Paiements reçus', 12); m.tableau(colonnes(tab.paiements, [1, 2.2, 2.2, 1.3, 1.8, 1]), texte(tab.paiements), { taille: 8 });
        m.titre('3. Écritures de la comptabilité', 12); m.tableau(colonnes(tab.ecritures, [1, 1, 3.2, 1.5, 1.3, 0.8]), texte(tab.ecritures), { taille: 8 });
        m.titre('4. Trésorerie de la période', 12); m.tableau(colonnes(tab.tresorerie, [2, 1.4, 1.3, 1.3, 1.4]), texte(tab.tresorerie));
        P.telecharger(await m.finir('Archives – période de rodage'), nom + '.pdf', 'application/pdf');
      }
      P.message('Copie téléchargée.');
    } catch (e) { P.message(P.erreurTexte(e)); } finally { if (el.isConnected) el.disabled = false; }
  };

  const E = P.espaces.paiements;
  E.pages.reprise = reprise;
  E.pages['archives-rodage'] = archives;
  // (juste après le « Tableau du mois », qui reste la page d'arrivée ; les archives en fin de menu)
  E.nav.splice(E.nav.findIndex((n) => n[0] === 'tableau') + 1 || E.nav.length, 0, ['reprise', 'Reprise du 1er mars']);
  E.nav.push(['archives-rodage', 'Archives – période de rodage']);

  // ---------- Comptabilité › Clôture guidée ----------
  const esp = P.espaces.compta, C = P.compta;
  if (!esp || !C) return;
  async function cloture() {
    const m = C.moisChoisi(), fin = C.bornes(m)[1];
    const [clos, comptes] = await Promise.all([P.bd(sb.from('compta_clotures').select('*').eq('mois', m)), C.comptes(true)]);
    const noms = {};
    comptes.forEach((c) => { noms[c.id] = c.nom; });
    const bilan = '<div class="ligne" style="margin-top:12px"><button class="btn rouge" type="button" data-action="compta-dossier" data-format="pdf">Bilan du mois en PDF</button><button class="btn rouge" type="button" data-action="compta-dossier" data-format="xlsx">Bilan du mois en Excel</button></div>';
    if (clos.length) {
      let comptages = [];
      try { comptages = await P.bd(sb.from('compta_comptages').select('*').eq('nature', 'cloture').eq('mois', m)); } catch (e) { /* fichier pas encore collé */ }
      return P.entete('Clôture guidée · ' + P.mois(m), C.choixMois()) +
        '<div class="carte"><h2>' + P.pastille('Mois clôturé le ' + P.date(clos[0].cloture_le), 'ok') + '</h2><p>Ce mois ne change plus. Une correction se fait par une écriture dans le mois en cours.</p>' +
        P.tableau(['Rubrique', '#Montant'], [['Recettes', clos[0].recettes], ['Dépenses', clos[0].depenses], ['Résultat', clos[0].recettes - clos[0].depenses]].map((l) => '<tr><td>' + l[0] + '</td><td class="nombre">' + P.fcfa(l[1]) + '</td></tr>')) +
        (comptages.length ? '<h3>Comptes comptés</h3>' + resumeComptage(comptages, noms) : '') + (clos[0].note ? '<p class="doux">Note : ' + P.esc(clos[0].note) + '</p>' : '') + bilan + '</div>';
    }
    if (m >= P.moisCourant()) {
      return P.entete('Clôture guidée · ' + P.mois(m), C.choixMois()) + '<div class="note info">Ce mois n’est pas terminé. La clôture se fait à partir du 1er du mois suivant : choisissez un mois passé.</div>';
    }
    const [enAttente, lignes] = await Promise.all([
      P.bd(sb.from('paiements_mannequins').select('id').eq('statut', 'declare').lt('declare_le', fin)),
      P.rpc('compta_tresorerie', { p_debut: m, p_fin: fin })
    ]);
    const actifs = new Set(comptes.filter((c) => c.actif && String(c.date_initiale || '') < fin).map((c) => c.id));
    P.etat.clotureComptes = (lignes || []).filter((c) => actifs.has(c.compte_id));
    return P.entete('Clôture guidée · ' + P.mois(m), C.choixMois()) +
      '<div class="note info">Quatre étapes : rien en suspens, chaque compte compté, la raison de chaque écart, puis le mois est verrouillé et vous téléchargez le bilan.</div>' +
      '<div class="carte"><h2>1. Rien en suspens</h2>' + (enAttente.length
        ? '<p>' + P.pastille(enAttente.length + ' paiement(s) « J’ai payé » à vérifier', 'alerte') + '</p><p>Validez-les ou refusez-les d’abord (espace Paiements, « Paiements à valider »).</p>'
        : '<p>' + P.pastille('Aucun paiement en attente', 'ok') + '</p>') + '</div>' +
      '<form class="carte f" data-form="cloture-guidee" data-mois="' + m + '"><h2>2. Comptez chaque compte au dernier jour du mois</h2>' +
      '<p class="doux">La caisse : l’argent compté. Wave : le solde affiché dans l’application au dernier jour du mois. Un écart devient une écriture de régularisation, avec sa raison.</p>' +
      champsComptage(P.etat.clotureComptes) +
      '<label class="fl" for="cg-note">Note (facultatif)<input id="cg-note" name="note" maxlength="300"></label>' +
      '<div class="ligne" style="margin-top:12px"><button class="btn rouge" type="submit"' + (enAttente.length ? ' disabled' : '') + '>Clôturer ' + P.esc(P.mois(m)) + '</button></div></form>';
  }
  P.formulaires['cloture-guidee'] = async (f, form) => {
    const m = form.getAttribute('data-mois');
    try {
      const comptages = lireComptage(f, P.etat.clotureComptes || []);
      if (!confirm('Clôturer ' + P.mois(m) + ' ? Le mois sera verrouillé : il ne changera plus.')) return;
      await P.sensible(() => P.rpc('compta_cloturer_complet', { p_mois: m, p_comptages: comptages, p_note: String(f.get('note') || '').trim() || null }));
      P.message('Mois clôturé. Téléchargez maintenant le bilan en PDF et en Excel.');
      await P.afficher();
    } catch (e) { P.message(absent(e) ? 'La clôture guidée s’ouvrira quand l’étape d’installation « supabase-reprise-mars.sql » sera faite.' : P.erreurTexte(e)); }
  };
  esp.pages['cloture-guidee'] = cloture;
  // (juste après « Clôture mensuelle » : rangé par js/portail/espace-compta-dossier.js, chargé avant ce fichier)
  esp.nav.splice(esp.nav.findIndex((n) => n[0] === 'dossier') + 1 || esp.nav.length, 0, ['cloture-guidee', 'Clôture guidée']);
})();
