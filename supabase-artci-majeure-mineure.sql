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
--  5. inscription_code_lire : la date tapée à l Inscription n est comparée à celle de la candidature que si
--     la candidature en a une (anciennes candidatures), et elle doit être vraisemblable (pas dans le futur).
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
                            $n$if nullif(ligne->>'age', '') is null and nullif(ligne->>'mineure', '') is null then  -- (ARTCI)$n$);
    if nouveau = def then raise exception 'ARTCI : formulaire_public_enregistrer inattendue, rien n est changé'; end if;
    execute nouveau;
  end if;

  -- 4. code d inscription sans date de naissance dans la candidature
  def := pg_get_functiondef('code_individuel_creer(uuid)'::regprocedure);
  if position('(ARTCI)' in def) = 0 then
    nouveau := regexp_replace(def, $r$if c\.date_naissance is null then\s*raise exception 'Date de naissance absente[^;]*;\s*end if;$r$,
                              $n$-- (ARTCI) la date de naissance est demandée à l Inscription$n$);
    if nouveau = def then raise exception 'ARTCI : code_individuel_creer inattendue, rien n est changé'; end if;
    execute nouveau;
  end if;

  -- 5. Inscription : comparaison seulement si la candidature a une date de naissance
  def := pg_get_functiondef('inscription_code_lire(text, date)'::regprocedure);
  if position('(ARTCI)' in def) = 0 then
    nouveau := replace(def, $a$or c.date_naissance is null or c.date_naissance <> p_naissance then$a$,
                            $n$or p_naissance > current_date or p_naissance < current_date - interval '100 years'
     or (c.date_naissance is not null and c.date_naissance <> p_naissance) then  -- (ARTCI)$n$);
    if nouveau = def then raise exception 'ARTCI : inscription_code_lire inattendue, rien n est changé'; end if;
    execute nouveau;
  end if;
end;
$$;

-- Contrôle
select case when
    exists (select 1 from information_schema.columns where table_name = 'casting_applications' and column_name = 'mineur')
    and exists (select 1 from information_schema.columns where table_name = 'cours_talons' and column_name = 'mineure')
    and position('(ARTCI)' in pg_get_functiondef('formulaire_public_enregistrer(text, jsonb, text)'::regprocedure)) > 0
    and position('(ARTCI)' in pg_get_functiondef('code_individuel_creer(uuid)'::regprocedure)) > 0
    and position('(ARTCI)' in pg_get_functiondef('inscription_code_lire(text, date)'::regprocedure)) > 0
  then '✅ ARTCI : majeure ou mineure installé (5 éléments sur 5)'
  else '❌ ARTCI : changement incomplet' end as controle;
