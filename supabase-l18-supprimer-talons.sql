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
create table if not exists medias_drive_corbeille (
  ref uuid primary key,
  source text not null check (source in ('candidature', 'cours_talons')),
  demande_le timestamptz not null default now(),
  faite_le timestamptz,
  nb int
);
alter table medias_drive_corbeille enable row level security;
drop policy if exists "Les admins lisent la corbeille Drive" on medias_drive_corbeille;
create policy "Les admins lisent la corbeille Drive" on medias_drive_corbeille for select
  using (exists (select 1 from admins where user_id = auth.uid()));

-- après la suppression d une candidature ou d une inscription : seulement si une personne connectée l a faite
create or replace function medias_drive_vers_corbeille()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_source text := case when tg_table_name = 'cours_talons' then 'cours_talons' else 'candidature' end;
begin
  if auth.uid() is null then return old; end if;
  if not exists (select 1 from medias_drive where ref = old.id and genre = 'dossier') then return old; end if;
  insert into medias_drive_corbeille (ref, source) values (old.id, v_source)
    on conflict (ref) do update set demande_le = now(), faite_le = null;
  if coalesce((select script_a_jour from medias_drive_reglage), false) then
    perform net.http_post(
      url := 'https://script.google.com/macros/s/AKfycbxzPeaTLvMqZKtBvJJabLeZBh6JJ9ZaggPYUY8XAoh1-tyBq1Byi3lBm3SkhkH8rqNxxg/exec',
      body := jsonb_build_object('cle', 'b56772fb9c5075517dc36a6b20db10734701e262274f3beb', 'action', 'corbeille', 'source', v_source, 'ref', old.id),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 60000);
  end if;
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

-- pour le programme Google : les dossiers à jeter (vide si la suppression n a pas été demandée par l agence,
-- si elle est déjà faite, ou si la ligne existe encore)
create or replace function media_drive_a_jeter(p_secret text, p_source text, p_ref uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not medias_drive_secret_ok(p_secret) then raise exception 'non autorisé'; end if;
  if not exists (select 1 from medias_drive_corbeille where ref = p_ref and source = p_source and faite_le is null)
     or exists (select 1 from casting_applications where id = p_ref)
     or exists (select 1 from cours_talons where id = p_ref) then
    return '[]'::jsonb;
  end if;
  return coalesce((select jsonb_agg(lien order by id) from medias_drive where ref = p_ref and genre = 'dossier'), '[]'::jsonb);
end;
$$;
revoke all on function media_drive_a_jeter(text, text, uuid) from public;
grant execute on function media_drive_a_jeter(text, text, uuid) to anon, authenticated;

-- le programme Google signale que c est fait (nb : dossiers mis à la corbeille)
create or replace function media_drive_jete(p_secret text, p_ref uuid, p_nb int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not medias_drive_secret_ok(p_secret) then raise exception 'non autorisé'; end if;
  update medias_drive_corbeille set faite_le = now(), nb = p_nb where ref = p_ref and faite_le is null;
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
  + (select count(*) from pg_proc where proname in ('media_drive_a_jeter', 'media_drive_jete'))) || ' éléments sur 4';
