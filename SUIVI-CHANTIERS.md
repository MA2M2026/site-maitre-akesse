# Suivi des chantiers (brief du 31/10/2026 : `PASSATION-BRIEF-31-10-2026.md`)

Règle : « terminé » seulement si tout le chantier est fait, essayé, vu fonctionner, en ligne et vérifié.
Sinon « en cours » (avec ce qui reste) ou « pas commencé ». Aucun secret dans ce fichier (dépôt public).

Branche de travail : `chantier-couleurs-site` (à jour avec `main` le 31/10/2026).
Version en ligne : `main` 1430a75 (lot C, 31/10/2026 au soir, déploiement Vercel réussi, fichiers en ligne identiques à la branche).
Retour en arrière possible : version précédente `main` 0a0f4e4 (lot A).

| Chantier | État | Ce qui reste |
|---|---|---|
| Étape 1 : vérifier avant de coder | terminé (31/10) | — |
| 0. Installation de l'application sur tous les téléphones | en cours | corrections en ligne depuis le 28/10, jamais essayées sur de vrais téléphones ; essais réels (iPhone d'abord), corrections, puis vidéo |
| 1. Grille du Book 3 / 4 / 5 | terminé (31/10) | — (vérifié en ligne : 3 / 4 / 5 colonnes, rien ne déborde) |
| 2. Fiche mannequin plus rapide | en cours | en ligne (lot C) ; mesuré en ligne (téléphone simulé, Pixel 7) : grande photo visible en ≈ 3,5 à 4 s au lieu de ≈ 6,2 s ; photo de 107 Ko à la taille de l'écran ; reste : mettre en ligne la correction SonarCloud (bug d'une promesse dans js/adresse-fiche.js, corrigé sur la branche) |
| 3. Application mannequin pleine largeur | en cours | en ligne (31/10) ; reste : vérification en ligne sur téléphone/tablette (adresse de l'application bloquée depuis l'espace de travail) |
| 4. Bande « Télécharger l'application » rouge foncé | terminé (31/10) | — (vérifié en ligne : rouge profond #5A141B, contour blanc) |
| 5. Édito (SonarCloud) + documentation | terminé (31/10) | — (SonarCloud après mise en ligne : 0 bug, 0 faille, notes au maximum ; README à jour) |
| 6. Appareil de confiance (Administration) | pas commencé | lot à part, essai réel avec compte de test et accord de la propriétaire |
| 7. Brouillon des actualités et événements | en cours | EN LIGNE (lot C, 31/10) ; reste : essai réel par la propriétaire |
| 8. Photos ajoutées en plusieurs fois | en cours | EN LIGNE (lot C, 31/10) ; reste : essai réel par la propriétaire |
| 9. Modifier les photos d'un article publié | en cours | EN LIGNE (lot C, 31/10) ; reste : essai réel par la propriétaire |
| 10. Même mécanisme pour tous les envois d'images | en cours | EN LIGNE (lot C, 31/10) ; reste : essai réel par la propriétaire |
| 11. Candidatures : plus d'ajout de photos par l'agence | en cours | EN LIGNE (lot C, 31/10) ; reste : vérification |
| 12. Évaluation globale (6 visiteurs, contrôles externes) | pas commencé | — |
| 13. Audit des secrets et protection du dépôt | pas commencé | décision de la propriétaire (31/10) : à faire À LA FIN |
| Après : site dynamique (`PLAN-SERVEUR.md`, chemin A choisi le 31/10) | en cours | branche `site-dynamique` (pas en ligne) : étape 1 faite (fiche d'un mannequin), étape 2 faite (The Book, actualités, événements, partenaires, agenda, parcours, qui sommes-nous : toutes les pages publiques qui affichent des données partent remplies par le serveur ; outil commun pageRemplie / donneesServeur) ; reste : batterie, relecture, mise en ligne avec accord, mesures avant / après ; puis étapes 3 à 5 (formulaires anti-robot, contenu des fichiers, surveillance) |
| 14. Liste de présence des cours du dimanche | en cours | partie 1 faite sur la branche `presences` (pas en ligne) : base (supabase-presences.sql, Extension 142, droits essayés sur la base locale), écran de l'Administration, « Mes cours du dimanche » dans l'application, synthèse ; SQL collé par la propriétaire le 01/11 à 22 h 03 (vérifié : les 5 fonctions existent, un visiteur est refusé partout) ; reste : essai réel avec un compte de test (accord), batterie, mise en ligne ; partie 2 (« Formation terminée », durée à confirmer : 18 ou 24 mois ?) et partie 3 (anniversaires, mannequin du mois, bulletin, mensurations, documents, signe mensualité) |

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
- Formation : 9 mois de cours par an, 3 mois de vacances (durée totale à confirmer : 18 mois ?).
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
