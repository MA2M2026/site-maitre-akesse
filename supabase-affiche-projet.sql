-- =====================================================================================
-- Extension 162 — Affiche ou photo jointe aux convocations d'un projet (11/11/2026, maquette validée par la propriétaire)
-- =====================================================================================
-- Demande : « quand on envoie les messages aux mannequins, pouvoir joindre une image, par exemple l'affiche du
-- défilé ». Dans Convocations, une case « Affiche ou photo (facultatif) » : l'image est gardée avec le projet,
-- dans cette nouvelle colonne. Les messages de convocation (WhatsApp, e-mails envoyés tout de suite ET e-mails
-- programmés envoyés par le serveur) ajoutent un lien « Voir l'affiche » ; envoyés tout de suite, ils partent aussi
-- dans l'application des mannequins avec l'affiche en grand.
-- Une seule colonne ajoutée (adresse https de l'image sur Cloudflare R2, ou vide). Aucun droit, aucune règle de
-- sécurité (RLS) ni aucun déclencheur n'est changé : la colonne suit les droits déjà en place sur agenda_projets.
-- Rejouable. À coller en entier dans Supabase › SQL Editor › Run.

alter table agenda_projets add column if not exists affiche text
  check (affiche is null or (affiche ~ '^https://' and length(affiche) <= 500));

NOTIFY pgrst, 'reload schema';

-- Contrôle final : une ligne « ✅ » attendue
select case when exists (select 1 from information_schema.columns where table_name = 'agenda_projets' and column_name = 'affiche')
            then '✅ Extension 162 : l’affiche des projets est prête (Convocations › Affiche ou photo)'
            else '❌ Extension 162 : la colonne affiche est absente' end as controle;
