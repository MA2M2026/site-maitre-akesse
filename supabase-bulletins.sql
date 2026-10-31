-- =====================================================================================
-- Extension 145 — Bulletins trimestriels des mannequins (01/11/2026, chantier 14, partie 3 ; idée gardée
-- par la propriétaire le 31/10/2026)
-- =====================================================================================
-- Chaque trimestre, l'agence note chaque mannequin du registre sur 5 (marche, posture, photo, expression,
-- attitude) et écrit une appréciation ; les présences du trimestre viennent de la liste de présence
-- (supabase-presences.sql). Tant qu'un bulletin n'est pas publié, seule l'équipe le voit ; publié, la
-- mannequin le voit dans son application (et reçoit un message). Elle ne peut jamais le modifier.
-- À coller en entier dans Supabase › SQL Editor › Run. Aucune donnée existante touchée ; rejouable.

create table if not exists bulletins (
  mannequin_id uuid not null references agence_mannequins(id) on delete cascade,
  trimestre date not null check (extract(day from trimestre) = 1 and extract(month from trimestre) in (1, 4, 7, 10)),
  notes jsonb not null default '{}'::jsonb,
  appreciation text,
  publie boolean not null default false,
  saisi_par uuid references auth.users(id),
  saisi_le timestamptz not null default now(),
  primary key (mannequin_id, trimestre)
);
alter table bulletins enable row level security;
revoke all on bulletins from anon, authenticated;

-- les cinq notes, chacune de 1 à 5 (ou vide)
create or replace function bulletin_notes_valides(p jsonb)
returns boolean language sql immutable as $$
  select jsonb_typeof(p) = 'object'
    and not exists (select 1 from jsonb_each(p) e
      where e.key not in ('marche', 'posture', 'photo', 'expression', 'attitude')
         or not (e.value = 'null'::jsonb or (jsonb_typeof(e.value) = 'number' and (e.value #>> '{}')::numeric in (1, 2, 3, 4, 5))));
$$;

-- Le trimestre pour l'équipe : mannequins actives (et celles qui ont déjà un bulletin ce trimestre)
create or replace function bulletins_trimestre(p_trimestre date)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  t date := date_trunc('quarter', p_trimestre)::date;
begin
  if not presences_equipe() then raise exception 'Réservé à l''équipe de l''agence.'; end if;
  return json_build_object(
    'trimestre', t,
    'mannequins', coalesce((select json_agg(json_build_object('id', a.id, 'nom', a.full_name, 'compte', a.user_id, 'date_entree', a.date_entree,
        'parent_nom', a.parent_nom, 'mineur', a.date_naissance is not null and extract(year from age(a.date_naissance)) < 18) order by a.full_name)
      from agence_mannequins a
      where a.statut = 'actif' or exists (select 1 from bulletins b where b.mannequin_id = a.id and b.trimestre = t)), '[]'::json),
    'bulletins', coalesce((select json_agg(json_build_object('mannequin', b.mannequin_id, 'notes', b.notes, 'appreciation', b.appreciation, 'publie', b.publie, 'saisi_le', b.saisi_le))
      from bulletins b where b.trimestre = t), '[]'::json));
end;
$$;

-- Enregistrer (ou corriger) un bulletin ; p_publier : le montrer à la mannequin (message la première fois)
create or replace function bulletin_enregistrer(p_mannequin uuid, p_trimestre date, p_notes jsonb, p_appreciation text, p_publier boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  t date := date_trunc('quarter', p_trimestre)::date;
  deja boolean;
  compte uuid;
begin
  if not presences_equipe() then raise exception 'Réservé à l''équipe de l''agence.'; end if;
  if not exists (select 1 from agence_mannequins where id = p_mannequin) then raise exception 'Mannequin inconnue.'; end if;
  if t > date_trunc('quarter', current_date)::date then raise exception 'Ce trimestre n''a pas encore commencé.'; end if;
  if not bulletin_notes_valides(coalesce(p_notes, '{}'::jsonb)) then raise exception 'Notes invalides (de 1 à 5).'; end if;
  select publie into deja from bulletins where mannequin_id = p_mannequin and trimestre = t;
  insert into bulletins (mannequin_id, trimestre, notes, appreciation, publie, saisi_par)
  values (p_mannequin, t, coalesce(p_notes, '{}'::jsonb), nullif(trim(coalesce(p_appreciation, '')), ''), coalesce(p_publier, false), auth.uid())
  on conflict (mannequin_id, trimestre) do update set notes = excluded.notes, appreciation = excluded.appreciation,
    publie = excluded.publie, saisi_par = excluded.saisi_par, saisi_le = now();
  if coalesce(p_publier, false) and not coalesce(deja, false) then
    select user_id into compte from agence_mannequins where id = p_mannequin;
    if compte is not null then
      perform app_message_auto(compte, 'bulletin-' || p_mannequin || '-' || t, 'info', '📘 Votre bulletin du trimestre est arrivé',
        'Votre bulletin du trimestre est disponible : vos notes, l’appréciation de l’agence et vos présences aux cours du dimanche. ' ||
        'Retrouvez-le dans l’onglet Profil de votre application.' || E'\n\nMaître Akesse et toute l’équipe', '/app/#profil');
    end if;
  end if;
end;
$$;

-- La mannequin connectée : SES bulletins publiés seulement (lecture seule)
create or replace function mes_bulletins()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  return coalesce((select json_agg(json_build_object('trimestre', b.trimestre, 'notes', b.notes, 'appreciation', b.appreciation) order by b.trimestre desc)
    from bulletins b join agence_mannequins a on a.id = b.mannequin_id
    where a.user_id = auth.uid() and b.publie), '[]'::json);
end;
$$;

revoke execute on function bulletins_trimestre(date), bulletin_enregistrer(uuid, date, jsonb, text, boolean), mes_bulletins() from public, anon;
grant execute on function bulletins_trimestre(date), bulletin_enregistrer(uuid, date, jsonb, text, boolean), mes_bulletins() to authenticated;

NOTIFY pgrst, 'reload schema';
