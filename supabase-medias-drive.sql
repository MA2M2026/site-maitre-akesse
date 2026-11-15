-- =====================================================================================================
-- Photos et vidéos envoyées vers Google Drive : enregistrées PAR LE SERVEUR (15/11/2026, demande de la
-- propriétaire : « une solution définitive », maquettes/URGENT-photos-candidatures.md).
--
-- Avant : le programme Google rangeait les photos dans Drive puis renvoyait leurs liens AU TÉLÉPHONE de la
-- candidate, qui les enregistrait. Réponse perdue (réseau coupé, page fermée, Google lent) = photos dans Drive mais
-- absentes de l'Administration (18 candidatures sur 20 du 19/10 au 12/11/2026).
-- Maintenant :
--   1. le programme Google (scripts/apps-script-photos-drive.gs) enregistre LUI-MÊME chaque lien ici, par
--      media_drive_recu(), protégée par un mot secret (seule son empreinte est écrite ci-dessous ; le mot lui-même
--      est rangé dans les « Propriétés du script » Google, jamais dans le dépôt) ;
--   2. le journal medias_drive garde tout ce qui est arrivé (photos, vidéo, dossier Drive), y compris pour une
--      inscription au cours de talons pas encore enregistrée (elle l'est après ses photos) : à son arrivée, elle
--      reprend ce qui l'attend (déclencheur cours_talons_z_medias_drive) ;
--   3. surveillance toutes les 15 minutes (medias_drive_surveiller) : une candidature ou une inscription sans photo
--      demande au programme Google de retrouver son dossier dans Drive (jusqu'à 4 fois) ; toujours rien ensuite →
--      alerte au journal des erreurs + notification sur le téléphone de l'agence ;
--   4. bouton « Récupérer les photos depuis Drive » de l'Administration : medias_drive_relancer().
-- À COLLER UNE FOIS dans Supabase (SQL Editor). Rien n'est effacé ; peut être recollé sans risque.
-- =====================================================================================================

-- ---------- réglage : empreinte du mot secret du programme Google, et « programme Google à jour »
create table if not exists medias_drive_reglage (
  id int primary key default 1 check (id = 1),
  empreinte text not null,
  script_a_jour boolean not null default false  -- devient vrai au premier envoi du nouveau programme Google
);
alter table medias_drive_reglage enable row level security;  -- aucune règle : personne ne le lit depuis le site
insert into medias_drive_reglage (empreinte) values ('6f53e3ce5d3646b749e260cede7959472e51eff01e4fa874037dfe53ebf5ae98')
on conflict (id) do update set empreinte = excluded.empreinte;

create or replace function medias_drive_secret_ok(p_secret text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from medias_drive_reglage
                  where empreinte = encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex'));
$$;
revoke all on function medias_drive_secret_ok(text) from public, anon, authenticated;

-- ---------- journal de ce qui est arrivé dans Drive
create table if not exists medias_drive (
  id bigserial primary key,
  source text not null check (source in ('candidature', 'cours_talons')),
  ref uuid not null,                 -- candidature : casting_applications.id ; cours de talons : cours_talons.id
  genre text not null check (genre in ('photo', 'video', 'dossier')),
  lien text not null,                -- photo / vidéo : lien Drive ; dossier : identifiant du dossier Drive
  cree_le timestamptz not null default now(),
  unique (ref, genre, lien)
);
create index if not exists medias_drive_ref on medias_drive (ref);
alter table medias_drive enable row level security;
drop policy if exists "Les admins lisent les medias Drive" on medias_drive;
create policy "Les admins lisent les medias Drive" on medias_drive for select
  using (exists (select 1 from admins where user_id = auth.uid()));

-- une même photo jamais deux fois sur une candidature (le téléphone ET le programme Google peuvent l'écrire)
-- (sans arrêter le collage si d'anciens doublons existent : rien n'est effacé, l'index attend qu'ils soient retirés)
do $$ begin
  create unique index if not exists casting_photos_une_fois on casting_photos (application_id, url) where url is not null;
exception when unique_violation then raise notice 'casting_photos : doublons existants, index « une fois » non créé';
end $$;

-- ---------- rattacher ce qui est connu pour une référence (journal → candidature / inscription)
create or replace function medias_drive_appliquer(p_source text, p_ref uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  m record;
  ajoutes int := 0;
begin
  if p_source = 'candidature' then
    for m in select lien from medias_drive where ref = p_ref and genre = 'photo' order by id loop
      insert into casting_photos (application_id, url, chemin)
        select p_ref, m.lien, null
         where exists (select 1 from casting_applications where id = p_ref)
           and not exists (select 1 from casting_photos where application_id = p_ref and url = m.lien)
           and (select count(*) from casting_photos where application_id = p_ref) < 12;
      if found then ajoutes := ajoutes + 1; end if;
    end loop;
    update casting_applications a set video_url = (select lien from medias_drive where ref = p_ref and genre = 'video' order by id limit 1)
     where a.id = p_ref and a.video_url is null and exists (select 1 from medias_drive where ref = p_ref and genre = 'video');
  elsif p_source = 'cours_talons' then
    for m in select lien from medias_drive where ref = p_ref and genre = 'photo' order by id loop
      update cours_talons set photos = photos || to_jsonb(m.lien)
       where id = p_ref and not (photos ? m.lien) and jsonb_array_length(photos) < 5;
      if found then ajoutes := ajoutes + 1; end if;
    end loop;
    update cours_talons t set video = (select lien from medias_drive where ref = p_ref and genre = 'video' order by id limit 1)
     where t.id = p_ref and t.video is null and exists (select 1 from medias_drive where ref = p_ref and genre = 'video');
  end if;
  return ajoutes;
end;
$$;
revoke all on function medias_drive_appliquer(text, uuid) from public, anon, authenticated;

-- ---------- appelée par le programme Google après chaque envoi (photos, vidéo, dossier)
create or replace function media_drive_recu(p_secret text, p_source text, p_ref uuid, p_dossier text default null,
                                            p_photos text[] default null, p_video text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l text;
begin
  if not medias_drive_secret_ok(p_secret) then raise exception 'non autorisé'; end if;
  if p_source not in ('candidature', 'cours_talons') or p_ref is null then raise exception 'envoi invalide'; end if;
  if coalesce(array_length(p_photos, 1), 0) > 20 then raise exception 'trop de photos'; end if;
  update medias_drive_reglage set script_a_jour = true where not script_a_jour;
  if p_dossier ~ '^[A-Za-z0-9_-]{10,120}$' then
    insert into medias_drive (source, ref, genre, lien) values (p_source, p_ref, 'dossier', p_dossier) on conflict do nothing;
  end if;
  foreach l in array coalesce(p_photos, '{}'::text[]) loop
    if l ~ '^https://drive\.google\.com/thumbnail\?id=[A-Za-z0-9_-]+&sz=w2000$' then
      insert into medias_drive (source, ref, genre, lien) values (p_source, p_ref, 'photo', l) on conflict do nothing;
    end if;
  end loop;
  if p_video ~ '^https://drive\.google\.com/file/d/[A-Za-z0-9_-]+/view$' then
    insert into medias_drive (source, ref, genre, lien) values (p_source, p_ref, 'video', p_video) on conflict do nothing;
  end if;
  return jsonb_build_object('ok', true, 'ajoutes', medias_drive_appliquer(p_source, p_ref));
end;
$$;
revoke all on function media_drive_recu(text, text, uuid, text, text[], text) from public;
grant execute on function media_drive_recu(text, text, uuid, text, text[], text) to anon, authenticated;

-- ---------- pour le programme Google, quand il cherche le dossier d'une personne (« retrouver »)
create or replace function media_drive_infos(p_secret text, p_source text, p_ref uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb;
begin
  if not medias_drive_secret_ok(p_secret) then raise exception 'non autorisé'; end if;
  if p_source = 'candidature' then
    select jsonb_build_object('nom', full_name, 'type', type_candidature, 'projet', projet_nom, 'cree_le', created_at,
                              'nb_photos', (select count(*) from casting_photos where application_id = a.id), 'video', video_url is not null)
      into r from casting_applications a where id = p_ref;
  elsif p_source = 'cours_talons' then
    select jsonb_build_object('nom', nom, 'type', 'projet', 'projet', 'Cours de talons', 'cree_le', cree_le,
                              'nb_photos', jsonb_array_length(photos), 'video', video is not null)
      into r from cours_talons where id = p_ref;
  end if;
  if r is null then return null; end if;
  return r || jsonb_build_object('dossiers', coalesce((select jsonb_agg(lien order by id) from medias_drive where ref = p_ref and genre = 'dossier'), '[]'::jsonb));
end;
$$;
revoke all on function media_drive_infos(text, text, uuid) from public;
grant execute on function media_drive_infos(text, text, uuid) to anon, authenticated;

-- ---------- inscription au cours de talons : reprend ce que Google a déjà enregistré pour elle
create or replace function cours_talons_z_medias_drive()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m record;
begin
  for m in select lien from medias_drive where ref = new.id and genre = 'photo' order by id loop
    if not (new.photos ? m.lien) and jsonb_array_length(new.photos) < 5 then new.photos := new.photos || to_jsonb(m.lien); end if;
  end loop;
  if new.video is null then new.video := (select lien from medias_drive where ref = new.id and genre = 'video' order by id limit 1); end if;
  return new;
end;
$$;
drop trigger if exists cours_talons_z_medias_drive on cours_talons;
create trigger cours_talons_z_medias_drive before insert on cours_talons
  for each row execute function cours_talons_z_medias_drive();

-- ---------- demander au programme Google de retrouver le dossier d'une personne (sans attendre sa réponse :
-- c'est le programme qui enregistre ce qu'il trouve, par media_drive_recu)
create or replace function medias_drive_demander(p_source text, p_ref uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://script.google.com/macros/s/AKfycbxzPeaTLvMqZKtBvJJabLeZBh6JJ9ZaggPYUY8XAoh1-tyBq1Byi3lBm3SkhkH8rqNxxg/exec',
    body := jsonb_build_object('cle', 'b56772fb9c5075517dc36a6b20db10734701e262274f3beb', 'action', 'retrouver', 'source', p_source, 'ref', p_ref),
    headers := jsonb_build_object('Content-Type', 'application/json'),  -- (pg_net n'accepte que ce type ; Google lit le texte quand même)
    timeout_milliseconds := 60000);
end;
$$;
revoke all on function medias_drive_demander(text, uuid) from public, anon, authenticated;

-- Bouton « Récupérer les photos depuis Drive » (Administration) : seulement pour un administrateur
create or replace function medias_drive_relancer(p_source text, p_ref uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then raise exception 'réservé à l''agence'; end if;
  if p_source not in ('candidature', 'cours_talons') then raise exception 'source inconnue'; end if;
  if not (select script_a_jour from medias_drive_reglage) then return false; end if;
  perform medias_drive_appliquer(p_source, p_ref);
  perform medias_drive_demander(p_source, p_ref);
  return true;
end;
$$;
revoke all on function medias_drive_relancer(text, uuid) from public, anon;
grant execute on function medias_drive_relancer(text, uuid) to authenticated;

-- ---------- surveillance (toutes les 15 minutes) et alerte
create table if not exists medias_drive_relances (
  ref uuid primary key,
  source text not null,
  essais int not null default 0,
  dernier timestamptz,
  alerte_le timestamptz
);
alter table medias_drive_relances enable row level security;
drop policy if exists "Les admins lisent les relances Drive" on medias_drive_relances;
create policy "Les admins lisent les relances Drive" on medias_drive_relances for select
  using (exists (select 1 from admins where user_id = auth.uid()));

create table if not exists medias_drive_alertes (
  id uuid primary key default gen_random_uuid(),   -- (uuid : le journal des notifications range cible_id en uuid)
  source text not null,
  ref uuid not null,
  nom text,
  cree_le timestamptz not null default now()
);
alter table medias_drive_alertes enable row level security;
drop policy if exists "Les admins lisent les alertes photos" on medias_drive_alertes;
create policy "Les admins lisent les alertes photos" on medias_drive_alertes for select
  using (exists (select 1 from admins where user_id = auth.uid()));
-- notification sur le téléphone de l'agence (api/notifications-webhook.js, même fonction que les candidatures)
drop trigger if exists trg_notif_medias_drive_alertes on medias_drive_alertes;
create trigger trg_notif_medias_drive_alertes after insert on medias_drive_alertes
  for each row execute function notifier_push_notification();
insert into notifications_reglages (cle, actif) values ('evenement_photos_manquantes', true) on conflict (cle) do nothing;

-- p_jours : jusqu'où remonter (3 jours pour la surveillance ; plus pour le rattrapage des anciens dossiers)
-- (au plus 8 demandes à Google par passage : Google n'accepte qu'une trentaine d'exécutions en même temps)
create or replace function medias_drive_surveiller(p_jours int default 3)
returns int language plpgsql security definer set search_path = public as $$
declare
  d record;
  r medias_drive_relances;
  demandes int := 0;
begin
  if not (select script_a_jour from medias_drive_reglage) then return 0; end if;  -- ancien programme Google : rien
  for d in
    select 'candidature'::text source, a.id ref, a.full_name nom from casting_applications a
     where a.created_at between now() - make_interval(days => p_jours) and now() - interval '10 minutes'
       and coalesce(a.type_candidature, '') <> 'direct'   -- (dossier créé par l'agence elle-même, sans photo)
       and not exists (select 1 from casting_photos p where p.application_id = a.id)
    union all
    select 'cours_talons', t.id, t.nom from cours_talons t
     where t.cree_le between now() - make_interval(days => p_jours) and now() - interval '10 minutes'
       and jsonb_array_length(t.photos) = 0
  loop
    -- photos déjà signalées par Google mais absentes : l'agence les a supprimées elle-même → on n'y touche pas
    continue when exists (select 1 from medias_drive m where m.ref = d.ref and m.genre = 'photo');
    select * into r from medias_drive_relances where ref = d.ref;
    if r.ref is null then
      insert into medias_drive_relances (ref, source) values (d.ref, d.source) returning * into r;
    end if;
    if r.essais < 4 and (r.dernier is null or r.dernier < now() - interval '25 minutes') then
      continue when demandes >= 8;
      perform medias_drive_demander(d.source, d.ref);
      update medias_drive_relances set essais = essais + 1, dernier = now() where ref = d.ref;
      demandes := demandes + 1;
    elsif r.essais >= 4 and r.alerte_le is null and r.dernier < now() - interval '20 minutes'
          and not exists (select 1 from casting_photos p where p.application_id = d.ref)
          and not exists (select 1 from cours_talons t where t.id = d.ref and jsonb_array_length(t.photos) > 0) then
      insert into medias_drive_alertes (source, ref, nom) values (d.source, d.ref, d.nom);
      insert into journal_erreurs (message, page, pile)
        values ('[Photos Drive] ' || case d.source when 'candidature' then 'candidature' else 'inscription au cours de talons' end
                || ' de ' || coalesce(d.nom, '?') || ' sans photo enregistrée (introuvables dans Drive après 4 recherches)',
                'surveillance', 'ref=' || d.ref);
      update medias_drive_relances set alerte_le = now() where ref = d.ref;
    end if;
  end loop;
  -- (le journal ne garde pas les liens d'une candidature ou d'une inscription effacée)
  delete from medias_drive m where m.cree_le < now() - interval '7 days'
     and not exists (select 1 from casting_applications a where a.id = m.ref)
     and not exists (select 1 from cours_talons t where t.id = m.ref);
  delete from medias_drive_relances x where not exists (select 1 from casting_applications a where a.id = x.ref)
     and not exists (select 1 from cours_talons t where t.id = x.ref);
  return demandes;
end;
$$;
revoke all on function medias_drive_surveiller(int) from public, anon, authenticated;

select cron.unschedule('medias-drive-surveillance') where exists (select 1 from cron.job where jobname = 'medias-drive-surveillance');
select cron.schedule('medias-drive-surveillance', '*/15 * * * *', 'select medias_drive_surveiller();');

NOTIFY pgrst, 'reload schema';
select 'Photos Drive enregistrées par le serveur : en place' as resultat;
