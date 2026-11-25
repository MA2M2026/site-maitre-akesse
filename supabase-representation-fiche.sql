-- =====================================================================================================
-- Agence de représentation : créer la fiche et le code d espace sans paiement (25/11/2026, accord de la propriétaire)
-- =====================================================================================================
-- 1. representation_creer_fiche : depuis une candidature « simple représentation » (porte reseau) retenue, l équipe
--    crée en un clic la fiche du registre (informations recopiées de la candidature) et la relation Talent Network,
--    en attente de la signature du contrat. Une seule fiche par candidature (agence_mannequins.candidature_id).
--    Aucune formation : la fiche est notée formation faite (18 mois sur 18), donc aucune mensualité n est jamais due.
-- 2. code_espace_creer : le code d espace reste réservé aux inscriptions payées et validées (MA2M Academy),
--    SAUF pour une personne en représentation simple (relation Talent Network en attente ou active), qui ne paie rien.
-- A COLLER UNE FOIS dans Supabase (SQL Editor, bouton orange Run without RLS). Peut être recollé sans risque.

create or replace function representation_creer_fiche(p_candidature uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c casting_applications;
  v uuid;
begin
  if not exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()) or not portail_peut('site') then
    raise exception 'Réservé à l''agence.';
  end if;
  select * into c from casting_applications where id = p_candidature;
  if not found then raise exception 'Candidature introuvable.'; end if;
  if c.type_candidature is distinct from 'agence' or c.porte is distinct from 'reseau' then
    raise exception 'Seulement pour une candidature « Agence de représentation : simple représentation ».';
  end if;
  if c.status is distinct from 'retenue' then raise exception 'Retenez d''abord la candidature.'; end if;
  if c.mineur and c.parent_confirme_le is null then raise exception 'Le parent n''a pas encore confirmé la candidature.'; end if;
  -- déjà créée : on renvoie la même fiche (jamais de doublon)
  select id into v from agence_mannequins where candidature_id = c.id order by cree_le limit 1;
  if v is not null then return v; end if;
  insert into agence_mannequins (full_name, genre, date_naissance, telephone, email, parent_nom, parent_telephone, parent_email,
                                 ville, candidature_id, formation_niveaux, formation_mois_faits, parcours_arrivee, notes)
  values (trim(c.full_name),
          case when c.genre in ('femme', 'homme') then c.genre when c.civilite = 'Monsieur' then 'homme' else 'femme' end,
          c.date_naissance,
          nullif(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'), ''),
          nullif(lower(trim(coalesce(c.email, ''))), ''),
          nullif(trim(coalesce(c.parent_nom, '')), ''),
          nullif(regexp_replace(coalesce(c.parent_telephone, ''), '[^0-9]', '', 'g'), ''),
          nullif(lower(trim(coalesce(c.parent_email, ''))), ''),
          nullif(trim(coalesce(c.city, '')), ''),
          c.id, 2, 18, 'formee',
          'Agence de représentation (simple représentation) : fiche créée depuis sa candidature. Aucune formation, rien à payer.')
  returning id into v;
  insert into relations_ma2m (mannequin_id, sorte, statut, debut, fin, notes)
  values (v, 'talent_network', 'en_attente', current_date, (current_date + relation_duree('talent_network'))::date,
          'Contrat de représentation à signer')
  on conflict do nothing;
  perform journaliser('Fiche créée depuis une candidature (représentation)', 'agence_mannequins', v::text, null, null);
  return v;
end $$;
revoke all on function representation_creer_fiche(uuid) from public, anon;
grant execute on function representation_creer_fiche(uuid) to authenticated;

create or replace function code_espace_creer(p_mannequin uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  m agence_mannequins;
  nouveau text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé'; end if;
  select * into m from agence_mannequins where id = p_mannequin;
  if not found then raise exception 'Mannequin introuvable.'; end if;
  if m.user_id is not null then raise exception 'Ce mannequin a déjà son espace.'; end if;
  -- (25/11/2026) MA2M Academy : après l inscription payée et validée. Représentation simple : gratuite, sans paiement.
  if not exists (select 1 from paiements_mannequins where mannequin_id = p_mannequin and objet = 'inscription' and statut = 'valide')
     and not exists (select 1 from relations_ma2m where mannequin_id = p_mannequin and sorte = 'talent_network' and statut in ('en_attente', 'active')) then
    raise exception 'Pas d''espace mannequin sans inscription payée et validée.';
  end if;
  -- un seul code valable à la fois : l ancien est annulé
  update codes_espace set annule = true where mannequin_id = p_mannequin and utilise_le is null and not annule;
  loop
    nouveau := 'ESP-';
    for i in 1..6 loop
      nouveau := nouveau || substr(alphabet, 1 + get_byte(gen_random_bytes(1), 0) % 32, 1);
    end loop;
    exit when not exists (select 1 from codes_espace where code = nouveau);
  end loop;
  insert into codes_espace (code, mannequin_id, cree_par) values (nouveau, p_mannequin, auth.uid());
  perform journaliser('Code de l''espace mannequin créé', 'agence_mannequins', p_mannequin::text, null, null);
  return nouveau;
end;
$$;
revoke all on function code_espace_creer(uuid) from public, anon;
grant execute on function code_espace_creer(uuid) to authenticated;

select 'Agence de représentation : fiche et code d espace sans paiement installés' as resultat;
