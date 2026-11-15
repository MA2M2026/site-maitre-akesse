# Rapport de l'agent D — agent testeur humain (15–16/11/2026)

Version auditée : `main` 3da0139 (PR #453), en ligne.
Accès : compte d'essai de l'Administration (rôle **« site »**, « Administrateur du site ») et compte d'essai de
l'espace mannequin. Les visites sont faites **en lecture seule** :
- aucun envoi, aucun enregistrement, jamais « Soumettre » ;
- aucun clic sur un bouton d'action (valider, supprimer…) ;
- les fenêtres de confirmation sont refusées automatiquement.

Les secrets restent hors du dépôt. Les noms des mannequins et des candidates ne figurent pas dans ce rapport.

Limite à connaître : mon environnement ne peut pas joindre `drive.google.com`. Les photos des candidatures stockées sur
Drive s'affichent donc chez moi en initiales. Ce n'est pas un défaut du site : les données sont bien en base (7 photos
sur les 3 derniers jours).

## 1. Résumé

- L'Administration et l'application des mannequins fonctionnent :
  - 42 rubriques ouvertes sur téléphone (390 px) et sur ordinateur (1440 px) ;
  - 15 écrans de l'application visités ;
  - aucune erreur de programme, aucun débordement.
- Batterie complète `scripts/tests-visiteur/lancer.sh` sur 3da0139 : **130 séries, 0 échec**.
- Les parcours publics (Intégrer l'agence, Postuler, Cours de talons, en FR et EN) n'ont montré aucun défaut en clic.
- Le point le plus grave confirmé en vrai est **A-03 (= D-01)**. Le rôle « site » :
  - lit les contacts des parents et les références de paiement ;
  - voit « Paiement reçu » sur les cours de talons ;
  - voit « Supprimer » sur la fiche d'une mannequin.
- Le journal des vrais visiteurs montre des chargements très lents de `/integrer-agence` sur téléphone (14 à 70 s).

## 2. Points forts confirmés par la visite réelle

| ID | Constat | Preuve |
|----|---------|--------|
| D-F1 | Les 42 rubriques permises au rôle « site » s'ouvrent sans erreur de programme ni débordement, sur téléphone et sur ordinateur | `revue-admin.js 390` et `1440` (outil local) |
| D-F2 | L'application des mannequins s'ouvre sans erreur, sur téléphone et sur ordinateur : 5 onglets, volet Paiements, 6 étapes du profil, Ma compcard, Mon CV, Ma carte, Programme | `revue-app.js` ; chargement de `/app/` à 390 et 1905 px |
| D-F3 | Un visiteur anonyme ne lit **aucune donnée privée**. Sur **72 tables** essayées avec la clé publique, seules 14 tables de contenu public répondent (actualités, partenaires, programme, réglages publics…). Les photos d'une mannequin **non publiée** sont refusées (0 ligne) | lecture REST anonyme, une ligne par table (recoupe B-F3, C-F1, C-F2) |
| D-F4 | En-têtes de l'Administration et de l'application : HSTS preload, `script-src 'self'` strict, `frame-ancestors 'self'`, nosniff, Permissions-Policy | réponse réelle des deux sous-domaines (recoupe B-F5) |
| D-F5 | Cohérence site ↔ Administration pour les cours de talons : une inscription faite sur le site apparaît dans « Cours de talons », avec les mêmes prix (groupe 30 000 FCFA les 4 dimanches ; privé 25 000 FCFA en salle) | page publique + rubrique `b2-cours-talons` |
| D-F6 | Les photos des candidatures arrivent de nouveau depuis le 14/11 (0 candidature sans photo les 14 et 15/11) | `casting_applications` × `casting_photos` (recoupe B-F7) |
| D-F7 | La page « Erreurs du site » trie et explique bien les erreurs ; elle a permis de trouver D-03, D-04 et D-07 | `#/site/b3a-erreurs` |

## 3. Problèmes

### D-01 = A-03 — **haute** (confirmé en vrai) — le rôle « Administrateur du site » a les droits d'un administrateur complet

- **Lieu** : table `admins` (le compte « site » y figure) ; voir A-03 pour la cause dans le code SQL.
- **Constaté avec le compte d'essai** (rôle `site`) :
  - **Données lues** :
    - `casting_applications` : 26 lignes, avec e-mail, téléphone, date de naissance, **nom, téléphone et e-mail des parents** ;
    - `inscriptions_mannequins` : avec **référence de paiement** et contacts des parents ;
    - `cours_talons` : téléphone, adresse, **référence Wave, montant**.
  - **Boutons affichés** (aucun clic) :
    - « Paiement reçu (Wave) » et « Payé en espèces » dans Cours de talons. La propriétaire a écrit le 15/11 à 23 h 11 que ce n'est **jamais** l'Administrateur du site qui valide ces paiements ;
    - « Supprimer » sur la fiche d'une mannequin.
- **Conséquence** : un compte « site » peut lire des données de mineurs et de paiement, et agir sur l'argent et les suppressions.
- **Solution** : celle à décider ensemble à partir de A-03 :
  - ne plus ajouter le rôle « site » à `admins` ;
  - ou bien filtrer par `portail_peut(...)` les règles RLS et les fonctions concernées ;
  - et cacher les boutons quand le droit manque.
- **Risque de régression** : élevé, car on touche aux droits de la base. La correction sera essayée **pour de vrai** avec
  le compte d'essai, avec l'accord de la propriétaire (CLAUDE.md, règle 3).
- **Vérification** : je referai la même lecture (`droits-site.js`) et le même contrôle des boutons. Le résultat attendu
  est « refusé », et aucun bouton affiché.

### D-02 — **haute** (données) — 11 candidatures du 06 au 12/11 n'ont aucune photo

- **Lieu** : `casting_applications` sans ligne `casting_photos`. Répartition : 06/11 : 2, 07/11 : 5, 09/11 : 1, 12/11 : 3.
- **Cause** : l'ancien envoi des photos. C'est corrigé depuis le 14/11 (voir B-F7). La cause exacte dans le code est à
  confirmer par B ou C.
- **Conséquence** : l'agence ne peut pas juger ces 11 candidates sur photo.
- **Solution** : ces photos n'ont jamais été reçues, aucun code ne peut donc les récupérer. Il faut demander les photos
  à ces 11 personnes sur WhatsApp. Je peux préparer la liste pour la propriétaire. Il faut aussi garder l'alerte
  « candidature sans photo » (B-F7).
- **Vérification** : la même requête doit donner 0 sur les jours suivants.

### D-03 — **moyenne** — CV créé depuis l'Administration sans le logo de l'agence

- **Lieu** : `js/app.js:256`, `js/app.js:269` (aperçu) et `js/app.js:1391` (PDF et JPEG). Le chemin relatif
  `assets/logo-header.png` devient `/admin/assets/logo-header.png`, qui renvoie **404**. `admin/index.html` n'a pas de
  `<base href="/">`, contrairement aux pages de l'application.
- **Preuve** :
  - 404 relevé en ouvrant `#/site/b2-mannequins-publies/<id>/cv` à 390 et 1440 px ;
  - le journal des vrais visiteurs contient « [Image du site non chargée] assets/logo-header.png », sur `/admin/#/…/cv`, le 13/11.
- **Conséquence** : un CV envoyé à un client depuis l'Administration n'a pas de logo.
- **Solution** : écrire `/assets/logo-header.png`, comme partout ailleurs dans `app.js`, `carte-mannequin.js` et `mannequin-app.js`.
- **Risque** : très faible, car l'application a déjà `<base href="/">`.
- **Vérification** :
  - ouvrir le CV dans l'Administration : aucun 404 ;
  - le PDF contient le logo ;
  - ajouter ce cas à un test visiteur (`test-nouvelle-admin-mannequins.js`).

### D-04 — **moyenne** — `/integrer-agence` (et `/cours-talons`) très lentes chez de vrais visiteurs sur téléphone

- **Preuve** :
  - journal des erreurs, 7 jours, `/integrer-agence` : « chargement complet en 14 / 16 / 21 / 23 / 70 s » (Android, iPhone, Windows) ;
  - `/cours-talons` : 31 s ;
  - ma mesure (Pixel 5, bonne connexion) : `/integrer-agence` met 5,7 s pour l'évènement `load` (contre 2,4 s pour l'accueil), avec 59 fichiers et 1,7 Mo, dont 0,65 Mo de scripts.
- **Cause** : le poids commun de chaque page : `app.js` 0,22 Mo, `style.css` 0,20 Mo, supabase-js 0,20 Mo. S'y ajoutent les images du diaporama.
- **Lien avec les autres rapports** : recoupe C-P9 et B-P1. L'« affichage qui saute » est aussi relevé sur `/integrer-agence` et `/cours-talons` dans le journal.
- **Solution** : à choisir ensemble avec B et C, qui ont les mesures 4G lente. Pistes : charger supabase-js seulement
  à l'envoi du formulaire, alléger `style.css`, réserver la place des images.
- **Vérification** : de nouvelles mesures 4G lente par B ou C, puis le journal des 7 jours suivants.

### D-05 — **moyenne** (cohérence application ↔ règles de paiement) — formation affichée pendant la fermeture de l'agence

- **Lieu** : application, onglets Accueil et Paiements (compte d'essai inscrit en novembre 2026). Valeurs calculées par
  la base (`mes_mensualites`, `mon_programme_formation`) et mises en phrases par `js/app.js:934-947`.
- **Constaté** :
  - à l'Accueil, la carte « **CE MOIS-CI** · Posture et démarche de base · Niveau 1 · mois 1 sur 9 », alors que l'agence est fermée jusqu'au 1er mars 2027 ;
  - aux Paiements, « Mois 1 sur 9 · **il reste 17 mois** », mais aussi « **0 / 18** mois payés » et « Prochaine mensualité : mars 2027 ».
- **Conséquence** : la mannequin peut croire qu'elle est déjà en cours de formation. De plus, 17 et 18 se contredisent.
- **Solution** : B ou C vérifient le calcul SQL (`supabase-reprise-mars.sql`). La propriétaire tranche la règle :
  pendant la fermeture, affiche-t-on « Commence en mars 2027 » ? Novembre compte-t-il comme mois 1 ?
- **Vérification** : revisiter l'application avec le compte d'essai.

### D-06 — **basse** — l'Administration est lente à ouvrir les fiches

- **Mesures** (avec le relais réseau de mon environnement, donc à relativiser) :
  - liste « Mannequins » : 5,2 à 6,1 s, 28 cartes ;
  - fiche d'une mannequin : 6,3 à 7,6 s ;
  - CV : 5,5 à 5,9 s ;
  - la rubrique Mannequins a atteint une fois 13,4 s.
- **Solution** : à mesurer sans relais par un autre agent avant de décider.

### D-07 — **basse** — le journal des erreurs est encombré par un très vieux navigateur

- **Preuve** : « SyntaxError: Unexpected token '=' », « supabase-js absent », « Page vide », « Page figée ». Tous viennent
  de Chrome 45 sous Windows 7 (sorti en 2015), le 14/11 et le 15/11, sur `/` et `/app/`. Ils sont classés « À corriger ».
- **Conséquence** : ces fausses alarmes inquiètent la propriétaire.
- **Solution** : ne pas journaliser (ou classer « appareil trop ancien ») les navigateurs qui ne savent pas lire le code
  moderne, détectés au démarrage.
- **Même catégorie** : « Identifier 'enMo' has already been declared » sur `/integrer-agence` (UA « Pixel C, Android
  8.1 », souvent un outil d'analyse automatique). `app.js` n'y est chargé qu'une fois, et l'erreur ne se reproduit pas.

### D-08 — **basse** — boutons « Compcard PDF JPEG » qui dépassent de 12 px sur téléphone

- **Preuve** : journal « [Page plus large que l'écran] /book/… : div.fiche-telecharger dépasse de 12 px » (3 fiches, le 14/11, Android).
- **Remarque** : non reproduit à 390 px par B (B-F1). C'est probablement un écran plus étroit (360 px).
- **Vérification** : visite d'une fiche du Book à 360 px.

## 4. Cohérence Administration ↔ application ↔ site

- **Cours de talons** :
  - site → Administration : cohérent (D-F5) ;
  - la page « Mon programme » de l'élève et le planning de l'Administration n'ont pas pu être comparés : il n'y a aucune
    séance planifiée en base (« Planning (0) »).
- **Formation et paiements** : l'application affiche des informations que le rôle « site » ne peut pas voir dans
  l'Administration (espace Paiements non permis). La comparaison des deux côtés pour D-05 demande donc un agent qui lit
  la base, ou la propriétaire.
- **Candidatures et Intégrer l'agence** : le formulaire public alimente bien « Candidatures casting » (26 dossiers :
  14 retenus, 12 refusés). Les photos manquantes sont traitées en D-02.

## 5. Avis sur les points des autres agents

- **Confirmés par une visite ou une mesure réelle** :
  - A-03 (= D-01) ;
  - B-P4 / C-P1 : `script-src 'unsafe-inline'` sans empreinte sur la page d'accueil en ligne ;
  - C-P9 : 0,65 Mo de scripts par page ;
  - B-P1 / C-P2 : « affichage qui saute » également présent dans le journal des vrais visiteurs, sur `/integrer-agence` et `/cours-talons` ;
  - B-F3, C-F1 : RLS, 72 tables essayées ;
  - B-F5 : en-têtes ;
  - A-04 en partie : des paramètres d'adresse (ex. `?utm_source=…`) apparaissent bien dans `journal_erreurs.page`.
- **Je ne peux pas confirmer** les variables d'environnement Vercel (A-06), ni A-01 (je n'ai pas fait de visite des
  fichiers `/docs/…`). Ces points restent à A, B et C.

## 6. Ce que je referai après chaque correction

1. `revue-admin.js` (390 et 1440 px) et `revue-app.js` : visite complète en lecture seule.
2. `droits-site.js` et `boutons-site.js` : droits réels du rôle « site » (D-01).
3. `visite-fiches.js` : fiche, CV (logo, D-03), candidature.
4. `scripts/tests-visiteur/lancer.sh` : batterie complète.

Ces outils sont dans le dossier de travail local de l'agent D. Les identifiants restent hors du dépôt.
