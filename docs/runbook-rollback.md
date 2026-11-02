# Retour en arrière après une mise en ligne (procédure, 02/11/2026)

## Le site ne marche plus après une mise en ligne : revenir à la version précédente (2 minutes, sans code)
1. Ouvrir vercel.com → projet `site-maitre-akesse-kiw2` → onglet **Deployments**.
2. Trouver la mise en ligne précédente (environnement **Production**, état **Ready**, commit d'avant).
3. Menu « … » → **Promote to Production** (ou **Instant Rollback**). Le site revient en quelques secondes.
4. Vérifier : `curl -sI https://www.maitreakessemodelmanagement.com/ | grep x-ma2m-build` doit afficher l'ancienne version.

Pour un agent avec l'outil Vercel : `list_deployments` (target production) puis `request_rollback` / `request_promote`
vers l'avant-dernier déploiement prêt.

## Ensuite, corriger proprement
- Ne jamais réécrire l'historique de `main`. Annuler la fusion fautive par un `git revert -m 1 <commit de fusion>` sur
  une branche, demande de fusion, vérification GitHub verte, puis fusion (Vercel remet la bonne version en ligne).
- Relancer `bash scripts/tests-visiteur/lancer.sh` et `node scripts/verify-dynamic.mjs --url https://www.maitreakessemodelmanagement.com`.

## Base de données (Supabase)
- Les extensions SQL sont ajoutées à la fin de `supabase-extension.sql` et doivent pouvoir se recoller. Chacune indique
  comment revenir en arrière (ex. Extension 153 : `ALTER FUNCTION … RESET search_path;`).
- Avant de coller une extension sur la vraie base : sauvegarde (Supabase → Database → Backups, ou
  `.github/workflows/sauvegarde-base.yml`) et accord de la propriétaire.

## Repères
- 02/11/2026 : versions en ligne successives ede3766 → fdf866b → a0dc54c → f4a0032 → dd63a51 (180/180 vérifié).
- Avant la phase 2 : 8250275.
