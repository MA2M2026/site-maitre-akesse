-- ===================================================================================
-- Espace 2 — Paramètres : liens de paiement Wave Business (cahier V3, 7.2)
-- À exécuter UNE FOIS par la propriétaire, dans l'éditeur SQL de Supabase, APRÈS
-- supabase-administration.sql. Rejouable sans danger (rien n'est supprimé ni remplacé).
-- ===================================================================================
-- Un lien de paiement par montant (25 000 : inscription + 1er mois ; 10 000 et 20 000 :
-- mensualités). Lecture : administrateur principal, encaissements (ou délégation). Écriture :
-- administrateur principal seul, avec un code d'authentification récent. Rien ne s'efface :
-- un lien qui ne sert plus est désactivé.
create table if not exists liens_wave (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('inscription', 'mensualite', 'autre')),
  libelle text not null check (length(trim(libelle)) between 1 and 120),
  montant int not null check (montant > 0),
  adresse text not null check (adresse ~* '^https://[^[:space:]]+$' and length(adresse) <= 500),
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  cree_par uuid references auth.users(id)
);
-- un seul lien actif par type et par montant
create unique index if not exists liens_wave_un_actif on liens_wave (type, montant) where actif;

alter table liens_wave enable row level security;
drop policy if exists liens_wave_lecture on liens_wave;
create policy liens_wave_lecture on liens_wave for select using (portail_peut('paiements'));
drop policy if exists liens_wave_ajout on liens_wave;
create policy liens_wave_ajout on liens_wave for insert with check (portail_est_principal());
drop policy if exists liens_wave_modif on liens_wave;
create policy liens_wave_modif on liens_wave for update using (portail_est_principal()) with check (portail_est_principal());

-- Garde-fous : administrateur principal seulement, code récent, seuls « actif » et le libellé changent
create or replace function liens_wave_garde_fous()
returns trigger language plpgsql as $$
begin
  if not portail_est_principal() then
    raise exception 'Seul l''administrateur principal peut modifier les liens de paiement.';
  end if;
  perform portail_exiger_auth_recente();
  if TG_OP = 'INSERT' then
    NEW.cree_par := auth.uid();
  else
    if NEW.type <> OLD.type or NEW.montant <> OLD.montant or NEW.adresse <> OLD.adresse or NEW.cree_le <> OLD.cree_le then
      raise exception 'Un lien ne se modifie pas : désactivez-le et ajoutez-en un nouveau.';
    end if;
  end if;
  return NEW;
end;
$$;
drop trigger if exists liens_wave_garde_fous on liens_wave;
create trigger liens_wave_garde_fous before insert or update on liens_wave for each row execute function liens_wave_garde_fous();

-- Journal d'audit : toute écriture est tracée
drop trigger if exists audit_liens_wave on liens_wave;
create trigger audit_liens_wave after insert or update or delete on liens_wave for each row execute function audit_ecriture();

grant select, insert, update on liens_wave to authenticated;
NOTIFY pgrst, 'reload schema';
select 'Paramètres — liens Wave Business en place' as resultat;
