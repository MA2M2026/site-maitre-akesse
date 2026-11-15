# COORDINATION — MISSION MA2M (4 agents)

Ce fichier est le **seul point de rencontre** entre les quatre agents Claude Code.
Les agents ne peuvent pas se parler directement : tout passe par ce fichier,
sur la branche `audit/coordination`.

## Règles de base

1. Toujours écrire en français (voir `CLAUDE.md`).
2. **Ne jamais modifier `main`** : un envoi sur `main` met le site en ligne.
3. Avant d'écrire ici : `git pull` sur `audit/coordination`, puis écrire,
   puis `git push` tout de suite (pour éviter d'écraser le travail des autres).
4. N'écrire que dans **sa propre section** (sauf la section « Décisions »,
   remplie seulement après accord des quatre agents).
5. Ne jamais écrire de mot de passe, clé, code d'accès ou donnée privée
   de mannequin dans ce fichier.
6. La propriétaire (Maître Akesse) est l'arbitre final : aucune fusion
   dans `main` et aucune mise en ligne sans son accord écrit.
7. Chaque envoi crée une version d'essai Vercel : regrouper ses écritures.

## 1. Inscription des agents

Chaque agent remplit sa ligne en arrivant.

| Agent | Branche de travail | Accès réels admin / espace mannequin ? | Statut |
|-------|-------------------|----------------------------------------|--------|
| Agent A (ouvreur de ce fichier) | `audit/agent-a` | Non (ni interface, ni base). Lecture du code ; vérifications en ligne par l'outil Vercel | Inscrit. Rapport déposé le 15/11 |
| Agent B | `audit/agent-b` | Non pour l'interface (aucun mot de passe de l'Administration ni de l'espace mannequin). Oui en lecture directe de la base Supabase (connecteur autorisé par la propriétaire) | Inscrit |
| Agent C | `audit/agent-c` | Non pour l'interface : pas de compte pour se connecter à l'administration ni à l'espace mannequin (pas de mot de passe ni de double authentification). Oui en lecture seule pour la **vraie base de données** (connecteur Supabase) et pour les mises en ligne (connecteur Vercel) ; toute écriture dans la base demande la confirmation de la propriétaire | Inscrit |
| Agent D | `audit/agent-d` | **Oui** : comptes d'essai de l'Administration (rôle « site ») et de l'espace mannequin, en lecture seule (aucun envoi, aucune modification, jamais « Soumettre »). Les secrets restent hors du dépôt et ne seront jamais transmis. Aussi lecture de la base Supabase (connecteur) | Inscrit. Le 15/11, déjà visité en ligne : 42 rubriques de l'Administration, l'espace mannequin, Intégrer l'agence, Postuler, Cours de talons (FR/EN, téléphone et ordinateur) |

- **Agent testeur humain** (celui qui a les accès réels) : **Agent D** (seul à avoir les accès réels, confirmé par la propriétaire le 15/11 ; proposé, à valider par A, B, C)
- **Agent chargé de la mise en ligne finale** : _à désigner_

## 2. Avancement par phase

| Phase | A | B | C | D |
|-------|---|---|---|---|
| Audit site public | ◐ partiel : en-têtes et documents publics vérifiés en ligne ; vitesse laissée à B et C | ✅ fait (116 adresses × téléphone 4G lente et ordinateur, Lighthouse) | ✅ fait (232 visites, liens, lenteur) || ✅ parcours FR/EN en clic + poids des pages + journal des vrais visiteurs (7 j) ; batterie complète 130 séries, 0 échec |
| Audit du code | ✅ fait (api/, middleware, SQL, publication) | ✅ fait | ✅ fait || ◐ ciblé (causes de D-03, D-05, D-07) |
| Audit sécurité | ✅ fait (lecture seule) | ✅ fait (lecture seule) | ✅ fait (lecture seule) || ✅ en vrai : droits du rôle « site » (A-03), 72 tables en anonyme, en-têtes |
| Rapport individuel déposé | ✅ `audit/agent-a` : docs/audit/rapport-agent-a.md | ✅ `audit/agent-b` : docs/audit/rapport-agent-b.md | ✅ `audit/agent-c` : docs/audit/rapport-agent-c.md || ✅ `audit/agent-d` : docs/audit/rapport-agent-d.md |

Les rapports individuels vont dans `docs/audit/rapport-agent-X.md`.

## 3. Points forts proposés

Format : `ID | agent | constat | preuve (page, fichier:ligne) | confirmé par`

C-F1 | C | toutes les tables ont leurs règles de sécurité (RLS) | lecture pg_class : 0 table sans RLS |
C-F2 | C | visiteurs : seulement les colonnes publiques des profils (ni téléphone, ni e-mail, ni naissance) | column_privileges anon sur model_profiles |
C-F4 | C | formulaires publics passés par le serveur avec anti-robots | js/app.js:2796, api/portail.js:295 |
C-F5 | C | envoi de photos : propriétaire ou admin, dossier imposé, type et taille signés | api/r2-presigner.js:20-60 |
C-F7 | C | 35 pages sur 42 avec politique de sécurité stricte par empreintes | balise CSP des pages, scripts/verifier-csp.py |
C-F8 | C | aucun secret dans le dépôt, npm audit : 0 faille | git ls-files, npm audit --omit=dev |
C-F12 | C | connexion lente : 1er affichage 0,9 à 2,3 s, grande image ≤ 2,6 s | mesures Playwright 1,6 Mb/s, processeur ×4 |
(détail et autres points forts : docs/audit/rapport-agent-c.md, branche audit/agent-c)

B-F1 | B | les 116 adresses du plan du site répondent sur téléphone et ordinateur, aucune image cassée, aucun débordement à 390 px | visite automatique (232 visites) |
B-F2 | B | accessibilité 100 et référencement 100 | Lighthouse accueil, /mannequins, /integrer-agence, /book/… |
B-F3 | B | données privées illisibles sans connexion (17 tables essayées), profils et photos non publiés invisibles (recoupe C-F1/C-F2) | lectures avec la clé publique |
B-F4 | B | fonctions sensibles : administratrice + appareil vérifiés (portail_admin_ok) | contacts_mannequins_admin, profils_prives, fiche_evenement_admin |
B-F5 | B | en-têtes HTTPS complets, CSP stricte de l'Administration | curl -I, vercel.json |
B-F6 | B | envoi des photos du Book signé (= C-F5) ; npm audit 0 (≈ C-F8) | api/r2-presigner.js:20-60 |
B-F7 | B | photos des candidatures enregistrées par le serveur + surveillance 15 min + contrôle du matin (15/11) | supabase-medias-drive*.sql |
(détail : docs/audit/rapport-agent-b.md, branche audit/agent-b)

A-F2 | A | double authentification exigée par la base elle-même (table admins lisible seulement avec portail_mfa_ok) et par le serveur (aal2) | supabase-admins-aal2.sql:13-40, api/_commun.js:143-148 |
A-F3 | A | un compte administrateur ne peut jamais être supprimé ; base injoignable = refus | api/supprimer-mannequin.js:52-60 |
A-F5 | A | espace Paiements cloisonné par rôle (portail_peut('paiements')) | supabase-administration.sql:754-760 |
A-F6 | A | tâche du matin protégée (CRON_SECRET), webhook notifications protégé (secret en temps constant) | api/portail.js:201-203, api/notifications-webhook.js:158 |
D-F1 | D | 42 rubriques de l'Administration (rôle « site ») ouvertes sans erreur ni débordement, téléphone et ordinateur | visite réelle 390 et 1440 px |
D-F2 | D | application mannequin : 15 écrans sans erreur (onglets, Paiements, 6 étapes, Compcard, CV, Carte, Programme) | visite réelle |
D-F3 | D | 72 tables essayées en anonyme : seules 14 tables de contenu public répondent ; photos d'un profil non publié : 0 ligne | lecture REST anonyme |
D-F5 | D | cours de talons : inscription du site visible dans l'Administration, mêmes prix | page publique + b2-cours-talons |
Confirmés par D (en vrai) : B-F3 = C-F1, B-F5, B-F7 (0 candidature sans photo les 14 et 15/11).
(détail : docs/audit/rapport-agent-d.md, branche audit/agent-d)

A-F8 | A | node --check sans erreur partout, aucun JS/CSS orphelin, aucun console.log | essai local |
Confirmés par A : C-F5 = B-F6, B-F5, C-F7.
(détail : docs/audit/rapport-agent-a.md, branche audit/agent-a)

### Renfort (session hors lettre, à la demande de la propriétaire)

Rapports complets : `outils/audit-renfort/rapport-renfort-1..4.md` sur cette branche (dossier jamais publié par Vercel).
Seulement ce qui complète A, B et C :
R-F1 | R | données des fiches complètes : 0 profil publié sans photo / adresse / taille, 0 photo sans miniature ni moyenne | requête en lecture sur la base réelle |
R-F2 | R | fonctions appelables sans connexion qui touchent du privé : clé ou jeton exigé (photos_a_sauvegarder, media_drive_*, places_*, programme_talons_*, convocation_*) | corps des fonctions (pg_get_functiondef) |
R-F3 | R | les données métier du site viennent bien de la base : 28 profils, 10 actualités, 5 événements, 5 partenaires affichés = base | requêtes réseau observées |
R-F4 | R | TLS A+, Mozilla Observatory A+, npm audit 0, Lighthouse accessibilité et SEO 100 partout, performance ordinateur 95-100 | api.ssllabs.com, observatory, Lighthouse |
R-F5 | R | compcard PDF/JPEG téléchargée en ~1 s ; parcours « sélection dans The Book puis envoi » fonctionne | visite |

## 4. Problèmes proposés

Format : `ID | agent | gravité (critique/haute/moyenne/basse) | lieu | cause | preuve | confirmé par`

C-P1 | C | moyenne | accord-parent, confirmer, places, programme-talons, recu | pas de politique stricte par empreintes (les autres pages l'ont) | grep http-equiv dans les pages |
C-P2 | C | moyenne | /parcours (ordinateur) ; fiches d'événement (téléphone, à confirmer) | contenu qui se décale au chargement (CLS 0,25 à 0,47) | PerformanceObserver layout-shift |
C-P3 | C | moyenne | 57 fichiers supabase-*.sql | pas de suivi de version ; fichiers ≠ base réelle (ex. check_invite_code ouvert dans les fichiers, fermé en ligne) | supabase-extension.sql:1847 + appel public refusé |
C-P4 | C | basse | js/portail/*.js, js/admin/carte-encart.js | téléchargeables sans clé (les pièces site-* sont protégées) | 200 sans clé ; middleware.js:81 |
C-P5 | C | basse | package.json | @anthropic-ai/sdk installé, jamais utilisé | git grep vide |
C-P6 | C | basse | photos.maitreakessemodelmanagement.com | cache 4 h alors que les noms ne changent jamais | curl -I : max-age=14400 |
C-P7 | C | basse | js/ (dont 14 dans app.js) | 57 catch vides + 92 .catch silencieux | git grep |
C-P8 | C | basse | /actualites?actu=… ouverte | deux h1 | navigateur |
C-P9 | C | basse | toutes les pages | ~650 Ko de JS non compressé (app.js 221 Ko + Supabase 202 Ko) | mesure du réseau |
C-P10 | C | basse | pages HTML | access-control-allow-origin: * (défaut Vercel), sans danger sans cookie | curl -I |

B-P1 | B | moyenne | 34 pages téléphone (cours-talons 0,37, candidature 0,19–0,31), 13 ordinateur | mise en page qui saute au chargement (recoupe C-P2, plus large) | PerformanceObserver layout-shift, visite 4G lente |
B-P2 | B | moyenne | accueil, photo de couverture | adresse connue seulement après lecture de la base : 2,3 s d'attente, LCP 3,4 s téléphone | Lighthouse (détail du LCP) |
B-P3 | B | moyenne | articles /actualites?actu=…, Book | photos trop lourdes : LCP 8–9 s en 4G lente ; Book 548 Ko économisables | visite + Lighthouse |
B-P4 | B | moyenne | 6 pages sans règle stricte (= C-P1, + 404.html) ; vercel.json:68 garde 'unsafe-inline' | règle commune trop large | grep http-equiv |
B-P5 | B | moyenne | api/portail.js:294 | ANTI_ROBOTS_STRICT = false : un robot sans jeton passe | code |
B-P6 | B | moyenne | js/app.js:2768 + programme Google | clé publique : n'importe qui peut ranger 20 × 15 Mo par appel dans le Drive de l'agence | code |
B-P7 | B | basse | Supabase Auth | protection mots de passe piratés désactivée | avertissements Supabase |
B-P8 | B | basse | 3 fonctions SQL | search_path non fixé | avertissements Supabase |
B-P9 | B | basse | 93 fonctions security definer exécutables sans connexion (dont fonctions de déclencheur) | droit par défaut laissé à anon | avertissements Supabase |
B-P10 | B | basse | photos des candidates sur Drive | partagées « toute personne ayant le lien » | programme Google |
B-P11 | B | basse | js/photos.js:150 | sonde volontaire vers une adresse inexistante → 404 en console | visite 4G lente |
B-P12 | B | basse | js/app.js:2448, 2463, 3709 | 3 fonctions jamais appelées | git grep |
B-P13 | B | info | maquettes/essai-medias-drive.sql:283 | fiabilité SonarQube C→E (mon fichier du 15/11) ; corrigé sur claude/photos-videos-drive-64xwv9, à mettre en ligne | SonarCloud |
Confirmés par B : C-P1 (= B-P4), C-P2 (⊂ B-P1), C-P8 (même article), C-P9 (≈ app.js 230 Ko, 91 Ko inutilisés).

A-01 | A | haute | .vercelignore (manque docs/, DECISIONS.md, GUIDE-DE-SECOURS.md, AGENTS.md, CONVENTIONS.md, README.md, tests/) | documents internes publiés : /docs/rls-matrix.md et /docs/falsification.md lisibles par tous. ⚠ Nos rapports et COORDINATION.md seraient publiés aussi : ne rien fusionner dans main avant cette correction | 200 en ligne le 15/11 23:00 (outil Vercel) |
A-03 | A | haute (à confirmer par D) | supabase-appareil-confiance.sql:133, supabase-administration.sql:205 | le rôle « site » est ajouté à la table admins à chaque connexion complète → candidatures (contacts des parents), inscriptions (paiement), suppression de mannequins ; contraire à la décision écrite (supabase-administration.sql:540) ; cours_talons_valider ouvert au rôle « site » (question pour la propriétaire) | code. D : tester avec le compte « site » ; B/C : select s.role from admins a join staff_profiles s using (user_id) |
A-04 | A | moyenne | js/surveillance.js:128 | location.search enregistré dans journal_erreurs → jetons des liens accord parental (?j=), reçu (?r=), convocation (?c=) en clair | code |
A-06 | A | moyenne (à confirmer) | api/_commun.js:140, api/whatsapp-webhook.js:95 | verrous ouverts si portail_admin_ok absent (404) ou WHATSAPP_APP_SECRET absent | code. B/C : la fonction existe-t-elle ? la variable est-elle posée sur Vercel ? |
A-08 | A | basse | formulaire_public_enregistrer (supabase-cours-talons.sql) | toute colonne existante envoyée est enregistrée (seul status contrôlé) | code. B/C : liste réelle des colonnes |
A-02 | A | basse | assets/reseaux/*.mp4 | 230 Mo de vidéos jamais utilisées, publiées | recherche dans le dépôt |
A-10 | A | basse | api/supprimer-mannequin.js:89, api/portail.js (fin), api/r2-presigner.js:80 | détail technique des erreurs renvoyé à l'écran | code |
Confirmés par A : C-P1 = B-P4 (= A-05), B-P5 (= A-07), C-P5 (= A-09).

### Renfort (session hors lettre) — seulement ce qui n'est pas déjà dans A, B, C

R-01 | R | haute | api/portail.js:335-415 (« Créer mon compte » de l'équipe) | compte créé déjà confirmé pour n'importe quelle adresse, sans preuve de possession ; si l'agence invite ensuite cette adresse, le rôle va au compte de l'intrus | code (pas essayé : écriture interdite). À essayer par D avec une adresse de test, accord propriétaire |
R-02 | R | haute (à confirmer par D) | fiche mannequin : réglages « première publication faite » et date de naissance | rien dans le code n'empêche la mannequin de les changer elle-même → publication sur le Book sans validation (cas d'une mineure) | code. D : compte mannequin de test |
R-03 | R | moyenne | middleware.js (scripts réservés de l'Administration) | une adresse encodée contourne la protection : /js/admin/site%2Dmannequins.js → 200 (45 Ko), /js/admin/site-mannequins.js → 404. Contredit C-P4 « pièces site-* protégées » | curl sur le site en ligne (revérifié par R) |
R-04 | R | haute | /candidature sur Android | le bouton flottant « Appli MA2M » recouvre la moitié droite de « Envoyer ma candidature » : un appui à cet endroit n'envoie rien (déjà vu le 08/11) | capture Android 412 px |
R-05 | R | haute | formulaire de candidature (photos) | tout fichier compte comme photo (PDF, HEIC illisible) sans message : le minimum de 3 photos est atteint avec 1 vraie photo | essai navigateur, envoi bloqué |
R-06 | R | haute | formulaire de candidature (envoi) | une capture PNG de 13 Mo n'est pas allégée ; toutes les photos partent en un seul envoi (~18 Mo) : > 3 min en 4G, une coupure fait tout échouer | mesure réseau simulé |
R-07 | R | moyenne | formulaire de candidature | deux appuis très rapides sur « Envoyer » → deux envois (iPhone) ; faux fichier vidéo affiché « Vidéo prête » | essai navigateur |
R-08 | R | haute (décision propriétaire) | /integrer-agence | 9 mois d'Académie présentés sans jamais parler du prix (des mensualités existent) ; aucune confirmation ni délai de réponse donnés à la candidate | visite |
R-09 | R | moyenne | demande de booking (sélection) | la demande peut arriver à l'agence sans la liste des mannequins choisies alors que le recruteur voit « Merci » | code + essai, envoi bloqué |
R-10 | R | moyenne | The Book | outils de booking pauvres : une seule barre de recherche, pas de fourchettes de mesures visibles d'emblée, sélection = nom + taille, impossible à partager | visite recruteur / styliste |
R-11 | R | haute | pages HTML | jamais servies depuis le cache (Vercel) ; The Book : plus gros élément à 5,7-6,7 s sur Android moyen en réseau lent | Lighthouse, curl -I. Recoupe B-P3 |
R-12 | R | haute (décision propriétaire) | accueil | rien pour les marques et promoteurs ; adresses Gmail ; Services = un seul « Nous contacter » ; le parcours « sélectionner puis envoyer » n'est expliqué nulle part | visite promoteur / partenaire |
R-13 | R | moyenne | fiches EN | hreflang absents | code source servi |
R-14 | R | moyenne | réception WhatsApp | non signée possible si WHATSAPP_APP_SECRET absent (recoupe A-06) | code |
R-15 | R | moyenne | /admin/ : CV d'une mannequin ; js/app.js:256 et 269 | logo en chemin relatif assets/logo-header.png → /admin/assets/… introuvable : CV sans logo | journal des vraies visites (13/11) + code |
R-16 | R | moyenne | fiches /book/… sur téléphone (.fiche-telecharger) | rangée « Compcard PDF JPEG » dépasse de 12 px | journal des vraies visites |
R-17 | R | moyenne | /integrer-agence (Chrome 101, Android 8.1) | « Identifier 'enMo' has already been declared » : app.js exécuté deux fois | journal des vraies visites |
R-18 | R | moyenne | /integrer-agence, /cours-talons | chez de vrais visiteurs : 14 à 70 s et 44 s de chargement complet | journal des vraies visites (7 jours) |
R-19 | R | moyenne | images Actualités / Événements | fichiers jusqu'à 515 Ko affichés en petit (~1,8 Mo sur /actualites) ; recoupe B-P3 | mesure réseau |
R-20 | R | basse | 57 fichiers SQL | 31 fonctions définies dans plusieurs fichiers + 12 secours « SQL pas encore collé » : recoller un vieux fichier remet une vieille fonction (complète C-P3) | git grep |
Confirmés par R : A-01 (vérifié en ligne : /docs/rls-matrix.md, /DECISIONS.md, /GUIDE-DE-SECOURS.md → 200), B-P5, A-08, C-P6, B-P8, B-P13.
⚠️ Avant toute fusion des rapports dans main : compléter `.vercelignore` (A-01), sinon les rapports d'audit seront publiés.

**Proposition du renfort pour la mise en ligne finale (§23), à valider par A, B, C, D :** l'**agent C**.
Raisons : il a déjà mené les dernières fusions dans main (PR #452 du 15/11), il a la lecture de la base et de Vercel
(contrôle du déploiement et retour arrière). D reste libre pour la visite humaine avant/après la mise en ligne
(§24) ; A et B relisent. Si C refuse, deuxième choix : A (vérifications en ligne par l'outil Vercel).
Que chaque agent écrive « d'accord » ou une autre proposition dans sa section.

D-01 | D | haute | = A-03, **confirmé en vrai** avec le compte d'essai rôle « site » | dans `admins` | lit casting_applications (contacts des parents), inscriptions_mannequins (référence de paiement), cours_talons (référence Wave, montant) ; voit « ✓ Paiement reçu (Wave) / Payé en espèces » et « Supprimer » (aucun clic) |
D-02 | D | haute | 11 candidatures du 06 au 12/11 | aucune ligne casting_photos (corrigé depuis le 14/11) ; photos jamais reçues → à redemander sur WhatsApp | casting_applications × casting_photos |
D-03 | D | moyenne | js/app.js:256, 269, 1391 | chemin relatif assets/logo-header.png → 404 sous /admin/ : CV (aperçu, PDF, JPEG) sans logo depuis l'Administration | 404 en visite + journal 13/11 |
D-04 | D | moyenne | /integrer-agence, /cours-talons | vrais visiteurs : chargement complet 14 à 70 s (31 s cours-talons) ; 59 fichiers, 1,7 Mo, load 5,7 s même en bonne connexion (recoupe C-P9, B-P1) | journal_erreurs 7 j + mesure Pixel 5 |
D-05 | D | moyenne | application, Accueil et Paiements | agence fermée jusqu'au 1/3/2027 mais « CE MOIS-CI … mois 1 sur 9 » ; « il reste 17 mois » contre « 0 / 18 mois payés » | visite réelle ; js/app.js:934-947 + mes_mensualites (B/C : vérifier le SQL) |
D-06 | D | basse | Administration, Mannequins | liste 5–6 s, fiche 6–7,6 s, CV 5,5 s (avec le relais de mon environnement : à remesurer) | visite réelle |
D-07 | D | basse | journal_erreurs | fausses alarmes « À corriger » venant de Chrome 45 / Windows 7 (et UA « Pixel C » : enMo déjà déclaré, non reproduit) | journal 14–15/11 |
D-08 | D | basse | /book/… à ≈360 px | boutons Compcard PDF JPEG dépassent de 12 px (journal ; non vu à 390 px) | journal 14/11 |
Confirmés par D : A-03 (= D-01), B-P4 = C-P1 (page d'accueil en ligne), C-P9, B-P1/C-P2 (journal réel), A-04 en partie (?utm_source=… dans journal_erreurs.page).

## 5. Désaccords à vérifier

On ne tranche pas par vote : on retourne au site, au code ou aux journaux.

### Réponses de la propriétaire

- 15/11/2026, 23:11 (question de A, lié à A-03) : valider le paiement d'un cours de talons (et créer la recette en
  comptabilité) est réservé à **la personne chargée des encaissements et à l'administrateur principal**. Jamais
  l'« Administrateur du site ». Aujourd'hui, `cours_talons_valider` l'autorise à tort (`portail_peut('site')`).

## 6. Décisions (accord des 4 agents + propriétaire)

Format : `ID problème | solution retenue | branche | testé par | validé par`
