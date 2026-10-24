-- Essais de supabase-photos-petites.sql : la petite version suit la photo de couverture.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'petite@test.ci') on conflict do nothing;
insert into model_profiles (id, full_name, category, published) values ('00000000-0000-0000-0000-0000000000d1', 'PETITE ESSAI', 'femme', true) on conflict (id) do update set published = true;
delete from model_photos where model_id = '00000000-0000-0000-0000-0000000000d1';
insert into model_photos (model_id, url, url_miniature, url_petite, principale, created_at) values
  ('00000000-0000-0000-0000-0000000000d1', 'https://x/o1.jpg', 'https://x/miniatures/1-n800-w.jpg', 'https://x/petites/1-n480-w.jpg', true, now()),
  ('00000000-0000-0000-0000-0000000000d1', 'https://x/o2.jpg', null, 'https://x/petites/2-n480-w.jpg', false, now() - interval '1 day');
set role anon;
select essai((select url_petite from photos_couverture_petites(array['00000000-0000-0000-0000-0000000000d1'::uuid])) = 'https://x/petites/1-n480-w.jpg', 'visiteur : photo principale avec sa petite version');
select essai((select url from photos_couverture_petites(array['00000000-0000-0000-0000-0000000000d1'::uuid])) = (select url from photos_couverture_mannequins(array['00000000-0000-0000-0000-0000000000d1'::uuid])), 'même photo que l''ancienne fonction');
reset role;
update model_photos set url_miniature = null where model_id = '00000000-0000-0000-0000-0000000000d1';
select essai((select url_petite from photos_couverture_petites(array['00000000-0000-0000-0000-0000000000d1'::uuid])) is null, 'sans miniature : pas de petite version (la photo d''origine reste)');
