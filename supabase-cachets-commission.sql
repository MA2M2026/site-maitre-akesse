-- ===================================================================================
-- « Payer les mannequins » : commission de l'agence (22/10/2026, choix de la propriétaire :
-- on saisit le montant TOTAL de la prestation ; l'agence garde sa commission, 20 % par défaut,
-- un seul pourcentage pour toute l'agence, modifiable par l'administrateur principal).
-- À exécuter UNE FOIS dans l'éditeur SQL de Supabase, APRÈS supabase-cachets.sql.
-- Rejouable sans danger (rien n'est supprimé ; les cachets déjà saisis ne changent pas).
-- ===================================================================================
alter table compta_reglages add column if not exists commission_taux numeric(5,2) not null default 20
  check (commission_taux >= 0 and commission_taux < 100);
alter table cachets_mannequins add column if not exists montant_prestation int
  check (montant_prestation is null or (montant_prestation > 0 and montant_prestation <= 5000000));
alter table cachets_mannequins add column if not exists commission_taux numeric(5,2);
alter table cachets_mannequins add column if not exists commission int;

-- Le calcul est fait ICI, par la base (jamais par la page) : commission = total × pourcentage du
-- moment, arrondie au franc ; montant (à verser à la mannequin) = total − commission. Le
-- pourcentage est gardé sur le cachet : le changer plus tard ne modifie pas les cachets passés.
create or replace function cachet_commission()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  taux numeric;
begin
  if NEW.montant_prestation is null then
    NEW.commission_taux := null; NEW.commission := null;  -- cachet saisi « montant versé » (avant la commission)
    return NEW;
  end if;
  select commission_taux into taux from compta_reglages where id = 1;
  NEW.commission_taux := coalesce(taux, 20);
  NEW.commission := round(NEW.montant_prestation * NEW.commission_taux / 100);
  NEW.montant := NEW.montant_prestation - NEW.commission;
  if NEW.montant < 1 then raise exception 'Après la commission de l''agence, il ne reste rien à verser.'; end if;
  return NEW;
end;
$$;
revoke all on function cachet_commission() from public, anon, authenticated;
drop trigger if exists cachet_commission on cachets_mannequins;
create trigger cachet_commission before insert on cachets_mannequins
  for each row execute function cachet_commission();

notify pgrst, 'reload schema';
