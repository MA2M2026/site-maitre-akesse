// Programmation défilé (24/10/2026, demande de la propriétaire) : répartition automatique des
// mannequins retenues (le « vivier ») dans les passages d'un défilé (un jour, une salle, une heure,
// un nombre de femmes et d'hommes). Partagé par l'Administration (js/admin/site-defiles.js) et
// les essais (scripts/tests-visiteur/test-defile-repartition.js) ; aucun accès à la base ici.
//  - une mannequin n'est jamais dans deux passages qui se chevauchent (le même jour, moins de
//    `ecartMinutes` entre deux débuts : le temps de se changer) ;
//  - le travail est partagé : on choisit d'abord celles qui ont le moins de passages, puis, à
//    égalité, dans l'ordre du vivier (stable : la même demande donne la même répartition) ;
//  - les choix faits à la main (`fixes`) sont gardés ; on complète autour d'eux ;
//  - les places impossibles à remplir sont rendues dans `manques` (pas assez de femmes, d'hommes).
(function (racine) {
  'use strict';
  const minutes = (h) => { const m = /^(\d{1,2})[:h](\d{2})/.exec(String(h || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  // deux passages se gênent-ils pour une même mannequin ?
  function seGenent(a, b, ecart) {
    if (a.jour !== b.jour) return false;
    const x = minutes(a.debut), y = minutes(b.debut);
    if (x === null || y === null) return true;  // heure inconnue le même jour : prudence
    return Math.abs(x - y) < ecart;
  }
  // passages : [{ id, jour 'AAAA-MM-JJ', debut 'HH:MM', femmes, hommes }] ; vivier : [{ cle, sexe }] ;
  // fixes : { idPassage: [cle…] } ; options : { ecartMinutes (90 par défaut) }.
  // Renvoie { affectations: { idPassage: [cle…] }, manques: { idPassage: { femme, homme } }, compte: { cle: n } }
  function repartirDefile(passages, vivier, fixes, options) {
    const ecart = (options && options.ecartMinutes) || 90;
    const ordre = passages.slice().sort((a, b) => String(a.jour).localeCompare(String(b.jour)) || (minutes(a.debut) || 0) - (minutes(b.debut) || 0));
    const sexeDe = {}; vivier.forEach((v) => { sexeDe[v.cle] = v.sexe === 'homme' ? 'homme' : 'femme'; });
    const affectations = {}, compte = {}, passagesDe = {};
    vivier.forEach((v) => { compte[v.cle] = 0; passagesDe[v.cle] = []; });
    // d'abord les choix faits à la main (seulement des mannequins du vivier)
    ordre.forEach((p) => {
      affectations[p.id] = [...new Set(((fixes && fixes[p.id]) || []).filter((c) => c in compte))];
      affectations[p.id].forEach((c) => { compte[c]++; passagesDe[c].push(p); });
    });
    const manques = {};
    ordre.forEach((p) => {
      const manque = {};
      ['femme', 'homme'].forEach((sexe) => {
        const voulu = Math.max(0, Number(sexe === 'femme' ? p.femmes : p.hommes) || 0);
        let deja = affectations[p.id].filter((c) => sexeDe[c] === sexe).length;
        const libres = vivier.map((v, rang) => ({ cle: v.cle, rang })).filter((x) => sexeDe[x.cle] === sexe && affectations[p.id].indexOf(x.cle) < 0 &&
          !passagesDe[x.cle].some((q) => seGenent(p, q, ecart)))
          .sort((a, b) => compte[a.cle] - compte[b.cle] || a.rang - b.rang);
        while (deja < voulu && libres.length) {
          const choisie = libres.shift().cle;
          affectations[p.id].push(choisie); compte[choisie]++; passagesDe[choisie].push(p); deja++;
        }
        if (deja < voulu) manque[sexe] = voulu - deja;
      });
      if (Object.keys(manque).length) manques[p.id] = manque;
    });
    return { affectations, manques, compte };
  }
  // passages trop rapprochés pour une même mannequin (alerte après une modification à la main)
  function conflitsDefile(passages, affectations, options) {
    const ecart = (options && options.ecartMinutes) || 90, parId = {}, conflits = [];
    passages.forEach((p) => { parId[p.id] = p; });
    const ou = {};
    Object.keys(affectations).forEach((id) => (affectations[id] || []).forEach((c) => { (ou[c] = ou[c] || []).push(parId[id]); }));
    Object.keys(ou).forEach((c) => {
      const l = ou[c].filter(Boolean);
      for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) if (seGenent(l[i], l[j], ecart)) conflits.push({ cle: c, a: l[i].id, b: l[j].id });
    });
    return conflits;
  }
  const outils = { repartirDefile, conflitsDefile };
  if (typeof module !== 'undefined' && module.exports) module.exports = outils;
  else Object.assign(racine, outils);
})(typeof window !== 'undefined' ? window : globalThis);
