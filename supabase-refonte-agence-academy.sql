-- =====================================================================================================
-- Refonte Agence + MA2M Academy (25/11/2026, décisions de la propriétaire)
-- =====================================================================================================
-- 1. Porte choisie sur la page Intégrer l agence : nouvelle colonne casting_applications.porte
--    (reseau = Talent Network, academie = MA2M Academy, equipe = Agency Roster). Le formulaire écrit
--    toujours la porte en première ligne du message (Parcours choisi : ...), et un déclencheur la recopie
--    dans la colonne. Les anciennes candidatures sont reprises de la même façon.
-- 2. Relations de chaque personne du registre avec MA2M : table relations_ma2m
--    (talent_network, agency_roster, formation_initiale, recyclage), avec début, fin et statut.
--    Les mannequins actuelles sont rangées comme décidé le 25/11 : Agency Roster et, en même temps,
--    formation initiale. Actives restent actives, suspendues restent suspendues, sorties sont terminées.
-- 3. Fin de contrat : chaque nuit, une relation dont la date de fin est passée devient terminée.
--    Rien n est effacé. Le profil n est pas caché automatiquement tant que la page de l Administration
--    qui le montre n est pas en ligne (étape suivante, avec accord de la propriétaire).
-- A COLLER UNE FOIS dans Supabase (SQL Editor, bouton orange Run without RLS), APRÈS la mise en ligne
-- des pages. Peut être recollé sans risque.

-- ---------- 1. porte de candidature ----------
alter table public.casting_applications add column if not exists porte text;
alter table public.casting_applications drop constraint if exists casting_applications_porte_check;
alter table public.casting_applications add constraint casting_applications_porte_check
  check (porte is null or porte in ('reseau', 'academie', 'equipe'));

create or replace function porte_depuis_message(p text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case substring(coalesce(p, '') from '^Parcours choisi : ([^\n]+)')
    when 'Talent Network' then 'reseau'
    when 'MA2M Academy' then 'academie'
    when 'Agency Roster' then 'equipe'
  end;
$$;
revoke all on function porte_depuis_message(text) from public, anon, authenticated;

create or replace function candidature_porte_remplir()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.type_candidature = 'agence' and new.porte is null then
    new.porte := porte_depuis_message(new.message);
  end if;
  if new.type_candidature is distinct from 'agence' then new.porte := null; end if;
  return new;
end $$;
drop trigger if exists casting_applications_porte on public.casting_applications;
create trigger casting_applications_porte before insert or update of message, type_candidature, porte
  on public.casting_applications for each row execute function candidature_porte_remplir();

update public.casting_applications set porte = porte_depuis_message(message)
  where type_candidature = 'agence' and porte is null and porte_depuis_message(message) is not null;

-- ---------- 2. relations avec MA2M ----------
create table if not exists public.relations_ma2m (
  id uuid primary key default gen_random_uuid(),
  mannequin_id uuid not null references public.agence_mannequins(id) on delete cascade,
  sorte text not null check (sorte in ('talent_network', 'agency_roster', 'formation_initiale', 'recyclage')),
  statut text not null default 'active' check (statut in ('en_attente', 'active', 'suspendue', 'terminee', 'resiliee')),
  debut date,
  fin date,
  notes text,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  maj_le timestamptz not null default now()
);
create index if not exists relations_ma2m_mannequin on public.relations_ma2m (mannequin_id);
create unique index if not exists relations_ma2m_une_ouverte on public.relations_ma2m (mannequin_id, sorte)
  where statut in ('en_attente', 'active', 'suspendue');
alter table public.relations_ma2m enable row level security;
-- aucune politique : on ne passe que par les fonctions ci-dessous
revoke all on public.relations_ma2m from anon, authenticated;

-- durée de chaque sorte de contrat (décisions du 25/11/2026)
create or replace function relation_duree(p_sorte text)
returns interval language sql immutable set search_path = public, pg_temp as $$
  select case p_sorte
    when 'talent_network' then interval '2 years'
    when 'agency_roster' then interval '5 years'
    when 'formation_initiale' then interval '2 years'
    when 'recyclage' then interval '9 months'
  end;
$$;

-- lecture pour l Administration (admin avec double vérification)
create or replace function relations_liste(p_mannequin uuid default null)
returns setof public.relations_ma2m language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()) then raise exception 'Accès refusé'; end if;
  return query select * from relations_ma2m where p_mannequin is null or mannequin_id = p_mannequin order by debut desc nulls last, cree_le desc;
end $$;

-- ouvrir, changer ou terminer une relation (admin)
create or replace function relation_enregistrer(p_id uuid, p_mannequin uuid, p_sorte text, p_statut text, p_debut date, p_fin date, p_notes text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid;
begin
  if not exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()) then raise exception 'Accès refusé'; end if;
  if p_id is null then
    insert into relations_ma2m (mannequin_id, sorte, statut, debut, fin, notes)
    values (p_mannequin, p_sorte, coalesce(p_statut, 'active'), coalesce(p_debut, current_date),
            coalesce(p_fin, (coalesce(p_debut, current_date) + relation_duree(p_sorte))::date), nullif(trim(p_notes), ''))
    returning id into v;
  else
    update relations_ma2m set statut = coalesce(p_statut, statut), debut = coalesce(p_debut, debut), fin = coalesce(p_fin, fin),
      notes = coalesce(nullif(trim(p_notes), ''), notes), maj_le = now()
    where id = p_id returning id into v;
    if v is null then raise exception 'Relation introuvable'; end if;
  end if;
  return v;
end $$;

-- ce que la mannequin connectée peut savoir de ses propres relations (application, plus tard)
create or replace function mes_relations()
returns table (sorte text, statut text, debut date, fin date)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.sorte, r.statut, r.debut, r.fin from relations_ma2m r
  join agence_mannequins m on m.id = r.mannequin_id
  where m.user_id = auth.uid() and auth.uid() is not null
  order by r.debut desc nulls last;
$$;

revoke all on function relation_duree(text), relations_liste(uuid), relation_enregistrer(uuid, uuid, text, text, date, date, text), mes_relations() from public, anon;
grant execute on function relations_liste(uuid), relation_enregistrer(uuid, uuid, text, text, date, date, text), mes_relations() to authenticated;

-- rangement des mannequins actuelles : seulement celles inscrites AVANT le 26/11/2026 et sans relation
-- (une personne ajoutée plus tard n est jamais rangée automatiquement, même si le fichier est recollé)
insert into public.relations_ma2m (mannequin_id, sorte, statut, debut, fin, notes)
select m.id, s.sorte,
  case m.statut when 'actif' then 'active' when 'suspendu' then 'suspendue' else 'terminee' end,
  coalesce(m.date_entree, m.cree_le::date, current_date),
  (coalesce(m.date_entree, m.cree_le::date, current_date) + relation_duree(s.sorte))::date,
  'Rangée automatiquement le 25/11/2026 (décision de la direction : Agency Roster et formation initiale)'
from public.agence_mannequins m
cross join (values ('agency_roster'), ('formation_initiale')) s(sorte)
where m.cree_le < timestamptz '2026-11-26 00:00:00+00'
  and not exists (select 1 from public.relations_ma2m r where r.mannequin_id = m.id);

-- ---------- 3. fin de contrat ----------
create or replace function relations_terminer_echues()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  update relations_ma2m set statut = 'terminee', maj_le = now()
  where statut in ('active', 'suspendue') and fin is not null and fin < current_date;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function relations_terminer_echues() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.unschedule('relations-fin-de-contrat') where exists (select 1 from cron.job where jobname = 'relations-fin-de-contrat');
select cron.schedule('relations-fin-de-contrat', '17 4 * * *', $$select relations_terminer_echues();$$);

select 'Refonte Agence + MA2M Academy : porte et relations installées' as resultat;
