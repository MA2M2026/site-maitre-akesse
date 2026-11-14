-- Essais de supabase-programme-mannequins.sql (programme de formation des mannequins, 14/11/2026) : les 18 thèmes,
-- calés sur les mois des mensualités (mois déjà faits avant la reprise, congés sautés) ; chacune voit le sien, l'agence
-- (espace Paiements) voit celui de chaque mannequin, personne d'autre.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
select essai((select count(*) from formation_programme) = 18, 'programme : 18 thèmes (2 niveaux de 9 mois)');
-- ESSAI REPRISE NIVEAU 2 (essais-reprise-mars.sql) : 2 niveaux, 7 mois faits avant la reprise de mars 2027
select formation_programme_calcul('00000000-0000-0000-0000-000000154e01') as p \gset
select essai(json_array_length(:'p'::json -> 'mois') = 18, '18 mois de cours au programme');
select essai((select bool_and(x->>'etat' = 'fait' and x->>'date' is null) from json_array_elements(:'p'::json -> 'mois') x where (x->>'rang')::int <= 7), 'les 7 mois faits avant la reprise : « fait », sans date');
select essai((select x->>'date' = '2027-03-01' and x->>'theme' = 'Défiler à plusieurs et chorégraphies de podium' and (x->>'niveau')::int = 1 and (x->>'mois_niveau')::int = 8
  from json_array_elements(:'p'::json -> 'mois') x where (x->>'rang')::int = 8), 'reprise en mars 2027 : niveau 1, mois 8 « Défiler à plusieurs »');
select essai((select x->>'date' = '2027-05-01' and x->>'theme' like 'Perfectionner sa démarche%' and (x->>'niveau')::int = 2
  from json_array_elements(:'p'::json -> 'mois') x where (x->>'rang')::int = 10), 'mai 2027 : niveau 2, mois 1');
select essai((select x->>'date' = '2028-04-01' and x->>'theme' = 'Le grand défilé de fin de formation' from json_array_elements(:'p'::json -> 'mois') x where (x->>'rang')::int = 18)
  and not exists (select 1 from json_array_elements(:'p'::json -> 'mois') x where extract(month from (x->>'date')::date) in (12, 1, 2)), 'dernier mois en avril 2028, jamais un mois de congé');
-- niveau 1 seulement : 9 mois
select essai(json_array_length(formation_programme_calcul('00000000-0000-0000-0000-000000154e02') -> 'mois') = 9, 'niveau 1 seulement : 9 mois au programme');
-- l'agence (Paiements) le lit ; une personne sans rôle non
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select essai(json_array_length(programme_formation_de('00000000-0000-0000-0000-000000154e01') -> 'mois') = 18, 'agence (Paiements) : programme d''une mannequin');
select essai_qui('00000000-0000-0000-0000-000000000fd3', 'aal2', 30, 'appareil-demande-0003');
select essai_refuse($$select programme_formation_de('00000000-0000-0000-0000-000000154e01')$$, 'personne sans rôle : refusé');
select essai(mon_programme_formation() is null, 'compte qui n''est pas mannequin : aucun programme');
reset role;
select essai_refuse($$set role anon; select mon_programme_formation()$$, 'visiteur : refusé');
reset role;
-- la mannequin connectée voit le sien (Roxane, mannequin de l'agence avec son compte : essais-administration.sql)
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b1');
select essai((mon_programme_formation() ->> 'total')::int in (9, 18) and json_array_length(mon_programme_formation() -> 'mois') = (mon_programme_formation() ->> 'total')::int, 'la mannequin voit son programme');
reset role;
