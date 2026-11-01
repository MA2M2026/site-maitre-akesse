-- =====================================================================================
-- Extension 150 — « Créer mon compte » pour l'équipe de l'Administration (01/11/2026, décision de la
-- propriétaire : comme les vraies applications, la personne crée elle-même son compte ; la propriétaire
-- est prévenue et accepte ou refuse). Remplace l'invitation par e-mail, qui ne partait pas.
-- =====================================================================================
-- Le serveur du site (api/portail.js, action « demande_acces ») crée le compte (e-mail + mot de passe) et
-- note la demande ici ; tant que l'administratrice principale ne l'a pas acceptée, la personne n'a AUCUN
-- accès (pas de ligne dans staff_profiles : portail_role() est vide, toutes les règles de la base refusent).
-- Accepter = choisir le rôle ; la double authentification reste obligatoire à la première connexion.
-- À coller en entier dans Supabase › SQL Editor › Run. Aucune donnée existante modifiée ; rejouable.

create table if not exists staff_demandes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nom text not null,
  email text not null,
  telephone text,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'acceptee', 'refusee')),
  cree_le timestamptz not null default now(),
  decide_le timestamptz,
  decide_par uuid references auth.users(id)
);
alter table staff_demandes enable row level security;
revoke all on staff_demandes from anon, authenticated;

-- Pour l'administratrice principale : les demandes en attente (et les 20 dernières décidées)
create or replace function portail_demandes_liste()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not portail_est_principal() then raise exception 'Réservé à l''administrateur principal.'; end if;
  return coalesce((select json_agg(x order by x.cree_le desc) from (
    (select id, nom, email, telephone, statut, cree_le, decide_le from staff_demandes where statut = 'en_attente')
    union all
    (select id, nom, email, telephone, statut, cree_le, decide_le from staff_demandes where statut <> 'en_attente' order by decide_le desc limit 20)) x), '[]'::json);
end;
$$;

-- Accepter : la personne reçoit son rôle (code de l'application saisi il y a moins de 10 minutes)
create or replace function portail_demande_accepter(p_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  d staff_demandes;
begin
  if not portail_est_principal() then raise exception 'Réservé à l''administrateur principal.'; end if;
  perform portail_exiger_auth_recente();
  if p_role not in ('site', 'caisse', 'compta') then raise exception 'Rôle inconnu.'; end if;
  select * into d from staff_demandes where id = p_id and statut = 'en_attente' for update;
  if not found then raise exception 'Demande introuvable ou déjà traitée.'; end if;
  insert into staff_profiles (user_id, nom, email, role, actif, cree_par)
  values (d.user_id, d.nom, d.email, p_role, true, auth.uid())
  on conflict (user_id) do update set role = excluded.role, actif = true, nom = excluded.nom;
  update staff_demandes set statut = 'acceptee', decide_le = now(), decide_par = auth.uid() where id = p_id;
  perform journaliser('Demande d''accès acceptée', 'staff_demandes', p_id::text, null, json_build_object('email', d.email, 'role', p_role)::jsonb);
end;
$$;

-- Refuser : la personne n'a toujours aucun accès (son compte ne sert à rien)
create or replace function portail_demande_refuser(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not portail_est_principal() then raise exception 'Réservé à l''administrateur principal.'; end if;
  update staff_demandes set statut = 'refusee', decide_le = now(), decide_par = auth.uid() where id = p_id and statut = 'en_attente';
  if not found then raise exception 'Demande introuvable ou déjà traitée.'; end if;
  perform journaliser('Demande d''accès refusée', 'staff_demandes', p_id::text, null, null);
end;
$$;

revoke execute on function portail_demandes_liste(), portail_demande_accepter(uuid, text), portail_demande_refuser(uuid) from public, anon;
grant execute on function portail_demandes_liste(), portail_demande_accepter(uuid, text), portail_demande_refuser(uuid) to authenticated;

NOTIFY pgrst, 'reload schema';
