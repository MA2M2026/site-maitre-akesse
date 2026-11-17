-- =====================================================================================================
-- L-18 (c) : bouton Supprimer pour les cours de talons (17/11/2026, demande de la propriétaire)
-- =====================================================================================================
-- Seul l administrateur principal peut supprimer une inscription au cours de talons (même règle que les
-- candidatures et les demandes recruteurs : portail_est_principal).
-- Ses séances partent avec elle (clé étrangère ON DELETE CASCADE) : les créneaux sont libérés.
-- Ses photos chez Cloudflare sont effacées ensuite par le site (base d abord, fichiers ensuite).
-- L-18 (d) : quand l agence supprime une candidature ou une inscription au cours de talons (son clic, connectée),
-- la base demande au programme Google de mettre son dossier Drive à la CORBEILLE (jamais d effacement définitif,
-- récupérable 30 jours dans la corbeille de Google Drive). Le nettoyage automatique de la nuit (sans personne
-- connectée) ne touche jamais au Drive. Le programme Google redemande à la base quels dossiers jeter : seulement
-- ceux d une suppression demandée par l agence, et seulement si la ligne n existe plus.
-- A COLLER UNE FOIS dans Supabase (SQL Editor, bouton orange Run without RLS), avec l accord écrit de la
-- propriétaire. Rien n est effacé par ce fichier. Peut être recollé sans risque.

drop policy if exists "Cours de talons : le principal supprime" on public.cours_talons;
create policy "Cours de talons : le principal supprime" on public.cours_talons
  for delete using (portail_est_principal());
-- (relecture de C, 17/11) la table ne donnait pas le droit de supprimer aux personnes connectées
-- (supabase-cours-talons.sql le retire) : sans cette ligne la règle ci-dessus ne servait à rien. La règle limite
-- toujours la suppression au seul principal.
grant delete on public.cours_talons to authenticated;

-- ---------- L-18 (d) : dossiers Drive à mettre à la corbeille (une ligne par suppression faite par l agence)
-- (les numéros des dossiers sont gardés ici : la surveillance efface ensuite le journal medias_drive des lignes disparues)
create table if not exists medias_drive_corbeille (
  ref uuid primary key,
  source text not null check (source in ('candidature', 'cours_talons')),
  dossiers jsonb not null default '[]'::jsonb,
  demande_le timestamptz not null default now(),
  essais int not null default 0,
  dernier timestamptz,
  faite_le timestamptz,
  nb int
);
alter table medias_drive_corbeille enable row level security;
drop policy if exists "Les admins lisent la corbeille Drive" on medias_drive_corbeille;
create policy "Les admins lisent la corbeille Drive" on medias_drive_corbeille for select
  using (exists (select 1 from admins where user_id = auth.uid()));

-- un seul endroit pour l adresse et la clé du programme Google (relecture de C : plus de copie)
create or replace function medias_drive_appel_google(p_corps jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://script.google.com/macros/s/AKfycbxzPeaTLvMqZKtBvJJabLeZBh6JJ9ZaggPYUY8XAoh1-tyBq1Byi3lBm3SkhkH8rqNxxg/exec',
    body := jsonb_build_object('cle', 'b56772fb9c5075517dc36a6b20db10734701e262274f3beb') || p_corps,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 60000);
end;
$$;
revoke all on function medias_drive_appel_google(jsonb) from public, anon, authenticated;

-- même travail qu avant (supabase-medias-drive.sql), par l appel commun
create or replace function medias_drive_demander(p_source text, p_ref uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform medias_drive_appel_google(jsonb_build_object('action', 'retrouver', 'source', p_source, 'ref', p_ref));
end;
$$;
revoke all on function medias_drive_demander(text, uuid) from public, anon, authenticated;

-- envoie (ou renvoie) une demande de corbeille au programme Google, s il est à jour
create or replace function medias_drive_corbeille_envoyer(p_ref uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  c medias_drive_corbeille;
begin
  select * into c from medias_drive_corbeille where ref = p_ref and faite_le is null;
  if c.ref is null or not coalesce((select script_a_jour from medias_drive_reglage), false) then return false; end if;
  perform medias_drive_appel_google(jsonb_build_object('action', 'corbeille', 'source', c.source, 'ref', c.ref));
  update medias_drive_corbeille set essais = essais + 1, dernier = now() where ref = p_ref;
  return true;
end;
$$;
revoke all on function medias_drive_corbeille_envoyer(uuid) from public, anon, authenticated;

-- après la suppression d une candidature ou d une inscription : seulement si une personne connectée l a faite
create or replace function medias_drive_vers_corbeille()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_source text := case when tg_table_name = 'cours_talons' then 'cours_talons' else 'candidature' end;
  v_dossiers jsonb;
begin
  if auth.uid() is null then return old; end if;
  select jsonb_agg(lien order by id) into v_dossiers from medias_drive where ref = old.id and genre = 'dossier';
  if v_dossiers is null then return old; end if;
  insert into medias_drive_corbeille (ref, source, dossiers) values (old.id, v_source, v_dossiers)
    on conflict (ref) do update set dossiers = excluded.dossiers, demande_le = now(), essais = 0, dernier = null, faite_le = null, nb = null;
  perform medias_drive_corbeille_envoyer(old.id);
  return old;
end;
$$;
revoke all on function medias_drive_vers_corbeille() from public, anon, authenticated;
drop trigger if exists casting_applications_corbeille_drive on casting_applications;
create trigger casting_applications_corbeille_drive after delete on casting_applications
  for each row execute function medias_drive_vers_corbeille();
drop trigger if exists cours_talons_corbeille_drive on cours_talons;
create trigger cours_talons_corbeille_drive after delete on cours_talons
  for each row execute function medias_drive_vers_corbeille();

-- relance chaque heure : Google injoignable, occupé, ou programme pas encore à jour (5 essais sur 7 jours au plus)
create or replace function medias_drive_corbeille_relancer()
returns int language plpgsql security definer set search_path = public as $$
declare
  c record;
  n int := 0;
begin
  for c in select ref from medias_drive_corbeille
            where faite_le is null and essais < 5 and demande_le > now() - interval '7 days'
              and (dernier is null or dernier < now() - interval '50 minutes')
            order by demande_le limit 8 loop
    if medias_drive_corbeille_envoyer(c.ref) then n := n + 1; end if;
  end loop;
  return n;
end;
$$;
revoke all on function medias_drive_corbeille_relancer() from public, anon, authenticated;
select cron.unschedule('medias-drive-corbeille') where exists (select 1 from cron.job where jobname = 'medias-drive-corbeille');
select cron.schedule('medias-drive-corbeille', '17 * * * *', 'select medias_drive_corbeille_relancer();');

-- pour le programme Google : les dossiers à jeter (vide si la suppression n a pas été demandée par l agence,
-- si elle est déjà faite, ou si la ligne existe encore)
create or replace function media_drive_a_jeter(p_secret text, p_source text, p_ref uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not medias_drive_secret_ok(p_secret) then raise exception 'non autorisé'; end if;
  if exists (select 1 from casting_applications where id = p_ref) or exists (select 1 from cours_talons where id = p_ref) then
    return '[]'::jsonb;
  end if;
  return coalesce((select dossiers from medias_drive_corbeille where ref = p_ref and source = p_source and faite_le is null), '[]'::jsonb);
end;
$$;
revoke all on function media_drive_a_jeter(text, text, uuid) from public;
grant execute on function media_drive_a_jeter(text, text, uuid) to anon, authenticated;

-- le programme Google signale que c est fait (nb : dossiers mis à la corbeille). Renvoie vrai (une fonction sans
-- réponse ferait répondre 204 au lieu de 200, que le programme Google prendrait pour une erreur)
create or replace function media_drive_jete(p_secret text, p_ref uuid, p_nb int)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not medias_drive_secret_ok(p_secret) then raise exception 'non autorisé'; end if;
  update medias_drive_corbeille set faite_le = now(), nb = p_nb where ref = p_ref and faite_le is null;
  return true;
end;
$$;
revoke all on function media_drive_jete(text, uuid, int) from public;
grant execute on function media_drive_jete(text, uuid, int) to anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Contrôle
select case when exists (select 1 from pg_policies where tablename = 'cours_talons' and cmd = 'DELETE'
                           and policyname = 'Cours de talons : le principal supprime')
                 and has_table_privilege('authenticated', 'public.cours_talons', 'DELETE')
  then '✅ L-18 : le principal peut supprimer une inscription au cours de talons'
  else '❌ L-18 : règle absente' end as controle
union all
select 'L-18 corbeille Drive : ' || ((select count(*) from pg_trigger where tgname in ('casting_applications_corbeille_drive', 'cours_talons_corbeille_drive'))
  + (select count(*) from pg_proc where proname in ('media_drive_a_jeter', 'media_drive_jete', 'medias_drive_corbeille_relancer'))
  + (select count(*) from cron.job where jobname = 'medias-drive-corbeille')) || ' éléments sur 6';
