-- Liste unique des mannequins suivis (tableau du mois, matrice, mensualités, récapitulatif, messages).
-- Rejouable sans risque. À exécuter une seule fois dans l'éditeur SQL de Supabase.

-- 1. La colonne : personne n'est suivi au départ ; la propriétaire choisit dans le « Tableau du mois ».
alter table agence_mannequins add column if not exists suivi boolean not null default false;

-- 2. Tout mannequin qui a déjà un paiement enregistré est suivi d'office (aucun paiement ne « disparaît »)
update agence_mannequins set suivi = true
 where not suivi and id in (select mannequin_id from paiements_mannequins);

-- 3. Un paiement déclaré par le mannequin, ou enregistré par l'agence, place le mannequin dans le suivi
create or replace function suivi_auto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update agence_mannequins set suivi = true where id = NEW.mannequin_id and not suivi;
  return NEW;
end;
$$;
revoke all on function suivi_auto() from public, anon, authenticated;
drop trigger if exists suivi_auto on paiements_mannequins;
create trigger suivi_auto after insert on paiements_mannequins for each row execute function suivi_auto();

-- 4. Le récapitulatif figé d'un mois ne retient que les mannequins suivis
create or replace function recap_figer(p_mois date)
returns recaps_mensuels language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_mois)::date;
  fin date := (date_trunc('month', p_mois) + interval '1 month - 1 day')::date;
  r recaps_mensuels;
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé'; end if;
  if m >= date_trunc('month', current_date)::date then
    raise exception 'Seul un mois terminé peut être figé.';
  end if;
  if exists (select 1 from recaps_mensuels where mois = m) then
    raise exception 'Ce mois est déjà figé.';
  end if;
  insert into recaps_mensuels (mois, donnees, fige_par)
  select m,
    jsonb_build_object('mois', to_char(m, 'YYYY-MM'), 'lignes', coalesce(jsonb_agg(jsonb_build_object(
      'mannequin_id', a.id, 'nom', a.full_name, 'statut', a.statut, 'mensualite', a.mensualite,
      'etat', mensualite_etat(a.id, m),
      'valide', (select coalesce(sum(p.montant), 0) from paiements_mannequins p
                  where p.mannequin_id = a.id and p.objet = 'mensualite' and p.mois = m and p.statut = 'valide')
    ) order by a.full_name), '[]'::jsonb)),
    auth.uid()
  from agence_mannequins a where a.date_entree <= fin and a.suivi
  returning * into r;
  return r;
end;
$$;
revoke all on function recap_figer(date) from public, anon;
grant execute on function recap_figer(date) to authenticated;

NOTIFY pgrst, 'reload schema';
