-- Essais de supabase-refonte-agence-academy.sql : porte de candidature recopiée du message, relations avec MA2M
-- (Agency Roster et formation pour les mannequins déjà là), lecture et écriture réservées à l équipe, fin de contrat.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
-- porte : par le même chemin que le site (formulaire public)
select set_config('essai.porte1', formulaire_public_enregistrer('casting_applications', '{"full_name":"Kone Reseau","email":"r@exemple.ci","phone":"+225 0505050511","mineur":false,"genre":"femme","type_candidature":"agence","message":"Parcours choisi : Talent Network\n\nBonjour, voici mon book."}'::jsonb, '9.9.9.31')::text, false);
select set_config('essai.porte2', formulaire_public_enregistrer('casting_applications', '{"full_name":"Kone Academie","email":"a@exemple.ci","phone":"+225 0505050512","mineur":false,"genre":"femme","type_candidature":"agence","message":"Parcours choisi : MA2M Academy\n\nBonjour, je débute."}'::jsonb, '9.9.9.32')::text, false);
select set_config('essai.porte3', formulaire_public_enregistrer('casting_applications', '{"full_name":"Kone Sans Porte","email":"s@exemple.ci","phone":"+225 0505050513","mineur":false,"genre":"femme","type_candidature":"agence","message":"Bonjour, ancienne page."}'::jsonb, '9.9.9.33')::text, false);
select essai((select porte = 'reseau' from casting_applications where id = current_setting('essai.porte1')::uuid), 'porte Talent Network recopiée du message');
select essai((select porte = 'academie' from casting_applications where id = current_setting('essai.porte2')::uuid), 'porte MA2M Academy recopiée du message');
select essai((select porte is null from casting_applications where id = current_setting('essai.porte3')::uuid), 'candidature sans porte (ancienne page) : rien d inventé');
select essai_refuse($$update casting_applications set porte = 'autre' where id = current_setting('essai.porte1')::uuid$$, 'porte inconnue refusée');
-- mannequins déjà inscrites : Agency Roster et formation initiale
select essai((select count(*) = 2 and bool_and(statut in ('active', 'suspendue', 'terminee')) from relations_ma2m where mannequin_id = '00000000-0000-0000-0000-0000000000d1'),
  'mannequin déjà inscrite : rangée en Agency Roster et en formation initiale');
select essai((select fin = (debut + interval '5 years')::date from relations_ma2m where mannequin_id = '00000000-0000-0000-0000-0000000000d1' and sorte = 'agency_roster'), 'Agency Roster : 5 ans');
select essai((select fin = (debut + interval '2 years')::date from relations_ma2m where mannequin_id = '00000000-0000-0000-0000-0000000000d1' and sorte = 'formation_initiale'), 'formation initiale : 2 ans');
-- un visiteur ou une mannequin ne lit ni n écrit les relations des autres
set role anon;
select essai_refuse($$select * from relations_ma2m$$, 'visiteur : aucune lecture directe');
select essai_refuse($$select relations_liste(null)$$, 'visiteur : pas de liste');
reset role;
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b9');
select essai_refuse($$select relations_liste(null)$$, 'personne qui n est pas de l équipe : pas de liste');
select essai_refuse($$select relation_enregistrer(null, '00000000-0000-0000-0000-0000000000d1', 'talent_network', null, null, null, null)$$, 'personne qui n est pas de l équipe : n ouvre pas de relation');
-- l équipe ouvre une relation Talent Network (2 ans par défaut) et la lit
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select set_config('essai.rel', relation_enregistrer(null, '00000000-0000-0000-0000-0000000000d2', 'talent_network', null, current_date - 800, null, 'essai')::text, false);
select essai((select count(*) = 1 from relations_liste('00000000-0000-0000-0000-0000000000d2') where sorte = 'talent_network'), 'équipe : relation Talent Network ouverte et lue');
select essai_refuse($$select relation_enregistrer(null, '00000000-0000-0000-0000-0000000000d2', 'talent_network', null, null, null, null)$$, 'deux relations Talent Network ouvertes en même temps : refusé');
reset role;
-- fin de contrat : la relation échue (débutée il y a 800 jours, 2 ans) devient terminée, rien n est effacé
select essai(relations_terminer_echues() >= 1, 'la nuit : les contrats échus sont terminés');
select essai((select statut = 'terminee' from relations_ma2m where id = current_setting('essai.rel')::uuid), 'relation Talent Network échue : terminée, gardée');
select essai((select count(*) = 1 from cron.job where jobname = 'relations-fin-de-contrat'), 'tâche de la nuit programmée');
