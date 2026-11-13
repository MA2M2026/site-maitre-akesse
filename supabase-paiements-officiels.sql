-- =====================================================================================================
-- Paiements officiels (13/11/2026, demande de la propriétaire) : reçu officiel des cachets des mannequins,
-- et moyen de paiement des recettes (paiements des clients : mobile money, Visa, virement, chèque, espèces)
-- À COLLER UNE FOIS dans Supabase (SQL Editor), bouton orange « Run without RLS » s’il est proposé
-- (la table existe déjà et reste protégée). Rien n’est effacé, peut être recollé sans risque.
-- Chaque cachet garde : date, heure de début et de fin, lieu, partenaire, impôts retenus, frais retenus
-- (jusqu’à 5 lignes), moyen de paiement (Wave, Orange Money, MTN Money, Moov Money, chèque, virement,
-- carte bancaire, espèces). Net versé = total de la prestation - commission - impôts - frais.
-- Le reçu (recu.html) montre tout. Les impôts retenus entrent dans l’échéancier des impôts.
-- =====================================================================================================

alter table cachets_mannequins add column if not exists date_prestation date;
alter table cachets_mannequins add column if not exists heure_debut time;
alter table cachets_mannequins add column if not exists heure_fin time;
alter table cachets_mannequins add column if not exists lieu text check (lieu is null or length(lieu) <= 160);
alter table cachets_mannequins add column if not exists partenaire text check (partenaire is null or length(partenaire) <= 160);
alter table cachets_mannequins add column if not exists impots int not null default 0 check (impots >= 0 and impots <= 5000000);
alter table cachets_mannequins add column if not exists frais jsonb not null default '[]'::jsonb check (jsonb_typeof(frais) = 'array' and jsonb_array_length(frais) <= 5);
alter table cachets_mannequins add column if not exists frais_total int not null default 0 check (frais_total >= 0);
alter table cachets_mannequins add column if not exists moyen text check (moyen is null or moyen in ('wave', 'orange_money', 'mtn_money', 'moov_money', 'cheque', 'virement', 'carte', 'especes'));
alter table cachets_mannequins add column if not exists impot_id uuid references compta_impots(id);

-- Le calcul est fait par la base : commission, puis impôts et frais retenus. Le montant versé (montant) est le net.
-- (Même version dans supabase-cachets-commission.sql, pour qu’un nouveau collage ne la remplace pas.)
create or replace function cachet_commission()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  taux numeric;
  f jsonb;
  total int := 0;
begin
  for f in select * from jsonb_array_elements(coalesce(NEW.frais, '[]'::jsonb)) loop
    if coalesce(trim(f ->> 'libelle'), '') = '' or (f ->> 'montant') !~ '^[0-9]{1,7}$' then
      raise exception 'Chaque frais retenu a un libellé et un montant.'; end if;
    total := total + (f ->> 'montant')::int;
  end loop;
  NEW.frais_total := total;
  NEW.impots := coalesce(NEW.impots, 0);
  if NEW.montant_prestation is null then
    NEW.commission_taux := null; NEW.commission := null;
    return NEW;
  end if;
  select commission_taux into taux from compta_reglages where id = 1;
  NEW.commission_taux := coalesce(taux, 20);
  NEW.commission := round(NEW.montant_prestation * NEW.commission_taux / 100);
  NEW.montant := NEW.montant_prestation - NEW.commission - NEW.impots - NEW.frais_total;
  if NEW.montant < 1 then raise exception 'Après la commission, les impôts et les frais, il ne reste rien à verser.'; end if;
  return NEW;
end;
$$;
revoke all on function cachet_commission() from public, anon, authenticated;

-- Marquer payé avec le moyen utilisé. Le paiement lui-même reste celui de cachet_payer (dépense du net versé,
-- recette de la prestation), puis le moyen est noté et les impôts retenus entrent dans l’échéancier des impôts
-- (à reverser, date limite : le 15 du mois suivant, modifiable dans Impôts et taxes).
create or replace function cachet_payer_moyen(p_id uuid, p_compte uuid, p_reference text, p_moyen text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  e uuid;
  c cachets_mannequins;
  i uuid;
begin
  if p_moyen is null or p_moyen not in ('wave', 'orange_money', 'mtn_money', 'moov_money', 'cheque', 'virement', 'carte', 'especes') then
    raise exception 'Moyen de paiement inconnu.'; end if;
  e := cachet_payer(p_id, p_compte, p_reference, 'wave_manuel');
  select * into c from cachets_mannequins where id = p_id;
  if c.impots > 0 then
    insert into compta_impots (nom, periode, echeance, montant)
      values (left('Retenue sur cachet · ' || c.beneficiaire, 120), to_char(now(), 'MM/YYYY'),
              (date_trunc('month', now()) + interval '1 month 14 days')::date, c.impots)
      returning id into i;
  end if;
  update cachets_mannequins set moyen = p_moyen, impot_id = i where id = p_id;
  return e;
end;
$$;
revoke all on function cachet_payer_moyen(uuid, uuid, text, text) from public, anon;
grant execute on function cachet_payer_moyen(uuid, uuid, text, text) to authenticated;

-- Le reçu montre maintenant tout le détail (commission comprise, à la demande de la propriétaire)
drop function if exists cachet_recu_lire(uuid);
create function cachet_recu_lire(p_jeton uuid)
returns table(numero text, beneficiaire text, montant integer, motif text, prestation text, paye_le timestamptz, reference_wave text,
  date_prestation date, heure_debut time, heure_fin time, lieu text, partenaire text, montant_prestation integer,
  commission_taux numeric, commission integer, impots integer, frais jsonb, moyen text, parent_nom text)
language sql stable security definer set search_path = public as $$
  select c.numero_recu, c.beneficiaire, c.montant, c.motif, c.prestation, c.paye_le, c.reference_wave,
    c.date_prestation, c.heure_debut, c.heure_fin, c.lieu, c.partenaire, c.montant_prestation,
    c.commission_taux, c.commission, c.impots, c.frais, c.moyen, c.parent_nom
  from cachets_mannequins c where c.jeton = p_jeton and c.statut = 'paye';
$$;
revoke all on function cachet_recu_lire(uuid) from public;
grant execute on function cachet_recu_lire(uuid) to anon, authenticated;

-- Recettes et dépenses : le moyen de paiement utilisé (un client paie sa facture par Orange Money, Visa, virement…)
alter table compta_ecritures add column if not exists moyen text check (moyen is null or moyen in ('wave', 'orange_money', 'mtn_money', 'moov_money', 'cheque', 'virement', 'carte', 'especes'));

NOTIFY pgrst, 'reload schema';
select 'Paiements officiels en place (reçu des cachets, moyen des recettes)' as resultat;
