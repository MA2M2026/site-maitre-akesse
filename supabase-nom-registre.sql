-- À coller dans Supabase › SQL Editor › Run (après supabase-administration.sql). Recollable.
-- ===========================================================================
-- Extension 156 (07/11/2026) : « Sans nom » dans les paiements. La fiche du registre (agence_mannequins) est créée
-- à la création du compte, souvent AVANT que la mannequin écrive son nom : elle restait « Sans nom » pour toujours.
-- Désormais, quand la mannequin écrit son nom sur son profil, une fiche encore « Sans nom » le reprend (une seule fois) ;
-- un nom écrit par l'agence dans le registre n'est jamais remplacé. Rattrapage des fiches existantes. Recollable.
-- ===========================================================================
create or replace function registre_reprendre_nom()
returns trigger language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if coalesce(trim(NEW.full_name), '') <> '' then
    update agence_mannequins set full_name = trim(NEW.full_name)
    where user_id = NEW.id and (coalesce(trim(full_name), '') = '' or full_name = 'Sans nom');
  end if;
  return NEW;
end;
$$;
revoke all on function registre_reprendre_nom() from public, anon, authenticated;
drop trigger if exists registre_reprendre_nom on model_profiles;
create trigger registre_reprendre_nom after update of full_name on model_profiles
  for each row execute function registre_reprendre_nom();
update agence_mannequins a set full_name = trim(m.full_name)
from model_profiles m
where m.id = a.user_id and coalesce(trim(m.full_name), '') <> '' and (coalesce(trim(a.full_name), '') = '' or a.full_name = 'Sans nom');

select '✅ Nom du registre repris du profil (Extension 156)' as controle;
