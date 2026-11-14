-- =====================================================================================
-- Extension 162 — Programme de formation des mannequins de l'agence (validé par la propriétaire le 14/11/2026)
-- =====================================================================================
-- Comme « Mon programme » des cours de talons : chaque mannequin voit dans son application le thème de chaque mois de
-- sa formation (niveau 1 « Les fondations », niveau 2 « La professionnelle », 9 mois de cours chacun, congés de
-- décembre à février sautés), le mois en cours, les mois faits et à venir ; l'agence le voit dans sa fiche.
-- Les mois suivent EXACTEMENT ceux des mensualités (formation_debut, formation_mois_n, formation_reste_total,
-- formation_mois_faits : supabase-formation.sql puis supabase-reprise-mars.sql, à coller AVANT ce fichier).
-- Les mannequins ne choisissent pas : toutes suivent le programme de leur niveau. Ajout seulement. Rejouable.
-- À coller dans Supabase › SQL Editor › Run.

create table if not exists formation_programme (
  niveau int not null check (niveau in (1, 2)),
  mois int not null check (mois between 1 and 9),
  theme text not null check (length(theme) between 2 and 120),
  primary key (niveau, mois)
);
insert into formation_programme (niveau, mois, theme) values
  (1, 1, 'Posture et démarche de base'),
  (1, 2, 'Le podium : marche, demi-tours, arrêts'),
  (1, 3, 'La pose photo : les bases (angles, mains, regard)'),
  (1, 4, 'Expression et regard'),
  (1, 5, 'Défiler en robe longue et tenue de soirée'),
  (1, 6, 'Défiler en tailleur, tenue courte et accessoires'),
  (1, 7, 'Le casting : la marche de casting, se présenter avec ses photos'),
  (1, 8, 'Défiler à plusieurs et chorégraphies de podium'),
  (1, 9, 'Le défilé de fin d''année'),
  (2, 1, 'Perfectionner sa démarche : un style pour chaque créateur'),
  (2, 2, 'Le rythme du podium : marcher sur la musique'),
  (2, 3, 'Pose avancée : le shooting en studio'),
  (2, 4, 'Pose en extérieur et en mouvement'),
  (2, 5, 'Poser pour la vidéo et les réseaux sociaux'),
  (2, 6, 'Castings professionnels : mises en situation'),
  (2, 7, 'Les coulisses d''un défilé : changements de tenue rapides'),
  (2, 8, 'Le mannequinat publicitaire'),
  (2, 9, 'Le grand défilé de fin de formation')
on conflict (niveau, mois) do update set theme = excluded.theme;
alter table formation_programme enable row level security;
revoke all on formation_programme from anon, authenticated;
grant select on formation_programme to authenticated;
drop policy if exists "Programme de formation : lu par les comptes" on formation_programme;
create policy "Programme de formation : lu par les comptes" on formation_programme for select using (true);

-- Le programme d'une mannequin, mois de cours par mois de cours : rang (1 à 18), niveau, mois du niveau, thème, mois du
-- calendrier (vide pour les mois faits avant la reprise de mars) et état : fait, en_cours, a_venir.
create or replace function formation_programme_calcul(p_mannequin uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  a agence_mannequins;
  avant int;
  courant date := date_trunc('month', now())::date;
begin
  select * into a from agence_mannequins where id = p_mannequin;
  if a.id is null then return null; end if;
  avant := least(coalesce(a.formation_mois_faits, 0), a.formation_niveaux * 9);
  return json_build_object(
    'niveaux', a.formation_niveaux, 'total', a.formation_niveaux * 9,
    'mois', (select json_agg(json_build_object('rang', x.rang, 'niveau', (x.rang - 1) / 9 + 1, 'mois_niveau', (x.rang - 1) % 9 + 1,
                'theme', p.theme, 'date', x.d,
                'etat', case when x.d is null or x.d < courant then 'fait' when x.d = courant then 'en_cours' else 'a_venir' end) order by x.rang)
             from (select g as rang, null::date as d from generate_series(1, avant) g
                   union all
                   select avant + s.r::int, s.m from formation_mois_n(formation_debut(a.id), formation_reste_total(a.id)) with ordinality s(m, r)) x
             join formation_programme p on p.niveau = (x.rang - 1) / 9 + 1 and p.mois = (x.rang - 1) % 9 + 1
             where x.rang <= a.formation_niveaux * 9));
end;
$$;
revoke all on function formation_programme_calcul(uuid) from public, anon, authenticated;

-- Côté mannequin (application) : SON programme seulement
create or replace function mon_programme_formation() returns json
language sql stable security definer set search_path = public as $$
  select formation_programme_calcul(id) from agence_mannequins where user_id = auth.uid() limit 1;
$$;
revoke all on function mon_programme_formation() from public, anon;
grant execute on function mon_programme_formation() to authenticated;

-- Côté agence (fiche du mannequin, espace Paiements)
create or replace function programme_formation_de(p_mannequin uuid) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé'; end if;
  return formation_programme_calcul(p_mannequin);
end;
$$;
revoke all on function programme_formation_de(uuid) from public, anon;
grant execute on function programme_formation_de(uuid) to authenticated;

NOTIFY pgrst, 'reload schema';

select 'Programme de formation installé : ' || ((select count(*) from formation_programme)
  + (select count(*) from pg_proc where proname in ('mon_programme_formation', 'programme_formation_de'))) || ' éléments sur 20' as controle;
