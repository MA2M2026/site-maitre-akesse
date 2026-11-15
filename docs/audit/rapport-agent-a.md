# Rapport d'audit — Agent A (mission MA2M, 15/11/2026)

> ⚠ **À lire avant toute fusion** : le dossier `docs/` est aujourd'hui **publié sur le site en ligne**
> (voir A-01). Ce rapport, ceux des autres agents et `COORDINATION.md` ne doivent **pas** arriver
> sur `main` tant que A-01 n'est pas corrigé, sinon la liste des failles devient publique.

## Résumé exécutif

Mon audit porte surtout sur le **code serveur** (`api/`, `middleware.js`), les **droits de la base**
(fichiers `supabase-*.sql`) et la **publication** (`vercel.json`, `.vercelignore`). C'est une
lecture seule : aucune écriture dans la base, aucun envoi sur `main`.

Limites honnêtes : depuis ma session, le shell ne peut pas joindre le site (proxy 403) et je n'ai
ni la base ni l'Administration. J'ai vérifié en ligne, avec l'outil Vercel, seulement les en-têtes
et deux documents. Je n'ai pas remesuré la vitesse : je m'appuie sur B et C pour ça.

Le socle de sécurité est sérieux : clé secrète gardée par le serveur, double authentification
exigée par la base elle-même, garde-fous sur la suppression et sur les photos, en-têtes HTTPS
complets, essais automatiques. **Deux points nouveaux sont importants** :

1. **A-01 (haute, confirmé en ligne)** : des documents internes de sécurité sont téléchargeables
   par n'importe qui (`/docs/rls-matrix.md`, `/docs/falsification.md`…).
2. **A-03 (haute, à confirmer par D)** : le rôle « Administrateur du site » reçoit, à chaque
   connexion complète, les droits de l'ancien tableau de bord (table `admins`). Or ces droits
   ouvrent les candidatures (contacts des parents) et les inscriptions (statut de paiement). C'est
   contraire à la règle de la propriétaire et à la décision écrite dans le SQL.

## Points forts (vérifiés dans le code)

| ID | Constat | Preuve |
|----|---------|--------|
| A-F1 | La clé secrète Supabase ne sert qu'au serveur ; le cookie d'accès est signé (HMAC) et comparé en temps constant | `api/_commun.js:192-215` |
| A-F2 | Double authentification exigée **par la base** : la table `admins` n'est lisible qu'avec `portail_mfa_ok()`, donc toutes les règles qui s'en servent l'exigent d'un coup ; le serveur fait le même contrôle (`aal2`) | `supabase-admins-aal2.sql:13-40`, `api/_commun.js:143-148` |
| A-F3 | Suppression : un compte administrateur ne peut jamais être supprimé par `api/supprimer-mannequin.js`, et la base injoignable = refus | `api/supprimer-mannequin.js:52-60` |
| A-F4 | Photos : dossier du mannequin imposé, chemin nettoyé, type et taille signés (recoupe C-F5) | `api/r2-presigner.js:42-61` |
| A-F5 | Espace Paiements cloisonné par rôle (`portail_peut('paiements')`), réglages réservés au principal | `supabase-administration.sql:754-760`, `supabase-moyens-paiement.sql:32-34` |
| A-F6 | Tâche du matin protégée par `CRON_SECRET` ; webhook des notifications protégé par un secret comparé en temps constant ; webhook WhatsApp vérifie la signature de Meta quand le secret est posé | `api/portail.js:201-203`, `api/notifications-webhook.js:158-159`, `api/whatsapp-webhook.js:95-97` |
| A-F7 | En-têtes en ligne complets : HSTS preload, X-Frame-Options, nosniff, Permissions-Policy, COOP/CORP (recoupe B-F5) | réponse en ligne du 15/11 23:00 |
| A-F8 | Code propre à la syntaxe : `node --check` sans erreur sur `api/`, `js/`, `js/admin/`, `middleware.js` ; aucun fichier JS ou CSS orphelin ; aucun `console.log` | essai local |
| A-F9 | Filet de sécurité réel : 138 fichiers d'essais « visiteur », essais automatiques sur GitHub (`essais.yml`, `verifier-csp.yml`), sauvegarde de la base chaque semaine | `scripts/tests-visiteur/`, `.github/workflows/` |
| A-F10 | Fichiers SQL, scripts, maquettes, plans et `outils/` déjà exclus de la publication | `.vercelignore` |

## Problèmes

Gravité : critique / haute / moyenne / basse. « Confirmé » = vu en ligne ou prouvé par le code ;
« à confirmer » = dépend de l'état réel de la base ou de Vercel, que je ne vois pas.

### A-01 — Documents internes de sécurité publiés sur le site — **HAUTE, confirmé en ligne**
- **Lieu** : `.vercelignore` (manque `docs/`, `DECISIONS.md`, `CONVENTIONS.md`, `AGENTS.md`,
  `GUIDE-DE-SECOURS.md`, `README.md`, `tests/`, et bientôt `COORDINATION.md`, `docs/audit/`).
- **Preuve** : `https://www.maitreakessemodelmanagement.com/docs/rls-matrix.md` et
  `/docs/falsification.md` répondent 200 avec le texte complet (15/11/2026, 23:00).
- **Cause** : la liste d'exclusion a été faite le 04/10, avant la création de `docs/`.
- **Conséquence** : un attaquant lit la carte des droits de la base, les noms des fonctions
  sensibles et la procédure de réaction. Nos rapports d'audit seraient publiés de la même façon.
- **Solution** : ajouter ces chemins à `.vercelignore` (aucun n'est utilisé par une page).
- **Risque de régression** : très faible ; vérifier que `sitemap.xml` et les pages n'y renvoient pas.
- **Vérification** : après mise en ligne, les deux adresses répondent 404.

### A-02 — 230 Mo de vidéos jamais utilisées publiées — **basse, probable**
- **Lieu** : `assets/reseaux/*.mp4` (8 fichiers de 16 à 50 Mo), absent de `.vercelignore`.
- **Preuve** : aucune page, aucun script ni CSS ne cite ces fichiers (recherche dans le dépôt).
  Je ne les ai pas téléchargés, pour ne pas consommer la bande passante.
- **Conséquence** : chaque mise en ligne envoie 230 Mo de plus ; un lien partagé consomme le quota
  gratuit de Vercel.
- **Solution** : les exclure (`assets/reseaux/`) ou les ranger dans `outils/`.
- **Vérification** : la mise en ligne suivante est plus légère et l'adresse répond 404.

### A-03 — Le rôle « Administrateur du site » reçoit les droits de l'ancien tableau de bord — **HAUTE, à confirmer par D**
- **Lieu** : `supabase-appareil-confiance.sql:133` et `supabase-administration.sql:205`
  (`portail_enregistrer_appareil`).
- **Cause** : `if portail_role() in ('principal', 'site') then insert into admins …`, à chaque
  connexion complète. Pourtant le même fichier dit (`supabase-administration.sql:540-543`) :
  « un compte Administrateur du site ne doit pas voir [les inscriptions et les paiements] ». Le
  commentaire de `api/portail.js` (ligne 414) parle d'un déclencheur `staff_suivre_admins`
  qui est **supprimé** (`drop trigger`, ligne 544).
- **Conséquence** : la table `admins` ouvre `casting_applications` (dont `parent_telephone`,
  `parent_email`), `inscriptions_mannequins` (statut de paiement), `messages_contact`,
  `page_views`, ainsi que `api/supprimer-mannequin.js` (suppression d'un compte de mannequin).
  Règle de la propriétaire : « l'administrateur du site ne doit pas voir les contacts privés des
  mannequins et des parents » et n'a « aucune donnée financière ».
- **Lié** : `cours_talons_valider` (`supabase-cours-talons.sql`) autorise `portail_peut('site')` à
  valider un paiement et à créer une recette en comptabilité. Est-ce voulu ? **Question pour la
  propriétaire.**
- **Solution proposée** (à discuter à quatre) : retirer `'site'` de cette ligne ; donner au rôle
  « site » ses propres règles (contenu du site, sans colonnes de contact ni d'argent).
- **Risque de régression** : moyen. Des rubriques de l'Administration « site » qui s'appuient sur
  `admins` pourraient se vider ; à lister avant.
- **Vérification** : D, avec le compte d'essai « site », ouvre Candidatures et Inscriptions et note
  ce qu'il voit. B ou C lancent en lecture `select s.role from admins a join staff_profiles s using (user_id);`.

### A-04 — Jetons secrets des liens personnels copiés dans le journal des erreurs — **moyenne, prouvé par le code**
- **Lieu** : `js/surveillance.js:128` (`page: location.pathname + location.search …`).
- **Cause** : sur `accord-parent.html?j=…`, `recu.html?r=…` ou `confirmer.html?c=…`, le jeton est
  dans l'adresse. À la moindre erreur sur la page, il part en clair dans `journal_erreurs`.
- **Conséquence** : toute personne qui lit le journal (agence) peut rouvrir le lien, par exemple
  donner l'accord parental à la place du parent.
- **Solution** : n'enregistrer que `location.pathname`, ou masquer les paramètres `j`, `r`, `c`
  et `t`.
- **Risque** : nul pour les visiteurs. Vérification : un essai qui provoque une erreur sur
  `recu.html?r=test`, puis on lit la ligne enregistrée (base simulée).

### A-05 — 5 pages sensibles sans règle stricte des scripts — **moyenne, confirmé** (= C-P1, B-P4)
- `accord-parent`, `recu`, `confirmer`, `places`, `programme-talons` n'ont pas de balise CSP par
  empreintes. Elles n'ont **aucun script en ligne** : on peut donc leur donner la même règle que
  les 35 autres pages, sans empreinte à calculer.

### A-06 — Verrous qui s'ouvrent si une pièce manque — **moyenne, à confirmer en base et sur Vercel**
- `api/_commun.js:140` : si la fonction `portail_admin_ok` n'existe pas en base (404), le contrôle
  de l'appareil est **considéré comme bon**. À vérifier : fonction bien présente (Extension 158) ?
- `api/whatsapp-webhook.js:95` : sans `WHATSAPP_APP_SECRET`, les messages non signés sont acceptés
  (seul contrôle : l'identifiant du compte, qui est public). À vérifier : la variable est-elle
  posée sur Vercel ?
- `middleware.js:77` (clé absente → les scripts réservés passent) et `api/_commun.js:237`
  (compteur en panne → pas de limite) : choix volontaires, à garder mais à noter.
- **Solution** : si tout est en place, rendre `portail_admin_ok` obligatoire (refus si 404).

### A-07 — Anti-robots non bloquant — **basse/moyenne, confirmé** (= B-P5)
- `api/portail.js:294` : `ANTI_ROBOTS_STRICT = false`. Je confirme B-P5. Il ne reste que les
  limites par adresse (6 à 3 envois par minute selon le formulaire).

### A-08 — Formulaires publics : le visiteur peut remplir des colonnes internes — **basse, prouvé par le code**
- **Lieu** : `formulaire_public_enregistrer` (`supabase-cours-talons.sql`, version la plus
  récente), `execute format('insert into %I (%s) …')`.
- **Cause** : toute colonne existante présente dans l'envoi est enregistrée. Seuls `status`
  (candidatures, recruteurs) et la liste de `cours_talons` sont contrôlés.
- **Conséquence** : un envoi fabriqué peut remplir par exemple `statut_change_at`, `created_at`
  ou toute colonne interne ajoutée plus tard (notes de l'agence…).
- **Solution** : une liste blanche de colonnes par formulaire. **À vérifier par B ou C** : liste
  réelle des colonnes de `casting_applications`, `recruiter_requests`, `messages_contact`.

### A-09 — Dépendance inutilisée — **basse, confirmé** (= C-P5)
- `@anthropic-ai/sdk` dans `package.json`, jamais chargé.

### A-10 — Messages d'erreur techniques renvoyés au navigateur — **basse**
- `api/supprimer-mannequin.js:89` (détail brut de Supabase), `api/portail.js` (fin du fichier,
  `e.message`), `api/r2-presigner.js:80`. Fuite d'informations mineure. Solution : message
  neutre pour l'écran, détail dans `journal_erreurs`.

## Recoupements avec B et C

- Confirmés par A : C-P1 = B-P4 (= A-05), B-P5 (= A-07), C-P5 (= A-09), C-F5 = B-F6 (= A-F4),
  B-F5 (= A-F7).
- Nouveaux (aucun autre agent) : **A-01, A-03, A-04, A-06, A-08**, A-02, A-10.

## Priorités de correction proposées

1. **A-01** (simple, sans risque, et nécessaire avant de fusionner nos rapports).
2. **A-03** après vérification par D, avec une décision de la propriétaire sur `cours_talons_valider`.
3. A-04 et A-05 (petits changements, gain réel).
4. A-06 (vérifications d'abord), puis A-08, A-07, A-02, A-09, A-10.
