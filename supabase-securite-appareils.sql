-- =====================================================================================
-- Extension 158 — Verrous des téléphones partout dans l'Administration (08/11/2026 ; demande de la propriétaire :
-- « préparez la sécurité, c'est important »)
-- =====================================================================================
-- Avant : les espaces récents (Paiements, Compta, Équipe : portail_role / portail_peut) vérifiaient les deux facteurs
-- ET les verrous de l'appareil (révoqué, 8 heures / 30 jours, code à 4 chiffres après 15 minutes, mot de passe après
-- 24 heures). Les parties plus anciennes (candidatures, fiches et contacts des mannequins, défilés, cartes…, règles
-- fondées sur la table « admins ») ne vérifiaient QUE les deux facteurs : un téléphone volé déjà connecté et
-- verrouillé à l'écran gardait, pour une personne technique, l'accès à ces données jusqu'à sa révocation.
-- Après : partout la même règle, portail_admin_ok() = deux facteurs ET appareil en règle (portail_appareil_ok :
-- en-tête « x-appareil » envoyé par l'Administration).
--  1. la règle de lecture de la table « admins » (dont dépendent toutes les règles anciennes) ;
--  2. les règles qui appellent directement portail_mfa_ok() (cartes, défilés) ;
--  3. les fonctions de la base qui vérifient « admins » + portail_mfa_ok() (contacts, profils privés, codes…) ;
--  4. accord_parent_demander (site vivant, Extension 157).
-- Ne change PAS : l'écran de verrouillage (portail_code_appareil_*), portail_role, les fonctions des mannequins.
-- Ajout et réécriture seulement ; rien n'est effacé ; recollable. Contrôle final en bas.

-- deux facteurs ET appareil en règle
create or replace function portail_admin_ok()
returns boolean language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select portail_mfa_ok() and portail_appareil_ok();
$$;
-- (correction du 08/11/2026) les VISITEURS (anon) doivent pouvoir l'appeler : la règle de lecture de « admins » l'appelle,
-- et les règles publiques (fiches, photos publiées) lisent « admins ». Sans ce droit, le site n'affichait plus aucune
-- mannequin ni photo. Pour un visiteur, elle répond toujours « non ».
revoke execute on function portail_admin_ok() from public;
grant execute on function portail_admin_ok() to anon, authenticated;

-- 1 et 2. Règles (politiques) qui appellent portail_mfa_ok() : portail_admin_ok() à la place
do $$
declare r record; u text; c text;
begin
  for r in select schemaname, tablename, policyname, qual, with_check from pg_policies
           where schemaname = 'public' and (qual ~ 'portail_mfa_ok\(\)' or with_check ~ 'portail_mfa_ok\(\)') loop
    u := case when r.qual is not null then ' using (' || replace(r.qual, 'portail_mfa_ok()', 'portail_admin_ok()') || ')' else '' end;
    c := case when r.with_check is not null then ' with check (' || replace(r.with_check, 'portail_mfa_ok()', 'portail_admin_ok()') || ')' else '' end;
    execute format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename) || u || c;
  end loop;
end $$;

-- 3. Fonctions de la base qui vérifient « admins » + portail_mfa_ok() : portail_admin_ok() à la place
-- (l'écran de verrouillage et portail_role ne lisent pas « admins » : jamais touchés)
do $$
declare r record; d text;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef and p.proname not like 'portail\_%' and p.proname not like 'staff\_%'
             -- (ancien code de validation de l'Administration : appelé par le serveur — api/acces-tableau.js,
             -- api/code-validation-protege.js — avec le jeton de la personne mais SANS l'en-tête de l'appareil ; il garde
             -- sa règle d'avant, sinon chaque code juste compterait comme faux — relecture du 08/11/2026)
             and p.proname not like '%code\_validation%' and p.proname <> 'definir_code_portail'
             and pg_get_functiondef(p.oid) ~* 'from\s+(public\.)?admins' and pg_get_functiondef(p.oid) ~ 'portail_mfa_ok\(\)' loop
    d := replace(pg_get_functiondef(r.oid), 'portail_mfa_ok()', 'portail_admin_ok()');
    execute d;
  end loop;
end $$;

-- 4. Site vivant : préparer le lien d'accord d'un parent (Extension 157) — même règle
do $$
begin
  if to_regprocedure('accord_parent_demander(uuid)') is not null
     and pg_get_functiondef('accord_parent_demander(uuid)'::regprocedure) !~ 'portail_admin_ok' then
    execute replace(pg_get_functiondef('accord_parent_demander(uuid)'::regprocedure),
      'where admins.user_id = auth.uid()) then', 'where admins.user_id = auth.uid()) or not portail_admin_ok() then');
  end if;
end $$;

NOTIFY pgrst, 'reload schema';

select case when to_regprocedure('portail_admin_ok()') is not null
             and has_function_privilege('anon', 'portail_admin_ok()', 'EXECUTE')  -- (sinon le site public n'affiche plus rien)
             and not exists (select 1 from pg_policies where schemaname = 'public' and (qual ~ 'portail_mfa_ok\(\)' or with_check ~ 'portail_mfa_ok\(\)'))
             and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                             where n.nspname = 'public' and p.prosecdef and p.proname not like 'portail\_%' and p.proname not like 'staff\_%'
                               and p.proname not like '%code\_validation%' and p.proname <> 'definir_code_portail'
                               and pg_get_functiondef(p.oid) ~* 'from\s+(public\.)?admins' and pg_get_functiondef(p.oid) ~ 'portail_mfa_ok\(\)')
             and (to_regprocedure('accord_parent_demander(uuid)') is null
                  or pg_get_functiondef('accord_parent_demander(uuid)'::regprocedure) ~ 'portail_admin_ok')
            then '✅ Verrous des téléphones partout (Extension 158)' else '❌ Extension 158 incomplète : recollez tout le fichier' end as controle;
