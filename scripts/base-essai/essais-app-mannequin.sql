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
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select essai((select count(*) from app_mes_evenements()) = 1 and (select jeton from app_mes_evenements()) = repeat('p', 36),
  'mannequin : sa convocation envoyée, avec son lien — pas celle du parent, pas celle pas encore envoyée');
select essai((select titre from app_mes_evenements()) = 'APP ENVOYÉ' and (select not passe from app_mes_evenements()), 'mannequin : titre et « à venir »');
select essai_qui('00000000-0000-0000-0000-0000000000b9', 'aal1');
select essai((select count(*) from app_mes_evenements()) = 1 and (select jeton from app_mes_evenements()) = repeat('s', 36), 'autre mannequin : seulement la sienne (WhatsApp à envoyer à la main compte)');
reset role;
set role anon;
select essai_refuse($$select * from app_mes_evenements()$$, 'visiteur : refusé');
reset role;
delete from agenda_projets where id in ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a6');
