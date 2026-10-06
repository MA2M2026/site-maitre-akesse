// Tailles calculées à partir des mensurations + équivalences internationales
// (décision de la propriétaire, 06/10/2026). Les tailles ne sont JAMAIS saisies :
// elles découlent des mensurations, pour qu'un recruteur voie toujours un profil
// cohérent. Chaque taille correspond à UNE mensuration (haut : poitrine ; bas :
// hanches pour les femmes, tour de taille pour les hommes) ; si haut et bas
// diffèrent, la taille générale l'indique (ex. « S-M »).
// Fichier partagé : Espace mannequin, fiche publique FR/EN, compcard, CV, fiche
// événement. Barèmes standard du prêt-à-porter (fourchettes en cm).
(function () {
  // Femmes — fourchettes de tour de poitrine (haut) et de hanches (bas), bornes incluses.
  var FEMMES = [
    { l: 'XXS', poitrine: [0, 77], hanches: [0, 85], fr: 32, it: 36, uk: 4, us: 0, br: 34, jp: 3, kr: 33, cn: '150/76A' },
    { l: 'XS', poitrine: [78, 81], hanches: [86, 89], fr: 34, it: 38, uk: 6, us: 2, br: 36, jp: 5, kr: 44, cn: '155/80A' },
    { l: 'S', poitrine: [82, 85], hanches: [90, 93], fr: 36, it: 40, uk: 8, us: 4, br: 38, jp: 7, kr: 55, cn: '160/84A' },
    { l: 'M', poitrine: [86, 89], hanches: [94, 97], fr: 38, it: 42, uk: 10, us: 6, br: 40, jp: 9, kr: 66, cn: '165/88A' },
    { l: 'L', poitrine: [90, 93], hanches: [98, 101], fr: 40, it: 44, uk: 12, us: 8, br: 42, jp: 11, kr: 77, cn: '170/92A' },
    { l: 'XL', poitrine: [94, 99], hanches: [102, 107], fr: 42, it: 46, uk: 14, us: 10, br: 44, jp: 13, kr: 88, cn: '175/96A' },
    { l: 'XXL', poitrine: [100, 105], hanches: [108, 113], fr: 44, it: 48, uk: 16, us: 12, br: 46, jp: 15, kr: 99, cn: '180/100A' },
    { l: 'XXXL', poitrine: [106, 999], hanches: [114, 999], fr: 46, it: 50, uk: 18, us: 14, br: 48, jp: 17, kr: 110, cn: '185/104A' }
  ];
  // Hommes — fourchettes de tour de poitrine (haut) et de tour de taille (bas).
  var HOMMES = [
    { l: 'XXS', poitrine: [0, 81], taille: [0, 67], eu: 42, pantalon: 36, us: 32, w: 26, br: 'PP', kr: 85, cn: '160/80A' },
    { l: 'XS', poitrine: [82, 87], taille: [68, 72], eu: 44, pantalon: 38, us: 34, w: 28, br: 'PP', kr: 90, cn: '165/84A' },
    { l: 'S', poitrine: [88, 93], taille: [73, 77], eu: 46, pantalon: 40, us: 36, w: 30, br: 'P', kr: 95, cn: '170/88A' },
    { l: 'M', poitrine: [94, 99], taille: [78, 83], eu: 48, pantalon: 42, us: 38, w: 32, br: 'M', kr: 100, cn: '175/92A' },
    { l: 'L', poitrine: [100, 105], taille: [84, 89], eu: 50, pantalon: 44, us: 40, w: 34, br: 'G', kr: 105, cn: '180/96A' },
    { l: 'XL', poitrine: [106, 111], taille: [90, 95], eu: 52, pantalon: 46, us: 42, w: 36, br: 'GG', kr: 110, cn: '185/100A' },
    { l: 'XXL', poitrine: [112, 117], taille: [96, 101], eu: 54, pantalon: 48, us: 44, w: 38, br: 'XGG', kr: 115, cn: '190/104A' },
    { l: 'XXXL', poitrine: [118, 999], taille: [102, 999], eu: 56, pantalon: 50, us: 46, w: 40, br: 'XGG', kr: 120, cn: '195/108A' }
  ];
  var ORDRE = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  function nombre(v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) && n > 0 ? n : null; }
  function ligne(table, cle, mesure) {
    var m = nombre(mesure); if (m == null) return null;
    m = Math.round(m);
    for (var i = 0; i < table.length; i++) if (m >= table[i][cle][0] && m <= table[i][cle][1]) return table[i];
    return null;
  }
  function generale(a, b) {
    if (a && b) {
      if (a === b) return a;
      var i = ORDRE.indexOf(a), j = ORDRE.indexOf(b);
      return i < j ? a + '-' + b : b + '-' + a;
    }
    return a || b || null;
  }
  function pouces(cm) { return cm ? Math.round(cm / 2.54 * 10) / 10 : null; }
  function piedsPouces(cm) {
    if (!cm) return null;
    var p = Math.round(cm / 2.54), pieds = Math.floor(p / 12);
    return pieds + '′' + (p - pieds * 12) + '″';
  }
  // Pointure : correspondances standard (femmes et hommes diffèrent au Royaume-Uni et aux États-Unis).
  var POINTURES_F = { 35: [2.5, 5], 36: [3.5, 6], 37: [4, 6.5], 38: [5, 7.5], 39: [6, 8.5], 40: [6.5, 9], 41: [7.5, 10], 42: [8, 10.5], 43: [9, 11.5], 44: [9.5, 12] };
  var POINTURES_H = { 38: [5, 6], 39: [6, 7], 40: [6.5, 7.5], 41: [7.5, 8.5], 42: [8, 9], 43: [9, 10], 44: [9.5, 10.5], 45: [10.5, 11.5], 46: [11, 12], 47: [12, 13], 48: [12.5, 13.5] };
  function pointures(eu, homme) {
    var n = nombre(eu); if (n == null) return null;
    var t = (homme ? POINTURES_H : POINTURES_F)[Math.round(n)];
    var uk = t ? t[0] : Math.round((homme ? n - 34 : n - 33.5) * 2) / 2;
    var us = t ? t[1] : uk + (homme ? 1 : 2.5);
    var mm = Math.round(((n / 1.5) - 1.5) * 2) / 2 * 10; // longueur du pied, système asiatique (mm)
    return { eu: n, uk: uk, us: us, asie: mm };
  }

  // p : { category ('femme'|'homme'), chest_cm, waist_cm, hips_cm, neck_cm, height_cm, weight_kg, shoe_size }
  window.ma2mTailles = function (p) {
    p = p || {};
    var homme = p.category === 'homme';
    var haut, bas, r = { homme: homme };
    if (homme) {
      haut = ligne(HOMMES, 'poitrine', p.chest_cm);
      bas = ligne(HOMMES, 'taille', p.waist_cm);
      r.haut = haut && { lettre: haut.l, eu: haut.eu, it: haut.eu, uk: haut.us, us: haut.us, br: haut.br, kr: haut.kr, cn: haut.cn };
      r.bas = bas && { lettre: bas.l, eu: bas.pantalon, it: bas.pantalon, uk: 'W' + bas.w, us: 'W' + bas.w, br: bas.pantalon - 2, kr: bas.w, cn: bas.cn };
      var cou = nombre(p.neck_cm);
      r.chemise = cou ? { eu: Math.round(cou), us: Math.round(cou / 2.54 * 2) / 2 } : null;
      var poitrine = nombre(p.chest_cm);
      r.costume = poitrine ? { eu: Math.round(poitrine / 4) * 2, us: Math.round(poitrine / 4) * 2 - 10 } : null;
    } else {
      haut = ligne(FEMMES, 'poitrine', p.chest_cm);
      bas = ligne(FEMMES, 'hanches', p.hips_cm);
      var vers = function (x) { return x && { lettre: x.l, eu: x.fr, it: x.it, uk: x.uk, us: x.us, br: x.br, jp: x.jp, kr: x.kr, cn: x.cn }; };
      r.haut = vers(haut); r.bas = vers(bas);
    }
    r.generale = generale(r.haut && r.haut.lettre, r.bas && r.bas.lettre);
    r.pointure = pointures(p.shoe_size, homme);
    r.hauteur = nombre(p.height_cm) ? { cm: nombre(p.height_cm), pieds: piedsPouces(nombre(p.height_cm)) } : null;
    r.poids = nombre(p.weight_kg) ? { kg: nombre(p.weight_kg), lb: Math.round(nombre(p.weight_kg) * 2.2046) } : null;
    r.pouces = pouces;
    return r;
  };

  // Texte court d'une taille : « S / 36 » (lettre + taille européenne).
  window.ma2mTailleCourte = function (t) { return t ? t.lettre + ' / ' + t.eu : ''; };
})();
