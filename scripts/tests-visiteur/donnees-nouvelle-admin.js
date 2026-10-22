// Base SIMULÉE de la nouvelle Administration (PLAN-NOUVELLE-ADMINISTRATION.md) : données
// réalistes mais fictives, partagées par les essais test-nouvelle-admin*.js. Rien de réel.
const auj = () => new Date().toLocaleDateString('fr-CA', { timeZone: 'Africa/Abidjan' });
const dansJours = (n) => { const d = new Date(Date.now() + n * 864e5); return d.toLocaleDateString('fr-CA', { timeZone: 'Africa/Abidjan' }); };
const NOMS = ['AYA KOUASSI', 'MARIAM TRAORÉ', 'GRÂCE YAO', 'FATIM DIALLO', 'ESTHER N’GUESSAN', 'LAURA BLÉ', 'SARAH KONAN', 'NADIA OUATTARA', 'CHRISTELLE AKA', 'JOSÉE KOFFI', 'JIGGER GALITO', 'YANN KOUAMÉ'];
const photo = (i) => 'https://www.maitreakessemodelmanagement.com/book-photos/m' + i + '/miniatures/1792000000000-abc-n800-w.jpg';

function donnees(role) {
  role = role || 'principal';
  const espaces = { site: role === 'principal' || role === 'site', paiements: role === 'principal' || role === 'caisse', compta: role === 'principal' || role === 'compta' };
  const profils = NOMS.map((n, i) => ({ id: 'm' + i, full_name: n, published: true, desactive: false, city: i % 3 ? 'Abidjan' : 'Cocody', category: i > 9 ? 'homme' : 'femme',
    niveau_mannequin: i % 4 ? 'New Face' : 'Main Board', created_at: '2026-10-' + String(20 - i).padStart(2, '0') + 'T10:00:00Z' }));
  return {
    memoriser: true,
    portail: { aal: 'aal1', facteurs: true },
    tables: {
      admins: [{ user_id: 'admin-1' }],
      staff_profiles: [{ user_id: 'admin-1', nom: 'Maître Akesse', email: 'admin@test.ci', role, actif: true, cree_le: '2026-10-19', appareils: [] }],
      staff_module_grants: [], staff_devices: [], audit_log: [],
      model_profiles: profils,
      casting_applications: [
        { id: 'c1', full_name: 'AWA KONÉ', email: 'awa@test.ci', phone: '+225 0102030405', genre: 'femme', date_naissance: '2000-01-01', type_candidature: 'agence', status: 'nouvelle', created_at: '2026-10-21T10:00:00Z' },
        { id: 'c2', full_name: 'BINTOU TRAORÉ', email: 'bintou@test.ci', phone: '+225 0505050505', genre: 'femme', date_naissance: '1998-01-01', type_candidature: 'agence', status: 'nouvelle', created_at: '2026-10-20T10:00:00Z' },
        { id: 'c3', full_name: 'YAO KOUASSI', email: 'yao@test.ci', phone: '+225 0707070707', genre: 'homme', date_naissance: '1999-01-01', type_candidature: 'agence', status: 'retenue', created_at: '2026-10-09T10:00:00Z' }],
      agenda_projets: [
        { id: 'p1', type: 'defile', titre: 'ABIDJAN BORDER FORUM', date_debut: auj(), date_fin: null, lieu: 'Parc des Expositions', ville: 'Abidjan', annule: false, visible: true,
          mannequin_ids: ['m0', 'm1', 'm2', 'm3'], partenaire_ids: [], seances: [], intervenants: [], mannequins_libres: [], partenaires_libres: [] },
        { id: 'p2', type: 'shooting', titre: 'SHOOTING CACAO', date_debut: dansJours(12), date_fin: null, lieu: 'Studio MA2M', ville: 'Abidjan', annule: false, visible: true,
          mannequin_ids: [], partenaire_ids: [], seances: [], intervenants: [], mannequins_libres: [], partenaires_libres: [] }],
      convocation_participants: [
        { id: 'cp1', projet_id: 'p1', model_id: 'm0', nom: 'Mademoiselle AYA KOUASSI', parent: false, reponse: 'confirme' },
        { id: 'cp2', projet_id: 'p1', model_id: 'm1', nom: 'Mademoiselle MARIAM TRAORÉ', parent: false, reponse: 'confirme' },
        { id: 'cp3', projet_id: 'p1', model_id: 'm2', nom: 'Mademoiselle GRÂCE YAO', parent: false, reponse: null },
        { id: 'cp4', projet_id: 'p1', model_id: 'm3', nom: 'Mademoiselle FATIM DIALLO', parent: false, reponse: null }],
      convocation_envois: [],
      agence_mannequins: profils.slice(0, 6).map((p, i) => ({ id: 'r' + i, full_name: p.full_name, telephone: '07000000' + (10 + i), mensualite: 10000, statut: 'actif', user_id: null, date_entree: '2026-09-01' })),
      paiements_mannequins: [
        { id: 'pm1', mannequin_id: 'r1', objet: 'mensualite', mois: '2026-10-01', montant: 10000, mode: 'wave', statut: 'declare', declare_le: '2026-10-19T09:00:00Z', mannequin: { full_name: 'MARIAM TRAORÉ', telephone: '0700000011' } },
        { id: 'pm2', mannequin_id: 'r2', objet: 'mensualite', mois: '2026-10-01', montant: 10000, mode: 'wave', statut: 'declare', declare_le: '2026-10-20T09:00:00Z', mannequin: { full_name: 'GRÂCE YAO', telephone: '0700000012' } }],
      codes_espace: [], compta_comptes: [{ id: 'k1', nom: 'Caisse (espèces)', type: 'caisse', solde_initial: 0, date_initiale: '2026-10-01', actif: true }], compta_ecritures: []
    },
    rpc: {
      portail_moi: { role, mfa: true, nom: 'Maître Akesse', actif: true, membre: true, espaces, contacts_prives: role !== 'site' && role !== 'compta', noms_payeurs: espaces.paiements },
      portail_enregistrer_appareil: { ok: true, nouveau: false },
      portail_code_appareil_etat: { defini: true, verrouille: false },
      code_validation_statut: [{ defini: true }],
      photos_couverture_mannequins: profils.map((p, i) => ({ model_id: p.id, url: photo(i) })),
      compta_soldes: [{ compte_id: 'k1', nom: 'Caisse (espèces)', type: 'caisse', solde: 235000 }]
    },
    api: { '/api/portail': () => ({ ok: true }) }
  };
}

// Photos du Book : servies par le serveur local (images d'essai), jamais par Cloudflare ni Vercel
async function photosLocales(page) {
  const fs = require('fs'), chemin = require('path');
  const images = ['photo0.jpg', 'photo1.jpg', 'photo2.jpg', 'photo3.jpg'].map((f) => fs.readFileSync(chemin.join(__dirname, 'medias', f)));
  await page.route(/photos\.maitreakessemodelmanagement\.com|\/book-photos\//, (r) => {
    const n = Number((/\/m(\d+)\//.exec(r.request().url()) || [0, 0])[1]);
    r.fulfill({ status: 200, contentType: 'image/jpeg', body: images[n % images.length] });
  });
}

// Connexion à la nouvelle Administration (mot de passe + code), comme une vraie personne
async function seConnecter(p, url) {
  await p.goto(url); await p.waitForSelector('#cx-mail', { timeout: 8000 });
  await p.fill('#cx-mail', 'admin@test.ci'); await p.fill('#cx-mdp', 'motdepasse-tres-long');
  await p.click('form[data-form="connexion"] [type=submit]');
  await p.waitForSelector('#cx-code'); await p.fill('#cx-code', '123456'); await p.click('form[data-form="code"] [type=submit]');
}

module.exports = { donnees, photosLocales, seConnecter, NOMS };
