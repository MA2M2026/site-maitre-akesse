-- ════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Catégorie de la fiche publique mise à jour TOUT DE SUITE (16/11/2026, demande de la propriétaire)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Avant : la carte changeait dès le clic de l'agence, mais la fiche publique (« New Face » / « Main Board ») attendait
-- le rangement de la nuit (4 h). Maintenant, la fiche est rangée aussitôt que change ce qui décide de sa catégorie :
--   • dans le registre (agence_mannequins) : son parcours à l'arrivée, sa position dans la formation, sa date
--     d'entrée, ou le lien vers son compte ;
--   • ses expériences (model_projects) : ajout, modification ou retrait.
-- Le rangement de la nuit reste en place (il suit le temps qui passe : 2 ans à l'agence).
-- Aussi : carte_mannequin_regler (réglages de la carte) corrigée, voir plus bas.
-- À coller une fois dans Supabase (SQL Editor), après supabase-carte-mannequin.sql.

create or replace function categorie_suivre_registre() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then perform categories_mannequins_mettre_a_jour(new.user_id); end if;
  if tg_op = 'UPDATE' and old.user_id is not null and old.user_id is distinct from new.user_id then
    perform categories_mannequins_mettre_a_jour(old.user_id);
  end if;
  return null;
end;
$$;
revoke all on function categorie_suivre_registre() from public, anon, authenticated;
drop trigger if exists categorie_suivre_registre on agence_mannequins;
create trigger categorie_suivre_registre after insert or update of parcours_arrivee, formation_mois_faits, formation_niveaux, date_entree, user_id
  on agence_mannequins for each row execute function categorie_suivre_registre();

create or replace function categorie_suivre_experiences() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'DELETE' then perform categories_mannequins_mettre_a_jour(new.model_id); end if;
  if tg_op <> 'INSERT' and (tg_op = 'DELETE' or old.model_id is distinct from new.model_id) then
    perform categories_mannequins_mettre_a_jour(old.model_id);
  end if;
  return null;
end;
$$;
revoke all on function categorie_suivre_experiences() from public, anon, authenticated;
drop trigger if exists categorie_suivre_experiences on model_projects;
create trigger categorie_suivre_experiences after insert or update of periode, model_id or delete
  on model_projects for each row execute function categorie_suivre_experiences();

-- Réglages de la carte depuis la fiche « Mannequins » (déplacé ici de supabase-carte-mannequin.sql le 16/11/2026,
-- corrigé à la relecture : des mois jamais réglés restent vides ; une position impossible est refusée en clair)
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
      -- (16/11/2026, relecture) des mois « jamais réglés » (vide) restent vides : sinon le début de sa formation, donc
      -- ses mensualités, passaient au calcul de la reprise sans que personne le voie
      formation_mois_faits = case when formation_mois_faits is null then null else least(formation_mois_faits, case when p_reglages->>'parcours' = 'formee' then 9 else 18 end) end, carte_formation = null
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
      -- (16/11/2026, relecture) ses mois de cours comptés depuis son arrivée vont déjà au-delà : on le dit, au lieu
      -- d'enregistrer en silence une autre position que celle touchée
      if n - 1 - e < 0 then
        raise exception 'Impossible : depuis son arrivée, % mois de cours sont déjà comptés (ses mensualités), elle est donc plus loin que ce mois-là.', e;
      end if;
      update agence_mannequins set formation_mois_faits = least(niv * 9, n - 1 - e) where id = p_agence;
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

NOTIFY pgrst, 'reload schema';

-- Contrôle (à lire après « Run ») : 3 éléments attendus
select 'Catégorie immédiate installée : ' || ((select count(*) from pg_trigger where tgname in ('categorie_suivre_registre', 'categorie_suivre_experiences')) +
  (select count(*) from pg_proc where proname = 'carte_mannequin_regler' and prosrc like '%depuis son arrivée%')) || ' éléments sur 3' as controle;
