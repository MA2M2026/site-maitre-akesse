-- Essais de supabase-traductions.sql (26/10/2026) : l'anglais des textes de l'Administration.
-- Tout le monde lit l'anglais (par l'empreinte), personne ne lit le français stocké ; seule
-- l'équipe du site écrit ; la clé suit toujours le texte français.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select essai((select count(*) from traductions_en) >= 60, 'traductions des textes déjà publiés enregistrées');
select essai((select en from traductions_en where cle = traduction_cle('CASTING NEWFACE')) = 'NEW FACE CASTING', 'clé = empreinte du texte français');
select essai(traduction_cle(E'  Bonjour\n') = traduction_cle('Bonjour'), 'espaces et retours au début ou à la fin : même clé');
-- visiteur
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select essai((select en from traductions_en where cle = traduction_cle('Défilé')) = 'Runway show', 'visiteur : lit l''anglais');
select essai_refuse('select fr from traductions_en limit 1', 'visiteur : ne lit pas le texte français stocké');
select essai_refuse($$insert into traductions_en (fr, en) values ('x', 'y')$$, 'visiteur : n''écrit rien');
-- mannequin connectée
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select essai_refuse('select fr from traductions_en limit 1', 'mannequin : ne lit pas le texte français stocké');
select essai_refuse($$insert into traductions_en (fr, en) values ('x', 'y')$$, 'mannequin : n''écrit rien');
select essai_refuse($$select traduction_enregistrer('x', 'y')$$, 'mannequin : la fonction d''écriture lui est refusée');
-- équipe du site
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select traduction_enregistrer('Texte d''essai', 'Test text');
select essai((select en from traductions_en where cle = traduction_cle('Texte d''essai')) = 'Test text', 'équipe du site : ajoute une traduction');
select traduction_enregistrer(E'Texte d''essai\n', 'Test text, corrected');
select essai((select en from traductions_en where cle = traduction_cle('Texte d''essai')) = 'Test text, corrected', 'équipe du site : corrige une traduction (même texte, même clé)');
select essai_refuse($$insert into traductions_en (fr, en) values ('x', 'y')$$, 'équipe du site : jamais d''écriture directe, seulement par la fonction');
select traduction_enregistrer('Texte d''essai', '');
select essai(not exists (select 1 from traductions_en where cle = traduction_cle('Texte d''essai')), 'équipe du site : anglais vide = traduction retirée');
reset role;
