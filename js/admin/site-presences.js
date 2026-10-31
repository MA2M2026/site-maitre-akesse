// Nouvelle Administration — « Liste de présence » des cours du dimanche (chantier 14, 01/11/2026,
// décisions de la propriétaire du 31/10/2026). Le mois en cours s'affiche avec ses dimanches (4 ou 5,
// trouvés tout seuls) : une ligne par mannequin du registre, une case par dimanche. Un toucher sur la case :
// vide → présente (vert) → absence excusée (orange) → vide ; enregistré aussitôt (presence_marquer).
// Un dimanche passé non coché devient rouge tout seul ; un dimanche peut être annulé (il ne compte pour
// personne). En bout de ligne : la mention du mois. « Synthèse » : une période (3 mois, l'année…), mois
// par mois, pour chaque mannequin. Calcul partagé avec l'application : js/presences-calcul.js.
// Base : supabase-presences.sql (Extension 142) ; la mannequin voit les siennes sans pouvoir les changer.
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site || !window.Presences) return;
  const PAGE = 'b2-presences';
  const C = window.Presences;
  const aujourdhui = () => C.jourIso(new Date());
  const moisDe = (jour) => jour.slice(0, 7);
  const NOMS_MOIS = (m) => new Date(m + '-15T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const jourCourt = (d) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const pasActivee = P.pasActivee('presences_mois');
  let etat = { mois: moisDe(aujourdhui()), donnees: null, filtre: '' };
  const SIGNES = { present: '✓', excuse: 'E', absent: '✕', annulee: '—', avant_entree: '', a_venir: '' };
  const NOMS_ETATS = { present: 'présente', excuse: 'absence excusée', absent: 'absente', annulee: 'séance annulée', avant_entree: 'pas encore à l’agence', a_venir: 'à venir' };

  // présences d'une mannequin, rangées par dimanche : { 'AAAA-MM-JJ': 'present' | 'excuse' }
  function parMannequin(d) {
    const m = new Map();
    (d.presences || []).forEach((p) => { if (!m.has(p.mannequin)) m.set(p.mannequin, {}); m.get(p.mannequin)[p.dimanche] = p.etat; });
    return m;
  }
  const visagesDe = async (mannequins) => P.photosCouverture(mannequins.map((x) => x.compte).filter(Boolean)).catch(() => ({}));

  async function pageMois() {
    let d;
    try { d = await P.rpc('presences_mois', { p_mois: etat.mois + '-01' }); } catch (e) {
      if (pasActivee(e)) return P.entete('Liste de présence') + '<div class="carte vide">La liste de présence n’est pas encore activée : il faut d’abord coller le fichier <b>supabase-presences.sql</b> dans Supabase.</div>';
      throw e;
    }
    etat.donnees = d;
    const visages = await visagesDe(d.mannequins);
    const jours = C.dimanchesDuMois(etat.mois), auj = aujourdhui(), annulees = (d.annulees || []).map((a) => a.dimanche);
    const presences = parMannequin(d);
    const tete = '<tr><th scope="col" class="pr-nom">Mannequin</th>' + jours.map((j) => {
      const annulee = annulees.includes(j);
      return '<th scope="col" class="pr-jour' + (j === auj ? ' aujourdhui' : '') + '"><span>' + P.esc(jourCourt(j)) + '</span>' +
        '<button type="button" class="pr-annuler" data-action="presences-annuler" data-jour="' + j + '" data-annulee="' + (annulee ? '1' : '') + '" title="' + (annulee ? 'Rétablir la séance' : 'Annuler la séance (elle ne comptera pour personne)') + '">' + (annulee ? 'Rétablir' : 'Annuler') + '</button></th>';
    }).join('') + '<th scope="col" class="pr-mention">Mention</th></tr>';
    const lignes = d.mannequins.map((m) => {
      const r = C.moisMannequin(etat.mois, presences.get(m.id), annulees, m.date_entree, auj);
      const ment = r.bilan.mention ? C.MENTIONS[r.bilan.mention] : null;
      // mensualité du mois pas payée (seulement pour qui a accès aux Paiements : la base ne le dit qu'à eux)
      const aPayer = m.mensualite === 'non_paye' || m.mensualite === 'a_payer';
      return '<tr data-nom="' + P.esc(String(m.nom || '').toLowerCase()) + '"><th scope="row" class="pr-nom"><div class="pr-nom-c">' + P.visage(visages[m.compte], m.nom, 'pr-vis') + '<span>' + P.esc(m.nom) +
        (aPayer ? ' <small class="pr-a-payer" title="Mensualité de ' + P.esc(NOMS_MOIS(etat.mois)) + (m.mensualite === 'non_paye' ? ' en retard' : ' à payer') + '">' + (m.mensualite === 'non_paye' ? 'retard' : 'à payer') + '</small>' : '') + '</span></div></th>' +
        r.jours.map((j) => {
          const modifiable = j.etat !== 'annulee' && j.dimanche <= auj;
          return '<td><button type="button" class="pr-case e-' + j.etat + '" data-action="presences-case" data-mannequin="' + P.esc(m.id) + '" data-jour="' + j.dimanche + '" data-etat="' + j.etat + '"' +
            (modifiable ? '' : ' disabled') + ' aria-label="' + P.esc(m.nom + ', ' + jourCourt(j.dimanche) + ' : ' + NOMS_ETATS[j.etat]) + '">' + SIGNES[j.etat] + '</button></td>';
        }).join('') +
        '<td class="pr-mention">' + (ment ? '<span class="pr-badge ' + ment.ton + '">' + P.esc(ment.agence) + '</span>' + (r.bilan.provisoire ? '<small class="doux"> (en cours)</small>' : '') : '<span class="doux">—</span>') + '</td></tr>';
    }).join('');
    const carteMdm = etat.mois === moisDe(auj) ? await carteMannequinDuMois(d, visages) : '';
    const dimancheDuJour = jours.includes(auj) ? auj : null;
    const presentes = dimancheDuJour ? d.mannequins.filter((m) => (presences.get(m.id) || {})[auj] === 'present').length : null;
    return P.entete('Liste de présence', '<a class="btn" href="#/site/' + PAGE + '/synthese">Synthèse</a>') +
      '<div class="carte pr-barre"><button type="button" class="btn petit" data-action="presences-mois" data-pas="-1" aria-label="Mois précédent">‹</button>' +
      '<h2><span class="pr-mois">' + P.esc(NOMS_MOIS(etat.mois)) + '</span> <span class="doux pr-nb">' + jours.length + ' dimanches</span></h2>' +
      '<button type="button" class="btn petit" data-action="presences-mois" data-pas="1" aria-label="Mois suivant">›</button></div>' +
      carteMdm +
      '<div class="chiffres">' + P.chiffre('Mannequins', String(d.mannequins.length)) + (presentes !== null ? P.chiffre('Présentes aujourd’hui', String(presentes), 'vert') : '') + '</div>' +
      '<p class="doux petit-texte">Touchez une case : <span class="pr-legende e-present">✓</span> présente, puis <span class="pr-legende e-excuse">E</span> absence excusée, puis vide. Un dimanche passé sans croix devient <span class="pr-legende e-absent">✕</span> rouge tout seul. Chaque toucher est enregistré tout de suite ; la mannequin le voit dans son application.</p>' +
      '<label class="fl pr-recherche" for="pr-recherche">Chercher un nom<input id="pr-recherche" type="search" data-change="presences-filtre" data-direct value="' + P.esc(etat.filtre) + '" placeholder="ex. : Awa"></label>' +
      (d.mannequins.length ? '<div class="pr-tableau"><table class="pr-grille"><thead>' + tete + '</thead><tbody>' + lignes + '</tbody></table></div>'
        : '<div class="carte vide">Aucune mannequin active au registre.</div>');
  }

  // ---------- Mannequin du mois (supabase-mannequin-du-mois.sql, Extension 144) ----------
  // Proposées : celles qui ont suivi tous les cours du mois précédent ; l'agence peut en choisir une autre.
  async function carteMannequinDuMois(d, visages) {
    const ceMois = moisDe(aujourdhui()), avant = C.moisVoisin(ceMois, -1);
    let historique, precedent;
    try {
      [historique, precedent] = await Promise.all([P.rpc('mannequins_du_mois_historique'), P.rpc('presences_mois', { p_mois: avant + '-01' })]);
    } catch (e) { return ''; }  // (pas encore activée : la carte n'apparaît pas)
    const actuelle = (historique || []).find((h) => String(h.mois).slice(0, 7) === ceMois);
    const pres = parMannequin(precedent), annulees = (precedent.annulees || []).map((a) => a.dimanche);
    const assidues = d.mannequins.filter((m) => C.moisMannequin(avant, pres.get(m.id), annulees, m.date_entree, aujourdhui()).bilan.mention === 'assidu');
    const bouton = (m) => '<button type="button" class="btn petit" data-action="mdm-choisir" data-mannequin="' + P.esc(m.id) + '" data-nom="' + P.esc(m.nom) + '">Choisir</button>';
    return '<section class="carte pr-mdm"><h2>🏆 Mannequin du mois <span class="doux">· ' + P.esc(NOMS_MOIS(ceMois)) + '</span></h2>' +
      (actuelle ? '<p><b>' + P.esc(actuelle.nom) + '</b>' + (actuelle.mot ? ' — « ' + P.esc(actuelle.mot) + ' »' : '') + '</p><p class="doux petit-texte">Elle a reçu son message de félicitations ; le site et l’application la mettent à l’honneur tout le mois (si sa fiche est publiée au Book).</p>'
        : '<p class="doux petit-texte">Pas encore choisie. ' + (assidues.length ? 'Assidues à tous les cours de ' + P.esc(NOMS_MOIS(avant)) + ' :' : 'Personne n’a suivi tous les cours de ' + P.esc(NOMS_MOIS(avant)) + ' : choisissez librement ci-dessous.') + '</p>') +
      (assidues.length && !actuelle ? '<ul class="pr-mdm-liste">' + assidues.map((m) => '<li>' + P.visage(visages[m.compte], m.nom, 'pr-vis') + '<span>' + P.esc(m.nom) + '</span>' + bouton(m) + '</li>').join('') + '</ul>' : '') +
      '<label class="fl" for="mdm-autre">' + (actuelle ? 'Changer pour' : 'Ou une autre mannequin') + '<select id="mdm-autre" data-change="mdm-autre"><option value="">Choisir…</option>' +
      d.mannequins.filter((m) => m.statut === 'actif').map((m) => '<option value="' + P.esc(m.id) + '">' + P.esc(m.nom) + '</option>').join('') + '</select></label></section>';
  }
  async function choisirMdm(id, nom) {
    const mot = prompt('Choisir « ' + nom + ' » comme mannequin du mois ? Elle recevra un message de félicitations dans son application.\n\nUn petit mot pour elle (facultatif) :', '');
    if (mot === null) return;
    try { await P.rpc('mannequin_du_mois_choisir', { p_mois: aujourdhui(), p_mannequin: id, p_mot: mot }); } catch (e) { P.message('Non enregistré : ' + P.erreurTexte(e)); return; }
    P.message('« ' + nom + ' » est la mannequin du mois.');
    return P.afficher();
  }
  P.actions['mdm-choisir'] = (el) => choisirMdm(el.dataset.mannequin, el.dataset.nom);
  P.changements['mdm-autre'] = (el) => { if (el.value) return choisirMdm(el.value, el.options[el.selectedIndex].textContent); };

  function appliquerFiltre() {
    const f = etat.filtre.trim().toLowerCase();
    document.querySelectorAll('.pr-grille tbody tr').forEach((tr) => { tr.hidden = !!f && !tr.dataset.nom.includes(f); });
  }

  // mention du mois d'une ligne, recalculée d'après ses cases
  function majMention(tr) {
    if (!tr) return;
    const b = C.bilan([...tr.querySelectorAll('.pr-case')].map((c) => c.dataset.etat));
    const ment = b.mention ? C.MENTIONS[b.mention] : null;
    tr.querySelector('td.pr-mention').innerHTML = ment ? '<span class="pr-badge ' + ment.ton + '">' + P.esc(ment.agence) + '</span>' + (b.provisoire ? '<small class="doux"> (en cours)</small>' : '') : '<span class="doux">—</span>';
  }
  // un toucher : vide/rouge → présente → excusée → vide (enregistré aussitôt ; en cas de refus, la case revient)
  const SUIVANT = { absent: 'present', a_venir: 'present', avant_entree: 'present', present: 'excuse', excuse: null };
  P.actions['presences-case'] = async (el) => {
    const avant = el.dataset.etat, voulu = SUIVANT[avant];
    const nouvel = voulu || C.etatJour(el.dataset.jour, null, false, null, aujourdhui());
    const montrer = (e) => { el.className = 'pr-case e-' + e; el.dataset.etat = e; el.textContent = SIGNES[e]; };
    montrer(nouvel); el.disabled = true;
    try {
      await P.rpc('presence_marquer', { p_mannequin: el.dataset.mannequin, p_dimanche: el.dataset.jour, p_etat: voulu });
      el.disabled = false;
      majMention(el.closest('tr'));  // (sans tout recharger : le dimanche, on coche vite)
    } catch (e) {
      montrer(avant); el.disabled = false;
      P.message('Non enregistré : ' + P.erreurTexte(e));
    }
  };
  P.actions['presences-annuler'] = async (el) => {
    const annulee = el.dataset.annulee === '1', jour = el.dataset.jour;
    let motif = null;
    if (!annulee) {
      motif = prompt('Annuler la séance du ' + jourCourt(jour) + ' ? Elle ne comptera pour personne (les cases déjà cochées ce jour-là sont effacées).\n\nMotif (facultatif) :', '');
      if (motif === null) return;
    } else if (!confirm('Rétablir la séance du ' + jourCourt(jour) + ' ?')) return;
    await P.rpc('presences_seance_annuler', { p_dimanche: jour, p_annulee: !annulee, p_motif: motif });
    P.message(annulee ? 'Séance rétablie.' : 'Séance annulée.');
    return P.afficher();
  };
  P.actions['presences-mois'] = (el) => { etat.mois = C.moisVoisin(etat.mois, Number(el.dataset.pas)); return P.afficher(); };
  P.changements['presences-filtre'] = (el) => { etat.filtre = el.value; appliquerFiltre(); };

  // ---------- Synthèse sur une période ----------
  let periode = { de: C.moisVoisin(moisDe(aujourdhui()), -2), a: moisDe(aujourdhui()) };
  async function pageSynthese() {
    const d = await P.rpc('presences_periode', { p_debut: periode.de + '-01', p_fin: periode.a + '-01' });
    const visages = await visagesDe(d.mannequins);
    const liste = C.moisEntre(periode.de, periode.a), auj = aujourdhui(), annulees = (d.annulees || []).map((a) => a.dimanche);
    const presences = parMannequin(d);
    const pourcent = (t) => (t === null ? '—' : Math.round(t * 100) + ' %');
    const lignes = d.mannequins.map((m) => {
      const s = C.synthese(liste, presences.get(m.id), annulees, m.date_entree, auj);
      const ment = s.bilan.mention ? C.MENTIONS[s.bilan.mention] : null;
      const detail = s.parMois.map((pm) => {
        const mm = pm.bilan.mention ? C.MENTIONS[pm.bilan.mention] : null;
        return '<li><b>' + P.esc(NOMS_MOIS(pm.mois)) + '</b> : ' + pm.bilan.presents + ' sur ' + pm.bilan.comptees +
          (pm.bilan.excuses ? ' (+ ' + pm.bilan.excuses + ' excusée' + (pm.bilan.excuses > 1 ? 's' : '') + ')' : '') + (mm ? ' — <span class="pr-badge ' + mm.ton + '">' + P.esc(mm.agence) + '</span>' : '') +
          ' <span class="doux">(' + pm.jours.filter((j) => j.etat === 'present').map((j) => jourCourt(j.dimanche)).join(', ') + ')</span></li>';
      }).join('');
      return '<details class="carte pr-synthese"><summary>' + P.visage(visages[m.compte], m.nom, 'pr-vis') + '<span class="pr-s-nom">' + P.esc(m.nom) + '</span>' +
        '<span class="pr-s-chiffres">' + s.parMois.length + ' mois · ' + s.bilan.presents + ' présence' + (s.bilan.presents > 1 ? 's' : '') + ' sur ' + s.bilan.comptees + ' · ' + pourcent(s.bilan.taux) + '</span>' +
        (ment ? '<span class="pr-badge ' + ment.ton + '">' + P.esc(ment.agence) + '</span>' : '<span class="doux">—</span>') + '</summary>' +
        (detail ? '<ul class="pr-detail">' + detail + '</ul>' : '<p class="doux">Aucune séance sur cette période.</p>') + '</details>';
    }).join('');
    const choixMois = (nom, valeur) => '<label class="fl" for="pr-' + nom + '">' + (nom === 'de' ? 'Du mois' : 'Au mois') + '<input id="pr-' + nom + '" type="month" value="' + valeur + '" data-change="presences-periode" data-borne="' + nom + '"></label>';
    const raccourci = (n, libelle) => '<button type="button" class="btn petit" data-action="presences-raccourci" data-mois="' + n + '">' + libelle + '</button>';
    return P.entete('Synthèse des présences', '<a class="btn" href="#/site/' + PAGE + '">← Liste du dimanche</a><button type="button" class="btn" data-action="presences-imprimer">Imprimer</button>') +
      '<div class="carte f pr-periode">' + choixMois('de', periode.de) + choixMois('a', periode.a) +
      '<div class="ligne">' + raccourci(3, '3 derniers mois') + raccourci(4, '4 derniers mois') + raccourci(12, '12 derniers mois') + '</div></div>' +
      '<p class="doux petit-texte">Touchez un nom pour voir le détail mois par mois (dimanches de présence, mention de chaque mois). Les absences excusées et les séances annulées ne comptent pas.</p>' +
      (lignes || '<div class="carte vide">Aucune mannequin sur cette période.</div>');
  }
  P.changements['presences-periode'] = (el) => {
    if (!/^\d{4}-\d{2}$/.test(el.value)) return;
    periode[el.dataset.borne] = el.value;
    if (periode.de > periode.a) periode = { de: periode.a, a: periode.de };
    return P.afficher();
  };
  P.actions['presences-raccourci'] = (el) => { const fin = moisDe(aujourdhui()); periode = { de: C.moisVoisin(fin, 1 - Number(el.dataset.mois)), a: fin }; return P.afficher(); };
  P.actions['presences-imprimer'] = () => { document.querySelectorAll('.pr-synthese').forEach((x) => { x.open = true; }); window.print(); };

  P.espaces.site.pages[PAGE] = (args) => (args && args[0] === 'synthese' ? pageSynthese() : pageMois());
  P.espaces.site.apres[PAGE] = appliquerFiltre;
})();
