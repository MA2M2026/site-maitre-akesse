-- =====================================================================================
-- Petite version des photos du Book (480 px) pour les téléphones (24/10/2026)
-- =====================================================================================
-- Les grilles (accueil, The Book, Parcours, visages de l'Administration) affichaient sur
-- téléphone la miniature de 800 px, bien plus grande que la case : temps de chargement perdu
-- (Lighthouse : « Properly size images », ~400 Ko de trop par page). Chaque photo reçoit une
-- petite version (dossier « petites », « -n480 », copie WebP comme les autres versions),
-- faite à l'envoi et, pour les photos déjà en ligne, par le rattrapage automatique de
-- l'Administration (js/photos.js). Le navigateur choisit : petite sur téléphone, miniature sinon.
-- À coller en entier dans Supabase › SQL Editor › Run. Aucune donnée supprimée ; peut être rejoué.

alter table model_photos add column if not exists url_petite text;
alter table model_photos add column if not exists chemin_petite text;

-- Même photo de couverture que photos_couverture_mannequins (inchangée, toujours utilisée par
-- les pages pas encore mises à jour), avec sa petite version quand elle existe (et seulement
-- si elle vient de la même photo que la miniature renvoyée).
create or replace function photos_couverture_petites(ids uuid[])
returns table(model_id uuid, url text, url_petite text)
language sql
stable
as $$
  select distinct on (model_id) model_id, coalesce(url_miniature, url) as url,
    case when url_miniature is not null then url_petite end as url_petite
  from model_photos
  where model_id = any(ids)
  order by model_id, principale desc, created_at asc;
$$;
grant execute on function photos_couverture_petites(uuid[]) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
