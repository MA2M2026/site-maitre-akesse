-- =====================================================================================
-- Application MA2M Mannequin : la « 3e voie » (26/10/2026, demande de la propriétaire)
-- =====================================================================================
-- Tout ce que l'Administration envoie aux mannequins par WhatsApp et par e-mail arrive AUSSI
-- dans leur application (boîte « Messages ») et, si elles l'ont accepté, en notification sur
-- leur téléphone. Les parents (sans application) continuent de recevoir par WhatsApp et e-mail.
--   1) app_messages : la boîte de chaque mannequin (seulement les siens ; l'agence relit tout).
--   2) app_messages_envoyer : envoi par l'agence (« Informations agence », Messages groupés,
--      rapport des profils…) à des mannequins choisies.
--   3) Envois automatiques, au moment où l'agence envoie déjà par WhatsApp / e-mail :
--      annonce de sélection, convocation et rappels (convocation_envois), places limitées
--      (places_invitations), appel et relances des mensualités (mensualites_appels), paiement
--      confirmé ou non retrouvé (paiements_mannequins), cachet payé (cachets_mannequins).
--      Une seule fois chacun (colonne « cle »), et jamais au point de gêner l'envoi d'origine.
--   5) infos_agence : les « Informations agence » (casting, défilé, remerciement, information)
--      écrites dans l'Administration, avec qui les reçoit et où en sont WhatsApp et e-mail.
--   4) app_push_abonnements : les téléphones des mannequins qui acceptent les notifications ;
--      chaque nouveau message déclenche la notification (même déclencheur que celles de
--      l'Administration : notifier_push_notification, supabase-extension.sql, Extension 107).
-- À coller en entier dans Supabase › SQL Editor › Run. Aucune donnée touchée ; peut être rejoué.

-- ---------- 1) La boîte de réception ----------
create table if not exists app_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sorte text not null check (sorte in ('info', 'casting', 'defile', 'remerciement', 'selection', 'convocation', 'rappel',
    'places', 'mensualite', 'paiement', 'cachet', 'message')),
  titre text not null check (length(trim(titre)) between 1 and 160),
  texte text check (texte is null or length(texte) <= 4000),
  image text check (image is null or image ~ '^https://'),
  fiche text check (fiche is null or fiche ~ '^https://'),
  lien text check (lien is null or lien ~ '^/[^/]'),       -- page de l'application ou du site
  cle text unique,                                           -- envoi automatique : une seule fois
  envoi uuid,                                                -- même envoi groupé
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  lu_le timestamptz
);
create index if not exists app_messages_boite on app_messages (user_id, cree_le desc);
create index if not exists app_messages_envoi on app_messages (envoi) where envoi is not null;
alter table app_messages enable row level security;
revoke all on app_messages from anon, authenticated;
grant select on app_messages to authenticated;
drop policy if exists "Une mannequin lit ses messages" on app_messages;
create policy "Une mannequin lit ses messages" on app_messages for select using (user_id = auth.uid());
drop policy if exists "L'agence relit les messages envoyés" on app_messages;
create policy "L'agence relit les messages envoyés" on app_messages for select using (portail_peut('site'));

-- lus (la mannequin, seulement les siens)
create or replace function app_messages_lus(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update app_messages set lu_le = now() where id = any(p_ids) and user_id = auth.uid() and lu_le is null;
$$;
revoke all on function app_messages_lus(uuid[]) from public, anon;
grant execute on function app_messages_lus(uuid[]) to authenticated;

-- ---------- Qui a l'application ? (compte du site d'une mannequin) ----------
-- clés des écrans de l'Administration : « m:<profil> », « r:<registre> », « c:<carnet> »,
-- « e:<e-mail> » (candidate des Messages groupés qui a, depuis, un compte)
create or replace function app_compte_de(p_cle text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  t text := split_part(p_cle, ':', 1);
  v text := substr(p_cle, length(t) + 2);
  u uuid;
begin
  if t = 'e' then
    select id into u from auth.users where lower(email) = lower(trim(v)) limit 1;
    return u;
  end if;
  if v is null or v !~* '^[0-9a-f-]{36}$' then return null; end if;
  if t = 'm' then select id into u from auth.users where id = v::uuid;
  elsif t = 'r' then select user_id into u from agence_mannequins where id = v::uuid;
  elsif t = 'c' then select a.user_id into u from contacts_externes c join agence_mannequins a on a.id = c.mannequin_id where c.id = v::uuid;
  end if;
  return u;
end;
$$;
revoke all on function app_compte_de(text) from public, anon, authenticated;

-- ---------- 2) Envoi par l'agence ----------
-- renvoie le nombre de mannequins qui le reçoivent dans l'application (celles qui ont un compte)
create or replace function app_messages_envoyer(p_cles text[], p_sorte text, p_titre text, p_texte text,
  p_image text default null, p_fiche text default null, p_lien text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_envoi uuid := gen_random_uuid();
  n int;
begin
  if not portail_peut('site') then raise exception 'Accès refusé.'; end if;
  if coalesce(array_length(p_cles, 1), 0) > 500 then raise exception 'Trop de destinataires d''un coup (500 au plus).'; end if;
  -- (« {prénom} » écrit dans le message : le nom de chacune)
  insert into app_messages (user_id, sorte, titre, texte, image, fiche, lien, envoi)
  select u, p_sorte, left(trim(p_titre), 160),
         left(regexp_replace(p_texte, '\{pr[ée]nom\}', coalesce((select full_name from model_profiles where id = u), (select full_name from agence_mannequins where user_id = u limit 1), ''), 'gi'), 4000),
         nullif(trim(coalesce(p_image, '')), ''), nullif(trim(coalesce(p_fiche, '')), ''), nullif(trim(coalesce(p_lien, '')), ''), v_envoi
    from (select distinct app_compte_de(c) u from unnest(p_cles) c) x where u is not null;
  get diagnostics n = row_count;
  perform journaliser('Message envoyé dans l''application', 'app_messages', v_envoi::text, null, json_build_object('sorte', p_sorte, 'nombre', n)::jsonb);
  return n;
end;
$$;
revoke all on function app_messages_envoyer(text[], text, text, text, text, text, text) from public, anon;
grant execute on function app_messages_envoyer(text[], text, text, text, text, text, text) to authenticated;

-- ---------- 3) Envois automatiques ----------
-- (dépôt d'un message automatique : jamais d'erreur qui bloquerait l'envoi d'origine)
create or replace function app_message_auto(p_user uuid, p_cle text, p_sorte text, p_titre text, p_texte text, p_lien text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into app_messages (user_id, sorte, titre, texte, lien, cle, cree_par)
  values (p_user, p_sorte, left(p_titre, 160), left(p_texte, 4000), p_lien, p_cle, null)
  on conflict (cle) do nothing;
exception when others then
  raise warning 'app_message_auto % : %', p_cle, sqlerrm;
end;
$$;
revoke all on function app_message_auto(uuid, text, text, text, text, text) from public, anon, authenticated;

create or replace function app_nom_mois(p date)
returns text language sql immutable as $$
  select (array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])[extract(month from p)::int] || ' ' || extract(year from p)::int;
$$;
create or replace function app_montant(p int)
returns text language sql immutable as $$
  select regexp_replace(coalesce(p, 0)::text, '(\d)(?=(\d{3})+$)', '\1 ', 'g') || ' FCFA';
$$;

-- dates et lieux d'un projet en une phrase (mêmes règles que js/messages-convocations.js) :
-- « le samedi 14 novembre 2026 », « du mercredi 21 au jeudi 22 octobre 2026 », « du vendredi 30
-- octobre au dimanche 1er novembre 2026 »
create or replace function app_jour(d date)
returns text language sql immutable as $$
  select (array['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'])[extract(dow from d)::int + 1] || ' ' ||
         case when extract(day from d) = 1 then '1er' else extract(day from d)::int::text end;
$$;
create or replace function app_periode(p_debut date, p_fin date)
returns text language sql immutable as $$
  select case when p_debut is null then null
    when p_fin is null or p_fin <= p_debut then 'le ' || app_jour(p_debut) || ' ' || app_nom_mois(p_debut)
    else 'du ' || app_jour(p_debut) ||
         case when extract(year from p_debut) <> extract(year from p_fin) then ' ' || app_nom_mois(p_debut)
              when extract(month from p_debut) <> extract(month from p_fin) then ' ' || split_part(app_nom_mois(p_debut), ' ', 1)
              else '' end ||
         ' au ' || app_jour(p_fin) || ' ' || app_nom_mois(p_fin) end;
$$;
-- tous les lieux : celui de chaque jour, le lieu général pour les jours sans lieu ; plusieurs lieux
-- séparés par une virgule (jamais coupés sur « et »), sans doublon, dans l'ordre des jours, puis la
-- ville si aucun lieu ne la nomme déjà (comme lieuProjet, js/messages-convocations.js)
create or replace function app_lieux(a agenda_projets)
returns text language sql stable as $$
  with jours as (
    select j.n, coalesce(nullif(btrim(j.v ->> 'lieu', E' \t\r\n'), ''), a.lieu) as lieu
    from jsonb_array_elements(coalesce(a.seances, '[]'::jsonb)) with ordinality j(v, n)
    union all select 0, a.lieu where not exists (select 1 from jsonb_array_elements(coalesce(a.seances, '[]'::jsonb)))
  ), tous as (
    select j.n * 1000 + t.m as o, btrim(t.x, E' \t\r\n') as x
    from jours j cross join lateral regexp_split_to_table(coalesce(j.lieu, ''), '[,;\n]') with ordinality t(x, m)
  ), uniques as (
    select distinct on (lower(x)) x, o from tous where x <> '' order by lower(x), o
  ), liste as (select string_agg(x, ', ' order by o) as l from uniques)
  -- (la ville comme mot entier : « Man » n'est pas dans « Salle Germaine »)
  select nullif(concat_ws(', ', l, case when nullif(btrim(a.ville), '') is not null and coalesce(l, '') !~* ('(^|[^[:alpha:]])' ||
    regexp_replace(btrim(a.ville), '([.*+?^$(){}|\[\]\\])', '\\\1', 'g') || '([^[:alpha:]]|$)') then btrim(a.ville) end), '') from liste;
$$;

-- a) annonce de sélection, convocation, rappels : quand le message part (ou est à envoyer à la
--    main) pour la mannequin elle-même (pas la ligne de son parent)
create or replace function app_auto_convocation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p convocation_participants;
  a agenda_projets;
  u uuid;
  quand text;
begin
  if new.statut not in ('envoye', 'a_faire') or (tg_op = 'UPDATE' and old.statut in ('envoye', 'a_faire')) then return new; end if;
  select * into p from convocation_participants where id = new.participant_id;
  if not found or p.parent then return new; end if;
  select * into a from agenda_projets where id = new.projet_id;
  if not found or a.annule then return new; end if;
  u := coalesce((select id from auth.users where id = p.model_id),
                (select r.user_id from contacts_externes c join agence_mannequins r on r.id = c.mannequin_id where c.id = p.contact_id));
  quand := 'Rendez-vous ' || coalesce(app_periode(a.date_debut, a.date_fin), 'bientôt') || coalesce(', ' || app_lieux(a), '') ||
           coalesce(', convocation à ' || replace(nullif(a.heure_convocation, ''), ':', 'h'), '') || '.';
  perform app_message_auto(u, 'convocation:' || p.id || ':' || new.sorte,
    case new.sorte when 'selection' then 'selection' when 'convocation' then 'convocation' else 'rappel' end,
    case new.sorte when 'selection' then '🎉 Bonne nouvelle, vous êtes ' || case when p.nom ~ '^(Madame|Mademoiselle)' then 'sélectionnée' when p.nom ~ '^Monsieur' then 'sélectionné' else 'sélectionné(e)' end || ' pour ' || a.titre
                   when 'convocation' then '💌 Votre convocation pour ' || a.titre
                   else '⏰ Petit rappel pour ' || a.titre end,
    case new.sorte when 'selection' then E'Toute l’équipe est fière de vous compter parmi nous ✨\n' else '' end ||
    quand || E'\nConfirmez votre présence et retrouvez tous les détails dans l’onglet Événements.', '/app/#evenements');
  return new;
end;
$$;
drop trigger if exists app_auto_convocation on convocation_envois;
create trigger app_auto_convocation after insert or update of statut on convocation_envois
  for each row execute function app_auto_convocation();

-- b) places limitées : quand le lien personnel part (pour elle ou pour son parent)
create or replace function app_auto_places()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a agenda_projets;
begin
  if new.statut = 'exclu' or not ((old.envoye_le is null and new.envoye_le is not null) or (old.parent_envoye_le is null and new.parent_envoye_le is not null)) then return new; end if;
  select * into a from agenda_projets where id = new.projet_id;
  -- (profil du site, mannequin du registre ou personne du carnet rattachée au registre)
  perform app_message_auto(coalesce(app_compte_de('m:' || new.model_id), app_compte_de('r:' || new.mannequin_id), app_compte_de('c:' || new.contact_id)), 'places:' || new.id, 'places',
    '🎟️ Places limitées pour ' || coalesce(a.titre, 'un nouveau projet'),
    'Les places partent vite. Réservez la vôtre avec votre lien personnel, les premières arrivées sont les premières servies.', '/places?c=' || new.jeton);
  return new;
end;
$$;
drop trigger if exists app_auto_places on places_invitations;
create trigger app_auto_places after update of envoye_le, parent_envoye_le on places_invitations
  for each row execute function app_auto_places();

-- c) mensualités : appel du 1er, relances du 3 et du 5
create or replace function app_auto_mensualite()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a agence_mannequins;
  quoi text;
begin
  select * into a from agence_mannequins where id = new.mannequin_id;
  if not found or a.user_id is null then return new; end if;
  if tg_op = 'INSERT' then
    perform app_message_auto(a.user_id, 'mensualite:' || new.mois || ':' || a.id, 'mensualite', '💳 Votre mensualité de ' || app_nom_mois(new.mois),
      'Le montant est de ' || app_montant(a.mensualite) || ', à régler avant le 5 avec Wave, depuis l’onglet Paiements. Merci 🤍', '/app/#paiements');
  else
    quoi := case when old.relance5_le is null and new.relance5_le is not null then 'r5' when old.relance3_le is null and new.relance3_le is not null then 'r3' end;
    if quoi is null then return new; end if;
    perform app_message_auto(a.user_id, 'mensualite:' || new.mois || ':' || a.id || ':' || quoi, 'mensualite',
      case quoi when 'r5' then '⏳ Dernier jour pour votre mensualité de ' else '🔔 Petit rappel pour votre mensualité de ' end || app_nom_mois(new.mois),
      case quoi when 'r5' then 'C’est aujourd’hui la date limite (' || app_montant(a.mensualite) || '). Vous pouvez régler depuis l’onglet Paiements.'
        else app_montant(a.mensualite) || ' à régler avant le 5, depuis l’onglet Paiements. Merci 🤍' end, '/app/#paiements');
  end if;
  return new;
end;
$$;
drop trigger if exists app_auto_mensualite on mensualites_appels;
create trigger app_auto_mensualite after insert or update of relance3_le, relance5_le on mensualites_appels
  for each row execute function app_auto_mensualite();

-- d) paiement vérifié par l'agence : confirmé ou non retrouvé
create or replace function app_auto_paiement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a agence_mannequins;
  quoi text;
begin
  if new.statut = old.statut or new.statut not in ('valide', 'refuse') then return new; end if;
  select * into a from agence_mannequins where id = new.mannequin_id;
  if not found or a.user_id is null then return new; end if;
  quoi := case when new.objet = 'inscription' then 'inscription' else 'mensualité de ' || app_nom_mois(new.mois) end;
  perform app_message_auto(a.user_id, 'paiement:' || new.id || ':' || new.statut, 'paiement',
    case new.statut when 'valide' then '✅ Paiement bien reçu pour votre ' || quoi else '⚠️ Paiement non retrouvé pour votre ' || quoi end,
    case new.statut when 'valide' then 'Merci 🤍 Nous avons bien reçu ' || coalesce(app_montant(new.montant), 'votre paiement') || '. Votre reçu vous attend dans l’onglet Paiements.'
      else coalesce(nullif(trim(new.motif), '') || ' ', '') || 'Si vous avez bien payé, écrivez-nous et nous regarderons ensemble.' end, '/app/#paiements');
  return new;
end;
$$;
drop trigger if exists app_auto_paiement on paiements_mannequins;
create trigger app_auto_paiement after update of statut on paiements_mannequins
  for each row execute function app_auto_paiement();

-- e) cachet payé par l'agence
create or replace function app_auto_cachet()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.statut <> 'paye' or old.statut = 'paye' then return new; end if;
  perform app_message_auto((select user_id from agence_mannequins where id = new.agence_mannequin_id), 'cachet:' || new.id, 'cachet',
    '💰 Votre cachet est payé', app_montant(new.montant) || ' pour ' || new.prestation || E'. Bravo et merci pour votre travail ✨\nVotre reçu est dans l’onglet Paiements.', '/app/#paiements');
  return new;
end;
$$;
drop trigger if exists app_auto_cachet on cachets_mannequins;
create trigger app_auto_cachet after update of statut on cachets_mannequins
  for each row execute function app_auto_cachet();

-- ---------- 4) Notifications sur le téléphone des mannequins ----------
create table if not exists app_push_abonnements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);
alter table app_push_abonnements enable row level security;
revoke all on app_push_abonnements from anon, authenticated;
-- (un téléphone passé à une autre mannequin : son abonnement change de propriétaire)
create or replace function app_push_abonner(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  insert into app_push_abonnements (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, actif = true;
end;
$$;
revoke all on function app_push_abonner(text, text, text) from public, anon;
grant execute on function app_push_abonner(text, text, text) to authenticated;
-- « Se déconnecter » : ce téléphone ne reçoit plus les notifications de ce compte
create or replace function app_push_desabonner(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  update app_push_abonnements set actif = false where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke all on function app_push_desabonner(text) from public, anon;
grant execute on function app_push_desabonner(text) to authenticated;
-- (le serveur des notifications n'est appelé que si la mannequin a un téléphone abonné : pas
-- d'appel inutile, ni de ligne au journal, pour les autres)
create or replace function app_a_un_telephone(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_push_abonnements where user_id = p_user and actif);
$$;
revoke all on function app_a_un_telephone(uuid) from public, anon, authenticated;

-- chaque nouveau message → notification (api/notifications-webhook.js l'envoie aux seuls
-- téléphones de cette mannequin)
drop trigger if exists trg_notif_app_messages on app_messages;
create trigger trg_notif_app_messages after insert on app_messages
  for each row when (app_a_un_telephone(new.user_id)) execute function notifier_push_notification();

-- ---------- 5) Informations agence (Administration › Projets et convocations) ----------
create table if not exists infos_agence (
  id uuid primary key default gen_random_uuid(),
  sorte text not null check (sorte in ('casting', 'defile', 'remerciement', 'info')),
  titre text not null check (length(trim(titre)) between 1 and 160),
  date_info date,
  heure text check (heure is null or length(heure) <= 20),
  lieu text check (lieu is null or length(lieu) <= 200),
  client text check (client is null or length(client) <= 160),
  projet_id uuid references agenda_projets(id) on delete set null,
  image text check (image is null or image ~ '^https://'),
  fiche text check (fiche is null or fiche ~ '^https://'),
  message text not null check (length(message) between 1 and 4000),          -- WhatsApp / e-mail, à la mannequin
  message_parent text check (message_parent is null or length(message_parent) <= 4000),  -- … au parent d'une mineure
  message_app text check (message_app is null or length(message_app) <= 4000),          -- dans l'application
  destinataires text[] not null default '{}',   -- clés m:/r:/c: des écrans de l'Administration
  faits_wa text[] not null default '{}',
  faits_email text[] not null default '{}',
  dans_app int not null default 0,
  cree_le timestamptz not null default now(),
  cree_par uuid references auth.users(id) default auth.uid()
);
alter table infos_agence add column if not exists date_fin date;  -- (projet sur plusieurs jours, 26/10/2026)
create index if not exists infos_agence_recentes on infos_agence (cree_le desc);
alter table infos_agence enable row level security;
revoke all on infos_agence from anon;
drop policy if exists "Informations agence : gestion du site" on infos_agence;
create policy "Informations agence : gestion du site" on infos_agence for all using (portail_peut('site')) with check (portail_peut('site'));

NOTIFY pgrst, 'reload schema';

-- Contrôle : doit afficher 1
select count(*) as boite_application from pg_proc where proname = 'app_messages_envoyer';
