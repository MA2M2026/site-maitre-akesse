-- ════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Catégorie de la fiche publique mise à jour TOUT DE SUITE (16/11/2026, demande de la propriétaire)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Avant : la carte changeait dès le clic de l'agence, mais la fiche publique (« New Face » / « Main Board ») attendait
-- le rangement de la nuit (4 h). Maintenant, la fiche est rangée aussitôt que change ce qui décide de sa catégorie :
--   • dans le registre (agence_mannequins) : son parcours à l'arrivée, sa position dans la formation, sa date
--     d'entrée, ou le lien vers son compte ;
--   • ses expériences (model_projects) : ajout, modification ou retrait.
-- Le rangement de la nuit reste en place (il suit le temps qui passe : 2 ans à l'agence).
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

-- Contrôle (à lire après « Run ») : 2 éléments attendus
select 'Catégorie immédiate installée : ' || (select count(*) from pg_trigger where tgname in ('categorie_suivre_registre', 'categorie_suivre_experiences')) || ' éléments sur 2' as controle;
