-- Essais de supabase-textes-pages.sql (Extension 151, 01/11/2026) : tout le monde lit les textes des pages ;
-- seule l'équipe du site les modifie (par textes_pages_enregistrer) ; un texte vide rend le texte d'origine.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
set role authenticated;
-- l'administrateur du site (a2) enregistre deux textes de Services
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select essai(textes_pages_enregistrer('services', '[{"cle":"services-1","fr":"  Nouveau texte  ","en":""},{"cle":"services-2","fr":"Autre","en":"Other"}]'::jsonb) = 2, 'équipe du site : enregistre les textes d''une page');
reset role;
select essai((select fr from textes_pages where cle = 'services-1') = 'Nouveau texte' and (select en from textes_pages where cle = 'services-1') is null, 'espaces retirés ; anglais vide = texte d''origine');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select essai_refuse($$select textes_pages_enregistrer('services', '[{"cle":"qui-sommes-nous-1","fr":"x"}]'::jsonb)$$, 'un repère d''une autre page : refusé');
select essai_refuse($$select textes_pages_enregistrer('accueil', '[{"cle":"accueil-1","fr":"x"}]'::jsonb)$$, 'une page non prévue : refusée');
select essai_refuse($$select textes_pages_enregistrer('services', jsonb_build_array(jsonb_build_object('cle','services-3','fr',repeat('a', 4001))))$$, 'texte de plus de 4000 caractères : refusé');
-- remettre le texte d'origine : la ligne vide disparaît
select textes_pages_enregistrer('services', '[{"cle":"services-2","fr":"","en":""}]'::jsonb);
reset role;
select essai(not exists (select 1 from textes_pages where cle = 'services-2') and exists (select 1 from textes_pages where cle = 'services-1'), 'texte remis à l''origine : ligne retirée, les autres restent');
-- une personne sans rôle ne modifie rien ; on n'écrit jamais directement dans la table
set role authenticated;
select essai_qui('00000000-0000-0000-0000-000000000fd3', 'aal2', 30, 'appareil-demande-0003');
select essai_refuse($$select textes_pages_enregistrer('services', '[{"cle":"services-1","fr":"pirate"}]'::jsonb)$$, 'personne sans rôle : refusé');
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select essai_refuse($$update textes_pages set fr = 'direct' where cle = 'services-1'$$, 'écriture directe dans la table : refusée');
reset role;
-- les visiteurs lisent (textes publics), sans écrire
set role anon;
select essai((select count(*) from textes_pages) = 1, 'visiteur : lit les textes des pages');
reset role;
select essai_refuse($$set role anon; select textes_pages_enregistrer('services', '[]'::jsonb)$$, 'visiteur : ne modifie rien');
reset role;
