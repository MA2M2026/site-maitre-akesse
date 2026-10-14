// Pages publiques dont le script est commun au français et à l'anglais (11/10/2026) : accueil,
// Nos mannequins, fiche mannequin, Actualités, Événements, Partenaires. Chaque page est ouverte
// comme un visiteur (base simulée) ; on vérifie que le contenu attendu s'affiche dans la bonne
// langue, sans erreur. Échec bloquant (code de sortie 1) si quelque chose manque.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(8800 + Math.floor(Math.random() * 100));
const tables = {
  model_profiles: [{ id: 'a1', full_name: 'Awa Koné', city: 'Abidjan', height_cm: 178, weight_kg: 55, category: 'femme', genre: 'femme', published: true, featured: true, slug: 'awa-kone' }],
  model_photos: [{ id: 'p1', model_id: 'a1', url: 'https://x/1.jpg', principale: true, categorie: 'book' }],
  actualites: [{ id: 'n1', titre: 'Casting Orange', contenu: '<p>Texte</p>', categorie: 'Casting', created_at: '2026-10-01T10:00:00Z', a_la_une: true }],
  evenements: [{ id: 'e1', titre: 'Défilé Abidjan', contenu: '<p>D</p>', date_evenement: '2026-09-20', created_at: '2026-09-21T10:00:00Z' }],
  partenaires: [{ id: 'pa', nom: 'Orange CI', logo_url: 'https://x/o.png' }],
  // expériences écrites par la mannequin : « Défilé Abidjan » saisi trois fois (doublons de
  // l'agenda, remplacés par le projet de l'agence) et un shooting à elle (gardé)
  model_projects: [
    { id: 'x1', model_id: 'a1', type_projet: 'Défilé', titre: 'Défilé Abidjan', periode: '2026', created_at: '2026-09-01T10:00:00Z' },
    { id: 'x2', model_id: 'a1', type_projet: 'Défilé', titre: 'DEFILE ABIDJAN', periode: '2026', created_at: '2026-09-02T10:00:00Z' },
    { id: 'x3', model_id: 'a1', type_projet: 'Défilé', titre: 'défilé abidjan 2026', periode: '2026', created_at: '2026-09-03T10:00:00Z' },
    { id: 'x4', model_id: 'a1', type_projet: 'Shooting', titre: 'Shooting Marque Perso', periode: '2025', created_at: '2026-08-01T10:00:00Z' },
    // même nom mais autre année : une autre édition, gardée
    { id: 'x5', model_id: 'a1', type_projet: 'Défilé', titre: 'Défilé Abidjan', periode: '2023', created_at: '2026-08-02T10:00:00Z' }],
  bandeau_annonce: [], instagram_posts_cache: [], mot_responsable: [], admins: []
};
const cas = [
  ['mannequins.html', ['Awa Koné']], ['en/mannequins.html', ['Awa Koné']],
  ['mannequin.html?id=a1', ['Awa Koné', 'Taille']], ['en/mannequin.html?id=a1', ['Awa Koné', 'Height', 'lbs']],
  ['actualites.html', ['Casting Orange', 'À la une']], ['en/actualites.html', ['Casting Orange', 'Featured']],
  ['evenements.html', ['Défilé Abidjan', '20 septembre 2026']], ['en/evenements.html', ['Défilé Abidjan', 'September 20, 2026']],
  ['partenaires.html', ['Voir la fiche']], ['en/partenaires.html', ['View Details']],
  ['index.html', ['Awa Koné', 'Femme']], ['en/index.html', ['Awa Koné', 'Female']],
  ['parcours.html', ['Défilé Abidjan', 'septembre 2026', 'Awa Koné']], ['en/parcours.html', ['Défilé Abidjan', 'Our models at work', 'Awa Koné']],
  // fiche : expériences (projets de l'agence inclus) ; l'encadré « Avec MA2M » est retiré (12/10/2026)
  ['mannequin.html?id=a1', ['Shooting Marque Perso']],
  // agenda public : partenaire indirect et mannequin sans profil, écrits à la main (Ext. 137/138)
  ['agenda.html', ['Forum Test', 'Maison XYZ', 'Fatou Bamba']], ['en/agenda.html', ['Forum Test', 'Maison XYZ', 'Fatou Bamba']]
];
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const [i, [page, attendus]] of cas.entries()) {
    const vp = i % 2 ? { width: 1280, height: 900 } : { width: 390, height: 844 };
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await brancher(p, { tables, rpc: { photos_couverture_mannequins: [{ model_id: 'a1', url: 'https://x/1.jpg' }],
      agenda_public: [{ id: 'g1', type: 'evenement', titre: 'Forum Test', date_debut: '2030-10-21', date_fin: '2030-10-22', ville: 'Abidjan', lieu: 'Sofitel', description: '', intervenants: [], seances: [],
        partenaires: [{ id: null, nom: 'Maison XYZ', logo_url: null }], mannequins: [{ id: 'a1', nom: 'Awa Koné', slug: 'awa-kone' }, { id: null, nom: 'Fatou Bamba', slug: null }] }],
      // Parcours MA2M : un projet réalisé de l'agenda (Extension 136)
      parcours_public: [{ id: 'e1', type: 'evenement', titre: 'Défilé Abidjan', date_debut: '2026-09-20', date_fin: null, lieu: 'Sofitel', ville: 'Abidjan', pays: "Côte d'Ivoire", mannequins: [{ id: 'a1', nom: 'Awa Koné', slug: 'awa-kone' }] },
        // casting ouvert de l'agence sans aucune de nos mannequins cochée : ne doit pas apparaître
        // mannequin de l'agence sans profil sur le site, écrite à la main (Extension 137) : nom sans lien
        { id: 'e3', type: 'shooting', titre: 'Shooting Cacao', date_debut: '2026-09-05', date_fin: null, lieu: '', ville: 'Abidjan', pays: "Côte d'Ivoire", mannequins: [{ id: null, nom: 'Fatou Bamba', slug: null }] },
        { id: 'e2', type: 'casting', titre: 'Casting ouvert sans nos mannequins', date_debut: '2026-09-10', date_fin: null, lieu: '', ville: 'Abidjan', pays: "Côte d'Ivoire", mannequins: [] }] } }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1500);
    const entrer = await p.$('text=/^\\s*(Entrer|Enter)\\s*$/i'); if (entrer) await entrer.click().catch(() => {});
    await p.waitForTimeout(2500);
    const texte = await p.evaluate(() => document.body.innerText);
    const manquants = attendus.filter(t => !texte.toLowerCase().includes(t.toLowerCase()));
    // Barre du haut, menu et bas de page communs (js/gabarit.js, 11/10/2026)
    const gabarit = await p.evaluate(() => ({
      langue: (document.querySelector('.lang-switch') || {}).href || '',
      menu: document.querySelectorAll('#menuOverlay .nav-links a').length,
      // menu « Modèle A » : Accueil puis The Book en tête, « Intégrer l'agence » en bouton rouge
      ordre: [...document.querySelectorAll('#menuOverlay .nav-links > li:not(.menu-sous) > a')].slice(0, 2).map(x => (x.getAttribute('href') || '').replace(/^.*\//, '')).join(','),
      rejoindre: !!document.querySelector('#menuOverlay li.menu-rejoindre a[href$="integrer-agence.html"]'),
      pied: !!document.querySelector('.site-footer .footer-grille'),
      // bas de page : ordre d'origine gardé (Intégrer l'agence avant Postuler, The Book avant Parcours)
      ordrePied: (() => { const h = [...document.querySelectorAll('.footer-grille a')].map(x => (x.getAttribute('href') || '').replace(/^.*\//, ''));
        return h.indexOf('integrer-agence.html') < h.indexOf('candidature.html') && h.indexOf('mannequins.html') < h.indexOf('parcours.html'); })(),
      annee: (document.getElementById('an') || {}).textContent || ''
    }));
    const autreLangue = page.startsWith('en/') ? '/' + page.slice(3).split('?')[0] : '/en/' + page.split('?')[0];
    // Fiche mannequin : le lien de langue mène à l'adresse « book » de la mannequin (js/fiche-mannequin.js).
    const attenduLangue = page.includes('mannequin.html?') ? (page.startsWith('en/') ? '/book/awa-kone' : '/en/book/awa-kone') : autreLangue;
    if (!gabarit.langue.endsWith(attenduLangue)) manquants.push('lien de langue (' + gabarit.langue + ')');
    if (gabarit.menu < 10) manquants.push('menu (' + gabarit.menu + ' liens)');
    if (gabarit.ordre !== 'index.html,mannequins.html' || !gabarit.rejoindre) manquants.push('ordre du menu (' + gabarit.ordre + ', bouton Intégrer : ' + gabarit.rejoindre + ')');
    if (page.includes('parcours') && texte.toLowerCase().includes('casting ouvert sans nos mannequins')) manquants.push('projet sans nos mannequins affiché');
    if (page.includes('parcours') || page.includes('agenda')) {
      const libre = await p.evaluate(() => ({ nom: document.body.innerText.includes('Fatou Bamba'), mauvaisLien: !!document.querySelector('a[href*="null"], a[href*="undefined"], a[href=""]') }));
      if (!libre.nom || libre.mauvaisLien) manquants.push('mannequin écrite à la main (' + JSON.stringify(libre) + ')');
    }
    // Journal du 14/10/2026 : en-tête du calendrier plus large que l'écran du téléphone.
    // Chaque vue (Année, Mois, Semaine, Jour : titres de longueurs différentes) sur 320 px.
    if (page.includes('agenda')) {
      await p.setViewportSize({ width: 320, height: 640 }); await p.waitForTimeout(300); // plus petit téléphone courant
      for (let v = 0; v < 4; v++) {
        await p.evaluate(i => document.querySelectorAll('.cal-vue')[i].click(), v); await p.waitForTimeout(200);
        const r = await p.evaluate(() => ({ vue: (document.querySelector('.cal-vue.actif') || {}).textContent,
          deborde: [...document.querySelectorAll('.cal-tete, .cal-tete *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).length,
          coupe: [...document.querySelectorAll('.cal-vue, .cal-aujourdhui')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent) }));
        if (r.deborde || r.coupe.length) manquants.push('calendrier « ' + r.vue + ' » trop large pour 320 px (' + r.deborde + ' élément(s), texte coupé : ' + r.coupe.join(', ') + ')');
      }
    }
    if (!gabarit.ordrePied) manquants.push('ordre du bas de page');
    // fiche : les expériences incluent le projet de l'agence une seule fois (doublons remplacés)
    if (page.startsWith('mannequin.html')) {
      const parcoursFiche = await p.evaluate(() => (document.getElementById('fiche-parcours') || {}).innerText || '');
      const n = (parcoursFiche.match(/d[ée]fil[ée] abidjan/gi) || []).length;
      // l'encadré « Avec MA2M » et la mention « avec MA2M » sont retirés (demande de la propriétaire, 12/10/2026)
      const avecMa2m = await p.evaluate(() => !!document.getElementById('fiche-avec-ma2m') || /avec MA2M|with MA2M/i.test(document.body.innerText));
      if (avecMa2m) manquants.push('« Avec MA2M » encore affiché sur la fiche');
      if (n !== 2) manquants.push('projet de l’agence dans le parcours de la fiche (' + n + ' fois au lieu de 2 : édition 2026 de l’agence + édition 2023 de la mannequin)');
    }
    if (!gabarit.pied || gabarit.annee !== String(new Date().getFullYear())) manquants.push('bas de page');
    if (page === 'index.html') {
      await p.click('#menuBtn'); await p.waitForTimeout(1500);
      await p.click('#menuOverlay .nav-links a[href$="services.html"]');
      await p.waitForTimeout(80);
      const pendant = await p.evaluate(() => ({ ouvert: document.getElementById('menuOverlay').classList.contains('active'), appui: !!document.querySelector('#menuOverlay a.appui[href$="services.html"]') }));
      await p.waitForURL(/services\.html/, { timeout: 3000 }).catch(() => {});
      if (!pendant.ouvert || !pendant.appui || !/services\.html/.test(p.url())) manquants.push('appui sur une rubrique du menu (' + JSON.stringify(pendant) + ' → ' + p.url() + ')');
    }
    const ok = !manquants.length && !errs.length;
    console.log(`${ok ? '✓' : '❌ ÉCHEC'} ${page} (${vp.width}px)${manquants.length ? ' | manque : ' + manquants.join(', ') : ''} | erreurs : ${JSON.stringify(errs)}`);
    if (!ok) process.exitCode = 1;
    await ctx.close();
  }
  await b.close(); srv.kill();
})();
