-- Étape 1 de la mise en ligne (19/10/2026) : RELEVÉ du nombre de lignes de chaque table.
-- Ce texte ne modifie RIEN : il compte seulement. À coller dans Supabase › SQL Editor › Run.
-- Faire une capture d'écran du résultat : on le comparera après la mise à jour.
select tablename as "table",
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', tablename), false, true, '')))[1]::text::bigint as "lignes"
from pg_tables where schemaname = 'public'
order by tablename;
