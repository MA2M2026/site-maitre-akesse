-- =====================================================================================
-- Extension 151 — Textes des pages modifiables depuis l'Administration (01/11/2026, étape C du site
-- dynamique, décision de la propriétaire : Services, Qui sommes-nous, Intégrer l'agence, Mentions légales,
-- Politique de confidentialité).
-- =====================================================================================
-- Chaque texte simple de ces pages porte un repère (data-texte="services-12", scripts/textes-pages.py).
-- textes_pages garde, pour un repère, le texte choisi dans Administration › Textes des pages (français et/ou
-- anglais) ; le serveur du site (middleware.js) le pose dans la page avant de l'envoyer. Sans ligne ici, ou
-- avec un texte vide, la page garde son texte d'origine. Du texte seul (jamais de code : le serveur l'échappe).
-- Lecture : tout le monde (ce sont des textes publics). Écriture : l'équipe du site, par textes_pages_enregistrer.
-- Ajout seulement : aucune donnée existante n'est modifiée. À coller dans Supabase › SQL Editor › Run ; rejouable.

create table if not exists textes_pages (
  page text not null check (page in ('services', 'qui-sommes-nous', 'integrer-agence', 'mentions-legales', 'politique-confidentialite')),
  cle text not null check (cle ~ '^[a-z-]+-[0-9]{1,3}$'),
  fr text check (fr is null or length(fr) <= 4000),
  en text check (en is null or length(en) <= 4000),
  maj timestamptz not null default now(),
  par uuid references auth.users(id) on delete set null default auth.uid(),
  primary key (page, cle),
  check (left(cle, length(page) + 1) = page || '-')
);
alter table textes_pages enable row level security;
revoke all on textes_pages from anon, authenticated;
grant select (page, cle, fr, en, maj) on textes_pages to anon, authenticated;
drop policy if exists "Textes des pages : lecture publique" on textes_pages;
create policy "Textes des pages : lecture publique" on textes_pages for select using (true);

-- Écriture : par cette seule fonction, pour l'équipe du site. p_textes : [{cle, fr, en}, …] d'UNE page ;
-- un texte vide (ou null) = texte d'origine de la page (la ligne garde l'autre langue).
create or replace function textes_pages_enregistrer(p_page text, p_textes jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  t jsonb;
  n integer := 0;
  v_fr text;
  v_en text;
begin
  if not portail_peut('site') then raise exception 'Accès refusé.'; end if;
  if jsonb_typeof(p_textes) <> 'array' or jsonb_array_length(p_textes) > 300 then raise exception 'Liste de textes invalide.'; end if;
  for t in select * from jsonb_array_elements(p_textes) loop
    v_fr := nullif(btrim(coalesce(t->>'fr', ''), E' \t\r\n'), '');
    v_en := nullif(btrim(coalesce(t->>'en', ''), E' \t\r\n'), '');
    insert into textes_pages (page, cle, fr, en) values (p_page, t->>'cle', v_fr, v_en)
    on conflict (page, cle) do update set fr = excluded.fr, en = excluded.en, maj = now(), par = auth.uid();
    n := n + 1;
  end loop;
  delete from textes_pages where page = p_page and fr is null and en is null;
  perform journaliser('Textes de la page modifiés', 'textes_pages', p_page, null, json_build_object('textes', n)::jsonb);
  return n;
end;
$$;
revoke all on function textes_pages_enregistrer(text, jsonb) from public, anon;
grant execute on function textes_pages_enregistrer(text, jsonb) to authenticated;

NOTIFY pgrst, 'reload schema';
