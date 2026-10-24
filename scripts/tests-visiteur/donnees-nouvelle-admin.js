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
  const d = {
    memoriser: true,
    portail: { aal: 'aal1', facteurs: true },
    tables: {
      admins: [{ user_id: 'admin-1' }],
      staff_profiles: [{ user_id: 'admin-1', nom: 'Maître Akesse', email: 'admin@test.ci', role, actif: true, cree_le: '2026-10-19', appareils: [] }],
      staff_module_grants: [], staff_devices: [], audit_log: [],
      model_profiles: profils,
      casting_applications: [
        { id: 'c4', full_name: 'PETITE AMA', email: 'ama@test.ci', phone: '+225 0101010101', genre: 'femme', civilite: 'Mademoiselle', date_naissance: '2013-03-03', type_candidature: 'projet', projet_nom: 'CASTING CACAO',
          status: 'nouvelle', created_at: '2026-10-22T08:00:00Z', city: 'Cocody', experience_mannequin: 'non', height_cm: 158, parent_nom: 'Madame Ama Mère', parent_telephone: '0707070707', parent_email: 'mere@test.ci',
          message: 'Je rêve de défiler pour MA2M.', video_url: 'https://drive.google.com/file/d/abc123/view' },
        { id: 'c1', full_name: 'AWA KONÉ', email: 'awa@test.ci', phone: '+225 0102030405', genre: 'femme', date_naissance: '2000-01-01', type_candidature: 'agence', status: 'nouvelle', created_at: '2026-10-21T10:00:00Z' },
        { id: 'c2', full_name: 'BINTOU TRAORÉ', email: 'bintou@test.ci', phone: '+225 0505050505', genre: 'femme', date_naissance: '1998-01-01', type_candidature: 'agence', status: 'nouvelle', created_at: '2026-10-20T10:00:00Z' },
        { id: 'c3', full_name: 'YAO KOUASSI', email: 'yao@test.ci', phone: '+225 0707070707', genre: 'homme', date_naissance: '1999-01-01', type_candidature: 'agence', status: 'retenue', created_at: '2026-10-09T10:00:00Z' }],
      agenda_projets: [
        { id: 'p1', type: 'defile', titre: 'ABIDJAN BORDER FORUM', date_debut: auj(), date_fin: null, lieu: 'Parc des Expositions', ville: 'Abidjan', annule: false, visible: true,
          mannequin_ids: ['m0', 'm1', 'm2', 'm3'], partenaire_ids: [], seances: [], intervenants: [], mannequins_libres: [], partenaires_libres: [] },
        { id: 'p2', type: 'shooting', titre: 'SHOOTING CACAO', date_debut: dansJours(12), date_fin: null, lieu: 'Studio MA2M', ville: 'Abidjan', annule: false, visible: true,
          mannequin_ids: [], partenaire_ids: [], seances: [], intervenants: [], mannequins_libres: [], partenaires_libres: [] }],
      casting_photos: [
        { id: 'ph1', application_id: 'c4', chemin: null, url: 'https://drive.google.com/uc?id=photo-ama-1' },
        { id: 'ph2', application_id: 'c4', chemin: null, url: 'https://drive.google.com/uc?id=photo-ama-2' },
        { id: 'ph3', application_id: 'c1', chemin: null, url: 'https://drive.google.com/uc?id=photo-awa-1' }],
      codes_inscription: [], contacts_externes: [],
      casting_projets: [
        { id: 'cp-a', nom: 'CASTING CACAO', description: 'Défilé de la maison Cacao.', actif: true, created_at: '2026-10-01T10:00:00Z', date_casting: '2026-11-08', lieu: 'Studio MA2M', ordre_affichage: 0 },
        { id: 'cp-b', nom: 'SHOOTING LAGUNE', description: null, actif: false, created_at: '2026-09-01T10:00:00Z', date_casting: null, lieu: null, ordre_affichage: 1 }],
      recruiter_requests: [
        { id: 'r-1', contact_name: 'Koffi Marc', company: 'Maison Ivoire', email: 'marc@maison.ci', phone: '0505050505', whatsapp: '0505050505', city: 'Abidjan', project_type: 'Défilé', event_date: '2026-12-05', status: 'nouvelle', created_at: '2026-10-21T12:00:00Z', message: 'Trois mannequins pour un défilé.' }],
      recruiter_request_models: [
        { id: 'rm1', request_id: 'r-1', model_id: 'm0', model_name_snapshot: 'AYA KOUASSI', model_height_snapshot: 178 },
        { id: 'rm2', request_id: 'r-1', model_id: 'm1', model_name_snapshot: 'MARIAM TRAORÉ', model_height_snapshot: 175 }],
      convocation_participants: [
        { id: 'cp1', projet_id: 'p1', model_id: 'm0', nom: 'Mademoiselle AYA KOUASSI', parent: false, reponse: 'confirme' },
        { id: 'cp2', projet_id: 'p1', model_id: 'm1', nom: 'Mademoiselle MARIAM TRAORÉ', parent: false, reponse: 'confirme' },
        { id: 'cp3', projet_id: 'p1', model_id: 'm2', nom: 'Mademoiselle GRÂCE YAO', parent: false, reponse: null },
        { id: 'cp4', projet_id: 'p1', model_id: 'm3', nom: 'Mademoiselle FATIM DIALLO', parent: false, reponse: null }],
      convocation_envois: [],
      agence_mannequins: profils.slice(0, 6).map((p, i) => ({ id: 'r' + i, full_name: p.full_name, telephone: '07000000' + (10 + i), mensualite: 10000, statut: 'actif', user_id: i < 3 ? p.id : null, date_entree: '2026-09-01', suivi: true })),
      paiements_mannequins: [
        { id: 'pm1', mannequin_id: 'r1', objet: 'mensualite', mois: '2026-10-01', montant: 10000, mode: 'wave', statut: 'declare', declare_le: '2026-10-19T09:00:00Z', mannequin: { full_name: 'MARIAM TRAORÉ', telephone: '0700000011' } },
        { id: 'pm2', mannequin_id: 'r2', objet: 'mensualite', mois: '2026-10-01', montant: 10000, mode: 'wave', statut: 'declare', declare_le: '2026-10-20T09:00:00Z', mannequin: { full_name: 'GRÂCE YAO', telephone: '0700000012' } }],
      codes_espace: [], compta_reglages: [{ id: 1, mode_legal: false, nom_entite: 'Maître Akesse Model Management', commission_taux: 20 }], compta_comptes: [{ id: 'k1', nom: 'Caisse (espèces)', type: 'caisse', solde_initial: 0, date_initiale: '2026-10-01', actif: true }, { id: 'k2', nom: 'Wave Business', type: 'wave', solde_initial: 0, date_initiale: '2026-10-01', actif: true }],
      // payer les mannequins : un cachet déjà payé (historique), avec sa dépense dans la comptabilité
      cachets_mannequins: [{ id: 'cc0', beneficiaire: 'GRÂCE YAO', telephone: '2250700000012', montant: 15000, prestation: 'Shooting Lagune', motif: 'shooting', numero_recu: 'MA2M-CA-2026-0001', jeton: '11111111-2222-3333-4444-555555555555', statut: 'paye', mode: 'wave_manuel', reference_wave: 'T_AB12', compte_id: 'k2', ecriture_id: 'e3', paye_le: '2026-10-15T10:00:00Z', cree_le: '2026-10-14T10:00:00Z' }],
      // comptabilité d'octobre qui tombe juste : caisse 15 000 F, Wave 50 000 − 15 000 = 35 000 F (compta_soldes ci-dessous)
      compta_ecritures: [
        { id: 'e1', sens: 'recette', date_op: '2026-10-03', montant: 15000, compte_id: 'k1', categorie: 'inscription', libelle: 'Droit d’inscription d’un mannequin', source: 'espace2', annule: false },
        { id: 'e2', sens: 'recette', date_op: '2026-10-08', montant: 50000, compte_id: 'k2', categorie: 'casting', libelle: 'Casting Cacao', tiers: 'Maison Ivoire', source: 'manuel', annule: false },
        { id: 'e3', sens: 'depense', date_op: '2026-10-15', montant: 15000, compte_id: 'k2', categorie: 'cachets', libelle: 'Cachet : Shooting Lagune', tiers: 'GRÂCE YAO', source: 'manuel', annule: false }]
    },
    rpc: {
      portail_moi: { role, mfa: true, nom: 'Maître Akesse', actif: true, membre: true, espaces, contacts_prives: role !== 'site' && role !== 'compta', noms_payeurs: espaces.paiements },
      portail_enregistrer_appareil: { ok: true, nouveau: false },
      portail_code_appareil_etat: { defini: true, verrouille: false },
      code_validation_statut: [{ defini: true }],
      photos_couverture_mannequins: profils.map((p, i) => ({ model_id: p.id, url: photo(i) })),
      compta_soldes: [{ compte_id: 'k1', nom: 'Caisse (espèces)', type: 'caisse', solde: 15000 }, { compte_id: 'k2', nom: 'Wave Business', type: 'wave', solde: 35000 }],
      resume_candidatures_par_projet: [{ type_candidature: 'projet', projet_nom: 'CASTING CACAO', total: 7 }],
      convocation_contacts_mannequins: (x) => (x.p_ids || []).map((id) => { const i = Number(id.slice(1)); return { model_id: id, full_name: NOMS[i], category: 'femme', phone: '07000000' + (10 + i), contact_email: 'mannequin' + i + '@test.ci', date_naissance: '2000-01-01' }; })
    },
    // code d'inscription créé par la base pour une candidature retenue (rangé dans codes_inscription)
    preparer(d) {
      // une mannequin en sourdine, une fiche en attente de validation (mineure), une mannequin à la une
      d.tables.model_profiles.push({ id: 'm12', full_name: 'KORA BAMBA', published: false, desactive: true, city: 'Yopougon', category: 'femme', niveau_mannequin: 'New Face', created_at: '2026-09-01T10:00:00Z' },
        { id: 'v1', full_name: 'NOUVELLE FACE', published: false, desactive: false, en_attente_validation: true, city: 'Abobo', category: 'femme', created_at: '2026-10-21T10:00:00Z' });
      d.tables.model_profiles[2].featured = true;
      d.tables.model_photos = d.tables.model_profiles.filter((p) => /^m\d+$/.test(p.id)).map((p) => {
        const i = Number(p.id.slice(1));
        return { id: 'pp' + i, model_id: p.id, url: photo(i), url_miniature: photo(i), url_moyenne: photo(i), chemin: 'm' + i + '/o.jpg', chemin_miniature: 'm' + i + '/miniatures/n.jpg', chemin_moyenne: 'm' + i + '/moyennes/m.jpg',
          principale: true, compcard_ordre: i === 0 ? 1 : null, categorie: 'book', created_at: '2026-10-01T10:00:00Z' };
      }).concat([{ id: 'pp0b', model_id: 'm0', url: photo(1), url_miniature: photo(1), chemin: 'm0/b.jpg', principale: false, compcard_ordre: null, categorie: 'lifestyle', created_at: '2026-10-02T10:00:00Z' },
        { id: 'pv1', model_id: 'v1', url: photo(3), url_miniature: photo(3), principale: true, created_at: '2026-10-21T10:00:00Z' },
        { id: 'pv2', model_id: 'v1', url: photo(2), url_miniature: photo(2), principale: false, created_at: '2026-10-21T10:01:00Z' }]);
      d.tables.model_projects = [];
      // photo que l'ancienne IA avait mise de côté ; fiches événement et contacts pour le rapport
      d.tables.model_photos.push({ id: 'pt1', model_id: 'm3', url: photo(3), url_miniature: photo(3), url_moyenne: photo(3), chemin: 'm3/t.jpg', tri_statut: 'ecartee', created_at: '2026-10-03T10:00:00Z' });
      d.tables.fiche_evenement = [{ model_id: 'm0', mis_a_jour: '2026-10-10T10:00:00Z', regime_allergies: 'Aucune', tiktok: null, facebook: null, droit_image: true }];
      d.tables.contacts_parents = [];
      // pilotage : visites des fiches (7 jours), visites du site, messages de contact, inscriptions
      d.rpc.stats_classement_mannequins = d.tables.model_profiles.filter((p) => /^m\d+$/.test(p.id)).map((p, i) => ({ model_id: p.id, nb_visites: 140 - i * 11 }));
      d.rpc.stats_visites_reelles_site = (x) => (new Date(x.depuis) > new Date(Date.now() - 864e5) ? 37 : 412);
      d.tables.messages_contact = [
        { id: 'mc1', nom: 'Marie Bamba', type_contact: 'Devenir mannequin', telephone: '0707123456', created_at: new Date(Date.now() - 3600e3).toISOString() },
        { id: 'mc2', nom: 'Société Lagune', type_contact: 'Recruter des mannequins', telephone: null, created_at: '2026-09-02T10:00:00Z' }];
      // contenu du site : actualités et événements publiés (images servies localement)
      d.tables.actualites = [
        { id: 'a1', titre: 'Casting national 2026', categorie: 'Casting', commentaire: '<p>Le grand <b>casting</b> revient.</p>', video_url: '', image_url: photo(4), created_at: '2026-10-18T10:00:00Z' },
        { id: 'a2', titre: 'Conseils pour un premier shooting', categorie: 'Conseils', commentaire: 'Dormez bien la veille.', video_url: 'https://youtu.be/abcdefghijk', image_url: null, created_at: '2026-10-02T10:00:00Z' }];
      d.tables.actualite_photos = [{ id: 'ap1', actualite_id: 'a1', url: photo(4), chemin: 'site/actualites/a1/1.jpg' }, { id: 'ap2', actualite_id: 'a1', url: photo(5), chemin: 'site/actualites/a1/2.jpg' }];
      d.tables.evenements = [{ id: 'e1', titre: 'Abidjan Fashion Night', date_evenement: '2026-09-12', lieu: 'Sofitel Ivoire', description: '<p>Une soirée inoubliable.</p>', image_url: photo(6), created_at: '2026-09-13T10:00:00Z' }];
      d.tables.partenaires = [
        { id: 'pa1', nom: 'Maison Ivoire', structure: 'Maison Ivoire SARL', evenement: 'Abidjan Fashion Night', role: 'Promoteur', description: '<p>Fidèle partenaire.</p>', logo_url: photo(7), logo_chemin: 'site/partenaires/pa1/logo.jpg', created_at: '2026-10-01T10:00:00Z' },
        { id: 'pa2', nom: 'koffi studio', structure: null, evenement: null, role: 'DA', description: null, logo_url: null, logo_chemin: null, created_at: '2026-09-01T10:00:00Z' }];
      d.tables.mot_responsable = [{ id: 'principal', nom: 'Franck Akesse', titre: 'Fondateur', message: 'Bienvenue chez MA2M.', photo_url: photo(8) }];
      d.tables.instagram_config = [{ id: 'principal', access_token: 'jeton-secret-essai', ig_user_id: '1784', token_expire_le: new Date(Date.now() + 5 * 864e5).toISOString() }];
      d.tables.instagram_posts_cache = [{ id: 'principal', posts: [{ id: 'g1', image: photo(9), lien: 'https://www.instagram.com/p/abc/', legende: 'Défilé' }], updated_at: '2026-10-20T10:00:00Z' }];
      d.tables.reglages_site = [{ cle: 'video_accueil', valeur: { type: 'video', chemin: 'site/video-accueil/essai.mp4', largeur: 640, hauteur: 360, taille: 99797, maj: '2026-10-10T10:00:00Z' } }];
      d.tables.codes_inscription = [
        { code: 'MA2M-LIBRE1', utilise: false, created_at: '2026-10-20T10:00:00Z', candidature_id: 'c3', candidature: { full_name: 'YAO KOUASSI' } },
        { code: 'MA2M-VIEUX1', utilise: false, created_at: '2026-09-01T10:00:00Z', candidature: null },
        { code: 'MA2M-FAIT01', utilise: true, utilise_le: '2026-10-05T10:00:00Z', created_at: '2026-09-20T10:00:00Z', candidature_id: 'c1', candidature: { full_name: 'AWA KONÉ' } }];
      d.rpc.casting_direct_creer = () => ({ code: 'MA2M-DIRECT' });
      d.rpc.nettoyer_photos_traitees_anciennes = 3;
      d.rpc.cachet_payer = (x) => { const c = d.tables.cachets_mannequins.find((l) => l.id === x.p_id); if (c) Object.assign(c, { statut: 'paye', compte_id: x.p_compte, reference_wave: x.p_reference, paye_le: new Date().toISOString(), mode: 'wave_manuel' }); return 'e-1'; };
      d.rpc.cachet_annuler = (x) => { const c = d.tables.cachets_mannequins.find((l) => l.id === x.p_id); if (c) Object.assign(c, { statut: 'annule', motif_annulation: x.p_motif }); return null; };
      const ilYa = (h) => new Date(Date.now() - h * 3600e3).toISOString();
      d.tables.journal_erreurs = [
        { id: 'j1', message: '[Erreur JavaScript] x is not defined', page: '/mannequins', pile: 'at f (app.js:1:2)', user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', created_at: ilYa(2) },
        { id: 'j2', message: '[Clics répétés] bouton « Envoyer » touché 4 fois', page: '/contact', pile: '', user_agent: 'Mozilla/5.0 (Linux; Android 13)', created_at: ilYa(5) },
        { id: 'j3', message: '[Page très lente] 14 s', page: '/', pile: '', user_agent: 'Mozilla/5.0 (Linux; Android 12)', created_at: ilYa(9) }];
      d.tables.evenement_photos = [{ id: 'ep1', evenement_id: 'e1', url: photo(6), chemin: 'site/evenements/e1/1.jpg' }];
      d.tables.inscriptions_mannequins = [{ id: 'i1', full_name: 'KADI SORO', genre: 'femme', date_naissance: '2001-02-02', statut: 'payée' }, { id: 'i2', full_name: 'PETIT ZIE', genre: 'homme', date_naissance: '2015-02-02', statut: 'payée' }];
      d.rpc.contacts_mannequins_admin = d.tables.model_profiles.filter((p) => /^m\d+$/.test(p.id)).map((p) => ({ model_id: p.id, phone: '0700000099' }));
      d.rpc.profils_prives = (x) => (x.ids || []).map((id) => ({ id, date_naissance: id === 'v1' ? '2011-05-05' : '2000-01-01' }));
      d.rpc.definir_sourdine = (x) => { const m = d.tables.model_profiles.find((p) => p.id === x.p_model); if (m) { m.desactive = x.p_desactive; m.published = !x.p_desactive; } return null; };
      d.rpc.code_individuel_creer = (x) => { d.tables.codes_inscription.push({ code: 'MA2M-ESSAI1', utilise: false, candidature_id: x.p_candidature }); return { code: 'MA2M-ESSAI1' }; };
    },
    api: { '/api/portail': () => ({ ok: true }), '/api/r2-site-images': (c) => (c.action === 'lire' ? { chemin: 'prive/note-integration/abc.pdf', date: '2026-10-14T10:00:00Z' } : c.action ? { ok: true } : { uploadUrl: '/__stockage', publicUrl: 'https://photos.maitreakessemodelmanagement.com/' + c.chemin }), '/api/connexion-admin': (c) => (c && c.action ? { ok: true } : { ipBloquees: [{ ip: '102.67.1.9', espace: 'mannequin', bloque_jusqua: new Date(Date.now() + 3600e3).toISOString() }],
      comptesBloques: [{ identifiant: '0707070707', espace: 'inscription-code', bloque_jusqua: new Date(Date.now() + 1800e3).toISOString() }], listeBlanche: [{ ip: '41.66.2.3', note: 'Bureau', ajoute_le: '2026-10-01' }] }),
    '/api/r2-presigner': (c) => ({ uploadUrl: '/__stockage', publicUrl: 'https://photos.maitreakessemodelmanagement.com/' + c.chemin }) }
  };
  d.preparer(d); delete d.preparer;
  // « Ajouter une personne » (personne_ajouter, supabase-personnes.sql) : de l'agence → registre
  // ET carnet ; extérieure → carnet seulement (en mémoire : rien n'est écrit pour de vrai)
  d.rpc.personne_ajouter = d.rpc.personne_ajouter || ((x) => {
    const n = (d.compteurPersonnes = (d.compteurPersonnes || 0) + 1), reg = x.p_agence ? 'reg-ajout-' + n : null;
    if (reg) (d.tables.agence_mannequins = d.tables.agence_mannequins || []).push({ id: reg, full_name: x.p_nom, genre: x.p_civilite === 'Monsieur' ? 'homme' : 'femme', telephone: x.p_telephone, email: x.p_email, parent_nom: x.p_parent_nom, parent_telephone: x.p_parent_telephone, statut: 'actif', user_id: null });
    (d.tables.contacts_externes = d.tables.contacts_externes || []).push({ id: 'contact-ajout-' + n, civilite: x.p_civilite, nom: x.p_nom, telephone: x.p_telephone, email: x.p_email ? x.p_email.toLowerCase() : null, parent_nom: x.p_parent_nom, parent_telephone: x.p_parent_telephone, mannequin_id: reg });
    return { contact_id: 'contact-ajout-' + n, mannequin_id: reg };
  });
  return d;
}

// Photos du Book : servies par le serveur local (images d'essai), jamais par Cloudflare ni Vercel
async function photosLocales(page) {
  const fs = require('fs'), chemin = require('path');
  const images = ['photo0.jpg', 'photo1.jpg', 'photo2.jpg', 'photo3.jpg'].map((f) => fs.readFileSync(chemin.join(__dirname, 'medias', f)));
  await page.route(/__stockage/, (r) => r.fulfill({ status: 200, body: '' }));  // envoi d'une photo (R2 simulé)
  await page.route(/photos\.maitreakessemodelmanagement\.com|\/book-photos\/|drive\.google\.com\/uc|i\.ytimg\.com/, (r) => {
    const n = Number((/\/m(\d+)\//.exec(r.request().url()) || [0, 0])[1]);
    r.fulfill({ status: 200, contentType: 'image/jpeg', body: images[n % images.length] });
  });
}

// Connexion à la nouvelle Administration (mot de passe + code), comme une vraie personne
// Règle de sécurité stricte de l'Administration (vercel.json, 24/10/2026 : aucun programme écrit dans
// la page), posée par le serveur comme en ligne : tous les essais de l'Administration tournent avec
// elle ; un programme bloqué apparaît dans la console comme une erreur (« aucune erreur »).
const REGLE_ADMIN = require('../../vercel.json').headers.find((h) => h.source === '/admin/(.*)').headers.find((h) => h.key === 'Content-Security-Policy').value;
async function seConnecter(p, url) {
  await p.route(/127\.0\.0\.1:\d+\/admin\/$/, async (r) => { const rep = await r.fetch(); r.fulfill({ response: rep, headers: Object.assign({}, rep.headers(), { 'content-security-policy': REGLE_ADMIN }) }); });
  await p.goto(url); await p.waitForSelector('#cx-mail', { timeout: 8000 });
  await p.fill('#cx-mail', 'admin@test.ci'); await p.fill('#cx-mdp', 'motdepasse-tres-long');
  await p.click('form[data-form="connexion"] [type=submit]');
  await p.waitForSelector('#cx-code'); await p.fill('#cx-code', '123456'); await p.click('form[data-form="code"] [type=submit]');
}

module.exports = { donnees, photosLocales, seConnecter, NOMS };
