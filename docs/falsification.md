# Si quelque chose a été falsifié (procédure, 07/11/2026)

Exemples : une photo ou un texte du site changé sans l'agence, un paiement « validé » que personne n'a validé, un
compte de l'équipe inconnu, des écritures de comptabilité qui ne correspondent à rien.

## 1. Arrêter l'accès (5 minutes, par l'administrateur principal)
- Administration › Sécurité › couper l'accès du compte suspect (ou de tous sauf le sien) ; révoquer ses appareils.
- Supabase › Authentication › Users : déconnecter le compte (« Sign out user ») ; changer son mot de passe.
- Changer les mots de passe et vérifier la double authentification : GitHub, Vercel, Supabase, Cloudflare.
- Si une clé secrète a pu fuiter (clé `service_role`, clés R2, EmailJS, CRON_SECRET) : la renouveler chez son
  fournisseur, puis la remplacer dans Vercel › Settings › Environment Variables et redéployer.

## 2. Savoir ce qui s'est passé
- Journal de sécurité (Administration › Sécurité › Journal, table `audit_log`) : qui a changé quoi, avant / après.
  Chaque modification des paiements, des écritures, des cachets, des comptes et de l'équipe y est notée par la base
  elle-même (déclencheurs `audit_ecriture`), même si elle vient d'un programme.
- Supabase › Logs (API, Auth) : adresses et heures des appels.
- Vercel › Deployments : une mise en ligne inattendue ? GitHub › commits de `main` : un changement inconnu ?

## 3. Remettre en état
- Site : redéployer la dernière bonne version (docs/runbook-rollback.md).
- Base : la sauvegarde de la semaine (`.github/workflows/sauvegarde-base.yml`, ou Supabase › Database › Backups).
  Ne JAMAIS restaurer toute la base sans l'accord de la propriétaire : on perdrait ce qui a été fait depuis.
  Préférer corriger ligne par ligne d'après le journal (valeur « avant »).
- Comptabilité : on n'efface pas ; on corrige par une écriture inverse avec un motif (exception : remise à zéro
  demandée par la propriétaire le 07/11/2026, avec copie Excel/PDF gardée).
- Photos : Cloudflare R2 garde les fichiers ; la liste des photos (`photos_a_sauvegarder`) sert à les retrouver.

## 4. Après
- Noter l'incident dans DECISIONS.md (date, ce qui s'est passé, ce qui a été fait).
- Relancer `node scripts/verify-dynamic.mjs --url https://www.maitreakessemodelmanagement.com` et la batterie.
