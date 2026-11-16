-- =====================================================================================================
-- Audit L-1 (A-03 = D-01), partie 2 : contacts des parents et données de paiement cachés au rôle « site » (16/11/2026)
-- =====================================================================================================
-- Règle de la propriétaire : l'« Administrateur du site » ne voit ni les contacts privés des parents, ni les données
-- de paiement. Ordre du superviseur (16/11, 05 h 22) : « contacts des parents et données de paiement plus visibles du
-- rôle site ».
--
-- Colonnes privées (lues seulement par l'administrateur principal, les encaissements, ou une personne à qui le
-- principal a donné l'accès « contacts_prives ») :
--   casting_applications     : parent_telephone, parent_email
--   inscriptions_mannequins  : parent_telephone, parent_email, reference_paiement
--   cours_talons             : parent_telephone, reference_wave
--
-- Comment : un compte connecté (rôle Postgres « authenticated », le même pour toute l'équipe) ne peut plus lire ces
-- colonnes directement ; il lit toutes les AUTRES (droits par colonne, comme model_profiles). L'Administration demande
-- la liste des colonnes lisibles (colonnes_lisibles) et, pour les personnes autorisées, les colonnes privées par une
-- fonction contrôlée (dossiers_prives). Rien n'est déplacé ni effacé : les fonctions de la base (convocations, codes
-- individuels, anniversaires, messages aux parents…) lisent toujours tout, comme avant.
--
-- ⚠ Une colonne AJOUTÉE plus tard à une de ces 3 tables n'est pas lisible par l'équipe tant que ce fichier n'est pas
-- recollé (il redonne le droit à toutes les colonnes non privées). Ne jamais coller « grant select on <table> to
-- authenticated » : cela rouvrirait les colonnes privées.
--
-- À COLLER UNE FOIS dans Supabase (SQL Editor), APRÈS supabase-l1-role-site.sql, avec l'accord écrit de la
-- propriétaire, EN MÊME TEMPS que la mise en ligne du site (l'Administration d'avant lit « toutes les colonnes » et
-- afficherait une erreur sur ces 3 pages). Rien n'est effacé ; peut être recollé sans risque.

create or replace function l1_colonnes_privees(p_table text)
returns text[] language sql immutable as $$
  select case p_table
    when 'casting_applications' then array['parent_telephone', 'parent_email']
    when 'inscriptions_mannequins' then array['parent_telephone', 'parent_email', 'reference_paiement']
    when 'cours_talons' then array['parent_telephone', 'reference_wave']
  end;
$$;

do $$
declare
  t text;
  cols text;
begin
  foreach t in array array['casting_applications', 'inscriptions_mannequins', 'cours_talons'] loop
    if to_regclass('public.' || t) is null then raise notice 'L-1 : table % absente : rien à faire', t; continue; end if;
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
    where table_schema = 'public' and table_name = t and column_name <> all (l1_colonnes_privees(t));
    execute format('revoke select on table public.%I from authenticated', t);
    execute format('revoke select (%s) on table public.%I from authenticated',
      (select string_agg(quote_ident(c), ', ') from unnest(l1_colonnes_privees(t)) c
       where exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = c)), t);
    execute format('grant select (%s) on table public.%I to authenticated', cols, t);
    raise notice 'L-1 : % : colonnes privées fermées à l''équipe (%)', t, array_to_string(l1_colonnes_privees(t), ', ');
  end loop;
end;
$$;

-- Les colonnes qu'un compte connecté peut lire dans une de ces tables (l'Administration s'en sert au lieu de « * »)
create or replace function colonnes_lisibles(p_table text)
returns text[] language sql stable security definer set search_path = public as $$
  select array_agg(a.attname::text order by a.attnum)
  from pg_attribute a
  where p_table in ('casting_applications', 'inscriptions_mannequins', 'cours_talons')
    and a.attrelid = to_regclass('public.' || p_table) and a.attnum > 0 and not a.attisdropped
    and has_column_privilege('authenticated', a.attrelid, a.attnum, 'SELECT');
$$;
revoke all on function colonnes_lisibles(text) from public, anon;
grant execute on function colonnes_lisibles(text) to authenticated;

-- Les colonnes privées de quelques dossiers, pour l'administrateur principal, les encaissements, ou l'accès
-- « contacts_prives » donné par le principal ; {} pour les autres. Réponse : { "<id>": { colonne: valeur, … } }.
create or replace function dossiers_prives(p_table text, p_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb;
begin
  if l1_colonnes_privees(p_table) is null then raise exception 'Table non prévue.'; end if;
  if not (portail_est_principal() or portail_peut('paiements') or portail_peut('contacts_prives')) then return '{}'::jsonb; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 then return '{}'::jsonb; end if;
  if array_length(p_ids, 1) > 1000 then raise exception 'Trop de dossiers à la fois.'; end if;
  execute format('select coalesce(jsonb_object_agg(t.id::text, to_jsonb(t) - ''id''), ''{}''::jsonb) from (select id, %s from public.%I where id = any($1)) t',
    (select string_agg(quote_ident(c), ', ') from unnest(l1_colonnes_privees(p_table)) c
     where exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = c)), p_table)
    into r using p_ids;
  return r;
end;
$$;
revoke all on function dossiers_prives(text, uuid[]) from public, anon;
grant execute on function dossiers_prives(text, uuid[]) to authenticated;

NOTIFY pgrst, 'reload schema';

select 'L-1 (partie 2) : ' ||
  (select count(*) from unnest(array['casting_applications', 'inscriptions_mannequins', 'cours_talons']) t
   where to_regclass('public.' || t) is not null and not has_column_privilege('authenticated', 'public.' || t, 'parent_telephone', 'SELECT'))
  || ' tables sur 3 aux contacts des parents fermés à l''équipe' as controle;
