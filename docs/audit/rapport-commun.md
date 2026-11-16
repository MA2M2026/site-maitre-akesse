# Rapport commun de l'audit MA2M — documents 5 et 6

Rédigé par l'agent B (décision de la propriétaire du 16/11), à partir de `COORDINATION.md` (branche `audit/coordination`)
et des rapports individuels : `docs/audit/rapport-agent-a.md` (`audit/agent-a`), `rapport-agent-b.md` (`audit/agent-b`),
`rapport-agent-c.md` (`audit/agent-c`), `rapport-agent-d.md` (`audit/agent-d`), `outils/audit-renfort/rapport-renfort-1..4.md`
(renfort, superviseur). **Version de travail du 16/11, 11 h 00 GMT** : mise à jour à chaque relecture du superviseur.

Aucune donnée privée, aucun mot de passe ni clé dans ce document.

---

## Document 5 — Rapport consolidé

### 5.1 Méthode

- **Cinq auditeurs** : A (code serveur, droits de la base, publication), B (site public, vitesse, sécurité en lecture),
  C (site public, code, sécurité en lecture), D (seul avec des accès réels de test : Administration rôle « site » et
  espace mannequin, en lecture seule), le renfort (parcours candidate sur Android en 4G lente, booking, sécurité ;
  superviseur depuis le 16/11).
- **Rien n'a été modifié sur le site ni dans les données pendant l'audit** : visites, lectures, mesures.
- **Chaque constat retenu a été confirmé par au moins deux agents**, ou en vrai par D, ou dans la base réelle.
  Les désaccords ont été tranchés en retournant au site, au code ou aux journaux, jamais par vote (exemple : C-P4
  « scripts réservés protégés », démenti par R-03, vérifié par B et C, corrigé).

### 5.2 Points forts confirmés

| Point fort | Constaté par | Confirmé par |
|---|---|---|
| Toutes les tables ont leurs règles de sécurité (RLS) ; les visiteurs ne voient que les colonnes publiques des profils (ni téléphone, ni e-mail, ni date de naissance) | C (C-F1, C-F2) | B (17 tables lues sans connexion), D (72 tables, en vrai) |
| Profils et photos non publiés invisibles sans connexion | B (B-F3) | D (D-F3) |
| Fonctions sensibles de la base : administratrice + appareil vérifiés (`portail_admin_ok`) ; fonctions publiques touchant du privé : clé ou jeton exigé | B (B-F4) | renfort (R-F2) |
| Double authentification exigée par la base ET par le serveur ; un compte administrateur ne peut pas être supprimé | A (A-F2, A-F3) | — (lecture du code) |
| Envoi des photos du Book signé par le serveur (propriétaire ou agence, dossier imposé, type et taille signés) | C (C-F5) | B (B-F6), A |
| En-têtes HTTPS complets (HSTS preload, X-Frame-Options, nosniff…) ; TLS A+, Mozilla Observatory A+ | B (B-F5) | renfort (R-F4), A |
| Aucun secret dans le dépôt ; aucune dépendance vulnérable (`npm audit` : 0) | C (C-F8) | B, renfort |
| Accessibilité 100 et référencement 100 (Lighthouse) | B (B-F2) | renfort (R-F4) |
| Les 116 adresses du plan du site répondent sur téléphone et ordinateur ; aucune image cassée ; aucun débordement à 390 px | B (B-F1) | C (232 visites) |
| 42 rubriques de l'Administration et 15 écrans de l'application mannequin sans erreur | D (D-F1, D-F2), en vrai | — (seul D a les accès) |
| Les données métier viennent bien de la base (profils, actualités, événements, partenaires) | renfort (R-F3) | B (visite) |
| Photos des candidatures enregistrées par le serveur, surveillance toutes les 15 min, contrôle du circuit chaque matin (mis en place le 15/11) | B (B-F7) | D (0 candidature sans photo les 14 et 15/11) |
| 130 essais automatiques « comme une visiteuse » avant chaque mise en ligne ; contrôle des règles de sécurité des pages | B (B-F9) | A (A-F8), C |

### 5.3 Problèmes confirmés (liste commune L-1 à L-16)

| L | Problème | Gravité | Trouvé par | Preuve | Solution retenue |
|---|---|---|---|---|---|
| L-1 | Rôle « Administrateur du site » trop ouvert (paiements, suppression, validation des cours de talons) | haute | A (A-03) | D en vrai avec le compte « site » (D-01) | Points sensibles fermés un par un ; validation des talons réservée aux encaissements et au principal ; règle des rôles de la propriétaire (16/11, 09 h 25) vérifiée par A ; contacts des parents **gardés** pour convoquer (décision de la propriétaire) |
| L-2 | Une mannequin peut se publier seule sur le Book, y compris mineure | haute | renfort (R-02) | D dans la base réelle (D-V1) | Gardien qui fige les réglages de l'agence ; minorité calculée sur l'ancienne date de naissance |
| L-3 | Documents internes du projet lisibles sur le site (`/docs/…`, `DECISIONS.md`…) | haute | A (A-01) | B, C, renfort en ligne (200) | `.vercelignore` complété |
| L-4 | Tâche de 8 h jamais exécutée : anniversaires, documents, relances des mensualités | haute | B (B-V5) | code (`api/portail.js:202`) + base (aucun anniversaire envoyé) | Clés `CRON_SECRET` et `EMAILJS_PRIVATE_KEY` posées sur Vercel avec la propriétaire ; contrôle le lendemain de la mise en ligne |
| L-5 | Formulaire de candidature : faux fichiers comptés comme photos, envois trop lourds, double envoi, bouton « Envoyer » couvert sur Android | haute | renfort (R-04 à R-07) | D (D-V2), essais navigateur | Fichiers non-images refusés et nommés, grosses images allégées, verrou au premier appui, bandeau « Appli MA2M » retiré des formulaires |
| L-6 | Compte d'équipe créé sans preuve de l'adresse e-mail | haute | renfort (R-01) | code | Compte créé non confirmé, lien de confirmation par e-mail, demande acceptable seulement adresse confirmée (décision de la propriétaire) |
| L-7 | Formulaires publics : colonnes libres, anti-robots non strict, dépôt Drive ouvert | moyenne | A (A-08), B (B-P5, B-P6) | B (B-V4) | Liste blanche des colonnes par formulaire ; anti-robots strict avec second jeton automatique ; seules les vraies images rangées dans Drive, avec un budget horaire |
| L-8 | Scripts réservés de l'Administration lisibles par une adresse codée | moyenne | renfort (R-03) | B et C en ligne (3 variantes → 200) | Adresse décodée avant comparaison (`middleware.js`) ; vérifié sur la version d'essai par B et C |
| L-9 | Lenteur et pages qui « sautent » au chargement ; photos lourdes ; pages jamais en cache | moyenne | B, C, D, renfort | mesures (CLS, Lighthouse, journal des vraies visites) | Pages qui sautent corrigées (B) ; nouvelles photos d'actualités allégées avant l'envoi (A) ; cache des photos : un réglage Cloudflare par la propriétaire |
| L-10 | 6 pages sans règle de sécurité stricte | moyenne | C (C-P1) | B (B-P4), A | Règle stricte par empreintes sur les 6 pages |
| L-11 | Jetons personnels (accord parental, reçu, convocation) écrits dans le journal des erreurs | moyenne | A (A-04) | C | Seul le nom des paramètres est gardé |
| L-12 | CV dans l'Administration sans logo | moyenne | D (D-03) | renfort (R-15), C | Chemin absolu du logo |
| L-13 | Formation affichée pendant la pause ; « 17 » contre « 18 mois » | moyenne | D (D-05) | C | Règle de la propriétaire : septembre à novembre comptent, pause décembre à février ; message de pause (D, en cours) |
| L-14 | Photos de candidates jamais arrivées dans Drive | action | D (D-02) | B (rattrapage du 15/11 : 18 candidatures réparées, 63 photos) | Liste remise à la propriétaire pour les redemander |
| L-15 | Décisions : prix de l'Académie (non), entrée « marques et promoteurs » (oui), booking (demande complète) | décision | renfort | — | Maquette validée par la propriétaire ; construction par C ; demande de booking réparée (R-09) |
| L-16 | Basses : SQL non suivi, verrous « ouverts si absents », code inutilisé, vidéos publiées, catch vides, hreflang, h1 doubles, boutons +12 px, fausses alarmes | basse | tous | — | Parts de B et C faites par D (acceptées) ; part de A ensuite |

### 5.4 Ce qui reste hors de cette série

- **Photos du Book des mannequins** (Cloudflare) : même schéma d'envoi que les photos Drive avant le 15/11 ; risque
  plus faible (la mannequin voit le résultat), à vérifier dans une prochaine série.
- **Essais réels** de L-2 et L-6 (D, avec un compte de test) : seulement avec l'accord écrit de la propriétaire.
- **Programme Google** (`scripts/apps-script-photos-drive.gs`, L-7) : à recoller par la propriétaire au moment de la mise en ligne.

---

## Document 6 — Liste des corrections effectuées

État au 16/11, 11 h 00 GMT. « Accepté » = relu et accepté par le superviseur. Rien n'est en ligne : tout part ensemble
dans **une seule** mise en ligne par C, après la batterie finale et l'accord écrit de la propriétaire.

| Chantier | Branche, commit | Par | Essais | État |
|---|---|---|---|---|
| L-3, L-8, L-11, L-12 | `audit/renfort-corrections`, cebd0d0f (+ 2d63fa2f, numéros de version, B) | renfort | `node --check`, `verifier-csp.py` OK ; L-3 et L-8 vérifiés sur la version d'essai Vercel par B et C ; batterie 128/130 (2 échecs sans lien, voir ci-dessous) | ✅ accepté (L-12 : visite réelle de D après la mise en ligne) |
| L-1 partie 1 et vérification des rôles | `audit/corr-a`, 8a15c578, 5d3b9dc0 (le rôle « site » ne marque plus une inscription « payée »), b22d62fe (comptages de caisse réservés à la comptabilité et au principal) | A | base d'essai locale verte ; essais des rôles | ✅ acceptés ; partie 2 (a945d451) **retirée** (décision de la propriétaire : contacts gardés) |
| L-2 | `audit/corr-c`, 5170d754 (+ compatibilité avec L-1) | C | base d'essai 6/6 | ✅ fait ; SQL à coller avec l'accord écrit de la propriétaire ; essai réel par D |
| L-4 | Vercel (clés posées le 16/11) | B, avec la propriétaire | contrôle le lendemain de la mise en ligne à 8 h 06 | ✅ accepté |
| L-5 | `audit/corr-d`, e6d0907e (+ 05868fa) | D | `test-candidature-fichiers.js` 7 ✓ + 7 séries d'essais ; contre-vérification de C | ✅ accepté |
| L-6 | `audit/corr-c`, efe5cb65 + 83220054 | C | base d'essai 5/5, `test-demandes-acces.js` | ✅ fait ; SQL à coller avec accord ; essai réel par D ; dépend de L-4 (clé EmailJS) |
| L-7 | `audit/corr-a`, 919d602d + ace7dcff | A | `test-anti-robots.js` 15/15, `test-inscription` 82/82, `test-cours-talons` 269/269… | ✅ accepté ; programme Google à recoller |
| L-9 partie 1 (pages qui sautent) | `audit/corr-b`, a3308767 | B | CLS : Atelier talons 0,37 → 0, Postuler 0,19 → 0, Postuler EN 0,29 → 0,03 ; apparence identique sur 6 pages | fait, ajouté à `audit/corrections` (7a60e64d) |
| L-9 partie 2 (photos d'actualités) | `audit/corr-a`, a36e67f5 | A | nouvelles photos allégées avant l'envoi (1,6 Mo → 0,4 Mo) | ✅ accepté ; les photos déjà en ligne restent lourdes (rattrapage à décider, non urgent) |
| L-9 partie 3 (cache des photos) | réglage Cloudflare, sans code | la propriétaire (un clic, marche à suivre de A) | — | à faire par la propriétaire |
| L-10 | `audit/corr-c`, c33413df | C | `verifier-csp.py`, 5 tests | ✅ fait |
| L-13 | `audit/corrections`, 1f95f78 | D | `test-app-mannequin` (+2 cas), `test-reprise-mars`, `test-mensualites`, `test-formation`, `test-cartes-acces`, `test-contraste-applis` ✅ | fait (message « pause de décembre à février, reprise le 1er mars 2027 »), à relire |
| L-14 | — (liste remise) | D | — | ✅ accepté |
| L-15 | maquette bccae75e | renfort, puis C | — | maquette validée ; construction en cours |
| L-16 (parts B et C) | `audit/corr-d`, fb155395, 330ed46b | D | essais ajoutés | ✅ acceptés |
| Fond `.se-date` (Administration) | c0bd9690 | D | doit faire passer `test-contraste-applis.js` | fait, ajouté à `audit/corrections` |
| Suppression des vieux messages d'essai (demande de la propriétaire) | `audit/corr-c`, 3ac7a81e | C | `test-suppression-messages.js` 10/10, base d'essai 2/2 | ✅ accepté sous condition (noms réels des règles de la base), condition vérifiée par D : noms identiques ; SQL à coller avec accord |

**Rassemblement** : `audit/corrections` (C, 7a60e64d) = renfort-corrections + corr-c + corr-d + corr-a (sans a945d451 ni
ea364a01, doublon de corr-b) + corr-b + fond `.se-date`. Reste à ajouter : suppression des messages d'essai (après relecture).

**Batterie finale** : pas encore lancée (attend L-9, vérification des rôles, message de pause, fond `.se-date`).
Règle : **0 échec** avant la mise en ligne.
