# Brief de passation (corrigé le 31/10/2026) : site Maître Akesse Model Management

Tu reprends un chantier commencé par d'autres conversations de Claude Code. Lis tout ce brief avant d'agir.
Ce fichier remplace le brief non corrigé (qui contenait des noms de fichiers dépassés et des couleurs
contraires aux décisions de la propriétaire). Il n'est jamais publié sur le site (`.vercelignore` : `PASSATION-*.md`).

## 1. Comment travailler avec moi (la propriétaire)

- Lis d'abord `CLAUDE.md` : ce sont mes règles, elles passent avant tout.
- Je ne suis pas développeur : réponds-moi **toujours en français**, simplement, sans jargon.
- Je dicte souvent à la voix : interprète avec bon sens et **pose une question si c'est ambigu**.
- **Une seule chose à la fois.** Propose, attends mon accord, puis passe à la suite.
- **Jamais de mise en ligne sans mon accord.** C'est l'envoi sur `main` qui met le site en ligne (Vercel).
- Quand tu mets en ligne, préviens-moi avec un résumé court, et dis combien de fichiers ont changé.

## 2. RÈGLE ABSOLUE : le mot « terminé »

- Tu n'écris « terminé » pour un chantier que s'il est fait **en entier** : tous ses points, essayé et vu
  fonctionner. Sinon : « en cours », et tu dis précisément ce qui reste.
- À chaque point d'étape, montre la liste complète des chantiers avec l'état de chacun
  (terminé / en cours, il reste… / pas commencé).
- « Étape faite » pour une étape, jamais « terminé ».
- Tiens à jour `SUIVI-CHANTIERS.md` dans le dépôt (sans aucun secret : **le dépôt est public**) et envoie-le
  sur GitHub avec ton travail, pour qu'une autre conversation puisse reprendre exactement où tu en es.

## 3. Le projet tel qu'il est VRAIMENT (vérifié le 31/10/2026)

- Dépôt public : https://github.com/MA2M2026/site-maitre-akesse — branche en ligne : `main`.
- Hébergement Vercel (offre gratuite : **peu de mises en ligne par jour**, une branche envoyée crée aussi
  une adresse d'essai qui compte). Base, comptes et stockage : Supabase. Photos : Cloudflare R2 (`photos.`).
- **Trois adresses** :
  - site public : https://www.maitreakessemodelmanagement.com (pages `*.html` à la racine et `en/` en anglais) ;
  - **Administration** : https://admin.maitreakessemodelmanagement.com/admin/ → dossier `admin/`,
    code dans `js/admin/*.js` (site) et `js/portail/*.js` (paiements, comptabilité, sécurité, connexion) ;
  - **application des mannequins** : https://mannequin.maitreakessemodelmanagement.com/app/ → dossier `app/`,
    code `js/mannequin-app.js`, `js/app-coque.js`, styles `css/mannequin-app.css`.
- **Il y a déjà une partie serveur** : fonctions Vercel dans `api/` (connexion protégée de l'Administration,
  accès au tableau, codes, envoi des photos vers R2, notifications, suppression d'un mannequin…) et
  `middleware.js` (accueil préparé par le serveur, protections). Le site n'est donc pas « purement statique ».
- **N'existent plus / ne servent plus** : `tableau-de-bord.html`, `espace-mannequin.html` à la racine
  (démolis le 26/10, l'application `app/` les remplace). Ne pas les recréer.
- Code partagé : `js/app.js` (dont la bande « Télécharger l'application », `bandeInstallation`).
- Documentation : `README-TECHNIQUE.md` (à jour, contient la double authentification TOTP, le code à
  4 chiffres par appareil, les codes de secours), `SECURITY.md`, `CONVENTIONS.md`, `GUIDE-DE-SECOURS.md`.
- **Base de données** : suivre la convention écrite dans `README-TECHNIQUE.md` (fichiers
  `supabase-<sujet>.sql` rejouables avec leur numéro d'Extension, source SQL toujours dans le dépôt).
  Ne jamais modifier `supabase-setup.sql`. Le SQL se colle dans Supabase → SQL Editor : je n'ai qu'un
  téléphone, donne-moi le SQL **en premier**, puis tu continues. Droits par règles RLS, jamais par
  JavaScript seul ; jamais la clé `service_role` dans le code.

### Couleurs : décision ferme de la propriétaire

**Uniquement rouge très mat `#7C2128` et blanc.** Rouge profond `#5A141B` autorisé pour ce qui doit
ressortir. **Plus de noir, plus de beige, plus d'ivoire ni de doré.** Écriture foncée dans les blocs blancs,
blanche sur le rouge. Ne jamais réintroduire l'ancienne palette (noir, bordeaux, ivoire, doré).

### Essais (obligatoires avant toute mise en ligne)

- `node --check` des fichiers JS touchés, `python3 scripts/versionner.py`, `python3 scripts/verifier-csp.py`,
  `bash scripts/base-essai/lancer.sh` (base d'essai locale), puis la batterie visiteur
  `bash scripts/tests-visiteur/lancer.sh` (≈ 70-74 parcours, ≈ 1 h, **doit finir à 0 échec**).
- Les essais doivent être **patients** (machine d'essai lente : attendre la fin des animations).
- L'espace de travail peut redémarrer et tout effacer : **envoie ton travail souvent** sur ta branche.
- Si le site en ligne est bloqué depuis l'espace de travail : réglages de l'environnement → « Network
  access » → « Allowed domains ».
- **Les robots ne remplacent pas un vrai téléphone** (ils ne voient ni le vrai Safari d'iPhone, ni Samsung
  Internet, ni Google Play Protect). Pour l'installation de l'application, fais essayer par de vraies
  personnes sur de vrais téléphones avec une liste de cases à cocher.
- Toute modification de la connexion ou des droits de la base : essai **pour de vrai** avec un compte de
  test, avec mon accord (`CLAUDE.md`).
- Après chaque mise en ligne : vérifier le site en ligne, puis SonarCloud (projet
  `MA2M2026_site-maitre-akesse`, notes au maximum, 0 bug, 0 faille).

## 4. État réel au 31/10/2026

- **En ligne** (`main`, 28/10 vers 13 h) : rouge mat et blanc sur le site, l'Administration et l'application ;
  corrections de l'installation (nouveau Safari, Samsung Internet, connexion lente) ; mur de photos derrière
  les titres ; édito de l'accueil affiché normalement.
- **Fait mais PAS en ligne** : branche **`chantier-couleurs-site`** (8 envois en plus de `main`) :
  - Book en planche contact : 3 photos par ligne sur téléphone, 4 sur tablette, 5 sur ordinateur ;
  - fiche mannequin plus rapide (demandes à la base en parallèle) ;
  - application des mannequins sur toute la largeur (tablette ; bornée sur ordinateur) ;
  - bande « Télécharger l'application » rouge foncé partout ;
  - correction SonarCloud de l'édito ; relecture ; deux essais rendus patients.
  La batterie complète tournait quand la conversation s'est arrêtée : **à relancer**, puis mise en ligne
  avec mon accord.
- **Pas commencé** : l'appareil de confiance (chantier 6 ci-dessous).

## 5. Première étape : vérifier avant de coder

1. `git fetch --all --prune`, reprends la branche `chantier-couleurs-site` (ou une branche à toi partant d'elle).
2. Vérifie ce qui est en ligne (site, Administration, application) et le dernier déploiement Vercel.
3. Crée `SUIVI-CHANTIERS.md`, puis fais-moi un point court.

## 6. Mises en ligne : par petits lots, pas tout d'un coup

Une seule mise en ligne pour treize chantiers est trop risquée (si quelque chose casse, on ne sait pas quoi).
Mise en ligne **par lots**, chacun testé, avec mon accord, une version précédente prête à être restaurée :
- **Lot A** : branche `chantier-couleurs-site` (chantiers 1 à 5) — dès que la batterie est verte.
- **Lot B** : installation de l'application vérifiée sur vrais téléphones (chantier 0).
- **Lot C** : photos des articles et des candidatures (chantiers 7 à 11).
- **Lot D, à part** : l'appareil de confiance (chantier 6), car il touche à la connexion.
Le chantier 13 (secrets du dépôt) peut commencer tout de suite : il ne touche pas au site.

## 7. Les chantiers

### Chantier 0 : installation de l'application des mannequins sur tous les téléphones
En ligne depuis le 28/10, mais **jamais vérifié sur de vrais téléphones**. Problèmes signalés le 27/10 :
Samsung Internet bloqué par Google Play Protect ; nouveau Safari d'iPhone (⋯ → Partager → Plus → « Sur
l'écran d'accueil » → Ajouter) ; « Chargement… » sans fin quand la connexion est mauvaise. Captures réelles :
`outils/video-installation/reel-*`. La plupart des mannequins ont un **iPhone** : priorité iPhone. Fais
essayer par de vraies personnes (iPhone récent et ancien, Android Chrome, Samsung Internet, ancien Android,
lien ouvert depuis WhatsApp) et corrige jusqu'à ce que tout marche. Google Play et QR code : abandonnés
pour l'instant. Ensuite, la vidéo d'installation doit suivre le vrai parcours (sources dans `outils/`).

### Chantiers 1 à 5 : faits sur la branche `chantier-couleurs-site`, à vérifier puis mettre en ligne
1. Grille du Book 3 / 4 / 5 photos par ligne (sur téléphone, seul le nom reste sur la photo).
2. Fiche mannequin : photo plus rapide. Étape faite : demandes en parallèle. **Reste** : mesurer aussi le
   chargement de la grande photo (poids, taille adaptée à l'écran, chargement prioritaire, emplacement
   réservé) et me donner le temps avant/après sur téléphone.
3. Application des mannequins sur toute la largeur.
4. Bande « Télécharger l'application » rouge foncé à contour blanc (comportement inchangé).
5. Édito de l'accueil (remarque SonarCloud) ; mettre à jour `README-TECHNIQUE.md`.

### Chantier 6 : double authentification par « appareil de confiance » (Administration)
Aujourd'hui (`js/portail/noyau.js`, `api/connexion-protegee.js`, `api/connexion-admin.js`) : e-mail + mot
de passe + code TOTP ; après 15 min sans rien faire, code à 4 chiffres ; au bout de 8 h ou « Se déconnecter »,
tout est à refaire. Ce que je veux :
1. Nouvel appareil ou navigateur : e-mail, mot de passe, double authentification, code à 4 chiffres ;
   l'appareil devient « de confiance » 30 jours.
2. 15 min d'inactivité : code à 4 chiffres seulement.
3. 1 à 2 h d'inactivité : e-mail, mot de passe et code à 4 chiffres, sans double authentification.
4. Double authentification redemandée seulement : nouvel appareil, 30 jours passés, ou « Oublier cet appareil ».
5. Ne pas se fier à l'adresse internet (elle change sans arrêt sur un téléphone).
Sécurité de connexion : essai **pour de vrai** avec un compte de test, avec mon accord ; vérifier que
l'accès à l'Administration reste possible avant la mise en ligne ; lot à part.

### Chantier 7 : brouillon dans « Actualités et événements » (Administration)
Si je quitte la page en créant un article, je retrouve en revenant le texte saisi et les photos déjà envoyées.

### Chantier 8 : photos ajoutées en plusieurs fois
Choisir 3 photos puis 3 autres (jusqu'à environ 15) : les nouvelles s'ajoutent aux précédentes, jusqu'à la
limite, et je peux en retirer une.

### Chantier 9 : modifier les photos d'un article déjà publié
Remplacer, supprimer, ajouter (et si possible réordonner) les photos d'un article publié, sans le supprimer.
Une photo retirée ne doit pas rester inutilement dans le stockage (R2/Supabase).

### Chantier 10 : même logique pour tous les envois d'images de l'Administration
Inventaire de tous les endroits (actualités, événements, partenaires, mannequins, vidéo d'accueil…), puis
**un seul mécanisme partagé** si c'est possible sans rien casser (`CLAUDE.md` : ne jamais recopier du code).
**Jamais de suppression de photos de mannequins sans le clic de l'agence.**

### Chantier 11 : candidatures de casting, plus d'ajout de photos par l'agence
Retirer l'ajout de photos dans la fiche d'une candidate (elle seule envoie ses photos) ; je dois toujours
pouvoir les consulter. Ne concerne pas les mannequins déjà inscrites.

Essais automatiques à ajouter pour les chantiers 7 à 11.

### Chantier 12 : évaluation globale (avant les dernières mises en ligne)
1. Batterie complète verte.
2. Six visiteurs fictifs **professionnels et exigeants** (styliste sur ordinateur ; jeune mannequin sur
   Android ; directeur de casting sur ordinateur ; promoteur d'événements sur iPhone ; marque partenaire sur
   tablette ; directeur artistique-photographe sur iPhone et tablette) visitent le site **en ligne**, puis
   font leur bilan : points positifs à améliorer, points négatifs à corriger. Plan d'actions dans un fichier
   du dépôt. **Rien n'est réellement envoyé** (aucune fausse candidature ni faux message).
3. Contrôle externe (SonarCloud, analyseurs de sécurité et de vitesse).
4. Corrections, essais relancés.

### Chantier 13 : audit des secrets et protection du dépôt public
1. Balayer tout l'historique Git (toutes branches) avec gitleaks ou trufflehog + recherches ciblées : clé
   `service_role`, jetons Resend, EmailJS (privé), Vercel, GitHub, R2, mots de passe, codes d'invitation,
   données personnelles de mannequins.
2. Les clés publiques (Supabase « anon », EmailJS publique, Google Analytics) sont normales.
3. **Ne jamais recopier un secret** : seulement son nom, son emplacement et ses 4 premiers caractères.
4. Secret trouvé : le **révoquer et le régénérer** dans le service concerné (m'expliquer pas à pas, depuis
   mon téléphone, et dans quel ordre). Pas de réécriture de l'historique sans mon accord.
5. Me guider pas à pas : double authentification GitHub, accès au dépôt, protection de `main`
   (en expliquant l'effet sur notre façon de travailler), « secret scanning » et « push protection ».
6. Expliquer avantages et inconvénients d'un dépôt privé (effet sur SonarCloud) ; ne rien changer sans
   mon accord.
7. Rapport simple : vérifié, trouvé (ou rien), ce que j'ai à faire.

## 8. Après la phase 1 : sécurité côté serveur (au lieu d'une reconstruction obligatoire)

Le site a déjà une partie serveur (`api/`, `middleware.js`). Plutôt que de tout reconstruire (Next.js), ce
qui risque de casser beaucoup pour peu de gain :
1. **Audit, sans code** : écrire `PLAN-SERVEUR.md` (sans secret) — ce qui est déjà protégé côté serveur, ce
   qui manque encore d'après `SECURITY.md` (vérification du contenu réel des fichiers envoyés, limitation de
   débit et anti-robot sur les formulaires publics, logique de l'appareil de confiance…), et pour chaque
   manque la solution la plus simple, son risque et les limites des offres gratuites.
2. Me le présenter, je choisis.
3. Réaliser étape par étape, chacune testée, mise en ligne avec mon accord, retour en arrière possible.
Si l'audit montre qu'une reconstruction complète est vraiment nécessaire, l'expliquer simplement avec
ses risques, et me laisser décider.

Contraintes permanentes : garder Supabase et toutes les données, le design rouge et blanc, les adresses
des pages, le référencement (sitemap, `google5acb001b6b29c80f.html`), l'installation des applications ;
secrets uniquement dans les variables d'environnement Vercel/Supabase, jamais dans le dépôt.

## 9. Messages de fin

« TERMINÉ — PHASE 1 » seulement quand **tous** les chantiers 0 à 13 sont terminés, évalués, en ligne et
vérifiés. Idem pour la suite : « TERMINÉ » seulement quand tout est en ligne et vérifié.
