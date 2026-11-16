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

drop policy if exists "Le principal supprime un message de contact" on messages_contact;
create policy "Le principal supprime un message de contact" on messages_contact for delete to authenticated
  using (portail_est_principal());
grant delete on messages_contact to authenticated;

drop policy if exists "Les admins suppriment une candidature" on casting_applications;
drop policy if exists "Le principal supprime une candidature" on casting_applications;
create policy "Le principal supprime une candidature" on casting_applications for delete to authenticated
  using (portail_est_principal());

drop policy if exists "Les admins suppriment une demande recruteur" on recruiter_requests;
drop policy if exists "Le principal supprime une demande recruteur" on recruiter_requests;
create policy "Le principal supprime une demande recruteur" on recruiter_requests for delete to authenticated
  using (portail_est_principal());

NOTIFY pgrst, 'reload schema';

-- Contrôle (à lire après « Run ») : 3 éléments attendus
select 'Suppression des messages installée : ' || (select count(*) from pg_policies where policyname in
  ('Le principal supprime un message de contact', 'Le principal supprime une candidature', 'Le principal supprime une demande recruteur'))
  || ' éléments sur 3' as controle;
