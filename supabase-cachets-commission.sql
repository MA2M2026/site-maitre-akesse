-- ===================================================================================
-- « Payer les mannequins » : commission de l'agence (22/10/2026, choix de la propriétaire :
-- on saisit le montant TOTAL de la prestation ; l'agence garde sa commission, 20 % par défaut,
-- un seul pourcentage pour toute l'agence, modifiable par l'administrateur principal ; au paiement,
-- recette de la prestation + dépense du cachet).
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

-- « Marquer payé » d'un cachet avec commission (22/10/2026, accord de la propriétaire : « les deux
-- lignes ») : DEUX écritures sur le même compte — la RECETTE de la prestation (montant total reçu
-- du client) et la DÉPENSE du cachet (part de la mannequin). La différence est la commission de
-- l'agence, dans le résultat du mois ; les soldes des comptes restent justes. (Ne plus saisir à la
-- main la recette de cette prestation : elle serait comptée deux fois.)
alter table cachets_mannequins add column if not exists recette_id uuid unique references compta_ecritures(id);

create or replace function cachet_payer(p_id uuid, p_compte uuid, p_reference text default null, p_mode text default 'wave_manuel')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c cachets_mannequins;
  e uuid;
  r uuid;
begin
  if not (est_ecriture_serveur() or portail_est_principal()) then raise exception 'Réservé à l''administrateur principal.'; end if;
  if not est_ecriture_serveur() then perform portail_exiger_auth_recente(); end if;
  if p_mode is null or p_mode not in ('wave_manuel', 'wave_api') or (p_mode = 'wave_api' and not est_ecriture_serveur()) then raise exception 'Mode de paiement inconnu.'; end if;
  select * into c from cachets_mannequins where id = p_id for update;
  if not found then raise exception 'Cachet introuvable.'; end if;
  if c.statut <> 'a_payer' then raise exception 'Ce cachet est déjà payé ou annulé.'; end if;
  if not exists (select 1 from compta_comptes where id = p_compte and actif) then raise exception 'Compte de paiement introuvable.'; end if;
  insert into compta_ecritures (sens, date_op, montant, compte_id, categorie, libelle, tiers, source)
    values ('depense', current_date, c.montant, p_compte, 'cachets', left('Cachet : ' || c.prestation, 300), c.beneficiaire, 'manuel')
    returning id into e;
  if c.montant_prestation is not null then
    insert into compta_ecritures (sens, date_op, montant, compte_id, categorie, libelle, source)
      values ('recette', current_date, c.montant_prestation, p_compte, 'prestation', left('Prestation : ' || c.prestation || ' (' || c.beneficiaire || ')', 300), 'manuel')
      returning id into r;
  end if;
  update cachets_mannequins set statut = 'paye', mode = p_mode, compte_id = p_compte, ecriture_id = e, recette_id = r, paye_le = now(), paye_par = auth.uid(),
    reference_wave = nullif(left(trim(coalesce(p_reference, '')), 80), '')
    where id = p_id;
  return e;
end;
$$;
revoke all on function cachet_payer(uuid, uuid, text, text) from public, anon;
grant execute on function cachet_payer(uuid, uuid, text, text) to authenticated;

-- Dépense d'un cachet annulée en comptabilité : le cachet revient « à payer » et la recette de la
-- prestation est annulée avec elle. La recette seule ne s'annule pas (sinon la commission serait fausse).
create or replace function cachet_depense_annulee()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r uuid;
begin
  if NEW.annule and not OLD.annule then
    if exists (select 1 from cachets_mannequins where recette_id = NEW.id and statut = 'paye') then
      raise exception 'Recette d''un cachet payé : annulez la dépense du cachet, la recette sera annulée avec elle.';
    end if;
    select recette_id into r from cachets_mannequins where ecriture_id = NEW.id and statut = 'paye';
    update cachets_mannequins set statut = 'a_payer', mode = null, compte_id = null, ecriture_id = null, recette_id = null, paye_le = null, paye_par = null, reference_wave = null
      where ecriture_id = NEW.id and statut = 'paye';
    if r is not null then
      update compta_ecritures set annule = true, motif_annulation = left('Cachet : paiement annulé — ' || coalesce(NEW.motif_annulation, ''), 300) where id = r and not annule;
    end if;
  end if;
  return NEW;
end;
$$;
revoke all on function cachet_depense_annulee() from public, anon, authenticated;

notify pgrst, 'reload schema';
