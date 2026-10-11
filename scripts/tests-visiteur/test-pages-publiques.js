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
  ['mannequin.html?id=a1', ['Avec MA2M', '1 événement']]
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
    if (page.includes('parcours')) {
      const libre = await p.evaluate(() => ({ nom: document.body.innerText.includes('Fatou Bamba'), mauvaisLien: !!document.querySelector('a[href*="null"], a[href*="undefined"], a[href=""]') }));
      if (!libre.nom || libre.mauvaisLien) manquants.push('mannequin écrite à la main (' + JSON.stringify(libre) + ')');
    }
    if (!gabarit.ordrePied) manquants.push('ordre du bas de page');
    if (!gabarit.pied || gabarit.annee !== String(new Date().getFullYear())) manquants.push('bas de page');
    const ok = !manquants.length && !errs.length;
    console.log(`${ok ? '✓' : '❌ ÉCHEC'} ${page} (${vp.width}px)${manquants.length ? ' | manque : ' + manquants.join(', ') : ''} | erreurs : ${JSON.stringify(errs)}`);
    if (!ok) process.exitCode = 1;
    await ctx.close();
  }
  await b.close(); srv.kill();
})();
