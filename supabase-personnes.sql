-- Ajouter une personne (23/10/2026, demande de la propriétaire) : dans les Places limitées et les
-- Convocations, le site demande d'abord « mannequin de l'agence » ou « mannequin extérieure ».
--  - De l'agence : elle entre dans le registre (agence_mannequins, espace Paiements : inscription,
--    mensualités), sans compte sur le site (son code d'accès se donne ensuite, comme d'habitude),
--    et dans le carnet des Convocations (contacts_externes.mannequin_id). Parent FACULTATIF (nom et
--    WhatsApp) : rempli, le message part à la mannequin ET au parent.
--  - Extérieure (partenaire, toujours majeure) : seulement dans le carnet, jamais comptée avec nos
--    mannequins ; on la retrouve dans « Mannequins extérieures » avec les projets faits avec elle.
-- La page « Confirmer ma présence » dit aussi si l'enfant ou le parent a déjà répondu.
-- À exécuter une fois dans Supabase (SQL Editor), après supabase-convocations.sql et
-- supabase-places.sql. Rejouable.

-- 1) Le parent dans le carnet ; l'enfant et son parent : deux participants d'un même projet
alter table contacts_externes add column if not exists parent_nom text check (parent_nom is null or length(parent_nom) <= 160);
alter table contacts_externes add column if not exists parent_telephone text check (parent_telephone is null or length(parent_telephone) <= 40);
drop index if exists convocation_participants_contact;
create unique index if not exists convocation_participants_contact_parent on convocation_participants (projet_id, contact_id, parent) where contact_id is not null;

-- 2) Ajouter une personne (agence → registre + carnet ; extérieure → carnet). Réservé à l'agence.
--    Renvoie { contact_id, mannequin_id }.
create or replace function personne_ajouter(p_agence boolean, p_civilite text, p_nom text, p_telephone text,
                                            p_parent_nom text default null, p_parent_telephone text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  reg uuid;
  contact uuid;
  nom text := trim(coalesce(p_nom, ''));
  pnom text := nullif(trim(coalesce(p_parent_nom, '')), '');
  ptel text := nullif(trim(coalesce(p_parent_telephone, '')), '');
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then raise exception 'Réservé à l''agence.'; end if;
  if length(nom) not between 2 and 120 then raise exception 'Indiquez le nom complet.'; end if;
  if p_civilite is not null and p_civilite not in ('Madame', 'Mademoiselle', 'Monsieur') then raise exception 'Civilité inconnue.'; end if;
  if coalesce(p_telephone, '') !~ '^[0-9]{8,15}$' then raise exception 'Le numéro WhatsApp n''est pas valable.'; end if;
  if (pnom is null) <> (ptel is null) then raise exception 'Pour le parent, indiquez son nom ET son numéro WhatsApp (ou aucun des deux).'; end if;
  if ptel is not null and ptel !~ '^[0-9]{8,15}$' then raise exception 'Le numéro WhatsApp du parent n''est pas valable.'; end if;
  if not p_agence and ptel is not null then raise exception 'Une mannequin extérieure est majeure : pas de parent.'; end if;
  if p_agence then
    insert into agence_mannequins (full_name, genre, telephone, parent_nom, parent_telephone, notes)
      values (nom, case when p_civilite = 'Monsieur' then 'homme' else 'femme' end, p_telephone, pnom, ptel,
              'Ajoutée depuis un projet (Places limitées ou Convocations), sans compte sur le site.')
      returning id into reg;
  end if;
  insert into contacts_externes (civilite, nom, telephone, parent_nom, parent_telephone, mannequin_id)
    values (p_civilite, nom, p_telephone, pnom, ptel, reg)
    returning id into contact;
  return jsonb_build_object('contact_id', contact, 'mannequin_id', reg);
end;
$$;
revoke all on function personne_ajouter(boolean, text, text, text, text, text) from public, anon;
grant execute on function personne_ajouter(boolean, text, text, text, text, text) to authenticated;

-- 3) Une mannequin du registre (sans compte) qui prend sa place : fiche dans le carnet (une seule
--    par mannequin) et participant(s) du projet, pour la convocation. Parent connu et mineure (ou
--    âge inconnu) : la mannequin ET son parent sont participants (même projet, deux messages).
create or replace function places_participant_registre(p_projet uuid, p_mannequin uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r agence_mannequins;
  contact uuid;
  part uuid;
  avec_parent boolean;
  civ text;
begin
  select * into r from agence_mannequins where id = p_mannequin;
  if not found then return null; end if;
  avec_parent := r.parent_telephone is not null
    and (r.date_naissance is null or r.date_naissance > current_date - interval '18 years');
  civ := case when r.genre = 'homme' then 'Monsieur' else 'Mademoiselle' end;
  select id into contact from contacts_externes where mannequin_id = r.id;
  if contact is null then
    insert into contacts_externes (civilite, nom, telephone, email, parent_nom, parent_telephone, mannequin_id)
      values (civ, left(trim(r.full_name), 120), left(r.telephone, 40), left(r.email, 160), left(r.parent_nom, 160), left(r.parent_telephone, 40), r.id)
      returning id into contact;
  end if;
  -- la mannequin elle-même (si elle a un numéro ou une adresse)
  if r.telephone is not null or r.email is not null then
    select id into part from convocation_participants where projet_id = p_projet and contact_id = contact and not parent;
    if part is null then
      insert into convocation_participants (projet_id, contact_id, nom, email, telephone, parent)
        values (p_projet, contact, left(trim(civ || ' ' || r.full_name), 160), left(r.email, 160), left(r.telephone, 40), false)
        returning id into part;
    end if;
  end if;
  -- son parent
  if avec_parent and not exists (select 1 from convocation_participants where projet_id = p_projet and contact_id = contact and parent) then
    insert into convocation_participants (projet_id, contact_id, nom, email, telephone, parent, parent_nom)
      values (p_projet, contact, left(trim(civ || ' ' || r.full_name), 160), left(r.parent_email, 160), left(r.parent_telephone, 40), true, left(r.parent_nom, 160));
  end if;
  return part;
end;
$$;
revoke all on function places_participant_registre(uuid, uuid) from public, anon, authenticated;

-- 4) Page publique « Confirmer ma présence » : en plus, la réponse déjà donnée par l'autre
--    personne du même groupe (l'enfant ou son parent), pour lui dire « … a déjà répondu ».
drop function if exists convocation_lire(text);
create or replace function convocation_lire(p_jeton text)
returns table(titre text, type text, date_debut date, date_fin date, heure_convocation text, lieu text, ville text, nom text, parent boolean, reponse text, passe boolean, autre_reponse text)
language sql stable security definer set search_path = public as $$
  select a.titre, a.type, a.date_debut, a.date_fin, a.heure_convocation, a.lieu, a.ville, cp.nom, cp.parent, cp.reponse,
         coalesce(a.date_fin, a.date_debut) < current_date,
         (select o.reponse from convocation_participants o
           where o.projet_id = cp.projet_id and o.id <> cp.id and o.parent <> cp.parent and o.reponse is not null
             and ((cp.model_id is not null and o.model_id = cp.model_id) or (cp.contact_id is not null and o.contact_id = cp.contact_id))
           order by o.repondu_le desc limit 1)
  from convocation_participants cp join agenda_projets a on a.id = cp.projet_id
  where length(coalesce(p_jeton, '')) = 36 and cp.jeton = p_jeton and not a.annule;
$$;
revoke all on function convocation_lire(text) from public;
grant execute on function convocation_lire(text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
