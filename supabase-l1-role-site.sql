-- =====================================================================================================
-- Audit L-1 (A-03 = D-01), partie 1 : l'« Administrateur du site » ne touche plus à l'argent (16/11/2026)
-- =====================================================================================================
-- Décision de la propriétaire (15/11/2026, 23 h 11) : valider le paiement d'un cours de talons, et donc créer la
-- recette en Comptabilité, est réservé à LA PERSONNE CHARGÉE DES ENCAISSEMENTS et à L'ADMINISTRATEUR PRINCIPAL.
-- La formule reste la même (l'élève paie, la personne autorisée clique « Paiement validé », la recette s'inscrit
-- toute seule) ; seul change QUI peut cliquer.
--
--  1. cours_talons_valider et cours_talons_mois_payer : portail_peut('site') → portail_peut('paiements')
--     (vrai pour le principal et pour le rôle « caisse », ou par délégation). Le corps des fonctions est repris
--     TEL QU'IL EST dans la base (pg_get_functiondef) : seule la ligne du contrôle change.
--  2. Un garde-fou sur la table cours_talons : l'équipe du site garde le suivi (date, notes, terminé, annulé,
--     rouvert), mais ne peut plus, par une écriture directe, marquer un paiement (statut « inscrite » sans
--     validation, date et auteur de validation, recette, mois payés, montant après paiement).
--
-- Ce fichier ne retire PAS le rôle « site » de la table admins : les pages du site (actualités, Book, partenaires…)
-- s'écrivent encore avec admins. Les contacts privés des candidatures sont traités à part (partie 2, à décider).
--
-- À COLLER UNE FOIS dans Supabase (SQL Editor), APRÈS supabase-programme-talons.sql, avec l'accord écrit de la
-- propriétaire. Rien n'est effacé ; peut être recollé sans risque.

-- 1. Les deux fonctions d'encaissement des cours de talons
do $$
declare
  f text;
  def text;
  ancien constant text := 'if not portail_peut(''site'') then raise exception ''Accès refusé.''; end if;';
  nouveau constant text := 'if not portail_peut(''paiements'') then raise exception ''Accès refusé : seuls les encaissements et l''''administrateur principal valident un paiement.''; end if;';
begin
  foreach f in array array['cours_talons_valider(uuid, integer, boolean)', 'cours_talons_mois_payer(uuid, integer, boolean)'] loop
    if to_regprocedure(f) is null then
      raise notice 'L-1 : % absente (fichier des cours de talons pas encore collé) : rien à faire', f;
      continue;
    end if;
    def := pg_get_functiondef(to_regprocedure(f));
    if position(nouveau in def) > 0 then
      raise notice 'L-1 : % déjà réservée aux encaissements', f;
    elsif position(ancien in def) > 0 then
      execute replace(def, ancien, nouveau);
      raise notice 'L-1 : % réservée aux encaissements et au principal', f;
    else
      raise exception 'L-1 : contrôle d''accès inattendu dans % : rien n''est changé, à relire avant de coller', f;
    end if;
  end loop;
end;
$$;

-- 2. Garde-fou des colonnes d'argent de cours_talons (écritures directes de l'Administration)
create or replace function cours_talons_garder_paiement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- serveur (clé secrète, auth.uid() nul) et encaissements / principal : rien ne change
  if auth.uid() is null or portail_peut('paiements') then return new; end if;
  if new.valide_le is distinct from old.valide_le
     or new.valide_par is distinct from old.valide_par
     or new.ecriture_id is distinct from old.ecriture_id
     or new.mois_payes is distinct from old.mois_payes
     or (old.valide_le is not null and new.montant is distinct from old.montant)
     or (new.statut = 'inscrite' and old.statut is distinct from 'inscrite' and new.valide_le is null) then
    raise exception 'Accès refusé : seuls les encaissements et l''administrateur principal enregistrent un paiement.';
  end if;
  return new;
end;
$$;
revoke all on function cours_talons_garder_paiement() from public, anon, authenticated;
drop trigger if exists trg_cours_talons_garder_paiement on cours_talons;
create trigger trg_cours_talons_garder_paiement before update on cours_talons
  for each row execute function cours_talons_garder_paiement();

-- 3. (16/11/2026, vérification des rôles, règle de la propriétaire du 16/11 09 h 25 : l'« Administrateur du site » n'a
-- ni les paiements ni la comptabilité) : les anciennes inscriptions (inscriptions_mannequins) ne passent plus à
-- « payée » (ou n'en sortent plus), et leur référence de paiement ne change plus, sans les encaissements ou le principal.
-- (La table admins y donnait encore le droit de modifier le statut : écran retiré, mais la base l'acceptait.)
create or replace function inscriptions_garder_paiement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or portail_peut('paiements') then return new; end if;
  if (new.statut is distinct from old.statut and (new.statut = 'payée' or old.statut = 'payée'))
     or new.reference_paiement is distinct from old.reference_paiement then
    raise exception 'Accès refusé : seuls les encaissements et l''administrateur principal enregistrent un paiement.';
  end if;
  return new;
end;
$$;
revoke all on function inscriptions_garder_paiement() from public, anon, authenticated;
do $$
begin
  if to_regclass('public.inscriptions_mannequins') is not null then
    execute 'drop trigger if exists trg_inscriptions_garder_paiement on inscriptions_mannequins';
    execute 'create trigger trg_inscriptions_garder_paiement before update on inscriptions_mannequins for each row execute function inscriptions_garder_paiement()';
  end if;
end;
$$;

NOTIFY pgrst, 'reload schema';

select 'L-1 (partie 1) : ' ||
  ((select count(*) from pg_proc where proname in ('cours_talons_valider', 'cours_talons_mois_payer') and prosrc like '%portail_peut(''paiements'')%')
   + (select count(*) from pg_trigger where tgname in ('trg_cours_talons_garder_paiement', 'trg_inscriptions_garder_paiement'))) || ' éléments sur 4' as controle;
