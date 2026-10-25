-- =====================================================================================
-- Application MA2M Mannequin (25/10/2026, demande de la propriétaire) — étape 1
-- =====================================================================================
-- « Mes événements » : chaque mannequin connectée voit SES convocations, et seulement celles
-- que l'agence lui a déjà envoyées (au moins un message parti ou à envoyer à la main). Ni
-- adresse exacte, ni notes internes, ni coordonnées : les mêmes informations que sa page « Confirmer ma présence »,
-- plus son lien personnel (jeton) pour répondre (convocation_repondre) et voir le programme du
-- défilé (defile_programme). Profil du site : sa propre ligne (pas celle du parent) ; mannequin
-- du registre avec un compte : les convocations reçues par sa fiche du carnet.
-- À coller en entier dans Supabase › SQL Editor › Run. Aucune donnée touchée ; peut être rejoué.

-- (une seule ligne par projet : convoquée à la fois par son profil et par sa fiche du carnet,
-- c'est la convocation de son profil qui compte)
drop function if exists app_mes_evenements();
create or replace function app_mes_evenements()
returns table(jeton text, titre text, type text, date_debut date, date_fin date, heure_evenement text, heure_convocation text,
  lieu text, ville text, reponse text, passe boolean, defile boolean)
language sql stable security definer set search_path = public as $$
  select x.jeton, x.titre, x.type, x.date_debut, x.date_fin, x.heure_evenement, x.heure_convocation, x.lieu, x.ville, x.reponse, x.passe, x.defile
  from (
    select distinct on (a.id) cp.jeton, a.titre, a.type, a.date_debut, a.date_fin, a.heure_evenement, a.heure_convocation, a.lieu, a.ville, cp.reponse,
      coalesce(a.date_fin, a.date_debut) < current_date as passe,
      exists (select 1 from defile_passages dp where dp.projet_id = a.id) as defile
    from convocation_participants cp join agenda_projets a on a.id = cp.projet_id
    where auth.uid() is not null and not a.annule and not cp.parent
      and (cp.model_id = auth.uid()
        or cp.contact_id in (select c.id from contacts_externes c join agence_mannequins r on r.id = c.mannequin_id where r.user_id = auth.uid()))
      and exists (select 1 from convocation_envois e where e.participant_id = cp.id and e.statut in ('envoye', 'a_faire'))
      and coalesce(a.date_fin, a.date_debut) >= current_date - 180
    order by a.id, (cp.model_id is null), cp.created_at
  ) x
  order by x.date_debut, x.titre;
$$;
revoke all on function app_mes_evenements() from public, anon;
grant execute on function app_mes_evenements() to authenticated;

NOTIFY pgrst, 'reload schema';

-- Contrôle : doit afficher 1
select count(*) as fonction_app from pg_proc where proname = 'app_mes_evenements';
