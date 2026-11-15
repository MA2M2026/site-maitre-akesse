-- =====================================================================================================
-- Carte « MANNEQUIN MA2M » et catégorie New Face / Professionnelle (décisions de la propriétaire du 15/11/2026,
-- maquette validée : maquettes/carte-identite-mannequin-v2.html). Rejouable.
--
-- 1) CATÉGORIE (fiche publique : « New Face » ou « Main Board » ; carte et application : New Face / Professionnelle) :
--    Professionnelle dès que l'une de ces choses est vraie, sinon New Face —
--      * 2 ans ou plus à l'agence (date d'entrée du registre) ;
--      * 2 ans ou plus d'expérience déclarée (years_experience) ;
--      * une expérience de sa fiche datée d'il y a 2 ans ou plus (année lue dans « période » : 2020, mars 2022…).
--    L'agence peut choisir à la main (model_profiles.niveau_manuel) : cela passe avant le calcul.
--    Tous les jours à 4 h, categories_mannequins_mettre_a_jour() range toutes les fiches (niveau_mannequin).
-- 2) CARTE : l'agence l'active (carte_active), choisit sa validité (durée du contrat : 3, 4 ou 5 ans, renouvelable)
--    et peut imposer le texte « Formation » (carte_formation ; vide = calculé d'après le programme). Le numéro
--    (carte_numero) est donné une fois pour toutes à la première activation : « MA2M · <année d'entrée> · 0142 ».
--    La mannequin lit SA carte (ma_carte_mannequin) seulement quand elle est activée.
-- =====================================================================================================

alter table model_profiles add column if not exists niveau_manuel text check (niveau_manuel is null or niveau_manuel in ('New Face', 'Professionnel'));
alter table agence_mannequins add column if not exists carte_active boolean not null default false;
alter table agence_mannequins add column if not exists carte_validite_ans int not null default 5 check (carte_validite_ans between 1 and 10);
alter table agence_mannequins add column if not exists carte_formation text check (carte_formation is null or length(carte_formation) <= 40);
alter table agence_mannequins add column if not exists carte_numero int unique;
create sequence if not exists agence_carte_numero_seq start 1;

-- numéro donné à la première activation, jamais changé ensuite
create or replace function agence_carte_numero() returns trigger language plpgsql set search_path = public as $$
begin
  if new.carte_active and new.carte_numero is null then new.carte_numero := nextval('agence_carte_numero_seq'); end if;
  if tg_op = 'UPDATE' and old.carte_numero is not null then new.carte_numero := old.carte_numero; end if;
  new.carte_formation := nullif(trim(new.carte_formation), '');
  return new;
end;
$$;
drop trigger if exists agence_carte_numero on agence_mannequins;
create trigger agence_carte_numero before insert or update on agence_mannequins for each row execute function agence_carte_numero();

-- la catégorie d'une fiche (règle ci-dessus)
create or replace function categorie_mannequin_calculee(p_model uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when mp.niveau_manuel is not null then mp.niveau_manuel
    when exists (select 1 from agence_mannequins a where a.user_id = mp.id and a.date_entree <= (current_date - interval '2 years')::date) then 'Professionnel'
    when coalesce(mp.years_experience, 0) >= 2 then 'Professionnel'
    when (select min(substring(pr.periode from '(19[5-9][0-9]|20[0-9][0-9])')::int) from model_projects pr where pr.model_id = mp.id)
         <= extract(year from current_date)::int - 2 then 'Professionnel'
    else 'New Face' end
  from model_profiles mp where mp.id = p_model
$$;
revoke all on function categorie_mannequin_calculee(uuid) from public, anon;
grant execute on function categorie_mannequin_calculee(uuid) to authenticated;

-- toutes les fiches rangées (tous les jours, et après un choix de l'agence) ; écriture « serveur » : les gardiens de
-- model_profiles laissent passer, et seule la colonne niveau_mannequin change. (Une fiche en ligne dont la première
-- publication n'est pas notée est laissée de côté : le gardien de publication la remettrait en attente.)
create or replace function categories_mannequins_mettre_a_jour(p_model uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  avant text := current_setting('request.jwt.claims', true);
  n int;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update model_profiles mp set niveau_mannequin = x.c
    from (select id, categorie_mannequin_calculee(id) as c from model_profiles where p_model is null or id = p_model) x
    where x.id = mp.id and mp.niveau_mannequin is distinct from x.c
      and (mp.published is not true or coalesce(mp.premiere_publication_faite, false));
  get diagnostics n = row_count;
  perform set_config('request.jwt.claims', coalesce(avant, ''), true);
  return n;
end;
$$;
revoke all on function categories_mannequins_mettre_a_jour(uuid) from public, anon, authenticated;

-- l'agence choisit la catégorie à la main (ou revient au calcul : null), puis la fiche est rangée tout de suite
create or replace function mannequin_categorie_choisir(p_agence uuid, p_niveau text) returns text
language plpgsql security definer set search_path = public as $$
declare
  u uuid;
  avant text := current_setting('request.jwt.claims', true);
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé'; end if;
  if p_niveau is not null and p_niveau not in ('New Face', 'Professionnel') then raise exception 'Catégorie inconnue.'; end if;
  select user_id into u from agence_mannequins where id = p_agence;
  if u is null then raise exception 'Cette mannequin n''a pas encore de compte : la catégorie suit sa fiche dès qu''elle en aura un.'; end if;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update model_profiles set niveau_manuel = p_niveau where id = u;
  perform set_config('request.jwt.claims', coalesce(avant, ''), true);
  perform categories_mannequins_mettre_a_jour(u);
  return categorie_mannequin_calculee(u);
end;
$$;
revoke all on function mannequin_categorie_choisir(uuid, text) from public, anon;
grant execute on function mannequin_categorie_choisir(uuid, text) to authenticated;

-- la carte (données communes à la mannequin et à l'agence)
create or replace function carte_mannequin_donnees(a agence_mannequins) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'active', (a).carte_active,
    'nom', coalesce(mp.full_name, (a).full_name),
    'matricule', case when (a).carte_numero is not null then 'MA2M · ' || extract(year from (a).date_entree)::int || ' · ' || lpad((a).carte_numero::text, 4, '0') end,
    'depuis', (a).date_entree,
    'validite_ans', (a).carte_validite_ans,
    'valable', ((a).date_entree + make_interval(years => (a).carte_validite_ans))::date,
    'categorie', case when mp.id is not null then categorie_mannequin_calculee(mp.id) else 'New Face' end,
    'categorie_manuelle', mp.niveau_manuel,
    'formation', (a).carte_formation,
    'niveaux', (a).formation_niveaux,
    'slug', mp.slug, 'id_fiche', mp.id, 'en_ligne', coalesce(mp.published, false))
  from (select 1) _ left join model_profiles mp on mp.id = (a).user_id
$$;
revoke all on function carte_mannequin_donnees(agence_mannequins) from public, anon, authenticated;

-- côté mannequin (application) : SA carte, seulement si l'agence l'a activée
create or replace function ma_carte_mannequin() returns jsonb
language sql stable security definer set search_path = public as $$
  select carte_mannequin_donnees(a) from agence_mannequins a where a.user_id = auth.uid() and a.carte_active limit 1
$$;
revoke all on function ma_carte_mannequin() from public, anon;
grant execute on function ma_carte_mannequin() to authenticated;

-- côté agence (fiche de la mannequin, espace Paiements)
create or replace function carte_mannequin_de(p_agence uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé'; end if;
  return (select carte_mannequin_donnees(a) from agence_mannequins a where a.id = p_agence);
end;
$$;
revoke all on function carte_mannequin_de(uuid) from public, anon;
grant execute on function carte_mannequin_de(uuid) to authenticated;

-- tous les jours à 4 h : les catégories suivent le temps qui passe (2 ans à l'agence)
create extension if not exists pg_cron;
select cron.unschedule('categories-mannequins') where exists (select 1 from cron.job where jobname = 'categories-mannequins');
select cron.schedule('categories-mannequins', '0 4 * * *', $$select categories_mannequins_mettre_a_jour();$$);

-- et une première fois tout de suite
select categories_mannequins_mettre_a_jour() as fiches_rangees;

NOTIFY pgrst, 'reload schema';

-- Contrôle (à lire après « Run ») : 8 éléments attendus
select 'Carte de mannequin installée : ' || (
  (select count(*) from information_schema.columns where (table_name, column_name) in (('model_profiles', 'niveau_manuel'), ('agence_mannequins', 'carte_active'), ('agence_mannequins', 'carte_numero'))) +
  (select count(*) from pg_proc where proname in ('categorie_mannequin_calculee', 'categories_mannequins_mettre_a_jour', 'ma_carte_mannequin', 'carte_mannequin_de')) +
  (select count(*) from cron.job where jobname = 'categories-mannequins')) || ' éléments sur 8' as controle;
