-- =====================================================================================
-- Extension 147 — Documents des mannequins qui expirent (01/11/2026, chantier 14, partie 3 ; idée gardée
-- par la propriétaire le 31/10/2026)
-- =====================================================================================
-- L'agence note, pour chaque mannequin du registre, ses documents (autorisation parentale, pièce d'identité,
-- contrat, autre) et leur date de fin. L'Administration les trie par urgence ; chaque matin, le serveur du site
-- (api/portail.js) envoie à l'agence un e-mail pour les documents qui expirent dans 30 jours, puis le jour où
-- ils expirent — une seule fois chacun. Seule l'équipe lit et écrit ; aucune donnée existante touchée.
-- À coller en entier dans Supabase › SQL Editor › Run. Rejouable.

create table if not exists documents_mannequins (
  id uuid primary key default gen_random_uuid(),
  mannequin_id uuid not null references agence_mannequins(id) on delete cascade,
  sorte text not null check (sorte in ('autorisation_parentale', 'piece_identite', 'contrat', 'autre')),
  libelle text,
  expire_le date not null,
  note text,
  alerte30_le timestamptz,
  alerte_fin_le timestamptz,
  cree_par uuid references auth.users(id),
  cree_le timestamptz not null default now()
);
create index if not exists documents_mannequins_expire on documents_mannequins (expire_le);
alter table documents_mannequins enable row level security;
revoke all on documents_mannequins from anon, authenticated;

-- La liste pour l'équipe : tous les documents (avec le nom), et les mannequins actives (pour en ajouter)
-- (presences_equipe : supabase-presences.sql)
create or replace function documents_liste()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not presences_equipe() then raise exception 'Réservé à l''équipe de l''agence.'; end if;
  return json_build_object(
    'documents', coalesce((select json_agg(json_build_object('id', d.id, 'mannequin', d.mannequin_id, 'nom', a.full_name, 'compte', a.user_id,
        'sorte', d.sorte, 'libelle', d.libelle, 'expire_le', d.expire_le, 'note', d.note) order by d.expire_le, a.full_name)
      from documents_mannequins d join agence_mannequins a on a.id = d.mannequin_id), '[]'::json),
    'mannequins', coalesce((select json_agg(json_build_object('id', a.id, 'nom', a.full_name) order by a.full_name)
      from agence_mannequins a where a.statut = 'actif'), '[]'::json));
end;
$$;

-- Ajouter (p_id null) ou corriger un document ; une nouvelle date de fin relance les alertes
create or replace function document_enregistrer(p_id uuid, p_mannequin uuid, p_sorte text, p_libelle text, p_expire_le date, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  n uuid;
begin
  if not presences_equipe() then raise exception 'Réservé à l''équipe de l''agence.'; end if;
  if p_expire_le is null then raise exception 'La date de fin est obligatoire.'; end if;
  if not exists (select 1 from agence_mannequins where id = p_mannequin) then raise exception 'Mannequin inconnue.'; end if;
  if p_id is null then
    insert into documents_mannequins (mannequin_id, sorte, libelle, expire_le, note, cree_par)
    values (p_mannequin, p_sorte, nullif(trim(coalesce(p_libelle, '')), ''), p_expire_le, nullif(trim(coalesce(p_note, '')), ''), auth.uid())
    returning id into n;
  else
    update documents_mannequins set mannequin_id = p_mannequin, sorte = p_sorte, libelle = nullif(trim(coalesce(p_libelle, '')), ''),
      note = nullif(trim(coalesce(p_note, '')), ''),
      alerte30_le = case when expire_le = p_expire_le then alerte30_le end,
      alerte_fin_le = case when expire_le = p_expire_le then alerte_fin_le end,
      expire_le = p_expire_le
    where id = p_id returning id into n;
    if n is null then raise exception 'Document introuvable.'; end if;
  end if;
  return n;
end;
$$;

create or replace function document_supprimer(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not presences_equipe() then raise exception 'Réservé à l''équipe de l''agence.'; end if;
  delete from documents_mannequins where id = p_id;
end;
$$;

-- Le matin (serveur seulement) : les alertes du jour, notées aussitôt (une seule fois chacune) :
-- « bientot » 30 jours avant la fin, « expire » le jour de la fin (ou après, si l'alerte n'est pas encore partie)
create or replace function documents_alertes_du_jour()
returns json language plpgsql security definer set search_path = public as $$
declare
  r json;
begin
  with dues as (
    select d.id, case when d.expire_le <= current_date then 'expire' else 'bientot' end as quoi
    from documents_mannequins d
    where (d.expire_le <= current_date and d.alerte_fin_le is null)
       or (d.expire_le > current_date and d.expire_le <= current_date + 30 and d.alerte30_le is null)
  ), notees as (
    update documents_mannequins d set alerte_fin_le = case when x.quoi = 'expire' then now() else d.alerte_fin_le end,
      alerte30_le = case when x.quoi = 'bientot' then now() else coalesce(d.alerte30_le, now()) end
    from dues x where x.id = d.id
    returning d.id, x.quoi, d.mannequin_id, d.sorte, d.libelle, d.expire_le
  )
  select coalesce(json_agg(json_build_object('quoi', n.quoi, 'nom', a.full_name, 'sorte', n.sorte, 'libelle', n.libelle, 'expire_le', n.expire_le)
    order by n.expire_le), '[]'::json) into r
  from notees n join agence_mannequins a on a.id = n.mannequin_id;
  return r;
end;
$$;

revoke execute on function documents_liste(), document_enregistrer(uuid, uuid, text, text, date, text), document_supprimer(uuid), documents_alertes_du_jour() from public, anon, authenticated;
grant execute on function documents_liste(), document_enregistrer(uuid, uuid, text, text, date, text), document_supprimer(uuid) to authenticated;
grant execute on function documents_alertes_du_jour() to service_role;

NOTIFY pgrst, 'reload schema';
