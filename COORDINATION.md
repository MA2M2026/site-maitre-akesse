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
| Agent A (ouvreur de ce fichier) | `audit/agent-a` | Non | Inscrit, en attente des autres |
| Agent B | `audit/agent-b` | Non pour l'interface (aucun mot de passe de l'Administration ni de l'espace mannequin). Oui en lecture directe de la base Supabase (connecteur autorisé par la propriétaire) | Inscrit |
| Agent C | `audit/agent-c` | Non pour l'interface : pas de compte pour se connecter à l'administration ni à l'espace mannequin (pas de mot de passe ni de double authentification). Oui en lecture seule pour la **vraie base de données** (connecteur Supabase) et pour les mises en ligne (connecteur Vercel) ; toute écriture dans la base demande la confirmation de la propriétaire | Inscrit |
| Agent D | | | |

- **Agent testeur humain** (celui qui a les accès réels) : _à désigner_
- **Agent chargé de la mise en ligne finale** : _à désigner_

## 2. Avancement par phase

| Phase | A | B | C | D |
|-------|---|---|---|---|
| Audit site public | | | | |
| Audit du code | | | | |
| Audit sécurité | | | | |
| Rapport individuel déposé | | | | |

Les rapports individuels vont dans `docs/audit/rapport-agent-X.md`.

## 3. Points forts proposés

Format : `ID | agent | constat | preuve (page, fichier:ligne) | confirmé par`

## 4. Problèmes proposés

Format : `ID | agent | gravité (critique/haute/moyenne/basse) | lieu | cause | preuve | confirmé par`

## 5. Désaccords à vérifier

On ne tranche pas par vote : on retourne au site, au code ou aux journaux.

## 6. Décisions (accord des 4 agents + propriétaire)

Format : `ID problème | solution retenue | branche | testé par | validé par`
