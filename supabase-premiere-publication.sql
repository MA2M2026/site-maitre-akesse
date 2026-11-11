-- =====================================================================================
-- Extension 161 — Mannequins jamais publiés bloqués sans « Récapitulatif » (11/11/2026, signalé par la propriétaire)
-- =====================================================================================
-- Constat : certaines mannequins (ex. une New Face au profil complet à 100 %) voyaient l'écran « Modifier bloc par
-- bloc » (réservé aux profils déjà validés une fois) au lieu des 6 étapes avec le Récapitulatif et le bouton qui envoie
-- le profil à l'agence. Elles ne pouvaient donc jamais demander leur mise en ligne.
-- Cause : le rattrapage de l'Extension 43 (premiere_publication_faite = true pour tout profil « nom + une photo + une
-- expérience », même jamais publié). Ces profils ne sont pas en ligne et n'ont jamais été validés par l'agence.
-- Correctif (données seulement, aucune règle ni droit changé) : premiere_publication_faite repasse à false pour les
-- profils NON publiés et NON mis en sourdine. Elles retrouvent les 6 étapes → Récapitulatif → « Soumettre » → la
-- demande arrive dans la file de validation de l'Administration, comme pour toute première publication.
-- Rien n'est effacé (photos, expériences, mensurations restent). Rejouable.
-- À coller en entier dans Supabase › SQL Editor › Run.

-- 1. Avant : la liste des profils concernés (pour information)
select full_name, created_at::date as inscrite_le, en_attente_validation as deja_en_attente, (raison_refus is not null) as correction_demandee
from model_profiles
where premiere_publication_faite and not published and not coalesce(desactive, false)
order by full_name;

-- 2. Correction
update model_profiles
set premiere_publication_faite = false
where premiere_publication_faite and not published and not coalesce(desactive, false);

NOTIFY pgrst, 'reload schema';

-- 3. Contrôle final : une ligne « ✅ » attendue
select case when count(*) = 0 then '✅ Extension 161 : plus aucun profil non publié bloqué en mode « déjà validé »'
            else '❌ Extension 161 : ' || count(*) || ' profil(s) encore concerné(s)' end as controle
from model_profiles
where premiere_publication_faite and not published and not coalesce(desactive, false);
