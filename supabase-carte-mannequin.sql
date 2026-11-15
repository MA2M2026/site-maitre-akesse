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
-- début du contrat en cours (vide = la date d'entrée) : « Renouveler » le remet à aujourd'hui
alter table agence_mannequins add column if not exists carte_debut date;
create sequence if not exists agence_carte_numero_seq start 1;

-- numéro donné à la première activation, jamais changé ensuite
create or replace function agence_carte_numero() returns trigger language plpgsql set search_path = public as $$
begin
  if new.carte_active and new.carte_numero is null then new.carte_numero := nextval('agence_carte_numero_seq'); end if;
  if tg_op = 'UPDATE' and old.carte_numero is not null then new.carte_numero := old.carte_numero; end if;
  new.carte_formation := nullif(trim(new.carte_formation), '');
  if new.carte_debut is not null and new.carte_debut > current_date + 31 then raise exception 'Date de début du contrat trop lointaine.'; end if;
  return new;
end;
$$;
drop trigger if exists agence_carte_numero on agence_mannequins;
create trigger agence_carte_numero before insert or update on agence_mannequins for each row execute function agence_carte_numero();

-- (15/11/2026, cohérence demandée par la propriétaire) UNE source pour tout : son parcours à l'arrivée (débutante
-- chez nous, ou déjà formée / expérimentée ailleurs) et sa position dans la formation (mois déjà faits, les mêmes que
-- l'assistant de reprise). Tout le reste en découle : « membre depuis », catégorie, formation écrite sur la carte.
alter table agence_mannequins add column if not exists parcours_arrivee text check (parcours_arrivee is null or parcours_arrivee in ('debutante', 'formee'));

-- début réel de sa formation : en remontant ses mois de cours déjà faits (sans les congés de décembre à février)
-- avant son départ dans le système
create or replace function formation_debut_reel(p_mannequin uuid) returns date
language sql stable security definer set search_path = public as $$
  select case when coalesce(a.formation_mois_faits, 0) = 0 then formation_debut(a.id)
    else (select m from (select (date_trunc('month', formation_debut(a.id)) - make_interval(months => k))::date as m from generate_series(1, 96) k) x
          where not mois_conge(m) order by m desc offset a.formation_mois_faits - 1 limit 1) end
  from agence_mannequins a where a.id = p_mannequin
$$;
revoke all on function formation_debut_reel(uuid) from public, anon, authenticated;
-- « membre depuis » : le plus ancien de son entrée au registre et du début réel de sa formation (une mannequin au
-- niveau 2 n'est jamais « membre depuis » le mois où sa fiche a été créée)
create or replace function mannequin_depuis(p_mannequin uuid) returns date
language sql stable security definer set search_path = public as $$
  select least(a.date_entree, coalesce(formation_debut_reel(a.id), a.date_entree)) from agence_mannequins a where a.id = p_mannequin
$$;
revoke all on function mannequin_depuis(uuid) from public, anon, authenticated;

-- la catégorie (règle ci-dessus), à partir des valeurs de la fiche : sert au calcul ET au déclencheur qui range la
-- fiche à chaque enregistrement (la page de la mannequin ne décide plus seule de sa catégorie)
create or replace function categorie_regle(p_model uuid, p_manuel text, p_annees int) returns text
language sql stable security definer set search_path = public as $$
  select case
    when p_manuel is not null then p_manuel
    -- déjà formée ou expérimentée ailleurs à son arrivée, ou 2 ans à l'agence (depuis le début RÉEL de sa formation)
    when exists (select 1 from agence_mannequins a where a.user_id = p_model and (a.parcours_arrivee = 'formee' or mannequin_depuis(a.id) <= (current_date - interval '2 years')::date)) then 'Professionnel'
    when coalesce(p_annees, 0) >= 2 then 'Professionnel'
    when (select min(substring(pr.periode from '(19[5-9][0-9]|20[0-9][0-9])')::int) from model_projects pr where pr.model_id = p_model)
         <= extract(year from current_date)::int - 2 then 'Professionnel'
    else 'New Face' end
$$;
revoke all on function categorie_regle(uuid, text, int) from public, anon, authenticated;
create or replace function categorie_mannequin_calculee(p_model uuid) returns text
language sql stable security definer set search_path = public as $$
  select categorie_regle(mp.id, mp.niveau_manuel, mp.years_experience) from model_profiles mp where mp.id = p_model
$$;

-- gardien : seule l'agence (ou la base) choisit niveau_manuel ; et niveau_mannequin suit TOUJOURS la règle (ce que la
-- page de la mannequin y écrit est remplacé)
create or replace function model_profiles_categorie() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.niveau_manuel is distinct from (case when tg_op = 'UPDATE' then old.niveau_manuel end)
     and not (coalesce(auth.role(), '') = 'service_role' or exists (select 1 from admins where user_id = auth.uid())) then
    raise exception 'Modification refusée : seule l''agence choisit la catégorie.';
  end if;
  new.niveau_mannequin := categorie_regle(new.id, new.niveau_manuel, new.years_experience);
  return new;
end;
$$;
revoke all on function model_profiles_categorie() from public, anon, authenticated;
drop trigger if exists model_profiles_categorie on model_profiles;
create trigger model_profiles_categorie before insert or update of niveau_manuel, niveau_mannequin, years_experience on model_profiles
  for each row execute function model_profiles_categorie();
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
    'depuis', mannequin_depuis((a).id),
    'parcours', (a).parcours_arrivee,
    'validite_ans', (a).carte_validite_ans,
    'debut', coalesce((a).carte_debut, mannequin_depuis((a).id)),
    'valable', (coalesce((a).carte_debut, mannequin_depuis((a).id)) + make_interval(years => (a).carte_validite_ans))::date,
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

-- (15/11/2026, demande de la propriétaire) la carte se gère depuis la fiche de la mannequin dans « Mannequins »
-- (Administration du site) : lecture par la fiche du site, et réglages par une seule fonction, pour l'équipe du site
-- comme pour celle des paiements
create or replace function carte_mannequin_par_fiche(p_fiche uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a agence_mannequins;
begin
  if not (portail_peut('site') or portail_peut('paiements')) then raise exception 'Accès refusé'; end if;
  select * into a from agence_mannequins where user_id = p_fiche limit 1;
  if a.id is null then return null; end if;
  return jsonb_build_object('agence_id', a.id, 'carte', carte_mannequin_donnees(a), 'programme', formation_programme_calcul(a.id));
end;
$$;
revoke all on function carte_mannequin_par_fiche(uuid) from public, anon;
grant execute on function carte_mannequin_par_fiche(uuid) to authenticated;

create or replace function carte_mannequin_regler(p_agence uuid, p_reglages jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid;
  avant text := current_setting('request.jwt.claims', true);
begin
  if not (portail_peut('site') or portail_peut('paiements')) then raise exception 'Accès refusé'; end if;
  if jsonb_typeof(p_reglages) <> 'object' then raise exception 'Réglage inconnu.'; end if;
  if p_reglages ? 'active' then update agence_mannequins set carte_active = (p_reglages->>'active')::boolean where id = p_agence; end if;
  if p_reglages ? 'validite_ans' then
    if (p_reglages->>'validite_ans')::int not between 1 and 10 then raise exception 'Validité inconnue.'; end if;
    update agence_mannequins set carte_validite_ans = (p_reglages->>'validite_ans')::int where id = p_agence;
  end if;
  if p_reglages ? 'formation' then update agence_mannequins set carte_formation = left(nullif(trim(p_reglages->>'formation'), ''), 40) where id = p_agence; end if;
  if p_reglages ? 'renouveler' then update agence_mannequins set carte_debut = current_date where id = p_agence; end if;
  -- son parcours et sa position dans la formation : les mêmes données que l'assistant de reprise (elles comptent aussi
  -- pour ses mensualités) → équipe des paiements (ou principal) seulement
  if (p_reglages ? 'parcours' or p_reglages ? 'position') and not portail_peut('paiements') then
    raise exception 'Seule l''équipe des paiements (ou l''administrateur principal) change le parcours ou la position dans la formation.';
  end if;
  if p_reglages ? 'parcours' then
    if (p_reglages->>'parcours') not in ('debutante', 'formee') then raise exception 'Parcours inconnu.'; end if;
    -- débutante : 2 niveaux (18 mois) ; déjà formée : le recyclage (9 mois) ; la position repart au début
    update agence_mannequins set parcours_arrivee = p_reglages->>'parcours', formation_niveaux = case when p_reglages->>'parcours' = 'formee' then 1 else 2 end,
      formation_mois_faits = least(coalesce(formation_mois_faits, 0), case when p_reglages->>'parcours' = 'formee' then 9 else 18 end), carte_formation = null
      where id = p_agence;
  end if;
  if p_reglages ? 'position' then
    -- position = le rang du mois EN COURS (1 = niveau 1 mois 1 … 18), ou niveaux × 9 + 1 = formation terminée :
    -- les mois déjà faits sont recalculés pour que le mois en cours soit celui-là
    declare
      n int := (p_reglages->>'position')::int;
      niv int := (select formation_niveaux from agence_mannequins where id = p_agence);
      e int;
    begin
      if n is null or n < 1 or n > niv * 9 + 1 then raise exception 'Position inconnue.'; end if;
      update agence_mannequins set formation_mois_faits = 0, carte_formation = null where id = p_agence;
      select count(*) into e from formation_mois_n(formation_debut(p_agence), 48) m where m < date_trunc('month', current_date)::date;
      update agence_mannequins set formation_mois_faits = least(niv * 9, greatest(0, n - 1 - e)) where id = p_agence;
    end;
  end if;
  if p_reglages ? 'categorie' then
    if (p_reglages->>'categorie') is not null and (p_reglages->>'categorie') not in ('New Face', 'Professionnel') then raise exception 'Catégorie inconnue.'; end if;
    select user_id into u from agence_mannequins where id = p_agence;
    if u is null then raise exception 'Cette mannequin n''a pas encore de compte.'; end if;
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    update model_profiles set niveau_manuel = p_reglages->>'categorie' where id = u;
    perform set_config('request.jwt.claims', coalesce(avant, ''), true);
    perform categories_mannequins_mettre_a_jour(u);
  end if;
  return (select carte_mannequin_donnees(a) from agence_mannequins a where a.id = p_agence);
end;
$$;
revoke all on function carte_mannequin_regler(uuid, jsonb) from public, anon;
grant execute on function carte_mannequin_regler(uuid, jsonb) to authenticated;

-- (15/11/2026) les anciens choix à la main (catégorie, texte de formation) sont retirés : tout découle maintenant du
-- parcours et de la position dans la formation
update agence_mannequins set carte_formation = null where carte_formation is not null;
do $$ begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update model_profiles set niveau_manuel = null where niveau_manuel is not null;
end $$;

-- tous les jours à 4 h : les catégories suivent le temps qui passe (2 ans à l'agence)
create extension if not exists pg_cron;
select cron.unschedule('categories-mannequins') where exists (select 1 from cron.job where jobname = 'categories-mannequins');
select cron.schedule('categories-mannequins', '0 4 * * *', $$select categories_mannequins_mettre_a_jour();$$);

-- et une première fois tout de suite
select categories_mannequins_mettre_a_jour() as fiches_rangees;

NOTIFY pgrst, 'reload schema';

-- Contrôle (à lire après « Run ») : 13 éléments attendus
select 'Carte de mannequin installée : ' || (
  (select count(*) from information_schema.columns where (table_name, column_name) in (('model_profiles', 'niveau_manuel'), ('agence_mannequins', 'carte_active'), ('agence_mannequins', 'carte_numero'), ('agence_mannequins', 'parcours_arrivee'))) +
  (select count(*) from pg_trigger where tgname = 'model_profiles_categorie') +
  (select count(*) from pg_proc where proname in ('categorie_mannequin_calculee', 'categories_mannequins_mettre_a_jour', 'ma_carte_mannequin', 'carte_mannequin_de', 'carte_mannequin_par_fiche', 'carte_mannequin_regler', 'mannequin_depuis')) +
  (select count(*) from cron.job where jobname = 'categories-mannequins')) || ' éléments sur 13' as controle;
