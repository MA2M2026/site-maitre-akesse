-- Suppression définitive d'un mannequin (essai ou erreur) — réservée à l'administrateur principal.
-- Refusée si : le mannequin a un compte sur le site, un paiement validé, ou un reçu.
-- Rejouable sans risque.
create or replace function mannequin_supprimer(p_mannequin uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m agence_mannequins;
begin
  if not portail_est_principal() then raise exception 'Seul l''administrateur principal peut supprimer.'; end if;
  perform portail_exiger_auth_recente();
  select * into m from agence_mannequins where id = p_mannequin for update;
  if not found then raise exception 'Mannequin introuvable.'; end if;
  if m.user_id is not null then raise exception 'Ce mannequin a déjà un compte : proposez plutôt sa sortie.'; end if;
  if exists (select 1 from paiements_mannequins where mannequin_id = p_mannequin and statut = 'valide')
     or exists (select 1 from recus_paiements r join paiements_mannequins p on p.id = r.paiement_id where p.mannequin_id = p_mannequin) then
    raise exception 'Ce mannequin a un paiement validé : proposez plutôt sa sortie.';
  end if;
  delete from rapprochements where paiement_id in (select id from paiements_mannequins where mannequin_id = p_mannequin);
  delete from paiements_mannequins where mannequin_id = p_mannequin;
  delete from sorties_mannequins where mannequin_id = p_mannequin;
  delete from codes_espace where mannequin_id = p_mannequin and utilise_le is null;
  delete from mensualites_appels where mannequin_id = p_mannequin;
  delete from agence_mannequins where id = p_mannequin;
end;
$$;
revoke all on function mannequin_supprimer(uuid) from public, anon;
grant execute on function mannequin_supprimer(uuid) to authenticated;
