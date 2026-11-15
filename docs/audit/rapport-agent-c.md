# Rapport d'audit — Agent C (16/11/2026)

Branche : `audit/agent-c` · version auditée : `main` = `3da01399` (site en ligne).
Méthode : **aucune écriture réelle**. Site en ligne visité par un navigateur piloté (les visites de robots ne
sont pas comptées dans les statistiques du site, `js/surveillance.js:92`), base de données **en lecture seule**
(connecteur Supabase), lecture du code. Pas d'accès humain à l'Administration ni à l'espace mannequin
(voir COORDINATION.md, section 1) : ces deux parties sont auditées par le code et par les règles de la base.

## Résumé exécutif

Le site est **solide** : 116 pages du plan du site visitées sur téléphone et ordinateur (232 visites), toutes
répondent 200, aucune erreur JavaScript, aucun débordement horizontal, aucune image sans texte alternatif,
209 liens internes tous valides. La sécurité est sérieuse (règles de la base sur toutes les tables, données
privées fermées colonne par colonne, formulaires publics passés par le serveur avec anti-robots, aucun secret
dans le dépôt, aucune faille connue dans les bibliothèques). Les problèmes trouvés sont **moyens ou bas** :
aucun critique, aucun haut.

## Points forts (avec preuves)

| ID | Constat | Preuve |
|----|---------|--------|
| C-F1 | Toutes les tables de la base ont leurs règles de sécurité (RLS) activées | lecture de `pg_class` : 0 table sans RLS |
| C-F2 | Les visiteurs ne lisent que des colonnes publiques des profils (ni téléphone, ni e-mail, ni date de naissance) | `information_schema.column_privileges` (anon, `model_profiles`) |
| C-F3 | Fonctions sensibles fermées aux visiteurs dans la vraie base (âges, codes d'invitation) | appel public refusé (401, « permission denied ») pour `ages_mannequins` et `check_invite_code` |
| C-F4 | Formulaires publics (candidature, contact, recruteur, cours de talons) envoyés par le serveur avec jeton anti-robots, pas directement dans la base | `js/app.js:2796` (`TABLES_ANTI_ROBOTS`), `api/portail.js:295` |
| C-F5 | Envois de photos : contrôle du propriétaire ou de l'admin, dossier imposé, type et taille signés | `api/r2-presigner.js:20-60` |
| C-F6 | En-têtes de sécurité complets (HSTS préchargé, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP/CORP) | `curl -I` sur `/`, `/book/…` |
| C-F7 | 35 pages sur 42 ont une politique de sécurité stricte par empreintes (pas de script en ligne permis) | balise `Content-Security-Policy` dans les pages ; `scripts/verifier-csp.py` |
| C-F8 | Aucun secret dans le dépôt (seule la clé publique « anon ») ; `npm audit` : 0 faille | recherche dans `git ls-files` ; `npm audit --omit=dev` |
| C-F9 | Données insérées dans les pages systématiquement échappées (risque XSS faible) | 6 insertions `innerHTML` avec variables, toutes protégées ou numériques |
| C-F10 | Très peu de code recopié entre fichiers | détecteur de blocs identiques (4 lignes) : 0 doublon entre fichiers |
| C-F11 | Aucun fichier JS/CSS orphelin | chaque fichier de `js/` et `css/` est référencé |
| C-F12 | Connexion lente (1,6 Mb/s, processeur ×4) : premier affichage 0,9 à 2,3 s, grande image 1,2 à 2,6 s | mesures sur `/`, `/mannequins`, `/book/kouadio-alicia`, `/candidature`, `/agenda` |
| C-F13 | Photos en WebP légères (11 à 40 Ko), servies par Cloudflare (HIT) ; scripts versionnés en cache 1 an | `curl` des photos et de `js/app.js?v=` |
| C-F14 | Référencement soigné : canonical, hreflang FR/EN, og:image, titres propres par fiche, actualité et événement | pages servies par le serveur (`middleware.js`) |
| C-F15 | Pièces de l'Administration « site » cachées aux visiteurs (404 sans la clé posée après double authentification) | `/js/admin/site-mannequins.js` → 404 |
| C-F16 | 128 tests « comme un visiteur » + base d'essai locale avec essais de droits | `scripts/tests-visiteur/`, `scripts/base-essai/` |

## Problèmes

Format : ID · gravité · lieu · cause · conséquence · solution · risque de régression · vérification.

**C-P1 · moyenne · pages à lien personnel** (`accord-parent.html`, `confirmer.html`, `places.html`,
`programme-talons.html`, `recu.html`)
- Cause : ces 5 pages n'ont pas la politique stricte par empreintes ; seule celle du serveur s'applique, qui
  permet `'unsafe-inline'` pour les scripts.
- Conséquence : ce sont justement les pages ouvertes avec un jeton personnel (parent, élève, reçu) ; une
  injection y serait moins bien bloquée qu'ailleurs.
- Solution : ajouter la même balise stricte qu'aux 35 autres pages (aucune n'a de script en ligne ni
  d'attribut `on…=`, vérifié) et les inclure dans `scripts/verifier-csp.py`.
- Risque : faible (pas de script en ligne à autoriser). Vérification : `verifier-csp.py`, tests
  `test-accord-parent.js`, `test-programme-talons.js`, `test-places.js`.

**C-P2 · moyenne · page `/parcours` (ordinateur), fiches d'événement (téléphone)**
- Cause : contenu qui se décale pendant le chargement (CLS). `/parcours` : 0,25 à 0,8 s
  (`SECTION.parcours-section`, `NAV.parcours-mois`, visages) ; événements : jusqu'à 0,47 (`DIV.news-modal-corps`).
- Conséquence : la page « saute » sous le doigt ; note Google Core Web Vitals dégradée (seuil 0,1).
- Solution : réserver la hauteur de la barre des mois et des visages avant leur arrivée ; dans la fenêtre
  d'un événement, réserver la place de la photo (`aspect-ratio`).
- **À confirmer** pour les événements : mon navigateur ne joignait pas `photos.maitreakessemodelmanagement.com`
  (limite de mon environnement), le décalage peut venir de la photo manquante. `/parcours` est confirmé.
- Vérification : mesure CLS (`PerformanceObserver` « layout-shift ») avant et après.

**C-P3 · moyenne · base de données : fichiers SQL**
- Cause : 57 fichiers `supabase-*.sql` (16 000 lignes) collés à la main, sans suivi de version ; des
  autorisations anciennes restent écrites dans les fichiers alors que la vraie base les a retirées depuis
  (ex. `check_invite_code` ouvert aux visiteurs dans `supabase-extension.sql:1847`, fermé en ligne).
- Conséquence : impossible de savoir, depuis le code seul, l'état réel de la base ; reconstruire la base à
  partir des fichiers pourrait rouvrir des accès.
- Solution : un instantané du schéma réel (`pg_dump --schema-only`, sans données) versionné après chaque
  changement, et une liste ordonnée des fichiers (celle de `scripts/base-essai/lancer.sh` peut servir).
- Risque : nul (documentation). Vérification : comparer l'instantané avec la base d'essai.

**C-P4 · basse · pièces de l'Administration Paiements et Comptabilité téléchargeables par tous**
- Cause : `middleware.js:81` (`SCRIPTS_ADMIN`) protège `js/admin/site-*.js` mais pas `js/portail/*.js` ni
  `js/admin/carte-encart.js` (200 sans clé).
- Conséquence : la logique interne est lisible ; **les données restent protégées par la base**.
- Solution : soit les protéger comme les pièces du site (chargement après connexion), soit noter la décision.
- Risque : moyen (ordre de chargement de l'Administration). Vérification : `test-tableau-protege.js`.

**C-P5 · basse · `package.json`** : la bibliothèque `@anthropic-ai/sdk` est installée pour les fonctions
serveur mais n'est utilisée nulle part. Solution : la retirer (plus léger, moins de surface). Risque : nul.
Vérification : `git grep "@anthropic-ai"` vide, mise en ligne d'essai Vercel.

**C-P6 · basse · photos : cache de 4 h seulement** (`cache-control: max-age=14400` sur
`photos.maitreakessemodelmanagement.com`) alors que les noms de fichiers changent à chaque nouvelle photo.
Solution : cache d'un an (`immutable`) dans la règle Cloudflare / R2. Gain : revisites plus rapides, moins
de trafic. Risque : faible si les noms restent uniques. Vérification : `curl -I` d'une photo.

**C-P7 · basse · erreurs avalées sans trace** : 57 `catch {}` vides, 29 `.catch(() => {})`, 63
`.catch(() => null)` (dont 14 dans `js/app.js`). Beaucoup sont voulus (stockage local, vibration), mais
certains masquent de vraies pannes. Solution : passer en revue ceux des parcours d'envoi (photos, paiements)
et noter dans `journal_erreurs`. Risque : faible.

**C-P8 · basse · deux titres principaux** (`h1`) sur une actualité ouverte (`/actualites?actu=…` : le titre de
la page et celui de l'article). Solution : l'article en `h2` quand il est ouvert en fenêtre. Risque : nul.

**C-P9 · basse · 650 Ko de JavaScript (non compressé) par page**, dont `js/app.js` (221 Ko) et la bibliothèque
Supabase (202 Ko) partout, même là où elles servent peu. Compressé : environ 80 Ko pour `app.js`, et les
mesures en connexion lente restent bonnes (C-F12). Solution à long terme : découper `app.js` par page.
Risque : élevé (fichier partagé par tout le site) : à ne faire qu'avec les tests complets.

**C-P10 · basse · `access-control-allow-origin: *`** sur les pages HTML (réglage par défaut de Vercel).
Sans cookie, sans danger réel ; à restreindre seulement si un jour une page renvoie des données privées.

## Limites de cet audit

- Pas de connexion humaine à l'Administration ni à l'espace mannequin (pas de compte) : à faire par l'agent
  testeur humain.
- Mon navigateur ne joignait pas le serveur de photos ni Sentry / Google Analytics (réseau de mon
  environnement) : les photos ont été vérifiées directement par `curl` (toutes en 200).
- Aucun formulaire envoyé pour de vrai (règle de non-écriture) : les parcours d'envoi sont couverts par les
  tests du dépôt sur base simulée.
- Une lecture de la base (liste des fonctions ouvertes aux visiteurs) a été refusée par la propriétaire : je
  l'ai remplacée par la lecture des fichiers SQL et deux appels publics en lecture seule.

## Priorités proposées

1. C-P1 (pages à lien personnel) — simple, gain de sécurité réel.
2. C-P2 (`/parcours`, puis événements après confirmation).
3. C-P3 (instantané du schéma réel).
4. C-P5, C-P6, C-P8 (rapides).
5. C-P4, C-P7, C-P9, C-P10 (à décider ensemble).
