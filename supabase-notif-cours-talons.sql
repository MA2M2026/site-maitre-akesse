-- =====================================================================================================
-- Notification sur le téléphone à chaque inscription au cours de talons (13/11/2026, demande de la
-- propriétaire : l'e-mail arrivait, pas la notification). Utilise la fonction notifier_push_notification
-- déjà installée pour les castings (Extension 107) : aucun secret à remplir.
-- À COLLER UNE FOIS dans Supabase (SQL Editor), bouton orange « Run without RLS » s'il est proposé.
-- Rien n'est effacé, peut être recollé sans risque.
-- =====================================================================================================

drop trigger if exists trg_notif_cours_talons on cours_talons;
create trigger trg_notif_cours_talons
  after insert on cours_talons
  for each row execute function notifier_push_notification();

insert into notifications_reglages (cle, actif) values ('evenement_cours_talons', true)
on conflict (cle) do nothing;

NOTIFY pgrst, 'reload schema';
select 'Notification des inscriptions au cours de talons en place' as resultat;
