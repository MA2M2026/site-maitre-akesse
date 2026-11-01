# Décisions (phase 2 : site écrit par le serveur + sécurité)

Une ligne par décision : décision — pourquoi — autre choix écarté.

- 01/11/2026 23 h 51 UTC : tâches programmées « 1 h : contrôle 100 % dynamique puis grand test » et « 3 h : reprise » DÉSACTIVÉES (pas supprimées) — elles devaient mettre en ligne automatiquement l'anti-robots strict b3ef467 ; la mission phase 2 demande de les annuler — suppression écartée (garder l'historique, réactivation possible).
- b3ef467 (anti-robots strict) n'existe sur aucune branche du dépôt en ligne (`git cat-file` : objet inconnu) : il n'était que sur une copie locale `wt-final` d'une autre session ; il ne peut donc pas partir en ligne tout seul — à refaire ou récupérer pour W6c.
- Branche de travail `phase2-dynamique` créée depuis `main` 8250275 (demandée par la mission) — travailler directement sur `main` écarté.
- Repère de retour `pre-phase2-8250275` (étiquette Git) — l'identifiant du déploiement Vercel n'est pas lisible : accès Vercel de l'équipe « ma-2-m » non autorisé pour Claude (à autoriser par la propriétaire).
- Le site en ligne n'est pas joignable depuis l'espace de travail de Claude (réglage réseau : www.maitreakessemodelmanagement.com refusé) : aucune mesure en ligne possible tant que l'adresse n'est pas ajoutée aux « Allowed domains » — pas de résultats inventés à la place.
