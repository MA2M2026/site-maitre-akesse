-- =====================================================================================
-- Droits d'administration seulement AVEC le code de l'application d'authentification
-- (24/10/2026, « À faire plus tard » de l'audit du 28/09/2026)
-- =====================================================================================
-- Avant : un mot de passe d'administrateur volé suffisait pour lire et modifier la base en
-- direct (l'écran demandait le code, la base non). Désormais un compte de la table `admins`
-- n'a ses droits que si sa connexion a validé le code de l'application d'authentification
-- (jeton « aal2 », `portail_mfa_ok()` de supabase-administration.sql).
-- À coller en entier dans Supabase › SQL Editor › Run. Aucune donnée supprimée ; peut être
-- rejoué sans risque (les fonctions déjà corrigées ne sont plus touchées).
-- Les serveurs du site (api/*.js) font la même vérification : `adminVerifie` (api/_commun.js).

-- 1) La table `admins` n'est lisible qu'avec le code : toutes les règles d'accès écrites
--    « exists (select 1 from admins where user_id = auth.uid()) » (tables, stockage) l'exigent
--    donc d'un coup, sans les réécrire une par une.
drop policy if exists "Un utilisateur peut verifier son statut admin" on admins;
create policy "Un utilisateur peut verifier son statut admin"
  on admins for select
  using (auth.uid() = user_id and portail_mfa_ok());

-- 2) Les fonctions « security definer » lisent `admins` sans ces règles : la même vérification
--    leur est ajoutée automatiquement (texte « from admins where user_id = auth.uid()) »).
do $$
declare
  f record;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.prosrc like '%from admins where user_id = auth.uid())%'
  loop
    execute replace(pg_get_functiondef(f.oid),
      'from admins where user_id = auth.uid())',
      'from admins where user_id = auth.uid() and portail_mfa_ok())');
  end loop;
end $$;

-- 3) Désormais, chaque nouveau fichier SQL qui vérifie un administrateur doit écrire
--    « from admins where user_id = auth.uid() and portail_mfa_ok()) » — ou rejouer ce fichier.

NOTIFY pgrst, 'reload schema';

-- Contrôle : doit afficher 0 (aucune fonction qui reconnaît un administrateur sans le code,
-- quelle que soit la façon de l'écrire)
select count(*) as fonctions_sans_code from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosrc ~* 'admins\s+(\w+\s+)?where\s+(\w+\.)?user_id\s*=\s*auth\.uid\(\)' and p.prosrc !~ 'portail_mfa_ok';
