-- Rappel automatique quelques jours avant l'événement (23/10/2026, demande de la propriétaire) :
-- en plus du rappel de la veille, un rappel « nous vous confirmons… » N jours avant (3 par
-- défaut), à l'heure choisie (10h00 par défaut), réglable sur chaque projet. Même chemin que le
-- rappel de la veille : convocation_envois (sorte « rappel_avant »), serveur d'envoi programmé
-- (api/portail.js), et il suit les changements de date. Les personnes qui ont répondu « absent »
-- ne reçoivent plus de rappel (ni celui-ci, ni celui de la veille).
-- À exécuter une fois dans Supabase (SQL Editor), après supabase-convocations.sql et
-- supabase-selection.sql. Rejouable.

-- 1) Le réglage du projet
alter table agenda_projets add column if not exists rappel_avant boolean not null default true;
alter table agenda_projets add column if not exists rappel_avant_jours int not null default 3
  check (rappel_avant_jours between 2 and 14);
alter table agenda_projets add column if not exists rappel_avant_heure text not null default '10:00'
  check (rappel_avant_heure ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- 2) La nouvelle sorte d'envoi
do $$
declare
  nom text;
begin
  for nom in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.convocation_envois'::regclass and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%sorte%'
  loop
    execute format('alter table public.convocation_envois drop constraint %I', nom);
  end loop;
end $$;
alter table public.convocation_envois add constraint convocation_envois_sorte_check
  check (sorte in ('selection', 'convocation', 'rappel', 'rappel_avant'));

-- 3) Heure du rappel N jours avant (Abidjan = heure UTC)
create or replace function convocation_heure_rappel_avant(p_date date, p_jours int, p_heure text)
returns timestamptz language sql immutable as $$
  select ((p_date - coalesce(p_jours, 3))::text || ' ' || coalesce(p_heure, '10:00') || ':00+00')::timestamptz;
$$;

-- 4) Projet modifié après la programmation : les deux rappels suivent la nouvelle date / heure ;
--    un projet annulé (ou un rappel décoché) n'envoie plus rien.
create or replace function convocation_suivre_projet()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.annule then
    update convocation_envois set statut = 'annule'
      where projet_id = NEW.id and statut in ('programme', 'a_faire');
    return NEW;
  end if;
  -- rappel de la veille
  if not NEW.rappel_veille then
    update convocation_envois set statut = 'annule'
      where projet_id = NEW.id and sorte = 'rappel' and statut in ('programme', 'a_faire');
  elsif NEW.date_debut is distinct from OLD.date_debut or NEW.rappel_heure is distinct from OLD.rappel_heure
        or (NEW.rappel_veille and not OLD.rappel_veille) then
    -- nouvelle heure (ou rappel recoché) : à venir → programmé ; déjà passée → annulé
    update convocation_envois set
      prevu_le = convocation_heure_rappel(NEW.date_debut, NEW.rappel_heure),
      statut = case when convocation_heure_rappel(NEW.date_debut, NEW.rappel_heure) > now() then 'programme' else 'annule' end
      where projet_id = NEW.id and sorte = 'rappel'
        and (statut = 'programme' or (statut = 'annule' and NEW.rappel_veille and not OLD.rappel_veille));
  end if;
  -- rappel quelques jours avant
  if not NEW.rappel_avant then
    update convocation_envois set statut = 'annule'
      where projet_id = NEW.id and sorte = 'rappel_avant' and statut in ('programme', 'a_faire');
  elsif NEW.date_debut is distinct from OLD.date_debut or NEW.rappel_avant_jours is distinct from OLD.rappel_avant_jours
        or NEW.rappel_avant_heure is distinct from OLD.rappel_avant_heure or (NEW.rappel_avant and not OLD.rappel_avant) then
    update convocation_envois set
      prevu_le = convocation_heure_rappel_avant(NEW.date_debut, NEW.rappel_avant_jours, NEW.rappel_avant_heure),
      statut = case when convocation_heure_rappel_avant(NEW.date_debut, NEW.rappel_avant_jours, NEW.rappel_avant_heure) > now() then 'programme' else 'annule' end
      where projet_id = NEW.id and sorte = 'rappel_avant'
        and (statut = 'programme' or (statut = 'annule' and NEW.rappel_avant and not OLD.rappel_avant));
  end if;
  return NEW;
end;
$$;
drop trigger if exists convocation_suivre_projet on agenda_projets;
create trigger convocation_suivre_projet after update on agenda_projets
  for each row execute function convocation_suivre_projet();

-- 5) Envois arrivés à l'heure (serveur seulement) : comme avant, et en plus un rappel n'est pas
--    envoyé à une personne qui a répondu « absent », ni plus d'une heure après son heure.
create or replace function convocations_a_traiter()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  resultat jsonb;
begin
  update convocation_envois set statut = case when tentatives >= 3 then 'echec' else 'programme' end,
      erreur = coalesce(erreur, 'Envoi interrompu.')
    where statut = 'en_cours' and coalesce(pris_le, prevu_le) < now() - interval '15 minutes';
  update convocation_envois set statut = 'annule'
    where statut = 'programme' and sorte in ('rappel', 'rappel_avant') and prevu_le < now() - interval '1 hour';
  update convocation_envois e set statut = 'annule'
    from convocation_participants cp
    where cp.id = e.participant_id and cp.reponse = 'absent'
      and e.statut = 'programme' and e.sorte in ('rappel', 'rappel_avant');
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

NOTIFY pgrst, 'reload schema';
