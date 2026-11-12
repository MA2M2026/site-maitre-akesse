-- =====================================================================================================
-- Registre des messages envoyés aux candidat(e)s (12/11/2026, demande de la propriétaire : « que le
-- système nous dise s'il a déjà reçu un message : l'information "vous êtes retenu", la convocation, la
-- relance »). Une ligne par message parti (e-mail envoyé, ou WhatsApp ouvert avec le message prêt).
--
-- À COLLER UNE FOIS dans Supabase : SQL Editor → New query → coller tout → Run. Sans danger : ne touche
-- à aucune table existante, peut être recollé (create … if not exists / drop policy if exists).
-- Droits : seuls les administrateurs de l'agence (table admins, comme pour les candidatures) lisent et
-- ajoutent ; personne ne modifie ni n'efface (c'est un historique) ; le public n'y a aucun accès.
-- Une candidature supprimée emporte ses lignes (on delete cascade).
-- =====================================================================================================

create table if not exists messages_candidats (
  id uuid primary key default gen_random_uuid(),
  candidature_id uuid not null references casting_applications(id) on delete cascade,
  -- information : 1er message d'un statut (retenue, refusée, à revoir, en attente) ; convocation ; relance ;
  -- contact : conversation WhatsApp ouverte sans message prêt ; libre : message écrit à la main
  sorte text not null check (sorte in ('information', 'convocation', 'relance', 'contact', 'libre')),
  canal text not null check (canal in ('whatsapp', 'email')),
  modele text check (modele is null or length(modele) <= 60),   -- clé du message (js/messages-candidats.js)
  envoye_le timestamptz not null default now(),
  envoye_par uuid default auth.uid() references auth.users(id) on delete set null
);
create index if not exists messages_candidats_candidature on messages_candidats (candidature_id, envoye_le desc);

alter table messages_candidats enable row level security;
revoke all on messages_candidats from anon, authenticated;
grant select, insert on messages_candidats to authenticated;

drop policy if exists messages_candidats_lecture on messages_candidats;
create policy messages_candidats_lecture on messages_candidats for select
  using (exists (select 1 from admins where admins.user_id = auth.uid()));

drop policy if exists messages_candidats_ajout on messages_candidats;
create policy messages_candidats_ajout on messages_candidats for insert
  with check (exists (select 1 from admins where admins.user_id = auth.uid()) and envoye_par = auth.uid());
