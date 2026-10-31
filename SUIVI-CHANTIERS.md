# Suivi des chantiers (brief du 31/10/2026 : `PASSATION-BRIEF-31-10-2026.md`)

Règle : « terminé » seulement si tout le chantier est fait, essayé, vu fonctionner, en ligne et vérifié.
Sinon « en cours » (avec ce qui reste) ou « pas commencé ». Aucun secret dans ce fichier (dépôt public).

Branche de travail : `chantier-couleurs-site` (à jour avec `main` le 31/10/2026).
Version en ligne : `main` 1cbf1e4 (28/10/2026, 13 h 13 UTC, déploiement Vercel réussi).

| Chantier | État | Ce qui reste |
|---|---|---|
| Étape 1 : vérifier avant de coder | terminé (31/10) | — |
| 0. Installation de l'application sur tous les téléphones | en cours | corrections en ligne depuis le 28/10, jamais essayées sur de vrais téléphones ; essais réels (iPhone d'abord), corrections, puis vidéo |
| 1. Grille du Book 3 / 4 / 5 | en cours | fait sur la branche ; batterie complète à relancer ; mise en ligne (lot A) ; vérification en ligne |
| 2. Fiche mannequin plus rapide | en cours | demandes en parallèle faites sur la branche ; reste : mesurer et accélérer la grande photo, temps avant/après sur téléphone ; mise en ligne |
| 3. Application mannequin pleine largeur | en cours | fait sur la branche ; batterie, mise en ligne (lot A), vérification |
| 4. Bande « Télécharger l'application » rouge foncé | en cours | fait sur la branche ; batterie, mise en ligne (lot A), vérification |
| 5. Édito (SonarCloud) + documentation | en cours | correction faite sur la branche ; README à compléter ; mise en ligne (lot A), SonarCloud |
| 6. Appareil de confiance (Administration) | pas commencé | lot à part, essai réel avec compte de test et accord de la propriétaire |
| 7. Brouillon des actualités et événements | pas commencé | — |
| 8. Photos ajoutées en plusieurs fois | pas commencé | — |
| 9. Modifier les photos d'un article publié | pas commencé | — |
| 10. Même mécanisme pour tous les envois d'images | pas commencé | — |
| 11. Candidatures : plus d'ajout de photos par l'agence | pas commencé | — |
| 12. Évaluation globale (6 visiteurs, contrôles externes) | pas commencé | — |
| 13. Audit des secrets et protection du dépôt | pas commencé | — |
| Après : audit de la sécurité côté serveur (`PLAN-SERVEUR.md`) | pas commencé | — |

## Constats de l'étape 1 (31/10/2026)

- Site public et Administration en ligne répondent (200). L'adresse de l'application des mannequins
  n'est pas joignable depuis l'espace de travail de Claude (réglage réseau de l'environnement) : la vérifier
  depuis un téléphone, ou l'ajouter dans « Network access » → « Allowed domains ».
- Le site en ligne correspond bien à `main` (mêmes numéros de version des fichiers).
- La branche `chantier-couleurs-site` a 10 envois de plus que `main` (56 fichiers), non encore en ligne.
- Chaque envoi sur une branche crée une adresse d'essai Vercel (compte dans la limite d'envois par jour).
- L'accès aux réglages Vercel depuis Claude demande une autorisation de la propriétaire (lien Vercel).
