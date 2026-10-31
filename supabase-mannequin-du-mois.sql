-- =====================================================================================
-- Extension 144 — Mannequin du mois (01/11/2026, chantier 14, partie 3 ; idée gardée par la
-- propriétaire le 31/10/2026 : « choisie à partir de l'assiduité »)
-- =====================================================================================
-- L'agence choisit, pour le mois en cours, la mannequin du mois (l'écran « Liste de présence » lui propose
-- celles qui ont suivi tous les cours du mois précédent). La mannequin reçoit un message de félicitations
-- dans son application ; le site et l'application la mettent en avant pendant tout le mois. Le public ne
-- voit que le mois, le nom affiché sur le site et l'adresse de sa fiche (si elle est publiée au Book).
-- À coller en entier dans Supabase › SQL Editor › Run. Aucune donnée existante touchée ; rejouable.

create table if not exists mannequin_du_mois (
  mois date primary key check (extract(day from mois) = 1),
  mannequin_id uuid not null references agence_mannequins(id) on delete cascade,
  mot text,
  choisi_par uuid references auth.users(id),
  choisi_le timestamptz not null default now()
);
alter table mannequin_du_mois enable row level security;
revoke all on mannequin_du_mois from anon, authenticated;

-- L'équipe choisit (ou change) la mannequin du mois ; la mannequin choisie reçoit son message (une fois
-- par mois). presences_equipe : supabase-presences.sql.
create or replace function mannequin_du_mois_choisir(p_mois date, p_mannequin uuid, p_mot text)
returns void language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_mois)::date;
  compte uuid;
begin
  if not presences_equipe() then raise exception 'Réservé à l''équipe de l''agence.'; end if;
  if not exists (select 1 from agence_mannequins where id = p_mannequin and statut = 'actif') then raise exception 'Mannequin inconnue ou pas active.'; end if;
  if m < date_trunc('month', current_date)::date then raise exception 'On ne change pas un mois passé.'; end if;
  insert into mannequin_du_mois (mois, mannequin_id, mot, choisi_par) values (m, p_mannequin, nullif(trim(coalesce(p_mot, '')), ''), auth.uid())
  on conflict (mois) do update set mannequin_id = excluded.mannequin_id, mot = excluded.mot, choisi_par = excluded.choisi_par, choisi_le = now();
  select user_id into compte from agence_mannequins where id = p_mannequin;
  if compte is not null then
    perform app_message_auto(compte, 'mannequin-du-mois-' || m || '-' || p_mannequin, 'info', '🏆 Vous êtes la mannequin du mois !',
      'Félicitations ! Pour votre assiduité et votre travail, l’agence vous a choisie comme mannequin du mois. ' ||
      'Vous êtes mise à l’honneur sur le site et dans l’application tout le mois. Continuez comme ça, nous sommes fiers de vous !' ||
      coalesce(E'\n\n« ' || nullif(trim(coalesce(p_mot, '')), '') || ' »', '') || E'\n\nMaître Akesse et toute l’équipe', '/app/');
  end if;
end;
$$;

-- Pour tout le monde (site, application) : la mannequin du mois en cours, SEULEMENT si sa fiche est
-- publiée au Book (sinon null : son nom n'est jamais montré au public ; elle a quand même son message)
create or replace function mannequin_du_mois_actuelle()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('mois', d.mois, 'nom', p.full_name, 'compte', p.id, 'slug', p.slug, 'mot', d.mot)
  from mannequin_du_mois d join agence_mannequins a on a.id = d.mannequin_id
  join model_profiles p on p.id = a.user_id and p.published
  where d.mois = date_trunc('month', current_date)::date;
$$;

-- Pour l'équipe : l'historique (les 12 derniers mois)
create or replace function mannequins_du_mois_historique()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not presences_equipe() then raise exception 'Réservé à l''équipe de l''agence.'; end if;
  return coalesce((select json_agg(json_build_object('mois', d.mois, 'mannequin', d.mannequin_id, 'nom', a.full_name, 'mot', d.mot) order by d.mois desc)
    from mannequin_du_mois d join agence_mannequins a on a.id = d.mannequin_id
    where d.mois >= date_trunc('month', current_date)::date - interval '11 months'), '[]'::json);
end;
$$;

revoke execute on function mannequin_du_mois_choisir(date, uuid, text), mannequin_du_mois_actuelle(), mannequins_du_mois_historique() from public, anon, authenticated;
grant execute on function mannequin_du_mois_choisir(date, uuid, text), mannequins_du_mois_historique() to authenticated;
grant execute on function mannequin_du_mois_actuelle() to anon, authenticated;

NOTIFY pgrst, 'reload schema';
