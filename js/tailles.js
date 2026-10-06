// Tailles calculées à partir des mensurations + équivalences internationales
// (décision de la propriétaire, 06/10/2026). Les tailles ne sont JAMAIS saisies :
// elles découlent des mensurations, pour qu'un recruteur voie toujours un profil
// cohérent. Option A : la taille retenue est celle de la plus grande des mesures
// (femmes : haut = poitrine et taille, bas = bassin et taille ; hommes : haut =
// poitrine, bas = taille et bassin) ; si haut et bas diffèrent, la taille générale
// l'indique (ex. « S-M »). Au-delà de L (grille MA2M) : « mensurations
// excessives » signalées.
// Fichier partagé : Espace mannequin, fiche publique FR/EN, compcard, CV, fiche
// événement. Tailles selon la grille des mensurations MA2M ; équivalences étrangères
// selon les correspondances standard du prêt-à-porter.
(function () {
  // Femmes — fourchettes de tour de poitrine (haut) et de hanches (bas), bornes incluses.
  var FEMMES = [
    { l: 'XXS', poitrine: [0, 77], taille: [0, 57], hanches: [0, 83], fr: 32, it: 36, uk: 4, us: 0, br: 34, jp: 3, kr: 33, cn: '150/76A' },
    { l: 'XS', poitrine: [78, 83], taille: [58, 63], hanches: [84, 89], fr: 34, it: 38, uk: 6, us: 2, br: 36, jp: 5, kr: 44, cn: '155/80A' },
    { l: 'S', poitrine: [84, 87], taille: [64, 67], hanches: [90, 93], fr: 36, it: 40, uk: 8, us: 4, br: 38, jp: 7, kr: 55, cn: '160/84A' },
    { l: 'M', poitrine: [88, 93], taille: [68, 73], hanches: [94, 99], fr: 38, it: 42, uk: 10, us: 6, br: 40, jp: 9, kr: 66, cn: '165/88A' },
    { l: 'L', poitrine: [94, 100], taille: [74, 80], hanches: [100, 106], fr: 40, it: 44, uk: 12, us: 8, br: 42, jp: 11, kr: 77, cn: '170/92A' },
    { l: 'XL', poitrine: [101, 106], taille: [81, 86], hanches: [107, 112], fr: 42, it: 46, uk: 14, us: 10, br: 44, jp: 13, kr: 88, cn: '175/96A' },
    { l: 'XXL', poitrine: [107, 112], taille: [87, 92], hanches: [113, 118], fr: 44, it: 48, uk: 16, us: 12, br: 46, jp: 15, kr: 99, cn: '180/100A' },
    { l: 'XXXL', poitrine: [113, 999], taille: [93, 999], hanches: [119, 999], fr: 46, it: 50, uk: 18, us: 14, br: 48, jp: 17, kr: 110, cn: '185/104A' }
  ];
  // Hommes — tour de poitrine, tour de taille, tour de bassin, bornes incluses.
  var HOMMES = [
    { l: 'XXS', poitrine: [0, 85], taille: [0, 67], bassin: [0, 83], eu: 42, pantalon: 36, us: 32, w: 26, br: 'PP', kr: 85, cn: '160/80A' },
    { l: 'XS', poitrine: [86, 91], taille: [68, 73], bassin: [84, 89], eu: 44, pantalon: 38, us: 34, w: 28, br: 'PP', kr: 90, cn: '165/84A' },
    { l: 'S', poitrine: [92, 95], taille: [74, 77], bassin: [90, 93], eu: 46, pantalon: 40, us: 36, w: 30, br: 'P', kr: 95, cn: '170/88A' },
    { l: 'M', poitrine: [96, 101], taille: [78, 83], bassin: [94, 99], eu: 48, pantalon: 42, us: 38, w: 32, br: 'M', kr: 100, cn: '175/92A' },
    { l: 'L', poitrine: [102, 108], taille: [84, 90], bassin: [100, 106], eu: 50, pantalon: 44, us: 40, w: 34, br: 'G', kr: 105, cn: '180/96A' },
    { l: 'XL', poitrine: [109, 114], taille: [91, 96], bassin: [107, 112], eu: 52, pantalon: 46, us: 42, w: 36, br: 'GG', kr: 110, cn: '185/100A' },
    { l: 'XXL', poitrine: [115, 120], taille: [97, 102], bassin: [113, 118], eu: 54, pantalon: 48, us: 44, w: 38, br: 'XGG', kr: 115, cn: '190/104A' },
    { l: 'XXXL', poitrine: [121, 999], taille: [103, 999], bassin: [119, 999], eu: 56, pantalon: 50, us: 46, w: 40, br: 'XGG', kr: 120, cn: '195/108A' }
  ];
  var ORDRE = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  function nombre(v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) && n > 0 ? n : null; }
  function ligne(table, cle, mesure) {
    var m = nombre(mesure); if (m == null) return null;
    m = Math.round(m);
    for (var i = 0; i < table.length; i++) if (m >= table[i][cle][0] && m <= table[i][cle][1]) return table[i];
    return null;
  }
  // Option A (décision de la propriétaire, 06/10/2026) : la taille retenue est celle de
  // la PLUS GRANDE des mesures concernées — le vêtement doit fermer partout.
  // base : taille de la mesure principale ; extras : [cle, mesure, champ] (tour de taille,
  // bassin des hommes). Un extra plus grand de plus de 2 tailles que la base est
  // sûrement une erreur de saisie : il n'est pas retenu et il est noté dans suspects.
  function plusGrande(table, base, extras, suspects) {
    var r = base;
    if (!base) return null;
    extras.forEach(function (m) {
      var x = ligne(table, m[0], m[1]);
      if (!x) return;
      if (ORDRE.indexOf(x.l) - ORDRE.indexOf(base.l) > 2) { if (suspects.indexOf(m[2]) === -1) suspects.push(m[2]); return; }
      if (ORDRE.indexOf(x.l) > ORDRE.indexOf(r.l)) r = x;
    });
    return r;
  }
  // Taille maximum d'un mannequin (décision du 06/10/2026) : au-delà, « mensurations
  // excessives » (signalées à la mannequin et à l'agence, sans rien cacher).
  var MAX_FEMMES = 'L', MAX_HOMMES = 'L'; // la grille MA2M s'arrête à L
  window.ma2mReperesTailles = function (homme) {
    var t = homme ? HOMMES : FEMMES, fmt = function (x) { return x[0] + ' à ' + (x[1] >= 999 ? '…' : x[1]) + ' cm'; };
    return t.filter(function (x) { return ['S', 'M', 'L', 'XL'].indexOf(x.l) !== -1 && ORDRE.indexOf(x.l) <= ORDRE.indexOf(homme ? MAX_HOMMES : MAX_FEMMES); }).map(function (x) {
      return x.l + ' : poitrine ' + fmt(x.poitrine) + ', taille ' + fmt(x.taille) + ', bassin ' + fmt(homme ? x.bassin : x.hanches);
    });
  };

  // Texte de l'alerte « mensurations excessives » (Espace et message WhatsApp du
  // rapport des profils) : lignes de texte simple, sans HTML.
  window.ma2mTexteExces = function (t) {
    return ['Mensurations excessives : votre taille calculée (' + t.generale + ') dépasse la taille maximum d’un mannequin ' + (t.homme ? 'homme' : 'femme') + ' (' + t.maximum + '). Vérifiez vos mesures avec un mètre ruban, à plat, sans serrer et sans vêtement épais. Repères :']
      .concat(window.ma2mReperesTailles(t.homme));
  };

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
    return pieds + "'" + (p - pieds * 12) + '"';
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
    // Contrôle de cohérence sur les mesures principales (même règle que la base) ;
    // tailles affichées : la plus grande des mesures (option A).
    var hautBrut, basBrut;
    r.aVerifier = []; // mesure secondaire écartée car invraisemblable (erreur de saisie probable)
    if (homme) {
      hautBrut = haut = ligne(HOMMES, 'poitrine', p.chest_cm);
      basBrut = ligne(HOMMES, 'taille', p.waist_cm);
      bas = plusGrande(HOMMES, basBrut, [['bassin', p.hips_cm, 'hips_cm']], r.aVerifier);
      r.haut = haut && { lettre: haut.l, eu: haut.eu, it: haut.eu, uk: haut.us, us: haut.us, br: haut.br, kr: haut.kr, cn: haut.cn };
      r.bas = bas && { lettre: bas.l, eu: bas.pantalon, it: bas.pantalon, uk: 'W' + bas.w, us: 'W' + bas.w, br: bas.pantalon - 2, kr: bas.w, cn: bas.cn };
      var cou = nombre(p.neck_cm);
      r.chemise = cou ? { eu: Math.round(cou), us: Math.round(cou / 2.54 * 2) / 2 } : null;
      var poitrine = nombre(p.chest_cm);
      r.costume = poitrine ? { eu: Math.round(poitrine / 4) * 2, us: Math.round(poitrine / 4) * 2 - 10 } : null;
    } else {
      hautBrut = ligne(FEMMES, 'poitrine', p.chest_cm);
      basBrut = ligne(FEMMES, 'hanches', p.hips_cm);
      haut = plusGrande(FEMMES, hautBrut, [['taille', p.waist_cm, 'waist_cm']], r.aVerifier);
      bas = plusGrande(FEMMES, basBrut, [['taille', p.waist_cm, 'waist_cm']], r.aVerifier);
      var vers = function (x) { return x && { lettre: x.l, eu: x.fr, it: x.it, uk: x.uk, us: x.us, br: x.br, jp: x.jp, kr: x.kr, cn: x.cn }; };
      r.haut = vers(haut); r.bas = vers(bas);
    }
    // Contrôle de cohérence (décision de la propriétaire, 06/10/2026) : si le haut et le
    // bas s'écartent de plus d'une taille (ex. M en haut, XL en bas), une mesure est
    // sûrement fausse. Les mesures en cause sont signalées « à reprendre » et AUCUNE
    // taille n'est donnée tant qu'elles ne sont pas corrigées.
    // Morphologies africaines (décision du 06/10/2026) : chez les femmes, des hanches
    // plus fortes que la poitrine sont fréquentes (jusqu'à 2 tailles d'écart admises,
    // l'inverse 1 seule) ; chez les hommes, une poitrine plus forte que le tour de
    // taille (silhouette athlétique) : 2 tailles admises, l'inverse 1 seule.
    // MÊME RÈGLE côté base : fonction mesures_incoherentes (Extension 121).
    r.aReprendre = [];
    var ecart = hautBrut && basBrut ? ORDRE.indexOf(basBrut.l) - ORDRE.indexOf(hautBrut.l) : 0;
    if (homme ? (ecart < -2 || ecart > 1) : (ecart > 2 || ecart < -1)) {
      r.aReprendre = ['chest_cm', homme ? 'waist_cm' : 'hips_cm'];
      r.haut = null; r.bas = null; r.costume = null;
    }
    r.generale = generale(r.haut && r.haut.lettre, r.bas && r.bas.lettre);
    var plusGrandeLettre = [r.haut, r.bas].filter(Boolean).map(function (x) { return x.lettre; }).sort(function (a, b) { return ORDRE.indexOf(b) - ORDRE.indexOf(a); })[0];
    r.maximum = homme ? MAX_HOMMES : MAX_FEMMES;
    r.exces = !!plusGrandeLettre && ORDRE.indexOf(plusGrandeLettre) > ORDRE.indexOf(r.maximum);
    r.pointure = pointures(p.shoe_size, homme);
    r.hauteur = nombre(p.height_cm) ? { cm: nombre(p.height_cm), pieds: piedsPouces(nombre(p.height_cm)) } : null;
    r.poids = nombre(p.weight_kg) ? { kg: nombre(p.weight_kg), lb: Math.round(nombre(p.weight_kg) * 2.2046) } : null;
    r.pouces = pouces;
    return r;
  };

  // Texte court d'une taille : « S / 36 » (lettre + taille européenne).
  window.ma2mTailleCourte = function (t) { return t ? t.lettre + ' / ' + t.eu : ''; };

  // Taille vêtements affichée partout (fiche, compcard, CV) : calculée d'après les
  // mensurations ; à défaut, l'ancienne taille déclarée (profil pas encore mis à jour).
  // Mesures à reprendre : la fiche publique et la compcard cachent les mensurations.
  window.ma2mMesuresAReprendre = function (p) { return window.ma2mTailles(p).aReprendre.length > 0; };

  // Mesures à reprendre : aucune taille (pas même l'ancienne taille déclarée).
  window.ma2mTailleVetements = function (p) {
    var t = window.ma2mTailles(p);
    if (t.aReprendre.length) return '';
    return t.generale || (p && p.clothing_size) || '';
  };

  // Mensurations de l'Extension 121 (épaules, bras, cou, tête), lues à part : si la
  // base ne les a pas encore, la page s'affiche quand même, sans elles.
  window.ma2mMesuresSupp = async function (id) {
    try {
      var r = await sb.from('model_profiles').select('shoulder_cm, arm_cm, neck_cm, head_cm').eq('id', id).maybeSingle();
      return (r && !r.error && r.data) || {};
    } catch (e) { return {}; }
  };

  // Tableau « Tailles & équivalences internationales » de la fiche publique (FR/EN).
  // Chaîne vide si aucune taille ne peut être calculée.
  window.ma2mBlocEquivalences = function (p, anglais) {
    var t = window.ma2mTailles(p);
    if (t.aReprendre.length) return '';
    // TR : la Turquie suit la numérotation européenne (vêtements et chaussures).
    var cols = t.homme ? ['eu', 'it', 'uk', 'us', 'tr', 'br', 'kr', 'cn'] : ['eu', 'it', 'uk', 'us', 'tr', 'br', 'jp', 'kr', 'cn'];
    var titres = { eu: anglais ? 'EU' : 'FR / EU', it: 'IT', uk: 'UK', us: 'US', tr: 'TR', br: 'BR', jp: 'JP', kr: 'KR', cn: 'CN' };
    var lignes = [];
    function rangee(libelle, lettre, valeurs) {
      valeurs.tr = valeurs.eu;
      lignes.push('<tr><th scope="row">' + libelle + '</th><td class="eq-lettre">' + (lettre || '') + '</td>' +
        cols.map(function (c) { var v = valeurs[c]; return '<td>' + (v === undefined || v === null || v === '' ? '—' : String(v)) + '</td>'; }).join('') + '</tr>');
    }
    if (t.haut) rangee(anglais ? 'Top' : 'Haut', t.haut.lettre, Object.assign({}, t.haut));
    if (t.bas) rangee(anglais ? 'Bottom' : 'Bas', t.bas.lettre, Object.assign({}, t.bas));
    // Taille générale : celle du haut et du bas réunies (ex. M-XL → 38-42 en France)
    // (femmes seulement : chez les hommes, veste et pantalon n'ont pas la même
    // numérotation ; leur taille générale est dans le compartiment « Vêtements »)
    if (!t.homme && t.haut && t.bas) {
      var gen = {}, petit = t.haut, grand = t.bas;
      if (ORDRE.indexOf(petit.lettre) > ORDRE.indexOf(grand.lettre)) { petit = t.bas; grand = t.haut; }
      ['eu', 'it', 'uk', 'us', 'br', 'jp', 'kr', 'cn'].forEach(function (c) {
        var h = petit[c], b = grand[c];
        gen[c] = (h === undefined || b === undefined) ? '' : (String(h) === String(b) ? h : h + '-' + b);
      });
      rangee(anglais ? 'Overall' : 'Générale', t.generale, gen);
    }
    if (t.pointure) {
      var pt = t.pointure, cmPied = pt.asie / 10;
      rangee(anglais ? 'Shoes' : 'Pointure', '', { eu: pt.eu, it: pt.eu, uk: pt.uk, us: pt.us, br: pt.eu - 2, jp: cmPied, kr: pt.asie, cn: pt.asie });
    }
    if (t.chemise) rangee(anglais ? 'Shirt (collar)' : 'Chemise (col)', '', { eu: t.chemise.eu, it: t.chemise.eu, uk: t.chemise.us, us: t.chemise.us });
    if (!lignes.length) return '';
    // Compartiment court (haut, bas, vêtements) toujours visible ; le grand tableau
    // ne s'ouvre que sur demande (<details>, sans script) pour ne pas allonger la page.
    var court = function (x) { return x ? x.lettre + ' <span>' + (anglais ? 'EU ' : '') + x.eu + '</span>' : '—'; };
    var compartiment = (t.haut || t.bas) ? '<dl class="fiche-tailles">' +
      '<div><dt>' + (anglais ? 'Top' : 'Taille haut') + '</dt><dd>' + court(t.haut) + '</dd></div>' +
      '<div><dt>' + (anglais ? 'Bottom' : 'Taille bas') + '</dt><dd>' + court(t.bas) + '</dd></div>' +
      '<div><dt>' + (anglais ? 'Clothing' : 'Vêtements') + '</dt><dd>' + (t.generale || '—') + '</dd></div></dl>' : '';
    return '<section class="fiche-equivalences" aria-label="' + (anglais ? 'Sizes' : 'Tailles') + '">' + compartiment +
      '<details><summary>' + (anglais ? 'See international size conversions' : 'Voir les équivalences internationales') + '</summary>' +
      '<div class="eq-defilement"><table><thead><tr><th></th><th>' + (anglais ? 'Size' : 'Taille') + '</th>' +
      cols.map(function (c) { return '<th scope="col">' + titres[c] + '</th>'; }).join('') + '</tr></thead><tbody>' + lignes.join('') + '</tbody></table></div>' +
      '<p class="eq-note">' + (anglais ? 'Calculated from the measurements (MA2M size chart, standard international conversions). Shoes: JP in cm, KR / CN in mm.' : 'Calculées d’après les mensurations (grille MA2M, correspondances internationales standard). Pointure : JP en cm, KR / CN en mm.') + '</p>' +
      '</details></section>';
  };
})();
