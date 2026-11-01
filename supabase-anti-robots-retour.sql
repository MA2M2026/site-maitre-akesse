-- Retour en arrière de supabase-anti-robots.sql (Extension 152) : les visiteurs écrivent de nouveau directement,
-- avec les règles d'avant (supabase-extension.sql). À coller seulement si l'anti-robots bloque de vrais visiteurs.
drop policy if exists "Tout le monde peut candidater" on casting_applications;
create policy "Tout le monde peut candidater" on casting_applications for insert
  with check (limiter_soumissions_publiques('candidature') and status = 'nouvelle' and (type_candidature <> 'projet' or casting_ouvert()));
drop policy if exists "Tout le monde peut envoyer une demande de casting" on recruiter_requests;
create policy "Tout le monde peut envoyer une demande de casting" on recruiter_requests for insert
  with check (limiter_soumissions_publiques_ip('recruteur', 30, 3) and status = 'nouvelle');
drop policy if exists "Tout le monde peut envoyer un message de contact" on messages_contact;
create policy "Tout le monde peut envoyer un message de contact" on messages_contact for insert
  with check (limiter_soumissions_publiques_ip('contact', 30, 3));
drop policy if exists "Mannequins d'une demande toute récente" on recruiter_request_models;
create policy "Tout le monde peut ajouter des mannequins à une demande" on recruiter_request_models for insert with check (true);
NOTIFY pgrst, 'reload schema';
select 'Retour en arrière fait' as controle;
