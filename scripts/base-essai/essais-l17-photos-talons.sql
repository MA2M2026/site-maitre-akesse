-- Essais L-17 (photos des cours de talons par Cloudflare) sur la base LOCALE jetable (jamais la vraie base)
-- (compteurs anti-robots remis à zéro : les essais précédents ont déjà rempli la limite globale)
delete from soumissions_formulaires_publics; delete from soumissions_formulaires_publics_ip;
set role service_role;
-- photo Cloudflare de CETTE inscription : acceptée
select formulaire_public_enregistrer('cours_talons',
  '{"id":"00000000-0000-0000-0000-0000000c1701","formule":"groupe","nom":"Aya R2","telephone":"+2250700001701","age":22,"photos":["r2:cours-talons/00000000-0000-0000-0000-0000000c1701/0123456789abcdef0123456789abcdef.jpg","https://drive.test/p2"]}'::jsonb, '3.17.0.1');
reset role;
select essai((select jsonb_array_length(photos) = 2 from cours_talons where id = '00000000-0000-0000-0000-0000000c1701'), 'L-17 : photo Cloudflare de l''inscription (r2:cours-talons/<son numéro>/…) acceptée, lien Drive aussi');
set role service_role;
delete from soumissions_formulaires_publics; delete from soumissions_formulaires_publics_ip;
select essai_refuse($$select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c1702","formule":"groupe","nom":"Autre dossier","telephone":"+2250700001702","age":22,"photos":["r2:cours-talons/00000000-0000-0000-0000-0000000c1701/0123456789abcdef0123456789abcdef.jpg"]}'::jsonb, '3.17.0.2')$$, 'L-17 : photo Cloudflare d''UNE AUTRE inscription : refusée');
delete from soumissions_formulaires_publics; delete from soumissions_formulaires_publics_ip;
select essai_refuse($$select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c1703","formule":"groupe","nom":"Mannequin","telephone":"+2250700001703","age":22,"photos":["r2:candidatures/00000000-0000-0000-0000-0000000c1703/0123456789abcdef0123456789abcdef.jpg"]}'::jsonb, '3.17.0.3')$$, 'L-17 : photo Cloudflare d''un autre dossier (candidatures) : refusée');
delete from soumissions_formulaires_publics; delete from soumissions_formulaires_publics_ip;
select essai_refuse($$select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c1704","formule":"groupe","nom":"Piège","telephone":"+2250700001704","age":22,"photos":["r2:cours-talons/00000000-0000-0000-0000-0000000c1704/../../x.svg"]}'::jsonb, '3.17.0.4')$$, 'L-17 : nom de fichier fabriqué : refusé');
delete from soumissions_formulaires_publics; delete from soumissions_formulaires_publics_ip;
select essai_refuse($$select formulaire_public_enregistrer('cours_talons', '{"formule":"groupe","nom":"Sans numéro","telephone":"+2250700001705","age":22,"photos":["r2:cours-talons/-/0123456789abcdef0123456789abcdef.jpg"]}'::jsonb, '3.17.0.5')$$, 'L-17 : inscription sans numéro : photo Cloudflare refusée');
delete from soumissions_formulaires_publics; delete from soumissions_formulaires_publics_ip;
select essai_refuse($$select formulaire_public_enregistrer('cours_talons', '{"formule":"groupe","nom":"Lien piège","telephone":"+2250700001706","age":22,"photos":["javascript:alert(1)"]}'::jsonb, '3.17.0.6')$$, 'L-17 : une photo qui n''est ni https ni Cloudflare reste refusée');
reset role;
