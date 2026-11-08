-- =====================================================================================
-- Extension 157 — « Site vivant » (08/11/2026, phase 3 V4 ; décisions de la propriétaire, DECISIONS.md)
-- =====================================================================================
-- L'accueil change à chaque visite (couverture, « À la une » épinglée, ordre des visages). Qui peut y paraître :
--  - une mannequin publiée, pas en sourdine, pas exclue par l'agence (exclue_vitrine) ;
--  - MAJEURE, ou MINEURE dont un parent a donné LUI-MÊME son accord (lien personnel « J'accepte », retirable).
-- Le Book et les fiches ne changent pas (déjà publics). Ajout seulement ; recollable. Contrôle final en bas.

-- 1. Exclusion par l'agence
alter table model_profiles add column if not exists exclue_vitrine boolean not null default false;

-- 2. Accord des parents (une ligne par mannequin mineure ; le lien personnel porte le jeton)
create table if not exists accords_parents (
  model_id uuid primary key references model_profiles(id) on delete cascade,
  jeton uuid not null unique default gen_random_uuid(),
  demande_le timestamptz not null default now(),
  demande_par uuid references auth.users(id),
  parent_nom text,
  accepte_le timestamptz,
  retire_le timestamptz
);
alter table accords_parents enable row level security;
revoke all on accords_parents from anon, authenticated;
drop policy if exists accords_parents_lecture on accords_parents;
create policy accords_parents_lecture on accords_parents for select
  using (exists (select 1 from admins where admins.user_id = auth.uid()));
grant select on accords_parents to authenticated;

-- accord en cours de validité ?
create or replace function accord_parent_valide(p_model uuid)
returns boolean language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select exists (select 1 from accords_parents where model_id = p_model and accepte_le is not null and retire_le is null);
$$;

-- 3. Qui peut paraître dans la vitrine de l'accueil (lu par le serveur et par la page, clé publique)
create or replace function vitrine_eligibles()
returns table (model_id uuid) language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select p.id from model_profiles p
  where p.published and not coalesce(p.desactive, false) and not p.exclue_vitrine
    and (p.date_naissance is not null and age(current_date, p.date_naissance) >= interval '18 years' or accord_parent_valide(p.id));
$$;

-- 4. Agence : préparer le lien d'accord d'une mannequin mineure (renvoie le jeton ; le même tant qu'il n'est pas répondu)
create or replace function accord_parent_demander(p_model uuid)
returns uuid language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare j uuid;
begin
  if not exists (select 1 from admins where admins.user_id = auth.uid()) then raise exception 'Accès refusé'; end if;
  if not exists (select 1 from model_profiles where id = p_model) then raise exception 'Mannequin introuvable.'; end if;
  insert into accords_parents (model_id, demande_par) values (p_model, auth.uid())
  on conflict (model_id) do update set demande_le = now(), demande_par = auth.uid(),
    -- (accord retiré : un nouveau lien, l'ancien ne marche plus)
    jeton = case when accords_parents.retire_le is not null then gen_random_uuid() else accords_parents.jeton end,
    retire_le = null, accepte_le = case when accords_parents.retire_le is not null then null else accords_parents.accepte_le end
  returning jeton into j;
  perform journaliser('Accord des parents demandé', 'accords_parents', p_model::text, null, null);
  return j;
end;
$$;

-- 5. Le parent, avec son lien : lire (prénom de la mannequin seulement), accepter, ou retirer
create or replace function accord_parent_lire(p_jeton uuid)
returns json language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select json_build_object('prenom', split_part(trim(p.full_name), ' ', 1), 'parent_nom', a.parent_nom,
    'etat', case when a.retire_le is not null then 'retire' when a.accepte_le is not null then 'accepte' else 'en_attente' end)
  from accords_parents a join model_profiles p on p.id = a.model_id where a.jeton = p_jeton;
$$;
create or replace function accord_parent_repondre(p_jeton uuid, p_accepte boolean, p_parent_nom text)
returns text language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare a accords_parents;
begin
  select * into a from accords_parents where jeton = p_jeton for update;
  if not found then raise exception 'Lien inconnu ou expiré.'; end if;
  if p_accepte then
    if length(trim(coalesce(p_parent_nom, ''))) < 3 then raise exception 'Écrivez votre nom complet.'; end if;
    update accords_parents set accepte_le = now(), retire_le = null, parent_nom = left(trim(p_parent_nom), 120) where jeton = p_jeton;
    perform journaliser('Accord des parents donné', 'accords_parents', a.model_id::text, null, json_build_object('parent', left(trim(p_parent_nom), 120))::jsonb);
    return 'accepte';
  end if;
  update accords_parents set retire_le = now() where jeton = p_jeton;
  perform journaliser('Accord des parents retiré', 'accords_parents', a.model_id::text, null, null);
  return 'retire';
end;
$$;

-- 6. Droits (Supabase donne d'office l'appel à anon et authenticated : on nomme les deux)
revoke execute on function accord_parent_valide(uuid), accord_parent_demander(uuid) from public, anon;
revoke execute on function vitrine_eligibles(), accord_parent_lire(uuid), accord_parent_repondre(uuid, boolean, text) from public;
grant execute on function vitrine_eligibles(), accord_parent_lire(uuid), accord_parent_repondre(uuid, boolean, text) to anon, authenticated;
grant execute on function accord_parent_demander(uuid) to authenticated;
revoke execute on function accord_parent_valide(uuid) from authenticated;

NOTIFY pgrst, 'reload schema';

select case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
                  and p.proname in ('accord_parent_valide', 'vitrine_eligibles', 'accord_parent_demander', 'accord_parent_lire', 'accord_parent_repondre')) = 5
              and exists (select 1 from information_schema.columns where table_name = 'model_profiles' and column_name = 'exclue_vitrine')
            then '✅ Site vivant installé (Extension 157)' else '❌ Site vivant incomplet : recollez tout le fichier' end as controle;
