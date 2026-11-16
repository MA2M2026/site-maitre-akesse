-- Essais de supabase-suppression-messages.sql (demande de la propriétaire, 16/11/2026) : seul le principal supprime
-- un message de contact, une candidature ou une demande recruteur
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
insert into messages_contact (id, nom, email, message) values ('00000000-0000-0000-0000-0000000c7a01', 'ESSAI CONTACT', 'essai@test.ci', 'test') on conflict do nothing;
insert into recruiter_requests (id, contact_name, email) values ('00000000-0000-0000-0000-0000000c7b01', 'ESSAI RECRUTEUR', 'essai@test.ci') on conflict do nothing;
insert into casting_applications (id, full_name, email, status) values ('00000000-0000-0000-0000-0000000c7c01', 'ESSAI CANDIDATE', 'essai@test.ci', 'nouvelle') on conflict do nothing;
set role authenticated;
-- l'équipe du site : ne supprime rien (même avec la double authentification)
select essai_qui('00000000-0000-0000-0000-0000000000a2');
delete from messages_contact where id = '00000000-0000-0000-0000-0000000c7a01';
delete from recruiter_requests where id = '00000000-0000-0000-0000-0000000c7b01';
delete from casting_applications where id = '00000000-0000-0000-0000-0000000c7c01';
reset role;
select set_config('request.jwt.claims', '', false);
select essai((select count(*) from messages_contact where id = '00000000-0000-0000-0000-0000000c7a01') = 1
  and (select count(*) from recruiter_requests where id = '00000000-0000-0000-0000-0000000c7b01') = 1
  and (select count(*) from casting_applications where id = '00000000-0000-0000-0000-0000000c7c01') = 1,
  'administrateur du site : ne supprime ni message de contact, ni demande recruteur, ni candidature');
-- le principal : supprime les trois
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
delete from messages_contact where id = '00000000-0000-0000-0000-0000000c7a01';
delete from recruiter_requests where id = '00000000-0000-0000-0000-0000000c7b01';
delete from casting_applications where id = '00000000-0000-0000-0000-0000000c7c01';
reset role;
select set_config('request.jwt.claims', '', false);
select essai((select count(*) from messages_contact where id = '00000000-0000-0000-0000-0000000c7a01') = 0
  and (select count(*) from recruiter_requests where id = '00000000-0000-0000-0000-0000000c7b01') = 0
  and (select count(*) from casting_applications where id = '00000000-0000-0000-0000-0000000c7c01') = 0,
  'administratrice principale : supprime le message de contact, la demande recruteur et la candidature d''essai');
