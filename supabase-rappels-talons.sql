-- =====================================================================================================
-- Cours de talons : notification sur le téléphone de l'agence la VEILLE de chaque cours (24 h avant), maquette
-- validée par la propriétaire le 15/11/2026 (maquettes/planning-talons.html). Rejouable.
-- Toutes les heures, cours_talons_rappels_preparer() note les cours qui commencent dans les 24 h (rattrape une heure
-- manquée et un cours fixé moins de 24 h avant ; jamais deux fois grâce à la clé) : le cours en
-- groupe en UNE ligne (nombre d'élèves), chaque cours privé en une ligne. Chaque nouvelle ligne déclenche la
-- notification par le même chemin que les inscriptions (notifier_push_notification, Extension 107 : aucun secret à
-- remplir), réglage « evenement_rappel_talons ». Jamais deux fois le même cours (clé unique).
-- Seulement les séances qui comptent (occupe : jamais une inscription annulée, ni une réservation de 48 h expirée),
-- pas faites, d'une inscription en cours. Rien n'est envoyé aux élèves : l'agence envoie le rappel WhatsApp depuis
-- le planning (Administration → Cours de talons → Planning). Abidjan est à l'heure UTC.
-- Nécessite supabase-creneaux-prives.sql (fonction occupe).
-- =====================================================================================================

create table if not exists cours_talons_rappels (
  cle text primary key,              -- « g:<début> » (groupe) ou « p:<séance>:<début> » (privé : une séance déplacée a un nouveau rappel)
  debut timestamptz not null,
  fin timestamptz not null,
  formule text not null,
  nom text,                          -- privé : « Mme Koné » ; groupe : vide
  nb int not null default 1,         -- groupe : nombre d'élèves
  lieu text,
  theme text,
  cree_le timestamptz not null default now()
);
alter table cours_talons_rappels enable row level security;
revoke all on cours_talons_rappels from anon, authenticated;   -- (aucune lecture directe : seulement la base)

create or replace function cours_talons_rappels_preparer() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  delete from cours_talons_rappels where debut < now() - interval '30 days';
  with prochaines as (
    select s.*, c.formule, c.nom as nom_eleve,
      case coalesce(c.civilite, case when c.age < 18 then 'mademoiselle' end) when 'mademoiselle' then 'Mlle' else 'Mme' end as civ,
      date_trunc('minute', s.debut) as minute
    from cours_talons_seances s join cours_talons c on c.id = s.inscription_id
    where s.debut > now() and s.debut <= now() + interval '24 hours'
      and not s.faite and c.statut not in ('annulee', 'terminee') and occupe(s)
      -- (groupe payé mois par mois : jamais un dimanche d'un mois pas encore réglé, comme le planning)
      and (c.formule <> 'groupe' or coalesce(s.mois, 0) <= coalesce(c.mois_payes, 0))),
  lignes as (
    select 'g:' || to_char(minute at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI') as cle, minute as debut, max(fin) as fin, 'groupe' as formule, null::text as nom,
      count(*)::int as nb, min(lieu) as lieu, min(theme) as theme
    from prochaines where formule = 'groupe' group by minute
    union all
    select 'p:' || id || ':' || to_char(debut at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI'), debut, fin, formule, civ || ' ' || coalesce(nullif(trim(nom_eleve), ''), 'une élève'), 1, lieu, theme
    from prochaines where formule <> 'groupe')
  insert into cours_talons_rappels (cle, debut, fin, formule, nom, nb, lieu, theme)
    select cle, debut, fin, formule, nom, nb, lieu, theme from lignes
  on conflict (cle) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function cours_talons_rappels_preparer() from public, anon, authenticated;

-- chaque rappel noté part en notification (même chemin que les inscriptions au cours de talons)
drop trigger if exists trg_notif_cours_talons_rappels on cours_talons_rappels;
create trigger trg_notif_cours_talons_rappels after insert on cours_talons_rappels
  for each row execute function notifier_push_notification();

insert into notifications_reglages (cle, actif) values ('evenement_rappel_talons', true) on conflict (cle) do nothing;

-- toutes les heures, à l'heure pile
create extension if not exists pg_cron;
select cron.unschedule('talons-rappels-veille') where exists (select 1 from cron.job where jobname = 'talons-rappels-veille');
select cron.schedule('talons-rappels-veille', '0 * * * *', $$select cours_talons_rappels_preparer();$$);

NOTIFY pgrst, 'reload schema';

-- Contrôle (à lire après « Run ») : 4 éléments attendus
select 'Rappels de la veille installés : ' || (
  (select count(*) from information_schema.tables where table_name = 'cours_talons_rappels') +
  (select count(*) from pg_proc where proname = 'cours_talons_rappels_preparer') +
  (select count(*) from pg_trigger where tgname = 'trg_notif_cours_talons_rappels') +
  (select count(*) from cron.job where jobname = 'talons-rappels-veille')) || ' éléments sur 4' as controle;
