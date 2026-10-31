// Liste de présence des cours du dimanche (chantier 14, 01/11/2026, décisions de la propriétaire du
// 31/10/2026) : le calcul, PARTAGÉ par l'Administration (js/admin/site-presences.js) et l'application des
// mannequins (js/mannequin-app.js). Données : supabase-presences.sql (Extension 142).
//  - les dimanches d'un mois sont trouvés tout seuls (4 ou 5) ;
//  - vert = présente, orange = absence excusée (ne compte pas contre elle), rouge = dimanche PASSÉ non
//    coché (dès le lundi : rien à faire), gris = séance annulée (ne compte pour personne) ou avant
//    l'entrée de la mannequin à l'agence (sauf si elle a été cochée) ; le dimanche du jour reste « à venir »
//    tant qu'il n'est pas coché ;
//  - mention : toutes les séances comptées = « Apprenant assidu, bravo ! » ; 75 % et plus = Bien ; 50 % et
//    plus = Passable ; moins = Insuffisant (« À améliorer » pour la mannequin) ; aucune = Absent.
(function (racine) {
  'use strict';
  const jourIso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  // « 2026-11 » → ['2026-11-01', '2026-11-08', …]
  function dimanchesDuMois(mois) {
    const [a, m] = String(mois).split('-').map(Number);
    const d = new Date(a, m - 1, 1), liste = [];
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
    while (d.getMonth() === m - 1) { liste.push(jourIso(d)); d.setDate(d.getDate() + 7); }
    return liste;
  }
  // « 2026-11 » → le mois d'avant / d'après
  function moisVoisin(mois, pas) {
    const [a, m] = String(mois).split('-').map(Number);
    const d = new Date(a, m - 1 + pas, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  // état d'un dimanche pour une mannequin : present, excuse, absent, annulee, avant_entree, a_venir
  function etatJour(dimanche, coche, annulee, dateEntree, aujourdhui) {
    if (annulee) return 'annulee';
    if (coche === 'present' || coche === 'excuse') return coche;
    if (dimanche >= aujourdhui) return 'a_venir';
    if (dateEntree && dimanche < dateEntree) return 'avant_entree';
    return 'absent';
  }
  const MENTIONS = {
    assidu: { agence: 'Apprenant assidu, bravo !', mannequin: 'Apprenant assidu, bravo !', ton: 'vert' },
    bien: { agence: 'Bien', mannequin: 'Bien', ton: 'vert' },
    passable: { agence: 'Passable', mannequin: 'Passable', ton: 'orange' },
    insuffisant: { agence: 'Insuffisant', mannequin: 'À améliorer', ton: 'rouge' },
    absent: { agence: 'Absent tout le mois', mannequin: 'Absent ce mois-ci', ton: 'rouge' }
  };
  // bilan d'une liste d'états : séances comptées (présente + absente), taux, mention
  function bilan(etats) {
    const n = (e) => etats.filter((x) => x === e).length;
    const presents = n('present'), absents = n('absent'), excuses = n('excuse'), aVenir = n('a_venir');
    const comptees = presents + absents;
    const taux = comptees ? presents / comptees : null;
    let mention = null;
    if (comptees) {
      if (presents === comptees) mention = 'assidu';
      else if (taux >= 0.75) mention = 'bien';
      else if (taux >= 0.5) mention = 'passable';
      else if (presents > 0) mention = 'insuffisant';
      else mention = 'absent';
    }
    return { presents, absents, excuses, aVenir, comptees, taux, mention, provisoire: aVenir > 0 };
  }
  // Une mannequin sur un mois : ses états jour par jour et son bilan.
  // presences : { 'AAAA-MM-JJ': 'present' | 'excuse' } ; annulees : Set ou tableau de dates
  function moisMannequin(mois, presences, annulees, dateEntree, aujourdhui) {
    const annule = new Set(annulees || []);
    const jours = dimanchesDuMois(mois).map((d) => ({ dimanche: d, etat: etatJour(d, (presences || {})[d], annule.has(d), dateEntree, aujourdhui) }));
    return { mois, jours, bilan: bilan(jours.map((j) => j.etat)) };
  }
  // Synthèse sur une période (liste de mois « AAAA-MM ») : le détail mois par mois et le bilan global
  function synthese(listeMois, presences, annulees, dateEntree, aujourdhui) {
    const parMois = listeMois.map((m) => moisMannequin(m, presences, annulees, dateEntree, aujourdhui))
      .filter((m) => m.jours.some((j) => j.etat !== 'avant_entree' && j.etat !== 'a_venir'));
    return { parMois, bilan: bilan(parMois.flatMap((m) => m.jours.map((j) => j.etat))) };
  }
  // mois de « debut » à « fin » inclus (« AAAA-MM »)
  function moisEntre(debut, fin) {
    const liste = [];
    for (let m = debut; m <= fin && liste.length < 60; m = moisVoisin(m, 1)) liste.push(m);
    return liste;
  }
  racine.Presences = { jourIso, dimanchesDuMois, moisVoisin, etatJour, bilan, moisMannequin, synthese, moisEntre, MENTIONS };
})(typeof window !== 'undefined' ? window : globalThis);
