-- Essais de l'Administration — étape 1 (comptes, connexion, sécurité) sur la base
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

-- Fonction d'essai : se mettre dans la peau de quelqu'un (jeton imité)
-- (le portail envoie aussi l'identifiant de son appareil : en-tête « x-appareil »)
create or replace function essai_qui(p_uid text, p_aal text default 'aal2', p_totp_il_y_a int default 30, p_appareil text default 'appareil-essai-0001')
returns void language sql as $$
  select set_config('request.headers', json_build_object('x-appareil', p_appareil)::text, false);
  select set_config('request.jwt.claims', json_build_object(
    'sub', p_uid, 'role', 'authenticated', 'aal', p_aal,
    'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint - p_totp_il_y_a)))::text, false);
$$;
grant execute on function essai_qui(text, text, int, text) to authenticated;
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


set role authenticated;
-- Connexion sans double authentification : aucun rôle
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal1');
select essai(portail_role() is null, 'sans double authentification, aucun espace (même le principal)');
-- Compte sans rôle : rien (moindre privilège)
select essai_qui('00000000-0000-0000-0000-0000000000a6');
select essai(portail_role() is null and not portail_peut('site'), 'un compte sans rôle n''a accès à rien');
-- Sans identifiant d'appareil, aucun accès
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal2', 30, '');
select essai(portail_role() is null, 'sans identifiant d''appareil, aucun espace');
-- Chaque rôle voit son seul espace
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai(portail_peut('site') and portail_peut('paiements') and portail_peut('compta'), 'principal : les trois espaces');
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select essai(portail_peut('site') and not portail_peut('paiements') and not portail_peut('compta'), 'administrateur du site : espace 1 seulement');
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select essai(portail_peut('paiements') and not portail_peut('site') and not portail_peut('compta'), 'encaissements : espace 2 seulement');
select essai_qui('00000000-0000-0000-0000-0000000000a4');
select essai(portail_peut('compta') and not portail_peut('paiements') and not portail_peut('site'), 'comptable : espace 3 seulement');
select essai((portail_moi() ->> 'nom') = 'Comptable', 'l''application connaît le nom et le rôle de la personne');
select essai((select count(*) from staff_profiles) = 1, 'chacun ne lit que sa propre fiche');
-- (la règle RLS ne laisse rien modifier : vérifié ci-dessous)
update staff_profiles set role = 'principal' where user_id = auth.uid();
reset role;
select essai((select role from staff_profiles where user_id = '00000000-0000-0000-0000-0000000000a4') = 'compta', 'personne ne se donne lui-même un rôle');
select set_config('request.jwt.claims', '', false);

-- Délégation : le comptable reçoit l'espace 2 → il y a accès ; révoquée → plus rien
insert into staff_module_grants (user_id, module, accorde_par) values ('00000000-0000-0000-0000-0000000000a4', 'paiements', '00000000-0000-0000-0000-0000000000a1');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a4');
select essai(portail_peut('paiements'), 'délégation : le comptable a l''espace 2 après accord du principal');
reset role;
select set_config('request.jwt.claims', '', false);
update staff_module_grants set revoque_le = now();
set role authenticated;
select essai(not portail_peut('paiements'), 'délégation révoquée : accès coupé');

-- Compte désactivé : coupure immédiate
reset role;
select set_config('request.jwt.claims', '', false);
update staff_profiles set actif = false where role = 'caisse';
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select essai(portail_role() is null, 'compte désactivé : coupure immédiate');

-- Le journal d'audit est en écriture seule, lu par le principal seul
select essai((select count(*) from audit_log) = 0, 'seul le principal lit le journal d''audit');
reset role;
select set_config('request.jwt.claims', '', false);
select essai((select count(*) from audit_log) > 0, 'les changements de comptes sont inscrits au journal');
select essai_refuse($$delete from audit_log$$, 'le journal d''audit ne s''efface pas');
select essai_refuse($$update audit_log set action = 'x'$$, 'le journal d''audit ne se modifie pas');

-- Relecture du 19/10/2026 : téléphone révoqué → les sessions déjà ouvertes cessent de servir
insert into staff_devices (user_id, appareil, libelle) values ('00000000-0000-0000-0000-0000000000a4', 'tel-vole-0001', 'Téléphone volé');
insert into admins (user_id) values ('00000000-0000-0000-0000-0000000000a4') on conflict do nothing;  -- (droits de l'ancien tableau de bord, pour l'essai)
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a4', 'aal2', 30, 'tel-vole-0001');
select essai(portail_role() = 'compta', 'avant la révocation, le téléphone ouvre l''espace');
reset role;
select set_config('request.jwt.claims', '', false);
update staff_devices set revoque = true where appareil = 'tel-vole-0001';
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a4', 'aal2', 30, 'tel-vole-0001');
select essai(portail_role() is null, 'téléphone révoqué : refusé');
reset role;
select essai(not exists (select 1 from admins where user_id = '00000000-0000-0000-0000-0000000000a4'), 'téléphone révoqué : l''ancien tableau de bord se ferme aussi');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a4', 'aal2', 30, 'nouvel-identifiant-0002');
select essai(portail_role() is null, 'téléphone révoqué : changer d''identifiant ne rend pas l''accès à la session déjà ouverte');
select essai_qui('00000000-0000-0000-0000-0000000000a4', 'aal2', -5, 'ordinateur-bureau-0003');
select essai(portail_role() = 'compta', 'après la révocation, une nouvelle connexion avec le code fonctionne');
reset role;
select set_config('request.jwt.claims', '', false);

-- Code à 4 chiffres de l'appareil (19/10/2026) : verrouillage après 15 minutes, 8 heures au plus
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal2', 30, 'tablette-pin-0001');
select portail_code_appareil_definir('tablette-pin-0001', '4826');
select essai_refuse($$select portail_code_appareil_definir('tablette-pin-0001', '1234')$$, 'code trop simple refusé');
select essai_refuse($$select * from staff_codes_appareil$$, 'le code haché n''est lisible par personne');
select essai((portail_code_appareil_etat('tablette-pin-0001') ->> 'defini')::boolean, 'code choisi après la connexion complète');
select essai(portail_role() = 'principal', 'appareil actif : accès normal');
select portail_code_appareil_verrouiller('tablette-pin-0001');
select essai(portail_role() is null, 'appareil verrouillé : plus aucun accès aux données');
select essai(not (portail_code_appareil_verifier('tablette-pin-0001', '1111') ->> 'ok')::boolean, 'mauvais code refusé');
select essai(portail_role() is null, 'après un mauvais code : toujours verrouillé');
select essai((portail_code_appareil_verifier('tablette-pin-0001', '4826') ->> 'ok')::boolean, 'bon code : déverrouillé');
select essai(portail_role() = 'principal', 'après le bon code : accès rendu');
reset role;
update staff_codes_appareil set derniere_activite = now() - interval '20 minutes' where appareil = 'tablette-pin-0001';
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal2', 3600, 'tablette-pin-0001');
select essai(portail_role() is null, '20 minutes sans activité : verrouillé par le serveur, même si l''écran ne l''a pas fait');
select portail_code_appareil_verifier('tablette-pin-0001', '0001'), portail_code_appareil_verifier('tablette-pin-0001', '0002'),
       portail_code_appareil_verifier('tablette-pin-0001', '0003'), portail_code_appareil_verifier('tablette-pin-0001', '0004');
select essai((portail_code_appareil_verifier('tablette-pin-0001', '0005') ->> 'bloque')::boolean, '5 erreurs : code bloqué');
select essai(not (portail_code_appareil_verifier('tablette-pin-0001', '4826') ->> 'ok')::boolean, 'code bloqué : même le bon code ne suffit plus');
select essai(portail_role() is null, 'code bloqué : toujours aucun accès');
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal2', -5, 'tablette-pin-0001');
select essai(not (portail_code_appareil_etat('tablette-pin-0001') ->> 'verrouille')::boolean and portail_role() = 'principal',
             'connexion complète (mot de passe + code de l''application) : appareil déverrouillé');
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal2', 9 * 3600, 'ordinateur-sans-pin-0002');
select essai(portail_role() is null, 'plus de 8 heures après le dernier code de l''application : session finie');
reset role;
select set_config('request.jwt.claims', '', false);


-- Espace 1 : un compte « site » n'a PAS (encore) les droits de l'ancien tableau de bord, qui
-- ouvrent aussi l'argent dans la base (branchés avec l'espace 2)
select essai(not exists (select 1 from admins where user_id = '00000000-0000-0000-0000-0000000000a2'), 'rôle « site » : pas d''accès à l''argent par la base');

-- Code individuel (cahier v2.4, 3.3) : seulement pour une personne retenue, un seul par personne
insert into admins (user_id) values ('00000000-0000-0000-0000-0000000000a1') on conflict do nothing;
insert into casting_applications (id, full_name, email, phone, type_candidature) values
  ('00000000-0000-0000-0000-00000000c001', 'AWA KONÉ', 'awa@test.ci', '0102030405', 'agence');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai_refuse($$select code_individuel_creer('00000000-0000-0000-0000-00000000c001')$$, 'pas de code pour une candidature non retenue');
reset role;
update casting_applications set status = 'retenue' where id = '00000000-0000-0000-0000-00000000c001';
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai(code_individuel_creer('00000000-0000-0000-0000-00000000c001') ~ '^MA2M-[A-Z2-9]{6}$', 'personne retenue : code créé à son nom');
select essai(code_individuel_creer('00000000-0000-0000-0000-00000000c001') = (select code from codes_inscription where candidature_id = '00000000-0000-0000-0000-00000000c001'),
             'redemander le code redonne le même (un seul code par personne)');
select essai((casting_direct_creer('kouassi yao', '0707070707', 'homme', '2000-05-05') ->> 'code') ~ '^MA2M-',
             'casting direct : fiche minimale retenue et code tout de suite');
select essai((select status from casting_applications where type_candidature = 'direct') = 'retenue', 'casting direct : la fiche est « Retenue »');
select essai_refuse($$select casting_direct_creer('', '07', 'homme', '2000-01-01')$$, 'casting direct sans nom refusé');
select essai_qui('00000000-0000-0000-0000-0000000000a6');
select essai_refuse($$select code_individuel_creer('00000000-0000-0000-0000-00000000c001')$$, 'un compte non administrateur ne crée pas de code');
reset role;
select set_config('request.jwt.claims', '', false);
update codes_inscription set utilise = true where candidature_id = '00000000-0000-0000-0000-00000000c001';
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai_refuse($$select code_individuel_creer('00000000-0000-0000-0000-00000000c001')$$, 'code déjà utilisé : pas de second code');
reset role;
select set_config('request.jwt.claims', '', false);

-- Espace 2 — registre (cahier v2.4, 5.1 et 5.5)
reset role;
select set_config('request.jwt.claims', '', false);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'roxane@test.ci');
insert into model_profiles (id, full_name, phone) values ('00000000-0000-0000-0000-0000000000b1', 'ROXANE OUATTARA', '0102030405');
select essai(exists (select 1 from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1'), 'nouveau compte sur le site : il entre au registre tout seul');
update staff_profiles set actif = true where role = 'caisse';
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');
insert into agence_mannequins (id, full_name, genre, date_naissance, telephone) values
  ('00000000-0000-0000-0000-0000000000d1', 'KONÉ AWA', 'femme', '2001-01-01', '0707070707');
select essai((select count(*) from agence_mannequins) = 2, 'encaissements : voit tout le registre (site + ajoutés à la main)');
select essai_refuse($$update agence_mannequins set mensualite = 20000 where id = '00000000-0000-0000-0000-0000000000d1'$$, 'encaissements : ne change pas la mensualité');
insert into paiements_mannequins (mannequin_id, objet, montant, mode, statut) values ('00000000-0000-0000-0000-0000000000d1', 'inscription', 25000, 'especes', 'valide');
select essai((select valide_par from paiements_mannequins where mannequin_id = '00000000-0000-0000-0000-0000000000d1') = '00000000-0000-0000-0000-0000000000a3', 'espèces : enregistré et validé par l''agence, au nom de la personne');
select essai_refuse($$insert into paiements_mannequins (mannequin_id, objet, mode, statut) values ('00000000-0000-0000-0000-0000000000d1', 'inscription', 'avant_systeme', 'valide')$$, 'une seule inscription payée par mannequin');
select essai_refuse($$update paiements_mannequins set montant = 1 where mannequin_id = '00000000-0000-0000-0000-0000000000d1'$$, 'un paiement validé ne se modifie plus');
select essai_refuse($$delete from paiements_mannequins$$, 'un paiement ne s''efface pas');
select essai_qui('00000000-0000-0000-0000-0000000000a1');
update agence_mannequins set mensualite = 20000 where id = '00000000-0000-0000-0000-0000000000d1';
select essai((select mensualite from agence_mannequins where id = '00000000-0000-0000-0000-0000000000d1') = 20000, 'principal : change la mensualité');
select essai_qui('00000000-0000-0000-0000-0000000000a4');
select essai((select count(*) from agence_mannequins) = 0 and (select count(*) from paiements_mannequins) = 0, 'comptable : ni le registre ni les paiements nominatifs');
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select essai((select count(*) from paiements_mannequins) = 0, 'le mannequin ne voit ni ne coche aucun paiement par la base');
reset role;
select set_config('request.jwt.claims', '', false);

-- Visiteur anonyme : rien
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select essai_refuse($$select count(*) from staff_profiles$$, 'visiteur anonyme : aucune table de l''Administration');
reset role;
select set_config('request.jwt.claims', '', false);
select '✅ essais de l''Administration (étape 1) terminés' as resultat;
