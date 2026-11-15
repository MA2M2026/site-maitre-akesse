-- Petit ajout (14/11/2026, accord de la propriétaire) : le programme de formation (les 27 thèmes) devient lisible sans
-- compte, pour l'écran « Merci » de l'inscription des nouveaux mannequins. Rien n'est effacé. Rejouable.
-- (Déjà repris dans supabase-programme-mannequins.sql.)
grant select on formation_programme to anon;
drop policy if exists "Programme de formation : lu par les comptes" on formation_programme;
drop policy if exists "Programme de formation : public" on formation_programme;
create policy "Programme de formation : public" on formation_programme for select using (true);
NOTIFY pgrst, 'reload schema';
select 'Programme lisible par tous : ' || (select count(*) from pg_policies where tablename = 'formation_programme' and policyname = 'Programme de formation : public') || ' sur 1' as controle;
