-- ===================================================================================
-- Administration MA2M — étape 1 : comptes de l'équipe, connexion, sécurité
-- (cahier des charges v2.3 + mise à jour v2.4 validée le 19/10/2026)
-- ===================================================================================
-- À coller dans Supabase › SQL Editor, en entier. Rejouable sans danger. N'efface et ne
-- modifie AUCUNE donnée existante du site : on AJOUTE seulement des tables et des fonctions.
--
-- Contenu de cette étape :
--   1. Comptes du personnel, rôles, délégations, appareils
--   2. Connexion : double authentification obligatoire, appareils, code à 4 chiffres par
--      appareil (verrouillage après 15 minutes, 8 heures au plus), codes de secours
--   3. Journal d'audit en écriture seule
--   4. Règles d'accès (RLS) et garde-fous des comptes
--   5. Espace 1 : code individuel d'inscription (personne retenue, casting direct)
--   6. Espace 2 : registre des mannequins et paiements (inscription, mensualités)
-- L'espace 3 viendra dans une étape suivante.
--
-- Rôles : principal (Maître Akesse, tout) · site (espace 1) · caisse (espace 2) · compta (espace 3)
-- ===================================================================================

create extension if not exists pgcrypto with schema extensions;
-- -----------------------------------------------------------------------------------
-- 1. Comptes du personnel
-- -----------------------------------------------------------------------------------
create table if not exists staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nom text not null,
  email text not null,
  role text not null check (role in ('principal', 'site', 'caisse', 'compta')),
  actif boolean not null default true,
  cree_par uuid references auth.users(id),
  cree_le timestamptz not null default now(),
  desactive_le timestamptz
);
-- un seul administrateur principal
create unique index if not exists staff_un_seul_principal on staff_profiles ((role)) where role = 'principal';

create table if not exists staff_module_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references staff_profiles(user_id) on delete cascade,
  module text not null check (module in ('site', 'paiements', 'compta', 'noms_payeurs', 'contacts_prives')),
  debut timestamptz not null default now(),
  fin timestamptz,
  accorde_par uuid not null references auth.users(id),
  revoque_le timestamptz,
  cree_le timestamptz not null default now()
);

create table if not exists staff_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references staff_profiles(user_id) on delete cascade,
  appareil text not null,             -- identifiant tiré au hasard par l'application
  libelle text,                       -- « iPhone, Safari » (navigateur déclaré)
  installe_le timestamptz not null default now(),
  derniere_activite timestamptz not null default now(),
  revoque boolean not null default false,
  unique (user_id, appareil)
);

-- -----------------------------------------------------------------------------------
-- 2. Qui est connecté, avec quels droits
-- -----------------------------------------------------------------------------------
-- Double authentification : le jeton de connexion doit être de niveau « aal2 » (code de
-- l'application d'authentification validé). Sans cela, aucun rôle n'est reconnu.
create or replace function portail_mfa_ok()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- Heure (en secondes) du dernier code de l'application d'authentification saisi pour cette session
create or replace function portail_dernier_code()
returns bigint language sql stable as $$
  select max((m ->> 'timestamp')::bigint)
  from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) m
  where m ->> 'method' in ('totp', 'mfa/totp');
$$;

-- Appareil révoqué (téléphone perdu ou volé) : toutes les sessions ouvertes AVANT la révocation
-- cessent de servir, sur tous les appareils de la personne ; elle se reconnecte avec mot de
-- passe et code (relecture du 19/10/2026 : vider le stockage du navigateur suffisait à
-- reprendre la main avec une session déjà ouverte).
alter table staff_profiles add column if not exists sessions_valides_apres timestamptz;

-- Verrouillage après 15 minutes d'inactivité (cahier v2.3, « Appareils et sessions ») : code à
-- 4 chiffres propre à l'appareil, choisi après une connexion complète (19/10/2026). Le code est
-- haché ; la table n'est lisible par personne (seulement par les fonctions ci-dessous).
create table if not exists staff_codes_appareil (
  user_id uuid not null references staff_profiles(user_id) on delete cascade,
  appareil text not null,
  code_hash text,                       -- null : code bloqué après 5 erreurs (connexion complète)
  essais int not null default 0,
  verrouille boolean not null default false,
  verrouille_le timestamptz,
  derniere_activite timestamptz not null default now(),
  primary key (user_id, appareil)
);
alter table staff_codes_appareil enable row level security;
revoke all on staff_codes_appareil from anon, authenticated;

-- Heure (en secondes) à partir de laquelle l'appareil est verrouillé (null : pas de code sur cet
-- appareil, donc pas de verrouillage par code ; l'application déconnecte alors complètement)
create or replace function portail_verrou_depuis(p_user uuid, p_appareil text)
returns bigint language sql stable security definer set search_path = public as $$
  select floor(extract(epoch from case when c.verrouille then c.verrouille_le else c.derniere_activite + interval '16 minutes' end))::bigint
  from staff_codes_appareil c where c.user_id = p_user and c.appareil = p_appareil;
$$;
revoke execute on function portail_verrou_depuis(uuid, text) from public, anon, authenticated;

-- Appareil révoqué : l'application envoie son identifiant dans l'en-tête « x-appareil »
create or replace function portail_appareil_ok()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  entetes json;
  app text;
  verrou bigint;
begin
  begin
    entetes := current_setting('request.headers', true)::json;
  exception when others then
    entetes := null;
  end;
  app := coalesce(entetes ->> 'x-appareil', '');
  -- sans identifiant d'appareil, pas d'accès (ne pas l'envoyer contournait une révocation) ;
  -- le portail et son serveur l'envoient toujours
  if app = '' then
    return false;
  end if;
  if exists (select 1 from staff_profiles where user_id = auth.uid() and sessions_valides_apres is not null
             and coalesce(portail_dernier_code(), 0) < extract(epoch from sessions_valides_apres)) then
    return false;
  end if;
  -- session de 8 heures au plus après le dernier code de l'application d'authentification
  if coalesce(portail_dernier_code(), 0) < extract(epoch from now()) - 8 * 3600 then
    return false;
  end if;
  -- appareil verrouillé (15 minutes sans activité) : il faut le code à 4 chiffres, ou une
  -- connexion complète faite APRÈS le verrouillage
  verrou := portail_verrou_depuis(auth.uid(), app);
  if verrou is not null and verrou <= floor(extract(epoch from now())) and coalesce(portail_dernier_code(), 0) < verrou then
    return false;
  end if;
  return not exists (select 1 from staff_devices where user_id = auth.uid() and appareil = app and revoque);
end;
$$;

create or replace function portail_role()
returns text language sql stable security definer set search_path = public as $$
  select s.role from staff_profiles s
  where s.user_id = auth.uid() and s.actif and portail_mfa_ok() and portail_appareil_ok();
$$;

-- Accès à un espace : rôle, ou délégation en cours accordée par l'administrateur principal
create or replace function portail_peut(p_module text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when portail_role() is null then false
    when portail_role() = 'principal' then true
    when p_module = 'site' and portail_role() = 'site' then true
    when p_module = 'paiements' and portail_role() = 'caisse' then true
    when p_module = 'compta' and portail_role() = 'compta' then true
    else exists (
      select 1 from staff_module_grants g
      where g.user_id = auth.uid() and g.module = p_module and g.revoque_le is null
        and g.debut <= now() and (g.fin is null or g.fin > now()))
  end;
$$;

create or replace function portail_est_principal()
returns boolean language sql stable as $$
  select portail_role() = 'principal';
$$;

-- Action sensible : le code MFA doit avoir été saisi il y a moins de 10 minutes
-- (export, suppression, changement de rôle, sortie d'un mannequin, avoir, montants, liens).
create or replace function portail_exiger_auth_recente()
returns void language plpgsql stable as $$
declare
  dernier bigint;
begin
  dernier := portail_dernier_code();
  if dernier is null or dernier < extract(epoch from now()) - 600 then
    raise exception 'AUTH_RECENTE: confirmez votre code de l''application d''authentification pour cette action.';
  end if;
end;
$$;

-- L'application déclare l'appareil où elle est installée (liste visible par l'administrateur
-- principal). Nouvel appareil : l'application prévient la personne et l'administrateur principal.
create or replace function portail_enregistrer_appareil(p_appareil text, p_libelle text)
returns json language plpgsql security definer set search_path = public as $$
declare
  nouveau boolean;
begin
  if not exists (select 1 from staff_profiles where user_id = auth.uid() and actif) then
    return json_build_object('ok', false);
  end if;
  nouveau := not exists (select 1 from staff_devices where user_id = auth.uid() and appareil = left(p_appareil, 64));
  insert into staff_devices (user_id, appareil, libelle) values (auth.uid(), left(p_appareil, 64), left(p_libelle, 120))
  on conflict (user_id, appareil) do update set derniere_activite = now(), libelle = excluded.libelle;
  if nouveau then
    perform journaliser('Connexion depuis un nouvel appareil', 'staff_devices', left(p_appareil, 64), null, json_build_object('appareil', p_libelle)::jsonb);
  end if;
  -- connexion complète (code saisi après une éventuelle révocation) : droits de l'ancien tableau
  -- de bord rendus au principal et au rôle « site » (retirés par staff_appareil_revoque)
  if portail_role() in ('principal', 'site') then
    insert into admins (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  end if;
  return json_build_object(
    'ok', not exists (select 1 from staff_devices where user_id = auth.uid() and appareil = left(p_appareil, 64) and revoque),
    'nouveau', nouveau and exists (select 1 from staff_devices where user_id = auth.uid() and appareil <> left(p_appareil, 64)),
    'moi', (select json_build_object('nom', nom, 'email', email) from staff_profiles where user_id = auth.uid()),
    'principal', case when nouveau then (select email from staff_profiles where role = 'principal') end);
end;
$$;

-- Codes de secours (8 par personne, hachés) et outils du serveur du site
create table if not exists staff_backup_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references staff_profiles(user_id) on delete cascade,
  code_hache text not null,
  utilise_le timestamptz,
  cree_le timestamptz not null default now()
);
alter table staff_backup_codes enable row level security;
revoke all on staff_backup_codes from anon, authenticated;

create or replace function portail_codes_secours_creer(p_user uuid, p_haches text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not est_ecriture_serveur() then raise exception 'Accès refusé.'; end if;
  delete from staff_backup_codes where user_id = p_user;
  insert into staff_backup_codes (user_id, code_hache) select p_user, h from unnest(p_haches) h;
  perform journaliser('Codes de secours créés', 'staff_backup_codes', p_user::text, null, null);
end;
$$;
create or replace function portail_code_secours_utiliser(p_user uuid, p_hache text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
begin
  if not est_ecriture_serveur() then raise exception 'Accès refusé.'; end if;
  select id into cid from staff_backup_codes where user_id = p_user and code_hache = p_hache and utilise_le is null for update;
  if cid is null then return false; end if;
  update staff_backup_codes set utilise_le = now() where id = cid;
  perform journaliser('Code de secours utilisé', 'staff_backup_codes', p_user::text, null, null);
  return true;
end;
$$;
create or replace function portail_utilisateur_par_email(p_email text)
returns uuid language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) and est_ecriture_serveur() limit 1;
$$;
revoke all on function portail_codes_secours_creer(uuid, text[]), portail_code_secours_utiliser(uuid, text), portail_utilisateur_par_email(text) from public, anon, authenticated;
grant execute on function portail_enregistrer_appareil(text, text) to authenticated;

-- Code à 4 chiffres de l'appareil : état (et remise à zéro après une connexion complète)
create or replace function portail_code_appareil_etat(p_appareil text)
returns json language plpgsql security definer set search_path = public as $$
declare
  c staff_codes_appareil;
  verrou bigint;
begin
  if auth.uid() is null or not portail_mfa_ok() then
    raise exception 'Accès refusé';
  end if;
  select * into c from staff_codes_appareil where user_id = auth.uid() and appareil = p_appareil;
  if not found then
    return json_build_object('defini', false, 'verrouille', false);
  end if;
  verrou := portail_verrou_depuis(auth.uid(), p_appareil);
  -- un code de l'application d'authentification saisi après le verrouillage déverrouille
  if coalesce(portail_dernier_code(), 0) >= verrou or verrou > floor(extract(epoch from now())) then
    update staff_codes_appareil set verrouille = false, verrouille_le = null, essais = 0, derniere_activite = now()
    where user_id = auth.uid() and appareil = p_appareil;
    return json_build_object('defini', c.code_hash is not null, 'verrouille', false);
  end if;
  return json_build_object('defini', c.code_hash is not null, 'verrouille', true, 'bloque', c.code_hash is null);
end;
$$;

-- Choisir le code (juste après une connexion complète : code saisi il y a moins de 10 minutes)
create or replace function portail_code_appareil_definir(p_appareil text, p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if portail_role() is null then
    raise exception 'Accès refusé';
  end if;
  perform portail_exiger_auth_recente();
  if coalesce(p_code, '') !~ '^[0-9]{4}$' or p_code in ('0000', '1111', '1234', '4321', '2222', '9999') then
    raise exception 'Choisissez 4 chiffres, pas trop simples (ni 0000, ni 1234).';
  end if;
  if coalesce(p_appareil, '') !~ '^[a-z0-9-]{16,64}$' then
    raise exception 'Appareil inconnu.';
  end if;
  insert into staff_codes_appareil (user_id, appareil, code_hash)
  values (auth.uid(), p_appareil, extensions.crypt(p_code, extensions.gen_salt('bf')))
  on conflict (user_id, appareil) do update set code_hash = excluded.code_hash, essais = 0,
    verrouille = false, verrouille_le = null, derniere_activite = now();
end;
$$;

-- Activité : repousse le verrouillage (appelée au plus une fois par minute pendant l'utilisation)
create or replace function portail_code_appareil_activite(p_appareil text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if portail_role() is null then
    return;  -- appareil déjà verrouillé ou session finie : rien à repousser
  end if;
  update staff_codes_appareil set derniere_activite = now() where user_id = auth.uid() and appareil = p_appareil;
end;
$$;

-- Verrouiller tout de suite (15 minutes sans geste sur l'écran)
create or replace function portail_code_appareil_verrouiller(p_appareil text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update staff_codes_appareil set verrouille = true, verrouille_le = least(now(), derniere_activite + interval '16 minutes')
  where user_id = auth.uid() and appareil = p_appareil and not verrouille;
end;
$$;

-- Déverrouiller avec le code : 5 erreurs → code bloqué, connexion complète obligatoire
create or replace function portail_code_appareil_verifier(p_appareil text, p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  c staff_codes_appareil;
begin
  if auth.uid() is null or not portail_mfa_ok()
     or not exists (select 1 from staff_profiles where user_id = auth.uid() and actif)
     or exists (select 1 from staff_devices where user_id = auth.uid() and appareil = p_appareil and revoque)
     or coalesce(portail_dernier_code(), 0) < extract(epoch from now()) - 8 * 3600 then
    return json_build_object('ok', false, 'bloque', true);
  end if;
  select * into c from staff_codes_appareil where user_id = auth.uid() and appareil = p_appareil for update;
  if not found or c.code_hash is null then
    return json_build_object('ok', false, 'bloque', true);
  end if;
  if extensions.crypt(coalesce(p_code, ''), c.code_hash) = c.code_hash then
    update staff_codes_appareil set verrouille = false, verrouille_le = null, essais = 0, derniere_activite = now()
    where user_id = auth.uid() and appareil = p_appareil;
    return json_build_object('ok', true);
  end if;
  if c.essais + 1 >= 5 then
    update staff_codes_appareil set code_hash = null, essais = c.essais + 1, verrouille = true,
      verrouille_le = coalesce(c.verrouille_le, least(now(), c.derniere_activite + interval '16 minutes')) where user_id = auth.uid() and appareil = p_appareil;
    perform journaliser('code_appareil_bloque', 'staff_codes_appareil', auth.uid()::text, null, json_build_object('appareil', p_appareil)::jsonb);
    return json_build_object('ok', false, 'bloque', true);
  end if;
  update staff_codes_appareil set essais = c.essais + 1, verrouille = true,
    verrouille_le = coalesce(c.verrouille_le, least(now(), c.derniere_activite + interval '16 minutes'))
  where user_id = auth.uid() and appareil = p_appareil;
  return json_build_object('ok', false, 'restants', 4 - c.essais);
end;
$$;
revoke execute on function portail_code_appareil_etat(text), portail_code_appareil_definir(text, text),
  portail_code_appareil_activite(text), portail_code_appareil_verrouiller(text), portail_code_appareil_verifier(text, text) from public, anon;
grant execute on function portail_code_appareil_etat(text), portail_code_appareil_definir(text, text),
  portail_code_appareil_activite(text), portail_code_appareil_verrouiller(text), portail_code_appareil_verifier(text, text) to authenticated;

-- Ce que l'application demande à l'ouverture : mon rôle, mes espaces, mon nom
create or replace function portail_moi()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'role', portail_role(),
    'mfa', portail_mfa_ok(),
    'nom', (select nom from staff_profiles where user_id = auth.uid()),
    'actif', coalesce((select actif from staff_profiles where user_id = auth.uid()), false),
    'membre', exists (select 1 from staff_profiles where user_id = auth.uid()),
    'espaces', json_build_object(
      'site', portail_peut('site'), 'paiements', portail_peut('paiements'), 'compta', portail_peut('compta')),
    'contacts_prives', portail_est_principal() or portail_peut('paiements') or portail_peut('contacts_prives'),
    'noms_payeurs', portail_peut('paiements') or portail_peut('noms_payeurs'));
$$;

-- L'administrateur actuel (table admins, compte partagé) devient administrateur principal.
-- À n'exécuter qu'une fois : il ne se passe rien s'il existe déjà un principal.
insert into staff_profiles (user_id, nom, email, role)
select a.user_id, 'Maître Akesse', coalesce(u.email, ''), 'principal'
from admins a join auth.users u on u.id = a.user_id
where not exists (select 1 from staff_profiles where role = 'principal')
order by u.created_at
limit 1
on conflict (user_id) do nothing;

-- -----------------------------------------------------------------------------------
-- 3. Journal d'audit : écriture seule
-- -----------------------------------------------------------------------------------
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  acteur uuid,
  acteur_nom text,
  acteur_role text,
  action text not null,
  objet text,
  objet_id text,
  avant jsonb,
  apres jsonb,
  ip text,
  cree_le timestamptz not null default now()
);

create or replace function portail_ip()
returns text language plpgsql stable as $$
declare
  entetes json;
begin
  entetes := current_setting('request.headers', true)::json;
  return split_part(coalesce(entetes ->> 'x-forwarded-for', entetes ->> 'x-real-ip', ''), ',', 1);
exception when others then
  return null;
end;
$$;

create or replace function journaliser(p_action text, p_objet text, p_objet_id text, p_avant jsonb, p_apres jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (acteur, acteur_nom, acteur_role, action, objet, objet_id, avant, apres, ip)
  values (auth.uid(),
          coalesce((select nom from staff_profiles where user_id = auth.uid()), case when est_ecriture_serveur() then 'Système' end),
          coalesce((select role from staff_profiles where user_id = auth.uid()), case when est_ecriture_serveur() then 'systeme' end),
          p_action, p_objet, p_objet_id, p_avant, p_apres, portail_ip());
end;
$$;
-- interne seulement (relecture du 19/10/2026 : un compte connecté pouvait remplir le journal de
-- fausses lignes) — les fonctions du portail l'appellent avec leurs propres droits
revoke all on function journaliser(text, text, text, jsonb, jsonb) from public, anon, authenticated;

-- Toute écriture dans une table du portail laisse une ligne d'audit (ancienne et nouvelle valeur)
create or replace function audit_ecriture()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform journaliser(
    lower(TG_OP) || ' ' || TG_TABLE_NAME, TG_TABLE_NAME,
    coalesce((case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end) ->> 'id',
             (case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end) ->> 'user_id'),
    case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end);
  return coalesce(NEW, OLD);
end;
$$;

-- Le journal ne se modifie ni ne s'efface, même par erreur
create or replace function audit_interdit()
returns trigger language plpgsql as $$
begin
  raise exception 'Le journal d''audit est en écriture seule.';
end;
$$;
drop trigger if exists audit_log_lecture_seule on audit_log;
create trigger audit_log_lecture_seule before update or delete on audit_log
  for each row execute function audit_interdit();

-- -----------------------------------------------------------------------------------
-- 4. Règles d'accès et garde-fous
-- -----------------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['staff_profiles', 'staff_module_grants', 'staff_devices', 'audit_log']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;
-- Sécurité du portail : administrateur principal seul (chacun lit sa propre fiche)
drop policy if exists staff_lecture on staff_profiles;
create policy staff_lecture on staff_profiles for select using (user_id = auth.uid() or portail_est_principal());
drop policy if exists staff_ecriture on staff_profiles;
create policy staff_ecriture on staff_profiles for all using (portail_est_principal()) with check (portail_est_principal());
drop policy if exists grants_lecture on staff_module_grants;
create policy grants_lecture on staff_module_grants for select using (user_id = auth.uid() or portail_est_principal());
drop policy if exists grants_ecriture on staff_module_grants;
create policy grants_ecriture on staff_module_grants for all using (portail_est_principal()) with check (portail_est_principal());
drop policy if exists appareils_lecture on staff_devices;
create policy appareils_lecture on staff_devices for select using (user_id = auth.uid() or portail_est_principal());
drop policy if exists appareils_ecriture on staff_devices;
create policy appareils_ecriture on staff_devices for update using (portail_est_principal()) with check (portail_est_principal());
drop policy if exists audit_lecture on audit_log;
create policy audit_lecture on audit_log for select using (portail_est_principal());

-- Rôles, accès, délégations, appareils : changement par l'administrateur principal avec un
-- code récent ; le compte principal ne se désactive pas et ne change pas de rôle.
create or replace function staff_garde_fous()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if est_ecriture_serveur() then return coalesce(NEW, OLD); end if;
  perform portail_exiger_auth_recente();
  if TG_TABLE_NAME = 'staff_profiles' then
    if TG_OP = 'DELETE' and OLD.role = 'principal' then raise exception 'Le compte principal n''est pas supprimable.'; end if;
    if TG_OP = 'UPDATE' and OLD.role = 'principal' and (NEW.role <> 'principal' or not NEW.actif) then
      raise exception 'Le compte principal ne se désactive pas et ne change pas de rôle.';
    end if;
    if TG_OP = 'UPDATE' and NEW.role = 'principal' and OLD.role <> 'principal' then raise exception 'Un seul administrateur principal.'; end if;
  end if;
  return coalesce(NEW, OLD);
end;
$$;
drop trigger if exists staff_garde_fous on staff_profiles;
create trigger staff_garde_fous before insert or update or delete on staff_profiles for each row execute function staff_garde_fous();
drop trigger if exists grants_garde_fous on staff_module_grants;
create trigger grants_garde_fous before insert or update or delete on staff_module_grants for each row execute function staff_garde_fous();
drop trigger if exists appareils_garde_fous on staff_devices;
create trigger appareils_garde_fous before update on staff_devices for each row
  when (OLD.revoque is distinct from NEW.revoque) execute function staff_garde_fous();

-- Appareil révoqué : les sessions déjà ouvertes de la personne cessent de servir (voir
-- portail_appareil_ok)
create or replace function staff_appareil_revoque()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update staff_profiles set sessions_valides_apres = now() where user_id = NEW.user_id;
  -- l'ancien tableau de bord (règles fondées sur la table admins) se ferme aussi ; les droits
  -- reviennent à la prochaine connexion complète au portail (portail_enregistrer_appareil)
  delete from admins where user_id = NEW.user_id;
  return NEW;
end;
$$;
revoke all on function staff_appareil_revoque() from public, anon, authenticated;
drop trigger if exists appareils_revoques on staff_devices;
create trigger appareils_revoques after update on staff_devices for each row
  when (NEW.revoque and not OLD.revoque) execute function staff_appareil_revoque();

-- Rôle « site » = droits de l'ancien tableau de bord (table admins). Changement de rôle ou accès
-- coupé : la ligne admins suit (relecture du 19/10/2026 : elle restait après une coupure).
-- Le compte principal n'est jamais touché.
create or replace function staff_suivre_admins()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.role = 'principal' then return NEW; end if;
  if NEW.role = 'site' and NEW.actif then
    insert into admins (user_id) values (NEW.user_id) on conflict (user_id) do nothing;
  else
    delete from admins where user_id = NEW.user_id;
  end if;
  return NEW;
end;
$$;
revoke all on function staff_suivre_admins() from public, anon, authenticated;
-- (19/10/2026, relecture : PAS de déclencheur pour l'instant. La table admins ouvre aussi les
-- inscriptions et les paiements dans la base ; un compte « Administrateur du site » ne doit pas
-- les voir (espace 1 sans argent). Il sera branché avec l'espace 2, quand l'argent aura ses
-- propres règles d'accès. D'ici là, seul l'administrateur principal ouvre l'espace 1.)
drop trigger if exists staff_suivre_admins on staff_profiles;

-- Journal : toute écriture sur les comptes, délégations et appareils est tracée
do $$
declare
  t text;
begin
  foreach t in array array['staff_profiles', 'staff_module_grants', 'staff_devices']
  loop
    execute format('drop trigger if exists audit_%s on %I', t, t);
    execute format('create trigger audit_%s after insert or update or delete on %I for each row execute function audit_ecriture()', t, t);
  end loop;
end $$;

grant execute on function portail_moi() to authenticated;

-- -----------------------------------------------------------------------------------
-- 5. Espace 1 — code individuel d'inscription (cahier v2.4, 3.3, validé le 19/10/2026)
-- -----------------------------------------------------------------------------------
-- Un code par personne RETENUE, créé seulement quand elle montre son intérêt, lié à sa
-- candidature (site) ou à une fiche minimale créée par l'agence (casting direct). Plus de code
-- « libre » sans nom de personne. Le code reste à usage unique (codes_inscription.utilise).
alter table codes_inscription add column if not exists candidature_id uuid references casting_applications(id) on delete set null;
create unique index if not exists codes_inscription_un_par_candidature on codes_inscription (candidature_id)
  where candidature_id is not null and not utilise;
alter table casting_applications drop constraint if exists casting_applications_type_check;
alter table casting_applications add constraint casting_applications_type_check
  check (type_candidature in ('agence', 'projet', 'direct'));

-- Créer (ou retrouver) le code d'une personne retenue
create or replace function code_individuel_creer(p_candidature uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  c casting_applications;
  existant text;
  nouveau text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if not exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()) then
    raise exception 'Accès refusé';
  end if;
  select * into c from casting_applications where id = p_candidature for update;
  if not found then
    raise exception 'Candidature introuvable.';
  end if;
  if c.status <> 'retenue' then
    raise exception 'Le code n''est créé que pour une personne retenue.';
  end if;
  -- la date de naissance protège le code et décide de l'accord du parent : sans elle, pas de code
  -- (relecture du 19/10/2026 : un mineur pouvait se déclarer majeur)
  if c.date_naissance is null then
    raise exception 'Date de naissance absente de cette candidature : enregistrez la personne avec « Casting direct ».';
  end if;
  select code into existant from codes_inscription where candidature_id = p_candidature and not utilise;
  if existant is not null then
    return existant;
  end if;
  if exists (select 1 from codes_inscription where candidature_id = p_candidature and utilise) then
    raise exception 'Cette personne a déjà utilisé son code : son inscription est faite.';
  end if;
  loop
    nouveau := 'MA2M-';
    for i in 1..6 loop
      nouveau := nouveau || substr(alphabet, 1 + get_byte(gen_random_bytes(1), 0) % 32, 1);
    end loop;
    exit when not exists (select 1 from codes_inscription where code = nouveau);
  end loop;
  insert into codes_inscription (code, candidature_id) values (nouveau, p_candidature);
  return nouveau;
end;
$$;

-- Casting direct à l'agence : fiche minimale, déjà retenue, et son code tout de suite
create or replace function casting_direct_creer(p_nom text, p_telephone text, p_genre text, p_naissance date)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()) then
    raise exception 'Accès refusé';
  end if;
  if coalesce(trim(p_nom), '') = '' or coalesce(trim(p_telephone), '') = '' or p_genre not in ('femme', 'homme') or p_naissance is null
     or p_naissance > current_date or p_naissance < current_date - interval '100 years' then
    raise exception 'Nom, téléphone, genre et date de naissance sont obligatoires.';
  end if;
  insert into casting_applications (full_name, email, phone, genre, date_naissance, type_candidature)
  values (upper(left(trim(p_nom), 120)), '', left(trim(p_telephone), 40), p_genre, p_naissance, 'direct')
  returning id into v_id;
  -- (toute candidature arrive « nouvelle » : trg_statut_candidature) → retenue
  update casting_applications set status = 'retenue' where id = v_id;
  return json_build_object('id', v_id, 'code', code_individuel_creer(v_id));
end;
$$;
revoke all on function code_individuel_creer(uuid), casting_direct_creer(text, text, text, date) from public, anon;
grant execute on function code_individuel_creer(uuid), casting_direct_creer(text, text, text, date) to authenticated;

-- -----------------------------------------------------------------------------------
-- 6. Espace 2 — registre des mannequins de l'agence (cahier v2.4, 5.1 et 5.5)
-- -----------------------------------------------------------------------------------
-- Tous les mannequins de l'agence : ceux qui ont un compte sur le site (repris automatiquement,
-- « Inscription déjà effectuée sur le site ») et ceux ajoutés à la main. Seul l'espace 2
-- (administrateur principal, encaissements, délégation) y a accès. Rien ne s'efface : un
-- mannequin qui quitte l'agence passe au statut « sorti ».
create table if not exists agence_mannequins (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  genre text check (genre in ('femme', 'homme')),
  date_naissance date,
  telephone text,
  email text,
  parent_nom text,
  parent_lien text,
  parent_telephone text,
  parent_email text,
  date_entree date not null default current_date,
  statut text not null default 'actif' check (statut in ('actif', 'suspendu', 'sorti')),
  mensualite int not null default 10000 check (mensualite in (10000, 20000)),
  notes text,
  user_id uuid unique references model_profiles(id) on delete set null,  -- compte sur le site
  candidature_id uuid references casting_applications(id) on delete set null,
  cree_le timestamptz not null default now(),
  cree_par uuid references auth.users(id)
);

-- Paiements des mannequins (inscription et mensualités) : orange = déclaré (« J'ai payé »,
-- en attente de validation), vert = validé par l'agence, refusé avec motif. Les paiements en
-- espèces et les inscriptions payées avant le nouveau système sont enregistrés et validés par
-- l'agence seule.
create table if not exists paiements_mannequins (
  id uuid primary key default gen_random_uuid(),
  mannequin_id uuid not null references agence_mannequins(id),
  objet text not null check (objet in ('inscription', 'mensualite')),
  mois date,                                   -- 1er jour du mois (mensualité)
  montant int check (montant is null or montant > 0),   -- inconnu pour « avant le nouveau système »
  mode text not null check (mode in ('wave', 'especes', 'avant_systeme')),
  statut text not null default 'declare' check (statut in ('declare', 'valide', 'refuse')),
  motif text,
  declare_le timestamptz not null default now(),
  valide_le timestamptz,
  valide_par uuid references auth.users(id),
  cree_par uuid references auth.users(id),
  check (objet <> 'mensualite' or mois is not null)
);
-- une seule inscription en cours ou validée par mannequin
create unique index if not exists paiements_une_inscription on paiements_mannequins (mannequin_id)
  where objet = 'inscription' and statut <> 'refuse';

-- Registre : comptes déjà créés sur le site → « Inscription déjà effectuée sur le site »
insert into agence_mannequins (full_name, date_naissance, telephone, email, user_id, date_entree)
select coalesce(nullif(trim(m.full_name), ''), 'Sans nom'), m.date_naissance, m.phone, m.contact_email, m.id, m.created_at::date
from model_profiles m
where not exists (select 1 from agence_mannequins a where a.user_id = m.id);

-- Un nouveau compte mannequin créé sur le site entre aussi au registre
create or replace function registre_suivre_comptes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into agence_mannequins (full_name, date_naissance, telephone, email, user_id, date_entree)
  values (coalesce(nullif(trim(NEW.full_name), ''), 'Sans nom'), NEW.date_naissance, NEW.phone, NEW.contact_email, NEW.id, current_date)
  on conflict (user_id) do nothing;
  return NEW;
end;
$$;
revoke all on function registre_suivre_comptes() from public, anon, authenticated;
drop trigger if exists registre_suivre_comptes on model_profiles;
create trigger registre_suivre_comptes after insert on model_profiles
  for each row execute function registre_suivre_comptes();

-- Garde-fous : la mensualité (10 000 ou 20 000) ne change que par l'administrateur principal ;
-- un paiement validé ne se modifie plus (sauf par l'administrateur principal, code récent)
create or replace function registre_garde_fous()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if est_ecriture_serveur() then return NEW; end if;
  if TG_TABLE_NAME = 'agence_mannequins' then
    if TG_OP = 'UPDATE' and NEW.mensualite is distinct from OLD.mensualite and not portail_est_principal() then
      raise exception 'Seul l''administrateur principal change la mensualité.';
    end if;
    if TG_OP = 'UPDATE' and NEW.user_id is distinct from OLD.user_id then
      raise exception 'Le lien avec le compte du site ne se change pas à la main.';
    end if;
  else
    -- un paiement ne se modifie que par « Valider » / « Refuser » (paiement_decider) ; sinon,
    -- seulement par l'administrateur principal avec un code récent (relecture du 19/10/2026)
    if TG_OP = 'UPDATE' and coalesce(current_setting('ma2m.decision', true), '') <> '1' then
      if OLD.statut = 'valide' and not portail_est_principal() then raise exception 'Un paiement validé ne se modifie plus.'; end if;
      if not portail_est_principal() then raise exception 'Un paiement se valide ou se refuse avec les boutons « Valider » et « Refuser ».'; end if;
      perform portail_exiger_auth_recente();
    end if;
    if NEW.statut = 'valide' and (TG_OP = 'INSERT' or OLD.statut <> 'valide') then
      NEW.valide_le := now();
      NEW.valide_par := auth.uid();
    end if;
    if NEW.statut = 'refuse' and coalesce(trim(NEW.motif), '') = '' then
      raise exception 'Motif obligatoire pour refuser un paiement.';
    end if;
    if TG_OP = 'INSERT' then NEW.cree_par := auth.uid(); end if;
  end if;
  return NEW;
end;
$$;
drop trigger if exists registre_garde_fous on agence_mannequins;
create trigger registre_garde_fous before insert or update on agence_mannequins for each row execute function registre_garde_fous();
drop trigger if exists paiements_garde_fous on paiements_mannequins;
create trigger paiements_garde_fous before insert or update on paiements_mannequins for each row execute function registre_garde_fous();

alter table agence_mannequins enable row level security;
alter table paiements_mannequins enable row level security;
revoke all on agence_mannequins, paiements_mannequins from anon;
drop policy if exists registre_espace2 on agence_mannequins;
create policy registre_espace2 on agence_mannequins for all using (portail_peut('paiements')) with check (portail_peut('paiements'));
drop policy if exists paiements_espace2_lecture on paiements_mannequins;
create policy paiements_espace2_lecture on paiements_mannequins for select using (portail_peut('paiements'));
drop policy if exists paiements_espace2_ajout on paiements_mannequins;
create policy paiements_espace2_ajout on paiements_mannequins for insert with check (portail_peut('paiements'));
drop policy if exists paiements_espace2_maj on paiements_mannequins;
create policy paiements_espace2_maj on paiements_mannequins for update using (portail_peut('paiements')) with check (portail_peut('paiements'));
-- (aucune suppression : un paiement erroné est refusé avec motif, tout reste au journal)
revoke delete, truncate on agence_mannequins, paiements_mannequins from authenticated;
grant select, insert, update on agence_mannequins, paiements_mannequins to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['agence_mannequins', 'paiements_mannequins']
  loop
    execute format('drop trigger if exists audit_%s on %I', t, t);
    execute format('create trigger audit_%s after insert or update or delete on %I for each row execute function audit_ecriture()', t, t);
  end loop;
end $$;

-- Valider ou refuser un paiement déclaré (« J'ai payé », orange) : d'un seul geste, avec la
-- ligne qui l'accompagne (inscription 15 000 + 1er mois 10 000, déclarés ensemble). Renvoie
-- les contacts pour le message de confirmation (parent si mineur).
create or replace function paiement_decider(p_id uuid, p_valider boolean, p_motif text default null)
returns json language plpgsql security invoker set search_path = public as $$
declare
  p paiements_mannequins;
  m agence_mannequins;
  total int;
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé'; end if;
  perform set_config('ma2m.decision', '1', true);  -- (seul chemin de validation : registre_garde_fous)
  select * into p from paiements_mannequins where id = p_id for update;
  if not found or p.statut <> 'declare' then raise exception 'Ce paiement n''est plus en attente de validation.'; end if;
  if not p_valider and coalesce(trim(p_motif), '') = '' then raise exception 'Motif obligatoire pour refuser un paiement.'; end if;
  update paiements_mannequins
     set statut = case when p_valider then 'valide' else 'refuse' end,
         motif = case when p_valider then motif else trim(p_motif) end
   where mannequin_id = p.mannequin_id and statut = 'declare' and declare_le = p.declare_le;
  select coalesce(sum(montant), 0) into total from paiements_mannequins
   where mannequin_id = p.mannequin_id and declare_le = p.declare_le;
  perform set_config('ma2m.decision', '', true);
  select * into m from agence_mannequins where id = p.mannequin_id;
  return json_build_object('nom', m.full_name, 'telephone', m.telephone, 'email', m.email,
    'parent_nom', m.parent_nom, 'parent_telephone', m.parent_telephone, 'parent_email', m.parent_email,
    'date_naissance', m.date_naissance, 'objet', p.objet, 'mois', p.mois, 'montant', total);
end;
$$;
revoke all on function paiement_decider(uuid, boolean, text) from public, anon;
grant execute on function paiement_decider(uuid, boolean, text) to authenticated;

-- -----------------------------------------------------------------------------------
-- 7. Inscription simplifiée (cahier v2.4, section 4) : code individuel + date de naissance,
--    informations du casting confirmées, règlement, « J'ai payé » (25 000 FCFA par Wave)
-- -----------------------------------------------------------------------------------
-- Appelées SEULEMENT par le serveur du site (api/code-protege.js, avec le compteur de tentatives) :
-- jamais depuis le navigateur.
alter table agence_mannequins add column if not exists ville text;
alter table agence_mannequins add column if not exists reglement_accepte_le timestamptz;
alter table agence_mannequins add column if not exists accord_parent_nom text;
create unique index if not exists agence_mannequins_une_candidature on agence_mannequins (candidature_id) where candidature_id is not null;

-- Code valable (individuel, non utilisé) + bonne date de naissance → informations du casting
create or replace function inscription_code_lire(p_code text, p_naissance date)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  c casting_applications;
  civ text;
begin
  if not est_ecriture_serveur() then raise exception 'Accès refusé.'; end if;
  select a.* into c from codes_inscription k join casting_applications a on a.id = k.candidature_id
   where k.code = upper(trim(p_code)) and not k.utilise and a.status = 'retenue';
  if not found or p_naissance is null or c.date_naissance is null or c.date_naissance <> p_naissance then
    return null;
  end if;
  civ := case when c.civilite in ('Madame', 'Mademoiselle', 'Monsieur') then c.civilite
              when c.genre = 'femme' then 'Mademoiselle' when c.genre = 'homme' then 'Monsieur' end;
  return json_build_object('salutation', trim(coalesce(civ, '') || ' ' || c.full_name), 'full_name', c.full_name,
    'telephone', c.phone, 'email', nullif(c.email, ''), 'ville', c.city, 'genre', c.genre, 'date_naissance', p_naissance,
    'casting', case c.type_candidature when 'projet' then c.projet_nom when 'direct' then 'Casting à l''agence' else 'Intégrer l''agence' end,
    'parent_nom', c.parent_nom, 'parent_telephone', c.parent_telephone, 'parent_email', c.parent_email,
    'mineur', extract(year from age(p_naissance)) < 18);
end;
$$;

-- « J'ai payé » : le code est consommé, le mannequin entre au registre (informations confirmées
-- ou corrigées) et son paiement apparaît en orange (15 000 d'inscription + 10 000 du 1er mois)
create or replace function inscription_simplifiee_payer(p_code text, p_naissance date, p_infos jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  infos json;
  k codes_inscription;
  t text := nullif(trim(p_infos ->> 'telephone'), '');
  v_id uuid;
begin
  if not est_ecriture_serveur() then raise exception 'Accès refusé.'; end if;
  -- verrou d'abord : deux « J'ai payé » simultanés, le second voit le code déjà utilisé
  select * into k from codes_inscription where code = upper(trim(p_code)) for update;
  infos := inscription_code_lire(p_code, p_naissance);
  if infos is null then raise exception 'code_invalide_ou_deja_utilise'; end if;
  if coalesce(trim(p_infos ->> 'full_name'), '') = '' or t is null then
    raise exception 'Nom et téléphone obligatoires.';
  end if;
  if (infos ->> 'mineur')::boolean and (coalesce(trim(p_infos ->> 'parent_nom'), '') = '' or coalesce(trim(p_infos ->> 'parent_telephone'), '') = ''
      or coalesce(trim(p_infos ->> 'accord_parent'), '') = '') then
    raise exception 'Mineur : nom, téléphone et accord du parent obligatoires.';
  end if;
  if coalesce(p_infos ->> 'reglement', '') <> 'accepte' then raise exception 'Le règlement doit être accepté.'; end if;
  update codes_inscription set utilise = true, utilise_le = now() where code = k.code;
  insert into agence_mannequins (full_name, genre, date_naissance, telephone, email, ville, parent_nom, parent_telephone, parent_email,
                                 candidature_id, reglement_accepte_le, accord_parent_nom)
  values (upper(left(trim(p_infos ->> 'full_name'), 120)), infos ->> 'genre', p_naissance, left(t, 40),
          left(nullif(trim(p_infos ->> 'email'), ''), 200), left(nullif(trim(p_infos ->> 'ville'), ''), 80),
          left(nullif(trim(p_infos ->> 'parent_nom'), ''), 120), left(nullif(trim(p_infos ->> 'parent_telephone'), ''), 40),
          left(nullif(trim(p_infos ->> 'parent_email'), ''), 200), k.candidature_id, now(),
          left(nullif(trim(p_infos ->> 'accord_parent'), ''), 120))
  returning id into v_id;
  insert into paiements_mannequins (mannequin_id, objet, mois, montant, mode) values
    (v_id, 'inscription', null, 15000, 'wave'),
    (v_id, 'mensualite', date_trunc('month', now())::date, 10000, 'wave');
  return v_id;
end;
$$;
revoke all on function inscription_code_lire(text, date), inscription_simplifiee_payer(text, date, jsonb) from public, anon, authenticated;

-- -----------------------------------------------------------------------------------
-- 8. Code de l'espace mannequin (cahier v2.4, 5.4) : remplace le code d'invitation général
-- -----------------------------------------------------------------------------------
-- Créé dans l'espace 2, seulement après une inscription payée et validée ; personnel, une seule
-- fois, 7 jours. À la création du compte, le mannequin retrouve ses informations du casting et
-- le code disparaît. Plus aucun code permanent.
create table if not exists codes_espace (
  code text primary key,
  mannequin_id uuid not null references agence_mannequins(id),
  cree_le timestamptz not null default now(),
  expire_le timestamptz not null default now() + interval '7 days',
  cree_par uuid references auth.users(id),
  annule boolean not null default false,
  utilise_le timestamptz
);
alter table codes_espace add column if not exists reserve_le timestamptz;
alter table codes_espace enable row level security;
revoke all on codes_espace from anon, authenticated;
drop policy if exists codes_espace_lecture on codes_espace;
create policy codes_espace_lecture on codes_espace for select using (portail_peut('paiements'));
grant select on codes_espace to authenticated;

create or replace function code_espace_creer(p_mannequin uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  m agence_mannequins;
  nouveau text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé'; end if;
  select * into m from agence_mannequins where id = p_mannequin;
  if not found then raise exception 'Mannequin introuvable.'; end if;
  if m.user_id is not null then raise exception 'Ce mannequin a déjà son espace.'; end if;
  if not exists (select 1 from paiements_mannequins where mannequin_id = p_mannequin and objet = 'inscription' and statut = 'valide') then
    raise exception 'Pas d''espace mannequin sans inscription payée et validée.';
  end if;
  -- un seul code valable à la fois : l'ancien est annulé
  update codes_espace set annule = true where mannequin_id = p_mannequin and utilise_le is null and not annule;
  loop
    nouveau := 'ESP-';
    for i in 1..6 loop
      nouveau := nouveau || substr(alphabet, 1 + get_byte(gen_random_bytes(1), 0) % 32, 1);
    end loop;
    exit when not exists (select 1 from codes_espace where code = nouveau);
  end loop;
  insert into codes_espace (code, mannequin_id, cree_par) values (nouveau, p_mannequin, auth.uid());
  perform journaliser('Code de l''espace mannequin créé', 'agence_mannequins', p_mannequin::text, null, null);
  return nouveau;
end;
$$;
revoke all on function code_espace_creer(uuid) from public, anon;
grant execute on function code_espace_creer(uuid) to authenticated;

-- Serveur du site seulement (api/code-protege.js, tentatives comptées)
create or replace function code_espace_valable(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select est_ecriture_serveur() and exists (select 1 from codes_espace c join agence_mannequins m on m.id = c.mannequin_id
    where c.code = upper(trim(p_code)) and not c.annule and c.utilise_le is null and c.expire_le > now() and m.user_id is null
      and (c.reserve_le is null or c.reserve_le < now() - interval '10 minutes'));
$$;
-- Réserver le code le temps de créer le compte : un second envoi simultané est refusé
create or replace function code_espace_reserver(p_code text, p_reserver boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not est_ecriture_serveur() then raise exception 'Accès refusé.'; end if;
  if not p_reserver then
    update codes_espace set reserve_le = null where code = upper(trim(p_code)) and utilise_le is null;
    return true;
  end if;
  if not code_espace_valable(p_code) then return false; end if;
  update codes_espace set reserve_le = now() where code = upper(trim(p_code));
  return true;
end;
$$;
-- Compte créé : rattaché à sa fiche du registre (la ligne ajoutée d'office par
-- registre_suivre_comptes est retirée), informations du casting recopiées, code consommé
create or replace function code_espace_utiliser(p_code text, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c codes_espace;
  m agence_mannequins;
begin
  if not est_ecriture_serveur() then raise exception 'Accès refusé.'; end if;
  select * into c from codes_espace where code = upper(trim(p_code)) for update;
  if not found or c.annule or c.utilise_le is not null or c.reserve_le is null then raise exception 'code_invalide_ou_deja_utilise'; end if;
  select * into m from agence_mannequins where id = c.mannequin_id for update;
  delete from agence_mannequins a where a.user_id = p_user and a.id <> m.id
    and not exists (select 1 from paiements_mannequins p where p.mannequin_id = a.id);
  update agence_mannequins set user_id = p_user where id = m.id;
  update model_profiles set full_name = coalesce(nullif(trim(m.full_name), ''), full_name), phone = coalesce(m.telephone, phone),
    contact_email = coalesce(m.email, contact_email), date_naissance = coalesce(m.date_naissance, date_naissance), city = coalesce(m.ville, city)
  where id = p_user;
  update codes_espace set utilise_le = now() where code = c.code;
  perform journaliser('Espace mannequin créé avec son code', 'agence_mannequins', m.id::text, null, null);
end;
$$;
revoke all on function code_espace_valable(text), code_espace_reserver(text, boolean), code_espace_utiliser(text, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------------
-- 9. Mensualités de formation (cahier v2.4, 5.6 et 5.7 ; choix du 19/10/2026)
-- -----------------------------------------------------------------------------------
-- Le 1er : l'agence coche les mannequins actifs à appeler (elle décoche ceux qui ne paient plus)
-- et envoie l'appel. Le 3 et le 5 : relances automatiques par e-mail, seulement aux personnes
-- appelées et pas encore payées (serveur du site), et liste WhatsApp prête dans l'espace 2.
-- Après le 5 : non payé (rouge). Le mannequin paie dans son espace (Wave, puis « J'ai payé ») ;
-- tableau de 24 mois de formation. Un seul paiement de mensualité en cours par mois.
create unique index if not exists paiements_une_mensualite on paiements_mannequins (mannequin_id, mois)
  where objet = 'mensualite' and statut <> 'refuse';
create table if not exists mensualites_appels (
  mois date not null,
  mannequin_id uuid not null references agence_mannequins(id),
  appel_le timestamptz not null default now(),
  appel_par uuid references auth.users(id),
  relance3_le timestamptz,
  relance5_le timestamptz,
  primary key (mois, mannequin_id)
);
alter table mensualites_appels enable row level security;
revoke all on mensualites_appels from anon, authenticated;
drop policy if exists appels_lecture on mensualites_appels;
create policy appels_lecture on mensualites_appels for select using (portail_peut('paiements'));
grant select on mensualites_appels to authenticated;

-- État d'un mois pour un mannequin : paye (vert), attente (orange), non_paye (rouge, après le 5),
-- a_payer (mois en cours avant le 6), a_venir
create or replace function mensualite_etat(p_mannequin uuid, p_mois date)
returns text language sql stable security definer set search_path = public as $$
  select case
    -- (seulement l'agence, le serveur, ou le mannequin pour lui-même)
    when not (est_ecriture_serveur() or portail_peut('paiements')
              or exists (select 1 from agence_mannequins where id = p_mannequin and user_id = auth.uid())) then null
    when exists (select 1 from paiements_mannequins where mannequin_id = p_mannequin and objet = 'mensualite' and mois = p_mois and statut = 'valide') then 'paye'
    when exists (select 1 from paiements_mannequins where mannequin_id = p_mannequin and objet = 'mensualite' and mois = p_mois and statut = 'declare') then 'attente'
    when p_mois > date_trunc('month', now())::date then 'a_venir'
    when p_mois < date_trunc('month', now())::date or extract(day from now()) > 5 then 'non_paye'
    else 'a_payer' end;
$$;
revoke all on function mensualite_etat(uuid, date) from public, anon;
grant execute on function mensualite_etat(uuid, date) to authenticated;

-- L'agence envoie l'appel du 1er aux personnes cochées (actives) : renvoie leurs contacts
create or replace function mensualites_appeler(p_mois date, p_ids uuid[])
returns json language plpgsql security definer set search_path = public as $$
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé'; end if;
  insert into mensualites_appels (mois, mannequin_id, appel_par)
  select date_trunc('month', p_mois)::date, a.id, auth.uid() from agence_mannequins a where a.id = any(p_ids) and a.statut = 'actif'
  on conflict (mois, mannequin_id) do nothing;
  perform journaliser('Appel des mensualités envoyé', 'mensualites_appels', to_char(p_mois, 'YYYY-MM'), null, json_build_object('nombre', coalesce(array_length(p_ids, 1), 0))::jsonb);
  return (select coalesce(json_agg(json_build_object('id', a.id, 'nom', a.full_name, 'telephone', a.telephone, 'email', a.email, 'date_naissance', a.date_naissance,
    'parent_nom', a.parent_nom, 'parent_telephone', a.parent_telephone, 'parent_email', a.parent_email, 'mensualite', a.mensualite)), '[]'::json)
    from agence_mannequins a where a.id = any(p_ids) and a.statut = 'actif');
end;
$$;
revoke all on function mensualites_appeler(date, uuid[]) from public, anon;
grant execute on function mensualites_appeler(date, uuid[]) to authenticated;

-- Relances du 3 et du 5 (serveur du site, une seule fois chacune) : personnes appelées ce mois,
-- toujours actives, sans paiement déclaré ni validé, pas encore relancées ce jour-là. Marquées
-- relancées SEULEMENT après l'envoi réussi de l'e-mail (mensualites_relance_faite).
create or replace function mensualites_relances(p_jour int)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  m date := date_trunc('month', now())::date;
begin
  if not est_ecriture_serveur() then raise exception 'Accès refusé.'; end if;
  if p_jour not in (3, 5) then raise exception 'Jour de relance : 3 ou 5.'; end if;
  return (select coalesce(json_agg(json_build_object('id', a.id, 'nom', a.full_name, 'telephone', a.telephone, 'email', a.email, 'date_naissance', a.date_naissance,
      'parent_nom', a.parent_nom, 'parent_telephone', a.parent_telephone, 'parent_email', a.parent_email, 'mensualite', a.mensualite)), '[]'::json)
    from mensualites_appels c join agence_mannequins a on a.id = c.mannequin_id
    where c.mois = m and a.statut = 'actif' and mensualite_etat(a.id, m) in ('a_payer', 'non_paye')
      and (case when p_jour = 3 then c.relance3_le else c.relance5_le end) is null);
end;
$$;
create or replace function mensualites_relance_faite(p_jour int, p_mannequin uuid)
returns void language sql security definer set search_path = public as $$
  update mensualites_appels set relance3_le = case when p_jour = 3 then now() else relance3_le end,
                                relance5_le = case when p_jour = 5 then now() else relance5_le end
  where mois = date_trunc('month', now())::date and mannequin_id = p_mannequin and est_ecriture_serveur();
$$;
revoke all on function mensualites_relance_faite(int, uuid) from public, anon, authenticated;
revoke all on function mensualites_relances(int) from public, anon, authenticated;

-- Côté mannequin (son espace) : ses 24 mois de formation et « J'ai payé » pour un mois
create or replace function mes_mensualites()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  a agence_mannequins;
  debut date;
begin
  select * into a from agence_mannequins where user_id = auth.uid();
  if not found then return json_build_object('inscrit', false); end if;
  -- (comptes repris : à partir de leur entrée au registre, jamais des mois d'avant le nouveau système)
  debut := date_trunc('month', coalesce((select min(mois) from paiements_mannequins where mannequin_id = a.id and objet = 'mensualite'),
                                        greatest(a.date_entree, a.cree_le::date)))::date;
  return json_build_object('inscrit', true, 'nom', a.full_name, 'mensualite', a.mensualite, 'statut', a.statut,
    'mineur', a.date_naissance is not null and extract(year from age(a.date_naissance)) < 18,
    'mois', (select json_agg(json_build_object('mois', g::date, 'etat', mensualite_etat(a.id, g::date)) order by g)
             from generate_series(debut, debut + interval '23 months', interval '1 month') g));
end;
$$;
create or replace function mensualite_declarer(p_mois date)
returns void language plpgsql security definer set search_path = public as $$
declare
  a agence_mannequins;
  m date := date_trunc('month', p_mois)::date;
begin
  select * into a from agence_mannequins where user_id = auth.uid() and statut = 'actif';
  if not found then raise exception 'Espace non rattaché à l''agence : contactez l''agence.'; end if;
  if m > date_trunc('month', now())::date + interval '3 months' or m < date_trunc('month', greatest(a.date_entree, a.cree_le::date)) then
    raise exception 'Mois hors de votre formation.';
  end if;
  if mensualite_etat(a.id, m) in ('paye', 'attente') then raise exception 'Ce mois est déjà payé ou en cours de vérification.'; end if;
  insert into paiements_mannequins (mannequin_id, objet, mois, montant, mode) values (a.id, 'mensualite', m, a.mensualite, 'wave');
end;
$$;
revoke all on function mes_mensualites(), mensualite_declarer(date) from public, anon;
grant execute on function mes_mensualites(), mensualite_declarer(date) to authenticated;

-- -----------------------------------------------------------------------------------
-- 10. Espace 3 — Comptabilité (cahier v2.4, section 6) : morceau A recettes, dépenses, trésorerie ;
--     morceau B clients et fournisseurs (ce qu'on nous doit, ce qu'on doit), personnel et
--     prestataires, matériel durable
-- -----------------------------------------------------------------------------------
-- L'agence enregistre, le comptable traite. Chaque paiement validé dans l'espace 2 devient tout
-- seul une recette (sans le nom du mannequin : le comptable ne voit que des montants). Rien ne
-- s'efface : une écriture erronée est annulée avec un motif, et tout reste au journal d'audit.
create table if not exists compta_comptes (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  type text not null check (type in ('caisse', 'wave', 'banque', 'mobile_money', 'autre')),
  solde_initial int not null default 0,
  date_initiale date not null default current_date,
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);
insert into compta_comptes (nom, type) values ('Caisse (espèces)', 'caisse'), ('Wave Business', 'wave')
on conflict (nom) do nothing;

-- Comptes : le type ne change pas ; il reste toujours une caisse et un compte Wave actifs (les
-- paiements de l'espace 2 y arrivent)
create or replace function compta_comptes_garde_fous()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if est_ecriture_serveur() then return NEW; end if;
  if NEW.type <> OLD.type then raise exception 'Le type d''un compte ne change pas.'; end if;
  if OLD.actif and not NEW.actif and OLD.type in ('caisse', 'wave') then
    perform 1 from compta_comptes where type = OLD.type and id <> OLD.id for update;  -- (deux fermetures en même temps)
  end if;
  if OLD.actif and not NEW.actif and OLD.type in ('caisse', 'wave') and not exists (select 1 from compta_comptes where type = OLD.type and actif and id <> OLD.id) then
    raise exception 'Gardez au moins un compte % actif : les paiements de l''espace 2 y arrivent.', case when OLD.type = 'caisse' then 'caisse' else 'Wave' end;
  end if;
  return NEW;
end;
$$;
drop trigger if exists compta_comptes_garde_fous on compta_comptes;
create trigger compta_comptes_garde_fous before update on compta_comptes for each row execute function compta_comptes_garde_fous();

-- Carnet : clients, fournisseurs, personnel, prestataires (jamais les mannequins : registre de l'espace 2)
create table if not exists compta_tiers (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (trim(nom) <> ''),
  type text not null check (type in ('client', 'fournisseur', 'personnel', 'prestataire')),
  telephone text,
  email text,
  notes text,
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);
-- Ce qu'on nous doit (créance : facture d'un client pas encore payée) et ce qu'on doit (dette :
-- facture d'un fournisseur pas encore payée). Réglées, en une ou plusieurs fois, par des
-- recettes ou des dépenses liées (compta_ecritures.dette_id).
create table if not exists compta_dettes (
  id uuid primary key default gen_random_uuid(),
  sens text not null check (sens in ('creance', 'dette')),
  tiers_id uuid not null references compta_tiers(id),
  date_op date not null default current_date,
  echeance date,
  montant int not null check (montant > 0),
  categorie text not null,
  libelle text not null,
  justificatif text,
  annule boolean not null default false,
  motif_annulation text,
  cree_par uuid references auth.users(id),
  cree_le timestamptz not null default now(),
  check (not annule or coalesce(trim(motif_annulation), '') <> '')
);

create table if not exists compta_ecritures (
  id uuid primary key default gen_random_uuid(),
  sens text not null check (sens in ('recette', 'depense', 'virement')),
  date_op date not null default current_date,
  montant int not null check (montant > 0),
  compte_id uuid not null references compta_comptes(id),
  compte_dest_id uuid references compta_comptes(id),         -- virement : compte qui reçoit
  categorie text not null,
  libelle text not null,
  tiers text,                                                  -- client, fournisseur, bénéficiaire
  tiers_id uuid references compta_tiers(id),
  dette_id uuid references compta_dettes(id),                  -- règlement d'une créance ou d'une dette
  justificatif text,                                           -- chemin dans le stockage privé
  source text not null default 'manuel' check (source in ('manuel', 'espace2')),
  paiement_id uuid references paiements_mannequins(id),       -- une seule recette en vigueur par paiement (index plus bas)
  annule boolean not null default false,
  motif_annulation text,
  cree_par uuid references auth.users(id),
  cree_le timestamptz not null default now(),
  check (sens <> 'virement' or (compte_dest_id is not null and compte_dest_id <> compte_id)),
  check (not annule or coalesce(trim(motif_annulation), '') <> '')
);
alter table compta_ecritures add column if not exists tiers_id uuid references compta_tiers(id);
alter table compta_ecritures add column if not exists dette_id uuid references compta_dettes(id);
create index if not exists compta_ecritures_date on compta_ecritures (date_op);
alter table compta_ecritures drop constraint if exists compta_ecritures_paiement_id_key;
create unique index if not exists compta_ecritures_paiement on compta_ecritures (paiement_id) where not annule;
create index if not exists compta_ecritures_dette on compta_ecritures (dette_id) where dette_id is not null;

-- Matériel durable acheté (ordinateur, appareil photo, projecteurs…), suivi à part : son achat
-- est une dépense « Matériel » (ecriture_id) ; il sort de l'inventaire avec un motif, jamais effacé
create table if not exists compta_materiel (
  id uuid primary key default gen_random_uuid(),
  designation text not null check (trim(designation) <> ''),
  date_achat date not null,
  montant int not null check (montant > 0),
  ecriture_id uuid unique references compta_ecritures(id),
  numero_serie text,
  emplacement text,
  etat text not null default 'en_service' check (etat in ('en_service', 'en_panne', 'sorti')),
  date_sortie date,
  motif_sortie text,
  cree_par uuid references auth.users(id),
  cree_le timestamptz not null default now(),
  check (etat <> 'sorti' or (date_sortie is not null and coalesce(trim(motif_sortie), '') <> ''))
);

-- Une écriture ne se modifie pas : seuls l'annulation (avec motif) et l'ajout du justificatif
-- sont permis ; les recettes venues de l'espace 2 ne s'annulent pas d'ici
create or replace function compta_garde_fous()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d compta_dettes;
begin
  if est_ecriture_serveur() then return NEW; end if;
  -- recette posée ou annulée par compta_depuis_espace2 (déclencheur dans un déclencheur : jamais une saisie)
  if pg_trigger_depth() > 1 and NEW.source = 'espace2' and (TG_OP = 'INSERT' or (OLD.source = 'espace2' and NEW.annule
      and (to_jsonb(NEW) - 'annule' - 'motif_annulation') = (to_jsonb(OLD) - 'annule' - 'motif_annulation'))) then return NEW; end if;
  if TG_OP = 'INSERT' then
    if NEW.source <> 'manuel' or NEW.paiement_id is not null then raise exception 'Les recettes de l''espace 2 arrivent toutes seules.'; end if;
    if NEW.dette_id is not null then
      select * into d from compta_dettes where id = NEW.dette_id for update;
      if not found or d.annule then raise exception 'Créance ou dette introuvable ou annulée.'; end if;
      if NEW.sens <> (case when d.sens = 'creance' then 'recette' else 'depense' end) then raise exception 'Règlement incohérent.'; end if;
      if NEW.montant > compta_dette_reste(d.id) then
        raise exception 'Le règlement dépasse ce qui reste à payer.';
      end if;
      NEW.tiers_id := d.tiers_id;
    end if;
    if NEW.tiers_id is not null then NEW.tiers := (select nom from compta_tiers where id = NEW.tiers_id); end if;
    NEW.cree_par := auth.uid();
    return NEW;
  end if;
  if (to_jsonb(NEW) - 'annule' - 'motif_annulation' - 'justificatif') <> (to_jsonb(OLD) - 'annule' - 'motif_annulation' - 'justificatif') then
    raise exception 'Une écriture ne se modifie pas : annulez-la avec un motif, puis saisissez la bonne.';
  end if;
  if OLD.annule and not NEW.annule then raise exception 'Une écriture annulée le reste.'; end if;
  if OLD.justificatif is not null and NEW.justificatif is distinct from OLD.justificatif then raise exception 'Le justificatif est déjà joint : il ne se remplace pas.'; end if;
  if NEW.annule and not OLD.annule and OLD.source = 'espace2' then
    raise exception 'Une recette de l''espace 2 ne s''annule pas d''ici.';
  end if;
  if NEW.annule and not OLD.annule and exists (select 1 from compta_documents where ecriture_id = OLD.id and not annule) then
    raise exception 'Un reçu a été remis pour cette recette : annulez d''abord le reçu.';
  end if;
  if NEW.annule and not OLD.annule and exists (select 1 from compta_materiel where ecriture_id = OLD.id and etat <> 'sorti') then
    raise exception 'Achat de matériel : sortez d''abord le matériel de l''inventaire (avec le motif).';
  end if;
  return NEW;
end;
$$;
drop trigger if exists compta_garde_fous on compta_ecritures;
create trigger compta_garde_fous before insert or update on compta_ecritures for each row execute function compta_garde_fous();

-- Créance ou dette : ne se modifie pas (sauf échéance et justificatif) ; annulée avec un motif,
-- seulement si aucun règlement n'est enregistré
create or replace function compta_dettes_garde_fous()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if est_ecriture_serveur() then return NEW; end if;
  if TG_OP = 'INSERT' then NEW.cree_par := auth.uid(); NEW.annule := false; NEW.motif_annulation := null; return NEW; end if;
  if (to_jsonb(NEW) - 'annule' - 'motif_annulation' - 'justificatif' - 'echeance') <> (to_jsonb(OLD) - 'annule' - 'motif_annulation' - 'justificatif' - 'echeance') then
    raise exception 'Ne se modifie pas : annulez avec un motif, puis saisissez la bonne.';
  end if;
  if OLD.annule and not NEW.annule then raise exception 'Une ligne annulée le reste.'; end if;
  if OLD.justificatif is not null and NEW.justificatif is distinct from OLD.justificatif then raise exception 'Le justificatif est déjà joint : il ne se remplace pas.'; end if;
  if NEW.annule and not OLD.annule and exists (select 1 from compta_documents where dette_id = OLD.id) then
    raise exception 'Somme due d''une facture : elle se corrige par un avoir.';
  end if;
  if NEW.annule and not OLD.annule and exists (select 1 from compta_ecritures where dette_id = OLD.id and not annule) then
    raise exception 'Des règlements sont enregistrés : annulez-les d''abord.';
  end if;
  return NEW;
end;
$$;
drop trigger if exists compta_dettes_garde_fous on compta_dettes;
create trigger compta_dettes_garde_fous before insert or update on compta_dettes for each row execute function compta_dettes_garde_fous();

-- Matériel : achat (date, montant, dépense liée) figé ; une fois sorti, il le reste
create or replace function compta_materiel_garde_fous()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if est_ecriture_serveur() then return NEW; end if;
  if TG_OP = 'INSERT' then
    if NEW.ecriture_id is not null and not exists (select 1 from compta_ecritures where id = NEW.ecriture_id and sens = 'depense' and categorie = 'materiel' and not annule) then
      raise exception 'La dépense liée doit être un achat de matériel.';
    end if;
    NEW.cree_par := auth.uid();
    return NEW;
  end if;
  if NEW.date_achat <> OLD.date_achat or NEW.montant <> OLD.montant or NEW.ecriture_id is distinct from OLD.ecriture_id or NEW.cree_par is distinct from OLD.cree_par then
    raise exception 'L''achat ne se modifie pas.';
  end if;
  if OLD.etat = 'sorti' and NEW.etat <> 'sorti' then raise exception 'Un matériel sorti de l''inventaire le reste.'; end if;
  return NEW;
end;
$$;
drop trigger if exists compta_materiel_garde_fous on compta_materiel;
create trigger compta_materiel_garde_fous before insert or update on compta_materiel for each row execute function compta_materiel_garde_fous();

-- Achat de matériel en une fois : la dépense « Matériel » et la ligne d'inventaire (droits de la
-- personne qui appelle : règles d'accès et garde-fous s'appliquent)
create or replace function compta_materiel_acheter(p_designation text, p_date date, p_montant int, p_compte uuid,
  p_fournisseur text default null, p_numero_serie text default null, p_emplacement text default null, p_justificatif text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  e uuid;
  m uuid;
begin
  insert into compta_ecritures (sens, date_op, montant, compte_id, categorie, libelle, tiers, justificatif)
  values ('depense', p_date, p_montant, p_compte, 'materiel', 'Achat : ' || trim(p_designation), nullif(trim(p_fournisseur), ''), p_justificatif)
  returning id into e;
  insert into compta_materiel (designation, date_achat, montant, ecriture_id, numero_serie, emplacement)
  values (trim(p_designation), p_date, p_montant, e, nullif(trim(p_numero_serie), ''), nullif(trim(p_emplacement), ''))
  returning id into m;
  return m;
end;
$$;
revoke all on function compta_materiel_acheter(text, date, int, uuid, text, text, text, text) from public, anon;
grant execute on function compta_materiel_acheter(text, date, int, uuid, text, text, text, text) to authenticated;

-- Espace 2 → comptabilité : un paiement validé (montant connu) devient une recette
create or replace function compta_depuis_espace2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  compte uuid;
begin
  if TG_OP = 'UPDATE' and OLD.statut = 'valide' then
    if NEW.statut = OLD.statut and NEW.montant is not distinct from OLD.montant and NEW.mode = OLD.mode then return NEW; end if;
    -- paiement corrigé ou refusé après validation : l'ancienne recette est annulée (et remplacée
    -- par la bonne s'il reste validé)
    update compta_ecritures set annule = true, motif_annulation = 'Paiement corrigé ou refusé dans l''espace 2'
    where paiement_id = NEW.id and not annule;
  end if;
  if NEW.statut <> 'valide' or NEW.montant is null or NEW.mode = 'avant_systeme' then return NEW; end if;
  -- (compte actif d'abord ; les garde-fous des comptes empêchent de fermer la dernière caisse ou le dernier Wave)
  select id into compte from compta_comptes where type = case when NEW.mode = 'especes' then 'caisse' else 'wave' end order by actif desc, cree_le limit 1;
  if compte is null then
    -- (ne bloque jamais la validation dans l'espace 2 ; les garde-fous des comptes l'empêchent)
    perform journaliser('Comptabilité : paiement validé sans compte ' || case when NEW.mode = 'especes' then 'caisse' else 'Wave' end || ' pour le recevoir',
                        'paiements_mannequins', NEW.id::text, null, null);
    return NEW;
  end if;
  insert into compta_ecritures (sens, date_op, montant, compte_id, categorie, libelle, source, paiement_id)
  values ('recette', coalesce(NEW.valide_le, now())::date, NEW.montant, compte,
          case when NEW.objet = 'inscription' then 'inscription' else 'formation' end,
          case when NEW.objet = 'inscription' then 'Droit d''inscription d''un mannequin'
               else 'Mensualité de formation · ' || to_char(NEW.mois, 'MM/YYYY') end,
          'espace2', NEW.id)
  on conflict (paiement_id) where not annule do nothing;
  return NEW;
end;
$$;
revoke all on function compta_depuis_espace2() from public, anon, authenticated;
drop trigger if exists compta_depuis_espace2 on paiements_mannequins;
create trigger compta_depuis_espace2 after insert or update of statut, montant, mode on paiements_mannequins
  for each row execute function compta_depuis_espace2();
-- paiements déjà validés avant cette étape : repris une fois
insert into compta_ecritures (sens, date_op, montant, compte_id, categorie, libelle, source, paiement_id)
select 'recette', coalesce(p.valide_le, p.declare_le)::date, p.montant,
       (select id from compta_comptes where type = case when p.mode = 'especes' then 'caisse' else 'wave' end order by cree_le limit 1),
       case when p.objet = 'inscription' then 'inscription' else 'formation' end,
       case when p.objet = 'inscription' then 'Droit d''inscription d''un mannequin' else 'Mensualité de formation · ' || to_char(p.mois, 'MM/YYYY') end,
       'espace2', p.id
from paiements_mannequins p
where p.statut = 'valide' and p.montant is not null and p.mode <> 'avant_systeme'
on conflict (paiement_id) where not annule do nothing;

-- Soldes de trésorerie : solde de départ + recettes − dépenses ± virements (hors annulées)
create or replace function compta_soldes()
returns table (compte_id uuid, nom text, type text, solde bigint) language sql stable security definer set search_path = public as $$
  select c.id, c.nom, c.type, c.solde_initial
    + coalesce((select sum(case when e.sens = 'recette' then e.montant when e.sens = 'depense' then -e.montant else -e.montant end)
                from compta_ecritures e where e.compte_id = c.id and not e.annule and e.date_op >= c.date_initiale), 0)
    + coalesce((select sum(e.montant) from compta_ecritures e where e.compte_dest_id = c.id and e.sens = 'virement' and not e.annule and e.date_op >= c.date_initiale), 0)
  from compta_comptes c where portail_peut('compta') order by c.cree_le;
$$;
revoke all on function compta_soldes() from public, anon;
-- Trésorerie d'une période (dossier du mois) : solde au début, entrées, sorties, solde à la fin
create or replace function compta_tresorerie(p_debut date, p_fin date)
returns table (compte_id uuid, nom text, ouvert boolean, debut bigint, entrees bigint, sorties bigint, fin bigint)
language sql stable security definer set search_path = public as $$
  with mvt as (
    select c.id, e.date_op, case when e.sens = 'virement' and e.compte_dest_id = c.id then e.montant when e.sens = 'recette' then e.montant else -e.montant end as effet
    from compta_comptes c join compta_ecritures e on (e.compte_id = c.id or (e.sens = 'virement' and e.compte_dest_id = c.id))
    where not e.annule and e.date_op >= c.date_initiale and e.date_op < p_fin
  )
  select c.id, c.nom, c.date_initiale < p_fin,
         c.solde_initial + coalesce((select sum(effet) from mvt where mvt.id = c.id and date_op < p_debut), 0),
         coalesce((select sum(effet) from mvt where mvt.id = c.id and date_op >= p_debut and effet > 0), 0),
         coalesce((select -sum(effet) from mvt where mvt.id = c.id and date_op >= p_debut and effet < 0), 0),
         c.solde_initial + coalesce((select sum(effet) from mvt where mvt.id = c.id), 0)
  from compta_comptes c where portail_peut('compta') order by c.cree_le;
$$;
revoke all on function compta_tresorerie(date, date) from public, anon;
grant execute on function compta_tresorerie(date, date) to authenticated;
grant execute on function compta_soldes() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['compta_comptes', 'compta_ecritures', 'compta_tiers', 'compta_dettes', 'compta_materiel']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
    execute format('revoke delete, truncate on %I from authenticated', t);
    execute format('grant select, insert, update on %I to authenticated', t);
    execute format('drop policy if exists %s_acces on %I', t, t);
    execute format('create policy %s_acces on %I for all using (portail_peut(''compta'')) with check (portail_peut(''compta''))', t, t);
    execute format('drop trigger if exists audit_%s on %I', t, t);
    execute format('create trigger audit_%s after insert or update or delete on %I for each row execute function audit_ecriture()', t, t);
  end loop;
end $$;

-- Justificatifs (photo ou PDF) : stockage privé, espace 3 seulement
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('compta-justificatifs', 'compta-justificatifs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Justificatifs : espace 3 lit" on storage.objects;
create policy "Justificatifs : espace 3 lit" on storage.objects for select using (bucket_id = 'compta-justificatifs' and portail_peut('compta'));
drop policy if exists "Justificatifs : espace 3 dépose" on storage.objects;
create policy "Justificatifs : espace 3 dépose" on storage.objects for insert with check (bucket_id = 'compta-justificatifs' and portail_peut('compta'));

-- -----------------------------------------------------------------------------------
-- 11. Espace 3 — Comptabilité : morceau C documents (devis, proformas, factures, avoirs, reçus
--     numérotés sans trou), morceau D impôts et taxes + interrupteur « mode légal »
-- -----------------------------------------------------------------------------------
-- Identité de l'agence imprimée sur les documents, et mode légal (une seule ligne). Aujourd'hui :
-- documents « non fiscal », TVA et FNE désactivées. Le jour où l'agence est constituée,
-- l'administrateur principal remplit l'identité légale et bascule l'interrupteur (définitif) :
-- les NOUVELLES factures deviennent de vraies factures, avec TVA ; rien d'ancien ne change.
create table if not exists compta_reglages (
  id int primary key default 1 check (id = 1),
  nom_commercial text not null default 'Maître Akesse Model Management',
  adresse text,
  telephone text,
  email text,
  raison_sociale text,
  forme_juridique text,
  rccm text,                       -- registre du commerce
  ncc text,                        -- numéro de compte contribuable (DGI)
  regime_fiscal text,
  tva_taux numeric(4,2) not null default 18 check (tva_taux >= 0 and tva_taux < 100),
  pied_de_page text,
  mode_legal boolean not null default false,
  mode_legal_le timestamptz,
  modifie_le timestamptz not null default now()
);
insert into compta_reglages (id) values (1) on conflict (id) do nothing;

create or replace function compta_reglages_garde_fous()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if est_ecriture_serveur() then return NEW; end if;
  if not portail_est_principal() then raise exception 'Réservé à l''administrateur principal.'; end if;
  if OLD.mode_legal and not NEW.mode_legal then raise exception 'Le mode légal, une fois activé, le reste.'; end if;
  if NEW.mode_legal and not OLD.mode_legal then
    perform portail_exiger_auth_recente();
    if coalesce(trim(NEW.raison_sociale), '') = '' or coalesce(trim(NEW.rccm), '') = '' or coalesce(trim(NEW.ncc), '') = '' then
      raise exception 'Remplissez d''abord la raison sociale, le RCCM et le numéro de compte contribuable.';
    end if;
    NEW.mode_legal_le := now();
  end if;
  if OLD.mode_legal then NEW.mode_legal_le := OLD.mode_legal_le; end if;
  NEW.id := 1;
  NEW.modifie_le := now();
  return NEW;
end;
$$;
drop trigger if exists compta_reglages_garde_fous on compta_reglages;
create trigger compta_reglages_garde_fous before update on compta_reglages for each row execute function compta_reglages_garde_fous();

-- Compteurs : un par type de document, par année et par série (non fiscale / fiscale). Pris dans
-- la même transaction que le document : si l'enregistrement échoue, le numéro n'est pas consommé.
create table if not exists compta_numeros (
  type text not null,
  annee int not null,
  fiscal boolean not null,
  dernier int not null default 0,
  primary key (type, annee, fiscal)
);

create table if not exists compta_documents (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('devis', 'proforma', 'facture', 'avoir', 'recu')),
  numero text not null unique,
  annee int not null,
  rang int not null,
  fiscal boolean not null,
  date_doc date not null,
  validite date,                                   -- devis, proforma
  tiers_id uuid not null references compta_tiers(id),
  destinataire jsonb not null,                     -- nom, téléphone, e-mail au jour du document
  lignes jsonb not null,                           -- [{ designation, quantite, prix }]
  total_ht int not null check (total_ht >= 0),
  tva_taux numeric(4,2) not null default 0,
  tva int not null default 0,
  total_ttc int not null check (total_ttc >= 0),
  categorie text,                                  -- catégorie de recette (facture)
  notes text,
  origine_id uuid references compta_documents(id), -- avoir → facture ; facture → devis/proforma ; reçu → facture
  dette_id uuid unique references compta_dettes(id),  -- facture → somme due par le client
  ecriture_id uuid references compta_ecritures(id),        -- reçu → recette encaissée (un seul reçu en vigueur)
  etat text not null default 'emis' check (etat in ('emis', 'en_attente', 'accepte', 'refuse', 'facture')),
  fne_reference text,                              -- numéro FNE de la DGI (vraies factures)
  annule boolean not null default false,
  motif_annulation text,
  cree_par uuid references auth.users(id),
  cree_le timestamptz not null default now(),
  unique (type, annee, fiscal, rang),
  check (not annule or coalesce(trim(motif_annulation), '') <> '')
);
create index if not exists compta_documents_date on compta_documents (date_doc);
alter table compta_documents drop constraint if exists compta_documents_ecriture_id_key;
create unique index if not exists compta_documents_recu on compta_documents (ecriture_id) where not annule;

-- Reste dû d'une créance ou d'une dette : montant − règlements − avoirs (factures)
create or replace function compta_dette_reste(p_id uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select d.montant
    - coalesce((select sum(e.montant) from compta_ecritures e where e.dette_id = d.id and not e.annule), 0)
    - coalesce((select sum(a.total_ttc) from compta_documents a join compta_documents f on f.id = a.origine_id
                where a.type = 'avoir' and not a.annule and f.dette_id = d.id), 0)
  from compta_dettes d where d.id = p_id;
$$;
revoke all on function compta_dette_reste(uuid) from public, anon, authenticated;
-- Créances ou dettes avec ce qui est réglé, les avoirs et le reste (droits de la personne qui appelle)
create or replace function compta_dettes_etat(p_sens text)
returns table (id uuid, sens text, tiers_id uuid, date_op date, echeance date, montant int, categorie text, libelle text, justificatif text,
               annule boolean, motif_annulation text, regle bigint, avoirs bigint, reste bigint, retard boolean, facture text)
language sql stable security invoker set search_path = public as $$
  select d.id, d.sens, d.tiers_id, d.date_op, d.echeance, d.montant, d.categorie, d.libelle, d.justificatif, d.annule, d.motif_annulation, x.regle, x.avoirs,
         case when d.annule then 0 else d.montant - x.regle - x.avoirs end,
         not d.annule and d.montant - x.regle - x.avoirs > 0 and d.echeance < current_date,
         (select f.numero from compta_documents f where f.dette_id = d.id)
  from compta_dettes d
  cross join lateral (select
    coalesce((select sum(e.montant) from compta_ecritures e where e.dette_id = d.id and not e.annule), 0)::bigint as regle,
    coalesce((select sum(a.total_ttc) from compta_documents a join compta_documents f on f.id = a.origine_id
              where a.type = 'avoir' and not a.annule and f.dette_id = d.id), 0)::bigint as avoirs) x
  where d.sens = p_sens
  order by d.date_op desc, d.cree_le desc;
$$;
revoke all on function compta_dettes_etat(text) from public, anon;
grant execute on function compta_dettes_etat(text) to authenticated;

-- Un document ne s'efface ni ne se modifie : seuls l'état d'un devis / proforma, le numéro FNE
-- (une fois) et l'annulation avec motif (devis, proforma, reçu ; une facture se corrige par un avoir)
create or replace function compta_documents_garde_fous()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if est_ecriture_serveur() then return NEW; end if;
  if TG_OP = 'INSERT' then
    if coalesce(current_setting('ma2m.document', true), '') <> '1' then raise exception 'Un document se crée par « Nouveau document ».'; end if;
    return NEW;
  end if;
  if coalesce(current_setting('ma2m.document', true), '') = '1' then return NEW; end if;  -- facture tirée d'un devis
  if (to_jsonb(NEW) - 'etat' - 'fne_reference' - 'annule' - 'motif_annulation') <> (to_jsonb(OLD) - 'etat' - 'fne_reference' - 'annule' - 'motif_annulation') then
    raise exception 'Un document numéroté ne se modifie pas.';
  end if;
  if NEW.etat <> OLD.etat and (OLD.type not in ('devis', 'proforma') or NEW.etat not in ('en_attente', 'accepte', 'refuse') or OLD.etat = 'facture') then
    raise exception 'État impossible pour ce document.';
  end if;
  if OLD.fne_reference is not null and NEW.fne_reference is distinct from OLD.fne_reference then raise exception 'Le numéro FNE est déjà enregistré.'; end if;
  if NEW.fne_reference is not null and OLD.fne_reference is null and not (OLD.fiscal and OLD.type in ('facture', 'avoir')) then
    raise exception 'Le numéro FNE ne concerne que les vraies factures et avoirs.';
  end if;
  if OLD.annule and not NEW.annule then raise exception 'Un document annulé le reste.'; end if;
  if NEW.annule and not OLD.annule and OLD.type in ('facture', 'avoir') then
    raise exception 'Une facture ou un avoir ne s''annule pas : faites un avoir.';
  end if;
  return NEW;
end;
$$;
drop trigger if exists compta_documents_garde_fous on compta_documents;
create trigger compta_documents_garde_fous before insert or update on compta_documents for each row execute function compta_documents_garde_fous();

-- Nouveau document : numéro suivant de sa série, totaux calculés ici (jamais par l'écran).
-- p : { type, tiers_id, date_doc, validite, lignes, notes, categorie, echeance, origine_id, ecriture_id }
create or replace function compta_document_creer(p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  r compta_reglages;
  t compta_tiers;
  o compta_documents;
  e compta_ecritures;
  doc compta_documents;
  typ text := p ->> 'type';
  le_jour date := coalesce((p ->> 'date_doc')::date, current_date);
  l jsonb;
  lignes jsonb := '[]'::jsonb;
  ht bigint := 0;
  q numeric;
  prix bigint;
  fisc boolean;
  taux numeric := 0;
  num int;
  dette uuid;
begin
  if not portail_peut('compta') then raise exception 'Accès refusé.'; end if;
  if typ not in ('devis', 'proforma', 'facture', 'avoir', 'recu') then raise exception 'Type de document inconnu.'; end if;
  select * into r from compta_reglages where id = 1;
  select * into t from compta_tiers where id = (p ->> 'tiers_id')::uuid;
  if not found then raise exception 'Choisissez le client.'; end if;
  if jsonb_typeof(p -> 'lignes') <> 'array' or jsonb_array_length(p -> 'lignes') not between 1 and 50 then raise exception 'Une à cinquante lignes.'; end if;
  for l in select * from jsonb_array_elements(p -> 'lignes') loop
    q := (l ->> 'quantite')::numeric;
    prix := (l ->> 'prix')::bigint;
    if coalesce(trim(l ->> 'designation'), '') = '' or q is null or q <= 0 or q > 100000 or prix is null or prix < 0 or prix > 1000000000 then
      raise exception 'Ligne incomplète : désignation, quantité et prix.';
    end if;
    lignes := lignes || jsonb_build_array(jsonb_build_object('designation', left(trim(l ->> 'designation'), 300), 'quantite', q, 'prix', prix));
    ht := ht + round(q * prix);
  end loop;
  fisc := r.mode_legal;
  if fisc and typ <> 'recu' then taux := r.tva_taux; end if;
  if typ = 'avoir' then
    select * into o from compta_documents where id = (p ->> 'origine_id')::uuid and type = 'facture' and not annule for update;
    if not found then raise exception 'Un avoir corrige une facture : choisissez-la.'; end if;
    if o.tiers_id <> t.id then raise exception 'L''avoir va au client de la facture.'; end if;
    fisc := o.fiscal; taux := o.tva_taux;   -- même série et même TVA que la facture corrigée
    if ht + round(ht * taux / 100) > compta_dette_reste(o.dette_id) then raise exception 'L''avoir dépasse ce qui reste dû sur la facture.'; end if;
  elsif p ->> 'origine_id' is not null then
    select * into o from compta_documents where id = (p ->> 'origine_id')::uuid and not annule for update;
    if not found or not ((typ = 'facture' and o.type in ('devis', 'proforma') and o.etat <> 'facture') or (typ = 'recu' and o.type = 'facture')) then
      raise exception 'Document d''origine impossible.';
    end if;
  end if;
  if typ = 'recu' and p ->> 'ecriture_id' is not null then
    select * into e from compta_ecritures where id = (p ->> 'ecriture_id')::uuid and sens = 'recette' and source = 'manuel' and not annule;
    if not found then raise exception 'Recette introuvable.'; end if;
    if e.montant <> ht then raise exception 'Le reçu doit être du montant de la recette.'; end if;
  end if;
  insert into compta_numeros (type, annee, fiscal, dernier) values (typ, extract(year from le_jour)::int, fisc, 1)
  on conflict (type, annee, fiscal) do update set dernier = compta_numeros.dernier + 1
  returning dernier into num;
  -- (après la prise du compteur : la série est verrouillée le temps de la vérification)
  if le_jour > current_date then raise exception 'La date du document ne peut pas être dans le futur.'; end if;
  if exists (select 1 from compta_documents where type = typ and fiscal = fisc and annee = extract(year from le_jour)::int and date_doc > le_jour) then
    raise exception 'Date plus ancienne que le dernier document de cette série : les numéros suivent l''ordre des dates.';
  end if;
  if typ = 'facture' then
    insert into compta_dettes (sens, tiers_id, date_op, echeance, montant, categorie, libelle)
    values ('creance', t.id, le_jour, (p ->> 'echeance')::date, ht + round(ht * taux / 100), coalesce(p ->> 'categorie', 'prestation'),
            'Facture ' || case when fisc then '' else 'NF-' end || 'FAC-' || extract(year from le_jour) || '-' || lpad(num::text, 4, '0'))
    returning id into dette;
  end if;
  perform set_config('ma2m.document', '1', true);
  insert into compta_documents (type, numero, annee, rang, fiscal, date_doc, validite, tiers_id, destinataire, lignes, total_ht, tva_taux, tva, total_ttc,
                                categorie, notes, origine_id, dette_id, ecriture_id, etat, cree_par)
  values (typ, case when fisc then '' else 'NF-' end || upper(case typ when 'devis' then 'DEV' when 'proforma' then 'PRO' when 'facture' then 'FAC' when 'avoir' then 'AV' else 'REC' end)
               || '-' || extract(year from le_jour) || '-' || lpad(num::text, 4, '0'),
          extract(year from le_jour)::int, num, fisc, le_jour, (p ->> 'validite')::date, t.id,
          jsonb_build_object('nom', t.nom, 'telephone', t.telephone, 'email', t.email), lignes, ht, taux, round(ht * taux / 100), ht + round(ht * taux / 100),
          case when typ = 'facture' then coalesce(p ->> 'categorie', 'prestation') end, nullif(trim(p ->> 'notes'), ''), o.id, dette, e.id,
          case when typ in ('devis', 'proforma') then 'en_attente' else 'emis' end, auth.uid())
  returning * into doc;
  if typ = 'facture' and o.id is not null then update compta_documents set etat = 'facture' where id = o.id; end if;
  perform set_config('ma2m.document', '', true);
  return json_build_object('id', doc.id, 'numero', doc.numero);
end;
$$;
revoke all on function compta_document_creer(jsonb) from public, anon;
grant execute on function compta_document_creer(jsonb) to authenticated;

-- Impôts et taxes : échéancier (patente, impôt synthétique, CNPS, TVA…) et paiement = dépense
-- « Impôts et taxes » liée. Avant paiement, échéance et montant prévu se corrigent ; après, plus rien.
create table if not exists compta_impots (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (trim(nom) <> ''),
  periode text,
  echeance date not null,
  montant int not null check (montant >= 0),
  ecriture_id uuid unique references compta_ecritures(id),
  annule boolean not null default false,
  motif_annulation text,
  cree_par uuid references auth.users(id),
  cree_le timestamptz not null default now(),
  check (not annule or coalesce(trim(motif_annulation), '') <> '')
);
create or replace function compta_impots_garde_fous()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  paye boolean;
begin
  if est_ecriture_serveur() then return NEW; end if;
  if TG_OP = 'INSERT' then NEW.cree_par := auth.uid(); NEW.ecriture_id := null; NEW.annule := false; return NEW; end if;
  paye := OLD.ecriture_id is not null and exists (select 1 from compta_ecritures where id = OLD.ecriture_id and not annule);
  if NEW.nom <> OLD.nom or NEW.periode is distinct from OLD.periode or NEW.cree_par is distinct from OLD.cree_par then raise exception 'Supprimez par une annulation, puis recréez.'; end if;
  if paye and (NEW.echeance <> OLD.echeance or NEW.montant <> OLD.montant or NEW.ecriture_id is distinct from OLD.ecriture_id or NEW.annule) then
    raise exception 'Impôt déjà payé : il ne se modifie plus.';
  end if;
  if NEW.ecriture_id is distinct from OLD.ecriture_id and coalesce(current_setting('ma2m.impot', true), '') <> '1' then
    raise exception 'Un impôt se paie par « Payer ».';
  end if;
  if OLD.annule and not NEW.annule then raise exception 'Une ligne annulée le reste.'; end if;
  return NEW;
end;
$$;
drop trigger if exists compta_impots_garde_fous on compta_impots;
create trigger compta_impots_garde_fous before insert or update on compta_impots for each row execute function compta_impots_garde_fous();
create or replace function compta_impot_payer(p_id uuid, p_compte uuid, p_date date, p_montant int, p_justificatif text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  i compta_impots;
  e uuid;
begin
  select * into i from compta_impots where id = p_id and not annule for update;
  if not found then raise exception 'Impôt introuvable.'; end if;
  insert into compta_ecritures (sens, date_op, montant, compte_id, categorie, libelle, justificatif)
  values ('depense', p_date, p_montant, p_compte, 'impots', i.nom || coalesce(' · ' || i.periode, ''), p_justificatif)
  returning id into e;
  perform set_config('ma2m.impot', '1', true);
  update compta_impots set ecriture_id = e where id = p_id;
  perform set_config('ma2m.impot', '', true);
  return e;
end;
$$;
revoke all on function compta_impot_payer(uuid, uuid, date, int, text) from public, anon;
grant execute on function compta_impot_payer(uuid, uuid, date, int, text) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['compta_reglages', 'compta_documents', 'compta_impots', 'compta_numeros']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
    execute format('revoke insert, delete, truncate on %I from authenticated', t);
    execute format('drop policy if exists %s_acces on %I', t, t);
    execute format('create policy %s_acces on %I for all using (portail_peut(''compta'')) with check (portail_peut(''compta''))', t, t);
    execute format('drop trigger if exists audit_%s on %I', t, t);
    execute format('create trigger audit_%s after insert or update or delete on %I for each row execute function audit_ecriture()', t, t);
  end loop;
end $$;
-- documents : créés par compta_document_creer seulement ; numéros : jamais touchés à la main
grant select, update on compta_reglages, compta_documents to authenticated;
grant select, insert, update on compta_impots to authenticated;
revoke all on compta_numeros from authenticated;

NOTIFY pgrst, 'reload schema';
select 'Administration — étape 1, espaces 1 et 2, comptabilité complète (journaux, suivi, documents, impôts, mode légal) en place' as resultat;
