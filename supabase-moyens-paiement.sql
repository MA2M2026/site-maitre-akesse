-- =====================================================================================================
-- Moyens de paiement des mannequins (12/11/2026, demande de la propriétaire) — À COLLER UNE FOIS dans
-- Supabase (SQL Editor). Rien n'est effacé ; peut être recollé sans risque.
-- Six moyens préparés : Wave, Orange Money, MTN Money, Moov Money, carte bancaire (Visa), virement.
-- Chacun s'allume dans l'Administration (Paramètres > Moyens de paiement) avec son numéro, son lien ou son RIB,
-- le jour où l'agence a le compte correspondant : aucune modification du site n'est alors nécessaire.
-- Aujourd'hui : seul Wave est allumé (les liens Wave des Paramètres restent utilisés).
-- =====================================================================================================

create table if not exists moyens_paiement (
  code text primary key check (code in ('wave', 'orange_money', 'mtn_money', 'moov_money', 'carte', 'virement')),
  nom text not null,
  actif boolean not null default false,
  numero text check (numero is null or numero ~ '^[0-9+ ]{6,20}$'),   -- numéro marchand ou de réception (mobile money)
  titulaire text check (titulaire is null or length(titulaire) <= 120),   -- au nom de…
  lien text check (lien is null or lien ~ '^https://[^\s]+$'),           -- lien de paiement (carte bancaire)
  rib text check (rib is null or length(rib) <= 300),                     -- banque, IBAN / RIB (virement)
  consignes text check (consignes is null or length(consignes) <= 400),   -- phrase affichée aux mannequins
  ordre int not null default 0,
  maj_le timestamptz not null default now(),
  maj_par uuid references auth.users(id)
);
insert into moyens_paiement (code, nom, actif, ordre) values
  ('wave', 'Wave', true, 1), ('orange_money', 'Orange Money', false, 2), ('mtn_money', 'MTN Money', false, 3),
  ('moov_money', 'Moov Money', false, 4), ('carte', 'Carte bancaire (Visa)', false, 5), ('virement', 'Virement bancaire', false, 6)
on conflict (code) do nothing;

alter table moyens_paiement enable row level security;
drop policy if exists moyens_paiement_lecture on moyens_paiement;
create policy moyens_paiement_lecture on moyens_paiement for select using (portail_peut('paiements') or portail_peut('compta'));
drop policy if exists moyens_paiement_modif on moyens_paiement;
create policy moyens_paiement_modif on moyens_paiement for update using (portail_est_principal()) with check (portail_est_principal());

-- garde-fous : un moyen allumé doit dire où payer ; qui a modifié et quand
create or replace function moyens_paiement_garde_fous()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.code <> OLD.code then raise exception 'Le code d''un moyen ne change pas.'; end if;
  if NEW.actif and NEW.code in ('orange_money', 'mtn_money', 'moov_money') and NEW.numero is null then
    raise exception 'Indiquez le numéro qui reçoit les paiements avant d''allumer %.', NEW.nom; end if;
  if NEW.actif and NEW.code = 'carte' and NEW.lien is null then raise exception 'Indiquez le lien de paiement par carte avant de l''allumer.'; end if;
  if NEW.actif and NEW.code = 'virement' and NEW.rib is null then raise exception 'Indiquez la banque et le RIB avant d''allumer le virement.'; end if;
  NEW.maj_le := now(); NEW.maj_par := auth.uid();
  return NEW;
end;
$$;
drop trigger if exists moyens_paiement_garde_fous on moyens_paiement;
create trigger moyens_paiement_garde_fous before update on moyens_paiement for each row execute function moyens_paiement_garde_fous();

-- Moyens allumés, pour les pages de paiement (aussi la page d'inscription, sans compte)
create or replace function moyens_paiement_publics()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'nom', nom, 'numero', numero, 'titulaire', titulaire, 'lien', lien,
    'rib', rib, 'consignes', consignes) order by ordre), '[]'::jsonb)
  from moyens_paiement where actif;
$$;
revoke all on function moyens_paiement_publics() from public;
grant execute on function moyens_paiement_publics() to anon, authenticated;

-- Le paiement garde le moyen utilisé (en plus de « wave », « especes », « avant_systeme »)
alter table paiements_mannequins drop constraint if exists paiements_mannequins_mode_check;
alter table paiements_mannequins add constraint paiements_mannequins_mode_check
  check (mode in ('wave', 'orange_money', 'mtn_money', 'moov_money', 'carte', 'virement', 'especes', 'avant_systeme'));

-- Après « J'ai payé » : la mannequin précise le moyen de SES paiements encore en attente, déclarés à l'instant
-- (les fonctions de déclaration existantes ne changent pas ; Wave par défaut)
create or replace function paiements_preciser_moyen(p_moyen text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  if not exists (select 1 from moyens_paiement where code = p_moyen and actif) then raise exception 'Moyen de paiement indisponible.'; end if;
  update paiements_mannequins p set mode = p_moyen
   from agence_mannequins a
   where a.id = p.mannequin_id and a.user_id = auth.uid() and p.statut = 'declare' and p.mode = 'wave'
     and p.declare_le > now() - interval '10 minutes';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function paiements_preciser_moyen(text) from public, anon;
grant execute on function paiements_preciser_moyen(text) to authenticated;

-- Comptabilité : la recette va sur le bon compte (espèces → caisse ; Wave → Wave ; Orange, MTN, Moov → compte
-- « Autre mobile money » ; carte et virement → banque ; sans compte de ce type, Wave, pour ne jamais rien perdre)
create or replace function compta_compte_du_mode(p_mode text)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select id from compta_comptes where type = case p_mode when 'especes' then 'caisse' when 'wave' then 'wave'
       when 'carte' then 'banque' when 'virement' then 'banque' else 'mobile_money' end order by actif desc, cree_le limit 1),
    (select id from compta_comptes where type = case when p_mode = 'especes' then 'caisse' else 'wave' end order by actif desc, cree_le limit 1));
$$;
revoke all on function compta_compte_du_mode(text) from public, anon, authenticated;

create or replace function compta_depuis_espace2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  compte uuid;
begin
  if TG_OP = 'UPDATE' and OLD.statut = 'valide' then
    if NEW.statut = OLD.statut and NEW.montant is not distinct from OLD.montant and NEW.mode = OLD.mode then return NEW; end if;
    update compta_ecritures set annule = true, motif_annulation = 'Paiement corrigé ou refusé dans l''espace 2'
    where paiement_id = NEW.id and not annule;
  end if;
  if NEW.statut <> 'valide' or NEW.montant is null or NEW.mode = 'avant_systeme' then return NEW; end if;
  compte := compta_compte_du_mode(NEW.mode);
  if compte is null then
    perform journaliser('Comptabilité : paiement validé sans compte pour le recevoir (' || NEW.mode || ')',
                        'paiements_mannequins', NEW.id::text, null, null);
    return NEW;
  end if;
  insert into compta_ecritures (sens, date_op, montant, compte_id, categorie, libelle, source, paiement_id)
  values ('recette', coalesce(NEW.valide_le, now())::date, NEW.montant, compte,
          case when NEW.objet = 'inscription' then 'inscription' else 'formation' end,
          case when NEW.objet = 'inscription' then 'Droit d''inscription d''un mannequin'
               else 'Mensualité de formation · ' || to_char(NEW.mois, 'MM/YYYY') end,
          'espace2', NEW.id)
  on conflict (paiement_id) where not annule do nothing;
  return NEW;
end;
$$;
revoke all on function compta_depuis_espace2() from public, anon, authenticated;
