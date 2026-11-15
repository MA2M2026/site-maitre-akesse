-- =====================================================================================================
-- Contrôle de santé quotidien du circuit des photos vers Google Drive (15/11/2026, demande de la propriétaire :
-- « s'il y a un problème, qu'il vienne de Google, pas de notre système, et qu'on le sache tout de suite »).
-- À coller APRÈS supabase-medias-drive.sql. Rien n'est effacé ; peut être recollé sans risque.
--
-- Chaque matin à 7 h 13 (heure d'Abidjan), la base demande au programme Google (action « controle ») de faire tout
-- le trajet d'une vraie photo : écrire une petite image d'essai dans Drive, la rendre lisible par lien, l'annoncer à
-- la base avec le mot secret (media_drive_controle_ok), puis la mettre à la corbeille. À 7 h 43, la base vérifie
-- que ce contrôle est bien arrivé ET que la surveillance des 15 minutes tourne ; sinon : alerte « 🩺 Circuit des
-- photos en panne » sur le téléphone de l'agence et ligne au journal des erreurs, avec l'étape qui a lâché.
-- Ce contrôle trouve ce qui casse CHEZ NOUS (clé, mot secret, programme Google modifié, tâche arrêtée) avant
-- qu'une vraie candidate ne soit touchée.
-- =====================================================================================================

create table if not exists medias_drive_controles (
  id bigserial primary key,
  le timestamptz not null default now(),
  ok boolean not null,
  details text
);
alter table medias_drive_controles enable row level security;
drop policy if exists "Les admins lisent les controles Drive" on medias_drive_controles;
create policy "Les admins lisent les controles Drive" on medias_drive_controles for select
  using (exists (select 1 from admins where user_id = auth.uid()));

-- appelée par le programme Google quand la photo d'essai a fait tout le trajet
create or replace function media_drive_controle_ok(p_secret text, p_details text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not medias_drive_secret_ok(p_secret) then raise exception 'non autorisé'; end if;
  insert into medias_drive_controles (ok, details) values (true, left(coalesce(p_details, ''), 300));
  delete from medias_drive_controles where le < now() - interval '60 days';
  return true;
end;
$$;
revoke all on function media_drive_controle_ok(text, text) from public;
grant execute on function media_drive_controle_ok(text, text) to anon, authenticated;

-- 7 h 13 : demander le contrôle au programme Google
create or replace function medias_drive_controler()
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://script.google.com/macros/s/AKfycbxzPeaTLvMqZKtBvJJabLeZBh6JJ9ZaggPYUY8XAoh1-tyBq1Byi3lBm3SkhkH8rqNxxg/exec',
    body := jsonb_build_object('cle', 'b56772fb9c5075517dc36a6b20db10734701e262274f3beb', 'action', 'controle'),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 60000);
end;
$$;
revoke all on function medias_drive_controler() from public, anon, authenticated;

-- 7 h 43 : le contrôle est-il arrivé ? la surveillance des 15 minutes tourne-t-elle ? Renvoie le problème, ou null.
create or replace function medias_drive_controle_verifier()
returns text language plpgsql security definer set search_path = public as $$
declare
  probleme text;
  derniere_surveillance timestamptz;
begin
  select max(d.end_time) into derniere_surveillance
    from cron.job_run_details d join cron.job j on j.jobid = d.jobid
   where j.jobname = 'medias-drive-surveillance' and d.status = 'succeeded';
  if not exists (select 1 from medias_drive_controles where ok and le > now() - interval '1 hour') then
    probleme := 'la photo d''essai n''a pas fait le trajet complet (programme Google injoignable, modifié, clé ou mot secret refusés, ou Drive en panne)';
  elsif derniere_surveillance is null or derniere_surveillance < now() - interval '1 hour' then
    probleme := 'la vérification automatique des 15 minutes ne tourne plus';
  end if;
  if probleme is null then return null; end if;
  insert into medias_drive_controles (ok, details) values (false, probleme);
  insert into medias_drive_alertes (source, ref, nom) values ('controle', gen_random_uuid(), probleme);
  insert into journal_erreurs (message, page, pile) values ('[Photos Drive] contrôle du matin : ' || probleme, 'surveillance', null);
  return probleme;
end;
$$;
revoke all on function medias_drive_controle_verifier() from public, anon, authenticated;

select cron.unschedule('medias-drive-controle') where exists (select 1 from cron.job where jobname = 'medias-drive-controle');
select cron.schedule('medias-drive-controle', '13 7 * * *', 'select medias_drive_controler();');
select cron.unschedule('medias-drive-controle-verifier') where exists (select 1 from cron.job where jobname = 'medias-drive-controle-verifier');
select cron.schedule('medias-drive-controle-verifier', '43 7 * * *', 'select medias_drive_controle_verifier();');

NOTIFY pgrst, 'reload schema';
select 'Contrôle de santé des photos Drive : en place (chaque matin à 7 h 13)' as resultat;
