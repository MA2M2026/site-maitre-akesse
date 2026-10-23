-- Cachet d'une mannequin mineure versé sur le Wave de son parent (23/10/2026, demande de la
-- propriétaire). Le cachet garde le nom du parent qui a reçu l'argent (cachets_mannequins.parent_nom ;
-- le numéro payé est dans « telephone ») ; s'il manquait, le nom et le numéro Wave du parent saisis
-- dans « Payer les mannequins » sont enregistrés dans le registre (agence_mannequins) et, si elle a
-- un compte sur le site, sur sa fiche (contacts_parents). Seulement pour une mineure ; un numéro de
-- parent déjà enregistré ne se change que depuis les Paiements (ou par l'administrateur principal).
-- À exécuter une fois dans Supabase (SQL Editor), après supabase-cachets.sql. Rejouable.

alter table cachets_mannequins add column if not exists parent_nom text
  check (parent_nom is null or length(parent_nom) <= 160);

create or replace function cachet_enregistrer_parent(p_mannequin uuid, p_nom text, p_telephone text)
returns void language plpgsql security definer set search_path = public as $$
declare
  compte uuid;
  m agence_mannequins;
begin
  if not (portail_peut('compta') or portail_peut('paiements')) then raise exception 'Action refusée : votre rôle ne le permet pas.'; end if;
  select * into m from agence_mannequins where id = p_mannequin;
  if not found then raise exception 'Mannequin introuvable dans le registre.'; end if;
  -- seulement pour une mineure (son cachet est versé au parent)
  if m.date_naissance is null or m.date_naissance <= current_date - interval '18 years' then raise exception 'Seul le parent d''une mannequin mineure s''enregistre ici.'; end if;
  -- un numéro de parent déjà enregistré ne se change que depuis les Paiements (ou par le principal)
  if not portail_peut('paiements') and m.parent_telephone is not null and m.parent_telephone <> p_telephone then
    raise exception 'Le numéro du parent est déjà enregistré : il se change depuis la fiche des Paiements.';
  end if;
  if length(trim(coalesce(p_nom, ''))) not between 2 and 160 then raise exception 'Indiquez le nom du parent.'; end if;
  if coalesce(p_telephone, '') !~ '^[0-9]{8,15}$' then raise exception 'Le numéro Wave du parent n''est pas valable.'; end if;
  update agence_mannequins set parent_nom = trim(p_nom), parent_telephone = p_telephone
    where id = p_mannequin
    returning user_id into compte;
  if not found then raise exception 'Mannequin introuvable dans le registre.'; end if;
  if compte is not null and exists (select 1 from model_profiles where id = compte) then
    insert into contacts_parents (model_id, parent_nom, parent_telephone, mis_a_jour)
      values (compte, trim(p_nom), p_telephone, now())
      on conflict (model_id) do update set parent_nom = excluded.parent_nom, parent_telephone = excluded.parent_telephone, mis_a_jour = now();
  end if;
end;
$$;
revoke all on function cachet_enregistrer_parent(uuid, text, text) from public, anon;
grant execute on function cachet_enregistrer_parent(uuid, text, text) to authenticated;

NOTIFY pgrst, 'reload schema';
