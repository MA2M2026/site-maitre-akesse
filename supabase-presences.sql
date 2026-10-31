-- =====================================================================================
-- Extension 142 — Liste de présence des cours du dimanche (01/11/2026, chantier 14,
-- décisions de la propriétaire du 31/10/2026)
-- =====================================================================================
-- Chaque dimanche, l'agence (la propriétaire ou une personne de l'équipe ayant accès à
-- l'Administration) coche les mannequins du registre venues au cours : vert = présente,
-- orange = absence excusée. Un dimanche passé non coché est une absence (rouge, calculé : rien
-- n'est écrit). Une séance peut être annulée (Noël, événement de l'agence…) : elle ne compte
-- pour personne. La mannequin voit ses présences dans son application, SANS pouvoir les
-- modifier : seules les fonctions ci-dessous écrivent, et elles vérifient qui demande.
-- Les mentions (assidu, bien, passable…) et la synthèse sont calculées par la page
-- (js/presences-calcul.js), à partir de ces seules données.
-- À coller en entier dans Supabase › SQL Editor › Run. Aucune donnée existante touchée ;
-- peut être rejoué sans risque.

create table if not exists presences_seances_annulees (
  dimanche date primary key check (extract(isodow from dimanche) = 7),
  motif text,
  modifie_par uuid references auth.users(id),
  modifie_le timestamptz not null default now()
);
create table if not exists presences (
  mannequin_id uuid not null references agence_mannequins(id) on delete cascade,
  dimanche date not null check (extract(isodow from dimanche) = 7),
  etat text not null check (etat in ('present', 'excuse')),
  saisi_par uuid references auth.users(id),
  saisi_le timestamptz not null default now(),
  primary key (mannequin_id, dimanche)
);
-- personne ne lit ni n'écrit directement : seulement par les fonctions (contrôle de qui demande)
alter table presences_seances_annulees enable row level security;
alter table presences enable row level security;
revoke all on presences_seances_annulees, presences from anon, authenticated;

-- Qui coche : toute personne de l'équipe connectée à l'Administration (double authentification,
-- appareil non révoqué : portail_role, supabase-administration.sql)
create or replace function presences_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select portail_role() is not null;
$$;
revoke execute on function presences_equipe() from public, anon;

-- Le mois d'un coup pour l'écran du dimanche : mannequins actives du registre (et celles qui
-- ont une présence ce mois-là, même si elles ne sont plus actives), leurs présences du mois,
-- les séances annulées du mois.
create or replace function presences_mois(p_mois date)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  debut date := date_trunc('month', p_mois)::date;
  fin date := (date_trunc('month', p_mois) + interval '1 month - 1 day')::date;
begin
  if not presences_equipe() then raise exception 'Réservé à l''équipe de l''agence.'; end if;
  return json_build_object(
    -- mensualite : état de la mensualité de ce mois (signe « à payer » à côté du nom, 01/11/2026) ;
    -- mensualite_etat (supabase-administration.sql) ne le dit qu'à qui a accès aux Paiements (sinon null)
    'mannequins', coalesce((select json_agg(json_build_object('id', a.id, 'nom', a.full_name, 'genre', a.genre,
        'date_entree', a.date_entree, 'compte', a.user_id, 'statut', a.statut,
        'mensualite', case when a.statut = 'actif' and debut >= date_trunc('month', a.date_entree) and debut <= current_date then mensualite_etat(a.id, debut) end) order by a.full_name)
      from agence_mannequins a
      where a.statut = 'actif' or exists (select 1 from presences p where p.mannequin_id = a.id and p.dimanche between debut and fin)), '[]'::json),
    'presences', coalesce((select json_agg(json_build_object('mannequin', p.mannequin_id, 'dimanche', p.dimanche, 'etat', p.etat))
      from presences p where p.dimanche between debut and fin), '[]'::json),
    'annulees', coalesce((select json_agg(json_build_object('dimanche', s.dimanche, 'motif', s.motif))
      from presences_seances_annulees s where s.dimanche between debut and fin), '[]'::json));
end;
$$;

-- Toute une période (synthèse de 3 mois, d'une année…) : mêmes données, du 1er mois au dernier
create or replace function presences_periode(p_debut date, p_fin date)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  debut date := date_trunc('month', p_debut)::date;
  fin date := (date_trunc('month', p_fin) + interval '1 month - 1 day')::date;
begin
  if not presences_equipe() then raise exception 'Réservé à l''équipe de l''agence.'; end if;
  if fin < debut or fin > debut + interval '3 years' then raise exception 'Période invalide (3 ans au plus).'; end if;
  return json_build_object(
    'mannequins', coalesce((select json_agg(json_build_object('id', a.id, 'nom', a.full_name, 'date_entree', a.date_entree, 'compte', a.user_id, 'statut', a.statut) order by a.full_name)
      from agence_mannequins a
      where a.statut = 'actif' or exists (select 1 from presences p where p.mannequin_id = a.id and p.dimanche between debut and fin)), '[]'::json),
    'presences', coalesce((select json_agg(json_build_object('mannequin', p.mannequin_id, 'dimanche', p.dimanche, 'etat', p.etat))
      from presences p where p.dimanche between debut and fin), '[]'::json),
    'annulees', coalesce((select json_agg(json_build_object('dimanche', s.dimanche, 'motif', s.motif))
      from presences_seances_annulees s where s.dimanche between debut and fin), '[]'::json));
end;
$$;

-- Cocher (présente / excusée) ou décocher (p_etat null). Jamais un dimanche à venir, jamais
-- une séance annulée.
create or replace function presence_marquer(p_mannequin uuid, p_dimanche date, p_etat text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not presences_equipe() then raise exception 'Réservé à l''équipe de l''agence.'; end if;
  if p_dimanche is null or extract(isodow from p_dimanche) <> 7 then raise exception 'Ce jour n''est pas un dimanche.'; end if;
  if p_dimanche > current_date then raise exception 'Ce dimanche n''est pas encore arrivé.'; end if;
  if exists (select 1 from presences_seances_annulees where dimanche = p_dimanche) then raise exception 'Cette séance est annulée.'; end if;
  if not exists (select 1 from agence_mannequins where id = p_mannequin) then raise exception 'Mannequin inconnue.'; end if;
  if p_etat is null then
    delete from presences where mannequin_id = p_mannequin and dimanche = p_dimanche;
  elsif p_etat in ('present', 'excuse') then
    insert into presences (mannequin_id, dimanche, etat, saisi_par) values (p_mannequin, p_dimanche, p_etat, auth.uid())
    on conflict (mannequin_id, dimanche) do update set etat = excluded.etat, saisi_par = excluded.saisi_par, saisi_le = now();
  else
    raise exception 'État inconnu.';
  end if;
end;
$$;

-- Annuler une séance (elle ne compte pour personne) ou la rétablir (p_annulee = false).
-- Annuler efface les présences déjà cochées ce jour-là (une séance annulée n'a pas eu lieu).
create or replace function presences_seance_annuler(p_dimanche date, p_annulee boolean, p_motif text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not presences_equipe() then raise exception 'Réservé à l''équipe de l''agence.'; end if;
  if p_dimanche is null or extract(isodow from p_dimanche) <> 7 then raise exception 'Ce jour n''est pas un dimanche.'; end if;
  if p_annulee then
    insert into presences_seances_annulees (dimanche, motif, modifie_par) values (p_dimanche, nullif(trim(coalesce(p_motif, '')), ''), auth.uid())
    on conflict (dimanche) do update set motif = excluded.motif, modifie_par = excluded.modifie_par, modifie_le = now();
    delete from presences where dimanche = p_dimanche;
  else
    delete from presences_seances_annulees where dimanche = p_dimanche;
  end if;
end;
$$;

-- La mannequin connectée : SES présences seulement (toute sa formation), sa date d'entrée et
-- les séances annulées. Lecture seule.
create or replace function mes_presences()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  a agence_mannequins;
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  select * into a from agence_mannequins where user_id = auth.uid() limit 1;
  if not found then return null; end if;
  return json_build_object(
    'date_entree', a.date_entree,
    'presences', coalesce((select json_agg(json_build_object('dimanche', p.dimanche, 'etat', p.etat) order by p.dimanche)
      from presences p where p.mannequin_id = a.id), '[]'::json),
    'annulees', coalesce((select json_agg(json_build_object('dimanche', s.dimanche, 'motif', s.motif) order by s.dimanche)
      from presences_seances_annulees s where s.dimanche >= a.date_entree - 31), '[]'::json));
end;
$$;

revoke execute on function presences_mois(date), presences_periode(date, date), presence_marquer(uuid, date, text),
  presences_seance_annuler(date, boolean, text), mes_presences() from public, anon;
grant execute on function presences_mois(date), presences_periode(date, date), presence_marquer(uuid, date, text),
  presences_seance_annuler(date, boolean, text), mes_presences() to authenticated;

NOTIFY pgrst, 'reload schema';
