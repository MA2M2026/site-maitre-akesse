# Suivi des chantiers (brief du 31/10/2026 : `PASSATION-BRIEF-31-10-2026.md`)

Règle : « terminé » seulement si tout le chantier est fait, essayé, vu fonctionner, en ligne et vérifié.
Sinon « en cours » (avec ce qui reste) ou « pas commencé ». Aucun secret dans ce fichier (dépôt public).

Branche de travail : `chantier-couleurs-site` (à jour avec `main` le 31/10/2026).
Version en ligne : `main` ede3766 (02/11/2026, phase 2 ; avant : c485622 (01/11/2026, après-midi : batterie complète 0 échec sur 4 198 vérifications, en ligne et vérifiée).
Retour en arrière possible : version précédente `main` d179d85 ; base : `retour-appareil-confiance.sql` (gardé hors dépôt) pour le téléphone de confiance.

| Chantier | État | Ce qui reste |
|---|---|---|
| Étape 1 : vérifier avant de coder | terminé (31/10) | — |
| 0. Installation de l'application sur tous les téléphones | en cours | corrections en ligne depuis le 28/10, jamais essayées sur de vrais téléphones ; essais réels (iPhone d'abord), corrections, puis vidéo |
| 1. Grille du Book 3 / 4 / 5 | terminé (31/10) | — (vérifié en ligne : 3 / 4 / 5 colonnes, rien ne déborde) |
| 2. Fiche mannequin plus rapide | en cours | EN LIGNE (01/11, c485622) : cartes vers /book/nom, fiche préparée au toucher, photo du serveur jamais effacée (elle tombait à 0 % : fondu « reveal ») ; mesuré en ligne (Pixel 7 simulé, 4G) : photo en ≈ 1,8 à 2 s au lieu de ≈ 3,6 s, visibilité 100 % ; reste : vérification par la propriétaire sur son téléphone |
| 3. Application mannequin pleine largeur | en cours | en ligne (31/10) ; reste : vérification en ligne sur téléphone/tablette (adresse de l'application bloquée depuis l'espace de travail) |
| 4. Bande « Télécharger l'application » rouge foncé | terminé (31/10) | — (vérifié en ligne : rouge profond #5A141B, contour blanc) |
| 5. Édito (SonarCloud) + documentation | terminé (31/10) | — (SonarCloud après mise en ligne : 0 bug, 0 faille, notes au maximum ; README à jour) |
| 6. Appareil de confiance (Administration) | en cours | EN LIGNE (01/11, c485622), base installée (Extension 149) ; connexion de la propriétaire vérifiée par elle le 01/11 ; reste : essai réel avec un compte de test créé par « Créer mon compte » |
| 7. Brouillon des actualités et événements | en cours | EN LIGNE (lot C, 31/10) ; reste : essai réel par la propriétaire |
| 8. Photos ajoutées en plusieurs fois | en cours | EN LIGNE (lot C, 31/10) ; reste : essai réel par la propriétaire |
| 9. Modifier les photos d'un article publié | en cours | EN LIGNE (lot C, 31/10) ; reste : essai réel par la propriétaire |
| 10. Même mécanisme pour tous les envois d'images | en cours | EN LIGNE (lot C, 31/10) ; reste : essai réel par la propriétaire |
| 11. Candidatures : plus d'ajout de photos par l'agence | en cours | EN LIGNE (lot C, 31/10) ; reste : vérification |
| 12. Évaluation globale (6 visiteurs, contrôles externes) | pas commencé | — |
| 13. Audit des secrets et protection du dépôt | pas commencé | à faire quand la propriétaire est devant son ordinateur (01/11) |
| Après : site dynamique (`PLAN-SERVEUR.md`) | en cours | EN LIGNE : étape A (pages écrites par le serveur), étape B (reçu, places), étape C (textes des 5 pages modifiables, Extension 151 collée le 01/11, écran « Textes des pages ») ; « Créer mon compte » (Extension 150) ; lot 3 (vérification des fichiers, surveillance) ; reste : anti-robot des formulaires (clé Cloudflare Turnstile de la propriétaire, devant son ordinateur) ; corrections SonarCloud du 01/11 prêtes sur la branche `demain` |
| 14. Liste de présence des cours du dimanche | en cours | partie 1 faite sur la branche `presences` (pas en ligne) : base (supabase-presences.sql, Extension 142, droits essayés sur la base locale), écran de l'Administration, « Mes cours du dimanche » dans l'application, synthèse ; SQL collé par la propriétaire le 01/11 à 22 h 03 (vérifié : les 5 fonctions existent, un visiteur est refusé partout) ; reste : essai réel avec un compte de test (accord), batterie, mise en ligne ; partie 2 faite sur la branche : formation de 18 mois de cours, congés (décembre, janvier, février) sans mensualité, mois de congé payé reporté sur le mois de cours suivant (choix de la propriétaire le 01/11), formation terminée proposée à la sortie (supabase-formation.sql, Extension 148, à coller AVANT la mise en ligne) et partie 3 : anniversaires automatiques faits sur la branche (supabase-anniversaires.sql, Extension 143, à coller ; tâche du matin quotidienne) ; mannequin du mois faite (supabase-mannequin-du-mois.sql, Extension 144, à coller) ; signe « mensualité à payer » fait (supabase-presences.sql à recoller) ; bulletins trimestriels faits (supabase-bulletins.sql, Extension 145, à coller) ; mensurations suivies faites (supabase-mensurations.sql, Extension 146, à coller ; déclencheur à essayer pour de vrai) ; documents qui expirent faits (supabase-documents.sql, Extension 147, à coller ; e-mail du matin à l'agence) |
| 15. Liste de présence : cases visibles, « Ne vient plus » | en cours | EN LIGNE (01/11, c485622) ; reste : essai réel par la propriétaire |

## Constats de l'étape 1 (31/10/2026)

- Site public et Administration en ligne répondent (200). L'adresse de l'application des mannequins
  n'est pas joignable depuis l'espace de travail de Claude (réglage réseau de l'environnement) : la vérifier
  depuis un téléphone, ou l'ajouter dans « Network access » → « Allowed domains ».
- Le site en ligne correspond bien à `main` (mêmes numéros de version des fichiers).
- La branche `chantier-couleurs-site` a 10 envois de plus que `main` (56 fichiers), non encore en ligne.
- Chaque envoi sur une branche crée une adresse d'essai Vercel (compte dans la limite d'envois par jour).
- L'accès aux réglages Vercel depuis Claude demande une autorisation de la propriétaire (lien Vercel).

## Lot C : batterie du 31/10/2026 (soir), mis en ligne (main 1430a75)

SonarCloud après mise en ligne : 1 bug (promesse sans gestion d'erreur, js/adresse-fiche.js) et 17
remarques de style : corrigés sur la branche, essais repassés, mise en ligne à faire avec l'accord de la propriétaire.


Après relecture et corrections : 76 parcours, 3 706 vérifications, 0 échec ; base d'essai : tous les
fichiers SQL passent. Contenu : chantiers 2, 7, 8, 9 (avec « Remplacer »), 10, 11 et la compcard
(grande photo entière).

## Lot A mis en ligne le 31/10/2026

Batterie complète : 73 parcours, 3 590 vérifications, 0 échec (après correction d'un essai qui ne
lisait pas « 1er novembre »). Base d'essai : tous les fichiers SQL passent. 58 fichiers changés.

## Chantier 14 : décisions de la propriétaire (31/10/2026)

- Liste de présence : dimanches du mois générés automatiquement ; vert = présent (coché) ; rouge automatique
  le lundi pour un dimanche passé non coché ; orange = absence excusée ; « séance annulée » (ne compte pour
  personne) ; dimanches avant l'entrée de la mannequin non comptés.
- Mentions du mois : toutes = « Apprenant assidu, bravo ! » ; 3/4, 4/5 = Bien ; 2/4, 3/5 = Passable ;
  1/4, 1-2/5 = Insuffisant ; aucune = Absent tout le mois (« À améliorer » côté mannequin).
- Visible dans l'application de la mannequin, sans pouvoir modifier (contrôlé par la base).
- Synthèse sur une période (3, 4 mois, année, formation complète), imprimable.
- Qui coche : la propriétaire ou une personne de l'équipe ayant accès à l'Administration.
- Statut « Formation terminée » : plus de mensualité, plus sur la liste, reste mannequin de l'agence ;
  attestation de fin de formation.
- Formation (confirmé le 01/11/2026) : 2 ans = 2 fois 9 mois de cours (18 mois de cours) ; chaque année 3 mois de congé :
  décembre, janvier, février (pas de cours : ces dimanches ne sont jamais des absences).
- Mensualités (décision du 01/11/2026) : seulement les mois de cours, 9 × 2 = **18 mensualités** ; rien en
  décembre, janvier, février. ⚠ Le système en ligne compte aujourd'hui 24 mois (supabase-administration.sql :
  mes_mensualites, mensualite_etat ; supabase-paiement-avance.sql ; js/mannequin-app.js, js/mes-paiements.js) :
  à corriger avec la partie 2 (« Formation terminée »), essai réel avec un compte de test.
  Mannequins ayant déjà fini : façon de faire à décider.
- Idées gardées (toutes) : bulletin trimestriel ; mensurations suivies ; documents qui expirent ;
  anniversaires (message AUTOMATIQUE par e-mail et WhatsApp) ; mannequin du mois (choisi selon
  l'assiduité et le bulletin) ; signe « mensualité non payée » sur la liste de présence.

## Plan de mise en ligne décidé par la propriétaire (01/11/2026)

Pas de mise en ligne unique (trop risquée), mais 4 lots, chacun avec batterie complète et accord :
1. **Lot 1** : site dynamique (pages préparées par le serveur, branche `site-dynamique`).
2. **Lot 2** : liste de présence complète (parties 1, 2, 3), noir et beige retirés à la source avec garde-fou,
   petites remarques SonarCloud.
3. **Lot 3** : protections serveur (étapes 3 à 5 de `PLAN-SERVEUR.md`).
4. **Lot 4** : appareil de confiance (chantier 6), SEUL, essai réel avec la propriétaire.
Plus tard (décision de la propriétaire) : facture / note de cachet conforme.
## Lot 1 (site dynamique) : batterie du 01/11/2026

Après relecture et corrections : 80 parcours, 3 901 vérifications, 0 échec ; base d'essai : tous les fichiers
SQL passent. Mis en ligne avec l'accord de la propriétaire. Retour en arrière possible : `main` 59cc077.

## Phase 2 : site écrit par le serveur + sécurité (mission du 01/11/2026)

Vocabulaire : `UNVERIFIED`, `IN_PROGRESS`, `BLOCKED`, `PASS(preuve)`, `FAIL(raison)`. Preuves : `evidence/` (hors dépôt).
Branche : `phase2-dynamique` (depuis `main` 8250275). Retour en arrière : étiquette `pre-phase2-8250275`.

| Chantier | État | Blocage / reste |
|---|---|---|
| W0 Tri de départ | PASS(DECISIONS.md) | envois de 1 h et 3 h désactivés ; retour en arrière : dpl_99F9Ue1NvHjsvqzdbJGJY3547yxP → dpl_3Pr6SMGmavSd9uh1AiXHPsr4ykVM |
| W1 Inventaire des pages | IN_PROGRESS | docs/routes.md écrit ; reste : sitemap généré depuis la base |
| W2 Pages complètes écrites par le serveur | PASS(evidence/prod-dd63a51.txt) | 180/180 sur le vrai site le 02/11/2026 (main dd63a51) ; reste hors W2 : plan du site généré depuis la base |
| W3 Cache exact | PASS(evidence/prod-apres-phase2.txt) | en ligne : Cache-Control explicite, x-ma2m-render: ssr, x-ma2m-build, plus de x-vercel-cache/age recopiés ; borne de fraîcheur 180 s documentée |
| W4 Retirer le code d'administration des pages publiques | PASS(evidence/prod-apres-w4.txt) | EN LIGNE (fdf866b) : 6 pages sans panneau ni bouton ; scripts d'écriture « introuvables » (404) sans la clé de l'agence ; essai test-publications.js |
| W5 Appareil de confiance (2FA) | UNVERIFIED | accord S2 + compte de test nécessaires |
| W6 Sécurité (envois, limites, en-têtes, RLS, secrets…) | IN_PROGRESS | W6i secrets : PASS(evidence/W6i-secrets.txt) — historique complet, aucun secret (clé anon seulement), npm audit 0 ; reste : a, b, c, d, e, f, g, h, j, k, l |
| W7 Vitesse (LCP ≤ 2,5 s) | FAIL(evidence/W7-lcp-apres.txt) | accueil 5,4 → 3,3 s, Book 4,9 → 4,3 s, fiche 3,9 → 4,0 s (Slow 4G simulé, médiane de 5) ; branche : annonce de la photo avant les scripts bloquants, premier visage du mur annoncé ; reste : feuilles de style bloquantes |
| W8 Administration du contenu | UNVERIFIED | — |
| W9 Essais automatiques | UNVERIFIED | — |
| W10 Documentation | UNVERIFIED | — |

### Prêt sur la branche `phase2-dynamique`, PAS encore en ligne (02/11/2026)
- Jauge « Envoi de la photo… » qui s'affichait à l'ouverture de l'Administration (travail automatique) : corrigée, essai test-jauge-rattrapage.js.
- Vitesse : photo annoncée avant les scripts bloquants, premier visage du mur annoncé ; accueil : photo « À la une » en version moyenne, traductions avec 3 s.
- Avant la mise en ligne : batterie complète + relecture du code (pas encore faites sur ces derniers changements).
