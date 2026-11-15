# Rapport d'audit — Agent B (15/11/2026)

Branche : `audit/agent-b` (partie de `main` au commit 3da01399). Aucune modification du site ni des données
pendant l'audit : visites, lectures et mesures seulement.

## Résumé

Le site public est **solide** : les 116 adresses du plan du site répondent sur téléphone et ordinateur, sans image
cassée ni page qui déborde ; accessibilité et référencement à 100/100 (Lighthouse) ; les données privées ne sont
pas lisibles sans connexion. Les points à travailler sont surtout **le confort visuel au chargement** (la mise en
page qui « saute » sur beaucoup de pages, la grande photo d'accueil qui arrive tard, des photos d'articles trop
lourdes) et **quelques protections à resserrer** (scripts en ligne autorisés sur le site public, anti-robots en
mode souple, clé publique du programme Google).

## Méthode et limites

- **Visite du site en ligne** (`www.maitreakessemodelmanagement.com`) : les 116 adresses du plan du site
  (`sitemap.xml`), d'abord sur téléphone (390 px, 4G lente simulée : 1,6 Mbit/s, 150 ms), puis sur ordinateur
  (1366 px). Pour chaque page : code de réponse, erreurs, images cassées, débordement horizontal, titres H1,
  textes alternatifs, LCP (affichage du plus grand élément) et CLS (décalages de mise en page), page parcourue
  jusqu'en bas pour charger les images différées.
- **Lighthouse** (téléphone) : accueil, Mannequins, Intégrer l'agence, un Book.
- **Sécurité** : en-têtes HTTPS du site, de l'Administration et de l'application ; essais de **lecture** sans
  connexion (clé publique) sur 17 tables ; relecture des fonctions de la base exécutables sans connexion ;
  avertissements de sécurité Supabase ; `npm audit`.
- **Code** : taille et organisation, fonctions inutilisées, relecture des fonctions serveur (`api/`).
- **Parcours candidate** : essayé avec les 130 essais « comme une visiteuse » du dépôt
  (`scripts/tests-visiteur/lancer.sh`, base simulée), tous passés le 15/11. **Pas d'envoi réel** sur le site en
  ligne (il créerait une vraie candidature).
- **Limites** : je n'ai **pas** d'accès humain à l'Administration ni à l'espace mannequin (pas de mot de passe) ;
  lecture directe de la base seulement. Mon environnement bloque Google Analytics, Sentry et YouTube : les
  erreurs de chargement de ces trois services sont de mon côté, pas du site, et ont été écartées.

## Points forts (proposés)

| ID | Constat | Preuve |
|----|---------|--------|
| F-B01 | Les 116 adresses du plan du site répondent (200) sur téléphone et ordinateur ; aucune image cassée ; aucun débordement horizontal à 390 px | visite automatique, 232 visites |
| F-B02 | Accessibilité 100/100 et référencement 100/100 | Lighthouse : accueil, /mannequins, /integrer-agence, /book/… |
| F-B03 | Chargement rapide en général : LCP médiane 1,8 s sur téléphone en 4G lente, 0,9 s sur ordinateur | visite automatique |
| F-B04 | En-têtes de sécurité complets : HSTS (2 ans, preload), X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP/CORP ; CSP **stricte** sur l'Administration (`script-src 'self'`) | `curl -I` ; `vercel.json` |
| F-B05 | Données privées illisibles sans connexion : candidatures, photos de candidature, cours de talons, registre, comptabilité, téléphones et dates de naissance des mannequins, codes, journaux, abonnements ; profils et photos **non publiés** invisibles | lectures avec la clé publique |
| F-B06 | Les fonctions sensibles de la base vérifient l'administratrice ET son appareil (`portail_admin_ok`) : `contacts_mannequins_admin`, `profils_prives`, `fiche_evenement_admin` ; sauvegarde des photos protégée par clé hachée (`photos_a_sauvegarder`) | `pg_get_functiondef` |
| F-B07 | Envoi des photos du Book (Cloudflare R2) signé par le serveur, taille inscrite dans la signature, chemin limité au dossier de la mannequin | `api/r2-presigner.js:20-60` |
| F-B08 | Aucune dépendance vulnérable | `npm audit --omit=dev` : 0 |
| F-B09 | 130 essais automatiques « comme une visiteuse » (téléphone/ordinateur, FR/EN) et contrôle des empreintes CSP avant chaque mise en ligne | `scripts/tests-visiteur/lancer.sh`, `scripts/verifier-csp.py` |
| F-B10 | Photos des candidatures vers Drive : enregistrement par le serveur, surveillance toutes les 15 min, contrôle du circuit chaque matin, alertes (mis en place le 15/11) | `supabase-medias-drive*.sql`, `scripts/apps-script-photos-drive.gs` |

## Problèmes (proposés)

| ID | Gravité | Lieu | Cause | Conséquence | Solution proposée | Risque de régression | Vérification |
|----|---------|------|-------|-------------|-------------------|----------------------|--------------|
| P-B01 | Moyenne | 34 pages sur téléphone (ex. `/cours-talons` CLS 0,37, `/en/candidature` 0,31, `/candidature` 0,19), 13 sur ordinateur (ex. `/parcours` 0,33, `/en/actualites` 0,26) | Contenus ajoutés après l'affichage (textes et listes lus dans la base, polices) sans place réservée | La page « saute » pendant le chargement : la visiteuse peut toucher le mauvais bouton | Réserver la hauteur des blocs remplis plus tard (`min-height`, gabarits vides), `font-display` adapté | Faible (CSS) | CLS < 0,1 à la visite automatique |
| P-B02 | Moyenne | Accueil, photo de couverture (`#couv-img`) | L'adresse de la photo n'est connue qu'après une lecture de la base par le script : 2,3 s d'attente avant même de la télécharger | Grande photo d'accueil à 3,4 s sur téléphone (cible : moins de 2,5 s) | Écrire l'adresse de la couverture dans la page (ou `preload`) au moment de la publication | Faible | Lighthouse : délai de chargement de la ressource LCP < 500 ms |
| P-B03 | Moyenne | Articles (`/actualites?actu=…`), Book (`/book/…`) | Photos d'articles servies trop lourdes ; Book : 548 Ko d'économies possibles (Lighthouse) | Affichage du plus grand élément à 8–9 s sur téléphone en 4G lente pour certains articles | Servir les photos d'articles redimensionnées (même chaîne que les photos de mannequins : WebP, tailles) | Faible | LCP < 4 s sur ces pages |
| P-B04 | Moyenne (sécurité) | `vercel.json:68`, CSP du site public | `script-src 'unsafe-inline'` alors qu'une seule page a un script en ligne (`reinitialiser-mot-de-passe.html:33,84`) | Une éventuelle faille d'injection (XSS) aurait plus d'effet | Sortir ce script dans un fichier, puis retirer `'unsafe-inline'` (comme l'Administration) | Moyen : toutes les pages publiques ; les 130 essais + `verifier-csp.py` le contrôlent | En-tête CSP sans `unsafe-inline`, aucune erreur CSP en visite |
| P-B05 | Moyenne (sécurité) | `api/portail.js:294` | `ANTI_ROBOTS_STRICT = false` (mis le 01/11 pendant une panne de Cloudflare Turnstile) | Un robot sans jeton valide passe ; seules les limites par minute et par adresse protègent | Lire le journal « [Anti-robots] » : si les vrais visiteurs passent, repasser à `true` | Moyen (vrais visiteurs refusés si Turnstile casse) | Journal des erreurs, essais anti-robots |
| P-B06 | Moyenne (sécurité) | `js/app.js:2768` + `scripts/apps-script-photos-drive.gs` | La clé du programme Google est publique (dans la page) : n'importe qui peut envoyer jusqu'à 20 photos de 15 Mo par appel dans le Drive de l'agence | Remplissage du Drive, dossiers indésirables | Faire vérifier au programme Google qu'une candidature ou inscription récente existe pour ce numéro (`media_drive_infos`) avant de ranger les fichiers ; ou passer par une fonction `api/` avec anti-robots | Moyen (l'inscription au cours de talons est enregistrée APRÈS ses photos) | Envoi sans numéro valide refusé |
| P-B07 | Basse (sécurité) | Supabase Auth | Protection contre les mots de passe déjà piratés (HaveIBeenPwned) désactivée | Mots de passe faibles connus acceptés | L'activer dans Supabase (Authentication → Policies) | Très faible | Avertissement Supabase disparu |
| P-B08 | Basse (sécurité) | Base : `compta_type_du_mode`, `cours_talons_prix_mois`, `cours_talons_module` | `search_path` non fixé | Bonne pratique non respectée (risque théorique) | `set search_path = public` sur ces 3 fonctions | Très faible | Avertissement Supabase disparu |
| P-B09 | Basse (sécurité) | Base : 93 fonctions `security definer` exécutables sans connexion | Droit d'exécution par défaut laissé à `anon`, y compris des fonctions de déclencheur (`notifier_push_notification`, `*_garde_fous`, `cours_talons_z_medias_drive`) | Surface inutile (les fonctions de déclencheur ne s'appellent pas directement ; les sensibles relues sont protégées) | `revoke execute … from anon` sur celles qui ne servent pas aux pages publiques | Moyen (une page publique qui en a besoin casserait) : liste à établir avec les essais | Avertissements Supabase réduits, essais visiteur verts |
| P-B10 | Basse | Photos des candidates sur Drive (dont mineures) | Partagées « toute personne ayant le lien » pour s'afficher dans l'Administration | Un lien transmis par erreur rend la photo visible | Servir ces photos à travers une fonction `api/` réservée à l'agence | Moyen | Lien Drive direct refusé hors connexion |
| P-B11 | Basse | `js/photos.js:150` | Sonde « sonde-connexion » volontairement vers une adresse inexistante quand les photos sont lentes | Erreurs 404 dans la console et les journaux (bruit) sur 15 pages en 4G lente | Sonder une petite adresse qui existe (réponse 204) | Faible | Plus de 404 en visite lente |
| P-B12 | Basse | Article `actu=f0f360c3…` | Deux titres H1 (un dans le contenu de l'éditeur) | Référencement et lecteurs d'écran moins clairs | Transformer le H1 du contenu en H2 à l'enregistrement d'un article | Faible | Un seul H1 par page |
| P-B13 | Basse (code) | `js/app.js:2448`, `:2463`, `:3709` | `editeurRicheDiffere`, `preparerEditeursDifferes`, `definirVilleAvecCommune` ne sont plus appelées | Code mort | Les retirer (et la mention du README) | Très faible | Recherche dans le dépôt, essais |
| P-B14 | Basse (performance) | `js/app.js` (3 821 lignes, 230 Ko) chargé par toutes les pages | Un seul gros fichier commun | ~91 Ko de JavaScript inutilisé par page (Lighthouse) | Découper par usage (formulaires, photos, administration) | Moyen | Lighthouse « unused JavaScript » |
| P-B15 | Info | `maquettes/essai-medias-drive.sql:283` | Mise à jour sans `where` dans le fichier d'essai (créé le 15/11) | Note de fiabilité SonarQube passée de C à E | Corrigé (`where id = 1`) sur `claude/photos-videos-drive-64xwv9`, à mettre en ligne | Nul | Nouvelle analyse SonarQube |

## À vérifier par les autres agents

- **Book des mannequins (R2)** : la photo part vers Cloudflare puis la ligne est écrite par le téléphone
  (`js/espace-mannequin.js`, `js/photos.js`) : même fragilité que les photos Drive avant le 15/11 si la connexion
  coupe entre les deux ? (la mannequin voit le résultat, le risque est plus faible).
- **Administration et espace mannequin** : non visités par moi (pas d'accès humain) ; en-têtes vérifiés seulement
  (CSP stricte, HSTS).

## Priorités proposées

1. P-B04 et P-B05 (protections), puis P-B06.
2. P-B01, P-B02, P-B03 (confort et vitesse sur téléphone).
3. Le reste en nettoyage.
