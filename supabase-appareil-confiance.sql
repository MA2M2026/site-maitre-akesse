-- =====================================================================================
-- Extension 149 — Appareil de confiance pour l'Administration (chantier 6, PLAN-APPAREIL-CONFIANCE.md ;
-- lot 4 décidé par la propriétaire, 01/11/2026)
-- =====================================================================================
-- Après une connexion complète (mot de passe + code de l'application d'authentification) sur un appareil
-- qui a son code à 4 chiffres, l'appareil est « de confiance » 30 jours : la session de l'Administration
-- n'est plus coupée au bout de 8 heures. Verrous, tous contrôlés par la base (pas seulement par l'écran) :
--   - 15 minutes sans activité : code à 4 chiffres (comme avant) ;
--   - 1 h 30 sans activité, ou « Se déconnecter » : mot de passe vérifié par le serveur APRÈS ce moment,
--     puis code à 4 chiffres (sans le code de l'application) ;
--   - 30 jours, « Oublier cet appareil », appareil révoqué, accès coupé : connexion complète.
-- Un appareil sans code à 4 chiffres n'est jamais de confiance (comportement d'avant : 8 heures).
-- Remplace (sans rien effacer) : portail_appareil_ok, portail_enregistrer_appareil, portail_code_appareil_etat,
-- portail_code_appareil_verifier (supabase-administration.sql). Jamais supabase-setup.sql.
-- À coller en entier dans Supabase › SQL Editor › Run. Aucune donnée existante modifiée ; rejouable.

alter table staff_devices add column if not exists confiance_jusqua timestamptz;   -- fin de la confiance (30 jours)
alter table staff_devices add column if not exists mdp_verifie_le timestamptz;     -- dernier mot de passe vérifié (verrou fort)
alter table staff_devices add column if not exists deconnecte_le timestamptz;      -- « Se déconnecter » sur un appareil de confiance

-- Ces trois colonnes ne changent QUE par les fonctions ci-dessous (personne, même l'administrateur
-- principal, ne prolonge une confiance à la main)
create or replace function staff_devices_confiance_garde()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('ma2m.confiance', true), '') = '1' then return NEW; end if;
  if NEW.confiance_jusqua is distinct from OLD.confiance_jusqua or NEW.mdp_verifie_le is distinct from OLD.mdp_verifie_le
     or NEW.deconnecte_le is distinct from OLD.deconnecte_le then
    raise exception 'La confiance d''un appareil ne se change pas à la main.';
  end if;
  return NEW;
end;
$$;
drop trigger if exists staff_devices_confiance_garde on staff_devices;
create trigger staff_devices_confiance_garde before update on staff_devices for each row execute function staff_devices_confiance_garde();
revoke all on function staff_devices_confiance_garde() from public, anon, authenticated;

-- Appareil de confiance : confiance pas expirée, appareil pas révoqué, code à 4 chiffres en place
create or replace function portail_appareil_de_confiance(p_user uuid, p_appareil text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_devices d join staff_codes_appareil c on c.user_id = d.user_id and c.appareil = d.appareil
    where d.user_id = p_user and d.appareil = p_appareil and not d.revoque and d.confiance_jusqua > now() and c.code_hash is not null);
$$;

-- Session encore valable : code de l'application il y a moins de 8 heures, ou moins de 30 jours sur un
-- appareil de confiance
create or replace function portail_session_valable(p_appareil text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(portail_dernier_code(), 0) >= extract(epoch from now()) - 8 * 3600
      or (coalesce(portail_dernier_code(), 0) >= extract(epoch from now()) - 30 * 86400 and portail_appareil_de_confiance(auth.uid(), p_appareil));
$$;

-- Verrou fort d'un appareil de confiance : depuis quand le mot de passe est exigé (null : pas exigé).
-- Moment = « Se déconnecter », ou 1 h 30 après le dernier signe de vie. Levé par un mot de passe vérifié
-- par le serveur APRÈS ce moment, ou par une connexion complète (code de l'application) après ce moment.
create or replace function portail_verrou_fort(p_appareil text)
returns timestamptz language sql stable security definer set search_path = public as $$
  select x.depuis from (
    select greatest(d.deconnecte_le, case when c.derniere_activite + interval '90 minutes' <= now() then c.derniere_activite + interval '90 minutes' end) as depuis,
           d.mdp_verifie_le
    from staff_devices d join staff_codes_appareil c on c.user_id = d.user_id and c.appareil = d.appareil
    where d.user_id = auth.uid() and d.appareil = p_appareil and portail_appareil_de_confiance(d.user_id, d.appareil)) x
  where x.depuis is not null and x.depuis <= now()
    and (x.mdp_verifie_le is null or x.mdp_verifie_le < x.depuis)
    and coalesce(portail_dernier_code(), 0) < extract(epoch from x.depuis);
$$;
revoke execute on function portail_appareil_de_confiance(uuid, text), portail_session_valable(text), portail_verrou_fort(text) from public, anon, authenticated;

-- Appareil révoqué, session trop ancienne, écran verrouillé : refusé (l'application envoie l'identifiant
-- de l'appareil dans l'en-tête « x-appareil »)
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
  -- sans identifiant d'appareil, pas d'accès (ne pas l'envoyer contournait une révocation)
  if app = '' then
    return false;
  end if;
  if exists (select 1 from staff_profiles where user_id = auth.uid() and sessions_valides_apres is not null
             and coalesce(portail_dernier_code(), 0) < extract(epoch from sessions_valides_apres)) then
    return false;
  end if;
  -- 8 heures après le dernier code de l'application, ou 30 jours sur un appareil de confiance
  if not portail_session_valable(app) then
    return false;
  end if;
  -- appareil de confiance resté 1 h 30 sans activité, ou « déconnecté » : mot de passe exigé
  if portail_verrou_fort(app) is not null then
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

-- L'application déclare l'appareil où elle est installée. Juste après une connexion complète (code de
-- l'application saisi il y a moins de 10 minutes) : l'appareil devient de confiance pour 30 jours.
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
  if portail_role() is not null and coalesce(portail_dernier_code(), 0) >= extract(epoch from now()) - 600 then
    perform set_config('ma2m.confiance', '1', true);
    update staff_devices set confiance_jusqua = now() + interval '30 days', deconnecte_le = null
    where user_id = auth.uid() and appareil = left(p_appareil, 64) and not revoque;
    perform set_config('ma2m.confiance', '', true);
  end if;
  -- connexion complète : droits de l'ancien tableau de bord rendus au principal et au rôle « site »
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

-- État de l'écran : code à 4 chiffres, verrouillage, confiance, mot de passe exigé
create or replace function portail_code_appareil_etat(p_appareil text)
returns json language plpgsql security definer set search_path = public as $$
declare
  c staff_codes_appareil;
  verrou bigint;
  conf boolean;
  fort timestamptz;
begin
  if auth.uid() is null or not portail_mfa_ok() then
    raise exception 'Accès refusé';
  end if;
  conf := portail_appareil_de_confiance(auth.uid(), p_appareil);
  select * into c from staff_codes_appareil where user_id = auth.uid() and appareil = p_appareil;
  if not found then
    return json_build_object('defini', false, 'verrouille', false, 'confiance', false, 'session', portail_session_valable(p_appareil));
  end if;
  fort := portail_verrou_fort(p_appareil);
  verrou := portail_verrou_depuis(auth.uid(), p_appareil);
  -- un code de l'application d'authentification saisi après le verrouillage déverrouille
  if fort is null and (coalesce(portail_dernier_code(), 0) >= verrou or verrou > floor(extract(epoch from now()))) then
    update staff_codes_appareil set verrouille = false, verrouille_le = null, essais = 0, derniere_activite = now()
    where user_id = auth.uid() and appareil = p_appareil;
    return json_build_object('defini', c.code_hash is not null, 'verrouille', false, 'confiance', conf, 'session', portail_session_valable(p_appareil),
      'confiance_jusqua', (select confiance_jusqua from staff_devices where user_id = auth.uid() and appareil = p_appareil));
  end if;
  return json_build_object('defini', c.code_hash is not null, 'verrouille', true, 'bloque', c.code_hash is null, 'confiance', conf,
    'mot_de_passe', fort is not null, 'session', portail_session_valable(p_appareil));
end;
$$;

-- Déverrouiller avec le code : 5 erreurs → code bloqué, connexion complète obligatoire ; verrou fort :
-- le mot de passe d'abord (sans compter d'erreur de code)
create or replace function portail_code_appareil_verifier(p_appareil text, p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  c staff_codes_appareil;
begin
  if auth.uid() is null or not portail_mfa_ok()
     or not exists (select 1 from staff_profiles where user_id = auth.uid() and actif)
     or exists (select 1 from staff_devices where user_id = auth.uid() and appareil = p_appareil and revoque)
     or not portail_session_valable(p_appareil) then
    return json_build_object('ok', false, 'bloque', true);
  end if;
  if portail_verrou_fort(p_appareil) is not null then
    return json_build_object('ok', false, 'mot_de_passe', true);
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

-- « Se déconnecter » : sur un appareil de confiance, verrou fort (mot de passe + code à 4 chiffres pour
-- revenir) ; renvoie vrai dans ce cas. Sinon faux : l'application ferme complètement la session.
create or replace function portail_appareil_deconnecter(p_appareil text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not portail_appareil_de_confiance(auth.uid(), p_appareil) then return false; end if;
  perform set_config('ma2m.confiance', '1', true);
  update staff_devices set deconnecte_le = now() where user_id = auth.uid() and appareil = p_appareil;
  perform set_config('ma2m.confiance', '', true);
  update staff_codes_appareil set verrouille = true, verrouille_le = now() where user_id = auth.uid() and appareil = p_appareil;
  return true;
end;
$$;

-- « Oublier cet appareil » : plus de confiance (l'application ferme ensuite complètement la session)
create or replace function portail_appareil_oublier(p_appareil text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  perform set_config('ma2m.confiance', '1', true);
  update staff_devices set confiance_jusqua = null, deconnecte_le = null where user_id = auth.uid() and appareil = p_appareil;
  perform set_config('ma2m.confiance', '', true);
end;
$$;

-- Le serveur du site (api/connexion-protegee.js, après un mot de passe juste) note le mot de passe vérifié
-- pour cet appareil de confiance
create or replace function portail_mot_de_passe_verifie(p_user uuid, p_appareil text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not est_ecriture_serveur() then raise exception 'Accès refusé.'; end if;
  perform set_config('ma2m.confiance', '1', true);
  update staff_devices set mdp_verifie_le = now() where user_id = p_user and appareil = p_appareil and not revoque and confiance_jusqua > now();
  get diagnostics n = row_count;
  perform set_config('ma2m.confiance', '', true);
  return n > 0;
end;
$$;

-- Révocation d'un appareil : sa confiance tombe aussi
create or replace function staff_appareil_revoque()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update staff_profiles set sessions_valides_apres = now() where user_id = NEW.user_id;
  perform set_config('ma2m.confiance', '1', true);
  update staff_devices set confiance_jusqua = null where id = NEW.id;
  perform set_config('ma2m.confiance', '', true);
  -- l'ancien tableau de bord (règles fondées sur la table admins) se ferme aussi ; les droits
  -- reviennent à la prochaine connexion complète au portail (portail_enregistrer_appareil)
  delete from admins where user_id = NEW.user_id;
  return NEW;
end;
$$;

-- Clé des pièces réservées (api/acces-tableau.js) : la session de l'Administration est-elle valable ?
create or replace function portail_session_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select portail_role() is not null;
$$;

revoke execute on function portail_appareil_deconnecter(text), portail_appareil_oublier(text), portail_session_ok(), portail_mot_de_passe_verifie(uuid, text) from public, anon;
grant execute on function portail_appareil_deconnecter(text), portail_appareil_oublier(text), portail_session_ok() to authenticated;
revoke execute on function portail_mot_de_passe_verifie(uuid, text) from authenticated;
grant execute on function portail_mot_de_passe_verifie(uuid, text) to service_role;

NOTIFY pgrst, 'reload schema';
