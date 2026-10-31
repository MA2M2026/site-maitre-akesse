-- Essais de supabase-anniversaires.sql (Extension 143, 01/11/2026) : anniversaires du jour (actives
-- seulement), une seule fois par an, message déposé dans l'application ; seul le serveur appelle.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
insert into agence_mannequins (id, full_name, date_naissance, email, statut, user_id) values
  ('00000000-0000-0000-0000-000000000ae1', 'ANNIV AUJOURDHUI', (current_date - interval '21 years')::date, 'anniv@test.ci', 'actif', null),
  ('00000000-0000-0000-0000-000000000ae2', 'ANNIV DEMAIN', (current_date - interval '21 years' + interval '1 day')::date, 'demain@test.ci', 'actif', null),
  ('00000000-0000-0000-0000-000000000ae3', 'ANNIV SORTIE', (current_date - interval '19 years')::date, 'sortie@test.ci', 'sorti', null)
on conflict (id) do nothing;
-- une mannequin avec son compte (application) dont c'est aussi l'anniversaire
update agence_mannequins set date_naissance = (current_date - interval '16 years')::date, statut = 'actif'
  where user_id = '00000000-0000-0000-0000-0000000000b1';
set role service_role;
select essai(anniversaires_du_jour()::text like '%ANNIV AUJOURDHUI%', 'serveur : l''anniversaire du jour est dans la liste');
select essai(anniversaires_du_jour()::text not like '%ANNIV DEMAIN%', 'serveur : pas celui de demain');
select essai(anniversaires_du_jour()::text not like '%ANNIV SORTIE%', 'serveur : pas une mannequin sortie de l''agence');
select essai(anniversaire_noter((select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1'), '🎂 Joyeux anniversaire !', 'Texte', true), 'serveur : anniversaire noté');
select essai(not anniversaire_noter((select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1'), '🎂 Joyeux anniversaire !', 'Texte', true), 'une seule fois par an (pas de second message)');
select essai(anniversaires_du_jour()::text not like '%' || (select full_name from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1') || '%', 'déjà souhaité : plus dans la liste du jour');
reset role;
select essai((select count(*) from app_messages where user_id = '00000000-0000-0000-0000-0000000000b1' and titre like '🎂%') = 1, 'le message est dans son application (une seule fois)');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai_refuse($$select anniversaires_du_jour()$$, 'même le principal ne lit pas la liste directement (serveur seulement)');
select essai_refuse($$select anniversaire_noter('00000000-0000-0000-0000-000000000ae1', 'x', 'y', true)$$, 'personne d''autre ne peut déposer un message d''anniversaire');
select essai_refuse($$select * from anniversaires_envoyes$$, 'la table n''est pas lisible directement');
reset role;
set role anon;
select essai_refuse($$select anniversaires_du_jour()$$, 'visiteur : refusé');
reset role;
