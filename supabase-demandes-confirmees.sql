-- ════════════════════════════════════════════════════════════════════════════════════════════════════════
-- « Créer mon compte » de l'équipe : adresse e-mail confirmée d'abord (audit du 16/11/2026, chantier L-6 = R-01)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Décision de la propriétaire (16/11, 01 h 20) : le compte ne sert à rien tant que la personne n'a pas cliqué le
-- lien de confirmation reçu par e-mail. Le serveur (api/portail.js, demande_acces) crée maintenant le compte NON
-- confirmé et envoie le lien ; ici :
--   • la demande n'apparaît dans Sécurité › Comptes et rôles qu'une fois l'adresse confirmée ;
--   • accepter une demande dont l'adresse n'est pas confirmée est refusé.
-- (Les demandes faites avant ce changement avaient un compte déjà confirmé : elles restent visibles.)
-- À coller une fois dans Supabase (SQL Editor), après supabase-demandes-acces.sql. Contrôle : « 2 éléments sur 2 ».

create or replace function portail_demandes_liste()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not portail_est_principal() then raise exception 'Réservé à l''administrateur principal.'; end if;
  return coalesce((select json_agg(x order by x.cree_le desc) from (
    -- (L-6) seulement les demandes dont l'adresse est confirmée (lien de l'e-mail cliqué)
    (select id, nom, email, telephone, statut, cree_le, decide_le from staff_demandes d where statut = 'en_attente'
       and exists (select 1 from auth.users u where u.id = d.user_id and u.email_confirmed_at is not null))
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
  -- (L-6) jamais de rôle à une adresse que personne n'a prouvé posséder
  if not exists (select 1 from auth.users u where u.id = d.user_id and u.email_confirmed_at is not null) then
    raise exception 'Adresse e-mail pas encore confirmée : la personne doit d''abord cliquer le lien reçu par e-mail.';
  end if;
  insert into staff_profiles (user_id, nom, email, role, actif, cree_par)
  values (d.user_id, d.nom, d.email, p_role, true, auth.uid())
  on conflict (user_id) do update set role = excluded.role, actif = true, nom = excluded.nom;
  update staff_demandes set statut = 'acceptee', decide_le = now(), decide_par = auth.uid() where id = p_id;
  perform journaliser('Demande d''accès acceptée', 'staff_demandes', p_id::text, null, json_build_object('email', d.email, 'role', p_role)::jsonb);
end;
$$;

revoke execute on function portail_demandes_liste(), portail_demande_accepter(uuid, text) from public, anon;
grant execute on function portail_demandes_liste(), portail_demande_accepter(uuid, text) to authenticated;

NOTIFY pgrst, 'reload schema';

-- Contrôle (à lire après « Run ») : 2 éléments attendus
select 'Demandes confirmées installées : ' || (select count(*) from pg_proc where proname in ('portail_demandes_liste', 'portail_demande_accepter') and prosrc like '%(L-6)%') || ' éléments sur 2' as controle;
