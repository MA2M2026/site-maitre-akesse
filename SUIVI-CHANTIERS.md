# Suivi des chantiers (brief du 31/10/2026 : `PASSATION-BRIEF-31-10-2026.md`)

Règle : « terminé » seulement si tout le chantier est fait, essayé, vu fonctionner, en ligne et vérifié.
Sinon « en cours » (avec ce qui reste) ou « pas commencé ». Aucun secret dans ce fichier (dépôt public).

Branche de travail : `chantier-couleurs-site` (à jour avec `main` le 31/10/2026).
Version en ligne : `main` 0a0f4e4 (lot A, 31/10/2026, 17 h 32 UTC, déploiement Vercel réussi).
Retour en arrière possible : version précédente `main` 1cbf1e4 (28/10/2026).

| Chantier | État | Ce qui reste |
|---|---|---|
| Étape 1 : vérifier avant de coder | terminé (31/10) | — |
| 0. Installation de l'application sur tous les téléphones | en cours | corrections en ligne depuis le 28/10, jamais essayées sur de vrais téléphones ; essais réels (iPhone d'abord), corrections, puis vidéo |
| 1. Grille du Book 3 / 4 / 5 | terminé (31/10) | — (vérifié en ligne : 3 / 4 / 5 colonnes, rien ne déborde) |
| 2. Fiche mannequin plus rapide | en cours | étape faite (31/10, branche) : grande photo lancée dès la liste des photos, âge en parallèle, identité demandée une fois (avant : photo demandée à ≈ 5,3 s, affichée à ≈ 6,2 s en ligne) ; reste : batterie, mise en ligne (prochain lot), mesure en ligne et sur un vrai téléphone |
| 3. Application mannequin pleine largeur | en cours | en ligne (31/10) ; reste : vérification en ligne sur téléphone/tablette (adresse de l'application bloquée depuis l'espace de travail) |
| 4. Bande « Télécharger l'application » rouge foncé | terminé (31/10) | — (vérifié en ligne : rouge profond #5A141B, contour blanc) |
| 5. Édito (SonarCloud) + documentation | terminé (31/10) | — (SonarCloud après mise en ligne : 0 bug, 0 faille, notes au maximum ; README à jour) |
| 6. Appareil de confiance (Administration) | pas commencé | lot à part, essai réel avec compte de test et accord de la propriétaire |
| 7. Brouillon des actualités et événements | en cours | étape faite (31/10, branche) : brouillon gardé dans le navigateur, retrouvé en revenant ou après rechargement, effacé à la publication ; essai test-brouillon-photos.js ; reste : batterie, mise en ligne, essai réel par la propriétaire |
| 8. Photos ajoutées en plusieurs fois | en cours | étape faite (31/10, branche) : les choix s'ajoutent, « ✕ » pour retirer, au plus 30 ; reste : batterie, mise en ligne, essai réel par la propriétaire |
| 9. Modifier les photos d'un article publié | en cours | étape faite (31/10, branche) : flèches (ordre), étoile (couverture), croix (retirer, fichier effacé du stockage après la base), « Annuler », gardé dans le brouillon ; essai test-photos-article-publie.js ; reste : batterie, mise en ligne, essai réel par la propriétaire |
| 10. Même mécanisme pour tous les envois d'images | en cours | étape faite (31/10, branche) : inventaire (README-TECHNIQUE.md), outil partagé js/admin/photos-choisies.js pour les actualités, événements et photos du Book ; photos d'iPhone acceptées partout ; étiquette « Compcard » rendue lisible ; reste : batterie, mise en ligne, essai réel par la propriétaire |
| 11. Candidatures : plus d'ajout de photos par l'agence | en cours | étape faite (31/10, branche) : plus de « Ajouter une photo » ni de « Remplacer » ; voir, agrandir et supprimer restent ; essai test-nouvelle-admin-castings.js ; reste : batterie, mise en ligne, vérification |
| 12. Évaluation globale (6 visiteurs, contrôles externes) | pas commencé | — |
| 13. Audit des secrets et protection du dépôt | pas commencé | décision de la propriétaire (31/10) : à faire À LA FIN |
| Après : audit de la sécurité côté serveur (`PLAN-SERVEUR.md`) | pas commencé | — |

## Constats de l'étape 1 (31/10/2026)

- Site public et Administration en ligne répondent (200). L'adresse de l'application des mannequins
  n'est pas joignable depuis l'espace de travail de Claude (réglage réseau de l'environnement) : la vérifier
  depuis un téléphone, ou l'ajouter dans « Network access » → « Allowed domains ».
- Le site en ligne correspond bien à `main` (mêmes numéros de version des fichiers).
- La branche `chantier-couleurs-site` a 10 envois de plus que `main` (56 fichiers), non encore en ligne.
- Chaque envoi sur une branche crée une adresse d'essai Vercel (compte dans la limite d'envois par jour).
- L'accès aux réglages Vercel depuis Claude demande une autorisation de la propriétaire (lien Vercel).

## Lot A mis en ligne le 31/10/2026

Batterie complète : 73 parcours, 3 590 vérifications, 0 échec (après correction d'un essai qui ne
lisait pas « 1er novembre »). Base d'essai : tous les fichiers SQL passent. 58 fichiers changés.
