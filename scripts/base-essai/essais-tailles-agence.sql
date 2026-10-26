-- Grille de tailles de l'agence (supabase-tailles-agence.sql), femmes : règle n° 1 (une mesure
-- pile sur la limite reste dans la plus petite taille) et contrôle « mesures à reprendre ».
select essai(rang_taille(92, array[87,92,96,101,109,115,121]) = 1
  and rang_taille(96, array[87,92,96,101,109,115,121]) = 2 and rang_taille(107, array[87,92,96,101,109,115,121]) = 4,
  'limites : bassin 92 = XS, bassin 96 = S, bassin 107 = L');
select essai(not mesures_incoherentes('femme', 92, 73, 107), 'poitrine 92 (M) et bassin 107 (L) : cohérent (M-L)');
select essai(not mesures_incoherentes('femme', 85, 68, 95), 'poitrine 85 (S) et bassin 95 (S) : cohérent');
select essai(mesures_incoherentes('femme', 80, 62, 107), 'poitrine 80 (XS) et bassin 107 (L) : 3 tailles d''écart, à reprendre');
select essai(mesures_incoherentes('femme', 99, 70, 88), 'poitrine 99 (L) et bassin 88 (XS) : bas plus petit de 3 tailles, à reprendre');
select essai(mesures_incoherentes('homme', 84, 80, null) and not mesures_incoherentes('homme', 96, 80, null), 'hommes : grille inchangée (comme js/tailles.js)');
