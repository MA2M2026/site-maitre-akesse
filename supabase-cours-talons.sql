-- =====================================================================================
-- Extension 160 — Cours de talons (Atelier Talons & Élégance), décisions de la propriétaire du 08/11/2026
-- =====================================================================================
-- Une page publique pour les personnes qui veulent seulement apprendre à marcher en talons (concours de Miss
-- ou de beauté, élégance, prestance), SANS intégrer l'agence. Deux formules : en groupe (chaque dimanche de
-- 15 h à 18 h, 30 000 FCFA les 4 séances) ou privé (séance de 2 h : 25 000 FCFA en salle à Riviera Faya,
-- 30 000 à 35 000 FCFA ailleurs). La personne envoie 2 ou 3 photos et une vidéo de sa marche (seulement pour
-- évaluer son niveau), puis paie par Wave maintenant ou plus tard.
-- Les visiteurs n'écrivent JAMAIS directement dans la table : l'inscription passe par le serveur du site
-- (api/portail.js, action « formulaire », anti-robots Turnstile) → formulaire_public_enregistrer (étendue
-- ici). L'équipe du site lit et suit les demandes ; la validation d'un paiement ajoute la recette en Compta.
-- Ajout seulement : aucune donnée existante n'est modifiée. À coller dans Supabase › SQL Editor › Run ; rejouable.

create table if not exists cours_talons (
  id uuid primary key default gen_random_uuid(),
  cree_le timestamptz not null default now(),
  formule text not null check (formule in ('groupe', 'prive_salle', 'prive_exterieur')),
  nom text not null check (length(trim(nom)) between 2 and 120),
  telephone text not null check (length(telephone) between 6 and 30),
  age int check (age between 8 and 90),
  quartier text check (quartier is null or length(quartier) <= 120),
  objectif text check (objectif is null or objectif in ('miss', 'beaute', 'elegance', 'evenement', 'autre')),
  concours text check (concours is null or length(concours) <= 160),
  concours_date date,
  niveau text check (niveau is null or niveau in ('debutante', 'un_peu', 'a_l_aise')),
  disponibilites text check (disponibilites is null or length(disponibilites) <= 600),
  adresse text check (adresse is null or length(adresse) <= 300),
  parent_nom text check (parent_nom is null or length(parent_nom) <= 120),
  parent_telephone text check (parent_telephone is null or length(parent_telephone) <= 30),
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 5),
  video text check (video is null or length(video) <= 600),
  decision text not null default 'plus_tard' check (decision in ('maintenant', 'plus_tard')),
  reference_wave text check (reference_wave is null or length(reference_wave) <= 120),
  statut text not null default 'nouvelle' check (statut in ('nouvelle', 'plus_tard', 'paiement_envoye', 'inscrite', 'terminee', 'annulee')),
  montant int check (montant is null or montant between 0 and 1000000),
  date_seance date,
  notes text check (notes is null or length(notes) <= 2000),
  valide_le timestamptz,
  valide_par uuid references auth.users(id) on delete set null,
  ecriture_id uuid references compta_ecritures(id) on delete set null,
  check (age is null or age >= 18 or parent_telephone is not null)
);
create index if not exists cours_talons_statut on cours_talons (statut, cree_le desc);

alter table cours_talons enable row level security;
revoke all on cours_talons from anon, authenticated;
grant select on cours_talons to authenticated;
grant update (statut, montant, date_seance, notes) on cours_talons to authenticated;
drop policy if exists "Cours de talons : l'équipe du site lit" on cours_talons;
create policy "Cours de talons : l'équipe du site lit" on cours_talons for select using (portail_peut('site'));
drop policy if exists "Cours de talons : l'équipe du site suit" on cours_talons;
create policy "Cours de talons : l'équipe du site suit" on cours_talons for update using (portail_peut('site')) with check (portail_peut('site'));

-- Montant d'une formule (le privé à l'extérieur part de 30 000 ; l'agence l'ajuste jusqu'à 35 000 selon le lieu)
create or replace function cours_talons_montant(p_formule text)
returns int language sql immutable as $$
  select case p_formule when 'groupe' then 30000 when 'prive_salle' then 25000 when 'prive_exterieur' then 30000 end;
$$;

-- Enregistrement des formulaires publics (supabase-anti-robots.sql), avec les cours de talons en plus.
-- SEULEMENT par le serveur du site (clé service_role), après l'anti-robots. Mêmes règles qu'avant pour les
-- trois autres formulaires.
create or replace function formulaire_public_enregistrer(p_table text, p_ligne jsonb, p_ip text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  colonnes text;
  nouvel_id uuid;
  ligne jsonb := p_ligne;
begin
  if p_table not in ('casting_applications', 'messages_contact', 'recruiter_requests', 'cours_talons') then raise exception 'Formulaire inconnu.'; end if;
  if jsonb_typeof(ligne) <> 'object' then raise exception 'Formulaire invalide.'; end if;
  if p_table = 'casting_applications' then
    if coalesce(ligne->>'status', 'nouvelle') <> 'nouvelle' then raise exception 'Formulaire invalide.'; end if;
    if ligne->>'type_candidature' = 'projet' and not casting_ouvert() then raise exception 'Aucun casting ouvert.'; end if;
    if not limiter_soumissions_publiques_ip_de('candidature', 60, 6, p_ip) then raise exception 'LIMITE_ATTEINTE'; end if;
  elsif p_table = 'recruiter_requests' then
    if coalesce(ligne->>'status', 'nouvelle') <> 'nouvelle' then raise exception 'Formulaire invalide.'; end if;
    if not limiter_soumissions_publiques_ip_de('recruteur', 30, 3, p_ip) then raise exception 'LIMITE_ATTEINTE'; end if;
  elsif p_table = 'cours_talons' then
    -- le visiteur choisit seulement : payer maintenant (paiement envoyé, à valider) ou plus tard ; le reste est
    -- décidé par l'agence (montant, date, validation)
    ligne := ligne - array['id', 'cree_le', 'statut', 'montant', 'date_seance', 'notes', 'valide_le', 'valide_par', 'ecriture_id'];
    ligne := ligne || jsonb_build_object(
      'statut', case when ligne->>'decision' = 'maintenant' then 'paiement_envoye' else 'plus_tard' end,
      'montant', cours_talons_montant(ligne->>'formule'));
    if not limiter_soumissions_publiques_ip_de('cours_talons', 30, 3, p_ip) then raise exception 'LIMITE_ATTEINTE'; end if;
  else
    if not limiter_soumissions_publiques_ip_de('contact', 30, 3, p_ip) then raise exception 'LIMITE_ATTEINTE'; end if;
  end if;
  select string_agg(quote_ident(c.column_name), ', ') into colonnes
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = p_table and ligne ? c.column_name;
  if colonnes is null then raise exception 'Formulaire vide.'; end if;
  execute format('insert into %I (%s) select %s from jsonb_populate_record(null::%I, $1) returning id', p_table, colonnes, colonnes, p_table)
    into nouvel_id using ligne;
  return nouvel_id;
end;
$$;
revoke all on function formulaire_public_enregistrer(text, jsonb, text) from public, anon, authenticated;
grant execute on function formulaire_public_enregistrer(text, jsonb, text) to service_role;

-- Valider le paiement d'une inscription : statut « inscrite », et la recette « Cours de talons » en Compta
-- (compte Wave, ou caisse si payé en espèces). Une seule recette par inscription.
create or replace function cours_talons_valider(p_id uuid, p_montant int default null, p_especes boolean default false)
returns cours_talons language plpgsql security definer set search_path = public as $$
declare
  d cours_talons;
  compte uuid;
  ecriture uuid;
  libelle_formule text;
begin
  if not portail_peut('site') then raise exception 'Accès refusé.'; end if;
  select * into d from cours_talons where id = p_id for update;
  if d.id is null then raise exception 'Inscription introuvable.'; end if;
  if d.statut in ('inscrite', 'terminee') and d.ecriture_id is not null then return d; end if;
  if coalesce(p_montant, d.montant, 0) <= 0 then raise exception 'Montant manquant.'; end if;
  select id into compte from compta_comptes where type = case when p_especes then 'caisse' else 'wave' end order by actif desc, cree_le limit 1;
  libelle_formule := case d.formule when 'groupe' then 'en groupe (4 dimanches)' when 'prive_salle' then 'privé en salle' else 'privé à l''extérieur' end;
  if compte is not null then
    insert into compta_ecritures (sens, date_op, montant, compte_id, categorie, libelle, tiers)
    values ('recette', current_date, coalesce(p_montant, d.montant), compte, 'cours_talons', 'Cours de talons ' || libelle_formule, d.nom)
    returning id into ecriture;
  else
    perform journaliser('Cours de talons : paiement validé sans compte pour le recevoir', 'cours_talons', p_id::text, null, null);
  end if;
  update cours_talons set statut = 'inscrite', montant = coalesce(p_montant, montant), valide_le = now(), valide_par = auth.uid(), ecriture_id = ecriture
  where id = p_id returning * into d;
  perform journaliser('Cours de talons : paiement validé', 'cours_talons', p_id::text, null, json_build_object('montant', d.montant)::jsonb);
  return d;
end;
$$;
revoke all on function cours_talons_valider(uuid, int, boolean) from public, anon;
grant execute on function cours_talons_valider(uuid, int, boolean) to authenticated;

NOTIFY pgrst, 'reload schema';

select 'Cours de talons installé : ' ||
  ((select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'cours_talons')
   + (select count(*) from pg_proc where proname in ('cours_talons_valider', 'cours_talons_montant'))
   + (select count(*) from pg_proc p where p.proname = 'formulaire_public_enregistrer' and p.prosrc like '%cours_talons%')) || ' éléments sur 4' as controle;
