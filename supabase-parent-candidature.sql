-- =====================================================================================================
-- Candidatures de mineurs : le parent confirme lui-même (24/11/2026, décision de la propriétaire)
-- =====================================================================================================
-- Constat du 23/11/2026 : une candidate mineure a écrit son propre nom, son propre numéro et son propre e-mail à la
-- place de ceux de son parent.
-- 1. Refus à l enregistrement (en plus de la page et du serveur du site) : pour une personne mineure, le WhatsApp du
--    parent, son e-mail ou son nom complet ne peuvent pas être ceux de la candidate (le nom de famille seul, si).
-- 2. Confirmation par le parent : chaque candidature de mineur reçoit un lien personnel (jeton). L agence l envoie au
--    parent par WhatsApp ou par e-mail depuis la fiche. Le parent confirme (avec son nom) ou refuse. Tant qu il n a
--    pas répondu, la fiche affiche « Parent non confirmé ». La réponse est DÉFINITIVE : ni le parent (ni un enfant qui
--    aurait vu le lien), ni l équipe ne peuvent la changer ensuite. Pour revenir dessus, la famille contacte l agence.
--    Le parent écrit son prénom et son nom, qui ne peuvent pas être une partie du nom de l enfant (ajout du 24/11/2026).
-- A COLLER UNE FOIS dans Supabase (SQL Editor, bouton orange Run without RLS), AVANT la mise en ligne.
-- Peut être recollé sans risque.

alter table public.casting_applications add column if not exists parent_jeton uuid;
alter table public.casting_applications add column if not exists parent_confirme_le timestamptz;
alter table public.casting_applications add column if not exists parent_refuse_le timestamptz;
alter table public.casting_applications add column if not exists parent_confirme_nom text;
create unique index if not exists casting_applications_parent_jeton on public.casting_applications (parent_jeton);

-- nom comparable : sans civilité, sans accents, sans ponctuation, mots rangés (Amon Emira = Emira Amon)
create or replace function nom_comparable(p text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select coalesce(string_agg(m, ' ' order by m), '')
  from regexp_split_to_table(
    regexp_replace(
      regexp_replace(
        translate(lower(coalesce(p, '')), 'àâäáãéèêëíìîïóòôöõúùûüçñÿ', 'aaaaaeeeeiiiiooooouuuucny'),
        '^\s*(madame|mademoiselle|monsieur|mme|mlle|mr|m)\.?\s+', ''),
      '[^a-z ]', ' ', 'g'),
    '\s+') m
  where m <> '';
$$;
-- numéro comparable : les 8 derniers chiffres (avec ou sans indicatif, avec ou sans le 0 de tête)
create or replace function numero_comparable(p text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 8);
$$;
revoke all on function nom_comparable(text), numero_comparable(text) from public, anon, authenticated;

create or replace function candidature_parent_verifier()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.mineur, false) then
      if length(numero_comparable(new.parent_telephone)) >= 6 and numero_comparable(new.parent_telephone) = numero_comparable(new.phone) then
        raise exception 'PARENT_IDENTIQUE : le WhatsApp du parent est celui de la candidate';
      end if;
      if nullif(lower(trim(new.parent_email)), '') = lower(trim(new.email)) then
        raise exception 'PARENT_IDENTIQUE : l e-mail du parent est celui de la candidate';
      end if;
      if nom_comparable(new.parent_nom) <> '' and nom_comparable(new.parent_nom) = nom_comparable(new.full_name) then
        raise exception 'PARENT_IDENTIQUE : le nom du parent est celui de la candidate';
      end if;
      new.parent_jeton := gen_random_uuid();
    else
      new.parent_jeton := null;
    end if;
    new.parent_confirme_le := null; new.parent_refuse_le := null; new.parent_confirme_nom := null;
    return new;
  end if;
  -- (modification) la réponse du parent ne change que par sa page (candidature_parent_repondre) ;
  -- le lien ne se crée que par candidature_parent_lien
  if coalesce(current_setting('ma2m.parent_reponse', true), '') <> '1' then
    new.parent_confirme_le := old.parent_confirme_le; new.parent_refuse_le := old.parent_refuse_le;
    new.parent_confirme_nom := old.parent_confirme_nom; new.parent_jeton := old.parent_jeton;
  end if;
  return new;
end;
$$;
revoke all on function candidature_parent_verifier() from public, anon, authenticated;
drop trigger if exists casting_applications_parent on public.casting_applications;
create trigger casting_applications_parent before insert or update on public.casting_applications
  for each row execute function candidature_parent_verifier();

-- Agence : le lien du parent d une candidature de mineur (créé s il manque, pour les candidatures plus anciennes)
create or replace function candidature_parent_lien(p_id uuid)
returns uuid language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare j uuid; m boolean;
begin
  -- (relecture : même règle que les autres fonctions de l Administration, double vérification comprise)
  if not exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()) then raise exception 'Accès refusé'; end if;
  select parent_jeton, coalesce(mineur, false) or (date_naissance is not null and age(current_date, date_naissance) < interval '18 years')
    into j, m from casting_applications where id = p_id;
  if not found then raise exception 'Candidature introuvable.'; end if;
  if not m then raise exception 'Cette candidature n est pas celle d une personne mineure.'; end if;
  if j is null then
    perform set_config('ma2m.parent_reponse', '1', true);
    update casting_applications set parent_jeton = gen_random_uuid() where id = p_id returning parent_jeton into j;
    perform set_config('ma2m.parent_reponse', '', true);
  end if;
  return j;
end;
$$;

-- Le parent, avec son lien : lire (premier mot du nom seulement, minimisation), confirmer ou refuser une seule fois
create or replace function candidature_parent_lire(p_jeton uuid)
returns json language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select json_build_object('candidate', split_part(trim(c.full_name), ' ', 1), 'parent_nom', c.parent_confirme_nom,
    'etat', case when c.parent_refuse_le is not null then 'refuse' when c.parent_confirme_le is not null then 'confirme' else 'en_attente' end)
  from casting_applications c where c.parent_jeton = p_jeton;
$$;
create or replace function candidature_parent_repondre(p_jeton uuid, p_accepte boolean, p_parent_nom text)
returns text language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare c casting_applications;
begin
  select * into c from casting_applications where parent_jeton = p_jeton for update;
  if not found then raise exception 'Lien inconnu ou expiré.'; end if;
  if c.parent_confirme_le is not null or c.parent_refuse_le is not null then raise exception 'REPONSE_DEJA_DONNEE'; end if;
  -- (24/11/2026, essai réel) prénom ET nom du parent, et pas une partie du nom de l enfant (ex. 2 de ses 3 prénoms)
  if length(trim(coalesce(p_parent_nom, ''))) < 3 or coalesce(array_length(string_to_array(nom_comparable(p_parent_nom), ' '), 1), 0) < 2 then
    raise exception 'Écrivez votre nom complet (prénom et nom).';
  end if;
  if string_to_array(nom_comparable(p_parent_nom), ' ') <@ string_to_array(nom_comparable(c.full_name), ' ') then
    raise exception 'Écrivez le nom du parent, pas celui de la candidate.';
  end if;
  perform set_config('ma2m.parent_reponse', '1', true);
  if p_accepte then
    update casting_applications set parent_confirme_le = now(), parent_refuse_le = null, parent_confirme_nom = left(trim(p_parent_nom), 120) where id = c.id;
  else
    update casting_applications set parent_refuse_le = now(), parent_confirme_le = null, parent_confirme_nom = left(trim(p_parent_nom), 120) where id = c.id;
  end if;
  perform set_config('ma2m.parent_reponse', '', true);
  perform journaliser(case when p_accepte then 'Candidature confirmée par le parent' else 'Candidature refusée par le parent' end,
    'casting_applications', c.id::text, null, json_build_object('parent', left(trim(p_parent_nom), 120))::jsonb);
  return case when p_accepte then 'confirme' else 'refuse' end;
end;
$$;

revoke execute on function candidature_parent_lien(uuid) from public, anon;
grant execute on function candidature_parent_lien(uuid) to authenticated;
revoke execute on function candidature_parent_lire(uuid), candidature_parent_repondre(uuid, boolean, text) from public;
grant execute on function candidature_parent_lire(uuid), candidature_parent_repondre(uuid, boolean, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Contrôle
select case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'casting_applications'
                    and column_name in ('parent_jeton', 'parent_confirme_le', 'parent_refuse_le', 'parent_confirme_nom')) = 4
                 and exists (select 1 from pg_trigger where tgname = 'casting_applications_parent')
                 and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
                      and p.proname in ('candidature_parent_lien', 'candidature_parent_lire', 'candidature_parent_repondre')) = 3
  then '✅ Candidatures de mineurs : confirmation du parent installée'
  else '❌ Candidatures de mineurs : installation incomplète' end as controle;
