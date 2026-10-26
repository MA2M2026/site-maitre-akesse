-- =====================================================================================
-- Paiement à l'avance des mensualités (26/10/2026, décision de la propriétaire)
-- =====================================================================================
-- Jusqu'à 3 mois à l'avance, au même prix, en UN seul paiement Wave. La mannequin connectée
-- choisit le nombre de mois ; la base déclare les prochains mois « à venir » TOUS ENSEMBLE
-- (tout ou rien : si un mois est refusé, aucun n'est déclaré) et à la même heure : l'écran
-- « Paiements à vérifier » de l'Administration les montre donc en UNE ligne, au montant total,
-- comme l'opération unique que l'agence voit dans Wave Business. Chaque mois est déclaré par
-- mensualite_declarer_avec_numero (supabase-bloc2-complements.sql : mêmes contrôles, même numéro).
-- À coller en entier dans Supabase › SQL Editor › Run. Aucune donnée touchée ; peut être rejoué.

create or replace function mensualites_payer_avance(p_nb int, p_numero text)
returns int language plpgsql security definer set search_path = public as $$
declare
  a agence_mannequins;
  courant date := date_trunc('month', now())::date;
  debut date;
  m date;
  faits int := 0;
begin
  if p_nb is null or p_nb < 1 or p_nb > 3 then raise exception 'De 1 à 3 mois à l''avance.'; end if;
  select * into a from agence_mannequins where user_id = auth.uid() and statut = 'actif';
  if not found then raise exception 'Espace non rattaché à l''agence : contactez l''agence.'; end if;
  debut := date_trunc('month', greatest(a.date_entree, a.cree_le::date))::date;
  for m in select g::date from generate_series(courant + interval '1 month', courant + interval '3 months', interval '1 month') g loop
    exit when faits >= p_nb or m >= debut + interval '24 months';  -- (fin des 24 mois de formation)
    if m >= debut and mensualite_etat(a.id, m) = 'a_venir' then
      perform mensualite_declarer_avec_numero(m, p_numero);
      faits := faits + 1;
    end if;
  end loop;
  if faits < p_nb then
    raise exception 'Seulement % mois peuvent être payés à l''avance pour le moment : rien n''a été enregistré.', faits;
  end if;
  return faits;
end;
$$;
revoke all on function mensualites_payer_avance(int, text) from public, anon;
grant execute on function mensualites_payer_avance(int, text) to authenticated;

NOTIFY pgrst, 'reload schema';

-- Contrôle : doit afficher 1
select count(*) as paiement_avance from pg_proc where proname = 'mensualites_payer_avance';
