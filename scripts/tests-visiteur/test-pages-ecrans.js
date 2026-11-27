// Vérifie le parcours écran par écran depuis le vrai menu, avec des services simulés.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
const { brancher } = require('./faux-serveur');
const port = 9700 + Math.floor(Math.random() * 60);
const site = 'http://127.0.0.1:' + port;
const parcours = ['cours-talons', 'candidature', 'integrer-agence', 'academie', 'representation'];

(async () => {
  const serveur = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'],
    { cwd: resolve(__dirname, '../..'), stdio: 'ignore' });
  let navigateur;
  try {
    navigateur = await chromium.launch();
    for (const [prefixe, largeur, hauteur] of [['', 390, 844], ['', 820, 1180], ['en/', 1366, 900]]) {
      const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, reducedMotion: 'reduce' });
      await page.route('**/*', (route) => route.request().url().startsWith(site + '/') ? route.continue() : route.abort());
      await brancher(page, { tables: { casting_projets: [{ nom: 'Casting d’essai', actif: true }] }, rpc: { casting_ouvert: true } }, []);
      await page.addInitScript(() => {
        localStorage.setItem('ma2m_cookies', 'non');
        sessionStorage.setItem('ma2m_entree_vue', '1');
      });
      for (const nom of parcours) {
        await page.goto(site + '/' + prefixe);
        await page.locator('#menuBtn').click();
        await page.locator('#menuOverlay a[href="' + nom + '.html"]').first().click();
        await page.locator('body.ma2m-ecrans-pleins').waitFor();
        const ecrans = page.locator('main > .ecran');
        const courant = page.locator('main > .ecran-courant');
        const suivant = page.locator('.ecrans-suivant');
        const total = await ecrans.count();
        assert.ok(total >= 3);
        for (let i = 1; i <= total; i++) {
          assert.equal(await courant.getAttribute('data-ecran'), String(i));
          const cadre = await suivant.boundingBox();
          assert.ok(cadre.y + cadre.height <= hauteur && cadre.y > hauteur - 150, nom + ' : bouton en bas');
          const dimensions = await courant.evaluate((e) => ({ surplus: e.scrollHeight - e.clientHeight, hauteur: e.clientHeight }));
          assert.ok(dimensions.hauteur > hauteur * .64, nom + ' : hauteur de l’écran');
          assert.ok(dimensions.surplus <= 10, nom + ' ' + largeur + ' écran ' + i + ' déborde de ' + dimensions.surplus + ' px');
          if (i === 2) {
            await page.locator('.ecrans-retour').click();
            await page.waitForFunction(() => document.querySelector('.ecran-courant').dataset.ecran === '1');
            await suivant.click();
          }
          await suivant.click();
        }
        await page.waitForURL((url) => nom === 'integrer-agence' ? url.pathname.includes('candidature-ma2m') : url.searchParams.get('vue') === 'candidature');
        if (nom !== 'integrer-agence') {
          await page.locator(nom === 'cours-talons' ? 'body.ma2m-talons-autonome' : 'body.ma2m-vue-candidature').waitFor();
        }
        console.log(nom, prefixe ? 'anglais' : 'français', largeur, 'px :', total, 'écrans vérifiés');
      }
      await page.close();
    }
  } finally {
    if (navigateur) await navigateur.close();
    serveur.kill();
  }
})().catch((erreur) => { console.error(erreur); process.exitCode = 1; });
