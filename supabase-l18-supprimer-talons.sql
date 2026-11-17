-- =====================================================================================================
-- L-18 (c) : bouton Supprimer pour les cours de talons (17/11/2026, demande de la propriétaire)
-- =====================================================================================================
-- Seul l administrateur principal peut supprimer une inscription au cours de talons (même règle que les
-- candidatures et les demandes recruteurs : portail_est_principal).
-- Ses séances partent avec elle (clé étrangère ON DELETE CASCADE) : les créneaux sont libérés.
-- Ses photos chez Cloudflare sont effacées ensuite par le site (base d abord, fichiers ensuite).
-- A COLLER UNE FOIS dans Supabase (SQL Editor, bouton orange Run without RLS), avec l accord écrit de la
-- propriétaire. Rien n est effacé par ce fichier. Peut être recollé sans risque.

drop policy if exists "Cours de talons : le principal supprime" on public.cours_talons;
create policy "Cours de talons : le principal supprime" on public.cours_talons
  for delete using (portail_est_principal());

-- Contrôle
select case when exists (select 1 from pg_policies where tablename = 'cours_talons' and cmd = 'DELETE'
                           and policyname = 'Cours de talons : le principal supprime')
  then '✅ L-18 : le principal peut supprimer une inscription au cours de talons'
  else '❌ L-18 : règle absente' end as controle;
