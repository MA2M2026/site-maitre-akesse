-- =====================================================================================
-- Extension 146 — Mensurations suivies dans le temps (01/11/2026, chantier 14, partie 3 ; idée gardée par
-- la propriétaire le 31/10/2026 : le Book et la compcard toujours justes)
-- =====================================================================================
-- À chaque changement des mensurations d'une mannequin (taille, poids, poitrine, tour de taille, hanches,
-- entrejambe, pointure), la base garde un relevé daté. L'Administration montre l'historique dans la fiche de
-- la mannequin et signale des mensurations vieilles de plus de 3 mois. Le déclencheur ne peut JAMAIS
-- empêcher d'enregistrer une fiche : au moindre souci, le relevé est simplement sauté.
-- À coller en entier dans Supabase › SQL Editor › Run. Aucune donnée existante modifiée ; rejouable.

create table if not exists mensurations_historique (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references model_profiles(id) on delete cascade,
  releve_le timestamptz not null default now(),
  valeurs jsonb not null,
  origine text not null default 'modification' check (origine in ('modification', 'installation'))
);
create index if not exists mensurations_historique_model on mensurations_historique (model_id, releve_le desc);
alter table mensurations_historique enable row level security;
revoke all on mensurations_historique from anon, authenticated;

create or replace function mensurations_valeurs(p model_profiles)
returns jsonb language sql immutable as $$
  select jsonb_build_object('height_cm', p.height_cm, 'weight_kg', p.weight_kg, 'chest_cm', p.chest_cm, 'waist_cm', p.waist_cm,
    'hips_cm', p.hips_cm, 'inseam_cm', p.inseam_cm, 'shoe_size', p.shoe_size);
$$;

-- relevé daté quand une mensuration change (jamais d'erreur : la fiche s'enregistre toujours)
create or replace function mensurations_suivre()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if mensurations_valeurs(new) is distinct from mensurations_valeurs(old) then
    insert into mensurations_historique (model_id, valeurs) values (new.id, mensurations_valeurs(new));
  end if;
  return null;
exception when others then
  raise warning 'mensurations_suivre % : %', new.id, sqlerrm;
  return null;
end;
$$;
drop trigger if exists trg_mensurations_suivre on model_profiles;
create trigger trg_mensurations_suivre after update on model_profiles
  for each row execute function mensurations_suivre();

-- point de départ : un relevé pour chaque fiche qui a déjà des mensurations (une seule fois)
insert into mensurations_historique (model_id, valeurs, origine)
select p.id, mensurations_valeurs(p), 'installation' from model_profiles p
where (p.height_cm is not null or p.chest_cm is not null or p.waist_cm is not null or p.hips_cm is not null)
  and not exists (select 1 from mensurations_historique h where h.model_id = p.id);

-- l'historique d'une mannequin, pour l'équipe (presences_equipe : supabase-presences.sql)
create or replace function mensurations_historique_lire(p_model uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not presences_equipe() then raise exception 'Réservé à l''équipe de l''agence.'; end if;
  return coalesce((select json_agg(json_build_object('releve_le', h.releve_le, 'valeurs', h.valeurs, 'origine', h.origine) order by h.releve_le desc)
    from mensurations_historique h where h.model_id = p_model), '[]'::json);
end;
$$;
revoke execute on function mensurations_historique_lire(uuid), mensurations_suivre(), mensurations_valeurs(model_profiles) from public, anon;
grant execute on function mensurations_historique_lire(uuid) to authenticated;

NOTIFY pgrst, 'reload schema';
