-- ════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Publication au Book : seule l'agence décide (audit du 16/11/2026, chantier L-2 = R-02 = D-V1, gravité haute)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Le défaut (confirmé dans la vraie base par l'agent D) : une mannequin connectée pouvait écrire elle-même
-- `premiere_publication_faite = true`, puis `published = true` avec une date de naissance d'adulte : sa fiche
-- paraissait au Book sans validation de l'agence, même si elle était mineure. Le gardien
-- gerer_validation_publication ne regardait que l'ANCIENNE valeur de premiere_publication_faite (qu'elle venait
-- de changer elle-même) et la NOUVELLE date de naissance (qu'elle venait de saisir).
-- La correction, dans ce même gardien (aucun changement de l'espace mannequin, qui n'envoie que `published`) :
--   1. hors agence, les réglages réservés à l'agence gardent leur valeur : premiere_publication_faite,
--      raison_refus, en_attente_validation (posé seulement par ce gardien), desactive (et sa date, son auteur),
--      exclue_vitrine ;
--   2. la minorité est calculée sur l'ANCIENNE date de naissance si elle existait, et sur la nouvelle : une
--      mineure ne devient pas majeure en changeant sa date ;
--   3. le reste ne change pas : l'agence publie directement ; une mannequin déjà validée une fois et majeure
--      republie seule ; sinon sa demande part en validation.
-- À coller une fois dans Supabase (SQL Editor). Contrôle en bas : « 1 élément sur 1 ».

create or replace function gerer_validation_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  est_admin boolean;
  est_mineur boolean := false;
begin
  -- écriture du serveur (fonctions de la base, tâches planifiées) : rien n'est imposé
  if auth.uid() is null then
    return NEW;
  end if;

  select exists(select 1 from admins where user_id = auth.uid()) into est_admin;

  if not est_admin then
    -- (L-2) réglages de l'agence : la mannequin ne peut pas les changer elle-même
    if tg_op = 'UPDATE' then
      NEW.premiere_publication_faite := OLD.premiere_publication_faite;
      NEW.raison_refus := OLD.raison_refus;
      NEW.en_attente_validation := OLD.en_attente_validation;
      NEW.desactive := OLD.desactive;
      NEW.desactive_le := OLD.desactive_le;
      NEW.desactive_par := OLD.desactive_par;
      NEW.exclue_vitrine := OLD.exclue_vitrine;
    else
      NEW.premiere_publication_faite := false;
      NEW.raison_refus := null;
      NEW.en_attente_validation := false;
      NEW.desactive := false;
      NEW.desactive_le := null;
      NEW.desactive_par := null;
      NEW.exclue_vitrine := false;
    end if;
  end if;

  -- (L-2) mineure si la nouvelle date OU l'ancienne le dit
  if NEW.date_naissance is not null and extract(year from age(NEW.date_naissance)) < 18 then
    est_mineur := true;
  end if;
  if tg_op = 'UPDATE' and OLD.date_naissance is not null and extract(year from age(OLD.date_naissance)) < 18 then
    est_mineur := true;
  end if;

  if NEW.published is true then
    if est_admin then
      NEW.en_attente_validation := false;
      NEW.premiere_publication_faite := true;
    elsif est_mineur or not coalesce(OLD.premiere_publication_faite, false) then
      NEW.published := false;
      NEW.en_attente_validation := true;
    end if;
  end if;

  return NEW;
end;
$$;
revoke all on function gerer_validation_publication() from public, anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Contrôle (à lire après « Run ») : 1 élément attendu
select 'Publication protégée installée : ' ||
  (select count(*) from pg_proc where proname = 'gerer_validation_publication' and prosrc like '%(L-2)%') || ' élément sur 1' as controle;
