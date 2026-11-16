-- =====================================================================================================
-- Vérification des rôles (16/11/2026) : les comptages de caisse réservés à la comptabilité et au principal
-- =====================================================================================================
-- Règle de la propriétaire (16/11, 09 h 25) : « Encaissements = les paiements SEULEMENT ». Réponse du 16/11, 10 h 15 :
-- les encaissements ne voient PAS les comptages de caisse (compta_comptages). Avant : lecture ouverte à
-- portail_peut( compta ) OU portail_peut( paiements ), et reprise_etat() (page « Dossiers de formation » des
-- encaissements) renvoyait aussi le bilan d ouverture compté.
--   1. règle de lecture de compta_comptages : comptabilité (et principal, qui peut tout) seulement ,
--   2. reprise_etat() : le bilan d ouverture n est rendu qu à la comptabilité (le corps est repris TEL QU IL EST dans
--      la base, pg_get_functiondef , seule la ligne « ouverture » change , autre chose que prévu : rien n est changé).
-- L écran de comptage (Comptabilité › Clôture guidée) est déjà dans l espace Comptabilité, invisible aux encaissements.
-- À COLLER UNE FOIS dans Supabase (SQL Editor), APRÈS supabase-reprise-mars.sql, avec l accord écrit de la propriétaire.
-- Rien n est effacé , peut être recollé sans risque.

do $$
begin
  if to_regclass('public.compta_comptages') is null then raise notice 'compta_comptages absente : rien à faire'; return; end if;
  execute 'drop policy if exists compta_comptages_lecture on compta_comptages';
  execute 'create policy compta_comptages_lecture on compta_comptages for select using (portail_peut(''compta''))';
end;
$$;

do $$
declare
  def text;
  ancien constant text := '''ouverture'', (select json_agg(row_to_json(t)) from compta_comptages t where nature = ''ouverture''),';
  nouveau constant text := '''ouverture'', case when portail_peut(''compta'') then (select json_agg(row_to_json(t)) from compta_comptages t where nature = ''ouverture'') end,';
begin
  if to_regprocedure('reprise_etat()') is null then raise notice 'reprise_etat absente : rien à faire'; return; end if;
  def := pg_get_functiondef('reprise_etat()'::regprocedure);
  if position(nouveau in def) > 0 then
    raise notice 'reprise_etat : bilan d''ouverture déjà réservé à la comptabilité';
  elsif position(ancien in def) > 0 then
    execute replace(def, ancien, nouveau);
  else
    raise exception 'reprise_etat : contenu inattendu, rien n''est changé (à relire avant de coller)';
  end if;
end;
$$;

NOTIFY pgrst, 'reload schema';

select 'Rôles, comptages : ' ||
  ((select count(*) from pg_policies where tablename = 'compta_comptages' and policyname = 'compta_comptages_lecture' and qual not like '%paiements%')
   + (select count(*) from pg_proc where proname = 'reprise_etat' and prosrc like '%case when portail_peut(''compta'') then (select json_agg%'))
  || ' éléments sur 2' as controle;
