-- =====================================================================================
-- Extension 148 — Formation de 18 mois de cours, congés sans mensualité (01/11/2026, chantier 14, partie 2 ;
-- décisions de la propriétaire du 01/11/2026)
-- =====================================================================================
-- La formation dure 2 ans = 2 × 9 mois de cours. Décembre, janvier et février sont des congés chaque année :
-- pas de cours, PAS de mensualité, pas d'appel ni de relance. Une mannequin paie donc 18 mensualités en tout ;
-- après la 18e, sa formation est terminée (plus rien à payer ; l'Administration propose sa sortie).
-- Un mois de congé déjà payé (par exemple avec le paiement à l'avance) n'est pas perdu : il compte pour le
-- prochain mois de cours non payé (choix de la propriétaire).
-- Remplace (sans rien effacer) : mensualite_etat, mes_mensualites, mensualite_declarer, mensualites_appeler
-- (supabase-administration.sql) et mensualites_payer_avance (supabase-paiement-avance.sql). Ajoute pour
-- l'Administration : mensualites_etats (états des mois de chaque mannequin, une seule règle pour tous les écrans).
-- À coller en entier dans Supabase › SQL Editor › Run. Aucune donnée modifiée ; rejouable.

-- décembre, janvier, février : congés
create or replace function mois_conge(p date)
returns boolean language sql immutable as $$
  select extract(month from p) in (12, 1, 2);
$$;

-- les 18 mois de cours à partir d'un mois de départ (les congés sautés)
create or replace function formation_mois(p_debut date)
returns setof date language sql immutable as $$
  select g::date from generate_series(date_trunc('month', p_debut), date_trunc('month', p_debut) + interval '35 months', interval '1 month') g
  where not mois_conge(g::date) order by g limit 18;
$$;

-- départ de la formation d'une mannequin (comme avant : premier mois payé, sinon son entrée au registre)
create or replace function formation_debut(p_mannequin uuid)
returns date language sql stable security definer set search_path = public as $$
  select date_trunc('month', coalesce((select min(p.mois) from paiements_mannequins p where p.mannequin_id = a.id and p.objet = 'mensualite'),
                                      greatest(a.date_entree, a.cree_le::date)))::date
  from agence_mannequins a where a.id = p_mannequin;
$$;
-- son 18e et dernier mois de cours
create or replace function formation_fin(p_mannequin uuid)
returns date language sql stable security definer set search_path = public as $$
  select max(m) from formation_mois(formation_debut(p_mannequin)) m;
$$;

-- Un mois de cours est-il réglé par un mois de congé payé plus tôt ? Chaque mois de congé payé (validé)
-- règle le prochain mois de cours qui n'a pas son propre paiement, dans l'ordre.
create or replace function mensualite_credit(p_mannequin uuid, p_mois date)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  depart date;
  m date;
  credits int := 0;
begin
  select min(mois) into depart from paiements_mannequins
  where mannequin_id = p_mannequin and objet = 'mensualite' and statut = 'valide' and mois_conge(mois);
  if depart is null or depart >= p_mois or mois_conge(p_mois) then return false; end if;
  for m in select g::date from generate_series(depart, date_trunc('month', p_mois), interval '1 month') g loop
    if mois_conge(m) then
      if exists (select 1 from paiements_mannequins where mannequin_id = p_mannequin and objet = 'mensualite' and mois = m and statut = 'valide') then
        credits := credits + 1;
      end if;
    elsif credits > 0 and not exists (select 1 from paiements_mannequins where mannequin_id = p_mannequin and objet = 'mensualite' and mois = m and statut in ('valide', 'declare')) then
      if m = date_trunc('month', p_mois)::date then return true; end if;
      credits := credits - 1;
    end if;
  end loop;
  return false;
end;
$$;

-- La mannequin a-t-elle un mois de congé payé (validé) ? (sinon, pas de report à chercher)
create or replace function mensualite_a_conge_paye(p_mannequin uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from paiements_mannequins where mannequin_id = p_mannequin and objet = 'mensualite' and statut = 'valide' and mois_conge(mois));
$$;

-- La règle d'un mois (LA seule, pour tous les écrans) : paye (vert), attente (orange), conge (gris : pas de
-- mensualité), termine (après le 18e mois de cours), non_paye (rouge, après le 5), a_payer (mois en cours avant
-- le 6), a_venir. p_fin et p_conge_paye : calculés une fois par mannequin par qui appelle.
create or replace function mensualite_etat_regle(p_mannequin uuid, p_mois date, p_fin date, p_conge_paye boolean)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from paiements_mannequins where mannequin_id = p_mannequin and objet = 'mensualite' and mois = p_mois and statut = 'valide') then 'paye'
    when exists (select 1 from paiements_mannequins where mannequin_id = p_mannequin and objet = 'mensualite' and mois = p_mois and statut = 'declare') then 'attente'
    when mois_conge(p_mois) then 'conge'
    when p_mois > p_fin then 'termine'
    when p_conge_paye and mensualite_credit(p_mannequin, p_mois) then 'paye'
    when p_mois > date_trunc('month', now())::date then 'a_venir'
    when p_mois < date_trunc('month', now())::date or extract(day from now()) > 5 then 'non_paye'
    else 'a_payer' end;
$$;

-- État d'un mois (seulement l'agence, le serveur, ou la mannequin pour elle-même)
create or replace function mensualite_etat(p_mannequin uuid, p_mois date)
returns text language sql stable security definer set search_path = public as $$
  select case
    when not (est_ecriture_serveur() or portail_peut('paiements')
              or exists (select 1 from agence_mannequins where id = p_mannequin and user_id = auth.uid())) then null
    else mensualite_etat_regle(p_mannequin, p_mois, formation_fin(p_mannequin), mensualite_a_conge_paye(p_mannequin)) end;
$$;

-- Côté mannequin : ses mois, du départ au 18e mois de cours ; les congés y figurent en gris (« conge »)
create or replace function mes_mensualites()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  a agence_mannequins;
  debut date;
  fin date;
begin
  select * into a from agence_mannequins where user_id = auth.uid();
  if not found then return json_build_object('inscrit', false); end if;
  debut := formation_debut(a.id);
  fin := formation_fin(a.id);
  return json_build_object('inscrit', true, 'nom', a.full_name, 'mensualite', a.mensualite, 'statut', a.statut,
    'mineur', a.date_naissance is not null and extract(year from age(a.date_naissance)) < 18,
    'total', 18, 'fin', fin,
    'mois', (select json_agg(json_build_object('mois', g::date, 'etat', mensualite_etat(a.id, g::date), 'conge', mois_conge(g::date)) order by g)
             from generate_series(debut, fin, interval '1 month') g));
end;
$$;

-- « J'ai payé » d'un mois : jamais un mois de congé, jamais après la formation, au plus 3 mois de cours d'avance
create or replace function mensualite_declarer(p_mois date)
returns void language plpgsql security definer set search_path = public as $$
declare
  a agence_mannequins;
  m date := date_trunc('month', p_mois)::date;
  courant date := date_trunc('month', now())::date;
begin
  select * into a from agence_mannequins where user_id = auth.uid() and statut = 'actif';
  if not found then raise exception 'Espace non rattaché à l''agence : contactez l''agence.'; end if;
  if mois_conge(m) then raise exception 'Pas de mensualité en décembre, janvier et février : ce sont les congés.'; end if;
  if m < date_trunc('month', greatest(a.date_entree, a.cree_le::date)) or m > formation_fin(a.id)
     or (m > courant and (select count(*) from generate_series(courant + interval '1 month', m, interval '1 month') g where not mois_conge(g::date)) > 3) then
    raise exception 'Mois hors de votre formation.';
  end if;
  if mensualite_etat(a.id, m) in ('paye', 'attente') then raise exception 'Ce mois est déjà payé ou en cours de vérification.'; end if;
  insert into paiements_mannequins (mannequin_id, objet, mois, montant, mode) values (a.id, 'mensualite', m, a.mensualite, 'wave');
end;
$$;

-- Paiement à l'avance : les 3 prochains mois de COURS (les congés sautés), tout ou rien
create or replace function mensualites_payer_avance(p_nb int, p_numero text)
returns int language plpgsql security definer set search_path = public as $$
declare
  a agence_mannequins;
  courant date := date_trunc('month', now())::date;
  debut date;
  m date;
  faits int := 0;
begin
  if p_nb is null or p_nb < 1 or p_nb > 3 then raise exception 'De 1 à 3 mois à l''avance.'; end if;
  select * into a from agence_mannequins where user_id = auth.uid() and statut = 'actif';
  if not found then raise exception 'Espace non rattaché à l''agence : contactez l''agence.'; end if;
  debut := date_trunc('month', greatest(a.date_entree, a.cree_le::date))::date;
  for m in select g::date from generate_series(courant + interval '1 month', courant + interval '12 months', interval '1 month') g
           where not mois_conge(g::date) order by g limit 3 loop
    exit when faits >= p_nb;
    if m >= debut and mensualite_etat(a.id, m) = 'a_venir' then
      perform mensualite_declarer_avec_numero(m, p_numero);
      faits := faits + 1;
    end if;
  end loop;
  if faits < p_nb then
    raise exception 'Seulement % mois peuvent être payés à l''avance pour le moment : rien n''a été enregistré.', faits;
  end if;
  return faits;
end;
$$;

-- L'appel du 1er : jamais pendant les congés, jamais à une mannequin dont la formation est terminée
create or replace function mensualites_appeler(p_mois date, p_ids uuid[])
returns json language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_mois)::date;
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé'; end if;
  if mois_conge(m) then raise exception 'Décembre, janvier et février sont des congés : pas de mensualité, pas d''appel.'; end if;
  insert into mensualites_appels (mois, mannequin_id, appel_par)
  select m, a.id, auth.uid() from agence_mannequins a where a.id = any(p_ids) and a.statut = 'actif' and m <= formation_fin(a.id)
  on conflict (mois, mannequin_id) do nothing;
  perform journaliser('Appel des mensualités envoyé', 'mensualites_appels', to_char(m, 'YYYY-MM'), null, json_build_object('nombre', coalesce(array_length(p_ids, 1), 0))::jsonb);
  return (select coalesce(json_agg(json_build_object('id', a.id, 'nom', a.full_name, 'telephone', a.telephone, 'email', a.email, 'date_naissance', a.date_naissance,
    'parent_nom', a.parent_nom, 'parent_telephone', a.parent_telephone, 'parent_email', a.parent_email, 'mensualite', a.mensualite)), '[]'::json)
    from agence_mannequins a where a.id = any(p_ids) and a.statut = 'actif' and m <= formation_fin(a.id));
end;
$$;

-- Pour l'Administration (Paiements) : les états des mois de p_debut à p_fin (36 mois au plus : récapitulatif des
-- impayés) pour chaque mannequin du registre qui n'est pas sortie, avec le départ et le dernier mois de sa
-- formation (calculés UNE fois par mannequin), et les mois de congé de la période
create or replace function mensualites_etats(p_debut date, p_fin date)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  d date := date_trunc('month', p_debut)::date;
  f date := date_trunc('month', p_fin)::date;
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé'; end if;
  if f < d or f > d + interval '35 months' then raise exception 'Période de 1 à 36 mois.'; end if;
  return json_build_object(
    'conges', coalesce((select json_agg(g::date order by g) from generate_series(d, f, interval '1 month') g where mois_conge(g::date)), '[]'::json),
    'mannequins', coalesce((select json_agg(json_build_object('id', a.id, 'debut', x.debut, 'fin', x.fin,
        'etats', (select json_object_agg(to_char(g, 'YYYY-MM-DD'), mensualite_etat_regle(a.id, g::date, x.fin, x.conge_paye)) from generate_series(d, f, interval '1 month') g)))
      from agence_mannequins a
      cross join lateral (select formation_debut(a.id) as debut, formation_fin(a.id) as fin, mensualite_a_conge_paye(a.id) as conge_paye) x
      where a.statut <> 'sorti'), '[]'::json));
end;
$$;

revoke execute on function formation_debut(uuid), formation_fin(uuid), mensualite_credit(uuid, date), mensualite_a_conge_paye(uuid), mensualite_etat_regle(uuid, date, date, boolean) from public, anon, authenticated;
revoke execute on function mensualite_etat(uuid, date), mes_mensualites(), mensualite_declarer(date), mensualites_payer_avance(int, text),
  mensualites_appeler(date, uuid[]), mensualites_etats(date, date) from public, anon;
grant execute on function mensualite_etat(uuid, date), mes_mensualites(), mensualite_declarer(date), mensualites_payer_avance(int, text),
  mensualites_appeler(date, uuid[]), mensualites_etats(date, date) to authenticated;

NOTIFY pgrst, 'reload schema';
