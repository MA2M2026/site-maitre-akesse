// Cartes d'événement (25/10/2026, demande de la propriétaire) : rubrique « 🎫 Cartes d'événement »
// de l'Administration. On choisit l'événement (projet de l'Agenda) ; seules les mannequins qui ont
// CONFIRMÉ leur présence (réponse à la convocation) apparaissent, pour ne jamais faire de carte
// en désordre. Toucher une mannequin → sa carte (PDF A5) ; « Toutes les cartes » → deux par
// feuille A4 couchée avec un trait de coupe. Sans photo (extérieure, autre agence, ou de l'agence
// sans photo dans le Book) : « 📷 Ajouter une photo », gardée pour les prochains événements et
// servant SEULEMENT aux cartes (stockage privé « cartes-photos », supabase-cartes.sql).
// La carte : logo, « Former – Révéler – Valoriser », photo (ou initiales), nom, numéro, QR code
// vers la fiche (profil publié), l'événement (titre, date, lieu, organisé par), bandeau
// « ACCÈS MANNEQUIN · MA2M ». Dessin sur canvas comme la compcard et le CV (outils de js/app.js :
// chargerJsPdf, chargerImageHauteRes, chargerImageLocale, chargerQrLib, dessinerQrCanvas,
// envelopperLignesCanvas, decoderImage).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P) return;
  const NOIR = '#0b0908', NOIR2 = '#1d1714', OR = '#c9a96e', IVOIRE = '#f4efe6', BORDEAUX = '#7a1220', GRIS_COUPE = '#9a9a9a';
  const CARTE_L = 148.5, CARTE_H = 210, DPI = 220;
  const px = (mm) => mm * DPI / 25.4;
  const pt = (n) => n * 0.3528 * DPI / 25.4;  // taille de police en points → pixels
  const ORGANISATEUR = 'Maître Akesse Model Management';
  const sansCivilite = (nom) => String(nom || '').replace(/^\s*(madame|mademoiselle|monsieur|mme|mlle|m\.)\s+/i, '').trim();
  const dateCourte = (j) => new Date(j + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  function datesProjet(p) {
    if (!p.date_fin || p.date_fin === p.date_debut) return dateCourte(p.date_debut);
    const a = new Date(p.date_debut + 'T12:00:00Z'), b = new Date(p.date_fin + 'T12:00:00Z');
    const memeMois = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
    return (memeMois ? a.getUTCDate() : dateCourte(p.date_debut).replace(/ \d{4}$/, '')) + ' – ' + dateCourte(p.date_fin);
  }

  // ---------- Dessin d'une carte (x0, y0 en mm sur la feuille) ----------
  // texte espacé (lettres écartées), centré sur cx ou aligné à gauche
  function texteEspace(ctx, texte, x, y, ecartMm, centre) {
    const ecart = px(ecartMm), lettres = [...texte];
    const largeur = lettres.reduce((s, l) => s + ctx.measureText(l).width, 0) + ecart * (lettres.length - 1);
    let cx = centre ? x - largeur / 2 : x;
    lettres.forEach((l) => { ctx.fillText(l, cx, y); cx += ctx.measureText(l).width + ecart; });
  }
  // lignes d'un texte dans une largeur, police réduite jusqu'à tenir en maxLignes
  function ajuster(ctx, texte, largeurMm, taillePt, minPt, maxLignes, police) {
    let t = taillePt, lignes;
    for (; t >= minPt; t -= 1) {
      lignes = envelopperLignesCanvas(ctx, texte, px(largeurMm), police.replace('{t}', pt(t)));
      if (lignes.length <= maxLignes && lignes.every((l) => ctx.measureText(l).width <= px(largeurMm))) break;
    }
    t = Math.max(t, minPt);
    ctx.font = police.replace('{t}', pt(t));
    return { lignes: envelopperLignesCanvas(ctx, texte, px(largeurMm), ctx.font).slice(0, maxLignes), taille: t };
  }
  function dessinerCarte(ctx, x0, y0, c, projet, logo, photo) {
    const X = (mm) => px(x0 + mm), Y = (mm) => px(y0 + mm);
    ctx.save();
    // fond noir profond, légèrement éclairé en haut
    const fond = ctx.createLinearGradient(0, Y(0), 0, Y(CARTE_H));
    fond.addColorStop(0, NOIR2); fond.addColorStop(0.55, NOIR); fond.addColorStop(1, NOIR);
    ctx.fillStyle = fond; ctx.fillRect(X(0), Y(0), px(CARTE_L), px(CARTE_H));
    // filet doré
    ctx.strokeStyle = OR; ctx.lineWidth = px(0.35);
    ctx.strokeRect(X(5), Y(5), px(CARTE_L - 10), px(186));
    // logo, devise
    if (logo) { const l = 72, h = l * logo.hauteur / logo.largeur; ctx.drawImage(logo.canvas, X((CARTE_L - l) / 2), Y(12), px(l), px(h)); }
    ctx.fillStyle = OR; ctx.textBaseline = 'alphabetic';
    ctx.font = '600 ' + pt(7) + 'px Montserrat, Arial, sans-serif';
    texteEspace(ctx, 'FORMER  –  RÉVÉLER  –  VALORISER', X(CARTE_L / 2), Y(38), 0.9, true);
    ctx.fillRect(X(CARTE_L / 2 - 22), Y(41.5), px(44), px(0.3));
    ctx.font = '600 ' + pt(8.5) + 'px Cinzel, Georgia, serif';
    texteEspace(ctx, 'MANNEQUIN', X(CARTE_L / 2), Y(49), 1.6, true);
    ctx.fillStyle = IVOIRE; ctx.font = '700 ' + pt(21) + 'px Cinzel, Georgia, serif';
    texteEspace(ctx, 'ACCÈS ÉVÉNEMENT', X(CARTE_L / 2), Y(59.5), 0.6, true);
    // photo (ou initiales) dans un cadre doré
    const PX = 13, PY = 67, PL = 60, PH = 80;
    if (photo) {
      const ratio = PL / PH, ri = photo.largeur / photo.hauteur;
      let sx = 0, sy = 0, sl = photo.largeur, sh = photo.hauteur;
      if (ri > ratio) { sl = photo.hauteur * ratio; sx = (photo.largeur - sl) / 2; } else { sh = photo.largeur / ratio; sy = Math.min((photo.hauteur - sh) * 0.15, photo.hauteur - sh); }
      ctx.drawImage(photo.canvas, sx, sy, sl, sh, X(PX), Y(PY), px(PL), px(PH));
    } else {
      const g = ctx.createLinearGradient(X(PX), Y(PY), X(PX + PL), Y(PY + PH));
      g.addColorStop(0, BORDEAUX); g.addColorStop(1, '#3a070f');
      ctx.fillStyle = g; ctx.fillRect(X(PX), Y(PY), px(PL), px(PH));
      ctx.fillStyle = IVOIRE; ctx.font = '700 ' + pt(54) + 'px Cinzel, Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillText(P.initiales(c.nom) || '?', X(PX + PL / 2), Y(PY + PH / 2 + 7));
      ctx.textAlign = 'left';
    }
    ctx.strokeStyle = OR; ctx.lineWidth = px(0.6); ctx.strokeRect(X(PX), Y(PY), px(PL), px(PH));
    // colonne de droite : nom, numéro, QR code
    const DX = 80, DL = CARTE_L - 13 - DX;
    ctx.fillStyle = OR; ctx.font = '600 ' + pt(7) + 'px Montserrat, Arial, sans-serif';
    texteEspace(ctx, 'MANNEQUIN', X(DX), Y(72), 0.9);
    const nom = ajuster(ctx, c.nom.toUpperCase(), DL, 17, 10, 3, '600 {t}px "Cormorant Garamond", Georgia, serif');
    ctx.fillStyle = IVOIRE;
    nom.lignes.forEach((l, i) => ctx.fillText(l, X(DX), Y(80 + i * nom.taille * 0.42)));
    ctx.fillStyle = OR; ctx.font = '600 ' + pt(7) + 'px Montserrat, Arial, sans-serif';
    texteEspace(ctx, 'N°', X(DX), Y(c.fiche ? 106 : 118), 0.9);
    ctx.font = '700 ' + pt(c.fiche ? 24 : 34) + 'px Cinzel, Georgia, serif';
    ctx.fillText(c.numero, X(DX), Y(c.fiche ? 116 : 132));
    if (c.fiche && dessinerQrCanvas(ctx, c.fiche, X(DX), Y(PY + PH - 25), px(25), NOIR)) {
      ctx.fillStyle = OR; ctx.font = '500 ' + pt(5.5) + 'px Montserrat, Arial, sans-serif';
      ctx.fillText('Sa fiche', X(DX + 27), Y(PY + PH - 3));
    }
    // l'événement
    ctx.fillStyle = OR; ctx.fillRect(X(13), Y(154), px(CARTE_L - 26), px(0.3));
    ctx.font = '600 ' + pt(7) + 'px Montserrat, Arial, sans-serif';
    texteEspace(ctx, 'ÉVÉNEMENT', X(13), Y(160.5), 0.9);
    const titre = ajuster(ctx, String(projet.titre || '').toUpperCase(), CARTE_L - 26, 15, 9, 2, '600 {t}px "Cormorant Garamond", Georgia, serif');
    ctx.fillStyle = IVOIRE;
    titre.lignes.forEach((l, i) => ctx.fillText(l, X(13), Y(167.5 + i * titre.taille * 0.4)));
    const infos = [['DATE', datesProjet(projet), 13, 36], ['LIEU', [projet.lieu, projet.ville].filter(Boolean).join(', ') || 'À préciser', 52, 42], ['ORGANISÉ PAR', projet.organisateur, 98, 37.5]];
    const yInfos = titre.lignes.length > 1 ? 179.5 : 176;
    infos.forEach(([titreInfo, valeur, x, l]) => {
      ctx.fillStyle = OR; ctx.font = '600 ' + pt(6) + 'px Montserrat, Arial, sans-serif';
      texteEspace(ctx, titreInfo, X(x), Y(yInfos), 0.6);
      const v = ajuster(ctx, valeur, l, 8, 6, 2, '600 {t}px Montserrat, Arial, sans-serif');
      ctx.fillStyle = IVOIRE;
      v.lignes.forEach((ligne, i) => ctx.fillText(ligne, X(x), Y(yInfos + 4.6 + i * v.taille * 0.42)));
    });
    // bandeau bordeaux
    ctx.fillStyle = BORDEAUX; ctx.fillRect(X(0), Y(195), px(CARTE_L), px(15));
    ctx.fillStyle = OR; ctx.fillRect(X(0), Y(195), px(CARTE_L), px(0.5));
    ctx.fillStyle = IVOIRE; ctx.font = '700 ' + pt(11) + 'px Cinzel, Georgia, serif';
    texteEspace(ctx, 'ACCÈS MANNEQUIN', X(13), Y(204.6), 0.8);
    ctx.fillStyle = OR; ctx.textAlign = 'right';
    ctx.fillText('MA2M', X(CARTE_L - 13), Y(204.6));
    ctx.textAlign = 'left';
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
  // seule : une carte A5 par page ; sinon deux cartes par feuille A4 couchée, trait de coupe au milieu
  async function fabriquerPdf(projet, cartes, seule) {
    await Promise.all([chargerJsPdf(), chargerQrLib().catch(() => null),
      document.fonts.load('700 40px Cinzel'), document.fonts.load('600 40px Cinzel'), document.fonts.load('600 40px "Cormorant Garamond"'),
      document.fonts.load('600 40px Montserrat'), document.fonts.load('500 40px Montserrat')]);
    const logo = await chargerImageLocale('/assets/logo-intro.png');
    const { jsPDF } = window.jspdf;
    const parFeuille = seule ? 1 : 2, largeur = parFeuille * CARTE_L;
    const doc = new jsPDF({ unit: 'mm', format: [largeur, CARTE_H], orientation: seule ? 'portrait' : 'landscape' });
    for (let i = 0; i < cartes.length; i += parFeuille) {
      const groupe = cartes.slice(i, i + parFeuille);
      const images = await Promise.all(groupe.map(imageDe));
      const feuille = document.createElement('canvas');
      feuille.width = Math.round(px(largeur)); feuille.height = Math.round(px(CARTE_H));
      const ctx = feuille.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, feuille.width, feuille.height);
      groupe.forEach((c, k) => dessinerCarte(ctx, k * CARTE_L, 0, c, projet, logo, images[k]));
      if (!seule) {
        ctx.strokeStyle = GRIS_COUPE; ctx.lineWidth = px(0.3); ctx.setLineDash([px(2), px(1.5)]);
        ctx.beginPath(); ctx.moveTo(px(CARTE_L), 0); ctx.lineTo(px(CARTE_L), feuille.height); ctx.stroke();
      }
      if (i) doc.addPage([largeur, CARTE_H], seule ? 'portrait' : 'landscape');
      doc.addImage(feuille.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, largeur, CARTE_H);
      // QR code cliquable dans le PDF aussi
      groupe.forEach((c, k) => { if (c.fiche) doc.link(k * CARTE_L + 80, 67 + 80 - 25, 25, 25, { url: c.fiche }); });
    }
    const slug = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    doc.save((seule ? 'carte-' + slug(cartes[0].nom) + '-' : 'cartes-') + slug(projet.titre || 'evenement') + horodatageFichier() + '.pdf');
  }

  // ---------- Les mannequins confirmées de l'événement ----------
  async function confirmees(p) {
    const participants = await P.bd(sb.from('convocation_participants').select('model_id, contact_id, nom, reponse').eq('projet_id', p.id).eq('reponse', 'confirme')).catch(() => []);
    const idsSite = [...new Set(participants.map((x) => x.model_id).filter(Boolean))];
    const contacts = [...new Set(participants.map((x) => x.contact_id).filter(Boolean))];
    const [profils, carnet, ajoutees] = await Promise.all([
      idsSite.length ? P.parPaquets(idsSite, 100, (l) => P.bd(sb.from('model_profiles').select('id, full_name, published').in('id', l))) : [],
      contacts.length ? P.parPaquets(contacts, 100, (l) => P.bd(sb.from('contacts_externes').select('id, civilite, nom, mannequin_id').in('id', l))).catch(() => []) : [],
      P.bd(sb.from('cartes_photos').select('cle, chemin')).catch(() => [])
    ]);
    const registreIds = [...new Set(carnet.map((c) => c.mannequin_id).filter(Boolean))];
    const registre = registreIds.length ? await P.parPaquets(registreIds, 100, (l) => P.bd(sb.from('agence_mannequins').select('id, full_name').in('id', l))).catch(() => []) : [];
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
  let ecran = null;  // { projet, personnes, apercus: { cle: url locale } }
  async function choixEvenement() {
    const depuis = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    const projets = await P.bd(sb.from('agenda_projets').select('id, titre, date_debut, date_fin, lieu, ville, annule').gte('date_debut', depuis).eq('annule', false).order('date_debut'));
    return P.entete('Cartes d’événement') +
      '<p class="doux">Choisissez l’événement : les mannequins qui ont confirmé leur présence apparaissent, touchez-en une pour faire sa carte.</p>' +
      (projets.length ? '<div class="projets-liste">' + projets.map((p, i) => '<a class="projet-carte apparait ca-evenement" style="--i:' + Math.min(i, 10) + '" href="#/site/' + PAGE + '/' + P.esc(p.id) + '">' +
        '<h2>' + P.esc(p.titre) + '</h2><p class="doux">' + P.esc(datesProjet(p) + ([p.lieu, p.ville].filter(Boolean).length ? ' · ' + [p.lieu, p.ville].filter(Boolean).join(', ') : '')) + '</p></a>').join('') + '</div>'
        : '<div class="carte vide">Aucun événement dans l’Agenda pour le moment.</div>');
  }
  async function evenement(id) {
    const r = await P.bd(sb.from('agenda_projets').select('*').eq('id', id));
    if (!r.length) return P.entete('Cartes d’événement') + '<div class="carte vide">Cet événement n’existe plus.</div>';
    const projet = r[0], personnes = await confirmees(projet);
    Object.values((ecran && ecran.apercus) || {}).forEach((u) => URL.revokeObjectURL(u));
    ecran = { projet, personnes, apercus: {} };
    // photos ajoutées pour les cartes : aperçu dans la liste
    await Promise.all(personnes.filter((c) => c.chemin).map(async (c) => {
      const blob = await P.bd(sb.storage.from(STOCKAGE).download(c.chemin)).catch(() => null);
      if (blob) ecran.apercus[c.cle] = URL.createObjectURL(blob);
    }));
    const cartes = personnes.map((c, i) => '<li class="ca-carte">' +
      '<button type="button" class="ca-faire" data-action="carte-une" data-i="' + i + '" aria-label="Faire la carte de ' + P.esc(c.nom) + '">' +
      P.visage(ecran.apercus[c.cle] || c.vignette, c.nom, 'ca-vis') + '<span class="ca-nom">' + P.esc(c.nom) + '</span><span class="doux">N° ' + c.numero + ' · 🎫 sa carte</span></button>' +
      (c.photo && !c.chemin ? '' : '<label class="btn petit ca-photo">📷 ' + (c.chemin ? 'Changer la photo' : 'Ajouter une photo') +
        '<input type="file" accept="image/*" data-change="carte-photo" data-i="' + i + '"></label>') + '</li>').join('');
    return P.entete('Cartes · ' + projet.titre, '<a class="btn" href="#/site/' + PAGE + '">← Choisir un autre événement</a>') +
      '<p class="doux">' + P.esc([datesProjet(projet), [projet.lieu, projet.ville].filter(Boolean).join(', ')].filter(Boolean).join(' · ')) + '</p>' +
      (personnes.length ? '<div class="carte"><label class="fl" for="ca-organisateur">Organisé par (écrit sur les cartes)<input id="ca-organisateur" maxlength="80" value="' + P.esc(projet.client || ORGANISATEUR) + '"></label>' +
        '<p class="doux petit-texte">' + P.pluriel(personnes.length, 'mannequin a confirmé', 'mannequins ont confirmé') + ' sa présence. Celles qui n’ont pas encore répondu, ou qui sont absentes, n’ont pas de carte.</p>' +
        '<ul class="ca-liste">' + cartes + '</ul>' +
        '<div class="ligne"><button type="button" class="btn rouge" data-action="cartes-toutes">🖨️ Toutes les cartes (2 par feuille A4)</button></div></div>'
        : '<div class="carte vide">Aucune mannequin n’a encore confirmé sa présence à cet événement (Convocations : lien « Confirmez votre présence »).</div>');
  }
  const organisateur = () => String((document.getElementById('ca-organisateur') || {}).value || '').trim() || ORGANISATEUR;
  async function fabriquer(cartes, seule, bouton) {
    if (bouton) bouton.disabled = true;
    P.message('Fabrication ' + (seule ? 'de la carte…' : 'des cartes… (' + cartes.length + ')'));
    try {
      await fabriquerPdf(Object.assign({}, ecran.projet, { organisateur: organisateur() }), cartes, seule);
      P.message(seule ? 'Carte de ' + cartes[0].nom + ' prête : le PDF est téléchargé.' : P.pluriel(cartes.length, 'carte prête', 'cartes prêtes') + ' : le PDF est téléchargé.');
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
    await P.bd(sb.storage.from(STOCKAGE).upload(chemin, jpeg, { contentType: 'image/jpeg', upsert: false }));
    await P.bd(sb.from('cartes_photos').upsert({ cle: c.cle, chemin, mis_a_jour: new Date().toISOString() }).select('cle'));
    if (c.chemin) await P.bd(sb.storage.from(STOCKAGE).remove([c.chemin])).catch(() => null);
    P.message('Photo de ' + c.nom + ' enregistrée pour ses cartes.');
    return P.afficher();
  };
  // raccourcis (Agenda, Programmation défilé) : la rubrique, sur cet événement
  P.actions['cartes-acces'] = (el) => { location.hash = '#/site/' + PAGE + (el.dataset.id ? '/' + encodeURIComponent(el.dataset.id) : ''); };
  if (P.espaces.site) P.espaces.site.pages[PAGE] = (args) => (args && args[0] ? evenement(decodeURIComponent(args[0])) : choixEvenement());
})();
