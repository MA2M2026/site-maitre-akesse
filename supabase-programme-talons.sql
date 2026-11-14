-- =====================================================================================
-- Extension 161 — « Mon programme » de l'Atelier Talons & Élégance (maquette validée par la propriétaire le 14/11/2026)
-- =====================================================================================
-- Chaque élève inscrite (paiement validé) reçoit sur WhatsApp un lien personnel vers SA page « Mon programme »
-- (programme-talons.html?c=jeton, sans compte) : ses séances, le calendrier, le lieu, « Ajouter à mon calendrier ».
--  - cours_talons.jeton : le jeton du lien (36 caractères, comme les convocations) ;
--  - cours_talons_seances : les séances de chaque élève (l'équipe du site les ajoute, les change, les coche) ;
--  - formule en groupe : à la validation du paiement, les 4 dimanches (15 h – 18 h) sont remplis tout seuls, à partir
--    de la date de première séance notée par l'agence si elle est à venir, sinon du prochain dimanche ;
--  - programme_talons_lire(jeton) : ce que la page de l'élève peut lire (rien sans le bon jeton, rien avant le
--    paiement validé, ni téléphone ni photos).
-- Ajout seulement : aucune donnée existante n'est modifiée. Après supabase-cours-talons.sql.
-- À coller dans Supabase › SQL Editor › Run ; rejouable.

alter table cours_talons add column if not exists jeton text not null default encode(extensions.gen_random_bytes(18), 'hex');
create unique index if not exists cours_talons_jeton on cours_talons (jeton);

create table if not exists cours_talons_seances (
  id uuid primary key default gen_random_uuid(),
  inscription_id uuid not null references cours_talons(id) on delete cascade,
  debut timestamptz not null,
  fin timestamptz not null,
  lieu text check (lieu is null or length(lieu) <= 200),
  theme text check (theme is null or length(theme) <= 120),
  faite boolean not null default false,
  cree_le timestamptz not null default now(),
  check (fin > debut and fin <= debut + interval '8 hours')
);
-- le jeton est toujours tiré par la base : un visiteur ne peut pas choisir le sien (le formulaire public envoie la ligne)
create or replace function cours_talons_jeton_force() returns trigger language plpgsql set search_path = public as $$
begin
  new.jeton := encode(extensions.gen_random_bytes(18), 'hex');
  return new;
end;
$$;
drop trigger if exists cours_talons_jeton_force on cours_talons;
create trigger cours_talons_jeton_force before insert on cours_talons for each row execute function cours_talons_jeton_force();

create index if not exists cours_talons_seances_inscription on cours_talons_seances (inscription_id, debut);

alter table cours_talons_seances enable row level security;
revoke all on cours_talons_seances from anon, authenticated;
grant select, insert, update, delete on cours_talons_seances to authenticated;
drop policy if exists "Séances de talons : l'équipe du site" on cours_talons_seances;
create policy "Séances de talons : l'équipe du site" on cours_talons_seances for all
  using (portail_peut('site')) with check (portail_peut('site'));

-- Groupe : les 4 dimanches remplis tout seuls quand l'inscription devient « inscrite » (une seule fois : rien
-- n'est ajouté si l'élève a déjà des séances). Abidjan est à l'heure UTC toute l'année.
create or replace function cours_talons_remplir_groupe() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  depart date;
  themes text[] := array['Posture et équilibre', 'Démarche et port de tête', 'Fluidité et tours', 'Le défilé final'];
begin
  if new.formule <> 'groupe' or new.statut <> 'inscrite' or old.statut = 'inscrite' then return new; end if;
  if exists (select 1 from cours_talons_seances where inscription_id = new.id) then return new; end if;
  -- le premier dimanche à partir de la date notée par l'agence (si elle est à venir), sinon à partir de demain :
  -- jamais un autre jour que le dimanche, jamais une séance déjà commencée
  depart := greatest(coalesce(new.date_seance, current_date + 1), current_date + 1);
  depart := depart + ((7 - extract(dow from depart)::int) % 7);
  insert into cours_talons_seances (inscription_id, debut, fin, lieu, theme)
  select new.id, ((depart + 7 * i) + time '15:00') at time zone 'Africa/Abidjan',
    ((depart + 7 * i) + time '18:00') at time zone 'Africa/Abidjan', 'Salle MA2M, Riviera Faya', themes[i + 1]
  from generate_series(0, 3) i;
  return new;
end;
$$;
revoke all on function cours_talons_remplir_groupe() from public, anon, authenticated;
drop trigger if exists cours_talons_remplir_groupe on cours_talons;
create trigger cours_talons_remplir_groupe after update of statut on cours_talons
  for each row execute function cours_talons_remplir_groupe();

-- Page « Mon programme » : seulement avec le bon jeton, seulement une fois le paiement validé.
create or replace function programme_talons_lire(p_jeton text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nom', c.nom,
    'civilite', case when c.age is not null and c.age < 18 then 'Mademoiselle' else 'Madame' end,
    'formule', c.formule, 'nb_seances', c.nb_seances, 'statut', c.statut,
    'numero', 'TAL-' || upper(left(replace(c.id::text, '-', ''), 6)),
    'seances', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'debut', s.debut, 'fin', s.fin, 'lieu', s.lieu, 'theme', s.theme, 'faite', s.faite) order by s.debut)
      from cours_talons_seances s where s.inscription_id = c.id), '[]'::jsonb))
  from cours_talons c
  where length(coalesce(p_jeton, '')) = 36 and c.jeton = p_jeton and c.statut in ('inscrite', 'terminee');
$$;
revoke all on function programme_talons_lire(text) from public;
grant execute on function programme_talons_lire(text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';

select 'Mon programme (talons) installé : ' ||
  ((select count(*) from information_schema.columns where table_name = 'cours_talons' and column_name = 'jeton')
   + (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'cours_talons_seances')
   + (select count(*) from pg_trigger where tgname = 'cours_talons_remplir_groupe')
   + (select count(*) from pg_proc where proname = 'programme_talons_lire')) || ' éléments sur 4' as controle;
