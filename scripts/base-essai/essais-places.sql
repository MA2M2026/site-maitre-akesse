-- Essais des « Places limitées » (supabase-places.sql) sur la base LOCALE jetable :
-- 2 places femmes, 1 place homme ; premier arrivé ; mineure et parent sur le même lien ;
-- désistement ; droits (le public ne lit rien directement, seulement par son lien).
\set ON_ERROR_STOP 1
set search_path = public, extensions;
grant execute on function essai(boolean, text) to anon;
grant execute on function essai_refuse(text, text) to anon;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'f1@test.ci'), ('00000000-0000-0000-0000-0000000000b2', 'f2@test.ci'),
  ('00000000-0000-0000-0000-0000000000b3', 'f3@test.ci'), ('00000000-0000-0000-0000-0000000000b4', 'h1@test.ci'),
  ('00000000-0000-0000-0000-0000000000b5', 'h2@test.ci')
on conflict do nothing;
insert into admins (user_id) values ('00000000-0000-0000-0000-0000000000a2') on conflict do nothing;
insert into model_profiles (id, full_name, category, civilite) values
  ('00000000-0000-0000-0000-0000000000b1', 'AWA KONÉ', 'femme', null), ('00000000-0000-0000-0000-0000000000b2', 'AMA PETITE', 'new-faces', 'Mademoiselle'),
  ('00000000-0000-0000-0000-0000000000b3', 'FATOU BAMBA', 'femme', null), ('00000000-0000-0000-0000-0000000000b4', 'JEAN YAO', 'new-faces', 'Monsieur'),
  ('00000000-0000-0000-0000-0000000000b5', 'KOFFI N', 'homme', null)
on conflict (id) do update set full_name = excluded.full_name, category = excluded.category, civilite = excluded.civilite;
update model_profiles set published = true, desactive = false, date_naissance = '2000-01-01' where id::text ~ '0000000000b[1-5]$';
update model_profiles set date_naissance = current_date - interval '15 years' where id = '00000000-0000-0000-0000-0000000000b2';  -- Ama, mineure
-- une mannequin en sourdine n'est pas invitée
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b6', 'sourdine@test.ci') on conflict do nothing;
insert into model_profiles (id, full_name, category, published, desactive) values ('00000000-0000-0000-0000-0000000000b6', 'EN SOURDINE', 'femme', false, true)
on conflict (id) do update set published = false, desactive = true;
insert into model_photos (model_id, url) values ('00000000-0000-0000-0000-0000000000b1', 'https://exemple.ci/awa.jpg');
insert into agenda_projets (id, type, titre, date_debut, lieu, ville) values
  ('00000000-0000-0000-0000-0000000000c1', 'defile', 'AFRICA IN RHYTHM', current_date + 20, 'Hôtel Ivoire', 'Abidjan'),
  ('00000000-0000-0000-0000-0000000000c2', 'defile', 'DEFILE PASSE', current_date - 3, 'Sofitel', 'Abidjan');

-- (d'autres mannequins existent déjà dans la base d'essai : on compte tout le monde)
create temp table attendu as select count(*)::int n, count(*) filter (where places_sexe(category, civilite) = 'femme')::int f from model_profiles where published and not desactive;
grant select on attendu to authenticated;
-- l'agence ouvre l'appel et prépare les liens
select essai_qui('00000000-0000-0000-0000-0000000000a2');
set role authenticated;
insert into places_appels (projet_id, places_femmes, places_hommes) values ('00000000-0000-0000-0000-0000000000c1', 2, 1), ('00000000-0000-0000-0000-0000000000c2', 1, 0);
select essai(places_preparer('00000000-0000-0000-0000-0000000000c1') = (select n from attendu), 'agence : un lien pour chaque mannequin publiée');
select essai(places_preparer('00000000-0000-0000-0000-0000000000c1') = (select n from attendu), 'préparer deux fois : pas de doublon, liens gardés');
select essai(places_preparer('00000000-0000-0000-0000-0000000000c2') = (select f from attendu), 'projet sans place homme : seules les femmes sont invitées');
select essai((select string_agg(sexe, ',' order by model_id) from places_invitations where projet_id = '00000000-0000-0000-0000-0000000000c1' and model_id::text ~ '0000000000b[1-5]$') = 'femme,femme,femme,homme,homme', 'sexe : catégorie ou civilité (Mademoiselle new-face = femme, Monsieur = homme)');
reset role;
select essai(not exists (select 1 from places_invitations where model_id = '00000000-0000-0000-0000-0000000000b6'), 'mannequin en sourdine (non publiée) : pas de lien');
create temp table j as select model_id, jeton from places_invitations where projet_id = '00000000-0000-0000-0000-0000000000c1';
grant select on j to anon, authenticated;
create or replace function jt(n text) returns text language sql as $$ select jeton from j where model_id = ('00000000-0000-0000-0000-0000000000' || n)::uuid $$;
grant execute on function jt(text) to anon;

-- le public (sans compte) : rien en direct
select set_config('request.jwt.claims', '{"role":"anon"}', false);
set role anon;
select essai_refuse('select * from places_invitations', 'public : la table des invitations est fermée');
select essai_refuse('select * from places_appels', 'public : la table des appels est fermée');
select essai(places_lire('x') is null and places_lire(repeat('0', 36)) is null, 'lien inconnu : rien');
select essai((places_lire(jt('b1')) ->> 'statut') = 'invite' and (places_lire(jt('b1')) ->> 'places_femmes') = '2' and (places_lire(jt('b1')) ->> 'nom') = 'AWA KONÉ' and not (places_lire(jt('b1')) ? 'adresse'), 'lien d''Awa : le projet, son nom, les places, pas d''adresse');
select essai(places_prendre(jt('b1')) = 'pris', 'Awa prend sa place');
select essai(places_prendre(jt('b1')) = 'deja', 'Awa reclique : déjà prise, pas de seconde place');
select essai(places_prendre(jt('b2'), true) = 'pris', 'la maman d''Ama prend la place de sa fille');
select essai(places_prendre(jt('b2')) = 'deja' and (places_lire(jt('b2')) ->> 'pris_par') = 'parent', 'Ama clique ensuite : déjà prise par sa maman');
select essai(places_prendre(jt('b3')) = 'complet', 'Fatou arrive troisième : plus de place femme');
select essai(places_prendre(jt('b4')) = 'pris' and places_prendre(jt('b5')) = 'complet', 'hommes : 1 place, Jean la prend, Koffi trop tard');
select essai(jsonb_array_length(places_lire(jt('b3')) -> 'pris') = 3 and (places_lire(jt('b3')) -> 'pris' -> 0 ->> 'photo') = 'https://exemple.ci/awa.jpg' and (places_lire(jt('b3')) -> 'pris' -> 0 ->> 'initiales') = 'AK'
  and not (places_lire(jt('b3')) -> 'pris' -> 0 ? 'nom'), 'grille : 3 places prises, photo ou initiales, jamais les noms des autres');
select essai((places_lire(jt('b3')) -> 'pris' -> 1 ->> 'photo') is null and (places_lire(jt('b3')) -> 'pris' -> 1 ->> 'initiales') = 'AP', 'grille : jamais le visage d''une mineure (Ama : initiales seulement)');
select essai((places_lire(jt('b1')) -> 'pris' -> 0 ->> 'moi') = 'true' and (places_lire(jt('b3')) -> 'pris' -> 0 ->> 'moi') = 'false', 'grille : « moi » repère sa propre place');
select essai(places_rendre(jt('b3')) = 'pas_pris', 'Fatou ne peut pas rendre une place qu''elle n''a pas');
select essai(places_rendre(jt('b1')) = 'desiste', 'Awa se désiste');
select essai(places_prendre(jt('b3')) = 'pris', 'la place libérée : Fatou la prend');
select essai(places_prendre(jt('b1')) = 'complet', 'Awa veut revenir : plus de place');
reset role;
-- le formulaire de l'agenda enregistre une liste ancienne (sans Fatou) : Fatou reste dans le projet
update agenda_projets set mannequin_ids = array['00000000-0000-0000-0000-0000000000b2']::uuid[] where id = '00000000-0000-0000-0000-0000000000c1';
select essai((select mannequin_ids from agenda_projets where id = '00000000-0000-0000-0000-0000000000c1') @> array['00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b4']::uuid[], 'agenda enregistré avec une liste ancienne : les sélectionnées restent dans le projet');
set role anon;
reset role;
select essai((select mannequin_ids from agenda_projets where id = '00000000-0000-0000-0000-0000000000c1') @> array['00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b4']::uuid[]
  and not (select mannequin_ids from agenda_projets where id = '00000000-0000-0000-0000-0000000000c1') @> array['00000000-0000-0000-0000-0000000000b1']::uuid[], 'agenda : les gagnantes sont dans le projet, Awa (désistée) n''y est plus');
-- désistement d'une personne déjà convoquée : notée absente, envois programmés annulés
insert into convocation_participants (id, projet_id, model_id, nom) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b4', 'Monsieur JEAN YAO');
insert into convocation_envois (projet_id, participant_id, sorte, canal, statut, prevu_le) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 'rappel', 'email', 'programme', now() + interval '10 days'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 'selection', 'email', 'envoye', now());
set role anon;
select essai(places_rendre(jt('b4')) = 'desiste', 'Jean, déjà convoqué, se désiste');
reset role;
select essai((select reponse from convocation_participants where id = '00000000-0000-0000-0000-0000000000d1') = 'absent'
  and (select string_agg(statut, ',' order by sorte) from convocation_envois where participant_id = '00000000-0000-0000-0000-0000000000d1') = 'annule,envoye', 'Jean : noté absent, son rappel programmé annulé, le message déjà parti reste');
-- une place se libère (Fatou se désiste) et Jean revient : plus « absent », son rappel repart
update places_appels set places_hommes = 1 where projet_id = '00000000-0000-0000-0000-0000000000c1';
set role anon;
select essai(places_prendre(jt('b4')) = 'pris', 'Jean reprend sa place');
reset role;
select essai((select reponse from convocation_participants where id = '00000000-0000-0000-0000-0000000000d1') is null
  and (select statut from convocation_envois where participant_id = '00000000-0000-0000-0000-0000000000d1' and sorte = 'rappel') = 'programme', 'Jean : plus noté absent, son rappel de la veille repart');
-- appel fermé, projet passé
update places_appels set ouvert = false where projet_id = '00000000-0000-0000-0000-0000000000c1';
set role anon;
select essai(places_prendre(jt('b5')) = 'ferme', 'appel fermé par l''agence : plus personne ne prend de place');
reset role;
select essai(places_prendre((select jeton from places_invitations where projet_id = '00000000-0000-0000-0000-0000000000c2' limit 1)) = 'termine', 'projet passé : terminé');
-- un compte mannequin connecté (non admin) ne prépare rien et ne lit pas les tables
select essai_qui('00000000-0000-0000-0000-0000000000a5');
set role authenticated;
select essai_refuse('select places_preparer(''00000000-0000-0000-0000-0000000000c1'')', 'mannequin connectée : ne peut pas préparer les liens');
select essai((select count(*) from places_invitations) = 0, 'mannequin connectée : ne voit aucune invitation');
reset role;
-- premier arrivé même quand tout le monde clique en même temps : vérifié par le verrou (for update)
