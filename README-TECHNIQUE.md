# README-TECHNIQUE.md — Maître Akesse Model Management (MA2M)

> **19/10/2026 (après-midi) — Administration v2.4, étape 1 en construction** (cahier v2.3 + mise à
> jour v2.4 validée par la propriétaire, document confidentiel hors du dépôt). Adresse séparée
> **admin.maitreakessemodelmanagement.com** (même projet Vercel ; redirections par hôte dans
> `vercel.json` : `/` → `/admin/` sur l'adresse admin, `/admin/*` de www → adresse admin). Fichiers :
> `admin/` (page, manifeste `id: /admin/`, service worker limité à /admin/), `css/portail.css`,
> `js/portail/noyau.js` (connexion mot de passe + code TOTP, code à 4 chiffres par appareil,
> verrouillage 15 min, 8 h max, menu « ☰ Menu » < 860 px), `js/portail/securite.js` (comptes,
> délégations, appareils, journal), `js/portail/espace-compta.js` (espace 3,
> comptabilité), `api/portail.js` (invitations, codes de secours, « Créer un compte
> admin » de l'ancien tableau de bord via `api/_creer-admin.js` : 11 fonctions au plus).
> Base : `supabase-administration.sql` (comptes, appareils, codes, journal ; rejouable, n'efface
> rien), essais `bash scripts/base-essai/lancer.sh` ; essai visiteur `test-administration.js`.
>
> **Espace 1 (19/10/2026, cahier v2.4 3.1)** : la tuile « Administration du site » ouvre
> `tableau-de-bord.html` DANS l'Administration (manifeste `scope: /`, même session : aucune
> deuxième connexion). `js/mode-administration.js` (chargé en tête, avant supabase-config) s'active
> sur l'hôte `admin.` ou si l'Administration a été ouverte sur l'appareil (localStorage
> `ma2m_mode_administration`) : `<html data-portail>`, accès vérifié par `portail_moi` (espace
> site), verrouillage partagé `js/portail/inactivite.js` (15 min → retour à /admin/ pour le code à
> 4 chiffres, puis retour à la page via sessionStorage `ma2m_retour_administration`), contrôle
> toutes les 5 min (révocation, 8 h). Rubriques cachées (`HORS_ESPACE_1`) : inscriptions/paiements
> Wave (→ espace 2), code de validation, « Créer un compte admin », code permanent ; CSS
> `css/mode-administration.css`. Actualités, événements, partenaires : pages publiques en mode
> Administration (barre `.adm-barre`, sans en-tête du site). `api/acces-tableau.js` accepte un jeton
> `aal2` (code TOTP < 8 h) à la place du code de validation. Base : déclencheur
> `staff_suivre_admins` (rôle « site » ↔ table `admins`). Essai : fin de `test-administration.js`.
>
> Candidatures (cahier v2.4 3.2) : « En étude » s'affiche « À revoir » (valeur en base inchangée),
> « À revoir » et « En attente » rangés à part (`aPart` dans DOSSIERS.casting, « Toutes » les exclut).
> Code individuel (3.3) : `code_individuel_creer(candidature)` (personne retenue, un code libre à la
> fois, lié par `codes_inscription.candidature_id`) depuis la fiche ; `casting_direct_creer` (fiche
> minimale `type_candidature = 'direct'`, retenue, + code) dans « Codes d'inscription » ; plus de code
> libre. Les anciens codes sans nom encore disponibles seront annulés à la mise en ligne finale.
>
> **Espace 2, morceau 1 — registre (19/10/2026, cahier v2.4 5.1/5.5)** : `js/portail/espace-paiements.js`
> (registre, ajout, fiche). Base (section 6 de `supabase-administration.sql`) : `agence_mannequins`
> (comptes du site repris + déclencheur `registre_suivre_comptes` sur model_profiles, ajouts à la
> main) et `paiements_mannequins` (inscription/mensualité ; déclaré = orange, validé = vert, refusé
> avec motif ; jamais effacé, validé figé sauf principal avec code récent). RLS : `portail_peut('paiements')`
> seulement ; mensualité changée par le principal seul (`registre_garde_fous`).
>
> **Espace 2, morceaux 2-3 (19/10/2026)** : « Paiements à valider » (`paiement_decider` : valide ou
> refuse avec motif, d'un geste, l'inscription et son 1er mois ; e-mail EmailJS + lien WhatsApp ;
> parent si mineur). **Inscription simplifiée** (cahier v2.4 §4) : `inscription-mannequin.html` FR/EN
> = 4 écrans (`js/inscription-simplifiee.js`, `css/inscription-simplifiee.css`), serveur
> `api/code-protege.js` types `inscription-code` (code individuel + date de naissance →
> `inscription_code_lire`) et `inscription-payer` (`inscription_simplifiee_payer` : code consommé,
> mannequin au registre, 15 000 + 10 000 « déclarés », orange). L'ancien formulaire complet
> (`js/inscription-mannequin.js`, photos, référence Wave) est retiré.
>
> **Code de l'espace mannequin (cahier v2.4 §5.4)** : table `codes_espace` (une fois, 7 jours, un seul
> valable par mannequin) ; `code_espace_creer` depuis la fiche du registre (inscription validée, pas de
> compte) ; « Créer mon compte » (`api/code-protege.js` types portail/portail-creer-compte) vérifie
> `code_espace_valable` puis `code_espace_utiliser` (rattache le compte à sa fiche, recopie les
> informations, consomme le code). L'ancien code permanent (`check_invite_code`) n'est plus utilisé.
>
> **Mensualités (cahier v2.4 §5.6-5.7, choix du 19/10/2026)** : espace 2 « Mensualités du mois »
> (actifs cochés, `mensualites_appeler`, e-mail EmailJS + file WhatsApp), relances du 3 et du 5 :
> tâche planifiée Vercel (`vercel.json` « crons » → GET `/api/portail`, `mensualites_relances`,
> e-mail EmailJS côté serveur : variables `EMAILJS_PRIVATE_KEY` et, conseillé, `CRON_SECRET` ; sans
> clé, rien ne part et c'est noté au journal). **Jamais de relance à qui a envoyé sa preuve** (« J'ai
> payé » en attente de validation) : ni les relances automatiques (`mensualite_etat` = `attente`), ni le
> filtre « Pas encore payé » de « Messages et relances » (décision de la propriétaire, 22/10/2026). Textes communs : `js/messages-mensualites.js`
> (navigateur + serveur). Mannequin : `mes-paiements.html` (`mes_mensualites`, 24 mois,
> `mensualite_declarer`). Fiche du registre : mensualité reçue par l'agence (Wave hors site, espèces).
>
> **Branche `administration-v23` (19/10/2026, cahier V3)** — administration reprise sur une branche à part
> (rien de mis en ligne sans accord écrit de la propriétaire). ⚠️ *Historique : depuis le déménagement du 22/10/2026,
> `/admin/` ne charge plus `espace-site.js` ni `css/portail.css` (voir « 🏛️ Nouvelle Administration » ; ces fichiers
> partent à la démolition).* **Espace 1 dans le portail** : `js/portail/espace-site.js`
> affiche l'ancien tableau de bord dans un cadre de même origine (`/tableau-de-bord.html?cadre=1#cle`) ;
> `js/mode-administration.js` détecte le cadre (classe `cadre-admin`, relais d'activité pour la déconnexion
> à 15 min) ; `vercel.json` : `frame-src 'self'` seul changement de sécurité (accord écrit). **Espace 2** :
> `espace-paiements.js` (tableau du mois, matrice mannequins × mois, récapitulatif PDF/xlsx, messages et relances,
> codes de l'espace mannequin, paramètres = liens Wave, correction/annulation d'un paiement) et
> `espace-paiements-suivi.js` (rapprochement Wave, sorties et suspensions, mois figés). **Espace mannequin** :
> `mes-paiements.js` (24 mois, lien Wave des Paramètres, numéro du payeur, historique avec reçus) et
> `inscription-simplifiee.js` (numéro du payeur). SQL, à exécuter dans cet ordre, rejouable :
> `supabase-administration.sql`, `supabase-parametres.sql` (table `liens_wave`),
> `supabase-bloc2-complements.sql` (récapitulatifs figés, sorties, reçus REC-AAAA-NNNNN automatiques à la validation,
> rapprochements, modèles et historique des messages, réglages, clôture comptable, `lien_paiement`,
> `mensualite_declarer_avec_numero`, `inscription_payer_avec_numero`, `mes_recus`). Les pages gardent un repli
> tant que le SQL n'est pas exécuté (`api/code-protege.js` retombe sur l'ancienne fonction). Orange, MTN et Moov :
> non activés, il faut d'abord un compte comptable par opérateur (aujourd'hui tout ce qui n'est pas « espèces »
> va au compte Wave). Tests : `test-tableau-du-mois`, `test-matrice-mois`, `test-recapitulatif`,
> `test-messages`, `test-parametres`, `test-correction-paiement`, `test-codes-espace`, `test-suivi-paiements`, `test-mensualites`.
>
> **Espace 3, morceau A — recettes, dépenses, trésorerie (cahier v2.4 §6)** : `js/portail/espace-compta.js`
> (tableau du mois, recettes, dépenses avec justificatif, trésorerie). Base, section 10 :
> `compta_comptes` (Caisse et Wave créés d'office, solde de départ à une date), `compta_ecritures`
> (recette / dépense / virement ; rien ne s'efface ni ne se modifie : annulation avec motif, seul le
> justificatif s'ajoute après coup — déclencheur `compta_garde_fous`), `compta_soldes()`. Un paiement
> validé dans l'espace 2 devient tout seul une recette sans nom de mannequin (déclencheur
> `compta_depuis_espace2`, une seule fois par paiement ; « avant le nouveau système » exclu).
> Justificatifs : stockage privé `compta-justificatifs` (photo ou PDF, 10 Mo), lus par lien
> temporaire de 5 minutes. Droits : `portail_peut('compta')`. Essai visiteur : `test-comptabilite.js`.
>
> **Espace 3, morceau B — suivi (cahier v2.4 §6, points 5, 7, 8)** : `js/portail/espace-compta-suivi.js`
> (se sert des outils `P.compta` de espace-compta.js, chargé avant). « Ce qu'on nous doit » /
> « Ce qu'on doit » : `compta_dettes` (créance d'un client, dette envers un fournisseur ; réglée en
> une ou plusieurs fois par des écritures liées `dette_id` — la base refuse un règlement plus grand
> que le reste ou de mauvais sens ; annulation avec motif seulement sans règlement). Personnel et
> prestataires : dépenses « personnel » liées à `compta_tiers` (pas de calcul de paie). Matériel
> durable : `compta_materiel`, acheté par `compta_materiel_acheter()` (dépense « Matériel » + ligne
> d'inventaire ensemble) ; achat figé, sortie définitive avec motif, dépense non annulable tant que
> le matériel est à l'inventaire. Carnet : `compta_tiers` (jamais les mannequins).
>
> **Espace 3, morceaux C, D, E (cahier v2.4 §6)** — base section 11. **Documents**
> (`js/portail/espace-compta-documents.js`) : `compta_documents`, créés seulement par
> `compta_document_creer(p)` (numéro suivant de la série `compta_numeros` type/année/fiscal, pris
> dans la même transaction → aucun trou ; totaux et TVA calculés par la base ; préfixe `NF-` tant
> que le mode légal est éteint). Facture → somme due (`compta_dettes`) ; devis/proforma → « Facturer » ;
> avoir ≤ reste dû (réduit la somme due : `compta_dette_reste`, `compta_dettes_etat`) ; reçu d'une
> recette saisie ; une facture/un avoir ne s'annule jamais. PDF : `js/portail/compta-pdf.js`
> (pdf-lib `js/vendor/pdf-lib-1.17.1.min.js`, chargé au premier PDF). **Impôts** : `compta_impots`
> (échéancier, répétition mois/trimestre/année), `compta_impot_payer` → dépense « impots ».
> **Mode légal** : `compta_reglages` (une ligne : identité, TVA, interrupteur) — administrateur
> principal seulement, code récent exigé, définitif ; FNE : numéro saisi à la main par facture
> (`fne_reference`) en attendant le branchement DGI. **Dossier du mois**
> (`js/portail/espace-compta-dossier.js`) : Excel 11 feuilles (`js/portail/compta-xlsx.js`, .xlsx écrit
> sans outil extérieur) et PDF résumé + justificatifs (PDF ajoutés, photos mises en page, formats
> illisibles listés ; trésorerie du mois calculée par la base, `compta_tresorerie`). Relecture du
> 19/10/2026 : paiement de l'espace 2 corrigé/refusé après validation → ancienne recette annulée et
> remplacée ; toujours une caisse et un Wave actifs ; justificatif jamais remplacé ; un document ne
> se date ni dans le futur ni avant le dernier de sa série ; nouveau reçu possible après annulation.
> Essai visiteur : `test-comptabilite-documents.js` (relit l'Excel avec openpyxl
> et le PDF avec pypdf, installés par `lancer.sh` s'ils manquent).
>
> Codes de secours : affichés à la première activation de la double authentification, et
> refaits à la demande dans Sécurité › « Mes codes de secours » (code récent demandé ; les
> anciens sont annulés). Ajouté le 19/10/2026 : un compte dont la double authentification
> existait déjà avant le portail ne passait jamais par l'activation, donc n'en avait aucun.

> **19/10/2026 — Administration (/admin) retirée, retour à l'ancien tableau de bord** (décision de la
> propriétaire). Tout ce qui concernait le portail /admin, les paiements, la comptabilité et
> l'inscription par code a été supprimé du site ; `tableau-de-bord.html`, ses scripts, `middleware.js`,
> les fonctions `api/` et l'espace mannequin sont revenus à leur état du 18/10/2026 (commit fb01d1e),
> en gardant l'apparence actuelle du site (couleurs, boutons, lisibilité sur photo). Dans la base,
> le texte « retour-ancien-tableau-de-bord.sql » (donné à la propriétaire) efface les tables,
> fonctions et règles de l'Administration. Les sections ci-dessous qui parlent du portail sont
> historiques.


Documentation pour tout développeur (humain ou IA) qui reprendrait ce
projet.

**Pour la propriétaire du site : si tu n'arrives plus à te connecter à
cette session Claude Code (compte perdu, session expirée, etc.), tu peux
ouvrir Claude Code sur n'importe quel autre compte, lui donner accès à ce
même dépôt GitHub (`MA2M2026/site-maitre-akesse`) et lui demander de lire
ce fichier en entier avant de continuer.** Il contient tout ce dont un
nouvel assistant a besoin pour reprendre le travail sans rien perdre :
la liste de tous les services connectés au site (Supabase, Vercel,
Cloudflare R2, Resend, EmailJS, Google Analytics/Search Console, le
domaine chez Spaceship), la méthode de déploiement à suivre, les pièges
déjà rencontrés et corrigés (pour ne pas les refaire), et où se trouve
chaque fonctionnalité dans le code. Rien d'important n'est stocké
uniquement "dans la tête" de cette conversation — tout ce qui compte est
écrit ici, dans `SECURITY.md`, et dans les commentaires du code lui-même.
Ce fichier est mis à jour à chaque changement important : le relire en
cas de doute donne toujours l'état le plus récent.

**Page d'accueil du dépôt (13/10/2026, demande de la propriétaire)** : `README.md` affiche en
rouge, à toute personne ou IA qui ouvre le dépôt, l'obligation de lire `CLAUDE.md`,
`SECURITY.md` et ce fichier avant toute modification ; `AGENTS.md` dit la même chose aux
agents de code (Codex, Copilot, Cursor…). `GUIDE-DE-SECOURS.md` est le guide de la
propriétaire pour se débrouiller sans IA (version PDF imprimable remise le 13/10/2026).

## 💸 Payer les mannequins (Comptabilité, 22/10/2026, choix de la propriétaire : Wave d'abord)
« Rapport des cachets » (23/10/2026, `js/portail/espace-compta-cachets-rapport.js`, menu de la
Comptabilité) : cachets payés d'un mois ou d'une année (filtre sur `paye_le`), totaux (prestations,
commission = recette de l'agence, versé = dépense), par mannequin (photo) et détail ; PDF
(`P.comptaPdf`, mention « non fiscal » hors mode légal) et Excel (`P.xlsx`, feuilles « Par
mannequin » et « Détail »). Lecture seule. Essai : `test-rapport-cachets.js`.
Mineure payée sur le Wave de son parent (23/10/2026, `supabase-cachets-parent.sql`) : en
choisissant une mannequin mineure du registre, le formulaire annonce le versement au parent,
demande le nom du parent et met son numéro Wave ; `cachets_mannequins.parent_nom` garde à qui
l'argent est allé (« versé au parent » dans la liste, reçu WhatsApp envoyé à ce numéro). Un parent
manquant ou changé est enregistré par `cachet_enregistrer_parent` (Paiements ou Comptabilité
seulement) dans le registre et, si elle est inscrite, dans `contacts_parents` (sa fiche).
Essais : `test-cachets.js`, `scripts/base-essai/essais-cachets-parent.sql`.

Rubrique « Payer les mannequins » de l'espace 3 (`js/portail/espace-compta-cachets.js`, chargé dans
`/admin/`) ; base : **`supabase-cachets.sql`** (à exécuter une fois dans Supabase).
Un cachet = une personne (registre `agence_mannequins` ou personne extérieure : nom + numéro Wave),
un montant, une prestation (projet de l'agenda ou texte). « Marquer payé » appelle `cachet_payer` :
la dépense « Cachets reversés aux mannequins » (`compta_ecritures`) est créée et le cachet passe payé,
ensemble ; réservé à l'administrateur principal, avec un code récent (`P.sensible`). Rien ne s'efface
(annulation avec motif). **Envoi direct par Wave (Payout API) : pas encore branché** — il faut une
agence constituée et une clé Wave Business avec l'autorisation « Payout », déposée par la propriétaire
dans Vercel (jamais donnée à l'assistant). Le serveur appellera alors `POST /v1/payout` (clé
d'idempotence = id du cachet) puis `cachet_payer(..., 'wave_api')`. Test : `test-cachets.js`.

**Motif et reçu** (22/10/2026, demande de la propriétaire) : motif choisi dans une liste
(`cachets_mannequins.motif`, repris en tête du texte de la prestation) ; au paiement, la base donne
un numéro de reçu (`MA2M-CA-AAAA-NNNN`) ; « Envoyer le reçu sur WhatsApp » (message prêt, avec le
lien personnel) et « Voir le reçu » ouvrent **`recu.html?r=<jeton>`** (`js/recu.js`, `css/recu.css`,
sans compte : `cachet_recu_lire`, seulement un cachet payé, sans la commission) ; la mannequin
retrouve ses cachets payés dans « Mes paiements » de son Espace (`mes_cachets`, `js/mes-paiements.js`).
Outils communs (motifs, message, lien) : `js/cachets-communs.js`. Base : **`supabase-cachets-recus.sql`**
(à exécuter une fois). Essais : `test-cachets.js`, `test-recu.js`, `test-mensualites.js`.

**Commission de l'agence** (22/10/2026, choix de la propriétaire : « A et 1 ») : on saisit le montant
TOTAL de la prestation ; la base (`cachet_commission`, **`supabase-cachets-commission.sql`**, à
exécuter une fois) garde la commission au pourcentage unique `compta_reglages.commission_taux`
(20 % par défaut, réglé sur la page par l'administrateur principal) et calcule `montant` (à verser) ;
le pourcentage est gardé sur le cachet. « Marquer payé » enregistre alors DEUX écritures sur le
même compte : la recette de la prestation (catégorie « prestation ») et la dépense du cachet ; la
différence est la commission (accord de la propriétaire, 22/10/2026). Dépense du cachet annulée →
recette annulée avec elle et cachet de nouveau « à payer » ; la recette seule ne s'annule pas
(`cachet_depense_annulee`). Tant que ce SQL n'est pas exécuté, la page reste en
« montant à verser » (pas de calcul). La page montre aussi la photo de la mannequin (registre).

## 🛍️ Boutique « Marketplace » retirée (23/10/2026)

Décision de la propriétaire (22/10/2026) : « dissoudre le marketplace, on en créera une autre au
moment venu ». Retirés : `marketplace/*.html`, `js/marketplace-*.js`, `js/gabarit-boutique.js`,
`css/marketplace.css`, le lien « Marketplace » de l'en-tête (`js/menu.js`), l'image d'aperçu
`assets/apercus/fr-boutique.jpg`, la catégorie d'envoi « boutique » (`api/r2-site-images.js`),
`test-boutique.js`. Les anciennes adresses `/marketplace…` mènent à l'accueil (`vercel.json`).
**Rien n'est effacé dans la base** (tables `boutique_*`, commandes) ni dans le stockage des photos :
une future boutique pourra s'en servir. Les sections plus bas qui parlent de la boutique sont
historiques.

## 🏛️ Nouvelle Administration (chantier du 22/10/2026 ; à l'adresse `/admin/` depuis le déménagement)

Feu vert de la propriétaire : nouvelle Administration aux couleurs du site (papier, rouge,
visages des mannequins), mêmes données, mêmes comptes, mêmes envois. Plan, règles du chantier
et avancement : **`PLAN-NOUVELLE-ADMINISTRATION.md`** (à lire avant d'y toucher). **Déménagement**
(feu vert de la propriétaire, 22/10/2026) : `/admin/` ouvre la nouvelle Administration ;
l'adresse d'essai `/admin/nouvelle/` renvoie vers `/admin/` (`vercel.json`) ; service worker
`admin/sw.js` en `administration-v10` (liste INTERFACE = fichiers de la nouvelle page) ; signal
d'appui des boutons (`js/bouton-appui.js`) gardé, avec son style dans `css/admin-vivante.css`.
**Démolition de l'ancien tableau de bord** (23/10/2026, accord de la propriétaire) : retirés
`tableau-de-bord.html`, `js/tableau-de-bord.js`, `js/tableau-v2.js`, `js/connexion-tableau.js`,
`css/tableau-v2.css`, `css/tableau-boutons.css`, `js/mode-administration.js` et
`css/mode-administration.css` (le « mode administration » des pages Actualités, Événements,
Partenaires), `js/portail/espace-site.js`, `css/portail.css`, `INVENTAIRE-BLOC1.md`. Repris
ailleurs, sans perte : l'invitation « Activer les notifications » et la réinscription du
téléphone (`js/admin/notifications.js`, table `push_abonnements`, service de fond
`/service-worker.js` dont le toucher ouvre `/admin/#/site/…` ; adresses envoyées par
`api/notifications-webhook.js`), le rattrapage des anciennes photos du Book
(`rattraperPhotosEnArrierePlan`, maintenant dans `js/photos.js`, lancé 8 s après l'accueil par
`js/admin/coque.js`). `/tableau-de-bord(.html)` renvoie vers `/admin/` (`vercel.json`) ; les
liens « Voir le tableau de bord » des pages publiques mènent à l'Administration. `middleware.js`
ne protège plus que les scripts réservés (`test-tableau-protege.js`, réécrit). Essais transposés
dans l'Administration : `test-convocations.js`, `test-journal-fichier.js`,
`test-note-integration.js`, `test-photos-webp.js` ; retirés : `test-admin.js`,
`test-tableau-largeur.js`, `test-code-permanent.js`, la partie « espace 1 » de
`test-administration.js`. Restent côté serveur, sans page qui s'en serve : l'espace 'admin' de
`api/connexion-protegee.js` et `api/code-validation-protege.js` ; à décider avec la propriétaire :
la gestion de la boutique (`js/marketplace-gestion.js`) demandait le code validé dans l'ancien
tableau de bord (`ma2m_code_valide`).
**Boutons de la nouvelle Administration** (choix de la propriétaire, 22/10/2026) : rouge pour les
actions importantes, clair (ou noir) pour les autres ; la règle « tous les boutons rouges » du
18/10/2026 reste celle du site public. Les essais (`scripts/tests-visiteur/boutons.js`) vérifient
dans l'Administration que chaque bouton reste lisible (contraste ≥ 4,5) et ne déborde pas ; ils
ouvrent les formulaires repliés par « ＋ » (`ouvrirSaisies`) et la lisibilité attend la fin des
apparitions en fondu (`lisibilite.js`). `test-espace1-cadre.js` (tuile de l'ancienne entrée) est retiré.

- **Page** : `admin/index.html` ; décoration `css/admin-vivante.css` ; coque, accueil
  vivant, visages et retouches automatiques (tableaux en cartes sur téléphone, écrans partagés
  harmonisés) : `js/admin/coque.js` ; noyau commun au portail : `js/portail/noyau.js`.
- **Bloc 1 « Administration du site »** : menu `js/admin/site.js` ; chaque rubrique est une
  pièce `js/admin/site-*.js` (dossiers, projets, mannequins, pilotage, contenu, vitrine, agenda,
  vidéo, accès, erreurs…), chargée seulement après la clé d'accès (`/api/acces-tableau`).
  Protection : `middleware.js` (`SCRIPTS_NOUVELLE_ADMIN`, `/js/admin/:fichier*`) et
  `vercel.json` (pas de cache public).
- **Photos en médaillon dans les Paiements** (demande de la propriétaire, 22/10/2026) : le
  Tableau du mois et le Registre (`photosDe` / `avecVisage`, `js/portail/espace-paiements.js`) mettent la photo du Book
  devant le nom des mannequins inscrits sur le site (`agence_mannequins.user_id` = id du profil),
  les initiales sinon. Seulement dans la nouvelle Administration (`P.photosCouverture` et
  `P.visage` de `js/admin/coque.js` ; l'ancienne garde la liste sans photo). Style `.nom-visage`.
- **Écrans partagés entre les deux maisons** (jamais de copie) : l'écran est dans
  `js/<nom>-gabarit.js` (`window.GABARIT_*`), la logique dans un `window.demarrer…()` :
  convocations, messages groupés, agenda, vidéo de l'accueil, photos mises de côté, rapport des
  profils, fiches événement, erreurs du site (`js/erreurs-site.js`), note d'intégration
  (`js/note-integration.js`), nettoyage (`js/nettoyage-supabase.js`).
- **Outils partagés créés pour l'occasion** : `js/photos.js` (affichage des photos, sorti de
  `js/app.js`, chargé avant lui sur toutes les pages), `PUBLICATIONS`, `sauverPublication`,
  `effacerPublication` (`js/publications.js`), `js/partenaires-communs.js`,
  `lienWhatsAppCode` (`js/messages-candidats.js`), `allegerPhotoSite` et
  `pageAdministration()` (`js/app.js` : l'Administration n'est ni comptée comme visite ni
  dotée de la pastille WhatsApp publique).
- **Tests** : `test-nouvelle-admin*.js` (dans `lancer.sh`), données simulées
  `donnees-nouvelle-admin.js` ; tournée photographique pour les visites « patron d'agence » :
  `CAPTURES=dossier [ESPACE=paiements|compta] node scripts/tests-visiteur/tournee-nouvelle-admin.js`.
- **Piège des tests (22/10/2026)** : le petit serveur local doit être lancé avec
  `stdio: 'ignore'` ; sinon son journal non lu se remplit et il se fige (pages qui ne
  s'ouvrent plus, faux échecs).

## 🚪 Écran d'entrée de l'accueil (21/10/2026, validé par la propriétaire)
`index.html` et `en/index.html` chargent dans le `<head>` `js/ecran-entree.js` (SANS defer) et
`css/ecran-entree.css`. Une fois par visite (`sessionStorage` `ma2m_ecran_entree`) : animation
du logo (`assets/logo-intro-clair.png` découpé en 9 morceaux par `clip-path`, modèle Pinterest
choisi par la propriétaire, ≈ 3,7 s), puis « Bienvenue sur notre site » / « Welcome to our
website » en police manuscrite Allison (hébergée : `assets/polices/`, licence OFL à côté),
trois boutons en verre (Intégrer l'agence, Visiter le Book, Participer à un casting ; à
l'appui le bouton s'enfonce et son rond passe au vert) et un bouton rond « marche » « Entrer
sur le site » à longue ombre (modèle Pinterest ; il a remplacé le 21/10/2026 la jauge de 5 s, trop
courte pour lire et choisir : plus de compte à rebours, l'écran reste jusqu'au choix du visiteur). Le script pose aussitôt la classe `ee-actif` sur `<html>` : un voile du même fond
(CSS) cache l'accueil jusqu'à ce que l'écran soit construit (pas d'éclair). Mouvements réduits :
pas d'animation. Navigateurs automatisés (robots, tests) : pas d'écran, sauf
`localStorage.ma2m_test_ecran_entree = '1'` (test `test-ecran-entree.js`). Échap ou le bouton « Entrer »
ferment l'écran ; défilement de la page dessous bloqué (`verrouillerDefilement`). Aucune étape
d'historique (le bouton « retour » ramène d'où l'on vient). Maquette validée et vidéos : faites
dans la conversation du 21/10/2026.

## 🔘 En-tête : boutons ronds EN/FR et Menu ; plus de bandeau sur l'accueil (21/10/2026)
- Les boutons « EN/FR » et « Menu » de l'en-tête (toutes les pages, `js/gabarit.js`) reprennent le
  bouton rond « marche » à longue ombre de l'écran d'entrée (validé par la propriétaire). Ils
  portent `data-bouton-libre` pour sortir du bouton rouge commun (`css/bouton-ma2m.css`) ; style
  dans `css/charte-ma2m.css` (en `!important`, car `css/style.css` impose encore l'ancien bouton
  sombre à `.lang-switch`). À l'appui, `js/bouton-appui.js` pose `.rond-appuye` : le bouton
  s'enfonce et passe au vert. Le mot « Menu » reste lu par les lecteurs d'écran (caché à l'œil).
- Le bandeau défilant « Infos du jour » est retiré de l'accueil FR/EN (il surchargeait la
  nouvelle couverture). La rubrique « Bandeau d'information » est aussi retirée du tableau de bord et
  de l'Administration (21/10/2026) ; la table `bandeau_annonce` reste dans la base, inutilisée. Le bandeau de la boutique
  (`js/marketplace-vitrine.js`) n'est pas concerné.
- Essai : `test-ecran-entree.js` (plus de bandeau, boutons ronds, vert à l'appui, menu ouvert).
- Même bouton rond (classe `.lien-marche-rond`, style partagé avec l'en-tête) en haut de « Intégrer
  l'agence » et « Postuler à un casting » (FR/EN) : le lien vers l'autre formulaire est un
  `a.lien-marche` (bouton rond + libellé souligné) au lieu d'un lien perdu dans la phrase. Essai :
  `test-lien-marche.js`.

## 🔑 Retour des liens d'invitation et « mot de passe oublié » (21/10/2026)
La base (Supabase, « Redirect URLs ») n'accepte que les adresses du site principal : un lien qui
demandait à revenir sur `admin.…` retombait sur l'accueil public. Invitations (`api/portail.js`,
`RETOUR_ADMINISTRATION`) et « mot de passe oublié » (`js/portail/noyau.js`) reviennent donc par
`https://www.maitreakessemodelmanagement.com/admin/`, que `vercel.json` renvoie vers l'Administration en
gardant la clé du lien (le « # »). E-mail d'invitation en français : modèle « Invite user » de Supabase.
Essai : `test-retour-invitation.js`.

## 🖼️ Photos des mannequins partout dans l'Administration (23/10/2026)
Demande de la propriétaire : partout où le nom d'une mannequin est écrit, sa photo à côté ; quand
on doit la choisir ou l'ouvrir, c'est la photo (avec le nom) qu'on touche. Tout passe par
`js/admin/coque.js`, sans recopie :
- **liens vers une fiche** : un écran écrit seulement le lien du nom — `#/paiements/fiche/<registre>`,
  `#/site/b2-mannequins-publies/<profil>` ou `#/site/b2-candidatures/<candidature>` — et
  `visagesDesFiches` place la photo cliquable devant (photos cherchées par paquets, une fois) ;
- **emplacements** `data-visage-registre` / `data-visage-profil` / `data-visage-candidature`
  (+ `data-nom`) : la photo dans une case à cocher ou un titre (fiche Paiements, participants des
  Convocations, Messages groupés) ; `data-visage-nom` : un nom seul (tiers de la Comptabilité,
  bénéficiaire d'un cachet) — photo seulement si c'est une mannequin du registre ;
- **choisir une mannequin** : `P.choixVisages` (grille de médaillons + recherche, champ caché au
  même nom que l'ancienne liste déroulante) — « Mannequins suivis » (Paiements), « Qui ? » d'un
  cachet ; cases à cocher à photo `caseVisage` (`js/agenda-outils.js`) — Agenda, Convocations ;
- classement, mannequin à la une, fiches événement, accueil : photo et nom mènent à la fiche ;
  fiche d'une candidature : sa première photo devant le nom (`P.photosDossiers`).
Essai : `test-visages-partout.js` parcourt tous les écrans (et les fiches, panneaux et fenêtres
qui s'ouvrent ensuite) et échoue si un nom de mannequin est sans photo.

## 🏁 Places limitées (premier arrivé, premier servi — 23/10/2026)
- **Base** : `supabase-places.sql` (rejouable, après `supabase-convocations.sql`). `places_appels`
  (un par projet de l'agenda : `places_femmes`, `places_hommes`, `ouvert`) et `places_invitations`
  (une par mannequin : `sexe` — catégorie « homme » ou civilité « Monsieur », sinon femme —,
  `jeton` de 36 caractères, `statut` invite/pris/desiste, `pris_par` mannequin/parent,
  `envoye_le` / `parent_envoye_le`). Tables réservées aux `admins`. Fonctions :
  `places_preparer` (agence : une invitation par mannequin pas en sourdine, publiée dans le Book ou pas encore, du sexe
  concerné, rejouable ; un homme « new-faces » sans civilité est compté femme : remplir sa
  civilité),
  `places_lire`, `places_prendre`, `places_rendre` (public, par le jeton seul). `places_prendre`
  verrouille la ligne de l'appel (`for update`) : jamais plus de places prises que prévu, même
  avec des clics simultanés. Une place prise ajoute la mannequin à `agenda_projets.mannequin_ids`
  (donc à « Convoquer ») ; un désistement l'en retire, la note « absente » dans les convocations
  et annule ses envois programmés ; une place reprise ensuite défait cela (plus « absente »,
  rappel de la veille reprogrammé). Déclencheur `places_garder_selectionnees` : un formulaire
  (agenda, convocations) enregistré avec une liste ancienne garde les sélectionnées. La grille
  publique ne montre que la photo (miniature) d'une personne majeure au profil publié, sinon les
  initiales : jamais le visage d'un(e) mineur(e), le lien pouvant être transféré.
- **Administration** : rubrique « Places limitées » (`b2-places`, `js/admin/site-places.js`) :
  nouvel appel (projet de l'agenda ou nouveau projet, ajouté à l'agenda), fiche avec la grille
  des visages (cliquables vers la fiche), « 💬 Envoyer le lien suivant » un par un (mineure ET
  parent, même lien, `&p=1` pour le parent ; envoi noté dans la base), « 📣 Annoncer une place
  libre » après un désistement (suivi pour la session : `sessionStorage`
  « ma2m_places_libre_<projet> »), nombre de places, fermer/rouvrir, « Ajouter les nouvelles
  mannequins », « Convoquer les sélectionnées » (`window.convoquerProjet`). Ajouts du 23/10/2026
  (demande de la propriétaire après un essai) : « Qui reçoit le lien ? » (une case par
  mannequin ; décochée = statut `exclu` : aucun message, son lien ne montre rien et ne prend
  rien ; « Ajouter les nouvelles mannequins » ne la recoche pas), « 👁️ Voir le message » (aperçu
  sans rien envoyer ni noter), « 🗑️ Supprimer cet appel » (liens et places effacés, le projet
  reste dans l'agenda ; les personnes déjà sélectionnées restent dans le projet).
- **Page publique** : `places.html` + `js/places.js` + `css/places.css` (sans compte, `noindex` ;
  code commun avec `confirmer.html` dans `js/lien-public.js`) :
  « Je prends ma place » → « Bravo… » (vert) ou « Oups… plus de place disponible. Rendez-vous au
  prochain projet ! » ; parent : « Votre fille / votre fils a déjà pris sa place » ; « Me
  désister ». La grille se relit toute seule toutes les 15 s.
- **Textes** : `messagePlaces` dans `js/messages-convocations.js` (appel et place libérée).
- **Essais** : `test-places.js` (Administration + page publique, téléphone/ordinateur) et
  `scripts/base-essai/essais-places.sql` (droits, premier arrivé, mineure/parent, désistement).

## 📨 Convocations des projets de l'agenda (Extension 141, 21/10/2026)
- **Base** : `supabase-convocations.sql` (rejouable, à exécuter une fois dans Supabase). Colonnes
  d'`agenda_projets` : `heure_evenement`, `heure_convocation`, `deroule` (heure + activité),
  `a_prevoir`, `message_modele`, `rappel_veille`, `rappel_heure`. Tables (agence seulement, RLS
  `admins`) : `contacts_externes` (carnet des non-inscrits), `convocation_participants`
  (coordonnées recopiées ; `parent` pour un mineur), `convocation_envois` (un par participant ×
  canal × sorte convocation/rappel ; statuts programme/en_cours/envoye/echec/a_faire/annule).
  `agenda_public` ne lit aucune de ces colonnes.
- **Tableau de bord** : page à part « 📨 Convocations » (section `b2-convocations`,
  `js/convocations-page.js`, demande du 21/10/2026), vierge à l'ouverture : on choisit un projet
  À VENIR de l'agenda (les projets passés ne sont pas proposés) ou « Nouveau projet », qui est
  enregistré dans l'agenda (date passée refusée) ; puis heures, déroulé, « À prévoir », message,
  mannequins. Le panneau d'envoi `js/convocations-admin.js` (participants, carnet, aperçu, quand,
  suivi, réponses, « Ouvrir WhatsApp ») s'ouvre ensuite. Dans l'Agenda, « 📨 Convoquer » (projets
  à venir seulement) ouvre cette page avec le projet choisi (`convoquerProjet`). Outils partagés
  Agenda/Convocations : `js/agenda-outils.js` (cases à cocher, lignes à deux champs, déroulé,
  `afficherMessageFormulaire` : un `.form-msg` ne se voit qu'avec la classe `ok` ou `err`).
  Message de la page : `#cv-etat` (`cv-msg` est déjà pris par « Code de validation »).
  En haut, « 📋 Voir les réponses » (demande du 21/10/2026) : liste des projets ayant au moins
  une convocation non annulée (le plus récent d'abord), puis réponses du projet choisi, sans
  rien envoyer. Dessin partagé avec le panneau : `window.dessinerReponsesConvocation`
  (`js/convocations-admin.js`).
  Relance des personnes sans réponse (22/10/2026) : un seul bouton « 💬 Relancer la suivante (X
  restantes) », comme « Envoyer le WhatsApp suivant », et seulement pour celles dont la convocation
  est vraiment partie (statut `envoye`) ; relances faites retenues pour la session
  (`sessionStorage` « ma2m_relances_<projet> »).
  « Maintenant » : e-mails envoyés depuis le navigateur (EmailJS).
  « Annoncer la sélection » (23/10/2026, `supabase-convocations.sql` : sorte `selection` ajoutée à
  `convocation_envois`) : choix « Quel message envoyer ? » (`#convoc-sorte`) dans le panneau ; le
  premier message (`MODELE_SELECTION`, toujours ce modèle) ne donne que félicitations, projet,
  date, heure, lieu et le même lien personnel de confirmation ; pas de rappel avec lui. Le
  panneau propose la sélection tant que rien n'est parti, puis la convocation ; changer de message
  recoche ceux qui ne l'ont pas reçu. Réponses et relances comptent dès la sélection.
  Textes validés par la propriétaire le 23/10/2026 (accord féminin / masculin par la civilité,
  version parent) ; relance et rappel : `messageRelance`, `messageRappel`. « 🔔 Rappel à la
  suivante » (23/10/2026) dans la liste des confirmés, même fonctionnement que la relance
  (`ajouterTournee`, `sessionStorage` « ma2m_rappels_<projet> »).
  Rappel automatique avant l’événement (23/10/2026, ajouté à `supabase-convocations.sql`, à rejouer en entier ; plus aucun autre fichier ne redéfinit ses fonctions) :
  `agenda_projets.rappel_avant` (coché d'office), `rappel_avant_jours` (2 à 14, 3 par défaut),
  `rappel_avant_heure` (10:00) ; sorte d'envoi `rappel_avant`, programmée avec la convocation
  (`heureRappelAvant`), message = celui du bouton « 🔔 Rappel » (+ lien de confirmation pour qui
  n'a pas répondu) ; suit les changements de date (`convocation_suivre_projet`) ; aucun rappel
  (veille ou avant) à une personne « absente » (`convocations_a_traiter`). Le formulaire ne
  montre et n'enregistre ce réglage que si la base a la colonne (fichier SQL exécuté).
  Ligne de menu « Annoncer la sélection » (`b2-selection`, `js/admin/site-convocations.js`) :
  le même écran que « Convocations », titre changé et message de sélection imposé
  (`window.convocationSorteImposee`).
- **Agenda public** : plus aucun nom de mannequin (`js/agenda.js`, décision du 21/10/2026) ; les
  noms restent dans « Parcours MA2M » (médaillons).
- **Envois programmés** : `pg_cron` toutes les 5 min → `convocations_reveil()` appelle (seulement
  s'il y a un envoi dû, `pg_net`) `GET /api/portail?tache=convocations` avec la clé tirée au hasard
  dans `reglages_prives` (vérifiée par `convocations_cle_valide`). Le serveur prend les envois
  (`convocations_a_traiter`, une seule fois chacun), envoie les e-mails (EmailJS, clé Vercel
  `EMAILJS_PRIVATE_KEY`, 3 essais à 10 min, `convocations_resultat`), passe WhatsApp/SMS « à faire »
  et prévient l'agence par e-mail. Rappel de la veille à `rappel_heure` (Abidjan = UTC) ; il suit
  les changements de date, et un projet annulé annule ses envois (déclencheur).
- **Textes** : `js/messages-convocations.js` (navigateur + serveur), repères `{salutation}`,
  `{introduction}`, `{date}`, `{heure_evenement}`, `{lieu}`, `{adresse}`, `{convocation}`,
  `{programme}`, `{a_prevoir}` ; une ligne dont le repère est vide disparaît.
- **Essais** : `test-convocations.js` (tableau de bord, téléphone/ordinateur, sans Extension 141),
  `test-convocations-serveur.js` (serveur, faux EmailJS). Le SQL a été essayé sur un PostgreSQL
  local (droits, reprise, échecs, rappel, annulation).

## 🔤 Polices hébergées sur le site (21/10/2026)
Plus aucune page n'appelle Google Fonts : `css/polices.css` (chargée par toutes les pages) décrit
les polices du site (Cormorant Garamond, Jost, Montserrat, Big Shoulders Display, Work Sans,
Cinzel, Allison pour l'écran d'entrée), fichiers `assets/polices/*.woff2` venant de Fontsource
(npm `@fontsource/<police>`, sous-ensembles « latin » et « latin étendu », licence SIL OFL). Pour
ajouter une graisse : copier le bloc `@font-face` du fichier `<graisse>.css` du paquet et le
fichier woff2 correspondant. Raison : une feuille Google bloquante et un serveur de plus
(jusqu'à ~0,9 s sur téléphone d'après Lighthouse), et plus aucune adresse IP de visiteur
envoyée à Google pour les polices.

## ⚡ Chargement des pages (21/10/2026)
- Le programme Sentry (`js-de.sentry-cdn.com`) est chargé en `async` sur toutes les pages : il
  bloquait l'affichage (jusqu'à 0,8 s sur téléphone d'après Lighthouse). `js/surveillance.js`
  attrape de toute façon les erreurs dès le début.
- `<link rel="preconnect" href="https://dfhghgmwmxiguhtxtsle.supabase.co" crossorigin>` sur
  toutes les pages qui lisent la base (≈ 0,3 s gagnées sur la première demande).
- Mesure Lighthouse depuis l'environnement de travail (qui bloque photos Cloudflare, Sentry et
  Google : les notes « Bonnes pratiques » 96 y viennent de ces blocages) : accessibilité 100,
  référencement 100 ; vitesse accueil ordinateur 93, téléphone 70 (avant : 86 / 52).

## 📶 Journal des erreurs : vraies erreurs seulement (21/10/2026, décision de la propriétaire)
Les signalements 🟢 « connexion du visiteur » (page très lente, réseau coupé, script non
chargé, bascule des photos vers le relais…) ne sont plus listés comme des erreurs : une seule
ligne les compte (« N visiteurs avaient une connexion faible », bouton Effacer). Le journal ne
montre que 🔴 et 🟠. Une erreur de `js/erreurs-corrigees.js` qui se reproduit APRÈS sa date de
correction est mise en tête, avec « ⚠️ Revenue après la correction du … » (aussi dans le fichier
pour Claude). Test : `test-journal-fichier.js`.

## 🆕 REFONTE « MAGAZINE » EN COURS (choisie le 20/10/2026)
Le site public va prendre l'allure d'un magazine qu'on feuillette (« Magazine 3 » : papier beige,
rouge MA2M, pages qui s'empilent). Choix, étapes et état d'avancement : **`PLAN-REFONTE-MAGAZINE.md`** ;
maquette : `maquettes/accueil-magazine.html` (fichiers non publiés, voir `.vercelignore`).

## 🆕 REFONTE OCTOBRE 2026 (cahiers v2.3 « Administration » et « Architecture ») — À LIRE EN PREMIER

Travail fait sur la branche `claude/dossier-ma2m-btywwr` du 17 au 19/10/2026, mis en ligne **en une
seule fois** (décision de la propriétaire). Ce qui change par rapport aux sections plus bas :

### Charte claire, un seul bouton (remplace « Fond noir partout » du 06/10/2026)
- **Tout le site est clair** (fond `#F6F5F3`, cartes blanches, rouge `#C8102E`, police Montserrat),
  y compris l'écran d'introduction, l'en-tête, le menu plein écran, la grande image d'accueil et le
  pied de page. Les couleurs vivent dans **`css/jetons.css`** (seul endroit où elles sont écrites) ;
  **`css/charte-ma2m.css`** rebranche les anciennes variables (`--noir`, `--bordeaux`…) sur la charte
  et déclare les rares zones sombres (classe `.contexte-sombre` : étiquettes posées sur une photo).
- **Un seul bouton pour tout le site** : `css/bouton-ma2m.css`, chargé sur TOUTES les pages (site,
  boutique, espace mannequin, portail, ancien tableau de bord). Les règles sont dans une couche
  `@layer bouton-ma2m` avec `!important` : elles passent devant tout autre style, il est inutile de
  les recopier. Exceptions : `.cliquable` (photos), WhatsApp flottant, logos de réseaux, attribut
  `data-bouton-libre`. Les liens dans un texte et les lignes de menu ne sont PAS des boutons.
- **Signal d'appui** : `js/bouton-appui.js` (toutes les pages) — liseré blanc à l'appui, points
  « en cours » à l'envoi d'un formulaire. Le bouton « choisi » (filtre, onglet) garde un liseré blanc.
- Logos pour fond clair : `assets/logo-header-clair.png`, `assets/logo-intro-clair.png` (tirés des
  logos blancs, même géométrie : l'animation `js/faisceau.js` en dépend).
- Titres h1–h3 et libellés de formulaires sans capitales forcées (maquettes).
- L'espace mannequin n'a plus de `<style>` : tout est dans `css/espace-mannequin.css`.

### Portail d'administration `/admin/` (application installable, remplace le tableau de bord)
- `admin/index.html` + `admin/manifest.webmanifest` + `admin/sw.js` (portée `/admin/` seulement ;
  monter `VERSION` à chaque changement des fichiers listés ; logo propre `icons/admin-*.png`, noir sur
  fond blanc, pour ne pas confondre avec l'application du site au logo blanc sur noir).
  Copie de secours (22/10/2026) : seule la page (`/admin`, `/admin/`, `/admin/index.html`) est rangée
  sous la clé `/admin/` ; avant, tout fichier du dossier (le manifeste) la remplaçait et, réseau coupé,
  on voyait le texte JSON « comme du code » (essai : `test-admin-hors-ligne.js`, serveur arrêté).
  Fond du tableau de bord dans le cadre : clair dès le début (`html.cadre-admin`, css/mode-administration.css),
  plus de fond noir pendant le chargement (essai retiré au déménagement du 22/10/2026).
  Identifiant de l'application : `/admin/?application=administration-ma2m` (changé le 19/10/2026 : une
  tablette gardait en mémoire l'ancienne installation et refusait de réinstaller). Sur téléphone et
  tablette en vertical (< 860 px), le menu est caché derrière « ☰ Menu » et glisse depuis la gauche
  (`.barre-menu`, `.voile-menu`, classe `menu-ouvert` sur `<html>`, refermé à chaque changement de page). Scripts : `js/portail/noyau.js`
  (connexion, double authentification TOTP obligatoire, 8 codes de secours, appareils, 15 min
  d'inactivité / 8 h de session, actions sensibles ré-authentifiées), `espace-site.js`,
  `espace-paiements.js`, `espace-compta.js`, `securite.js`. Styles : `css/portail.css`.
- Fonction serveur multi-actions : `api/portail.js` (invitations, codes de secours, inscription par
  code, lien de paiement personnel…, et « Créer un compte admin » de l'ancien tableau de bord via
  `api/_creer-admin.js`). **Limite réelle : 11 fichiers `api/*.js` sans « _ » + `middleware.js`** —
  une 12e fonction fait échouer TOUTES les mises en ligne (05/10 et 19/10/2026) ; vérifié par
  `scripts/tests-visiteur/test-portail-serveur.js`.
- ⚠️ *Historique (jusqu'au déménagement du 22/10/2026) : depuis, `/admin/` charge `js/admin/site.js` et
  ses pièces `js/admin/site-*.js` ; `espace-site.js` n'est plus chargé (démolition à suivre).*
- **L'ancien tableau de bord n'existe plus seul** (19/10/2026) : `middleware.js` renvoie toute
  adresse `/tableau-de-bord(.html)` vers `/admin/`, sauf `?integre=1` chargé DANS un cadre
  (en-tête `Sec-Fetch-Dest: iframe`) et la lecture interne `?depuis=interne`. Ses rubriques
  s'ouvrent dans l'administration (menu « Administration du site », groupes Mannequins, Castings et
  contacts, Contenu du site, Maintenance) : `js/portail/espace-site.js` (tableau `RUBRIQUES`) affiche
  un cadre `/tableau-de-bord.html?depuis=portail&integre=1#<rubrique>` après avoir demandé la clé
  d'accès (`api/acces-tableau.js`, double authentification du portail obligatoire pour un compte du
  portail — l'ancien code de validation ne suffit plus, `api/code-validation-protege.js` ne donne
  plus la clé à un compte du portail). `js/tableau-integre.js` + `css/tableau-integre.css` retirent
  l'en-tête, le menu et le pied de l'ancien tableau de bord ; son minuteur d'inactivité est coupé
  (celui de l'administration suffit). `vercel.json` : `frame-src 'self'` (cadre du site lui-même).
  Notifications du téléphone → `/admin/#/site/…`. Boutique : la connexion de l'administration
  (aal2) vaut la « vérification de sécurité ».
- **Appareils** : le portail envoie l'identifiant de son appareil (en-tête `x-appareil`) à la base
  ET à `api/portail.js`, qui le transmet. Sans cet en-tête, `portail_role()` ne donne aucun rôle.
  Révoquer un appareil remplit `staff_profiles.sessions_valides_apres` : toutes les sessions de la
  personne ouvertes avant (code saisi avant, lu dans `amr`) cessent de servir, sur tous ses
  appareils ; elle se reconnecte avec mot de passe + code.
- **Rôle « site » et table `admins`** (droits de l'ancien tableau de bord) : tenus à jour par la
  base (déclencheur `staff_suivre_admins`) au changement de rôle ou à la coupure ; le compte
  principal n'est jamais touché. L'invitation refuse une personne déjà dans le portail (son rôle
  se change dans la liste) et refuse de s'inviter soi-même.
- **Pages publiques** (inscription par code, lien de paiement) : compteur d'essais par adresse
  (`ip:…`), tout refus compte, une réussite ne remet pas à zéro ; la date de naissance est vérifiée
  AVANT de dire si un code a servi ou expiré ; jamais le message brut de la base en cas de panne.
  Le lien Wave et les messages demandent le **reste dû** d'un mois payé en partie (la
  confirmation, elle, annonce le montant payé).
- **Deuxième relecture complète (19/10/2026)** :
  - `portail_valider_paiement(..., p_automatique => true)` est réservé au serveur
    (`est_ecriture_serveur()`) ; `journaliser` n'est plus appelable par les comptes connectés.
  - Inscription : la fiche du registre naît **« pré-inscrit »** à la déclaration « J'ai payé » (aucune
    mensualité), devient « actif » quand l'inscription est **entièrement** payée ; un acompte
    (espèces en plusieurs fois) ne crée ni « inscrite » ni code d'espace — un seul code, au solde.
  - Rattachement automatique d'un compte au registre (`registre_rattacher_compte`) : même téléphone
    **et** même date de naissance (le téléphone de l'espace est saisi par le mannequin, l'e-mail
    n'est pas vérifié) ; sinon c'est le code personnel ESP qui rattache.
  - Téléphone révoqué : la ligne `admins` de la personne est retirée (ancien tableau de bord fermé),
    rendue à la prochaine connexion complète au portail (`portail_enregistrer_appareil`, principal
    et rôle « site »). `api/acces-tableau.js` refuse aussi un compte du portail coupé ou dont les
    sessions ont été coupées (`ficheStaff`, `dernierCode` dans `api/_commun.js`).
  - `api/_creer-admin.js` (appelé par `api/portail.js`, action `creer_admin`) : une personne du portail autre que le principal ne crée pas de compte
    admin. Nouveaux codes de secours : code saisi il y a moins de 10 minutes.
  - Page d'inscription : « mineur » vient de la base (`candidat.mineur`, âge de majorité réglable).
- **Registre et messages (cahier 7.1 et 7.5, 19/10/2026)** :
  - Registre : « Mannequins de l'agence déjà sur le site » (fiches lues par `contacts_mannequins_admin`
    et `profils_prives`, colonnes privées non lisibles directement) → registre avec la mensualité du
    mois et l'espace relié ; import CSV (modèle téléchargeable) ; la nouvelle inscription payée en
    espèces (25 000) est dans un volet à part. Saisie, import et reprise passent par `ajouterAuRegistre`.
  - Messages : cases à cocher (tout le monde, inscrits, non inscrits, non payés, catégorie, groupe
    enregistré `message_groupes`), envoi groupé ou à une personne, aperçu, envoi planifié
    (`message_planifies`, préparé par la tâche de 6 h). `portail_message_selection` →
    `message_preparer_selection` : seulement les échéances encore à payer (jamais une relance à une
    personne à jour). Les e-mails de CET envoi partent aussitôt (`envoyerFile(filtre)`). Sans la
    fonction en base, l'écran retombe sur `portail_message_echeance`.
  - Codes : « Générer le code » seulement pour une candidature « Retenue » (refus aussi en base) ;
    quitter « Retenue » annule le code donné. Code de l'espace mannequin valable 7 jours.
  - Candidatures en groupes : À traiter, Retenues (par défaut), Inscrites, Refusées (archivées).
- **Lisibilité sur photo** : `scripts/tests-visiteur/test-lisibilite-photos.js` cache chaque texte posé
  sur une photo, capture le dessous et mesure le contraste pixel par pixel (photo sombre et à
  rayures, claire et toute blanche, toutes les pages publiques, téléphone et tablette ; `PAGES=index.html` pour
  aller vite) ; seuls les textes entièrement visibles sont mesurés (pas à moitié sous la barre du
  haut) ; une capture de chaque défaut va dans `captures/illisible-*.png`.
- « Mannequin à la une » et « Mot de Maître Akesse » (19/10/2026, demande de la propriétaire) : plus
  de voile blanc, photo nette, textes en blanc sur une ombre foncée limitée au bas de l'image
  (`css/charte-ma2m.css`).
- Rôles : principal, site (aucun montant ni contact privé), caisse (paiements), compta (totaux sans
  nom). Les droits sont dans la base (RLS + fonctions `portail_peut`, `portail_est_principal`).

### Base de données : `supabase-portail.sql` (Extension 140, rejouable)
- À coller en entier dans Supabase › SQL Editor (aucune suppression de données). Tables du portail,
  du registre (`agence_mannequins`), des échéances (`fee_dues`), déclarations, paiements, reçus,
  comptabilité, codes d'inscription (`registration_codes`), **codes personnels de l'espace
  mannequin (`espace_codes`)**, journal d'audit en écriture seule.
- Parcours d'inscription : candidature « Retenue » → code `MA2M-XXXX-XX` → 4 écrans
  (`inscription-mannequin.html`, `js/inscription-nouveau-source.js` + `js/inscription-nouveau.js`) →
  « J'ai payé » → rapprochement dans le portail → `portail_valider_paiement` (reçu REC-AAAA-NNNNN,
  2 lignes de recette, code consommé) **et code personnel de l'espace `ESP-XXXX-XX`** envoyé.
- **Inscription payée à l'agence (espèces…)** : portail › Paiements › Registre ›
  `portail_inscription_agence` (même résultat qu'en ligne, en un geste).
- **Création de l'espace mannequin avec le code personnel** : `api/code-protege.js`
  (`portail-creer-compte`) vérifie `espace_code_verifier`, crée le compte, puis
  `espace_code_utiliser` reprend le casting (informations + photos, cases vides seulement). L'ancien
  code commun reste accepté pendant la transition.
- « Mes paiements » (`mes-paiements.html`, `js/mes-paiements.js`) : bandeau, Payer avec Wave,
  J'ai payé, **calendrier de la formation** (`portail_reglages.duree_formation_mois`, 24 par défaut),
  historique, reçus. Lien personnel sans compte : `paiement/?t=…`.
- Tâche quotidienne `portail_tache_quotidienne` (pg_cron 06:00) : échéances du 1er, relances, Non payé.

### Tests
- `bash scripts/base-essai/lancer.sh` : base Postgres LOCALE jetable + tous les fichiers SQL +
  `scripts/base-essai/essais-portail.sql` (droits, paiements, codes, inscription à l'agence…).
- `bash scripts/tests-visiteur/lancer.sh` : ajoute `test-portail.js`, `test-inscription-code.js`,
  `test-mes-paiements.js`, `test-code-espace.js` et `test-visuel.js` (lisibilité WCAG AA de 42 pages
  FR/EN + espace connecté, **contrôle des boutons** `boutons.js`, pied de page vide, styles bloqués
  par la CSP, aucun lien Admin, captures dans `captures/`).

### Reste à faire (cahier « Architecture », après la mise en ligne)
- Chantier A : ~1 200 couleurs écrites en dur et ~730 `!important` dans les anciennes feuilles
  (`python3 scripts/compter-couleurs.py`) à remplacer par les jetons. Chantier E : 14 pages ont
  encore un `<style>`. Chantier F : découpage de `app.js`, `tableau-de-bord.js`,
  `espace-mannequin.js`. Page « guide de style ». Voir aussi `CONVENTIONS.md`.

## ⚠️ HISTORIQUE DU 27-28 SEPTEMBRE 2026 — architecture photos revue
## À LIRE avant de retoucher à R2, au domaine personnalisé ou à `vercel.json`

**Mise à jour du 13/10/2026 — photos des pages publiques servies directement par
Cloudflare, avec roue de secours.** Le quota Vercel « Fast Data Transfer » (100 Go/mois)
montait trop vite (25 Go) parce que chaque photo affichée passait par le relais
`/book-photos/`. Décision de la propriétaire : faire passer les photos par le domaine
personnalisé R2 `photos.maitreakessemodelmanagement.com` (trafic gratuit chez Cloudflare),
avec secours automatique, puis quitter le relais une fois le rodage réussi.

- Vérifié le 13/10/2026 : le domaine résout partout (IP Cloudflare), sert une vraie photo
  (validateur W3C : `image/jpeg`), SSL Labs B (TLS 1.0/1.1 encore acceptés : à monter à
  1.2 minimum dans Cloudflare → SSL/TLS → Certificats Edge, optionnel). Chez la
  propriétaire : ordinateur, tablette et téléphone en 4G OK ; téléphone sur sa box Orange
  CI : `ERR_CONNECTION_CLOSED` pendant quelques minutes, puis OK sans rien changer
  (cloudflare.com s'ouvrait, pas d'IPv6 sur la box). Cause non élucidée → secours obligatoire.
- **Rien ne change en base** : les adresses restent `https://www.…/book-photos/…`. Seul
  l'affichage est converti, dans `js/app.js` : `urlLegere()` (déjà utilisée par l'accueil,
  The Book, la fiche, Qui sommes-nous, Parcours) renvoie la copie WebP **sur
  `photos.maitreakessemodelmanagement.com`**. Retour arrière immédiat :
  `PHOTOS_DIRECTES_ACTIVES = false`.
- **Roue de secours** (`urlDeSecours`, `prechargerPhoto`, `passerAuRelais`) : une photo
  directe en échec essaie d'abord le JPEG au même endroit (copie WebP absente ≠ panne),
  puis la même photo par le relais ; le visiteur ne bascule que si elle s'affiche par le
  relais (une photo supprimée, absente des deux côtés, ne compte pas). Garde-fou contre le
  chargement sans fin (aucune erreur n'arrive dans ce cas) : 8 s après une photo directe
  préparée (ou un défilement), s'il en reste d'attendues à l'écran, petite sonde vers une
  adresse inexistante de Cloudflare ; réponse (404) en moins de 5 s = connexion lente, on
  patiente ; sinon une seconde sonde part par le relais et Cloudflare a encore 5 s ; ni Cloudflare ni le relais ne répondent = connexion
  faible du visiteur, on patiente aussi (passer par Vercel n'aiderait pas et consommerait son
  quota — 21/10/2026) ; seul « Cloudflare muet, relais qui répond » fait basculer
  (`cloudflareSeulMuet`, aussi utilisé par `js/video-accueil.js`). Après la bascule, le
  visiteur est mémorisé 1 h (12 h avant le 21/10/2026)
  (`localStorage` `ma2m_photos_relais`, lu une fois par page), toute photo directe ajoutée
  ensuite à la page repart par le relais (MutationObserver : filtres, Sélection…), et le
  basculement est noté UNE fois dans le journal des erreurs (catégorie `photos`) : c'est
  l'indicateur du rodage. `js/surveillance.js` ignore les échecs des photos directes (déjà
  rattrapés). La page Sélection repasse aussi ses photos gardées en mémoire par `urlLegere`.
- **Étendu le 13/10/2026 (2e lot, demande de la propriétaire : « tout ce qui est photo et
  vidéo transite par Cloudflare, Vercel reste l'hébergeur »)** : actualités (liste +
  galerie `js/publications.js`), événements, partenaires (page + accueil + agenda), photo
  du mot du responsable (accueil, Qui sommes-nous), boutique (`js/marketplace-vitrine.js`)
  passent aussi par `urlLegere`. **Vidéo de l'accueil** (`js/video-accueil.js`) : servie
  directement, avec le même secours : erreur → même vidéo par le relais, au même moment
  (tout le site ne bascule que si l'échec est arrivé AVANT toute donnée et que le relais
  marche ; une coupure en pleine lecture n'accuse pas Cloudflare) ; lecture bloquée plus de
  12 s → la vidéo seule passe par le relais ; rien après 10 s et sonde muette → bascule ;
  une bascule décidée par les photos (événement `ma2m:photos-relais`) fait suivre la vidéo.
  Galerie agrandie partagée (`ouvrirGalerieLightbox`) : `urlLegere` aussi ; pour cela, `vercel.json` autorise
  `https://photos.maitreakessemodelmanagement.com` dans `media-src` (ajout seul, accord
  écrit de la propriétaire le 13/10/2026). `sonderPhotosDirectes()` est partagée par les
  photos et la vidéo.
- Restent sur le relais (peu de trafic, ou contrainte) : tableau de bord, Espace mannequin,
  gestion de la boutique, compcard/CV (téléchargés par `fetch`, `connect-src` sans ce
  domaine), sauvegarde Google Drive (lit les adresses de la base, inchangées).
- Tests : `scripts/tests-visiteur/test-photos-directes.js` (Cloudflare OK, connexion
  coupée, Cloudflare muet, connexion lente, photo supprimée, WebP absent, Sélection,
  actualités, événements, partenaires, téléphone et ordinateur, FR/EN) et
  `test-video-accueil.js` (vidéo directe, Cloudflare coupé ou muet → relais).

**Nouvelle architecture (28 septembre 2026, nuit) : les photos passent
maintenant par le domaine du site lui-même, plus jamais directement par un
domaine Cloudflare.** Après l'échec du domaine personnalisé R2 (incident
détaillé ci-dessous), plutôt que de re-tenter un nouveau sous-domaine, le
choix a été de faire de Vercel un relais : le navigateur du visiteur ne
contacte jamais R2 ni `r2.dev` directement, il contacte uniquement
`www.maitreakessemodelmanagement.com`, qui va lui-même chercher la photo
côté serveur.

- **`vercel.json`** : ajout d'une règle `rewrites` — toute requête vers
  `/book-photos/:path*` est transmise (proxy serveur-à-serveur, invisible
  pour le visiteur) vers
  `https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev/:path*`.
- **Pourquoi ça règle le bug mobile** : le problème d'origine
  (`ERR_CONNECTION_ABORTED` sur Android/iPhone) semble spécifique à la
  façon dont les navigateurs MOBILES contactent le domaine partagé
  `r2.dev`. En passant par Vercel (un serveur, pas un téléphone), c'est
  Vercel qui contacte `r2.dev` — jamais l'appareil du visiteur — donc ce
  problème ne peut plus se produire, quel que soit l'appareil ou le réseau
  du visiteur.
- **Avantage supplémentaire** : plus besoin d'un domaine personnalisé
  séparé, donc plus aucun risque de DNS/propagation comme celui rencontré
  cette nuit avec `photos.maitreakessemodelmanagement.com`. Pas de
  changement de CSP nécessaire non plus : les photos étant désormais
  servies par le même domaine que le site (`img-src 'self'`), l'ancienne
  règle CSP autorisant `*.r2.dev` reste seulement utile pour les mises en
  ligne (upload direct par URL signée), pas pour l'affichage.
- **`R2_PUBLIC_URL`** (Vercel, projet `site-maitre-akesse-kiw2`) doit
  valoir `https://www.maitreakessemodelmanagement.com/book-photos` — plus
  jamais une adresse `r2.dev` ni `photos.maitreakessemodelmanagement.com`
  directement.
- **Point à surveiller** : ce relais fait transiter le trafic des photos
  par le quota Vercel ("Fast Data Transfer", 100 Go/mois gratuits, 1 To
  sur le plan Pro à 20 $/mois). Vérifier périodiquement Vercel → Usage →
  "Transfert de données rapide". Le 28 septembre 2026, le site utilisait
  2,1 Go/100 Go avant même d'ajouter les photos — large marge, mais à
  re-vérifier si le nombre de mannequins ou de visites augmente fortement.

**Ce qui reste vrai de l'ancien diagnostic (voir aussi plus bas, section
"Photos du Book sur Cloudflare R2") :** le domaine partagé `r2.dev` en
lui-même n'est toujours pas fiable pour un accès DIRECT depuis un
navigateur (raison pour laquelle il ne faut jamais redonner cette adresse
brute à un visiteur) — mais il reste parfaitement utilisable comme
destination d'un appel serveur-à-serveur, ce que fait justement ce relais
Vercel.

**Chronologie de l'incident, pour comprendre le contexte :**
1. DNS du domaine migré de Spaceship vers Cloudflare, domaine personnalisé
   R2 connecté et affiché "Actif", variable Vercel `R2_PUBLIC_URL` et les
   276 lignes de `model_photos` basculées vers le nouveau domaine
   (Extension 90). Tout semblait correct côté configuration.
2. Le nouveau domaine `photos.maitreakessemodelmanagement.com` s'est mis à
   répondre `DNS_PROBE_FINISHED_NXDOMAIN` pour la propriétaire ET des tiers
   sans lien avec elle, sur wifi ET 4G, sur plusieurs appareils —
   **alors que dnschecker.org (sondes US, type A et CNAME) montrait une
   résolution mondiale normale, en vert, vers des IP Cloudflare
   classiques**. Contradiction jamais élucidée pendant cette session.
3. Peu après, le SITE PRINCIPAL (`www.maitreakessemodelmanagement.com`,
   qui ne passe pourtant pas par R2 ni par le domaine personnalisé — DNS
   uniquement chez Cloudflare, pointant vers Vercel) a présenté le même
   genre de symptôme pour au moins un utilisateur iPhone ("Safari n'a pas
   pu ouvrir la page car le serveur ne répondait plus"), avec le même
   paradoxe (dnschecker.org vert partout). La propriétaire, elle,
   gardait un accès normal au site — donc portée exacte de ce
   second symptôme non confirmée (un seul utilisateur rapporté, pas
   vérifié comme généralisé).
4. Pistes vérifiées et écartées pendant le diagnostic : DNSSEC désactivé
   à la fois chez Cloudflare et chez Spaceship (donc pas de conflit de
   clés DNSSEC) ; pas de VPN/filtre DNS côté utilisateurs concernés ; pas
   un problème de cache navigateur (testé en navigation privée) ; pas un
   problème de box/routeur (reproduit aussi en 4G, sur un réseau
   totalement différent).
5. Décision prise avec la propriétaire : revenir en arrière plutôt que de
   continuer à chercher en pleine nuit. Exécution de l'Extension 91
   (inverse de l'Extension 90, remet `r2.dev` dans `model_photos`) +
   remise de `R2_PUBLIC_URL` sur `r2.dev` sur Vercel (projet
   `site-maitre-akesse-kiw2`) + redéploiement. Confirmé fonctionnel par la
   propriétaire après coup.

**Pour la suite (prochain assistant, ou reprise plus tard) :**
- **Le domaine personnalisé R2 (`photos.maitreakessemodelmanagement.com`)
  n'est plus le plan retenu.** Il reste techniquement en place côté
  Cloudflare (rien supprimé), mais le site ne l'utilise plus du tout — la
  solution adoptée est le relais Vercel décrit plus haut, qui évite
  complètement le problème de fond (un nouveau nom de domaine à faire
  reconnaître mondialement). Ne pas y revenir sans raison précise.
- Si jamais le relais Vercel montrait à son tour un problème inattendu, la
  piste du domaine personnalisé reste documentée ici en dernier recours,
  avec la contradiction jamais élucidée à garder en tête : résolution
  mondiale confirmée OK (dnschecker) mais `NXDOMAIN` réel pour la
  propriétaire et des tiers en Côte d'Ivoire, y compris sur le site
  principal (indépendant de R2) au même moment — donc peut-être pas un
  problème spécifique à R2, plutôt un souci propre à la zone Cloudflare de
  ce compte à ce moment-là. Pistes déjà écartées : DNSSEC (désactivé des
  deux côtés), VPN/filtre, cache navigateur, box/routeur. À noter : les
  "domaines personnalisés R2" de Cloudflare ont un historique documenté de
  bugs discrets (ex. un bug HTTP/3 fin août/début septembre 2026, réglé le
  3 septembre — donc pas la cause directe de notre incident du 27-28, mais
  ça montre que cette fonctionnalité précise mérite prudence).
- **Décision de la propriétaire (28 septembre 2026) : on reste sur le
  relais Vercel, on ne retente pas le domaine personnalisé R2 pour
  l'instant.** Revoir cette décision seulement si le relais Vercel pose
  un problème réel (fiabilité ou coût de bande passante), pas par
  précaution préventive.
- L'Extension 90 (SQL, bascule vers l'ancien domaine personnalisé) et
  l'Extension 91 (retour à `r2.dev`) restent toutes les deux dans
  l'historique (`supabase-extension.sql`) à titre de référence, mais
  aucune des deux ne doit être ré-exécutée : la bonne adresse actuelle
  pour `model_photos` est désormais
  `https://www.maitreakessemodelmanagement.com/book-photos/...` (voir
  Extension 92).

## 🖼️ Photos des mannequins : cadrage validé (29 septembre 2026)

- **Ronds de l'accueil, vignettes du Book, photo ronde de la fiche** :
  `object-position: center top` : on garde le haut de la photo (le visage).
- **Couverture de la fiche** : plein cadre sur tous les écrans, haut de la
  photo gardé quand elle est plus étroite que le cadre (tablette, ordinateur).
  Dôme d'ombre qui monte du bas. L'essai « photo entière sur fond flou » a été
  refusé par la propriétaire : ne pas le remettre.
- **Vérifier qu'une mise en ligne est bien en Production** : sur Vercel →
  Deployments, la ligne du commit de `main` doit porter l'étiquette
  « Production ». Le 29/09, une fusion n'a produit qu'un « Aperçu » (limite
  quotidienne probable) : il a fallu une nouvelle fusion pour relancer.

## 📐 « Affichage qui saute » (29 septembre 2026)

- Actualités / Événements (FR/EN) : la hauteur du bloc « À la une » est réservée
  par la classe `.une-reservee` (css/style.css), posée dans le HTML et retirée par
  js/app.js dès que le bloc est rempli, que le message « Aucune… » s'affiche, ou
  après 12 s. Choix de la propriétaire : une règle comprise par TOUS les
  navigateurs, y compris anciens (remplace la version `:empty:not(:has(...))` du
  même jour, ignorée par les navigateurs d'avant 2023).
- Reste à traiter si la propriétaire le souhaite : le même défaut sur l'accueil,
  quand le « Mot de Maître Akesse » apparaît.

## 📝 À faire plus tard (demandé par la propriétaire — à lui rappeler)

- **Nettoyer les anciennes copies de photos sur Supabase Storage** (noté le 28
  septembre 2026). Les outils « Migration des photos vers R2 » du tableau de bord
  ont COPIÉ les photos vers Cloudflare R2 sans les effacer de Supabase. Vérifié le
  28/09 : « Aucune photo à migrer — tout est déjà sur R2 » pour le Book ET pour
  les images du site. Les copies Supabase ne servent donc plus (aucune bande
  passante consommée, seulement de la place de stockage). Idée validée avec la
  propriétaire, à faire quand elle le demandera : un bouton « Nettoyer les
  anciennes copies sur Supabase » dans le tableau de bord, qui supprime
  uniquement dans les buckets `model-photos`, `actualites-images`,
  `evenements-images`, `partenaires-logos` les fichiers qu'AUCUNE fiche ne
  référence plus — sans jamais toucher `casting-applications` ni
  `inscriptions-photos` (anciennes photos de dossiers encore affichées).
- **Rendre le code de validation admin (2FA) obligatoire côté serveur** — voir
  la section « Audit complet du 28 septembre 2026 » en bas de ce fichier.

## Vue d'ensemble

Site statique (HTML / CSS / JavaScript, aucun framework, aucune étape de
build) pour une agence de mannequins à Abidjan. Aucun serveur applicatif :
Supabase joue le rôle de backend (base de données PostgreSQL,
authentification, stockage de fichiers), appelé directement depuis le
navigateur.

- **Hébergement** : Vercel, déployé automatiquement depuis GitHub (dépôt
  `MA2M2026/site-maitre-akesse`). Le propriétaire du site n'est pas
  développeur : il pousse les fichiers modifiés directement sur GitHub
  (interface web, pas de ligne de commande) et Vercel redéploie tout seul.
  **Ne jamais proposer de repasser au dépôt-par-zip sur Vercel** — c'était
  l'ancienne méthode, abandonnée.
- **Backend** : Supabase (projet `dfhghgmwmxiguhtxtsle`)
- **E-mails automatiques** : deux systèmes distincts, pour deux usages différents —
  ne jamais les confondre ni essayer d'en supprimer un au profit de l'autre :
  - **EmailJS** (`js/emailjs-config.js`) : notifie l'agence quand un visiteur
    remplit un formulaire (candidature, contact...). Site → agence.
  - **Resend**, branché comme fournisseur SMTP personnalisé dans Supabase
    (Authentication → Emails → SMTP Settings) : envoie les e-mails
    d'authentification de Supabase lui-même (réinitialisation de mot de passe,
    pour les mannequins comme pour l'admin). Sans lui, Supabase utilise son
    service gratuit interne, limité à quelques e-mails/heure pour tout le
    site — largement insuffisant, déjà rencontré en production. Le domaine
    `maitreakessemodelmanagement.com` est vérifié côté Resend (DKIM/SPF/DMARC,
    enregistrements DNS ajoutés chez Spaceship). Les adresses
    `.../tableau-de-bord.html` et `.../espace-mannequin.html` (en version
    normale ET en version "www.") doivent rester dans Supabase →
    Authentication → URL Configuration → Redirect URLs, sinon le lien de
    réinitialisation renvoie vers la page d'accueil au lieu du bon écran.
- **Domaine** : maitreakessemodelmanagement.com — bureau d'enregistrement
  (registrar) : Spaceship. **DNS géré par Cloudflare depuis fin septembre
  2026** (nameservers Cloudflare configurés chez Spaceship ; les
  enregistrements DNS eux-mêmes se gèrent désormais dans Cloudflare, plus
  chez Spaceship), condition nécessaire pour connecter le domaine
  personnalisé R2 (`photos.maitreakessemodelmanagement.com`, voir plus
  bas). Tous les enregistrements existants (Vercel, Resend/e-mail) ont été
  reportés en mode "DNS uniquement" (non proxié) dans Cloudflare pour ne
  rien changer à leur comportement.
- **Analytics** : Google Analytics (gtag.js, ID `G-1BX5MPZ6WE`), installé à
  l'identique sur les pages réelles du site. Depuis le 21/10/2026, le programme de Google
  n'est plus appelé dans le `<head>` des pages : `js/analytics-config.js` l'ajoute 1,5 s
  après le chargement complet de la page (au plus tard 4 s après l'arrivée) (sur connexion faible, il mettait jusqu'à 35 s et
  retardait tout ; les appels `gtag()` attendent dans `dataLayer`). Google Search Console est
  aussi vérifié (fichier `google5acb001b6b29c80f.html` à la racine — ne
  jamais le supprimer, c'est la preuve de propriété du site) et le
  sitemap (`sitemap.xml`) y est soumis.

## Tests « comme un visiteur » (07/10/2026) — à lancer avant chaque mise en ligne

`bash scripts/tests-visiteur/lancer.sh` (dossier non publié, voir `.vercelignore`).
`faux-serveur.js` remplace Supabase, EmailJS, Google Drive et les fonctions `/api/`
par des réponses simulées (rien n'est écrit pour de vrai) et note tout ce que le
site envoie. Parcours couverts : formulaire « Intégrer l'agence » (FR téléphone,
EN ordinateur) d'une mineure ; inscription mannequin avec code (FR/EN) ; tableau
de bord (connexion, liste des candidatures, fiche d'un mineur, changement de
statut, 1er message automatique, convocation, e-mail, Messages groupés). Ajouter
un parcours dès qu'une modification en touche un qui n'est pas couvert.

## Avant toute modification

1. Lire `SECURITY.md` en entier. Les règles qui y figurent ne sont pas
   optionnelles.
2. Toute modification touchant les droits d'accès (qui peut voir/modifier
   quoi) doit passer par une policy RLS dans `supabase-extension.sql`, pas
   uniquement par une condition JavaScript.
3. Ne jamais modifier `supabase-setup.sql` rétroactivement — ce fichier
   représente l'état initial. Toute évolution se fait en ajoutant une
   nouvelle "Extension N" à la fin de `supabase-extension.sql`, numérotée
   à la suite des précédentes, avec un commentaire expliquant son but.
4. **Le propriétaire du site n'est pas technique et n'a accès qu'à un
   téléphone.** Formuler les instructions de déploiement étape par étape,
   en évitant tout jargon non expliqué. Toujours préciser clairement :
   quel(s) fichier(s) remplacer, s'il y a du SQL à exécuter et dans quel
   ordre (le SQL passe toujours par Supabase → SQL Editor, indépendamment
   du dépôt des fichiers sur GitHub).
5. Avant d'affirmer qu'un correctif fonctionne, le vérifier en conditions
   réelles quand c'est possible (rendu live via un navigateur, pas
   seulement une relecture du code) — voir l'historique de ce projet : des
   bugs bloquants (inscriptions de mannequins impossibles) ont déjà été
   introduits par du code jamais vérifié en conditions réelles.
6. **Toute modification d'un script inline sur une page au CSP durci**
   (`index.html`/`en/index.html` notamment — repérable au commentaire
   d'avertissement juste avant le meta CSP) : lancer ensuite
   `python3 scripts/verifier-csp.py` avant de proposer le correctif comme
   fonctionnel. Sans ça, le script peut être bloqué en silence par le
   navigateur sans qu'aucune erreur ne le signale — voir la section
   "Porte d'entrée / verrou de scroll" plus bas pour l'incident qui a
   motivé ce garde-fou.

## Structure des fichiers

```
index.html                       Page d'accueil
services.html                     Présentation des services + valeurs
mannequins.html                    "The Book" — répertoire des mannequins
mannequin.html                      Fiche publique d'un mannequin (+ génération Compcard PDF)
actualites.html                      Actualités de l'agence (+ admin)
evenements.html                       "Nos Événements" — même architecture qu'actualites.html
                                        (bloc "à la une" + grille magazine + fiche modale avec
                                        galerie photo adaptative + admin), depuis fin septembre
                                        2026 — l'ancienne version (grille d'albums + page de
                                        détail séparée) a été entièrement remplacée à la demande
                                        du client, qui la trouvait moins belle qu'Actualités.
partenaires.html                      "Nos partenaires" (+ admin)
candidature.html                       Candidature casting (photos compressées, jamais publiées)
inscription-mannequin.html              Page d'inscription (redirige en pratique vers espace-mannequin.html)
espace-mannequin.html                    Espace personnel du mannequin (connexion, inscription par
                                           code d'invitation, mode guidé pour la 1ère publication,
                                           gestion du profil/projets/photos)
selection.html                            Sélection recruteur (localStorage + envoi par e-mail)
contact.html                               Formulaire de contact (enregistré en base)
tableau-de-bord.html                        Admin : statistiques, listes, modération, journal d'erreurs
reinitialiser-mot-de-passe.html            Page dédiée de "nouveau mot de passe" (lien reçu par e-mail)
mentions-legales.html / politique-confidentialite.html   Pages légales
google5acb001b6b29c80f.html                  Fichier de vérification Google Search Console — ne pas toucher

outils/carte-visite.html / qr-generateur.html / scannez-moi.html   Outils internes agence (cartes de visite, QR codes)

en/                                Version anglaise de chaque page publique (structure identique,
                                     PAS de version EN pour tableau-de-bord.html / espace-mannequin.html)

css/style.css                     Toutes les feuilles de style du site (fichier unique, ~1800 lignes)

js/app.js                          Fonctions partagées (voir plus bas), surveillance globale des
                                     erreurs, verrou de défilement (menu/modales), filet retour arrière
js/menu.js                          Ouverture/fermeture du menu plein écran
js/accueil.js (FR + EN)                Logique de la page d'accueil (porte d'entrée, carrousel hero,
                                        mannequin à la une, mot du fondateur, stats...)
js/mannequins.js (FR + EN)              Logique de "The Book" (filtres, sélection recruteur)
js/actualites.js                    Logique de la page Actualités (admin publication/édition inclus)
js/evenements.js                      Logique de la page Nos Événements (même schéma que
                                        js/actualites.js — champs date/lieu au lieu de
                                        catégorie/vidéo). Les versions en/ ont leur propre
                                        logique en script inline (comme en/actualites.html),
                                        pas ce fichier.
js/selection.js                      Logique de la page selection.html
js/app.js (fin du fichier)       Indicatifs téléphoniques et villes de Côte d’Ivoire (formulaires ; intégrés le 20/10/2026)
js/analytics-config.js               Initialise Google Analytics (dataLayer/gtag)
js/copyright-annee.js                 Remplit l'année du copyright dans le pied de page
js/supabase-config.js                 Connexion au projet Supabase (clé publique)
js/emailjs-config.js                   Connexion EmailJS (clé publique)

supabase-setup.sql                Schéma initial (tables, RLS de base) — ne jamais modifier
supabase-extension.sql              Toutes les évolutions, par "Extension N" numérotées et commentées
                                      — c'est ici qu'il faut regarder pour comprendre l'état actuel
                                      exact de la base (dernière extension = état le plus récent)

vercel.json                       En-têtes de sécurité HTTP (CSP, HSTS...) — inclut désormais les
                                    domaines Google Analytics dans le CSP
api/supprimer-mannequin.js          Fonction serveur Vercel (clé secrète Supabase) — supprime
                                      définitivement le compte de connexion d'un mannequin
api/r2-presigner.js                  Fonction serveur Vercel (clés R2) — URL signées pour
                                      envoyer/supprimer les photos du Book sur Cloudflare R2
api/_creer-admin.js                 (via api/portail.js, action creer_admin) (clé secrète Supabase) — crée un
                                      nouveau compte admin, réservé aux admins déjà connectés
package.json                     Dépendances npm des fonctions api/ (@aws-sdk/*) — Vercel les
                                   installe automatiquement, aucune étape manuelle
manifest.json / service-worker.js   PWA (installation sur écran d'accueil)
sitemap.xml / robots.txt             Référencement
assets/ , icons/                      Logos et icônes
```

## Fonctions JavaScript partagées à connaître

Définies dans `js/app.js`, chargées sur (presque) chaque page :

- **`echapperHtml(texte)`** — à utiliser systématiquement avant d'insérer
  une donnée saisie par un utilisateur dans le HTML, y compris dans un
  attribut (`src="${echapperHtml(url)}"`). Ne jamais insérer de donnée
  utilisateur brute dans un `innerHTML`.
- **`nomFichierSur(nom)`** — nettoie un nom de fichier avant de l'utiliser
  dans un chemin de stockage Supabase.
- **`ouvrirGalerieLightbox(urls, indexDepart)`** — ouvre le plein écran
  photo partagé (avec balayage tactile), réutilisé sur toutes les pages
  qui affichent des photos.
- **`convertirSiHeic(fichier)`** — convertit une photo iPhone (HEIC) en
  JPEG avant l'envoi, quand nécessaire. Depuis le 19/10/2026 dans
  `js/conversion-heic.js` (chargé juste avant `js/app.js` sur chaque page, et par
  l'Administration pour les justificatifs de la comptabilité).
- **`construireHtmlCv(donnees)`** — gabarit du "Model CV" (icônes, libellés
  de compétences, regroupement des expériences par catégorie), partagé
  entre l'aperçu personnel du mannequin (`espace-mannequin.html`, bouton
  "Voir mon CV") et l'outil admin du tableau de bord ("📄 Voir le CV" sur
  chaque mannequin publié, dans "Mannequins publiés — gérer les photos").
  Prend un objet de données simple (voir commentaire au-dessus de la
  fonction dans `js/app.js`) — chaque page construit cet objet à partir de
  sa propre source (état local pour le mannequin, requêtes Supabase directes
  pour l'admin) et affiche le résultat dans son propre conteneur `.cv-sheet`
  (styles CSS dupliqués dans les deux pages, qui ont chacune leur propre
  système de variables CSS — voir plus bas, "Durcissement CSP page par
  page"). Téléchargement en PDF via l'impression du navigateur
  (`window.print()`), pas de génération PDF côté serveur.
- **Surveillance globale des erreurs** (IIFE en tête de fichier) — capte
  silencieusement toute erreur JavaScript réelle (`error` et
  `unhandledrejection`) survenue chez un visiteur et l'enregistre dans la
  table `journal_erreurs` (voir plus bas). Ne capte **pas** les erreurs
  Supabase renvoyées normalement (`const { error } = await sb.from(...)`),
  seulement les exceptions non interceptées — pour ces erreurs "métier",
  chaque écran doit afficher lui-même un message clair incluant
  `error.message`.

⚠️ **Piège récurrent** : `js/supabase-config.js` définit
`const sb = (...) ? supabase.createClient(...) : null;` — si le CDN
Supabase ne charge pas (connexion mobile capricieuse), `sb` vaut `null`.
Tout code qui appelle `sb.xxx` sans avoir vérifié `if (!sb) return;` avant
provoque une exception non gérée. Plusieurs bugs de ce type ont déjà été
trouvés et corrigés dans ce projet — toujours vérifier ce garde-fou avant
d'ajouter un nouvel appel `sb.` en haut d'un script.

### Deux clients Supabase : `sb` (lecture publique) et `sbAdmin` (admin) — piège déjà rencontré

`js/supabase-config.js` définit **deux** clients, pas un seul :

- **`sb`** — utilisé pour toutes les lectures publiques (afficher les
  actualités, événements, partenaires, profils...). Sur les pages qui ne
  définissent pas `window.MA2M_SESSION_REQUISE = true` avant de charger ce
  script (actualités, événements, partenaires — pages publiques avec un
  panneau admin caché), `sb` est créé avec `persistSession: false` : il
  **ignore volontairement** toute session déjà connectée dans le
  navigateur, pour qu'une session périmée laissée par une connexion
  précédente au tableau de bord ne fasse jamais échouer les lectures
  publiques d'un simple visiteur (401 systématique — bug réel déjà
  rencontré, voir plus bas "profils invisibles").
- **`sbAdmin`** — utilisé UNIQUEMENT pour détecter qu'un admin est déjà
  connecté (`verifierAdmin()`) et pour les actions d'écriture admin
  (publier/modifier/supprimer une actualité, un événement, un partenaire).
  Sur ces mêmes pages publiques, `sbAdmin` est un second client créé avec
  `persistSession: true` : lui seul relit la session déjà posée dans le
  `localStorage` par une connexion faite depuis `tableau-de-bord.html`
  (même origine, même clé de stockage par défaut). Sur les pages qui
  définissent déjà `MA2M_SESSION_REQUISE = true` (`tableau-de-bord.html`,
  `espace-mannequin.html`), `sbAdmin` vaut simplement `sb` (même client,
  pas de doublon) puisque `sb` y persiste déjà la session normalement.

**Piège déjà rencontré (fin septembre 2026)** : un correctif du bug des
"profils invisibles" (voir plus bas) avait fait passer `sb` en
`persistSession: false` sur `actualites.html`/`evenements.html`/
`partenaires.html` sans introduire `sbAdmin` en remplacement pour les
usages admin — résultat, `verifierAdmin()` (qui appelait encore `sb.auth.
getUser()`) ne retrouvait plus jamais aucune session, même pour un admin
réellement connecté depuis le tableau de bord : le panneau de publication
et les boutons Modifier/Supprimer disparaissaient totalement, sans aucune
erreur visible (le `catch (e) {}` de `verifierAdmin()` avale l'échec en
silence, par design, pour ne jamais planter la page pour un visiteur
normal). **Règle à retenir** : toute lecture/écriture qui a besoin de
savoir si l'utilisateur est l'admin, ou d'agir en tant qu'admin, doit
utiliser `sbAdmin` — jamais `sb` — sur une page qui n'a pas
`MA2M_SESSION_REQUISE`. Les lectures purement publiques (visibles par
n'importe quel visiteur) continuent, elles, d'utiliser `sb`.

## Déploiement

1. Faire les modifications nécessaires aux fichiers concernés.
2. S'il y a des changements de base de données, les ajouter comme une
   nouvelle "Extension N" à la fin de `supabase-extension.sql`.
3. Donner au propriétaire du site, dans l'ordre où il doit les exécuter :
   - le SQL (à coller dans Supabase → SQL Editor → Run) — **toujours en
     premier**, c'est l'habitude prise ;
   - puis le(s) fichier(s) modifiés, à remplacer sur le dépôt GitHub
     `MA2M2026/site-maitre-akesse` (il les dépose via l'interface web de
     GitHub, pas en ligne de commande).
4. Vercel redéploie automatiquement dès que GitHub reçoit les fichiers —
   aucune action manuelle supplémentaire n'est nécessaire côté Vercel.
5. Toujours préciser explicitement le nombre exact de fichiers envoyés et
   ce qu'ils remplacent : le propriétaire du site tient une comptabilité
   stricte de ce qu'il a déployé et le vérifie à chaque fois.

## Variable d'environnement Vercel : `SUPABASE_SERVICE_ROLE_KEY`

Utilisée par `api/supprimer-mannequin.js`, ajoutée pour permettre à
l'agence de supprimer définitivement le profil ET le compte de connexion
d'un mannequin depuis le tableau de bord, par `api/r2-presigner.js`
(voir section suivante) pour vérifier qu'une demande d'envoi/suppression de
photo vient bien du mannequin propriétaire ou d'un admin, et par
`api/creer-admin.js` (bouton "Créer un compte admin", tableau de bord →
Bloc 3 → 3B — Sécurité & accès) pour créer un nouveau compte admin sans
passer par la manipulation manuelle dans Supabase (Authentication > Add
user, puis Table Editor > admins > Insert row) — réservé aux admins déjà
connectés (même contrôle que les deux fonctions précédentes), avec
annulation automatique du compte de connexion si l'ajout dans la table
`admins` échoue (jamais de compte orphelin sans rôle). Cette clé
**secrète** Supabase (jamais la clé publique déjà utilisée dans
`js/supabase-config.js`) ne doit jamais apparaître dans un fichier du
dépôt — elle se configure uniquement dans Vercel :

1. Sur Supabase : Project Settings → API → repérer la clé secrète /
   `service_role` (à ne jamais coller ailleurs que dans Vercel).
2. Sur Vercel : Project Settings → Environment Variables → ajouter
   `SUPABASE_SERVICE_ROLE_KEY` avec cette valeur, puis redéployer.

Sans cette variable, le bouton "🗑 Supprimer" du tableau de bord et l'envoi
de nouvelles photos échouent proprement (message d'erreur explicite), sans
jamais bloquer le reste du site.

## Photos du Book sur Cloudflare R2 (plus sur Supabase Storage)

Le plan gratuit Supabase limite la bande passante ("Cached Egress") à
5 Go/mois — dépassé deux fois (222%, puis 291%) à cause des photos du Book,
consultées en boucle par les visiteurs. Cloudflare R2 ne facture **aucune**
bande passante de sortie ; les photos du Book (bucket `model-photos` côté
DB, colonnes `model_photos.url` / `url_miniature` / `url_moyenne`
inchangées) y sont désormais envoyées à la place. Supabase reste utilisé
pour tout le reste (connexion, base de données) et pour les photos de
candidature/inscription (toujours vers Google Drive, sans rapport avec ce
quota — voir plus bas).

**Important — le quota n'était pas la seule cause des "profils invisibles" :**
deux bugs distincts, sans lien avec la bande passante, produisaient le même
symptôme (fiche mannequin vide) et ont été corrigés séparément :
1. `js/supabase-config.js` utilisait le nouveau format de clé Supabase
   (`sb_publishable_...`), rejeté par ce projet pour les appels REST directs
   (401 systématique) — remplacé par la clé "anon" historique (format JWT,
   récupérable dans Supabase → Settings → API → "Legacy anon, service_role
   API keys").
2. Extension 51 (verrouillage colonne par colonne pour `anon`, voir plus
   bas) n'avait jamais été mise à jour après l'ajout de la colonne
   `niveau_mannequin` à `model_profiles` — `mannequin.html`/`en/mannequin.html`
   la sélectionnent pour toute fiche individuelle, et PostgREST refuse la
   requête ENTIÈRE (401) dès qu'une seule colonne demandée n'a pas de droit
   de lecture pour `anon`, même si les autres colonnes sont autorisées. Le
   Book et l'accueil ne demandent pas cette colonne, d'où leur affichage
   normal pendant que les fiches individuelles échouaient (voir Extension 89).

**`api/r2-presigner.js`** — fonction serveur partagée par
`espace-mannequin.html` et `tableau-de-bord.html` : génère une URL R2
signée temporaire (5 minutes) pour un envoi (`PutObjectCommand`) ou une
suppression (`DeleteObjectCommand`), après avoir vérifié que l'appelant est
bien le mannequin propriétaire du dossier ciblé ou un admin — jamais les
clés R2 elles-mêmes côté navigateur. Utilise le SDK AWS officiel (R2 est
compatible S3), d'où le nouveau `package.json` du dépôt (`@aws-sdk/client-s3`,
`@aws-sdk/s3-request-presigner` — première fois que ce site a des
dépendances npm, Vercel les installe automatiquement au déploiement).

Variables d'environnement Vercel requises : `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
`R2_PUBLIC_URL` (Cloudflare → R2 → compartiment `ma2m-photos` → jeton API
de type Account, lecture/écriture, scopé à ce compartiment).

**`R2_PUBLIC_URL` = domaine personnalisé, jamais `r2.dev` (fin septembre
2026) :** `R2_PUBLIC_URL` pointait au départ vers l'URL publique de
développement de Cloudflare (`https://pub-<hash>.r2.dev`), activée en
urgence lors de la migration initiale depuis Supabase Storage. Cloudflare
documente explicitement ce domaine comme non destiné à la production, et
c'est la cause réelle trouvée d'un bug signalé début : les photos du Book
étaient invisibles pour TOUS les mannequins, mais seulement sur
navigateurs mobiles (Android ET iPhone, sur wifi comme en données
mobiles) — desktop et tablette n'étaient jamais concernés. Symptôme
navigateur : `ERR_CONNECTION_ABORTED`. Corrigé en migrant vers un domaine
personnalisé R2 dédié (`photos.maitreakessemodelmanagement.com`,
Cloudflare → R2 → compartiment `ma2m-photos` → Paramètres → Domaines
personnalisés), ce qui a nécessité au préalable de faire gérer le DNS du
domaine principal par Cloudflare (voir section suivante) — un domaine
personnalisé R2 exige que la zone DNS soit déjà chez Cloudflare. Après
connexion du domaine personnalisé, `R2_PUBLIC_URL` a été mis à jour vers
`https://photos.maitreakessemodelmanagement.com` sur Vercel (redéploiement
nécessaire pour prise en compte) et les URLs déjà enregistrées dans
`model_photos` (`url` / `url_miniature` / `url_moyenne`) ont été réécrites
en une fois via SQL (Extension 90). **Ne jamais repasser `R2_PUBLIC_URL`
sur une URL `r2.dev`**, même temporairement pour dépanner : le bug mobile
reviendrait.

**CORS obligatoire sur le compartiment R2** (Paramètres → Politique CORS),
sinon le navigateur ne peut pas envoyer directement vers l'URL signée :

```json
[
  {
    "AllowedOrigins": ["https://www.maitreakessemodelmanagement.com"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

**Migration des photos déjà en ligne** : outil admin dans le tableau de
bord ("☁️ Migration des photos vers R2", Bloc 3 → 3A) — télécharge chaque
photo encore hébergée sur Supabase Storage depuis le navigateur de l'admin,
la renvoie vers R2 au même chemin, puis met à jour la fiche. Relançable
sans risque (une photo déjà migrée est ignorée). Les nouveaux envois
passent déjà par R2 dès ce déploiement ; cet outil ne concerne que
l'historique.

## Images du site (actualités, événements, partenaires) sur R2 également (28 septembre 2026)

Même cause, même remède que pour les photos du Book ci-dessus, mais
découvert plus tard : les images des actualités (`actualites-images`), des
événements (`evenements-images`), des logos de partenaires
(`partenaires-logos`) et de la photo du mot du fondateur (également dans
`partenaires-logos`, chemin `responsable/...`) restaient hébergées
directement sur Supabase Storage. Chaque visite d'une page publique les
rechargeait depuis Supabase, consommant le même quota gratuit de bande
passante ("Cached Egress") — repéré cette fois via un avertissement de
facturation Supabase (organisation restreinte à partir du 15 octobre 2026,
quota à 293%).

**`api/r2-site-images.js`** — même principe que `api/r2-presigner.js`
(URL R2 signée temporaire, jamais les clés côté navigateur), mais réservé
aux admins uniquement (ces images n'appartiennent à aucun mannequin).
Catégories autorisées : `actualites`, `evenements`, `partenaires`,
`responsable`. Chaque chemin envoyé doit commencer par
`site/<categorie>/` — vérifié côté serveur avant toute opération.

**`js/app.js`** — trois fonctions partagées par toutes les pages
concernées :
- `envoyerImageSite(categorie, chemin, fichier)` : upload avec 3 tentatives
  (délai croissant) avant d'abandonner.
- `supprimerImageSite(categorie, chemin)` : suppression sur R2, échoue en
  silence (une image déjà supprimée ou introuvable ne doit jamais bloquer
  la suppression de la fiche qui la référence).
- `supprimerCheminsImagesSite(categorie, bucketSupabase, chemins)` :
  aiguille chaque chemin vers R2 ou vers l'ancien Supabase Storage selon
  qu'il commence par `site/<categorie>/` ou non — nécessaire pendant la
  période de transition où une même actualité/événement peut avoir des
  photos encore anciennes (Supabase) et des photos nouvelles (R2).

Toutes ces images sont servies via le même relais Vercel `/book-photos/`
déjà en place pour le Book (voir plus haut) — aucune nouvelle variable
Vercel, aucun nouveau réglage DNS ou CORS nécessaire, le compartiment R2
est le même (`ma2m-photos`), seul le préfixe de chemin change
(`site/<categorie>/...` au lieu de `<model_id>/...`).

**Migration des images déjà en ligne : faite.** Outil admin « ☁️ Migration
des images du site vers R2 » (tableau de bord, section Migration des photos
vers R2, PR #192) — lancé par la propriétaire le 28 septembre 2026, réponse
« Aucune image à migrer — tout est déjà sur R2 ». Rien à faire avant la
restriction Supabase du 15 octobre 2026.

### Méthode actuelle quand l'assistant IA a accès à git/GitHub (depuis fin
### septembre 2026) — à préférer à la méthode manuelle ci-dessus

Le propriétaire du site reste non-technique et ne passe jamais par la ligne
de commande — mais quand l'assistant IA a lui-même accès à git et à
l'API GitHub (`$GITHUB_TOKEN`), la méthode retenue avec lui est :

1. Toujours synchroniser sur `origin/main` d'abord, puis créer **une
   branche isolée par correctif/fonctionnalité** (jamais commiter
   directement sur `main`, jamais empiler plusieurs sujets différents sur
   la même branche/PR) — il tient à pouvoir tester et valider chaque
   changement indépendamment des autres.
2. Committer avec un message clair expliquant le POURQUOI (pas juste le
   quoi), pousser la branche, ouvrir une Pull Request via l'API GitHub.
3. **Vérifier le diff réel de la PR** (`GET /pulls/{n}/files`) — ne jamais
   se fier uniquement au message de commit.
4. Attendre/vérifier que le déploiement Vercel de la PR (preview) réussit
   (`GET /commits/{sha}/status`), puis donner au propriétaire le lien de la
   PR **et** le lien direct de l'aperçu Vercel (`https://<projet>-git-
   <branche>-<org>.vercel.app`, retrouvable dans les commentaires du bot
   Vercel sur la PR) pour qu'il teste avant de merger.
5. ~~C'est lui qui merge~~ — **changé le 28 septembre 2026** : la
   propriétaire demande désormais que l'assistant **merge et publie
   directement lui-même** une fois le travail terminé et l'aperçu Vercel
   au vert (squash merge), sans attendre son clic.
6. Après confirmation du merge, `git fetch`/`git merge --ff-only
   origin/main` pour resynchroniser la copie locale, et **vérifier
   concrètement** que le fichier mergé contient bien le changement
   (`git show origin/main:<fichier> | grep <repère>`), pas seulement se
   fier au message de fusion GitHub.

**Piège récurrent à connaître** : un lien d'aperçu Vercel de PR (`*-git-
<branche>-*.vercel.app`) reste **figé sur le dernier commit de cette
branche au moment du merge** — il ne se met JAMAIS à jour avec des
correctifs mergés séparément après coup, même sur `main`. Si le
propriétaire du site reteste sur un vieux lien d'aperçu après avoir dit
qu'un bug persiste, vérifier d'abord si ce lien correspond bien à la
dernière version de `main`, ou lui redonner le lien de production
(`maitreakessemodelmanagement.com`) pour un test fiable.

## Mode guidé pour les nouveaux mannequins

Colonne `model_profiles.premiere_publication_faite` (Extension 43). Tant
qu'une personne n'a jamais publié son profil avec succès une première
fois, seul le bouton final "Enregistrer mon profil" (bloc 5,
`form-publication`) est visible — les boutons d'enregistrement autonomes
des blocs 1 et 3 restent cachés, pour forcer à tout remplir en une fois
avant la première publication. Une fois la première publication réussie,
ces boutons réapparaissent définitivement (`appliquerModeGuide()` dans
`espace-mannequin.html`). Les blocs "Mes réalisations" (projets) et "Mes
photos" restent, eux, toujours autonomes (ajout/suppression possibles à
tout moment, même en mode guidé) — **il faut ajouter au moins un projet et
une photo avant de pouvoir publier**, la validation finale du bloc 5 le
vérifie.

## "New Face" et types de projet

Dans "Mes réalisations" (`espace-mannequin.html`), le champ "Type de projet"
inclut une option **"New Face"** destinée aux mannequins qui n'ont encore
aucune expérience réelle (défilé, shoot, pub, casting) — sans elle, un
débutant n'aurait aucun moyen de satisfaire l'exigence "au moins un projet"
requise pour publier son profil. Choisir "New Face" fait disparaître les
champs annexes (nom du projet, période, pays, ville, promoteur), qui n'ont
pas de sens dans ce cas. Une option "Autre" existe aussi, avec un champ
libre, pour tout type de projet non prévu dans la liste fixe.

## Mot de passe oublié (mannequins ET admin)

`sb.auth.resetPasswordForEmail()` est appelé depuis `tableau-de-bord.html`
(écran de connexion admin) et `espace-mannequin.html` (écran de connexion
mannequin), avec `redirectTo` pointant vers **`reinitialiser-mot-de-passe.html`**
— une page dédiée, à usage unique, séparée du tableau de bord et de l'espace
mannequin.

Ce choix vient d'un bug réel : quand le lien de récupération ramenait
l'utilisateur directement sur `tableau-de-bord.html`/`espace-mannequin.html`,
une course entre deux traitements asynchrones au démarrage de la page
(la reconnexion automatique habituelle vs. l'événement `PASSWORD_RECOVERY`,
qui attend une validation réseau du jeton) pouvait faire gagner la
reconnexion automatique et sauter complètement l'écran "nouveau mot de
passe". Plutôt que de continuer à rustiner cette logique de démarrage
partagée, `reinitialiser-mot-de-passe.html` n'a aucune autre logique au
chargement : elle détecte `type=recovery` directement dans l'URL (test
synchrone, sans attendre aucun appel réseau), affiche le formulaire de
nouveau mot de passe si présent, appelle `sb.auth.updateUser({ password })`
à la soumission, puis propose des liens vers le tableau de bord et l'espace
mannequin. Aucune course possible : rien d'autre ne dispute l'écran.

Dépend entièrement du SMTP personnalisé Resend (voir plus haut) et des
Redirect URLs Supabase correctement configurées.

## Miniatures des photos (consommation Supabase)

Le plan gratuit Supabase limite le "Cached Egress" (bande passante servie
aux visiteurs) à 5 Go/mois, renouvelés chaque mois — contrairement au
stockage réel des photos (1 Go), qui lui ne se remet jamais à zéro. Le book
public (`mannequins.html`) et la galerie de chaque fiche (`mannequin.html`)
affichaient jusqu'ici les photos en pleine résolution même en petite
vignette, ce qui a fait dépasser cette limite (222% constaté un mois).

Solution mise en place en deux temps :

1. **Extension 45** : chaque photo uploadée génère désormais, à côté de
   l'originale, une miniature légère (`model_photos.url_miniature` /
   `chemin_miniature`, ~500px, JPEG qualité 0.70) stockée dans un
   sous-dossier `miniatures/` du même dossier utilisateur. Utilisée
   uniquement pour l'affichage en grille (book public, galerie de la fiche).
   Un outil admin dans `tableau-de-bord.html` ("🖼️ Miniatures des photos")
   permet de rattraper les photos déjà en ligne qui n'ont pas encore de
   miniature ; ce rattrapage peut lui-même échouer si le quota mensuel est
   déjà dépassé (télécharger l'originale pour la réduire consomme de la
   bande passante) — dans ce cas, attendre le renouvellement du cycle
   (visible dans Supabase → Usage) avant de relancer l'outil.

2. **`compresserPhotoOrigine()`** (`espace-mannequin.html`) : contrairement
   à ce qui avait été décidé initialement (photos du book jamais
   compressées, pour préserver la qualité Compcard), l'originale elle-même
   est désormais compressée modérément à l'envoi — 2200px de côté maximum,
   JPEG qualité 0.85, uniquement si le fichier dépasse 900 Ko. Ce réglage
   reste supérieur à ce qu'il faut pour imprimer net à 400 DPI sur la plus
   grande case du Compcard (~2050px), donc aucune perte visible attendue,
   tout en réduisant nettement le poids de chaque photo (stockage ET bande
   passante) — resserré depuis 3000px/0.90 (un excédent bien au-delà du
   besoin réel d'impression) après un second dépassement de quota (291%).
   La version "moyenne" (grandes photos plein écran de l'accueil,
   `url_moyenne`/`chemin_moyenne`) est passée de 1600px/0.82 à 1400px/0.78
   pour la même raison. Ne s'applique qu'aux nouveaux envois — les photos
   déjà en ligne avant ce changement restent à leur poids d'origine (aucun
   rattrapage automatique prévu sur les originales, contrairement aux
   miniatures : modifier une originale déjà publiée est plus risqué qu'en
   ajouter une copie réduite à côté).

3. **`cacheControl` sur chaque upload Storage** : les photos ne changent
   jamais après leur envoi, mais étaient mises en cache seulement 1 heure
   (valeur par défaut de `supabase-js`) — un visiteur qui revient (même le
   jour même) retéléchargeait donc la même image. Chaque `.upload(...)` de
   `model-photos` passe désormais `{ cacheControl: '31536000' }` (1 an),
   pour que le navigateur ET le CDN Supabase réutilisent l'image déjà
   servie au lieu de la retélécharger. Ne s'applique, là aussi, qu'aux
   nouveaux envois (une valeur de cache ne se change pas rétroactivement
   sans réenvoyer le fichier).

## Surveillance des erreurs réelles (alternative aux audits manuels)

**Depuis le 28 septembre 2026 : `js/surveillance.js`**, chargé tout en haut de
chaque page (juste après Sentry). La propriétaire veut que le site détecte TOUT
dysfonctionnement, pas seulement les plantages — les bugs du jour (QR code du CV
bloqué par le CSP, photos absentes depuis Facebook) étaient silencieux. Il signale,
dans `journal_erreurs` ET dans Sentry, avec une catégorie entre crochets : erreurs
JS, images/scripts/styles non chargés, blocages CSP (`securitypolicyviolation`),
requêtes réseau en échec (fetch surveillé ; 401/403/404/406/409 ignorés car
normaux), `console.error`, page très lente (> 12 s, avec les fichiers les plus
longs), supabase-js jamais chargé. L'appli d'origine (Facebook, Instagram…) et le
type de réseau sont ajoutés en première ligne de `pile` et affichés dans le tableau
de bord. Envoi direct par fetch à l'API REST (clé anon), indépendant de supabase-js.
Anti-doublon par session, 25 signalements max par page. Depuis le code :
`window.signalerErreur(catégorie, message, détail)` (ou `signalerProbleme()` dans
`js/app.js`) pour tout échec rattrapé sans planter.

Journal du 12/10/2026 : ne sont plus signalés les styles en ligne ajoutés par les navigateurs
Brave (iPhone) et PHX (TECNO / Infinix) sans fichier d'origine, une « erreur » sans message ni
fichier, le code du navigateur intégré d'Instagram (`connect.facebook.net`) et l'erreur de
lecture d'une vidéo déjà rattrapée par le formulaire. Les erreurs corrigées s'effacent toutes
seules du journal grâce à `js/erreurs-corrigees.js` ; l'essai `scripts/tests-visiteur/test-journal.js`
vérifie, avec de vraies lignes du journal, ce qui est effacé et comment le reste est classé.

Table `journal_erreurs` (Extension 44) + capture globale dans `js/app.js`
+ section "🔴 Erreurs réelles du site" dans `tableau-de-bord.html`.
Écriture ouverte à tout visiteur anonyme (comme pour les autres tables
d'analytics du site), lecture réservée aux admins. Le propriétaire du site
consulte cette section régulièrement plutôt que de demander un audit
manuel complet à chaque doute — c'est la méthode retenue avec lui pour
détecter les bugs réels en production sans re-vérifier tout le code à
chaque fois.

## Ce qui a été audité pour la sécurité (état à ce jour)

Voir `SECURITY.md` pour le détail. En résumé : RLS activé et vérifié sur
toutes les tables, protection XSS systématique, statuts métier verrouillés
par triggers SQL, buckets de stockage restreints par type/taille de
fichier, en-têtes de sécurité HTTP en place, dépendances externes figées à
une version précise.

## Limites connues

Voir la section "Limites connues" de `SECURITY.md` — notamment l'absence
de vérification approfondie du contenu réel des fichiers uploadés (au-delà
du type déclaré), qui demanderait une fonction serveur supplémentaire non
mise en place à ce jour.

## Porte d'entrée / verrou de scroll (accueil et superpositions du site)

`index.html`/`en/index.html` bloquent le scroll tant que le bouton "Entrer"
n'a pas été cliqué, pour forcer l'utilisateur à voir l'écran d'accueil avant
de naviguer. Le même mécanisme verrouille aussi le menu plein écran, les
fiches actualité/partenaire, la galerie photo, et les modales/tiroir du
tableau de bord.

**⚠️ Piège déjà rencontré, ne pas répéter** : `overflow: hidden` sur
`body`/`html` (ancienne méthode, retirée) **ne bloque PAS le défilement
tactile sur iOS Safari** — limitation connue et documentée d'iOS, pas un bug
ponctuel. Un visiteur pouvait faire défiler la page À TRAVERS la porte
d'entrée sans jamais cliquer "Entrer", ce qui cassait tout le mécanisme
(sessionStorage jamais posé, la porte revenait sans cesse). Découvert et
corrigé fin septembre 2026 après plusieurs itérations infructueuses avec
`overflow:hidden`.

**Méthode actuelle, seule fiable sur tous les appareils** : figer la page en
`position:fixed` à sa position de scroll exacte (`document.body.style.top =
'-' + scrollY + 'px'`), restaurée à l'identique au déverrouillage — plus un
blocage direct du geste tactile (`touchmove`, `preventDefault()`) en
seconde ligne de défense pour les navigateurs/WebViews embarqués les plus
récalcitrants. Fonctions partagées `window.verrouillerDefilement()` /
`window.deverrouillerDefilement()` (avec compteur, pour empiler plusieurs
verrous sans conflit) :

- Définies **au tout début de `<body>`** dans `index.html`/`en/index.html`
  (avant tout le reste de la page) — **et non dans `js/app.js`**, qui
  charge trop tard (fin de page). Un deuxième bug a été trouvé pour cette
  raison précise : sur une connexion lente ou avec un visiteur rapide, le
  temps que `js/app.js` charge, l'utilisateur pouvait déjà faire défiler
  avant que le verrou ne s'active, et se retrouvait bloqué au milieu de la
  page au lieu du haut. Toute page avec un élément à verrouiller **dès le
  chargement** (pas juste au clic d'un bouton) doit définir/activer le
  verrou le plus tôt possible dans `<body>`, jamais compter sur `js/app.js`.
- `js/app.js` ne redéfinit ces fonctions **que si elles n'existent pas déjà**
  (`if (!window.verrouillerDefilement) (function(){...})();`) — pour toutes
  les autres pages (qui n'ont besoin du verrou qu'au clic d'un bouton, donc
  sans le même problème de timing). Ne jamais retirer ce garde-fou : sans
  lui, une redéfinition écraserait un verrou déjà posé et le laisserait
  bloqué en permanence (compteur désynchronisé).
- Zones avec leur propre défilement interne légitime (à ne jamais bloquer) :
  `.menu-overlay, .news-modal-contenu, .modal-overlay, .tdb-menu-panel,
  .projets-liste-scroll` — liste vérifiée via `e.target.closest(...)` dans
  le blocage tactile.

**Règle de sécurité impérative, toujours valable** : le verrou doit
TOUJOURS pouvoir se libérer tout seul, même si Supabase ne répond jamais
(connexion coupée, quota dépassé, etc.). Le clic sur "Entrer" attend au
maximum 4 secondes (`Promise.race` avec un `setTimeout`) le chargement du
mannequin à la une, puis débloque la page dans tous les cas. Ne jamais
retirer ce filet de sécurité.

## `100vh` à bannir — toujours utiliser `100dvh`

Plusieurs bugs de ce projet (bandeau d'annonce qui dépassait de l'écran
verrouillé, grand vide noir après rotation d'écran sur tablette/mobile,
piste probable d'un blocage au scroll signalé par le client) viennent tous
de la même cause : `100vh` ne suit pas la barre d'outils dynamique des
navigateurs mobiles (elle apparaît/disparaît pendant le scroll), donc la
hauteur réelle visible change sans que `100vh` se mette à jour. **Toujours
utiliser `100dvh`** (avec un repli `100vh` juste avant, pour les très
vieux navigateurs) pour toute hauteur pleine page — jamais `100vh` seul,
et jamais de solution en JavaScript (`--vh` recalculé sur un listener
`resize`), qui peut elle-même provoquer une boucle resize↔scroll sur
mobile. `100dvh` est natif, se recalcule sans JS, donc sans ce risque.

## Fond de page en photo — tenté puis abandonné (ne pas refaire à l'identique)

Une tentative d'utiliser une photo comme fond de page globale (au lieu du
dégradé + texture bruit actuel) a été testée puis annulée à la demande du
client. Deux causes techniques ont empêché que ça fonctionne, à connaître
avant de retenter l'expérience :

1. **Les sections de contenu recouvrent le fond du `body`.** La quasi-
   totalité des sections (`.fond-noir`/`.fond-anthracite`, la porte
   d'entrée, le pied de page...) ont leur propre fond opaque — le fond du
   `body` n'est donc jamais visible derrière, sauf dans de rares zones sans
   fond propre. Rendre ces fonds semi-transparents (`rgba(...)` à ~86%
   d'opacité) résout ce point sans nuire à la lisibilité du texte.
2. **`background-size: cover` sur `body` se calcule sur la page entière,
   pas sur l'écran, dès que `background-attachment` n'est pas `fixed`.**
   Sur mobile, `background-attachment: fixed` a volontairement été
   désactivé (coûteux au scroll sur Safari iOS), ce qui repasse en
   `scroll` — et dans ce mode, `cover` dimensionne l'image sur la hauteur
   totale du document (potentiellement plusieurs milliers de pixels), pas
   sur le viewport. Résultat : l'image apparaît écrasée/quasi invisible
   sur mobile, même après avoir réglé le point 1.

   La bonne approche pour une prochaine tentative n'est **pas**
   `background-image` sur `body`, mais un pseudo-élément dédié :
   `body::before { position: fixed; inset: 0; z-index: -1;
   background-image: url(...); background-size: cover; }` — un élément
   `position: fixed` se dimensionne nativement sur le viewport (jamais sur
   le document), et les navigateurs mobiles le composent bien plus
   efficacement qu'un `background-attachment: fixed` classique, donc pas
   besoin non plus de désactiver quoi que ce soit sur mobile.

## Durcissement CSP page par page (chantier en cours)

`vercel.json` pose un en-tête CSP global qui inclut `'unsafe-inline'` (pour
ne casser aucune page pas encore migrée). L'objectif à terme est de retirer
`'unsafe-inline'` **partout**, page par page, en isolé — jamais tout d'un
coup, le propriétaire du site veut pouvoir tester/valider chaque page
migrée indépendamment avant de passer à la suivante.

**Méthode** : chaque page migrée reçoit son propre
`<meta http-equiv="Content-Security-Policy" content="script-src 'self'
https://cdn.jsdelivr.net https://www.googletagmanager.com 'sha256-...';
style-src 'self' https://fonts.googleapis.com https://cdn.jsdelivr.net;">`
dans `<head>` — additif au header global (intersection des deux, jamais un
remplacement), donc chaque migration reste isolée et réversible. Les scripts
`<script>` inline restants sur une page migrée (filet de sécurité "reveal",
JSON-LD) doivent avoir leur hash SHA-256 exact dans ce meta CSP — calculé en
Python : `hashlib.sha256(texte_exact_du_script.encode('utf-8')).digest()`
puis encodé en base64. Le texte à hasher est EXACTEMENT le contenu entre
`<script>` et `</script>`, espaces/retours à la ligne compris — toute
modification ultérieure de ce script change son hash et casse la page tant
que le meta CSP n'est pas mis à jour en conséquence.

Tous les `style=""` inline doivent être remplacés par une classe utilitaire
(voir section suivante) avant de retirer `'unsafe-inline'` de `style-src` —
sinon la mise en forme concernée disparaît silencieusement.

**⚠️ Piège déjà rencontré** : du JS qui génère du `style=""` via
`innerHTML`/template literal est LUI AUSSI bloqué par un CSP strict (alors
que `element.style.propriete = valeur` en JS classique ne l'est PAS) —
plusieurs bugs de ce type ont déjà été trouvés en migrant des pages
(bouton de sélection sur "The Book", message "Profils bientôt disponibles",
instructions d'installation PWA, intégration vidéo des actualités) : la
correction a toujours été de remplacer le style calculé par une classe CSS
togglée via `classList`. Quand la valeur elle-même est vraiment calculée
(largeur de barre en %, ex. le classement Top 10 du tableau de bord) : ne
JAMAIS l'écrire dans une chaîne de gabarit `style="width:${valeur}%"`
(bloqué) — poser un `data-*` dans le gabarit, puis juste après l'injection
du HTML, boucler sur les éléments et faire `el.style.largeur =
el.dataset.xxx + '%'` (assignation JS classique, autorisée).

**⚠️ Autre piège rencontré (attributs `onXxx=""`)** : un attribut
`onclick=""`/`onerror=""`/... inline est bloqué par un `script-src` strict
même avec les bonnes empreintes de `<script>` — le message d'erreur du
navigateur le précise explicitement ("hashes do not apply to event
handlers... unless the 'unsafe-hashes' keyword is present"). Trouvé sur
`mannequin.html`/`en/mannequin.html` (bouton "Réessayer" du profil, corrigé
en hotfix après coup) et sur `tableau-de-bord.html` (deux `onerror=""`
d'aperçus photo). Correction : retirer l'attribut du gabarit, ajouter un
`addEventListener` (ou une assignation `img.onerror = ...`) juste après
l'injection du HTML dans le DOM — jamais dans le HTML lui-même. Avant de
considérer une page comme migrée : `grep -noE '\son[a-z]+=' fichier.html`
doit être vide (en excluant les faux positifs dans les commentaires).

**⚠️ Piège rencontré sur une page à plusieurs `<style>`** : `style-src`
exige une empreinte par bloc `<style>...</style>` PRIS SÉPARÉMENT — sur
`tableau-de-bord.html`, qui a 11 blocs `<style>` distincts accumulés au fil
des refontes, n'avoir haché QUE le nouveau bloc ajouté a bloqué en silence
les 10 autres (`violatedDirective: style-src-elem` dans
`securitypolicyviolation`, repéré uniquement par test navigateur). Un
fichier avec plusieurs `<style>` doit avoir TOUTES leurs empreintes dans le
meta CSP, pas seulement celle du dernier ajouté. `scripts/verifier-csp.py`
vérifie maintenant aussi les `<style>` (pas seulement les `<script>`)
pour détecter ce cas automatiquement.

**État à ce jour (fin septembre 2026)** — **les 28 pages du site sont
migrées** (plus `'unsafe-inline'` du tout) : toutes les pages FR
(`index.html`, `mannequins.html`, `mentions-legales.html`,
`politique-confidentialite.html`, `services.html`, `actualites.html`,
`candidature.html`, `contact.html`, `evenements.html`, `mannequin.html`,
`partenaires.html`, `selection.html`, `inscription-mannequin.html`,
`espace-mannequin.html`, `tableau-de-bord.html`) + leurs équivalents `en/`
existants (13 pages, `espace-mannequin.html`/`tableau-de-bord.html` n'ont
pas de version anglaise). `espace-mannequin.html` et `tableau-de-bord.html`
ont été migrées séparément et en dernier, une à la fois, avec des tests
dédiés plus poussés (navigateur headless + écoute de l'événement
`securitypolicyviolation` pour repérer précisément quel bloc pose
problème) — ce sont les deux pages les plus riches en JavaScript du site
(respectivement ~80 et ~163 `style=""` inline avant migration, des blocs
`<script>` de plusieurs dizaines de milliers de caractères, et pour
`tableau-de-bord.html` plusieurs générations de scripts "patch" empilées
qui se recouvrent partiellement — toutes ont dû être corrigées, pas
seulement la version qui semble "active").

`vercel.json` garde son `'unsafe-inline'` global par prudence (une page qui
serait ajoutée sans meta CSP dédié doit continuer à fonctionner), mais
n'a plus aucun effet protecteur réel puisque toutes les pages existantes
ont désormais leur propre CSP restrictif qui prime.

Pour les pages avec un formulaire dont le JavaScript génère lui-même du
HTML via `innerHTML`/template literal (aperçus photo, listes filtrées,
etc.) : les `style=""` qui apparaissent DANS ce JavaScript (pas seulement
dans le HTML statique) doivent aussi être remplacés par des classes,
sinon ils sont bloqués en silence exactement comme un `<script>` non
haché — voir le piège déjà rencontré ci-dessus. Chaque page migrée reçoit
ses propres classes utilitaires dans un `<style>` posé dans son
`<head>` (nommées `<prefixe>-1`, `<prefixe>-2`, ... — préfixe court propre
à la page), pour rester page par page et isolé sans gonfler
`css/style.css` de classes à usage unique ; seules les valeurs qui
correspondent exactement à une classe `.u-*` déjà existante sont
réutilisées telles quelles.

## Classes utilitaires CSS (`.u-*`)

Ajoutées au fil du durcissement CSP ci-dessus, pour remplacer les
`style=""` inline sans dupliquer de CSS : `.u-hidden`, `.u-tc`,
`.u-flex-center`, `.u-mt-*` / `.u-mb-*` / `.u-ml-*` / `.u-pt-*` / `.u-pb-*`
/ `.u-py-*` (espacements, suffixe = valeur en rem avec `-` pour la
décimale, ex. `.u-mt-1-5` = `margin-top: 1.5rem`), `.u-maxw-520` /
`.u-maxw-60ch` / `.u-maxw-60ch-texte`, `.u-texte-doux` / `.u-c-texte-doux`
/ `.u-texte-gris`, `.u-border-y-gris`, `.u-cta-row`, `.u-icone-partage` et
variantes `.u-ic-*`. Toutes définies en fin de `css/style.css`, section
"Classes utilitaires". Avant d'ajouter une nouvelle classe utilitaire,
vérifier qu'une existante ne convient pas déjà — l'objectif est d'éviter
la prolifération de variantes quasi identiques.

## Nettoyage de code mort — méthode à respecter

Un audit de nettoyage (fin septembre 2026) a retiré du CSS/JS mort
confirmé (ancien système de menu mobile, ancien header, blocs "Hero
ancienne mise en page"/"Équipe" jamais utilisés, classes isolées jamais
référencées). **Ne jamais supprimer un sélecteur/une fonction en le
supposant inutilisé** — vérifier systématiquement par recherche exhaustive
sur TOUT le repo (`.html` ET `.js`, racine + `en/` + `outils/`), y compris
les classes ajoutées dynamiquement (`classList.add(...)`, `className =
...`) qui n'apparaîtront jamais dans un simple grep sur le HTML statique.

## Fonctionnalités majeures ajoutées récemment (repères pour s'orienter)

- **heic2any retiré (28 septembre 2026)** — ~90 % du journal d'erreurs était
  une « EvalError » : heic2any (conversion des photos HEIC d'iPhone) utilise
  `new Function`, interdit par le CSP (pas de `'unsafe-eval'`, à ne pas
  ajouter). Il plantait à chaque chargement des 12 pages d'envoi de photos,
  sans jamais pouvoir convertir, et pesait 1,3 Mo par page. Remplacé par une
  conversion faite par le navigateur (`window.heic2any` défini dans
  `js/app.js`, même signature) : fonctionne là où le HEIC est lisible
  (Safari iPhone/Mac) ; ailleurs les pages envoient le fichier d'origine,
  comme avant. Le tableau de bord affiche aussi désormais le détail technique
  de chaque erreur (fichier/ligne/adresse), pour diagnostiquer depuis une
  simple capture d'écran.
- **Cases photo du CV et de la compcard remplies automatiquement**
  (28 septembre 2026) : si le mannequin n'a pas choisi sa photo de CV ou
  une photo pour une case de la compcard, la case est complétée avec ses
  photos du Book (photo de profil en premier), sans doublon tant qu'il en
  reste d'autres — `completerEmplacementsPhotos()` / `photosCvCompletees()`
  dans `js/app.js`, utilisés par le CV (HTML + fichier), la compcard
  (fichier FR/EN + aperçu de l'espace mannequin). Le choix du mannequin
  reste prioritaire ; rien n'est écrit en base (c'est un remplissage à
  l'affichage, qui disparaît dès qu'il choisit lui-même).
- **Allègement du site (28 septembre 2026)** — plainte de la propriétaire :
  site très lourd depuis le navigateur intégré de Facebook, photos qui ne
  s'affichent pas. Constats et corrections :
  - `vercel.json` posait `Cache-Control: no-cache, must-revalidate` sur
    TOUT (`/(.*)`), y compris les photos du relais `/book-photos/*` : le
    téléphone ne gardait jamais une photo, chaque visite repassait par le
    relais Vercel → r2.dev. Ajout de règles plus bas dans `headers` (la
    dernière règle correspondante l'emporte) : `/book-photos/*` en cache
    1 an `immutable` (chaque photo a un nom unique horodaté, elle ne change
    jamais) + `CDN-Cache-Control` pour que Vercel la garde aussi ;
    `/assets/*` et `/icons/*` en cache 1 jour. HTML/JS/CSS inchangés
    (toujours revalidés, pour que les mises à jour se voient tout de suite).
  - `assets/logo-header.png` (bandeau de toutes les pages) : 492 Ko → 20 Ko,
    `assets/logo-dark-bg.png` : 840 Ko → 34 Ko (redimensionnés à 600 et
    800 px + palette 256 couleurs, rendu identique ; restent assez grands
    pour la compcard 400 dpi et le CV 300 dpi).
  - Fiche mannequin : couverture en `url_moyenne`, médaillon en
    `url_miniature` au lieu de l'originale.
- **CV téléchargé (PDF/JPEG, `construireCanvasCv()` dans `js/app.js`)** —
  28 septembre 2026 : hauteur exacte (le dessin est fait deux fois, d'abord
  « à blanc » pour mesurer, plus aucune estimation qui laissait un grand
  vide en bas) ; bas de page réorganisé (compétences sur deux colonnes, puis
  portfolio en une rangée de photos, puis « En ligne » : Instagram + lien
  vers la fiche + QR code, cliquables dans le PDF). Le QR code est désormais
  calculé localement (`js/qrcode-generator.js`, copie de qrcode-generator
  1.4.4) : l'ancien appel à api.qrserver.com était bloqué par `connect-src`
  du CSP et le QR disparaissait en silence du fichier.
- **Fiche mannequin publique (`mannequin.html` / `en/mannequin.html`) en
  mise en page « profil » façon Facebook/Instagram** (28 septembre 2026) :
  couverture plein écran cliquable (ouvre la galerie du Book), photo de
  profil en médaillon à gauche qui chevauche le bas de la couverture,
  mensurations en liste aérée à sa droite, boutons « Sélectionner » et
  « Compcard » (un seul bouton → menu PDF / JPEG) juste dessous, puis cartes
  À propos + Contact / Parcours (frise) + Vidéo, sur deux colonnes dès
  900px. Styles : classes `.fiche-*` en fin de `css/style.css`. Le CV reste
  privé (espace mannequin et tableau de bord uniquement).
  2e passe le même jour : boutons dans la typographie de « MENU » (pilules
  fines), barre d'onglets (À propos / Parcours / Photos / Contact, simples
  ancres), et contact officiel déplacé tout en bas, après le Book
  (`#fiche-contact-bas`, rempli en JS) — objectif de la propriétaire : qu'on
  ait l'impression d'être sur la page Facebook du mannequin, sans copier
  Facebook.
- **`evenements.html`** — "Nos Événements", reconstruite fin septembre 2026
  sur exactement la même architecture qu'`actualites.html` (bloc "à la
  une", grille magazine, fiche modale, galerie photo adaptative, éditeur
  plein écran) — voir `js/evenements.js` et la section dédiée plus haut.
- **Refonte visuelle premium de "The Book"** (`mannequins.html`).
- **Éditeur de texte enrichi** (Quill) pour les champs
  commentaire/description des actualités, événements et partenaires — voir
  `creerEditeurRiche()`/`rendreContenuRiche()` dans `js/app.js`, qui gèrent
  aussi la conversion des anciens textes bruts déjà enregistrés.
- **Validation admin à deux facteurs (2FA)**, avec récupération par e-mail,
  pour l'accès à `tableau-de-bord.html`.
- **Refonte de la navigation du tableau de bord** en 3 blocs + menu mobile
  dédié (`.tdb-menu-panel`/`.tdb-menu-toggle`) — voir aussi la section
  verrou de défilement plus haut, ce tiroir en fait partie.
- **Messages groupés : convocation au casting de l'agence (7 octobre 2026)**
  — `js/messages-groupes.js`. Le message « Retenue » d'« Intégrer l'agence »
  est écrit pour WhatsApp (`*gras*`, `_italique_`) avec `{date}`, `{heure}`,
  `{lieu}` remplis par trois cases au-dessus du message (`#mg-infos-rdv`,
  visibles seulement si le message contient ces mots). Date : dimanche
  suivant par défaut ; heure et lieu retenus dans `localStorage`
  (`ma2m_mg_heure`, `ma2m_mg_lieu`). L'e-mail reçoit le même texte passé par
  `pourEmail()` (signes WhatsApp retirés, phrase « Un e-mail de confirmation…
  » retirée). Le suivi « déjà envoyé » tient compte de date/heure/lieu : une
  nouvelle date = un nouvel envoi possible pour tout le monde.
  **Texte unique** dans `js/messages-candidats.js` (ex-`convocation-agence.js`) (`CONVOCATION_AGENCE`,
  `dimancheSuivantISO`, `dateLongueFr`, `infosRdvMemorisees`/`memoriserInfosRdv`,
  `sansPhraseEmail`, `messagePourEmail`) : utilisé aussi par la fiche d'une
  personne (« Écrire sur WhatsApp » → Convocation, candidat(e)s « agence »
  seulement ; casting précis et inscriptions gardent l'ancienne convocation).
  La fiche propose les mêmes date/heure/lieu et a un bouton « ✉️ Envoyer aussi
  par e-mail ». Sans adresse e-mail, la phrase « Un e-mail de confirmation… »
  est retirée du WhatsApp (fiche et messages groupés).
  **Premiers messages** (changement de statut d'une candidature sur la fiche,
  `MODELES_NOTIFICATION.casting` dans `tableau-de-bord.html`) : réécrits le
  07/10/2026 (en étude, en attente, retenue, refusée) au même format WhatsApp ;
  l'e-mail (automatique et bouton) passe par `messagePourEmail`.
  **Seconds messages** (Messages groupés, 07/10/2026) : casting précis retenu =
  `CONVOCATION_CASTING` (même cases date/heure/lieu, même `DRESS_CODE` que
  l'agence ; aussi sur la fiche) ; nouvelle / en étude / en attente = relances
  (`messageCandidature`). « Refusée » et « annulée » ne sont plus proposées
  (`SANS_SECOND_MESSAGE`) : pas de second message après un refus.
  **Tous les messages, seul OU en groupe (07/10/2026)** : catalogue
  `MESSAGES_CANDIDATS` dans `js/messages-candidats.js` (1er message de chaque
  statut, relances, convocation, rappel). La fiche (« Écrire sur WhatsApp »,
  valeurs `c:<clé>`) et Messages groupés (case « Quel message ? » `#mg-type`)
  proposent exactement les mêmes textes ; `personnaliserMessage()` les remplit.
  Les premiers messages du changement de statut (`MODELES_NOTIFICATION.casting`)
  viennent aussi du catalogue. « Refusée » revient dans Messages groupés avec son
  seul 1er message (inscriptions : « annulée » toujours exclue).
- **L'e-mail partout + contacts du parent (07/10/2026, Extension 129)** —
  formulaire d'inscription : e-mail obligatoire (`ins-email`, passé par
  `api/code-protege.js` → `p_email`), téléphone renommé « WhatsApp ». Les trois
  formulaires (FR/EN) : « WhatsApp du parent » + `parent_email` (obligatoires
  pour un mineur). Espace mannequin : bloc « Parent ou tuteur » pour une
  mineure, enregistré dans la table **`contacts_parents`** (une ligne par
  mannequin, RLS : la mannequin ne voit que la sienne, l'agence tout) — et non
  dans `model_profiles`, dont les droits colonne par colonne ne cachent rien aux
  comptes connectés (ils ont la lecture de toute la table). ⚠️ Mettre en ligne
  APRÈS l'Extension 129 : sinon la candidature d'un mineur (colonne
  `parent_email` absente) et toute inscription (fonction à 12 paramètres
  absente) échouent.
- **Téléphone / e-mail des mannequins verrouillés (07/10/2026, Extension 130)** —
  le rôle `authenticated` n'a plus la lecture de TOUTE la table `model_profiles`,
  seulement de toutes les colonnes sauf `phone` et `contact_email` (avant, un
  compte connecté pouvait les lire pour toutes les fiches publiées). Conséquences
  pour le code : jamais de `select()` / `select('*')` sur `model_profiles` côté
  navigateur (toujours nommer les colonnes) ; ⚠️ toute NOUVELLE colonne doit être
  ouverte : `grant select (col) on model_profiles to authenticated;` (et `to anon`
  si publique), sinon les pages qui la lisent échouent.
- **Toutes les informations personnelles verrouillées (07/10/2026, Extension 131)** —
  date et lieu de naissance, nationalité, quartier, établissement, commentaire de
  refus : plus lisibles directement par un compte connecté. La mannequin (sa fiche)
  et l'agence les obtiennent par `profils_prives(ids)` ; côté code, toujours lire
  `model_profiles` avec `sansChampsPrives('…')` puis `completerProfilsPrives(lignes)`
  (`js/app.js`, `CHAMPS_PRIVES_PROFIL`). Tant que l'extension n'est pas exécutée,
  `completerProfilsPrives` relit ces champs directement (pas de panne).
- **Messages : le 1er message n'est plus dans les listes (07/10/2026)** — il part
  tout seul au changement de statut (`premier: true` dans `MESSAGES_CANDIDATS`) ;
  « Message tout prêt » (fiche) et « Quel message ? » (groupés) ne proposent que les
  messages suivants (relances, convocation, rappel, libre). « Refusée » : rien.
  L'accusé de réception « Nouvelle » a été retiré (07/10/2026) ; Messages groupés
  ne montre que les statuts qui ont un message à envoyer. Libellés sans tiret long
  (demande de la propriétaire : pas de « traces d'IA » dans les textes).
- **Mineurs : les messages partent vers le parent (07/10/2026)** — `contactsEnvoi(d)`
  (`js/messages-candidats.js`) : moins de 18 ans + contacts du parent ⇒ WhatsApp et
  e-mail du parent, texte « parent » du catalogue (`parent:` sur chaque message,
  `messageParent`, repère `{parent}` = `salutationParent(parent_nom)`). La civilité
  (Madame / Monsieur / Mademoiselle) est choisie dans les formulaires et l'Espace
  mannequin et rangée DEVANT le nom dans `parent_nom` (« Madame Kouassi Marie ») ;
  sans civilité : « Madame, Monsieur Kouassi Marie ». Messages groupés : case
  « Version pour les parents (mineurs) » (`#mg-message-parent`), visible seulement si
  la liste contient un mineur joint par son parent. Fiche : `contactsFiche()`.
  Inscriptions : même chose (07/10/2026).
- **Civilité et inscriptions dans le catalogue (07/10/2026)** — `{prénom}` devient
  « Mademoiselle / Monsieur + nom complet » selon le genre (`nomAvecCivilite`). Le
  catalogue `MESSAGES_CANDIDATS` a une `source` : 'casting' ou 'inscription'
  (1ers messages vérification / validée / refusée, relances paiement / vérification,
  convocation à la première formation `CONVOCATION_FORMATION`, versions parent).
  Fiche et Messages groupés les proposent pour les deux ; les anciens textes
  d'inscription en dur ont été retirés.
- **Civilité choisie par la candidate (07/10/2026, Extension 132)** — case
  « Civilité » (Madame / Mademoiselle) visible quand le genre est « Femme » dans
  les 6 formulaires ; « Monsieur » d'office pour un homme. Colonne `civilite`
  (candidatures et inscriptions, `p_civilite` dans `soumettre_inscription_mannequin`).
  `nomAvecCivilite` l'utilise en priorité. ⚠️ Mettre en ligne APRÈS l'Extension 132.
  Civilité partout (même jour) : formulaire de contact, demande des recruteurs
  (`selection.html`) et commande de la boutique → civilité rangée DEVANT le nom
  (« Madame Kouassi Marie »), sans colonne ; Espace mannequin → colonne
  `model_profiles.civilite` (ouverte en lecture à `authenticated`), lue et
  enregistrée à part (rien ne bloque si la colonne manque).

## Diagnostic sécurité du 28 septembre 2026 (nuit)

Revue complète de la sécurité et des connexions, à la demande de la
propriétaire, faite pendant que le site tournait normalement (lecture et
vérification uniquement, aucune modification risquée). Rapport complet :
https://claude.ai/artifact/6VhrViMnZ8cRxJvsnnrNtD

**Résumé** : fondations déjà solides — RLS activé sur les 36 tables sans
exception, les 43 fonctions `SECURITY DEFINER` ont `set search_path`
(protection contre le détournement de chemin de recherche), aucun secret
dans le code, aucun lien mort, endpoints d'administration (créer admin,
supprimer mannequin) correctement vérifiés côté serveur.

Deux points mineurs relevés sur le tout nouveau système de cœurs
(Extension 93 de la même nuit) ont été corrigés dans la foulée
(Extension 95) : limite anti-spam par visiteur (réutilise
`limiter_soumissions_publiques`, Extension 75) et cœurs désormais
réservés aux profils publiés.

Recommandations restantes (aucune urgente) : confirmer Resend par un
envoi réel, envisager une vérification plus poussée du contenu des
fichiers uploadés (limite déjà documentée dans `SECURITY.md`), faire
tourner Mozilla Observatory / SSL Labs pour un second avis extérieur.

## Audit complet du 28 septembre 2026 (soir) — demandé par la propriétaire

Revue de bout en bout (analyse statique de tout le code + chargement de chaque
page FR/EN en navigateur réel, mobile et ordinateur, avec base simulée — vide,
absente, puis remplie de fausses données contenant du code malveillant pour
vérifier qu'aucun texte n'est jamais exécuté). Corrigé :

- **Faille d'envoi de fichiers** (`api/r2-presigner.js`, `api/r2-site-images.js`) :
  le type de fichier n'était pas vérifié. Un compte mannequin pouvait envoyer un
  fichier HTML/SVG « déguisé » en photo, servi ensuite depuis le domaine du site
  (relais `/book-photos`) → exécution de code possible, vol de session. Désormais
  seules les vraies images sont acceptées (JPEG, PNG, WebP, GIF, HEIC, AVIF), les
  remontées de dossier (`..`) sont refusées, et `vercel.json` sert tout
  `/book-photos/*` avec un CSP `sandbox` (aucun code ne peut s'y exécuter, même
  si un mauvais fichier y était déjà). Conséquence : un logo partenaire en SVG est
  désormais refusé à l'envoi (message clair) — utiliser PNG.
- **Comptage des visites** (`js/app.js`) : toutes les fiches mannequin
  partageaient la même clé de session → seule la première fiche vue était
  comptée, le classement « Top 10 » était faussé. Clé désormais par fiche.
- **Page « nouveau mot de passe »** : formulaire affiché trop tôt (attribut
  `style="display:none"` bloqué en silence par le CSP) → règle déplacée dans
  `css/style.css`.
- **espace-mannequin-ancien.html** (filet de secours) : entièrement cassé
  (constantes redéclarées, déjà fournies par `js/app.js`) → réparé ; heic2any
  retiré aussi.
- Bouton « Sélectionner » : ne plante plus si le stockage du navigateur est
  indisponible. Liens Instagram de l'accueil limités à `https://`.
- Surveillance : ignore les `<img src="">` en attente et les services d'audience
  bloqués par les bloqueurs de pub (ipify, Google Analytics) — sinon bruit inutile.
- `robots.txt` : chemins sans `.html` (le site utilise `cleanUrls`).
- **Suppressions dans le bon ordre** (photo du Book côté mannequin et admin,
  photo de dossier, actualité, événement, partenaire — FR/EN) : la fiche en base
  est supprimée d'abord, les fichiers ensuite seulement si la base a accepté.
  Avant, les fichiers partaient en premier et l'erreur de base était ignorée →
  élément toujours listé mais image cassée. En cas d'échec : message clair.
- Types `image/jpg` et `image/pjpeg` (certains Android) acceptés par les `/api`.
- **espace-mannequin-ancien.html supprimé** (même soir, sur conseil de l'assistant
  et accord de la propriétaire) : doublon inutilisé du nouvel espace, encore basé
  sur Supabase Storage, et une page de connexion de plus à protéger. Redirection
  permanente vers `/espace-mannequin` dans `vercel.json`. Récupérable à tout
  moment dans l'historique git si besoin. Les mentions qui restent dans les
  commentaires du code sont historiques.
- **Aucun flux photo vers Supabase** (règle de la propriétaire, restriction
  Supabase du 15 octobre 2026) : `espace-mannequin-ancien.html` envoyait encore
  les photos vers Supabase Storage → envoi et suppression de photos désactivés sur
  cette page de secours (message renvoyant vers le nouvel espace). Restent
  seulement, côté tableau de bord, des suppressions (libèrent de la place, sans
  bande passante) et l'affichage des très anciennes photos de candidatures d'avant
  Google Drive (URL signées, uniquement à l'ouverture de ces vieux dossiers).
- Outils internes (`outils/`) : logos introuvables (mauvais chemin) corrigés.

**Recommandation non appliquée (demande une décision + du SQL)** : le code de
validation admin (2ᵉ facteur) n'est vérifié que dans le navigateur
(`sessionStorage`). Quelqu'un qui aurait le mot de passe d'un admin pourrait
appeler directement Supabase et les `/api` sans le code. Le rendre vraiment
obligatoire suppose de le vérifier côté base (RLS) et côté `/api` — chantier à
part, à préparer avec soin pour ne pas bloquer l'accès de la propriétaire.

### Vérification espace mannequin / envoi de photos (28 septembre 2026, suite)

Demande de la propriétaire (« les mannequins disent que télécharger des images
c'est compliqué »). Simulation complète en navigateur (session simulée, envoi réel
jusqu'à `/api/r2-presigner` + PUT + insertion en base) sur iPhone SE, iPhone 12,
Galaxy S9+, iPad et ordinateur — NB : moteur Chromium uniquement (Safari/WebKit
indisponible dans l'environnement de l'assistant), d'où en plus une vérification
statique de compatibilité iOS. Corrigé :
- `crypto.randomUUID` (iOS ≥ 15.4 seulement) utilisé par candidature, sélection,
  actualités/événements/partenaires : équivalent ajouté en tête de `js/app.js`
  pour les iPhone plus anciens (l'envoi plantait sans message).
- `??` dans `espace-mannequin.html` (iOS ≥ 13.4) : remplacé — sur un iPhone plus
  ancien, tout le script de l'espace mannequin ne se chargeait pas.
- Photos lourdes non-JPEG (captures PNG, WebP > 900 Ko) désormais compressées en
  JPEG avant envoi (avant : envoyées telles quelles, parfois 10-20 Mo).
- Envoi de plusieurs photos : message « Envoi de la photo 2 sur 5… » puis bilan.
- Coupure réseau : message en français au lieu de « Failed to fetch » /
  « Load failed ».
Résultat : 0 appel au stockage Supabase, 3 versions par photo vers R2, fiche en
base ; Book, fiche mannequin FR/EN et accueil : toutes les images chargées sur les
5 appareils, sans erreur ni débordement.

### Journal d'erreurs du 28 septembre 2026 (soir) — analyse et corrections

- **Sentry ne fonctionnait pas** : le chargeur (`js-de.sentry-cdn.com`) télécharge
  ensuite le SDK complet depuis `browser.sentry-cdn.com`, absent du CSP → bloqué
  partout, Sentry n'a jamais rien enregistré. Ajouté à `script-src` (vercel.json +
  meta CSP des 29 pages) et à `connect-src`.
- Navigateurs intégrés Instagram/Facebook : ils injectent leur propre code
  (`iabjs://…`, « Java object is gone ») et re-téléchargent par `fetch` les
  scripts/polices de la page → faux signalements. `connect-src` autorise
  désormais `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com` ;
  `js/surveillance.js` ignore les erreurs de code étranger (`codeEtranger()`) et
  les réponses « opaques » (statut 0, ex. Google Analytics).
- Aucune erreur du journal ne venait d'une page du site ni d'une photo non
  affichée (y compris depuis Facebook).


## 🔗 Aperçu des liens partagés + boutons Partager (29 septembre 2026)

- Ouvrir une actualité ou un événement met son adresse précise dans le navigateur
  (`?actu=ID` / `?evenement=ID`), et la fiche propose **Partager** (téléphone),
  **WhatsApp** et **Copier le lien** (`window.ficheOuverte` / `window.ficheFermee`
  dans `js/app.js`, appelés par `js/actualites.js`, `js/evenements.js` et les
  pages anglaises).
- `middleware.js` (Routing Middleware Vercel) : **seuls les robots d'aperçu**
  (WhatsApp, Facebook, Telegram, X, LinkedIn…) reçoivent une petite page avec les
  balises `og:` de la fiche (titre, texte, photo). Les visiteurs ne sont jamais
  concernés ; au moindre problème, le robot reçoit la page normale.
- La photo d'aperçu passe par l'optimiseur d'images de Vercel
  (`/_vercel/image?...&w=1080`, réglé par la clé `images` de `vercel.json`) :
  WhatsApp n'affiche pas les photos trop lourdes.
- Ne pas ajouter les navigateurs intégrés des applis (Instagram, « FBAN »,
  Snapchat, LINE…) à la liste des robots : ce sont de vraies personnes.

## 🛍️ Marketplace — Boutique MA2M (29 septembre 2026 — construite, fermée au public)

- **Cahier des charges** validé par la propriétaire (boutique de l'agence, paiement
  Wave / Orange Money / MTN avec référence, livraison à domicile).
- **Base de données** : Extension 98 (`supabase-extension.sql`), lancée dans Supabase
  le 29/09. Tables `boutique_*`, prix calculés par la base, stock verrouillé,
  factures numérotées sans trou, annulation automatique des commandes non payées.
  Testée sur PostgreSQL 16 avant envoi (y compris l'achat simultané du dernier article).
- **FERMÉE au public** tant que `boutique_reglages.ouverte = false` : les règles RLS
  ne laissent rien lire à un non-admin ; les pages `marketplace/` affichent alors
  « Page introuvable ». Ne PAS passer `ouverte` à true avant la fin de la construction,
  la relecture des CGV et l'accord de la propriétaire.
- **Nom retenu : « La Maison MA2M ».** Règle de la propriétaire : la boutique réutilise les composants du site officiel (eyebrow, titres capitales + point rouge, .btn, .filtre-btn, .form-champ, .fil-ariane, .vedette-fullbleed, .btn-mini-admin) et des textes naturels — pas d’interface ni de phrases « génériques IA ».
- **Pages** : `marketplace/index.html` (vitrine), `produit.html?p=<slug>` (fiche),
  `gestion.html` (tableau de bord de la boutique : exige un admin connecté ET le code
  de validation saisi dans cet onglet). Code : `js/marketplace-commun.js` (accès,
  prix, panier), `js/marketplace-vitrine.js`, `js/marketplace-gestion.js`, styles
  `css/marketplace.css` (préfixe `mp-` / `mpg-`, aucun effet sur le reste du site).
  Aucun script en ligne : CSP stricte sans empreinte à maintenir.
- **Photos produits** : Cloudflare R2, dossier `site/boutique/<produit>/`, catégorie
  `boutique` ajoutée à `api/r2-site-images.js`. Allégées dans le navigateur avant
  envoi (1800 px + miniature 640 px). Jamais de photo sur Supabase.
- **Lien « Marketplace »** (js/menu.js) : visible seulement pour un admin connecté ;
  dans la barre du haut sur ordinateur/tablette, en tête du menu sur téléphone (sur
  téléphone, un 4e bouton écrasait le logo).
- **Direction artistique (29/09, version « affiche »)** : ouverture reprise de
  l'affiche FORM choisie par la propriétaire (nuit laquée, filets de lumière, grand
  « M A 2 M » espacé, trait, accroche, ornement trait-point-trait), **rouge et noir
  uniquement — aucun doré** (`--or` est redéfini en rouge dans `.mp-corps`).
  **Tous les boutons** ont la forme ronde des boutons de l'en-tête (EN / Admin /
  Marketplace). Polices de la boutique : Bodoni Moda (titres) + Tenor Sans (textes).
- **Adresses absolues partout** (`/marketplace/gestion`, `/css/…`) : avec les
  adresses propres de Vercel, `/marketplace` sans « / » final cassait les liens
  relatifs (page 404 signalée le 29/09). Pages générées par un script (même
  en-tête, barre, panier, pied) : garder cette règle en cas d'ajout.
- **Trois univers** (colonne `type` des produits) : Articles (`physique`, livrés),
  Billets (`billet` : date, lieu, « stock » = places ; un billet à code + QR par
  place, émis à la validation du paiement), Services (`service` : modalités,
  rendez-vous après paiement). Vitrine : section « Trois portes », puis filtres
  univers → catégories.
- **Parcours client complet** : `commande.html` (coordonnées, zone de livraison
  seulement s'il y a un article, CGV obligatoires) → `suivi.html?n=&j=` (paiement :
  numéro Wave/OM/MTN + saisie de la référence ; puis étapes, livreur, billets QR,
  facture) → `facture.html?n=&j=` (imprimable / PDF, numéro F-AAAA-NNNNN). Suivi
  aussi par numéro + téléphone. `cgv.html` = **projet à faire valider par un juriste**.
- **Gestion** : onglet Commandes (« À vérifier » en tête ; confirmer / refuser le
  paiement, préparer, remettre au livreur, terminer, rembourser ; WhatsApp client ;
  historique), onglet Billets (contrôle à l'entrée ; le QR ouvre
  `/marketplace/gestion?billet=CODE`, un billet ne sert qu'une fois), Réglages
  (identité légale du vendeur imprimée sur les factures : RCCM, NCC, mention fiscale
  à valider avec le comptable).
- **Base** : Extension 99 (colonnes événement/service, `type_produit` des lignes,
  table `boutique_billets`, fonctions `boutique_emettre_billets`,
  `boutique_controler_billet`, suivi enrichi, « payée → terminée » pour billets et
  services). Testée sur PostgreSQL 16 (installée deux fois, billets sans doublon,
  refus d'un événement passé, contrôle réservé aux admins).
- **Rayons** (Extension 100) : chaque catégorie appartient à une porte
  (`boutique_categories.univers`). Rayons de départ : Articles (Vêtements,
  Accessoires, Objets de l'agence), Billets (Défilés, Galas et soirées, Castings,
  Ateliers et masterclass), Services (Shooting photo, Formation privée, Coaching et
  accompagnement, Autres services). Tous visibles dans la boutique, « bientôt »
  quand ils sont vides ; l'éditeur de produit ne propose que les rayons de la porte
  choisie.
- **Bandeau défilant** (Extension 101) : message réglable dans Gestion → Réglages
  (`bandeau_texte`, `bandeau_actif`) ; désactivé ou vide = texte habituel.

## 🧭 Confort de navigation et cookies (29 septembre 2026)

Liste de la propriétaire, triée avec elle : ajouté ce qui manquait et avait du sens.
- **Bandeau cookies** (`js/analytics-config.js`) : Google Analytics en « mode
  consentement » — refusé par défaut, accordé seulement après « Accepter »
  (`localStorage.ma2m_cookies` = oui / non). Bouton « Modifier mon choix » sur la
  page Confidentialité (`[data-cookies-modifier]`), dont le paragraphe Cookies a été
  corrigé (il disait à tort « aucun traceur tiers »).
- **`js/confort.js`** (chargé après app.js sur toutes les pages, et sur
  reinitialiser-mot-de-passe) : œil sur chaque champ mot de passe (y compris ajoutés
  plus tard), bouton « retour en haut » (coin droit, rehaussé au-dessus de « Ma
  sélection »), lien « Aller au contenu » visible seulement au clavier.
- **Liens partagés marqués (UTM)** : actualités / événements partagés par WhatsApp,
  lien copié ou partage du téléphone → `utm_source`, `utm_medium=partage`,
  `utm_campaign=actualite|evenement` (sans effet sur les aperçus, middleware.js).
- **Date de dernière mise à jour** en bas des mentions légales et de la
  confidentialité (FR + EN) — à changer à chaque modification de ces pages.
- Écartés avec la propriétaire : mode sombre (le site est noir), barre de progression,
  bouton copier sur les textes, recherche globale ; FAQ en attente de ses questions.

## ⚖️ Conformité et sécurité (30 septembre 2026)

Audit à partir d'une liste générale fournie par la propriétaire (beaucoup de points
déjà en place ou sans objet : pas d'IA, pas de connexion Google, pas de paiement
par carte). Corrigé :
- **Case d'accord obligatoire** (`.form-consentement`, `required`) sur les formulaires
  d'inscription, de contact et de sélection (FR + EN) ; la candidature l'avait déjà.
- **Plus d'appel à ipify** : l'adresse IP des visiteurs n'est plus envoyée à un tiers.
  `empreinteVisiteur()` (js/app.js) = identifiant aléatoire, gardé dans le navigateur
  seulement si les cookies de mesure sont acceptés, sinon pour la visite en cours.
  `api.ipify.org` retiré du CSP (vercel.json).
- **Prestataires déclarés** dans la politique de confidentialité (#prestataires).
- **jsDelivr retiré** de tous les CSP : plus aucun code chargé depuis ce CDN (jsPDF de
  en/mannequin.html passé en copie locale, empreinte CSP mise à jour).
- **Accessibilité** : audit axe-core (WCAG 2 A/AA) sur toutes les pages — seuls défauts :
  étiquettes non reliées à leur champ (connexion admin, espace mannequin, codes du
  tableau de bord) → corrigées. Contrastes et textes alternatifs : conformes.
- Déjà en place : limite anti-spam des formulaires publics
  (`limiter_soumissions_publiques`), code de validation admin vérifié par la base avec
  limite de tentatives, aucune redirection ouverte.
- **Reste** : documents légaux de l'entreprise (CGU, page cookies, remboursement des
  droits d'inscription) — en attente des documents de la propriétaire (rappel le 04/10).
  Le « code validé » de l'administration n'est gardé que dans l'onglet (les règles de
  la base ne le vérifient pas) : pour une vraie double authentification, activer le MFA
  de Supabase Auth.

## 💾 Sauvegardes de la base (30 septembre 2026)

Supabase est en offre **gratuite** (choix de la propriétaire) : aucune sauvegarde
fournie. D'où `.github/workflows/sauvegarde-base.yml` + `scripts/sauvegarde-base.sh` :
- chaque **dimanche à 3 h UTC** (et à la demande : onglet Actions → « Run workflow »),
  copie du schéma `public` (structure + données + règles RLS) et de `auth.users`
  (données), compressée puis **chiffrée AES-256** (gpg) avec la phrase secrète de la
  propriétaire ; gardée **90 jours** en « Artifact » de l'exécution ;
- secrets GitHub requis : `SUPABASE_DB_PASSWORD` (mot de passe de la base seul — le serveur « Session pooler » est fixé dans le script ; plus simple et sans risque de caractère spécial) ou, à défaut, `SUPABASE_DB_URL` (adresse « Session pooler » de Supabase →
  bouton Connect, mot de passe compris ; les machines GitHub n'ont pas d'IPv6, la
  connexion directe ne marcherait pas) et `BACKUP_PASSPHRASE` ;
- échec (secret faux, base injoignable, fichier < 2 Ko) → e-mail automatique de GitHub.
- **Restauration testée** le 30/09 sur une base locale : données et 16 règles RLS
  identiques. Procédure :
  `gpg --decrypt ma2m-base-AAAA-MM-JJ.sql.gz.gpg | gunzip | psql "<base vide>" -v ON_ERROR_STOP=1`
  (la base cible doit déjà avoir les schémas Supabase `auth`, `storage` — c'est le cas
  d'un nouveau projet Supabase).
- Les photos ne sont pas dans la base (Cloudflare R2).

## 🔎 Visite complète du site (30 septembre 2026, nuit)

Visite de toutes les pages publiques (FR/EN) sur iPhone, Android, tablette et ordinateur,
avec gestes réels (menu, langue, filtres du Book, sélection, visionneuse, compcard,
fiches) et formulaires remplis jusqu'au bout — **sans aucune écriture** : toutes les
écritures (base, Drive, EmailJS, compteurs de visites, statistiques) étaient interceptées.

- **Formulaires publics et afflux** : la base limite les envois (anti-robots). Les
  formulaires candidature / contact / sélection passent par `insererAvecPatience()`
  (`js/app.js`) : un envoi refusé pour cette seule raison est retenté 3 fois (15, 25,
  35 s) avec un compte à rebours, au lieu d'afficher « Erreur lors de l'envoi ».
  **Extension 102** (à lancer dans Supabase) relève les plafonds : candidatures 60/min
  pour le site et 6/min par connexion ; contact et recruteurs 30/min et 3/min.
- **Charge (lecture seule, site réel)** : une visite de 6 pages = 24 petites lectures
  (≈ 50 Ko). Jusqu'à 50 visiteurs arrivant à la même seconde : tout fonctionne (réponses
  de la base 1 à 4 s). Au-delà, la machine de test elle-même saturait (test témoin sur un
  simple fichier du site) : pas de mesure fiable possible depuis l'environnement de test.
- **Accueil** : les photos des 6 médaillons arrivent en une seule demande groupée
  (`photos_couverture_mannequins`, comme le Book) au lieu de 6 demandes successives.
- **Adresse /en** : Vercel transforme `/en/index.html` en `/en` ; les liens relatifs de
  l'accueil anglais menaient alors aux pages françaises. `js/adresse-en.js` remet la
  barre finale (`history.replaceState`, sans rechargement).
- **Sauts d'affichage corrigés** : Partenaires, Ma sélection (`js/selection-etat.js`),
  The Book (largeur des cartes fixée avant l'arrivée des photos).
- **Outils** : empreintes CSP à recalculer après toute retouche d'un script inline
  (`scripts/verifier-csp.py` pour vérifier).

## 📌 Rappels et suivis (mis à jour le 30 septembre 2026)

Liste de tout ce qui reste à faire ou à surveiller, pour la propriétaire et pour Claude.

**Chantiers « zéro critique » décidés le 06/10/2026 (dans cet ordre, une mise en ligne par chantier)**
1. **Essais automatiques à chaque modification** : ranger les essais Playwright (sans
   écriture réelle) dans le dépôt et les faire tourner par GitHub Actions sur chaque
   pull request, avec `node --check` et `scripts/verifier-csp.py` (déjà
   `.github/workflows/verifier-csp.yml`) ; la fusion est refusée si un essai échoue.
   Programmé : nuit du 7 au 8 octobre, 1 h.
2. ~~Sauvegarde des photos des mannequins~~ : FAIT le 06/10/2026 au soir, sur Google
   Drive (voir « Sauvegarde des photos des mannequins sur Google Drive » plus bas).
3. **Pages HTML en double** (paires FR/EN, en-têtes et pieds de page recopiés) : environ
   5 000 lignes à mettre en commun.
4. Un jour : relecture complète par un développeur humain.

**Rappels programmés**
- **Dimanche 4 octobre 2026** : documents légaux (CGU, page cookies, politique de
  remboursement dont les 45 000 FCFA d'inscription, relecture des CGV de la boutique,
  infos vendeur, mention fiscale) — dès que la propriétaire a les documents de la société.
- **Lundi 5 octobre 2026, puis chaque lundi à 6 h 47 (Abidjan)** : visite automatique du
  site sur 4 appareils, rapport par notification et e-mail. La visite signale ; les
  corrections se font ensuite dans une conversation.
- **Jeudi 8 octobre 2026** : vérifier la consommation Supabase du nouveau mois
  (https://supabase.com/dashboard/org/_/usage) — « Cached Egress » était à 294 % sur le
  mois 6 sept.–6 oct. (photos servies par Supabase avant leur passage chez Cloudflare),
  restriction annoncée au 15 octobre si le dépassement continuait.

**À faire par la propriétaire**
- Corriger dans le tableau de bord les fautes de ses propres textes : « Afik » →
  « Afrik » (actualité Afrik Fashion Week) ; titres « FASHION WEEKS », « FOLIES DE MODE
  14 » ; « 15hrs » → « 15 h » (bandeau, casting Newface) ; « AFRICA IN RHYTHM » et
  NOOM/Noum ; « Les belles créations » ; « Créations signées GILLES TOURÉ » ; partenaire
  « GILLES TOURÉ » ; fiche Cha Kane (un « 1 » isolé et des `` à la fin).
- Alerte de disponibilité du site (UptimeRobot) et droits sur les photos (audit de conformité).
- Supprimer le secret GitHub devenu inutile SUPABASE_DB_URL (facultatif).

**Prochaines étapes techniques**
- ✅ **Tableau de bord (30/09)** : menu limité au bloc choisi (BLOC 1/2/3), page gardée
  dans l'adresse (#…) au rechargement, boutons « touche de clavier » (css/tableau-boutons.css),
  avatar « MA » retiré, cloche 🔔 → page « À traiter ».
- ⚠️ **Limite de publication Vercel (offre gratuite, 100 publications / 24 h)** : chaque
  demande de fusion compte DEUX publications (aperçu + mise en ligne). Les jours de gros
  travaux, regrouper les changements pour ne pas atteindre la limite (atteinte le 30/09).
- ✅ **Vidéo de candidature envoyée en morceaux de 4 Mo** (30/09, programme Google
  version 7, autorisation « service externe » donnée) : une vidéo de 20 Mo d'un seul bloc
  faisait échouer le programme (2 et 8 Mo passaient). Essai réel de 20 Mo réussi.
- ✅ **Numéro de l'agence : +225 05 45 65 66 87** (corrigé partout le 30/09 ; l'ancien
  « 68 87 » était faux).
- ✅ **Nouveau formulaire de candidature — EN LIGNE le 30/09** (Extension 104 exécutée,
  programme Google remplacé par scripts/apps-script-photos-drive.gs → version 6, même
  adresse ; si le programme est un jour modifié, repartir de cette copie) :
  - « Intégrer l'agence » : première question « Avez-vous déjà été mannequin ? » Oui / Non.
  - **Non (débutant·e)** — tout obligatoire : nom, e-mail, WhatsApp, date de naissance,
    genre, résidence (ville ; commune si Abidjan ; quartier), niveau d'études, taille
    (blocage 1,75 m F / 1,85 m H déjà en place), poids, taille de vêtements (liste),
    **3 photos** minimum, **vidéo de présentation** (1 minute maximum depuis le 30/09, 60 Mo).
  - **Oui (déjà mannequin)** et **tout casting précis** — tout obligatoire : le formulaire
    complet (taille, poids, pointure, poitrine, tour de taille, hanches, taille de
    vêtements), résidence complète, niveau d'études, **4 photos** minimum, vidéo.
  - Niveau d'études en trois listes : Primaire (CP1 → CM2), Secondaire (6e → Terminale),
    Supérieur (BTS, Licence 1-3, Master 1-2, Doctorat, Autre) ; plus « Je ne suis plus à
    l'école » (dernier niveau atteint) et « Jamais scolarisé(e) ».
  - Tableau de bord : « Débutant·e » / « Déjà mannequin », niveau d'études, quartier,
    lien vers la vidéo. Vidéos rangées dans le Google Drive (jamais dans Supabase).
- Envoi d'e-mails : passer à un service gratuit à 300 e-mails/jour (EmailJS actuel :
  200/mois) — création d'un compte par la propriétaire, guidée pas à pas.
- FAQ du site : quand la propriétaire aura envoyé ses questions.
- Plus tard : vraie double authentification admin ; détection « page figée » sur iPhone.

**Liens de consommation**
- Vercel : https://vercel.com/ma-2-m/~/usage (au 30/09 : 3 % de la bande passante)
- Supabase : https://supabase.com/dashboard/org/_/usage
- Cloudflare (photos) : https://dash.cloudflare.com/?to=/:account/r2/overview (4 % du gratuit)

**Accès de Claude (réglés le 30/09)** : lecture des pages du site et des données
publiques de la base, comme un visiteur. Pas d'accès au tableau de bord, aux données
privées ni aux écrans de consommation (connexion de la propriétaire nécessaire).

## Vidéos tutoriels (30/09/2026)

Trois vidéos de démonstration (présentation du site, comment postuler, inscription à
l'Espace mannequin) ont été filmées en format téléphone, sans rien écrire dans la base :
toutes les écritures sont simulées pendant l'enregistrement.

## Vidéo de candidature allégée, jauges et aperçu (30/09/2026)

- `js/video-allegee.js` : avant l'envoi, l'appareil du candidat réduit sa vidéo en 720p,
  30 images/s, ~1,8 Mbit/s (outil libre Mediabunny, licence MPL-2.0, copié dans
  `js/vendor/mediabunny-1.61.0.min.js`, chargé seulement quand une vidéo est choisie).
  Aucun service extérieur. Si l'appareil ne sait pas le faire, la vidéo d'origine part
  telle quelle (60 Mo maximum, comme avant).
- Formulaire FR/EN : jauges « Photos » et « Vidéo » qui se remplissent pendant l'envoi,
  image d'aperçu de la vidéo, photos agrandies au toucher (`css/jauges-envoi.css`).

## 🤖 Tri des photos par IA, revue des books, adresses lisibles (05–06/10/2026)

> **Retiré le 07/10/2026** (décision de la propriétaire) : `api/trier-photo.js` et
> `api/_revue-book.js` sont supprimés, plus aucun appel à l'IA. Les deux premiers points
> ci-dessous ne sont plus qu'un historique ; la table `revues_book` et les colonnes `tri_*`
> restent en base sans être utilisées (sauf `tri_statut = 'ecartee'`, toujours filtré).
> Section du tableau de bord remplacée par « Photos mises de côté »
> (`js/photos-mises-de-cote.js`) : remettre / garder / supprimer d'un clic, avec confirmation.

- **Tri à l'envoi** (`api/trier-photo.js`, Claude Opus 5.5, clé `ANTHROPIC_API_KEY`
  sur Vercel, crédit prépayé Anthropic) : chaque nouvelle photo est classée `book`
  ou `digital` (rubrique « Digitals & Lifestyle » de la fiche) ; une photo
  clairement inutilisable (certitude ≥ 0,8) est supprimée ; en cas de doute
  `a_verifier`. Colonnes `tri_*` de `model_photos` (Extension 116).
- **Revue des books** (`api/_revue-book.js`, appelée par `api/trier-photo.js` avec
  `action: 'revue'` — fichier préfixé `_` car l'offre Vercel limite le nombre de
  fonctions) : l'IA voit tout le book d'un mannequin (images 560 px envoyées par le
  tableau de bord), classe les photos, **propose** les suppressions (jamais de
  suppression sans le clic de l'agence), rédige un rapport, une fiche technique et
  un message WhatsApp (table `revues_book`, Extension 117). Consignes de l'agence :
  défilés, shootings professionnels et campagnes toujours gardés.
- **Numéro fixe des photos** (`model_photos.numero`, Extension 117) : affiché dans
  l'Espace mannequin et cité dans les rapports.
- **Adresses lisibles** (Extension 118, colonne `model_profiles.slug`) :
  `/book/nom-du-mannequin` et `/en/book/…`. `middleware.js` retrouve le mannequin et
  sert `mannequin.html` à cette adresse (en-tête `x-middleware-rewrite`) ; aperçus
  WhatsApp/Facebook inchangés. La fiche a un `<base href="/">` (`/en/` en anglais)
  pour charger ses fichiers depuis n'importe quelle adresse ; `js/adresse-fiche.js`
  lit le nom d'adresse, garde les liens « # » dans la page et affiche la jolie
  adresse dans la barre du navigateur. Les anciennes adresses `?id=` restent valables.
- **Fonction partagée** `convertirSiHeic` dans `js/app.js` (remplace 14 copies).

## 📋 Fiches événement et compcard depuis le tableau de bord (06/10/2026)

- **Fiche événement** (Extension 120) : table privée `fiche_evenement` (régime et
  allergies, TikTok, Facebook, droit à l'image ; les colonnes taille haut / bas ne
  servent plus depuis les tailles calculées de l'Extension 121), remplie par la
  mannequin à l'étape « physique » de son Espace (chaque mannequin ne lit que sa
  ligne). Le tableau de bord (Bloc 2 → « Fiches événement », `js/fiches-evenement-admin.js`)
  télécharge un PDF via `fiche_evenement_admin(id)` (réservée aux admins ; depuis
  l'Extension 121, sans téléphone ni e-mail du mannequin : le PDF n'affiche que les
  contacts de l'agence, `MA2M_TELEPHONES` / `MA2M_EMAIL` dans `js/app.js`). Jamais de
  pièce d'identité. Les mannequins ne peuvent pas télécharger cette fiche.
- **Compcard choisie par l'agence** : liste « Compcard 1 à 5 » sous chaque photo dans
  la fenêtre photos d'un mannequin publié. Fonction commune `affecterCaseCompcard`
  (`js/app.js`) avec l'Espace mannequin : l'ancienne photo d'une case la quitte
  toujours (corrige les doubles photos sur une case signalées le 06/10/2026).
- Constantes partagées `MA2M_SITE` et `MA2M_CONTACT_PDF` (`js/app.js`) pour les PDF.
- Noms des fichiers téléchargés horodatés (`horodatageFichier`, `js/app.js`).

## 📏 Mensurations complètes et tailles calculées (06/10/2026)

- **`js/tailles.js`** (fichier partagé : espace mannequin, fiche publique FR/EN,
  compcard, CV, fiche événement) : les tailles ne sont **jamais saisies**, elles
  sont calculées d'après les mensurations (barèmes standard du prêt-à-porter).
  Femmes : haut = tour de poitrine, bas = tour de hanches. Hommes : haut = tour
  de poitrine, bas = tour de taille. Taille générale = haut et bas (ex. « M-L »).
  Équivalences FR/EU, IT, UK, US, BR, JP, KR, CN (tableau sur la fiche publique).
- **Grille des mensurations MA2M** (décision du 06/10/2026, soir, Extension 123) : les
  tailles XS à L suivent la grille de l'agence (femmes : poitrine XS 78–83, S 84–87,
  M 88–93, L 94–100 ; taille 58–63 / 64–67 / 68–73 / 74–80 ; bassin 84–89 / 90–93 /
  94–99 / 100–106 — hommes : poitrine 86–91 / 92–95 / 96–101 / 102–108 ; taille
  68–73 / 74–77 / 78–83 / 84–90 ; bassin comme les femmes). Pile sur une limite = la
  taille du dessus. La pointure n'entre pas dans le calcul. Maximum L pour tous.
- **Haut, bas et taille maximum** (décisions du 06/10/2026, soir) : selon la norme du
  prêt-à-porter, **haut = tour de poitrine seul** ; **bas = le plus grand entre tour de
  bassin et tour de taille** (femmes comme hommes). Femmes : S ou M recommandé, L toléré ;
  hommes (07/10/2026) : M ou L recommandé, XL toléré. Au-delà
  — `MAX_FEMMES` / `MAX_HOMMES` dans `js/tailles.js` — « Mensurations
  excessives » en rouge dans l'Espace (accueil et étape physique) et dans le Rapport des
  profils, avec les repères S/M(/L) ; rien n'est caché au public pour autant.
- **Mesures incohérentes** : femmes, bas plus grand que le haut de plus de 2
  tailles (ou plus petit de plus d'1) ; hommes, haut plus grand que le bas de plus
  de 2 tailles (ou plus petit de plus d'1). Écarts adaptés aux morphologies
  africaines (décision de la propriétaire). Effets : cases en rouge « Mensuration
  pas exacte, à reprendre » dans l'espace, aucune taille donnée, mensurations
  cachées sur la fiche publique et la compcard ; **après 7 jours sans correction,
  la fiche est invisible du public** (règle de lecture de la base) ; tout revient
  automatiquement dès la correction.
- **Extension 121** : colonnes `shoulder_cm`, `arm_cm`, `neck_cm`, `head_cm`,
  `mesures_a_reprendre_depuis` (posée par la base, jamais par la mannequin),
  fonctions `rang_taille` / `mesures_incoherentes` — **même barème et même règle
  que `js/tailles.js` : toute modification se fait aux deux endroits** —, nouvelle
  version de `fiche_evenement_admin` (sans téléphone ni e-mail du mannequin) et de
  la règle « Profils publiés visibles de tous ».

## 🩺 Rapport des profils (tableau de bord, 06/10/2026)

- **`js/rapport-profils-admin.js`**, rubrique « Rapport des profils » (Bloc 2) :
  pour chaque mannequin, mensurations manquantes ou incohérentes (`js/tailles.js`),
  photo de profil, couverture, book (10 photos minimum, Book et Lifestyle ensemble, décision du 07/10/2026 ; le
  message dit combien il en reste à publier ; les cases de compcard non
  choisies se complètent seules avec le book), photos
  « à remplacer » laissées par la revue stricte des books (aucun nouvel appel à
  l'IA). Message personnel prêt (modifiable), envoi WhatsApp une personne après
  l'autre (un appui chacune ; sans numéro, le message est copié) ; date du dernier
  envoi notée sur l'appareil. Un profil prévenu le jour même passe dans « Messages
  envoyés aujourd'hui » ; bouton « Actualiser » pour refaire l'analyse.
- **Fonctions partagées ajoutées dans `js/app.js`** : `numeroWhatsApp(tel)` (format
  wa.me), `prenomDe(nom)`, `lireToutesLignes(fabrique)` (lecture par paquets de 1000),
  `texteMensurationsCv(p, sexe)`, constantes `MA2M_TELEPHONES` / `MA2M_EMAIL`.
- **Règle de cohérence écrite deux fois** (JS pour l'affichage immédiat dans l'Espace,
  SQL pour le délai de 7 jours) : voir la section Mensurations ci-dessus.

## 📄 Note d'intégration et frais d'intégration (14/10/2026)

- **Frais** : 25 000 FCFA (inscription 15 000 + premier mois de formation 10 000), au lieu de
  45 000 — pages `inscription-mannequin.html` FR/EN, lien Wave `amount=25000`, reçu.
  Paiement par Wave uniquement (lien, vérification manuelle de la référence). Le paiement
  intégré Wave (Checkout + confirmation automatique) demanderait un compte Wave Business avec
  accès API : chantier possible plus tard.
- **Note d'information et procédure d'intégration (PDF)** : remise aux mannequins seulement
  après un code d'inscription valable. Jamais dans le dépôt (public). Rangée dans R2 sous
  `prive/note-integration/<32 caractères hexadécimaux>.pdf` (`CHEMIN_NOTE_INTEGRATION`,
  `notesIntegration()`, `nettoyerNotesIntegration()` dans `api/_r2.js`) : le stockage public ne
  permet pas de lister les fichiers, le nom ne se devine pas.
  - Dépôt : tableau de bord → Sécurité & accès → Codes d'inscription → « Note d'intégration
    (PDF) » (`js/tableau-de-bord.js`, `actionImageSite()` / `envoyerImageSite()` de `js/app.js`),
    via `api/r2-site-images.js` catégorie `note-integration` (PDF seul, nom secret obligatoire,
    actions `lire` et `nettoyer`, admin seulement). Un nouveau dépôt remplace l'ancien.
  - Remise : `api/code-protege.js`, type `inscription`, ajoute `note` (chemin du document le
    plus récent, en 3 s au plus, sinon `null`) quand le code est valable ;
    `js/inscription-mannequin.js` affiche alors l'encadré avec un lien vers l'adresse photos
    Cloudflare. **Jamais par le relais `/book-photos/`** : Vercel le garde un an en mémoire,
    un document remplacé y resterait accessible.
  - Nettoyage : seuls les documents PLUS ANCIENS que le nouveau sont retirés, et rien si le
    document indiqué n'existe pas (deux dépôts proches ne s'effacent jamais l'un l'autre).
    Un échec du nettoyage n'annule pas le dépôt (refait au dépôt suivant).
  - Traitement à part dans `api/r2-site-images.js` (`traiterNoteIntegration()` de
    `api/_r2.js`), sans toucher aux contrôles des images.
  - Test : `scripts/tests-visiteur/test-note-integration.js`.
  - Variables Vercel `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
    `R2_BUCKET_NAME`, `R2_PUBLIC_URL` : cochées aussi pour **Preview** le 14/10/2026 (sinon la
    version d'essai affiche « Configuration serveur incomplète »). Une variable modifiée ne
    s'applique qu'aux versions construites ensuite (les 5 cochées et vérifiées le 14/10/2026).

- **Code permanent « Créer mon compte » (14/10/2026)** : après « Définir ce code », le code reste
  affiché avec un bouton « Copier le code » (`brancherCopieCode()` de `js/tableau-de-bord.js`,
  partagé avec les codes d'inscription). Test : `test-code-permanent.js`.

## 💾 Sauvegarde des photos des mannequins sur Google Drive (06/10/2026)

- **Extension 122** : table privée `cle_sauvegarde_photos` (empreinte sha256 d'une clé
  secrète, jamais la clé elle-même) et fonction `photos_a_sauvegarder(cle)` qui, avec la
  bonne clé, renvoie la liste de toutes les photos (mannequin, numéro, adresse). Relancer
  le dernier bloc de l'Extension 122 crée une nouvelle clé et annule l'ancienne.
- **`scripts/sauvegarde-photos-google-drive.gs`** : script Google Apps Script installé
  dans le compte Google de l'agence (script.google.com), avec la clé collée à la ligne
  `CLE_SAUVEGARDE`. Fonction `installer()` lancée une fois : passage automatique toutes
  les heures. Dossier Drive « Sauvegarde photos MA2M », un sous-dossier par mannequin ;
  seules les nouvelles photos sont copiées (index `_index-sauvegarde.json`, enregistré
  toutes les 10 photos ; photo introuvable sur le site = notée « absente », plus
  réessayée), liste lue par paquets de 1000, un seul passage à la fois (verrou), dossier
  d'une mannequin retrouvé par son identifiant même si son nom change ; rien n'est jamais
  effacé du Drive ; bilan du dernier passage dans `_dernier-passage.txt`. Version
  installée le 06/10 au soir : la première ; la version améliorée du dépôt est à recoller
  dans le script Google (même clé) à l'occasion.
- La base Supabase reste sauvegardée chaque semaine par `.github/workflows/sauvegarde-base.yml`.

## 🎬 Page « Qui sommes-nous » animée (06/10/2026)

- Pages : `qui-sommes-nous.html` et `en/qui-sommes-nous.html` (« About us »), style dans
  `css/qui-sommes-nous.css`, comportement dans `js/qui-sommes-nous.js` (partagé FR/EN).
- Lien du menu ajouté **une seule fois** par `js/menu.js` (juste après « Accueil / Home »),
  pour toutes les pages ; les deux pages elles-mêmes l'ont en dur (classe `actif`).
- Photos lues dans la base (lecture publique) : photos des événements (`evenement_photos`,
  la photo de couverture `image_url` ne sert qu'en dernier recours car c'est souvent une
  affiche), portrait du fondateur (`mot_responsable`), une photo par mannequin publié
  (`model_photos`, profils masqués exclus par la base). Chaque événement enregistré dans le
  tableau de bord reçoit automatiquement sa carte (un même titre sur plusieurs dates = une carte).
- **Aucun montant ni moyen de paiement** sur cette page (décision de la propriétaire) : l'inscription dit seulement
  que l'agence confirme l'inscription (ni montant ni moyen de paiement cités, demande du 06/10/2026).
- Pas de couverture animée (faisceau ou vidéo de couverture) sur ces deux pages, retirée à la
  demande de la propriétaire : les photos des défilés ouvrent directement la page.
- Animations : toutes sous la classe `.qsn-mouvement`, posée par le JS uniquement si
  l'appareil accepte les animations (`prefers-reduced-motion`). Sans JS ou en mode
  « réduire les animations », la page est fixe et entièrement lisible.
- Piège connu : un élément caché par son propre `clip-path` n'est jamais signalé visible par
  `IntersectionObserver` dans Chrome ; le JS observe donc le **parent** des `.qsn-rideau`.
- Polices : on garde Cormorant Garamond + Jost (un essai Bodoni Moda + Hanken Grotesk a été
  montré puis refusé par la propriétaire le 06/10/2026).

## 📅 Agenda MA2M (06/10/2026)

- Idée de la propriétaire : montrer aux clients le programme de l'agence (shootings, défilés,
  castings, formations, événements) avec le photographe, les partenaires et les mannequins.
- Base : **Extension 124** (`agenda_projets`, lisible et modifiable par les admins seulement ;
  fonction publique `agenda_public()`). Le public ne reçoit **jamais** l'heure, l'adresse ni les
  notes internes (sécurité des mannequins, dont des mineures) ; seuls les mannequins dont le
  profil est visible sur le site sont cités (mêmes règles que le Book). Projets de plus de
  12 mois et projets « cachés du site » exclus.
- Tableau de bord : Bloc 3 → « Agenda du site » (`js/agenda-admin.js`, section
  `data-section="b3c-agenda"`). Chargement au premier affichage de la rubrique.
- Site : pages `agenda.html` / `en/agenda.html` et encart « À venir » de l'accueil FR/EN
  (`data-agenda-accueil`, caché s'il n'y a rien à venir), tous remplis par `js/agenda.js`,
  style `css/agenda.css`. Libellés des types et format des dates partagés dans `js/app.js`
  (`MA2M_TYPES_AGENDA`, `libelleTypeAgenda`, `dateAgenda`).
- Page Agenda = **agenda en ligne** d'après le modèle montré par la propriétaire (calendrier
  de sa tablette) : `#agenda-calendrier`, vues Année / Mois / Semaine / Jour, numéros de semaine
  ISO (semaine du lundi au dimanche), projets écrits dans les cases avec une couleur par type
  (points de couleur sur téléphone), panneau du jour choisi en grand + prochains projets avec
  compte à rebours (« dans 2 jours »). Un clic sur un jour remplit la liste détaillée
  (`#agenda-avenir`, bouton « Voir tous les projets à venir » pour revenir). Les projets sont
  indexés par jour une seule fois (`indexParJour`) ; le focus clavier est conservé à chaque
  nouveau dessin (attributs `data-cle`), et une zone invisible annonce le mois aux lecteurs d'écran.
- Menu : `js/menu.js` ajoute « Agenda » après « Événements » (et « Qui sommes-nous » après
  « Accueil ») pour toutes les pages, une seule fois.
- **Extension 125 (agenda généraliste)** : types élargis (défilé, show, shooting, casting,
  essayages, masterclass, formation, rencontre, événement, autre — liste partagée
  `MA2M_TYPES_AGENDA`), **intervenants** libres (`intervenants` jsonb : rôle + nom, rôles
  proposés dans `MA2M_ROLES_INTERVENANTS` ; l'ancien champ `photographe` est repris), **lieu**
  visible, **horaires jour par jour** (`seances` jsonb : jour, début, fin) montrés au public
  seulement si `horaires_publics` est coché. Un nouveau partenaire peut être enregistré depuis
  le formulaire de l'agenda (il rejoint la table `partenaires`, donc la page Partenaires).
- Ordre de mise en service : exécuter l'Extension 124 dans Supabase **avant** la mise en
  ligne ; sinon la page affiche simplement « Nos prochains projets seront affichés ici très bientôt ».

## ⬛ Fond noir partout (06/10/2026, décision de la propriétaire) — REMPLACÉ le 18/10/2026 par la charte claire (voir « REFONTE OCTOBRE 2026 » en haut)

- Les fonds du site sont **noirs**, sans teinte rouge bordeaux : `--noir` (#060606), `--noir-doux`
  (#0f0f10) et `--anthracite` (#0e0e0f) sont neutres ; les sections `.fond-anthracite` ont un
  léger reflet « noir brillant » (`--noir-brillant`). Le bordeaux reste réservé aux accents
  (boutons, liens, petits survols, filets), jamais aux grands fonds de section.

## 📅 Agenda : couleurs par type, fonds noirs, événements repris, listes courtes (06/10/2026, soir)

- L'agenda garde **une couleur par type de projet** (défilé, shooting, casting…), voulue par la
  propriétaire pour reconnaître les événements d'un coup d'œil. Ce qui doit rester **noir**,
  partout sur le site, ce sont les **fonds** et les **survols** (aucune lueur ni fond bordeaux) ;
  le bordeaux reste pour les écritures d'accent, les filets et les boutons.
- Les **événements de la page « Événements »** (table `evenements`) sont repris
  automatiquement dans le calendrier et dans « Réalisés » (`evenementsDuSite` dans
  `js/agenda.js`) : jours consécutifs d'un même titre regroupés, pas de doublon avec un projet
  déjà saisi dans l'agenda, lien « Voir les photos sur la page Événements ».
- Listes affichées **par paquets de 6** avec un bouton « Voir plus » (`PAQUET`), pour que la
  page reste lisible avec des dizaines ou des centaines de projets ; « Réalisés » en cartes
  compactes.
- `titreLisible()` (js/app.js, partagée avec « Qui sommes-nous ») met en forme les titres
  saisis en capitales (« Africa in Rythm », « Parc des Expositions d'Abidjan »).

## 🧹 Regroupement du code recopié (nuit du 07/10/2026)

Aucun changement visible : le même code était recopié dans plusieurs fichiers, il n'existe
plus qu'à un seul endroit.

- **Fonctions serveur** : `api/_commun.js` (le « _ » évite que Vercel le compte dans la
  limite de 12 fonctions) regroupe la vérification du jeton de connexion
  (`verifierUtilisateur`), la vérification administrateur (`lignesAdmin` / `estAdmin`,
  refus si la base ne répond pas), la lecture du jeton et du corps de la requête,
  les en-têtes de la clé serveur (`enTetesService`), la connexion au stockage photos R2 (`creerClientR2`), le contrôle des chemins de
  fichier (`cheminSur`), l'adresse IP et l'identifiant d'appareil. Utilisé par
  r2-presigner, r2-site-images, code-protege,
  code-validation-protege, connexion-protegee, connexion-admin, creer-admin,
  supprimer-mannequin.
- **Envoi d'une photo de Book** : une seule chaîne dans `js/app.js`,
  `envoyerPhotoBook(modelId, fichier)` (conversion HEIC, compression de l'originale,
  miniature 800 px, moyenne 1400 px, envoi R2 avec 3 essais), utilisée par l'Espace
  mannequin et le tableau de bord. Outils associés au même endroit : `uploaderVersR2`,
  `supprimerDeR2`, `jetonSessionCourante`, `idAppareilMa2m`, `aleatoire()` /
  `suffixeAleatoire()` (hasard sûr `crypto.getRandomValues`, plus de `Math.random`).
  Remplacement d'une photo au tableau de bord : la base est mise à jour d'abord, les
  anciens fichiers effacés ensuite ; si la base refuse, les fichiers tout juste envoyés
  sont retirés (pas de fichier « orphelin »). Le mannequin concerné est mémorisé au début
  de l'envoi (fermer la fenêtre pendant l'envoi ne mélange plus rien). Seul petit
  changement : au tableau de bord aussi, une capture PNG/WebP de plus de 900 Ko est
  désormais allégée en JPEG (comme dans l'Espace mannequin depuis le 28/09/2026).
  Le tri automatique par IA après un envoi passe par `trierPhotoEnArrierePlan(photoId)`
  (js/app.js), commun aux deux pages.
- **Compcard** : une seule fonction de dessin `construireCanvasCompcard(ficheData, langue)`
  et `genererFiche(format, ficheData, idPdf, idJpeg, langue)` ; `langue = 'en'` pour la fiche
  anglaise (libellés anglais, mesures impériales `enPieds`/`enPouces`/`enLivres`/`pointureUS`,
  couleurs traduites `enAnglais`). Les mensurations viennent de `champsCompcard()` : masquage
  « à reprendre » et libellé « Bassin » en français conservés. Vérifié : fiches FR et EN
  identiques au pixel près avant/après.
- Reste à faire plus tard (prudence) : les paires de scripts FR/EN encore recopiées
  (accueil, mannequins, actualités/événements) et les pages HTML en double.

## ✅ Remarques de fiabilité SonarQube traitées (07/10/2026, matin — demande de la propriétaire)

- **Étiquettes de formulaires** (95 remarques) : chaque champ a une étiquette lue par les
  lecteurs d'écran — `<label for="id">` quand un libellé visible existe juste au-dessus,
  sinon `aria-label` (repris du texte d'exemple ou du libellé du sélecteur d'indicatif pour
  les numéros de téléphone). À respecter pour tout nouveau champ.
- **Actions lancées en arrière-plan** (`chargerActualites()`, `demarrer()`,
  `supprimerDeR2()`…) : marquées `void appel();` pour dire « on n'attend pas la réponse,
  volontairement ». Leur éventuel échec n'est pas perdu : il est capté par la surveillance
  globale (`js/surveillance.js`, `unhandledrejection` → journal d'erreurs + Sentry).
- Lecture des vidéos : `Promise.resolve(v.play()).catch(...)` (plus de test « si p » sur une
  promesse). Polices de la Compcard : `await document.fonts.ready`.
- Hasard : `aleatoire()` utilise toujours `crypto.getRandomValues` (plus de `Math.random`) ;
  le souffle des effets sonores est tiré par `remplirBruitBlanc(donnees)` (js/app.js), par
  paquets de 16 384 valeurs (limite du navigateur).
- Boutique : un code de billet venant de l'adresse (`?billet=`) n'est gardé en mémoire
  d'onglet après nettoyage par `codeBilletPropre()` (espaces retirés, majuscules, code
  reconstruit à partir des seuls lettres, chiffres et tirets, 4 à 40 caractères ; sinon ignoré).
- CSS : propriétés écrasées ou inconnues retirées sans changement visible ; la barre du
  nouveau code d'inscription (`.tdb-20`) reste cachée tant qu'aucun code n'est généré
  (avant, une barre vide s'affichait).
- `supabase-extension.sql` : l'ancienne mise à jour de tous les niveaux porte `where true`
  (toutes les fiches, voulu) et le déclencheur des adresses de fiche compare des longueurs
  au lieu de chaînes vides (même résultat ; avertissement SonarQube pensé pour Oracle).
  Rien à exécuter dans Supabase : comportement identique.

## 📸 Instagram obligatoire, tour de tête retiré (07/10/2026, décision de la propriétaire)

- **Instagram** : obligatoire à l'étape « Identité » de l'Espace mannequin — soit un compte,
  soit la case « Je n'ai pas Instagram » (colonne `sans_instagram`, **Extension 126**, lue et
  enregistrée à part pour ne jamais bloquer l'étape si la colonne manque). Fonctions
  `lireInstagramFormulaire()` / `enregistrerSansInstagram()` (js/espace-mannequin.js).
  L'étape 1 n'est « complète » qu'avec l'un des deux.
- **Tour de tête** : n'est plus demandé (Espace), ni affiché (fiches FR/EN, fiche événement),
  ni réclamé par le rapport des profils. La colonne `head_cm` reste en base (rien d'effacé) et
  n'est plus jamais réécrite.

## 📝 Rapport des profils — nouvelle version (07/10/2026, demande de la propriétaire)

`js/rapport-profils-admin.js` (tableau de bord, « Rapport des profils ») rédige un message WhatsApp
(*gras*, _italique_, symboles ; premier texte proposé, choisi par la propriétaire) de
**sensibilisation** (jamais de menace) : « Mlle » / « Monsieur » + nom, points forts, profil
complet à x % (barre), 3 priorités classées (mensurations > identité > parcours > photos),
puis identité, expérience et parcours (projets `model_projects`, études, formation, langues),
mensurations avec les tailles calculées haut / bas / générale (femmes S ou M recommandé, L toléré ;
hommes M ou L recommandé, XL toléré ; au-delà : conseil bienveillant), et les photos en dernier (photo de profil = couverture, moins de
10 photos : « il vous reste N photos à publier »). **Aucune remarque de l'IA** n'est reprise (`tri_raison` ignoré). Lien
New Face sans expérience : jamais réclamée (message encourageant). Lien Espace mannequin en fin de message ; WhatsApp de l'agence cité sans lien (le message part de ce numéro). Constante `MA2M_WHATSAPP` (js/app.js) pour le bouton flottant. Historique des envois remis à
zéro (clé `ma2m_rapport_profils_envois_v2`) + bouton « Réinitialiser l'historique ».
**Message WhatsApp** (décision du 07/10/2026, soir) : toujours et seulement ce qui reste à
régler, bloc par bloc (Identité, Physique, Formation, Expérience, Photos), avec les mêmes
chiffres que les ronds rouges de l'Espace (`ma2mPointsParBloc`, js/analyse-profil.js). Plus
de points forts, de priorités, de « bravo » ni de « Bon à savoir ». L'historique des envois
ne sert plus qu'à ranger les mannequins déjà prévenues aujourd'hui.
Le paragraphe sur les deux catégories de photos s'active avec `CATEGORIES_PHOTOS_ACTIVES`.
Photos : le diagnostic suit **la logique de la fiche publique**, fonction partagée `photosAffichees()` (js/app.js, utilisée aussi par mannequin.html FR/EN) : sans photo de
profil choisie, la fiche montre la plus ancienne photo ; sans couverture choisie, elle reprend la
photo de profil. Le rapport dit donc « vous n'avez pas choisi… votre fiche affiche la même photo
aux deux endroits » au lieu de « ajoutez une photo de profil » (cas réel du 07/10/2026).

## 📒🌿 Photos : Book et Lifestyle, classées par le site sans IA (07/10/2026)

- Colonne `model_photos.categorie` (`book` | `lifestyle`, défaut `book`) — **Extension 127**.
  Toutes les photos existantes sont dans le Book.
- À l'envoi d'une photo (`envoyerPhotoBook`, js/app.js), `categoriePhoto(fichier)` lit l'EXIF
  de la photo d'origine AVANT compression (`lireInfosAppareil`) : logiciel de retouche pro
  (Photoshop, Lightroom, Capture One…) ou appareil photo (Canon, Nikon, Sony Alpha, Fujifilm…)
  → `book` ; téléphone (Apple, Samsung, Tecno, Infinix, Xiaomi…, caméra avant, fichier HEIC)
  → `lifestyle` ; doute → `book` (règle d'origine, remplacée le 12/10/2026, voir ci-dessous). La catégorie est
  enregistrée dès l'insertion de la photo (Extension 127 obligatoire AVANT la mise en ligne).
- Correction : la mannequin peut seulement passer une photo du Book vers Lifestyle (étiquette
  « 📒 Book » dans son Espace) ; seule l'agence remet une photo dans le Book (règle aussi
  imposée par la base, **Extension 128**, déclencheur `proteger_categorie_photo`). Étiquette sur chaque photo de l'Espace
  mannequin, liste déroulante dans la fenêtre photos du tableau de bord.
- Fiche publique FR/EN : section « Book » puis « Digitals & Lifestyle » d'après `categorie`
  (et non plus `tri_statut` de l'IA). Le rapport des profils explique les deux catégories
  (`CATEGORIES_PHOTOS_ACTIVES = true`).
- **Règles plus minutieuses (12/10/2026, books de Lucrèce Ori et Divine Tama, choix « A » de la
  propriétaire)**, dans cet ordre : HEIC/HEIF (iPhone ; « .HIF » des appareils pros exclu) →
  `lifestyle` ; téléphone reconnu → `lifestyle` MÊME retouché (Lightroom…) ; polaroïd
  (`estPolaroid` : cadre de papier clair et uni, plus épais en bas, mesuré sur une version de
  240 px ; JPEG seulement ; avec un appareil pro, un fond blanc pur n'est jamais un cadre) →
  `lifestyle`, même pris avec un appareil pro ;
  appareil ou logiciel pro → `book` ; nom de fichier de téléphone (WhatsApp, capture,
  FullSizeRender, Pixel, Samsung) → `lifestyle`, d'appareil pro (`_MG_`, `3O2A1234`, `DSC_`,
  `DSCF`, Capture One, RAW) → `book` ; sans aucune information : forme de téléphone
  (`formeDeTelephone` : 4 × 3 ou 9 × 16 et plus étroite) → `lifestyle`, sinon `book`. Limite
  connue : une photo pro recadrée en 4 × 3 ou 9 × 16 et transférée par WhatsApp arrive en
  Lifestyle (l'agence la remet dans le Book d'un clic), de même qu'une photo d'appareil moyen
  format ou Micro 4/3 (4 × 3) ; les « digitals » prises à l'appareil pro restent à ranger à la
  main. Essai : `scripts/tests-visiteur/test-tri-photos.js` (règles + envoi réel depuis l'Espace).
- **Plus de tri par l'IA à l'envoi** (`trierPhotoEnArrierePlan` retiré) : décision de la
  propriétaire (logos des organisateurs et même tenue sous plusieurs angles signalés à tort).
  `api/trier-photo.js` a ensuite été supprimé (07/10/2026, voir plus haut).

## Espace mannequin : téléphone (07/10/2026)

`css/espace-mannequin-correctifs.css` : la liste des pays (`#f-tel-indicatif`) et la case du
numéro (`#f-tel-numero`) passent l'une sous l'autre quand la place manque (téléphone,
tablette) et restent côte à côte sur ordinateur. Avant, la liste prenait toute la largeur
et la case du numéro faisait 30 px, hors de l'écran. Contrôle de tous les formulaires
(script de mesure : case trop étroite, hors écran, chevauchement) sur 5 largeurs : aucun
autre cas.

## Pastilles rouges de l'Espace mannequin (07/10/2026)

Règle unique **`js/analyse-profil.js`** (`ma2mAnalyserProfil`, `MA2M_PHOTOS_MINIMUM = 10`),
chargée par `tableau-de-bord.html` (Rapport des profils) et `espace-mannequin.html`.
Dans l'Espace, `pointsARemplir()` (js/espace-mannequin.js) refait cette analyse sur l'état
du formulaire : un rond rouge chiffré sur chaque onglet (assistant) et chaque bloc
(tableau de bord) — éléments manquants **et** mensurations incohérentes (à reprendre / à
vérifier) ; photos = photos manquantes pour arriver à 10 + profil + couverture. En ouvrant
le bloc, `marquerChampsARemplir()` encadre les cases en rouge (classe `champ-a-remplir`,
styles dans `css/espace-mannequin-correctifs.css`) et affiche une phrase d'explication ;
le rouge d'une case s'efface dès qu'elle est remplie, le chiffre se met à jour à
l'enregistrement. L'alerte « Votre profil n'est pas complet » suit la même règle.

## Journal du 07/10/2026 : corrections (mise en ligne du 07/10, fin d'après-midi)

- `js/surveillance.js` : fausses alertes filtrées (traduction automatique et Dark Reader :
  styles en ligne ; feuilles de traduction Google ; `www.google.com/g/collect` ; erreurs à
  une ligne qui n'existe pas dans la page = code ajouté par le navigateur) ; « Média non
  chargé » seulement si le serveur répond une erreur ; « Réseau injoignable » une fois par
  page ; zoom des cases à cocher ignoré ; blocs plein écran (100vw) considérés comme coupant.
- `js/app.js` : photos de compcard / CV re-téléchargées une fois si elles ne se décodent
  pas, et réduites à 2000 px (`COTE_MAX_FICHE`) ; `relancerChargementFiche` = second essai
  automatique de la fiche mannequin FR/EN (rechargement unique si la base n'est pas chargée).
- CSS : filtres de niveau des mannequins qui passent à la ligne en 320 px ; place réservée
  au calendrier de l'agenda (`#agenda-calendrier:empty`) et à la fiche pendant son
  chargement ; photos du book avec `aspect-ratio: auto 2 / 3` (la grille ne saute plus).
- Non modifié : la vidéo de couverture des pages Espace / candidature / tableau de bord
  (c'est la bannière visible en haut de ces pages) ; ses échecs passagers ne sont plus signalés.

## « Créer mon compte » bloqué (corrigé le 11/10/2026, Extension 133)

Depuis le 04/10/2026, `api/code-protege.js` crée le compte d'une nouvelle mannequin
côté serveur (clé service_role) puis sa fiche `model_profiles`. Le déclencheur
`proteger_proprietaire_profil()` (Extension ~93) refusait toute écriture sans
utilisateur connecté : la fiche échouait, le compte était supprimé et la mannequin
voyait « La création du compte a échoué ». L'Extension 133 laisse passer le rôle
`service_role` (serveur seulement) ; rien ne change pour les mannequins et les admins.
**Extension 134 (règle unique)** : `est_ecriture_serveur()` = la requête ne vient pas d'un
navigateur (rôle ni `anon` ni `authenticated` : serveur du site, base elle-même, éditeur
SQL). `proteger_proprietaire_profil()` et `proteger_proprietaire_photo()` la consultent en
premier ; la seconde aurait aussi bloqué la suppression d'un compte de mannequin ayant
des photos (suppression en cascade). ⚠️ Tout NOUVEAU garde-fou commence par
`if est_ecriture_serveur() then return … end if;`.
`api/code-protege.js` écrit maintenant toute panne de création de compte dans le journal
des erreurs (`[Création de compte mannequin] échec : …`, avec la raison de la base).
**Pourquoi l'incident a duré** : le changement de sécurité du 04/10 n'a été essayé qu'avec
une base simulée, jamais avec un vrai compte ; l'échec était silencieux pour l'agence.

## Mise en sourdine d'un profil (11/10/2026, Extension 135)

Bouton « 🔇 Mettre en sourdine / 🔊 Réactiver » sur chaque carte de la liste des
mannequins publiés du tableau de bord (`changerSourdine` dans `tableau-de-bord.html`),
qui appelle la fonction `definir_sourdine(p_model, p_desactive)` (admins seulement).
Rien n'est supprimé : colonnes `model_profiles.desactive`, `desactive_le`, `desactive_par`.
- **Site public** : `profil_visible_public(publie, a_reprendre_depuis, desactive)` (3
  arguments) cache le profil partout (liste, fiche, book, photos, projets, `agenda_public`,
  middleware) puisque toutes ces lectures passent par la règle de lecture des profils.
- **Espace mannequin** : `Store.load` lit `desactive` à part (`state.meta.desactive`) ;
  `render()` n'affiche alors que `viewSourdine()` (message « L'administrateur a désactivé
  votre profil » + lien WhatsApp de l'agence + bouton de déconnexion).
- **Base** : déclencheur `bloquer_profil_en_sourdine()` sur `model_profiles`,
  `model_photos` et `model_projects` : la mannequin ne peut ni changer `desactive`, ni
  rien modifier tant que son profil est en sourdine (serveur et admins passent).

## Formulaire de candidature partagé (11/10/2026, nettoyage du code recopié)

`candidature.html`, `integrer-agence.html` et leurs versions `en/` utilisent un seul script :
`js/formulaire-candidature.js` (avant : quatre copies de ~650 lignes dans les pages).
- Parcours : `<form id="form-casting" data-parcours="projet">` (postuler à un casting précis :
  liste des castings, 4 photos) ou `data-parcours="agence"` (intégrer l'agence : débutant·e
  = formulaire allégé et 3 photos, déjà mannequin = complet et 4 photos).
- Langue : `<html lang="en">` ; chaque texte est écrit `T('français', 'anglais')`.
- Essai visiteur : `scripts/tests-visiteur/test-visiteur.js` couvre les quatre pages.

## Bande au logo animé retirée (11/10/2026, décision de la propriétaire)

La « couverture » (bande noire avec le logo animé ou la vidéo de couverture, au-dessus de la
barre du menu) faisait doublon avec le logo de la barre et prenait un quart de l'écran du
téléphone. Retirée des 21 pages qui l'avaient (`js/couverture-faisceau.js` supprimé), ainsi
que la rubrique « Couverture du site (vidéo) » du tableau de bord. La barre du menu est
maintenant en haut de toutes les pages. Conservés : l'intro de l'accueil (bouton « Entrer »,
`js/faisceau.js` + `js/intro-faisceau.js`) et la « Vidéo de la page d'accueil ». Les règles
CSS `.couverture-faisceau` / `--couv-h` restent sans effet (nettoyage CSS à faire).

## Scripts partagés FR/EN (nettoyage du code recopié, suite, 11/10/2026)
- `js/mannequins.js` : « Nos mannequins » FR et EN (`js/mannequins-en.js` supprimé).
- `js/app.js` : `EN` (page en anglais) et `T('français', 'anglais')` — le traducteur commun à
  tous les scripts FR/EN ; aussi `remplirSelectListe` (« Autre »/« Other »), `urlHttpSure`,
  `verifierAdmin` (panneau d'ajout des pages publiques), `urlIndiqueRecuperationMdp`,
  `URL_SCRIPT_PHOTOS_CASTING`, `redimensionnerImage`, `fichierEnBase64`.
- `js/filet-reveal.js` : filet d'affichage (33 pages, chargé en `async`).
- Un seul script FR/EN par page : `js/accueil.js`, `js/inscription-mannequin.js`,
  `js/contact.js`, `js/demande-recruteur.js` (page Sélection), `js/partenaires.js`,
  `js/actualites.js`, `js/evenements.js` (+ `js/publications.js`, fonctions communes à ces deux).
- Essai visiteur `scripts/tests-visiteur/test-pages-publiques.js` : ces pages en FR et EN.
- `js/fiche-mannequin.js` : fiche d'une mannequin, `mannequin.html` et `en/mannequin.html`
  (avant : deux scripts de ~400 lignes dans les pages). Textes `T('fr', 'en')` ; en anglais,
  équivalents impériaux (`enPieds`, `enPouces`, `enLivres`, `pointureUS` de `js/app.js`).

## Structure commune des pages et formulaire de candidature (11/10/2026, suite du nettoyage)
- `js/gabarit.js` écrit la barre du haut, le menu et le bas de page des 33 pages publiques
  FR/EN. Chaque page ne contient que des emplacements vides (`data-gabarit="entete" |
  "menu" | "pied"`, avec `data-page="nom-du-fichier"` sur la barre du haut) et charge le
  script juste après eux. **Ajouter une page au menu = une ligne dans `PAGES`.**
  `data-autre-langue` : page de l'autre langue quand elle n'existe pas (Espace mannequin).
  Pages non concernées : tableau de bord, 404, réinitialisation du mot de passe, boutique.
- `js/formulaire-candidature-champs.js` : les champs du formulaire de candidature, écrits une
  seule fois pour les 4 pages (casting / intégrer l'agence, FR / EN), dans la bonne langue.
- `js/tableau-de-bord.js` : programme principal du tableau de bord (avant écrit dans la page).
- `.sonarcloud.properties` : le journal SQL (historique des Extensions) est exclu du seul
  calcul des doublons SonarQube.
- Essai visiteur `test-pages-publiques.js` : vérifie aussi lien de langue, menu et bas de page.

## Parcours MA2M (11/10/2026, Extension 136)
Bilan public des activités des mannequins, **calculé à partir de l'agenda** (aucune saisie en
double) : un projet passé, visible et non annulé compte automatiquement.
- Tableau de bord, Agenda : champs **Pays** et **Projet annulé** (`agenda_projets.pays`,
  `.annule` ; un projet annulé disparaît aussi de l'agenda public).
- Base : `parcours_public(début, fin[, mannequin])` — type, titre, dates, lieu, ville, pays et
  mannequins publiques (id, nom, slug). Jamais l'adresse exacte, l'heure, les notes, les contacts.
- Page `parcours.html` / `en/parcours.html` (`js/parcours.js`, `css/parcours.css`) : frise des
  24 derniers mois, chiffres animés, mur des visages (mannequins actives du mois, 18 puis
  « Voir les autres »), détail par mannequin, projets du mois par type ; animations coupées si
  le visiteur demande moins de mouvement.
- Fiche mannequin : la rubrique « Avec MA2M » a été retirée le 12/10/2026 (demande de la
  propriétaire) ; les projets de l'agence restent dans les expériences (« Parcours » de la fiche).
- Outils communs dans `js/app.js` : `ma2mParcours`, `ma2mCompteParType`, `nombreTypeAgenda`,
  `lienFicheMannequin` (aussi utilisé par `js/agenda.js`).
- Essais : `test-pages-publiques.js` (page FR/EN + fiche), `test-admin.js` (pays + annulé).

## Menu « Modèle A » (11/10/2026, choisi par la propriétaire parmi 4 maquettes)
Menu plein écran, grands titres numérotés 01, 02… (police des titres), rubrique ouverte en
rouge (écrite droite comme les autres, demande du 11/10/2026), « Intégrer l'agence » en grand bouton rouge et « Espace mannequin » en bouton
contour. Style : `css/menu.css` (appelé par un `<link>` avant `css/style.css` ou `css/entete-site.css`,
sélecteurs préfixés `html body` pour passer devant l'ancien tiroir). Ordre et libellés : liste
`PAGES` de `js/gabarit.js`. Le Parcours MA2M n'affiche que les projets où au moins une de nos
mannequins publiées est cochée (`ma2mParcours`, js/app.js).
`js/menu.js` ajoute Femmes / Hommes sous The Book puis pose `--rang` (ordre d'apparition en
cascade) sur chaque ligne ; le lien « Marketplace » des administratrices reste non numéroté, en
rouge. L'ancien voile sombre et les titres de groupes du tiroir ont été supprimés. L'ordre du
bas de page suit `PAGES`. Essais : `test-pages-publiques.js` vérifie l'ordre du menu, le bouton
« Intégrer l'agence » et qu'un projet sans nos mannequins n'apparaît pas dans le Parcours.

## « Autres mannequins » dans l'agenda (Extension 137, 11/10/2026)
Une mannequin de l'agence sans profil sur le site (nouvelle recrue) peut être écrite à la main
sur un projet : champ `#agenda-autres` du tableau de bord (un nom par ligne, 40 noms de 80
caractères au plus, doublons retirés par `lireAutres()` dans `js/agenda-admin.js`), enregistré
dans `agenda_projets.mannequins_libres`. La fonction SQL `mannequins_publics_projet(ids, noms)`
est la règle unique qui fabrique la liste publique des mannequins d'un projet (profils visibles
du public + noms écrits, ces derniers avec `id` et `slug` vides, une seule fois chacun et
jamais en double d'une mannequin cochée) pour `agenda_public` et
`parcours_public`. Côté site, `lienFicheMannequin(m)` renvoie un lien vide pour ces noms :
agenda et Parcours les affichent sans lien ni photo (logo par défaut). Tant que l'Extension 137
n'est pas collée, le formulaire n'envoie le champ que si des noms sont écrits (message clair
en cas d'erreur). Essais : `test-admin.js` (envoi des noms) et `test-pages-publiques.js`.

## Menu agrandi et animé (11/10/2026, demande de la propriétaire)
`css/menu.css` : ouverture et fermeture en cercle depuis le bouton Menu (`clip-path`), rubriques qui montent une à une (`--rang`), très grands titres
(`clamp(2rem, 8.6vw, 3.6rem)`), deux colonnes à partir de 1024 px de large pour que tout tienne
sur une page. Aucune animation si le visiteur a demandé moins de mouvement.

## Bas de page du tableau de bord (11/10/2026)
`body.zone-admin` en colonne flexible, hauteur minimale de l'écran, bas de page poussé en bas
(`css/style.css`, fin du fichier) : l'écran de connexion n'a plus l'air coupé en deux.

## « Autres partenaires » et bandeau « Vous modifiez » dans l'agenda (Extension 138, 11/10/2026)
Un partenaire INDIRECT d'un projet (venu par un intermédiaire) s'écrit à la main dans
`#agenda-autres-partenaires` (un nom par ligne) : enregistré dans
`agenda_projets.partenaires_libres`, jamais ajouté à la table `partenaires` (page Partenaires).
`agenda_public` le renvoie dans `partenaires` avec `id` et `logo_url` vides ; `js/agenda.js`
l'affiche sans lien. Même précaution que l'Extension 137 tant que la colonne manque.
Règle commune des noms écrits (mannequins et partenaires) : `noms_libres_publics(noms, exclus)`,
utilisée par `mannequins_publics_projet` et `partenaires_publics_projet`. Un nom écrit qui est
déjà l'un de nos partenaires est coché automatiquement à l'enregistrement. Les ids d'un projet
modifié absents des listes chargées sont gardés (`idsGardes`).
« Modifier » ouvre un bandeau `#agenda-en-cours` (titre + dates du projet) et encadre sa ligne
(`.agenda-ligne.en-modif`) : le 11/10/2026, la propriétaire avait ouvert Abidjan Border Forum
(premier bouton « Modifier », liste « À venir ») en croyant ouvrir Cacao Fashion Show.
Essais : `test-admin.js` (étapes 8 et 9) et `test-pages-publiques.js` (page Agenda).

## Expériences des mannequins synchronisées avec l'agenda (12/10/2026)
Chaque projet réalisé avec l'agence (agenda → `parcours_public`, filtré sur la mannequin)
apparaît tout seul dans ses expériences : fiche publique (parcours, sans mention « avec MA2M » depuis le 12/10/2026), CV
(Espace mannequin et tableau de bord), Espace mannequin (bloc « Ajoutés automatiquement par
l'agence », en lecture seule). Rien n'est écrit ni effacé dans `model_projects` : la fusion se
fait à l'affichage, règle unique dans `js/app.js` : `ma2mExperiencesAgence(id)`,
`fusionnerExperiences(agence, propres)`, `memeProjet(a, b)` (même nom, majuscules, accents,
ponctuation et années ignorés, et même année si la mannequin en a indiqué une),
`experiencePourCv(e)`. Un nom d’au moins trois mots contenu mot pour mot dans l’autre compte aussi
(« JNCC/ cacao fashion show » = « Cacao Fashion Show »). Seuls les défilés, shows, shootings, événements et projets comptent
(pas les castings, essayages, formations, masterclasses, rencontres). `ma2mParcours` garde
ses réponses en mémoire : un seul appel au serveur par page et par période. Une ligne écrite par la
mannequin pour le même projet est remplacée par celle de l'agence (et signalée dans son Espace,
où elle peut la supprimer). Parcours MA2M : visages ronds. Essais : `test-pages-publiques.js`
(fiche avec doublons) et `test-espace-experiences.js` (Espace + CV).

## Formulaire d'expérience enrichi (Extension 139, 12/10/2026)
Espace mannequin, étape « Expérience » : type, nom, date (ou année, texte libre), pays, ville,
lieu (salle, hôtel, studio… — nouvelle colonne `model_projects.lieu`), promoteur / styliste /
marque / institution (`promoteur`). Tout est facultatif. Conversion unique
`experienceDepuisBase` / `experienceVersBase` (js/espace-mannequin.js) ; la colonne `lieu`
n'est envoyée que si elle est remplie tant qu'elle n'a pas été vue (avant l'Extension 139).
La fiche publique affiche lieu, ville et pays ; le CV reste court (nom, ville, date) pour ne
pas le surcharger ; la compcard ne liste pas les expériences (seulement leur nombre).

## Menu, Parcours, fiche et Espace (12/10/2026, suite)
- Menu : rubriques à la taille et dans la police du bouton « Espace mannequin de l'agence »
  (0,95 rem, lettres espacées) ; ouverture : rubriques qui arrivent floues puis nettes, grand
  filigrane « MA2M » qui traverse le fond ; appui du doigt : voile rouge qui se remplit, puis la
  page s'ouvre 0,25 s plus tard (`js/menu.js`, classe `appui`).
- Parcours : motion design au défilement (`mettreEnScene`, IntersectionObserver, classes
  `pm-entree` / `pm-vu`) : compteurs lancés à leur arrivée, visages qui éclosent avec anneau et
  pastille, cartes avec filet, titre mot à mot (`decouperTitre`), filigrane qui dérive.
- Fiche : « Avec MA2M » devient un résumé chiffré (plus de liste) — les projets ne sont plus
  montrés deux fois au visiteur ; le détail reste dans « Parcours ». (Résumé retiré le 12/10/2026.)
- Espace mannequin : les lignes qui répètent un projet de l'agence sont masquées, avec un bouton
  « Supprimer ces doublons » (action de la mannequin, avec confirmation).

## SonarQube : programmes d'essai déclarés comme essais (12/10/2026)
`.sonarcloud.properties` : `scripts/tests-visiteur/**` exclu du code du site et déclaré en
`sonar.tests`. Leurs alertes (port tiré au hasard, démarrage du serveur local) faisaient
descendre les notes de fiabilité et de sécurité à C alors qu'ils ne sont jamais envoyés aux
visiteurs. `js/tableau-v2.js` : `ouvrirFicheSure()` signale au journal une panne d'ouverture
de fiche au lieu de la laisser passer inaperçue.

**20/10/2026 (audit général)** : `scripts/base-essai/**` déclaré de la même façon (ses `update`
sans `where` visent exprès une table de la base d'essai jetable). `void` ajouté devant
`entrer()`, `paye()`, `chargerLien()` (js/inscription-simplifiee.js) et `lancer()`
(js/mode-administration.js) : ces fonctions gèrent déjà leurs erreurs elles-mêmes (règle S9383).
Alerte « Browser Storage Poisoning » sur `ma2m_retour_administration` (mode-administration.js) :
fausse alerte, l'adresse relue est filtrée par une liste stricte (js/portail/noyau.js) avant
tout `location.replace`.

## Code recopié → 0 % (12/10/2026)
Regroupements faits pour supprimer les derniers blocs recopiés signalés par SonarQube :
- Boutique : `js/gabarit-boutique.js` (haut de page, menu, barre, panier, bas de page des 6
  pages ; emplacements `data-gabarit-boutique`), polices chargées par `css/marketplace.css`.
- Accueil FR/EN : script de démarrage dans `js/accueil-debut.js` (chargé sans async en haut
  du `<body>`). Candidature / Intégrer l'agence : `css/candidature.css`, visionneuse créée par
  `js/formulaire-candidature.js`. Contact : icônes des réseaux via `data-gabarit="reseaux"`.
- Actualités / Événements : `afficherMediasPublication`, `brancherRedaction`,
  `envoyerPhotosPublication`, `enregistrerPhotosPublication`, `supprimerPublication`
  (`js/publications.js`, constante `PUBLICATION` dans chaque page). Depuis le 20/10/2026 (code
  recopié signalé par jscpd) aussi : `ouvrirRedactionPublication`, `enregistrerPublication`,
  `messageRedaction`, `montrerFichePublication`, `brancherFicheLecture` et l'état `redaction`
  ({ id, images }) ; chaque page ne garde que ses champs propres (catégorie et vidéo ; date et
  lieu). Essai : `test-publications.js` (publier, titre obligatoire d'un événement, modifier,
  supprimer, se déconnecter). Le bloc d'administration de ces pages (dont « Voir le tableau de
  bord ») ne s'affiche qu'avec une session admin, donc sur l'adresse de l'Administration.
- Verrou du défilement (porte d'entrée, menu, fenêtres) : `js/verrou-defilement.js`, chargé sans
  defer juste avant `js/app.js` sur chaque page (tout en haut du body sur l'accueil).
- CV de la mannequin : `css/cv-mannequin.css` (Espace + tableau de bord, rendu identique au pixel ;
  règles jamais utilisées retirées).
- `js/app.js` : `reduireEnJpeg` (sur `redessinerPhoto`), `messageAccesRefuse`,
  `remplirTailleMinimale` ; `js/messages-candidats.js` : `entreeMessage` (textes identiques).
- `api/_commun.js` : `debutRequete`, `compteurTentatives` (blocage / échec / réussite).
  `api/_r2.js` (à part, pour que les fonctions de connexion n'embarquent pas les modules du
  stockage) : `debutR2`, `repondreR2`, `TYPES_IMAGES`. Comparaison ancien / nouveau sur 41 cas simulés :
  mêmes réponses et mêmes appels à la base. Seul changement : le message d'erreur 500 de
  creer-admin / supprimer-mannequin ne cite plus le nom de la variable secrète.

## Vidéo de la page d'accueil : entière et jamais d'espace noir (12/10/2026)
Demande de la propriétaire (« toute la vidéo en entier » ; sur sa tablette Android, la vidéo
apparaissait puis disparaissait en laissant un espace noir).
- `css/style.css` : écran en hauteur, vidéo verticale **entière** (`object-fit: contain`, plus
  de rognage haut/bas) dans un espace 9:16 limité à la hauteur visible (`100svh`) ; le fond
  flouté remplit les côtés si l'écran est moins haut.
- `js/video-accueil.js` : la vidéo apparaît dès sa première image (`loadeddata`), pas seulement
  quand elle joue. Si la lecture automatique est refusée (économie de données ou de batterie),
  la première image reste visible et le bouton devient « Lire le film » / « Play the film ».
  En cas d'erreur de chargement, le fichier est relancé une fois ; si l'erreur revient,
  l'espace est retiré et le code d'erreur part dans le journal des erreurs du tableau de bord
  (`signalerErreur('video', …)`), pour connaître la cause exacte sur l'appareil concerné.
- Essai visiteur `scripts/tests-visiteur/test-video-accueil.js` : téléphone, tablette,
  ordinateur, lecture refusée, erreur passagère, fichier illisible, anglais.

## Diagnostic de nuit du 12/10/2026 (outils extérieurs)
Contrôles : SonarQube Cloud, Lighthouse (le moteur de Google PageSpeed, lancé en local car le
quota gratuit de l'API PageSpeed était épuisé), validateur W3C (`vnu.jar`, en local : le site
validator.w3.org bloque les envois en série), Mozilla Observatory, SSL Labs.
- **W3C** : plus aucune erreur sur les 48 pages (seul `google5acb001b6b29c80f.html`, fichier de
  vérification Google, doit rester tel quel). Images sans adresse → GIF transparent `data:` ;
  titres de structure invisibles `.u-lecteur-ecran` (css/style.css) pour l'ordre h1 → h2 → h3 ;
  tableau de bord : `meta charset` en tête, blocs `<style>` du `<body>` déplacés dans le `<head>`,
  cartes d'accueil sans h3/p dans les boutons (`.tdb-landing-titre` / `.tdb-landing-texte`).
- **Accessibilité** : titre invisible en tête du bas de page commun (js/gabarit.js) ; bouton
  « sélection » ≥ 32 px sur téléphone ; jours estompés de l'agenda lisibles (css/agenda.css) ;
  panier de la boutique `inert` quand il est fermé, focus géré à l'ouverture/fermeture
  (js/marketplace-commun.js, testé dans test-boutique.js) ; liens de la bulle Quill avec `href`.
- **SonarQube** : remarques bloquantes S3516 (fonctions qui renvoyaient toujours `true` dans
  js/espace-mannequin.js → `enregistrerComplementsIdentite` / `enregistrerComplementsPhysique`,
  jamais bloquantes) et critiques S3504/S3735 corrigées. Essai visiteur
  `test-espace-enregistrement.js` (étapes identité d'une mineure puis mensurations).
- **Vitesse** : le canvas du reflet de l'intro (js/faisceau.js) n'est plus réalloué à chaque
  image ; première photo de l'accueil chargée en priorité (`fetchPriority`).
- **Restent, hors de notre main** : Observatory A+ (110) — l'intégrité SRI est impossible pour les
  scripts Google Analytics et Sentry (leur contenu change) ; SSL Labs A+ sur une adresse de
  Vercel et A sur l'autre (réglage de Vercel) ; pages volontairement non indexées (noindex).

## Photos légères en WebP (12/10/2026)
- `js/app.js` : `envoyerVersionPhoto()` fabrique chaque version réduite (miniature 800 px,
  moyenne 1400 px) en JPEG et, si le navigateur sait écrire le WebP (pas Safari), en WebP.
  Convention sans colonne en base : le JPEG se termine alors par `-w.jpg` (`-n800-w.jpg` pour la
  miniature) et la copie WebP porte le même nom en `.webp`. `urlLegere(url)` donne l'adresse
  WebP à afficher (accueil, The Book, fiche, Qui sommes-nous, Parcours) ; un écouteur global
  d'erreur d'image revient au JPEG si la copie manque ou n'est pas lisible. `supprimerDeR2`
  et `api/supprimer-mannequin.js` suppriment aussi la copie WebP.
- `js/tableau-de-bord.js` : le rattrapage automatique (8 s après l'ouverture) refait les
  versions des anciennes photos avec leur copie WebP — 40 photos au plus par ouverture,
  seulement sur ordinateur (écran ≥ 900 px) hors connexion mobile signalée, et seulement si la
  photo n'a pas été remplacée entre-temps. Les anciennes versions JPEG restent dans le stockage
  (non référencées : liens déjà en cache chez des visiteurs, e-mails…). La marque `-w.jpg` ne
  compte que dans les dossiers `miniatures/` et `moyennes/` (jamais pour une photo d'origine).
- Essai visiteur `scripts/tests-visiteur/test-photos-webp.js`.

## Tableau de bord protégé côté serveur (13/10/2026)
Avant, n'importe qui pouvait télécharger la page du tableau de bord et ses scripts (sans accès
aux données, protégées par la base). Désormais :
- `js/connexion-tableau.js` (sorti de `js/tableau-de-bord.js`) : connexion, code de validation,
  mot de passe / code oubliés, déconnexion, verrouillage d'inactivité. Après une connexion admin
  complète, il demande la **clé d'accès** au serveur, puis recharge la page si elle était réduite.
- Clé d'accès = cookie `ma2m_admin` (HttpOnly, Secure, SameSite=Lax, 12 h) signé HMAC-SHA256 avec
  `SUPABASE_SERVICE_ROLE_KEY` (`cookieAccesTableau` / `cleAccesTableauValide` dans `api/_commun.js`).
  Posée par `api/code-validation-protege.js` quand le code est bon, ou par `api/acces-tableau.js`
  (POST : compte admin sans code, ou prolongation d'une clé valide ; DELETE : déconnexion).
- `middleware.js` : sur `/tableau-de-bord(.html)` et les scripts réservés (liste `SCRIPTS_ADMIN`
  = celle de `config.matcher`), sans clé valide → la page arrive **sans les zones**
  `<!-- ZONE-ADMIN … -->` … `<!-- /ZONE-ADMIN -->` de `tableau-de-bord.html` (lue par une demande
  interne signée et datée de 60 s) et les scripts réservés répondent 404. Clé serveur absente ou
  panne : on laisse passer (comportement d'avant) pour ne jamais enfermer la propriétaire dehors.
- ⚠ Tout nouveau script réservé au tableau de bord : le placer dans une ZONE-ADMIN **et** l'ajouter
  à `config.matcher` et à `SCRIPTS_ADMIN` (le test le vérifie).
- Essai visiteur `scripts/tests-visiteur/test-tableau-protege.js`.
- Copie de test Vercel (« Preview ») : la variable `SUPABASE_SERVICE_ROLE_KEY` doit aussi être
  cochée pour *Preview* dans Vercel (Settings → Environment Variables), sinon la connexion y
  répond « Connexion refusée » (activé par la propriétaire le 13/10/2026).

## Journal du 14/10/2026 : corrections

- **Règles de sécurité gardées en mémoire (vidéo bloquée sur une tablette)** : quand une
  page n'a pas changé, Vercel répond « page inchangée » (304) **sans** les en-têtes de
  sécurité (CSP) de `vercel.json`. Le navigateur garde alors les anciennes règles : la
  tablette de la propriétaire bloquait encore la vidéo servie par Cloudflare (`media-src`
  ajouté le 13/10). **Règle** : quand on change les en-têtes de sécurité de `vercel.json`,
  modifier aussi le contenu des pages concernées (au moins `index.html` et `en/index.html`),
  pour que le navigateur les recharge en entier. Un commentaire le rappelle en tête de ces
  deux pages.
- **`js/surveillance.js`** : la branche « vidéo non chargée » n'interroge plus (HEAD) une
  adresse `photos.maitreakessemodelmanagement.com` (interdite par `connect-src`, d'où une
  fausse alerte « sécurité ») : elle interroge le même fichier par le relais `/book-photos/`
  (`urlParRelais`). Test : `test-video-accueil.js` (aucune demande HEAD vers Cloudflare).
- **Limite connue** : la règle du « 304 sans en-têtes » vaut pour **toutes** les pages. Seules
  les deux pages d'accueil portent le rappel ; si un futur changement d'en-tête concerne
  surtout une autre page, modifier aussi cette page.
- **Agenda sur petit téléphone** (`css/agenda.css`) : en français, la 1re ligne
  « 10 / 2026 » + « ‹ Aujourd'hui › » était plus large que l'écran (jusqu'à 390 px) et
  élargissait tout l'en-tête, boutons « Année Mois Semaine Jour » compris. Resserrée sous
  400 px et 340 px ; les longs titres (Semaine, Jour) passent à la ligne. Test :
  `test-pages-publiques.js` (les 4 vues du calendrier dans un écran de 320 px, sans texte coupé).
- **Journal des erreurs : « Télécharger le fichier pour Claude »** (demande de la propriétaire :
  la copie de 38 erreurs arrivait coupée dans la conversation). Bouton au-dessus de la liste
  (`#erreurs-telecharger-btn`) : crée `journal-ma2m-AAAA-MM-JJ-….md` avec **toutes** les erreurs
  affichées (filtres compris), rangées en 3 groupes (🔴 À corriger, 🟠 À surveiller, 🟢 Pas
  d'action). « Copier pour Claude » copie exactement le même texte (`journalPourClaude()` dans
  `js/tableau-de-bord.js`). Le fichier se joint à la conversation (trombone / « + »).
  Le téléchargement passe par `telechargerFichier()` (`js/app.js`), partagé avec les fiches et
  les CV en image. Test : `test-journal-fichier.js` (100 erreurs simulées, filtre, double appui).
- **Affichage qui saute au retour en arrière** (journal : scores 0,6 à 3,4 sur The Book et
  l'accueil, téléphone). Deux causes : 1) `content-visibility: auto` sur `.medaillon-carte`
  (hauteur provisoire 380 px, ≈ 240 px en vrai) : retiré ; 2) au retour, le navigateur replace
  le visiteur plus bas avant l'arrivée de la liste des mannequins. **Accueil** : 6 cartes
  d'attente (`.medaillon-attente`) dans `#medaillons-accueil`, à la taille des vraies, remplacées
  par `accueil.js`. **The Book** (nombre variable) : `#grille` porte `data-place-reservee` ;
  `js/gabarit.js` (2e chargement, juste après le bas de page) y réserve la hauteur retenue à la
  visite précédente (localStorage `ma2m_hauteur_…`, même clé avec ou sans « .html », par largeur
  d'écran) ; `mannequins.js` appelle `libererPlaceListe(grille, listeComplete())` (hauteur
  retenue seulement sans filtre). Test : `test-affichage-stable.js` (score
  ≤ 0,22 au lieu de 0,71 à 1,93). Le saut juste après « Entrer » est l'ouverture voulue de la porte.
- **Aperçus des liens partagés, une image par page** (demande de la propriétaire : en partageant un
  lien sur WhatsApp, Facebook…, on doit voir de quelle page il s'agit). `assets/apercus/{fr|en}-{page}.jpg`
  (1200 × 630 : logo, surtitre, NOM DE LA PAGE, phrase, adresse), faites par
  `scripts/apercus/generer.js` (mode d'emploi en tête du fichier, polices du site). Balises
  `og:image` (+ `?v=1`, à augmenter après un changement d'image), `og:image:width/height/alt` sur
  31 pages ; ajoutées à `espace-mannequin.html` et `selection.html` (FR/EN). The Book n'utilise plus
  la photo du mannequin à la une (`middleware.js`) ; les fiches `/book/…` gardent la photo du
  mannequin. Test : `test-apercus.js`. WhatsApp garde un ancien aperçu en mémoire quelque temps.
- **Recherche du Book par mesures** (demande de la propriétaire : un recruteur ne connaît pas les
  noms). Catégorie et niveau sur une seule ligne (`.filtres-ligne`, deux rangées de 3 sur
  téléphone). Critères : taille min/max, tour de poitrine, de taille, de bassin, pointure, taille
  haut / bas / complète (calculées par `js/tailles.js`), puis « Plus de critères » : yeux, cheveux,
  carnation, ville, langue, disponibilité, nom. **Chaque critère s'utilise seul** (champ vide = pas
  de filtre ; critère rempli = fiches sans cette mesure écartées). Mesure exacte d'abord ; si aucun
  profil, profils à 2 cm près (1 pointure) avec un message. Compteur + « Effacer les filtres ».
  `js/mannequins.js` (`CHAMPS_FILTRES`, `correspond`). Test : `test-recherche-book.js`.

## Rapidité du site (14/10/2026)

Mesures avant correction (page d'accueil, 2e visite) : chaque page redemandait au serveur ses
~30 scripts et styles (`no-cache, must-revalidate`), un aller-retour par fichier — très lent
depuis Abidjan (une vérification a bloqué l'accueil 10 s) ; le tableau de bord en a 23.

- **Fichiers numérotés** : toutes les pages appellent `js/…` et `css/…` avec `?v=<empreinte>`
  (8 caractères du SHA-1 du fichier). `vercel.json` garde ces adresses **un an** dans le
  navigateur (`immutable`) ; scripts réservés du tableau de bord en `private`. Sans `?v=`, la
  règle d'avant reste (`no-cache`). **Après TOUTE modification d'un fichier js/ ou css/ :
  `python3 scripts/versionner.py`** (sinon les visiteurs gardent l'ancienne version). La série
  de tests le vérifie (`versionner.py --verifier`). Fichiers chargés par un script (jsPDF, QR,
  outil vidéo) : pas de numéro, revérifiés à chaque fois.
- **Plus de `@import` en chaîne** : `css/menu.css` et `css/champs-telephone.css` sont appelés
  par un `<link>` dans chaque page, juste avant le fichier qui les importait (`style.css`,
  `entete-site.css`, `espace-mannequin-correctifs.css`).
- **Copies WebP des anciennes photos** (jusqu'à 420 Ko sans elles, sur l'accueil) : le rattrapage
  automatique du tableau de bord se fait aussi sur tablette (écran ≥ 700 × 600 px, pas un
  téléphone tenu en largeur, hors données mobiles signalées), plus seulement sur ordinateur.
- **Boutique** : la police Google n'est plus importée par `css/marketplace.css` mais appelée par
  un `<link>` dans chaque page `marketplace/`.
- **Scripts réservés du tableau de bord** : jamais gardés en mémoire longue (`private, no-cache`,
  règle à part dans `vercel.json`, même liste que `SCRIPTS_ADMIN` de `middleware.js` — vérifié par
  `test-tableau-protege.js`), pour ne jamais garder une réponse « Introuvable ».
- **Non modifié** : la protection d'accès du tableau de bord (`middleware.js`) demande la page
  deux fois quand la clé de 12 h a expiré (≈ 1,7 s) ; à revoir avec un essai réel (règle 3 de
  CLAUDE.md). La base Supabase répond en 0,3 à 0,8 s par demande (formule gratuite).

## Test visuel : lisibilité et captures (18/10/2026, chantier D du cahier « Architecture »)

`scripts/tests-visiteur/test-visuel.js` (lancé par `lancer.sh`, environ 2 min 30) ouvre les
42 pages publiques FR et EN sur téléphone (390 px) et ordinateur (1280 px), avec la base simulée.

- **Lisibilité — bloquant.** `scripts/tests-visiteur/lisibilite.js` mesure, pour chaque texte
  visible, le contraste entre sa couleur et ce qui est réellement peint dessous (norme WCAG AA :
  4,5 pour 1, ou 3 pour 1 pour un grand texte). Un dégradé est mesuré à l'endroit du texte ; un
  texte posé sur une photo ou une vidéo n'est pas jugé ; un texte caché sous le menu non plus.
  La page est parcourue de haut en bas, puis vérifiée menu ouvert, bandeau cookies affiché et
  formulaires (contact, intégrer l'agence, connexion) envoyés vides.
- **Contrôle du contrôle.** Au début, un texte sombre est posé exprès sur le menu sombre : s'il
  n'est pas signalé, le test échoue (le vérificateur serait cassé).
- **Captures — non bloquant.** Rangées dans `scripts/tests-visiteur/captures/actuelles` (dossier
  non publié). `node test-visuel.js --reference` les enregistre comme référence ; aux passages
  suivants, `comparer-captures.py` écrit `captures/rapport.html` avec la part de chaque capture
  qui a changé et une image où les changements sont en rouge (utile pour repérer une page
  déformée par erreur).
- Premières corrections trouvées par ce test : lien « Intégrer l'agence » du bas de page sur
  fond clair (nouvelle charte, `css/charte-ma2m.css`) et phrase « Accédez à votre espace
  mannequin. » (`css/espace-mannequin-correctifs.css`).
- `lancer.sh` installe aussi les paquets des fonctions serveur (`npm install --no-save`) s'ils
  manquent, car `test-note-integration.js` en a besoin.
- Suite (18/10/2026, soir) : inscription simplifiée (`js/inscription-nouveau.js`) — les trois
  appels à la base passent par `appeler()` : si la connexion coupe, le bouton n'est plus bloqué
  sur « en cours » et un message invite à réessayer (3 défauts SonarQube). Les moyens de paiement
  « bientôt » sont en gris lisible (`css/inscription-nouveau.css`). `test-inscription-simplifiee.js`
  utilise maintenant le contrôle commun `lisibilite.js` (sa copie est supprimée ; la page est lue
  de haut en bas par `lirePageEntiere`, partagée avec `test-visuel.js`) et essaie la connexion
  coupée aux trois étapes (code, « Corriger » — ce qui a été tapé est gardé —, « J'ai payé »).
  Les boutons grisés (désactivés) ne sont pas jugés, comme le prévoit la norme.

### Suivi des 6 points du 20/10/2026
- Registre : filtre « Sans nom » (comptes site sans nom rempli, e-mail affiché, rien n'est supprimé).
- Sorties et suspensions : liste « Formation terminée (24 mois) » avec bouton « Proposer la sortie » (RPC `sortie_proposer`, motif prérempli). Un mannequin « sorti » n'est plus appelé ni relancé (les relances ciblent `statut='actif'`).
- Codes de l'espace mannequin : bouton « Enregistrer son paiement » (fiche) quand l'inscription n'est pas payée, puis « Générer le code ».
- Suppression définitive d'un mannequin d'essai : fonction `mannequin_supprimer` (fichier `supabase-suppression-mannequin.sql`, à exécuter une fois). Principal seulement, code récent exigé, refusée si compte existant, paiement validé ou reçu. Bouton sur la fiche.
- « Tableau du mois » : démarre vide ; liste déroulante pour ajouter des mannequins au suivi (ou « Tous les mannequins actifs »), bouton « Retirer ». La sélection est gardée dans le navigateur de l'appareil (clé `ma2m_suivi_tableau`), rien n'est modifié en base. Les relances automatiques par e-mail (serveur) ne dépendent pas de cette liste.
- Rappel : après toute modification d'un fichier JS/CSS, lancer `python3 scripts/versionner.py` AVANT la mise en ligne (oubli le 20/10/2026 : l'ancien tableau est resté affiché chez la propriétaire).
- Compta : menu dans l'ordre du plan (Portail_Admin_MA2M.html), carte « Mode actuel / Activer le mode légal et la FNE » sur le tableau de bord. Espace 1 : le cadre reste caché (« Chargement… ») tant que le tableau de bord vérifie la session (9 s max).
- Compta : bouton « Envoyer » sur devis/proformas/factures/avoirs (partage du PDF par l'appareil, sinon téléchargement + liens WhatsApp / e-mail avec message prêt) ; page « Accès du comptable » (principal seul : liste, couper/rétablir, lien vers l'invitation).

## Suivi des mannequins (colonne `suivi`) — 20/10/2026
- Le suivi des paiements repose sur la colonne `suivi` de la table des mannequins (remplie automatiquement par le déclencheur `suivi_auto` dès qu'un paiement est validé). Récapitulatif, matrice, mensualités, messages groupés et tableau du mois utilisent tous la même liste (`mannequinsSuivis` dans `js/portail/espace-paiements.js`).
- À exécuter une fois dans Supabase : `supabase-suivi-et-suppression.sql` (colonne `suivi` + fonction `mannequin_supprimer`). Tant que ce n'est pas fait, les tableaux affichent tous les actifs avec un bandeau, et le bouton Supprimer indique que la fonction n'est pas activée.
- Suppression d'un mannequin : réservée au responsable principal, seulement sans compte ni paiement validé.

## Chantier A — couleurs centralisées (20/10/2026)
- `python3 scripts/centraliser-couleurs.py` remplace les couleurs écrites en dur dans `css/*.css` par des variables `--c-…`, définies une seule fois dans `css/jetons.css` (bloc « Palette centralisée »). Rejouable, option `--essai`. Rendu identique (captures comparées : 0 différence).

## Audit général, suite (20/10/2026)
- **Sécurité (SonarCloud « Browser Storage Poisoning »)** : `js/mode-administration.js` ne recopie
  plus l'adresse telle quelle dans `ma2m_retour_administration`. `adresseRetour()` la reconstruit :
  page prise dans une liste fixe (`PAGES_RETOUR`), fiche `?actu=|evenement=|partenaire=` et rubrique
  `#…` gardées seulement si elles n'ont que `[\w-]` (64 caractères au plus). `js/portail/noyau.js`
  refiltre toujours avant d'y retourner. Essai : test-administration.js (adresse piégée sur partenaires).
- **Descriptions Google** (`<meta name="description">`) ramenées entre 130 et 155 caractères :
  inscription-mannequin, qui-sommes-nous, services, actualites (FR et EN).
- **Couverture du book (mannequin.html)** : nom, étiquette et ligne d'infos en blanc sur l'ombre
  de la photo (`css/charte-ma2m.css`, comme « Mannequin à la une ») — ils étaient restés en encre
  foncée depuis le passage du site en clair. Essai : test-pages-publiques.js vérifie leur couleur.
- **Plus d'administration sur le site public** (demande de la propriétaire, 20/10/2026 :
  « l'administration se fait par les applications ») : bouton « Admin » de la barre du haut
  retiré pour tout le monde (js/menu.js ; repère `ma2m_appareil_admin` plus posé par
  js/tableau-v2.js). vercel.json : sur www, `/admin/`, `/tableau-de-bord` et
  `/tableau-de-bord.html` renvoient vers admin.maitreakessemodelmanagement.com (le tableau
  de bord reste l'espace 1 DANS l'Administration). Les notifications du téléphone
  (`/tableau-de-bord.html?notif=…&id=…`) suivent le renvoi : `adresseRetour()` garde aussi
  `notif` et `id`. Essais : test-pages-publiques.js (aucun bouton « Admin », même sur un
  ancien appareil admin), test-administration.js (notification → fiche).

## Refonte « Magazine » (20/10/2026) — tout le site et l'Administration
Choix de la propriétaire : « Magazine 3 » (maquette `maquettes/accueil-magazine.html`, plan et journal
détaillés dans `PLAN-REFONTE-MAGAZINE.md`). Le style s'applique à TOUT (site public, boutique,
Administration, tableau de bord) ; aucune donnée n'a été modifiée.
- **Jetons** (`css/jetons.css`) : bloc « Édition Magazine » (`--mag-scene`, `--mag-papier`, `--mag-encre`,
  `--mag-gris`, `--mag-carte`, `--mag-lignes`, voiles `--mag-voile-*`, polices `--mag-titre` = Big Shoulders
  Display et `--mag-texte` = Work Sans), puis bloc « Édition Magazine partout » qui rebranche les couleurs
  de base (`--fond`, `--surface`, `--encre`, `--sombre`, `--police`…) pour le site ET l'Administration.
  Le mode sombre de l'Administration (`:root.theme-auto`) et les couleurs d'état ne changent pas.
- **Accueil** (`index.html`, `en/index.html`, `css/magazine.css`, `js/accueil.js`) : pages de magazine
  les unes sous les autres, bord à bord, qu'on fait défiler (d'abord « collées » et superposées ; changé le
  20/10/2026 à la demande de la propriétaire : pas de superposition, pas d'espace entre les pages).
  Chaque page prend TOUT l'écran (largeur, et hauteur sous la barre du haut) ; tailles en `cqmin`
  (plus petit côté de la page) ; sur un écran en largeur, « doubles pages » (`@container (orientation:
  landscape)` pour l'intérieur des pages, `@media (orientation: landscape)` pour la page elle-même).
  Couverture : les photos de tous les mannequins défilent en fondu toutes les 5 s (`defilerCouverture`,
  deux images `#couv-img` / `#couv-img-2`), arrêt hors écran, immobile si « moins d'animations ».
  Essai : `test-couverture-accueil.js`.
  Sommaire : la photo est un « tirage de galerie » (`figure.vignette` : marge claire, ombre
  `--mag-ombre-tirage`, légère inclinaison, nom du mannequin en légende `#sommaire-legende`), flottante à
  droite ; titre et lignes en `display: flow-root` pour s'arrêter avant elle. Pages « L'agence » et
  « Nous rejoindre » en hauteur : la photo prend toute la place libre et reste calée sur le visage
  (`object-position: 50% 12%`). Les deux sont contrôlés par `test-couverture-accueil.js`.
- **Polices partout** : `html { font-synthesis-style: none; }` (jetons) — pas de faux italique (nos polices
  n'ont pas de version italique) ; « Qui sommes-nous » alignée sur le reste du site.
- **Actualités / Événements** : titre et catégorie de l'article « à la une » en blanc sur la photo
  (`css/charte-ma2m.css`) ; contrôlés par `test-lisibilite-photos.js` (photos d'essai très claires). Ordinateur et tablette : format 3:4 ;
  téléphone : hauteur de l'écran moins la place des boutons flottants, textes ≥ 12 px. Pages remplies
  depuis l'Administration ; pages en option (agenda, film, partenaires, Instagram) réservées d'une visite
  à l'autre (`localStorage ma2m_magazine_pages`) pour que la page ne saute pas au retour en arrière.
  Sommaire et numéros de page recalculés (MutationObserver). Dos rouge : « Casting ouvert » seulement si
  `casting_projets.actif`. Couverture et « À la une » : version moyenne de la photo (`url_moyenne`).
- **Site public** : fin de `css/charte-ma2m.css` (titres h1 en Big Shoulders capitales, h2 en Big Shoulders sans capitales, en-tête et pied
  de page sur le papier avec filet d'encre, boutons presque carrés via `--bouton-rayon` lu par
  `css/bouton-ma2m.css`). Polices ajoutées dans les 43 pages publiques, `admin/index.html` et
  `tableau-de-bord.html` (autorisées par le CSP : fonts.googleapis.com / fonts.gstatic.com).
- **Administration** : `css/portail.css` (h1 en Big Shoulders, sans capitales : outil de travail), `css/tableau-v2.css` (`--v2-*` rebranchés
  sur les jetons magazine, titre « Tableau de bord » en Big Shoulders, sans capitales).
- **Retirés** : intro animée, porte « Entrer », carrousel, médaillons de l'accueil (`js/accueil-debut.js`,
  `js/intro-faisceau.js`, `js/faisceau.js`, `css/splash.css`). `js/verrou-defilement.js` reste chargé sur
  l'accueil (menu).
- **Tests** : `test-affichage-stable.js` (pages Femmes/Hommes, pas de saut), `test-lisibilite-photos.js`
  (ajouté à `lancer.sh` ; photos d'essai générées ; une photo cachée sous une page opaque ne compte plus).

## Journal du 20/10/2026 : analyse et corrections (zooms de la propriétaire)
La propriétaire zoome souvent elle-même (doigts, clavier, menu du navigateur) ; le journal le
comptait en erreur. `js/surveillance.js` :
- plus de « Zoom inattendu » (zoom sans geste repéré) ; le « Zoom automatique » sur un champ au
  texte de moins de 16 px reste signalé ;
- « Page dézoomée » seulement si le contenu dépasse vraiment de l'écran (`scrollWidth`) ;
- « Page plus large que l'écran » pas mesurée pendant un zoom (`visualViewport.scale` ≠ 1) ;
- « Page figée » : le temps passé dans la fenêtre d'impression (`beforeprint` / `afterprint`)
  est excusé, comme les fenêtres de confirmation.
Essai : `test-surveillance-zoom.js` (zoom simulé en remplaçant `window.visualViewport`).
Autres corrections tirées du même journal :
- tableau de bord (adresse admin.…) : le rattrapage des versions légères des photos télécharge
  l'original par le relais de la même adresse (`/book-photos/…`), et non plus par l'adresse www
  enregistrée en base, refusée par le CSP (`connect-src`) ;
- bloc « Inscriptions mannequins » qui dépassait sur tablette (800 px) : `min-width: 0` sur les
  blocs des grilles et coupure des longs textes (`css/tableau-v2.css`). Essai :
  `test-tableau-largeur.js` ;
- inscription simplifiée : plus de `style="…"` écrit par le script (refusé par le CSP),
  classes `.inn-question` et `.inn-surtitre--serre` ; `test-inscription.js` relève désormais
  les refus du CSP ;
- formulaire de candidature : le message (erreur ou envoi) est ramené à l'écran, pour que le
  visiteur sache pourquoi rien ne part (4 clics sur « Envoyer » relevés sur un petit téléphone).
Sans action : erreurs de traduction automatique ou d'extensions (« user-script », fonctions
« Hk/Fk »), pages lentes et réseau injoignable (connexion du visiteur), vidéo illisible sur
certains vieux téléphones (la page la masque déjà).

## Aperçus des liens au style « Magazine » (20/10/2026)
Demande de la propriétaire : « chaque élément du site a son bel aperçu, conforme au nouveau design ».
- `scripts/apercus/generer.js` refait les 31 images de pages (`assets/apercus/`, FR + EN) et
  l'image de la boutique (`fr-boutique.jpg`, liste `AUTRES`) : papier beige, rubrique rouge, grand
  titre Big Shoulders Display (réduit tout seul pour tenir), texte Work Sans, bandeau rouge « MA2M ».
  Polices : paquets `@fontsource/big-shoulders-display` et `@fontsource/work-sans` (mode d'emploi en
  tête du fichier). Numéro des images passé à `?v=2` (pages et `middleware.js`).
- `middleware.js` : nouvel aperçu d'UN partenaire (`/partenaires?partenaire=ID` : nom, texte, logo ;
  sans logo, l'image de la page). Fiches des mannequins, actualités et événements : inchangés (leur
  photo).
- Boutique (`marketplace/index.html`, `produit.html`) : balises og: ajoutées (image commune).
- Essais : `test-apercus.js` (pages + boutique), `test-middleware-apercus.mjs` (partenaires).

## Visites « comme un humain » du 20/10/2026 (Android, iPhone, tablette, ordinateur) : corrections
- **Bouton « retour » du téléphone** : il referme la fenêtre ouverte (article, album, photo en
  grand, fiche d'un partenaire) au lieu de quitter la page — `window.fenetreOuverte(fermer)` /
  `window.fenetreFermee(fermer)` dans `js/verrou-defilement.js` (une étape d'historique par
  fenêtre ; le menu n'est pas concerné). Essai : `test-retour-fenetres.js`.
- **Pastille WhatsApp** discrète : effacée quand on descend dans la page ou qu'on remplit un champ,
  de retour en remontant (`js/app.js`, `css/charte-ma2m.css`). Essai : `test-whatsapp-discret.js`.
- **Articles** : lignes vides retirées, police de lecture (`--texte`), adresses web et numéros de
  téléphone cliquables (`retirerParagraphesVides`, `rendreLiensCliquables` dans `js/app.js`).
  Essai : `test-texte-articles.js`.
- **The Book** : sur téléphone, mesures repliées (règle CSS, donc sans saut ; bouton
  `.filtres-mesures-bouton`) ; coche dans le coin du filtre choisi (`css/bouton-ma2m.css`) ; bouton
  « + » expliqué. Essai : `test-recherche-book.js`.
- **Menu au clavier** : focus gardé dans le menu ouvert, retour au bouton « Menu » à la fermeture
  (`js/menu.js`). Essai : `test-menu-clavier.js`.
- **Fiche d'un mannequin** : silhouette (photo + lignes) pendant le chargement ; sur téléphone, les
  mensurations passent sous la photo ronde.
- **Âge** : candidatures à partir de 14 ans (`AGE_MINIMUM`, `js/formulaire-candidature.js`), plus
  d'âge maximum ; critères mis à jour (Intégrer l'agence, Qui sommes-nous, FR/EN). Essai :
  `test-visiteur.js` (12 ans refusés).
- **Accueil** : bouton « Activer le son » centré (il sortait de l'écran) ; sommaire « Les
  visages : femmes / hommes » ; l'annonce du bandeau (écrite en français) n'est plus affichée sur
  la version anglaise, qui garde son bandeau des services ; étiquette « Infos du jour » centrée.
- Étoiles sur « Nom complet » et « E-mail » du formulaire de candidature.
