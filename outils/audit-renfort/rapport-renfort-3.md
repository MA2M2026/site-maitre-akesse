# Mission MA2M — Rapport de l'agent 3 (15/11/2026)

Angle principal : **code de fond en comble (§6)**, **code ↔ site réel et dynamisme (§7, §8)**, **visiteur
professionnel** (directeur de casting sur ordinateur 1440×900, styliste sur tablette 800×1200). Administration et
application des mannequins : **par le code seulement** (§15, aucun accès réel).

Version en ligne contrôlée : `665f03d` (en-tête `x-ma2m-build`, = `origin/main`). Aucune écriture réelle : dans
Playwright, toute requête autre que GET vers Supabase, EmailJS et `/api/` était bloquée (voir ce que l'écran affiche
alors). Lectures de la base faites en anonyme (GET, clé publique), comme n'importe quel visiteur.
Scripts et captures : dossier `agent-3` du scratchpad de la mission (`dynamisme.js`, `recruteur.js`, `jpeg.js`,
`perf.js`, `refs.py`, `mort.py`, `sql.py`, captures `recruteur-*.png`, `styliste-*.png`).

---

## 1. Résumé exécutif

Le site public est **réellement dynamique** : les pages métier sont écrites par le serveur à partir de la base à
chaque visite (cache 60 s + mémoire 3 min), et les nombres affichés correspondent exactement à la base (28 profils,
10 actualités, 5 événements, 5 partenaires). Le parcours d'un professionnel fonctionne sans erreur de page (0), la
compcard PDF et JPEG se télécharge en moins de 1,1 s, la sélection résiste à un échec d'envoi.

Mais l'audit trouve **2 failles hautes de logique d'accès** (création publique de comptes « confirmés » sans preuve
de l'e-mail ; validation de l'agence contournable par une mannequin, à confirmer avec un compte de test), **plusieurs
protections annoncées qui ne protègent pas** (scripts réservés servis par une adresse encodée, anti-robots désactivé
depuis le 01/11, documents internes publiés sur le site), et une **dette structurelle** : 57 fichiers SQL sans suivi
de ce qui est installé, 31 fonctions redéfinies dans plusieurs fichiers, 21 replis « SQL pas encore collé » dans le
code. Pour un recruteur, la recherche est astucieuse mais **trop pauvre pour booker** (une seule barre de texte, pas
de fourchettes, sélection réduite au nom + taille, rien à partager), et The Book est la page la plus lente sur
téléphone moyen (LCP 5,7 s).

| Gravité | Nombre |
|---|---|
| Critique | 0 |
| Haute | 2 |
| Moyenne | 9 |
| Basse | 13 |
| **Total** | **24** |

---

## 2. Points forts (vérifiés : comportement réel + code responsable)

| # | Point fort | Preuve (mesure) | Code responsable |
|---|---|---|---|
| F1 | Pages métier écrites par le serveur depuis la base | 13 pages : en-tête `x-ma2m-render: ssr`, bloc JSON de données posé dans la page (`book-donnees`, `publications-donnees`, `partenaires-donnees`, `agenda-donnees`, `parcours-donnees`, `qsn-donnees`, `accueil-donnees`, `page-donnees`) ; aucune lecture Supabase supplémentaire par le navigateur (seul `POST page_views`) | `middleware.js:647-678` (pageRemplie), `:797-822`, `:833-877` |
| F2 | Ce qui est affiché = ce qui est en base | The Book : 28 cartes (FR et EN) = 28 profils publiés lus en anonyme (`content-range 0-0/28`) ; actualités : 1 « à la une » + 9 cartes = 10 en base ; événements 5/5 ; partenaires 5/5 | `middleware.js:801`, `js/rendu-book.js:23-49` |
| F3 | Droits par colonne sur les profils | `model_profiles?select=*` en anonyme → 401 « permission denied » ; seules les colonnes publiques passent ; `casting_applications`, `recruiter_requests`, `messages_contact` lus en anonyme → 0 ligne | `supabase-extension.sql:3639, 6076, 6212` + RLS |
| F4 | Recherche « en langage naturel » cohérente | 16 recherches identiques sur ordinateur et tablette (ex. « 1m75 » → 11, « plus de 1m80 femme » → 5, « taille M » → 9, « pointure 40 » → 3, « xyz » → 0 avec message) | `js/mannequins.js:33-64, 182-206` |
| F5 | Compcard rapide et fiable | PDF 2 166 Ko en 0,97 s (ordinateur) / 1,10 s (tablette) ; JPEG en 0,80 s / 0,79 s | `js/app.js:1215-1254`, `js/fiche-mannequin.js:178-205` |
| F6 | Sélection robuste | Gardée dans le navigateur ; envoi bloqué → « Erreur lors de l'envoi… », bouton réactivé, sélection conservée (vidée seulement après succès) | `js/demande-recruteur.js:44-80, 104` |
| F7 | Tâches planifiées et webhooks fermés | `GET /api/portail` → 401, `?tache=convocations` → 401, `GET /api/whatsapp-webhook` → 403 | `api/portail.js:200-203, 235-238`, `api/whatsapp-webhook.js:73-82` |
| F8 | Envois de fichiers contrôlés | Type annoncé limité, taille inscrite dans la signature, **contenu réel relu** (premiers octets) et fichier supprimé s'il ment | `api/_r2.js:12, 30-63, 94-103` |
| F9 | Suppression d'une mannequin encadrée | identifiant vérifié, admin à deux facteurs, refus si la cible est un compte admin, limite 20/min | `api/supprimer-mannequin.js:27-57` |
| F10 | Administration : pas de script en ligne | CSP `/(admin|app)/` : `script-src 'self'` ; noms recopiés par les recruteurs échappés à l'affichage | `vercel.json` (bloc admin/app), `js/admin/site-dossiers.js:283-290` |

---

## 3. Points faibles (synthèse)

1. Logique d'accès : comptes créables par n'importe qui avec un e-mail non prouvé (A3-01) ; validation de l'agence
   contournable (A3-02) ; protections « fail-open » (A3-11).
2. Protections affichées mais inopérantes : scripts réservés (A3-03), anti-robots (A3-05), documents internes (A3-04).
3. Base de données non pilotée : fichiers SQL sans suivi, fonctions redéfinies, replis permanents (A3-10, A3-06).
4. Outil de booking insuffisant pour un professionnel (A3-08, A3-07) ; The Book lent sur téléphone (A3-09).
5. Code monolithique et erreurs avalées (A3-16, A3-17).

---

## 4. Bugs fonctionnels et problèmes (fiches détaillées)

### A3-01 — Haute — N'importe qui peut créer un compte « confirmé » avec l'e-mail de quelqu'un d'autre
- **Localisation** : Administration › « Créer mon compte » ; `api/portail.js:335-366` (`demandeAcces`), `:392-415` (`inviter`).
- **Cause** : l'action publique `demande_acces` (aucun jeton, aucun anti-robot) crée le compte avec
  `email_confirm: true` et le mot de passe choisi par le demandeur, sans jamais prouver qu'il possède l'adresse.
  Ensuite, `inviter` (administratrice principale) cherche l'adresse : si un compte existe déjà et n'a pas de fiche
  `staff_profiles`, il lui **attribue directement le rôle** (upsert `staff_profiles`) sans envoyer d'invitation.
- **Conséquence** : (1) une personne qui connaît l'adresse d'un futur collaborateur peut la « réserver » avant lui ;
  le jour où l'agence l'invite, c'est le compte de l'intrus (son mot de passe, et il peut activer sa propre double
  authentification) qui reçoit le rôle ; (2) blocage d'adresses : une mannequin ou un collaborateur ne peut plus créer
  son compte (« Un compte existe déjà ») ; (3) la limite est **globale** (10 demandes par heure pour tout le monde) :
  un robot bloque toutes les vraies demandes.
- **Solution proposée** : ne plus marquer l'adresse confirmée (`email_confirm: false` + lien de confirmation), ou
  refuser dans `inviter` tout compte existant créé par `demande_acces` non accepté (passer par
  `staff_demandes`/accepter) ; ajouter Turnstile + limite par adresse IP sur `demande_acces`.
- **Risque de régression** : moyen (création de compte = zone de l'incident du 04-11/10) ; essai réel obligatoire
  (règle 3 de CLAUDE.md).
- **Vérification** : avec l'accord de la propriétaire et l'agent testeur : créer une demande avec une adresse de
  test, inviter cette adresse, constater que le rôle n'est pas attribué sans confirmation.
- **Preuve** : code cité (lignes 345-348 puis 395-411).

### A3-02 — Haute (à confirmer par un essai réel) — Une mannequin peut se publier sans la validation de l'agence
- **Localisation** : Application des mannequins ; `supabase-extension.sql:6105-6140` (`gerer_validation_publication`),
  `:2072-2104` (`bloquer_publication_mineur`) ; `js/espace-mannequin.js:319, 586`.
- **Cause** : la règle « première publication = validation de l'agence » repose sur
  `OLD.premiere_publication_faite`, et la règle « mineure jamais publiée seule » sur `date_naissance` ; **aucun
  déclencheur ni droit par colonne n'empêche la mannequin de modifier ces deux colonnes de sa propre fiche** (seuls
  `featured`, `desactive`, `niveau_manuel` sont protégés ; aucun `grant update (…)` sur `model_profiles`).
- **Conséquence** : par un appel direct à l'API (sans passer par l'application) : 1) `premiere_publication_faite = true`,
  2) `published = true` → fiche en ligne sans validation ; une mineure peut d'abord vider ou vieillir sa date de
  naissance. Le Book public affiche alors un profil non contrôlé.
- **Solution proposée** : déclencheur « colonnes réservées à l'agence » (`premiere_publication_faite`,
  `en_attente_validation`, `raison_refus`, `date_naissance` après la première validation) sur le modèle de
  `bloquer_profil_en_sourdine` ; ou droits UPDATE par colonne pour `authenticated`.
- **Risque de régression** : moyen (l'application écrit `date_naissance` à l'inscription : l'autoriser tant que la
  fiche n'a jamais été validée).
- **Vérification** : essai sur la base d'essai (`scripts/base-essai`) puis réel avec un compte de test : les deux
  mises à jour doivent être refusées.
- **Preuve** : lecture des 7 déclencheurs `before … on model_profiles` (lignes 605, 2103, 2266, 2447, 6073, 6283, 7031)
  et de `supabase-carte-mannequin.sql:87-97` ; aucun ne touche `premiere_publication_faite` ni `date_naissance`.

### A3-03 — Moyenne — Les « scripts réservés » de l'Administration se téléchargent sans clé
- **Localisation** : `middleware.js:81-84, 1211` ; tous les domaines.
- **Cause** : le filtre compare `url.pathname` **encodé** à une liste ; `site%2Dmannequins.js` ou `%73ite-…` ne
  correspond pas, mais Vercel décode l'adresse et sert le fichier.
- **Conséquence** : la protection promise (13/10/2026) ne tient pas. Impact limité (les données restent protégées par
  la base, et le dépôt GitHub est public selon `api/_r2.js:103`), mais c'est une promesse non tenue.
- **Solution proposée** : comparer `decodeURIComponent(url.pathname)` (et refuser les `%` dans `/js/`), ou assumer
  que ces fichiers sont publics et retirer cette fausse sécurité.
- **Risque** : faible. **Vérification** : les 4 adresses ci-dessous doivent répondre 404.
- **Preuve** (GET, sans cookie) :
  `/js/admin/site-mannequins.js` → 404 ; `/js/admin/site%2Dmannequins.js` → **200 (45 413 octets)** ;
  `/js/agenda%2Dadmin.js` → **200 (27 542)** ; sur admin.… : `site-mannequins%2Ejs` et `%73ite-mannequins.js` → **200**.

### A3-04 — Moyenne — Documents internes publiés sur le site de l'agence
- **Localisation** : `.vercelignore` (ne liste pas `docs/`, `DECISIONS.md`, `GUIDE-DE-SECOURS.md`, `AGENTS.md`,
  `CONVENTIONS.md`, `tests/`).
- **Conséquence** : la carte des droits de la base, la procédure en cas de falsification, le plan de retour arrière,
  les rapports d'audit sont lisibles sur www.maitreakessemodelmanagement.com. **Ce rapport-ci le serait aussi** dès
  sa fusion dans `main`.
- **Preuve** : `/docs/rls-matrix.md` 200 (4 117 o), `/docs/falsification.md` 200, `/docs/runbook-rollback.md` 200,
  `/DECISIONS.md` 200 (6 136 o), `/GUIDE-DE-SECOURS.md` 200 (7 621 o), `/AGENTS.md` 200, `/tests/js-only-whitelist.json` 200.
- **Solution** : ajouter `docs/`, `tests/`, `*.md` (sauf ceux voulus) à `.vercelignore` **avant** de fusionner les
  rapports de la mission. **Risque** : nul pour les visiteurs. **Vérification** : mêmes adresses → 404.

### A3-05 — Moyenne — L'anti-robots des formulaires est désactivé depuis le 01/11
- **Localisation** : `api/portail.js:291-305` (`ANTI_ROBOTS_STRICT = false`).
- **Cause** : mise en ligne « en attendant de trouver la cause » d'un refus, jamais réactivée.
- **Conséquence** : candidature, contact, demande de recruteur acceptés **sans jeton** ; seules les limites par
  minute de la base protègent. README-TECHNIQUE.md (§ Extension 152) décrit une protection qui n'est pas appliquée.
- **Solution** : lire au journal les raisons notées depuis 14 jours, corriger, puis `true`.
- **Risque** : refus de vrais visiteurs si la cause n'est pas réglée. **Vérification** : `journal_erreurs` « [Anti-robots] ».

### A3-06 — Moyenne — Repli dangereux d'enregistrement des formulaires avec la clé secrète
- **Localisation** : `api/portail.js:321-329`.
- **Cause** : si la fonction `formulaire_public_enregistrer` est absente, le serveur insère **la ligne envoyée par le
  navigateur** (toutes ses colonnes sauf `status`) avec la clé `service_role`, qui ignore la sécurité par ligne.
- **Conséquence** : le jour où la fonction manque (fichier SQL rejoué dans le mauvais ordre, A3-10), n'importe qui peut
  écrire n'importe quelle colonne de ces 4 tables.
- **Solution** : supprimer ce repli (le SQL est installé depuis le 01/11) ou lister les colonnes permises.
- **Risque** : faible. **Vérification** : essai serveur simulé avec la fonction absente → refus.

### A3-07 — Moyenne — Demande de booking : la liste des mannequins peut se perdre sans que personne le voie
- **Localisation** : `/selection` ; `js/demande-recruteur.js:61-93` ; `supabase-anti-robots.sql:78-93` ;
  contrainte `supabase-extension.sql:3571-3574`.
- **Cause** : la demande passe par le serveur, puis la liste des mannequins est insérée **séparément**, depuis le
  navigateur, en un seul envoi. La sélection est une copie gardée dans le navigateur (nom, taille, photo), jamais
  revérifiée : un profil supprimé depuis → violation de clé étrangère → **tout l'envoi de la liste échoue** ; plus de
  60 profils → refusé par la règle. L'erreur part au journal, mais le recruteur voit « Merci ! » et sa sélection est
  effacée.
- **Conséquence** : l'agence reçoit une demande sans les mannequins demandés (le cœur du booking).
- **Solution** : envoyer la liste avec la demande dans le même appel serveur (`formulaire_public_enregistrer`),
  ignorer les profils disparus, et revalider la sélection à l'ouverture de `/selection` (retirer les profils non publiés).
- **Risque** : faible. **Vérification** : essai visiteur avec une sélection contenant un identifiant inexistant.

### A3-08 — Moyenne — Outils de booking trop pauvres pour un directeur de casting ou une styliste
- **Localisation** : `/mannequins`, fiche, `/selection`.
- **Constats mesurés (1440×900 et 800×1200)** :
  - une seule barre de texte (+ Tous/Femmes/Hommes) : pas de fourchettes (taille 172-178, tour de taille ≤ 64), pas de
    tri, pas de filtre ville/disponibilité visible ; la tolérance est fixe (2 cm) : « 86-62-90 » → **0 profil, sans
    proposition** ; « teint noir » → 0 (le vocabulaire attendu n'est pas indiqué) ;
  - la carte ne montre que niveau, nom, taille, ville (« MAIN BOARD ASSOA MARIE-FRANCE 1,74 m · Abidjan ») : aucune
    mensuration au survol ;
  - à l'arrivée sur ordinateur, seulement 4 cartes coupées à mi-hauteur sont visibles (titre 480 px + bandeau des
    cookies 78 px + bulle WhatsApp) — capture `recruteur-01-book.png` ;
  - « Ma sélection » : nom + taille seulement (capture `recruteur-04-selection.png`), pas de mensurations, pas de
    compcard groupée, **pas de lien de partage** (la sélection n'existe que dans ce navigateur : impossible de
    l'envoyer au client ou de la retrouver sur un autre appareil) ;
  - « Réserver » sur la fiche ne fait que descendre aux numéros de l'agence ; la demande de booking (dates, durée,
    lieu, budget, usage des images) se réduit à « type de projet » + « date souhaitée » en texte libre.
- **Solution** : filtres repliables (fourchettes taille / mensurations, ville, disponibilité, tri), mensurations
  au survol, tableau de sélection avec mensurations + « Télécharger les compcards (PDF) » + lien partageable,
  champs de booking (dates de début/fin, lieu, usage, budget indicatif).
- **Risque** : moyen (page la plus vue des professionnels) ; décision de la propriétaire nécessaire (elle avait
  demandé une barre unique le 12/11). **Vérification** : parcours recruteur ajouté aux tests visiteur.

### A3-09 — Moyenne — The Book est la page la plus lente sur un téléphone moyen
- **Localisation** : `/mannequins`, `/en/mannequins`.
- **Mesure** (Android 412×915, 1,6 Mbit/s, 150 ms, processeur ×4, médiane d'un passage) :

  | Page | LCP | CLS | Poids transféré | Requêtes |
  |---|---|---|---|---|
  | `/` | 2,65 s | 0,007 | 529 Ko | 52 |
  | `/mannequins` | **5,66 s** (5,68 au 2e passage) | 0,006 | 516 Ko | 61 |
  | `/en/mannequins` | **5,33 s** | 0,009 | 527 Ko | 60 |
  | `/book/assoa-marie-france` | 1,56 s | 0,028 | 515 Ko | 51 |
  | `/selection` | 1,38 s | 0,09 | 421 Ko | 43 |
  | `/candidature` | 1,79 s | **0,241** | 639 Ko | 57 |
- **Cause probable** : le plus grand élément est affiché après tous les programmes (bandeau des cookies déjà signalé
  le 08/11 dans `visitor-report.md` §4, ou photos des cartes) — élément exact non isolé dans cet audit.
- **Solution** : identifier l'élément (Lighthouse « LCP element »), puis même méthode que la fiche (1,56 s).
- **Vérification** : même script `perf.js`, objectif ≤ 2,5 s.

### A3-10 — Moyenne — La base de données n'a pas de suivi de version
- **Localisation** : 57 fichiers `supabase-*.sql` à la racine (15 990 lignes, 327 fonctions).
- **Mesures** : **31 fonctions redéfinies dans plusieurs fichiers** (ex. `mensualites_appeler`, `mes_mensualites` : 3
  fichiers ; `cachet_depense_annulee`, `cours_talons_valider`, `recap_figer`, `mensualites_payer_avance` : 3 ;
  `formulaire_public_enregistrer` : 2) ; **12 replis « pas encore collé » dans 9 fichiers JS** et **14 tests
  d'absence de fonction** (`PGRST202`, `Could not find the function`) ; `supabase-extension.sql:2219-2229` reconnaît
  qu'une règle RLS essentielle (« modifier sa propre fiche ») « n'est pas vérifiable depuis ce dépôt ».
- **Conséquence** : recoller un ancien fichier remet silencieusement une ancienne version d'une fonction (paiements,
  validation) ; personne ne sait avec certitude ce qui tourne en production ; le code garde des chemins de secours
  permanents (A3-06).
- **Solution** : exporter le schéma réel (`supabase db dump --schema-only`) dans le dépôt, numéroter les fichiers
  (migrations), table `migrations_appliquees`, puis supprimer les replis devenus inutiles.
- **Risque** : faible si fait en lecture d'abord. **Vérification** : comparaison schéma réel / dépôt.

### A3-11 — Moyenne — Contrôles qui laissent passer en cas de doute (« fail-open »)
- `api/_commun.js:146` : appareil de l'administrateur → si la fonction `portail_admin_ok` répond 404, **accepté**.
- `api/_commun.js:224-237` (`limiteDebit`) : base injoignable → pas de limite (choix assumé, à documenter).
- `api/acces-tableau.js:46-55` : un administrateur **sans code de validation défini** reçoit la clé d'accès de 12 h
  avec le seul mot de passe (`aal1`).
- `middleware.js:105-107` : variable serveur absente → scripts réservés servis.
- **Solution** : refuser par défaut (404 → refus une fois l'Extension 158 confirmée installée ; exiger `aal2` pour la clé).
- **Risque** : enfermer la propriétaire dehors → essai réel avec l'agent testeur. **Vérification** : essais serveur simulés.

### A3-12 — Basse — Webhook WhatsApp acceptant des événements non signés
- `api/whatsapp-webhook.js:86-104` : si `WHATSAPP_APP_SECRET` n'est pas réglée, tout POST dont l'identifiant de compte
  = la constante publique `WABA_AGENCE` est enregistré (faux « délivré / échoué » dans l'Administration).
- **Solution** : refuser sans secret. **Vérification** : variable présente sur Vercel (agent ayant les accès).

### A3-13 — Basse — Conditions de course (deux écritures au lieu d'une)
- « Mettre à la une » : `js/admin/site-mannequins.js:468-469` (tout à faux, puis une à vrai) ; rôles de photo :
  `js/app.js:2056-2062` (`definirRolePhoto`). Deux appareils en même temps, ou une coupure entre les deux → aucune
  ou deux photos principales / aucune mannequin à la une.
- **Solution** : une fonction SQL atomique par action. **Vérification** : essai base d'essai en parallèle.

### A3-14 — Basse — Code mort et fonctionnalités codées mais invisibles
- 5 fonctions jamais appelées (analyse de 162 fichiers, 1 506 déclarations) : `definirVilleAvecCommune`
  (`js/app.js:3672`), `editeurRicheDiffere` (`:2448`), `preparerEditeursDifferes` (`:2463`), `taillesDepuisEtat`
  (`js/espace-mannequin.js:1184`), `erreurEnClair` (`js/erreurs-site.js:65`).
- Colonne `actualites.featured` lue à chaque visite (`middleware.js:830`, `js/actualites.js:27`) mais « plus utilisée »
  (`supabase-extension.sql:766`) : « À la une » = simplement la plus récente.
- Bloc Instagram de l'accueil codé mais caché : `accueil-donnees.instagram = 0` (table de cache vide).
- **Aucun fichier JS orphelin** (chaque fichier de `js/` est chargé quelque part) — bon point.

### A3-15 — Basse — Recopies de code
- Échappement HTML écrit **au moins 11 fois** différemment (`js/app.js:107`, `js/partage.js:237`,
  `js/rendu-agenda.js:9`, `js/rendu-book.js:7`, `js/rendu-publications.js:7`, `js/rendu-fiche.js:14`,
  `js/parcours.js:21`, `js/inscription-simplifiee.js:20`, `js/mes-paiements.js:18`, `js/messages-groupes.js:53`,
  `middleware.js:127`) ; certaines versions n'échappent pas l'apostrophe (`partage.js`, `rendu-agenda.js`) : sûr
  aujourd'hui (attributs entre guillemets doubles), fragile demain. Contraire à la règle 5 de CLAUDE.md.
- `genererFiche` / `genererCv` presque identiques (`js/app.js:1215-1254` et `1706-1749`).
- SonarCloud : duplication **2,4 %** (1,8 % le 08/11), complexité cognitive **20 133** (16 344 le 08/11),
  6 926 « odeurs ».

### A3-16 — Basse — Programmes lourds et monolithiques
- `js/app.js` : 3 784 lignes, 224 Ko, chargé par **toutes** les pages publiques (contient aussi CV, compcard,
  envoi de photos, outils d'Administration). `supabase-js` 202 Ko chargé même sur les pages déjà remplies par le
  serveur. `js/gabarit.js` exécuté **deux fois** sur 34 des 42 pages (en-tête puis pied ; voulu, mais 20 Ko analysés
  deux fois).
- Mesure (non compressé) : `/` 20 scripts, 680 Ko ; `/mannequins` 21 scripts, 648 Ko ; fiche 22 scripts, 660 Ko ;
  `/selection` 607 Ko ; `/contact` 600 Ko.
- **Solution** : découper `app.js` par thème (déjà proposé le 08/11) et charger Supabase à la demande.

### A3-17 — Basse — Erreurs avalées sans trace
- 102 `catch {}` vides, 130 `.catch(() => {}/null/…)`, 62 promesses lancées avec `void`, 44 écouteurs `async`
  sans garde visible ; 0 `console.log` oublié, 0 `eval`.
- Conséquence : pannes silencieuses (cf. A3-07). **Solution** : `signalerErreur` dans les `catch` des chemins métier.

### A3-18 — Basse — Bouton « + » de sélection petit, grille redessinée à chaque appui
- Bouton 28×28 px (minimum tactile recommandé 44×44) sur tablette ; après une recherche, chaque appui sur « + »
  redessine les 28 cartes (`js/mannequins.js:247-266` → `appliquerFiltres`) : l'essai a mesuré « Element is not
  attached to the DOM » au 2e appui (le bouton visé a été remplacé), perte du focus clavier.
- **Solution** : mettre à jour le seul bouton touché.

### A3-19 — Basse — Formulaire de booking : validations faibles
- `pas-un-email@x` accepté par le navigateur ; téléphone et WhatsApp facultatifs (l'agence peut recevoir une demande
  joignable seulement par une adresse fausse) ; validation serveur non visible dans le dépôt (dépend de
  `formulaire_public_enregistrer`).
- **Solution** : même règle `EMAIL_VALIDE` côté page et côté base ; un moyen de contact obligatoire.

### A3-20 — Basse — SonarCloud : note de fiabilité E sur un fichier qui n'existe plus
- `api/issues/search` : 1 « bug » bloquant dans `maquettes/essai-medias-drive.sql:283`, fichier absent de `main` :
  l'analyse publique ne reflète pas l'état de `main` (règle 8 de CLAUDE.md). **Solution** : relancer l'analyse sur `main`.

### A3-21 — Basse — Catégorie « Main Board » auto-déclarable
- `supabase-carte-mannequin.sql:64-72` : `years_experience ≥ 2` (saisi par la mannequin) ou une expérience datée de
  2 ans suffit pour passer en Main Board. Choix métier à confirmer par la propriétaire.

### A3-22 — Basse — Mensurations « à reprendre » cachées à l'écran mais présentes dans la page
- Le bloc JSON `book-donnees` / `fiche-donnees` contient poitrine, taille, hanches même quand la fiche les cache
  (`js/mannequins.js:119-122`) ; elles sont aussi lisibles par l'API publique. Faible enjeu, mais incohérent avec
  la règle affichée.

### A3-23 — Basse — Suppression d'une mannequin : détails techniques renvoyés, fichiers oubliés
- `api/supprimer-mannequin.js:84-87` renvoie le texte brut de l'API d'authentification ; si la lecture des photos
  échoue (`:62-64`), le compte est supprimé mais les fichiers R2 restent (orphelins).

### A3-24 — Basse — CSP du site public : scripts en ligne autorisés
- `vercel.json` : `script-src 'self' 'unsafe-inline' …` sur le site public (l'Administration, elle, ne l'autorise pas).
  Une injection HTML deviendrait exécutable. **Solution** : empreintes (déjà calculées par `scripts/verifier-csp.py`)
  au lieu de `'unsafe-inline'`.

---

## 5. Comparaison code ↔ site réel et dynamisme (§7, §8)

Méthode : chaque page ouverte dans un vrai navigateur ; requêtes réseau relevées ; données posées par le serveur
comparées à la base lue en anonyme (GET).

| Fonctionnalité | Source réelle observée | Code ↔ écran | Verdict |
|---|---|---|---|
| Profils / The Book | serveur → `model_profiles` + `rpc photos_couverture…` ; 28 = 28 en base | conforme ; 2 chapitres Main Board / New Faces | **Dynamique** |
| Fiche mannequin | serveur → profil, photos (11), projets, parcours, mesures | conforme ; compcard PDF/JPEG OK | **Dynamique** |
| Castings | `candidature` : `page-donnees.projets = 0`, accueil `castingOuvert: false` | formulaire général affiché, aucun casting ouvert | Dynamique (vide aujourd'hui) |
| Statuts de validation | déclencheurs SQL (A3-02) ; non observables sans compte | **contournable** par appel direct | À confirmer (agent testeur) |
| Actualités | serveur → 10 en base, 1 « à la une » + 9 cartes | `featured` lue mais ignorée (A3-14) | **Dynamique** |
| Événements | serveur → 5/5 | conforme | **Dynamique** |
| Agenda | serveur → `agenda-donnees` : 5 projets + 5 événements ; table fermée aux visiteurs (401), lue par fonction | accueil « À venir » caché (0 à venir) : cohérent | **Dynamique** |
| Parcours | serveur → 5 projets, 16 photos (12/2024 → 11/2026) | conforme | **Dynamique** |
| Partenaires | serveur → 5/5 | conforme | **Dynamique** |
| Statistiques | `POST page_views` depuis chaque page (bloqué ici) | tableau de l'Administration non vérifiable (§15) | Dynamique (écriture) |
| Photos | `photos.maitreakessemodelmanagement.com` + relais `/book-photos/` | conforme | Stockage réel |
| Instagram | `instagram_posts_cache` vide → bloc caché | code présent, rien à l'écran | **Codé mais invisible** |
| Sélection | navigateur uniquement (localStorage) | jamais revalidée contre la base (A3-07) | Statique par choix |

Écart à noter : `/selection` n'est pas écrite par le serveur et relit **toute la liste des profils** au chargement
(`GET model_profiles` + 2 fonctions de photos) même quand la sélection est vide — inutile pour cette page.

---

## 6. UX / UI — visiteur professionnel

**Directeur de casting, ordinateur 1440×900** : arrive sur un grand titre « The Book » ; 4 cartes visibles, coupées
par le bandeau des cookies (78 px) et la bulle WhatsApp ; la recherche est rapide et intelligente mais il faut
deviner le vocabulaire ; aucune mensuration sur les cartes ; la fiche est complète et belle (mesures, à propos,
parcours, book 11 photos, compcard en 1 s) ; « Ma sélection » est une liste de noms sans mensurations, impossible à
envoyer à son client ; la demande de booking ne demande ni durée, ni lieu, ni usage. Verdict : **suffisant pour un
premier contact, pas pour un vrai booking.**

**Styliste, tablette 800×1200** : mêmes résultats de recherche (16/16 identiques) ; bouton « + » de 28 px difficile
à toucher ; barre du bas « ↓ Compcard » présente et utile ; compcard JPEG 0,79 s. Le formulaire est utilisable,
mais la civilité est obligatoire alors que le nom de l'entreprise ne l'est pas — un professionnel attend l'inverse.

---

## 7. Performance — voir A3-09 (tableau) et A3-16 (poids des programmes).

## 8. Images et médias
- Les cartes du Book utilisent des miniatures WebP 800 px (`…-n800-w.webp`), la fiche une version moyenne ; la
  première photo est annoncée (`<link rel="preload">`) — `middleware.js:680-690`.
- Compcard PDF : 2,1 Mo (lourde pour un envoi WhatsApp ; une version « légère » serait utile aux recruteurs).

## 9. Responsive
- Aucun débordement observé sur 1440×900 et 800×1200 ; sur ordinateur, éléments fixes en bas (cookies 78 px +
  WhatsApp 56 px) masquent la première rangée de cartes et le formulaire (captures 01 et 04).

## 10. Code et architecture (mesures)

| Mesure | Valeur |
|---|---|
| Fichiers JS (hors bibliothèques) | 162 fichiers, 38 188 lignes (dont `app.js` 3 784, `espace-mannequin.js` 1 821, `middleware.js` 1 261) |
| Fonctions déclarées | 1 506 (1 312 noms) ; 5 jamais appelées (A3-14) ; 94 noms réutilisés (souvent des fonctions locales, normal) |
| Fichiers JS jamais chargés | 0 |
| SQL | 57 fichiers, 15 990 lignes, 340 fonctions `security definer` (chemin de recherche fixé partout, y compris par la boucle `supabase-extension.sql:7318`), 31 fonctions redéfinies |
| Replis « SQL pas encore collé » | 12 dans 9 fichiers + 14 tests d'absence de fonction |
| Erreurs avalées | 102 catch vides, 130 `.catch` muets |
| SonarCloud (15/11) | 59 935 lignes, duplication 2,4 %, complexité 20 133, sécurité A, fiabilité E (fichier fantôme, A3-20), maintenabilité A |
| Serveur (`api/`) | 14 fichiers, 2 186 lignes ; début commun partagé (`debutRequete`), contrôles d'admin partagés (`adminVerifie`) : bon |

Architecture : une seule façon de dessiner chaque bloc, partagée serveur/navigateur (`js/rendu-*.js` importés par
`middleware.js:25-37`) — solide. Mais le dépôt mélange site, Administration, outils, maquettes, plans et rapports à la
racine (8 fichiers PLAN/PASSATION, 57 SQL) : difficile à reprendre par une autre personne (règle 7).

## 11. Sécurité (synthèse)
Hautes : A3-01, A3-02. Moyennes : A3-03, A3-04, A3-05, A3-06, A3-11. Basses : A3-12, A3-24. Rappel : le dépôt est
public (commentaire `api/_r2.js:103`, projet SonarCloud public) — **toute la sécurité repose sur la base (RLS,
déclencheurs) et sur `api/`**, jamais sur le secret du code. C'est pourquoi A3-02 et A3-10 comptent plus que A3-03.

## 12. SEO et accessibilité
- Fiches : titre, description, `og:` et données structurées `ProfilePage` posés par le serveur (`middleware.js:769-785`) ;
  plan du site fabriqué depuis la base (`/sitemap.xml`, `middleware.js:604-621`) — bon.
- Accessibilité : bouton « + » 28 px ; redessin de la grille = focus perdu (A3-18) ; `/candidature` CLS 0,24.

## 13. Infrastructure
- En-têtes complets (HSTS preload, CSP, COOP, CORP, nosniff), cache immuable sur les fichiers versionnés `?v=`.
- Pages remplies : `s-maxage=60` + mémoire de 3 min → une modification de l'Administration peut mettre jusqu'à
  ~4 min à apparaître (documenté).
- Tâche du matin unique (`vercel.json` crons) : bien protégée.

## 14. Risques
1. Prise de rôle par compte pré-créé (A3-01) le jour d'une invitation.
2. Profil publié sans contrôle de l'agence, éventuellement mineur (A3-02).
3. Retour en arrière involontaire d'une fonction de paiement en recollant un vieux fichier SQL (A3-10).
4. Publication des rapports d'audit sur le site lors de la fusion (A3-04).
5. Demandes de booking reçues sans mannequins (A3-07).

## 15. Recommandations et priorités de correction

| Priorité | ID | Action | Effort |
|---|---|---|---|
| P0 (avant toute fusion des rapports) | A3-04 | `.vercelignore` : `docs/`, `tests/`, notes internes | très faible |
| P1 | A3-01 | `demande_acces` : e-mail non confirmé + anti-robots ; `inviter` ne réattribue jamais un compte existant non accepté | faible, essai réel |
| P1 | A3-02 | déclencheur « colonnes réservées » (première publication, date de naissance) | faible, essai réel |
| P2 | A3-05, A3-06 | anti-robots strict ; supprimer le repli `service_role` | faible |
| P2 | A3-07 | liste des mannequins envoyée avec la demande, sélection revalidée | faible |
| P2 | A3-03, A3-11 | adresses décodées dans le filtre ; refus par défaut | faible |
| P3 | A3-10 | export du schéma réel + migrations numérotées | moyen |
| P3 | A3-09, A3-08 | The Book : LCP ; filtres pro, sélection partageable (décision de la propriétaire) | moyen |
| P4 | A3-12 à A3-24 | nettoyage, doublons, découpage d'`app.js`, CSP par empreintes | variable |

Points à faire vérifier par **l'agent testeur (accès réels)** : A3-02 (compte de test), A3-01 (création + invitation
d'une adresse de test), A3-11 (administrateur sans code de validation), A3-12 (variable `WHATSAPP_APP_SECRET`),
statistiques de l'Administration (§8).
