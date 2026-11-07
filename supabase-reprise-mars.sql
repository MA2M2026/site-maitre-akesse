-- =====================================================================================
-- Extension 154 — « Reprise de mars » (07/11/2026, PLAN-REPRISE-MARS.md ; décisions de la propriétaire)
-- =====================================================================================
-- Septembre à novembre 2026 = période de rodage : RIEN n'est effacé ; les mois non payés de cette période ne sont
-- jamais réclamés (état « rodage », gris). Décembre, janvier, février = congés (mois_conge, Extension 148).
-- Reprise le 1er mars 2027 : assistant de reprise (bilan d'ouverture des comptes, chaque mannequin : statut, niveaux,
-- mois de formation déjà faits, inscription), puis chaque mois une clôture guidée (caisse comptée, Wave, écart en
-- écriture de régularisation avec motif, mois verrouillé, solde reporté).
-- Réutilise Extension 148 (supabase-formation.sql) : formation 2 × 9 mois, congés, mensualite_etat_regle (la seule
-- règle des mois), compta_tresorerie (4 lignes par compte), compta_cloturer / compta_clotures.
-- À coller en entier dans Supabase › SQL Editor › Run, APRÈS supabase-formation.sql. Ajout seulement ; aucune donnée
-- effacée ; rejouable. Contrôle final en bas du fichier (une ligne « ✅ … » attendue).

-- -----------------------------------------------------------------------------------
-- 1. Réglages de la reprise (une seule ligne) : date de reprise, période de rodage
-- -----------------------------------------------------------------------------------
create table if not exists reglages_reprise (
  id boolean primary key default true check (id),
  date_reprise date not null default '2027-03-01' check (date_reprise = date_trunc('month', date_reprise)::date),
  rodage_debut date not null default '2026-09-01' check (rodage_debut = date_trunc('month', rodage_debut)::date),
  rodage_fin date not null default '2026-11-01' check (rodage_fin = date_trunc('month', rodage_fin)::date),  -- dernier mois du rodage
  maj_le timestamptz not null default now(),
  check (rodage_debut <= rodage_fin and rodage_fin < date_reprise)
);
insert into reglages_reprise (id) values (true) on conflict (id) do nothing;
alter table reglages_reprise enable row level security;
revoke all on reglages_reprise from anon, authenticated;
drop policy if exists reglages_reprise_lecture on reglages_reprise;
create policy reglages_reprise_lecture on reglages_reprise for select using (portail_peut('paiements') or portail_peut('compta'));
grant select on reglages_reprise to authenticated;

create or replace function reprise_date()
returns date language sql stable security definer set search_path = public as $$
  select date_reprise from reglages_reprise where id;
$$;
-- un mois de la période de rodage (septembre à novembre 2026) ?
create or replace function mois_rodage(p date)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select date_trunc('month', p)::date between rodage_debut and rodage_fin from reglages_reprise where id), false);
$$;

-- -----------------------------------------------------------------------------------
-- 2. Fiche de formation de chaque mannequin (remplie dans l'assistant de reprise)
--    formation_niveaux : 2 (niveau 1 puis niveau 2, 18 mois) ou 1 (s'arrête après le niveau 1, 9 mois)
--    formation_mois_faits : mois de cours déjà faits AVANT la reprise (saisis par la propriétaire) ; null = pas encore
--    passée dans l'assistant (ancienne règle de l'Extension 148)
-- -----------------------------------------------------------------------------------
alter table agence_mannequins add column if not exists formation_niveaux int not null default 2;
alter table agence_mannequins add column if not exists formation_mois_faits int;
alter table agence_mannequins add column if not exists reprise_vue_le timestamptz;
alter table agence_mannequins drop constraint if exists agence_mannequins_formation_niveaux_check;
alter table agence_mannequins add constraint agence_mannequins_formation_niveaux_check check (formation_niveaux in (1, 2));
alter table agence_mannequins drop constraint if exists agence_mannequins_formation_mois_faits_check;
alter table agence_mannequins add constraint agence_mannequins_formation_mois_faits_check check (formation_mois_faits is null or formation_mois_faits between 0 and 18);

-- n mois de cours à partir d'un mois de départ (les congés sautés)
create or replace function formation_mois_n(p_debut date, p_n int)
returns setof date language sql immutable as $$
  select g::date from generate_series(date_trunc('month', p_debut), date_trunc('month', p_debut) + interval '47 months', interval '1 month') g
  where not mois_conge(g::date) order by g limit greatest(coalesce(p_n, 0), 0);
$$;

-- mois de cours qui restent à faire dans le système (niveaux × 9 − mois déjà faits avant la reprise)
create or replace function formation_reste_total(p_mannequin uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when a.formation_mois_faits is null then 18
              else greatest(a.formation_niveaux * 9 - a.formation_mois_faits, 0) end
  from agence_mannequins a where a.id = p_mannequin;
$$;

-- départ dans le système : comme avant (premier mois payé, sinon entrée au registre) ; une mannequin passée dans
-- l'assistant de reprise repart au plus tôt le mois de la reprise (ses mois déjà faits sont comptés à part)
create or replace function formation_debut(p_mannequin uuid)
returns date language sql stable security definer set search_path = public as $$
  select case when a.formation_mois_faits is null then x.ancien
              else greatest(x.ancien, reprise_date(), date_trunc('month', greatest(a.date_entree, a.cree_le::date))::date) end
  from agence_mannequins a
  cross join lateral (select date_trunc('month', coalesce((select min(p.mois) from paiements_mannequins p where p.mannequin_id = a.id and p.objet = 'mensualite'
                                                             and (a.formation_mois_faits is null or p.mois >= reprise_date())),
                                                          greatest(a.date_entree, a.cree_le::date)))::date as ancien) x
  where a.id = p_mannequin;
$$;
-- dernier mois de cours (rien à faire : le mois d'avant le départ, tous les mois sont alors « termine »)
create or replace function formation_fin(p_mannequin uuid)
returns date language sql stable security definer set search_path = public as $$
  select coalesce((select max(m) from formation_mois_n(formation_debut(p_mannequin), formation_reste_total(p_mannequin)) m),
                  (formation_debut(p_mannequin) - interval '1 month')::date);
$$;

-- LA règle d'un mois (remplace celle de l'Extension 148 ; mêmes états + « rodage ») : paye, attente, conge, rodage
-- (mois de rodage ou d'avant la reprise non payé : jamais réclamé), termine, a_venir, non_paye, a_payer
create or replace function mensualite_etat_regle(p_mannequin uuid, p_mois date, p_fin date, p_conge_paye boolean)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from paiements_mannequins where mannequin_id = p_mannequin and objet = 'mensualite' and mois = p_mois and statut = 'valide') then 'paye'
    when exists (select 1 from paiements_mannequins where mannequin_id = p_mannequin and objet = 'mensualite' and mois = p_mois and statut = 'declare') then 'attente'
    when mois_conge(p_mois) then 'conge'
    when p_mois < reprise_date() then 'rodage'
    when p_mois > p_fin then 'termine'
    when p_conge_paye and mensualite_credit(p_mannequin, p_mois) then 'paye'
    when p_mois > date_trunc('month', now())::date then 'a_venir'
    when p_mois < date_trunc('month', now())::date or extract(day from now()) > 5 then 'non_paye'
    else 'a_payer' end;
$$;

-- Côté mannequin (application) : ses mois, et où elle en est : niveau, mois X sur 9, il reste N mois, prochaine
-- mensualité ; pendant la fermeture : « agence fermée jusqu'au … »
create or replace function mes_mensualites()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  a agence_mannequins;
  debut date;
  fin date;
  courant date := date_trunc('month', now())::date;
  faits int;
  position int;
  ouverture date;
begin
  select * into a from agence_mannequins where user_id = auth.uid();
  if not found then return json_build_object('inscrit', false); end if;
  debut := formation_debut(a.id);
  fin := formation_fin(a.id);
  -- mois de cours déjà faits : avant la reprise (saisis) + dans le système jusqu'au mois en cours compris
  faits := coalesce(a.formation_mois_faits, 0)
           + (select count(*) from generate_series(debut, least(courant, fin), interval '1 month') g where not mois_conge(g::date));
  position := least(faits, a.formation_niveaux * 9);
  -- agence fermée : avant la reprise, ou pendant les congés → premier mois de cours à venir
  ouverture := case when courant < reprise_date() or mois_conge(courant)
                    then (select min(g)::date from generate_series(greatest(courant, reprise_date()), greatest(courant, reprise_date()) + interval '12 months', interval '1 month') g where not mois_conge(g::date))
               end;
  return json_build_object('inscrit', true, 'nom', a.full_name, 'mensualite', a.mensualite, 'statut', a.statut,
    'mineur', a.date_naissance is not null and extract(year from age(a.date_naissance)) < 18,
    'total', a.formation_niveaux * 9, 'fin', fin,
    'niveaux', a.formation_niveaux,
    'niveau', case when position <= 9 then 1 else 2 end,
    'mois_niveau', case when position = 0 then 0 when position <= 9 then position else position - 9 end,
    'reste', greatest(a.formation_niveaux * 9 - faits, 0),
    'termine', courant > fin,
    'fermee_jusqu_au', ouverture,
    'prochaine', (select min(g)::date from generate_series(greatest(courant, debut), fin, interval '1 month') g
                  where mensualite_etat(a.id, g::date) in ('a_payer', 'non_paye', 'a_venir')),
    'mois', (select json_agg(json_build_object('mois', g::date, 'etat', mensualite_etat(a.id, g::date), 'conge', mois_conge(g::date)) order by g)
             from generate_series(debut, greatest(fin, debut), interval '1 month') g));
end;
$$;

-- L'appel du 1er (remplace celui de l'Extension 148) : jamais pendant les congés, jamais avant la reprise (rodage),
-- jamais à une mannequin dont la formation est terminée
create or replace function mensualites_appeler(p_mois date, p_ids uuid[])
returns json language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_mois)::date;
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé'; end if;
  if mois_conge(m) then raise exception 'Décembre, janvier et février sont des congés : pas de mensualité, pas d''appel.'; end if;
  if m < reprise_date() then raise exception 'Avant la reprise du % : période de rodage, rien n''est réclamé.', to_char(reprise_date(), 'DD/MM/YYYY'); end if;
  insert into mensualites_appels (mois, mannequin_id, appel_par)
  select m, a.id, auth.uid() from agence_mannequins a where a.id = any(p_ids) and a.statut = 'actif' and m <= formation_fin(a.id)
  on conflict (mois, mannequin_id) do nothing;
  perform journaliser('Appel des mensualités envoyé', 'mensualites_appels', to_char(m, 'YYYY-MM'), null, json_build_object('nombre', coalesce(array_length(p_ids, 1), 0))::jsonb);
  return (select coalesce(json_agg(json_build_object('id', a.id, 'nom', a.full_name, 'telephone', a.telephone, 'email', a.email, 'date_naissance', a.date_naissance,
    'parent_nom', a.parent_nom, 'parent_telephone', a.parent_telephone, 'parent_email', a.parent_email, 'mensualite', a.mensualite)), '[]'::json)
    from agence_mannequins a where a.id = any(p_ids) and a.statut = 'actif' and m <= formation_fin(a.id));
end;
$$;

-- -----------------------------------------------------------------------------------
-- 3. Assistant de reprise : chaque mannequin (statut, niveaux, mois déjà faits) et son inscription
-- -----------------------------------------------------------------------------------
create or replace function reprise_mannequin_enregistrer(p_id uuid, p_statut text, p_niveaux int, p_mois_faits int)
returns json language plpgsql security definer set search_path = public as $$
declare
  avant agence_mannequins;
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé'; end if;
  if p_statut not in ('actif', 'suspendu', 'sorti') then raise exception 'Statut inconnu.'; end if;
  if p_niveaux not in (1, 2) then raise exception 'Niveaux : 1 ou 2.'; end if;
  if p_mois_faits is null or p_mois_faits < 0 or p_mois_faits > p_niveaux * 9 then
    raise exception 'Mois déjà faits : de 0 à % pour % niveau(x).', p_niveaux * 9, p_niveaux;
  end if;
  select * into avant from agence_mannequins where id = p_id for update;
  if not found then raise exception 'Mannequin introuvable.'; end if;
  update agence_mannequins set statut = p_statut, formation_niveaux = p_niveaux, formation_mois_faits = p_mois_faits, reprise_vue_le = now()
  where id = p_id;
  perform journaliser('Reprise : fiche de formation', 'agence_mannequins', p_id::text,
    json_build_object('statut', avant.statut, 'niveaux', avant.formation_niveaux, 'mois_faits', avant.formation_mois_faits)::jsonb,
    json_build_object('statut', p_statut, 'niveaux', p_niveaux, 'mois_faits', p_mois_faits)::jsonb);
  return json_build_object('id', p_id, 'reste', greatest(p_niveaux * 9 - p_mois_faits, 0), 'debut', formation_debut(p_id), 'fin', formation_fin(p_id));
end;
$$;

-- Inscription d'une mannequin sans inscription enregistrée : « encaissee » avant le système (l'argent n'est pas sur
-- les comptes : pas de recette), « a_recevoir » (créance « Ce qu'on nous doit »), ou « abandonnee » (rien réclamé,
-- noté au journal). Une seule fois par mannequin.
create or replace function reprise_inscription(p_id uuid, p_choix text, p_montant int default 15000)
returns text language plpgsql security definer set search_path = public as $$
declare
  a agence_mannequins;
  t uuid;
begin
  if not portail_peut('paiements') then raise exception 'Accès refusé'; end if;
  select * into a from agence_mannequins where id = p_id;
  if not found then raise exception 'Mannequin introuvable.'; end if;
  if exists (select 1 from paiements_mannequins where mannequin_id = p_id and objet = 'inscription' and statut <> 'refuse') then
    raise exception 'L''inscription de % est déjà enregistrée.', a.full_name;
  end if;
  if p_choix = 'encaissee' then
    insert into paiements_mannequins (mannequin_id, objet, montant, mode, statut, valide_le, valide_par, cree_par)
    values (p_id, 'inscription', nullif(p_montant, 0), 'avant_systeme', 'valide', now(), auth.uid(), auth.uid());
  elsif p_choix = 'a_recevoir' then
    if p_montant is null or p_montant <= 0 then raise exception 'Montant de l''inscription à recevoir manquant.'; end if;
    if exists (select 1 from compta_dettes d join compta_tiers x on x.id = d.tiers_id
               where d.sens = 'creance' and not d.annule and d.categorie = 'inscription' and x.nom = a.full_name) then
      raise exception 'L''inscription de % est déjà dans « Ce qu''on nous doit ».', a.full_name;
    end if;
    select id into t from compta_tiers where nom = a.full_name and type = 'client' order by cree_le limit 1;
    if t is null then
      insert into compta_tiers (nom, type, telephone, email, notes) values (a.full_name, 'client', a.telephone, a.email, 'Mannequin de l''agence (reprise du ' || to_char(reprise_date(), 'DD/MM/YYYY') || ')')
      returning id into t;
    end if;
    insert into compta_dettes (sens, tiers_id, date_op, montant, categorie, libelle, cree_par)
    values ('creance', t, greatest(current_date, reprise_date()), p_montant, 'inscription', 'Droit d''inscription de ' || a.full_name, auth.uid());
  elsif p_choix = 'abandonnee' then
    null;
  else
    raise exception 'Choix inconnu.';
  end if;
  perform journaliser('Reprise : inscription ' || p_choix, 'agence_mannequins', p_id::text, null, json_build_object('montant', p_montant)::jsonb);
  return p_choix;
end;
$$;

-- -----------------------------------------------------------------------------------
-- 4. Comptages des comptes : bilan d'ouverture (une fois, à la reprise) et clôture de chaque mois
--    L'écart entre le compte réel (caisse comptée, solde Wave) et le système devient UNE écriture de
--    régularisation avec motif (on n'efface jamais : on corrige par une écriture).
-- -----------------------------------------------------------------------------------
create table if not exists compta_comptages (
  id uuid primary key default gen_random_uuid(),
  nature text not null check (nature in ('ouverture', 'cloture')),
  mois date not null check (mois = date_trunc('month', mois)::date),   -- ouverture : mois de la reprise ; clôture : mois clôturé
  compte_id uuid not null references compta_comptes(id),
  solde_systeme bigint not null,
  solde_reel bigint not null check (solde_reel >= 0),
  ecart bigint not null,
  motif text,
  ecriture_id uuid references compta_ecritures(id),
  compte_le timestamptz not null default now(),
  compte_par uuid references auth.users(id),
  unique (nature, mois, compte_id),
  check (ecart = 0 or coalesce(trim(motif), '') <> '')
);
alter table compta_comptages enable row level security;
revoke all on compta_comptages from anon, authenticated;
drop policy if exists compta_comptages_lecture on compta_comptages;
create policy compta_comptages_lecture on compta_comptages for select using (portail_peut('compta') or portail_peut('paiements'));
grant select on compta_comptages to authenticated;
drop trigger if exists compta_comptages_lecture_seule on compta_comptages;
create trigger compta_comptages_lecture_seule before update or delete on compta_comptages for each row execute function recaps_interdit();

-- un comptage : écriture de régularisation si écart (recette si le réel est plus haut, dépense s'il est plus bas)
create or replace function compta_comptage_poser(p_nature text, p_mois date, p_date date, p_compte uuid, p_reel bigint, p_motif text)
returns compta_comptages language plpgsql security definer set search_path = public as $$
declare
  systeme bigint;
  e uuid;
  r compta_comptages;
  nom_compte text;
begin
  select t.fin, t.nom into systeme, nom_compte from compta_tresorerie(p_mois, (p_date + 1)) t where t.compte_id = p_compte;
  if nom_compte is null then raise exception 'Compte introuvable.'; end if;
  if p_reel is null then raise exception 'Montant compté manquant pour %.', nom_compte; end if;
  if p_reel < 0 then raise exception 'Le montant compté pour % ne peut pas être négatif.', nom_compte; end if;
  if p_reel <> systeme and coalesce(trim(p_motif), '') = '' then
    raise exception 'Écart de % FCFA sur % : indiquez-en la raison.', p_reel - systeme, nom_compte;
  end if;
  if p_reel <> systeme then
    perform set_config('ma2m.ecriture_regularisation', 'oui', true);
    insert into compta_ecritures (sens, date_op, montant, compte_id, categorie, libelle, cree_par)
    values (case when p_reel > systeme then 'recette' else 'depense' end, p_date, abs(p_reel - systeme), p_compte, 'regularisation',
            case when p_nature = 'ouverture' then 'Écart constaté à la reprise · ' else 'Écart de clôture · ' end || nom_compte || ' · ' || trim(p_motif), auth.uid())
    returning id into e;
    perform set_config('ma2m.ecriture_regularisation', '', true);
  end if;
  insert into compta_comptages (nature, mois, compte_id, solde_systeme, solde_reel, ecart, motif, ecriture_id, compte_par)
  values (p_nature, p_mois, p_compte, systeme, p_reel, p_reel - systeme, nullif(trim(coalesce(p_motif, '')), ''), e, auth.uid())
  returning * into r;
  return r;
end;
$$;
revoke all on function compta_comptage_poser(text, date, date, uuid, bigint, text) from public, anon, authenticated;

-- Bilan d'ouverture (assistant de reprise) : p_comptages = [{ "compte_id": …, "montant": …, "motif": … }] pour CHAQUE
-- compte actif ; une seule fois
create or replace function compta_ouverture(p_comptages jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  m date := reprise_date();
  c record;
  x jsonb;
begin
  if not portail_peut('compta') then raise exception 'Accès refusé'; end if;
  if current_date < m then raise exception 'Le bilan d''ouverture se fait à partir du %.', to_char(m, 'DD/MM/YYYY'); end if;
  if exists (select 1 from compta_comptages where nature = 'ouverture') then raise exception 'Le bilan d''ouverture est déjà fait.'; end if;
  for c in select id, nom from compta_comptes where actif order by cree_le loop
    x := (select v from jsonb_array_elements(coalesce(p_comptages, '[]'::jsonb)) v where v->>'compte_id' = c.id::text limit 1);
    if x is null then raise exception 'Montant compté manquant pour %.', c.nom; end if;
    perform compta_comptage_poser('ouverture', m, current_date, c.id, (x->>'montant')::bigint, x->>'motif');
  end loop;
  perform journaliser('Reprise : bilan d''ouverture', 'compta_comptages', to_char(m, 'YYYY-MM'), null, p_comptages);
  return (select json_agg(row_to_json(t)) from compta_comptages t where nature = 'ouverture');
end;
$$;

-- Clôture guidée d'un mois terminé : rien en suspens (aucun paiement « J'ai payé » non vérifié du mois), chaque
-- compte actif compté, écarts régularisés, puis la photo des chiffres (compta_cloturer) ; le mois est ensuite verrouillé
create or replace function compta_cloturer_complet(p_mois date, p_comptages jsonb, p_note text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_mois)::date;
  dernier date := (date_trunc('month', p_mois) + interval '1 month' - interval '1 day')::date;
  c record;
  x jsonb;
  en_attente int;
begin
  if not portail_peut('compta') then raise exception 'Accès refusé'; end if;
  if m >= date_trunc('month', current_date)::date then raise exception 'Seul un mois terminé peut être clôturé.'; end if;
  if exists (select 1 from compta_clotures where mois = m) then raise exception 'Ce mois est déjà clôturé.'; end if;
  select count(*) into en_attente from paiements_mannequins where statut = 'declare' and declare_le < (dernier + 1);
  if en_attente > 0 then raise exception 'Il reste % paiement(s) « J''ai payé » à vérifier : validez-les ou refusez-les d''abord.', en_attente; end if;
  for c in select id, nom from compta_comptes where actif and date_initiale <= dernier order by cree_le loop
    x := (select v from jsonb_array_elements(coalesce(p_comptages, '[]'::jsonb)) v where v->>'compte_id' = c.id::text limit 1);
    if x is null then raise exception 'Montant compté manquant pour %.', c.nom; end if;
    perform compta_comptage_poser('cloture', m, dernier, c.id, (x->>'montant')::bigint, x->>'motif');
  end loop;
  perform compta_cloturer(m, p_note);
  return json_build_object('mois', m, 'comptages', (select json_agg(row_to_json(t)) from compta_comptages t where nature = 'cloture' and mois = m),
                           'tresorerie', (select json_agg(row_to_json(t)) from compta_tresorerie(m, (dernier + 1)) t));
end;
$$;

-- Un mois clôturé est verrouillé : plus aucune écriture saisie, annulée ni modifiée à une date de ce mois (une
-- correction se fait par une nouvelle écriture dans un mois ouvert). Exceptions : le serveur, et les recettes
-- automatiques des paiements (déclencheur dans un déclencheur), pour ne jamais bloquer une validation.
create or replace function compta_mois_verrouille()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if est_ecriture_serveur() or pg_trigger_depth() > 1 then return NEW; end if;
  if exists (select 1 from compta_clotures where mois = date_trunc('month', NEW.date_op)::date)
     or (TG_OP = 'UPDATE' and exists (select 1 from compta_clotures where mois = date_trunc('month', OLD.date_op)::date)) then
    raise exception 'Le mois de % est clôturé : il ne change plus. Corrigez par une écriture dans le mois en cours.', to_char(NEW.date_op, 'MM/YYYY');
  end if;
  return NEW;
end;
$$;
revoke all on function compta_mois_verrouille() from public, anon, authenticated;
drop trigger if exists compta_mois_verrouille on compta_ecritures;
create trigger compta_mois_verrouille before insert or update on compta_ecritures for each row execute function compta_mois_verrouille();

-- (l'écriture de régularisation posée par compta_comptage_poser passe les garde-fous des écritures : catégorie
-- « regularisation », source manuelle, rien d'autre de permis)
create or replace function compta_regularisation_permise()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.categorie = 'regularisation' and coalesce(current_setting('ma2m.ecriture_regularisation', true), '') <> 'oui' then
    raise exception 'Une régularisation se fait seulement par le comptage des comptes (clôture ou reprise).';
  end if;
  return NEW;
end;
$$;
revoke all on function compta_regularisation_permise() from public, anon, authenticated;
drop trigger if exists compta_regularisation_permise on compta_ecritures;
create trigger compta_regularisation_permise before insert on compta_ecritures for each row execute function compta_regularisation_permise();

-- -----------------------------------------------------------------------------------
-- 5. Archives – période de rodage (lecture seule) et état de la reprise (pour l'assistant)
-- -----------------------------------------------------------------------------------
create or replace function archives_rodage()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  r reglages_reprise;
  fin date;
begin
  if not (portail_peut('paiements') or portail_peut('compta')) then raise exception 'Accès refusé'; end if;
  select * into r from reglages_reprise where id;
  fin := (r.rodage_fin + interval '1 month')::date;
  return json_build_object('debut', r.rodage_debut, 'fin', r.rodage_fin,
    'mannequins', coalesce((select json_agg(json_build_object('id', a.id, 'nom', a.full_name, 'statut', a.statut, 'mensualite', a.mensualite,
        'etats', (select json_object_agg(to_char(g, 'YYYY-MM-DD'), mensualite_etat_regle(a.id, g::date, formation_fin(a.id), false)) from generate_series(r.rodage_debut, r.rodage_fin, interval '1 month') g))
        order by a.full_name) from agence_mannequins a), '[]'::json),
    'paiements', coalesce((select json_agg(json_build_object('nom', a.full_name, 'objet', p.objet, 'mois', p.mois, 'montant', p.montant, 'mode', p.mode,
        'statut', p.statut, 'le', coalesce(p.valide_le, p.declare_le)) order by coalesce(p.valide_le, p.declare_le))
        from paiements_mannequins p join agence_mannequins a on a.id = p.mannequin_id
        where coalesce(p.valide_le, p.declare_le) >= r.rodage_debut and coalesce(p.valide_le, p.declare_le) < fin), '[]'::json),
    'ecritures', coalesce((select json_agg(json_build_object('date', e.date_op, 'sens', e.sens, 'montant', e.montant, 'compte', c.nom, 'categorie', e.categorie,
        'libelle', e.libelle, 'annule', e.annule) order by e.date_op, e.cree_le)
        from compta_ecritures e join compta_comptes c on c.id = e.compte_id where e.date_op >= r.rodage_debut and e.date_op < fin), '[]'::json),
    'tresorerie', (select json_agg(row_to_json(t)) from compta_tresorerie(r.rodage_debut, fin) t));
end;
$$;

create or replace function reprise_etat()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not (portail_peut('paiements') or portail_peut('compta')) then raise exception 'Accès refusé'; end if;
  return json_build_object('date_reprise', reprise_date(), 'aujourdhui', current_date,
    'ouverture', (select json_agg(row_to_json(t)) from compta_comptages t where nature = 'ouverture'),
    'comptes', (select json_agg(json_build_object('id', c.id, 'nom', c.nom, 'type', c.type) order by c.cree_le) from compta_comptes c where c.actif),
    'mannequins', coalesce((select json_agg(json_build_object('id', a.id, 'nom', a.full_name, 'statut', a.statut, 'niveaux', a.formation_niveaux,
        'mois_faits', a.formation_mois_faits, 'vue_le', a.reprise_vue_le,
        'inscription', (select p.mode from paiements_mannequins p where p.mannequin_id = a.id and p.objet = 'inscription' and p.statut <> 'refuse' limit 1),
        'inscription_due', exists (select 1 from compta_dettes d join compta_tiers x on x.id = d.tiers_id where d.sens = 'creance' and not d.annule and d.categorie = 'inscription' and x.nom = a.full_name))
        order by a.full_name) from agence_mannequins a), '[]'::json));
end;
$$;

-- -----------------------------------------------------------------------------------
-- 6. Droits
-- -----------------------------------------------------------------------------------
revoke execute on function reprise_date(), mois_rodage(date), formation_mois_n(date, int), formation_reste_total(uuid) from public, anon;
grant execute on function reprise_date(), mois_rodage(date), formation_mois_n(date, int) to authenticated;
revoke execute on function formation_reste_total(uuid), formation_debut(uuid), formation_fin(uuid), mensualite_etat_regle(uuid, date, date, boolean) from authenticated;
revoke execute on function mes_mensualites(), mensualites_appeler(date, uuid[]), reprise_mannequin_enregistrer(uuid, text, int, int), reprise_inscription(uuid, text, int),
  compta_ouverture(jsonb), compta_cloturer_complet(date, jsonb, text), archives_rodage(), reprise_etat() from public, anon;
grant execute on function mes_mensualites(), mensualites_appeler(date, uuid[]), reprise_mannequin_enregistrer(uuid, text, int, int), reprise_inscription(uuid, text, int),
  compta_ouverture(jsonb), compta_cloturer_complet(date, jsonb, text), archives_rodage(), reprise_etat() to authenticated;

NOTIFY pgrst, 'reload schema';

-- -----------------------------------------------------------------------------------
-- Contrôle final : une ligne « ✅ » si tout est installé
-- -----------------------------------------------------------------------------------
select case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
                  and p.proname in ('reprise_date', 'mois_rodage', 'formation_mois_n', 'formation_reste_total', 'reprise_mannequin_enregistrer', 'reprise_inscription',
                                    'compta_comptage_poser', 'compta_ouverture', 'compta_cloturer_complet', 'compta_mois_verrouille', 'archives_rodage', 'reprise_etat')) = 12
              and exists (select 1 from reglages_reprise where id and date_reprise = '2027-03-01')
              and exists (select 1 from information_schema.columns where table_name = 'agence_mannequins' and column_name = 'formation_mois_faits')
              and exists (select 1 from pg_trigger where tgname = 'compta_mois_verrouille')
            then '✅ Reprise de mars installée (Extension 154)' else '❌ Reprise de mars incomplète : recollez tout le fichier' end as controle;
