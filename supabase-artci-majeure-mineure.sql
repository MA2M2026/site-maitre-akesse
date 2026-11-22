-- =====================================================================================================
-- Minimisation ARTCI (22/11/2026, décision de la propriétaire) : « majeure ou mineure » au lieu de l âge
-- =====================================================================================================
-- Postuler à un casting, Intégrer l agence, Cours de talons : on ne demande plus la date de naissance ni l âge,
-- seulement « 18 ans ou plus » ou « moins de 18 ans ». La date de naissance est demandée à l Inscription seulement
-- (personnes retenues par l agence), et c est elle qui décide de l accord du parent (déjà le cas).
--  1. casting_applications.mineur et cours_talons.mineure : le choix fait dans le formulaire.
--  2. cours_talons : une mineure doit donner le téléphone de son parent (comme avant avec l âge).
--  3. formulaire_public_enregistrer : une inscription au cours de talons n exige plus l âge (le choix suffit).
--  4. code_individuel_creer : un code d inscription peut être créé sans date de naissance dans la candidature.
--  5. inscription_code_lire (relecture du 22/11) : nouvelle version à 3 informations, code + date de naissance +
--     4 derniers chiffres du WhatsApp de la candidature. La date n est comparée que si la candidature en a une
--     (anciennes candidatures), sinon ce sont les 4 chiffres qui protègent le code. 14 ans minimum.
--     Mineur(e) si la candidature l a déclaré OU si la date tapée donne moins de 18 ans (accord du parent exigé).
--     L ancienne version à 2 informations ne sert plus que pour les anciennes candidatures (avec date).
--  6. casting_applications : une personne déclarée mineure doit donner le téléphone de son parent.
-- A COLLER AVANT la mise en ligne du site (bouton orange Run without RLS), avec l accord de la propriétaire.
-- Rien n est effacé. Peut être recollé sans risque.

alter table casting_applications add column if not exists mineur boolean;
alter table cours_talons add column if not exists mineure boolean;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cours_talons_mineure_parent') then
    alter table cours_talons add constraint cours_talons_mineure_parent
      check (mineure is not true or parent_telephone is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'casting_mineur_parent') then
    alter table casting_applications add constraint casting_mineur_parent
      check (mineur is not true or parent_telephone is not null) not valid;
  end if;
end;
$$;

do $$
declare
  def text;
  nouveau text;
begin
  -- 3. cours de talons : l âge ou le choix majeure / mineure
  def := pg_get_functiondef('formulaire_public_enregistrer(text, jsonb, text)'::regprocedure);
  if position('(ARTCI)' in def) = 0 then
    nouveau := replace(def, $a$if nullif(ligne->>'age', '') is null then$a$,
                            $n$if nullif(ligne->>'age', '') is null and nullif(ligne->>'mineure', '') is null then /* (ARTCI) */$n$);
    if nouveau = def then raise exception 'ARTCI : formulaire_public_enregistrer inattendue, rien n est changé'; end if;
    execute nouveau;
  end if;

  -- 4. code d inscription sans date de naissance dans la candidature
  def := pg_get_functiondef('code_individuel_creer(uuid)'::regprocedure);
  if position('(ARTCI)' in def) = 0 then
    nouveau := regexp_replace(def, $r$if c\.date_naissance is null then\s*raise exception 'Date de naissance absente[^;]*;\s*end if;$r$,
                              $n$/* (ARTCI) la date de naissance est demandée à l Inscription */$n$);
    if nouveau = def then raise exception 'ARTCI : code_individuel_creer inattendue, rien n est changé'; end if;
    execute nouveau;
  end if;

  -- 5. Inscription : la version à 3 informations est appelée au paiement
  def := pg_get_functiondef('inscription_simplifiee_payer(text, date, jsonb)'::regprocedure);
  if position('(ARTCI)' in def) = 0 then
    nouveau := replace(def, $a$infos := inscription_code_lire(p_code, p_naissance);$a$,
                            $n$infos := inscription_code_lire(p_code, p_naissance, p_infos ->> 'tel4'); /* (ARTCI) */$n$);
    if nouveau = def then raise exception 'ARTCI : inscription_simplifiee_payer inattendue, rien n est changé'; end if;
    execute nouveau;
  end if;
end;
$$;

-- 5 bis. Lecture du code avec les 4 derniers chiffres du WhatsApp (nouvelle version)
create or replace function inscription_code_lire(p_code text, p_naissance date, p_tel4 text)
returns json language plpgsql stable security definer set search_path to 'public' as $f$
declare
  c casting_applications;
  civ text;
  t4 text := right(regexp_replace(coalesce(p_tel4, ''), '[^0-9]', '', 'g'), 4);
begin
  if not est_ecriture_serveur() then raise exception 'Accès refusé.'; end if;
  select a.* into c from codes_inscription k join casting_applications a on a.id = k.candidature_id
   where k.code = upper(trim(p_code)) and not k.utilise and a.status = 'retenue';
  if not found or p_naissance is null or p_naissance > current_date - interval '14 years' or p_naissance < current_date - interval '100 years'
     or (c.date_naissance is not null and c.date_naissance <> p_naissance)
     or (c.date_naissance is null and (length(t4) < 4 or right(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'), 4) <> t4)) then
    return null;
  end if;
  civ := case when c.civilite in ('Madame', 'Mademoiselle', 'Monsieur') then c.civilite
              when c.genre = 'femme' then 'Mademoiselle' when c.genre = 'homme' then 'Monsieur' end;
  return json_build_object('salutation', trim(coalesce(civ, '') || ' ' || c.full_name), 'full_name', c.full_name,
    'telephone', c.phone, 'email', nullif(c.email, ''), 'ville', c.city, 'genre', c.genre, 'date_naissance', p_naissance,
    'casting', case c.type_candidature when 'projet' then c.projet_nom when 'direct' then 'Casting à l''agence' else 'Intégrer l''agence' end,
    'parent_nom', c.parent_nom, 'parent_telephone', c.parent_telephone, 'parent_email', c.parent_email,
    'mineur', coalesce(c.mineur, false) or extract(year from age(p_naissance)) < 18);
end;
$f$;
revoke all on function inscription_code_lire(text, date, text) from public, anon, authenticated;
grant execute on function inscription_code_lire(text, date, text) to service_role;

-- L ancienne version à 2 informations : seulement les anciennes candidatures (avec date de naissance)
create or replace function inscription_code_lire(p_code text, p_naissance date)
returns json language plpgsql stable security definer set search_path to 'public' as $f$
begin
  return inscription_code_lire(p_code, p_naissance, null::text);
end;
$f$;
revoke all on function inscription_code_lire(text, date) from public, anon, authenticated;

-- Contrôle
select case when
    exists (select 1 from information_schema.columns where table_name = 'casting_applications' and column_name = 'mineur')
    and exists (select 1 from information_schema.columns where table_name = 'cours_talons' and column_name = 'mineure')
    and position('(ARTCI)' in pg_get_functiondef('formulaire_public_enregistrer(text, jsonb, text)'::regprocedure)) > 0
    and position('(ARTCI)' in pg_get_functiondef('code_individuel_creer(uuid)'::regprocedure)) > 0
    and position('(ARTCI)' in pg_get_functiondef('inscription_simplifiee_payer(text, date, jsonb)'::regprocedure)) > 0
    and to_regprocedure('inscription_code_lire(text, date, text)') is not null
    and exists (select 1 from pg_constraint where conname = 'casting_mineur_parent')
  then '✅ ARTCI : majeure ou mineure installé (7 éléments sur 7)'
  else '❌ ARTCI : changement incomplet' end as controle;
