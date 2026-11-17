
do $$
declare
  def text;
  ancien constant text := $a$(e #>> '{}') !~ '^https://[^\s"<>]+$')$a$;
  nouveau constant text := $n$((e #>> '{}') !~ '^https://[^\s"<>]+$' and (e #>> '{}') !~ coalesce('^r2:cours-talons/' || lower(ligne->>'id') || '/[0-9a-f]{32}\.(jpg|png|webp)$', '^$x')))$n$;
  ancien2 constant text := $a$where id = p_ref and not (photos ? m.lien) and jsonb_array_length(photos) < 5;$a$;
  nouveau2 constant text := $n$where id = p_ref and not (photos ? m.lien) and jsonb_array_length(photos) < 5
         and not exists (select 1 from jsonb_array_elements_text(photos) x where x like 'r2:%');  -- (L-17)$n$;
begin
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

select case when position('^r2:cours-talons/' in pg_get_functiondef(to_regprocedure('formulaire_public_enregistrer(text, jsonb, text)'))) > 0
  then '✅ L-17 : inscriptions au cours de talons ouvertes aux photos Cloudflare'
  else '❌ L-17 : changement absent' end as controle;
