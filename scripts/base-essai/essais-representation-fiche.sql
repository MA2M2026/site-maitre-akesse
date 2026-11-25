-- Essais de supabase-representation-fiche.sql : fiche créée depuis une candidature de représentation simple,
-- sans doublon ni mensualité, et code d espace sans paiement pour elle seulement.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
select set_config('essai.tn', formulaire_public_enregistrer('casting_applications', '{"full_name":"Yao Representee","email":"Yao@Exemple.ci","phone":"+225 07 07 07 07 21","city":"Cocody","mineur":false,"genre":"femme","type_candidature":"agence","message":"Parcours choisi : Talent Network\n\nBonjour"}'::jsonb, '9.9.9.41')::text, false);
select set_config('essai.ac', formulaire_public_enregistrer('casting_applications', '{"full_name":"Yao Academie","email":"ya@exemple.ci","phone":"+225 0707070722","mineur":false,"genre":"femme","type_candidature":"agence","message":"Parcours choisi : MA2M Academy\n\nBonjour"}'::jsonb, '9.9.9.42')::text, false);
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai_refuse($$select representation_creer_fiche(current_setting('essai.tn')::uuid)$$, 'candidature pas encore retenue : refusé');
update casting_applications set status = 'retenue' where id in (current_setting('essai.tn')::uuid, current_setting('essai.ac')::uuid);
select essai_refuse($$select representation_creer_fiche(current_setting('essai.ac')::uuid)$$, 'candidature MA2M Academy : pas de fiche gratuite');
select set_config('essai.m', representation_creer_fiche(current_setting('essai.tn')::uuid)::text, false);
select essai(representation_creer_fiche(current_setting('essai.tn')::uuid) = current_setting('essai.m')::uuid, 'deuxième clic : la même fiche, pas de doublon');
reset role;
select essai((select full_name = 'Yao Representee' and telephone = '2250707070721' and email = 'yao@exemple.ci' and ville = 'Cocody' and genre = 'femme' and user_id is null
  from agence_mannequins where id = current_setting('essai.m')::uuid), 'fiche : informations recopiées de la candidature');
select essai((select count(*) = 1 from relations_ma2m where mannequin_id = current_setting('essai.m')::uuid and sorte = 'talent_network' and statut = 'en_attente'), 'relation Talent Network en attente du contrat');
select essai((select formation_fin(current_setting('essai.m')::uuid) < formation_debut(current_setting('essai.m')::uuid)), 'aucune formation : la fin est avant le début, jamais de mensualité due');
select essai((select mensualite_etat_regle(current_setting('essai.m')::uuid, (reprise_date() + interval '1 month')::date, formation_fin(current_setting('essai.m')::uuid), false) = 'termine'), 'après la reprise : rien à payer (terminé)');
-- code d espace : sans paiement pour la représentation simple, toujours refusé sans paiement pour les autres
with i as (insert into agence_mannequins (full_name, genre) values ('Sans Paiement Ni Contrat', 'femme') returning id) select set_config('essai.sans', id::text, false) from i;
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai(code_espace_creer(current_setting('essai.m')::uuid) like 'ESP-%', 'représentation simple : code d espace créé sans paiement');
select essai_refuse($$select code_espace_creer(current_setting('essai.sans')::uuid)$$, 'sans inscription payée ni représentation : toujours refusé');
-- une personne qui n est pas de l équipe ne crée rien
select essai_qui('00000000-0000-0000-0000-0000000000b9');
select essai_refuse($$select representation_creer_fiche(current_setting('essai.tn')::uuid)$$, 'personne hors équipe : refusé');
reset role;
set role anon;
select essai_refuse($$select representation_creer_fiche(current_setting('essai.tn')::uuid)$$, 'visiteur : refusé');
reset role;
