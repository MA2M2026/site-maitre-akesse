-- Essais de supabase-app-mannequin.sql (25/10/2026) : une mannequin connectée ne voit que SES
-- convocations déjà envoyées (pas celles du parent, pas celles pas encore envoyées, rien des
-- autres) ; un visiteur n'a rien.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
insert into agenda_projets (id, type, titre, date_debut) values
  ('00000000-0000-0000-0000-0000000000a5', 'defile', 'APP ENVOYÉ', current_date + 10),
  ('00000000-0000-0000-0000-0000000000a6', 'shooting', 'APP PAS ENVOYÉ', current_date + 12) on conflict (id) do nothing;
insert into convocation_participants (id, projet_id, model_id, nom, parent, jeton) values
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000b1', 'Mademoiselle AWA', false, repeat('p', 36)),
  ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000b1', 'Parent de AWA', true, repeat('q', 36)),
  ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000000b1', 'Mademoiselle AWA', false, repeat('r', 36)),
  ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000b9', 'Bintou', false, repeat('s', 36));
insert into convocation_envois (projet_id, participant_id, sorte, canal, prevu_le, statut) values
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000d5', 'convocation', 'email', now(), 'envoye'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000d6', 'convocation', 'email', now(), 'envoye'),
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000000d7', 'convocation', 'email', now() + interval '1 day', 'programme'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000d8', 'convocation', 'whatsapp', now(), 'a_faire');
-- b1 est aussi au registre (avec son compte) et dans le carnet : convoquée par sa fiche du carnet
-- au même défilé (doublon) et seule à un autre projet, où son parent est aussi convoqué
insert into agence_mannequins (full_name, user_id) select 'AWA', '00000000-0000-0000-0000-0000000000b1'
  where not exists (select 1 from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1');
insert into contacts_externes (id, civilite, nom, mannequin_id) select '00000000-0000-0000-0000-0000000000c7', 'Mademoiselle', 'AWA', id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1';
insert into agenda_projets (id, type, titre, date_debut, heure, heure_evenement) values ('00000000-0000-0000-0000-0000000000a7', 'shooting', 'APP CARNET', current_date + 20, 'NOTE INTERNE', '18:00') on conflict (id) do nothing;
insert into convocation_participants (id, projet_id, contact_id, nom, parent, jeton) values
  ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000c7', 'Mademoiselle AWA', false, repeat('t', 36)),
  ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000c7', 'Mademoiselle AWA', false, repeat('v', 36)),
  ('00000000-0000-0000-0000-0000000000db', '00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000c7', 'Parent de AWA', true, repeat('w', 36));
insert into convocation_envois (projet_id, participant_id, sorte, canal, prevu_le, statut) values
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000d9', 'convocation', 'email', now(), 'envoye'),
  ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000da', 'convocation', 'email', now(), 'envoye'),
  ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000db', 'convocation', 'email', now(), 'envoye');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select essai((select count(*) from app_mes_evenements()) = 2 and (select jeton from app_mes_evenements() where titre = 'APP ENVOYÉ') = repeat('p', 36),
  'mannequin : ses convocations envoyées, une fois par projet (celle de son profil), avec son lien — pas celle du parent, pas celle pas encore envoyée');
select essai((select jeton from app_mes_evenements() where titre = 'APP CARNET') = repeat('v', 36), 'mannequin du registre : la convocation de sa fiche du carnet, pas celle de son parent');
select essai((select heure_evenement from app_mes_evenements() where titre = 'APP CARNET') = '18:00'
  and (select row_to_json(x)::text from app_mes_evenements() x where titre = 'APP CARNET') not like '%NOTE INTERNE%', 'heure de l’événement, jamais les notes internes de l’agence');
select essai((select bool_and(not passe) from app_mes_evenements()), 'mannequin : « à venir »');
select essai_qui('00000000-0000-0000-0000-0000000000b9', 'aal1');
select essai((select count(*) from app_mes_evenements()) = 1 and (select jeton from app_mes_evenements()) = repeat('s', 36), 'autre mannequin : seulement la sienne (WhatsApp à envoyer à la main compte)');
reset role;
set role anon;
select essai_refuse($$select * from app_mes_evenements()$$, 'visiteur : refusé');
reset role;
delete from agenda_projets where id in ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000000a7');
delete from contacts_externes where id = '00000000-0000-0000-0000-0000000000c7';
