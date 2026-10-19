-- ===================================================================================
-- Compléments des espaces 2 et 3 (cahier V3, 7.2 et 7.3) — UN SEUL fichier
-- À exécuter UNE FOIS par la propriétaire, dans l'éditeur SQL de Supabase, APRÈS
-- supabase-administration.sql et supabase-parametres.sql.
-- Rejouable sans danger : rien n'est supprimé, rien n'est remplacé, aucune donnée existante
-- n'est modifiée. Tout ce qui est ajouté laisse une trace au journal d'audit.
--
-- Contenu :
--   1. Récapitulatif mensuel figé (photo d'un mois terminé, inchangeable)
--   2. Sorties de mannequins : proposition par l'encaissement, décision par l'administrateur principal
--   3. Reçus numérotés REC-AAAA-NNNNN (numéros qui se suivent, sans trou)
--   4. Rapprochement avec Wave (numéro du payeur, référence, « Introuvable », « Précision demandée »)
--   5. Messages : modèles modifiables + historique des messages envoyés
--   6. Réglages modifiables (montants, jour limite, relances)
--   7. Comptabilité : clôture mensuelle (photo des chiffres du mois)
-- ===================================================================================

-- -----------------------------------------------------------------------------------
-- 1. Récapitulatif mensuel figé
-- -----------------------------------------------------------------------------------
create table if not exists recaps_mensuels (
  mois date primary key check (mois = date_trunc('month', mois)::date),
  donnees jsonb not null,
  fige_le timestamptz not null default now(),
  fige_par uuid references auth.users(id)
);
alter table recaps_mensuels enable row level security;
revoke all on recaps_mensuels from anon, authenticated;
drop policy if exists recaps_lecture on recaps_mensuels;
create policy recaps_lecture on recaps_mensuels for select using (portail_peut('paiements'));
grant select on recaps_mensuels to authenticated;

create or replace function recaps_interdit()
returns trigger language plpgsql as $$
begin
  raise exception 'Un récapitulatif figé ne se modifie ni ne s''efface.';
end;
$$;
drop trigger if exists recaps_lecture_seule on recaps_mensuels;
create trigger recaps_lecture_seule before update or delete on recaps_mensuels for each row execute function recaps_interdit();
drop trigger if exists audit_recaps_mensuels on recaps_mensuels;
create trigger audit_recaps_mensuels after insert on recaps_mensuels for each row execute function audit_ecriture();

-- Fige un mois TERMINÉ (jamais le mois en cours) : une ligne par mannequin déjà entré à l'agence
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
  from agence_mannequins a where a.date_entree <= fin
  returning * into r;
  return r;
end;
$$;
revoke all on function recap_figer(date) from public, anon;
grant execute on function recap_figer(date) to authenticated;

-- -----------------------------------------------------------------------------------
-- 2. Sorties de mannequins (suspension ou sortie) : l'encaissement PROPOSE, le principal DÉCIDE
-- -----------------------------------------------------------------------------------
create table if not exists sorties_mannequins (
  id uuid primary key default gen_random_uuid(),
  mannequin_id uuid not null references agence_mannequins(id),
  type text not null check (type in ('suspendu', 'sorti')),
  motif text not null check (length(trim(motif)) > 0),
  propose_par uuid references auth.users(id),
  propose_le timestamptz not null default now(),
  decision text not null default 'en_attente' check (decision in ('en_attente', 'accepte', 'refuse')),
  decide_par uuid references auth.users(id),
  decide_le timestamptz,
  motif_decision text
);
create unique index if not exists sorties_une_en_attente on sorties_mannequins (mannequin_id) where decision = 'en_attente';
alter table sorties_mannequins enable row level security;
revoke all on sorties_mannequins from anon, authenticated;
drop policy if exists sorties_lecture on sorties_mannequins;
create policy sorties_lecture on sorties_mannequins for select using (portail_peut('paiements'));
grant select on sorties_mannequins to authenticated;
drop trigger if exists audit_sorties_mannequins on sorties_mannequins;
create trigger audit_sorties_mannequins after insert or update or delete on sorties_mannequins for each row execute function audit_ecriture();

-- Seul l'administrateur principal (code récent) peut passer un mannequin en « suspendu » ou « sorti »
-- (ou le réactiver) en modifiant directement la fiche ; l'encaissement passe par une proposition.
create or replace function sortie_garde_fous()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if est_ecriture_serveur() then return NEW; end if;
  if NEW.statut is distinct from OLD.statut and coalesce(current_setting('ma2m.sortie', true), '') <> '1' then
    if not portail_est_principal() then
      raise exception 'Seul l''administrateur principal change le statut d''un mannequin : faites une proposition.';
    end if;
    perform portail_exiger_auth_recente();
  end if;
  return NEW;
end;
$$;
drop trigger if exists sortie_garde_fous on agence_mannequins;
create trigger sortie_garde_fous before update on agence_mannequins for each row execute function sortie_garde_fous();

create or replace function sortie_proposer(p_mannequin uuid, p_type text, p_motif text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  nouveau uuid;
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé'; end if;
  if p_type not in ('suspendu', 'sorti') then raise exception 'Type inconnu.'; end if;
  if coalesce(trim(p_motif), '') = '' then raise exception 'Le motif est obligatoire.'; end if;
  if not exists (select 1 from agence_mannequins where id = p_mannequin and statut = 'actif') then
    raise exception 'Ce mannequin n''est pas actif.';
  end if;
  insert into sorties_mannequins (mannequin_id, type, motif, propose_par)
  values (p_mannequin, p_type, trim(p_motif), auth.uid()) returning id into nouveau;
  return nouveau;
end;
$$;
revoke all on function sortie_proposer(uuid, text, text) from public, anon;
grant execute on function sortie_proposer(uuid, text, text) to authenticated;

create or replace function sortie_decider(p_id uuid, p_accepter boolean, p_motif text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  s sorties_mannequins;
begin
  if not portail_est_principal() then raise exception 'Seul l''administrateur principal décide.'; end if;
  perform portail_exiger_auth_recente();
  select * into s from sorties_mannequins where id = p_id for update;
  if not found or s.decision <> 'en_attente' then raise exception 'Cette proposition n''est plus en attente.'; end if;
  if not p_accepter and coalesce(trim(p_motif), '') = '' then raise exception 'Motif obligatoire pour refuser.'; end if;
  update sorties_mannequins
     set decision = case when p_accepter then 'accepte' else 'refuse' end,
         decide_par = auth.uid(), decide_le = now(), motif_decision = nullif(trim(coalesce(p_motif, '')), '')
   where id = p_id;
  if p_accepter then
    perform set_config('ma2m.sortie', '1', true);
    update agence_mannequins set statut = s.type where id = s.mannequin_id;
    perform set_config('ma2m.sortie', '', true);
  end if;
end;
$$;
revoke all on function sortie_decider(uuid, boolean, text) from public, anon;
grant execute on function sortie_decider(uuid, boolean, text) to authenticated;

-- Réactivation (retour à l'agence) : administrateur principal seulement, avec motif
create or replace function mannequin_reactiver(p_mannequin uuid, p_motif text)
returns void language plpgsql security definer set search_path = public as $$
declare
  nb int;
begin
  if not portail_est_principal() then raise exception 'Seul l''administrateur principal réactive un mannequin.'; end if;
  perform portail_exiger_auth_recente();
  if coalesce(trim(p_motif), '') = '' then raise exception 'Le motif est obligatoire.'; end if;
  perform set_config('ma2m.sortie', '1', true);
  update agence_mannequins set statut = 'actif', notes = coalesce(notes || E'\n', '') || 'Réactivé : ' || trim(p_motif)
   where id = p_mannequin and statut <> 'actif';
  get diagnostics nb = row_count;
  perform set_config('ma2m.sortie', '', true);
  if nb = 0 then raise exception 'Ce mannequin est déjà actif.'; end if;
end;
$$;
revoke all on function mannequin_reactiver(uuid, text) from public, anon;
grant execute on function mannequin_reactiver(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------------
-- 3. Reçus numérotés REC-AAAA-NNNNN (un par paiement validé, numéros continus, sans trou)
-- -----------------------------------------------------------------------------------
create table if not exists recus_compteur (
  annee int primary key,
  dernier int not null default 0
);
create table if not exists recus_paiements (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  annee int not null,
  rang int not null,
  paiement_id uuid not null unique references paiements_mannequins(id),
  emis_le timestamptz not null default now(),
  emis_par uuid references auth.users(id),
  unique (annee, rang)
);
alter table recus_compteur enable row level security;
alter table recus_paiements enable row level security;
revoke all on recus_compteur, recus_paiements from anon, authenticated;
drop policy if exists recus_lecture on recus_paiements;
create policy recus_lecture on recus_paiements for select using (portail_peut('paiements'));
grant select on recus_paiements to authenticated;

create or replace function recus_interdit()
returns trigger language plpgsql as $$
begin
  raise exception 'Un reçu émis ne se modifie ni ne s''efface.';
end;
$$;
drop trigger if exists recus_lecture_seule on recus_paiements;
create trigger recus_lecture_seule before update or delete on recus_paiements for each row execute function recus_interdit();
drop trigger if exists audit_recus_paiements on recus_paiements;
create trigger audit_recus_paiements after insert on recus_paiements for each row execute function audit_ecriture();

-- Émet (ou renvoie) le reçu d'un paiement VALIDÉ. Appelé deux fois : même numéro.
create or replace function recu_emettre(p_paiement uuid)
returns recus_paiements language plpgsql security definer set search_path = public as $$
declare
  p paiements_mannequins;
  r recus_paiements;
  a int := extract(year from now() at time zone 'Africa/Abidjan')::int;
  n int;
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé'; end if;
  select * into p from paiements_mannequins where id = p_paiement;
  if not found then raise exception 'Paiement introuvable.'; end if;
  if p.statut <> 'valide' then raise exception 'Un reçu ne s''émet que pour un paiement validé.'; end if;
  select * into r from recus_paiements where paiement_id = p_paiement;
  if found then return r; end if;
  insert into recus_compteur (annee, dernier) values (a, 0) on conflict (annee) do nothing;
  update recus_compteur set dernier = dernier + 1 where annee = a returning dernier into n;
  insert into recus_paiements (numero, annee, rang, paiement_id, emis_par)
  values ('REC-' || a || '-' || lpad(n::text, 5, '0'), a, n, p_paiement, auth.uid())
  returning * into r;
  return r;
end;
$$;
revoke all on function recu_emettre(uuid) from public, anon;
grant execute on function recu_emettre(uuid) to authenticated;

-- -----------------------------------------------------------------------------------
-- 4. Rapprochement avec Wave : numéro du payeur, référence de la transaction, état
-- -----------------------------------------------------------------------------------
create table if not exists rapprochements (
  paiement_id uuid primary key references paiements_mannequins(id),
  numero_wave text check (numero_wave is null or numero_wave ~ '^[0-9+ ]{6,20}$'),
  reference_wave text check (reference_wave is null or length(trim(reference_wave)) between 3 and 60),
  etat text not null default 'a_verifier' check (etat in ('a_verifier', 'introuvable', 'precision', 'rapproche')),
  note text,
  modifie_le timestamptz not null default now(),
  modifie_par uuid references auth.users(id),
  check (etat not in ('introuvable', 'precision') or coalesce(trim(note), '') <> '')
);
create index if not exists rapprochements_reference on rapprochements (reference_wave) where reference_wave is not null;
alter table rapprochements enable row level security;
revoke all on rapprochements from anon, authenticated;
drop policy if exists rapprochements_lecture on rapprochements;
create policy rapprochements_lecture on rapprochements for select using (portail_peut('paiements'));
drop policy if exists rapprochements_ajout on rapprochements;
create policy rapprochements_ajout on rapprochements for insert with check (portail_peut('paiements'));
drop policy if exists rapprochements_maj on rapprochements;
create policy rapprochements_maj on rapprochements for update using (portail_peut('paiements')) with check (portail_peut('paiements'));
grant select, insert, update on rapprochements to authenticated;

create or replace function rapprochements_garde_fous()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' and NEW.paiement_id <> OLD.paiement_id then
    raise exception 'Le paiement d''un rapprochement ne change pas.';
  end if;
  NEW.modifie_le := now();
  NEW.modifie_par := auth.uid();
  return NEW;
end;
$$;
drop trigger if exists rapprochements_garde_fous on rapprochements;
create trigger rapprochements_garde_fous before insert or update on rapprochements for each row execute function rapprochements_garde_fous();
drop trigger if exists audit_rapprochements on rapprochements;
create trigger audit_rapprochements after insert or update or delete on rapprochements for each row execute function audit_ecriture();
revoke delete on rapprochements from authenticated;

-- -----------------------------------------------------------------------------------
-- 5. Messages : modèles modifiables + historique des envois
-- -----------------------------------------------------------------------------------
create table if not exists modeles_messages (
  cle text primary key check (cle in ('appel', 'relance3', 'relance5', 'non_recu', 'confirme', 'libre')),
  texte text not null check (length(trim(texte)) between 1 and 2000),
  modifie_le timestamptz not null default now(),
  modifie_par uuid references auth.users(id)
);
alter table modeles_messages enable row level security;
revoke all on modeles_messages from anon, authenticated;
drop policy if exists modeles_lecture on modeles_messages;
create policy modeles_lecture on modeles_messages for select using (portail_peut('paiements'));
drop policy if exists modeles_ajout on modeles_messages;
create policy modeles_ajout on modeles_messages for insert with check (portail_est_principal());
drop policy if exists modeles_maj on modeles_messages;
create policy modeles_maj on modeles_messages for update using (portail_est_principal()) with check (portail_est_principal());
grant select, insert, update on modeles_messages to authenticated;

create or replace function modeles_garde_fous()
returns trigger language plpgsql as $$
begin
  if not portail_est_principal() then raise exception 'Seul l''administrateur principal modifie les modèles.'; end if;
  NEW.modifie_le := now();
  NEW.modifie_par := auth.uid();
  return NEW;
end;
$$;
drop trigger if exists modeles_garde_fous on modeles_messages;
create trigger modeles_garde_fous before insert or update on modeles_messages for each row execute function modeles_garde_fous();
drop trigger if exists audit_modeles_messages on modeles_messages;
create trigger audit_modeles_messages after insert or update or delete on modeles_messages for each row execute function audit_ecriture();
revoke delete on modeles_messages from authenticated;

create table if not exists messages_envoyes (
  id uuid primary key default gen_random_uuid(),
  mannequin_id uuid not null references agence_mannequins(id),
  mois date,
  modele text not null check (modele in ('appel', 'relance3', 'relance5', 'non_recu', 'confirme', 'libre')),
  canal text not null check (canal in ('whatsapp', 'email', 'sms')),
  envoye_le timestamptz not null default now(),
  envoye_par uuid references auth.users(id)
);
create index if not exists messages_envoyes_mannequin on messages_envoyes (mannequin_id, envoye_le desc);
alter table messages_envoyes enable row level security;
revoke all on messages_envoyes from anon, authenticated;
drop policy if exists messages_envoyes_lecture on messages_envoyes;
create policy messages_envoyes_lecture on messages_envoyes for select using (portail_peut('paiements'));
drop policy if exists messages_envoyes_ajout on messages_envoyes;
create policy messages_envoyes_ajout on messages_envoyes for insert with check (portail_peut('paiements'));
grant select, insert on messages_envoyes to authenticated;

create or replace function messages_envoyes_garde_fous()
returns trigger language plpgsql as $$
begin
  NEW.envoye_par := auth.uid();
  NEW.envoye_le := now();
  return NEW;
end;
$$;
drop trigger if exists messages_envoyes_garde_fous on messages_envoyes;
create trigger messages_envoyes_garde_fous before insert on messages_envoyes for each row execute function messages_envoyes_garde_fous();
drop trigger if exists audit_messages_envoyes on messages_envoyes;
create trigger audit_messages_envoyes after insert on messages_envoyes for each row execute function audit_ecriture();

-- -----------------------------------------------------------------------------------
-- 6. Réglages modifiables des paiements (administrateur principal, code récent)
-- -----------------------------------------------------------------------------------
create table if not exists reglages_paiements (
  cle text primary key check (cle in ('montant_inscription', 'montant_premier_mois', 'mensualite_standard',
                                      'mensualite_superieure', 'jour_limite', 'jour_relance_1', 'jour_relance_2')),
  valeur int not null check (valeur > 0),
  modifie_le timestamptz not null default now(),
  modifie_par uuid references auth.users(id)
);
alter table reglages_paiements enable row level security;
revoke all on reglages_paiements from anon, authenticated;
drop policy if exists reglages_lecture on reglages_paiements;
create policy reglages_lecture on reglages_paiements for select using (portail_peut('paiements'));
drop policy if exists reglages_ajout on reglages_paiements;
create policy reglages_ajout on reglages_paiements for insert with check (portail_est_principal());
drop policy if exists reglages_maj on reglages_paiements;
create policy reglages_maj on reglages_paiements for update using (portail_est_principal()) with check (portail_est_principal());
grant select, insert, update on reglages_paiements to authenticated;

create or replace function reglages_paiements_garde_fous()
returns trigger language plpgsql as $$
begin
  if not portail_est_principal() then raise exception 'Seul l''administrateur principal modifie les réglages.'; end if;
  perform portail_exiger_auth_recente();
  if NEW.cle like 'jour_%' and NEW.valeur > 28 then raise exception 'Un jour du mois doit être entre 1 et 28.'; end if;
  NEW.modifie_le := now();
  NEW.modifie_par := auth.uid();
  return NEW;
end;
$$;
drop trigger if exists reglages_paiements_garde_fous on reglages_paiements;
create trigger reglages_paiements_garde_fous before insert or update on reglages_paiements for each row execute function reglages_paiements_garde_fous();
drop trigger if exists audit_reglages_paiements on reglages_paiements;
create trigger audit_reglages_paiements after insert or update or delete on reglages_paiements for each row execute function audit_ecriture();
revoke delete on reglages_paiements from authenticated;

-- -----------------------------------------------------------------------------------
-- 7. Comptabilité : clôture mensuelle (photo des chiffres d'un mois terminé)
--    Sans nom de mannequin : seulement des totaux. Ne bloque PAS la saisie (une correction
--    reste possible, et laisse sa trace) : elle fige les chiffres qui ont été remis.
-- -----------------------------------------------------------------------------------
create table if not exists compta_clotures (
  mois date primary key check (mois = date_trunc('month', mois)::date),
  recettes bigint not null,
  depenses bigint not null,
  nb_ecritures int not null,
  note text,
  cloture_le timestamptz not null default now(),
  cloture_par uuid references auth.users(id)
);
alter table compta_clotures enable row level security;
revoke all on compta_clotures from anon, authenticated;
drop policy if exists compta_clotures_acces on compta_clotures;
create policy compta_clotures_acces on compta_clotures for select using (portail_peut('compta'));
grant select on compta_clotures to authenticated;
drop trigger if exists recaps_lecture_seule_compta on compta_clotures;
create trigger recaps_lecture_seule_compta before update or delete on compta_clotures for each row execute function recaps_interdit();
drop trigger if exists audit_compta_clotures on compta_clotures;
create trigger audit_compta_clotures after insert on compta_clotures for each row execute function audit_ecriture();

create or replace function compta_cloturer(p_mois date, p_note text default null)
returns compta_clotures language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_mois)::date;
  fin date := (date_trunc('month', p_mois) + interval '1 month')::date;
  r compta_clotures;
begin
  if not portail_peut('compta') then raise exception 'Accès refusé'; end if;
  if m >= date_trunc('month', current_date)::date then raise exception 'Seul un mois terminé peut être clôturé.'; end if;
  if exists (select 1 from compta_clotures where mois = m) then raise exception 'Ce mois est déjà clôturé.'; end if;
  insert into compta_clotures (mois, recettes, depenses, nb_ecritures, note, cloture_par)
  select m,
    coalesce(sum(montant) filter (where sens = 'recette'), 0),
    coalesce(sum(montant) filter (where sens = 'depense'), 0),
    count(*),
    nullif(trim(coalesce(p_note, '')), ''),
    auth.uid()
  from compta_ecritures where date_op >= m and date_op < fin and not coalesce(annule, false)
  returning * into r;
  return r;
end;
$$;
revoke all on function compta_cloturer(date, text) from public, anon;
grant execute on function compta_cloturer(date, text) to authenticated;

NOTIFY pgrst, 'reload schema';
select 'Compléments espaces 2 et 3 en place' as resultat;
