-- ===================================================================================
-- Extension 140 — Portail d'administration (cahier des charges v2.3, 18/10/2026)
-- ===================================================================================
-- À coller UNE FOIS dans Supabase (SQL Editor), en entier, APRÈS supabase-setup.sql et
-- supabase-extension.sql. Rejouable sans danger : tout est « if not exists » /
-- « create or replace » / « drop policy if exists ». AUCUNE donnée existante n'est
-- supprimée ni modifiée (mannequins, photos, candidatures, inscriptions, actualités,
-- comptes : tout est conservé). Seules des tables, vues et fonctions sont AJOUTÉES.
--
-- Contenu :
--   1. Comptes du personnel, rôles, délégations, appareils (section 4 du cahier)
--   2. Double authentification obligatoire (MFA) et nouvelle authentification récente
--   3. Journal d'audit en écriture seule (section 5)
--   4. Espace 2 : registre, parents, liens Wave, échéances, déclarations « J'ai payé »,
--      paiements, reçus, liens personnels, messages, récapitulatifs (section 7, 15)
--   5. Espace 3 : activités, clients, documents numérotés, dépenses, trésorerie,
--      impôts, demandes du comptable, clôtures, entité légale et FNE (section 8)
--   6. Inscription simplifiée : codes individuels (section 14)
--   7. Fonctions « tout ou rien » (section 16) : valider un paiement, créer les échéances
--      du mois, relances, passage à Non payé, figer le récapitulatif, émettre un document
--   8. Vues sans argent pour l'espace 1 et vue d'agrégats pour le comptable
--
-- Rôles (table staff_profiles.role) :
--   principal = Administrateur principal (Maître Akesse) : tout
--   site      = Administrateur du site : espace 1, sans argent ni contact privé
--   caisse    = Responsable des encaissements : espace 2
--   compta    = Comptable : espace 3, totaux sans noms
-- Trois verrous : l'interface masque, les fonctions refusent, la RLS ne renvoie rien.
-- ===================================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------------
-- 1. Comptes du personnel
-- -----------------------------------------------------------------------------------
create table if not exists staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nom text not null,
  email text not null,
  role text not null check (role in ('principal', 'site', 'caisse', 'compta')),
  actif boolean not null default true,
  cree_par uuid references auth.users(id),
  cree_le timestamptz not null default now(),
  desactive_le timestamptz
);
-- un seul administrateur principal
create unique index if not exists staff_un_seul_principal on staff_profiles ((role)) where role = 'principal';

create table if not exists staff_module_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references staff_profiles(user_id) on delete cascade,
  module text not null check (module in ('site', 'paiements', 'compta', 'noms_payeurs', 'contacts_prives')),
  debut timestamptz not null default now(),
  fin timestamptz,
  accorde_par uuid not null references auth.users(id),
  revoque_le timestamptz,
  cree_le timestamptz not null default now()
);

create table if not exists staff_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references staff_profiles(user_id) on delete cascade,
  appareil text not null,             -- identifiant tiré au hasard par l'application
  libelle text,                       -- « iPhone, Safari » (navigateur déclaré)
  installe_le timestamptz not null default now(),
  derniere_activite timestamptz not null default now(),
  revoque boolean not null default false,
  unique (user_id, appareil)
);

-- -----------------------------------------------------------------------------------
-- 2. Qui est connecté, avec quels droits
-- -----------------------------------------------------------------------------------
-- Double authentification : le jeton de connexion doit être de niveau « aal2 » (code de
-- l'application d'authentification validé). Sans cela, aucun rôle n'est reconnu.
create or replace function portail_mfa_ok()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- Appareil révoqué : l'application envoie son identifiant dans l'en-tête « x-appareil »
create or replace function portail_appareil_ok()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  entetes json;
  app text;
begin
  begin
    entetes := current_setting('request.headers', true)::json;
  exception when others then
    entetes := null;
  end;
  app := coalesce(entetes ->> 'x-appareil', '');
  if app = '' then
    return true;
  end if;
  return not exists (select 1 from staff_devices where user_id = auth.uid() and appareil = app and revoque);
end;
$$;

create or replace function portail_role()
returns text language sql stable security definer set search_path = public as $$
  select s.role from staff_profiles s
  where s.user_id = auth.uid() and s.actif and portail_mfa_ok() and portail_appareil_ok();
$$;

-- Accès à un espace : rôle, ou délégation en cours accordée par l'administrateur principal
create or replace function portail_peut(p_module text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when portail_role() is null then false
    when portail_role() = 'principal' then true
    when p_module = 'site' and portail_role() = 'site' then true
    when p_module = 'paiements' and portail_role() = 'caisse' then true
    when p_module = 'compta' and portail_role() = 'compta' then true
    else exists (
      select 1 from staff_module_grants g
      where g.user_id = auth.uid() and g.module = p_module and g.revoque_le is null
        and g.debut <= now() and (g.fin is null or g.fin > now()))
  end;
$$;

create or replace function portail_est_principal()
returns boolean language sql stable as $$
  select portail_role() = 'principal';
$$;

-- Action sensible : le code MFA doit avoir été saisi il y a moins de 10 minutes
-- (export, suppression, changement de rôle, sortie d'un mannequin, avoir, montants, liens).
create or replace function portail_exiger_auth_recente()
returns void language plpgsql stable as $$
declare
  dernier bigint;
begin
  select max((m ->> 'timestamp')::bigint) into dernier
  from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) m
  where m ->> 'method' in ('totp', 'mfa/totp');
  if dernier is null or dernier < extract(epoch from now()) - 600 then
    raise exception 'AUTH_RECENTE: confirmez votre code de l''application d''authentification pour cette action.';
  end if;
end;
$$;

-- L'application déclare l'appareil où elle est installée (liste visible par l'administrateur
-- principal). Nouvel appareil : l'application prévient la personne et l'administrateur principal.
create or replace function portail_enregistrer_appareil(p_appareil text, p_libelle text)
returns json language plpgsql security definer set search_path = public as $$
declare
  nouveau boolean;
begin
  if not exists (select 1 from staff_profiles where user_id = auth.uid() and actif) then
    return json_build_object('ok', false);
  end if;
  nouveau := not exists (select 1 from staff_devices where user_id = auth.uid() and appareil = left(p_appareil, 64));
  insert into staff_devices (user_id, appareil, libelle) values (auth.uid(), left(p_appareil, 64), left(p_libelle, 120))
  on conflict (user_id, appareil) do update set derniere_activite = now(), libelle = excluded.libelle;
  if nouveau then
    perform journaliser('Connexion depuis un nouvel appareil', 'staff_devices', left(p_appareil, 64), null, json_build_object('appareil', p_libelle)::jsonb);
  end if;
  return json_build_object(
    'ok', not exists (select 1 from staff_devices where user_id = auth.uid() and appareil = left(p_appareil, 64) and revoque),
    'nouveau', nouveau and exists (select 1 from staff_devices where user_id = auth.uid() and appareil <> left(p_appareil, 64)),
    'moi', (select json_build_object('nom', nom, 'email', email) from staff_profiles where user_id = auth.uid()),
    'principal', case when nouveau then (select email from staff_profiles where role = 'principal') end);
end;
$$;

-- Codes de secours (8 par personne, hachés) et outils du serveur du site
create table if not exists staff_backup_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references staff_profiles(user_id) on delete cascade,
  code_hache text not null,
  utilise_le timestamptz,
  cree_le timestamptz not null default now()
);
alter table staff_backup_codes enable row level security;
revoke all on staff_backup_codes from anon, authenticated;

create or replace function portail_codes_secours_creer(p_user uuid, p_haches text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not est_ecriture_serveur() then raise exception 'Accès refusé.'; end if;
  delete from staff_backup_codes where user_id = p_user;
  insert into staff_backup_codes (user_id, code_hache) select p_user, h from unnest(p_haches) h;
  perform journaliser('Codes de secours créés', 'staff_backup_codes', p_user::text, null, null);
end;
$$;
create or replace function portail_code_secours_utiliser(p_user uuid, p_hache text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
begin
  if not est_ecriture_serveur() then raise exception 'Accès refusé.'; end if;
  select id into cid from staff_backup_codes where user_id = p_user and code_hache = p_hache and utilise_le is null for update;
  if cid is null then return false; end if;
  update staff_backup_codes set utilise_le = now() where id = cid;
  perform journaliser('Code de secours utilisé', 'staff_backup_codes', p_user::text, null, null);
  return true;
end;
$$;
create or replace function portail_utilisateur_par_email(p_email text)
returns uuid language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) and est_ecriture_serveur() limit 1;
$$;
revoke all on function portail_codes_secours_creer(uuid, text[]), portail_code_secours_utiliser(uuid, text), portail_utilisateur_par_email(text) from public, anon, authenticated;
grant execute on function portail_enregistrer_appareil(text, text) to authenticated;

-- Ce que l'application demande à l'ouverture : mon rôle, mes espaces, mon nom
create or replace function portail_moi()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'role', portail_role(),
    'mfa', portail_mfa_ok(),
    'nom', (select nom from staff_profiles where user_id = auth.uid()),
    'actif', coalesce((select actif from staff_profiles where user_id = auth.uid()), false),
    'membre', exists (select 1 from staff_profiles where user_id = auth.uid()),
    'espaces', json_build_object(
      'site', portail_peut('site'), 'paiements', portail_peut('paiements'), 'compta', portail_peut('compta')),
    'contacts_prives', portail_est_principal() or portail_peut('paiements') or portail_peut('contacts_prives'),
    'noms_payeurs', portail_peut('paiements') or portail_peut('noms_payeurs'));
$$;

-- L'administrateur actuel (table admins, compte partagé) devient administrateur principal.
-- À n'exécuter qu'une fois : il ne se passe rien s'il existe déjà un principal.
insert into staff_profiles (user_id, nom, email, role)
select a.user_id, 'Maître Akesse', coalesce(u.email, ''), 'principal'
from admins a join auth.users u on u.id = a.user_id
where not exists (select 1 from staff_profiles where role = 'principal')
order by u.created_at
limit 1
on conflict (user_id) do nothing;

-- -----------------------------------------------------------------------------------
-- 3. Journal d'audit : écriture seule
-- -----------------------------------------------------------------------------------
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  acteur uuid,
  acteur_nom text,
  acteur_role text,
  action text not null,
  objet text,
  objet_id text,
  avant jsonb,
  apres jsonb,
  ip text,
  cree_le timestamptz not null default now()
);

create or replace function portail_ip()
returns text language plpgsql stable as $$
declare
  entetes json;
begin
  entetes := current_setting('request.headers', true)::json;
  return split_part(coalesce(entetes ->> 'x-forwarded-for', entetes ->> 'x-real-ip', ''), ',', 1);
exception when others then
  return null;
end;
$$;

create or replace function journaliser(p_action text, p_objet text, p_objet_id text, p_avant jsonb, p_apres jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (acteur, acteur_nom, acteur_role, action, objet, objet_id, avant, apres, ip)
  values (auth.uid(),
          coalesce((select nom from staff_profiles where user_id = auth.uid()), case when est_ecriture_serveur() then 'Système' end),
          coalesce((select role from staff_profiles where user_id = auth.uid()), case when est_ecriture_serveur() then 'systeme' end),
          p_action, p_objet, p_objet_id, p_avant, p_apres, portail_ip());
end;
$$;
revoke all on function journaliser(text, text, text, jsonb, jsonb) from public, anon;

-- Toute écriture dans une table du portail laisse une ligne d'audit (ancienne et nouvelle valeur)
create or replace function audit_ecriture()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform journaliser(
    lower(TG_OP) || ' ' || TG_TABLE_NAME, TG_TABLE_NAME,
    coalesce((case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end) ->> 'id',
             (case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end) ->> 'user_id'),
    case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end);
  return coalesce(NEW, OLD);
end;
$$;

-- Le journal ne se modifie ni ne s'efface, même par erreur
create or replace function audit_interdit()
returns trigger language plpgsql as $$
begin
  raise exception 'Le journal d''audit est en écriture seule.';
end;
$$;
drop trigger if exists audit_log_lecture_seule on audit_log;
create trigger audit_log_lecture_seule before update or delete on audit_log
  for each row execute function audit_interdit();

-- -----------------------------------------------------------------------------------
-- 4. Espace 2 : registre et paiements
-- -----------------------------------------------------------------------------------
-- Réglages (une seule ligne) : montants, calendrier, seuils. Montants en FCFA entiers.
create table if not exists portail_reglages (
  id boolean primary key default true check (id),
  droit_inscription int not null default 15000,
  premier_mois int not null default 10000,
  mensualite_standard int not null default 10000,
  mensualite_haute int not null default 20000,
  jour_limite int not null default 5 check (jour_limite between 1 and 28),
  jour_relance int not null default 3 check (jour_relance between 1 and 28),
  jour_derniere_relance int not null default 5 check (jour_derniere_relance between 1 and 28),
  age_majorite int not null default 18,
  mois_impayes_alerte int not null default 2,
  seuil_double_validation int not null default 100000,
  validite_code_jours int not null default 30,
  essais_code int not null default 3,
  heures_alerte_rapprochement int not null default 48,
  modifie_le timestamptz not null default now()
);
insert into portail_reglages (id) values (true) on conflict (id) do nothing;

create table if not exists agence_mannequins (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prenoms text,
  genre text,
  date_naissance date not null,
  telephone text,
  whatsapp text,
  email text,
  categorie text,
  statut text not null default 'actif' check (statut in ('actif', 'suspendu', 'sortie_proposee', 'sorti')),
  date_entree date not null default current_date,
  notes text,
  user_id uuid references auth.users(id) on delete set null,     -- compte du site, s'il existe
  model_id uuid references model_profiles(id) on delete set null, -- fiche publique, si elle existe
  candidature_id uuid references casting_applications(id) on delete set null,
  montant_mensuel int not null default 10000 check (montant_mensuel >= 0),
  exoneration_motif text,
  motif_sortie text,
  cree_le timestamptz not null default now()
);
create index if not exists agence_mannequins_user on agence_mannequins (user_id);
create index if not exists agence_mannequins_tel on agence_mannequins (telephone);

create table if not exists mannequin_guardians (
  id uuid primary key default gen_random_uuid(),
  mannequin_id uuid not null references agence_mannequins(id) on delete cascade,
  nom text not null,
  lien text,
  telephone text not null,
  whatsapp text,
  email text,
  cree_le timestamptz not null default now()
);

create table if not exists historique_mensualites (
  id uuid primary key default gen_random_uuid(),
  mannequin_id uuid not null references agence_mannequins(id) on delete cascade,
  ancien int,
  nouveau int not null,
  modifie_par uuid,
  modifie_le timestamptz not null default now()
);

create table if not exists wave_links (
  id uuid primary key default gen_random_uuid(),
  type_droit text not null check (type_droit in ('inscription', 'formation', 'autre')),
  montant int not null check (montant > 0),
  url text not null check (url ~ '^https://'),
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);

create table if not exists fee_dues (
  id uuid primary key default gen_random_uuid(),
  mannequin_id uuid not null references agence_mannequins(id) on delete cascade,
  type text not null check (type in ('inscription', 'mensualite', 'autre')),
  mois date not null,                         -- 1er jour du mois concerné
  montant_du int not null check (montant_du >= 0),
  montant_paye int not null default 0,
  date_limite date not null,
  statut text not null default 'a_payer'
    check (statut in ('a_payer', 'declare', 'payee', 'refusee', 'non_paye', 'exoneree', 'annulee')),
  motif text,
  cree_le timestamptz not null default now()
);
-- une seule mensualité par mannequin et par mois : la création des échéances est rejouable
create unique index if not exists fee_dues_une_par_mois on fee_dues (mannequin_id, mois) where type = 'mensualite';

create table if not exists payment_declarations (
  id uuid primary key default gen_random_uuid(),
  echeance_id uuid references fee_dues(id) on delete cascade,
  candidature_id uuid references casting_applications(id) on delete set null,
  numero_payeur text,
  operateur text not null default 'wave',
  montant int not null,
  declare_le timestamptz not null default now(),
  declare_par text,                            -- mannequin, parent, lien personnel, agent
  statut text not null default 'declare' check (statut in ('declare', 'valide', 'introuvable', 'precision', 'confirme_auto')),
  motif text,
  id_transaction text,
  traite_par uuid,
  traite_le timestamptz
);
create unique index if not exists declarations_transaction_unique on payment_declarations (id_transaction) where id_transaction is not null and statut in ('valide', 'confirme_auto');

create table if not exists payment_proofs (
  id uuid primary key default gen_random_uuid(),
  echeance_id uuid not null references fee_dues(id) on delete cascade,
  chemin text not null,                        -- stockage privé « preuves-paiement »
  empreinte text not null,                     -- pour repérer une capture réutilisée
  depose_par uuid,
  depose_le timestamptz not null default now(),
  statut text not null default 'deposee'
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  echeance_id uuid not null references fee_dues(id) on delete restrict,
  declaration_id uuid references payment_declarations(id),
  montant int not null check (montant > 0),
  mode text not null check (mode in ('wave', 'especes', 'virement', 'autre', 'orange', 'mtn', 'moov')),
  paye_par text,
  id_transaction text,
  confirmation text not null default 'manuelle' check (confirmation in ('manuelle', 'automatique')),
  valide_par uuid,
  valide_le timestamptz not null default now()
);

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,                 -- REC-AAAA-NNNNN
  paiement_id uuid not null unique references payments(id),
  emis_le timestamptz not null default now(),
  fichier text
);

-- Numérotation continue, sans trou, par type et par année (verrou de ligne)
create table if not exists portail_compteurs (
  type text not null,
  annee int not null,
  dernier int not null default 0,
  primary key (type, annee)
);
create or replace function portail_numero(p_type text, p_largeur int)
returns text language plpgsql security definer set search_path = public as $$
declare
  a int := extract(year from (now() at time zone 'Africa/Abidjan'))::int;
  n int;
begin
  insert into portail_compteurs (type, annee, dernier) values (p_type, a, 1)
  on conflict (type, annee) do update set dernier = portail_compteurs.dernier + 1
  returning dernier into n;
  return p_type || '-' || a || '-' || lpad(n::text, p_largeur, '0');
end;
$$;
revoke all on function portail_numero(text, int) from public, anon, authenticated;

create table if not exists pay_tokens (
  id uuid primary key default gen_random_uuid(),
  echeance_id uuid not null references fee_dues(id) on delete cascade,
  jeton_hache text not null unique,
  expire_le timestamptz not null,
  revoque boolean not null default false,
  cree_le timestamptz not null default now()
);

create table if not exists message_templates (
  code text primary key,
  libelle text not null,
  texte text not null,
  modifie_le timestamptz not null default now()
);
insert into message_templates (code, libelle, texte) values
  ('appel', 'Le 1er : appel de paiement', 'Bonjour {prenom}, votre droit de formation de {mois} s''élève à {montant}. À régler avant le {date_limite} avec le lien Wave : {lien_wave}. Après le paiement, appuyez sur « J''ai payé » dans votre espace : {lien_espace}'),
  ('relance', 'Relance', 'Bonjour {prenom}, rappel : le paiement de {mois} ({montant}) n''est pas encore reçu. Date limite : le {date_limite}. Lien Wave : {lien_wave}'),
  ('derniere_relance', 'Dernière relance', 'Bonjour {prenom}, dernier rappel : le délai de paiement de {mois} ({montant}) se termine le {date_limite}. Lien Wave : {lien_wave}'),
  ('non_recu', 'Paiement non reçu', 'Bonjour {prenom}, le paiement de {mois} n''a pas été reçu dans le délai. Merci de régulariser ou de contacter l''agence.'),
  ('confirme', 'Paiement confirmé', 'Bonjour {prenom}, votre paiement de {mois} ({montant}) est confirmé. Votre reçu est disponible dans votre espace.'),
  ('refuse', 'Paiement non retrouvé', 'Bonjour {prenom}, votre paiement de {mois} n''a pas été retrouvé. Réessayez ou contactez l''agence.')
on conflict (code) do nothing;

create table if not exists message_log (
  id uuid primary key default gen_random_uuid(),
  mannequin_id uuid references agence_mannequins(id) on delete set null,
  echeance_id uuid references fee_dues(id) on delete set null,
  modele text,
  canal text not null check (canal in ('espace', 'email', 'sms', 'whatsapp')),
  destinataire text,                           -- « Parent · Nom » ou « Lui-même · Nom »
  adresse text,                                -- e-mail ou téléphone
  texte text not null,
  statut text not null default 'a_envoyer' check (statut in ('a_envoyer', 'envoye', 'echec', 'sans_fournisseur')),
  tentatives int not null default 0,
  planifie_le timestamptz not null default now(),
  envoye_le timestamptz,
  erreur text
);
create index if not exists message_log_a_envoyer on message_log (statut, planifie_le);

-- Notifications visibles dans l'espace du mannequin (canal « espace »)
create table if not exists notifications_mannequins (
  id uuid primary key default gen_random_uuid(),
  mannequin_id uuid not null references agence_mannequins(id) on delete cascade,
  texte text not null,
  lu boolean not null default false,
  cree_le timestamptz not null default now()
);

create table if not exists month_snapshots (
  mois date primary key,
  contenu jsonb not null,
  fige_le timestamptz not null default now(),
  fige_par uuid
);

-- -----------------------------------------------------------------------------------
-- 5. Espace 3 : comptabilité
-- -----------------------------------------------------------------------------------
create table if not exists activities (
  code text primary key,
  libelle text not null
);
insert into activities (code, libelle) values
  ('inscription', 'Inscription'), ('formation', 'Formation'), ('masterclass', 'Masterclass'),
  ('cours', 'Cours'), ('casting', 'Casting'), ('collaboration', 'Collaboration'),
  ('mise_a_disposition', 'Mise à disposition'), ('choregraphie', 'Chorégraphie'),
  ('direction_artistique', 'Direction artistique'), ('autre', 'Autre')
on conflict (code) do nothing;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  contact text,
  telephone text,
  email text,
  identifiant_fiscal text,
  cree_le timestamptz not null default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  contact text,
  identifiant_fiscal text,
  cree_le timestamptz not null default now()
);

create table if not exists company_settings (
  id boolean primary key default true check (id),
  raison_sociale text,
  rccm text,
  ncc text,
  regime text,
  assujetti_tva boolean,
  taux_tva numeric(5, 2) not null default 18.00,
  mode_legal boolean not null default false,
  active_le timestamptz,
  modifie_le timestamptz not null default now()
);
insert into company_settings (id) values (true) on conflict (id) do nothing;

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('devis', 'proforma', 'facture', 'avoir')),
  numero text unique,                          -- attribué à l'émission, jamais modifié
  client_id uuid references clients(id),
  activite text references activities(code),
  statut text not null default 'brouillon'
    check (statut in ('brouillon', 'emis', 'envoye', 'partiel', 'paye', 'annule')),
  date_emission date,
  echeance date,
  total_ht int not null default 0,
  total_tva int not null default 0,
  total_ttc int not null default 0,
  paye int not null default 0,
  mention text,                                -- « Document non fiscal… » en mode pré-légal
  origine_id uuid references invoices(id),     -- devis → proforma → facture ; facture → avoir
  conditions text,
  cree_le timestamptz not null default now()
);

create table if not exists invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  designation text not null,
  quantite numeric(10, 2) not null default 1 check (quantite > 0),
  prix_unitaire int not null check (prix_unitaire >= 0),
  remise int not null default 0,
  tva boolean not null default false,
  ordre int not null default 0
);

create table if not exists treasury_accounts (
  code text primary key,
  libelle text not null
);
insert into treasury_accounts (code, libelle) values
  ('caisse', 'Caisse'), ('wave', 'Wave Business'), ('banque', 'Banque'), ('mobile', 'Autre monnaie mobile')
on conflict (code) do nothing;

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  numero text unique,                          -- DEP-AAAA-NNNN
  date_depense date not null,
  montant int not null check (montant > 0),
  categorie text not null,
  fournisseur_id uuid references suppliers(id),
  libelle text not null,
  compte text not null references treasury_accounts(code),
  justificatif text,                           -- stockage privé « pieces-comptables »
  tva_deductible int not null default 0,
  cree_par uuid,
  cree_le timestamptz not null default now()
);

create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  date_ecriture date not null,
  sens text not null check (sens in ('recette', 'depense')),
  montant int not null check (montant > 0),
  activite text,                               -- recette : code d'activité ; dépense : catégorie
  compte text not null references treasury_accounts(code),
  source text not null check (source in ('mannequin', 'facture', 'depense', 'manuel', 'hors_ligne')),
  reference text not null,                     -- REC-…, FAC-…, DEP-… (jamais de nom de mannequin)
  libelle text,
  cree_le timestamptz not null default now()
);

create table if not exists tax_obligations (
  id uuid primary key default gen_random_uuid(),
  obligation text not null,
  echeance date not null,
  statut text not null default 'a_faire' check (statut in ('a_faire', 'fait')),
  rappel_jours int not null default 7
);

create table if not exists accountant_requests (
  id uuid primary key default gen_random_uuid(),
  objet text not null,
  ecriture_id uuid references ledger_entries(id),
  statut text not null default 'ouverte' check (statut in ('ouverte', 'traitee')),
  reponse text,
  cree_par uuid,
  cree_le timestamptz not null default now(),
  traite_le timestamptz
);

create table if not exists fiscal_periods (
  mois date primary key,
  statut text not null default 'ouverte' check (statut in ('ouverte', 'verrouillee')),
  verrouille_par uuid,
  verrouille_le timestamptz
);

create table if not exists fne_documents (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id),
  numero_dgi text,
  qr_code text,
  cachet text,
  transmis_le timestamptz,
  statut text not null default 'a_transmettre'
);

-- Une période verrouillée ne reçoit plus aucune écriture (sauf l'administrateur principal)
create or replace function compta_periode_ouverte()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d date := date_trunc('month', coalesce(
    (to_jsonb(coalesce(NEW, OLD)) ->> 'date_ecriture')::date,
    (to_jsonb(coalesce(NEW, OLD)) ->> 'date_depense')::date,
    (to_jsonb(coalesce(NEW, OLD)) ->> 'date_emission')::date,
    current_date))::date;
begin
  if exists (select 1 from fiscal_periods where mois = d and statut = 'verrouillee')
     and not portail_est_principal() then
    raise exception 'Période verrouillée : écriture refusée.';
  end if;
  return coalesce(NEW, OLD);
end;
$$;

-- Un document émis ne se modifie plus : on le corrige par un avoir
create or replace function compta_document_fige()
returns trigger language plpgsql as $$
begin
  if OLD.statut <> 'brouillon' then
    if NEW.numero is distinct from OLD.numero or NEW.total_ttc <> OLD.total_ttc or NEW.client_id is distinct from OLD.client_id
       or NEW.type <> OLD.type or NEW.date_emission is distinct from OLD.date_emission then
      raise exception 'Document émis : il ne se modifie plus. Corrigez-le par un avoir.';
    end if;
  end if;
  return NEW;
end;
$$;
create or replace function compta_lignes_figees()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from invoices where id = coalesce(NEW.invoice_id, OLD.invoice_id) and statut <> 'brouillon') then
    raise exception 'Document émis : ses lignes ne se modifient plus.';
  end if;
  return coalesce(NEW, OLD);
end;
$$;

-- -----------------------------------------------------------------------------------
-- 6. Codes individuels d'inscription
-- -----------------------------------------------------------------------------------
alter table casting_applications add column if not exists source text not null default 'en_ligne';
-- nouveau statut « inscrite » (paiement d'inscription validé) ; les anciens restent valables
alter table casting_applications drop constraint if exists casting_applications_status_check;
alter table casting_applications add constraint casting_applications_status_check
  check (status in ('nouvelle', 'vue', 'en étude', 'en attente', 'retenue', 'refusée', 'inscrite'));
alter table casting_applications add column if not exists lieu_casting text;

create table if not exists registration_codes (
  id uuid primary key default gen_random_uuid(),
  candidature_id uuid not null references casting_applications(id) on delete cascade,
  code_hache text not null unique,
  indice text not null,                        -- 2 derniers caractères, pour que l'agent s'y retrouve
  expire_le timestamptz not null,
  utilise_le timestamptz,
  essais int not null default 0,
  statut text not null default 'genere' check (statut in ('genere', 'utilise', 'expire', 'bloque', 'annule')),
  cree_par uuid,
  cree_le timestamptz not null default now()
);

-- Demandes de correction du nom ou de la date de naissance (vérifiées par l'agence)
create table if not exists demandes_correction (
  id uuid primary key default gen_random_uuid(),
  candidature_id uuid not null references casting_applications(id) on delete cascade,
  champ text not null check (champ in ('nom', 'date_naissance')),
  valeur text not null,
  statut text not null default 'ouverte' check (statut in ('ouverte', 'acceptee', 'refusee')),
  cree_le timestamptz not null default now()
);

-- -----------------------------------------------------------------------------------
-- RLS : chaque table n'est lisible que par l'espace qui la concerne
-- -----------------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['staff_profiles', 'staff_module_grants', 'staff_devices', 'audit_log',
    'portail_reglages', 'agence_mannequins', 'mannequin_guardians', 'historique_mensualites', 'wave_links',
    'fee_dues', 'payment_declarations', 'payment_proofs', 'payments', 'receipts', 'portail_compteurs',
    'pay_tokens', 'message_templates', 'message_log', 'notifications_mannequins', 'month_snapshots',
    'activities', 'clients', 'suppliers', 'company_settings', 'invoices', 'invoice_lines',
    'treasury_accounts', 'expenses', 'ledger_entries', 'tax_obligations', 'accountant_requests',
    'fiscal_periods', 'fne_documents', 'registration_codes', 'demandes_correction']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;

-- Sécurité du portail : administrateur principal seul (chacun lit sa propre fiche)
drop policy if exists staff_lecture on staff_profiles;
create policy staff_lecture on staff_profiles for select using (user_id = auth.uid() or portail_est_principal());
drop policy if exists staff_ecriture on staff_profiles;
create policy staff_ecriture on staff_profiles for all using (portail_est_principal()) with check (portail_est_principal());
drop policy if exists grants_lecture on staff_module_grants;
create policy grants_lecture on staff_module_grants for select using (user_id = auth.uid() or portail_est_principal());
drop policy if exists grants_ecriture on staff_module_grants;
create policy grants_ecriture on staff_module_grants for all using (portail_est_principal()) with check (portail_est_principal());
drop policy if exists appareils_lecture on staff_devices;
create policy appareils_lecture on staff_devices for select using (user_id = auth.uid() or portail_est_principal());
drop policy if exists appareils_ecriture on staff_devices;
create policy appareils_ecriture on staff_devices for update using (portail_est_principal()) with check (portail_est_principal());
drop policy if exists audit_lecture on audit_log;
create policy audit_lecture on audit_log for select using (portail_est_principal());

-- Espace 2
drop policy if exists reglages_lecture on portail_reglages;
create policy reglages_lecture on portail_reglages for select using (portail_peut('paiements') or portail_peut('site'));
drop policy if exists reglages_ecriture on portail_reglages;
create policy reglages_ecriture on portail_reglages for update using (portail_est_principal()) with check (portail_est_principal());
do $$
declare
  t text;
begin
  foreach t in array array['agence_mannequins', 'mannequin_guardians', 'historique_mensualites', 'fee_dues',
    'payment_declarations', 'payment_proofs', 'payments', 'receipts', 'message_log', 'notifications_mannequins',
    'month_snapshots', 'message_templates']
  loop
    execute format('drop policy if exists espace2_lecture on %I', t);
    execute format('create policy espace2_lecture on %I for select using (portail_peut(''paiements''))', t);
    execute format('drop policy if exists espace2_ecriture on %I', t);
    execute format('create policy espace2_ecriture on %I for insert with check (portail_peut(''paiements''))', t);
    execute format('drop policy if exists espace2_modif on %I', t);
    execute format('create policy espace2_modif on %I for update using (portail_peut(''paiements'')) with check (portail_peut(''paiements''))', t);
  end loop;
end $$;
-- liens Wave : lus par l'espace 2, modifiés par l'administrateur principal seul
drop policy if exists wave_lecture on wave_links;
create policy wave_lecture on wave_links for select using (portail_peut('paiements'));
drop policy if exists wave_ecriture on wave_links;
create policy wave_ecriture on wave_links for all using (portail_est_principal()) with check (portail_est_principal());

-- Le mannequin (ou son compte) voit ses propres échéances, reçus, notifications
drop policy if exists mannequin_lit_sa_fiche on agence_mannequins;
create policy mannequin_lit_sa_fiche on agence_mannequins for select using (user_id = auth.uid());
drop policy if exists mannequin_lit_ses_echeances on fee_dues;
create policy mannequin_lit_ses_echeances on fee_dues for select
  using (exists (select 1 from agence_mannequins m where m.id = fee_dues.mannequin_id and m.user_id = auth.uid()));
drop policy if exists mannequin_lit_ses_notifs on notifications_mannequins;
create policy mannequin_lit_ses_notifs on notifications_mannequins for select
  using (exists (select 1 from agence_mannequins m where m.id = notifications_mannequins.mannequin_id and m.user_id = auth.uid()));

-- Espace 3
do $$
declare
  t text;
begin
  foreach t in array array['activities', 'clients', 'suppliers', 'invoices', 'invoice_lines', 'treasury_accounts',
    'expenses', 'ledger_entries', 'tax_obligations', 'accountant_requests', 'fiscal_periods', 'fne_documents']
  loop
    execute format('drop policy if exists espace3_lecture on %I', t);
    execute format('create policy espace3_lecture on %I for select using (portail_peut(''compta''))', t);
    execute format('drop policy if exists espace3_ecriture on %I', t);
    execute format('create policy espace3_ecriture on %I for insert with check (portail_peut(''compta''))', t);
    execute format('drop policy if exists espace3_modif on %I', t);
    execute format('create policy espace3_modif on %I for update using (portail_peut(''compta'')) with check (portail_peut(''compta''))', t);
  end loop;
end $$;
drop policy if exists entite_lecture on company_settings;
create policy entite_lecture on company_settings for select using (portail_peut('compta'));
drop policy if exists entite_ecriture on company_settings;
create policy entite_ecriture on company_settings for update using (portail_peut('compta')) with check (portail_peut('compta'));
-- la ligne des documents brouillon peut être supprimée ; rien d'autre ne se supprime
drop policy if exists lignes_suppr on invoice_lines;
create policy lignes_suppr on invoice_lines for delete using (portail_peut('compta'));

-- Codes d'inscription : générés par les espaces 1 et 2, contrôlés par le serveur
drop policy if exists codes_lecture on registration_codes;
create policy codes_lecture on registration_codes for select using (portail_peut('site') or portail_peut('paiements'));
drop policy if exists corrections_lecture on demandes_correction;
create policy corrections_lecture on demandes_correction for select using (portail_peut('site') or portail_peut('paiements'));
drop policy if exists corrections_modif on demandes_correction;
create policy corrections_modif on demandes_correction for update using (portail_peut('site') or portail_peut('paiements'));

-- Déclencheurs : audit, période verrouillée, documents figés
do $$
declare
  t text;
begin
  foreach t in array array['staff_profiles', 'staff_module_grants', 'staff_devices', 'portail_reglages',
    'agence_mannequins', 'mannequin_guardians', 'wave_links', 'fee_dues', 'payment_declarations', 'payments',
    'receipts', 'month_snapshots', 'message_templates', 'clients', 'suppliers', 'company_settings', 'invoices',
    'expenses', 'ledger_entries', 'tax_obligations', 'accountant_requests', 'fiscal_periods',
    'registration_codes', 'demandes_correction']
  loop
    execute format('drop trigger if exists audit_%s on %I', t, t);
    execute format('create trigger audit_%s after insert or update or delete on %I for each row execute function audit_ecriture()', t, t);
  end loop;
end $$;
drop trigger if exists ecritures_periode on ledger_entries;
create trigger ecritures_periode before insert or update or delete on ledger_entries for each row execute function compta_periode_ouverte();
drop trigger if exists depenses_periode on expenses;
create trigger depenses_periode before insert or update or delete on expenses for each row execute function compta_periode_ouverte();
drop trigger if exists factures_periode on invoices;
create trigger factures_periode before update on invoices for each row execute function compta_periode_ouverte();
drop trigger if exists factures_figees on invoices;
create trigger factures_figees before update on invoices for each row execute function compta_document_fige();
drop trigger if exists lignes_figees on invoice_lines;
create trigger lignes_figees before insert or update or delete on invoice_lines for each row execute function compta_lignes_figees();

-- Rôles, accès, délégations, appareils : changement par l'administrateur principal avec un
-- code récent ; le compte principal ne se désactive pas et ne change pas de rôle.
create or replace function staff_garde_fous()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if est_ecriture_serveur() then return coalesce(NEW, OLD); end if;
  perform portail_exiger_auth_recente();
  if TG_TABLE_NAME = 'staff_profiles' then
    if TG_OP = 'DELETE' and OLD.role = 'principal' then raise exception 'Le compte principal n''est pas supprimable.'; end if;
    if TG_OP = 'UPDATE' and OLD.role = 'principal' and (NEW.role <> 'principal' or not NEW.actif) then
      raise exception 'Le compte principal ne se désactive pas et ne change pas de rôle.';
    end if;
    if TG_OP = 'UPDATE' and NEW.role = 'principal' and OLD.role <> 'principal' then raise exception 'Un seul administrateur principal.'; end if;
  end if;
  return coalesce(NEW, OLD);
end;
$$;
drop trigger if exists staff_garde_fous on staff_profiles;
create trigger staff_garde_fous before insert or update or delete on staff_profiles for each row execute function staff_garde_fous();
drop trigger if exists grants_garde_fous on staff_module_grants;
create trigger grants_garde_fous before insert or update or delete on staff_module_grants for each row execute function staff_garde_fous();
drop trigger if exists appareils_garde_fous on staff_devices;
create trigger appareils_garde_fous before update on staff_devices for each row
  when (OLD.revoque is distinct from NEW.revoque) execute function staff_garde_fous();

-- Mensualité : seul l'administrateur principal la change (historique gardé) ; sortie :
-- proposée par l'encaissement, décidée par l'administrateur principal (code récent).
create or replace function registre_garde_fous()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if est_ecriture_serveur() then
    return NEW;
  end if;
  if NEW.montant_mensuel is distinct from OLD.montant_mensuel then
    if not portail_est_principal() then
      raise exception 'Seul l''administrateur principal modifie une mensualité.';
    end if;
    perform portail_exiger_auth_recente();
    insert into historique_mensualites (mannequin_id, ancien, nouveau, modifie_par)
    values (NEW.id, OLD.montant_mensuel, NEW.montant_mensuel, auth.uid());
  end if;
  if NEW.statut = 'sorti' and OLD.statut <> 'sorti' then
    if not portail_est_principal() then
      raise exception 'La sortie d''un mannequin est décidée par l''administrateur principal.';
    end if;
    perform portail_exiger_auth_recente();
    if coalesce(NEW.motif_sortie, '') = '' then
      raise exception 'Motif de sortie obligatoire.';
    end if;
    -- les échéances futures s'arrêtent
    update fee_dues set statut = 'annulee', motif = 'Sortie de l''agence'
    where mannequin_id = NEW.id and statut in ('a_payer', 'non_paye') and mois > date_trunc('month', current_date);
  end if;
  return NEW;
end;
$$;
drop trigger if exists registre_garde_fous on agence_mannequins;
create trigger registre_garde_fous before update on agence_mannequins for each row execute function registre_garde_fous();

-- Mineur : contact du parent obligatoire avant toute échéance
create or replace function registre_parent_obligatoire()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r portail_reglages;
  m agence_mannequins;
begin
  select * into r from portail_reglages limit 1;
  select * into m from agence_mannequins where id = NEW.mannequin_id;
  if age(current_date, m.date_naissance) < make_interval(years => r.age_majorite)
     and not exists (select 1 from mannequin_guardians where mannequin_id = m.id) then
    raise exception 'Mannequin mineur : le contact du parent est obligatoire.';
  end if;
  return NEW;
end;
$$;
drop trigger if exists echeance_parent_mineur on fee_dues;
create trigger echeance_parent_mineur before insert on fee_dues for each row execute function registre_parent_obligatoire();

-- -----------------------------------------------------------------------------------
-- 7. Fonctions « tout ou rien »
-- -----------------------------------------------------------------------------------
-- Destinataire automatique : le parent pour un mineur, la personne pour un majeur
create or replace function registre_destinataire(p_mannequin uuid)
returns json language sql stable security definer set search_path = public as $$
  select case
    when not (est_ecriture_serveur() or portail_peut('paiements')) then null
    when age(current_date, m.date_naissance) < make_interval(years => r.age_majorite) then (
      select json_build_object('qui', 'Parent', 'nom', g.nom, 'telephone', g.telephone,
                               'whatsapp', coalesce(g.whatsapp, g.telephone), 'email', g.email)
      from mannequin_guardians g where g.mannequin_id = m.id order by g.cree_le limit 1)
    else json_build_object('qui', 'Lui-même', 'nom', m.nom, 'telephone', m.telephone,
                           'whatsapp', coalesce(m.whatsapp, m.telephone), 'email', m.email)
  end
  from agence_mannequins m, portail_reglages r where m.id = p_mannequin;
$$;

-- Lien Wave proposé pour un montant
create or replace function lien_wave_pour(p_type text, p_montant int)
returns text language sql stable security definer set search_path = public as $$
  select url from wave_links where actif and montant = p_montant
  order by (type_droit = p_type) desc, cree_le desc limit 1;
$$;

-- Prépare un message (modèle + variables) sur tous les canaux connus du destinataire
create or replace function portail_preparer_message(p_echeance uuid, p_modele text)
returns int language plpgsql security definer set search_path = public as $$
declare
  e fee_dues;
  m agence_mannequins;
  d json;
  r portail_reglages;
  txt text;
  mois_txt text;
  n int := 0;
begin
  select * into e from fee_dues where id = p_echeance;
  select * into m from agence_mannequins where id = e.mannequin_id;
  select * into r from portail_reglages limit 1;
  d := coalesce(registre_destinataire(m.id), json_build_object('qui', 'Lui-même', 'nom', m.nom));
  mois_txt := (array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])[extract(month from e.mois)::int]
              || ' ' || extract(year from e.mois)::int;
  select texte into txt from message_templates where code = p_modele;
  txt := replace(txt, '{prenom}', coalesce(nullif(split_part(coalesce(m.prenoms, m.nom), ' ', 1), ''), m.nom));
  txt := replace(txt, '{mois}', mois_txt);
  txt := replace(txt, '{montant}', trim(to_char(e.montant_du, 'FM999G999G999')) || ' FCFA');
  txt := replace(txt, '{date_limite}', to_char(e.date_limite, 'DD/MM/YYYY'));
  txt := replace(txt, '{lien_wave}', coalesce(lien_wave_pour(case when e.type = 'inscription' then 'inscription' else 'formation' end, e.montant_du), ''));
  txt := replace(txt, '{lien_espace}', 'https://www.maitreakessemodelmanagement.com/espace-mannequin');
  txt := replace(replace(txt, ' ', ' '), '  ', ' ');
  if m.user_id is not null then
    insert into notifications_mannequins (mannequin_id, texte) values (m.id, txt);
    insert into message_log (mannequin_id, echeance_id, modele, canal, destinataire, texte, statut, envoye_le)
    values (m.id, e.id, p_modele, 'espace', (d ->> 'qui') || ' · ' || (d ->> 'nom'), txt, 'envoye', now());
    n := n + 1;
  end if;
  if coalesce(d ->> 'email', '') <> '' then
    insert into message_log (mannequin_id, echeance_id, modele, canal, destinataire, adresse, texte)
    values (m.id, e.id, p_modele, 'email', (d ->> 'qui') || ' · ' || (d ->> 'nom'), d ->> 'email', txt);
    n := n + 1;
  end if;
  if coalesce(d ->> 'telephone', '') <> '' then
    -- SMS : aucun fournisseur choisi pour l'instant (point 4 du cahier) → « sans fournisseur »
    insert into message_log (mannequin_id, echeance_id, modele, canal, destinataire, adresse, texte, statut)
    values (m.id, e.id, p_modele, 'sms', (d ->> 'qui') || ' · ' || (d ->> 'nom'), d ->> 'telephone', txt, 'sans_fournisseur');
    -- WhatsApp : lien wa.me prérempli, envoyé en un geste par l'agent (file d'envoi)
    insert into message_log (mannequin_id, echeance_id, modele, canal, destinataire, adresse, texte)
    values (m.id, e.id, p_modele, 'whatsapp', (d ->> 'qui') || ' · ' || (d ->> 'nom'), d ->> 'whatsapp', txt);
    n := n + 2;
  end if;
  return n;
end;
$$;
revoke all on function portail_preparer_message(uuid, text) from public, anon, authenticated;

-- Valider un paiement : échéance payée, reçu numéroté, recette(s) sans nom pour le
-- comptable, notification, code d'inscription consommé, registre mis à jour. Tout ou rien.
create or replace function portail_valider_paiement(
  p_echeance uuid, p_montant int, p_mode text, p_declaration uuid default null,
  p_paye_par text default null, p_id_transaction text default null, p_automatique boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare
  e fee_dues;
  r portail_reglages;
  pid uuid;
  num text;
  v_compte text;
  d date := (now() at time zone 'Africa/Abidjan')::date;
begin
  if not p_automatique and not portail_peut('paiements') then
    raise exception 'Accès refusé.';
  end if;
  select * into e from fee_dues where id = p_echeance for update;
  if e.id is null then raise exception 'Échéance introuvable.'; end if;
  if e.statut = 'payee' then raise exception 'Ce paiement est déjà validé.'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Montant reçu obligatoire.'; end if;
  select * into r from portail_reglages limit 1;
  if p_montant > r.seuil_double_validation and not p_automatique and not portail_est_principal() then
    raise exception 'Montant au-dessus du seuil : validation par l''administrateur principal.';
  end if;
  if p_id_transaction is not null and exists (select 1 from payments where id_transaction = p_id_transaction) then
    raise exception 'Cette transaction Wave est déjà rattachée à un autre paiement.';
  end if;
  v_compte := case p_mode when 'wave' then 'wave' when 'especes' then 'caisse' when 'virement' then 'banque' else 'mobile' end;

  insert into payments (echeance_id, declaration_id, montant, mode, paye_par, id_transaction, confirmation, valide_par)
  values (e.id, p_declaration, p_montant, p_mode, p_paye_par, p_id_transaction,
          case when p_automatique then 'automatique' else 'manuelle' end, auth.uid())
  returning id into pid;
  num := portail_numero('REC', 5);
  insert into receipts (numero, paiement_id) values (num, pid);

  update fee_dues set montant_paye = montant_paye + p_montant,
    statut = case when montant_paye + p_montant >= montant_du then 'payee' else statut end
  where id = e.id;
  if p_declaration is not null then
    update payment_declarations set statut = case when p_automatique then 'confirme_auto' else 'valide' end,
      traite_par = auth.uid(), traite_le = now(), id_transaction = coalesce(p_id_transaction, id_transaction)
    where id = p_declaration;
  end if;

  -- recettes pour la comptabilité : le numéro de reçu, jamais le nom
  if e.type = 'inscription' then
    insert into ledger_entries (date_ecriture, sens, montant, activite, compte, source, reference, libelle)
    values (d, 'recette', least(p_montant, r.droit_inscription), 'inscription', v_compte, 'mannequin', num, 'Droit d''inscription');
    if p_montant > r.droit_inscription then
      insert into ledger_entries (date_ecriture, sens, montant, activite, compte, source, reference, libelle)
      values (d, 'recette', p_montant - r.droit_inscription, 'formation', v_compte, 'mannequin', num, 'Formation, 1er mois');
    end if;
  else
    insert into ledger_entries (date_ecriture, sens, montant, activite, compte, source, reference, libelle)
    values (d, 'recette', p_montant, case when e.type = 'mensualite' then 'formation' else 'autre' end, v_compte,
            case when p_mode in ('especes', 'virement', 'autre') then 'hors_ligne' else 'mannequin' end, num, 'Paiement mannequin');
  end if;

  -- inscription : code consommé, mannequin actif, 1re mensualité au 1er du mois suivant
  if e.type = 'inscription' then
    update registration_codes set statut = 'utilise', utilise_le = now()
    where candidature_id = (select candidature_id from agence_mannequins where id = e.mannequin_id) and statut = 'genere';
    update casting_applications set status = 'inscrite'
    where id = (select candidature_id from agence_mannequins where id = e.mannequin_id);
    update agence_mannequins set statut = 'actif' where id = e.mannequin_id;
  end if;

  perform portail_preparer_message(e.id, 'confirme');
  perform journaliser(case when p_automatique then 'Paiement confirmé automatiquement' else 'Paiement validé' end,
                      'fee_dues', e.id::text, null, json_build_object('recu', num, 'montant', p_montant)::jsonb);
  return json_build_object('recu', num, 'paiement', pid);
end;
$$;
revoke all on function portail_valider_paiement(uuid, int, text, uuid, text, text, boolean) from public, anon;

create or replace function portail_refuser_declaration(p_declaration uuid, p_motif text, p_precision boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  dcl payment_declarations;
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé.'; end if;
  if coalesce(trim(p_motif), '') = '' then raise exception 'Motif obligatoire.'; end if;
  select * into dcl from payment_declarations where id = p_declaration for update;
  update payment_declarations set statut = case when p_precision then 'precision' else 'introuvable' end,
    motif = p_motif, traite_par = auth.uid(), traite_le = now() where id = p_declaration;
  if not p_precision then
    update fee_dues set statut = 'refusee', motif = p_motif where id = dcl.echeance_id and statut = 'declare';
    perform portail_preparer_message(dcl.echeance_id, 'refuse');
  end if;
end;
$$;

-- « J'ai payé » depuis l'espace du mannequin (connecté) : déclaration, relances arrêtées
create or replace function mannequin_declarer_paiement(p_echeance uuid, p_numero text)
returns void language plpgsql security definer set search_path = public as $$
declare
  e fee_dues;
begin
  select f.* into e from fee_dues f join agence_mannequins m on m.id = f.mannequin_id
  where f.id = p_echeance and m.user_id = auth.uid();
  if e.id is null then raise exception 'Échéance introuvable.'; end if;
  if e.statut not in ('a_payer', 'refusee', 'non_paye') then raise exception 'Ce paiement est déjà déclaré ou validé.'; end if;
  insert into payment_declarations (echeance_id, numero_payeur, montant, declare_par)
  values (e.id, nullif(trim(p_numero), ''), e.montant_du - e.montant_paye, 'mannequin');
  update fee_dues set statut = 'declare' where id = e.id;
end;
$$;
grant execute on function mannequin_declarer_paiement(uuid, text) to authenticated;

-- Message préparé à la demande de l'agent (relance manuelle d'une échéance)
create or replace function portail_message_echeance(p_echeance uuid, p_modele text)
returns int language plpgsql security definer set search_path = public as $$
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé.'; end if;
  if not exists (select 1 from message_templates where code = p_modele) then raise exception 'Modèle inconnu.'; end if;
  return portail_preparer_message(p_echeance, p_modele);
end;
$$;
grant execute on function portail_message_echeance(uuid, text) to authenticated;

-- Réglages des paiements : administrateur principal, avec un code récent
create or replace function portail_modifier_reglages(p_reglages jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not portail_est_principal() then raise exception 'Réservé à l''administrateur principal.'; end if;
  perform portail_exiger_auth_recente();
  update portail_reglages set
    droit_inscription = coalesce((p_reglages ->> 'droit_inscription')::int, droit_inscription),
    premier_mois = coalesce((p_reglages ->> 'premier_mois')::int, premier_mois),
    mensualite_standard = coalesce((p_reglages ->> 'mensualite_standard')::int, mensualite_standard),
    mensualite_haute = coalesce((p_reglages ->> 'mensualite_haute')::int, mensualite_haute),
    jour_limite = coalesce((p_reglages ->> 'jour_limite')::int, jour_limite),
    jour_relance = coalesce((p_reglages ->> 'jour_relance')::int, jour_relance),
    jour_derniere_relance = coalesce((p_reglages ->> 'jour_derniere_relance')::int, jour_derniere_relance),
    age_majorite = coalesce((p_reglages ->> 'age_majorite')::int, age_majorite),
    mois_impayes_alerte = coalesce((p_reglages ->> 'mois_impayes_alerte')::int, mois_impayes_alerte),
    seuil_double_validation = coalesce((p_reglages ->> 'seuil_double_validation')::int, seuil_double_validation),
    validite_code_jours = coalesce((p_reglages ->> 'validite_code_jours')::int, validite_code_jours),
    essais_code = coalesce((p_reglages ->> 'essais_code')::int, essais_code),
    heures_alerte_rapprochement = coalesce((p_reglages ->> 'heures_alerte_rapprochement')::int, heures_alerte_rapprochement),
    modifie_le = now();
end;
$$;
grant execute on function portail_modifier_reglages(jsonb) to authenticated;

-- Liens de paiement : toute modification exige un code récent (action sensible)
create or replace function wave_liens_sensible()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not est_ecriture_serveur() then
    perform portail_exiger_auth_recente();
  end if;
  return coalesce(NEW, OLD);
end;
$$;
drop trigger if exists wave_liens_sensible on wave_links;
create trigger wave_liens_sensible before insert or update or delete on wave_links for each row execute function wave_liens_sensible();

-- Création des échéances du mois (le 1er à 06:00, Abidjan) : rejouable sans doublon
create or replace function portail_creer_echeances(p_mois date)
returns int language plpgsql security definer set search_path = public as $$
declare
  r portail_reglages;
  m record;
  e_id uuid;
  n int := 0;
  v_mois date := date_trunc('month', p_mois)::date;
begin
  if not est_ecriture_serveur() and not portail_peut('paiements') then raise exception 'Accès refusé.'; end if;
  select * into r from portail_reglages limit 1;
  for m in select * from agence_mannequins a
           where a.statut = 'actif' and a.exoneration_motif is null and a.date_entree < v_mois
             -- le 1er mois est payé à l'inscription : rien à créer pour le mois d'entrée
             and not exists (select 1 from fee_dues f where f.mannequin_id = a.id and f.type = 'inscription' and f.mois = v_mois)
  loop
    e_id := null;
    insert into fee_dues (mannequin_id, type, mois, montant_du, date_limite)
    values (m.id, 'mensualite', v_mois, m.montant_mensuel, v_mois + (r.jour_limite - 1))
    on conflict do nothing
    returning id into e_id;
    if e_id is not null then
      perform portail_preparer_message(e_id, 'appel');
      n := n + 1;
    end if;
  end loop;
  perform journaliser('Échéances du mois créées', 'fee_dues', to_char(v_mois, 'YYYY-MM'), null, json_build_object('nombre', n)::jsonb);
  return n;
end;
$$;

-- Tâche quotidienne (appelée chaque matin par le serveur) : 1er = échéances, relances le 3
-- et le 5 aux personnes sans paiement déclaré, le 6 = Non payé, dernier jour = récapitulatif
create or replace function portail_tache_quotidienne(p_jour date default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  j date := coalesce(p_jour, (now() at time zone 'Africa/Abidjan')::date);
  r portail_reglages;
  v_mois date := date_trunc('month', j)::date;
  e record;
  creees int := 0;
  relances int := 0;
  impayes int := 0;
begin
  if not est_ecriture_serveur() and not portail_est_principal() then raise exception 'Accès refusé.'; end if;
  select * into r from portail_reglages limit 1;
  if extract(day from j) = 1 then
    creees := portail_creer_echeances(v_mois);
  end if;
  if extract(day from j) in (r.jour_relance, r.jour_derniere_relance) then
    for e in select * from fee_dues where mois = date_trunc('month', j)::date and statut in ('a_payer', 'refusee')
             and not exists (select 1 from message_log l where l.echeance_id = fee_dues.id
                              and l.planifie_le::date = j and l.modele in ('relance', 'derniere_relance'))
    loop
      perform portail_preparer_message(e.id, case when extract(day from j) = r.jour_derniere_relance then 'derniere_relance' else 'relance' end);
      relances := relances + 1;
    end loop;
  end if;
  if extract(day from j) = r.jour_limite + 1 then
    for e in select * from fee_dues where mois = date_trunc('month', j)::date and statut in ('a_payer', 'refusee') loop
      update fee_dues set statut = 'non_paye' where id = e.id;
      perform portail_preparer_message(e.id, 'non_recu');
      impayes := impayes + 1;
    end loop;
  end if;
  if j = (date_trunc('month', j) + interval '1 month - 1 day')::date then
    perform portail_figer_recap(v_mois);
  end if;
  return json_build_object('jour', j, 'echeances', creees, 'relances', relances, 'non_payes', impayes);
end;
$$;
revoke all on function portail_tache_quotidienne(date) from public, anon, authenticated;

-- Récapitulatif de fin de mois figé et archivé
create or replace function portail_figer_recap(p_mois date)
returns json language plpgsql security definer set search_path = public as $$
declare
  c jsonb;
begin
  if not est_ecriture_serveur() and not portail_peut('paiements') then raise exception 'Accès refusé.'; end if;
  select jsonb_build_object(
    'payes', coalesce(jsonb_agg(jsonb_build_object('nom', m.nom, 'montant', f.montant_du, 'statut', f.statut)) filter (where f.statut in ('payee', 'exoneree')), '[]'),
    'non_payes', coalesce(jsonb_agg(jsonb_build_object('nom', m.nom, 'montant', f.montant_du - f.montant_paye, 'statut', f.statut)) filter (where f.statut not in ('payee', 'exoneree', 'annulee')), '[]'),
    'attendu', coalesce(sum(f.montant_du) filter (where f.statut <> 'annulee'), 0),
    'encaisse', coalesce(sum(f.montant_paye), 0))
  into c
  from fee_dues f join agence_mannequins m on m.id = f.mannequin_id
  where f.mois = date_trunc('month', p_mois)::date;
  insert into month_snapshots (mois, contenu, fige_par) values (date_trunc('month', p_mois)::date, c, auth.uid())
  on conflict (mois) do update set contenu = excluded.contenu, fige_le = now(), fige_par = excluded.fige_par;
  return c;
end;
$$;

-- Émettre un document (devis, proforma, facture, avoir) : numéro continu, sans trou
create or replace function compta_emettre(p_invoice uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  i invoices;
  s company_settings;
  pref text;
  ht int;
  tv int;
begin
  if not portail_peut('compta') then raise exception 'Accès refusé.'; end if;
  select * into i from invoices where id = p_invoice for update;
  if i.statut <> 'brouillon' then raise exception 'Document déjà émis.'; end if;
  if i.type = 'avoir' then perform portail_exiger_auth_recente(); end if;
  select * into s from company_settings limit 1;
  pref := case i.type when 'devis' then 'DEV' when 'proforma' then 'PRO' when 'facture' then 'FAC' else 'AVO' end;
  select coalesce(sum(round(quantite * prix_unitaire) - remise), 0)::int,
         coalesce(sum(case when tva and s.mode_legal and coalesce(s.assujetti_tva, false)
                           then round((round(quantite * prix_unitaire) - remise) * s.taux_tva / 100) else 0 end), 0)::int
  into ht, tv from invoice_lines where invoice_id = i.id;
  update invoices set numero = portail_numero(pref, 4), statut = 'emis',
    date_emission = coalesce(date_emission, (now() at time zone 'Africa/Abidjan')::date),
    total_ht = ht, total_tva = tv, total_ttc = ht + tv,
    mention = case when s.mode_legal then null else 'Document non fiscal, non valable pour la déduction de TVA' end
  where id = i.id;
  if i.type = 'avoir' and i.origine_id is not null then
    update invoices set statut = 'annule' where id = i.origine_id;
  end if;
  return (select numero from invoices where id = i.id);
end;
$$;

-- Règlement d'une facture : recette dans la bonne activité, trésorerie à jour
create or replace function compta_encaisser(p_invoice uuid, p_montant int, p_compte text)
returns void language plpgsql security definer set search_path = public as $$
declare
  i invoices;
begin
  if not portail_peut('compta') then raise exception 'Accès refusé.'; end if;
  select * into i from invoices where id = p_invoice for update;
  if i.type <> 'facture' or i.statut not in ('emis', 'envoye', 'partiel') then raise exception 'Facture non encaissable.'; end if;
  if p_montant <= 0 or p_montant > i.total_ttc - i.paye then raise exception 'Montant incorrect.'; end if;
  insert into ledger_entries (date_ecriture, sens, montant, activite, compte, source, reference, libelle)
  values ((now() at time zone 'Africa/Abidjan')::date, 'recette', p_montant, i.activite, p_compte, 'facture', i.numero, 'Règlement de facture');
  update invoices set paye = paye + p_montant,
    statut = case when paye + p_montant >= total_ttc then 'paye' else 'partiel' end where id = i.id;
end;
$$;

-- Dépense : numéro DEP, justificatif obligatoire, écriture de trésorerie
create or replace function compta_depense(p_date date, p_montant int, p_categorie text, p_libelle text,
                                          p_compte text, p_justificatif text, p_fournisseur uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  num text;
begin
  if not portail_peut('compta') then raise exception 'Accès refusé.'; end if;
  if coalesce(p_justificatif, '') = '' then raise exception 'Le justificatif est obligatoire.'; end if;
  num := portail_numero('DEP', 4);
  insert into expenses (numero, date_depense, montant, categorie, fournisseur_id, libelle, compte, justificatif, cree_par)
  values (num, p_date, p_montant, p_categorie, p_fournisseur, p_libelle, p_compte, p_justificatif, auth.uid());
  insert into ledger_entries (date_ecriture, sens, montant, activite, compte, source, reference, libelle)
  values (p_date, 'depense', p_montant, p_categorie, p_compte, 'depense', num, p_libelle);
  return num;
end;
$$;

create or replace function compta_verrouiller(p_mois date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not portail_peut('compta') then raise exception 'Accès refusé.'; end if;
  insert into fiscal_periods (mois, statut, verrouille_par, verrouille_le)
  values (date_trunc('month', p_mois)::date, 'verrouillee', auth.uid(), now())
  on conflict (mois) do update set statut = 'verrouillee', verrouille_par = auth.uid(), verrouille_le = now();
end;
$$;

-- Interrupteur légal : seulement si les champs légaux sont remplis, par l'administrateur principal
create or replace function compta_mode_legal(p_actif boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  s company_settings;
begin
  if not portail_est_principal() then raise exception 'Réservé à l''administrateur principal.'; end if;
  perform portail_exiger_auth_recente();
  select * into s from company_settings limit 1;
  if p_actif and (coalesce(s.raison_sociale, '') = '' or coalesce(s.rccm, '') = '' or coalesce(s.ncc, '') = ''
                  or coalesce(s.regime, '') = '' or s.assujetti_tva is null) then
    raise exception 'Champs légaux incomplets : raison sociale, RCCM, NCC, régime et TVA.';
  end if;
  update company_settings set mode_legal = p_actif, active_le = case when p_actif then now() end;
end;
$$;

-- Code individuel : généré à « Retenue » (ou casting direct). Le code en clair n'est
-- renvoyé qu'une fois, à l'agent ; seul son empreinte est gardée. Forme MA2M-XXXX-XX.
create or replace function generer_code_inscription(p_candidature uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sans 0, O, 1, I
  brut text := '';
  code text;
  r portail_reglages;
  c casting_applications;
begin
  if not (portail_peut('site') or portail_peut('paiements')) then raise exception 'Accès refusé.'; end if;
  select * into c from casting_applications where id = p_candidature;
  if c.id is null then raise exception 'Candidature introuvable.'; end if;
  select * into r from portail_reglages limit 1;
  if c.date_naissance is null then raise exception 'Date de naissance manquante sur la candidature.'; end if;
  if age(current_date, c.date_naissance) < make_interval(years => r.age_majorite)
     and (coalesce(c.parent_nom, '') = '' or coalesce(c.parent_telephone, '') = '') then
    raise exception 'Mannequin mineur : nom et téléphone du parent obligatoires.';
  end if;
  for k in 1..6 loop
    brut := brut || substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % length(alphabet)), 1);
  end loop;
  code := 'MA2M-' || substr(brut, 1, 4) || '-' || substr(brut, 5, 2);
  update registration_codes set statut = 'annule' where candidature_id = c.id and statut in ('genere', 'bloque', 'expire');
  insert into registration_codes (candidature_id, code_hache, indice, expire_le, cree_par)
  values (c.id, encode(digest(code, 'sha256'), 'hex'), substr(brut, 5, 2), now() + make_interval(days => r.validite_code_jours), auth.uid());
  update casting_applications set status = 'retenue' where id = c.id and status <> 'inscrite';
  return code;
end;
$$;

-- Casting direct : fiche minimale créée par l'agent, retenue d'office, code généré
create or replace function casting_direct(p_nom text, p_naissance date, p_telephone text, p_lieu text,
                                          p_parent_nom text, p_parent_tel text, p_genre text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  doublon uuid;
begin
  if not (portail_peut('site') or portail_peut('paiements')) then raise exception 'Accès refusé.'; end if;
  if coalesce(trim(p_nom), '') = '' or p_naissance is null or coalesce(trim(p_telephone), '') = '' then
    raise exception 'Nom, date de naissance et téléphone obligatoires.';
  end if;
  select id into doublon from casting_applications
  where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = regexp_replace(p_telephone, '\D', '', 'g')
     or (lower(full_name) = lower(trim(p_nom)) and date_naissance = p_naissance)
  limit 1;
  insert into casting_applications (full_name, email, phone, date_naissance, parent_nom, parent_telephone,
                                    genre, status, source, lieu_casting, type_candidature)
  values (trim(p_nom), '', trim(p_telephone), p_naissance, nullif(trim(p_parent_nom), ''), nullif(trim(p_parent_tel), ''),
          p_genre, 'retenue', 'direct', nullif(trim(p_lieu), ''), 'agence')
  returning id into cid;
  return json_build_object('candidature', cid, 'code', generer_code_inscription(cid), 'doublon_possible', doublon);
end;
$$;

-- Statut d'une candidature (espaces 1 et 2) ; « inscrite » est posé par la validation du paiement seulement
create or replace function portail_statut_candidature(p_id uuid, p_statut text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (portail_peut('site') or portail_peut('paiements')) then raise exception 'Accès refusé.'; end if;
  if p_statut not in ('nouvelle', 'vue', 'en étude', 'en attente', 'retenue', 'refusée') then raise exception 'Statut inconnu.'; end if;
  update casting_applications set status = p_statut where id = p_id and status <> 'inscrite';
  if p_statut = 'refusée' then
    update registration_codes set statut = 'annule' where candidature_id = p_id and statut in ('genere', 'bloque');
  end if;
end;
$$;
grant execute on function portail_statut_candidature(uuid, text) to authenticated;

-- Contrôle du code (appelé par le serveur du site, qui limite aussi les essais par adresse)
-- Message neutre : il ne dit jamais si c'est le code ou la date qui est faux.
create or replace function verifier_code_inscription(p_code text, p_naissance date)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  rc registration_codes;
  c casting_applications;
  r portail_reglages;
begin
  if not est_ecriture_serveur() then raise exception 'Accès refusé.'; end if;
  select * into r from portail_reglages limit 1;
  select * into rc from registration_codes where code_hache = encode(digest(upper(trim(p_code)), 'sha256'), 'hex') for update;
  if rc.id is null then return json_build_object('ok', false, 'raison', 'inconnu'); end if;
  if rc.statut = 'utilise' then return json_build_object('ok', false, 'raison', 'deja_utilise'); end if;
  if rc.statut = 'bloque' then return json_build_object('ok', false, 'raison', 'bloque'); end if;
  if rc.statut <> 'genere' or rc.expire_le < now() then
    update registration_codes set statut = 'expire' where id = rc.id and statut = 'genere';
    return json_build_object('ok', false, 'raison', 'expire');
  end if;
  select * into c from casting_applications where id = rc.candidature_id;
  if c.date_naissance is distinct from p_naissance then
    update registration_codes set essais = essais + 1,
      statut = case when essais + 1 >= r.essais_code then 'bloque' else statut end where id = rc.id;
    perform journaliser('Code d''inscription : essai raté', 'registration_codes', rc.id::text, null, null);
    return json_build_object('ok', false, 'raison', case when rc.essais + 1 >= r.essais_code then 'bloque' else 'inconnu' end,
                             'essais', rc.essais + 1);
  end if;
  return json_build_object('ok', true,
    'montant', r.droit_inscription + r.premier_mois, 'droit_inscription', r.droit_inscription, 'premier_mois', r.premier_mois,
    'lien_wave', lien_wave_pour('inscription', r.droit_inscription + r.premier_mois),
    'candidat', json_build_object(
      'nom', c.full_name, 'naissance', c.date_naissance, 'telephone', c.phone, 'email', nullif(c.email, ''),
      'origine', case when c.source = 'direct' then 'Casting direct' else 'Casting en ligne' end,
      'parent', case when c.parent_nom is not null then json_build_object('nom', c.parent_nom, 'telephone', c.parent_telephone) end));
end;
$$;
revoke all on function verifier_code_inscription(text, date) from public, anon, authenticated;

-- Correction par le mannequin (téléphone / e-mail) ; nom et date partent à l'agence
create or replace function corriger_inscription(p_code text, p_naissance date, p_telephone text, p_email text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v json := verifier_code_inscription(p_code, p_naissance);
begin
  if not (v ->> 'ok')::boolean then return v; end if;
  update casting_applications set phone = trim(p_telephone), email = coalesce(nullif(trim(p_email), ''), email)
  where id = (select candidature_id from registration_codes where code_hache = encode(digest(upper(trim(p_code)), 'sha256'), 'hex'));
  return json_build_object('ok', true);
end;
$$;
revoke all on function corriger_inscription(text, date, text, text) from public, anon, authenticated;

-- « J'ai payé » à l'inscription : le mannequin entre au registre (en pré-inscription),
-- l'échéance d'inscription (25 000) est créée et la déclaration part au rapprochement.
create or replace function declarer_paiement_inscription(p_code text, p_naissance date, p_numero text, p_operateur text,
                                                         p_reglement_accepte boolean, p_accord_parent boolean)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v json := verifier_code_inscription(p_code, p_naissance);
  rc registration_codes;
  c casting_applications;
  r portail_reglages;
  mid uuid;
  eid uuid;
  mineur boolean;
begin
  if not (v ->> 'ok')::boolean then return v; end if;
  if not p_reglement_accepte then raise exception 'Le règlement doit être accepté.'; end if;
  select * into rc from registration_codes where code_hache = encode(digest(upper(trim(p_code)), 'sha256'), 'hex');
  select * into c from casting_applications where id = rc.candidature_id;
  select * into r from portail_reglages limit 1;
  mineur := age(current_date, c.date_naissance) < make_interval(years => r.age_majorite);
  if mineur and not p_accord_parent then raise exception 'Mannequin mineur : l''accord du parent est obligatoire.'; end if;
  select id into mid from agence_mannequins where candidature_id = c.id;
  if mid is null then
    insert into agence_mannequins (nom, genre, date_naissance, telephone, whatsapp, email, statut, candidature_id,
                                   montant_mensuel, notes)
    values (c.full_name, c.genre, c.date_naissance, c.phone, c.phone, nullif(c.email, ''), 'actif', c.id,
            r.mensualite_standard, 'Règlement accepté le ' || to_char(now() at time zone 'Africa/Abidjan', 'DD/MM/YYYY HH24:MI')
            || case when mineur then ' ; accord du parent donné' else '' end)
    returning id into mid;
    if mineur then
      insert into mannequin_guardians (mannequin_id, nom, lien, telephone, email)
      values (mid, c.parent_nom, 'Parent', c.parent_telephone, c.parent_email);
    end if;
  end if;
  select id into eid from fee_dues where mannequin_id = mid and type = 'inscription';
  if eid is null then
    insert into fee_dues (mannequin_id, type, mois, montant_du, date_limite)
    values (mid, 'inscription', date_trunc('month', current_date)::date, r.droit_inscription + r.premier_mois, current_date + 7)
    returning id into eid;
  end if;
  if exists (select 1 from fee_dues where id = eid and statut in ('declare', 'payee')) then
    return json_build_object('ok', true, 'deja', true);
  end if;
  insert into payment_declarations (echeance_id, candidature_id, numero_payeur, operateur, montant, declare_par)
  values (eid, c.id, trim(p_numero), coalesce(p_operateur, 'wave'), r.droit_inscription + r.premier_mois, 'inscription');
  update fee_dues set statut = 'declare' where id = eid;
  return json_build_object('ok', true);
end;
$$;
revoke all on function declarer_paiement_inscription(text, date, text, text, boolean, boolean) from public, anon, authenticated;

-- Lien personnel sans compte (mannequin non inscrit) : jeton tiré au hasard, haché en base
create or replace function portail_creer_lien_paiement(p_echeance uuid, p_jours int default 10)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  jeton text := encode(gen_random_bytes(24), 'base64');
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé.'; end if;
  jeton := translate(jeton, '+/=', '-_');
  update pay_tokens set revoque = true where echeance_id = p_echeance and not revoque;
  insert into pay_tokens (echeance_id, jeton_hache, expire_le)
  values (p_echeance, encode(digest(jeton, 'sha256'), 'hex'), now() + make_interval(days => greatest(1, least(p_jours, 31))));
  return jeton;
end;
$$;

create or replace function lien_paiement_lire(p_jeton text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  t pay_tokens;
  e fee_dues;
  m agence_mannequins;
begin
  if not est_ecriture_serveur() then raise exception 'Accès refusé.'; end if;
  select * into t from pay_tokens where jeton_hache = encode(digest(p_jeton, 'sha256'), 'hex');
  if t.id is null or t.revoque or t.expire_le < now() then return json_build_object('ok', false); end if;
  select * into e from fee_dues where id = t.echeance_id;
  select * into m from agence_mannequins where id = e.mannequin_id;
  return json_build_object('ok', true, 'prenom', split_part(coalesce(m.prenoms, m.nom), ' ', 1),
    'mois', e.mois, 'type', e.type, 'montant', e.montant_du - e.montant_paye, 'statut', e.statut,
    'lien_wave', lien_wave_pour(case when e.type = 'inscription' then 'inscription' else 'formation' end, e.montant_du),
    'numero', coalesce(m.telephone, ''));
end;
$$;
revoke all on function lien_paiement_lire(text) from public, anon, authenticated;

create or replace function lien_paiement_declarer(p_jeton text, p_numero text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  t pay_tokens;
  e fee_dues;
begin
  if not est_ecriture_serveur() then raise exception 'Accès refusé.'; end if;
  select * into t from pay_tokens where jeton_hache = encode(digest(p_jeton, 'sha256'), 'hex');
  if t.id is null or t.revoque or t.expire_le < now() then return json_build_object('ok', false); end if;
  select * into e from fee_dues where id = t.echeance_id for update;
  if e.statut in ('declare', 'payee') then return json_build_object('ok', true, 'deja', true); end if;
  insert into payment_declarations (echeance_id, numero_payeur, montant, declare_par)
  values (e.id, nullif(trim(p_numero), ''), e.montant_du - e.montant_paye, 'lien personnel');
  update fee_dues set statut = 'declare' where id = e.id;
  return json_build_object('ok', true);
end;
$$;
revoke all on function lien_paiement_declarer(text, text) from public, anon, authenticated;

-- Rattachement automatique : quand un mannequin active son espace, sa fiche du registre
-- (même téléphone ou même e-mail) est reliée à son compte, sans doublon.
create or replace function registre_rattacher_compte()
returns json language plpgsql security definer set search_path = public as $$
declare
  u auth.users;
  p model_profiles;
  mid uuid;
begin
  if auth.uid() is null then return json_build_object('ok', false); end if;
  if exists (select 1 from agence_mannequins where user_id = auth.uid()) then return json_build_object('ok', true); end if;
  select * into u from auth.users where id = auth.uid();
  select * into p from model_profiles where id = auth.uid();
  select id into mid from agence_mannequins
  where user_id is null and (
    (coalesce(u.email, '') <> '' and lower(email) = lower(u.email))
    or (coalesce(p.phone, '') <> '' and regexp_replace(coalesce(telephone, ''), '\D', '', 'g') = regexp_replace(p.phone, '\D', '', 'g')))
  order by cree_le limit 1;
  if mid is null then return json_build_object('ok', false); end if;
  update agence_mannequins set user_id = auth.uid(), model_id = coalesce(model_id, p.id) where id = mid;
  return json_build_object('ok', true);
end;
$$;
grant execute on function registre_rattacher_compte() to authenticated;

-- -----------------------------------------------------------------------------------
-- 8. Vues : espace 1 sans argent ni contact privé ; agrégats pour le comptable
-- -----------------------------------------------------------------------------------
create or replace view v_site_dossiers with (security_invoker = false) as
  select m.id, m.nom, m.categorie, m.date_entree,
         case when m.statut = 'sorti' then 'refusé'
              when exists (select 1 from fee_dues f where f.mannequin_id = m.id and f.type = 'inscription' and f.statut = 'payee') then 'validé'
              else 'en cours' end as statut
  from agence_mannequins m
  where portail_peut('site');

create or replace view v_compta_encaissements_agreges with (security_invoker = false) as
  select date_trunc('month', p.valide_le)::date as mois,
         f.type as nature,
         count(distinct f.mannequin_id) as nombre_payants,
         sum(p.montant)::bigint as total
  from payments p join fee_dues f on f.id = p.echeance_id
  where portail_peut('compta')
  group by 1, 2;

-- Candidatures pour l'espace 1 : jamais de contact privé (sauf droit accordé)
create or replace view v_site_candidatures with (security_invoker = false) as
  select c.id, c.full_name, c.genre, c.city, c.height_cm, c.date_naissance, c.status, c.source, c.lieu_casting,
         c.type_candidature, c.created_at,
         case when portail_est_principal() or portail_peut('contacts_prives') then c.phone end as phone,
         case when portail_est_principal() or portail_peut('contacts_prives') then c.email end as email,
         (select rc.statut from registration_codes rc where rc.candidature_id = c.id order by rc.cree_le desc limit 1) as code_statut,
         (select rc.indice from registration_codes rc where rc.candidature_id = c.id order by rc.cree_le desc limit 1) as code_indice
  from casting_applications c
  where portail_peut('site') or portail_peut('paiements');

-- Mannequins publiés ou non, pour l'espace 1 : sans téléphone ni e-mail (sauf droit accordé)
create or replace view v_site_mannequins with (security_invoker = false) as
  select p.id, p.full_name, p.category, p.city, p.height_cm, p.published, p.desactive, p.en_attente_validation,
         p.date_naissance, p.slug, p.created_at,
         case when portail_est_principal() or portail_peut('contacts_prives') then p.phone end as phone,
         case when portail_est_principal() or portail_peut('contacts_prives') then p.contact_email end as contact_email,
         (select count(*) from model_photos ph where ph.model_id = p.id) as photos
  from model_profiles p
  where portail_peut('site');

revoke all on v_site_dossiers, v_compta_encaissements_agreges, v_site_candidatures, v_site_mannequins from anon;
grant select on v_site_dossiers, v_compta_encaissements_agreges, v_site_candidatures, v_site_mannequins to authenticated;

-- Les comptes « administrateur du site » et « comptable » ne lisent jamais directement les
-- anciennes tables qui contiennent paiements ou contacts privés (même s'ils figurent dans
-- « admins » pour gérer le contenu du site) : règles RESTRICTIVES, qui s'ajoutent aux autres.
create or replace function portail_sans_donnees_privees()
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from staff_profiles where user_id = auth.uid() and role in ('site', 'compta'))
      or portail_peut('contacts_prives');
$$;
drop policy if exists portail_restreint on inscriptions_mannequins;
create policy portail_restreint on inscriptions_mannequins as restrictive for all using (portail_sans_donnees_privees());
drop policy if exists portail_restreint on contacts_parents;
create policy portail_restreint on contacts_parents as restrictive for all using (portail_sans_donnees_privees());
drop policy if exists portail_restreint on casting_applications;
create policy portail_restreint on casting_applications as restrictive for select using (portail_sans_donnees_privees() or auth.uid() is null);

-- Stockage privé : preuves de paiement et pièces comptables (liens signés de courte durée)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('preuves-paiement', 'preuves-paiement', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
       ('pieces-comptables', 'pieces-comptables', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
drop policy if exists "Preuves : espace 2" on storage.objects;
create policy "Preuves : espace 2" on storage.objects for select using (bucket_id = 'preuves-paiement' and portail_peut('paiements'));
drop policy if exists "Preuves : dépôt" on storage.objects;
create policy "Preuves : dépôt" on storage.objects for insert with check (bucket_id = 'preuves-paiement' and auth.uid() is not null);
drop policy if exists "Pièces : espace 3" on storage.objects;
create policy "Pièces : espace 3" on storage.objects for select using (bucket_id = 'pieces-comptables' and portail_peut('compta'));
drop policy if exists "Pièces : dépôt" on storage.objects;
create policy "Pièces : dépôt" on storage.objects for insert with check (bucket_id = 'pieces-comptables' and portail_peut('compta'));

-- Fonctions appelables par l'application (le reste est réservé au serveur)
grant execute on function portail_moi(), portail_valider_paiement(uuid, int, text, uuid, text, text, boolean),
  portail_refuser_declaration(uuid, text, boolean), portail_creer_echeances(date), portail_figer_recap(date),
  compta_emettre(uuid), compta_encaisser(uuid, int, text), compta_depense(date, int, text, text, text, text, uuid),
  compta_verrouiller(date), compta_mode_legal(boolean), generer_code_inscription(uuid),
  casting_direct(text, date, text, text, text, text, text), portail_creer_lien_paiement(uuid, int),
  registre_destinataire(uuid) to authenticated;

-- Tâche quotidienne à 06:00 (Abidjan = heure UTC) : échéances, relances, Non payé, récapitulatif
create extension if not exists pg_cron;
select cron.schedule('portail-quotidien', '0 6 * * *', $cron$select portail_tache_quotidienne()$cron$);

NOTIFY pgrst, 'reload schema';
