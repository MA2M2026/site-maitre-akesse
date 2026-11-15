-- Efface la fausse inscription « ESSAI NOTIFICATION » de l'essai de la notification de la veille (15/11/2026).
-- Rien d'autre n'est touché.
delete from cours_talons_rappels where nom = 'Mme ESSAI NOTIFICATION';
delete from cours_talons_seances where inscription_id = '3519841a-64d2-461d-a405-886e5a85c7e0';
delete from cours_talons where id = '3519841a-64d2-461d-a405-886e5a85c7e0' and nom = 'ESSAI NOTIFICATION';
select 'Essai effacé : ' || (
  (select count(*) from cours_talons where nom = 'ESSAI NOTIFICATION') +
  (select count(*) from cours_talons_seances where theme = 'Essai de notification') +
  (select count(*) from cours_talons_rappels where nom like '%ESSAI%')) || ' reste (attendu 0)' as controle;
