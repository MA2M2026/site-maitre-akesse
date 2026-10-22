-- ===================================================================================
-- « Payer les mannequins » : motif du cachet et REÇU (22/10/2026, demande de la propriétaire :
-- motif choisi dans une liste ; après le paiement, un joli reçu envoyé sur WhatsApp, avec un lien
-- vers sa page de reçu, et visible aussi dans l'Espace mannequin).
-- À exécuter UNE FOIS dans l'éditeur SQL de Supabase, APRÈS supabase-cachets.sql et
-- supabase-cachets-commission.sql. Rejouable sans danger (rien n'est supprimé).
-- ===================================================================================
alter table cachets_mannequins add column if not exists motif text
  check (motif is null or motif in ('defile', 'shooting', 'campagne', 'video', 'evenement', 'casting', 'autre'));
-- lien personnel du reçu (page /recu?r=…) : seul ce jeton donne accès au reçu, rien d'autre
alter table cachets_mannequins add column if not exists jeton uuid not null default gen_random_uuid();
create unique index if not exists cachets_mannequins_jeton on cachets_mannequins (jeton);
alter table cachets_mannequins add column if not exists numero_recu text unique;
create sequence if not exists cachets_recu_numero;

-- une saisie ne choisit ni le jeton ni le numéro du reçu
drop policy if exists cachets_ajout on cachets_mannequins;
create policy cachets_ajout on cachets_mannequins for insert
  with check (portail_peut('compta') and statut = 'a_payer' and ecriture_id is null and paye_le is null and mode is null
    and paye_par is null and compte_id is null and reference_wave is null and motif_annulation is null
    and numero_recu is null and cree_par = auth.uid());
create or replace function cachet_jeton_neuf()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  NEW.jeton := gen_random_uuid();
  return NEW;
end;
$$;
revoke all on function cachet_jeton_neuf() from public, anon, authenticated;
drop trigger if exists cachet_jeton_neuf on cachets_mannequins;
create trigger cachet_jeton_neuf before insert on cachets_mannequins for each row execute function cachet_jeton_neuf();

-- numéro du reçu donné au paiement (MA2M-CA-2026-0001…), gardé ensuite
create or replace function cachet_numero_recu()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.statut = 'paye' and OLD.statut <> 'paye' and NEW.numero_recu is null then
    NEW.numero_recu := 'MA2M-CA-' || to_char(now() at time zone 'Africa/Abidjan', 'YYYY') || '-' || lpad(nextval('cachets_recu_numero')::text, 4, '0');
  end if;
  return NEW;
end;
$$;
revoke all on function cachet_numero_recu() from public, anon, authenticated;
drop trigger if exists cachet_numero_recu on cachets_mannequins;
create trigger cachet_numero_recu before update on cachets_mannequins for each row execute function cachet_numero_recu();

-- Page du reçu (sans compte) : seulement un cachet PAYÉ, et seulement ce qu'un reçu montre
-- (jamais la commission ni le compte de l'agence).
create or replace function cachet_recu_lire(p_jeton uuid)
returns table(numero text, beneficiaire text, montant int, motif text, prestation text, paye_le timestamptz, reference_wave text)
language sql stable security definer set search_path = public as $$
  select c.numero_recu, c.beneficiaire, c.montant, c.motif, c.prestation, c.paye_le, c.reference_wave
  from cachets_mannequins c where c.jeton = p_jeton and c.statut = 'paye';
$$;
revoke all on function cachet_recu_lire(uuid) from public;
grant execute on function cachet_recu_lire(uuid) to anon, authenticated;

-- Espace mannequin : ses propres cachets payés (mannequin du registre reliée à son compte du site)
create or replace function mes_cachets()
returns table(numero text, montant int, motif text, prestation text, paye_le timestamptz, jeton uuid)
language sql stable security definer set search_path = public as $$
  select c.numero_recu, c.montant, c.motif, c.prestation, c.paye_le, c.jeton
  from cachets_mannequins c join agence_mannequins m on m.id = c.agence_mannequin_id
  where auth.uid() is not null and m.user_id = auth.uid() and c.statut = 'paye'
  order by c.paye_le desc;
$$;
revoke all on function mes_cachets() from public, anon;
grant execute on function mes_cachets() to authenticated;

notify pgrst, 'reload schema';
