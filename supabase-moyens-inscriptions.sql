-- =====================================================================================================
-- Moyens de paiement aussi pour l’inscription des nouveaux mannequins et les cours de talons
-- (13/11/2026, demande de la propriétaire). À COLLER UNE FOIS dans Supabase (SQL Editor), APRÈS
-- supabase-moyens-paiement.sql. Bouton orange « Run without RLS » s’il est proposé (aucune table nouvelle).
-- Rien n’est effacé, peut être recollé sans risque.
-- =====================================================================================================

-- Inscription : le moyen choisi (infos.moyen) est noté sur les paiements déclarés de la nouvelle mannequin
-- (Wave par défaut). Appelé seulement par le serveur du site.
create or replace function inscription_payer_avec_numero(p_code text, p_naissance date, p_infos jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  n text := nullif(trim(coalesce(p_infos ->> 'numero_payeur', '')), '');
  m text := nullif(trim(coalesce(p_infos ->> 'moyen', '')), '');
  v_id uuid;
begin
  if not est_ecriture_serveur() then raise exception 'Accès refusé.'; end if;
  if n is null or n !~ '^[0-9+ ]{6,20}$' then raise exception 'Numéro mobile money invalide.'; end if;
  if m is not null and m <> 'wave' and not exists (select 1 from moyens_paiement where code = m and actif) then raise exception 'Moyen de paiement indisponible.'; end if;
  v_id := inscription_simplifiee_payer(p_code, p_naissance, p_infos);
  insert into rapprochements (paiement_id, numero_payeur)
  select p.id, n from paiements_mannequins p where p.mannequin_id = v_id and p.statut = 'declare'
  on conflict (paiement_id) do nothing;
  if m is not null and m <> 'wave' then
    update paiements_mannequins set mode = m where mannequin_id = v_id and statut = 'declare' and mode = 'wave';
  end if;
  return v_id;
end;
$$;
revoke all on function inscription_payer_avec_numero(text, date, jsonb) from public, anon, authenticated;

-- Cours de talons : le moyen choisi par la personne, et la recette sur le compte de ce moyen à la validation
alter table cours_talons add column if not exists moyen text check (moyen is null or moyen in ('wave', 'orange_money', 'mtn_money', 'moov_money', 'carte', 'virement'));

create or replace function cours_talons_valider(p_id uuid, p_montant integer default null, p_especes boolean default false)
returns cours_talons language plpgsql security definer set search_path = public as $$
declare
  d cours_talons;
  compte uuid;
  ecriture uuid;
  libelle_formule text;
  mode text;
begin
  if not portail_peut('site') then raise exception 'Accès refusé.'; end if;
  select * into d from cours_talons where id = p_id for update;
  if d.id is null then raise exception 'Inscription introuvable.'; end if;
  if d.ecriture_id is not null or d.valide_le is not null then return d; end if;
  if d.statut = 'annulee' then raise exception 'Inscription annulée : rouvrez-la d''abord.'; end if;
  if coalesce(p_montant, d.montant, 0) <= 0 then raise exception 'Montant manquant.'; end if;
  mode := case when p_especes then 'especes' else coalesce(d.moyen, 'wave') end;
  select id into compte from compta_comptes where type = compta_type_du_mode(mode) and actif order by cree_le limit 1;
  if compte is null then
    select id into compte from compta_comptes where type = case when mode = 'especes' then 'caisse' else 'wave' end order by actif desc, cree_le limit 1;
    if mode not in ('especes', 'wave') and compte is not null then
      perform journaliser('Cours de talons : recette ' || mode || ' rangée sur le compte Wave (aucun compte ' || compta_type_du_mode(mode) || ' actif) : à corriger', 'cours_talons', p_id::text, null, null);
    end if;
  end if;
  libelle_formule := case d.formule when 'groupe' then 'en groupe (4 dimanches)'
    when 'prive_salle' then 'privé en salle, ' || d.nb_seances || ' séance' || case when d.nb_seances > 1 then 's' else '' end
    else 'privé à l''extérieur, ' || d.nb_seances || ' séance' || case when d.nb_seances > 1 then 's' else '' end end;
  if compte is not null then
    insert into compta_ecritures (sens, date_op, montant, compte_id, categorie, libelle, tiers, moyen)
    values ('recette', current_date, coalesce(p_montant, d.montant), compte, 'cours_talons', 'Cours de talons ' || libelle_formule, d.nom, mode)
    returning id into ecriture;
  else
    perform journaliser('Cours de talons : paiement validé sans compte pour le recevoir', 'cours_talons', p_id::text, null, null);
  end if;
  update cours_talons set statut = 'inscrite', montant = coalesce(p_montant, montant), valide_le = now(), valide_par = auth.uid(), ecriture_id = ecriture
  where id = p_id returning * into d;
  perform journaliser('Cours de talons : paiement validé', 'cours_talons', p_id::text, null, json_build_object('montant', d.montant)::jsonb);
  return d;
end;
$$;

NOTIFY pgrst, 'reload schema';
select 'Moyens de paiement pour l’inscription et les cours de talons en place' as resultat;
