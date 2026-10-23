-- ===================================================================================
-- Espace 3 — « Payer les mannequins » : cachets après une prestation (22/10/2026, choix de la
-- propriétaire : Wave d'abord). À exécuter UNE FOIS par la propriétaire, dans l'éditeur SQL de
-- Supabase, APRÈS supabase-administration.sql. Rejouable sans danger (rien n'est supprimé).
-- ⚠ Version à jour de cachet_payer et cachet_depense_annulee (commission, recette de la
-- prestation) : supabase-cachets-commission.sql, à rejouer APRÈS celui-ci s'il est rejoué.
-- ===================================================================================
-- Un cachet à payer : une personne (mannequin du registre, ou personne extérieure : nom +
-- numéro Wave), un montant, une prestation (projet de l'agenda ou texte libre).
-- En attendant la clé Wave Business (agence pas encore constituée) : l'agence paie depuis son
-- téléphone Wave puis touche « Marquer payé » ; la dépense « Cachets reversés aux mannequins »
-- entre alors toute seule dans la comptabilité. Le jour de la clé, le serveur du site enverra
-- l'argent lui-même et appellera la même fonction (mode 'wave_api').
-- Droits : l'espace 3 voit et prépare ; SEUL l'administrateur principal marque payé ou annule,
-- avec un code d'authentification récent. Rien ne s'efface : un cachet abandonné est annulé ;
-- si la dépense d'un cachet payé est annulée en comptabilité, le cachet revient « à payer ».
create table if not exists cachets_mannequins (
  id uuid primary key default gen_random_uuid(),
  beneficiaire text not null check (length(trim(beneficiaire)) between 1 and 160),
  telephone text not null check (telephone ~ '^[0-9]{8,15}$'),          -- chiffres seuls, indicatif compris
  montant int not null check (montant > 0 and montant <= 5000000),
  prestation text not null check (length(trim(prestation)) between 1 and 200),
  projet_id uuid references agenda_projets(id) on delete set null,
  agence_mannequin_id uuid references agence_mannequins(id) on delete set null,
  statut text not null default 'a_payer' check (statut in ('a_payer', 'paye', 'annule')),
  mode text check (mode in ('wave_manuel', 'wave_api')),
  reference_wave text check (reference_wave is null or length(reference_wave) <= 80),
  compte_id uuid references compta_comptes(id),
  ecriture_id uuid unique references compta_ecritures(id),
  paye_le timestamptz,
  paye_par uuid references auth.users(id),
  motif_annulation text,
  cree_par uuid references auth.users(id) default auth.uid(),
  cree_le timestamptz not null default now(),
  check (statut <> 'paye' or (ecriture_id is not null and paye_le is not null and mode is not null)),
  check (statut <> 'annule' or coalesce(trim(motif_annulation), '') <> '')
);
create index if not exists cachets_mannequins_statut on cachets_mannequins (statut, cree_le desc);

alter table cachets_mannequins enable row level security;
revoke all on cachets_mannequins from anon;
revoke update, delete, truncate on cachets_mannequins from authenticated;
grant select, insert on cachets_mannequins to authenticated;
drop policy if exists cachets_lecture on cachets_mannequins;
create policy cachets_lecture on cachets_mannequins for select using (portail_peut('compta'));
-- (une saisie arrive toujours « à payer », sans écriture : le paiement passe par cachet_payer)
drop policy if exists cachets_ajout on cachets_mannequins;
create policy cachets_ajout on cachets_mannequins for insert
  with check (portail_peut('compta') and statut = 'a_payer' and ecriture_id is null and paye_le is null and mode is null
    and paye_par is null and compte_id is null and reference_wave is null and motif_annulation is null
    and cree_par = auth.uid());
drop trigger if exists audit_cachets_mannequins on cachets_mannequins;
create trigger audit_cachets_mannequins after insert or update or delete on cachets_mannequins
  for each row execute function audit_ecriture();

-- Marquer payé : la dépense entre dans la comptabilité et le cachet passe « payé », ensemble.
create or replace function cachet_payer(p_id uuid, p_compte uuid, p_reference text default null, p_mode text default 'wave_manuel')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c cachets_mannequins;
  e uuid;
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
  update cachets_mannequins set statut = 'paye', mode = p_mode, compte_id = p_compte, ecriture_id = e, paye_le = now(), paye_par = auth.uid(),
    reference_wave = nullif(left(trim(coalesce(p_reference, '')), 80), '')
    where id = p_id;
  return e;
end;
$$;
revoke all on function cachet_payer(uuid, uuid, text, text) from public, anon;
grant execute on function cachet_payer(uuid, uuid, text, text) to authenticated;

create or replace function cachet_annuler(p_id uuid, p_motif text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not portail_est_principal() then raise exception 'Réservé à l''administrateur principal.'; end if;
  perform portail_exiger_auth_recente();
  if coalesce(trim(p_motif), '') = '' then raise exception 'Indiquez le motif de l''annulation.'; end if;
  update cachets_mannequins set statut = 'annule', motif_annulation = left(trim(p_motif), 300) where id = p_id and statut = 'a_payer';
  if not found then raise exception 'Seul un cachet encore à payer peut être annulé.'; end if;
end;
$$;
revoke all on function cachet_annuler(uuid, text) from public, anon;
grant execute on function cachet_annuler(uuid, text) to authenticated;

-- La dépense d'un cachet est annulée dans la comptabilité (erreur : l'argent n'est pas parti) :
-- le cachet revient « à payer », pour être payé de nouveau ou annulé avec un motif. Rien ne
-- s'efface : le journal (audit_ecriture) garde le paiement annulé et sa référence Wave.
create or replace function cachet_depense_annulee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.annule and not OLD.annule then
    update cachets_mannequins set statut = 'a_payer', mode = null, compte_id = null, ecriture_id = null, paye_le = null, paye_par = null, reference_wave = null
      where ecriture_id = NEW.id and statut = 'paye';
  end if;
  return NEW;
end;
$$;
revoke all on function cachet_depense_annulee() from public, anon, authenticated;
drop trigger if exists cachet_depense_annulee on compta_ecritures;
create trigger cachet_depense_annulee after update of annule on compta_ecritures
  for each row execute function cachet_depense_annulee();

-- 23/10/2026 (demande de la propriétaire) : un cachet pour un événement qui n'est pas encore dans
-- l'agenda — « ➕ Nouvel événement » dans « Nouveau cachet ». La personne des paiements n'a pas
-- accès à l'agenda : la fonction l'y ajoute (non montré sur le site public, l'agence décide
-- ensuite), date passée permise (on paie souvent après l'événement).
create or replace function cachet_nouvel_evenement(p_titre text, p_date date, p_type text default 'evenement', p_lieu text default null, p_ville text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare nouveau uuid;
begin
  if not portail_peut('compta') then raise exception 'Réservé à l''agence.'; end if;
  if length(trim(coalesce(p_titre, ''))) = 0 or p_date is null then raise exception 'Indiquez le titre et la date de l''événement.'; end if;
  insert into agenda_projets (titre, type, date_debut, lieu, ville, visible)
    values (left(trim(p_titre), 160),
            coalesce(nullif(trim(coalesce(p_type, '')), ''), 'evenement'),  -- (types : ceux de l'agenda, vérifiés par la table)
            p_date, nullif(left(trim(coalesce(p_lieu, '')), 160), ''), nullif(left(trim(coalesce(p_ville, '')), 80), ''), false)
    returning id into nouveau;
  return nouveau;
end;
$$;
revoke all on function cachet_nouvel_evenement(text, date, text, text, text) from public, anon;
grant execute on function cachet_nouvel_evenement(text, date, text, text, text) to authenticated;

notify pgrst, 'reload schema';
