-- Essais de supabase-cartes.sql (25/10/2026) : photos des cartes d'événement réservées à l'agence
-- avec le code ; personne d'autre (mannequin connectée, visiteur) ne les voit ni n'en dépose.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
select essai((select public from storage.buckets where id = 'cartes-photos') = false, 'stockage des photos de cartes : privé');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal2');
insert into cartes_photos (cle, chemin) values ('c:00000000-0000-0000-0000-0000000000c9', 'c-00000000-0000-0000-0000-0000000000c9/123-456.jpg');
insert into storage.objects (bucket_id, name) values ('cartes-photos', 'c-00000000-0000-0000-0000-0000000000c9/123-456.jpg');
select essai((select count(*) from cartes_photos) = 1 and (select count(*) from storage.objects where bucket_id = 'cartes-photos') = 1, 'agence avec le code : photo de carte déposée et lue');
select essai_refuse($$insert into cartes_photos (cle, chemin) values ('x:1', '../../secret.jpg')$$, 'clé ou chemin mal formé : refusé');
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal1');
select essai((select count(*) from cartes_photos) = 0 and (select count(*) from storage.objects where bucket_id = 'cartes-photos') = 0, 'sans le code : rien à lire');
select essai_refuse($$insert into cartes_photos (cle, chemin) values ('m:abc', 'm-abc/1-2-3-4.jpg')$$, 'sans le code : dépôt refusé');
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal2');
select essai((select count(*) from cartes_photos) = 0, 'mannequin connectée : rien à lire');
select essai_refuse($$insert into storage.objects (bucket_id, name) values ('cartes-photos', 'm-abc/1-2.jpg')$$, 'mannequin connectée : dépôt refusé');
reset role;
set role anon;
select essai_refuse($$select * from cartes_photos$$, 'visiteur : rien à lire');
reset role;
delete from storage.objects where bucket_id = 'cartes-photos';
delete from cartes_photos;
