-- =====================================================================================
-- Client d'un projet de l'agenda (24/10/2026, demande de la propriétaire)
-- =====================================================================================
-- Quand un client a fait sa sélection sur le site (Demandes recruteurs), l'agence crée le
-- projet et annonce la sélection : le message peut citer le client (« … pour *Marque X* »).
-- client : nom du client (interne, jamais montré sur le site public) ; citer_client : le citer
-- dans les messages aux mannequins (case du panneau des convocations, cochée d'office).
-- À coller en entier dans Supabase › SQL Editor › Run. Aucune donnée supprimée ; peut être rejoué.
alter table agenda_projets add column if not exists client text check (client is null or length(client) <= 160);
alter table agenda_projets add column if not exists citer_client boolean not null default true;
NOTIFY pgrst, 'reload schema';
