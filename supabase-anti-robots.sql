-- =====================================================================================
-- Extension 152 — Anti-robots des formulaires publics (01/11/2026, décision de la propriétaire ; clé Cloudflare
-- Turnstile créée par elle, la clé secrète est dans Vercel, TURNSTILE_SECRET_KEY).
-- =====================================================================================
-- Candidature (casting_applications), Contact (messages_contact) et Demande d'un recruteur (recruiter_requests)
-- ne s'écrivent plus directement depuis le navigateur : le serveur du site (api/portail.js, action « formulaire »)
-- vérifie d'abord que ce n'est pas un robot (Cloudflare Turnstile), puis enregistre par formulaire_public_enregistrer,
-- avec EXACTEMENT les mêmes limites qu'avant (nombre d'envois par minute, par adresse, casting ouvert, statut).
-- La liste des mannequins d'une demande (recruiter_request_models) n'est acceptée que pour une demande toute
-- récente. Rien n'est effacé ni modifié dans les données. À coller dans Supabase › SQL Editor › Run ; rejouable.
-- Retour en arrière : supabase-anti-robots-retour.sql (remet les anciennes règles).

-- 1. Limite par adresse, l'adresse étant donnée (le serveur la transmet ; avant, lue dans l'en-tête de la demande)
create or replace function limiter_soumissions_publiques_ip_de(p_formulaire text, p_max_par_minute int, p_max_par_ip int, p_ip text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  nb_recentes int;
  nb_recentes_ip int;
  ip_visiteur text := nullif(trim(p_ip), '');
begin
  delete from soumissions_formulaires_publics where cree_le < now() - interval '10 minutes';
  select count(*) into nb_recentes from soumissions_formulaires_publics
    where formulaire = p_formulaire and cree_le > now() - interval '1 minute';
  if nb_recentes >= p_max_par_minute then return false; end if;
  if ip_visiteur is not null then
    delete from soumissions_formulaires_publics_ip where cree_le < now() - interval '10 minutes';
    select count(*) into nb_recentes_ip from soumissions_formulaires_publics_ip
      where formulaire = p_formulaire and ip = ip_visiteur and cree_le > now() - interval '1 minute';
    if nb_recentes_ip >= p_max_par_ip then return false; end if;
    insert into soumissions_formulaires_publics_ip (formulaire, ip) values (p_formulaire, ip_visiteur);
  end if;
  insert into soumissions_formulaires_publics (formulaire) values (p_formulaire);
  return true;
end;
$$;
revoke all on function limiter_soumissions_publiques_ip_de(text, int, int, text) from public, anon, authenticated;

-- 2. Enregistrement d'un formulaire public : SEULEMENT par le serveur du site (clé service_role), après l'anti-robots.
--    Seules les colonnes envoyées sont écrites (les autres gardent leur valeur par défaut). Renvoie l'identifiant.
create or replace function formulaire_public_enregistrer(p_table text, p_ligne jsonb, p_ip text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  colonnes text;
  nouvel_id uuid;
begin
  if p_table not in ('casting_applications', 'messages_contact', 'recruiter_requests') then raise exception 'Formulaire inconnu.'; end if;
  if jsonb_typeof(p_ligne) <> 'object' then raise exception 'Formulaire invalide.'; end if;
  -- (les mêmes règles qu'avant pour les visiteurs ; LIMITE_ATTEINTE : le navigateur réessaie tout seul)
  if p_table = 'casting_applications' then
    if coalesce(p_ligne->>'status', 'nouvelle') <> 'nouvelle' then raise exception 'Formulaire invalide.'; end if;
    if p_ligne->>'type_candidature' = 'projet' and not casting_ouvert() then raise exception 'Aucun casting ouvert.'; end if;
    if not limiter_soumissions_publiques_ip_de('candidature', 60, 6, p_ip) then raise exception 'LIMITE_ATTEINTE'; end if;
  elsif p_table = 'recruiter_requests' then
    if coalesce(p_ligne->>'status', 'nouvelle') <> 'nouvelle' then raise exception 'Formulaire invalide.'; end if;
    if not limiter_soumissions_publiques_ip_de('recruteur', 30, 3, p_ip) then raise exception 'LIMITE_ATTEINTE'; end if;
  else
    if not limiter_soumissions_publiques_ip_de('contact', 30, 3, p_ip) then raise exception 'LIMITE_ATTEINTE'; end if;
  end if;
  select string_agg(quote_ident(c.column_name), ', ') into colonnes
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = p_table and p_ligne ? c.column_name;
  if colonnes is null then raise exception 'Formulaire vide.'; end if;
  execute format('insert into %I (%s) select %s from jsonb_populate_record(null::%I, $1) returning id', p_table, colonnes, colonnes, p_table)
    into nouvel_id using p_ligne;
  return nouvel_id;
end;
$$;
revoke all on function formulaire_public_enregistrer(text, jsonb, text) from public, anon, authenticated;
grant execute on function formulaire_public_enregistrer(text, jsonb, text) to service_role;

-- 3. Plus d'écriture directe par les visiteurs dans ces trois tables (l'équipe garde ses propres droits)
drop policy if exists "Tout le monde peut candidater" on casting_applications;
drop policy if exists "Tout le monde peut envoyer une demande de casting" on recruiter_requests;
drop policy if exists "Tout le monde peut envoyer un message de contact" on messages_contact;

-- 4. Liste des mannequins d'une demande de recruteur : seulement pour une demande de moins de 15 minutes,
--    60 mannequins au plus (avant : n'importe qui pouvait en ajouter, sans limite)
create or replace function demande_recruteur_recente(p_request uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from recruiter_requests r where r.id = p_request and r.created_at > now() - interval '15 minutes')
    and (select count(*) from recruiter_request_models m where m.request_id = p_request) < 60;
$$;
revoke all on function demande_recruteur_recente(uuid) from public;
grant execute on function demande_recruteur_recente(uuid) to anon, authenticated;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'recruiter_request_models' and cmd = 'INSERT' loop
    execute format('drop policy %I on recruiter_request_models', p.policyname);
  end loop;
end $$;
create policy "Mannequins d'une demande toute récente" on recruiter_request_models for insert
  with check (demande_recruteur_recente(request_id));

NOTIFY pgrst, 'reload schema';

select 'Anti-robots installé : ' ||
  ((select count(*) from pg_proc where proname in ('formulaire_public_enregistrer', 'limiter_soumissions_publiques_ip_de', 'demande_recruteur_recente'))
   + (select count(*) from pg_policies where tablename = 'recruiter_request_models' and policyname = 'Mannequins d''une demande toute récente')) || ' éléments sur 4' as controle;
