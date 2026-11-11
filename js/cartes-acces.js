// Cartes d'événement (25/10/2026, demande de la propriétaire) : rubrique « 🎫 Cartes d'événement »
// de l'Administration. On choisit l'événement (projet de l'Agenda) ; seules les mannequins qui ont
// CONFIRMÉ leur présence (réponse à la convocation) apparaissent. Sans photo (extérieure, autre agence, ou de
// l'agence sans photo dans le Book) : « 📷 Ajouter une photo », gardée pour les prochains événements et servant
// SEULEMENT aux cartes (stockage privé « cartes-photos », supabase-cartes.sql).
// (11/11/2026, maquette « G · Couverture » validée par la propriétaire) LE BADGE : un quart de A4 (105 × 148,5 mm),
// 4 par feuille A4 avec traits de coupe, à glisser dans un étui porté au cou. La photo en pleine page, « MODEL » en
// très grand, le nom de l'événement en grand (police du site, Big Shoulders), la date et le lieu avec des tirets,
// le numéro, une bande « MODEL · BACKSTAGE ». Le VOILE qui monte du bas prend la couleur de l'événement, lue sur
// l'affiche jointe au projet (Convocations, Extension 162) ; sans affiche : noir. Logo au choix : agence,
// partenaire (téléversé) ou aucun (par défaut). Dessin sur canvas (outils de js/app.js : chargerJsPdf,
// chargerImageHauteRes, chargerImageLocale, decoderImage, envelopperLignesCanvas, texteEspaceToile).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P) return;
  const CARTE_L = 105, CARTE_H = 148.5, DPI = 260, NOIR_BASE = '#0b0606', ROUGE_TIRET = '#E03A3A', GRIS_COUPE = '#9a9a9a';
  const px = (mm) => mm * DPI / 25.4;
  const pt = (n) => n * 0.3528 * DPI / 25.4;  // taille de police en points → pixels
  const TITRE = '"Big Shoulders Display", "Arial Narrow", Arial, sans-serif', TEXTE = '"Work Sans", Arial, sans-serif';
  const sansCivilite = (nom) => String(nom || '').replace(/^\s*(madame|mademoiselle|monsieur|mme|mlle|m\.)\s+/i, '').trim();
  const dateCourte = (j) => new Date(j + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  function datesProjet(p) {
    if (!p.date_fin || p.date_fin === p.date_debut) return dateCourte(p.date_debut);
    const a = new Date(p.date_debut + 'T12:00:00Z'), b = new Date(p.date_fin + 'T12:00:00Z');
    const memeMois = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
    return (memeMois ? a.getUTCDate() : dateCourte(p.date_debut).replace(/ \d{4}$/, '')) + ' – ' + dateCourte(p.date_fin);
  }
  // ---------- Couleurs de l'événement (lues sur l'affiche) ----------
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const rgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  // couleur dominante « vive » de l'affiche (les pixels presque blancs, noirs ou gris comptent peu), assombrie pour le voile
  async function couleurAffiche(url) {
    const img = url ? await chargerImageHauteRes(url, 160).catch(() => null) : null;  // (js/app.js)
    if (!img) return null;
    const c = img.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let r = 0, g = 0, b = 0, poids = 0;
    for (let i = 0; i < d.length; i += 16) {
      const R = d[i], G = d[i + 1], B = d[i + 2], max = Math.max(R, G, B), min = Math.min(R, G, B), sat = max ? (max - min) / max : 0;
      if (max < 40 || (max > 235 && sat < 0.12)) continue;
      const w = sat * sat + 0.02;
      r += R * w; g += G * w; b += B * w; poids += w;
    }
    if (!poids) return null;
    r /= poids; g /= poids; b /= poids;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b, k = lum > 70 ? 70 / lum : 1;  // voile assez sombre pour lire le texte blanc
    return hex(r * k, g * k, b * k);
  }
  // tirets et bande : la couleur du voile éclaircie (vive) ; voile noir : le rouge de l'agence
  function accent(voile) {
    if (voile === NOIR_BASE) return ROUGE_TIRET;
    const [r, g, b] = rgb(voile), max = Math.max(r, g, b, 1), k = 230 / max;
    return hex(r * k, g * k, b * k);
  }
  function ajusterTitre(ctx, texte, largeurPx, max, min, lignesMax) {
    let t = max, lignes = [];
    for (; t >= min; t -= 1) {
      ctx.font = '800 ' + pt(t) + 'px ' + TITRE;
      lignes = envelopperLignesCanvas(ctx, texte, largeurPx, ctx.font);  // (js/app.js)
      if (lignes.length <= lignesMax && lignes.every((l) => ctx.measureText(l).width <= largeurPx)) break;
    }
    return { lignes: lignes.slice(0, lignesMax), taille: Math.max(t, min) };
  }
  // ---------- Dessin d'un badge (x0, y0 en mm sur la feuille) ----------
  function dessinerCarte(ctx, x0, y0, c, projet, reglages, photo) {
    const X = (mm) => px(x0 + mm), Y = (mm) => px(y0 + mm), M = 7, voile = reglages.voile || NOIR_BASE, vif = accent(voile);
    const [vr, vg, vb] = rgb(voile);
    ctx.save();
    ctx.beginPath(); ctx.rect(X(0), Y(0), px(CARTE_L), px(CARTE_H)); ctx.clip();
    // la photo en pleine page (le haut du visage gardé), sinon un fond à la couleur de l'événement et les initiales
    if (photo) {
      const ratio = CARTE_L / CARTE_H, ri = photo.largeur / photo.hauteur;
      let sx = 0, sy = 0, sl = photo.largeur, sh = photo.hauteur;
      if (ri > ratio) { sl = photo.hauteur * ratio; sx = (photo.largeur - sl) / 2; } else { sh = photo.largeur / ratio; sy = Math.min((photo.hauteur - sh) * 0.15, photo.hauteur - sh); }
      ctx.drawImage(photo.canvas, sx, sy, sl, sh, X(0), Y(0), px(CARTE_L), px(CARTE_H));
    } else {
      ctx.fillStyle = hex(vr * 1.6 + 30, vg * 1.6 + 10, vb * 1.6 + 12); ctx.fillRect(X(0), Y(0), px(CARTE_L), px(CARTE_H));
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '800 ' + pt(90) + 'px ' + TITRE; ctx.textAlign = 'center';
      ctx.fillText(P.initiales(c.nom) || '?', X(CARTE_L / 2), Y(62)); ctx.textAlign = 'left';
    }
    // le voile qui monte, à la couleur de l'événement ; une ombre légère en haut pour « MODEL » et le logo
    const v = ctx.createLinearGradient(0, Y(CARTE_H * 0.3), 0, Y(CARTE_H * 0.8));
    v.addColorStop(0, 'rgba(' + vr + ',' + vg + ',' + vb + ',0)'); v.addColorStop(0.55, 'rgba(' + vr + ',' + vg + ',' + vb + ',.80)'); v.addColorStop(1, 'rgba(' + vr + ',' + vg + ',' + vb + ',.97)');
    ctx.fillStyle = v; ctx.fillRect(X(0), Y(CARTE_H * 0.3), px(CARTE_L), px(CARTE_H * 0.7));
    const h = ctx.createLinearGradient(0, Y(0), 0, Y(30));
    h.addColorStop(0, 'rgba(0,0,0,.45)'); h.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = h; ctx.fillRect(X(0), Y(0), px(CARTE_L), px(30));
    // repère de la fente du cordon
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = px(0.25);
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(X(CARTE_L / 2 - 7), Y(3), px(14), px(2.6), px(1.3)) : ctx.rect(X(CARTE_L / 2 - 7), Y(3), px(14), px(2.6)); ctx.stroke();
    // logo (au choix) et « MODEL »
    ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'alphabetic';
    let logoL = 0;
    if (reglages.logo) {
      const l = Math.min(34, 13 * reglages.logo.largeur / reglages.logo.hauteur), hl = l * reglages.logo.hauteur / reglages.logo.largeur;
      ctx.drawImage(reglages.logo.canvas, X(M), Y(9), px(l), px(hl)); logoL = l;
    }
    ctx.font = '800 ' + pt(42) + 'px ' + TITRE; ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = px(2);
    if (logoL) { ctx.textAlign = 'right'; ctx.fillText('MODEL', X(CARTE_L - M), Y(21)); ctx.textAlign = 'left'; }
    else ctx.fillText('MODEL', X(M), Y(21));
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    // l'événement en grand, puis la date et le lieu avec leurs tirets
    const titre = ajusterTitre(ctx, String(projet.titre || '').toUpperCase(), px(CARTE_L - 2 * M), 34, 18, 3);
    const lieu = [projet.lieu, projet.ville].filter(Boolean).join(', ') || 'Lieu à préciser';
    const yInfos = CARTE_H - 33, ligneT = titre.taille * 0.3528 * 0.9;
    titre.lignes.forEach((l, i) => { ctx.font = '800 ' + pt(titre.taille) + 'px ' + TITRE; ctx.fillText(l, X(M), Y(yInfos - 4 - (titre.lignes.length - 1 - i) * ligneT)); });
    ctx.font = '500 ' + pt(9) + 'px ' + TEXTE;
    [[datesProjet(projet), yInfos + 2.5], [lieu, yInfos + 8]].forEach(([t, y]) => {
      ctx.fillStyle = vif; ctx.fillRect(X(M), Y(y - 1.3), px(4.5), px(0.6));
      ctx.fillStyle = '#ffffff'; ctx.fillText(envelopperLignesCanvas(ctx, t, px(CARTE_L - 2 * M - 30), ctx.font)[0] || t, X(M + 7), Y(y));
    });
    // le numéro
    ctx.font = '800 ' + pt(20) + 'px ' + TITRE; ctx.textAlign = 'right';
    ctx.fillText('N° ' + c.numero, X(CARTE_L - M), Y(yInfos + 9)); ctx.textAlign = 'left';
    // la bande du bas
    const bande = voile === NOIR_BASE ? NOIR_BASE : vif;
    ctx.fillStyle = bande; ctx.fillRect(X(0), Y(CARTE_H - 9), px(CARTE_L), px(9));
    const [br, bg, bb] = rgb(bande), clair = 0.299 * br + 0.587 * bg + 0.114 * bb > 150;
    ctx.fillStyle = clair ? '#1a1206' : '#ffffff'; ctx.font = '700 ' + pt(6.5) + 'px ' + TEXTE;
    texteEspaceToile(ctx, 'MODEL · BACKSTAGE', X(M), Y(CARTE_H - 3.4), px(0.9));  // (js/app.js)
    texteEspaceToile(ctx, 'N° ' + c.numero, X(CARTE_L - M), Y(CARTE_H - 3.4), px(0.9), 'right');
    ctx.restore();
  }

  // ---------- Le PDF ----------
  // photo d'une carte : celle ajoutée pour les cartes (stockage privé), sinon celle du Book
  async function imageDe(c) {
    if (c.chemin) {
      const blob = await P.bd(sb.storage.from(STOCKAGE).download(c.chemin)).catch(() => null);
      if (blob) return (await decoderImage(blob, COTE_PETITE_CASE)) || null;
    }
    return c.photo ? chargerImageHauteRes(c.photo, COTE_PETITE_CASE) : null;
  }
  // seule : un badge par page (105 × 148,5 mm) ; sinon 4 badges par feuille A4 portrait, traits de coupe
  async function fabriquerPdf(projet, cartes, seule, reglages) {
    await Promise.all([chargerJsPdf(), document.fonts.load('800 40px "Big Shoulders Display"'),
      document.fonts.load('500 40px "Work Sans"'), document.fonts.load('700 40px "Work Sans"')]);
    const { jsPDF } = window.jspdf;
    const L = seule ? CARTE_L : 2 * CARTE_L, H = seule ? CARTE_H : 2 * CARTE_H, parFeuille = seule ? 1 : 4;
    const doc = new jsPDF({ unit: 'mm', format: [L, H], orientation: 'portrait' });
    for (let i = 0; i < cartes.length; i += parFeuille) {
      const groupe = cartes.slice(i, i + parFeuille);
      const images = await Promise.all(groupe.map(imageDe));
      const feuille = document.createElement('canvas');
      feuille.width = Math.round(px(L)); feuille.height = Math.round(px(H));
      const ctx = feuille.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, feuille.width, feuille.height);
      groupe.forEach((c, k) => dessinerCarte(ctx, (k % 2) * CARTE_L, Math.floor(k / 2) * CARTE_H, c, projet, reglages, images[k]));
      if (!seule) {
        ctx.strokeStyle = GRIS_COUPE; ctx.lineWidth = px(0.3); ctx.setLineDash([px(2), px(1.5)]);
        ctx.beginPath(); ctx.moveTo(px(CARTE_L), 0); ctx.lineTo(px(CARTE_L), feuille.height); ctx.moveTo(0, px(CARTE_H)); ctx.lineTo(feuille.width, px(CARTE_H)); ctx.stroke();
      }
      if (i) doc.addPage([L, H], 'portrait');
      doc.addImage(feuille.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, L, H);
    }
    const slug = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    doc.save((seule ? 'badge-' + slug(cartes[0].nom) + '-' : 'badges-') + slug(projet.titre || 'evenement') + horodatageFichier() + '.pdf');
  }

  // ---------- Les mannequins confirmées de l'événement ----------
  async function confirmees(p) {
    const participants = await P.bd(sb.from('convocation_participants').select('model_id, contact_id, nom, reponse').eq('projet_id', p.id).eq('reponse', 'confirme')).catch(() => []);
    const idsSite = [...new Set(participants.map((x) => x.model_id).filter(Boolean))];
    const contacts = [...new Set(participants.map((x) => x.contact_id).filter(Boolean))];
    const [profils, carnet] = await Promise.all([
      idsSite.length ? P.parPaquets(idsSite, 100, (l) => P.bd(sb.from('model_profiles').select('id, full_name, published').in('id', l))) : [],
      contacts.length ? P.parPaquets(contacts, 100, (l) => P.bd(sb.from('contacts_externes').select('id, civilite, nom, mannequin_id').in('id', l))).catch(() => []) : []
    ]);
    const registreIds = [...new Set(carnet.map((c) => c.mannequin_id).filter(Boolean))];
    // clés possibles des personnes de l'événement (photos ajoutées pour les cartes)
    const cles = idsSite.map((id) => 'm:' + id).concat(registreIds.map((id) => 'r:' + id), contacts.map((id) => 'c:' + id));
    const [registre, ajoutees] = await Promise.all([
      registreIds.length ? P.parPaquets(registreIds, 100, (l) => P.bd(sb.from('agence_mannequins').select('id, full_name').in('id', l))).catch(() => []) : [],
      P.parPaquets(cles, 100, (l) => P.bd(sb.from('cartes_photos').select('cle, chemin').in('cle', l))).catch(() => [])
    ]);
    const photos = {}, chemins = {};
    (idsSite.length ? await lirePhotosCouverture(sb, idsSite, false).catch(() => []) : []).forEach((l) => { photos[l.model_id] = l; });
    ajoutees.forEach((x) => { chemins[x.cle] = x.chemin; });
    const profilDe = {}; profils.forEach((m) => { profilDe[m.id] = m; });
    const carnetDe = {}; carnet.forEach((c) => { carnetDe[c.id] = c; });
    const registreDe = {}; registre.forEach((r) => { registreDe[r.id] = r; });
    const liste = [], vus = {};
    participants.forEach((x) => {
      let cle, nom, photo = '', fiche = '';
      if (x.model_id) {
        const m = profilDe[x.model_id] || {};
        cle = 'm:' + x.model_id; nom = m.full_name || x.nom;
        if (photos[x.model_id]) photo = photos[x.model_id].url;
        if (m.published) fiche = 'https://www.maitreakessemodelmanagement.com/mannequin.html?id=' + encodeURIComponent(x.model_id);
      } else {
        const c = carnetDe[x.contact_id] || {};
        cle = c.mannequin_id ? 'r:' + c.mannequin_id : 'c:' + x.contact_id;
        nom = (c.mannequin_id && registreDe[c.mannequin_id] && registreDe[c.mannequin_id].full_name) || c.nom || x.nom;
      }
      if (vus[cle]) return;
      vus[cle] = true;
      liste.push({ cle, nom: sansCivilite(nom) || '?', photo, vignette: photo && urlGrille(photos[x.model_id], true), fiche, chemin: chemins[cle] || '' });
    });
    liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    liste.forEach((c, i) => { c.numero = String(i + 1).padStart(3, '0'); });
    return liste;
  }

  // ---------- La rubrique ----------
  const PAGE = 'b2-cartes', STOCKAGE = 'cartes-photos';
  const PAS_ACTIVE = 'L’ajout de photos pour les cartes n’est pas encore activé : exécutez une fois le fichier supabase-cartes.sql dans Supabase.';
  let ecran = null;  // { projet, personnes, apercus: { cle: url locale } }
  async function choixEvenement() {
    const depuis = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    const projets = await P.bd(sb.from('agenda_projets').select('id, titre, date_debut, date_fin, lieu, ville, annule').gte('date_debut', depuis).eq('annule', false).order('date_debut'));
    return P.entete('Cartes d’événement') +
      '<p class="doux">Choisissez l’événement : les mannequins qui ont confirmé leur présence apparaissent, touchez-en une pour faire son badge.</p>' +
      (projets.length ? '<div class="projets-liste">' + projets.map((p, i) => '<a class="projet-carte apparait ca-evenement" style="--i:' + Math.min(i, 10) + '" href="#/site/' + PAGE + '/' + P.esc(p.id) + '">' +
        '<h2>' + P.esc(p.titre) + '</h2><p class="doux">' + P.esc(datesProjet(p) + ([p.lieu, p.ville].filter(Boolean).length ? ' · ' + [p.lieu, p.ville].filter(Boolean).join(', ') : '')) + '</p></a>').join('') + '</div>'
        : '<div class="carte vide">Aucun événement dans l’Agenda pour le moment.</div>');
  }
  async function evenement(id) {
    const r = await P.bd(sb.from('agenda_projets').select('*').eq('id', id));
    if (!r.length) return P.entete('Cartes d’événement') + '<div class="carte vide">Cet événement n’existe plus.</div>';
    const projet = r[0], personnes = await confirmees(projet);
    Object.values((ecran && ecran.apercus) || {}).forEach((u) => URL.revokeObjectURL(u));
    // couleur du voile : lue sur l'affiche du projet (Extension 162) ; sans affiche, noir
    const auto = (await couleurAffiche(projet.affiche).catch(() => null)) || NOIR_BASE;
    ecran = { projet, personnes, apercus: {}, auto, logo: (ecran && ecran.projet && ecran.projet.id === projet.id && ecran.logo) || 'aucun', logoPartenaire: (ecran && ecran.projet && ecran.projet.id === projet.id && ecran.logoPartenaire) || null };
    // photos ajoutées pour les cartes : aperçu dans la liste
    await Promise.all(personnes.filter((c) => c.chemin).map(async (c) => {
      const blob = await P.bd(sb.storage.from(STOCKAGE).download(c.chemin)).catch(() => null);
      if (blob) ecran.apercus[c.cle] = URL.createObjectURL(blob);
    }));
    const cartes = personnes.map((c, i) => '<li class="ca-carte">' +
      '<button type="button" class="ca-faire" data-action="carte-une" data-i="' + i + '" aria-label="Faire la carte de ' + P.esc(c.nom) + '">' +
      P.visage(ecran.apercus[c.cle] || c.vignette, c.nom, 'ca-vis') + '<span class="ca-nom">' + P.esc(c.nom) + '</span><span class="doux">N° ' + c.numero + ' · 🎫 son badge</span></button>' +
      (c.photo && !c.chemin ? '' : '<label class="btn petit ca-photo">📷 ' + (c.chemin ? 'Changer la photo' : 'Ajouter une photo') +
        '<input type="file" accept="image/*" data-change="carte-photo" data-i="' + i + '"></label>') + '</li>').join('');
    return P.entete('Cartes · ' + projet.titre, '<a class="btn" href="#/site/' + PAGE + '">← Choisir un autre événement</a>') +
      '<p class="doux">' + P.esc([datesProjet(projet), [projet.lieu, projet.ville].filter(Boolean).join(', ')].filter(Boolean).join(' · ')) + '</p>' +
      (personnes.length ? '<div class="carte"><h2>Le badge</h2>' +
        // (11/11/2026) logo au choix : l'événement peut être celui d'un partenaire
        '<fieldset class="ca-logo"><legend>Logo en haut à gauche</legend>' + [['aucun', 'Aucun'], ['agence', 'Logo de l’agence'], ['partenaire', 'Logo du partenaire']].map((o) =>
          '<label><input type="radio" name="ca-logo" value="' + o[0] + '" data-change="carte-logo"' + (ecran.logo === o[0] ? ' checked' : '') + '> ' + o[1] + '</label>').join('') + '</fieldset>' +
        '<div id="ca-logo-partenaire"' + (ecran.logo === 'partenaire' ? '' : ' hidden') + '></div>' +
        '<label class="fl ca-couleur" for="ca-voile">Couleur du voile<input id="ca-voile" type="color" value="' + P.esc(ecran.auto) + '"></label>' +
        '<p class="doux petit-texte">' + (projet.affiche ? 'Couleur prise sur l’affiche de l’événement ; vous pouvez la changer.' : 'Pas d’affiche jointe à ce projet : voile noir (joignez l’affiche dans Convocations pour prendre ses couleurs).') + '</p>' +
        '<p class="doux petit-texte">' + P.pluriel(personnes.length, 'mannequin a confirmé', 'mannequins ont confirmé') + ' sa présence. Celles qui n’ont pas encore répondu, ou qui sont absentes, n’ont pas de carte.</p>' +
        '<ul class="ca-liste">' + cartes + '</ul>' +
        '<div class="ligne"><button type="button" class="btn rouge" data-action="cartes-toutes">🖨️ Tous les badges (4 par feuille A4)</button></div></div>'
        : '<div class="carte vide">Aucune mannequin n’a encore confirmé sa présence à cet événement (Convocations : lien « Confirmez votre présence »).</div>');
  }
  // réglages du badge au moment de l'impression : logo choisi, couleur du voile
  async function reglagesBadge() {
    const voile = String((document.getElementById('ca-voile') || {}).value || ecran.auto || NOIR_BASE);
    let logo = null;
    if (ecran.logo === 'agence') logo = await chargerImageLocale('/assets/logo-header.png').catch(() => null);  // (js/app.js)
    if (ecran.logo === 'partenaire' && ecran.logoPartenaire) logo = await chargerImageHauteRes(ecran.logoPartenaire, 800).catch(() => null);
    return { voile: voile.toLowerCase() === NOIR_BASE ? NOIR_BASE : voile, logo };
  }
  P.changements['carte-logo'] = (el) => {
    ecran.logo = el.value;
    const zone = document.getElementById('ca-logo-partenaire');
    zone.hidden = el.value !== 'partenaire';
    if (!zone.hidden && !zone.dataset.pret && window.ImageJointe) {  // (js/image-jointe.js : téléversé depuis la galerie)
      zone.dataset.pret = '1';
      window.ImageJointe.brancher(zone, { valeur: ecran.logoPartenaire, surChange: (url) => { ecran.logoPartenaire = url; } });
      const aide = zone.querySelector('.ij-canaux'); if (aide) aide.textContent = 'Le logo du partenaire (de préférence en blanc ou clair, sur fond transparent).';
    }
  };
  async function fabriquer(cartes, seule, bouton) {
    if (bouton) bouton.disabled = true;
    P.message('Fabrication ' + (seule ? 'de la carte…' : 'des cartes… (' + cartes.length + ')'));
    try {
      await fabriquerPdf(ecran.projet, cartes, seule, await reglagesBadge());
      P.message(seule ? 'Badge de ' + cartes[0].nom + ' prêt : le PDF est téléchargé.' : P.pluriel(cartes.length, 'badge prêt', 'badges prêts') + ' : le PDF est téléchargé (4 par feuille A4).');
    } finally { if (bouton) bouton.disabled = false; }
  }
  P.actions['carte-une'] = (el) => { const c = ecran && ecran.personnes[Number(el.dataset.i)]; if (c) return fabriquer([c], true, el); };
  P.actions['cartes-toutes'] = (el) => ecran && ecran.personnes.length && fabriquer(ecran.personnes, false, el);
  // photo ajoutée : JPEG refait (1600 px au plus, sans les données cachées de l'appareil photo),
  // déposée dans le stockage privé, puis l'ancienne retirée
  P.changements['carte-photo'] = async (el) => {
    const c = ecran && ecran.personnes[Number(el.dataset.i)], fichier = el.files && el.files[0];
    if (!c || !fichier) return;
    P.message('Envoi de la photo…');
    const source = typeof convertirSiHeic === 'function' ? await convertirSiHeic(fichier) : fichier;
    const image = await decoderImage(source, COTE_PETITE_CASE);
    if (!image) { P.message('Cette photo n’a pas pu être lue : essayez une photo JPEG ou PNG.'); return; }
    const jpeg = await new Promise((ok) => image.canvas.toBlob(ok, 'image/jpeg', 0.9));
    const chemin = c.cle.replace(':', '-') + '/' + crypto.getRandomValues(new Uint32Array(2)).join('-') + '.jpg';
    try {
      await P.bd(sb.storage.from(STOCKAGE).upload(chemin, jpeg, { contentType: 'image/jpeg', upsert: false }));
    } catch (e) {
      if (/bucket|not.?found|cartes/i.test(String((e && e.message) || e))) { P.message(PAS_ACTIVE); return; }
      throw e;
    }
    try {
      const r = await P.bd(sb.from('cartes_photos').upsert({ cle: c.cle, chemin, mis_a_jour: new Date().toISOString() }).select('cle'));
      if (!r || !r.length) throw new Error('Rien n’a été enregistré : reconnectez-vous puis réessayez.');
    } catch (e) {
      await P.bd(sb.storage.from(STOCKAGE).remove([chemin])).catch(() => null);  // pas de fichier orphelin
      if (P.pasActivee('cartes_photos')(e)) { P.message(PAS_ACTIVE); return; }
      throw e;
    }
    if (c.chemin) await P.bd(sb.storage.from(STOCKAGE).remove([c.chemin])).catch(() => null);
    P.message('Photo de ' + c.nom + ' enregistrée pour ses cartes.');
    return P.afficher();
  };
  // raccourcis (Agenda, Programmation défilé) : la rubrique, sur cet événement
  P.actions['cartes-acces'] = (el) => { location.hash = '#/site/' + PAGE + (el.dataset.id ? '/' + encodeURIComponent(el.dataset.id) : ''); };
  if (P.espaces.site) P.espaces.site.pages[PAGE] = (args) => (args && args[0] ? evenement(decodeURIComponent(args[0])) : choixEvenement());
})();
