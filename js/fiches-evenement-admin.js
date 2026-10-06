// Tableau de bord — « Fiches événement » (06/10/2026) : pour chaque mannequin, une
// fiche PDF prête à envoyer aux organisateurs de défilés (identité, contacts,
// mensurations, informations événements, réseaux sociaux). Données lues au moment
// du téléchargement (fonction fiche_evenement_admin, Extension 120, réservée aux
// admins) : la fiche est donc toujours à jour. Contacts affichés : ceux de l'agence. Jamais de pièce d'identité. Les
// mannequins ne peuvent pas la télécharger.
(function () {
  var details = document.getElementById('fiches-evenement-details');
  if (!details || typeof sb === 'undefined' || !sb) return;
  var charge = false;

  function echapper(t) { return typeof echapperHtml === 'function' ? echapperHtml(t) : String(t == null ? '' : t); }

  // Lien cliquable à partir d'un nom ou d'un lien (Instagram, TikTok, Facebook).
  function lienReseau(reseau, valeur) {
    var v = String(valeur || '').trim();
    if (!v) return null;
    if (/^https?:\/\//i.test(v)) return v;
    if (/^[\w.-]+\.[a-z]{2,}\//i.test(v)) return 'https://' + v; // lien sans « https:// » (m.facebook.com/…, vm.tiktok.com/…)
    var nom = v.replace(/^@/, '');
    if (/\s/.test(nom)) return null; // nom affiché tel quel (ex. « Awa Konaté » sur Facebook)
    if (reseau === 'instagram') return 'https://www.instagram.com/' + encodeURIComponent(nom);
    if (reseau === 'tiktok') return 'https://www.tiktok.com/@' + encodeURIComponent(nom);
    return 'https://www.facebook.com/' + encodeURIComponent(nom);
  }

  async function genererPdf(d) {
    await chargerJsPdf();
    var image = await chargerImageLocale('assets/logo-header.png'); // logo partagé (js/app.js)
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var L = 210, M = 16, y;
    var BORDEAUX = [122, 18, 32], NOIR = [6, 5, 4], GRIS = [110, 102, 96];

    // En-tête
    doc.setFillColor(NOIR[0], NOIR[1], NOIR[2]); doc.rect(0, 0, L, 34, 'F');
    if (image) { try { var hLogo = 16, lLogo = hLogo * image.largeur / image.hauteur; doc.addImage(image.canvas.toDataURL('image/png'), 'PNG', M, 9, lLogo, hLogo, undefined, 'FAST'); } catch (e) {} }
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text('FICHE ÉVÉNEMENT', L - M, 16, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text('Maître Akesse Model Management · Abidjan', L - M, 23, { align: 'right' });
    doc.setFillColor(BORDEAUX[0], BORDEAUX[1], BORDEAUX[2]); doc.rect(0, 34, L, 1.4, 'F');

    // Nom
    y = 48;
    doc.setTextColor(NOIR[0], NOIR[1], NOIR[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    doc.text(String(d.full_name || 'Mannequin').toUpperCase(), M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    doc.text([d.category === 'femme' ? 'Femme' : d.category === 'homme' ? 'Homme' : '', d.city || ''].filter(Boolean).join(' · '), M, y + 7);
    y += 16;

    function section(titre) {
      if (y > 262) { doc.addPage(); y = 20; }
      doc.setFillColor(BORDEAUX[0], BORDEAUX[1], BORDEAUX[2]); doc.rect(M, y, L - 2 * M, 8, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(titre, M + 3, y + 5.5); y += 12;
    }
    function ligne(libelle, valeur, lien) {
      var texte = (valeur === null || valeur === undefined || valeur === '') ? '—' : String(valeur);
      if (lien && texte === lien) texte = texte.replace(/^https?:\/\/(www\.)?/i, ''); // lien affiché sans « https://www. »
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
      var lignes = doc.splitTextToSize(texte, 106);
      // saut de page AVANT d'écrire, en tenant compte de la hauteur réelle (texte long) :
      // rien ne doit passer sous le pied de page
      if (y + 4.8 * lignes.length > 276) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setTextColor(NOIR[0], NOIR[1], NOIR[2]);
      doc.text(libelle, M + 2, y);
      doc.setFont('helvetica', 'normal');
      if (lien) { doc.setTextColor(BORDEAUX[0], BORDEAUX[1], BORDEAUX[2]); doc.textWithLink(lignes[0], 86, y, { url: lien }); }
      else { doc.setTextColor(50, 46, 43); doc.text(lignes, 86, y); }
      y += 4.8 * Math.max(1, lien ? 1 : lignes.length) + 1.6;
      doc.setDrawColor(220, 214, 208); doc.line(M, y - 3.6, L - M, y - 3.6);
    }
    var cm = function (v) { return v ? v + ' cm' : ''; };

    section('1. IDENTITÉ & CONTACT');
    ligne('Nom complet', d.full_name);
    ligne('Genre', d.category === 'femme' ? 'Féminin' : d.category === 'homme' ? 'Masculin' : '');
    ligne('Âge', d.age != null ? d.age + ' ans' : '');
    ligne('Nationalité', d.nationalite);
    // Contacts : toujours ceux de l'agence sur les documents officiels (décision de la
    // propriétaire, 06/10/2026) — jamais le téléphone ni l'e-mail du mannequin.
    ligne('Contact (agence MA2M)', '+225 27 22 23 11 76 · +225 05 45 65 66 87');
    ligne('E-mail (agence MA2M)', 'infos.ma2m@gmail.com');
    ligne('Adresse', [d.quartier, d.city].filter(Boolean).join(', '));

    section('2. MENSURATIONS');
    ligne('Taille', cm(d.height_cm));
    ligne('Poids', d.weight_kg ? d.weight_kg + ' kg' : '');
    ligne('Tour de poitrine', cm(d.chest_cm));
    ligne('Tour de taille', cm(d.waist_cm));
    ligne('Tour de hanches', cm(d.hips_cm));
    ligne('Pointure (EU)', d.shoe_size);
    ligne('Taille haut', d.taille_haut || d.clothing_size);
    ligne('Taille bas', d.taille_bas);
    ligne('Yeux / cheveux', [d.eye_color, d.hair_color].filter(Boolean).join(' / '));

    section('3. ÉVÉNEMENTS');
    ligne('Régime / allergies', d.regime_allergies);
    ligne('Droit à l’image', d.droit_image === true ? 'Oui' : d.droit_image === false ? 'Non' : '');

    section('4. RÉSEAUX SOCIAUX & BOOK');
    ligne('Instagram', d.instagram, lienReseau('instagram', d.instagram));
    ligne('TikTok', d.tiktok, lienReseau('tiktok', d.tiktok));
    ligne('Facebook', d.facebook, lienReseau('facebook', d.facebook));
    var book = d.slug ? MA2M_SITE + '/book/' + d.slug : '';
    ligne('Book en ligne', book, book || null);

    // Pied de page
    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFillColor(NOIR[0], NOIR[1], NOIR[2]); doc.rect(0, 282, L, 15, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text(MA2M_CONTACT_PDF, L / 2, 288, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.text('Document confidentiel réservé à l’organisation de l’événement — généré le ' + new Date().toLocaleDateString('fr-FR') + ' · maitreakessemodelmanagement.com', L / 2, 293, { align: 'center' });
    }
    var nom = String(d.full_name || 'mannequin').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    doc.save('fiche-evenement-' + nom + (typeof horodatageFichier === 'function' ? horodatageFichier() : '') + '.pdf');
  }

  async function telecharger(btn) {
    var texte = btn.textContent;
    btn.disabled = true; btn.textContent = 'Préparation…';
    try {
      var r = await sb.rpc('fiche_evenement_admin', { id_mannequin: btn.dataset.id });
      if (r.error || !r.data) throw new Error(r.error ? r.error.message : 'fiche introuvable');
      await genererPdf(r.data);
    } catch (e) {
      alert('Impossible de préparer la fiche : ' + (e && e.message ? e.message : e));
    } finally {
      btn.disabled = false; btn.textContent = texte;
    }
  }

  async function charger() {
    charge = true;
    var zone = document.getElementById('fiches-evenement-liste');
    zone.textContent = 'Chargement…';
    var pr = await sb.from('model_profiles').select('id, full_name, published').not('full_name', 'is', null).order('full_name');
    if (pr.error) { zone.textContent = 'Erreur : ' + pr.error.message; return; }
    var fe = await sb.from('fiche_evenement').select('model_id, mis_a_jour, taille_haut, taille_bas, regime_allergies, tiktok, facebook, droit_image');
    if (fe.error) { zone.innerHTML = '<p class="tdb-9">Les fiches événement seront disponibles après l’exécution de l’Extension 120 dans Supabase.</p>'; return; }
    // « remplies » seulement si au moins une information a vraiment été donnée
    var remplies = {}; (fe.data || []).forEach(function (f) {
      if (f.taille_haut || f.taille_bas || f.regime_allergies || f.tiktok || f.facebook || f.droit_image != null) remplies[f.model_id] = f.mis_a_jour;
    });
    var liste = (pr.data || []).filter(function (m) { return (m.full_name || '').trim(); });
    zone.innerHTML = liste.length ? liste.map(function (m) {
      var etat = remplies[m.id] ? '✓ informations événements remplies le ' + new Date(remplies[m.id]).toLocaleDateString('fr-FR') : 'informations événements pas encore remplies';
      return '<div class="fe-ligne"><div><strong>' + echapper(m.full_name) + '</strong>' + (m.published ? '' : ' <span class="fe-non-publie">(non publiée)</span>') +
        '<br><span class="fe-etat' + (remplies[m.id] ? ' ok' : '') + '">' + etat + '</span></div>' +
        '<button class="btn fe-btn" type="button" data-id="' + echapper(m.id) + '">⬇ Télécharger la fiche</button></div>';
    }).join('') : '<div class="dossiers-vide">Aucun mannequin.</div>';
  }

  details.addEventListener('toggle', function () { if (details.open && !charge) charger(); });
  details.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.fe-btn');
    if (b) telecharger(b);
  });
})();
