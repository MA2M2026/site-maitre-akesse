-- Essais de supabase-programme-talons.sql (« Mon programme » de l'Atelier talons, 14/11/2026) : séances remplies
-- toutes seules pour le groupe, page de l'élève lisible avec le seul jeton et seulement après le paiement validé.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
set role service_role;
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0101","formule":"groupe","nom":"Aya Programme","telephone":"+2250700000101","age":28}'::jsonb, '4.4.4.1');
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0102","formule":"prive_salle","nom":"Privée Programme","telephone":"+2250700000102","age":16,"parent_nom":"M. Yao","parent_telephone":"+2250700000103","nb_seances":2}'::jsonb, '4.4.4.2');
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0103","formule":"groupe","nom":"Jeton Choisi","telephone":"+2250700000104","age":30,"jeton":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'::jsonb, '4.4.4.3');
reset role;
select essai((select jeton <> 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' and length(jeton) = 36 from cours_talons where id = '00000000-0000-0000-0000-0000000c0103'), 'jeton envoyé par un visiteur : ignoré, la base tire le sien');
-- date de première séance notée un samedi (dans un an) : les dimanches partent du lendemain
update cours_talons set date_seance = (current_date + 365) + ((6 - extract(dow from current_date + 365)::int + 7) % 7) where id = '00000000-0000-0000-0000-0000000c0103';
select essai((select length(jeton) = 36 from cours_talons where id = '00000000-0000-0000-0000-0000000c0101'), 'chaque inscription a un jeton de 36 caractères');
select jeton as j1 from cours_talons where id = '00000000-0000-0000-0000-0000000c0101' \gset
-- avant le paiement : la page ne montre rien
set role anon;
select essai(programme_talons_lire(:'j1') is null, 'avant le paiement validé : la page ne montre rien');
reset role;
select essai_refuse($$set role anon; select count(*) from cours_talons_seances$$, 'visiteur : ne lit pas les séances directement');
reset role;
select essai_refuse($$set role anon; insert into cours_talons_seances (inscription_id, debut, fin) values ('00000000-0000-0000-0000-0000000c0101', now(), now() + interval '1 hour')$$, 'visiteur : n''ajoute pas de séance');
reset role;
-- l'équipe du site valide le groupe : 4 dimanches de 15 h à 18 h remplis tout seuls
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select cours_talons_valider('00000000-0000-0000-0000-0000000c0101');
select essai((select count(*) from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0101') = 4, 'groupe validé : 4 séances remplies');
select cours_talons_valider('00000000-0000-0000-0000-0000000c0103');
select essai((select bool_and(extract(dow from s.debut at time zone 'UTC') = 0) and min(s.debut at time zone 'UTC')::date = min(c.date_seance) + 1
  from cours_talons_seances s join cours_talons c on c.id = s.inscription_id where c.id = '00000000-0000-0000-0000-0000000c0103'), 'date notée un samedi : les séances partent du dimanche suivant, jamais un samedi');
select essai((select bool_and(extract(dow from debut at time zone 'UTC') = 0 and extract(hour from debut at time zone 'UTC') = 15 and fin - debut = interval '3 hours' and debut > now())
  from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0101'), 'les 4 séances : dimanches à venir, 15 h – 18 h');
select essai((select max(debut) - min(debut) = interval '21 days' from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0101'), 'quatre dimanches qui se suivent');
-- rouvrir puis revalider : jamais de doublon
update cours_talons set statut = 'terminee' where id = '00000000-0000-0000-0000-0000000c0101';
update cours_talons set statut = 'inscrite' where id = '00000000-0000-0000-0000-0000000c0101';
select essai((select count(*) from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0101') = 4, 'inscription rouverte : toujours 4 séances (pas de doublon)');
-- privé : rien de rempli tout seul ; l'équipe ajoute, change, coche, retire une séance
select cours_talons_valider('00000000-0000-0000-0000-0000000c0102');
select essai((select count(*) from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0102') = 0, 'privé validé : aucune séance ajoutée toute seule');
insert into cours_talons_seances (inscription_id, debut, fin, lieu) values ('00000000-0000-0000-0000-0000000c0102', '2030-01-05 10:00Z', '2030-01-05 12:00Z', 'Salle MA2M, Riviera Faya');
update cours_talons_seances set faite = true where inscription_id = '00000000-0000-0000-0000-0000000c0102';
select essai_refuse($$insert into cours_talons_seances (inscription_id, debut, fin) values ('00000000-0000-0000-0000-0000000c0102', '2030-01-06 12:00Z', '2030-01-06 10:00Z')$$, 'séance qui finit avant de commencer : refusée');
reset role;
-- la page de l'élève : avec le jeton seulement, sans téléphone ni photos
set role anon;
select essai((programme_talons_lire(:'j1')->>'civilite') = 'Madame' and jsonb_array_length(programme_talons_lire(:'j1')->'seances') = 4
  and programme_talons_lire(:'j1')->>'telephone' is null and programme_talons_lire(:'j1')->>'photos' is null, 'page de l''élève : ses 4 séances, « Madame », ni téléphone ni photos');
reset role;
select essai((select programme_talons_lire(jeton)->>'civilite' = 'Mademoiselle' from cours_talons where id = '00000000-0000-0000-0000-0000000c0102'), 'élève mineure : « Mademoiselle »');
set role anon;
select essai(programme_talons_lire('000000000000000000000000000000000000') is null and programme_talons_lire('x') is null and programme_talons_lire(null) is null, 'mauvais jeton : rien');
reset role;
-- une personne sans rôle ne voit ni ne change aucune séance
set role authenticated;
select essai_qui('00000000-0000-0000-0000-000000000fd3', 'aal2', 30, 'appareil-demande-0003');
select essai((select count(*) from cours_talons_seances) = 0, 'personne sans rôle : ne voit aucune séance');
reset role;
