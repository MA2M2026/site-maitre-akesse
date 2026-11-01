-- Essais de supabase-documents.sql (Extension 147, 01/11/2026) : l'équipe note les documents et leur date de
-- fin ; alertes du matin une seule fois (30 jours avant, puis le jour de la fin) ; personne d'autre n'y touche.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
create temp table docs as select
  document_enregistrer(null, '00000000-0000-0000-0000-0000000000d1', 'autorisation_parentale', 'Autorisation 2026', current_date + 20, null) as bientot,
  document_enregistrer(null, '00000000-0000-0000-0000-0000000000d1', 'piece_identite', 'CNI', current_date - 1, 'à renouveler') as expire,
  document_enregistrer(null, '00000000-0000-0000-0000-0000000000d1', 'contrat', null, current_date + 200, null) as loin;
select essai(json_array_length(documents_liste() -> 'documents') >= 3, 'équipe : documents enregistrés');
select essai((documents_liste() -> 'documents') -> 0 ->> 'sorte' = 'piece_identite', 'triés par date de fin (le plus urgent d''abord)');
select essai_refuse($$select document_enregistrer(null, '00000000-0000-0000-0000-0000000000d1', 'contrat', null, null, null)$$, 'date de fin obligatoire');
select essai_refuse($$select document_enregistrer(null, '00000000-0000-0000-0000-0000000000d1', 'passeport_magique', null, current_date, null)$$, 'sorte inconnue : refusée');
reset role;
set role service_role;
create temp table alertes1 as select documents_alertes_du_jour() as j;
select essai((select json_array_length(j) from alertes1) = 2, 'matin : 2 alertes (expiré, et dans 20 jours), pas celui dans 200 jours');
select essai((select j::text from alertes1) like '%"quoi" : "expire"%' and (select j::text from alertes1) like '%"quoi" : "bientot"%', 'alertes : « expiré » et « bientôt »');
select essai(json_array_length(documents_alertes_du_jour()) = 0, 'le lendemain : pas deux fois la même alerte');
reset role;
-- nouvelle date de fin : les alertes repartent
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select document_enregistrer((select expire from docs), '00000000-0000-0000-0000-0000000000d1', 'piece_identite', 'CNI', current_date + 10, null);
reset role;
set role service_role;
select essai(json_array_length(documents_alertes_du_jour()) = 1, 'date de fin changée : une nouvelle alerte « bientôt »');
reset role;
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select document_supprimer((select loin from docs));
select essai(json_array_length(documents_liste() -> 'documents') = 2, 'équipe : document supprimé');
select essai_refuse($$select documents_alertes_du_jour()$$, 'équipe : les alertes sont pour le serveur seulement');
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select essai_refuse($$select documents_liste()$$, 'mannequin : ne voit pas les documents de l''agence');
select essai_refuse($$select * from documents_mannequins$$, 'table pas lisible directement');
reset role;
set role anon;
select essai_refuse($$select documents_liste()$$, 'visiteur : refusé');
reset role;
-- encaissements et comptable : pas l'espace « Administration du site », donc pas les documents (relecture du 01/11/2026)
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select essai_refuse($$select documents_liste()$$, 'encaissements : pas d''accès aux documents des mannequins');
select essai_refuse($$select document_supprimer(gen_random_uuid())$$, 'encaissements : ne peut rien supprimer');
select essai_qui('00000000-0000-0000-0000-0000000000a4');
select essai_refuse($$select documents_liste()$$, 'comptable : pas d''accès aux documents des mannequins');
reset role;
