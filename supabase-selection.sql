-- « Annoncer la sélection » (23/10/2026, demande de la propriétaire) : un premier message court
-- (félicitations, projet, date, heure, lieu, lien « Confirmez votre participation ») envoyé avant
-- la convocation détaillée. Il passe par les mêmes envois que les convocations (convocation_envois)
-- et le même serveur d'envoi programmé (api/portail.js) : seule la liste des sortes de message
-- s'agrandit. À exécuter une fois dans Supabase (SQL Editor), après supabase-convocations.sql.
do $$
declare
  nom text;
begin
  for nom in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.convocation_envois'::regclass and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%sorte%'
  loop
    execute format('alter table public.convocation_envois drop constraint %I', nom);
  end loop;
end $$;
alter table public.convocation_envois add constraint convocation_envois_sorte_check
  check (sorte in ('selection', 'convocation', 'rappel'));

NOTIFY pgrst, 'reload schema';
