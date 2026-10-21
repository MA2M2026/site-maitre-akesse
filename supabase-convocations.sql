-- ===========================================================================
-- Extension 141 — Convocations des projets de l'agenda (21/10/2026, demande de la
-- propriétaire). Rejouable : on peut l'exécuter plusieurs fois sans rien casser.
--
-- Un projet de l'agenda (défilé, shooting…) reçoit en plus : l'heure de convocation,
-- le déroulé de la journée (heure + activité), « À prévoir », un message personnalisé
-- (facultatif) et le rappel de la veille. Depuis le tableau de bord, « Convoquer » choisit
-- les participants (mannequins du projet et personnes non inscrites, gardées dans un
-- carnet d'adresses) et programme l'envoi : e-mail automatique, WhatsApp préparé (envoi à
-- la main tant que l'envoi automatique n'est pas activé), SMS prévu pour plus tard.
--
-- Envois programmés : toutes les 5 minutes, la base regarde s'il y a des envois arrivés à
-- l'heure ; seulement dans ce cas, elle appelle le serveur du site (api/portail.js,
-- ?tache=convocations) avec une clé tirée au hasard ici (jamais écrite dans ce fichier,
-- jamais lisible par le site). Le serveur envoie les e-mails (EmailJS, clé
-- EMAILJS_PRIVATE_KEY de Vercel) et prévient l'agence quand des WhatsApp sont à envoyer.
--
-- Rien de tout cela n'est visible du public : la page Agenda (agenda_public) ne lit
-- toujours que ses colonnes habituelles.
-- ===========================================================================

-- 1) Le projet : convocation, déroulé, « À prévoir », message, rappel de la veille
alter table agenda_projets add column if not exists heure_convocation text
  check (heure_convocation is null or heure_convocation ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table agenda_projets add column if not exists heure_evenement text
  check (heure_evenement is null or heure_evenement ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table agenda_projets add column if not exists deroule jsonb not null default '[]'
  check (jsonb_typeof(deroule) = 'array' and jsonb_array_length(deroule) <= 30);
alter table agenda_projets add column if not exists a_prevoir text
  check (a_prevoir is null or length(a_prevoir) <= 1500);
alter table agenda_projets add column if not exists message_modele text
  check (message_modele is null or length(message_modele) <= 4000);
alter table agenda_projets add column if not exists rappel_veille boolean not null default true;
alter table agenda_projets add column if not exists rappel_heure text not null default '18:00'
  check (rappel_heure ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- 2) Carnet des personnes non inscrites sur le site (réutilisables d'un projet à l'autre)
create table if not exists contacts_externes (
  id uuid primary key default gen_random_uuid(),
  civilite text check (civilite is null or civilite in ('Madame', 'Mademoiselle', 'Monsieur')),
  nom text not null check (length(trim(nom)) between 1 and 120),
  telephone text check (telephone is null or length(telephone) <= 40),
  email text check (email is null or length(email) <= 160),
  created_at timestamptz not null default now()
);
alter table contacts_externes enable row level security;
revoke all on contacts_externes from anon;
drop policy if exists "Carnet : agence seulement" on contacts_externes;
create policy "Carnet : agence seulement" on contacts_externes for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

-- 3) Participants convoqués à un projet. Les coordonnées sont recopiées au moment où la
--    personne est ajoutée (et rafraîchies à chaque programmation) : le serveur d'envoi n'a
--    pas à lire les fiches privées des mannequins. « parent » : mineur, on écrit au parent.
create table if not exists convocation_participants (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references agenda_projets(id) on delete cascade,
  model_id uuid references model_profiles(id) on delete set null,
  contact_id uuid references contacts_externes(id) on delete set null,
  nom text not null check (length(trim(nom)) between 1 and 160),        -- « Mademoiselle Awa Koné »
  email text check (email is null or length(email) <= 160),
  telephone text check (telephone is null or length(telephone) <= 40),
  parent boolean not null default false,
  parent_nom text check (parent_nom is null or length(parent_nom) <= 160),
  created_at timestamptz not null default now()
);
-- un(e) mineur(e) reçoit son message ET son parent reçoit le sien (demande du 21/10/2026) : deux lignes
drop index if exists convocation_participants_mannequin;
create unique index if not exists convocation_participants_mannequin_parent on convocation_participants (projet_id, model_id, parent) where model_id is not null;
create unique index if not exists convocation_participants_contact on convocation_participants (projet_id, contact_id) where contact_id is not null;
alter table convocation_participants enable row level security;
revoke all on convocation_participants from anon;
drop policy if exists "Participants : agence seulement" on convocation_participants;
create policy "Participants : agence seulement" on convocation_participants for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

-- 4) Les envois : un par participant, par moyen (e-mail, WhatsApp, SMS) et par sorte
--    (convocation, rappel de la veille). Le texte est écrit au moment de l'envoi, avec les
--    informations du projet à jour.
--    statut : programme → en_cours → envoye | echec ; a_faire = WhatsApp/SMS arrivé à l'heure,
--    à envoyer à la main ; annule = projet annulé ou envoi retiré.
create table if not exists convocation_envois (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references agenda_projets(id) on delete cascade,
  participant_id uuid not null references convocation_participants(id) on delete cascade,
  sorte text not null check (sorte in ('convocation', 'rappel')),
  canal text not null check (canal in ('email', 'whatsapp', 'sms')),
  prevu_le timestamptz not null,
  statut text not null default 'programme' check (statut in ('programme', 'en_cours', 'envoye', 'echec', 'a_faire', 'annule')),
  tentatives int not null default 0,
  envoye_le timestamptz,
  pris_le timestamptz,   -- quand l'envoi a été pris (serveur ou navigateur) : reprise après 15 min
  erreur text check (erreur is null or length(erreur) <= 300),
  created_at timestamptz not null default now(),
  unique (participant_id, sorte, canal)
);
alter table convocation_envois add column if not exists pris_le timestamptz;
create index if not exists convocation_envois_a_l_heure on convocation_envois (prevu_le) where statut = 'programme';
alter table convocation_envois enable row level security;
revoke all on convocation_envois from anon;
drop policy if exists "Envois : agence seulement" on convocation_envois;
create policy "Envois : agence seulement" on convocation_envois for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

-- 5) Coordonnées des mannequins choisis (téléphone, e-mail, date de naissance, parent) :
--    réservé à l'agence, comme les autres informations privées.
create or replace function convocation_contacts_mannequins(p_ids uuid[])
returns table(model_id uuid, full_name text, category text, phone text, contact_email text,
              date_naissance date, parent_nom text, parent_telephone text, parent_email text)
language sql stable security definer
set search_path = public
as $$
  select m.id, m.full_name, m.category, m.phone, m.contact_email, m.date_naissance,
         c.parent_nom, c.parent_telephone, c.parent_email
  from model_profiles m
  left join contacts_parents c on c.model_id = m.id
  where m.id = any(p_ids)
    and exists (select 1 from admins where user_id = auth.uid());
$$;
revoke all on function convocation_contacts_mannequins(uuid[]) from public, anon;
grant execute on function convocation_contacts_mannequins(uuid[]) to authenticated;

-- 6) Heure du rappel de la veille (Abidjan = heure UTC).
create or replace function convocation_heure_rappel(p_date date, p_heure text)
returns timestamptz language sql immutable as $$
  select ((p_date - 1)::text || ' ' || coalesce(p_heure, '18:00') || ':00+00')::timestamptz;
$$;

-- Projet modifié après la programmation : le rappel suit la nouvelle date / heure, et un
-- projet annulé (ou dont le rappel est décoché) n'envoie plus rien.
create or replace function convocation_suivre_projet()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.annule then
    update convocation_envois set statut = 'annule'
      where projet_id = NEW.id and statut in ('programme', 'a_faire');
    return NEW;
  end if;
  if not NEW.rappel_veille then
    update convocation_envois set statut = 'annule'
      where projet_id = NEW.id and sorte = 'rappel' and statut in ('programme', 'a_faire');
  elsif NEW.date_debut is distinct from OLD.date_debut or NEW.rappel_heure is distinct from OLD.rappel_heure
        or (NEW.rappel_veille and not OLD.rappel_veille) then
    -- nouvelle heure (ou rappel recoché) : à venir → programmé ; déjà passée → annulé
    -- (jamais de « c'est demain ! » le jour même ou après l'événement)
    update convocation_envois set
      prevu_le = convocation_heure_rappel(NEW.date_debut, NEW.rappel_heure),
      statut = case when convocation_heure_rappel(NEW.date_debut, NEW.rappel_heure) > now() then 'programme' else 'annule' end
      where projet_id = NEW.id and sorte = 'rappel'
        and (statut = 'programme' or (statut = 'annule' and NEW.rappel_veille and not OLD.rappel_veille));
  end if;
  return NEW;
end;
$$;
drop trigger if exists convocation_suivre_projet on agenda_projets;
create trigger convocation_suivre_projet after update on agenda_projets
  for each row execute function convocation_suivre_projet();

-- 7) Côté serveur seulement (clé secrète du serveur, jamais le navigateur) ---------------
create table if not exists reglages_prives (cle text primary key, valeur text not null);
alter table reglages_prives enable row level security;
revoke all on reglages_prives from anon, authenticated;
insert into reglages_prives (cle, valeur)
  values ('convocations_cle', encode(extensions.gen_random_bytes(24), 'hex'))
  on conflict (cle) do nothing;

create or replace function convocations_cle_valide(p_cle text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from reglages_prives where cle = 'convocations_cle' and valeur = p_cle and length(coalesce(p_cle, '')) >= 32);
$$;
revoke all on function convocations_cle_valide(text) from public, anon, authenticated;
grant execute on function convocations_cle_valide(text) to service_role;

-- Prend les envois arrivés à l'heure (une seule fois chacun, même si deux appels se
-- croisent) et renvoie tout ce qu'il faut pour écrire les messages. Les WhatsApp et SMS
-- passent « à faire » (envoi à la main depuis le tableau de bord). Un envoi resté
-- « en cours » plus de 15 minutes (serveur interrompu) est repris.
create or replace function convocations_a_traiter()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  resultat jsonb;
begin
  -- envoi pris il y a plus de 15 minutes sans résultat (serveur ou onglet interrompu) : repris,
  -- sauf après 3 essais (non envoyé)
  update convocation_envois set statut = case when tentatives >= 3 then 'echec' else 'programme' end,
      erreur = coalesce(erreur, 'Envoi interrompu.')
    where statut = 'en_cours' and coalesce(pris_le, prevu_le) < now() - interval '15 minutes';
  -- un rappel de la veille dont l'heure est passée de plus d'une heure ne part plus
  update convocation_envois set statut = 'annule'
    where statut = 'programme' and sorte = 'rappel' and prevu_le < now() - interval '1 hour';
  with dus as (
    select id from convocation_envois
    where statut = 'programme' and prevu_le <= now()
    order by prevu_le limit 200
    for update skip locked
  ), pris as (
    update convocation_envois e
      set statut = case when e.canal = 'email' then 'en_cours' else 'a_faire' end,
          tentatives = e.tentatives + case when e.canal = 'email' then 1 else 0 end,
          pris_le = now()
    from dus where e.id = dus.id
    returning e.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', pris.id, 'sorte', pris.sorte, 'canal', pris.canal,
      'participant', to_jsonb(cp) - 'created_at',
      'projet', to_jsonb(a) - 'notes_internes' - 'partenaire_ids' - 'mannequin_ids' - 'mannequins_libres' - 'partenaires_libres'
    )), '[]'::jsonb)
  into resultat
  from pris
  join convocation_participants cp on cp.id = pris.participant_id
  join agenda_projets a on a.id = pris.projet_id;
  return resultat;
end;
$$;
revoke all on function convocations_a_traiter() from public, anon, authenticated;
grant execute on function convocations_a_traiter() to service_role;

-- Résultat d'un e-mail : envoyé, ou nouvel essai 10 minutes plus tard (3 essais en tout).
create or replace function convocations_resultat(p_id uuid, p_ok boolean, p_erreur text default null)
returns void language sql security definer set search_path = public as $$
  update convocation_envois set
    statut = case when p_ok then 'envoye' when tentatives >= 3 then 'echec' else 'programme' end,
    envoye_le = case when p_ok then now() else envoye_le end,
    prevu_le = case when p_ok or tentatives >= 3 then prevu_le else now() + interval '10 minutes' end,
    erreur = case when p_ok then null else left(p_erreur, 300) end
  where id = p_id and statut = 'en_cours';
$$;
revoke all on function convocations_resultat(uuid, boolean, text) from public, anon, authenticated;
grant execute on function convocations_resultat(uuid, boolean, text) to service_role;

-- 8) Toutes les 5 minutes : s'il y a des envois arrivés à l'heure (et seulement dans ce
--    cas), la base appelle le serveur du site.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create or replace function convocations_reveil()
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from convocation_envois where statut = 'programme' and prevu_le <= now()) then
    perform net.http_get(
      url := 'https://www.maitreakessemodelmanagement.com/api/portail?tache=convocations',
      headers := jsonb_build_object('x-cle-convocations', (select valeur from reglages_prives where cle = 'convocations_cle')),
      timeout_milliseconds := 30000
    );
  end if;
end;
$$;
revoke all on function convocations_reveil() from public, anon, authenticated;
select cron.unschedule('convocations-envois') where exists (select 1 from cron.job where jobname = 'convocations-envois');
select cron.schedule('convocations-envois', '*/5 * * * *', $$select convocations_reveil();$$);

-- 9) Confirmation de présence (demande de la propriétaire, 21/10/2026) : chaque message porte un
--    lien personnel (maitreakessemodelmanagement.com/confirmer?c=…), impossible à deviner, qui
--    marche sans compte (personnes non inscrites, parents). La page publique ne lit que le titre,
--    la date, l'heure de convocation, le lieu et le nom ; elle enregistre « confirmé » ou « absent ».
alter table convocation_participants add column if not exists jeton text not null default encode(extensions.gen_random_bytes(18), 'hex');
create unique index if not exists convocation_participants_jeton on convocation_participants (jeton);
alter table convocation_participants add column if not exists reponse text check (reponse is null or reponse in ('confirme', 'absent'));
alter table convocation_participants add column if not exists repondu_le timestamptz;

create or replace function convocation_lire(p_jeton text)
returns table(titre text, type text, date_debut date, date_fin date, heure_convocation text, lieu text, ville text, nom text, parent boolean, reponse text, passe boolean)
language sql stable security definer set search_path = public as $$
  select a.titre, a.type, a.date_debut, a.date_fin, a.heure_convocation, a.lieu, a.ville, cp.nom, cp.parent, cp.reponse,
         coalesce(a.date_fin, a.date_debut) < current_date
  from convocation_participants cp join agenda_projets a on a.id = cp.projet_id
  where length(coalesce(p_jeton, '')) = 36 and cp.jeton = p_jeton and not a.annule;
$$;
revoke all on function convocation_lire(text) from public;
grant execute on function convocation_lire(text) to anon, authenticated;

create or replace function convocation_repondre(p_jeton text, p_reponse text)
returns boolean language sql security definer set search_path = public as $$
  update convocation_participants cp set reponse = p_reponse, repondu_le = now()
  from agenda_projets a
  where a.id = cp.projet_id and length(coalesce(p_jeton, '')) = 36 and cp.jeton = p_jeton
    and p_reponse in ('confirme', 'absent') and not a.annule
    and coalesce(a.date_fin, a.date_debut) >= current_date
  returning true;
$$;
revoke all on function convocation_repondre(text, text) from public;
grant execute on function convocation_repondre(text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
