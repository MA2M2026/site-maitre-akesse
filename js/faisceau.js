// Animation « faisceau de lumière » du logo MA2M (modèle 2 choisi par la propriétaire,
// 04/10/2026), partagée par l'intro de l'accueil (js/intro-faisceau.js) et la couverture
// en haut de l'accueil (js/couverture-faisceau.js).
// Dans le noir, une ligne de lumière naît au centre ; un rayon balaie et révèle
// « MAÎTRE AKESSE » ; « MODEL MANAGEMENT » apparaît, le trait rouge se dessine depuis le
// centre, le triangle rouge tombe à sa place, puis un reflet traverse le logo.
// Dessiné en direct dans un <canvas> : aucune vidéo à télécharger.
//   ma2mFaisceau(canvas, { mode: 'intro' | 'couverture', duree, mesurer: () => ({ W, H }) })
//   → { pret (promesse : image chargée), dimensionner(), dessiner(t) }
window.ma2mFaisceau = function (cv, opts) {
  var ctx = cv.getContext('2d');
  var prefixe = /\/en\//.test(location.pathname) ? '../' : '';
  var logo = new Image();
  var pret = new Promise(function (ok, ko) { logo.onload = ok; logo.onerror = ko; });
  logo.src = prefixe + 'assets/logo-intro.png';

  // Bandes horizontales du logo (mesurées sur assets/logo-intro.png, 1496 × 400)
  var B = { tri: [0, 77], titre: [77, 270], sous: [290, 350], trait: [355, 400] };
  var TRI = { x0: 323, x1: 406 };
  var LW = 1496, LH = 400;
  var W, H, dpr, S, OX, OY, f, faisceau = null, refletCv = null, poussieres = [];
  var couverture = opts.mode === 'couverture', DUREE = opts.duree || 7.2;

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function lisse(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function eIO(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function eOut(x) { return 1 - Math.pow(1 - x, 3); }
  function eBack(x) { var c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }

  // Graine fixe : la poussière est la même à chaque visite
  var graine = 1004;
  function hasard() { graine = (graine * 16807) % 2147483647; return (graine - 1) / 2147483646; }
  for (var i = 0; i < 50; i++) poussieres.push({ x: hasard(), y: hasard(), v: .01 + hasard() * .03, z: .4 + hasard(), ph: hasard() * 6.28 });

  function dimensionner() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var dim = opts.mesurer(); W = Math.max(1, dim.W); H = Math.max(1, dim.H);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var largeur = couverture ? Math.min(W * .72, 640, H * .42 * LW / LH) : Math.min(W * .82, 600, H * .9 * LW / LH);
    S = largeur / LW; OX = W / 2; OY = H / 2; f = largeur / 620;
    // Rayon lumineux pré-dessiné une fois (traînée douce), sans filtre de flou :
    // ctx.filter n'existe pas sur tous les téléphones (Safari).
    var tw = Math.max(8, Math.round(LW * S * .16 * dpr)), th = Math.max(8, Math.round(LH * S * 1.5 * dpr));
    faisceau = document.createElement('canvas'); faisceau.width = tw; faisceau.height = th;
    var fc = faisceau.getContext('2d'), img = fc.createImageData(tw, th), d = img.data;
    for (var y = 0; y < th; y++) {
      var vy = 1 - Math.pow(Math.abs(y / th * 2 - 1), 2);
      for (var x = 0; x < tw; x++) {
        var u = x / tw, h = u < .9 ? Math.pow(u / .9, 2.2) : 1 - (u - .9) / .1;
        var o = (y * tw + x) * 4; d[o] = 255; d[o + 1] = 235; d[o + 2] = 230; d[o + 3] = 255 * .35 * h * vy;
      }
    }
    fc.putImageData(img, 0, 0);
  }

  function bande(b, x0, x1, dx, dy, alpha, sx) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(OX + dx, OY + dy); ctx.scale(S * (sx || 1), S); ctx.translate(-LW / 2, -LH / 2);
    ctx.beginPath(); ctx.rect(x0, b[0], x1 - x0, b[1] - b[0]); ctx.clip();
    ctx.drawImage(logo, 0, 0); ctx.restore();
  }
  function logoNet(alpha, lueur) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(OX, OY); ctx.scale(S, S); ctx.translate(-LW / 2, -LH / 2);
    if (lueur > 0) { ctx.shadowColor = 'rgba(255,220,210,' + lueur + ')'; ctx.shadowBlur = 20 * f * dpr; }
    ctx.drawImage(logo, 0, 0); ctx.restore();
  }
  function reflet(u) {
    if (u <= 0 || u >= 1) return;
    var oc = refletCv || (refletCv = document.createElement('canvas'));
    oc.width = Math.ceil(LW * S * dpr); oc.height = Math.ceil(LH * S * dpr);
    var o = oc.getContext('2d'); o.clearRect(0, 0, oc.width, oc.height);
    o.drawImage(logo, 0, 0, oc.width, oc.height); o.globalCompositeOperation = 'source-in';
    var bx = (-.3 + 1.6 * eIO(u)) * oc.width, g = o.createLinearGradient(bx - oc.width * .12, 0, bx + oc.width * .12, oc.height * .4);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    o.fillStyle = g; o.fillRect(0, 0, oc.width, oc.height);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(oc, OX - LW * S / 2, OY - LH * S / 2, LW * S, LH * S); ctx.restore();
  }

  function dessiner(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var k = Math.max(W, H), lw = LW * S, gauche = OX - lw / 2, g, h;
    // fond : noir, halo bordeaux qui respire
    ctx.fillStyle = '#050304'; ctx.fillRect(0, 0, W, H);
    var force = lisse(1.6, 3.6, t);
    if (force > 0) {
      var hx = W * (.5 + .12 * Math.sin(t * .5)), hy = H * (.5 + .05 * Math.cos(t * .4));
      g = ctx.createRadialGradient(hx, hy, 0, hx, hy, k * .55);
      g.addColorStop(0, 'rgba(122,18,32,' + (.26 * force) + ')'); g.addColorStop(.5, 'rgba(70,8,18,' + (.12 * force) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // poussière
    var a0 = lisse(1.4, 3, t);
    if (a0 > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < poussieres.length; i++) {
        var p = poussieres[i], py = (((p.y - t * p.v) % 1) + 1) % 1 * H;
        ctx.fillStyle = 'rgba(255,228,220,' + Math.max(0, (.15 + .2 * Math.sin(t * 1.7 + p.ph * 3)) * a0 * p.z) + ')';
        ctx.beginPath(); ctx.arc(p.x * W, py, .9 * p.z * f, 0, 6.283); ctx.fill();
      }
      ctx.restore();
    }
    // 1) une ligne de lumière naît au centre et s'étire
    var nait = lisse(.35, 1.3, t), eteint = 1 - lisse(1.5, 2.2, t);
    if (nait > 0 && eteint > 0) {
      var larg = W * .9 * eOut(nait);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      g = ctx.createLinearGradient(OX - larg / 2, 0, OX + larg / 2, 0);
      g.addColorStop(0, 'rgba(255,230,225,0)'); g.addColorStop(.5, 'rgba(255,240,236,' + (.95 * eteint) + ')'); g.addColorStop(1, 'rgba(255,230,225,0)');
      ctx.fillStyle = g; ctx.fillRect(OX - larg / 2, OY - 1.2, larg, 2.4);
      h = ctx.createRadialGradient(OX, OY, 0, OX, OY, Math.max(1, larg * .35));
      h.addColorStop(0, 'rgba(213,84,104,' + (.35 * eteint) + ')'); h.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = h; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    // 2) un rayon vertical balaie de gauche à droite et révèle les lettres
    var u = lisse(1.5, 3.4, t), bx = gauche - lw * .08 + lw * 1.16 * u;
    if (t > 1.5) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, bx, H); ctx.clip(); bande(B.titre, 0, LW, 0, 0, 1); ctx.restore();
      if (u < 1) {
        var hh = LH * S * 1.5, tr = lw * .16;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(faisceau, bx - tr, OY - hh / 2, tr + 6 * f, hh);
        var c = ctx.createLinearGradient(0, OY - hh * .6, 0, OY + hh * .6);
        c.addColorStop(0, 'rgba(255,250,248,0)'); c.addColorStop(.5, 'rgba(255,250,248,.95)'); c.addColorStop(1, 'rgba(255,250,248,0)');
        ctx.fillStyle = c; ctx.fillRect(bx - 1.5 * f, OY - hh * .6, 3 * f, hh * 1.2);
        ctx.restore();
      }
    }
    // 3) « MODEL MANAGEMENT » apparaît en se resserrant
    var s3 = lisse(3.0, 4.0, t);
    if (s3 > 0) bande(B.sous, 0, LW, 0, 8 * f * (1 - s3), s3, 1.12 - .12 * eOut(s3));
    // 4) le trait rouge se dessine depuis le centre
    var s4 = eIO(lisse(3.6, 4.4, t));
    if (s4 > 0) { var cx = LW / 2 + 14, demi = 400 * s4; bande(B.trait, cx - demi, cx + demi, 0, 0, 1); }
    // 5) le triangle rouge tombe à sa place
    var s5 = clamp((t - 4.3) / .7, 0, 1);
    if (s5 > 0) {
      ctx.save(); ctx.shadowColor = 'rgba(230,40,60,.8)'; ctx.shadowBlur = (30 * (1 - lisse(5, 6, t)) + 6) * dpr;
      bande(B.tri, TRI.x0, TRI.x1, 0, -(1 - eBack(s5)) * 120 * S * 3, lisse(0, .3, s5)); ctx.restore();
    }
    if (t > 5.0) {
      var ha = Math.exp(-(t - 5.0) * 3) + (couverture ? .25 * lisse(6, 8, t) * (.6 + .4 * Math.sin(t * .8)) : 0);
      g = ctx.createRadialGradient(OX, OY, 0, OX, OY, lw * .7);
      g.addColorStop(0, 'rgba(150,22,40,' + (.45 * ha) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      logoNet(lisse(5.0, 5.4, t), .35);
    }
    // couverture : une fois le logo formé, il reste en place et un reflet repasse toutes les 9 s
    reflet(couverture && t > 6.6 ? ((t - 5.4) % 9) / 1.2 : (t - 5.4) / 1.2);
    // vignettage, ouverture et fermeture au noir
    var v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.hypot(W, H) * .6);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.75)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    var noir = 1 - lisse(0, .5, t) + (couverture ? 0 : lisse(DUREE - .45, DUREE, t));
    if (noir > 0) { ctx.fillStyle = 'rgba(0,0,0,' + clamp(noir, 0, 1) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  return { pret: pret, dimensionner: dimensionner, dessiner: dessiner };
};
