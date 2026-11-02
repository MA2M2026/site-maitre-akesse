# Passation — Phase 2 (état au 02/11/2026, fin de session)

À lire en premier par toute personne (agent ou développeur) qui reprend le site. Détails : `SUIVI-CHANTIERS.md`
(tableau W0–W10), `DECISIONS.md` (choix et raisons), `README-TECHNIQUE.md` (section « Phase 2 »), `docs/routes.md`.
Règles de travail : `CLAUDE.md` (tout en français avec la propriétaire, une chose à la fois, essais avant chaque mise
en ligne, une mise en ligne par jour si possible).

## En ligne (main dd63a51)
- **Site public 100 % écrit par le serveur** : `node scripts/verify-dynamic.mjs --url https://www.maitreakessemodelmanagement.com`
  → **180/180** (preuve : `evidence/` hors dépôt ; relancer pour la reproduire). Même page pour visiteurs et robots
  (Google, WhatsApp, Facebook), balises og:/JSON-LD par fiche, article, événement, partenaire.
- Dessins partagés serveur + page : `js/gabarit.js`, `js/partage.js`, `js/rendu-agenda.js`, `js/parcours.js`,
  `js/rendu-fiche.js`, `js/formulaire-candidature-champs.js`, `js/tailles.js`, `js/rendu-book.js`, `js/rendu-publications.js`.
  `js/partage.js` doit être chargé AVANT `js/app.js` partout (site, `/admin/`, `/app/`, copies hors ligne).
- Cache exact (`public, max-age=0, s-maxage=60, stale-while-revalidate=120` ; liens personnels `private, no-store`),
  en-têtes `x-ma2m-render: ssr` et `x-ma2m-build`.
- W4 : plus aucun code d'administration dans les pages publiques ; l'écriture (`js/publications-ecriture.js`,
  `js/partenaires-communs.js`, `js/images-site-ecriture.js`) n'est servie qu'à l'agence connectée (404 sinon).
- En-têtes de sécurité COOP/CORP ajoutés ; audit des secrets de tout l'historique : aucun secret (clé anon seulement).
- Jauge « Envoi de la photo… » de l'Administration cachée pendant le travail automatique.
- Accueil : premier visiteur après une mise en ligne servi complet (attente de la base jusqu'à 3 s).

## Pas fait / à faire (par ordre de priorité)
1. **Vitesse (W7)** : grande image en 3,3 s (accueil), 4,0 s (Book), 3,6 s (fiche) sur téléphone 4G lente simulé ;
   objectif 2,5 s. Reste : feuilles de style bloquantes (8 fichiers), scripts synchrones en tête de page.
   Mesure : Lighthouse mobile, 5 essais, médiane.
2. **Base de données (W6f)** : Extension 153 (`supabase-extension.sql`, fin du fichier) prête et essayée sur la base
   locale — À COLLER par la propriétaire, avec son accord. Revoir les 84/149 fonctions SECURITY DEFINER appelables
   (contrôle de sécurité Supabase), écrire `docs/rls-matrix.md`.
3. **Actions de la propriétaire (W6l)** : protection « mots de passe volés » dans Supabase Auth, double authentification
   GitHub/Vercel/Supabase/Cloudflare, protection de la branche `main`, secret scanning GitHub.
4. **W6 restants** : effacer les données cachées des photos (EXIF/GPS) à l'envoi ; limites de débit sur tous les
   `api/*` ; validation stricte des entrées des `api/*`.
5. **W5 Appareil de confiance** : la propriétaire juge le parcours actuel correct (compte, 2FA, code à 4 chiffres,
   2FA après 30 jours, validation des nouveaux comptes) — à vérifier seulement, pas à refaire.
6. **W8–W10** : essais de l'Administration pour chaque envoi de photos ; essais lancés automatiquement sur GitHub à
   chaque demande de fusion ; plan du site (`sitemap.xml`) généré depuis la base ; `docs/runbook-rollback.md`,
   `docs/falsification.md`.

## Avant toute mise en ligne
`bash scripts/tests-visiteur/lancer.sh` (batterie complète, ~1 h 30) ; `python3 scripts/versionner.py` ;
`python3 scripts/verifier-csp.py` ; relecture du code ; mesure locale :
`NODE_USE_ENV_PROXY=1 node scripts/serveur-local.mjs 8787` puis `node scripts/verify-dynamic.mjs --url http://127.0.0.1:8787`.
Mise en ligne : demande de fusion vers `main` (vérification GitHub verte), puis contrôle du vrai site (en-tête
`x-ma2m-build` = la nouvelle version, puis `verify-dynamic.mjs`). Retour en arrière : redéployer la version
précédente dans Vercel.

## Tâches programmées
« 1 h » et « 3 h » (grand test automatique avec mise en ligne) : DÉSACTIVÉES volontairement le 01/11/2026 — ne pas
les réactiver sans l'accord de la propriétaire.
