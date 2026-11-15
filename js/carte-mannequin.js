// Carte « MANNEQUIN MA2M » (maquette validée par la propriétaire le 15/11/2026 :
// maquettes/carte-identite-mannequin-v2.html), DESSINÉE une seule fois ici sur un canvas : la même image sert à
// l'écran (application des mannequins, « Mon profil »), au téléchargement (recto + verso en une image) et à
// l'impression (PDF au vrai format carte, 85,6 × 54 mm). Données : ma_carte_mannequin (supabase-carte-mannequin.sql).
// Outils partagés de js/app.js : chargerQrLib, dessinerQrCanvas, chargerJsPdf, telechargerFichier, horodatageFichier.
window.CarteMannequin = (function () {
  'use strict';
  const W = 1012, H = 638;            // 85,6 × 54 mm à ~300 points par pouce
  const u = W / 358;                  // 1 « point » de la maquette (carte de 358 px de large)
  const ROSE = '#EBC9CE', ROSE_CLAIR = '#F6E3E6';
  const images = {};
  const image = (src) => images[src] || (images[src] = new Promise((ok) => {
    const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src;
  }));
  async function polices() {
    if (!document.fonts || !document.fonts.load) return;
    await Promise.all(['500 23px "Cormorant Garamond"', 'italic 400 18px "Cormorant Garamond"', '400 10px "Work Sans"', '500 10px "Work Sans"', '300 10px "Work Sans"', '600 10px "Work Sans"']
      .map((f) => document.fonts.load(f).catch(() => null)));
  }
  // texte avec espacement des lettres (comme letter-spacing), aligné à gauche, au centre ou à droite
  function texte(ctx, t, x, y, police, couleur, espace, aligne) {
    ctx.font = police; ctx.fillStyle = couleur; ctx.textBaseline = 'alphabetic';
    const e = (espace || 0) * u, lettres = Array.from(String(t));
    const largeur = lettres.reduce((s, c) => s + ctx.measureText(c).width + e, 0) - e;
    let cx = aligne === 'right' ? x - largeur : aligne === 'center' ? x - largeur / 2 : x;
    if (!e) { ctx.textAlign = 'left'; ctx.fillText(t, cx, y); return largeur; }
    lettres.forEach((c) => { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + e; });
    return largeur;
  }
  function arrondi(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // image « cover » dans un cadre (position verticale 18 % : le visage)
  function couvrir(ctx, img, x, y, w, h) {
    const k = Math.max(w / img.width, h / img.height), sw = w / k, sh = h / k;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) * 0.18, sw, sh, x, y, w, h);
  }
  // fond commun : dégradé rouge, guillochis (vagues fines), reflet, bord
  function fond(ctx) {
    arrondi(ctx, 0, 0, W, H, 16 * u); ctx.clip();
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 1.3);
    g.addColorStop(0, '#9A2B36'); g.addColorStop(0.45, '#6E1A22'); g.addColorStop(1, '#3E0C12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.1 * W / 856;
    for (let k = 0; k < 26; k++) {
      ctx.beginPath();
      for (let x = 0; x <= 856; x += 6) {
        const y = 20 + k * 20 + Math.sin(x / 38 + k * 0.6) * 12 + Math.sin(x / 11 + k) * 2.5;
        if (x) ctx.lineTo(x * W / 856, y * H / 540); else ctx.moveTo(0, y * H / 540);
      }
      ctx.stroke();
    }
    ctx.restore();
    const r = ctx.createLinearGradient(0, 0, W, H * 0.6);
    r.addColorStop(0.3, 'rgba(255,255,255,0)'); r.addColorStop(0.45, 'rgba(255,255,255,0.10)'); r.addColorStop(0.6, 'rgba(255,255,255,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  }
  const SANS = (poids, taille) => poids + ' ' + (taille * u).toFixed(1) + 'px "Work Sans", sans-serif';
  const SERIF = (style, taille) => style + ' ' + (taille * u).toFixed(1) + 'px "Cormorant Garamond", Georgia, serif';
  function champ(ctx, titre, valeur, x, y) {
    texte(ctx, titre, x, y, SANS(500, 6.5), ROSE, 0.22 * 6.5);
    texte(ctx, valeur || '—', x, y + 12 * u, SANS(400, 10), '#FFFFFF', 0);
  }
  const dateCourte = (iso) => {
    const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const m = /^(\d{4})-(\d{2})/.exec(String(iso || '')); return m ? MOIS[+m[2] - 1] + ' ' + m[1] : '';
  };

  async function recto(c, d) {
    const ctx = c.getContext('2d'); ctx.save(); fond(ctx);
    // micro-texte en haut
    texte(ctx, 'MAÎTRE AKESSE MODEL MANAGEMENT · '.repeat(6), -4 * u, 7 * u, SANS(600, 5), 'rgba(255,255,255,0.35)', 0.3 * 5);
    const logo = await image('/assets/logo-header.png');
    if (logo) ctx.drawImage(logo, 15 * u, 15 * u, 16 * u * logo.width / logo.height, 16 * u);
    texte(ctx, 'MANNEQUIN MA2M', W - 15 * u, 26 * u, SANS(500, 8), '#FFFFFF', 0.42 * 8, 'right');
    // photo
    const px = 15 * u, py = 44 * u, pw = 92 * u, ph = pw * 4 / 3;
    const photo = d.photo ? await image(d.photo) : null;
    ctx.save(); arrondi(ctx, px, py, pw, ph, 9 * u); ctx.clip();
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(px, py, pw, ph);
    if (photo) couvrir(ctx, photo, px, py, pw, ph);
    ctx.restore();
    ctx.lineWidth = 1.5 * u; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; arrondi(ctx, px, py, pw, ph, 9 * u); ctx.stroke();
    // photo fantôme
    if (photo) { ctx.save(); ctx.globalAlpha = 0.22; ctx.filter = 'grayscale(1)'; arrondi(ctx, W - 49 * u, 46 * u, 34 * u, 45 * u, 5 * u); ctx.clip(); couvrir(ctx, photo, W - 49 * u, 46 * u, 34 * u, 45 * u); ctx.restore(); }
    // nom, catégorie, champs
    const ix = 120 * u;
    ctx.save(); ctx.font = SERIF(500, 22);
    let nom = String(d.nom || '').toUpperCase(), taille = 22;
    while (taille > 13 && (ctx.measureText(nom).width + nom.length * 0.06 * taille * u) > W - ix - 60 * u) { taille -= 1; ctx.font = SERIF(500, taille); }
    texte(ctx, nom, ix, 66 * u, SERIF(500, taille), '#FFFFFF', 0.06 * taille);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(ix, 76 * u, 26 * u, 1 * u);
    const col2 = ix + 112 * u;
    champ(ctx, 'CATÉGORIE', d.categorie, ix, 94 * u); champ(ctx, 'TAILLE', d.taille, col2, 94 * u);
    champ(ctx, 'FORMATION', d.formation, ix, 121 * u); champ(ctx, 'MENSURATIONS', d.mensurations, col2, 121 * u);
    champ(ctx, 'MEMBRE DEPUIS', dateCourte(d.depuis), ix, 148 * u); champ(ctx, 'VALABLE JUSQU’AU', dateCourte(d.valable), col2, 148 * u);
    // numéro
    texte(ctx, 'N° DE MANNEQUIN', 15 * u, H - 26 * u, SANS(500, 6.5), ROSE, 0.22 * 6.5);
    texte(ctx, d.matricule || '', 15 * u, H - 11 * u, SANS(500, 11), '#FFFFFF', 0.14 * 11);
    // sceau
    const sx = W - 33 * u, sy = H - 28 * u, sr = 19 * u;
    let sg;
    if (ctx.createConicGradient) { sg = ctx.createConicGradient(0.35, sx, sy); [['#ffffff55', 0], ['#f3c6cf88', 0.25], ['#ffffff22', 0.5], ['#e9b6c088', 0.75], ['#ffffff55', 1]].forEach((x) => sg.addColorStop(x[1], x[0])); }
    else { sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr); sg.addColorStop(0, '#ffffff44'); sg.addColorStop(1, '#f3c6cf66'); }
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1 * u; ctx.stroke();
    texte(ctx, 'MA2M', sx, sy + 3.5 * u, SERIF('italic 600', 9.5), '#FFFFFF', 0.05 * 9.5, 'center');
    ctx.restore();
  }
  // ligne lisible par machine (comme un passeport) : lettres sans accents, « < » pour les blancs
  function ligneMachine(t, n) { return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9<]+/g, '<').slice(0, n).padEnd(n, '<'); }
  function mmaa(iso) { const m = /^(\d{4})-(\d{2})/.exec(String(iso || '')); return m ? m[2] + m[1].slice(2) : '0000'; }
  async function verso(c, d) {
    const ctx = c.getContext('2d'); ctx.save(); fond(ctx);
    texte(ctx, 'CARTE OFFICIELLE', 15 * u, 26 * u, SANS(500, 7.5), ROSE, 0.42 * 7.5);
    const logo = await image('/assets/logo-header.png');
    if (logo) { ctx.globalAlpha = 0.9; ctx.drawImage(logo, W - 15 * u - 13 * u * logo.width / logo.height, 16 * u, 13 * u * logo.width / logo.height, 13 * u); ctx.globalAlpha = 1; }
    // QR : son book officiel (vérification)
    const q = 92 * u, qx = 15 * u, qy = 42 * u;
    ctx.fillStyle = '#FFFFFF'; arrondi(ctx, qx, qy, q, q, 10 * u); ctx.fill();
    if (typeof chargerQrLib === 'function') { await chargerQrLib().catch(() => null); if (typeof dessinerQrCanvas === 'function') dessinerQrCanvas(ctx, d.lienBook || 'https://www.maitreakessemodelmanagement.com', qx + 6 * u, qy + 6 * u, q - 12 * u, '#2A1416'); }
    const tx = qx + q + 15 * u;
    texte(ctx, 'VÉRIFIER', tx, 56 * u, SANS(500, 6.5), '#FFFFFF', 0.24 * 6.5);
    texte(ctx, 'Scannez : son book officiel s’ouvre', tx, 70 * u, SANS(300, 10), ROSE_CLAIR, 0);
    texte(ctx, 'sur le site de l’agence.', tx, 85 * u, SANS(300, 10), ROSE_CLAIR, 0);
    texte(ctx, 'BOOKING', tx, 104 * u, SANS(500, 6.5), '#FFFFFF', 0.24 * 6.5);
    texte(ctx, 'Uniquement par l’agence', tx, 118 * u, SANS(300, 10), ROSE_CLAIR, 0);
    texte(ctx, '+225 05 45 65 66 87', tx, 133 * u, SANS(300, 10), ROSE_CLAIR, 0);
    // ligne machine
    const cat = d.categorie === 'Professionnel' ? 'PR' : 'NF';
    const num = /(\d{4}) · (\d{4})$/.exec(d.matricule || '') || ['', '0000', '0000'];
    ctx.font = (8.5 * u).toFixed(1) + 'px "Courier New", monospace'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    texte(ctx, ligneMachine('MA2M<<' + (d.nom || ''), 30), 15 * u, H - 38 * u, (8.5 * u).toFixed(1) + 'px "Courier New", monospace', 'rgba(255,255,255,0.75)', 0.14 * 8.5);
    texte(ctx, ligneMachine(num[1] + '<' + num[2] + '<' + cat + '<<' + mmaa(d.depuis) + '<' + mmaa(d.valable), 30), 15 * u, H - 25 * u, (8.5 * u).toFixed(1) + 'px "Courier New", monospace', 'rgba(255,255,255,0.75)', 0.14 * 8.5);
    texte(ctx, 'maitreakessemodelmanagement.com · propriété de l’agence', 15 * u, H - 10 * u, SANS(300, 7), ROSE, 0.06 * 7);
    texte(ctx, 'Maître Akesse', W - 15 * u, H - 10 * u, SERIF('italic 400', 13), '#FFFFFF', 0, 'right');
    ctx.restore();
  }
  function canvasVide() { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }
  async function dessiner(face, d) { await polices(); const c = canvasVide(); await (face === 'verso' ? verso(c, d) : recto(c, d)); return c; }
  // une image : recto au-dessus du verso, sur fond blanc
  async function imageRectoVerso(d) {
    const [r, v] = await Promise.all([dessiner('recto', d), dessiner('verso', d)]);
    const m = 40, c = document.createElement('canvas'); c.width = W + 2 * m; c.height = 2 * H + 3 * m;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(r, m, m); ctx.drawImage(v, m, H + 2 * m);
    return c;
  }
  const nomFichier = (d, ext) => 'carte-ma2m-' + String(d.nom || 'mannequin').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
    (typeof horodatageFichier === 'function' ? horodatageFichier() : '') + '.' + ext;
  async function telechargerImage(d) {
    const c = await imageRectoVerso(d);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
    telechargerFichier(blob, nomFichier(d, 'png'));
  }
  // PDF au vrai format carte (85,6 × 54 mm), recto puis verso
  async function telechargerPdf(d) {
    await chargerJsPdf();
    const [r, v] = await Promise.all([dessiner('recto', d), dessiner('verso', d)]);
    const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54] });
    pdf.addImage(r.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 85.6, 54);
    pdf.addPage([85.6, 54], 'landscape');
    pdf.addImage(v.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 85.6, 54);
    telechargerFichier(pdf.output('blob'), nomFichier(d, 'pdf'));
  }
  return { dessiner, imageRectoVerso, telechargerImage, telechargerPdf, ligneMachine };
})();
