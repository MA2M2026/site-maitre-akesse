-- =====================================================================================
-- Tailles des mannequins femmes : grille de l'agence (26/10/2026, décision de la propriétaire)
-- =====================================================================================
-- XS : poitrine 80-84, taille 60-65, bassin 88-92 · S : 85-89, 66-70, 93-96
-- M : 90-93, 71-74, 97-101 · L : 94-99, 75-81, 102-109 (XXS, XL, XXL, XXXL : 6 cm par taille)
-- Une mesure pile sur la limite de deux tailles reste dans la plus petite (règle n° 1).
-- MÊMES BORNES que js/tailles.js. Le contrôle « mesures à reprendre » (haut et bas trop
-- éloignés) suit cette grille ; les fiches sont ensuite remises à jour (une fiche redevenue
-- cohérente n'est plus signalée). À exécuter une fois dans Supabase (SQL Editor) ; peut être
-- relancé sans risque. Rien n'est effacé.

create or replace function mesures_incoherentes(categorie text, poitrine numeric, tour_taille numeric, hanches numeric)
returns boolean language sql immutable as $$
  select case when categorie = 'homme' then
    -- (hommes : inchangés, grille de l'Extension 123)
    coalesce((rang_taille(tour_taille, array[67,73,77,83,90,96,102])
            - rang_taille(poitrine, array[85,91,95,101,108,114,120])) not between -2 and 1, false)
  else
    coalesce((rang_taille(hanches, array[87,92,96,101,109,115,121])
            - rang_taille(poitrine, array[79,84,89,93,99,105,111])) not between -1 and 2, false)
  end;
$$;

-- fiches actuelles remises à jour avec la nouvelle grille (même méthode que l'Extension 123 ; le
-- déclencheur qui protège le profil de la propriétaire est suspendu le temps de cette mise à jour)
begin;
alter table model_profiles disable trigger trg_proteger_proprietaire_profil;
update model_profiles set mesures_a_reprendre_depuis =
  case when mesures_incoherentes(category, chest_cm, waist_cm, hips_cm) then coalesce(mesures_a_reprendre_depuis, now()) else null end
where (mesures_a_reprendre_depuis is not null) <> mesures_incoherentes(category, chest_cm, waist_cm, hips_cm);
alter table model_profiles enable trigger trg_proteger_proprietaire_profil;
commit;

-- Contrôle : doit afficher la nouvelle grille (bassin 87, 92, 96…)
select position('87,92,96,101,109' in pg_get_functiondef('mesures_incoherentes(text,numeric,numeric,numeric)'::regprocedure)) > 0 as grille_agence;
