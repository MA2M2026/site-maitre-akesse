-- Essais des droits et des fonctions du portail (cahier v2.3, section 12) sur la base
-- LOCALE jetable. Chaque essai échoue bruyamment (exception) si le résultat n'est pas le bon.
-- Personnes fictives : P = principal, S = admin du site, C = encaissements, K = comptable,
-- M = mannequin avec compte, X = compte sans rôle.
\set ON_ERROR_STOP 1
set search_path = public, extensions;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'principal@test.ci'),
  ('00000000-0000-0000-0000-0000000000a2', 'site@test.ci'),
  ('00000000-0000-0000-0000-0000000000a3', 'caisse@test.ci'),
  ('00000000-0000-0000-0000-0000000000a4', 'compta@test.ci'),
  ('00000000-0000-0000-0000-0000000000a5', 'awa@test.ci'),
  ('00000000-0000-0000-0000-0000000000a6', 'inconnu@test.ci');
insert into staff_profiles (user_id, nom, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Maître Akesse', 'principal@test.ci', 'principal'),
  ('00000000-0000-0000-0000-0000000000a2', 'Gestion du site', 'site@test.ci', 'site'),
  ('00000000-0000-0000-0000-0000000000a3', 'Encaissements', 'caisse@test.ci', 'caisse'),
  ('00000000-0000-0000-0000-0000000000a4', 'Comptable', 'compta@test.ci', 'compta')
on conflict (user_id) do nothing;
update portail_reglages set seuil_double_validation = 100000;
insert into wave_links (type_droit, montant, url) values
  ('inscription', 25000, 'https://pay.wave.com/m/essai-25000'),
  ('formation', 10000, 'https://pay.wave.com/m/essai-10000'),
  ('formation', 20000, 'https://pay.wave.com/m/essai-20000');

-- Fonction d'essai : se mettre dans la peau de quelqu'un (jeton imité)
create or replace function essai_qui(p_uid text, p_aal text default 'aal2', p_totp_il_y_a int default 30)
returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', p_uid, 'role', 'authenticated', 'aal', p_aal,
    'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint - p_totp_il_y_a)))::text, false);
$$;
grant execute on function essai_qui(text, text, int) to authenticated;
create or replace function essai(p_ok boolean, p_libelle text) returns text language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception '❌ ÉCHEC : %', p_libelle; end if;
  return '✅ ' || p_libelle;
end;
$$;
grant execute on function essai(boolean, text) to authenticated;
create or replace function essai_refuse(p_sql text, p_libelle text) returns text language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return '✅ ' || p_libelle || ' (refusé : ' || left(sqlerrm, 70) || ')';
  end;
  raise exception '❌ ÉCHEC : % — accepté alors qu''il devait être refusé', p_libelle;
end;
$$;
grant execute on function essai_refuse(text, text) to authenticated;

-- Données : une candidature majeure retenue, une mineure, un mannequin au registre avec compte
insert into casting_applications (id, full_name, email, phone, date_naissance, genre)
values ('00000000-0000-0000-0000-00000000c001', 'Awa Koné', 'awa@test.ci', '0700000001', '2001-03-12', 'femme'),
       ('00000000-0000-0000-0000-00000000c002', 'Yao Bamba', '', '0700000002', '2012-05-03', 'homme');
-- ce qu'Awa a donné au casting (repris dans son espace mannequin) : ville, taille, deux photos
update casting_applications set city = 'Abidjan', height_cm = 176, hips_cm = 97 where id = '00000000-0000-0000-0000-00000000c001';
insert into casting_photos (application_id, url) values
  ('00000000-0000-0000-0000-00000000c001', 'https://photos.essai/casting-awa-1.jpg'),
  ('00000000-0000-0000-0000-00000000c001', 'https://photos.essai/casting-awa-2.jpg');
insert into agence_mannequins (id, nom, date_naissance, telephone, email, user_id, montant_mensuel, date_entree)
values ('00000000-0000-0000-0000-00000000e001', 'Fanta Sylla', '1999-11-20', '0700000003', 'fanta@test.ci',
        '00000000-0000-0000-0000-0000000000a5', 10000, '2026-01-10');

set role authenticated;

-- 5. Connexion sans MFA : aucun rôle
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal1');
select essai(portail_role() is null, 'test 5 : sans double authentification, aucun espace (même le principal)');
select essai((select count(*) from agence_mannequins) = 0, 'test 5 : sans double authentification, le registre ne renvoie rien');

-- Compte sans rôle : rien (moindre privilège)
select essai_qui('00000000-0000-0000-0000-0000000000a6');
select essai(portail_role() is null and not portail_peut('site'), 'un compte sans rôle n''a accès à rien');

-- 1 et 2. Administrateur du site : ni espace 2 ni espace 3, aucun montant, aucun contact privé
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select essai(portail_role() = 'site', 'l''administrateur du site est reconnu (double authentification faite)');
select essai((select count(*) from agence_mannequins) = 0, 'test 1 : l''administrateur du site ne lit pas le registre (espace 2)');
select essai((select count(*) from fee_dues) = 0 and (select count(*) from payments) = 0, 'test 1 : ni échéances ni paiements pour l''administrateur du site');
select essai((select count(*) from ledger_entries) = 0 and (select count(*) from invoices) = 0, 'test 1 : aucune donnée comptable pour l''administrateur du site');
select essai((select count(*) from wave_links) = 0, 'test 2 : aucun lien de paiement pour l''administrateur du site');
select essai((select phone from v_site_candidatures where id = '00000000-0000-0000-0000-00000000c001') is null
             and (select full_name from v_site_candidatures where id = '00000000-0000-0000-0000-00000000c001') = 'Awa Koné',
             'test 2 : candidatures visibles SANS téléphone ni e-mail pour l''administrateur du site');
select essai(registre_destinataire('00000000-0000-0000-0000-00000000e001') is null, 'test 2 : contacts du registre refusés à l''administrateur du site');
select essai_refuse($$insert into ledger_entries (date_ecriture, sens, montant, compte, source, reference) values (current_date, 'recette', 1000, 'caisse', 'manuel', 'X')$$,
                    'test 1 : l''administrateur du site ne peut pas écrire en comptabilité');

-- 26. Candidature retenue → code individuel
create temporary table essai_codes (qui text, code text) on commit preserve rows;
grant all on essai_codes to authenticated;
insert into essai_codes values ('awa', generer_code_inscription('00000000-0000-0000-0000-00000000c001'));
select essai((select code from essai_codes where qui = 'awa') ~ '^MA2M-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$', 'test 26 : code individuel unique de la forme MA2M-XXXX-XX, sans caractère ambigu');
select essai((select status from v_site_candidatures where id = '00000000-0000-0000-0000-00000000c001') = 'retenue', 'test 26 : la candidature passe à Retenue');
select essai((select code_statut from v_site_candidatures where id = '00000000-0000-0000-0000-00000000c001') = 'genere', 'test 26 : le code est visible de l''agent (statut « généré »)');
select essai_refuse($$select generer_code_inscription('00000000-0000-0000-0000-00000000c002')$$, 'test 29 : mineur sans parent : code refusé');
select essai_refuse($$select casting_direct('Ibrahim Cissé', '2013-02-11', '0700000009', 'Abidjan', '', '', 'homme')$$, 'test 29 : casting direct d''un mineur sans parent refusé');
select essai((casting_direct('Ibrahim Cissé', '2013-02-11', '0700000009', 'Abidjan', 'Parent Cissé', '0700000019', 'homme') ->> 'code') like 'MA2M-%',
             'test 29 : casting direct d''un mineur avec parent : fiche créée et code généré');

-- 3. Le comptable : pas de noms, seulement des totaux
select essai_qui('00000000-0000-0000-0000-0000000000a4');
select essai((select count(*) from agence_mannequins) = 0 and (select count(*) from payments) = 0, 'test 3 : le comptable ne lit ni le registre ni la liste des payeurs');
select essai((select count(*) from v_site_candidatures) = 0, 'test 3 : le comptable ne lit pas les candidatures');
select essai_refuse($$select generer_code_inscription('00000000-0000-0000-0000-00000000c001')$$, 'le comptable ne génère pas de code d''inscription');

-- 4. L'encaissement ouvre une table comptable : refus
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select essai((select count(*) from ledger_entries) = 0 and (select count(*) from expenses) = 0, 'test 4 : l''encaissement ne lit pas la comptabilité');
select essai((select count(*) from agence_mannequins) >= 1, 'l''encaissement lit le registre');
select essai_refuse($$update portail_reglages set mensualite_standard = 5000$$ || '; select essai((select mensualite_standard from portail_reglages) = 5000, ''x'')', 'paramètres en lecture seule pour l''encaissement');

-- Inscription simplifiée (serveur) : 27, 28, 30, 31
reset role;
select set_config('request.jwt.claims', '', false);
select essai((verifier_code_inscription((select code from essai_codes where qui = 'awa'), '2001-03-12') ->> 'ok')::boolean, 'test 30 : bon code + bonne date → récapitulatif');
select essai((verifier_code_inscription((select code from essai_codes where qui = 'awa'), '2001-03-12') -> 'candidat' ->> 'telephone') = '0700000001', 'test 30 : récapitulatif prérempli (rien n''est redemandé)');
select essai((verifier_code_inscription('MA2M-AAAA-AA', '2001-03-12') ->> 'raison') = 'inconnu', 'test 27 : code inconnu → message neutre');
select essai((declarer_paiement_inscription((select code from essai_codes where qui = 'awa'), '2001-03-12', '0700000001', 'wave', true, false) ->> 'ok')::boolean,
             'test 31 : « J''ai payé » à l''inscription accepté');
select essai((select count(*) from payment_declarations d join fee_dues f on f.id = d.echeance_id where f.type = 'inscription' and d.montant = 25000 and d.numero_payeur = '0700000001') = 1,
             'test 31 : une ligne « à rapprocher » avec numéro payeur et montant de 25 000');
-- 28. trois essais ratés : code bloqué
insert into essai_codes values ('ibra', null);
do $$
declare
  c text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000a1', 'role', 'authenticated', 'aal', 'aal2')::text, false);
  c := generer_code_inscription((select id from casting_applications where full_name = 'Ibrahim Cissé' and source = 'direct'));
  perform set_config('request.jwt.claims', '', false);
  update essai_codes set code = c where qui = 'ibra';
end $$;
select verifier_code_inscription((select code from essai_codes where qui = 'ibra'), '2000-01-01');
select verifier_code_inscription((select code from essai_codes where qui = 'ibra'), '2000-01-02');
select essai((verifier_code_inscription((select code from essai_codes where qui = 'ibra'), '2000-01-03') ->> 'raison') = 'bloque', 'test 28 : trois essais ratés → code bloqué');
select essai((verifier_code_inscription((select code from essai_codes where qui = 'ibra'), '2013-02-11') ->> 'raison') = 'bloque', 'test 28 : même la bonne date ne débloque pas le code');
select essai((select count(*) from audit_log where action like 'Code d''inscription : essai raté%') >= 3, 'test 28 : les essais ratés sont journalisés');

-- 34 et 23. Validation de l'inscription : tout ensemble, deux lignes en comptabilité
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select essai((portail_valider_paiement((select f.id from fee_dues f where f.type = 'inscription' limit 1), 25000, 'wave',
              (select id from payment_declarations limit 1), null, 'TX-0001') ->> 'recu') ~ '^REC-\d{4}-\d{5}$', 'test 11 : reçu numéroté REC-AAAA-NNNNN à la validation');
reset role;
select set_config('request.jwt.claims', '', false);
select essai((select count(*) from ledger_entries where source = 'mannequin' and activite = 'inscription' and montant = 15000) = 1
         and (select count(*) from ledger_entries where source = 'mannequin' and activite = 'formation' and montant = 10000) = 1,
         'test 23 : 25 000 validés → deux lignes (15 000 Inscription, 10 000 Formation)');
select essai((select bool_and(reference like 'REC-%' and libelle not like '%Awa%') from ledger_entries where source = 'mannequin'), 'test 15 : la recette porte le numéro de reçu, jamais le nom');
select essai((select status from casting_applications where id = '00000000-0000-0000-0000-00000000c001') = 'inscrite'
         and (select statut from registration_codes where candidature_id = '00000000-0000-0000-0000-00000000c001' and statut <> 'annule') = 'utilise',
         'test 34 : candidature « inscrite » et code consommé, en même temps');
select essai((select count(*) from message_log where modele = 'confirme') >= 1, 'test 11 : message de confirmation préparé');

-- Code personnel de l'espace mannequin (18/10/2026) : créé et envoyé à la validation de
-- l'inscription ; le compte créé avec lui reprend les informations et photos du casting.
create temp table essai_espace as
  select substring(texte from 'ESP-[A-Z2-9]{4}-[A-Z2-9]{2}') as code from message_log where modele = 'code_espace' limit 1;
select essai((select code from essai_espace) is not null, 'code espace : envoyé avec la confirmation de l''inscription (format ESP-XXXX-XX)');
select essai((select count(*) from espace_codes where statut = 'genere') = 1, 'code espace : un seul code valable, gardé haché');
select essai(espace_code_verifier((select lower(code) from essai_espace)), 'code espace : reconnu (majuscules ou minuscules)');
select essai(not espace_code_verifier('ESP-AAAA-AA'), 'code espace : un code inventé est refusé');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'awa@test.ci');
insert into model_profiles (id, full_name, published) values ('00000000-0000-0000-0000-0000000000b1', 'Awa Koné', false);
select essai((espace_code_utiliser((select code from essai_espace), '00000000-0000-0000-0000-0000000000b1') ->> 'photos')::int = 2,
             'code espace : le compte reprend les 2 photos du casting');
select essai((select city = 'Abidjan' and height_cm = 176 and hips_cm = 97 and date_naissance = '2001-03-12' and phone = '0700000001'
              from model_profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'code espace : la fiche reprend les informations du casting');
select essai((select user_id from agence_mannequins where candidature_id = '00000000-0000-0000-0000-00000000c001') = '00000000-0000-0000-0000-0000000000b1',
             'code espace : le compte est rattaché au registre (paiements visibles dans son espace)');
select essai(not ((espace_code_utiliser((select code from essai_espace), '00000000-0000-0000-0000-0000000000b1') ->> 'ok')::boolean)
         and not espace_code_verifier((select code from essai_espace)), 'code espace : il ne sert qu''une fois');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b1');
select essai((mannequin_mes_paiements() -> 'formation' ->> 'duree')::int = 24
         and json_array_length(mannequin_mes_paiements() -> 'formation' -> 'mois') = 24, 'Mes paiements : calendrier des 24 mois de formation');
select essai((mannequin_mes_paiements() -> 'formation' -> 'mois' -> 0 ->> 'statut') = 'payee'
         and (mannequin_mes_paiements() -> 'formation' -> 'mois' -> 0 ->> 'mode') = 'wave', 'Mes paiements : 1er mois payé avec l''inscription, par Wave');
select essai((mannequin_mes_paiements() -> 'formation' -> 'mois' -> 5 ->> 'statut') = 'a_venir', 'Mes paiements : les mois suivants « à venir »');
select essai_refuse($$select espace_code_utiliser('ESP-AAAA-AA', auth.uid())$$, 'code espace : la page ne peut pas utiliser un code elle-même');
reset role;
select set_config('request.jwt.claims', '', false);

select essai((select count(*) from audit_log where action = 'Paiement validé') = 1, 'test 21 : la validation laisse une ligne d''audit');
select essai((select count(*) from fee_dues where type = 'mensualite' and mannequin_id = (select id from agence_mannequins where candidature_id = '00000000-0000-0000-0000-00000000c001')
              and mois = date_trunc('month', current_date)::date) = 0, 'test 23 : pas de mensualité en plus pour le mois de l''inscription');

-- Inscription payée en espèces à l'agence, sans passer par le site (18/10/2026)
insert into casting_applications (id, full_name, email, phone, date_naissance, genre, status, city)
values ('00000000-0000-0000-0000-00000000c003', 'Mariam Touré', 'mariam@test.ci', '0700000009', '2000-06-01', 'femme', 'retenue', 'Yamoussoukro');
update casting_applications set status = 'retenue' where id = '00000000-0000-0000-0000-00000000c003'; -- (à l'envoi, la candidature arrive toujours « nouvelle »)
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');
create temp table essai_agence as select portail_inscription_agence('00000000-0000-0000-0000-00000000c003', 25000, 'especes', true, false) as r;
select essai((select r ->> 'code_espace' from essai_agence) ~ '^ESP-', 'inscription en espèces à l''agence : code personnel de l''espace créé et affiché');
select essai((select r ->> 'recu' from essai_agence) ~ '^REC-', 'inscription en espèces à l''agence : reçu numéroté');
select essai_refuse($$select portail_inscription_agence('00000000-0000-0000-0000-00000000c003', 25000, 'especes', true, false)$$, 'inscription à l''agence : pas deux fois');
reset role;
select set_config('request.jwt.claims', '', false);
select essai((select status from casting_applications where id = '00000000-0000-0000-0000-00000000c003') = 'inscrite'
         and (select candidature_id from agence_mannequins where nom = 'Mariam Touré') = '00000000-0000-0000-0000-00000000c003',
         'inscription à l''agence : candidature inscrite et reliée au registre (le casting sera repris)');
select essai((select mode from payments p join fee_dues f on f.id = p.echeance_id join agence_mannequins m on m.id = f.mannequin_id where m.nom = 'Mariam Touré') = 'especes',
         'inscription à l''agence : paiement enregistré en espèces');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select essai_refuse($$select portail_inscription_agence('00000000-0000-0000-0000-00000000c001', 25000, 'especes', true, false)$$, 'inscription à l''agence : refusée à l''administrateur du site (pas d''argent)');
reset role;
select set_config('request.jwt.claims', '', false);

-- 32. validation en double impossible
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select essai_refuse($$select portail_valider_paiement((select id from fee_dues where type = 'inscription' limit 1), 25000, 'wave')$$, 'test 32 : un paiement ne se valide qu''une fois');

-- 9. Calendrier : échéances le 1er (rejouable), relance le 3, Non payé le 6
reset role;
select set_config('request.jwt.claims', '', false);
select essai(portail_tache_quotidienne(date_trunc('month', current_date + interval '1 month')::date) ->> 'echeances' >= '1', 'test 9 : le 1er, les échéances du mois sont créées');
select essai((portail_tache_quotidienne(date_trunc('month', current_date + interval '1 month')::date) ->> 'echeances') = '0', 'test 9 : rejouer le 1er ne crée aucun doublon');
select essai((portail_tache_quotidienne((date_trunc('month', current_date + interval '1 month') + interval '2 days')::date) ->> 'relances')::int >= 1, 'test 9 : relance le 3 aux personnes sans paiement déclaré');
select essai((portail_tache_quotidienne((date_trunc('month', current_date + interval '1 month') + interval '5 days')::date) ->> 'non_payes')::int >= 1, 'test 9 : le 6, les échéances ouvertes passent à Non payé');
-- 10. « J'ai payé » du mannequin connecté
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a5', 'aal1');
select essai((select count(*) from fee_dues) >= 1, 'le mannequin voit ses propres échéances');
select mannequin_declarer_paiement((select id from fee_dues order by mois desc limit 1), '0700000003');
select essai((select statut from fee_dues order by mois desc limit 1) = 'declare', 'test 10 : « J''ai payé » → Paiement déclaré, sans capture ni référence');
select essai((select count(*) from agence_mannequins where user_id <> auth.uid()) = 0, 'le mannequin ne voit pas les autres mannequins');

-- 7. Mineur : messages au parent
reset role;
select set_config('request.jwt.claims', '', false);
select essai((registre_destinataire((select id from agence_mannequins where nom = 'Fanta Sylla')) ->> 'qui') = 'Lui-même', 'test 8 : majeur → messages à lui-même');
insert into agence_mannequins (id, nom, date_naissance, telephone) values ('00000000-0000-0000-0000-00000000e002', 'Yao Bamba', '2012-05-03', '0700000002');
select essai_refuse($$insert into fee_dues (mannequin_id, type, mois, montant_du, date_limite) values ('00000000-0000-0000-0000-00000000e002', 'mensualite', '2027-01-01', 10000, '2027-01-05')$$,
                    'mineur sans parent : aucune échéance possible');
insert into mannequin_guardians (mannequin_id, nom, telephone) values ('00000000-0000-0000-0000-00000000e002', 'Parent de Yao', '0700000012');
select essai((registre_destinataire('00000000-0000-0000-0000-00000000e002') ->> 'qui') = 'Parent', 'test 7 : mineur → messages au parent');

-- 24. Mensualité : principal seul, avec code récent ; historique
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select essai_refuse($$update agence_mannequins set montant_mensuel = 20000 where nom = 'Fanta Sylla'$$, 'test 24 : l''encaissement ne change pas une mensualité');
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal2', 3600);
select essai_refuse($$update agence_mannequins set montant_mensuel = 20000 where nom = 'Fanta Sylla'$$, 'action sensible : code MFA trop ancien → refus');
select essai_qui('00000000-0000-0000-0000-0000000000a1');
update agence_mannequins set montant_mensuel = 20000 where nom = 'Fanta Sylla';
select essai((select count(*) from historique_mensualites) = 1, 'test 24 : mensualité changée par le principal, historique conservé');

-- 17. Sortie : proposée par l'encaissement, décidée par le principal
select essai_qui('00000000-0000-0000-0000-0000000000a3');
update agence_mannequins set statut = 'sortie_proposee' where nom = 'Fanta Sylla';
select essai_refuse($$update agence_mannequins set statut = 'sorti', motif_sortie = 'x' where nom = 'Fanta Sylla'$$, 'test 17 : l''encaissement ne décide pas une sortie');
select essai_qui('00000000-0000-0000-0000-0000000000a1');
update agence_mannequins set statut = 'sorti', motif_sortie = 'Impayés' where nom = 'Fanta Sylla';
select essai((select statut from agence_mannequins where nom = 'Fanta Sylla') = 'sorti', 'test 17 : sortie effective après décision du principal');

-- 18 et 19. Documents : numéros consécutifs, document émis figé, période verrouillée
select essai_qui('00000000-0000-0000-0000-0000000000a4');
insert into clients (id, nom) values ('00000000-0000-0000-0000-0000000c1e01', 'Marque Exemple');
insert into invoices (id, type, client_id, activite) values
  ('00000000-0000-0000-0000-0000000f0001', 'facture', '00000000-0000-0000-0000-0000000c1e01', 'casting'),
  ('00000000-0000-0000-0000-0000000f0002', 'facture', '00000000-0000-0000-0000-0000000c1e01', 'casting');
insert into invoice_lines (invoice_id, designation, prix_unitaire) values
  ('00000000-0000-0000-0000-0000000f0001', 'Casting, 2 jours', 150000), ('00000000-0000-0000-0000-0000000f0002', 'Casting', 50000);
select compta_emettre('00000000-0000-0000-0000-0000000f0001');
select compta_emettre('00000000-0000-0000-0000-0000000f0002');
select essai((select right(numero, 4)::int from invoices where id = '00000000-0000-0000-0000-0000000f0002')
           = (select right(numero, 4)::int from invoices where id = '00000000-0000-0000-0000-0000000f0001') + 1, 'test 18 : deux factures → numéros consécutifs, sans trou');
select essai((select mention from invoices where id = '00000000-0000-0000-0000-0000000f0001') like 'Document non fiscal%', 'mode pré-légal : mention « Document non fiscal »');
select essai_refuse($$update invoices set total_ttc = 1 where id = '00000000-0000-0000-0000-0000000f0001'$$, 'test 19 : une facture émise ne se modifie plus');
select compta_encaisser('00000000-0000-0000-0000-0000000f0001', 150000, 'banque');
select essai((select statut from invoices where id = '00000000-0000-0000-0000-0000000f0001') = 'paye', 'facture payée : recette enregistrée');
select essai_refuse($$select compta_depense(current_date, 5000, 'Transport', 'Taxi', 'caisse', '')$$, 'dépense sans justificatif refusée');
select compta_depense(current_date, 5000, 'Transport', 'Taxi', 'caisse', 'pieces-comptables/essai.pdf');
select essai((select count(*) from v_compta_encaissements_agreges) >= 1, 'test 3 : le comptable lit les totaux des encaissements (vue d''agrégats)');
select compta_verrouiller(current_date);
select essai_refuse($$select compta_depense(current_date, 5000, 'Transport', 'Taxi', 'caisse', 'x.pdf')$$, 'test 19 : période verrouillée → écriture refusée');

-- 20. Interrupteur légal : champs incomplets → refus ; comptable → refus
select essai_refuse($$select compta_mode_legal(true)$$, 'test 20 : l''interrupteur légal est réservé au principal');
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai_refuse($$select compta_mode_legal(true)$$, 'test 20 : champs légaux incomplets → interrupteur refusé');

-- Délégation : le comptable reçoit l'espace 2 → il le voit ; révoquée → plus rien
reset role;
select set_config('request.jwt.claims', '', false);
insert into staff_module_grants (user_id, module, accorde_par) values ('00000000-0000-0000-0000-0000000000a4', 'paiements', '00000000-0000-0000-0000-0000000000a1');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a4');
select essai((select count(*) from agence_mannequins) >= 1, 'délégation : le comptable voit l''espace 2 après accord du principal');
reset role;
select set_config('request.jwt.claims', '', false);
update staff_module_grants set revoque_le = now();
set role authenticated;
select essai((select count(*) from agence_mannequins) = 0, 'délégation révoquée : accès coupé');

-- 6. Compte désactivé ou appareil révoqué : coupure immédiate
reset role;
select set_config('request.jwt.claims', '', false);
update staff_profiles set actif = false where role = 'caisse';
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select essai(portail_role() is null and (select count(*) from fee_dues) = 0, 'test 6 : compte désactivé → coupure immédiate');

-- 21. Le journal d'audit est en écriture seule, lu par le principal seul
select essai((select count(*) from audit_log) = 0, 'seul le principal lit le journal d''audit');
reset role;
select set_config('request.jwt.claims', '', false);
select essai_refuse($$delete from audit_log$$, 'test 21 : le journal d''audit ne s''efface pas');
select essai_refuse($$update audit_log set action = 'x'$$, 'test 21 : le journal d''audit ne se modifie pas');

-- 13, 14, 12, 16 (relecture du 18/10/2026 : mannequin non inscrit, lien personnel, rattachement,
-- capture réutilisée, récapitulatif figé)
reset role;
select set_config('request.jwt.claims', '', false);
insert into agence_mannequins (id, nom, date_naissance, telephone, email, montant_mensuel, date_entree)
values ('00000000-0000-0000-0000-00000000e077', 'Koffi Yao', '1998-02-02', '07 00 00 00 77', 'koffi@test.ci', 10000, '2026-01-05');
insert into fee_dues (id, mannequin_id, type, mois, montant_du, date_limite) values
  ('00000000-0000-0000-0000-00000000f771', '00000000-0000-0000-0000-00000000e077', 'mensualite', date_trunc('month', current_date)::date, 10000, current_date + 5),
  ('00000000-0000-0000-0000-00000000f772', '00000000-0000-0000-0000-00000000e077', 'mensualite', (date_trunc('month', current_date) - interval '1 month')::date, 10000, current_date - 25);
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1'); -- (le compte d'encaissement a été désactivé par le test 6)
create temp table essai_lien as select portail_creer_lien_paiement('00000000-0000-0000-0000-00000000f771', 10) as jeton;
reset role;
select set_config('request.jwt.claims', '', false);
select essai((lien_paiement_lire((select jeton from essai_lien)) ->> 'montant')::int = 10000, 'test 13 : non inscrit → son lien personnel montre le bon montant, sans compte');
select essai((lien_paiement_declarer((select jeton from essai_lien), '0700000077') ->> 'ok')::boolean, 'test 13 : « J''ai payé » par le lien accepté');
select essai((select statut from fee_dues where id = '00000000-0000-0000-0000-00000000f771') = 'declare', 'test 13 : l''échéance passe à « Paiement déclaré »');
update pay_tokens set revoque = true;
select essai(not (lien_paiement_lire((select jeton from essai_lien)) ->> 'ok')::boolean, 'test 13 : lien révoqué refusé');
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select essai_refuse($$select lien_paiement_lire('x')$$, 'test 13 : la page ne lit pas un lien elle-même (tout passe par le serveur)');
reset role;
select set_config('request.jwt.claims', '', false);
-- 14 : Koffi crée son compte sur le site (même téléphone) → rattachement automatique, sans doublon
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b7', 'autre-adresse@test.ci');
insert into model_profiles (id, full_name, phone, published) values ('00000000-0000-0000-0000-0000000000b7', 'Koffi Yao', '0700000077', false);
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b7');
select essai((registre_rattacher_compte() ->> 'ok')::boolean, 'test 14 : inscrit après avoir été non inscrit → rattaché (même téléphone)');
reset role;
select set_config('request.jwt.claims', '', false);
select essai((select count(*) from agence_mannequins where regexp_replace(telephone, '\D', '', 'g') = '0700000077') = 1
         and (select user_id from agence_mannequins where id = '00000000-0000-0000-0000-00000000e077') = '00000000-0000-0000-0000-0000000000b7',
         'test 14 : sans doublon dans le registre');
-- 12 : la même capture pour deux échéances → alerte à l'agent
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b7');
select mannequin_joindre_preuve('00000000-0000-0000-0000-00000000f771', '00000000-0000-0000-0000-00000000f771/11111111-1111-1111-1111-111111111111.jpg', 'empreinte-capture-1');
select essai((mannequin_joindre_preuve('00000000-0000-0000-0000-00000000f772', '00000000-0000-0000-0000-00000000f772/22222222-2222-2222-2222-222222222222.jpg', 'empreinte-capture-1') ->> 'deja_vue')::boolean,
             'test 12 : même capture déposée pour deux échéances → signalée');
reset role;
select set_config('request.jwt.claims', '', false);
-- 16 : fin de mois → récapitulatif figé, listes payés et non payés
select portail_figer_recap(current_date);
select essai((select jsonb_array_length(contenu -> 'non_payes') >= 1 and contenu ? 'payes' and contenu ? 'attendu' from month_snapshots where mois = date_trunc('month', current_date)::date),
             'test 16 : récapitulatif du mois figé (payés, non payés, attendu, encaissé)');

-- Visiteur anonyme : rien
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select essai_refuse($$select count(*) from agence_mannequins$$, 'visiteur anonyme : aucune table du portail');
reset role;
select set_config('request.jwt.claims', '', false);
select '✅ essais du portail terminés' as resultat;
