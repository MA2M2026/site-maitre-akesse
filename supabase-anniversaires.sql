-- =====================================================================================
-- Extension 143 — Anniversaires automatiques des mannequins (01/11/2026, chantier 14, partie 3 ;
-- idée gardée par la propriétaire le 31/10/2026)
-- =====================================================================================
-- Chaque matin, le serveur du site (api/portail.js, tâche quotidienne de Vercel) demande la liste des
-- mannequins actives du registre qui fêtent leur anniversaire aujourd'hui (née un 29 février : le 28 les
-- années non bissextiles), leur envoie un e-mail (au parent pour une mineure) puis le note ici : le
-- message arrive alors dans l'application de la mannequin (et la notification sur son téléphone). Une
-- seule fois par an et par mannequin. Seul le serveur (clé serveur) appelle ces fonctions.
-- À coller en entier dans Supabase › SQL Editor › Run. Aucune donnée existante touchée ; rejouable.

create table if not exists anniversaires_envoyes (
  mannequin_id uuid not null references agence_mannequins(id) on delete cascade,
  annee int not null,
  envoye_le timestamptz not null default now(),
  email_ok boolean,
  primary key (mannequin_id, annee)
);
alter table anniversaires_envoyes enable row level security;
revoke all on anniversaires_envoyes from anon, authenticated;

-- Les anniversaires du jour pas encore souhaités (date du jour à Abidjan = heure universelle)
create or replace function anniversaires_du_jour()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', a.id, 'nom', a.full_name, 'email', a.email, 'telephone', a.telephone,
      'date_naissance', a.date_naissance, 'parent_nom', a.parent_nom, 'parent_email', a.parent_email, 'parent_telephone', a.parent_telephone)
      order by a.full_name), '[]'::json)
  from agence_mannequins a
  where a.statut = 'actif' and a.date_naissance is not null
    and (to_char(a.date_naissance, 'MM-DD') = to_char(current_date, 'MM-DD')
      -- né un 29 février : fêté le 28 février les années non bissextiles
      or (to_char(a.date_naissance, 'MM-DD') = '02-29' and to_char(current_date, 'MM-DD') = '02-28'
          and extract(day from make_date(extract(year from current_date)::int, 3, 1) - 1) = 28))
    and not exists (select 1 from anniversaires_envoyes e where e.mannequin_id = a.id and e.annee = extract(year from current_date)::int);
$$;

-- Noter l'anniversaire souhaité (une fois par an) et déposer le message dans l'application ; vrai si
-- c'était la première fois cette année.
create or replace function anniversaire_noter(p_mannequin uuid, p_titre text, p_texte text, p_email_ok boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  an int := extract(year from current_date)::int;
  compte uuid;
begin
  insert into anniversaires_envoyes (mannequin_id, annee, email_ok) values (p_mannequin, an, p_email_ok)
  on conflict (mannequin_id, annee) do nothing;
  if not found then return false; end if;
  select user_id into compte from agence_mannequins where id = p_mannequin;
  -- (app_message_auto, supabase-app-messages.sql : jamais d'erreur qui bloquerait l'envoi)
  if compte is not null then
    perform app_message_auto(compte, 'anniversaire-' || p_mannequin || '-' || an, 'info', p_titre, p_texte, '/app/');
  end if;
  return true;
end;
$$;

revoke all on function anniversaires_du_jour(), anniversaire_noter(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function anniversaires_du_jour(), anniversaire_noter(uuid, text, text, boolean) to service_role;

NOTIFY pgrst, 'reload schema';
