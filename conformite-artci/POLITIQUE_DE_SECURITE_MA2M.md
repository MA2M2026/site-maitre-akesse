# Politique de sécurité — MA2M

Seules les mesures **constatées** sont marquées [VÉRIFIÉ].

| Mesure | État |
|---|---|
| Règles d'accès (RLS) sur toutes les tables de la base | [VÉRIFIÉ] aucune table publique sans RLS |
| Contrôles côté serveur (pas seulement à l'écran) | [VÉRIFIÉ] fonctions serveur (`api/`), droits de la base (ex. seuls l'administrateur principal et les encaissements valident un paiement) |
| Colonnes privées fermées aux visiteurs (téléphone, e-mail, date de naissance…) | [VÉRIFIÉ] ; poids : **fermé aux visiteurs** depuis le 22/11/2026 [VÉRIFIÉ] (limite : un compte mannequin connecté peut encore le lire sur les fiches publiées) |
| Photos privées | [VÉRIFIÉ] photos de candidatures et de cours de talons : adresses signées d'1 heure, règle Cloudflare « Photos privées des candidatures » |
| Suppression par l'agence | [VÉRIFIÉ] bouton « Supprimer » réservé à l'administrateur principal (candidatures, cours de talons, mannequins), avec confirmation ; dossiers Google Drive mis à la corbeille (jamais d'effacement définitif sans le clic de l'agence) |
| Séparation public / privé | [VÉRIFIÉ] The Book public ; candidatures, inscriptions, cours de talons privés |
| Rôles et privilèges | [VÉRIFIÉ] administrateur principal, site, paiements, comptabilité ; création de compte avec confirmation de l'e-mail et validation par le principal |
| Double authentification | [VÉRIFIÉ] obligatoire pour l'équipe ; appareils de confiance ; codes de secours |
| Limitation des essais | [VÉRIFIÉ] blocage par compte et par adresse IP ; limite par IP sur les formulaires publics ; anti-robots Turnstile |
| Secrets | [VÉRIFIÉ] variables d'environnement Vercel, jamais dans le code public |
| Journal des actions de l'équipe | [VÉRIFIÉ] `audit_log` (acteur, action, avant/après, IP) |
| Surveillance des pannes | [VÉRIFIÉ] journal des erreurs + e-mail quotidien de surveillance + Sentry |
| Contrôle qualité externe | [VÉRIFIÉ] SonarQube Cloud (notes A) |
| Sauvegardes et restauration | [À COMPLÉTER] selon l'offre Supabase ; procédure de restauration à écrire |
| Prévention de l'énumération des comptes | [À VÉRIFIER] messages de connexion identiques que le compte existe ou non |
| Procédure en cas d'incident | **à écrire** : constater, limiter, corriger, informer la propriétaire, évaluer l'information des personnes et de l'ARTCI [JURISTE] |
