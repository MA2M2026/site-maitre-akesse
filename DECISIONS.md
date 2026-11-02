# Décisions (phase 2 : site écrit par le serveur + sécurité)

Une ligne par décision : décision — pourquoi — autre choix écarté.

- 01/11/2026 23 h 51 UTC : tâches programmées « 1 h : contrôle 100 % dynamique puis grand test » et « 3 h : reprise » DÉSACTIVÉES (pas supprimées) — elles devaient mettre en ligne automatiquement l'anti-robots strict b3ef467 ; la mission phase 2 demande de les annuler — suppression écartée (garder l'historique, réactivation possible).
- b3ef467 (anti-robots strict) n'existe sur aucune branche du dépôt en ligne (`git cat-file` : objet inconnu) : il n'était que sur une copie locale `wt-final` d'une autre session ; il ne peut donc pas partir en ligne tout seul — à refaire ou récupérer pour W6c.
- Branche de travail `phase2-dynamique` créée depuis `main` 8250275 (demandée par la mission) — travailler directement sur `main` écarté.
- Repère de retour `pre-phase2-8250275` (étiquette Git) — l'identifiant du déploiement Vercel n'est pas lisible : accès Vercel de l'équipe « ma-2-m » non autorisé pour Claude (à autoriser par la propriétaire).
- Le site en ligne n'est pas joignable depuis l'espace de travail de Claude (réglage réseau : www.maitreakessemodelmanagement.com refusé) : aucune mesure en ligne possible tant que l'adresse n'est pas ajoutée aux « Allowed domains » — pas de résultats inventés à la place.
- 02/11/2026 : accès Vercel autorisé par la propriétaire. Version en ligne = déploiement `dpl_99F9Ue1NvHjsvqzdbJGJY3547yxP` (main 8250275) ; retour en arrière possible vers `dpl_3Pr6SMGmavSd9uh1AiXHPsr4ykVM` (main 16594d6). L'étiquette Git `pre-phase2-8250275` a été refusée à l'envoi (403) : le repère reste le commit 8250275.
- 02/11/2026 : site en ligne joignable depuis l'espace de travail (adresse ajoutée par la propriétaire).
- 02/11/2026 : Supabase branché par la propriétaire. Vraie base = projet `dfhghgmwmxiguhtxtsle` ; second projet `yqbqqkltkoduxydruvaa` en pause (base d'essai possible, avec son accord). Contrôle de sécurité Supabase lu (lecture seule) : 0 erreur ; 84 + 149 fonctions SECURITY DEFINER à revoir, 44 fonctions sans search_path fixé, protection des mots de passe volés désactivée — à traiter dans W6f. Preuves dans `evidence/` (hors dépôt, ajouté à .gitignore).
