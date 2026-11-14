-- =====================================================================================
-- Extension 161 — « Mon programme » de l'Atelier Talons & Élégance (maquette validée par la propriétaire le 14/11/2026)
-- =====================================================================================
-- Chaque élève inscrite (paiement validé) reçoit sur WhatsApp un lien personnel vers SA page « Mon programme »
-- (programme-talons.html?c=jeton, sans compte) : ses séances, le calendrier, le lieu, « Ajouter à mon calendrier ».
--  - cours_talons.jeton : le jeton du lien (36 caractères, comme les convocations) ;
--  - cours_talons_seances : les séances de chaque élève (l'équipe du site les ajoute, les change, les coche) ;
--  - formule en groupe : à la validation du paiement, les 4 dimanches (15 h – 18 h) sont remplis tout seuls, à partir
--    de la date de première séance notée par l'agence si elle est à venir, sinon du prochain dimanche ;
--  - programme_talons_lire(jeton) : ce que la page de l'élève peut lire (rien sans le bon jeton, rien avant le
--    paiement validé, ni téléphone ni photos).
--  - (14/11/2026, demandes de la propriétaire) la CIVILITÉ choisie par la personne (Madame ou Mademoiselle) ; le
--    GROUPE sur plusieurs mois (1 à 12) : 30 000 FCFA × le nombre de mois, payés en une fois OU mois par mois (au choix
--    de l'élève). Tous les dimanches sont prévus dès la validation ; chaque mois suivant payé est encaissé par
--    cours_talons_mois_payer, qui sert aussi à renouveler (un mois de plus, 4 dimanches ajoutés à la suite).
-- Ajouts seulement (seule la nouvelle colonne mois_payes est remplie pour les inscriptions déjà payées). APRÈS supabase-cours-talons.sql et
-- supabase-moyens-inscriptions.sql (sa version de cours_talons_valider est remplacée ici).
-- À coller dans Supabase › SQL Editor › Run ; rejouable.

alter table cours_talons add column if not exists jeton text not null default encode(extensions.gen_random_bytes(18), 'hex');
create unique index if not exists cours_talons_jeton on cours_talons (jeton);

create table if not exists cours_talons_seances (
  id uuid primary key default gen_random_uuid(),
  inscription_id uuid not null references cours_talons(id) on delete cascade,
  debut timestamptz not null,
  fin timestamptz not null,
  lieu text check (lieu is null or length(lieu) <= 200),
  theme text check (theme is null or length(theme) <= 120),
  faite boolean not null default false,
  mois int check (mois is null or mois between 1 and 24),
  cree_le timestamptz not null default now(),
  check (fin > debut and fin <= debut + interval '8 hours')
);
alter table cours_talons add column if not exists civilite text check (civilite is null or civilite in ('madame', 'mademoiselle'));
alter table cours_talons add column if not exists nb_mois int not null default 1 check (nb_mois between 1 and 24);
alter table cours_talons add column if not exists paiement text not null default 'tout' check (paiement in ('tout', 'mensuel'));
-- (14/11/2026, décision de la propriétaire) le PARCOURS, en groupe comme en privé : « debut » = elle débute, tout le
-- programme dans l'ordre ; « base » = elle a déjà la base et choisit ses thèmes (modules = les mois du programme
-- choisis, dans l'ordre, répétés quand elle en prend 2 mois : {3,3,4} = La prestance 2 mois puis Le podium 1 mois)
-- (vide pour les inscriptions d'avant : personne ne leur a posé la question)
alter table cours_talons add column if not exists parcours text check (parcours is null or parcours in ('debut', 'base'));
alter table cours_talons add column if not exists modules int[] check (modules is null or (array_length(modules, 1) between 1 and 12
  and array_position(modules, null) is null and 1 <= all(modules) and 6 >= all(modules)));
alter table cours_talons add column if not exists mois_payes int not null default 0 check (mois_payes between 0 and 24);
-- inscriptions déjà payées avant ce fichier : leur mois est payé (la nouvelle colonne seulement)
update cours_talons set mois_payes = nb_mois where valide_le is not null and mois_payes = 0;

-- Prix du groupe : 30 000 FCFA le mois (4 dimanches) — décision de la propriétaire du 08/11/2026, inchangée
create or replace function cours_talons_prix_mois() returns int language sql immutable as $$ select 30000 $$;

-- À l'inscription (formulaire public, qui envoie la ligne) : la base tire le jeton, compte les mois payés (aucun),
-- borne la durée et décide du montant à payer maintenant : groupe = 30 000 × mois si tout est payé d'un coup,
-- 30 000 (le premier mois) si l'élève paie mois par mois. Le privé garde ses règles (cours_talons_montant).
drop trigger if exists cours_talons_jeton_force on cours_talons;
drop function if exists cours_talons_jeton_force();
create or replace function cours_talons_avant_inscription() returns trigger language plpgsql set search_path = public as $$
begin
  new.jeton := encode(extensions.gen_random_bytes(18), 'hex');
  new.mois_payes := 0;
  -- thèmes remis en ordre : chacun 1 ou 2 mois au plus (règle de la propriétaire), dans l'ordre du programme ;
  -- en privé, 7 mois de thèmes au plus (28 séances : le privé est limité à 30)
  if new.parcours = 'base' then
    select array_agg(t.m order by t.m) into new.modules
      from (select m from (select m, least(count(*), 2) n from unnest(new.modules) m where m is not null group by m) g, generate_series(1, g.n)) t;
    if new.formule <> 'groupe' then new.modules := new.modules[1:7]; end if;
  end if;
  new.parcours := coalesce(new.parcours, 'debut');
  if new.parcours = 'base' and coalesce(array_length(new.modules, 1), 0) = 0 then new.parcours := 'debut'; end if;
  if new.parcours = 'debut' then new.modules := null; end if;
  if new.formule = 'groupe' then
    -- « j'ai la base » : un mois par module choisi
    new.nb_mois := case when new.parcours = 'base' then array_length(new.modules, 1) else greatest(1, least(12, coalesce(new.nb_mois, 1))) end;
    if new.nb_mois = 1 then new.paiement := 'tout'; end if;
    new.nb_seances := 4;
    new.montant := cours_talons_prix_mois() * case when new.paiement = 'mensuel' then 1 else new.nb_mois end;
  else
    new.nb_mois := 1; new.paiement := 'tout';
    -- privé, « j'ai la base » : 4 séances par mois de module choisi, au prix de la séance
    if new.parcours = 'base' then
      new.nb_seances := least(30, 4 * array_length(new.modules, 1));
      new.montant := cours_talons_montant(new.formule, new.nb_seances);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists cours_talons_avant_inscription on cours_talons;
create trigger cours_talons_avant_inscription before insert on cours_talons for each row execute function cours_talons_avant_inscription();

-- Premier paiement validé (cours_talons_valider) : le groupe payé d'un coup a tous ses mois payés ; mois par mois, le
-- premier seulement. Les mois suivants : cours_talons_mois_payer.
create or replace function cours_talons_mois_valides() returns trigger language plpgsql set search_path = public as $$
begin
  -- (premier paiement validé : passage à « inscrite », ou validation d'une ligne déjà mise « inscrite » à la main)
  if new.statut = 'inscrite' and new.mois_payes = 0 and (old.statut is distinct from 'inscrite' or (old.valide_le is null and new.valide_le is not null)) then
    new.mois_payes := case when new.paiement = 'mensuel' then 1 else new.nb_mois end;
  end if;
  return new;
end;
$$;
drop trigger if exists cours_talons_mois_valides on cours_talons;
create trigger cours_talons_mois_valides before update of statut, valide_le on cours_talons for each row execute function cours_talons_mois_valides();

alter table cours_talons_seances add column if not exists mois int check (mois is null or mois between 1 and 24);
create index if not exists cours_talons_seances_inscription on cours_talons_seances (inscription_id, debut);

alter table cours_talons_seances enable row level security;
revoke all on cours_talons_seances from anon, authenticated;
grant select, insert, update, delete on cours_talons_seances to authenticated;
drop policy if exists "Séances de talons : l'équipe du site" on cours_talons_seances;
create policy "Séances de talons : l'équipe du site" on cours_talons_seances for all
  using (portail_peut('site')) with check (portail_peut('site'));

-- Le PROGRAMME mois par mois (validé par la propriétaire le 14/11/2026 ; ni « s'asseoir », ni escaliers, ni prise de
-- parole : l'agence ne les enseigne pas) : l'élève progresse, elle ne refait pas le même
-- mois ; à partir du 7e mois, « Perfectionnement » (séances adaptées, que l'agence précise dans la fiche), le dernier
-- dimanche reste un défilé. Une seule source : la page de l'élève et l'Administration le lisent ici.
create table if not exists cours_talons_programme (
  mois int primary key check (mois between 1 and 7),
  titre text not null check (length(titre) <= 60),
  themes text[] not null check (array_length(themes, 1) = 4)
);
insert into cours_talons_programme (mois, titre, themes) values
  (1, 'Les bases', array['Posture et équilibre', 'Démarche et port de tête', 'Fluidité et tours', 'Premier défilé']),
  (2, 'L''assurance', array['Talons plus hauts', 'Marche lente et marche rapide', 'L''équilibre en mouvement', 'Défilé du mois']),
  (3, 'La prestance', array['Regard et expression', 'Gestuelle des mains', 'Poses et arrêts', 'Défilé du mois']),
  (4, 'Le podium', array['Marcher en rythme sur la musique', 'Demi-tours et tours complets', 'Défiler à plusieurs', 'Défilé du mois']),
  (5, 'Les tenues', array['Robe longue et traîne', 'Tailleur et tenue courte', 'Les accessoires : sac, veste, chapeau', 'Défilé du mois']),
  (6, 'Miss et concours', array['Le passage devant le jury', 'Tenue de soirée et écharpe', 'Les poses de concours', 'Concours blanc']),
  (7, 'Perfectionnement', array['Séance adaptée à votre niveau', 'Séance adaptée à votre niveau', 'Séance adaptée à votre niveau', 'Défilé du mois'])
on conflict (mois) do update set titre = excluded.titre, themes = excluded.themes;
alter table cours_talons_programme enable row level security;
revoke all on cours_talons_programme from anon, authenticated;
grant select on cours_talons_programme to anon, authenticated;
drop policy if exists "Programme des talons : public" on cours_talons_programme;
create policy "Programme des talons : public" on cours_talons_programme for select using (true);

-- Ajoute les dimanches de p_nb mois (4 par mois) à partir du dimanche p_depart, 15 h – 18 h, dans la salle, avec leur
-- numéro de mois (colonne mois : les pages savent quels mois sont payés) ; le thème suit le programme du mois
-- (cours_talons_programme ; au-delà du 6e mois, celui du perfectionnement)
alter table cours_talons_seances add column if not exists module int check (module is null or module between 1 and 7);
-- (privé) place de la séance dans son programme : une séance retirée (annulée) laisse sa place, que la prochaine séance
-- ajoutée reprend ; les thèmes des autres séances ne bougent pas
alter table cours_talons_seances add column if not exists rang int check (rang is null or rang >= 0);

-- Le module (mois du programme) du m-ième mois d'une élève : elle débute → 1, 2, 3… ; elle a la base → ses modules
-- choisis, dans l'ordre ; au-delà → Perfectionnement (7)
create or replace function cours_talons_module(p_parcours text, p_modules int[], p_m int) returns int
language sql immutable as $$
  select case when p_parcours = 'base' and p_m <= coalesce(array_length(p_modules, 1), 0) then p_modules[p_m]
    when p_parcours = 'base' then 7 else least(greatest(p_m, 1), 7) end;
$$;
-- Thème de la k-ième séance (k à partir de 0) de son m-ième mois : le programme du module ; le 2e mois d'un même
-- module choisi deux fois est un approfondissement
create or replace function cours_talons_theme(p_parcours text, p_modules int[], p_m int, p_k int) returns text
language sql stable set search_path = public as $$
  select p.themes[p_k % 4 + 1] || case when p_parcours = 'base' and p_m > 1 and p_m <= coalesce(array_length(p_modules, 1), 0)
      and p_modules[p_m - 1] = p_modules[p_m] and p.mois < 7 then ' (approfondissement)' else '' end
  from cours_talons_programme p where p.mois = cours_talons_module(p_parcours, p_modules, p_m);
$$;

create or replace function cours_talons_ajouter_dimanches(p_id uuid, p_depart date, p_premier_mois int, p_nb int)
returns void language sql security definer set search_path = public as $$
  insert into cours_talons_seances (inscription_id, debut, fin, lieu, theme, mois, module)
  select c.id, ((p_depart + 7 * i) + time '15:00') at time zone 'Africa/Abidjan',
    ((p_depart + 7 * i) + time '18:00') at time zone 'Africa/Abidjan', 'Salle MA2M, Riviera Faya',
    cours_talons_theme(c.parcours, c.modules, p_premier_mois + i / 4, i), p_premier_mois + i / 4,
    cours_talons_module(c.parcours, c.modules, p_premier_mois + i / 4)
  from cours_talons c, generate_series(0, 4 * p_nb - 1) i where c.id = p_id;
$$;

-- Cours PRIVÉ : une séance ajoutée par l'agence sans thème prend le suivant de son programme (4 séances par mois de
-- programme, dans l'ordre de son parcours). Le groupe n'est pas concerné (un rattrapage reste sans thème imposé).
create or replace function cours_talons_seance_theme() returns trigger language plpgsql security definer set search_path = public as $$
declare
  c cours_talons;
  k int;
begin
  if new.theme is not null or new.module is not null then return new; end if;
  select * into c from cours_talons where id = new.inscription_id;
  if c.id is null or c.formule = 'groupe' then return new; end if;
  select min(n) into k from generate_series(0, 200) n
    where not exists (select 1 from cours_talons_seances where inscription_id = new.inscription_id and rang = n);
  new.rang := k;
  new.module := cours_talons_module(c.parcours, c.modules, k / 4 + 1);
  new.theme := cours_talons_theme(c.parcours, c.modules, k / 4 + 1, k);
  return new;
end;
$$;
revoke all on function cours_talons_seance_theme() from public, anon, authenticated;
drop trigger if exists cours_talons_seance_theme on cours_talons_seances;
create trigger cours_talons_seance_theme before insert on cours_talons_seances for each row execute function cours_talons_seance_theme();
revoke all on function cours_talons_ajouter_dimanches(uuid, date, int, int) from public, anon, authenticated;

-- Groupe : les 4 dimanches remplis tout seuls quand l'inscription devient « inscrite » (une seule fois : rien
-- n'est ajouté si l'élève a déjà des séances). Abidjan est à l'heure UTC toute l'année.
create or replace function cours_talons_remplir_groupe() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  depart date;
begin
  if new.formule <> 'groupe' or new.statut <> 'inscrite' then return new; end if;
  if old.statut = 'inscrite' and not (old.valide_le is null and new.valide_le is not null) then return new; end if;
  if exists (select 1 from cours_talons_seances where inscription_id = new.id) then return new; end if;
  -- le premier dimanche à partir de la date notée par l'agence (si elle est à venir), sinon à partir de demain :
  -- jamais un autre jour que le dimanche, jamais une séance déjà commencée
  depart := greatest(coalesce(new.date_seance, current_date + 1), current_date + 1);
  depart := depart + ((7 - extract(dow from depart)::int) % 7);
  perform cours_talons_ajouter_dimanches(new.id, depart, 1, new.nb_mois);
  return new;
end;
$$;
revoke all on function cours_talons_remplir_groupe() from public, anon, authenticated;
drop trigger if exists cours_talons_remplir_groupe on cours_talons;
create trigger cours_talons_remplir_groupe after update of statut, valide_le on cours_talons
  for each row execute function cours_talons_remplir_groupe();

-- Page « Mon programme » : seulement avec le bon jeton, seulement une fois le paiement validé.
create or replace function programme_talons_lire(p_jeton text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nom', c.nom,
    'civilite', case coalesce(c.civilite, case when c.age < 18 then 'mademoiselle' end) when 'mademoiselle' then 'Mademoiselle' else 'Madame' end,
    'formule', c.formule, 'nb_seances', c.nb_seances, 'statut', c.statut,
    'titres_mois', (select jsonb_object_agg(mois, titre) from cours_talons_programme),
    'parcours', c.parcours, 'modules', c.modules,
    'nb_mois', c.nb_mois, 'mois_payes', c.mois_payes, 'paiement', c.paiement, 'prix_mois', cours_talons_prix_mois(),
    'numero', 'TAL-' || upper(left(replace(c.id::text, '-', ''), 6)),
    'seances', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'mois', s.mois, 'module', s.module, 'debut', s.debut, 'fin', s.fin, 'lieu', s.lieu, 'theme', s.theme, 'faite', s.faite) order by s.debut)
      from cours_talons_seances s where s.inscription_id = c.id), '[]'::jsonb))
  from cours_talons c
  where length(coalesce(p_jeton, '')) = 36 and c.jeton = p_jeton and c.statut in ('inscrite', 'terminee');
$$;
revoke all on function programme_talons_lire(text) from public;
grant execute on function programme_talons_lire(text) to anon, authenticated;

-- Compte qui reçoit une recette « Cours de talons » : celui du moyen de l'élève (ou la caisse en espèces) ; à défaut, le
-- compte Wave, et le journal le signale pour correction. Commun à cours_talons_valider et cours_talons_mois_payer.
create or replace function cours_talons_compte(p_mode text, p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  compte uuid;
begin
  select id into compte from compta_comptes where type = compta_type_du_mode(p_mode) and actif order by cree_le limit 1;
  if compte is null then
    select id into compte from compta_comptes where type = case when p_mode = 'especes' then 'caisse' else 'wave' end order by actif desc, cree_le limit 1;
    if p_mode not in ('especes', 'wave') and compte is not null then
      perform journaliser('Cours de talons : recette ' || p_mode || ' rangée sur le compte Wave (aucun compte ' || compta_type_du_mode(p_mode) || ' actif) : à corriger', 'cours_talons', p_id::text, null, null);
    end if;
  end if;
  return compte;
end;
$$;
revoke all on function cours_talons_compte(text, uuid) from public, anon, authenticated;

-- Valider le premier paiement : statut « inscrite » et UNE recette « Cours de talons » en Compta.
-- ⚠ VERSION À JOUR (14/11/2026) : remplace celle de supabase-moyens-inscriptions.sql (même comportement ; libellé juste
-- pour le groupe sur plusieurs mois : « 3 mois payés d'un coup », « mois 1 sur 3 »).
create or replace function cours_talons_valider(p_id uuid, p_montant integer default null, p_especes boolean default false)
returns cours_talons language plpgsql security definer set search_path = public as $$
declare
  d cours_talons;
  compte uuid;
  ecriture uuid;
  libelle_formule text;
  mode text;
begin
  if not portail_peut('site') then raise exception 'Accès refusé.'; end if;
  select * into d from cours_talons where id = p_id for update;
  if d.id is null then raise exception 'Inscription introuvable.'; end if;
  if d.ecriture_id is not null or d.valide_le is not null then return d; end if;
  if d.statut = 'annulee' then raise exception 'Inscription annulée : rouvrez-la d''abord.'; end if;
  -- groupe payé mois par mois : ce premier paiement est le mois 1, jamais plus (les suivants : cours_talons_mois_payer)
  if d.formule = 'groupe' and d.paiement = 'mensuel' and d.nb_mois > 1 then p_montant := cours_talons_prix_mois(); end if;
  if coalesce(p_montant, d.montant, 0) <= 0 then raise exception 'Montant manquant.'; end if;
  mode := case when p_especes then 'especes' else coalesce(d.moyen, 'wave') end;
  compte := cours_talons_compte(mode, p_id);
  libelle_formule := case
    when d.formule = 'groupe' and d.nb_mois > 1 and d.paiement = 'mensuel' then 'en groupe, mois 1 sur ' || d.nb_mois
    when d.formule = 'groupe' and d.nb_mois > 1 then 'en groupe, ' || d.nb_mois || ' mois payés d''un coup'
    when d.formule = 'groupe' then 'en groupe (4 dimanches)'
    when d.formule = 'prive_salle' then 'privé en salle, ' || d.nb_seances || ' séance' || case when d.nb_seances > 1 then 's' else '' end
    else 'privé à l''extérieur, ' || d.nb_seances || ' séance' || case when d.nb_seances > 1 then 's' else '' end end;
  if compte is not null then
    insert into compta_ecritures (sens, date_op, montant, compte_id, categorie, libelle, tiers, moyen)
    values ('recette', current_date, coalesce(p_montant, d.montant), compte, 'cours_talons', 'Cours de talons ' || libelle_formule, d.nom, mode)
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

-- Mois suivant payé (groupe) : une recette de 30 000 en Compta (même compte que la validation : moyen de l'élève, ou la
-- caisse en espèces), un mois payé de plus ; au-delà de la durée prévue, c'est un renouvellement : un mois de plus et ses
-- 4 dimanches ajoutés après le dernier (jamais avant demain), et l'élève paie désormais mois par mois.
-- p_mois : le mois que l'agence encaisse (affiché sur le bouton) ; un deuxième appui sur le même bouton est refusé.
drop function if exists cours_talons_mois_payer(uuid, boolean);
create or replace function cours_talons_mois_payer(p_id uuid, p_mois int, p_especes boolean default false)
returns cours_talons language plpgsql security definer set search_path = public as $$
declare
  d cours_talons;
  compte uuid;
  ecriture uuid;
  mode text;
  depart date;
begin
  if not portail_peut('site') then raise exception 'Accès refusé.'; end if;
  select * into d from cours_talons where id = p_id for update;
  if d.id is null then raise exception 'Inscription introuvable.'; end if;
  if d.formule <> 'groupe' then raise exception 'Seul le cours en groupe se paie au mois.'; end if;
  if d.statut <> 'inscrite' or d.valide_le is null then raise exception 'Validez d''abord le premier paiement.'; end if;
  if d.mois_payes >= 24 then raise exception 'Vingt-quatre mois au plus.'; end if;
  if p_mois is distinct from d.mois_payes + 1 then raise exception 'Le mois % est déjà enregistré : rechargez la page.', p_mois; end if;
  mode := case when p_especes then 'especes' else coalesce(d.moyen, 'wave') end;
  compte := cours_talons_compte(mode, p_id);
  if compte is not null then
    insert into compta_ecritures (sens, date_op, montant, compte_id, categorie, libelle, tiers, moyen)
    values ('recette', current_date, cours_talons_prix_mois(), compte, 'cours_talons', 'Cours de talons en groupe, mois ' || (d.mois_payes + 1) || case when d.mois_payes + 1 <= d.nb_mois then ' sur ' || d.nb_mois else '' end, d.nom, mode)
    returning id into ecriture;
  else
    perform journaliser('Cours de talons : mois payé sans compte pour le recevoir', 'cours_talons', p_id::text, null, null);
  end if;
  if d.mois_payes + 1 > d.nb_mois then
    select greatest(coalesce(max(debut at time zone 'Africa/Abidjan')::date + 7, current_date + 1), current_date + 1) into depart
      from cours_talons_seances where inscription_id = p_id;
    depart := depart + ((7 - extract(dow from depart)::int) % 7);
    perform cours_talons_ajouter_dimanches(p_id, depart, d.nb_mois + 1, 1);
  end if;
  update cours_talons set mois_payes = mois_payes + 1, nb_mois = greatest(nb_mois, mois_payes + 1),
    paiement = case when mois_payes + 1 > nb_mois then 'mensuel' else paiement end, montant = coalesce(montant, 0) + cours_talons_prix_mois()
  where id = p_id returning * into d;
  perform journaliser('Cours de talons : mois payé', 'cours_talons', p_id::text, null, json_build_object('mois', d.mois_payes, 'ecriture', ecriture)::jsonb);
  return d;
end;
$$;
revoke all on function cours_talons_mois_payer(uuid, int, boolean) from public, anon;
grant execute on function cours_talons_mois_payer(uuid, int, boolean) to authenticated;

NOTIFY pgrst, 'reload schema';

select 'Mon programme (talons) installé : ' ||
  ((select count(*) from information_schema.columns where table_name = 'cours_talons' and column_name = 'jeton')
   + (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'cours_talons_seances')
   + (select count(*) from pg_trigger where tgname = 'cours_talons_remplir_groupe')
   + (select count(*) from pg_proc where proname = 'programme_talons_lire')
   + (select count(*) from information_schema.columns where table_name = 'cours_talons' and column_name in ('civilite', 'nb_mois', 'paiement', 'mois_payes'))
   + (select count(*) from pg_proc where proname = 'cours_talons_mois_payer')) || ' éléments sur 9' as controle;
