// Vérifie les quatre parcours depuis le menu public, avec des services simulés.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
const { brancher } = require('./faux-serveur');

const port = 9700 + Math.floor(Math.random() * 60);
const site = 'http://127.0.0.1:' + port;
const parcours = ['cours-talons', 'academie', 'candidature', 'representation'];

(async () => {
  const serveur = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'],
    { cwd: resolve(__dirname, '../..'), stdio: 'ignore' });
  let navigateur;
  try {
    navigateur = await chromium.launch();
    for (const [prefixe, largeur, hauteur] of [['', 390, 844], ['en/', 390, 844], ['', 820, 1180], ['en/', 1366, 900]]) {
      const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur } });
      await page.route('**/*', (route) => route.request().url().startsWith(site + '/') ? route.continue() : route.abort());
      await brancher(page, { tables: { casting_projets: [{ nom: 'Casting d’essai', actif: true }] }, rpc: { casting_ouvert: true } }, []);
      await page.addInitScript(() => {
        localStorage.setItem('ma2m_cookies', 'non');
        sessionStorage.setItem('ma2m_entree_vue', '1');
      });
      for (const nom of parcours) {
        const talons = nom === 'cours-talons';
        await page.goto(site + '/' + prefixe);
        await page.locator('#menuBtn').click();
        await page.locator('#menuOverlay a[href="' + nom + '.html"]').first().click();
        await page.waitForURL('**/' + prefixe + nom + '.html');
        const couverture = page.locator('.ma2m-couverture-parcours');
        await couverture.waitFor();
        assert.equal(await page.locator('.ecrans-barre').count(), 0);
        assert.equal(await page.locator('.whatsapp-flottant:visible').count(), 0);
        await couverture.locator('.ma2m-lien-infos').click();
        assert.equal(new URL(page.url()).hash, '#informations-parcours');
        await page.waitForFunction(() => document.querySelector("#informations-parcours").getBoundingClientRect().top < 170);
        const liens = await page.locator('.ma2m-rubriques a').all();
        assert.ok(liens.length >= 2);
        for (const lien of liens) {
          assert.equal(await page.locator(await lien.getAttribute('href')).count(), 1);
        }
        await couverture.locator('.ma2m-action').click();
        await page.waitForURL((url) => url.searchParams.get('vue') === 'candidature');
        await page.locator(talons ? 'body.ma2m-talons-autonome' : 'body.ma2m-vue-candidature').waitFor();
        const bouton = page.locator(talons ? '#ct-suivant' : '.lx-etape:not([hidden]) .lx-suivant');
        await bouton.waitFor();
        assert.equal(await couverture.isVisible(), false);
        const cadre = await bouton.boundingBox();
        assert.ok(cadre.y + cadre.height <= hauteur && cadre.y + cadre.height > hauteur - 120);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        console.log(nom, prefixe ? 'anglais' : 'français', largeur, 'px : menu, couverture, rubriques et formulaire vérifiés');
      }
      await page.close();
    }
  } finally {
    if (navigateur) await navigateur.close();
    serveur.kill();
  }
})().catch((erreur) => { console.error(erreur); process.exitCode = 1; });
