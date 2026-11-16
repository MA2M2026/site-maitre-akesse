-- =====================================================================================================
-- Audit L-17 : photos des COURS DE TALONS d'abord chez Cloudflare R2, copie Google Drive ensuite (16/11/2026)
-- =====================================================================================================
-- Demande de la propriétaire (16/11, 15 h 20) : « toutes les photos téléchargées sur le site suivent la même route »
-- (Cloudflare d'abord, copie Drive ensuite, affichage depuis Cloudflare). Proposition validée par le superviseur
-- (COORDINATION.md, 15 h 35).
--
--  1. formulaire_public_enregistrer : une inscription au cours de talons accepte AUSSI, dans « photos », des
--     photos Cloudflare de CETTE inscription : « r2:cours-talons/<numéro de l'inscription>/<32 caractères>.jpg|png|webp »
--     (noms choisis par le serveur, api/r2-presigner.js). Les liens https (Drive) restent acceptés ; la limite de
--     5 photos (colonne) ne change pas. Le corps de la fonction est repris TEL QU'IL EST dans la base
--     (pg_get_functiondef) : seule la vérification des photos change.
--  2. medias_drive_appliquer : la copie Drive (archive) n'est plus ajoutée aux photos d'une inscription qui a déjà
--     des photos Cloudflare (sinon chaque photo s'afficherait deux fois). Le journal medias_drive garde la copie.
--
-- À COLLER UNE FOIS dans Supabase (SQL Editor), APRÈS supabase-cours-talons.sql et supabase-medias-drive.sql, avec
-- l'accord écrit de la propriétaire. Rien n'est effacé ; peut être recollé sans risque.

do $$
declare
  def text;
  ancien constant text := $a$(e #>> '{}') !~ '^https://[^\s"<>]+$')$a$;
  nouveau constant text := $n$((e #>> '{}') !~ '^https://[^\s"<>]+$' and (e #>> '{}') !~ coalesce('^r2:cours-talons/' || (ligne->>'id') || '/[0-9a-f]{32}\.(jpg|png|webp)$', '^$x')))$n$;
  ancien2 constant text := $a$where id = p_ref and not (photos ? m.lien) and jsonb_array_length(photos) < 5;$a$;
  nouveau2 constant text := $n$where id = p_ref and not (photos ? m.lien) and jsonb_array_length(photos) < 5
         and not exists (select 1 from jsonb_array_elements_text(photos) x where x like 'r2:%');  -- (L-17)$n$;
begin
  -- 1. inscription : photos Cloudflare acceptées
  if to_regprocedure('formulaire_public_enregistrer(text, jsonb, text)') is null then
    raise exception 'L-17 : formulaire_public_enregistrer absente : coller d''abord supabase-cours-talons.sql';
  end if;
  def := pg_get_functiondef(to_regprocedure('formulaire_public_enregistrer(text, jsonb, text)'));
  if position('^r2:cours-talons/' in def) > 0 then
    raise notice 'L-17 : inscription déjà ouverte aux photos Cloudflare';
  elsif position(ancien in def) > 0 then
    execute replace(def, ancien, nouveau);
    raise notice 'L-17 : inscription ouverte aux photos Cloudflare';
  else
    raise exception 'L-17 : vérification des photos inattendue dans formulaire_public_enregistrer : rien n''est changé, à relire';
  end if;

  -- 2. copie Drive : plus ajoutée quand l'inscription a des photos Cloudflare
  if to_regprocedure('medias_drive_appliquer(text, uuid)') is null then
    raise notice 'L-17 : medias_drive_appliquer absente (circuit Drive pas encore collé) : rien à faire';
  else
    def := pg_get_functiondef(to_regprocedure('medias_drive_appliquer(text, uuid)'));
    if position('(L-17)' in def) > 0 then
      raise notice 'L-17 : copie Drive déjà réglée';
    elsif position(ancien2 in def) > 0 then
      execute replace(def, ancien2, nouveau2);
      raise notice 'L-17 : copie Drive réglée (pas de double avec Cloudflare)';
    else
      raise exception 'L-17 : medias_drive_appliquer inattendue : rien n''est changé, à relire';
    end if;
  end if;
end;
$$;

-- Contrôle
select case when position('^r2:cours-talons/' in pg_get_functiondef(to_regprocedure('formulaire_public_enregistrer(text, jsonb, text)'))) > 0
  then '✅ L-17 : inscriptions au cours de talons ouvertes aux photos Cloudflare'
  else '❌ L-17 : changement absent' end as controle;
