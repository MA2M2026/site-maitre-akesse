-- Essais de supabase-roles-comptages.sql (vérification des rôles, 16/11/2026) : les comptages de caisse ne se lisent
-- que par la comptabilité et le principal ; les encaissements ne les voient plus, ni en direct ni par reprise_etat().
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
insert into compta_comptages (nature, mois, compte_id, solde_systeme, solde_reel, ecart, motif)
  select 'ouverture', date_trunc('month', current_date)::date, c.id, 1000, 1000, 0, 'essai rôles' from compta_comptes c limit 1
  on conflict do nothing;  -- (déjà là avec les essais précédents : on s'en sert)
-- (le compte d'essai « compta » a un téléphone révoqué dans les essais précédents : on lui donne un appareil de confiance)
insert into staff_devices (user_id, appareil, libelle) values ('00000000-0000-0000-0000-0000000000a4', 'appareil-essai-roles', 'essai rôles')
  on conflict (user_id, appareil) do nothing;
update staff_profiles set sessions_valides_apres = null where user_id = '00000000-0000-0000-0000-0000000000a4';  -- (« déconnecté partout » dans un essai précédent)
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');   -- (encaissements)
select essai((select count(*) from compta_comptages) = 0, 'encaissements : aucun comptage de caisse lisible');
select essai((reprise_etat() ->> 'ouverture') is null, 'encaissements : « Dossiers de formation » sans le bilan d''ouverture compté');
select essai(json_array_length(reprise_etat() -> 'mannequins') >= 0, 'encaissements : la page « Dossiers de formation » marche toujours');
select essai_qui('00000000-0000-0000-0000-0000000000a4', 'aal2', 30, 'appareil-essai-roles');   -- (comptabilité)
select essai((select count(*) from compta_comptages) >= 1, 'comptabilité : les comptages se lisent');
select essai((reprise_etat() ->> 'ouverture') is not null, 'comptabilité : le bilan d''ouverture est rendu');
select essai_qui('00000000-0000-0000-0000-0000000000a1');   -- (principal)
select essai((select count(*) from compta_comptages) >= 1, 'principal : les comptages se lisent');
select essai_qui('00000000-0000-0000-0000-0000000000a2');   -- (site)
select essai((select count(*) from compta_comptages) = 0, 'site : aucun comptage');
reset role;
select '✅ Rôles, comptages de caisse : tous les essais passent';
