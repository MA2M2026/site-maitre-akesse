-- Essais de supabase-app-messages.sql (26/10/2026) : la boîte de réception de l'application.
-- Chaque mannequin ne lit que SES messages ; seule l'agence (gestion du site) envoie ; les envois
-- déjà faits par WhatsApp / e-mail (sélection, convocation, places, mensualités, paiements,
-- cachets) y arrivent tout seuls, une seule fois ; jamais pour un visiteur.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select essai(exists (select 1 from pg_trigger where tgname = 'trg_notif_app_messages'), 'chaque nouveau message déclenche la notification sur le téléphone');
-- l'envoi par l'agence
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select essai(app_messages_envoyer(array['m:00000000-0000-0000-0000-0000000000b1', 'r:' || (select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1'),
    'm:00000000-0000-0000-0000-0000000000ff', 'e:ROXANE@test.ci', 'x:rien'], 'casting', 'Casting Kouroukan', 'Préparez-vous', 'https://exemple.ci/a.jpg', null, '/app/#messages') = 1,
  'agence : une mannequin choisie de plusieurs façons ne reçoit qu''UN message ; sans compte, rien');
select essai(app_messages_envoyer(array['m:00000000-0000-0000-0000-0000000000b1'], 'info', 'Bonjour', 'Chère {prénom}, à bientôt.') = 1, 'agence : « {prénom} » écrit dans le message');
select essai_refuse($$select app_messages_envoyer(array['m:00000000-0000-0000-0000-0000000000b1'], 'info', 'x', 'x', 'javascript:alert(1)')$$, 'image : seulement une adresse https');
select essai_refuse($$select app_messages_envoyer(array['m:00000000-0000-0000-0000-0000000000b1'], 'info', 'x', 'x', null, null, '//pirate.ci')$$, 'lien : seulement une page du site');
select essai_qui('00000000-0000-0000-0000-0000000000a4');
select essai_refuse($$select app_messages_envoyer(array['m:00000000-0000-0000-0000-0000000000b1'], 'info', 'x', 'x')$$, 'comptable : n''envoie rien');
-- la mannequin
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select essai((select count(*) from app_messages where titre = 'Casting Kouroukan' and user_id = auth.uid()) = 1, 'mannequin : lit son message');
select essai((select texte from app_messages where titre = 'Bonjour') = 'Chère ' || (select full_name from model_profiles where id = auth.uid()) || ', à bientôt.', 'mannequin : « {prénom} » remplacé par son nom');
select essai_refuse($$insert into app_messages (user_id, sorte, titre) values (auth.uid(), 'info', 'faux')$$, 'mannequin : n''écrit pas de message');
select essai_refuse($$update app_messages set titre = 'changé'$$, 'mannequin : ne change pas un message');
select app_messages_lus(array(select id from app_messages where titre = 'Casting Kouroukan'));
select essai((select lu_le is not null from app_messages where titre = 'Casting Kouroukan'), 'mannequin : marqué comme lu');
select essai_qui('00000000-0000-0000-0000-0000000000b9', 'aal1');
select essai((select count(*) from app_messages) = 0, 'autre mannequin : ne voit rien des messages des autres');
select app_messages_lus(array(select id from app_messages));
set role anon;
select essai_refuse($$select count(*) from app_messages$$, 'visiteur : rien à lire');
select essai_refuse($$select app_push_abonner('https://push.exemple/1', 'a', 'b')$$, 'visiteur : pas d''abonnement aux notifications');
-- téléphone de la mannequin : abonnement aux notifications
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select app_push_abonner('https://push.exemple/telephone-roxane', 'cle', 'secret');
select essai_refuse($$select * from app_push_abonnements$$, 'mannequin : ne lit pas la liste des téléphones abonnés');
reset role;
select essai((select user_id from app_push_abonnements where endpoint = 'https://push.exemple/telephone-roxane') = '00000000-0000-0000-0000-0000000000b1', 'son téléphone est abonné aux notifications');
select essai(app_a_un_telephone('00000000-0000-0000-0000-0000000000b1') and not app_a_un_telephone('00000000-0000-0000-0000-0000000000b9'), 'notification seulement pour qui a un téléphone abonné');
-- le même téléphone passe à une autre mannequin, qui se déconnecte ensuite
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b9', 'aal1');
select app_push_abonner('https://push.exemple/telephone-roxane', 'cle2', 'secret2');
select app_push_desabonner('https://push.exemple/telephone-roxane');
reset role;
select essai((select user_id = '00000000-0000-0000-0000-0000000000b9' and not actif from app_push_abonnements where endpoint = 'https://push.exemple/telephone-roxane'), 'téléphone passé à une autre mannequin, puis déconnexion : plus aucune notification sur ce téléphone');
update app_push_abonnements set user_id = '00000000-0000-0000-0000-0000000000b1', actif = true where endpoint = 'https://push.exemple/telephone-roxane';

-- envois automatiques
-- a) convocation (par sa fiche de profil) : un seul message, même envoyé par WhatsApp ET e-mail ; rien pour la ligne du parent
insert into agenda_projets (id, type, titre, date_debut, lieu, ville, heure_convocation) values ('00000000-0000-0000-0000-0000000000e1', 'defile', 'DÉFILÉ BOÎTE', current_date + 9, 'Sofitel', 'Abidjan', '14:00') on conflict (id) do nothing;
insert into convocation_participants (id, projet_id, model_id, nom, parent, jeton) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'Mademoiselle ROXANE', false, repeat('x', 36)),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'Parent de ROXANE', true, repeat('y', 36)) on conflict do nothing;
insert into convocation_envois (projet_id, participant_id, sorte, canal, prevu_le, statut) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2', 'selection', 'whatsapp', now(), 'a_faire'),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2', 'convocation', 'email', now() + interval '1 hour', 'programme'),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2', 'convocation', 'whatsapp', now(), 'a_faire'),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e3', 'convocation', 'whatsapp', now(), 'a_faire');
update convocation_envois set statut = 'envoye', envoye_le = now() where participant_id = '00000000-0000-0000-0000-0000000000e2' and canal = 'email';
select essai((select count(*) from app_messages where user_id = '00000000-0000-0000-0000-0000000000b1' and titre like '%DÉFILÉ BOÎTE') = 2
  and exists (select 1 from app_messages where titre = '🎉 Bonne nouvelle, vous êtes sélectionnée pour DÉFILÉ BOÎTE')
  and (select texte from app_messages where titre = '💌 Votre convocation pour DÉFILÉ BOÎTE') like 'Rendez-vous le % 20%, Sofitel, Abidjan, convocation à 14h00.%',
  'sélection puis convocation : un message chacune (pas une par canal, rien pour le parent), avec la date, le lieu et l''heure, au féminin');
select essai(not exists (select 1 from app_messages where titre like '%DÉFILÉ BOÎTE' and lien <> '/app/#evenements'), 'le message ouvre l''onglet Événements');
-- dates et lieux d'un projet sur plusieurs jours (mêmes phrases que les messages WhatsApp)
select essai(app_periode('2026-11-14', null) = 'le samedi 14 novembre 2026'
  and app_periode('2026-10-21', '2026-10-22') = 'du mercredi 21 au jeudi 22 octobre 2026'
  and app_periode('2026-10-30', '2026-11-01') = 'du vendredi 30 octobre au dimanche 1er novembre 2026'
  and app_periode('2026-12-31', '2027-01-01') = 'du jeudi 31 décembre 2026 au vendredi 1er janvier 2027', 'dates : un jour ou plusieurs, en une phrase, avec le « 1er »');
select essai(app_lieux(row(a.*)::agenda_projets) = 'Parc des Expositions et des Congrès, La Tribe, Noom Hôtel, Abidjan', 'lieux : ceux de chaque jour dans l''ordre, le lieu général pour un jour sans lieu, jamais coupés sur « et », sans doublon, puis la ville')
  from (select (jsonb_populate_record(null::agenda_projets, jsonb_build_object('lieu', 'Noom Hôtel', 'ville', 'Abidjan',
    'seances', '[{"jour":"2026-10-21","lieu":"Parc des Expositions et des Congrès, La Tribe"},{"jour":"2026-10-22","lieu":"la tribe"},{"jour":"2026-10-23","lieu":" \n"}]'::jsonb))).*) a;
select essai(app_lieux(row(a.*)::agenda_projets) = 'Sofitel Abidjan, Parc des Expositions', 'lieux : sans horaires par jour, le lieu général (découpé aux virgules), sans répéter la ville')
  from (select (jsonb_populate_record(null::agenda_projets, jsonb_build_object('lieu', 'Sofitel Abidjan, Parc des Expositions', 'ville', 'abidjan', 'seances', '[]'::jsonb))).*) a;
select essai(app_lieux(row(a.*)::agenda_projets) = 'Salle Germaine, Man', 'lieux : la ville comme mot entier (« Man » n''est pas dans « Salle Germaine »)')
  from (select (jsonb_populate_record(null::agenda_projets, jsonb_build_object('lieu', 'Salle Germaine', 'ville', 'Man', 'seances', '[]'::jsonb))).*) a;
select essai(app_lieux(row(a.*)::agenda_projets) = 'Noom, Sofitel', 'lieux : un jour vide prend le lieu général (comme en JS)')
  from (select (jsonb_populate_record(null::agenda_projets, jsonb_build_object('lieu', 'Noom', 'seances', '[null, {"lieu":"Sofitel"}]'::jsonb))).*) a;
-- b) places limitées : quand son lien part
update places_invitations set envoye_le = now() where model_id = '00000000-0000-0000-0000-0000000000b1' and envoye_le is null and statut <> 'exclu';
select essai(exists (select 1 from app_messages where user_id = '00000000-0000-0000-0000-0000000000b1' and sorte = 'places' and lien like '/places?c=%'), 'places limitées : son lien personnel dans l''application');
-- c) mensualités : appel puis relance du 3
delete from mensualites_appels where mannequin_id = (select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1');
insert into mensualites_appels (mois, mannequin_id) select date_trunc('month', now())::date, id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1' on conflict do nothing;
update mensualites_appels set relance3_le = now() where mannequin_id = (select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1');
select essai((select count(*) from app_messages where user_id = '00000000-0000-0000-0000-0000000000b1' and sorte = 'mensualite') = 2
  and exists (select 1 from app_messages where titre like '🔔 Petit rappel pour votre mensualité de%' and texte like '% FCFA à régler avant le 5%'), 'mensualités : l''appel du 1er et la relance du 3, avec le montant');
-- d) paiement vérifié par l'agence (les deux mois payés à l'avance dans essais-paiement-avance.sql)
set ma2m.decision = '1';  -- (comme le bouton « Valider », paiement_decider)
update paiements_mannequins set statut = 'valide', valide_le = now() where statut = 'declare' and mannequin_id = (select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1');
select essai((select count(*) from app_messages where user_id = '00000000-0000-0000-0000-0000000000b1' and titre like '✅ Paiement bien reçu pour votre mensualité de %') >= 2, 'paiement validé : « Paiement confirmé » pour chaque mois');
-- rejouer la même validation ne renvoie rien
update paiements_mannequins set motif = motif where mannequin_id = (select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1');
select essai((select count(*) from app_messages where cle like 'paiement:%') = (select count(distinct cle) from app_messages where cle like 'paiement:%'), 'jamais deux fois le même message automatique');
reset ma2m.decision;
-- e) un envoi automatique qui échouerait ne bloque jamais l'envoi d'origine
select essai((select count(*) from convocation_envois where participant_id = '00000000-0000-0000-0000-0000000000e2' and statut in ('envoye', 'a_faire')) = 3, 'les envois d''origine sont bien enregistrés');
reset role;
