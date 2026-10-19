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
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'Accès refusé';
  end if;
  select * into c from casting_applications where id = p_candidature for update;
  if not found then
    raise exception 'Candidature introuvable.';
  end if;
  if c.status <> 'retenue' then
    raise exception 'Le code n''est créé que pour une personne retenue.';
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
  if not exists (select 1 from admins where user_id = auth.uid()) then
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
    if TG_OP = 'UPDATE' and OLD.statut = 'valide' then
      if not portail_est_principal() then raise exception 'Un paiement validé ne se modifie plus.'; end if;
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

NOTIFY pgrst, 'reload schema';
select 'Administration — étape 1, espace 1 et registre en place' as resultat;
