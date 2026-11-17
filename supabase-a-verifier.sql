-- =====================================================================================================
-- Envois « À vérifier » (17/11/2026, décision de la propriétaire)
-- =====================================================================================================
-- Depuis le 17/11, un formulaire public envoyé SANS la vérification anti-robots de Cloudflare (le téléphone n a pas
-- pu la charger) est accepté (api/portail.js, jetonAntiRobotValide). Le serveur le note ici. L Administration
-- affiche alors une étiquette « À vérifier » sur la candidature ou la demande recruteur, avec un bouton
-- « C est une vraie personne » qui retire l étiquette (rien d autre n est touché).
-- Seule l équipe de l agence lit et retire ces étiquettes. Seul le serveur en ajoute.
-- A COLLER UNE FOIS dans Supabase (SQL Editor, Run). Rien n est effacé. Peut être recollé sans risque.

create table if not exists envois_a_verifier (
  ref uuid primary key,
  table_nom text not null check (table_nom in ('casting_applications', 'messages_contact', 'recruiter_requests', 'cours_talons')),
  raison text,
  cree_le timestamptz not null default now()
);
alter table envois_a_verifier enable row level security;
revoke all on envois_a_verifier from anon, authenticated;
grant select, delete on envois_a_verifier to authenticated;
grant all on envois_a_verifier to service_role;

drop policy if exists "L agence lit les envois a verifier" on envois_a_verifier;
create policy "L agence lit les envois a verifier" on envois_a_verifier for select
  using (coalesce(portail_peut('site'), false) or exists (select 1 from admins where user_id = auth.uid()));
drop policy if exists "L agence retire les envois a verifier" on envois_a_verifier;
create policy "L agence retire les envois a verifier" on envois_a_verifier for delete
  using (coalesce(portail_peut('site'), false) or exists (select 1 from admins where user_id = auth.uid()));

-- l étiquette part avec la candidature ou la demande supprimée
create or replace function envois_a_verifier_nettoyer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from envois_a_verifier where ref = old.id;
  return old;
end;
$$;
revoke all on function envois_a_verifier_nettoyer() from public, anon, authenticated;
drop trigger if exists casting_applications_a_verifier on casting_applications;
create trigger casting_applications_a_verifier after delete on casting_applications
  for each row execute function envois_a_verifier_nettoyer();
drop trigger if exists recruiter_requests_a_verifier on recruiter_requests;
create trigger recruiter_requests_a_verifier after delete on recruiter_requests
  for each row execute function envois_a_verifier_nettoyer();

NOTIFY pgrst, 'reload schema';

-- Contrôle
select 'À vérifier : ' || ((select count(*) from pg_tables where tablename = 'envois_a_verifier')
  + (select count(*) from pg_policies where tablename = 'envois_a_verifier')
  + (select count(*) from pg_trigger where tgname in ('casting_applications_a_verifier', 'recruiter_requests_a_verifier'))) || ' éléments sur 5' as controle;
