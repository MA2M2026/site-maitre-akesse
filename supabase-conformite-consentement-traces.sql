-- =====================================================================================================
-- Conformité ARTCI, côté site (23/11/2026, accord de la propriétaire)
-- =====================================================================================================
-- 1. Preuve du consentement : chaque candidature, inscription aux cours de talons, message de contact et demande
--    de recruteur garde la VERSION de la politique de confidentialité acceptée (envoyée par le serveur du site)
--    et la DATE de cet accord (posée par la base elle-même, impossible à inventer par la page).
--    Les fiches déjà enregistrées restent vides (on ne fabrique pas une preuve après coup).
-- 2. Effacement automatique des TRACES TECHNIQUES seulement (choix de la propriétaire) :
--    adresses IP des formulaires et des connexions, compteurs et journal des blocages : 12 mois
--    (le journal des actions de l équipe, audit_log, reste en écriture seule : personne ne peut l effacer, pas même
--    cette tâche, pour qu aucune action ne puisse être cachée)
--    erreurs techniques : 6 mois
--    statistiques de visites : 14 mois
--    Aucune personne, aucun dossier, aucune photo n est effacé par ce fichier ni par la tâche de nuit.
--    Les dossiers (candidatures retenues, mannequins, élèves, contacts, recruteurs) restent supprimés au clic.
-- A COLLER UNE FOIS dans Supabase (SQL Editor, bouton orange Run without RLS), AVANT la mise en ligne.
-- Peut être recollé sans risque.

-- ---------- 1. preuve du consentement
alter table public.casting_applications add column if not exists politique_version text;
alter table public.casting_applications add column if not exists consentement_le timestamptz;
alter table public.cours_talons add column if not exists politique_version text;
alter table public.cours_talons add column if not exists consentement_le timestamptz;
alter table public.messages_contact add column if not exists politique_version text;
alter table public.messages_contact add column if not exists consentement_le timestamptz;
alter table public.recruiter_requests add column if not exists politique_version text;
alter table public.recruiter_requests add column if not exists consentement_le timestamptz;

-- la date de l accord est toujours posée par la base, au moment de l enregistrement (jamais reçue de la page)
create or replace function consentement_dater()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.politique_version is not null then
    new.politique_version := left(new.politique_version, 20);
    new.consentement_le := now();
  else
    new.consentement_le := null;
  end if;
  return new;
end;
$$;
revoke all on function consentement_dater() from public, anon, authenticated;

drop trigger if exists casting_applications_consentement on public.casting_applications;
create trigger casting_applications_consentement before insert on public.casting_applications
  for each row execute function consentement_dater();
drop trigger if exists cours_talons_consentement on public.cours_talons;
create trigger cours_talons_consentement before insert on public.cours_talons
  for each row execute function consentement_dater();
drop trigger if exists messages_contact_consentement on public.messages_contact;
create trigger messages_contact_consentement before insert on public.messages_contact
  for each row execute function consentement_dater();
drop trigger if exists recruiter_requests_consentement on public.recruiter_requests;
create trigger recruiter_requests_consentement before insert on public.recruiter_requests
  for each row execute function consentement_dater();

-- la preuve ne se modifie pas après coup (ni par l équipe, ni par une page)
create or replace function consentement_garder()
returns trigger language plpgsql set search_path = public as $$
begin
  new.politique_version := old.politique_version;
  new.consentement_le := old.consentement_le;
  return new;
end;
$$;
revoke all on function consentement_garder() from public, anon, authenticated;
drop trigger if exists casting_applications_consentement_garder on public.casting_applications;
create trigger casting_applications_consentement_garder before update on public.casting_applications
  for each row execute function consentement_garder();
drop trigger if exists cours_talons_consentement_garder on public.cours_talons;
create trigger cours_talons_consentement_garder before update on public.cours_talons
  for each row execute function consentement_garder();
drop trigger if exists messages_contact_consentement_garder on public.messages_contact;
create trigger messages_contact_consentement_garder before update on public.messages_contact
  for each row execute function consentement_garder();
drop trigger if exists recruiter_requests_consentement_garder on public.recruiter_requests;
create trigger recruiter_requests_consentement_garder before update on public.recruiter_requests
  for each row execute function consentement_garder();

-- ---------- 2. effacement des traces techniques (chaque nuit à 3 h 47)
create or replace function effacer_traces_techniques()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b int := 0; c int := 0; d int := 0; e int := 0; f int := 0;
begin
  delete from soumissions_formulaires_publics_ip where cree_le < now() - interval '12 months';
  get diagnostics b = row_count;
  delete from connexion_tentatives_ip
    where derniere_tentative < now() - interval '12 months' and (bloque_jusqua is null or bloque_jusqua < now());
  get diagnostics c = row_count;
  delete from connexion_tentatives_compte
    where derniere_tentative < now() - interval '12 months' and (bloque_jusqua is null or bloque_jusqua < now());
  delete from blocages_connexion where cree_le < now() - interval '12 months';
  get diagnostics f = row_count;
  delete from journal_erreurs where created_at < now() - interval '6 months';
  get diagnostics d = row_count;
  delete from page_views where created_at < now() - interval '14 months';
  get diagnostics e = row_count;
  return jsonb_build_object('ip_formulaires', b, 'ip_connexions', c, 'blocages', f, 'erreurs', d, 'statistiques', e);
end;
$$;
revoke all on function effacer_traces_techniques() from public, anon, authenticated;
select cron.unschedule('effacement-traces-techniques') where exists (select 1 from cron.job where jobname = 'effacement-traces-techniques');
select cron.schedule('effacement-traces-techniques', '47 3 * * *', 'select effacer_traces_techniques();');

NOTIFY pgrst, 'reload schema';

-- Contrôle
select case when (select count(*) from information_schema.columns where table_schema = 'public'
                    and table_name in ('casting_applications', 'cours_talons', 'messages_contact', 'recruiter_requests')
                    and column_name in ('politique_version', 'consentement_le')) = 8
                 and (select count(*) from pg_trigger where tgname like '%\_consentement%') = 8
                 and exists (select 1 from cron.job where jobname = 'effacement-traces-techniques')
  then '✅ Conformité : preuve du consentement et effacement des traces techniques installés'
  else '❌ Conformité : installation incomplète' end as controle;
