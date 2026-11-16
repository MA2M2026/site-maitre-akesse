-- ════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Supprimer les vieux messages d'essai venus du site (demande de la propriétaire, 16/11/2026, 10 h 15)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════
-- « De vieux messages d'essai écrits depuis le site restent dans l'Administration : je veux pouvoir les supprimer
-- moi-même » : bouton « Supprimer » avec confirmation, ADMINISTRATRICE PRINCIPALE SEULEMENT, aucune suppression
-- automatique. Ici, la base l'impose aussi (pas seulement l'écran) :
--   • messages de contact : la suppression est ouverte, au principal seulement (il n'y en avait pas) ;
--   • candidatures et demandes recruteurs : la suppression passe de « tous les admins » au principal seulement.
-- (Les photos d'une candidature partent avec elle : casting_photos … on delete cascade ; les copies Google Drive
-- restent. Aucune photo de mannequin n'est concernée.)
-- À coller une fois dans Supabase (SQL Editor). Contrôle : « 3 éléments sur 3 ».

-- toutes les règles de SUPPRESSION existantes de ces 3 tables sont retirées, QUEL QUE SOIT LEUR NOM (relecture du
-- superviseur, 16/11 : un nom supposé qui ne correspondrait pas laisserait l'ancienne règle en place)
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('messages_contact', 'casting_applications', 'recruiter_requests')
             and cmd in ('DELETE', 'ALL') loop
    if r.policyname not in ('Le principal supprime un message de contact', 'Le principal supprime une candidature', 'Le principal supprime une demande recruteur') then
      -- (une règle « ALL » donnerait aussi la suppression : signalée, jamais retirée en silence)
      if (select cmd from pg_policies where schemaname = 'public' and tablename = r.tablename and policyname = r.policyname) = 'ALL' then
        raise notice 'À regarder : règle « % » (ALL) sur % : elle permet aussi de supprimer.', r.policyname, r.tablename;
      else
        execute format('drop policy %I on %I', r.policyname, r.tablename);
      end if;
    end if;
  end loop;
end $$;

drop policy if exists "Le principal supprime un message de contact" on messages_contact;
create policy "Le principal supprime un message de contact" on messages_contact for delete to authenticated
  using (portail_est_principal());
grant delete on messages_contact to authenticated;

drop policy if exists "Le principal supprime une candidature" on casting_applications;
create policy "Le principal supprime une candidature" on casting_applications for delete to authenticated
  using (portail_est_principal());

drop policy if exists "Le principal supprime une demande recruteur" on recruiter_requests;
create policy "Le principal supprime une demande recruteur" on recruiter_requests for delete to authenticated
  using (portail_est_principal());

NOTIFY pgrst, 'reload schema';

-- Contrôle (à lire après « Run ») : « 3 éléments sur 3, 0 autre règle de suppression »
select 'Suppression des messages installée : ' || (select count(*) from pg_policies where policyname in
  ('Le principal supprime un message de contact', 'Le principal supprime une candidature', 'Le principal supprime une demande recruteur'))
  || ' éléments sur 3, ' || (select count(*) from pg_policies where schemaname = 'public'
    and tablename in ('messages_contact', 'casting_applications', 'recruiter_requests') and cmd in ('DELETE', 'ALL')
    and policyname not in ('Le principal supprime un message de contact', 'Le principal supprime une candidature', 'Le principal supprime une demande recruteur'))
  || ' autre règle de suppression' as controle;
